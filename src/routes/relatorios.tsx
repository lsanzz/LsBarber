import { createFileRoute } from "@tanstack/react-router";
import { Card, PageHeader, StatCard } from "@/components/ui-kit";
import { computeCommissions, formatBRL, useStore } from "@/lib/store";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });

function RelatoriosPage() {
  const state = useStore((s) => s);

  const totalRevenue = state.sales.reduce((sum, s) => sum + s.total, 0);
  const monthRevenue = state.sales
    .filter((s) => new Date(s.createdAt).getMonth() === new Date().getMonth() && new Date(s.createdAt).getFullYear() === new Date().getFullYear())
    .reduce((sum, s) => sum + s.total, 0);

  const serviceCount = new Map<string, { name: string; count: number; revenue: number }>();
  for (const sale of state.sales) {
    for (const it of sale.items) {
      if (it.kind !== "service") continue;
      const cur = serviceCount.get(it.refId) ?? { name: it.name, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += it.price;
      serviceCount.set(it.refId, cur);
    }
  }
  const topServices = [...serviceCount.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  const commissions = computeCommissions(state.sales);

  const byPayment = state.sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.paymentMethod] = (acc[s.paymentMethod] ?? 0) + s.total;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Indicadores financeiros e operacionais" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Faturamento total" value={formatBRL(totalRevenue)} accent />
        <StatCard label="Faturamento do mês" value={formatBRL(monthRevenue)} />
        <StatCard label="Vendas" value={String(state.sales.length)} />
        <StatCard label="Atendimentos" value={String(state.appointments.length)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-display text-lg mb-4">Serviços mais realizados</h2>
          {topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((s) => {
                const max = Math.max(...topServices.map((x) => x.count));
                return (
                  <li key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">{s.count}x · {formatBRL(s.revenue)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${(s.count / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg mb-4">Comissões por profissional</h2>
          {state.professionals.length === 0 ? <p className="text-sm text-muted-foreground">Sem profissionais.</p> : (
            <ul className="divide-y">
              {state.professionals.map((p) => (
                <li key={p.id} className="py-2 flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="font-medium">{formatBRL(commissions.get(p.id) ?? 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display text-lg mb-4">Vendas por forma de pagamento</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["dinheiro", "pix", "debito", "credito"] as const).map((m) => (
              <div key={m} className="rounded-lg bg-muted/40 p-4">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">{m}</div>
                <div className="font-display text-xl mt-1">{formatBRL(byPayment[m] ?? 0)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
