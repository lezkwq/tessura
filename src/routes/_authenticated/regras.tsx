import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
import { getRules, resetRules, saveRules } from "@/lib/abordagem.functions";
import { metadata } from "@/lib/prospeccao";
import type { Rules } from "@/lib/abordagem";

export const Route = createFileRoute("/_authenticated/regras")({
  head: () => metadata("Regras", "Instruções e validadores das mensagens de WhatsApp."),
  component: () => <Gate><RulesPage /></Gate>,
});

function RulesPage() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => getRules() });
  const [form, setForm] = useState<Rules | null>(null);
  const [banned, setBanned] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (rules.data) { setForm(rules.data); setBanned(rules.data.banned_words.join("\n")); } }, [rules.data]);

  if (rules.isLoading || !form) return <div className="app-container py-24"><p className="loading-text text-muted-foreground">{rules.isError ? "Não foi possível carregar as regras." : "Carregando regras..."}</p></div>;

  async function run(fn: () => Promise<Rules>, ok: string) {
    setBusy(true); setStatus("");
    try { qc.setQueryData(["rules"], await fn()); setStatus(ok); } catch (e) { setStatus(e instanceof Error ? e.message : "Erro."); }
    setBusy(false);
  }
  const f = form;
  const field = "field mt-1 text-sm text-foreground";

  return (
    <div className="app-container py-14">
      <h1 className="page-title">Suas <strong>regras</strong> de abordagem</h1>
      <p className="mt-3 mb-8 text-sm text-muted-foreground">O tom e os limites das suas mensagens.</p>
      <label className="data-label block" htmlFor="ins">Instruções enviadas à IA</label>
      <textarea id="ins" className={`${field} min-h-[320px]`} value={f.instructions} onChange={(e) => setForm({ ...f, instructions: e.target.value })} />
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <label className="data-label">Mínimo de palavras<input type="number" className={`${field} opacity-50`} value={35} readOnly /></label>
        <label className="data-label">Máximo de palavras<input type="number" className={`${field} opacity-50`} value={60} readOnly /></label>
        <label className="data-label">Abertura obrigatória<input className={`${field} opacity-50`} value="Olá" readOnly /></label>
        <label className="data-label">Quem assina<input className={field} value={f.signer} onChange={(e) => setForm({ ...f, signer: e.target.value })} /></label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Abertura e limite de palavras são fixos no código e não mudam por aqui.</p>
      <label className="data-label mt-6 block" htmlFor="ban">Palavras proibidas (uma por linha)</label>
      <textarea id="ban" className={`${field} min-h-[160px]`} value={banned} onChange={(e) => setBanned(e.target.value)} />
      <div className="mt-6 flex gap-3">
        <Button variant="solid" size="sm" disabled={busy} onClick={() => void run(() => saveRules({ data: { instructions: f.instructions, min_words: f.min_words, max_words: f.max_words, opening: f.opening, signer: f.signer, banned_words: banned.split("\n").map((w) => w.trim()).filter(Boolean) } }), "Regras salvas.")}>Salvar</Button>
        <Button variant="bordered" size="sm" disabled={busy} onClick={() => void run(() => resetRules(), "Padrão restaurado.")}>Restaurar padrão</Button>
      </div>
      {status && <p role="status" className="mt-4 text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
