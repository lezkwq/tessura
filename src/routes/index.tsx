import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
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

export const Route = createFileRoute("/")({
  head: () => metadata("Busca", "Encontre empresas sem site próprio na sua cidade."),
  component: () => (
    <Gate>
      <SearchPage />
    </Gate>
  ),
});

const emptyForm = { city: "", state: "SP", niche: "" };
const ACTIVE_KEY = "prospeccao:busca-ativa";

function SearchPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState<Search | null>(null);
  const [batch, setBatch] = useState<Business[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState("");
  const [keyHint, setKeyHint] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const keyQuery = useQuery({ queryKey: ["apify-key"], queryFn: () => keyStatus() });
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(true);

  function remember(id: string) {
    window.localStorage.setItem(ACTIVE_KEY, id);
  }

  function show(result: { search: Search | null; batch: Business[] }) {
    if (!result.search) return;
    setSearch(result.search);
    setBatch(result.batch);
    setAdded(new Set(result.batch.filter((b) => b.is_lead).map((b) => b.id)));
    setForm({ city: result.search.city, state: result.search.state, niche: result.search.niche });
    remember(result.search.id);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored === "none") { setRestoring(false); return; }
    restoreSearch({ data: stored ? { id: stored } : {} })
      .then((result) => { if (alive.current) show(result); })
      .catch((e) => { if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível restaurar a busca."); })
      .finally(() => { if (alive.current) setRestoring(false); });
  }, []);

  function reset() {
    window.localStorage.setItem(ACTIVE_KEY, "none");
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
      show(await restoreSearch({ data: { id: result.search.id } }));
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
  const canFetchMore = search?.status === "ready";

  return (
    <div className="app-container py-14">
      <p className="eyebrow mb-3">EMPRESAS SEM SITE PRÓPRIO</p>
      <h1 className="page-title mb-10">Nova busca</h1>
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="status-tag">{configured ? "Chave configurada" : "Chave pendente"}</span>
        {configured && (
          <Button variant="quiet" size="sm" onClick={() => setKeyHint(!keyHint)}>
            Trocar chave
          </Button>
        )}
      </div>
      {keyHint ? (
        <p className="mb-8 text-sm text-muted-foreground">
          A chave do Apify é trocada nas configurações de conectores do projeto.
        </p>
      ) : (
        !configured && (
          <p className="mb-8 text-sm text-muted-foreground">
            Adicione sua chave do Apify nos conectores do projeto para começar a buscar.
          </p>
        )
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
          {canFetchMore && (
            <Button
              variant="bordered"
              type="button"
              disabled={!configured || pending}
              onClick={() => void run(form)}
            >
              Mostrar mais 10
            </Button>
          )}
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
  const rating = typeof data["totalScore"] === "number" ? data["totalScore"].toFixed(1) : null;
  const count = typeof data["reviewsCount"] === "number" ? data["reviewsCount"] : null;
  const website = safeUrl(data["website"]);

  return (
    <article
      className={`business-card card-enter${leaving ? " card-leaving" : ""}`}
      style={{ animationDelay: `${(index % 10) * 40}ms` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-base font-medium">{text(data["title"])}</h2>
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
          <dd>{text(data["phoneUnformatted"] ?? data["phone"])}</dd>
        </div>
        <div>
          <dt className="data-label">Avaliação</dt>
          <dd>{rating ? `${rating} (${count ?? 0} avaliações)` : "não informado"}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          className={buttonVariants({ variant: "bordered", size: "sm" })}
          href={mapsUrl(business)}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no Maps
        </a>
        {website && (
          <a
            className={buttonVariants({ variant: "bordered", size: "sm" })}
            href={website}
            target="_blank"
            rel="noreferrer"
          >
            Abrir site
          </a>
        )}
        {added ? (
          <Button key="added" variant="bordered" size="sm" disabled className="fade-swap disabled:opacity-100">
            Adicionado
          </Button>
        ) : (
          <Button variant="solid" size="sm" disabled={busy} onClick={onLead}>
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
          <Button variant="quiet" size="sm" onClick={onAskDiscard}>
            Descartar
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
