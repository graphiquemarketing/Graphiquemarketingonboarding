/** Traduce los errores de la base de datos a mensajes que explican qué hacer. */
const MESSAGES: Record<string, string> = {
  SIN_PERMISO: 'Tu cuenta no tiene permiso para esta acción.',
  TRANSICION_INVALIDA: 'El proyecto cambió de estado. Recarga la página para ver lo más reciente.',
  REQUIERE_: 'Esta acción se hace desde su pantalla específica.',
  FALTA_FOLIO: 'Escribe el folio de la propuesta o del contrato.',
  PAQUETE_INVALIDO: 'Elige uno de los paquetes del catálogo.',
  PAQUETE_BLOQUEADO: 'El paquete ya no se puede cambiar porque el proyecto está contratado.',
  DEMASIADAS_SOLICITUDES: 'Recibimos varias solicitudes desde tu conexión. Espera una hora o escríbenos por WhatsApp.',
  INVITACION_NO_PERMITIDA: 'Solo se invita a proyectos contratados.',
  CORREO_INVALIDO: 'Revisa el correo: falta la @ o el dominio.',
  INVITACION_INVALIDA: 'El enlace de invitación no es válido. Pide uno nuevo a Graphique.',
  INVITACION_USADA: 'Esta invitación ya se usó. Entra con tu correo desde la página de acceso.',
  INVITACION_VENCIDA: 'La invitación venció. Pide una nueva a Graphique.',
  CORREO_NO_COINCIDE: 'Entraste con un correo distinto al invitado. Cierra sesión y usa el correo de la invitación.',
  BRIEF_BLOQUEADO: 'El brief ya se envió. Graphique te avisará si necesita cambios.',
  PREGUNTA_INVALIDA: 'Esa pregunta no existe en tu cuestionario.',
  RESPUESTA_DEMASIADO_LARGA: 'La respuesta es demasiado larga. Resúmela o súbela como archivo.',
  CONFLICTO_DE_EDICION: 'Otra persona de tu equipo editó esta respuesta. Recarga para ver su versión.',
  FALTAN_OBLIGATORIAS: 'Faltan preguntas obligatorias. Revisa el resumen.',
  EXTENSION_INVALIDA: 'Ese tipo de archivo no está permitido.',
  ARCHIVO_INVALIDO: 'No encontramos ese archivo.',
  CUOTA_EXCEDIDA: 'Tu proyecto llegó al límite de almacenamiento. Escríbenos para ampliarlo.',
  ARCHIVO_NO_SUBIDO: 'El archivo no terminó de subir. Inténtalo de nuevo.',
  TAMANO_NO_COINCIDE: 'El archivo llegó incompleto. Inténtalo de nuevo.',
  FALTAN_RESPUESTAS: 'Responde todas las aclaraciones antes de enviarlas.',
  ALCANCE_BLOQUEADO: 'El alcance solo se clasifica durante la revisión.',
  ALCANCE_PENDIENTE: 'Hay partidas pendientes o ampliaciones sin decidir.',
  ACLARACIONES_ABIERTAS: 'Hay aclaraciones sin respuesta.',
  USUARIO_INVALIDO: 'No encontramos esa cuenta.',
  ES_CLIENTE: 'Esa cuenta pertenece a un cliente; usa otro correo para el equipo.',
  NO_PUEDES_QUITARTE_ACCESO: 'No puedes desactivarte ni quitarte el rol de administrador a ti mismo.',
  FALTA_NOMBRE: 'Escribe el nombre de la persona.',
  DEBE_HABER_UN_ADMIN: 'Debe quedar al menos un administrador activo.',
  REGISTRO_INMUTABLE: 'Las versiones aprobadas y la auditoría no se modifican.',
};

export function friendlyError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? '';
  const key = Object.keys(MESSAGES).find((k) => m.includes(k));
  if (key) return MESSAGES[key];
  if (/check constraint/.test(m)) return 'Algún dato no tiene el formato esperado. Revísalo e inténtalo de nuevo.';
  return 'No pudimos completar la acción. Inténtalo de nuevo en unos minutos.';
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
