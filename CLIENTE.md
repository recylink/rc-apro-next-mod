# Cliente: APRO

Herramienta de huella de carbono para APRO (Comercial de Artículos de Protección y Seguridad Industrial Manquehue Ltda, RUT 86.887.200-4).
Diseño en [DISEÑO-APRO.md](DISEÑO-APRO.md).

| Qué | Valor |
|-----|-------|
| `EMPRESA` | `APRO` |
| Planilla | "APRO NEXT" — `1hKQSyEhx66bUhlu8_uhAO8vj4HluBo5_KxgQB7kCvTc` |
| Carpeta raíz | "APRO" — `1PN0iPdrJ-fBRHlOo3sqSJd_WALO6jYdZ`, dentro de la unidad compartida `0ADgVGuZngcHNUk9PVA` |
| Robot | `rcando@recylink.iam.gserviceaccount.com` (hereda acceso de la unidad) |
| Repo | `recylink/rc-apro-next-mod` |
| Vercel | proyecto `rc-apro-next-mod` (scope recylink) → https://rc-apro-next-mod.vercel.app, con `SITE_PASSWORD`. Sin conexión a GitHub: deploy manual con `vercel --prod` |

## Bitácora

- **2026-10-14** — greenfield: planilla y carpeta nuevas, sin prototipo que apagar
  (`APPS_SCRIPT_URL` queda vacía: no hay correo de "foto pendiente").
  `POST /api/migracion/setup` creó las hojas y el árbol de carpetas bajo "APRO";
  `columna-id` encendió `registrosConId` con 0 ids escritos. Queda una `Hoja 1` vacía
  que la app no usa.
- **2026-10-14** — primer deploy a producción con `vercel --prod`. `vercel link` creó el
  proyecto pero no pudo conectar el repo (la app de Vercel en la org no tiene acceso a
  repos nuevos sin aprobación de un owner). Variables: credenciales del robot,
  `SPREADSHEET_ID`, `SPREADSHEET_URL`, `RC_SDK_ACTIONS` y `SITE_PASSWORD`; sin
  `APPS_SCRIPT_URL`.
