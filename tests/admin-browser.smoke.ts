// Runs the actual production Next build and real routes. Only the external
// Auth/Data HTTP boundary is simulated, backed by isolated PostgreSQL + RLS.
// No production users, provider secrets, DOM replacements, or UI mocks.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer,type Server} from "node:http";
import {once} from "node:events";
import {spawn} from "node:child_process";
import {mkdirSync} from "node:fs";
import {join} from "node:path";
import {createServerClient} from "@supabase/ssr";
import {chromium,webkit,expect as baseExpect} from "@playwright/test";
import {v051Database} from "./helpers/v051-database";
import {asUser,fixtureId as id} from "./helpers/database";
import {controlCopy} from "../src/lib/admin-control";
const expect=baseExpect.configure({timeout:15000});
async function listening(server:Server){server.listen(0,"127.0.0.1");await once(server,"listening");const addr=server.address();assert.ok(addr&&typeof addr!=="string");return addr.port;}
test("Actual Next admin: protected routes, persistent streamed shell, RLS-backed filters and Chromium/WebKit responsive navigation",{timeout:240000},async t=>{
 const db=await v051Database();
 const uid=id(1),student=id(2),tokens=new Map<string,string>(),requests:{table:string;section?:string;at:number}[]=[];
 const makeToken=(user:string)=>{const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")+"."+Buffer.from(JSON.stringify({sub:user,role:"authenticated",exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString("base64url")+".fixture-not-a-real-signature";tokens.set(token,user);return token;};
 const adminToken=makeToken(uid),studentToken=makeToken(student);
 await db.exec(`insert into auth.users(id) values('${uid}'),('${student}');update profiles set role='admin',display_name='Demo Admin' where id='${uid}';update profiles set display_name='Demo Student' where id='${student}';
  insert into classes(id,name,grade,section) values('${id(10)}','9H',9,'H'),('${id(11)}','9G',9,'G');update profiles set class_id='${id(10)}';
  insert into subjects(id,name,name_ru,name_kz,name_en) values('${id(20)}','Mathematics','Математика','Математика','Mathematics');
  insert into weekly_schedule(class_id,subject_id,weekday,lesson_start,lesson_end,start_time,end_time,room) values('${id(10)}','${id(20)}',1,1,2,'08:30','10:10','305');
  insert into class_homework(id,class_id,subject_id,due_date,body,created_by) values('${id(30)}','${id(10)}','${id(20)}',current_date,'Safe demonstration homework. No personal data.','${student}');
  insert into user_activity_logs(user_id,path,user_agent) values('${student}','/schedule','iPhone Safari/605');`);
 // Serialize test DB role changes only. Production uses real independent DB
 // transactions; this queue is NOT part of the application or its caches.
 let queue=Promise.resolve();const locked=async<T>(user:string,fn:()=>Promise<T>)=>{const before=queue;let release!:()=>void;queue=new Promise<void>(r=>{release=r;});await before;try{await asUser(db,user);return await fn();}finally{release();}};
 const tables=new Set(["profiles","classes","subjects","books","book_variants","weekly_schedule","non_school_days","edupage_sync_state","schedule_import_batches","support_tickets","community_reports"]);
 const dataServer=createServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");
  const url=new URL(req.url!,"http://fixture"),user=tokens.get((req.headers.authorization??"").replace(/^Bearer /,""));
  if(!user){res.statusCode=401;res.end(JSON.stringify({code:"fixture_auth_required",message:"Unauthorized"}));return;}
  try{
   if(url.pathname==="/auth/v1/user"){requests.push({table:"auth",at:Date.now()});res.end(JSON.stringify({id:user,aud:"authenticated",role:"authenticated",email:"fixture@example.invalid",email_confirmed_at:"2026-10-01T00:00:00Z",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},identities:[],created_at:"2026-10-01T00:00:00Z"}));return;}
   const route=url.pathname.split("/").pop()!;
   if(url.pathname.startsWith("/rest/v1/rpc/")){
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(chunk);const args=JSON.parse(Buffer.concat(chunks).toString()||"{}");
    requests.push({table:route,section:args.p_section,at:Date.now()});
    if(route==="admin_control_read"){
     if(args.p_section==="chart")await new Promise(r=>setTimeout(r,900));
     const value=await locked(user,async()=>(await db.query<{value:unknown}>("select admin_control_read($1,$2::jsonb) value",[args.p_section,JSON.stringify(args.p_filters??{})])).rows[0].value);res.end(JSON.stringify(value));return;
    }
    if(route==="log_user_activity"){await locked(user,()=>db.query("select log_user_activity($1,$2)",[args.p_path,args.p_user_agent]));res.end("null");return;}
    if(route==="admin_update_user"){await locked(user,()=>db.query("select admin_update_user($1,$2,$3,$4,$5)",[args.p_user,args.p_class,args.p_role,args.p_expected_role,args.p_confirm]));res.end("null");return;}
    if(route==="moderate_class_homework"){await locked(user,()=>db.query("select moderate_class_homework($1)",[args.p_id]));res.end("null");return;}
    res.statusCode=400;res.end('{"code":"fixture_rpc_unavailable"}');return;
   }
   if(!tables.has(route)||req.method!=="GET"){res.statusCode=404;res.end("{}");return;}
   requests.push({table:route,at:Date.now()});
   const select=url.searchParams.get("select")??"*";assert.match(select,/^(?:\*|[a-z_]+(?:,[a-z_]+)*)$/);
   const values:unknown[]=[],where:string[]=[];
   for(const [key,value]of url.searchParams){if(["select","order","offset","limit"].includes(key))continue;assert.match(key,/^[a-z_]+$/);
    if(value.startsWith("eq.")){values.push(value.slice(3));where.push(`"${key}"=$${values.length}`);}else if(value==="is.null")where.push(`"${key}" is null`);else throw new Error("Unsupported fixture filter");
   }
   const order=url.searchParams.get("order"),orderSql=order?" order by "+order.split(",").map(term=>{assert.match(term,/^[a-z_]+(?:\.(?:asc|desc))?(?:\.nulls(?:first|last))?$/);const[col,dir]=term.split(".");return `"${col}" ${dir==="desc"?"desc":"asc"}`;}).join(","):"";
   const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??1000);assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(limit)&&limit>=0&&limit<=1000);
   const filter=where.length?" where "+where.join(" and "):"";
   const result=await locked(user,()=>db.query(`select ${select} from public."${route}"${filter}${orderSql} limit ${limit} offset ${offset}`,values));
   res.setHeader("Content-Range",`${offset}-${offset+result.rows.length-1}/${result.rows.length}`);
   if(String(req.headers.accept).includes("vnd.pgrst.object")){if(result.rows.length!==1){res.statusCode=406;res.end('{"code":"PGRST116"}');return;}res.end(JSON.stringify(result.rows[0]));}else res.end(JSON.stringify(result.rows));
  }catch{res.statusCode=400;res.end('{"code":"fixture_rejected","message":"Test boundary rejected request"}');}
 });
 const dataPort=await listening(dataServer),supabaseOrigin=`http://127.0.0.1:${dataPort}`;
 const reserve=createServer(),port=await listening(reserve);await new Promise<void>(r=>reserve.close(()=>r()));
 const origin=`http://127.0.0.1:${port}`,artifacts=join("test-results","admin-control");mkdirSync(artifacts,{recursive:true});
 const app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p",String(port)],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:supabaseOrigin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture_only",NEXT_PUBLIC_SUPABASE_ANON_KEY:"",NEXT_PUBLIC_SITE_URL:"https://nis-hub-ura.vercel.app",TELEGRAM_BOT_TOKEN:"",TELEGRAM_WEBHOOK_SECRET:"",SUPABASE_SERVICE_ROLE_KEY:"",GEMINI_API_KEY:"",AI_STUDY_ENABLED:"false",EDUPAGE_TIMETABLE_ENABLED:"false",NODE_ENV:"production"},stdio:["ignore","pipe","pipe"]});
 let output="";app.stdout.on("data",v=>{output+=v.toString();});app.stderr.on("data",v=>{output+=v.toString();});
 try{
  for(let attempt=0;attempt<100;attempt++){if(app.exitCode!==null)throw new Error("Next fixture start failed");try{await fetch(origin+"/setup",{signal:AbortSignal.timeout(1000)});break;}catch{await new Promise(r=>setTimeout(r,100));}}
  async function sessionCookies(token:string){const collected:{name:string;value:string}[]=[];const client=createServerClient(supabaseOrigin,"sb_publishable_fixture_only",{cookies:{getAll:()=>[],setAll:cookies=>{for(const c of cookies)collected.push({name:c.name,value:c.value});}}});const {error}=await client.auth.setSession({access_token:token,refresh_token:"fixture-refresh-not-real"});assert.equal(error,null);return collected.map(c=>({...c,url:origin,httpOnly:true,sameSite:"Lax" as const}));}
  for(const [name,engine]of [["chromium",chromium],["webkit",webkit]] as const){
   const browser=await engine.launch({headless:true});
   try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(await sessionCookies(adminToken));
    const page=await context.newPage(),errors:string[]=[],documents:string[]=[],failed:string[]=[];page.on("pageerror",e=>errors.push(new URL(page.url()).pathname+": "+e.message));page.on("requestfailed",r=>failed.push(r.method()+" "+r.url()+" "+r.failure()?.errorText));page.on("request",r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents.push(r.url());});
    const response=await page.goto(origin+"/admin",{waitUntil:"commit"});assert.notEqual(response?.status(),500,"Local Next fixture failed: "+output.slice(-2500));await expect(page.locator(".admin-header")).toBeVisible();await expect(page.locator(".admin-nav-main")).toBeVisible();
    // The slow chart's own fallback, not the whole shell, is visible during its
    // server delay. Assert actual streamed DOM rather than simulated timings.
    await expect(page.locator(".admin-skeleton").first()).toBeVisible();await expect(page.locator(".admin-stats")).toBeVisible();await expect(page.locator(".admin-chart")).toBeVisible();
    await page.locator(".admin-nav-main").evaluate(el=>{el.setAttribute("data-persistent-qa","same-node");});
    const initialDocuments=documents.length,transitions:{route:string;milliseconds:number}[]=[];
    for(const route of ["users","activity","homework","schedule","content","tickets","system"]){
     const link=page.locator(`.admin-nav-main a[href="/admin/${route}"]`);await link.focus();const start=performance.now();await link.click();await expect(page).toHaveURL(origin+"/admin/"+route);await expect(page.locator(".admin-nav-main")).toHaveAttribute("data-persistent-qa","same-node");await expect(link).toHaveAttribute("aria-current","page");transitions.push({route,milliseconds:Math.round(performance.now()-start)});
    }
    assert.equal(documents.length,initialDocuments,"section transitions make no document requests");
    t.diagnostic(`${name}: local fixture-backed route transitions ${JSON.stringify(transitions)}; document reloads: ${documents.length-initialDocuments}`);
    await page.locator('.admin-nav-main a[href="/admin/users"]').click();await expect(page.locator(".admin-table")).toBeVisible();await page.locator('.admin-filters input[name="q"]').fill("Demo Student");await page.locator(".admin-filters button").click();await expect(page.locator(".admin-table tbody tr")).toHaveCount(1);await expect(page.locator(".admin-table")).not.toContainText("Demo Admin");
    await page.locator(".admin-table a").click();await expect(page.locator('input[name="confirm"]')).toBeVisible();await expect(page.locator('form select[name="role"]')).toHaveValue("student");await page.goBack();await expect(page.locator(".admin-table")).toBeVisible();await page.goForward();await expect(page.locator('form select[name="role"]')).toBeVisible();
    const roleForm=page.locator('form').filter({has:page.locator('select[name="role"]')}),beforeMutation=requests.filter(r=>r.table==="admin_update_user").length;
    await roleForm.locator("button").click();assert.equal(requests.filter(r=>r.table==="admin_update_user").length,beforeMutation,"required confirmation prevents submit");
    await roleForm.locator('select[name="class"]').selectOption(id(11));await roleForm.locator('select[name="role"]').selectOption("admin");await roleForm.locator('input[name="confirm"]').check();await roleForm.locator("button").click();await expect(roleForm.locator('input[name="expected"]')).toHaveValue("admin");
    await roleForm.locator('select[name="role"]').selectOption("student");await roleForm.locator('input[name="confirm"]').check();await roleForm.locator("button").click();await expect(roleForm.locator('input[name="expected"]')).toHaveValue("student");
    await page.goto(origin+"/admin/schedule/classes");await expect(page.locator('.admin-nav-secondary a[aria-current="page"]')).toContainText(controlCopy("ru").classes);await expect(page.locator('input[name="name"]')).toBeVisible();
    await page.goto(origin+"/admin/homework");await expect(page.locator(".admin-homework-body").first()).toContainText("Safe demonstration homework");await page.locator(".admin-list details").first().locator("summary").click();await expect(page.locator(".admin-list details[open]")).toContainText("Safe demonstration homework");
    for(const width of [1440,1024,768,390,320]){
     await page.setViewportSize({width,height:1000});
     for(const locale of ["ru","kk","en"] as const){await context.addCookies([{name:"nis-locale",value:locale,url:origin}]);await page.goto(origin+"/admin");await expect(page.locator(".admin-chart")).toBeVisible();
      for(const theme of ["light","dark"]){await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}/${width}/${locale}/${theme}: no overflow`);await expect(page.locator(".admin-nav-main")).toContainText(controlCopy(locale).users);if(locale==="en"&&[390,1440].includes(width))await page.screenshot({path:join(artifacts,`${name}-${width}-${theme}.png`),fullPage:true});}
     }
    }
    await page.setViewportSize({width:390,height:844});await page.goto(origin+"/admin/users");await expect(page.locator(".admin-table-mobile")).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.setViewportSize({width:720,height:900});await page.evaluate(()=>{document.documentElement.style.zoom="2";});await expect(page.locator(".admin-nav-main")).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"200% zoom fits");
    const other=await browser.newContext();await other.addCookies(await sessionCookies(studentToken));const studentPage=await other.newPage();await studentPage.goto(origin+"/admin/users");await expect(studentPage).toHaveURL(origin+"/forbidden");await expect(studentPage.locator(".admin-center")).toHaveCount(0);await other.close();
    const anonymous=await browser.newPage();await anonymous.goto(origin+"/admin/system");await expect(anonymous).not.toHaveURL(origin+"/admin/system");await expect(anonymous.locator(".admin-center")).toHaveCount(0);await anonymous.close();
    if(errors.length)t.diagnostic(`${name} fixture request failures: ${JSON.stringify(failed)}`);
    assert.deepEqual(errors,[],"no JS/hydration errors");await context.close();
   }finally{await browser.close();}
  }
  assert.ok(requests.some(r=>r.table==="admin_control_read"&&r.section==="users"));assert.ok(!requests.some(r=>r.table.includes("storage")));
  assert.ok(!output.includes("fixture-refresh-not-real"),"no session logged by application");
 }finally{
  app.kill("SIGTERM");if(app.exitCode===null)await once(app,"exit");await new Promise<void>(r=>dataServer.close(()=>r()));await db.close();
 }
});
