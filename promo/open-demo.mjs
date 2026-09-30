import {chromium} from "@playwright/test";
const browser=await chromium.launch({headless:false,args:["--remote-debugging-address=127.0.0.1","--remote-debugging-port=9336"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},locale:"ru-RU"});
const page=await context.newPage();
await page.goto("https://nis-hub-ura.vercel.app/?auth=login#welcome-auth",{waitUntil:"domcontentloaded"});
console.log("Войдите только в согласованный demo/test аккаунт. Cookies и запись входа не сохраняются.");
await new Promise(resolve=>browser.on("disconnected",resolve));
