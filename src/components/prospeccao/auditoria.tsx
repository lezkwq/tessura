import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { generateMessage, readPrints, getAuditWorkspace, saveAuditNotes } from "@/lib/abordagem.functions";
import { mapsObservations, type Audit } from "@/lib/abordagem";
import type { Business } from "@/lib/prospeccao";
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { parseNotes, photoCount, type Observation } from '@/lib/audit-data';
import { PrintPicker } from './print-picker';
import { MessageWhatsapp } from './message-whatsapp';

type Obs = Observation;

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    r.readAsDataURL(file);
  });
}

export function Auditoria({ business }: { business: Business }) {
  const [files, setFiles] = useState<File[]>([]);
  const [obs, setObs] = useState<Obs[]>(() => mapsObservations(business).map((text, i) => ({ id: `maps-${i}`, text, checked: false, source: "Maps" })));
  const [busy, setBusy] = useState<"" | "print" | "msg">("");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);

  const [complement, setComplement] = useState('');
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();
  const loadFn = useServerFn(getAuditWorkspace);
  const saveFn = useServerFn(saveAuditNotes);
  const generateFn = useServerFn(generateMessage);
  const readFn = useServerFn(readPrints);
  useEffect(() => { let active = true; void loadFn({ data: { id: business.id } }).then(result => {
    if (!active) return;
    const notes = result.notes.observations.length || result.notes.complement ? result.notes : parseNotes({ complement: result.audit?.complement ?? '', observations: result.audit?.observation_state });
    if (notes.observations.length) setObs(notes.observations);
    setComplement(notes.complement); setAudit(result.audit); setReady(true);
  }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar a auditoria.'); }); return () => { active = false; }; }, [business.id, loadFn]);
  useEffect(() => { if (!ready) return; const timer = setTimeout(() => { void saveFn({ data: { id: business.id, notes: { complement, observations: obs } } }).then(() => qc.invalidateQueries({ queryKey: ['audit-workspace-export', business.id] })).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível salvar.')); }, 500); return () => clearTimeout(timer); }, [business.id, complement, obs, ready, saveFn, qc]);

  async function read() {
    setBusy("print"); setError("");
    try {
      const big = files.find((f) => f.size > 5_000_000);
      if (big) throw new Error(`O arquivo ${big.name} passa de 5 MB.`);
      const images = await Promise.all(files.map(toDataUrl));
      const lines = await readFn({ data: { images } });
      if (!lines.length) setError("Não foi possível ler nada com segurança nesses prints.");
      setObs((o) => [...o.filter((x) => x.source !== "Print"), ...lines.map((item, i) => ({ id: `print-${Date.now()}-${i}`, ...item, checked: false, source: "Print" as const }))]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o print."); }
    setBusy("");
  }

  async function generate(confirmed = false) {
    if (audit?.status === 'enviada' && !confirmed) { setConfirming(true); return; }
    setConfirming(false); setBusy("msg"); setError("");
    try {
      const chosen = obs.filter((o) => o.checked && o.text.trim()).map((o) => o.text.trim());
      await saveFn({ data: { id: business.id, notes: { complement, observations: obs } } });
      setAudit(await generateFn({ data: { id: business.id, observations: chosen, complement, observation_state: obs, confirmed } }));
      await qc.invalidateQueries({ queryKey: ['audits'] });
      await qc.invalidateQueries({ queryKey: ['audit-workspace-export', business.id] });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar a mensagem."); }
    setBusy("");
  }

  const update = (id: string, patch: Partial<Obs>) => setObs((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const anyChecked = obs.some((o) => o.checked && o.text.trim());

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-3xl font-bold">Auditoria</h2>
      <PrintPicker files={files} onChange={setFiles} busy={busy !== ''} />
      <div>
        <Button className="mt-3" variant="solid" size="sm" title={!files.length ? 'Escolha um print primeiro' : undefined} disabled={!files.length || busy !== ""} onClick={() => void read()}>Ler print</Button>
        {!files.length && <p className="mt-2 text-xs text-muted-foreground">Escolha um print primeiro</p>}
        {busy === "print" && <p className="loading-text mt-2 text-sm text-muted-foreground">Lendo prints...</p>}
      </div>
      <div className="mt-6">
        <p className="data-label">Observações</p>
        <ul className="mt-2 space-y-2">
          {obs.map((o) => (
            <li key={o.id} className="flex items-start gap-3">
              <input type="checkbox" className="mt-2" checked={o.checked} aria-label="Usar observação" onChange={(e) => update(o.id, { checked: e.target.checked })} />
              <textarea rows={2} aria-label="Observação" className="field min-w-0 flex-1 text-sm" value={o.text} onChange={(e) => update(o.id, { text: e.target.value })} />
              <span className="mt-2 text-xs text-muted-foreground">{o.source}{o.kind === 'Visual' ? ' · Visual' : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <label className="data-label block" htmlFor="complement">Complemento</label>
        <textarea id="complement" className="field mt-2" rows={3} maxLength={300} value={complement} disabled={!ready || busy !== ''} onChange={e => setComplement(e.target.value)} />
        <p className="mt-2 text-xs text-muted-foreground">Algo que você viu e a busca não captura. Ex.: Maps sem fotos, Instagram parado há meses.</p>
        <p className="mt-1 text-right text-xs text-muted-foreground">{complement.length}/300</p>
        {photoCount(business.data && typeof business.data === 'object' && !Array.isArray(business.data) ? business.data : {}) !== null && <p className="mt-2 text-sm">Fotos no Maps: {photoCount(business.data && typeof business.data === 'object' && !Array.isArray(business.data) ? business.data : {})}</p>}
      </div>
      <Button className="mt-6" variant="solid" size="sm" disabled={!ready || (!anyChecked && !complement.trim()) || busy !== ""} onClick={() => void generate()}>Gerar mensagem</Button>
      {confirming && <div className="mt-4 card-coral" role="alertdialog" aria-label="Substituir mensagem enviada"><p>Esta mensagem já foi marcada como enviada. Gerar uma nova substitui a mensagem e o registro. Continuar?</p><div className="mt-3 flex gap-3"><Button variant="solid" onClick={() => void generate(true)}>Continuar</Button><Button variant="bordered" onClick={() => setConfirming(false)}>Cancelar</Button></div></div>}
      {busy === "msg" && <p className="loading-text mt-2 text-sm text-muted-foreground">Gerando mensagem...</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {audit && (
        <div className="mt-6 card-yellow">
          <p className="whitespace-pre-wrap">{audit.message}</p>
          <p className="mt-3 text-xs text-muted-foreground">{audit.word_count} palavras</p>
          <p className="data-label mt-4">Observações usadas</p>
          <ul className="text-sm">{audit.observations.map((o) => <li key={o}>{o}</li>)}</ul>
          <div className="mt-4 flex flex-wrap items-center gap-3"><MessageWhatsapp data={business.data} message={audit.message} /><Link className="text-sm underline" to="/auditorias">Ver em Auditorias</Link></div>
        </div>
      )}
    </section>
  );
}
