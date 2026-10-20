import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAuditWorkspace } from '@/lib/abordagem.functions';
import { downloadLeadMarkdown } from '@/lib/lead-markdown';
import type { Business } from '@/lib/prospeccao';
export function LeadDownload({ business }: { business: Business }) {
  const read = useServerFn(getAuditWorkspace);
  const [error, setError] = useState('');
  const workspace = useQuery({ queryKey: ['audit-workspace-export', business.id], queryFn: () => read({ data: { id: business.id } }), staleTime: 0 });
  return <div><Button variant="bordered" disabled={!workspace.data || workspace.isFetching} onClick={() => {
    if (!workspace.data) return;
    try { downloadLeadMarkdown(business, workspace.data.audit, workspace.data.notes); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível baixar.'); }
  }}>Baixar .md</Button>{(error || workspace.isError) && <p role="alert" className="mt-2 text-xs text-destructive">{error || 'Não foi possível carregar os dados para baixar.'}</p>}</div>;
}