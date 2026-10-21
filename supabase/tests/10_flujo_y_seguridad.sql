-- Pruebas de flujo, permisos y aislamiento (QA: SEC-01, COM-01, AUTH-01, BRF-02, REV-01, APR-01, SCP-01, FIL-01).
-- Se ejecuta con psql -v ON_ERROR_STOP=1 después de las migraciones. Cualquier fallo detiene la corrida.
\set QUIET on
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

create schema t;
grant usage on schema t to anon, authenticated, service_role;
create table t.ctx (k text primary key, v text);
grant all on t.ctx to anon, authenticated, service_role;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FALLA: %', msg; end if; raise notice 'ok · %', msg; end $$;
-- Ejecuta sql y exige que falle con un mensaje que contenga «expected».
create function t.err(sql text, expected text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(expected in sqlerrm) > 0 then raise notice 'ok · %', msg; return; end if;
    raise exception 'FALLA: % (error distinto: %)', msg, sqlerrm;
  end;
  raise exception 'FALLA: % (no hubo error)', msg;
end $$;
create function t.v(key text) returns text language sql as $$ select v from t.ctx where k = key $$;
grant execute on all functions in schema t to anon, authenticated, service_role;

insert into auth.users values
  ('00000000-0000-0000-0000-0000000000c1', 'comercial@graphique.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'pm@graphique.test'),
  ('00000000-0000-0000-0000-0000000000aa', 'ana@roble.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'beto@lince.test');
insert into public.staff values
  ('00000000-0000-0000-0000-0000000000c1', 'comercial', 'Comercial Prueba', true, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'pm', 'PM Prueba', true, now());

-- ===== Solicitudes (servidor) =====
set role service_role;
insert into t.ctx select 'pA', project_id::text from public.create_request('Ana Prueba', 'Taller Roble', 'ana@roble.test', '5512345678', null, 'PYME', 'Quiero hacer crecer mi negocio', '{}', 'ip1');
insert into t.ctx select 'pB', project_id::text from public.create_request('Beto Prueba', 'Consultora Lince', 'beto@lince.test', '5598765432', null, 'PERSONAL', null, '{}', 'ip2');
select t.ok((select duplicate from public.create_request('Ana', 'Roble', 'ANA@roble.test', '5512345678', null, 'PYME', null, '{}', 'ip1')), 'solicitud repetida del mismo correo se une a la existente');
select t.err($$select public.create_request('X', 'Y', 'x@y.test', '5512345678', null, 'GRATIS', null, '{}', 'ip3')$$, 'PAQUETE_INVALIDO', 'paquete inexistente se rechaza');
select public.create_request('Spam', 'Spam', 's'||g||'@s.test', '5512345678', null, 'PYME', null, '{}', 'ip9') from generate_series(1,5) g;
select t.err($$select public.create_request('Spam', 'Spam', 's6@s.test', '5512345678', null, 'PYME', null, '{}', 'ip9')$$, 'DEMASIADAS_SOLICITUDES', 'límite de 5 solicitudes por hora por IP');
reset role;

-- ===== Anónimo =====
set role anon;
select t.err($$select count(*) from public.projects$$, 'permission denied', 'anónimo no puede leer proyectos');
select t.ok((select count(*) from public.package_versions) = 4, 'anónimo lee el catálogo');
select t.err($$select public.create_request('A', 'B', 'c@d.test', '5512345678', null, 'PYME', null, '{}', 'ip')$$, 'permission denied', 'anónimo no puede crear solicitudes directamente (solo el servidor)');
reset role;

-- ===== Comercial =====
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"comercial@graphique.test","aal":"aal1"}', false);
select t.ok((select count(*) from public.projects) = 0, 'personal sin MFA (aal1) no ve proyectos');
select t.err($$select public.transition_project(t.v('pA')::uuid, 'CONTACTO_PENDIENTE')$$, 'SIN_PERMISO', 'personal sin MFA no puede operar');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"comercial@graphique.test","aal":"aal2"}', false);
select t.ok((select count(*) from public.projects) >= 2, 'comercial con MFA ve proyectos');
select public.transition_project(t.v('pA')::uuid, 'CONTACTO_PENDIENTE');
select t.err($$select public.transition_project(t.v('pA')::uuid, 'CONTRATADO')$$, 'TRANSICION_INVALIDA', 'no se puede saltar etapas');
select public.transition_project(t.v('pA')::uuid, 'PROPUESTA_ENVIADA');
select public.change_package(t.v('pA')::uuid, 'CORPORATE');
select public.change_package(t.v('pA')::uuid, 'PYME');
select public.transition_project(t.v('pA')::uuid, 'CONTRATACION_PENDIENTE');
select t.err($$select public.transition_project(t.v('pA')::uuid, 'CONTRATADO')$$, 'REQUIERE_CONFIRM_CONTRACT', 'contratar exige la función con folio');
select t.err($$select public.confirm_contract(t.v('pA')::uuid, ' ')$$, 'FALTA_FOLIO', 'contratar sin folio se rechaza');
select public.confirm_contract(t.v('pA')::uuid, 'PRO-2026-001');
select t.err($$select public.change_package(t.v('pA')::uuid, 'TURNKEY')$$, 'PAQUETE_BLOQUEADO', 'el paquete no cambia después de contratar');
insert into t.ctx values ('tokA', public.create_invitation(t.v('pA')::uuid, 'ana@roble.test'));
select t.ok((select state from public.projects where id = t.v('pA')::uuid) = 'INVITACION_PENDIENTE', 'invitación cambia el estado');
-- Proyecto B completo hasta invitación
select public.transition_project(t.v('pB')::uuid, 'CONTACTO_PENDIENTE');
select public.transition_project(t.v('pB')::uuid, 'PROPUESTA_ENVIADA');
select public.transition_project(t.v('pB')::uuid, 'CONTRATACION_PENDIENTE');
select public.confirm_contract(t.v('pB')::uuid, 'PRO-2026-002');
insert into t.ctx values ('tokB', public.create_invitation(t.v('pB')::uuid, 'beto@lince.test'));
insert into t.ctx values ('tokOld', public.create_invitation(t.v('pB')::uuid, 'beto2@lince.test'));
select t.err($$select public.approve_brief(t.v('pA')::uuid, '[]')$$, 'SIN_PERMISO', 'comercial no aprueba briefs');
reset role;

-- ===== Invitaciones =====
set role anon;
select t.ok((select status from public.invitation_info(t.v('tokA'))) = 'VIGENTE', 'la invitación vigente se consulta sin sesión');
select t.ok((select count(*) from public.invitation_info('token-falso')) = 0, 'un token falso no revela nada');
reset role;
update public.invitations set expires_at = now() - interval '1 minute' where token_hash = encode(extensions.digest(t.v('tokOld'), 'sha256'), 'hex');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","email":"beto@lince.test","aal":"aal1"}', false);
select t.err($$select public.accept_invitation(t.v('tokA'))$$, 'CORREO_NO_COINCIDE', 'una invitación no la acepta otro correo');
select t.err($$select public.accept_invitation(t.v('tokOld'))$$, 'INVITACION_VENCIDA', 'invitación de más de 72 h se rechaza');
select public.accept_invitation(t.v('tokB'));
select t.err($$select public.accept_invitation(t.v('tokB'))$$, 'INVITACION_USADA', 'una invitación solo se usa una vez');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","email":"ana@roble.test","aal":"aal1"}', false);
select t.ok((select count(*) from public.projects) = 0, 'antes de aceptar, el cliente no ve su proyecto (COM-01)');
select public.accept_invitation(t.v('tokA'));
select t.ok((select state from public.projects where id = t.v('pA')::uuid) = 'BRIEF_EN_PROGRESO', 'aceptar invitación abre el brief');
select t.ok((select value #>> '{}' from public.answers where project_id = t.v('pA')::uuid and question_id = 'M01_Q01') = 'Taller Roble', 'empresa precargada (WCAG 3.3.7)');
select t.ok((select value ->> 'correo' from public.answers where project_id = t.v('pA')::uuid and question_id = 'M10_Q01') = 'ana@roble.test', 'contacto precargado');

-- ===== Brief (cliente A) =====
select t.err($$select public.save_answer(t.v('pA')::uuid, 'M99_Q01', '"x"')$$, 'PREGUNTA_INVALIDA', 'pregunta inexistente se rechaza');
select t.ok(public.save_answer(t.v('pA')::uuid, 'M01_Q02', '"Industria"') = 1, 'guarda respuesta nueva');
select t.ok(public.save_answer(t.v('pA')::uuid, 'M01_Q02', '"Comercio"', 1) = 2, 'actualiza con revisión esperada');
select t.err($$select public.save_answer(t.v('pA')::uuid, 'M01_Q02', '"Salud"', 1)$$, 'CONFLICTO_DE_EDICION', 'detecta edición simultánea');
select t.err($$select public.transition_project(t.v('pA')::uuid, 'BRIEF_ENVIADO')$$, 'REQUIERE_SUBMIT_BRIEF', 'enviar exige la función de envío');
select t.err($$select public.submit_brief(t.v('pA')::uuid)$$, 'FALTAN_OBLIGATORIAS', 'no se envía con obligatorias vacías');
select t.err($$insert into public.answers (project_id, question_id, value) values (t.v('pA')::uuid, 'M01_Q03', '"x"')$$, 'permission denied', 'sin escritura directa en tablas');
select t.err($$select public.confirm_contract(t.v('pA')::uuid, 'X1')$$, 'SIN_PERMISO', 'el cliente no puede marcarse contratado');

-- Archivos
insert into t.ctx select 'fA', file_id::text from public.register_file(t.v('pA')::uuid, null, 'Identidad', 'logo roble.svg', 'svg', 'image/svg+xml', 2048);
insert into t.ctx select 'pathA', storage_path from public.files where id = t.v('fA')::uuid;
select t.ok(t.v('pathA') like t.v('pA') || '/%/v1.svg', 'ruta de almacenamiento normalizada sin nombre original');
select t.err($$insert into storage.objects (bucket_id, name, metadata) values ('expedientes', t.v('pA') || '/otro/v1.exe', '{"size":10}')$$, 'row-level security', 'no se sube a rutas no registradas');
insert into storage.objects (bucket_id, name, metadata) values ('expedientes', t.v('pathA'), '{"size":999}');
select t.err($$select public.confirm_file(t.v('fA')::uuid)$$, 'TAMANO_NO_COINCIDE', 'el tamaño subido debe coincidir');
reset role;
update storage.objects set metadata = '{"size":2048}' where name = t.v('pathA');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","email":"ana@roble.test","aal":"aal1"}', false);
select public.confirm_file(t.v('fA')::uuid);
select t.ok((select status from public.files where id = t.v('fA')::uuid) = 'RECIBIDO', 'archivo confirmado');
select t.err($$select public.register_file(t.v('pA')::uuid, null, 'Otros', 'enorme.zip', 'zip', 'application/zip', 3000::bigint * 1048576)$$, 'CUOTA_EXCEDIDA', 'cuota por proyecto');

-- ===== Aislamiento entre clientes (AUTH-01) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","email":"beto@lince.test","aal":"aal1"}', false);
select t.ok((select count(*) from public.projects where id = t.v('pA')::uuid) = 0, 'cliente B no ve el proyecto A');
select t.ok((select count(*) from public.answers where project_id = t.v('pA')::uuid) = 0, 'cliente B no lee respuestas de A');
select t.ok((select count(*) from public.files where project_id = t.v('pA')::uuid) = 0, 'cliente B no ve archivos de A');
select t.ok((select count(*) from storage.objects where name = t.v('pathA')) = 0, 'cliente B no puede descargar el objeto de A');
select t.err($$select public.save_answer(t.v('pA')::uuid, 'M01_Q03', '"intruso"')$$, 'SIN_PERMISO', 'cliente B no escribe en A');
select t.err($$select public.register_file(t.v('pA')::uuid, null, 'Otros', 'x.pdf', 'pdf', 'application/pdf', 10)$$, 'SIN_PERMISO', 'cliente B no sube a A');
select t.ok((select count(*) from public.lead_contacts) = 0, 'cliente no ve datos de prospectos');
select t.ok((select count(*) from public.audit_logs) = 0, 'cliente no ve la auditoría');

-- Completa obligatorias y envía (cliente A)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","email":"ana@roble.test","aal":"aal1"}', false);
select public.save_answer(t.v('pA')::uuid, 'M01_Q05', '{"correo":"contacto@roble.test"}');
select public.save_answer(t.v('pA')::uuid, 'M04_Q01', '["Cotizaciones"]');
select public.save_answer(t.v('pA')::uuid, 'M08_Q01', '["formulario","pagos"]');
select public.submit_brief(t.v('pA')::uuid);
select t.ok((select state from public.projects where id = t.v('pA')::uuid) = 'BRIEF_ENVIADO', 'brief enviado');
select t.err($$select public.save_answer(t.v('pA')::uuid, 'M01_Q03', '"tarde"')$$, 'BRIEF_BLOQUEADO', 'no se edita después de enviar');
select t.err($$select public.approve_brief(t.v('pA')::uuid, '[]')$$, 'SIN_PERMISO', 'el cliente no aprueba su propio expediente');

-- ===== Revisión (PM) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"pm@graphique.test","aal":"aal2"}', false);
select public.transition_project(t.v('pA')::uuid, 'EN_REVISION');
select t.err($$select public.approve_brief(t.v('pA')::uuid, '[{"key":"fn:pagos","classification":"ADICIONAL"}]')$$, 'ALCANCE_PENDIENTE', 'no se aprueba con ampliaciones sin decidir (SCP-01)');
select t.err($$select public.set_scope(t.v('pA')::uuid, 'fn:pagos', 'ADICIONAL_APROBADA', null)$$, 'check', 'ampliación aprobada exige nota de autorización');
select public.set_scope(t.v('pA')::uuid, 'fn:pagos', 'ADICIONAL_APROBADA', 'OC-2026-01 · +$6,000 · 1 semana');
insert into t.ctx select 'rq', public.request_clarification(t.v('pA')::uuid, 'M06', '¿Quién aprueba los textos finales?')::text;
select t.ok((select state from public.projects where id = t.v('pA')::uuid) = 'INFORMACION_PENDIENTE', 'aclaración solicitada');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","email":"ana@roble.test","aal":"aal1"}', false);
select public.save_answer(t.v('pA')::uuid, 'M06_Q02', '"Ana, directora"');
select t.err($$select public.answer_clarifications(t.v('pA')::uuid, '{}')$$, 'FALTAN_RESPUESTAS', 'hay que responder todas las aclaraciones');
select public.answer_clarifications(t.v('pA')::uuid, jsonb_build_object(t.v('rq'), 'Los aprueba Ana.'));
select t.ok((select answer from public.review_requests where id = t.v('rq')::uuid) = 'Los aprueba Ana.', 'historial de aclaración conservado (REV-01)');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"pm@graphique.test","aal":"aal2"}', false);
select public.review_file(t.v('fA')::uuid, 'APROBADO', null);
insert into t.ctx select 'ap', approval_id::text from public.approve_brief(t.v('pA')::uuid,
  '[{"key":"fn:formulario","classification":"INCLUIDA"},{"key":"fn:pagos","classification":"ADICIONAL_APROBADA","note":"OC-2026-01"}]');
select t.ok((select state from public.projects where id = t.v('pA')::uuid) = 'BRIEF_APROBADO', 'brief aprobado');
select t.ok((select answers ->> 'M06_Q02' from public.approvals where id = t.v('ap')::uuid) = 'Ana, directora', 'la versión congela las respuestas de la tabla');
select t.ok((select jsonb_array_length(files) from public.approvals where id = t.v('ap')::uuid) = 1, 'manifiesto de archivos congelado');
select t.ok((select length(hash) from public.approvals where id = t.v('ap')::uuid) = 64, 'huella SHA-256');
select public.record_export(t.v('ap')::uuid, 'json');
select t.ok((select count(*) from public.audit_logs where project_id = t.v('pA')::uuid) >= 12, 'auditoría completa del proyecto');
reset role;
select t.err($$update public.approvals set hash = 'x' where id = t.v('ap')::uuid$$, 'REGISTRO_INMUTABLE', 'una versión aprobada no se modifica (APR-01)');
select t.err($$delete from public.audit_logs$$, 'REGISTRO_INMUTABLE', 'la auditoría no se borra');

-- Nueva revisión crea v2 sin tocar v1
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"pm@graphique.test","aal":"aal2"}', false);
select public.transition_project(t.v('pA')::uuid, 'BRIEF_EN_PROGRESO', 'cliente pidió cambiar objetivos');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","email":"ana@roble.test","aal":"aal1"}', false);
select public.save_answer(t.v('pA')::uuid, 'M04_Q01', '["Cotizaciones","Ventas"]');
select t.ok((select answers -> 'M04_Q01' from public.approvals where id = t.v('ap')::uuid) = '["Cotizaciones"]'::jsonb, 'la v1 aprobada no cambia al editar');
reset role;
\echo '== Todas las pruebas de base de datos pasaron =='
