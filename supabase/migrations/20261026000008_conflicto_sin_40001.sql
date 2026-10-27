-- GM-ONB-3.0 · 0008 CONFLICTO_DE_EDICION sin SQLSTATE 40001.
-- PostgREST reintenta sin fin las transacciones que fallan con 40001 (serialization_failure):
-- la petición nunca termina, retiene la conexión y agota el pool (PGRST003).
-- Se usa un código propio (clase P0); la app detecta el conflicto por el texto CONFLICTO_DE_EDICION.

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
