# Huella de Carbono APRO

Herramienta para que APRO registre sus datos de actividad (consumos, combustible por fuente de emisión, transporte de carga) y cuantifique su huella de carbono organizacional según GHG Protocol y la homologación ISO 14064-1 de HuellaChile. Copia independiente de `registro-de-consumos-next` (desde `febd7f6`); no comparte historia ni código con la referencia ni con sus espejos. Las decisiones que llevaron aquí están en [DISEÑO-APRO.md](DISEÑO-APRO.md).

Los términos marcados _(nuevo)_ son el modelo acordado y todavía no están en el código.

## Language

### Organización

**Sucursal**:
Unidad operativa que consume (planta, oficina, obra, centro de distribución), con a lo más una cuenta de servicio por tipo de servicio ante cada proveedor. Un sitio físico con dos empalmes se modela como dos Sucursales. Puede ser permanente o temporal; al cerrarse conserva su historia.
_Avoid_: sede, sitio, local, obra (como término de modelo)

**Datos de sucursal** _(nuevo)_:
Trabajadores y m² de una Sucursal en un año. Se capturan una vez al año y solo sirven de denominador para la Intensidad.
_Avoid_: dotación, superficie (como términos de modelo)

**Número de cliente**:
Identificador de la cuenta de una Sucursal ante un proveedor de servicio. Pertenece a exactamente una Sucursal, lo que permite rutear boletas extraídas a su Sucursal automáticamente.
_Avoid_: cuenta (a secas), N° servicio

### Captura

**Registro**:
Un consumo de una sucursal: cantidad, unidad, costo, tipo, subcategoría, proveedor y fecha, idealmente respaldado por un Documento. En combustible lleva además Fuente de emisión y, opcional, Equipo. Es la fuente de verdad del consumo — Impacto y el informe se calculan desde Registros, Recargas y Embarques.
_Avoid_: consumo (a secas), record, entrada

**Fecha de Registro**:
Una fecha dentro del mes al que se atribuye el consumo (el mes predominante del período facturado). En Registros extraídos de un Documento es el punto medio del período; en Registros manuales el usuario digita un día del mes de consumo. Nunca es la fecha de emisión, pago ni vencimiento.
_Avoid_: fecha de emisión, fecha de pago, vencimiento, fecha de cierre

**Período facturado**:
El rango desde–hasta que cubre una boleta (período de lectura). Puede cruzar dos meses; su punto medio determina el mes del Registro.
_Avoid_: período de lectura (como término de modelo), ciclo

**Subcategoría**:
Variante de un tipo de consumo: el combustible (diésel, gasolina 95, GLP, leña) o la calidad del agua (potable, gris, riego). Nunca codifica la Fuente de emisión: "diésel móvil" no es una subcategoría.
_Avoid_: subtipo, categoría

**Fuente de emisión**:
Qué quema o emite: camioneta, furgón, grúa horquilla, generador, bus de acercamiento. Viene de un catálogo editable por la empresa, donde cada fuente tiene fija su Clase de fuente y su Alcance. Quien registra solo elige la fuente; clase, alcance y factor salen de ella.
_Avoid_: tipo de vehículo, equipo (cuando se habla del tipo y no de la unidad)

**Clase de fuente**:
Las cuatro categorías del alcance 1: combustión fija, combustión móvil, fugitiva, proceso. Determina qué fila del catálogo de factores aplica (el diésel de un generador y el de una camioneta tienen factores distintos).
_Avoid_: estacionaria (decir "fija")

**Equipo**:
La unidad concreta de una Fuente de emisión: una patente, "Grúa 1". Opcional; sirve para filtrar y agrupar.
_Avoid_: activo, vehículo (como término de modelo)

**Recarga**:
Kilogramos de refrigerante repuestos a equipos de una Sucursal en un mes, declarados por el cliente. No tiene boleta ni proveedor, y emite por GWP × kg (alcance 1, fugitiva).
_Avoid_: consumo de refrigerante, cuarto tipo de consumo

**Embarque** _(nuevo)_:
Un transporte de carga comprado: origen, destino, medio (barco, camión), kg y km, de donde sale el dato de actividad en ton-km. Lleva fecha (al menos mes/año) y Documento opcional. Alcance 3, categoría 4.
_Avoid_: importación, flete, contenedor (como términos de modelo)

**Ruta** _(nuevo)_:
Par origen–destino con su distancia en km y medio, precargado para no tipear los km en cada Embarque.
_Avoid_: trayecto, lane

