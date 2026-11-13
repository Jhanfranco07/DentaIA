import Cuenta from "@/features/cuenta/Cuenta";
import MisPagos from "@/components/MisPagos";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  return (
    <main className="module-shell">
      <Cuenta modoInicial={modo === "registro"} />
      <MisPagos />
    </main>
  );
}