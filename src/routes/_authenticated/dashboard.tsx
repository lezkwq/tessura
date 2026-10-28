import { displayName, formatPhone, formatRating, linkLabel, plural, sortByScore } from '@/lib/format';
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
import { ArrowUpRight, Trash, UserPlus, MapPin } from '@phosphor-icons/react';
import { ActionIcon } from '@/components/prospeccao/action-icon';
import { listLeads } from '@/lib/prospeccao.functions';
import { listAudits } from '@/lib/abordagem.functions';
import { readSearchSession, writeSearchSession } from '@/lib/search-session';
import {
  addLead,
  beginSearch,
  discardBusiness,
  keyStatus,
  pollSearch,
  restoreSearch,
} from "@/lib/prospeccao.functions";
import {
  mapsUrl,
  metadata,
  placeData,
  safeUrl,
  states,
  text,
  type Business,
  type Search,
} from "@/lib/prospeccao";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => metadata("Busca", "Encontre empresas sem site próprio na sua cidade."),
  component: () => (
    <Gate>
      <SearchPage />
    </Gate>
  ),
});

const emptyForm = { city: "", state: "SP", niche: "" };

function SearchPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState<Search | null>(null);
  const [batch, setBatch] = useState<Business[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const keyQuery = useQuery({ queryKey: ["apify-key"], queryFn: () => keyStatus() });
  const leads = useQuery({ queryKey: ['leads'], queryFn: () => listLeads() });
  const audits = useQuery({ queryKey: ['audits'], queryFn: () => listAudits() });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(true);

  function show(result: { search: Search | null; batch: Business[] }) {
    if (!result.search) return;
    setSearch(result.search);
    setBatch(previous => sortByScore([...new Map([...(search?.id === result.search?.id ? previous : []), ...result.batch].map(b => [b.id, b])).values()]));
    setAdded(previous => new Set([...previous, ...result.batch.filter((b) => b.is_lead).map((b) => b.id)]));
    setForm({ city: result.search.city, state: result.search.state, niche: result.search.niche });
  }

  useEffect(() => {
    const stored = readSearchSession(() => window.sessionStorage);
    if (stored) setForm(stored.form);
    if (!stored?.searchId) { setRestoring(false); return; }
    restoreSearch({ data: { id: stored.searchId } })
      .then((result) => {
        if (!alive.current) return;
        setSearch(result.search);
        const rows = result.batch.filter(b => stored.batchIds.includes(b.id));
        setBatch(sortByScore(rows));
        setAdded(new Set(rows.filter(b => b.is_lead).map(b => b.id)));
      })
      .catch((e) => { if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível restaurar a busca."); })
      .finally(() => { if (alive.current) setRestoring(false); });
  }, []);

  useEffect(() => {
    if (restoring) return;
    writeSearchSession(() => window.sessionStorage, { form, searchId: search?.id ?? null, batchIds: batch.map(b => b.id) });
  }, [form, search, batch, restoring]);

  function reset() {
    writeSearchSession(() => window.sessionStorage, null);
    setSearch(null); setBatch([]); setAdded(new Set()); setLeaving(new Set());
    setForm(emptyForm); setStatus(""); setError(""); setConfirming("");
  }

  const add = useMutation({
    mutationFn: (id: string) => addLead({ data: { id } }),
    onSuccess: (_result, id) => {
      setAdded((prev) => new Set(prev).add(id));
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Não foi possível adicionar o lead."),
  });

  const discard = useMutation({
    mutationFn: (placeId: string) => discardBusiness({ data: { placeId } }),
    onSuccess: (_result, placeId) => {
      setConfirming("");
      setLeaving((prev) => new Set(prev).add(placeId));
      setTimeout(() => {
        if (!alive.current) return;
        setBatch((rows) => rows.filter((row) => row.place_id !== placeId));
      }, 190);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Não foi possível descartar a empresa."),
  });

  async function wait(searchId: string) {
    for (let i = 0; i < 90; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      if (!alive.current) throw new Error("A busca foi interrompida.");
      const result = await pollSearch({ data: { id: searchId } });
      if (result.search.status !== "running") return result;
    }
    throw new Error("A busca demorou demais. Tente novamente.");
  }

  async function run(input: typeof emptyForm) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setConfirming("");
    setStatus("Buscando empresas...");
    try {
      let result = await beginSearch({ data: input });
      if (result.search.status === "running") result = await wait(result.search.id);
      show(result);
      setStatus(result.search.status === "exhausted" ? "Não há mais resultados para esta busca." : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível buscar.");
      setStatus("");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const configured = keyQuery.data?.configured ?? false;

  return (
    <div className="app-container py-14">
      <h1 className="page-title">Olá, <strong>Leandro</strong> 👋</h1>
      <p className="mt-3 mb-8 text-sm text-muted-foreground">{leads.data && audits.data ? (() => { const pend = audits.data.filter(a => a.status === 'não enviada').length; return `${plural(leads.data.length, 'lead salvo', 'leads salvos')} · ${plural(pend, 'auditoria não enviada', 'auditorias não enviadas')}`; })() : 'Carregando seus números...'}</p>
      {keyQuery.isLoading && (
        <p role="status" className="loading-text mb-6 text-sm text-muted-foreground">Verificando a chave do Apify...</p>
      )}
      {keyQuery.isError && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          {keyQuery.error instanceof Error ? keyQuery.error.message : "Não foi possível verificar a chave do Apify."}
        </p>
      )}
      {keyQuery.data?.configured === false && <p role="alert" className="mb-6 text-sm text-destructive">A chave do Apify está ausente.</p>}
      {leads.isError && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          {leads.error instanceof Error ? leads.error.message : "Não foi possível carregar os leads."}
        </p>
      )}
      {audits.isError && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          {audits.error instanceof Error ? audits.error.message : "Não foi possível carregar as auditorias."}
        </p>
      )}
      <form
        className="search-panel mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          void run(form);
        }}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="field-label">Cidade</span>
            <input
              className="field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Sua cidade"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="block">
            <span className="field-label">UF</span>
            <select
              className="field"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            >
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Nicho</span>
            <input
              className="field"
              value={form.niche}
              onChange={(e) => setForm({ ...form, niche: e.target.value })}
              placeholder="Ex.: barbearia"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="solid" type="submit" disabled={!configured || pending}>
            {pending ? "Aguarde..." : "Buscar empresas"}
          </Button>
          {search && (
            <Button variant="quiet" type="button" disabled={pending} onClick={reset}>
              Nova busca
            </Button>
          )}
        </div>
      </form>
      {restoring && (
        <p role="status" className="loading-text mb-8 text-sm text-muted-foreground">
          Restaurando a última busca...
        </p>
      )}
      {status && (
        <p role="status" className={`${pending ? "loading-text " : ""}mb-8 text-sm text-muted-foreground`}>
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-8 text-sm text-destructive">
          {error}
        </p>
      )}
      {batch.length > 0 && (
        <div className="space-y-4">
          {batch.map((business, index) => (
            <BusinessCard
              key={business.id}
              index={index}
              business={business}
              added={added.has(business.id)}
              leaving={leaving.has(business.place_id)}
              confirming={confirming === business.place_id}
              busy={(add.isPending && add.variables === business.id) || discard.isPending}
              onLead={() => add.mutate(business.id)}
              onAskDiscard={() => setConfirming(business.place_id)}
              onCancelDiscard={() => setConfirming("")}
              onConfirmDiscard={() => discard.mutate(business.place_id)}
            />
          ))}
        </div>
      )}
      {!batch.length && !status && !error && !restoring && search && (
        <div className="empty-region">
          <p className="text-muted-foreground">
            {search.status === "exhausted"
              ? "Não há mais resultados para esta busca."
              : "Nenhuma empresa nesta leva. Mostre mais resultados para continuar."}
          </p>
        </div>
      )}
    </div>
  );
}

function BusinessCard({
  index,
  added,
  leaving,
  business,
  confirming,
  busy,
  onLead,
  onAskDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: {
  index: number;
  added: boolean;
  leaving: boolean;
  business: Business;
  confirming: boolean;
  busy: boolean;
  onLead: () => void;
  onAskDiscard: () => void;
  onCancelDiscard: () => void;
  onConfirmDiscard: () => void;
}) {
  const data = placeData(business.data);
  const rating = typeof data["totalScore"] === "number" ? formatRating(data["totalScore"]) : null;
  const count = typeof data["reviewsCount"] === "number" ? data["reviewsCount"] : null;
  const website = safeUrl(data["website"]);

  return (
    <article
      className={`card-green card-enter${leaving ? " card-leaving" : ""}`}
      style={{ animationDelay: `${(index % 10) * 40}ms` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">{displayName(text(data["title"]))}</h2>
        <span className="text-sm text-muted-foreground">{business.website_type}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{text(data["categoryName"])}</p>
      <dl className="mt-6 grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="data-label">Endereço</dt>
          <dd>{text(data["address"])}</dd>
        </div>
        <div>
          <dt className="data-label">Telefone</dt>
          <dd>{typeof (data["phone"] ?? data["phoneUnformatted"]) === "string" ? formatPhone(String(data["phone"] ?? data["phoneUnformatted"])) : "não informado"}</dd>
        </div>
        <div>
          <dt className="data-label">Avaliação</dt>
          <dd>{rating ? `${rating} (${count ?? 0} avaliações)` : "não informado"}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          className={buttonVariants({ variant: "bordered", className: 'h-auto py-1 pl-1 pr-4 whitespace-normal' })}
          href={mapsUrl(business)}
          target="_blank"
          rel="noreferrer"
        >
          <ActionIcon icon={MapPin}/>Abrir no Maps
        </a>
        {website && (
          <a
            className={buttonVariants({ variant: "bordered", className: "h-auto py-1 pl-1 pr-4 whitespace-normal" })}
            href={website}
            target="_blank"
            rel="noreferrer"
          >
            <ActionIcon icon={ArrowUpRight}/>{linkLabel(business.website_type)}
          </a>
        )}
        {added ? (
          <Button key="added" variant="bordered" size="sm" disabled className="fade-swap disabled:opacity-100">
            Adicionado
          </Button>
        ) : (
          <Button variant="solid" className="h-auto py-1 pl-1 pr-4 whitespace-normal" disabled={busy} onClick={onLead}>
            <ActionIcon icon={UserPlus}/>
            {busy ? "Adicionando..." : "Adicionar aos leads"}
          </Button>
        )}
        {confirming ? (
          <>
            <Button variant="danger" size="sm" disabled={busy} onClick={onConfirmDiscard}>
              Confirmar descarte
            </Button>
            <Button variant="quiet" size="sm" onClick={onCancelDiscard}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="quiet" className="h-auto py-1 pl-1 pr-4" onClick={onAskDiscard}>
            <ActionIcon icon={Trash} className="bg-pastel-coral"/>Descartar
          </Button>
        )}
      </div>
      {confirming && (
        <p className="mt-3 text-xs text-muted-foreground">
          O descarte remove a empresa de todas as buscas e dos leads.
        </p>
      )}
    </article>
  );
}
