import Cuenta from "@/features/cuenta/Cuenta";
import EstadoPlanPremium from "@/components/EstadoPlanPremium";
import MisPagos from "@/components/MisPagos";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ modo?: string; perfil?: string }> }) {
  const { modo, perfil } = await searchParams;
  return (
    <>
      <Cuenta modoInicial={modo === "registro"} perfilSolicitado={perfil === "1"} />
      <EstadoPlanPremium />
      <MisPagos />
    </>
  );
}
