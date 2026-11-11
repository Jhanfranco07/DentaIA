import Cuenta from "@/features/cuenta/Cuenta";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  return <Cuenta modoInicial={modo === "registro"} />;
}
