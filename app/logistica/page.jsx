import { AvisoDatos } from "@/components/ui/avisos";
import { Logistica } from "@/components/views/logistica";
import { loadEmbarques, loadEmissions, loadRutas, loadSucursales } from "@/lib/data";
import { mergeEmissions } from "@/lib/domain/emisiones";
import { currentMonthKey } from "@/lib/domain/periods";

export const metadata = { title: "Logística" };

export default async function LogisticaPage() {
  const [embarques, rutas, sucursales, emissions] = await Promise.all([
    loadEmbarques(),
    loadRutas(),
    loadSucursales(),
    loadEmissions(),
  ]);

  return (
    <div>
      <AvisoDatos configured={embarques.configured} error={embarques.error || rutas.error || sucursales.error} />
      <Logistica
        embarques={embarques.data}
        rutas={rutas.data}
        sucursales={sucursales.data}
        emissions={mergeEmissions(emissions.data)}
        mesActual={currentMonthKey()}
      />
    </div>
  );
}
