export const plans = [
  { id: 'basico', name: 'Básico', cents: 3990, people: 1, intro: 'Para quem comanda a própria cadeira.' },
  { id: 'plus', name: 'Plus', cents: 6990, people: 3, intro: 'Para uma equipe pequena, bem organizada.' },
  { id: 'pro', name: 'Pro', cents: 9990, people: 8, intro: 'Para acompanhar uma operação maior.' },
] as const;
export type PlanId = (typeof plans)[number]['id'];
export type BillingCycle = 'monthly' | 'annual';
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const planTotal = (plan: (typeof plans)[number], cycle: BillingCycle) => plan.cents * (cycle === 'annual' ? 10 : 1);
export function purchaseSelection(search: string) {
  const query = new URLSearchParams(search);
  return { plan: plans.find(plan => plan.id === query.get('plano')) ?? plans[1], cycle: query.get('ciclo') === 'annual' ? 'annual' as const : 'monthly' as const };
}
export const purchaseUrl = (path: string, plan: PlanId, cycle: BillingCycle) => `${path}?plano=${plan}&ciclo=${cycle}`;
