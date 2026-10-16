import { AvisoDatos } from "@/components/ui/avisos";
import { InformeHuella } from "@/components/views/informe";
import { cargarInforme } from "@/lib/informe-datos";

export const metadata = { title: "Informe de huella" };

export default async function InformePage({ searchParams }) {
  const { anio } = await searchParams;
  const { informe, comparacion, anios, configured, error } = await cargarInforme(anio);

  return (
    <div>
      <AvisoDatos configured={configured} error={error} />
      <InformeHuella informe={informe} comparacion={comparacion} anios={anios} comparando={anio === "comparar"} />
    </div>
  );
}
