import EstadoPago from "./EstadoPago";

export default async function ExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  return (
    <main className="module-shell">
      <div className="page-intro">
        <span className="pill">PAGO DE PRUEBA</span>
        <h1>Volviste de Stripe</h1>
        <p>Estamos confirmando tu pago de prueba.</p>
      </div>
      <EstadoPago sessionId={session_id} />
    </main>
  );
}