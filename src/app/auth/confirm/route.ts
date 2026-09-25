import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markWelcomeComplete } from "@/lib/welcome-server";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const supabase = await createClient(true);
  if (supabase && token_hash && token_hash.length < 2048 && type === "email") {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
    if (!error) {
      await markWelcomeComplete();
      return NextResponse.redirect(new URL("/profile", request.url));
    }
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
