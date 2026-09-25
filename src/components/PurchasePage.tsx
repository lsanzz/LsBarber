import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Eye, EyeOff, LockKeyhole, Scissors, ShieldCheck } from 'lucide-react';
import { AnimatedValue, ChoiceGroup } from './motion-kit';
import { billingConfigured, billingEnabled, billingRequest, demoReceiptKey, readDraft, saveDraft } from '@/lib/purchase';
import { money, plans, planTotal, purchaseSelection, type BillingCycle, type PlanId } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import './sales-page.css';
import './purchase-page.css';

export function PurchasePage({ stage }: { stage: 'cadastro' | 'checkout' | 'confirmacao' }) {
  const initial = purchaseSelection(window.location.search);
  const [planId, setPlanId] = useState<PlanId>(initial.plan.id);
  const [cycle, setCycle] = useState<BillingCycle>(initial.cycle);
  const plan = plans.find(item => item.id === planId)!;
  const [draft, setDraft] = useState(readDraft);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [signedIn, setSignedIn] = useState(!billingEnabled);
  const [authReady, setAuthReady] = useState(!billingEnabled);
  const [status, setStatus] = useState<'checking' | 'demo' | 'paid' | 'pending' | 'invalid'>('checking');
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const query = `plano=${planId}&ciclo=${cycle}`;
  const cancelled = new URLSearchParams(window.location.search).get('cancelado') === '1';
  const amount = planTotal(plan, cycle);
  useEffect(() => {
    if (stage !== 'checkout') return;
    const url = new URL(window.location.href);
    url.searchParams.set('plano', planId);
    url.searchParams.set('ciclo', cycle);
    window.history.replaceState(window.history.state, '', url);
  }, [planId, cycle, stage]);
  useEffect(() => { document.title = `${stage === 'cadastro' ? 'Cadastro' : stage === 'checkout' ? 'Checkout' : 'Confirmação'} · LsBarber`; }, [stage]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!billingEnabled || !supabase) { setAuthReady(true); return; }
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => { if (mounted) { setSignedIn(!!data.session); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (mounted) { setSignedIn(!!session); setAuthReady(true); } });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (stage !== 'confirmacao') return;
    let ignore = false;
    if (!billingEnabled) {
      try {
        const receipt = JSON.parse(sessionStorage.getItem(demoReceiptKey) || 'null');
        const valid = receipt?.plan === initial.plan.id && receipt?.cycle === initial.cycle && Date.now() - receipt.createdAt < 3600000;
        setStatus(valid ? 'demo' : 'invalid');
      } catch { setStatus('invalid'); }
      return;
    }
    if (!authReady) return;
    if (!signedIn) { setStatus('invalid'); return; }
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) { setStatus('invalid'); return; }
    setStatus('checking');
    void billingRequest({ action: 'status', sessionId }).then(result => {
      if (ignore) return;
      if (plans.some(plan => plan.id === result.plan)) setPlanId(result.plan);
      if (result.cycle === 'annual' || result.cycle === 'monthly') setCycle(result.cycle);
      setStatus(result.paid ? 'paid' : 'pending');
    }).catch(err => { if (!ignore) { setError(err.message); setStatus('pending'); } });
    return () => { ignore = true; };
  }, [stage, retry, authReady, signedIn]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(''); setNotice('');
    if (!login && (!draft.name.trim() || !draft.business.trim())) { setError('Preencha seu nome e o nome da barbearia.'); return; }
    if (!login && password !== confirmation) { setError('As senhas precisam ser iguais. Confira a confirmação.'); return; }
    if (!login && !/^\d{10,11}$/.test(draft.phone.replace(/\D/g, ''))) { setError('Informe um telefone com DDD e 10 ou 11 dígitos.'); return; }
    submitting.current = true; setBusy(true);
    try {
      const clean = { ...draft, name: draft.name.trim(), business: draft.business.trim(), email: draft.email.trim().toLowerCase() };
      saveDraft(clean);
      if (billingEnabled) {
        if (!supabase) throw new Error('Cadastro indisponível até a configuração da integração.');
        const result = login
          ? await supabase.auth.signInWithPassword({ email: clean.email, password })
          : await supabase.auth.signUp({ email: clean.email, password, options: { data: { full_name: clean.name, business_name: clean.business, phone: clean.phone }, emailRedirectTo: `${window.location.origin}/checkout?${query}` } });
        if (result.error) throw new Error(login ? 'Não foi possível entrar. Confira o e-mail, a senha e a confirmação do e-mail.' : 'Não foi possível criar a conta. Tente novamente ou use “Já tenho conta”.');
        setPassword(''); setConfirmation('');
        if (!result.data.session) { setNotice('Confira seu e-mail e confirme o cadastro. Depois, entre na sua conta para continuar o pagamento.'); setLogin(true); return; }
      }
      window.location.assign(`/checkout?${query}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível continuar.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function checkout() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (!billingEnabled) {
        sessionStorage.setItem(demoReceiptKey, JSON.stringify({ plan: planId, cycle, createdAt: Date.now() }));
        window.location.assign(`/confirmacao?${query}`);
        return;
      }
      const result = await billingRequest({ action: 'create', plan: planId, cycle });
      const target = new URL(result.url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('Endereço de pagamento inválido. Tente novamente.');
      window.location.assign(target.href);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível abrir o pagamento.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  const ready = billingEnabled ? signedIn && authReady && billingConfigured : !!draft.name && !!draft.email && !!draft.business;
  const step = stage === 'cadastro' ? 0 : stage === 'checkout' ? 1 : 2;
  return <div className="sales-page purchase-page">
    <header className="purchase-header"><a className="sales-logo" href="/apresentacao"><Scissors /><span>LsBarber<span className="logo-dot">.</span></span></a><a href="/apresentacao#planos"><ArrowLeft size={15} /> Voltar aos planos</a></header>
    <main className="purchase-layout">
      <section className="purchase-main">
        <ol className="purchase-steps" aria-label="Etapas da contratação">{['Cadastro', 'Pagamento', 'Confirmação'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={i <= step ? 'is-current' : ''}><span>{i < step ? <Check size={14} /> : i + 1}</span>{label}</li>)}</ol>
        {!billingEnabled && <div className="purchase-demo"><ShieldCheck size={19} /><span><strong>Ambiente de demonstração</strong>Teste com dados fictícios. Nenhuma conta real ou cobrança será criada.</span></div>}
        {error && <div className="purchase-alert" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
        {notice && <div className="purchase-notice" role="status">{notice}</div>}
        {stage === 'cadastro' && <>
          <p className="sales-eyebrow">SUA BARBEARIA, MAIS ORGANIZADA</p><h1>{login ? 'Bem-vindo de volta.' : 'Vamos preparar a sua conta.'}</h1><p className="purchase-lead">{login ? 'Entre para continuar com o plano escolhido.' : 'Comece pelos seus dados. Você revisa o plano antes de pagar.'}</p>
          <form onSubmit={register} className="purchase-form">
            {!login && <><label>Seu nome<input name="name" autoComplete="name" required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Como podemos chamar você?" /></label><label>Nome da barbearia<input name="organization" autoComplete="organization" required maxLength={120} value={draft.business} onChange={e => setDraft({ ...draft, business: e.target.value })} placeholder="Nome do seu negócio" /></label></>}
            <div className="purchase-form-row"><label>E-mail<input type="email" name="email" autoComplete="email" required maxLength={254} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="voce@exemplo.com" /></label>{!login && <label>Telefone com DDD<input type="tel" name="tel" autoComplete="tel" required maxLength={20} value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} placeholder="(11) 99999-9999" /></label>}</div>
            <label>{billingEnabled ? 'Senha' : 'Senha de demonstração'}<div className="purchase-password"><input aria-label={billingEnabled ? 'Senha' : 'Senha de demonstração'} type={showPassword ? 'text' : 'password'} name="password" autoComplete={login ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-hint" /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><small id="password-hint">Pelo menos 8 caracteres.{!billingEnabled && ' Use uma senha fictícia; ela não será salva.'}</small></label>
            {!login && <label>Confirmar senha<input type="password" name="confirm-password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>}
            <button type="submit" className="sales-button" disabled={busy || (billingEnabled && !billingConfigured)}>{busy ? 'Aguarde…' : login ? 'Entrar e continuar' : 'Continuar para pagamento'}<ArrowRight size={17} /></button>
            {billingEnabled && <button type="button" className="purchase-link" onClick={() => { setLogin(!login); setError(''); }}>{login ? 'Ainda não tenho conta' : 'Já tenho conta'}</button>}
            <p className="purchase-fine">{billingEnabled ? 'A senha é usada somente para autenticar sua conta. Dados de cartão serão solicitados pela Stripe.' : 'Os dados deste formulário ficam apenas nesta aba para a demonstração. A senha não é armazenada.'}</p>
          </form>
        </>}
        {stage === 'checkout' && <>
          <p className="sales-eyebrow">FALTA POUCO</p><h1>Seu plano. Tudo conferido.</h1><p className="purchase-lead">Revise a contratação antes de continuar para o pagamento.</p>
          {cancelled && <div className="purchase-notice" role="status">Você voltou do checkout. O pagamento não foi confirmado; revise os dados para tentar novamente.</div>}
          {!authReady ? <p role="status">Verificando sua conta…</p> : !ready ? <div className="purchase-notice">{billingEnabled ? 'Entre na sua conta para continuar.' : 'Preencha seu cadastro antes de testar o pagamento.'}<a className="sales-button" href={`/cadastro?${query}`}>Ir para cadastro</a></div> : <>
            <div className="purchase-person"><span>CONTA DA BARBEARIA</span><strong>{draft.business || 'Sua conta LsBarber'}</strong><p>{draft.email || 'Conta autenticada'}</p><a href={`/cadastro?${query}`}>Voltar ao cadastro</a></div>
            <label className="purchase-plan-select">Plano<select aria-label="Plano" value={planId} onChange={e => setPlanId(e.target.value as PlanId)}>{plans.map(item => <option value={item.id} key={item.id}>{item.name} · {item.people} {item.people > 1 ? 'profissionais' : 'profissional'}</option>)}</select></label>
            <ChoiceGroup className="sales-billing" label="Periodicidade do plano" value={cycle} onChange={value => setCycle(value as BillingCycle)} options={[{ id: 'monthly', content: 'Mensal' }, { id: 'annual', content: <>Anual <span>2 meses de economia</span></> }]} />
            <div className="purchase-payment"><CreditCard size={25} /><div><h2>{billingEnabled ? 'Pagamento com a Stripe' : 'Simulação de checkout'}</h2><p>{billingEnabled ? 'Você será direcionado ao ambiente de pagamento da Stripe para informar os dados do cartão.' : 'Veja a etapa de confirmação sem informar cartão e sem realizar nenhuma cobrança.'}</p></div></div>
            <p className="purchase-fine">{cycle === 'annual' ? `${money(amount)} por ano, em pagamento anual. Equivale a ${money(amount / 12)} por mês.` : `${money(amount)} por mês.`} {billingEnabled ? 'Assinatura recorrente, com renovação automática.' : 'Valores ilustram a assinatura; esta simulação não contrata um plano.'}</p>
            <button className="sales-button purchase-submit" onClick={checkout} disabled={busy}>{busy ? 'Preparando checkout…' : billingEnabled ? 'Continuar para a Stripe' : 'Simular pagamento'}<ArrowRight size={18} /></button>
          </>}
        </>}
        {stage === 'confirmacao' && <div className="purchase-confirmation">
          <CheckCircle2 size={52} className={status === 'paid' || status === 'demo' ? 'confirmed' : ''} />
          <h1>{status === 'checking' ? 'Verificando pagamento…' : status === 'demo' ? 'Demonstração concluída!' : status === 'paid' ? 'Pagamento confirmado.' : status === 'pending' ? 'Aguardando confirmação.' : 'Vamos começar pelo cadastro.'}</h1>
          <p className="purchase-lead" role="status">{status === 'demo' ? 'Você percorreu todo o fluxo. Nenhuma cobrança foi feita e nenhuma assinatura real foi ativada.' : status === 'paid' ? 'A Stripe confirmou o pagamento da sua assinatura. Guarde o comprovante enviado por e-mail.' : status === 'pending' ? 'Ainda não foi possível confirmar o pagamento. Você pode consultar novamente sem criar outra cobrança.' : status === 'invalid' ? 'Não encontramos uma sessão de compra válida nesta conta. Retome o cadastro para continuar.' : 'Consultando a Stripe com segurança.'}</p>
          {status === 'pending' && <button className="sales-button" onClick={() => { setError(''); setRetry(value => value + 1); }}>Verificar novamente</button>}
          {status === 'demo' && <a className="sales-button" href="/">Explorar o painel local<ArrowRight size={17} /></a>}
          {status === 'paid' && <a className="sales-button" href="/apresentacao">Voltar à LsBarber<ArrowRight size={17} /></a>}
          {status === 'invalid' && <a className="sales-button" href={`/cadastro?${query}`}>Retomar cadastro</a>}
          <a className="purchase-link" href="/apresentacao#planos">Voltar aos planos</a>
        </div>}
      </section>
      <aside className="purchase-summary"><div className="purchase-summary-inner"><p className="sales-eyebrow">SEU PRÓXIMO PASSO</p><h2>Menos improviso.<br />Mais controle.</h2><p>Da primeira cadeira ao fechamento do caixa, tudo no seu lugar.</p><div className="purchase-summary-plan"><span>PLANO {plan.name.toUpperCase()}</span><strong><AnimatedValue value={money(amount)} /><small>/{cycle === 'annual' ? 'ano' : 'mês'}</small></strong><p>{cycle === 'annual' ? `Equivalente a ${money(amount / 12)}/mês. Economia de ${money(plan.cents * 2)}/ano.` : 'Assinatura mensal'}</p></div><ul>{[`${plan.people === 1 ? '1 profissional' : `Até ${plan.people} profissionais`} · 1 barbearia`, 'Agenda e cadastro de clientes', 'Serviços e comissões', 'Caixa, estoque e relatórios'].map(feature => <li key={feature}><Check size={16} />{feature}</li>)}</ul><div className="purchase-security"><LockKeyhole size={17} /><span>{billingEnabled ? 'Dados do cartão tratados pela Stripe' : 'Demonstração sem cobrança'}</span></div></div></aside>
    </main>
    <footer className="purchase-footer">LsBarber · Gestão para quem entende de estilo.</footer>
  </div>;
}
