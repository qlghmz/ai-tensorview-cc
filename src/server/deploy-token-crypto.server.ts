/**
 * Token 加密：AES-GCM via Web Crypto，密钥从 SUPABASE_SERVICE_ROLE_KEY 派生。
 * 仅在服务端执行；文件名以 .server.ts 结尾，构建期会阻止客户端引入。
 */

function getSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing on server");
  return s;
}

async function getKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(getSecret());
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  // 存 iv|ct base64
  const merged = new Uint8Array(iv.byteLength + ct.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ct), iv.byteLength);
  return toB64(merged.buffer);
}

export async function decryptToken(stored: string): Promise<string> {
  const merged = fromB64(stored);
  const iv = merged.slice(0, 12);
  const ct = merged.slice(12);
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export function tokenTail(token: string): string {
  return token.slice(-4);
}
