import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, StatCard } from "@/components/ui-kit";
import { computeCommissions, formatBRL, useStore } from "@/lib/store";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const state = useStore((s) => s);
  const today = new Date().toDateString();
  const todays = state.appointments.filter((a) => new Date(a.start).toDateString() === today && a.status !== "cancelado" && a.status !== "faltou");
  const todaySales = state.sales.filter((s) => new Date(s.createdAt).toDateString() === today);
  const revenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const commissions = computeCommissions(state.sales);
  const totalCommissions = [...commissions.values()].reduce((a, b) => a + b, 0);
  const lowStock = state.products.filter((p) => p.stock <= p.minStock);

  const upcoming = [...todays]
    .filter((a) => new Date(a.start) >= new Date())
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 5);

  return (
    <div>
      <PageHeader title="Bem-vindo à LsBarber" subtitle="Resumo operacional do dia" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Faturamento de hoje" value={formatBRL(revenue)} accent />
        <StatCard label="Atendimentos hoje" value={String(todays.length)} hint={`${state.appointments.length} no total`} />
        <StatCard label="Clientes" value={String(state.clients.length)} />
        <StatCard label="Comissões a pagar" value={formatBRL(totalCommissions)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Próximos atendimentos</h2>
            <Link to="/agenda" className="text-sm text-gold hover:underline">Ver agenda →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum atendimento programado para hoje.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((a) => {
                const c = state.clients.find((x) => x.id === a.clientId);
                const p = state.professionals.find((x) => x.id === a.professionalId);
                const s = state.services.find((x) => x.id === a.serviceId);
                return (
                  <li key={a.id} className="py-3 flex items-center gap-4">
                    <div className="font-display text-lg w-16">
                      {new Date(a.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{c?.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{s?.name} · {p?.name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{s ? formatBRL(s.price) : ""}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-xl mb-4">Estoque baixo</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Tudo abastecido ✨</p>
          ) : (
            <ul className="space-y-3">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-destructive font-medium">{p.stock} un</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
