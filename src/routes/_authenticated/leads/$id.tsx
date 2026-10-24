import { createFileRoute } from '@tanstack/react-router';
import { Gate } from '@/components/prospeccao/gate';
import { LeadWorkspace } from '@/components/prospeccao/lead-workspace';
import { metadata } from '@/lib/prospeccao';
export const Route = createFileRoute('/_authenticated/leads/$id')({
  head: () => metadata('Lead', 'Detalhes da empresa salva nos seus leads.'),
  component: Page,
});
function Page() { const { id } = Route.useParams(); return <Gate><LeadWorkspace selectedId={id}/></Gate>; }
