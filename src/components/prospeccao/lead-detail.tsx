import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { Gate } from "@/components/prospeccao/gate";
import { addLead, discardBusiness, getLead, pollLead } from "@/lib/prospeccao.functions";
import { displayCity, displayName, formatHours, formatPhone, formatRating, linkLabel } from "@/lib/format";
import { ArrowUpRight, MapPin, Trash } from '@phosphor-icons/react';
import { ActionIcon } from './action-icon';
import { Auditoria } from "@/components/prospeccao/auditoria";
import { mapsUrl, placeData, safeUrl, text } from "@/lib/prospeccao";

function items(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
    : [];
}

function hourRows(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [formatHours(entry)] : [];
    if (entry && typeof entry === "object") {
      const row = entry as Record<string, unknown>;
      const day = typeof row["day"] === "string" ? row["day"] : null;
      const hours = typeof row["hours"] === "string" ? row["hours"] : null;
      if (day && hours) return [`${day}: ${formatHours(hours)}`];
    }
    return [];
  });
}

function reviewRows(value: unknown): { id: string; head: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const name = typeof row["name"] === "string" ? row["name"] : "autor não informado";
    const stars = typeof row["stars"] === "number" ? `nota ${String(row["stars"]).replace(".", ",")}` : "nota não informada";
    const when = typeof row["publishedAtDate"] === "string" ? new Date(row["publishedAtDate"]).toLocaleDateString("pt-BR") : typeof row["publishAt"] === "string" ? row["publishAt"] : "data não informada";
    const head = [name, stars, when].filter(Boolean).join(" · ");
    const id = typeof row["reviewId"] === "string" ? row["reviewId"] : head;
    const text = typeof row["text"] === "string" ? row["text"] : "";
    return [{ id, head, text }];
  });
}

