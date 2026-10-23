-- GM-ONB-3.0 · 0007 Gestor del equipo: administradores, alta, rol y activación con auditoría.
-- Un administrador del equipo (is_admin) puede dar de alta personal, cambiar su rol y activarlo o desactivarlo.
-- El rol de negocio (comercial / pm / admin_tecnico) sigue siendo uno solo por persona.

alter table public.staff add column if not exists is_admin boolean not null default false;

create or replace function public.is_team_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active and s.is_admin)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

-- Alta o cambio de una persona del equipo. La cuenta de Auth la crea antes el servidor (service_role).
create or replace function public.team_save(p_user uuid, p_role public.staff_role, p_name text, p_active boolean, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_team_admin() then raise exception 'SIN_PERMISO' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'USUARIO_INVALIDO' using errcode = '22023'; end if;
  if exists (select 1 from public.organization_members where user_id = p_user) then raise exception 'ES_CLIENTE' using errcode = '22023'; end if;
  if p_user = auth.uid() and (not p_active or not p_admin) then raise exception 'NO_PUEDES_QUITARTE_ACCESO' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'FALTA_NOMBRE' using errcode = '22023'; end if;
  insert into public.staff (user_id, role, display_name, active, is_admin)
  values (p_user, p_role, left(trim(p_name), 80), p_active, p_admin)
  on conflict (user_id) do update set role = excluded.role, display_name = excluded.display_name, active = excluded.active, is_admin = excluded.is_admin;
  if not exists (select 1 from public.staff where active and is_admin) then raise exception 'DEBE_HABER_UN_ADMIN' using errcode = '22023'; end if;
end $$;

revoke execute on function public.is_team_admin(), public.team_save(uuid, public.staff_role, text, boolean, boolean) from public, anon;
grant execute on function public.is_team_admin(), public.team_save(uuid, public.staff_role, text, boolean, boolean) to authenticated;

-- Primer administrador: Rafael Barriga (sin efecto si la cuenta no existe en este entorno).
update public.staff set is_admin = true
 where user_id = (select id from auth.users where lower(email) = 'rafael@graphiquemarketing.com.mx');
