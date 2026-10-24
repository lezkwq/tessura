import { displayCity, displayName, plural } from '@/lib/format';
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "@phosphor-icons/react";
import { ActionIcon } from "@/components/prospeccao/action-icon";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
import { listAudits, markSent, regenerateAudit } from "@/lib/abordagem.functions";
import { MessageWhatsapp } from '@/components/prospeccao/message-whatsapp';
import { parseNotes } from '@/lib/audit-data';
import { metadata, placeData, text } from "@/lib/prospeccao";

export const Route = createFileRoute("/_authenticated/auditorias")({
  head: () => metadata("Auditorias", "Mensagens de WhatsApp geradas para os leads."),
  component: () => <Gate><AuditsPage /></Gate>,
});

type Row = Awaited<ReturnType<typeof listAudits>>[number];

function AuditsPage() {
  const [filter, setFilter] = useState("Todas");
  const [selected, setSelected] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const audits = useQuery({ queryKey: ["audits"], queryFn: () => listAudits() });
  if (audits.isLoading) return <div className="app-container py-24"><p className="loading-text text-muted-foreground">Carregando auditorias...</p></div>;
  if (audits.isError) return <div className="app-container py-24"><p className="text-destructive">Não foi possível carregar as auditorias.</p><p className="mt-2 text-xs text-muted-foreground">{audits.error instanceof Error ? audits.error.message : ""}</p></div>;
  const rows = audits.data ?? [];
  const visible = rows.filter(a => (filter === "Todas" || a.status === (filter === "Enviadas" ? "enviada" : "não enviada")) && text(placeData(a.businesses?.data ?? {})["title"]).toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR')));
  const active = visible.find(a => a.id === selected) ?? visible[0];
  return <main className="app-container py-10">
    <h1 className="page-title">Você tem <strong>{plural(rows.length,'auditoria','auditorias')}</strong></h1>
    <p className="mt-3 mb-8 text-sm text-muted-foreground">Mensagens prontas para o próximo contato.</p>
    <div className="mb-8 flex flex-wrap items-center gap-4">
      <input className="field max-w-xs" aria-label="Filtrar auditorias" placeholder="Nome da empresa" value={term} onChange={e => setTerm(e.target.value)}/>
      <div className="flex max-w-full flex-wrap gap-1 rounded-full bg-card p-1" aria-label="Status de auditoria">{['Todas','Não enviadas','Enviadas'].map(f => <Button key={f} variant={f === filter ? 'solid' : 'quiet'} aria-pressed={f === filter} onClick={() => setFilter(f)}>{f}</Button>)}</div>
    </div>
    {!rows.length && <p className="card-cream">Nenhuma auditoria ainda.</p>}
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
      <aside className="min-w-0 space-y-4">{visible.map(a => <Button key={a.id} variant="quiet" className={cn('card-yellow h-auto w-full flex-col items-stretch whitespace-normal text-left text-foreground border-2',active?.id === a.id ? 'border-primary' : 'border-transparent')} onClick={() => setSelected(a.id)}>
        <span className="flex items-start justify-between gap-3"><span className="font-display text-xl font-bold">{displayName(text(placeData(a.businesses?.data ?? {})['title']))}</span><ActionIcon icon={ArrowUpRight}/></span>
        <span className="mt-2 text-sm text-muted-foreground">{displayCity(a.businesses?.city ?? '')}/{a.businesses?.state}</span><AuditStatus status={a.status}/>
      </Button>)}{rows.length > 0 && !visible.length && <p className="card-cream">Nenhuma auditoria neste filtro.</p>}</aside>
      {active && <AuditRow key={active.id} audit={active} index={0}/>}
    </div>
  </main>;
}

function AuditStatus({ status }: { status: Row['status'] }) {
  return <span className={cn('mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-xs',status === 'enviada' ? 'text-success' : 'text-muted-foreground')}><span className={cn('h-1.5 w-1.5 rounded-full',status === 'enviada' ? 'bg-success' : 'bg-muted-foreground')}/>{status}</span>;
}

function AuditRow({ audit, index }: { audit: Row; index: number }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const d = placeData(audit.businesses?.data ?? {});
  const notes = parseNotes({ complement: audit.complement, observations: audit.observation_state });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); await qc.invalidateQueries({ queryKey: ["audits"] }); } catch (e) { setError(e instanceof Error ? e.message : "Erro."); }
    setBusy(false);
  }
  return (
    <div className="card-yellow card-enter min-w-0" style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {audit.businesses ? <Link to="/leads/$id" params={{ id: audit.business_id }} className="text-lg font-medium">{displayName(text(d["title"]))}</Link> : <span>não informado</span>}
        <span className="text-sm text-muted-foreground">{displayCity(audit.businesses?.city ?? "")}/{audit.businesses?.state} · {new Date(audit.created_at).toLocaleDateString("pt-BR")} · {audit.status === "enviada" && audit.sent_at ? `enviada em ${new Date(audit.sent_at).toLocaleString("pt-BR")}` : "não enviada"}</span>
      </div>
      <AuditStatus status={audit.status}/><p className="mt-4 whitespace-pre-wrap break-words">{audit.message}</p>
      <p className="mt-2 text-xs text-muted-foreground">{audit.word_count} palavras</p>
      <p className="data-label mt-4">Observações usadas</p>
      <ul className="text-sm">{audit.observations.map((o) => <li key={o}>{o}</li>)}</ul>
      {audit.complement && <div className="mt-4"><p className="data-label">Complemento</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{audit.complement}</p></div>}
      {notes.observations.some(o => o.kind === 'Visual') && <div className="mt-4"><p className="data-label">Linguagem visual (do print)</p><ul className="mt-2 text-sm">{notes.observations.filter(o => o.kind === 'Visual').map(o => <li key={o.id}>{o.text} · {o.checked ? 'marcada' : 'não marcada'}</li>)}</ul></div>}
      <div className="mt-5 flex flex-wrap gap-3">
        <MessageWhatsapp data={audit.businesses?.data ?? {}} message={audit.message}/>
        <Button variant="bordered" className="h-auto py-1 pl-1 pr-4 whitespace-normal" disabled={busy || audit.status === "enviada"} onClick={() => void act(() => markSent({ data: { id: audit.id } }))}><ActionIcon icon={Check}/>Marcar como enviada</Button>
        <Button variant="quiet" size="sm" disabled={busy} onClick={() => { if (audit.status === 'enviada') setConfirming(true); else void act(() => regenerateAudit({ data: { id: audit.id } })); }}>Gerar de novo</Button>
      </div>
      {confirming && <div className="mt-4" role="alertdialog" aria-label="Substituir mensagem enviada"><p>Esta mensagem já foi marcada como enviada. Gerar uma nova substitui a mensagem e o registro. Continuar?</p><div className="mt-3 flex gap-3"><Button variant="solid" disabled={busy} onClick={() => { setConfirming(false); void act(() => regenerateAudit({ data: { id: audit.id, confirmed: true } })); }}>Continuar</Button><Button variant="bordered" onClick={() => setConfirming(false)}>Cancelar</Button></div></div>}
      {busy && <p className="loading-text mt-2 text-sm text-muted-foreground">Aguarde...</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
