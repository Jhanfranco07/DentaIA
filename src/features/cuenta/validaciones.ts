const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarNombre(nombre: string): string | null {
  const longitud = nombre.trim().length;
  return longitud < 2 || longitud > 120 ? "El nombre completo debe tener entre 2 y 120 caracteres." : null;
}

export function validarAcceso(email: string, password: string): string | null {
  if (!email.trim() || !password) return "Completa el correo electrónico y la contraseña.";
  if (!CORREO_VALIDO.test(email.trim())) return "Introduce un correo electrónico válido.";
  return null;
}

export function validarRegistro(nombre: string, email: string, password: string, confirmacion: string): string | null {
  return validarNombre(nombre) ?? validarAcceso(email, password)
    ?? (password.length < 8 ? "Usa una contraseña de al menos 8 caracteres." : null)
    ?? (password !== confirmacion ? "Las contraseñas no coinciden." : null);
}

export type CampoCuenta = "nombre" | "email" | "password" | "confirmacion";

// Conserva las validaciones existentes y señala dónde corregir el primer error.
export function validarFormularioCuenta({ registro, nombre, email, password, confirmacion }: {
  registro: boolean; nombre: string; email: string; password: string; confirmacion: string;
}): { campo: CampoCuenta; mensaje: string } | null {
  const mensaje = registro ? validarRegistro(nombre, email, password, confirmacion) : validarAcceso(email, password);
  if (!mensaje) return null;
  let campo: CampoCuenta;
  if (registro && validarNombre(nombre)) campo = "nombre";
  else if (!email.trim() || !CORREO_VALIDO.test(email.trim())) campo = "email";
  else if (!password || (registro && password.length < 8)) campo = "password";
  else campo = "confirmacion";
  return { campo, mensaje };
}

// No se muestran mensajes crudos del proveedor ni se registran credenciales.
export function mensajeError(error: unknown): string {
  if (error instanceof Error && error.message.includes("Falta configurar .env.local")) {
    return "El acceso no está disponible porque falta la configuración de conexión. Comunícalo al responsable de DentaIA.";
  }
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  switch (code) {
    case "invalid_credentials": return "El correo o la contraseña no son correctos.";
    case "email_not_confirmed": return "Confirma tu correo electrónico antes de iniciar sesión.";
    case "weak_password": return "La contraseña no cumple las reglas de seguridad. Usa una más larga y combina letras, números y símbolos.";
    case "user_already_exists": return "No se pudo completar el registro. Si ya tienes una cuenta, intenta iniciar sesión.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit": return "Se realizaron demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
    case "signup_disabled": return "El registro no está disponible en este momento.";
    case "session_not_found":
    case "refresh_token_not_found": return "Tu sesión ya no es válida. Vuelve a iniciar sesión.";
    default: return "No pudimos completar la operación. Revisa tu conexión e inténtalo de nuevo.";
  }
}
