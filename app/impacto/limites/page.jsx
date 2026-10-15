import { AvisoDatos } from "@/components/ui/avisos";
import { Limites } from "@/components/views/limites";
import { loadEmbarques, loadEmissions, loadInventario, loadRecords, loadResiduos, loadSucursales } from "@/lib/data";
import { mergeEmissions } from "@/lib/domain/emisiones";
import { currentMonthKey } from "@/lib/domain/periods";

export const metadata = { title: "Límites del inventario" };

export default async function LimitesPage() {
  const [records, embarques, sucursales, emissions, inventario, residuos] = await Promise.all([
    loadRecords(),
    loadEmbarques(),
    loadSucursales(),
    loadEmissions(),
    loadInventario(),
    loadResiduos(),
  ]);

  return (
    <div>
      <AvisoDatos configured={records.configured} error={records.error || inventario.error || sucursales.error} />
      <Limites
        records={records.data}
        embarques={embarques.data}
        residuos={residuos.data}
        sucursales={sucursales.data}
        emissions={mergeEmissions(emissions.data)}
        inventario={inventario.data}
        mesActual={currentMonthKey()}
      />
    </div>
  );
}
