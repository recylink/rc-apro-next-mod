import { AvisoDatos } from "@/components/ui/avisos";
import { Limites } from "@/components/views/limites";
import { loadEmbarques, loadEmissions, loadInventario, loadRecords, loadSucursales } from "@/lib/data";
import { mergeEmissions } from "@/lib/domain/emisiones";
import { currentMonthKey } from "@/lib/domain/periods";

export const metadata = { title: "Límites del inventario" };

export default async function LimitesPage() {
  const [records, embarques, sucursales, emissions, inventario] = await Promise.all([
    loadRecords(),
    loadEmbarques(),
    loadSucursales(),
    loadEmissions(),
    loadInventario(),
  ]);

  return (
    <div>
      <AvisoDatos configured={records.configured} error={records.error || inventario.error || sucursales.error} />
      <Limites
        records={records.data}
        embarques={embarques.data}
        sucursales={sucursales.data}
        emissions={mergeEmissions(emissions.data)}
        inventario={inventario.data}
        mesActual={currentMonthKey()}
      />
    </div>
  );
}
