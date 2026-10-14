# Diseño — Huella de Carbono APRO

Decisiones tomadas en el grill del 2026-10-13/14 entre Domingo y Claude, antes de tocar código.
El vocabulario está en [CONTEXT.md](CONTEXT.md).

## Qué es esta herramienta

Una sola herramienta de huella de carbono, cohesiva y funcional para APRO. **No** está
organizada en módulos independientes ni expone contratos para otras herramientas.

A futuro, Domingo separará estas capacidades en herramientas individuales que sean
cohesivas entre sí (consumos, logística, residuos, huella). Ese es otro proyecto, con
su propio diseño, y no condiciona este código.

Se copió de `registro-de-consumos-next@febd7f6` con historia git nueva y sin remote
al upstream. La referencia y sus cinco espejos no se tocan.

## Reglas de base

- **La norma manda, no la planilla del cliente.** La planilla `HUELLA DE CARBONO APRO 2024`
  dice qué datos capturan. Cómo se clasifica y calcula lo dicen el GHG Protocol y la
  homologación ISO 14064-1 de HuellaChile (`Alcances 1, 2 y 3 desde la perspectiva
  HuellaChile.md`). Sus cálculos no se traspasan.
- **Registrar por tipo de dato, reportar por alcance.** Quien carga piensa en "la
  factura Copec" o "un embarque"; quien lee piensa en Alcance 1/2/3 y sus categorías.
  La clasificación sale sola de los catálogos: no se le pide al usuario.

## Decisiones

| # | Tema | Decisión | Descartado y por qué |
|---|------|----------|----------------------|
| 1 | Refrigerantes | Siguen dentro de consumos (Recarga) | Módulo aparte: mismo grano sucursal × mes, mismo usuario. Techo: inventario por equipo |
| 2 | Flota | Sin módulo. Combustible gana **Fuente de emisión** (catálogo con clase y alcance) y **Equipo** opcional; filtrable | "Diésel móvil" como subcategoría: combinatoria combustible × clase |
| 3 | Bus de personal | Una Fuente de emisión más ("Bus 45 personas"), alcance 3 cat. 7 | Módulo de movilidad: solo hace falta con encuestas de commuting o viajes |
| 4 | Residuos | Fuera de la app; existen en Recylink | Capturarlos aquí: dos fuentes de verdad |
| 5 | Logística | Por **Embarque** con fecha (mes/año mínimo), Documento opcional y **Rutas** precargadas. Alcance 3 cat. 4 | Por año o total anual: rompe vistas mensuales y Metas |
| 6 | Factores | **Catálogo** HuellaChile + DEFRA en el repo, con fuente; la empresa elige y puede hacer override justificado | Que cada empresa digite: nadie sabe de dónde sale el número |
| 7 | Historia | Factor elegido **por año de inventario**; recalcular un año pasado es explícito | Recalcular siempre: cambia una huella ya reportada. Snapshot al cierre: techo si hay verificación externa |
| 8 | Categoría 3 | WTT **derivado automático** de todo combustible; se activa por empresa. Pérdidas T&D después (confirmar con HuellaChile dónde van) | Cargarlo a mano: doble digitación |
| 9 | Intensidad | Trabajadores y m² por sucursal y año; intensidad calculada | — (la pide el cliente, no la norma) |
| 10 | Electricidad | Solo método de ubicación | Ubicación + mercado: no hay cliente con PPA ni certificados |
| 11 | Carga masiva | Directo en el Sheet, con listas desplegables en columnas de catálogo y `/api/migracion/columna-id` después | Plantilla de carga en la app: innecesaria |
| 12 | Año inicial | La carga la hace Domingo desde la herramienta, para probarla | Importar 2024 por script |
| 13 | Organización de la app | Registrar por tipo de dato, reportar por alcance y categoría | Todo por alcance o todo por tipo |
| 14 | Salida | **Informe de huella** como ruta imprimible + Excel; Impacto muestra lo mismo en pantalla; una sola función de cálculo | PDF con librería: imprimir desde el navegador alcanza |
| 15 | Límites | Por año: enfoque de control + cada categoría incluida/excluida/no aplica con justificación | Matriz de significancia con puntaje: criterio de cada consultor |

## Supuestos (no discutidos, aceptados al cierre)

- La unidad del dato se elige entre las que el catálogo tenga para ese combustible
  (L, m³, kg, ton); el factor se toma por unidad, sin conversiones propias.
- Lo existente se mantiene como está: Medidores, extracción PDF, fotos, Metas,
  matriz de carga.
- Fuentes del catálogo: hoja `FE HC` de la planilla APRO (670 filas HuellaChile) y
  `ghg-conversion-factors-2025-full-set (1).xlsx` de Labs (DEFRA). Solo factores.

## Consecuencias para el código

- La hoja de combustible gana columnas `Fuente` y `Equipo`, **al final** (después de
  `ID`): `lib/sheets/encabezados.js` corta la lectura si una columna se mueve.
- Hojas nuevas: Fuentes de emisión, Embarques, Rutas, Datos de sucursal, Límites, y la
  elección de factores por año en `Config`.
- `lib/domain/emisiones-calc.js` deja de buscar el factor por clave de energético y lo
  toma de (año, combustible, clase, unidad); suma Embarques y Emisiones derivadas.
- Cada emisión calculada lleva alcance, categoría GHG y categoría ISO.

## Pendiente fuera del código

- Planilla y carpeta de APRO en la unidad compartida, env vars y deploy: seguir
  `PLAYBOOK-ESPEJO-CLIENTE.md` (y `CLIENTE.md`) cuando toque.
- Repo vacío en GitHub `recylink/rc-apro-next`, que crea Domingo.

## Estado de implementación (2026-10-14)

Los siete pasos están en `main`, con pruebas (`npm test`):

| Paso | Qué | Dónde |
|------|-----|-------|
| 1 | Catálogo de factores HuellaChile (+ GLP por tonelada de DEFRA 2025) | `scripts/catalogo-factores.mjs` → `lib/domain/catalogo-factores.js` |
| 2 | Fuente de emisión, Equipo y Unidad en Combustible | hoja `Fuentes`; columnas L–N de `Combustible` |
| 3 | Factor por año de inventario | `lib/domain/factores.js`; `Config.factoresPorAnio`; Impacto → Factores |
| 4 | WTT derivado (alcance 3, cat. 3) | `Config.wtt`; interruptor en Factores |
| 5 | Embarques y Rutas (alcance 3, cat. 4) | hojas `Embarques` y `Rutas`; pantalla Logística |
| 6 | Organización, datos de sucursal y límites por año | `Config.organizacion/datosSucursal/limites`; Impacto → Límites |
| 7 | Informe anual: pantalla, impresión y Excel | `lib/domain/informe.js`; `/impacto/informe` |

Lo que se apartó del diseño, y por qué:

- **Ya no hay factor por sucursal.** El valor propio por año lo reemplaza; un caso como
  generación propia se modela como otro sistema eléctrico u otra fuente.
- **Las exclusiones no se cruzan con la matriz de carga.** La matriz es por tipo de consumo
  y una categoría GHG no se mapea uno a uno a un tipo. El informe sí las descuenta y avisa
  si una categoría excluida tiene emisiones.
- **Impacto (el tablero con filtros) muestra todo lo registrado; el informe, el inventario
  declarado.** Si hay categorías excluidas con emisiones, los totales difieren y el informe
  lo dice.
- **El documento de un embarque es texto** (N° de BL o link), no un archivo subido.
