/** Search folding deliberately keeps the displayed text unchanged. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("ru")
    .replace(/\p{M}/gu, "")
    .replace(/ё/g, "е")
    .replace(/і/g, "и")
    .replace(
      /[қғңұүөһә]/g,
      (c) =>
        ({ қ: "к", ғ: "г", ң: "н", ұ: "у", ү: "у", ө: "о", һ: "х", ә: "а" })[
          c
        ]!,
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
const ru = "йцукенгшщзхъфывапролджэячсмитьбю";
const en = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const latin: Record<string, string> = {
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
  c: "к",
  y: "ы",
  q: "к",
  w: "в",
  x: "кс",
};
export function libraryQueryVariants(query: string): string[] {
  const value = query.normalize("NFKC").toLocaleLowerCase("ru").trim();
  if (!value) return [];
  const swap = (from: string, to: string) =>
    [...value]
      .map((c) => (from.includes(c) ? to[from.indexOf(c)] : c))
      .join("");
  const transliterated = value
    .replace(
      /shch|sch|zh|ch|sh|kh|ts|ya|yu|yo|ye/g,
      (c) =>
        ({
          shch: "щ",
          sch: "щ",
          zh: "ж",
          ch: "ч",
          sh: "ш",
          kh: "х",
          ts: "ц",
          ya: "я",
          yu: "ю",
          yo: "е",
          ye: "е",
        })[c]!,
    )
    .replace(/[a-z]/g, (c) => latin[c] ?? c);
  const cyrillic: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    қ: "q",
    ғ: "gh",
    ң: "ng",
    ұ: "u",
    ү: "u",
    ө: "o",
    һ: "h",
    ә: "a",
    і: "i",
  };
  const romanized = [...value].map((c) => cyrillic[c] ?? c).join("");
  return [
    ...new Set(
      [value, swap(en, ru), swap(ru, en), transliterated, romanized].map((v) =>
        normalizeSearch(v).slice(0, 100),
      ),
    ),
  ].filter(Boolean);
}
export const naturalTitleCompare = (a: string, b: string, locale = "ru") =>
  a.localeCompare(b, locale, { numeric: true, sensitivity: "base" });
