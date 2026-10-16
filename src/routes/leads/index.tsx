import { createFileRoute } from '@tanstack/react-router';
import { Gate } from '@/components/prospeccao/gate';
import { LeadWorkspace } from '@/components/prospeccao/lead-workspace';
import { metadata } from '@/lib/prospeccao';
export const Route = createFileRoute('/leads/')({
  head: () => metadata('Leads', 'As empresas que você salvou para contato.'),
  component: () => <Gate><LeadWorkspace/></Gate>,
});
