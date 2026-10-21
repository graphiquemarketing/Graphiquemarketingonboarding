-- GM-ONB-3.0 · Portal de clientes · 0001 Esquema
-- Entidades mínimas de la sección 10 del brief. Nombres en inglés para el modelo, contenido en español.

create extension if not exists pgcrypto with schema extensions;

create type public.project_state as enum (
  'SOLICITUD_RECIBIDA','CONTACTO_PENDIENTE','PROPUESTA_ENVIADA','CONTRATACION_PENDIENTE','CONTRATADO',
  'INVITACION_PENDIENTE','BRIEF_EN_PROGRESO','BRIEF_ENVIADO','EN_REVISION','INFORMACION_PENDIENTE',
  'BRIEF_APROBADO','LISTO_PARA_PLANEACION','DESCARTADA');
create type public.staff_role  as enum ('comercial','pm','admin_tecnico');
create type public.member_role as enum ('responsable','colaborador');
create type public.scope_class as enum ('INCLUIDA','NO_INCLUIDA','PENDIENTE','ADICIONAL','ADICIONAL_APROBADA','NO_APLICA');
create type public.file_status as enum ('PENDIENTE_CARGA','RECIBIDO','APROBADO','REEMPLAZO_SOLICITADO','RECHAZADO');

-- Personal de Graphique (las cuentas se crean en Supabase Auth y se dan de alta aquí).
create table public.staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         public.staff_role not null,
  display_name text not null check (char_length(display_name) between 2 and 80),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'colaborador',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.organization_members (user_id);

-- Catálogo versionado: un cambio de precios o alcances crea una versión nueva.
create table public.package_versions (
  code       text not null check (code in ('PERSONAL','PYME','CORPORATE','TURNKEY')),
  version    text not null,
  name       text not null,
  data       jsonb not null,
  active     boolean not null default true,
  primary key (code, version)
);

create table public.questionnaire_versions (
  id           text primary key,
  published_at timestamptz not null default now(),
  definition   jsonb not null
);

create table public.questions (
  version_id text not null references public.questionnaire_versions(id) on delete cascade,
  id         text not null check (id ~ '^M[0-9]{2}_Q[0-9]{2}$'),
  module     text not null,
  type       text not null,
  label      text not null,
  required   boolean not null default false,
  sensitive  boolean not null default false,
  packages   text[],
  has_condition boolean not null default false,
  definition jsonb not null,
  primary key (version_id, id)
);

create sequence public.folio_seq;

create table public.projects (
  id                    uuid primary key default gen_random_uuid(),
  folio                 text not null unique default ('GM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.folio_seq')::text, 4, '0')),
  org_id                uuid not null references public.organizations(id) on delete restrict,
  package_code          text not null,
  package_version       text not null,
  questionnaire_version text not null references public.questionnaire_versions(id),
  state                 public.project_state not null default 'SOLICITUD_RECIBIDA',
  source                text not null default 'portal' check (source in ('portal','hubspot','manual')),
  source_cta            text,
  utm                   jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (package_code, package_version) references public.package_versions(code, version)
);
create index on public.projects (org_id);
create index on public.projects (state);

-- Datos del prospecto: solo los ve Graphique.
create table public.lead_contacts (
  project_id          uuid primary key references public.projects(id) on delete cascade,
  full_name           text not null check (char_length(full_name) between 2 and 120),
  email               text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  phone               text not null check (char_length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15),
  comment             text check (char_length(comment) <= 2000),
  privacy_accepted_at timestamptz not null,
  created_at          timestamptz not null default now()
);
create index on public.lead_contacts (lower(email));

create table public.contracts (
  project_id   uuid primary key references public.projects(id) on delete cascade,
  reference    text not null check (char_length(reference) between 2 and 80),
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now()
);

-- Invitaciones propias (72 h): el token solo existe en el correo; aquí se guarda su SHA-256.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        public.member_role not null default 'responsable',
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at  timestamptz,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);
create index on public.invitations (project_id);

create table public.answers (
  project_id  uuid not null references public.projects(id) on delete cascade,
  question_id text not null check (question_id ~ '^M[0-9]{2}_Q[0-9]{2}$'),
  value       jsonb,
  revision    integer not null default 1,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (project_id, question_id)
);

-- Cada fila es una versión de un archivo lógico (file_key). Reemplazar crea una versión nueva; nada se sobrescribe.
create table public.files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  file_key      uuid not null,
  version       integer not null check (version > 0),
  category      text not null check (category in ('Identidad','Fotografías','Videos','Textos','Catálogos','Presentaciones','Casos','Referencias','Documentos técnicos','Otros')),
  original_name text not null check (char_length(original_name) between 1 and 255),
  storage_path  text not null unique,
  mime          text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  status        public.file_status not null default 'PENDIENTE_CARGA',
  uploaded_by   uuid not null references auth.users(id),
  uploaded_at   timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  review_note   text,
  unique (file_key, version)
);
create index on public.files (project_id);

create table public.review_requests (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  module      text not null check (module ~ '^M[0-9]{2}$'),
  question    text not null check (char_length(question) between 3 and 1000),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  answer      text check (char_length(answer) <= 4000),
  answered_by uuid references auth.users(id),
  answered_at timestamptz
);
create index on public.review_requests (project_id);

create table public.scope_overrides (
  project_id     uuid not null references public.projects(id) on delete cascade,
  item_key       text not null check (item_key ~ '^[a-z]+(:[a-z_]+)?$'),
  classification public.scope_class not null check (classification <> 'ADICIONAL'),
  note           text check (char_length(note) <= 500),
  decided_by     uuid not null references auth.users(id),
  decided_at     timestamptz not null default now(),
  primary key (project_id, item_key),
  -- Una ampliación aprobada exige registro de autorización.
  check (classification <> 'ADICIONAL_APROBADA' or char_length(coalesce(note, '')) >= 3)
);

-- Versiones aprobadas: inmutables (ver trigger en 0002).
create table public.approvals (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete restrict,
  version               integer not null,
  approved_by           uuid not null references auth.users(id),
  approved_by_label     text not null,
  approved_at           timestamptz not null default now(),
  package_code          text not null,
  package_version       text not null,
  questionnaire_version text not null,
  answers               jsonb not null,
  scope                 jsonb not null,
  files                 jsonb not null,
  hash                  text not null,
  unique (project_id, version)
);

create table public.exports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  approval_id uuid not null references public.approvals(id),
  kind        text not null check (kind in ('pdf','json','inventario','matriz','claude')),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  project_id  uuid references public.projects(id) on delete set null,
  actor       uuid,
  actor_label text not null,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index on public.audit_logs (project_id, at desc);

-- Cola de correos transaccionales con reintentos idempotentes (la clave es id).
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  kind       text not null,
  to_email   text not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'PENDIENTE' check (status in ('PENDIENTE','ENVIADO','ERROR')),
  attempts   integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create table public.request_throttle (
  id  bigint generated always as identity primary key,
  key text not null,
  at  timestamptz not null default now()
);
create index on public.request_throttle (key, at);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
