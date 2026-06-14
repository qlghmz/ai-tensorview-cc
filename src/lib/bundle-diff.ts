import type { UiBundle } from "@/lib/ui-bundle";

export type FileDiffStatus = "added" | "removed" | "modified" | "unchanged";

export type FileDiff = {
  path: string;
  status: FileDiffStatus;
  before?: string;
  after?: string;
  hunks?: DiffHunk[];
};

export type DiffHunk = {
  type: "same" | "add" | "remove";
  line: string;
};

export function diffUiBundles(before: UiBundle | null, after: UiBundle | null): FileDiff[] {
  const beforeFiles = before?.files ?? {};
  const afterFiles = after?.files ?? {};
  const paths = new Set([...Object.keys(beforeFiles), ...Object.keys(afterFiles)]);
  const out: FileDiff[] = [];

  for (const path of [...paths].sort()) {
    const b = beforeFiles[path];
    const a = afterFiles[path];
    if (b === undefined && a !== undefined) {
      out.push({ path, status: "added", after: a, hunks: lineDiff("", a) });
    } else if (b !== undefined && a === undefined) {
      out.push({ path, status: "removed", before: b, hunks: lineDiff(b, "") });
    } else if (b !== a) {
      out.push({ path, status: "modified", before: b, after: a, hunks: lineDiff(b ?? "", a ?? "") });
    } else {
      out.push({ path, status: "unchanged", before: b, after: a });
    }
  }
  return out;
}

/** Simple line-by-line diff (Myers-lite for small files). */
export function lineDiff(before: string, after: string): DiffHunk[] {
  const aLines = before.split("\n");
  const bLines = after.split("\n");
  const hunks: DiffHunk[] = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    const al = aLines[i];
    const bl = bLines[i];
    if (al === bl) {
      if (al !== undefined) hunks.push({ type: "same", line: al });
    } else {
      if (al !== undefined) hunks.push({ type: "remove", line: al });
      if (bl !== undefined) hunks.push({ type: "add", line: bl });
    }
  }
  return hunks;
}

export function diffSummary(diffs: FileDiff[]): { added: number; removed: number; modified: number } {
  return {
    added: diffs.filter((d) => d.status === "added").length,
    removed: diffs.filter((d) => d.status === "removed").length,
    modified: diffs.filter((d) => d.status === "modified").length,
  };
}
