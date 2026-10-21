-- ============================================================================
-- Portal de clientes Graphique · STAGING · aplicar lo pendiente en un solo paso
-- Dónde: Supabase › proyecto «Graphique Marketing Onboarding» › SQL Editor › pegar todo › Run.
-- Requisito: ya aplicados el esquema (0001) y la parte A de 0002 (estados y auditoría).
-- Seguro de repetir: funciones con «create or replace», políticas con «drop policy if exists»,
-- catálogo con «on conflict do nothing». Todo corre en una transacción: si algo falla, no se aplica nada.
-- ============================================================================
begin;

-- ---------- 0002 · resto de funciones (solicitudes, invitaciones, brief, archivos, revisión, aprobación) ----------
create or replace function public._create_request(
  p_full_name text, p_company text, p_email text, p_phone text, p_comment text,
  p_package text, p_source text, p_source_cta text, p_utm jsonb)
returns table (project_id uuid, folio text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_org uuid; v_p public.projects; v_pkg public.package_versions; v_q text;
begin
  select pid, p.folio into project_id, folio from (
    select p.id as pid, p.folio, p.created_at from public.projects p join public.lead_contacts l on l.project_id = p.id
    where lower(l.email) = lower(trim(p_email)) and p.state in ('SOLICITUD_RECIBIDA','CONTACTO_PENDIENTE','PROPUESTA_ENVIADA','CONTRATACION_PENDIENTE')
    order by p.created_at desc limit 1) p;
  if project_id is not null then
    perform public.audit(project_id, 'SOLICITUD_REPETIDA', jsonb_build_object('paquete', p_package, 'origen', p_source_cta));
    duplicate := true; return next; return;
  end if;
  select * into v_pkg from public.package_versions where code = p_package and active order by version desc limit 1;
  if not found then raise exception 'PAQUETE_INVALIDO' using errcode = '22023'; end if;
  select id into v_q from public.questionnaire_versions order by published_at desc limit 1;
  insert into public.organizations (name) values (left(trim(p_company), 200)) returning id into v_org;
  insert into public.projects (org_id, package_code, package_version, questionnaire_version, source, source_cta, utm)
  values (v_org, v_pkg.code, v_pkg.version, v_q, p_source, left(p_source_cta, 120), coalesce(p_utm, '{}'::jsonb)) returning * into v_p;
  insert into public.lead_contacts (project_id, full_name, email, phone, comment, privacy_accepted_at)
  values (v_p.id, trim(p_full_name), lower(trim(p_email)), trim(p_phone), nullif(left(trim(coalesce(p_comment, '')), 2000), ''), now());
  perform public.audit(v_p.id, 'SOLICITUD_RECIBIDA', jsonb_build_object('paquete', v_pkg.code, 'origen', p_source, 'cta', p_source_cta));
  project_id := v_p.id; folio := v_p.folio; duplicate := false; return next;
end $$;

create or replace function public.create_request(
  p_full_name text, p_company text, p_email text, p_phone text, p_comment text,
  p_package text, p_source_cta text, p_utm jsonb, p_ip_hash text)
returns table (project_id uuid, folio text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.request_throttle where key = p_ip_hash and at > now() - interval '1 hour') >= 5 then
    raise exception 'DEMASIADAS_SOLICITUDES' using errcode = '53400';
  end if;
  insert into public.request_throttle (key) values (p_ip_hash);
  delete from public.request_throttle where at < now() - interval '1 day';
  return query select * from public._create_request(p_full_name, p_company, p_email, p_phone, p_comment, p_package, 'portal', p_source_cta, p_utm);
end $$;

create or replace function public.create_project_manual(
  p_full_name text, p_company text, p_email text, p_phone text, p_comment text, p_package text, p_source text default 'hubspot')
returns table (project_id uuid, folio text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.current_staff_role() is distinct from 'comercial' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  return query select * from public._create_request(p_full_name, p_company, p_email, p_phone, p_comment, p_package, p_source, null, '{}'::jsonb);
end $$;

create or replace function public.change_package(p_project uuid, p_package text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.projects; v_pkg public.package_versions;
begin
  if public.current_staff_role() is distinct from 'comercial' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select * into v from public.projects where id = p_project for update;
  if v.state not in ('SOLICITUD_RECIBIDA','CONTACTO_PENDIENTE','PROPUESTA_ENVIADA','CONTRATACION_PENDIENTE') then
    raise exception 'PAQUETE_BLOQUEADO' using errcode = '22023'; end if;
  select * into v_pkg from public.package_versions where code = p_package and active order by version desc limit 1;
  if not found then raise exception 'PAQUETE_INVALIDO' using errcode = '22023'; end if;
  update public.projects set package_code = v_pkg.code, package_version = v_pkg.version where id = p_project;
  perform public.audit(p_project, 'PAQUETE_CORREGIDO', jsonb_build_object('de', v.package_code, 'a', v_pkg.code));
end $$;

create or replace function public.confirm_contract(p_project uuid, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_staff_role() is distinct from 'comercial' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 2 then raise exception 'FALTA_FOLIO' using errcode = '22023'; end if;
  insert into public.contracts (project_id, reference, confirmed_by) values (p_project, trim(p_reference), auth.uid())
  on conflict (project_id) do update set reference = excluded.reference, confirmed_by = excluded.confirmed_by, confirmed_at = now();
  perform public._transition(p_project, 'CONTRATADO', 'confirm_contract', 'folio ' || trim(p_reference));
end $$;

create or replace function public.create_invitation(p_project uuid, p_email text, p_role public.member_role default 'responsable')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_state public.project_state; v_token text;
begin
  if public.current_staff_role() not in ('comercial','pm') then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select state into v_state from public.projects where id = p_project;
  if v_state not in ('CONTRATADO','INVITACION_PENDIENTE','BRIEF_EN_PROGRESO','INFORMACION_PENDIENTE') then
    raise exception 'INVITACION_NO_PERMITIDA' using errcode = '22023'; end if;
  if p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'CORREO_INVALIDO' using errcode = '22023'; end if;
  update public.invitations set revoked_at = now()
   where project_id = p_project and lower(email) = lower(trim(p_email)) and accepted_at is null and revoked_at is null;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.invitations (project_id, email, role, token_hash, expires_at, created_by)
  values (p_project, lower(trim(p_email)), p_role, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '72 hours', auth.uid());
  perform public.audit(p_project, 'INVITACION_ENVIADA', jsonb_build_object('rol', p_role));
  if v_state = 'CONTRATADO' then perform public._transition(p_project, 'INVITACION_PENDIENTE', 'create_invitation'); end if;
  return v_token;
end $$;

create or replace function public.invitation_info(p_token text)
returns table (folio text, organization text, email_masked text, email text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select p.folio, o.name,
         left(i.email, 1) || '•••' || substr(i.email, position('@' in i.email)),
         i.email,
         case when i.revoked_at is not null then 'REVOCADA' when i.accepted_at is not null then 'ACEPTADA'
              when i.expires_at < now() then 'VENCIDA' else 'VIGENTE' end
  from public.invitations i join public.projects p on p.id = i.project_id join public.organizations o on o.id = p.org_id
  where i.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v public.invitations; v_p public.projects; v_l public.lead_contacts;
begin
  select * into v from public.invitations where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found then raise exception 'INVITACION_INVALIDA' using errcode = '22023'; end if;
  if v.revoked_at is not null or v.accepted_at is not null then raise exception 'INVITACION_USADA' using errcode = '22023'; end if;
  if v.expires_at < now() then raise exception 'INVITACION_VENCIDA' using errcode = '22023'; end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(v.email) then raise exception 'CORREO_NO_COINCIDE' using errcode = '42501'; end if;
  select * into v_p from public.projects where id = v.project_id;
  insert into public.organization_members (org_id, user_id, role) values (v_p.org_id, auth.uid(), v.role)
  on conflict (org_id, user_id) do update set role = case when public.organization_members.role = 'responsable' or excluded.role = 'responsable' then 'responsable'::public.member_role else 'colaborador'::public.member_role end;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = v.id;
  perform public.audit(v.project_id, 'INVITACION_ACEPTADA', jsonb_build_object('rol', v.role));
  if v_p.state = 'INVITACION_PENDIENTE' then
    perform public._transition(v.project_id, 'BRIEF_EN_PROGRESO', 'accept_invitation');
    -- Lo dado en la solicitud llega precargado (WCAG 3.3.7).
    select * into v_l from public.lead_contacts where project_id = v.project_id;
    insert into public.answers (project_id, question_id, value, updated_by)
    values (v.project_id, 'M01_Q01', to_jsonb((select name from public.organizations where id = v_p.org_id)), auth.uid())
    on conflict do nothing;
    if v_l.project_id is not null then
      insert into public.answers (project_id, question_id, value, updated_by)
      values (v.project_id, 'M10_Q01', jsonb_build_object('nombre', v_l.full_name, 'correo', v_l.email, 'tel', v_l.phone), auth.uid())
      on conflict do nothing;
    end if;
  end if;
  return v.project_id;
end $$;

create or replace function public.save_answer(p_project uuid, p_question text, p_value jsonb, p_expected_revision integer default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_state public.project_state; v_q text; v_rev integer;
begin
  if public.member_role_in(p_project) is null then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select state, questionnaire_version into v_state, v_q from public.projects where id = p_project;
  if v_state not in ('BRIEF_EN_PROGRESO','INFORMACION_PENDIENTE') then raise exception 'BRIEF_BLOQUEADO' using errcode = '22023'; end if;
  if not exists (select 1 from public.questions where version_id = v_q and id = p_question) then raise exception 'PREGUNTA_INVALIDA' using errcode = '22023'; end if;
  if octet_length(coalesce(p_value::text, '')) > 32768 then raise exception 'RESPUESTA_DEMASIADO_LARGA' using errcode = '22001'; end if;
  select revision into v_rev from public.answers where project_id = p_project and question_id = p_question for update;
  if found then
    if p_expected_revision is not null and p_expected_revision <> v_rev then raise exception 'CONFLICTO_DE_EDICION' using errcode = '40001'; end if;
    update public.answers set value = p_value, revision = v_rev + 1, updated_by = auth.uid(), updated_at = now()
     where project_id = p_project and question_id = p_question;
    return v_rev + 1;
  end if;
  insert into public.answers (project_id, question_id, value, updated_by) values (p_project, p_question, p_value, auth.uid());
  return 1;
end $$;

create or replace function public._answer_filled(v jsonb) returns boolean language sql immutable set search_path = public as $$
  select case
    when v is null or v = 'null'::jsonb or v = '""'::jsonb or v = to_jsonb('__no_lo_se__'::text) then false
    when jsonb_typeof(v) = 'array' then jsonb_array_length(v) > 0
    when jsonb_typeof(v) = 'object' then exists (select 1 from jsonb_each_text(v) e where coalesce(e.value, '') <> '')
    else true end
$$;

create or replace function public.submit_brief(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.projects; v_missing text[];
begin
  select * into v_p from public.projects where id = p_project;
  -- Defensa en profundidad: obligatorias sin condición deben tener respuesta (la app valida además las condicionales).
  select array_agg(q.id order by q.id) into v_missing
  from public.questions q left join public.answers a on a.project_id = p_project and a.question_id = q.id
  where q.version_id = v_p.questionnaire_version and q.required and not q.has_condition
    and (q.packages is null or v_p.package_code = any (q.packages)) and not public._answer_filled(a.value);
  if v_missing is not null then raise exception 'FALTAN_OBLIGATORIAS %', array_to_string(v_missing, ',') using errcode = '22023'; end if;
  perform public._transition(p_project, 'BRIEF_ENVIADO', 'submit_brief');
end $$;

create or replace function public.register_file(
  p_project uuid, p_file_key uuid, p_category text, p_original_name text, p_ext text, p_mime text, p_size bigint)
returns table (file_id uuid, storage_path text, version integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_state public.project_state; v_key uuid := coalesce(p_file_key, gen_random_uuid()); v_ver integer; v_used bigint;
begin
  if public.member_role_in(p_project) is null then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select state into v_state from public.projects where id = p_project;
  if v_state not in ('BRIEF_EN_PROGRESO','INFORMACION_PENDIENTE') then raise exception 'BRIEF_BLOQUEADO' using errcode = '22023'; end if;
  if p_ext !~ '^[a-z0-9]{1,5}$' then raise exception 'EXTENSION_INVALIDA' using errcode = '22023'; end if;
  if p_file_key is not null and not exists (select 1 from public.files f where f.file_key = p_file_key and f.project_id = p_project) then
    raise exception 'ARCHIVO_INVALIDO' using errcode = '22023'; end if;
  select coalesce(sum(size_bytes), 0) into v_used from public.files where project_id = p_project and status <> 'RECHAZADO';
  if v_used + p_size > 2048::bigint * 1048576 then raise exception 'CUOTA_EXCEDIDA' using errcode = '53400'; end if;
  select coalesce(max(f.version), 0) + 1 into v_ver from public.files f where f.file_key = v_key;
  file_id := gen_random_uuid(); version := v_ver;
  storage_path := p_project::text || '/' || v_key::text || '/v' || v_ver || '.' || p_ext;
  insert into public.files (id, project_id, file_key, version, category, original_name, storage_path, mime, size_bytes, uploaded_by)
  values (file_id, p_project, v_key, v_ver, p_category, left(p_original_name, 255), storage_path, p_mime, p_size, auth.uid());
  return next;
end $$;

create or replace function public.confirm_file(p_file uuid) returns void
language plpgsql security definer set search_path = public, storage as $$
declare v public.files; v_size bigint;
begin
  select * into v from public.files where id = p_file for update;
  if not found or public.member_role_in(v.project_id) is null then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if v.status <> 'PENDIENTE_CARGA' then return; end if;
  select (o.metadata ->> 'size')::bigint into v_size from storage.objects o where o.bucket_id = 'expedientes' and o.name = v.storage_path;
  if v_size is null then raise exception 'ARCHIVO_NO_SUBIDO' using errcode = '22023'; end if;
  if v_size <> v.size_bytes then raise exception 'TAMANO_NO_COINCIDE' using errcode = '22023'; end if;
  update public.files set status = 'RECIBIDO' where id = p_file;
  perform public.audit(v.project_id, 'ARCHIVO_RECIBIDO', jsonb_build_object('file_key', v.file_key, 'version', v.version, 'categoria', v.category));
end $$;

create or replace function public.review_file(p_file uuid, p_status public.file_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v public.files;
begin
  if public.current_staff_role() is distinct from 'pm' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if p_status not in ('APROBADO','REEMPLAZO_SOLICITADO','RECHAZADO') then raise exception 'ESTADO_INVALIDO' using errcode = '22023'; end if;
  update public.files set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 500)
   where id = p_file and status <> 'PENDIENTE_CARGA' returning * into v;
  if not found then raise exception 'ARCHIVO_INVALIDO' using errcode = '22023'; end if;
  perform public.audit(v.project_id, 'ARCHIVO_REVISADO', jsonb_build_object('file_key', v.file_key, 'version', v.version, 'estado', p_status));
end $$;

create or replace function public.request_clarification(p_project uuid, p_module text, p_question text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_staff_role() is distinct from 'pm' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  insert into public.review_requests (project_id, module, question, created_by) values (p_project, p_module, trim(p_question), auth.uid()) returning id into v_id;
  perform public._transition(p_project, 'INFORMACION_PENDIENTE', 'request_clarification', p_module);
  return v_id;
end $$;

create or replace function public.answer_clarifications(p_project uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r public.review_requests; v_a text;
begin
  if public.member_role_in(p_project) is distinct from 'responsable' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  for r in select * from public.review_requests where project_id = p_project and answered_at is null for update loop
    v_a := trim(coalesce(p_answers ->> r.id::text, ''));
    if v_a = '' then raise exception 'FALTAN_RESPUESTAS' using errcode = '22023'; end if;
    update public.review_requests set answer = left(v_a, 4000), answered_by = auth.uid(), answered_at = now() where id = r.id;
  end loop;
  perform public._transition(p_project, 'EN_REVISION', 'answer_clarifications');
end $$;

create or replace function public.set_scope(p_project uuid, p_item_key text, p_class public.scope_class, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_state public.project_state;
begin
  if public.current_staff_role() is distinct from 'pm' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select state into v_state from public.projects where id = p_project;
  if v_state not in ('BRIEF_ENVIADO','EN_REVISION') then raise exception 'ALCANCE_BLOQUEADO' using errcode = '22023'; end if;
  insert into public.scope_overrides (project_id, item_key, classification, note, decided_by)
  values (p_project, p_item_key, p_class, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (project_id, item_key) do update set classification = excluded.classification, note = excluded.note, decided_by = excluded.decided_by, decided_at = now();
  perform public.audit(p_project, 'ALCANCE', jsonb_build_object('partida', p_item_key, 'clasificacion', p_class, 'nota', p_note));
end $$;

create or replace function public.approve_brief(p_project uuid, p_scope jsonb)
returns table (approval_id uuid, version integer, hash text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_p public.projects; v_answers jsonb; v_files jsonb; v_ver integer; v_hash text; v_id uuid; v_label text;
begin
  if public.current_staff_role() is distinct from 'pm' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select * into v_p from public.projects where id = p_project for update;
  if v_p.state <> 'EN_REVISION' then raise exception 'TRANSICION_INVALIDA % -> BRIEF_APROBADO', v_p.state using errcode = '22023'; end if;
  if exists (select 1 from public.review_requests where project_id = p_project and answered_at is null) then
    raise exception 'ACLARACIONES_ABIERTAS' using errcode = '22023'; end if;
  if jsonb_typeof(p_scope) <> 'array' then raise exception 'ALCANCE_INVALIDO' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_scope) e where e ->> 'classification' in ('PENDIENTE','ADICIONAL')) then
    raise exception 'ALCANCE_PENDIENTE' using errcode = '22023'; end if;
  select coalesce(jsonb_object_agg(question_id, value), '{}'::jsonb) into v_answers from public.answers where project_id = p_project;
  select coalesce(jsonb_agg(jsonb_build_object('file_key', f.file_key, 'version', f.version, 'category', f.category, 'original_name', f.original_name,
           'mime', f.mime, 'size_bytes', f.size_bytes, 'status', f.status, 'storage_path', f.storage_path) order by f.category, f.original_name), '[]'::jsonb)
    into v_files
    from (select distinct on (file_key) * from public.files where project_id = p_project and status in ('RECIBIDO','APROBADO') order by files.file_key, files.version desc) f;
  select coalesce(max(a.version), 0) + 1 into v_ver from public.approvals a where a.project_id = p_project;
  v_hash := encode(digest(jsonb_build_object('project', p_project, 'version', v_ver, 'package', v_p.package_code || '@' || v_p.package_version,
              'questionnaire', v_p.questionnaire_version, 'answers', v_answers, 'scope', p_scope, 'files', v_files)::text, 'sha256'), 'hex');
  v_label := public.actor_label();
  insert into public.approvals (project_id, version, approved_by, approved_by_label, package_code, package_version, questionnaire_version, answers, scope, files, hash)
  values (p_project, v_ver, auth.uid(), v_label, v_p.package_code, v_p.package_version, v_p.questionnaire_version, v_answers, p_scope, v_files, v_hash)
  returning id into v_id;
  perform public._transition(p_project, 'BRIEF_APROBADO', 'approve_brief', 'v' || v_ver || ' · ' || left(v_hash, 12));
  approval_id := v_id; version := v_ver; hash := v_hash; return next;
end $$;

create or replace function public.record_export(p_approval uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  if not public.is_staff() then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select project_id into v_project from public.approvals where id = p_approval;
  insert into public.exports (project_id, approval_id, kind, created_by) values (v_project, p_approval, p_kind, auth.uid());
  perform public.audit(v_project, 'EXPORTACION', jsonb_build_object('archivo', p_kind, 'aprobacion', p_approval));
end $$;

-- ---------- 0003 · seguridad por filas y permisos ----------
-- GM-ONB-3.0 · 0003 Seguridad por filas y permisos.
-- Regla: lectura filtrada por RLS; ninguna escritura directa desde el cliente (solo funciones auditadas).

alter table public.staff                  enable row level security;
alter table public.organizations          enable row level security;
alter table public.organization_members   enable row level security;
alter table public.package_versions       enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.questions              enable row level security;
alter table public.state_transitions      enable row level security;
alter table public.projects               enable row level security;
alter table public.lead_contacts          enable row level security;
alter table public.contracts              enable row level security;
alter table public.invitations            enable row level security;
alter table public.answers                enable row level security;
alter table public.files                  enable row level security;
alter table public.review_requests        enable row level security;
alter table public.scope_overrides        enable row level security;
alter table public.approvals              enable row level security;
alter table public.exports                enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.notifications          enable row level security;
alter table public.request_throttle       enable row level security;

-- Sin escrituras directas para anon ni authenticated.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.package_versions, public.questionnaire_versions, public.questions, public.state_transitions to anon, authenticated;
grant select on public.staff, public.organizations, public.organization_members, public.projects, public.lead_contacts, public.contracts,
  public.invitations, public.answers, public.files, public.review_requests, public.scope_overrides, public.approvals, public.exports,
  public.audit_logs to authenticated;

-- Catálogo y cuestionario: públicos.
drop policy if exists catalog_read on public.package_versions;
create policy catalog_read on public.package_versions       for select to anon, authenticated using (true);
drop policy if exists qv_read on public.questionnaire_versions;
create policy qv_read on public.questionnaire_versions for select to anon, authenticated using (true);
drop policy if exists q_read on public.questions;
create policy q_read on public.questions              for select to anon, authenticated using (true);
drop policy if exists st_read on public.state_transitions;
create policy st_read on public.state_transitions      for select to anon, authenticated using (true);

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (user_id = auth.uid() or public.is_staff());

drop policy if exists org_read on public.organizations;
create policy org_read on public.organizations for select to authenticated using (public.is_staff() or public.is_org_member(id));
drop policy if exists members_read on public.organization_members;
create policy members_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff() or public.is_org_member(org_id));

-- COM-01 / AUTH-01: un cliente solo ve proyectos de organizaciones a las que fue invitado y aceptó.
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.can_read_project(id));

drop policy if exists leads_read on public.lead_contacts;
create policy leads_read on public.lead_contacts for select to authenticated using (public.is_staff());
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts     for select to authenticated using (public.is_staff());
drop policy if exists inv_read on public.invitations;
create policy inv_read on public.invitations   for select to authenticated using (public.is_staff());
drop policy if exists exports_read on public.exports;
create policy exports_read on public.exports       for select to authenticated using (public.is_staff());
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs    for select to authenticated using (public.is_staff());

drop policy if exists answers_read on public.answers;
create policy answers_read on public.answers         for select to authenticated using (public.can_read_project(project_id));
drop policy if exists files_read on public.files;
create policy files_read on public.files           for select to authenticated using (public.can_read_project(project_id));
drop policy if exists reviews_read on public.review_requests;
create policy reviews_read on public.review_requests for select to authenticated using (public.can_read_project(project_id));
drop policy if exists scope_read on public.scope_overrides;
create policy scope_read on public.scope_overrides for select to authenticated using (public.can_read_project(project_id));
drop policy if exists approvals_read on public.approvals;
create policy approvals_read on public.approvals      for select to authenticated using (public.can_read_project(project_id));
-- notifications y request_throttle: solo service_role (sin políticas).

-- ---------- Funciones ----------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Ayudantes usados por políticas.
grant execute on function public.current_staff_role(), public.is_staff(), public.is_org_member(uuid), public.member_role_in(uuid),
  public.can_read_project(uuid), public.actor_of(uuid), public.actor_label(), public._answer_filled(jsonb) to anon, authenticated;

-- Operaciones de clientes y personal (cada una valida rol y estado por dentro).
grant execute on function
  public.transition_project(uuid, public.project_state, text),
  public.create_project_manual(text, text, text, text, text, text, text),
  public.change_package(uuid, text),
  public.confirm_contract(uuid, text),
  public.create_invitation(uuid, text, public.member_role),
  public.accept_invitation(text),
  public.save_answer(uuid, text, jsonb, integer),
  public.submit_brief(uuid),
  public.register_file(uuid, uuid, text, text, text, text, bigint),
  public.confirm_file(uuid),
  public.review_file(uuid, public.file_status, text),
  public.request_clarification(uuid, text, text),
  public.answer_clarifications(uuid, jsonb),
  public.set_scope(uuid, text, public.scope_class, text),
  public.approve_brief(uuid, jsonb),
  public.record_export(uuid, text)
to authenticated;

-- Pantalla de invitación sin sesión.
grant execute on function public.invitation_info(text) to anon, authenticated;

-- Solicitud pública: solo desde el servidor con la llave service_role.
grant execute on function public.create_request(text, text, text, text, text, text, text, jsonb, text) to service_role;

-- ---------- 0004 · almacenamiento privado ----------
-- GM-ONB-3.0 · 0004 Almacenamiento privado del expediente (sección 09).
-- Bucket privado, sin URLs públicas permanentes; descargas con URL firmada de corta vigencia.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 524288000, array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','image/jpeg','image/png','image/webp','image/svg+xml',
  'application/postscript','application/illustrator','image/vnd.adobe.photoshop','application/octet-stream',
  'video/mp4','video/quicktime','application/zip','application/x-zip-compressed'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.try_uuid(p text) returns uuid language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

-- Solo se puede subir a una ruta que el servidor registró antes (register_file) y que sigue pendiente.
create or replace function public.can_upload_object(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.files f join public.projects p on p.id = f.project_id
    where f.storage_path = p_name and f.status = 'PENDIENTE_CARGA' and f.uploaded_by = auth.uid()
      and p.state in ('BRIEF_EN_PROGRESO','INFORMACION_PENDIENTE') and public.member_role_in(p.id) is not null)
$$;
grant execute on function public.try_uuid(text), public.can_upload_object(text) to authenticated;

drop policy if exists expedientes_read on storage.objects;
create policy expedientes_read on storage.objects for select to authenticated
  using (bucket_id = 'expedientes' and public.can_read_project(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists expedientes_upload on storage.objects;
create policy expedientes_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and public.can_upload_object(name));
-- Sin políticas de update ni delete: nada se sobrescribe ni se borra desde el cliente.

-- ---------- 0005 · catálogo 2026-10-14 y cuestionario Q-2026-10-21.1 ----------
-- GM-ONB-3.0 · 0005 Catálogo 2026-10-14 y cuestionario Q-2026-10-21.1.
-- GENERADO por scripts/gen-catalog.ts desde lib/catalog.ts y lib/questionnaire.ts. No editar a mano.
-- Para un cambio de precios o preguntas: nueva versión en lib/ y nueva migración (las versiones anteriores se conservan).

insert into public.package_versions (code, version, name, data) values
  ('PERSONAL', '2026-10-14', 'Personal', '{"code":"PERSONAL","name":"Personal","sub":"Professional","priceLabel":"$9,900 MXN + IVA","limitLabel":"1 landing · hasta 6 secciones","max":6,"unit":"secciones","warrantyDays":15,"rounds":"2 rondas","discovery":"Esencial","seo":"SEO inicial","analytics":"GA4 / GSC","included":["formulario","whatsapp"],"conditional":[]}'::jsonb),
  ('PYME', '2026-10-14', 'PyME Growth', '{"code":"PYME","name":"PyME Growth","sub":"Business Growth","priceLabel":"$21,900 MXN + IVA","limitLabel":"Hasta 8 páginas","max":8,"unit":"páginas","warrantyDays":30,"rounds":"3 rondas","discovery":"Completo","seo":"SEO + AEO básico","analytics":"Eventos contratados","included":["formulario","whatsapp","cotizar"],"conditional":[]}'::jsonb),
  ('CORPORATE', '2026-10-14', 'Corporate B2B', '{"code":"CORPORATE","name":"Corporate B2B","sub":"B2B Performance","priceLabel":"Desde $49,900 MXN + IVA","limitLabel":"Hasta 15 páginas/plantillas","max":15,"unit":"páginas/plantillas","warrantyDays":45,"rounds":"Según propuesta","discovery":"Corporativo","seo":"SEO técnico","analytics":"Conversiones","included":["formulario","whatsapp","cotizar","catalogo","descargar"],"conditional":["crm"]}'::jsonb),
  ('TURNKEY', '2026-10-14', 'Turn Key', '{"code":"TURNKEY","name":"Turn Key","sub":"Enterprise","priceLabel":"Desde $149,900 MXN + IVA","limitLabel":"Según contrato","max":null,"unit":"páginas","warrantyDays":60,"rounds":"Según contrato","discovery":"Profundo","seo":"Especificado","analytics":"A medida","included":[],"conditional":"*"}'::jsonb)
on conflict (code, version) do nothing;

insert into public.questionnaire_versions (id, definition) values ('Q-2026-10-21.1', '{"version":"Q-2026-10-21.1","modules":[{"id":"M01","title":"Tu empresa","questions":[{"id":"M01_Q01","label":"¿Cómo se llama tu empresa o marca?","type":"text","required":true,"module":"M01"},{"id":"M01_Q02","label":"¿A qué se dedica?","type":"single","required":true,"options":["Servicios profesionales","Comercio","Industria","Construcción e inmobiliario","Salud","Educación","Tecnología","Hospitalidad","Otro"],"module":"M01"},{"id":"M01_Q03","label":"Cuéntanos brevemente qué hace tu empresa.","type":"area","module":"M01"},{"id":"M01_Q04","label":"¿Dónde atiendes?","type":"multi","options":["Una ciudad","Varias ciudades","Todo México","Otros países","Solo en línea"],"module":"M01"},{"id":"M01_Q05","label":"¿Cuáles son tus datos oficiales de contacto?","type":"fields","required":true,"sensitive":true,"fields":[{"key":"tel","label":"Teléfono","input":"tel"},{"key":"correo","label":"Correo","input":"email","required":true},{"key":"whatsapp","label":"WhatsApp","input":"tel"},{"key":"ciudad","label":"Ciudad","input":"text"}],"module":"M01"},{"id":"M01_Q06","label":"¿Tienes sitio web?","type":"single","options":["Sí","No","No lo sé"],"module":"M01"},{"id":"M01_Q07","label":"Dirección de tu sitio actual","type":"url","when":{"q":"M01_Q06","eq":"Sí"},"module":"M01"}]},{"id":"M02","title":"Servicios y diferenciadores","questions":[{"id":"M02_Q01","label":"¿Qué productos o servicios ofreces?","type":"list","fields":[{"key":"nombre","label":"Nombre"},{"key":"descripcion","label":"Descripción"},{"key":"prioridad","label":"Prioridad","options":["Alta","Media","Baja"]},{"key":"publico","label":"Público"},{"key":"material","label":"¿Tienes material?","options":["Sí","No"]}],"module":"M02"},{"id":"M02_Q02","label":"¿Por qué te eligen tus clientes?","type":"area","module":"M02"},{"id":"M02_Q03","label":"¿Qué servicios quieres promover primero?","type":"multi","optionsFrom":{"q":"M02_Q01","field":"nombre"},"emptyText":"Agrega primero tus servicios en la pregunta anterior.","module":"M02"},{"id":"M02_Q04","label":"¿Qué empresas consideras competencia?","type":"list","fields":[{"key":"nombre","label":"Empresa"},{"key":"url","label":"Sitio web","input":"url"}],"module":"M02"},{"id":"M02_Q05","label":"¿Qué información no debemos publicar?","type":"area","sensitive":true,"module":"M02"}]},{"id":"M03","title":"Clientes y mercado","questions":[{"id":"M03_Q01","label":"¿A quién quieres llegar?","type":"multi","options":["Personas","Microempresas","PyME","Corporativos","Distribuidores","Gobierno","Otros"],"module":"M03"},{"id":"M03_Q02","label":"¿En qué ciudades o países buscas clientes?","type":"text","module":"M03"},{"id":"M03_Q03","label":"¿Qué problema solucionas?","type":"area","module":"M03"},{"id":"M03_Q04","label":"¿Qué preguntas u objeciones recibes?","type":"area","module":"M03"}]},{"id":"M04","title":"Objetivos y conversiones","questions":[{"id":"M04_Q01","label":"¿Qué quieres conseguir con tu web?","type":"multi","required":true,"options":["Cotizaciones","Contactos","Presentación","Proyectos","Ventas","Citas","Llamadas","Descargas","Otro"],"module":"M04"},{"id":"M04_Q02","label":"¿Cuál es el objetivo principal?","type":"single","optionsFrom":{"q":"M04_Q01"},"emptyText":"Elige primero qué quieres conseguir.","module":"M04"},{"id":"M04_Q03","label":"¿Qué datos necesitas de un prospecto?","type":"multi","options":["Nombre","Empresa","Correo","Teléfono","Ciudad","Presupuesto","Mensaje"],"module":"M04"},{"id":"M04_Q04","label":"¿Quién recibirá y atenderá los mensajes?","type":"text","allowUnknown":true,"module":"M04"}]},{"id":"M05","title":"Identidad y referencias","questions":[{"id":"M05_Q01","label":"¿Tienes logotipo?","type":"single","options":["Sí","No","En desarrollo"],"module":"M05"},{"id":"M05_Q02","label":"¿Tienes manual de marca?","type":"single","options":["Sí","No","No lo sé"],"module":"M05"},{"id":"M05_Q03","label":"¿Qué estilo prefieres?","type":"multi","options":["Corporativo","Minimalista","Elegante","Creativo","Tecnológico","Cálido","Sobrio","Otro"],"module":"M05"},{"id":"M05_Q04","label":"¿Qué sitios web te inspiran?","type":"list","fields":[{"key":"url","label":"Sitio","input":"url"},{"key":"gusta","label":"Qué te gusta"},{"key":"no_gusta","label":"Qué no te gusta"}],"module":"M05"},{"id":"M05_Q05","label":"¿Qué elementos de tu imagen actual debemos conservar?","type":"area","module":"M05"}]},{"id":"M06","title":"Contenidos","questions":[{"id":"M06_Q01","label":"¿Qué materiales tienes?","type":"multi","options":["Textos","Fotos","Videos","Logo","Catálogos","Presentaciones","Casos","Testimonios","Ninguno","Otros"],"module":"M06"},{"id":"M06_Q02","label":"¿Quién prepara y aprueba los textos?","type":"text","help":"La redacción especializada no está incluida en ningún paquete; se cotiza aparte.","allowUnknown":true,"module":"M06"},{"id":"M06_Q03","label":"¿Tienes derechos o autorización para publicar fotos, logos y testimonios?","type":"single","options":["Sí","No","Pendiente"],"module":"M06"},{"id":"M06_Q04","label":"¿Qué materiales te faltan?","type":"area","module":"M06"}]},{"id":"M07","title":"Páginas y secciones","questions":[{"id":"M07_Q01","label":"¿Qué apartados necesitas?","labelByPackage":{"PERSONAL":"¿Qué secciones necesita tu landing?"},"type":"multi","countsPages":true,"options":["Inicio","Nosotros","Servicios","Productos","Proyectos","Casos","Blog","FAQ","Contacto","Sucursales","Catálogo","Otros"],"module":"M07"},{"id":"M07_Q02","label":"¿Qué secciones son prioritarias?","type":"order","orderOf":"M07_Q01","help":"Ordena de mayor a menor prioridad.","module":"M07"},{"id":"M07_Q03","label":"¿Hay información que debamos trasladar de una web anterior?","type":"single","options":["Sí","No","No lo sé"],"when":{"q":"M01_Q06","ne":"No"},"module":"M07"},{"id":"M07_Q04","label":"Detalle de lo que hay que trasladar","type":"area","when":{"q":"M07_Q03","eq":"Sí"},"module":"M07"}]},{"id":"M08","title":"Funciones","questions":[{"id":"M08_Q01","label":"¿Qué quieres que hagan tus visitantes?","type":"multi","scoped":true,"keyedOptions":[{"key":"formulario","label":"Enviar un formulario"},{"key":"whatsapp","label":"Escribir por WhatsApp"},{"key":"cotizar","label":"Cotizar"},{"key":"agendar","label":"Agendar"},{"key":"descargar","label":"Descargar"},{"key":"catalogo","label":"Ver un catálogo"},{"key":"buscador","label":"Usar un buscador"},{"key":"pagos","label":"Pagar en línea"},{"key":"area","label":"Entrar a un área privada"},{"key":"crm","label":"Conectar con mi CRM"},{"key":"erp","label":"Conectar con mi ERP"},{"key":"idiomas","label":"Ver el sitio en otros idiomas"},{"key":"otro","label":"Otro"}],"module":"M08"},{"id":"M08_Q02","label":"¿Hay herramientas externas que ya utilizas?","type":"text","help":"Nombre y, si quieres, su dirección web.","module":"M08"},{"id":"M08_Q03","label":"¿Necesitas algún proceso especial?","type":"area","help":"Graphique lo clasificará como incluido, pendiente o adicional.","packages":["CORPORATE","TURNKEY"],"module":"M08"}]},{"id":"M09","title":"Presencia digital","questions":[{"id":"M09_Q01","label":"¿Tienes dominio, hosting y correo corporativo?","type":"tri","items":["Dominio","Hosting","Correo corporativo"],"module":"M09"},{"id":"M09_Q02","label":"¿Utilizas estas herramientas?","type":"tri","items":["Google Analytics 4","Google Search Console","Google Ads","CRM"],"module":"M09"},{"id":"M09_Q03","label":"¿Quién administra esas herramientas?","type":"text","help":"Escribe solo nombres o puestos. Nunca compartas contraseñas en este portal.","allowUnknown":true,"module":"M09"},{"id":"M09_Q04","label":"¿Hay que migrar datos o contenidos?","type":"single","options":["Sí","No","No lo sé"],"packages":["PYME","CORPORATE","TURNKEY"],"module":"M09"},{"id":"M09_Q05","label":"Describe qué hay que migrar","type":"area","when":{"q":"M09_Q04","eq":"Sí"},"module":"M09"}]},{"id":"M10","title":"Responsables y cierre","questions":[{"id":"M10_Q01","label":"¿Quién enviará información y resolverá dudas?","type":"fields","required":true,"sensitive":true,"fields":[{"key":"nombre","label":"Nombre","required":true},{"key":"correo","label":"Correo","input":"email","required":true},{"key":"tel","label":"Teléfono","input":"tel"}],"module":"M10"},{"id":"M10_Q02","label":"¿Quién aprobará diseño, textos y publicación?","type":"list","fields":[{"key":"nombre","label":"Nombre"},{"key":"rol","label":"Qué aprueba","options":["Diseño","Textos","Publicación","Todo"]}],"module":"M10"},{"id":"M10_Q03","label":"¿Tienes una fecha objetivo o evento importante?","type":"date","module":"M10"},{"id":"M10_Q04","label":"¿Por qué esa fecha?","type":"text","when":{"q":"M10_Q03","filled":true},"module":"M10"},{"id":"M10_Q05","label":"¿Hay restricciones o instrucciones adicionales?","type":"area","module":"M10"}]}]}'::jsonb)
on conflict (id) do nothing;

insert into public.questions (version_id, id, module, type, label, required, sensitive, packages, has_condition, definition) values
  ('Q-2026-10-21.1', 'M01_Q01', 'M01', 'text', '¿Cómo se llama tu empresa o marca?', true, false, null, false, '{"id":"M01_Q01","label":"¿Cómo se llama tu empresa o marca?","type":"text","required":true,"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q02', 'M01', 'single', '¿A qué se dedica?', true, false, null, false, '{"id":"M01_Q02","label":"¿A qué se dedica?","type":"single","required":true,"options":["Servicios profesionales","Comercio","Industria","Construcción e inmobiliario","Salud","Educación","Tecnología","Hospitalidad","Otro"],"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q03', 'M01', 'area', 'Cuéntanos brevemente qué hace tu empresa.', false, false, null, false, '{"id":"M01_Q03","label":"Cuéntanos brevemente qué hace tu empresa.","type":"area","module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q04', 'M01', 'multi', '¿Dónde atiendes?', false, false, null, false, '{"id":"M01_Q04","label":"¿Dónde atiendes?","type":"multi","options":["Una ciudad","Varias ciudades","Todo México","Otros países","Solo en línea"],"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q05', 'M01', 'fields', '¿Cuáles son tus datos oficiales de contacto?', true, true, null, false, '{"id":"M01_Q05","label":"¿Cuáles son tus datos oficiales de contacto?","type":"fields","required":true,"sensitive":true,"fields":[{"key":"tel","label":"Teléfono","input":"tel"},{"key":"correo","label":"Correo","input":"email","required":true},{"key":"whatsapp","label":"WhatsApp","input":"tel"},{"key":"ciudad","label":"Ciudad","input":"text"}],"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q06', 'M01', 'single', '¿Tienes sitio web?', false, false, null, false, '{"id":"M01_Q06","label":"¿Tienes sitio web?","type":"single","options":["Sí","No","No lo sé"],"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M01_Q07', 'M01', 'url', 'Dirección de tu sitio actual', false, false, null, true, '{"id":"M01_Q07","label":"Dirección de tu sitio actual","type":"url","when":{"q":"M01_Q06","eq":"Sí"},"module":"M01"}'::jsonb),
  ('Q-2026-10-21.1', 'M02_Q01', 'M02', 'list', '¿Qué productos o servicios ofreces?', false, false, null, false, '{"id":"M02_Q01","label":"¿Qué productos o servicios ofreces?","type":"list","fields":[{"key":"nombre","label":"Nombre"},{"key":"descripcion","label":"Descripción"},{"key":"prioridad","label":"Prioridad","options":["Alta","Media","Baja"]},{"key":"publico","label":"Público"},{"key":"material","label":"¿Tienes material?","options":["Sí","No"]}],"module":"M02"}'::jsonb),
  ('Q-2026-10-21.1', 'M02_Q02', 'M02', 'area', '¿Por qué te eligen tus clientes?', false, false, null, false, '{"id":"M02_Q02","label":"¿Por qué te eligen tus clientes?","type":"area","module":"M02"}'::jsonb),
  ('Q-2026-10-21.1', 'M02_Q03', 'M02', 'multi', '¿Qué servicios quieres promover primero?', false, false, null, false, '{"id":"M02_Q03","label":"¿Qué servicios quieres promover primero?","type":"multi","optionsFrom":{"q":"M02_Q01","field":"nombre"},"emptyText":"Agrega primero tus servicios en la pregunta anterior.","module":"M02"}'::jsonb),
  ('Q-2026-10-21.1', 'M02_Q04', 'M02', 'list', '¿Qué empresas consideras competencia?', false, false, null, false, '{"id":"M02_Q04","label":"¿Qué empresas consideras competencia?","type":"list","fields":[{"key":"nombre","label":"Empresa"},{"key":"url","label":"Sitio web","input":"url"}],"module":"M02"}'::jsonb),
  ('Q-2026-10-21.1', 'M02_Q05', 'M02', 'area', '¿Qué información no debemos publicar?', false, true, null, false, '{"id":"M02_Q05","label":"¿Qué información no debemos publicar?","type":"area","sensitive":true,"module":"M02"}'::jsonb),
  ('Q-2026-10-21.1', 'M03_Q01', 'M03', 'multi', '¿A quién quieres llegar?', false, false, null, false, '{"id":"M03_Q01","label":"¿A quién quieres llegar?","type":"multi","options":["Personas","Microempresas","PyME","Corporativos","Distribuidores","Gobierno","Otros"],"module":"M03"}'::jsonb),
  ('Q-2026-10-21.1', 'M03_Q02', 'M03', 'text', '¿En qué ciudades o países buscas clientes?', false, false, null, false, '{"id":"M03_Q02","label":"¿En qué ciudades o países buscas clientes?","type":"text","module":"M03"}'::jsonb),
  ('Q-2026-10-21.1', 'M03_Q03', 'M03', 'area', '¿Qué problema solucionas?', false, false, null, false, '{"id":"M03_Q03","label":"¿Qué problema solucionas?","type":"area","module":"M03"}'::jsonb),
  ('Q-2026-10-21.1', 'M03_Q04', 'M03', 'area', '¿Qué preguntas u objeciones recibes?', false, false, null, false, '{"id":"M03_Q04","label":"¿Qué preguntas u objeciones recibes?","type":"area","module":"M03"}'::jsonb),
  ('Q-2026-10-21.1', 'M04_Q01', 'M04', 'multi', '¿Qué quieres conseguir con tu web?', true, false, null, false, '{"id":"M04_Q01","label":"¿Qué quieres conseguir con tu web?","type":"multi","required":true,"options":["Cotizaciones","Contactos","Presentación","Proyectos","Ventas","Citas","Llamadas","Descargas","Otro"],"module":"M04"}'::jsonb),
  ('Q-2026-10-21.1', 'M04_Q02', 'M04', 'single', '¿Cuál es el objetivo principal?', false, false, null, false, '{"id":"M04_Q02","label":"¿Cuál es el objetivo principal?","type":"single","optionsFrom":{"q":"M04_Q01"},"emptyText":"Elige primero qué quieres conseguir.","module":"M04"}'::jsonb),
  ('Q-2026-10-21.1', 'M04_Q03', 'M04', 'multi', '¿Qué datos necesitas de un prospecto?', false, false, null, false, '{"id":"M04_Q03","label":"¿Qué datos necesitas de un prospecto?","type":"multi","options":["Nombre","Empresa","Correo","Teléfono","Ciudad","Presupuesto","Mensaje"],"module":"M04"}'::jsonb),
  ('Q-2026-10-21.1', 'M04_Q04', 'M04', 'text', '¿Quién recibirá y atenderá los mensajes?', false, false, null, false, '{"id":"M04_Q04","label":"¿Quién recibirá y atenderá los mensajes?","type":"text","allowUnknown":true,"module":"M04"}'::jsonb),
  ('Q-2026-10-21.1', 'M05_Q01', 'M05', 'single', '¿Tienes logotipo?', false, false, null, false, '{"id":"M05_Q01","label":"¿Tienes logotipo?","type":"single","options":["Sí","No","En desarrollo"],"module":"M05"}'::jsonb),
  ('Q-2026-10-21.1', 'M05_Q02', 'M05', 'single', '¿Tienes manual de marca?', false, false, null, false, '{"id":"M05_Q02","label":"¿Tienes manual de marca?","type":"single","options":["Sí","No","No lo sé"],"module":"M05"}'::jsonb),
  ('Q-2026-10-21.1', 'M05_Q03', 'M05', 'multi', '¿Qué estilo prefieres?', false, false, null, false, '{"id":"M05_Q03","label":"¿Qué estilo prefieres?","type":"multi","options":["Corporativo","Minimalista","Elegante","Creativo","Tecnológico","Cálido","Sobrio","Otro"],"module":"M05"}'::jsonb),
  ('Q-2026-10-21.1', 'M05_Q04', 'M05', 'list', '¿Qué sitios web te inspiran?', false, false, null, false, '{"id":"M05_Q04","label":"¿Qué sitios web te inspiran?","type":"list","fields":[{"key":"url","label":"Sitio","input":"url"},{"key":"gusta","label":"Qué te gusta"},{"key":"no_gusta","label":"Qué no te gusta"}],"module":"M05"}'::jsonb),
  ('Q-2026-10-21.1', 'M05_Q05', 'M05', 'area', '¿Qué elementos de tu imagen actual debemos conservar?', false, false, null, false, '{"id":"M05_Q05","label":"¿Qué elementos de tu imagen actual debemos conservar?","type":"area","module":"M05"}'::jsonb),
  ('Q-2026-10-21.1', 'M06_Q01', 'M06', 'multi', '¿Qué materiales tienes?', false, false, null, false, '{"id":"M06_Q01","label":"¿Qué materiales tienes?","type":"multi","options":["Textos","Fotos","Videos","Logo","Catálogos","Presentaciones","Casos","Testimonios","Ninguno","Otros"],"module":"M06"}'::jsonb),
  ('Q-2026-10-21.1', 'M06_Q02', 'M06', 'text', '¿Quién prepara y aprueba los textos?', false, false, null, false, '{"id":"M06_Q02","label":"¿Quién prepara y aprueba los textos?","type":"text","help":"La redacción especializada no está incluida en ningún paquete; se cotiza aparte.","allowUnknown":true,"module":"M06"}'::jsonb),
  ('Q-2026-10-21.1', 'M06_Q03', 'M06', 'single', '¿Tienes derechos o autorización para publicar fotos, logos y testimonios?', false, false, null, false, '{"id":"M06_Q03","label":"¿Tienes derechos o autorización para publicar fotos, logos y testimonios?","type":"single","options":["Sí","No","Pendiente"],"module":"M06"}'::jsonb),
  ('Q-2026-10-21.1', 'M06_Q04', 'M06', 'area', '¿Qué materiales te faltan?', false, false, null, false, '{"id":"M06_Q04","label":"¿Qué materiales te faltan?","type":"area","module":"M06"}'::jsonb),
  ('Q-2026-10-21.1', 'M07_Q01', 'M07', 'multi', '¿Qué apartados necesitas?', false, false, null, false, '{"id":"M07_Q01","label":"¿Qué apartados necesitas?","labelByPackage":{"PERSONAL":"¿Qué secciones necesita tu landing?"},"type":"multi","countsPages":true,"options":["Inicio","Nosotros","Servicios","Productos","Proyectos","Casos","Blog","FAQ","Contacto","Sucursales","Catálogo","Otros"],"module":"M07"}'::jsonb),
  ('Q-2026-10-21.1', 'M07_Q02', 'M07', 'order', '¿Qué secciones son prioritarias?', false, false, null, false, '{"id":"M07_Q02","label":"¿Qué secciones son prioritarias?","type":"order","orderOf":"M07_Q01","help":"Ordena de mayor a menor prioridad.","module":"M07"}'::jsonb),
  ('Q-2026-10-21.1', 'M07_Q03', 'M07', 'single', '¿Hay información que debamos trasladar de una web anterior?', false, false, null, true, '{"id":"M07_Q03","label":"¿Hay información que debamos trasladar de una web anterior?","type":"single","options":["Sí","No","No lo sé"],"when":{"q":"M01_Q06","ne":"No"},"module":"M07"}'::jsonb),
  ('Q-2026-10-21.1', 'M07_Q04', 'M07', 'area', 'Detalle de lo que hay que trasladar', false, false, null, true, '{"id":"M07_Q04","label":"Detalle de lo que hay que trasladar","type":"area","when":{"q":"M07_Q03","eq":"Sí"},"module":"M07"}'::jsonb),
  ('Q-2026-10-21.1', 'M08_Q01', 'M08', 'multi', '¿Qué quieres que hagan tus visitantes?', false, false, null, false, '{"id":"M08_Q01","label":"¿Qué quieres que hagan tus visitantes?","type":"multi","scoped":true,"keyedOptions":[{"key":"formulario","label":"Enviar un formulario"},{"key":"whatsapp","label":"Escribir por WhatsApp"},{"key":"cotizar","label":"Cotizar"},{"key":"agendar","label":"Agendar"},{"key":"descargar","label":"Descargar"},{"key":"catalogo","label":"Ver un catálogo"},{"key":"buscador","label":"Usar un buscador"},{"key":"pagos","label":"Pagar en línea"},{"key":"area","label":"Entrar a un área privada"},{"key":"crm","label":"Conectar con mi CRM"},{"key":"erp","label":"Conectar con mi ERP"},{"key":"idiomas","label":"Ver el sitio en otros idiomas"},{"key":"otro","label":"Otro"}],"module":"M08"}'::jsonb),
  ('Q-2026-10-21.1', 'M08_Q02', 'M08', 'text', '¿Hay herramientas externas que ya utilizas?', false, false, null, false, '{"id":"M08_Q02","label":"¿Hay herramientas externas que ya utilizas?","type":"text","help":"Nombre y, si quieres, su dirección web.","module":"M08"}'::jsonb),
  ('Q-2026-10-21.1', 'M08_Q03', 'M08', 'area', '¿Necesitas algún proceso especial?', false, false, array['CORPORATE','TURNKEY'], false, '{"id":"M08_Q03","label":"¿Necesitas algún proceso especial?","type":"area","help":"Graphique lo clasificará como incluido, pendiente o adicional.","packages":["CORPORATE","TURNKEY"],"module":"M08"}'::jsonb),
  ('Q-2026-10-21.1', 'M09_Q01', 'M09', 'tri', '¿Tienes dominio, hosting y correo corporativo?', false, false, null, false, '{"id":"M09_Q01","label":"¿Tienes dominio, hosting y correo corporativo?","type":"tri","items":["Dominio","Hosting","Correo corporativo"],"module":"M09"}'::jsonb),
  ('Q-2026-10-21.1', 'M09_Q02', 'M09', 'tri', '¿Utilizas estas herramientas?', false, false, null, false, '{"id":"M09_Q02","label":"¿Utilizas estas herramientas?","type":"tri","items":["Google Analytics 4","Google Search Console","Google Ads","CRM"],"module":"M09"}'::jsonb),
  ('Q-2026-10-21.1', 'M09_Q03', 'M09', 'text', '¿Quién administra esas herramientas?', false, false, null, false, '{"id":"M09_Q03","label":"¿Quién administra esas herramientas?","type":"text","help":"Escribe solo nombres o puestos. Nunca compartas contraseñas en este portal.","allowUnknown":true,"module":"M09"}'::jsonb),
  ('Q-2026-10-21.1', 'M09_Q04', 'M09', 'single', '¿Hay que migrar datos o contenidos?', false, false, array['PYME','CORPORATE','TURNKEY'], false, '{"id":"M09_Q04","label":"¿Hay que migrar datos o contenidos?","type":"single","options":["Sí","No","No lo sé"],"packages":["PYME","CORPORATE","TURNKEY"],"module":"M09"}'::jsonb),
  ('Q-2026-10-21.1', 'M09_Q05', 'M09', 'area', 'Describe qué hay que migrar', false, false, null, true, '{"id":"M09_Q05","label":"Describe qué hay que migrar","type":"area","when":{"q":"M09_Q04","eq":"Sí"},"module":"M09"}'::jsonb),
  ('Q-2026-10-21.1', 'M10_Q01', 'M10', 'fields', '¿Quién enviará información y resolverá dudas?', true, true, null, false, '{"id":"M10_Q01","label":"¿Quién enviará información y resolverá dudas?","type":"fields","required":true,"sensitive":true,"fields":[{"key":"nombre","label":"Nombre","required":true},{"key":"correo","label":"Correo","input":"email","required":true},{"key":"tel","label":"Teléfono","input":"tel"}],"module":"M10"}'::jsonb),
  ('Q-2026-10-21.1', 'M10_Q02', 'M10', 'list', '¿Quién aprobará diseño, textos y publicación?', false, false, null, false, '{"id":"M10_Q02","label":"¿Quién aprobará diseño, textos y publicación?","type":"list","fields":[{"key":"nombre","label":"Nombre"},{"key":"rol","label":"Qué aprueba","options":["Diseño","Textos","Publicación","Todo"]}],"module":"M10"}'::jsonb),
  ('Q-2026-10-21.1', 'M10_Q03', 'M10', 'date', '¿Tienes una fecha objetivo o evento importante?', false, false, null, false, '{"id":"M10_Q03","label":"¿Tienes una fecha objetivo o evento importante?","type":"date","module":"M10"}'::jsonb),
  ('Q-2026-10-21.1', 'M10_Q04', 'M10', 'text', '¿Por qué esa fecha?', false, false, null, true, '{"id":"M10_Q04","label":"¿Por qué esa fecha?","type":"text","when":{"q":"M10_Q03","filled":true},"module":"M10"}'::jsonb),
  ('Q-2026-10-21.1', 'M10_Q05', 'M10', 'area', '¿Hay restricciones o instrucciones adicionales?', false, false, null, false, '{"id":"M10_Q05","label":"¿Hay restricciones o instrucciones adicionales?","type":"area","module":"M10"}'::jsonb)
on conflict do nothing;

commit;
