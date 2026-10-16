import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { listLeads } from '@/lib/prospeccao.functions';
import { placeData, text } from '@/lib/prospeccao';
import { cn } from '@/lib/utils';
import { ActionIcon } from './action-icon';
import { LeadDetail } from './lead-detail';

export interface LeadWorkspaceProps { selectedId?: string }
export function LeadWorkspace({ selectedId }: LeadWorkspaceProps) {
  const leads = useQuery({ queryKey: ['leads'], queryFn: () => listLeads() });
  const [filter, setFilter] = useState('');
  const rows = leads.data ?? [];
  const visible = rows.filter(b => `${text(placeData(b.data)['title'])} ${b.city} ${b.state}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
  const active = selectedId ?? visible[0]?.id;
  return <main className="app-container py-10">
    <h1 className="page-title">Você tem <strong>{rows.length} leads</strong> salvos</h1>
    <p className="mt-3 mb-8 text-sm text-muted-foreground">Empresas para o seu próximo contato.</p>
    {leads.isLoading && <p className="loading-text">Carregando leads...</p>}
    {leads.isError && <div role="alert"><p className="text-destructive">Não foi possível carregar os leads.</p><p className="mt-2 text-xs text-muted-foreground">{leads.error.message}</p></div>}
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
      <aside className="min-w-0 space-y-4">
        <input aria-label="Filtrar leads" className="field" placeholder="Nome ou cidade" value={filter} onChange={e => setFilter(e.target.value)}/>
        {visible.map(b => <Link key={b.id} to="/leads/$id" params={{id:b.id}} aria-current={active===b.id?'true':undefined} className={cn('card-blue card-enter block border-2 transition duration-150 active:scale-[0.98] motion-reduce:transform-none',active===b.id?'border-primary':'border-transparent hover:border-foreground/25')}>
          <div className="flex items-start justify-between gap-3"><h2 className="font-display text-xl font-bold break-words">{text(placeData(b.data)['title'])}</h2><ActionIcon icon={ArrowUpRight}/></div>
          <p className="mt-3 text-sm text-muted-foreground">{b.city}/{b.state} · {b.website_type}</p>
        </Link>)}
        {!leads.isLoading && !visible.length && <p className="card-cream">{rows.length?'Nenhum lead neste filtro.':'Você ainda não tem leads.'}</p>}
      </aside>
      {active && <div className="min-w-0"><LeadDetail key={active} id={active}/></div>}
    </div>
  </main>;
}