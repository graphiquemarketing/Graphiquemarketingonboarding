-- GM-ONB-3.0 · 0006 Endurecimiento según los avisos de seguridad de Supabase (21/10/2026).
-- 1) search_path fijo en try_uuid. 2) Los visitantes sin sesión solo ejecutan invitation_info.
create or replace function public.try_uuid(p text) returns uuid language plpgsql immutable set search_path = public as $$
begin return p::uuid; exception when others then return null; end $$;
revoke execute on function public.current_staff_role(), public.is_staff(), public.is_org_member(uuid), public.member_role_in(uuid),
  public.can_read_project(uuid), public.actor_of(uuid), public.actor_label(), public._answer_filled(jsonb),
  public.can_upload_object(text), public.try_uuid(text) from anon;
-- try_uuid y can_upload_object se crearon después del «revoke ... from public» de 0003: heredaban EXECUTE para todos.
revoke execute on function public.can_upload_object(text), public.try_uuid(text) from public;
grant execute on function public.can_upload_object(text), public.try_uuid(text) to authenticated;
