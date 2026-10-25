import { randomBytes } from "node:crypto";
import { appendFile, open } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./supabase-config.mjs";

const { url } = publicSupabaseConfig();
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret || secret.startsWith("sb_publishable_")) {
  throw new Error("Solo el propietario: configura SUPABASE_SECRET_KEY en .env.admin.local. Nunca uses NEXT_PUBLIC_ para esta clave.");
}
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const destination = ".env.test-accounts.local";
// No sobrescribir credenciales generadas por una ejecución anterior.
const output = await open(destination, "wx", 0o600);
await output.writeFile("# Credenciales privadas de desarrollo. No subir a Git ni compartir el archivo completo.\n");
await output.close();
let failed = false;
for (const name of ["jhan", "angie", "anelis", "stephan"]) {
  const email = `${name}.dev@dentaia.test`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    failed = true;
    console.error(`${name}: no creado (${error.code ?? error.status ?? "error"}). Revisa Authentication > Users; no se cambia ninguna contraseña existente.`);
    continue;
  }
  await appendFile(destination, `DENTAIA_${name.toUpperCase()}_EMAIL=${email}\nDENTAIA_${name.toUpperCase()}_PASSWORD=${password}\n`);
  console.log(`${name}: cuenta de prueba creada.`);
}
console.log(`Credenciales nuevas guardadas solo en ${destination}. Entrega a cada integrante únicamente las suyas.`);
if (failed) process.exitCode = 1;
