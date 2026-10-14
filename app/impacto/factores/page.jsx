import { AvisoDatos } from "@/components/ui/avisos";
import { Factores } from "@/components/views/factores";
import { loadEmissions, loadRecords, loadSucursales } from "@/lib/data";
import { mergeEmissions } from "@/lib/domain/emisiones";
import { currentMonthKey } from "@/lib/domain/periods";

export const metadata = { title: "Factores de emisión" };

export default async function FactoresPage() {
  const [emissions, sucursales, records] = await Promise.all([loadEmissions(), loadSucursales(), loadRecords()]);
  const mes = currentMonthKey();

  return (
    <div>
      <AvisoDatos configured={sucursales.configured} error={sucursales.error || emissions.error || records.error} />
      <Factores
        emissions={mergeEmissions(emissions.data)}
        sucursales={sucursales.data}
        // Los factores que se muestran son los de los consumos registrados en cada año.
        records={records.data}
        anioActual={mes.slice(0, 4)}
        // Mes al que se atribuye una recarga de refrigerante nueva.
        mesActual={mes}
      />
    </div>
  );
}
