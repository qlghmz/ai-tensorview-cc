import { zipSync, strToU8 } from "fflate";
import type { UiBundle } from "@/lib/ui-bundle";
import { buildViteProjectFiles } from "@/lib/export-vite-project";
import { buildNextProjectFiles } from "@/lib/export-next-project";
import { buildVueProjectFiles } from "@/lib/export-vue-project";

export type ExportFormat = "vite" | "next" | "vue";

function buildFiles(format: ExportFormat, bundle: UiBundle, projectName: string): Record<string, string> {
  switch (format) {
    case "next":
      return buildNextProjectFiles(bundle, projectName);
    case "vue":
      return buildVueProjectFiles(bundle, projectName);
    default:
      return buildViteProjectFiles(bundle, projectName);
  }
}

export function downloadProjectZip(format: ExportFormat, bundle: UiBundle, projectName: string): void {
  const files = buildFiles(format, bundle, projectName);
  const zipEntries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    zipEntries[path] = strToU8(content);
  }
  const zipped = zipSync(zipEntries);
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const suffix = format === "vite" ? "vite" : format;
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9-_]/g, "-") || "project"}-${suffix}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated use downloadProjectZip */
export function downloadViteProjectZip(bundle: UiBundle, projectName: string): void {
  downloadProjectZip("vite", bundle, projectName);
}
