import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./supabase-config.mjs";

const { url, key } = publicSupabaseConfig();
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.from("dentists").select("id,is_demo,name");
assert.equal(error, null, error?.message);
assert.ok(data.length >= 4, "Se esperaban los cuatro perfiles de demostración.");
assert.ok(data.every(row => row.is_demo), "El directorio académico solo debe contener perfiles ficticios.");
for (const table of ["profiles", "appointment_requests", "patient_consents", "dental_photos"]) {
  const result = await client.from(table).select("*").limit(1);
  if (result.error) assert.equal(result.error.code, "42501", result.error.message);
  else assert.equal(result.data.length, 0, `Un visitante pudo consultar datos privados de ${table}.`);
}
console.log(`OK: conexión real, ${data.length} perfiles ficticios y sin datos privados accesibles como visitante.`);

// Opcional: una cuenta ya creada permite comprobar Auth sin depender de la UI de Jhan.
if (process.env.DENTAIA_TEST_EMAIL && process.env.DENTAIA_TEST_PASSWORD) {
  try {
    const { data: auth, error: authError } = await client.auth.signInWithPassword({
      email: process.env.DENTAIA_TEST_EMAIL,
      password: process.env.DENTAIA_TEST_PASSWORD,
    });
    assert.equal(authError, null, authError?.message);
    const profile = await client.from("profiles").select("id");
    assert.equal(profile.error, null, profile.error?.message);
    assert.ok(profile.data.every(row => row.id === auth.user.id), "Se recibió un perfil ajeno.");
    console.log("OK: autenticación y consulta privada de la cuenta de prueba.");
  } finally { await client.auth.signOut(); }
} else {
  console.log("Auth no probado: configura DENTAIA_TEST_EMAIL y DENTAIA_TEST_PASSWORD si deseas verificar una cuenta.");
}
