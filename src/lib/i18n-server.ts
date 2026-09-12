import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { dictionaries, LOCALE_COOKIE, parseLocale } from "./i18n";
export const getI18n = cache(async () => {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, t: dictionaries[locale] };
});
