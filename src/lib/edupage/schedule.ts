import "server-only";
import { createHash } from "node:crypto";
import { eduPageConfig } from "./config";
import { EduPageHttp, REGULAR_RPC, VIEWER_RPC } from "./http";
import { discoverEduPage, discoverPublication } from "./discover";
import { parseEduPage } from "./parser";
export async function fetchEduPage(http = new EduPageHttp(eduPageConfig())) {
  const discovery = discoverEduPage(await http.request(http.config.path));
  const viewer = await http.request(VIEWER_RPC, { __args: [null, discovery.year], __gsh: discovery.signature });
  const publication = discoverPublication(viewer);
  const raw = await http.request(REGULAR_RPC, { __args: [null, publication.number], __gsh: discovery.signature });
  const snapshot = parseEduPage(raw, publication);
  // Hash parsed relevant data, not volatile provider metadata, for confirmation.
  // No raw response, anonymous signature, or teacher records are logged/stored here.
  const sourceHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { snapshot, sourceHash, checkedAt: new Date().toISOString() };
}
