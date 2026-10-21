# Fase C · MVP en staging · estado al 21/10/2026

## Resultado
Código completo del MVP, compilado y probado fuera de producción. Falta conectarlo a un proyecto Supabase de staging y a un hosting (pasos del README), que requieren cuentas de Graphique.

| Verificación | Resultado |
|---|---|
| `next build` con revisión de tipos | Sin errores · 24 rutas |
| Pruebas de dominio (`npm test`) | 20 de 20 |
| Pruebas de base de datos (`npm run test:db`, Postgres 16) | 61 de 61 |
| Prueba de humo del servidor | Páginas públicas 200, 404 propio, invitación inválida → «enlace vencido», CSP/HSTS/X-Frame-Options presentes, `?plan=pyme` preselecciona y `?plan=gratis` no |
| Prueba de punta a punta con Supabase Auth real | **Pendiente en staging** (no hay Docker en este entorno) |

## Matriz QA del brief
| ID | Estado | Evidencia |
|---|---|---|
| CTA-01 | Sin cambios en el sitio (coexistencia aprobada) | Alta desde HubSpot en `/admin/proyectos/nuevo` |
| SEC-01 | Cubierto | `planFromParam`, `PAQUETE_INVALIDO`, prueba de humo |
| COM-01 | Cubierto | Prueba SQL «antes de aceptar, el cliente no ve su proyecto» |
| AUTH-01 | Cubierto en BD | 8 pruebas SQL de aislamiento (lectura, escritura, archivos, storage, prospectos, auditoría) |
| BRF-01 | Cubierto | Pruebas de visibilidad por paquete y por respuesta |
| BRF-02 | Cubierto | Autoguardado con debounce, reintento, modo sin conexión, `CONFLICTO_DE_EDICION` |
| FIL-01 | Cubierto, falta antivirus | Bucket privado, URL firmada de 60 s, ruta registrada, tamaño verificado, firma de bytes en el navegador. **Pendiente: análisis antivirus en servidor (Fase D)** |
| REV-01 | Cubierto | Prueba SQL de historial de aclaraciones |
| APR-01 | Cubierto | Trigger de inmutabilidad, huella SHA-256, v1 no cambia al editar v2 |
| SCP-01 | Cubierto | `ALCANCE_PENDIENTE`, nota obligatoria para ampliación aprobada |
| EXP-01 | Cubierto | Exportaciones salen del snapshot aprobado; pruebas de exclusión de datos |
| MAIL-01 | Implementado, falta probar entrega | Registro en `notifications`, 3 reintentos idempotentes; sin llave = simulado |
| ANA-01 | Cubierto | Lista blanca de parámetros, deduplicación por sesión |
| ACC-01 | Implementado, falta auditoría con lector de pantalla | Etiquetas, `aria-live`, foco visible, código pegable, objetivos de 40 px |
| OPS-01 | Pendiente (Fase E) | Respaldo y restauración en el plan de Supabase |
| REG-01 | Sin riesgo | El sitio público no se modifica |

## Decisiones tomadas al construir (para validar)
1. **Invitación propia de 72 h** en lugar del enlace de Supabase (que permite máximo 24 h). El token solo vive en el correo; la base guarda su SHA-256.
2. **Altas públicas desactivadas**: la cuenta del cliente se crea solo con una invitación vigente.
3. **MFA exigido en la base de datos** (`aal2` en RLS), no solo en pantallas.
4. **Cuota de 2 GB por proyecto** y límites por tipo de archivo (PDF/Office 25 MB, ZIP 200 MB, video 500 MB).
5. **Los datos de contacto (M01_Q05, M10_Q01) y «lo que no debemos publicar» (M02_Q05) no salen al expediente para IA**; sí aparecen en el PDF interno.
6. El brief se modela como respuestas versionadas por pregunta más snapshots en `approvals`; no se usó una tabla `answer_sets` separada.

## Pendiente para la Fase D (integración y QA)
- Conectar staging: Supabase, SMTP, dominio y variables (README).
- Prueba de punta a punta con cuentas reales: comercial, PM, cliente A y cliente B.
- Antivirus de archivos (Edge Function con ClamAV o servicio equivalente) antes de marcar RECIBIDO.
- Recordatorios de brief incompleto (cron de Supabase o Vercel con frecuencia configurable).
- Auditoría de accesibilidad con lector de pantalla y teclado en móvil.
- Sustituir tokens visuales provisionales y tipografía local.
- GTM en el portal con banner de consentimiento propio (el consentimiento del sitio no se comparte entre subdominios).
- Revisión jurídica del aviso de privacidad para las nuevas finalidades del portal.
