/** Quick test Cloudflare DNS API auth — set CLOUDFLARE_ZONE_ID in env */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const zone = process.env.CLOUDFLARE_ZONE_ID;
if (!zone) {
  console.error("Set CLOUDFLARE_ZONE_ID to your zone id");
  process.exit(1);
}

function oauth() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return undefined;
  const tomlPath = join(home, "AppData/Roaming/xdg.config/.wrangler/config/default.toml");
  try {
    const toml = readFileSync(tomlPath, "utf8");
    return toml.match(/oauth_token = "([^"]+)"/)?.[1];
  } catch {
    return undefined;
  }
}

async function tryToken(label, token) {
  if (!token) return;
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  console.log(label, "success:", j.success, "count:", j.result?.length ?? 0, j.errors?.[0]?.message ?? "");
}

const oauthToken = oauth();
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
await tryToken("oauth", oauthToken);
await tryToken("api_token", apiToken);
