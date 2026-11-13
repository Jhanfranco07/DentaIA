import Cuenta from "@/features/cuenta/Cuenta";
import MisPagos from "@/components/MisPagos";

<<<<<<< HEAD
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  return (
    <main className="module-shell">
      <Cuenta modoInicial={modo === "registro"} />
      <MisPagos />
    </main>
  );
}
=======
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ modo?: string; perfil?: string }> }) {
  const { modo, perfil } = await searchParams;
  return <Cuenta modoInicial={modo === "registro"} perfilSolicitado={perfil === "1"} />;
}
>>>>>>> origin/main
