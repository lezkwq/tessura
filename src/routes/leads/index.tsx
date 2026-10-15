import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gate } from "@/components/prospeccao/gate";
import { listLeads } from "@/lib/prospeccao.functions";
import { metadata, placeData, text } from "@/lib/prospeccao";

export const Route = createFileRoute("/leads/")({
  head: () => metadata("Leads", "As empresas que você salvou para contato."),
  component: () => (
    <Gate>
      <LeadsPage />
    </Gate>
  ),
});

function LeadsPage() {
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => listLeads() });

  if (leads.isLoading)
    return (
      <div className="app-container py-24">
        <p className="loading-text text-muted-foreground">Carregando leads...</p>
      </div>
    );

  if (leads.isError)
    return (
      <div className="app-container py-24">
        <p className="text-destructive">Não foi possível carregar os leads.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {leads.error instanceof Error ? leads.error.message : String(leads.error)}
        </p>
      </div>
    );

  const rows = leads.data ?? [];

  if (!rows.length)
    return (
      <div className="app-container">
        <div className="empty-region">
          <p className="text-muted-foreground">
            Você ainda não tem leads. Adicione empresas pela busca.
          </p>
        </div>
      </div>
    );

  return (
    <div className="app-container py-14">
      <p className="eyebrow mb-3">SEUS LEADS</p>
      <h1 className="page-title mb-10">Leads salvos</h1>
      <div className="space-y-3">
        {rows.map((business) => {
          const data = placeData(business.data);
          return (
            <Link
              key={business.id}
              style={{ animationDelay: `${Math.min(rows.indexOf(business), 9) * 40}ms` }}
              to="/leads/$id"
              params={{ id: business.id }}
              className="business-card card-enter block transition-colors duration-150 hover:bg-muted hover:border-foreground/20"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-medium">{text(data["title"])}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {text(data["categoryName"])} · {business.city}/{business.state}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">{business.website_type}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
