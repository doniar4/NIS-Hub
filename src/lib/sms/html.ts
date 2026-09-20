import { parse, type DefaultTreeAdapterMap } from "parse5";
export type HtmlNode = DefaultTreeAdapterMap["node"];
export function nodes(root: HtmlNode, tag?: string): DefaultTreeAdapterMap["element"][] {
  const found: DefaultTreeAdapterMap["element"][] = [], stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if ("tagName" in node && (!tag || node.tagName === tag)) found.push(node);
    if ("childNodes" in node) stack.push(...node.childNodes.slice().reverse());
  }
  return found;
}
export function attr(node: DefaultTreeAdapterMap["element"], key: string) {
  return node.attrs.find(a => a.name === key)?.value;
}
export function nodeText(root: HtmlNode): string {
  const result: string[] = [], stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if ("tagName" in node && ["script", "style", "template"].includes(node.tagName)) continue;
    if ("value" in node) result.push(node.value);
    if ("childNodes" in node) stack.push(...node.childNodes.slice().reverse());
  }
  return result.join(" ").replace(/\s+/g, " ").trim();
}
export function document(raw: string) { return parse(raw); }
// SMS emits a JSON object into Ext.apply. Parse JSON only; never execute upstream JS.
export function serverState(raw: string): { Area?: string; ApplicationPath?: string; User?: { IsAuthenticated?: boolean } } | null {
  for (const script of nodes(document(raw), "script")) {
    const text = script.childNodes.map(n => "value" in n ? n.value : "").join("");
    const marker = /Ext\.apply\(App\.Server,\s*/.exec(text);
    if (!marker) continue;
    const start = marker.index + marker[0].length;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        try {
          const value = JSON.parse(text.slice(start, i + 1));
          return { Area: value.Area, ApplicationPath: value.ApplicationPath,
            User: { IsAuthenticated: value.User?.IsAuthenticated } };
        } catch { return null; }
      }
    }
  }
  return null;
}