**Documento**:
La boleta, factura o papel de embarque que respalda un dato. Un Registro con origen "documento" nació por extracción PDF; uno "manual" fue digitado (con Documento adjunto opcional).
_Avoid_: usar "factura" y "boleta" como conceptos distintos

**Medidor**:
Un punto de medición físico (eléctrico, agua, combustible) asociado a una sucursal. Sirve para control operativo — detectar fugas, validar boletas, submedición — y nunca alimenta la huella.
_Avoid_: meter, remarcador

**Lectura**:
El valor mensual anotado de un Medidor. Dato operativo; no es un Registro y no emite.
_Avoid_: reading, marcación

### Cálculo

**Dato de actividad**:
La cantidad que se multiplica por un factor: litros, kWh, kg, ton-km. Toda emisión es dato de actividad × factor de emisión.
_Avoid_: consumo (cuando se habla en general)

**Catálogo de factores**:
Tabla de referencia HuellaChile + DEFRA, versionada por año, con unidad y fuente citada (IPCC, CNE, DEFRA) por fila. Vive en el repo, no en la planilla. Se toman de él solo factores, nunca cálculos de clientes.
_Avoid_: tabla de conversión

**Clave de factor**:
Qué se consumió y en qué unidad, que es lo que decide el factor: `combustible|diesel|móvil|L`, `electricidad|SEN|kWh`, `agua|m³`. La clase sale de la Fuente de emisión; el sistema eléctrico, de la Sucursal.
_Avoid_: energético, key

**Factor de emisión**:
Coeficiente kgCO₂e por unidad de dato de actividad para una Clave en un **año de inventario**. Por defecto sale del Catálogo (en electricidad, el del año o el último publicado); la empresa puede elegir para ese año otra fila del Catálogo o un valor propio con justificación. Cambiar un año no toca los otros. Se guarda en la clave `factoresPorAnio` de la hoja "Config".
_Avoid_: factor de conversión

_Ya no existe el **Factor de sucursal**_ (override por sucursal): el valor propio por año lo reemplaza. Si una sucursal necesita un factor distinto (generación propia), es un sistema eléctrico o una fuente de emisión distinta, no un override.

**Emisión derivada**:
Emisión que no se captura y se calcula desde otro dato: hoy, el upstream de los combustibles (WTT), alcance 3, categoría 3, sobre todo Registro de combustible. Se activa por empresa (clave `wtt` de "Config", interruptor en Factores).
_Avoid_: bienes y servicios (para WTT)

**Alcance**:
Clasificación GEI de una emisión según quién controla la fuente: 1 (directas: combustión fija, móvil, fugitivas, proceso), 2 (energía comprada: electricidad, por método de ubicación), 3 (cadena de valor: 15 categorías). La electricidad se reporta solo por método de ubicación.
_Avoid_: scope

**Categoría** _(nuevo)_:
La subdivisión del Alcance. Cada emisión lleva dos: la del GHG Protocol (en alcance 3, del 1 al 15) y su equivalente ISO 14064-1 según HuellaChile (directas, energía importada, transporte, productos que utiliza la organización, uso de productos de la organización).
_Avoid_: subcategoría (es otra cosa)

**Intensidad** _(nuevo)_:
tCO₂e dividido por trabajadores o por m², por sucursal o empresa y por año. Se calcula, no se guarda. La pide el cliente, no la norma.
_Avoid_: indicador de relevancia

### Reporte

**Límites** _(nuevo)_:
Por año: el enfoque de control (operacional o financiero) y, por cada categoría, si está incluida, excluida o no aplica, con su justificación escrita. Una categoría excluida no aparece como faltante.
_Avoid_: alcance (para hablar de límites), matriz de relevancia

**Meta**:
Compromiso de reducción de emisiones de la empresa o de una Sucursal: porcentaje relativo contra un año base, o tope absoluto de tCO₂e. Se mide sobre el total absoluto; el sesgo por crecimiento (abrir sucursales sube el total) es aceptado.
_Avoid_: objetivo, target

**Informe de huella** _(nuevo)_:
La salida anual: organización, totales por alcance con %, desglose categoría → fuente, intensidades, factores usados con su fuente y límites. Impacto muestra lo mismo en pantalla; impresión y Excel salen de la misma función de cálculo.
_Avoid_: reporte de resultados, calculadora
