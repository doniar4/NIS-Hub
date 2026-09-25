import "server-only";

import { cookies } from "next/headers";
import {
  isWelcomeComplete,
  WELCOME_COOKIE,
  WELCOME_COOKIE_MAX_AGE,
} from "./welcome";

export async function hasCompletedWelcome(): Promise<boolean> {
  return isWelcomeComplete((await cookies()).get(WELCOME_COOKIE)?.value);
}

export async function markWelcomeComplete(): Promise<void> {
  (await cookies()).set(WELCOME_COOKIE, "1", {
    httpOnly: true,
    maxAge: WELCOME_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
