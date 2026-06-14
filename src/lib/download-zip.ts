import { zipSync, strToU8 } from "fflate";
import type { UiBundle } from "@/lib/ui-bundle";
import { buildViteProjectFiles } from "@/lib/export-vite-project";

export function downloadViteProjectZip(bundle: UiBundle, projectName: string): void {
  const files = buildViteProjectFiles(bundle, projectName);
  const zipEntries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    zipEntries[path] = strToU8(content);
  }
  const zipped = zipSync(zipEntries);
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9-_]/g, "-") || "project"}-vite.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
