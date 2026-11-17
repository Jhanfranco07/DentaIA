export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configured || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!candidate) throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL.");

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL no es una URL válida.");
  }

  const localHttp = process.env.NODE_ENV !== "production"
    && url.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash
    || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("NEXT_PUBLIC_SITE_URL debe ser un origen HTTPS válido.");
  }
  return url.origin;
}