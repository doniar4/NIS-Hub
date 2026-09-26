import { EduPageError } from "./errors";
export type SourceGroup = { id: string; classId: string; name: string; division: string; entire: boolean };
// Each cell is a possible combination of the school's independent divisions.
// Different divisions therefore intersect conservatively: we never assume that
// "boys" and "group 1" are disjoint without individual pupil membership.
export function classAudience(groups: SourceGroup[], selected: string[]) {
  const own = selected.map(id => groups.find(g => g.id === id));
  if (!own.length || own.some(g => !g)) throw new EduPageError("source_changed");
  const specific = own.filter((g): g is SourceGroup => !!g && !g.entire);
  if (!specific.length && own.some(g => g!.entire))
    return { subgroup_key: "", subgroup_label: null, audience: "{(,)}", cells: null };
  const divisions = [...new Set(groups.filter(g => !g.entire).map(g => g.division))].sort();
  const parts = divisions.map(d => groups.filter(g => !g.entire && g.division === d).sort((a,b) => a.name.localeCompare(b.name)));
  if (parts.some(p => !p.length || new Set(p.map(g => g.name)).size !== p.length)) throw new EduPageError("unsupported");
  const count = parts.reduce((n,p) => n * p.length, 1);
  if (count > 256 || divisions.length > 8) throw new EduPageError("unsupported");
  const selectedByDivision = new Map<string, Set<string>>();
  for (const group of own) {
    if (!group || group.entire) continue;
    const set = selectedByDivision.get(group.division) ?? new Set<string>();
    set.add(group.id);
    selectedByDivision.set(group.division, set);
  }
  const cells: number[] = [];
  for (let cell = 0; cell < count; cell++) {
    let n = cell, included = true;
    for (const part of parts) {
      const choice = part[n % part.length];
      n = Math.floor(n / part.length);
      const allowed = selectedByDivision.get(choice.division);
      if (allowed && !allowed.has(choice.id)) included = false;
    }
    if (included) cells.push(cell);
  }
  if (!cells.length) throw new EduPageError("source_changed");
  // Export IDs only resolve this document. Persistent identity uses explicit
  // division codes and group names, never the provider's temporary object IDs.
  const key = specific.map(g => g.division + ":" + g.name).sort().join(" | ");
  const label = specific.map(g => g.name).sort().join(" / ");
  if (key.length > 240 || label.length > 200) throw new EduPageError("unsupported");
  return { subgroup_key: key, subgroup_label: label, audience: "{" + cells.map(n => "[" + n + "," + (n+1) + ")").join(",") + "}", cells };
}
export function audienceCells(value?: string): Set<number> | null {
  if (!value || value === "{(,)}") return null;
  if (!/^\{(?:\[\d+,\d+\)(?:,\[\d+,\d+\))*)\}$/.test(value)) throw new EduPageError("source_changed");
  const result = new Set<number>();
  for (const match of value.matchAll(/\[(\d+),(\d+)\)/g)) {
    const start = Number(match[1]), end = Number(match[2]);
    if (start < 0 || end > 256 || end <= start) throw new EduPageError("source_changed");
    for (let i=start; i<end; i++) result.add(i);
  }
  if (!result.size) throw new EduPageError("source_changed");
  return result;
}
export function audiencesOverlap(a?: string, b?: string) {
  const x = audienceCells(a), y = audienceCells(b);
  return !x || !y || [...x].some(n => y.has(n));
}
