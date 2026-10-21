/**
 * Máquina de estados del proyecto. Espejo de public.state_transitions (migración 0002).
 * La autoridad es la base de datos: este archivo solo decide qué botones mostrar.
 */
export const STATES = [
  'SOLICITUD_RECIBIDA', 'CONTACTO_PENDIENTE', 'PROPUESTA_ENVIADA', 'CONTRATACION_PENDIENTE', 'CONTRATADO',
  'INVITACION_PENDIENTE', 'BRIEF_EN_PROGRESO', 'BRIEF_ENVIADO', 'EN_REVISION', 'INFORMACION_PENDIENTE',
  'BRIEF_APROBADO', 'LISTO_PARA_PLANEACION', 'DESCARTADA',
] as const;
export type ProjectState = (typeof STATES)[number];

export type Actor = 'comercial' | 'pm' | 'admin_tecnico' | 'responsable' | 'colaborador';

export const STATE_LABEL: Record<ProjectState, string> = {
  SOLICITUD_RECIBIDA: 'Solicitud recibida', CONTACTO_PENDIENTE: 'Contacto pendiente', PROPUESTA_ENVIADA: 'Propuesta enviada',
  CONTRATACION_PENDIENTE: 'Contratación pendiente', CONTRATADO: 'Contratado', INVITACION_PENDIENTE: 'Invitación pendiente',
  BRIEF_EN_PROGRESO: 'Brief en progreso', BRIEF_ENVIADO: 'Brief enviado', EN_REVISION: 'En revisión',
  INFORMACION_PENDIENTE: 'Información pendiente', BRIEF_APROBADO: 'Brief aprobado', LISTO_PARA_PLANEACION: 'Listo para planeación',
  DESCARTADA: 'Descartada',
};

export type Tone = 'lead' | 'com' | 'ok' | 'work' | 'bad' | 'na';
export const STATE_TONE: Record<ProjectState, Tone> = {
  SOLICITUD_RECIBIDA: 'lead', CONTACTO_PENDIENTE: 'com', PROPUESTA_ENVIADA: 'com', CONTRATACION_PENDIENTE: 'com',
  CONTRATADO: 'ok', INVITACION_PENDIENTE: 'work', BRIEF_EN_PROGRESO: 'work', BRIEF_ENVIADO: 'lead', EN_REVISION: 'lead',
  INFORMACION_PENDIENTE: 'bad', BRIEF_APROBADO: 'ok', LISTO_PARA_PLANEACION: 'ok', DESCARTADA: 'na',
};

export interface Transition {
  from: ProjectState;
  to: ProjectState;
  actors: Actor[];
  label: string;
  /** Si la transición solo ocurre dentro de una función específica (con validaciones extra). */
  via?: 'confirm_contract' | 'create_invitation' | 'accept_invitation' | 'submit_brief' | 'request_clarification' | 'answer_clarifications' | 'approve_brief';
}

export const TRANSITIONS: Transition[] = [
  { from: 'SOLICITUD_RECIBIDA', to: 'CONTACTO_PENDIENTE', actors: ['comercial'], label: 'Tomar solicitud' },
  { from: 'CONTACTO_PENDIENTE', to: 'PROPUESTA_ENVIADA', actors: ['comercial'], label: 'Registrar propuesta enviada' },
  { from: 'PROPUESTA_ENVIADA', to: 'CONTRATACION_PENDIENTE', actors: ['comercial'], label: 'Propuesta aceptada' },
  { from: 'CONTRATACION_PENDIENTE', to: 'CONTRATADO', actors: ['comercial'], label: 'Confirmar contratación', via: 'confirm_contract' },
  { from: 'CONTRATADO', to: 'INVITACION_PENDIENTE', actors: ['comercial', 'pm'], label: 'Enviar invitación', via: 'create_invitation' },
  { from: 'INVITACION_PENDIENTE', to: 'BRIEF_EN_PROGRESO', actors: ['responsable', 'colaborador'], label: 'Aceptar invitación', via: 'accept_invitation' },
  { from: 'BRIEF_EN_PROGRESO', to: 'BRIEF_ENVIADO', actors: ['responsable'], label: 'Enviar brief para revisión', via: 'submit_brief' },
  { from: 'BRIEF_ENVIADO', to: 'EN_REVISION', actors: ['pm'], label: 'Iniciar revisión' },
  { from: 'EN_REVISION', to: 'INFORMACION_PENDIENTE', actors: ['pm'], label: 'Solicitar aclaración', via: 'request_clarification' },
  { from: 'INFORMACION_PENDIENTE', to: 'EN_REVISION', actors: ['responsable'], label: 'Enviar respuestas', via: 'answer_clarifications' },
  { from: 'EN_REVISION', to: 'BRIEF_APROBADO', actors: ['pm'], label: 'Aprobar versión', via: 'approve_brief' },
  { from: 'BRIEF_APROBADO', to: 'LISTO_PARA_PLANEACION', actors: ['pm'], label: 'Marcar listo para planeación' },
  { from: 'BRIEF_APROBADO', to: 'BRIEF_EN_PROGRESO', actors: ['pm'], label: 'Abrir nueva revisión del brief' },
  { from: 'SOLICITUD_RECIBIDA', to: 'DESCARTADA', actors: ['comercial'], label: 'Descartar (duplicado o spam)' },
  { from: 'CONTACTO_PENDIENTE', to: 'DESCARTADA', actors: ['comercial'], label: 'Descartar' },
  { from: 'PROPUESTA_ENVIADA', to: 'DESCARTADA', actors: ['comercial'], label: 'Propuesta no aceptada' },
];

/** Botones genéricos disponibles (sin las transiciones que tienen pantalla propia). */
export function genericActions(state: ProjectState, actor: Actor): Transition[] {
  return TRANSITIONS.filter((t) => t.from === state && t.actors.includes(actor) && !t.via);
}

export const ORDER: ProjectState[] = STATES.filter((s) => s !== 'DESCARTADA');
export function rank(s: ProjectState): number {
  return ORDER.indexOf(s);
}

/** Estados en los que el cliente puede editar respuestas y archivos. */
export const CLIENT_EDITABLE: ProjectState[] = ['BRIEF_EN_PROGRESO', 'INFORMACION_PENDIENTE'];

export const NEXT_STEP: Partial<Record<ProjectState, string>> = {
  INVITACION_PENDIENTE: 'Acepta la invitación para empezar tu brief.',
  BRIEF_EN_PROGRESO: 'Completa los módulos y envía tu brief.',
  BRIEF_ENVIADO: 'Graphique revisará tu brief. Te avisaremos por correo.',
  EN_REVISION: 'Graphique está revisando tu brief. Te avisaremos por correo.',
  INFORMACION_PENDIENTE: 'Responde las aclaraciones para continuar.',
  BRIEF_APROBADO: 'Tu brief está aprobado. Graphique prepara la planeación técnica.',
  LISTO_PARA_PLANEACION: 'Tu proyecto pasó a planeación técnica.',
};
