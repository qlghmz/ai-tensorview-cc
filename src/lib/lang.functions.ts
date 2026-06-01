import { createServerFn } from "@tanstack/react-start";
import type { Lang } from "./i18n-dict";

/**
 * Server-side language detection. The handler body imports `lang.server`
 * lazily so the `.server` module never reaches the client bundle.
 * Called from __root.tsx's beforeLoad during SSR.
 */
export const getServerLang = createServerFn({ method: "GET" }).handler(
  async (): Promise<Lang> => {
    const { detectLangServer } = await import("./lang.server");
    return detectLangServer();
  },
);
