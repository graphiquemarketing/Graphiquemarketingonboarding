# ADR-001 · Stack del portal de clientes
Estado: **Aceptado** por Graphique el 21/10/2026.

**Decisión:** Next.js (App Router, TypeScript) + Supabase (Auth, Postgres con RLS, Storage privado), en el subdominio `clientes.graphiquemarketing.com.mx`, separado del sitio en Apache/cPanel.

**Motivos:** autenticación con OTP y MFA incluida; autorización a nivel de fila en la base de datos (no depende del frontend); almacenamiento privado con URLs firmadas; respaldo administrado; portabilidad (Postgres estándar, migraciones SQL versionadas).

**Consecuencias:** requiere repositorio privado, un hosting de Node (sugerido Vercel) y un proveedor SMTP (Resend o Postmark). El sitio público no cambia. Costos mensuales a confirmar con los planes vigentes de cada proveedor antes de producción.
