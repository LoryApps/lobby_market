import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(origin);
    }
  }

  // Redirect to login with error on failure
  const loginUrl = new URL("/login", new URL(request.url).origin);
  loginUrl.searchParams.set("error", "Could not authenticate user");
  return NextResponse.redirect(loginUrl.toString());
}
