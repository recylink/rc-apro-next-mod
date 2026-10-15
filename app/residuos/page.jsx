import { AvisoDatos } from "@/components/ui/avisos";
import { Residuos } from "@/components/views/residuos";
import { loadEmissions, loadResiduos, loadSucursales } from "@/lib/data";
import { mergeEmissions } from "@/lib/domain/emisiones";
import { currentMonthKey } from "@/lib/domain/periods";

export const metadata = { title: "Residuos" };

export default async function ResiduosPage() {
  const [residuos, sucursales, emissions] = await Promise.all([loadResiduos(), loadSucursales(), loadEmissions()]);

  return (
    <div>
      <AvisoDatos configured={residuos.configured} error={residuos.error || sucursales.error} />
      <Residuos
        residuos={residuos.data}
        sucursales={sucursales.data}
        emissions={mergeEmissions(emissions.data)}
        mesActual={currentMonthKey()}
      />
    </div>
  );
}
