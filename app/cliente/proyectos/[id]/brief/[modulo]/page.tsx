import { notFound, redirect } from 'next/navigation';
import { requireClient } from '@/lib/server/session';
import { getAnswers, getProject } from '@/lib/server/data';
import { MODULES } from '@/lib/questionnaire';
import { Back, Note } from '@/components/ui';
import { ProjectNav } from '@/components/ProjectNav';
import { Track } from '@/components/Track';
import { BriefModule } from '@/components/brief/BriefModule';

export default async function Brief({ params, searchParams }: { params: Promise<{ id: string; modulo: string }>; searchParams: Promise<{ bienvenida?: string }> }) {
  const { id, modulo } = await params; const sp = await searchParams;
  const i = MODULES.findIndex((m) => m.id === modulo);
  if (i < 0) notFound();
  const { sb } = await requireClient(`/cliente/proyectos/${id}/brief/${modulo}`);
  const p = await getProject(sb, id);
  if (p.state !== 'BRIEF_EN_PROGRESO') redirect(p.state === 'INFORMACION_PENDIENTE' ? `/cliente/proyectos/${id}/aclaraciones` : `/cliente/proyectos/${id}/resumen`);
  const { answers, revisions } = await getAnswers(sb, id);
  const m = MODULES[i];
  return (
    <div className="wrap stack" style={{ gap: 20 }}>
      {sp.bienvenida && <Track event="onboarding_invitation_accepted" params={{ paquete: p.package_code }} dedupe={`inv:${id}`} />}
      <Back href={`/cliente/proyectos/${id}`}>{p.organizations?.name ?? 'Proyecto'}</Back>
      <ProjectNav id={id} current="Brief" />
      {sp.bienvenida && <Note tone="ok">Bienvenido. Precargamos el nombre de tu empresa y tu contacto. Todo se guarda solo; puedes pausar y volver cuando quieras.</Note>}
      <BriefModule key={m.id} projectId={id} pkg={p.package_code} moduleIndex={i} initial={answers} revisions={revisions} />
    </div>
  );
}
