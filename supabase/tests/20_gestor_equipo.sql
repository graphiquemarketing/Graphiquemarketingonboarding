-- Pruebas del gestor del equipo (se ejecuta después de 10_flujo_y_seguridad.sql, reutiliza t.*).
\set QUIET on
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1', 'nuevo@graphique.test');
update public.staff set is_admin = true where user_id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"pm@graphique.test","aal":"aal2"}', false);
select t.err($$select public.team_save('00000000-0000-0000-0000-0000000000d1', 'pm', 'Nuevo', true, false)$$, 'SIN_PERMISO', 'un PM que no es administrador no gestiona el equipo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"comercial@graphique.test","aal":"aal1"}', false);
select t.err($$select public.team_save('00000000-0000-0000-0000-0000000000d1', 'pm', 'Nuevo', true, false)$$, 'SIN_PERMISO', 'el administrador sin MFA no gestiona el equipo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","email":"comercial@graphique.test","aal":"aal2"}', false);
select public.team_save('00000000-0000-0000-0000-0000000000d1', 'pm', 'Persona Nueva', true, false);
select t.ok((select role from public.staff where user_id = '00000000-0000-0000-0000-0000000000d1') = 'pm', 'alta de una persona con rol PM');
select public.team_save('00000000-0000-0000-0000-0000000000d1', 'comercial', 'Persona Nueva', false, false);
select t.ok((select not active from public.staff where user_id = '00000000-0000-0000-0000-0000000000d1'), 'desactivar a una persona');
select t.err($$select public.team_save('00000000-0000-0000-0000-0000000000c1', 'comercial', 'Comercial Prueba', false, true)$$, 'NO_PUEDES_QUITARTE_ACCESO', 'el administrador no se desactiva a sí mismo');
select t.err($$select public.team_save('00000000-0000-0000-0000-0000000000aa', 'pm', 'Ana', true, false)$$, 'ES_CLIENTE', 'una cuenta de cliente no se convierte en personal');
select t.err($$select public.team_save('00000000-0000-0000-0000-0000000000ff', 'pm', 'Fantasma', true, false)$$, 'USUARIO_INVALIDO', 'no se da de alta una cuenta inexistente');
select t.err($$update public.staff set role = 'pm' where user_id = '00000000-0000-0000-0000-0000000000d1'$$, 'permission denied', 'sin cambios directos a la tabla del equipo');
reset role;
select t.ok((select count(*) from public.audit_logs where action like 'staff_%' and detail ->> 'user_id' = '00000000-0000-0000-0000-0000000000d1') >= 2, 'cambios del equipo auditados');
\echo '== Pruebas del gestor del equipo pasaron =='
