import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export type VinculoCursor = { actor: string; session: string; patient: string; membership: string | null; limit: number };
export type ContextoCursor = { professional: string | null; clinic: string | null };
export type PosicionCursor = { beforeAt: string; beforeId: string };
type Payload = VinculoCursor & ContextoCursor & { v: 1; position: PosicionCursor; iat: number; exp: number };

function claves(secret: string) {
  if (!/^[A-Za-z0-9_-]{43,86}$/.test(secret)) throw new Error("CURSOR_CONFIGURATION");
  const master = Buffer.from(secret, "base64url");
  if (master.length < 32 || master.length > 64) throw new Error("CURSOR_CONFIGURATION");
  const salt = Buffer.from("dentaia.clinical.cursor.v1");
  return {
    enc: Buffer.from(hkdfSync("sha256", master, salt, "encryption", 32)),
    mac: Buffer.from(hkdfSync("sha256", master, salt, "signature", 32)),
  };
}

/** Cifrado autenticado y firma HMAC: posiciones e identificadores no quedan en claro. */
export function firmarCursor(secret: string, binding: VinculoCursor, context: ContextoCursor, position: PosicionCursor, ttl: number, tokenExp: number, now = Math.floor(Date.now() / 1000)) {
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 900 || tokenExp <= now) throw new Error("CURSOR_CONFIGURATION");
  const key = claves(secret);
  const payload: Payload = { ...binding, ...context, v: 1, position, iat: now, exp: Math.min(tokenExp, now + ttl) };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.enc, iv);
  cipher.setAAD(Buffer.from("dentaia.clinical.cursor.v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const base = ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  return base + "." + createHmac("sha256", key.mac).update(base).digest("base64url");
}

export function verificarCursor(secret: string, token: string, binding: VinculoCursor, now = Math.floor(Date.now() / 1000)): Payload | null {
  try {
    if (token.length > 2048 || !/^v1(?:\.[A-Za-z0-9_-]+){4}$/.test(token)) return null;
    const parts = token.split(".");
    if (parts.slice(1).some(part => Buffer.from(part, "base64url").toString("base64url") !== part)) return null;
    const key = claves(secret);
    const signature = Buffer.from(parts[4], "base64url");
    const expected = createHmac("sha256", key.mac).update(parts.slice(0, 4).join(".")).digest();
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
    const iv = Buffer.from(parts[1], "base64url"), tag = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key.enc, iv);
    decipher.setAAD(Buffer.from("dentaia.clinical.cursor.v1"));
    decipher.setAuthTag(tag);
    const p = JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8")) as Payload;
    if (!p || p.v !== 1 || !Number.isInteger(p.exp) || !Number.isInteger(p.iat) || p.exp <= now || p.iat > now || p.exp - p.iat > 900
      || p.actor !== binding.actor || p.session !== binding.session || p.patient !== binding.patient || p.membership !== binding.membership || p.limit !== binding.limit
      || !p.position || typeof p.position.beforeAt !== "string" || typeof p.position.beforeId !== "string"
      || !(p.professional === null || typeof p.professional === "string") || !(p.clinic === null || typeof p.clinic === "string")) return null;
    return p;
  } catch { return null; }
}
