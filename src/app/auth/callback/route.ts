import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { absoluteSiteUrl, getSiteOrigin } from "@/lib/site-url";
import { markWelcomeComplete } from "@/lib/welcome-server";

function authRedirect(path: string) {
  const response = NextResponse.redirect(absoluteSiteUrl(path), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Completes Supabase's PKCE code flow without reflecting caller-supplied URLs. */
export async function GET(request: NextRequest) {
  const failure = "/login?callback=failed";
  if (process.env.NODE_ENV === "production" && request.nextUrl.origin !== getSiteOrigin()) {
    return authRedirect(failure);
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 2048 || /\s/.test(code)) return authRedirect(failure);

  try {
    const supabase = await createClient(true);
    if (!supabase) return authRedirect(failure);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user || !data.session) return authRedirect(failure);
    const verified = await supabase.auth.getUser();
    if (verified.error || verified.data.user?.id !== data.user.id) return authRedirect(failure);
    await markWelcomeComplete();
    return authRedirect("/profile");
  } catch {
    // Never log the callback URL, one-time code or session material.
    return authRedirect(failure);
  }
}
