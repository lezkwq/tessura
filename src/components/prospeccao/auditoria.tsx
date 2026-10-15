import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { generateMessage, readPrints } from "@/lib/abordagem.functions";
import { mapsObservations, type Audit } from "@/lib/abordagem";
import type { Business } from "@/lib/prospeccao";

interface Obs { id: number; text: string; checked: boolean; source: "Print" | "Maps" }
let seq = 0;

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
  const [obs, setObs] = useState<Obs[]>(() => mapsObservations(business).map((text) => ({ id: seq++, text, checked: false, source: "Maps" })));
  const [busy, setBusy] = useState<"" | "print" | "msg">("");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);

  async function read() {
    setBusy("print"); setError("");
    try {
      const big = files.find((f) => f.size > 5_000_000);
      if (big) throw new Error(`O arquivo ${big.name} passa de 5 MB.`);
      const images = await Promise.all(files.map(toDataUrl));
      const lines = await readPrints({ data: { images } });
      if (!lines.length) setError("Não foi possível ler nada com segurança nesses prints.");
      setObs((o) => [...o.filter((x) => x.source !== "Print"), ...lines.map((text) => ({ id: seq++, text, checked: false, source: "Print" as const }))]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o print."); }
    setBusy("");
  }

  async function generate() {
    setBusy("msg"); setError(""); setAudit(null);
    try {
      const chosen = obs.filter((o) => o.checked && o.text.trim()).map((o) => o.text.trim());
      setAudit(await generateMessage({ data: { id: business.id, observations: chosen } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar a mensagem."); }
    setBusy("");
  }

  const update = (id: number, patch: Partial<Obs>) => setObs((o) => o.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const anyChecked = obs.some((o) => o.checked && o.text.trim());

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="text-xl font-medium">Auditoria</h2>
      <div className="mt-5">
        <label className="data-label block" htmlFor="prints">Prints do Instagram (opcional)</label>
        <input id="prints" type="file" accept="image/png,image/jpeg,image/webp" multiple className="mt-1 block text-sm"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
        <Button className="mt-3" variant="bordered" size="sm" disabled={!files.length || busy !== ""} onClick={() => void read()}>Ler print</Button>
        {busy === "print" && <p className="loading-text mt-2 text-sm text-muted-foreground">Lendo prints...</p>}
      </div>
      <div className="mt-6">
        <p className="data-label">Observações (só as marcadas entram na mensagem)</p>
        <ul className="mt-2 space-y-2">
          {obs.map((o) => (
            <li key={o.id} className="flex items-start gap-3">
              <input type="checkbox" className="mt-2" checked={o.checked} aria-label="Usar observação" onChange={(e) => update(o.id, { checked: e.target.checked })} />
              <input className="w-full border border-border px-3 py-1.5 text-sm" value={o.text} onChange={(e) => update(o.id, { text: e.target.value })} />
              <span className="mt-2 text-xs text-muted-foreground">{o.source}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button className="mt-6" variant="solid" size="sm" disabled={!anyChecked || busy !== ""} onClick={() => void generate()}>Gerar mensagem</Button>
      {busy === "msg" && <p className="loading-text mt-2 text-sm text-muted-foreground">Gerando mensagem...</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {audit && (
        <div className="mt-6 border border-border p-5">
          <p className="whitespace-pre-wrap">{audit.message}</p>
          <p className="mt-3 text-xs text-muted-foreground">{audit.word_count} palavras</p>
          <p className="data-label mt-4">Observações usadas</p>
          <ul className="text-sm">{audit.observations.map((o) => <li key={o}>{o}</li>)}</ul>
          <Link className="mt-4 inline-block text-sm underline" to="/auditorias">Ver em Auditorias</Link>
        </div>
      )}
    </section>
  );
}
