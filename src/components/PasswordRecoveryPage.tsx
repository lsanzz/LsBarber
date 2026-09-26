import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, Scissors } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './sales-page.css';
import './purchase-page.css';
import './purchase-auth.css';

type RecoveryState = 'checking' | 'ready' | 'expired' | 'done';

export function PasswordRecoveryPage() {
  const [state, setState] = useState<RecoveryState>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Redefinir senha · LsBarber';
    if (!supabase) { setState('expired'); return; }
    let mounted = true;
    const client = supabase;
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (mounted && event === 'PASSWORD_RECOVERY' && session) setState('ready');
    });
    void client.auth.getUser().then(({ data, error: authError }) => {
      if (mounted) setState(current => current === 'ready' ? current : (!authError && data.user ? 'ready' : 'expired'));
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !supabase) return;
    setError('');
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return; }
    if (password !== confirmation) { setError('As senhas não coincidem. Confira a confirmação.'); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmation('');
      await supabase.auth.signOut();
      setState('done');
    } catch {
      setError('Não foi possível alterar a senha. Solicite um novo link e tente novamente.');
    } finally { setBusy(false); }
  }

  return <div className="sales-page purchase-page">
    <header className="purchase-header"><a className="sales-logo" href="/apresentacao"><Scissors /><span>LsBarber<span className="logo-dot">.</span></span></a><a href="/cadastro?entrar=1"><ArrowLeft size={15} /> Voltar ao login</a></header>
    <main className="purchase-layout">
      <section className="purchase-main" aria-labelledby="recovery-title">
        <p className="sales-eyebrow">ACESSO À SUA BARBEARIA</p>
        <h1 id="recovery-title">{state === 'done' ? 'Senha alterada.' : 'Crie uma nova senha.'}</h1>
        <p className="purchase-lead" role="status">{state === 'checking' ? 'Validando seu link de recuperação…' : state === 'expired' ? 'Este link não está válido ou expirou. Peça um novo e-mail de recuperação.' : state === 'done' ? 'Sua senha foi atualizada. Entre novamente para acessar sua barbearia.' : 'Escolha uma senha nova para proteger sua conta.'}</p>
        {error && <div className="purchase-alert" role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
        {state === 'ready' && <form className="purchase-form" onSubmit={updatePassword}>
          <label>Nova senha<input name="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
          <label>Confirme a nova senha<input name="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
          <button type="submit" className="sales-button" disabled={busy}>{busy ? 'Atualizando…' : 'Salvar nova senha'} <ArrowRight size={17} /></button>
        </form>}
        {(state === 'expired' || state === 'done') && <a className="sales-button" href="/cadastro?entrar=1">{state === 'done' ? 'Entrar na conta' : 'Pedir novo link'} <ArrowRight size={17} /></a>}
      </section>
      <aside className="purchase-summary"><div className="purchase-summary-inner"><p className="sales-eyebrow">SUA CONTA PROTEGIDA</p><h2>Volte ao controle<br />da sua rotina.</h2><p>O link de recuperação é pessoal e tem prazo de validade. Depois de trocar a senha, faça login novamente.</p><div className="purchase-security"><LockKeyhole size={17} /><span>A LsBarber nunca solicita sua senha por mensagem.</span></div></div></aside>
    </main>
    <footer className="purchase-footer">LsBarber · Gestão para quem entende de estilo.</footer>
  </div>;
}
