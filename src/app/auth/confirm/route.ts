import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markWelcomeComplete } from "@/lib/welcome-server";
import { absoluteSiteUrl, getSiteOrigin } from "@/lib/site-url";

function confirmRedirect(path: string) {
  const response = NextResponse.redirect(absoluteSiteUrl(path), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && request.nextUrl.origin !== getSiteOrigin()) {
    return confirmRedirect("/login?confirmation=failed");
  }

  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient(true);
  if (supabase && token_hash && token_hash.length < 2048 && type === "email") {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
    if (!error) {
      await markWelcomeComplete();
      return confirmRedirect("/profile");
    }
  }
  return confirmRedirect("/login?confirmation=failed");
}
