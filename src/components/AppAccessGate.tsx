import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, CreditCard, LockKeyhole, RefreshCw, Scissors } from 'lucide-react';
import { billingConfigured, billingEnabled, billingRequest, getLiveBillingMode } from '@/lib/purchase';
import { disconnectSupabaseSync, downloadWorkspaceData, initSupabaseSync, setWorkspacePlanLimit, type State } from '@/lib/store';
import { plans } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { AppShell } from './AppShell';

type Access = { kind: 'checking' | 'signin' | 'subscription' | 'error' | 'ready'; message?: string };

export function AppAccessGate() {
  const [access, setAccess] = useState<Access>({ kind: 'checking' });
  const [openingPortal, setOpeningPortal] = useState(false);
  const [notice, setNotice] = useState('');
  const checkId = useRef(0);

  async function verify() {
    const id = ++checkId.current;
    setAccess({ kind: 'checking' });
    if (!supabase) { setAccess({ kind: 'error', message: 'A conexão da LsBarber não está configurada.' }); return; }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (id !== checkId.current) return;
    if (userError || !userData.user?.email_confirmed_at) {
      disconnectSupabaseSync();
      setAccess({ kind: 'signin' });
      return;
    }
    let liveMode: boolean;
    try { liveMode = await getLiveBillingMode(); }
    catch {
      if (id !== checkId.current) return;
      disconnectSupabaseSync();
      setAccess({ kind: 'error', message: 'Não foi possível conferir o ambiente de pagamento. Tente novamente.' });
      return;
    }
    if (id !== checkId.current) return;
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('billing_subscriptions')
      .select('plan, status, event_time, updated_at')
      .eq('user_id', userData.user.id)
      .eq('livemode', liveMode)
      .order('event_time', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1).maybeSingle();
    if (id !== checkId.current) return;
    if (subscriptionError) {
      disconnectSupabaseSync();
      setAccess({ kind: 'error', message: 'Não foi possível conferir seu plano. Tente novamente.' });
      return;
    }
    const active = subscriptions && (subscriptions.status === 'active' || subscriptions.status === 'trialing') ? subscriptions : null;
    if (!active) {
      disconnectSupabaseSync();
      setAccess({ kind: 'subscription' });
      return;
    }
    const sync = await initSupabaseSync(userData.user.id, String(userData.user.user_metadata?.business_name ?? ''));
    if (id !== checkId.current) return;
    setWorkspacePlanLimit(plans.find(plan => plan.id === active.plan)?.people ?? 0);
    setAccess(sync.status === 'conectado'
      ? { kind: 'ready' }
      : { kind: 'error', message: sync.message });
  }

  useEffect(() => {
    if (!billingEnabled) return;
    void verify();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        checkId.current++;
        disconnectSupabaseSync();
        setAccess({ kind: 'signin' });
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        void verify();
      }
    });
    return () => { checkId.current++; data.subscription.unsubscribe(); };
  }, []);

  if (!billingEnabled) return <AppShell />;
  if (access.kind === 'ready') return <AppShell />;

  const openPortal = async () => {
    setOpeningPortal(true);
    try {
      const result = await billingRequest({ action: 'portal' });
      const url = new URL(result.url);
      if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('Endereço de gestão inválido.');
      window.location.assign(url.href);
    } catch (error) {
      setAccess({ kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível abrir a gestão da assinatura.' });
      setOpeningPortal(false);
    }
  };

  const downloadOwnData = async () => {
    if (!supabase) return;
    const { data: account, error: authError } = await supabase.auth.getUser();
    if (authError || !account.user) { setNotice('Entre novamente para baixar seus dados.'); return; }
    const { data, error } = await supabase.from('salon_workspaces')
      .select('data').eq('owner_id', account.user.id).maybeSingle();
    if (error) setNotice('Não foi possível baixar seus dados agora. Tente novamente.');
    else if (!data) setNotice('Esta conta ainda não possui dados de barbearia.');
    else { downloadWorkspaceData(data.data as State); setNotice('Cópia dos dados preparada para download.'); }
  };

  return <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-lg rounded-2xl border bg-card p-7 sm:p-10 shadow-soft">
      <Link to="/apresentacao" className="inline-flex items-center gap-2 font-display text-xl text-foreground">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-gold-foreground"><Scissors size={20} /></span>
        LsBarber
      </Link>
      <div className="mt-9 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-gold" aria-hidden="true">
        {access.kind === 'subscription' ? <CreditCard /> : <LockKeyhole />}
      </div>
      <h1 className="mt-5 font-display text-3xl text-foreground">
        {access.kind === 'checking' ? 'Conferindo seu acesso…' : access.kind === 'signin' ? 'Entre na sua conta.' : access.kind === 'subscription' ? 'Seu painel aguarda um plano ativo.' : 'Não foi possível abrir seu painel.'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status">
        {access.kind === 'checking' ? 'Estamos verificando sua conta e carregando apenas os dados da sua barbearia.'
          : access.kind === 'signin' ? 'Faça login com o e-mail confirmado para proteger as informações da sua barbearia.'
            : access.kind === 'subscription' ? 'A contratação pode estar em processamento ou sua assinatura precisa de atenção. Confira o plano antes de acessar os dados.'
              : access.message}
      </p>
      {notice && <p className="mt-4 text-sm text-muted-foreground" role="status">{notice}</p>}
      <div className="mt-7 flex flex-wrap gap-3">
        {access.kind === 'signin' && <a href="/cadastro?entrar=1" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Entrar ou criar conta <ArrowRight size={16} /></a>}
        {access.kind === 'subscription' && <>
          <Link to="/apresentacao" hash="planos" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ver planos <ArrowRight size={16} /></Link>
          <button type="button" onClick={openPortal} disabled={openingPortal} className="rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50">{openingPortal ? 'Abrindo…' : 'Gerenciar assinatura'}</button>
          <button type="button" onClick={() => void downloadOwnData()} className="rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted">Baixar meus dados</button>
        </>}
        {(access.kind === 'subscription' || access.kind === 'error') && <button type="button" onClick={() => void verify()} className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-muted"><RefreshCw size={16} /> Verificar novamente</button>}
      </div>
      {!billingConfigured && <p className="mt-5 text-xs text-destructive">Configuração de cobrança ausente neste ambiente.</p>}
    </div>
  </div>;
}
