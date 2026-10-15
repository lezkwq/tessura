import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
import { listAudits, markSent, regenerateAudit } from "@/lib/abordagem.functions";
import { whatsappLink, whatsappNumber } from "@/lib/abordagem";
import { metadata, placeData, text } from "@/lib/prospeccao";

export const Route = createFileRoute("/auditorias")({
  head: () => metadata("Auditorias", "Mensagens de WhatsApp geradas para os leads."),
  component: () => <Gate><AuditsPage /></Gate>,
});

type Row = Awaited<ReturnType<typeof listAudits>>[number];

function AuditsPage() {
  const audits = useQuery({ queryKey: ["audits"], queryFn: () => listAudits() });
  if (audits.isLoading) return <div className="app-container py-24"><p className="loading-text text-muted-foreground">Carregando auditorias...</p></div>;
  if (audits.isError) return <div className="app-container py-24"><p className="text-destructive">Não foi possível carregar as auditorias.</p><p className="mt-2 text-xs text-muted-foreground">{audits.error instanceof Error ? audits.error.message : ""}</p></div>;
  const rows = audits.data ?? [];
  return (
    <div className="app-container py-14">
      <h1 className="page-title mb-10">Auditorias</h1>
      {!rows.length && <p className="text-muted-foreground">Nenhuma auditoria ainda. Gere uma mensagem no detalhe de um lead.</p>}
      <div className="space-y-4">{rows.map((a, i) => <AuditRow key={a.id} audit={a} index={i} />)}</div>
    </div>
  );
}

function AuditRow({ audit, index }: { audit: Row; index: number }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const d = placeData(audit.businesses?.data ?? {});
  const phone = whatsappNumber(d["phoneUnformatted"] ?? d["phone"]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); await qc.invalidateQueries({ queryKey: ["audits"] }); } catch (e) { setError(e instanceof Error ? e.message : "Erro."); }
    setBusy(false);
  }
  return (
    <div className="business-card card-enter" style={{ animationDelay: `${Math.min(index, 9) * 40}ms` }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {audit.businesses ? <Link to="/leads/$id" params={{ id: audit.business_id }} className="text-lg font-medium">{text(d["title"])}</Link> : <span>não informado</span>}
        <span className="text-sm text-muted-foreground">{audit.businesses?.city}/{audit.businesses?.state} · {new Date(audit.created_at).toLocaleDateString("pt-BR")} · {audit.status === "enviada" && audit.sent_at ? `enviada em ${new Date(audit.sent_at).toLocaleString("pt-BR")}` : "não enviada"}</span>
      </div>
      <p className="mt-4 whitespace-pre-wrap">{audit.message}</p>
      <p className="mt-2 text-xs text-muted-foreground">{audit.word_count} palavras</p>
      <p className="data-label mt-4">Observações usadas</p>
      <ul className="text-sm">{audit.observations.map((o) => <li key={o}>{o}</li>)}</ul>
      <div className="mt-5 flex flex-wrap gap-3">
        {phone.number
          ? <a className={buttonVariants({ variant: "solid" })} href={whatsappLink(phone.number, audit.message)} target="_blank" rel="noreferrer">Abrir WhatsApp com a mensagem</a>
          : <Button variant="solid" disabled>Abrir WhatsApp com a mensagem</Button>}
        <Button variant="bordered" size="sm" disabled={busy || audit.status === "enviada"} onClick={() => void act(() => markSent({ data: { id: audit.id } }))}>Marcar como enviada</Button>
        <Button variant="quiet" size="sm" disabled={busy} onClick={() => void act(() => regenerateAudit({ data: { id: audit.id } }))}>Gerar de novo</Button>
      </div>
      {!phone.number && <p className="mt-2 text-sm text-muted-foreground">{phone.reason}</p>}
      {busy && <p className="loading-text mt-2 text-sm text-muted-foreground">Aguarde...</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
