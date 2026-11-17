import AnalisisDental from "@/features/analisis/AnalisisDental";
import { FotografiaPreparacionProvider } from "@/features/analisis/FotografiaPreparacionContexto";

export default function AnalisisDentalPage() {
  return (
    <FotografiaPreparacionProvider>
      <AnalisisDental />
    </FotografiaPreparacionProvider>
  );
}
