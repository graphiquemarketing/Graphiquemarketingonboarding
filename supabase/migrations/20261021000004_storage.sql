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

create policy expedientes_read on storage.objects for select to authenticated
  using (bucket_id = 'expedientes' and public.can_read_project(public.try_uuid((storage.foldername(name))[1])));

create policy expedientes_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and public.can_upload_object(name));
-- Sin políticas de update ni delete: nada se sobrescribe ni se borra desde el cliente.
