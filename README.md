# Portal de clientes · Graphique Marketing (GM-ONB-3.0)

Portal de onboarding independiente del sitio comercial. **Next.js 15 + Supabase** (ADR-001).
Este repositorio es la **Fase C (MVP en staging)**. No modifica graphiquemarketing.com.mx ni sus CTA: los leads siguen entrando por el brief comercial a HubSpot y el equipo los da de alta aquí en **Alta desde HubSpot**.

## Qué incluye
| Área | Dónde |
|---|---|
| Solicitud pública (`/solicitud?plan=`), confirmación, antispam y límite por IP | `app/solicitud`, `create_request()` |
| Acceso de clientes con código por correo, 6 dígitos (sin contraseña) | `app/acceso` |
| Invitación propia de 72 h, un solo uso, ligada al correo | `app/invitacion/[token]`, `create_invitation()`, `accept_invitation()` |
| Personal con contraseña + MFA TOTP obligatorio (sin aal2 la base de datos no muestra nada) | `app/admin/acceso`, `is_staff()` |
| Brief M01–M10 con visibilidad por paquete, autoguardado, «No lo sé», control de edición simultánea | `components/brief/BriefModule.tsx`, `save_answer()` |
| Archivos: registro previo de ruta, subida directa a bucket privado, verificación de tamaño, versiones, cuota | `components/brief/FileUploader.tsx`, `register_file()`, `confirm_file()` |
| Revisión, aclaraciones con historial, clasificación de alcance, aprobación inmutable con SHA-256 | `app/admin/proyectos/[id]/*`, `approve_brief()` |
| Expediente: PDF, JSON, inventario CSV, matriz CSV, arranque para Claude | `lib/export.ts`, `lib/pdf.ts`, ruta `exportar/[version]/[kind]` |
| Correos transaccionales con registro y reintentos | `lib/server/email.ts`, tabla `notifications` |
| Auditoría inmutable de estados, contratos, invitaciones, archivos, alcance, exportaciones, personal y membresías | tabla `audit_logs` |

## Puesta en marcha en STAGING (webmaster)
1. **Supabase**: crea un proyecto nuevo solo para staging (región sugerida: la más cercana a México disponible).
2. **Migraciones**: con la CLI de Supabase (`supabase link --project-ref <ref>` y `supabase db push`) o pegando en el SQL Editor, en orden, los archivos de `supabase/migrations/`. Después, opcionalmente, `supabase/seed.sql` (datos ficticios).
3. **Auth** (Authentication › Providers / Settings):
   - Email: **desactivar «Allow new users to sign up»** (las cuentas de cliente solo se crean al aceptar una invitación).
   - Plantilla «Magic Link»: debe mostrar el código `{{ .Token }}` (el portal usa código, no enlace). Vigencia del OTP: 600 s. La longitud del código («Email OTP Length») debe coincidir con `NEXT_PUBLIC_EMAIL_OTP_LENGTH` (8 por omisión).
   - MFA: TOTP habilitado.
   - SMTP personalizado (Resend o Postmark) para que los códigos lleguen de forma confiable; configurar SPF, DKIM y DMARC en el dominio.
4. **Personal de Graphique**: Authentication › Add user (correo y contraseña) y luego en SQL:
   `insert into public.staff (user_id, role, display_name) values ('<uuid>', 'comercial', 'Nombre');` (roles: `comercial`, `pm`, `admin_tecnico`). En el primer acceso cada persona da de alta su app de autenticación.
5. **Hosting de la app** (sugerido Vercel; cualquier hosting de Node 20+ sirve): importar el repositorio privado, configurar las variables de `.env.example` y el dominio `staging-clientes.graphiquemarketing.com.mx` (registro CNAME en la zona DNS del dominio, sin tocar el sitio actual).
6. **Tipografía e identidad**: copiar `montserrat-latin-wght-normal.woff2` del sitio a `public/fonts/` y sustituir en `app/globals.css` los tokens provisionales por el bloque `:root` real del sitio.

## Desarrollo
```bash
npm ci
npm test          # 20 pruebas de dominio (cuestionario, alcance, exportación, archivos, analítica)
npm run test:db   # 61 pruebas de base de datos sobre Postgres 16 local (flujo, RLS, aislamiento entre clientes)
npm run build
npm run gen:catalog   # regenera la migración del catálogo/cuestionario si cambian lib/catalog.ts o lib/questionnaire.ts
```

## Reglas que no se rompen
- Ninguna escritura directa a tablas desde el navegador: todo pasa por funciones `security definer` que validan rol, estado y organización, y dejan auditoría.
- `?plan=` solo preselecciona. Precio, permisos y estado contractual los decide la base de datos.
- Un cliente no puede marcarse contratado ni aprobar su propio expediente.
- Las versiones aprobadas y la auditoría no se modifican (triggers).
- El expediente para IA excluye contacto e información confidencial; la exportación a Claude es manual.
- No se aceptan contraseñas en el cuestionario ni archivos ejecutables.