export function LeadDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [retryError, setRetryError] = useState("");
  const lead = useQuery({ queryKey: ["lead", id], queryFn: () => getLead({ data: { id } }) });

  useEffect(() => {
    if (lead.data?.enrichment_status !== "running") return;
    let active = true;
    void (async () => {
      for (let i = 0; i < 60 && active; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (!active) return;
        try {
          const fresh = await pollLead({ data: { id } });
          if (!active) return;
          queryClient.setQueryData(["lead", id], fresh);
          if (fresh.enrichment_status !== "running") return;
        } catch (error) {
          if (active) {
            setRetryError(error instanceof Error ? error.message : String(error));
            void queryClient.invalidateQueries({ queryKey: ["lead", id] });
          }
          return;
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [id, lead.data?.enrichment_status, queryClient]);

  const retry = useMutation({
    mutationFn: () => addLead({ data: { id } }),
    onMutate: () => { setRetryError(""); setStatus(""); },
    onSuccess: (fresh) => queryClient.setQueryData(["lead", id], fresh),
    onError: (error) => setRetryError(error instanceof Error ? error.message : String(error)),
  });

  const remove = useMutation({
    mutationFn: (placeId: string) => discardBusiness({ data: { placeId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void navigate({ to: "/leads" });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "Não foi possível descartar."),
  });

  if (lead.isLoading)
    return (
      <div className="py-12">
        <p className="loading-text text-muted-foreground">Carregando lead...</p>
      </div>
    );

  if (lead.isError || !lead.data)
    return (
      <div className="py-12">
        <p className="text-destructive">Lead não encontrado.</p>
        <Link className={buttonVariants({ variant: "bordered", size: "sm" })} to="/leads">
          Voltar aos leads
        </Link>
      </div>
    );

  const business = lead.data;
  const data = placeData(business.data);
  const emails = items(data["emails"]);
  const social = [
    ...items(data["facebooks"]),
    ...items(data["instagrams"]),
    ...items(data["linkedIns"]),
    ...items(data["twitters"]),
    ...items(data["youtubes"]),
    ...items(data["tiktoks"]),
  ];
  const hours = hourRows(data["openingHours"]);
  const reviews = reviewRows(data["reviews"]).slice(0, 5);
  const photos = items(data["imageUrls"]).slice(0, 6);
  const website = safeUrl(data["website"]);
  const rating = typeof data["totalScore"] === "number" ? formatRating(data["totalScore"]) : null;
  const count = typeof data["reviewsCount"] === "number" ? data["reviewsCount"] : null;

  return (
    <div className="min-w-0">
      <Link className="text-sm text-muted-foreground hover:text-foreground" to="/leads">
        Voltar aos leads
      </Link>
      <h2 className="font-display mt-6 text-3xl font-bold break-words">{displayName(text(data["title"]))}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {text(data["categoryName"])} · {displayCity(business.city)}/{business.state}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          className={buttonVariants({ variant: "bordered", className: "h-auto py-1 pl-1 pr-4" })}
          href={mapsUrl(business)}
          target="_blank"
          rel="noreferrer"
        >
          <ActionIcon icon={MapPin}/>Abrir no Maps
        </a>
        {website && (
          <a
            className={buttonVariants({ variant: "bordered", className: "h-auto py-1 pl-1 pr-4" })}
            href={website}
            target="_blank"
            rel="noreferrer"
          >
            <ActionIcon icon={ArrowUpRight}/>{linkLabel(business.website_type)}
          </a>
        )}
        <Button variant="danger" className="h-auto py-1 pl-1 pr-4" onClick={() => setConfirming(true)}>
          <ActionIcon icon={Trash}/>Descartar
        </Button>
      </div>
      {confirming && (
        <div className="mt-6 card-coral">
          <p className="text-sm">
            Confirmar descarte remove esta empresa dos leads e de todas as buscas.
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              variant="danger"
              size="sm"
              disabled={remove.isPending}
              onClick={() => remove.mutate(business.place_id)}
            >
              Confirmar descarte
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {status && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          {status}
        </p>
      )}
      {business.enrichment_status === "running" && (
        <p role="status" className="loading-text mt-8 text-sm text-muted-foreground">
          Carregando detalhes da empresa...
        </p>
      )}
      {business.enrichment_status === "failed" && (
        <div className="mt-8 card-coral">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Os detalhes não foram carregados.</p>
            <Button variant="bordered" size="sm" disabled={retry.isPending} onClick={() => retry.mutate()}>
              {retry.isPending ? "Tentando..." : "Tentar de novo"}
            </Button>
          </div>
          {retryError && <p className="mt-2 text-xs text-muted-foreground">{retryError}</p>}
        </div>
      )}
      <dl className="detail-grid mt-10 card-blue">
        <div>
          <dt className="data-label">Endereço</dt>
          <dd>{text(data["address"])}</dd>
        </div>
        <div>
          <dt className="data-label">Telefone</dt>
          <dd>{typeof (data["phone"] ?? data["phoneUnformatted"]) === "string" ? formatPhone(String(data["phone"] ?? data["phoneUnformatted"])) : "não informado"}</dd>
        </div>
        <div>
          <dt className="data-label">Site</dt>
          <dd>{business.website_type}</dd>
        </div>
        <div>
          <dt className="data-label">Avaliação</dt>
          <dd>{rating ? `${rating} (${count ?? 0} avaliações)` : "não informado"}</dd>
        </div>
      </dl>
      <div className="mt-10 border-t border-border pt-8">
        <p className="data-label">Horários</p>
        {hours.length ? (
          <ul className="mt-2 space-y-1">
            {hours.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">não informado</p>
        )}
      </div>
      {reviews.length === 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Avaliações recentes</p>
          <p className="mt-2">não informado</p>
        </div>
      )}
      {reviews.length > 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Avaliações recentes</p>
          <ul className="mt-3 space-y-4">
            {reviews.map((review) => (
              <li key={review.id}>
                <p className="text-sm text-muted-foreground">{review.head}</p>
                {review.text && <p className="mt-1 text-sm">{review.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {emails.length > 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Email</p>
          <ul className="mt-2 space-y-1">
            {emails.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      )}
      {social.length > 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Links sociais</p>
          <ul className="mt-2 space-y-1">
            {social.map((entry) => {
              const href = safeUrl(entry);
              return (
                <li key={entry}>
                  {href ? (
                    <a className="underline break-all" href={href} target="_blank" rel="noreferrer">
                      {entry}
                    </a>
                  ) : (
                    entry
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {social.length === 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Links sociais</p>
          <p className="mt-2">não informado</p>
        </div>
      )}
      {photos.length === 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Fotos</p>
          <p className="mt-2">não informado</p>
        </div>
      )}
      {photos.length > 0 && (
        <div className="mt-8 border-t border-border pt-8">
          <p className="data-label">Fotos</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((entry) => (
              <img key={entry} src={entry} alt="Foto da empresa" loading="lazy" className="h-40 w-40 max-w-full rounded-[28px] object-cover" />
            ))}
          </div>
        </div>
      )}
      <Auditoria business={business} />
    </div>
  );
}
