import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui-kit';
import { billingRequest, getLiveBillingMode } from '@/lib/purchase';
import { plans } from '@/lib/plans';
import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/assinatura')({ component: SubscriptionPage });

type Subscription = {
  plan: string;
  cycle: string;
  status: string;
  cancel_at_period_end: boolean;
  event_time: number;
};

function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    if (!supabase) { setError('A conexão com a conta não está configurada.'); setLoading(false); return; }
    const { data: account, error: accountError } = await supabase.auth.getUser();
    if (accountError || !account.user) { setError('Entre novamente para consultar sua assinatura.'); setLoading(false); return; }
    let liveMode: boolean;
    try { liveMode = await getLiveBillingMode(); }
    catch { setError('Não foi possível verificar o ambiente de pagamento.'); setLoading(false); return; }
    const { data, error: readError } = await supabase.from('billing_subscriptions')
      .select('plan, cycle, status, cancel_at_period_end, event_time')
      .eq('user_id', account.user.id).eq('livemode', liveMode)
      .order('event_time', { ascending: false })
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (readError) setError('Não foi possível consultar o plano. Tente novamente.');
    else setSubscription(data);
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  async function openPortal() {
    setOpening(true);
    setError('');
    try {
      const result = await billingRequest({ action: 'portal' });
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('Endereço de gestão inválido.');
      window.location.assign(url.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a gestão da assinatura.');
      setOpening(false);
    }
  }

  const plan = plans.find(item => item.id === subscription?.plan);
  const status = subscription?.status === 'active' ? 'Ativa' : subscription?.status === 'trialing' ? 'Em avaliação' : 'Requer atenção';
  return <div className="max-w-3xl">
    <PageHeader title="Assinatura" subtitle="Seu plano e pagamentos em um só lugar" />
    {error && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <Card className="overflow-hidden">
      <div className="border-b bg-sidebar px-6 py-7 text-sidebar-foreground">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-gold">LsBarber</p><h2 className="mt-2 font-display text-2xl">{loading ? 'Carregando plano…' : plan ? `Plano ${plan.name}` : 'Nenhum plano encontrado'}</h2></div>
          <CreditCard className="text-gold" aria-hidden="true" />
        </div>
      </div>
      <div className="p-6">
        {subscription && <dl className="grid gap-5 sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Situação</dt><dd className="mt-1 font-medium">{status}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Cobrança</dt><dd className="mt-1 font-medium">{subscription.cycle === 'annual' ? 'Anual' : 'Mensal'}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Renovação</dt><dd className="mt-1 font-medium">{subscription.cancel_at_period_end ? 'Desativada ao fim do período' : 'Automática'}</dd></div>
        </dl>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Button variant="gold" onClick={openPortal} disabled={opening || loading || !subscription}>{opening ? 'Abrindo…' : 'Gerenciar na Stripe'} <ArrowUpRight size={16} /></Button>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> Atualizar</Button>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> Cartão, faturas e cancelamento são gerenciados no portal seguro da Stripe. O painel atualiza depois que a Stripe confirma a mudança.</p>
      </div>
    </Card>
  </div>;
}
