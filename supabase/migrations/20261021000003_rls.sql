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
create policy catalog_read on public.package_versions       for select to anon, authenticated using (true);
create policy qv_read      on public.questionnaire_versions for select to anon, authenticated using (true);
create policy q_read       on public.questions              for select to anon, authenticated using (true);
create policy st_read      on public.state_transitions      for select to anon, authenticated using (true);

create policy staff_read on public.staff for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy org_read on public.organizations for select to authenticated using (public.is_staff() or public.is_org_member(id));
create policy members_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff() or public.is_org_member(org_id));

-- COM-01 / AUTH-01: un cliente solo ve proyectos de organizaciones a las que fue invitado y aceptó.
create policy projects_read on public.projects for select to authenticated using (public.can_read_project(id));

create policy leads_read     on public.lead_contacts for select to authenticated using (public.is_staff());
create policy contracts_read on public.contracts     for select to authenticated using (public.is_staff());
create policy inv_read       on public.invitations   for select to authenticated using (public.is_staff());
create policy exports_read   on public.exports       for select to authenticated using (public.is_staff());
create policy audit_read     on public.audit_logs    for select to authenticated using (public.is_staff());

create policy answers_read  on public.answers         for select to authenticated using (public.can_read_project(project_id));
create policy files_read    on public.files           for select to authenticated using (public.can_read_project(project_id));
create policy reviews_read  on public.review_requests for select to authenticated using (public.can_read_project(project_id));
create policy scope_read    on public.scope_overrides for select to authenticated using (public.can_read_project(project_id));
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
