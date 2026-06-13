/** Quick test Cloudflare DNS API auth */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const zone = "ffbc4652adc5eb3e8f99259f991dafc4";

function oauth() {
  const toml = readFileSync(
    join(process.env.USERPROFILE, "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8",
  );
  return toml.match(/oauth_token = "([^"]+)"/)?.[1];
}

async function tryToken(label, token) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  console.log(label, "success:", j.success, "count:", j.result?.length ?? 0, j.errors?.[0]?.message ?? "");
  const ai = j.result?.filter((x) => x.name === "ai.tensorview.cc" || x.name === "ai");
  if (ai?.length) ai.forEach((x) => console.log(" ", x.id, x.type, x.name, x.content));
}

const oauthToken = oauth();
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
await tryToken("oauth", oauthToken);
if (apiToken) await tryToken("api_token", apiToken);
