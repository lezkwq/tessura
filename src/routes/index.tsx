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
  latestSearch,
  pollSearch,
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

  useEffect(() => () => { alive.current = false; }, []);

  const keyQuery = useQuery({ queryKey: ["apify-key"], queryFn: () => keyStatus() });
  const lastQuery = useQuery({ queryKey: ["latest-search"], queryFn: () => latestSearch() });

  useEffect(() => {
    const last = lastQuery.data;
    if (last && !form.city && !form.niche)
      setForm({ city: last.city, state: last.state, niche: last.niche });
  }, [lastQuery.data, form.city, form.niche]);

  const add = useMutation({
    mutationFn: (id: string) => addLead({ data: { id } }),
    onSuccess: (_result, id) => {
      setBatch((rows) => rows.filter((row) => row.id !== id));
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Não foi possível adicionar o lead."),
  });

  const discard = useMutation({
    mutationFn: (placeId: string) => discardBusiness({ data: { placeId } }),
    onSuccess: (_result, placeId) => {
      setBatch((rows) => rows.filter((row) => row.place_id !== placeId));
      setConfirming("");
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
      setSearch(result.search);
      setBatch(result.batch);
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
        </div>
      </form>
      {status && (
        <p role="status" className="mb-8 text-sm text-muted-foreground">
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
          {batch.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              confirming={confirming === business.place_id}
              busy={add.isPending || discard.isPending}
              onLead={() => add.mutate(business.id)}
              onAskDiscard={() => setConfirming(business.place_id)}
              onCancelDiscard={() => setConfirming("")}
              onConfirmDiscard={() => discard.mutate(business.place_id)}
            />
          ))}
        </div>
      )}
      {!batch.length && !status && !error && search && (
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
  business,
  confirming,
  busy,
  onLead,
  onAskDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: {
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
    <article className="business-card">
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
        <Button variant="solid" size="sm" disabled={busy} onClick={onLead}>
          Adicionar aos leads
        </Button>
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
