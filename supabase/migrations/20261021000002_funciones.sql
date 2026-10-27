-- GM-ONB-3.0 · 0002 Máquina de estados, permisos y operaciones auditadas.
-- Toda escritura de negocio pasa por estas funciones: el navegador nunca actualiza tablas directamente.

-- ---------- Identidad del actor ----------
-- El personal de Graphique cuenta como tal solo con sesión verificada por MFA (aal2).
create or replace function public.current_staff_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select s.role from public.staff s
  where s.user_id = auth.uid() and s.active and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_staff_role() is not null
$$;

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members m where m.org_id = p_org and m.user_id = auth.uid())
$$;

create or replace function public.member_role_in(p_project uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select m.role from public.projects p
  join public.organization_members m on m.org_id = p.org_id and m.user_id = auth.uid()
  where p.id = p_project
$$;

create or replace function public.can_read_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.member_role_in(p_project) is not null
$$;

create or replace function public.actor_label() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'Graphique ' || s.role::text || ' · ' || s.display_name from public.staff s where s.user_id = auth.uid() and public.is_staff()),
    (select 'Cliente · ' || coalesce(auth.jwt() ->> 'email', 'sin correo')),
    'Sistema')
$$;

create or replace function public.audit(p_project uuid, p_action text, p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (project_id, actor, actor_label, action, detail)
  values (p_project, auth.uid(), public.actor_label(), p_action, coalesce(p_detail, '{}'::jsonb))
$$;

-- ---------- Máquina de estados ----------
create table public.state_transitions (
  from_state public.project_state not null,
  to_state   public.project_state not null,
  actors     text[] not null,
  via        text,
  primary key (from_state, to_state)
);
insert into public.state_transitions values
  ('SOLICITUD_RECIBIDA','CONTACTO_PENDIENTE','{comercial}',null),
  ('CONTACTO_PENDIENTE','PROPUESTA_ENVIADA','{comercial}',null),
  ('PROPUESTA_ENVIADA','CONTRATACION_PENDIENTE','{comercial}',null),
  ('CONTRATACION_PENDIENTE','CONTRATADO','{comercial}','confirm_contract'),
  ('CONTRATADO','INVITACION_PENDIENTE','{comercial,pm}','create_invitation'),
  ('INVITACION_PENDIENTE','BRIEF_EN_PROGRESO','{responsable,colaborador}','accept_invitation'),
  ('BRIEF_EN_PROGRESO','BRIEF_ENVIADO','{responsable}','submit_brief'),
  ('BRIEF_ENVIADO','EN_REVISION','{pm}',null),
  ('EN_REVISION','INFORMACION_PENDIENTE','{pm}','request_clarification'),
  ('INFORMACION_PENDIENTE','EN_REVISION','{responsable}','answer_clarifications'),
  ('EN_REVISION','BRIEF_APROBADO','{pm}','approve_brief'),
  ('BRIEF_APROBADO','LISTO_PARA_PLANEACION','{pm}',null),
  ('BRIEF_APROBADO','BRIEF_EN_PROGRESO','{pm}',null),
  ('SOLICITUD_RECIBIDA','DESCARTADA','{comercial}',null),
  ('CONTACTO_PENDIENTE','DESCARTADA','{comercial}',null),
  ('PROPUESTA_ENVIADA','DESCARTADA','{comercial}',null);

create or replace function public.actor_of(p_project uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_staff_role()::text, public.member_role_in(p_project)::text)
$$;

-- Interna: no se expone a clientes. Valida transición, actor y la función que la invoca.
create or replace function public._transition(p_project uuid, p_to public.project_state, p_via text, p_note text default null)
returns public.project_state language plpgsql security definer set search_path = public as $$
declare v_from public.project_state; v_actor text; v_t public.state_transitions;
begin
  select state into v_from from public.projects where id = p_project for update;
  if not found then raise exception 'PROYECTO_NO_ENCONTRADO' using errcode = 'P0002'; end if;
  v_actor := public.actor_of(p_project);
  if v_actor is null then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  select * into v_t from public.state_transitions where from_state = v_from and to_state = p_to;
  if not found then raise exception 'TRANSICION_INVALIDA % -> %', v_from, p_to using errcode = '22023'; end if;
  if not (v_actor = any (v_t.actors)) then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if v_t.via is distinct from p_via then raise exception 'REQUIERE_%', upper(coalesce(v_t.via, 'TRANSICION_GENERICA')) using errcode = '22023'; end if;
  update public.projects set state = p_to where id = p_project;
  perform public.audit(p_project, 'ESTADO', jsonb_build_object('de', v_from, 'a', p_to, 'nota', p_note));
  return p_to;
end $$;

-- Transiciones sin validación extra (tomar solicitud, iniciar revisión, descartar…).
create or replace function public.transition_project(p_project uuid, p_to public.project_state, p_note text default null)
returns public.project_state language sql security definer set search_path = public as $$
  select public._transition(p_project, p_to, null, left(p_note, 500))
$$;

-- ---------- Solicitudes ----------
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

-- Solicitud pública: solo el servidor (service_role) la llama, con límite de 5 por hora por IP.
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

-- Alta manual por Graphique (lead que llegó por el brief comercial del sitio a HubSpot).
create or replace function public.create_project_manual(
  p_full_name text, p_company text, p_email text, p_phone text, p_comment text, p_package text, p_source text default 'hubspot')
returns table (project_id uuid, folio text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.current_staff_role() is distinct from 'comercial' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  return query select * from public._create_request(p_full_name, p_company, p_email, p_phone, p_comment, p_package, p_source, null, '{}'::jsonb);
end $$;

-- Corrección de paquete por comercial antes de contratar.
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

-- ---------- Contratación e invitación ----------
create or replace function public.confirm_contract(p_project uuid, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_staff_role() is distinct from 'comercial' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 2 then raise exception 'FALTA_FOLIO' using errcode = '22023'; end if;
  insert into public.contracts (project_id, reference, confirmed_by) values (p_project, trim(p_reference), auth.uid())
  on conflict (project_id) do update set reference = excluded.reference, confirmed_by = excluded.confirmed_by, confirmed_at = now();
  perform public._transition(p_project, 'CONTRATADO', 'confirm_contract', 'folio ' || trim(p_reference));
end $$;

-- Devuelve el token en claro una sola vez (va en el correo); guarda solo su hash. Vigencia 72 h.
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

-- Datos mínimos para la pantalla de invitación (accesible sin sesión).
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

-- ---------- Brief ----------
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
    if p_expected_revision is not null and p_expected_revision <> v_rev then raise exception 'CONFLICTO_DE_EDICION' using errcode = 'P0409'; end if;
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

-- ---------- Archivos ----------
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

-- Tras subir a Storage: verifica que el objeto exista y coincida en tamaño.
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

-- ---------- Revisión, alcance y aprobación ----------
create or replace function public.request_clarification(p_project uuid, p_module text, p_question text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if public.current_staff_role() is distinct from 'pm' then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  insert into public.review_requests (project_id, module, question, created_by) values (p_project, p_module, trim(p_question), auth.uid()) returning id into v_id;
  perform public._transition(p_project, 'INFORMACION_PENDIENTE', 'request_clarification', p_module);
  return v_id;
end $$;

-- p_answers: {"<review_request_id>": "respuesta", ...}. Exige responder todas las abiertas.
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

-- Congela respuestas y archivos desde las tablas (no desde el navegador) y el alcance calculado en el servidor.
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

-- ---------- Inmutabilidad ----------
create or replace function public.forbid_change() returns trigger language plpgsql set search_path = public as $$
begin raise exception 'REGISTRO_INMUTABLE: %', tg_table_name using errcode = '42501'; end $$;
create trigger approvals_immutable before update or delete on public.approvals for each row execute function public.forbid_change();
create trigger audit_immutable before update or delete on public.audit_logs for each row execute function public.forbid_change();

-- Cambios de personal y membresías quedan auditados.
create or replace function public.audit_membership() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (project_id, actor, actor_label, action, detail)
  values (null, auth.uid(), public.actor_label(), tg_table_name || '_' || lower(tg_op), to_jsonb(coalesce(new, old)));
  return coalesce(new, old);
end $$;
create trigger staff_audit after insert or update or delete on public.staff for each row execute function public.audit_membership();
create trigger members_audit after insert or update or delete on public.organization_members for each row execute function public.audit_membership();
