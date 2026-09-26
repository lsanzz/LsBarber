import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BarChart3, CalendarDays, Check, ChevronRight, Expand, Menu, Package, Scissors, Users, Wallet, X } from 'lucide-react';
import './sales-page.css';
import { AnimatedValue, ChoiceGroup } from './motion-kit';
import { plans, purchaseUrl } from '@/lib/plans';
import { billingEnabled } from '@/lib/billing-mode';

const modules = [
  { name: 'Visão geral', icon: BarChart3, image: 'dashboard', title: 'Abra o dia com tudo à vista.', text: 'Faturamento do dia, próximos atendimentos, comissões e alertas de estoque. O essencial da sua operação em uma única tela.', alt: 'Dashboard real da LsBarber com faturamento, próximos atendimentos e estoque baixo' },
  { name: 'Agenda', icon: CalendarDays, image: 'agenda', title: 'Cada profissional. Cada horário.', text: 'Organize os atendimentos por profissional e acompanhe cada status. O sistema verifica conflitos e respeita o horário de funcionamento.', alt: 'Agenda da LsBarber com três profissionais e horários preenchidos com clientes fictícios' },
  { name: 'Caixa / PDV', icon: Wallet, image: 'caixa', title: 'Do atendimento à comanda.', text: 'Junte serviços e produtos, aplique descontos e registre a forma de pagamento. Ao concluir a venda, o estoque dos produtos é atualizado.', alt: 'Caixa da LsBarber com uma comanda de corte, barba e pomada' },
  { name: 'Relatórios', icon: BarChart3, image: 'relatorios', title: 'Entenda os números da casa.', text: 'Consulte o faturamento, os serviços mais realizados, as comissões por profissional e as vendas por forma de pagamento.', alt: 'Relatórios da LsBarber com receitas demonstrativas, serviços e comissões' },
];
const questions = [
  ['Como funciona o plano anual?', `O valor anual equivale a 10 mensalidades e é cobrado uma vez por ano. O equivalente mensal serve apenas para comparação. Você escolhe o plano, cadastra a barbearia e revisa tudo antes de pagar.${billingEnabled ? ' O pagamento da assinatura é feito na Stripe.' : ' Nesta demonstração, nenhuma cobrança é feita.'}`],
  ['Para quem é a LsBarber?', 'Para quem administra uma barbearia ou salão e precisa reunir agenda, clientes, equipe, vendas e estoque na mesma rotina. Você cadastra os profissionais, serviços e horários do seu negócio.'],
  ['Cada profissional recebe um login?', 'Não. Você cadastra os profissionais para organizar agenda, serviços e comissões, mas a assinatura oferece uma conta de acesso para o responsável pela barbearia. Logins individuais para a equipe ainda não estão disponíveis.'],
  ['As telas mostram o sistema de verdade?', 'Sim. As imagens foram capturadas na própria LsBarber. Os nomes, atendimentos e valores são fictícios e foram usados apenas para demonstrar as telas. Ao abrir uma instalação nova, os cadastros começam vazios.'],
  ['Posso usar no celular?', 'Sim. A interface se adapta a celulares, tablets e computadores. Na agenda, você pode deslizar a grade horizontalmente para consultar os profissionais.'],
  ['Como meus dados são salvos?', billingEnabled ? 'Os dados da sua barbearia são sincronizados com o Supabase e vinculados à sua conta. O painel exige login e assinatura ativa. Você pode baixar uma cópia dos seus dados em JSON nas configurações.' : 'Nesta demonstração, os dados ficam neste navegador. Não use informações reais no modo local.'],
  ['O sistema recebe pagamentos?', 'O caixa registra vendas em dinheiro, Pix, débito ou crédito para seu controle. O recebimento é realizado fora da LsBarber: não há processamento de cartão ou geração de cobrança Pix integrada.'],
];

function ProductImage({ module, priority = false, full = false }: { module: (typeof modules)[number]; priority?: boolean; full?: boolean }) {
  return <img src={`/images/${module.image}-1440.webp`}
    srcSet={full ? undefined : [480, 800, 1200, 1440].map(width => `/images/${module.image}-${width}.webp ${width}w`).join(', ')}
    sizes={full ? undefined : '(max-width: 700px) calc(100vw - 40px), (max-width: 1280px) calc(100vw - 80px), 1200px'}
    alt={module.alt} width={1440} height={960} decoding="async"
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />;
}

export function SalesPage() {
  const [annual, setAnnual] = useState(false);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<(typeof modules)[number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const selected = modules[active];
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (preference.matches) continue;
        entry.target.getAnimations().forEach(animation => animation.cancel());
        const siblings = Array.from(entry.target.parentElement?.children ?? []);
        const stagger = entry.target.matches('.sales-resource, .sales-workflow li, .sales-faq details');
        const delay = stagger ? siblings.indexOf(entry.target) * 90 : 0;
        const sideways = entry.target.matches('.sales-workflow li, .sales-faq details');
        const animation = entry.target.animate([
          { opacity: 0, transform: sideways ? 'translateX(32px)' : 'translateY(42px) scale(.97)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 700, delay, fill: 'backwards', easing: 'cubic-bezier(.16, 1, .3, 1)' });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
        animation.oncancel = () => animations.delete(animation);
      }
    }, { threshold: 0.12 });
    pageRef.current?.querySelectorAll('.sales-section-heading, .sales-resource, .sales-showcase-heading, .sales-module-buttons, .sales-workflow > div, .sales-workflow li, .sales-faq > div:first-child, .sales-faq details, .sales-final .sales-container').forEach(element => observer.observe(element));
    const cancel = () => { if (preference.matches) animations.forEach(animation => animation.cancel()); };
    preference.addEventListener('change', cancel);
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); preference.removeEventListener('change', cancel); };
  }, []);
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const previews = Array.from(root.querySelectorAll<HTMLElement>('.sales-hero-preview, .sales-showcase-image'));
    const progress = root.querySelector<HTMLElement>('.sales-scroll-progress');
    let frame = 0;
    const update = () => {
      frame = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      progress?.style.setProperty('transform', `scaleX(${maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0})`);
      const positions = previews.map(element => element.getBoundingClientRect());
      previews.forEach((element, index) => {
        const rect = positions[index];
        const distance = Math.min(1, Math.max(-1, (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight));
        element.style.setProperty('translate', preference.matches ? 'none' : `0 ${distance * 18}px`);
        element.style.setProperty('scale', preference.matches ? 'none' : String(1 - Math.abs(distance) * .025));
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', schedule);
      resize.disconnect();
    };
  }, []);
  useEffect(() => {
    const previous = document.title;
    document.title = 'LsBarber — Sua barbearia bem administrada';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    if (expanded) {
      dialog.current?.showModal();
      const old = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = old; };
    }
    dialog.current?.close();
  }, [expanded]);
  return (
    <div className="sales-page" ref={pageRef}>
      <div className="sales-scroll-progress" aria-hidden="true" />
      <a className="sales-skip" href="#conteudo">Pular para o conteúdo</a>
      <header className="sales-header">
        <div className="sales-container sales-nav">
          <a href="/apresentacao" className="sales-logo" aria-label="LsBarber, início"><Scissors aria-hidden="true" /><span>LsBarber<span className="logo-dot">.</span></span></a>
          <nav aria-label="Navegação principal" className={menuOpen ? 'sales-links is-open' : 'sales-links'}>
            <a href="#recursos" onClick={() => setMenuOpen(false)}>Recursos</a>
            <a href="#sistema" onClick={() => setMenuOpen(false)}>O sistema</a>
            <a href="#planos" onClick={() => setMenuOpen(false)}>Planos</a>
            <a href="#duvidas" onClick={() => setMenuOpen(false)}>Dúvidas</a>
          </nav>
          <a href="/" className="sales-login">Acessar sistema <ArrowRight size={16} /></a>
          <button className="sales-menu" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>
      <main id="conteudo">
        <section className="sales-hero">
          <div className="sales-container">
            <div className="sales-hero-top">
              <div>
                <p className="sales-eyebrow"><span /> GESTÃO FEITA PARA BARBEARIAS</p>
                <h1>Seu talento na cadeira.<br />Sua gestão na LsBarber.</h1>
              </div>
              <div className="sales-hero-copy">
                <p>Agenda organizada, caixa em dia e uma visão clara do negócio. Cuide de cada detalhe da sua barbearia em um só lugar.</p>
                <a href="#sistema" className="sales-button">Conhecer o sistema <ArrowDown size={18} /></a>
                <span className="sales-micro">Veja as telas reais. Conheça cada recurso.</span>
              </div>
            </div>
            <div className="sales-hero-preview">
              <div className="sales-window-bar"><span className="sales-window-dots"><i /><i /><i /></span><span>LsBarber / Visão geral</span><span className="sales-window-label">SEU NEGÓCIO, À VISTA</span></div>
              <button className="sales-image-button" onClick={() => setExpanded(modules[0])} aria-label="Ampliar imagem do dashboard">
                <ProductImage module={modules[0]} priority />
                <span className="sales-zoom"><Expand size={16} /> Ampliar tela</span>
              </button>
            </div>
            <div className="sales-preview-foot"><span>INTERFACE REAL. DADOS ILUSTRATIVOS.</span><span>Menos improviso. Mais controle.</span></div>
          </div>
        </section>

        <section id="recursos" className="sales-resources sales-container">
          <div className="sales-section-heading"><p className="sales-eyebrow">A ROTINA INTEIRA, CONECTADA</p><h2>Uma boa barbearia merece<br />uma gestão à altura.</h2><p>Do primeiro horário ao último atendimento, cada parte da operação tem seu lugar.</p></div>
          <div className="sales-resource-grid">
            {[
              { icon: CalendarDays, number: '01', title: 'Organize a agenda', text: 'Visualize horários por profissional e acompanhe o atendimento, do agendamento à finalização.' },
              { icon: Wallet, number: '02', title: 'Controle cada venda', text: 'Monte comandas de serviços e produtos, registre descontos e acompanhe as formas de pagamento.' },
              { icon: Users, number: '03', title: 'Conheça seus clientes', text: 'Mantenha contatos, observações e histórico de atendimentos reunidos no painel da barbearia.' },
              { icon: Package, number: '04', title: 'Cuide do estoque', text: 'Cadastre produtos, defina um estoque mínimo e veja quando está na hora de repor.' },
            ].map(({ icon: Icon, number, title, text }) => <article className="sales-resource" key={number}><div><Icon size={25} strokeWidth={1.5} /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section id="sistema" className="sales-showcase">
          <div className="sales-container">
            <div className="sales-showcase-heading"><div><p className="sales-eyebrow">POR DENTRO DA LSBARBER</p><h2>Veja como tudo se encaixa.</h2></div><p>Explore as telas do sistema.<br />Sem precisar imaginar como funciona.</p></div>
            <ChoiceGroup className="sales-module-buttons" label="Escolha uma tela do sistema" value={String(active)} onChange={value => setActive(Number(value))} options={modules.map((module, i) => ({ id: String(i), content: <><module.icon size={17} />{module.name}</> }))} />
            <div className="sales-module-copy" aria-live="polite"><h3 key={selected.image}>{selected.title}</h3><p>{selected.text}</p></div>
            <button className="sales-image-button sales-showcase-image" onClick={() => setExpanded(selected)} aria-label={`Ampliar tela de ${selected.name}`}><ProductImage key={selected.image} module={selected} /><span className="sales-zoom"><Expand size={16} /> Ampliar tela</span></button>
            <p className="sales-image-caption">Capturas do sistema com dados fictícios, usados exclusivamente para demonstração.</p>
          </div>
        </section>

        <section className="sales-workflow sales-container">
          <div><p className="sales-eyebrow">DO SEU JEITO, DESDE O INÍCIO</p><h2>O seu negócio.<br />As suas regras.</h2><p>Configure a LsBarber para a rotina da sua barbearia. Você define os serviços, os profissionais e os horários.</p><a href="/" className="sales-text-link">Abrir meu painel <ArrowRight size={18} /></a></div>
          <ol>
            <li><span>01</span><div><h3>Prepare a casa</h3><p>Cadastre sua equipe, preços, duração dos serviços e expediente.</p></div><Check size={20} /></li>
            <li><span>02</span><div><h3>Organize os atendimentos</h3><p>Adicione clientes e agende com os profissionais disponíveis.</p></div><Check size={20} /></li>
            <li><span>03</span><div><h3>Acompanhe o resultado</h3><p>Registre as vendas no caixa e consulte receitas e comissões.</p></div><Check size={20} /></li>
          </ol>
        </section>

        <section id="planos" className="sales-pricing sales-container">
          <div className="sales-section-heading"><p className="sales-eyebrow">UM PLANO PARA CADA TAMANHO DE EQUIPE</p><h2>Todos os recursos.<br />O plano que cabe na sua rotina.</h2><p>Agenda, clientes, caixa, estoque e relatórios em todos os planos. Escolha pelo número de profissionais.</p></div>
          <ChoiceGroup className="sales-billing" label="Periodicidade do plano" value={annual ? 'annual' : 'monthly'} onChange={value => setAnnual(value === 'annual')} options={[{ id: 'monthly', content: 'Mensal' }, { id: 'annual', content: <>Anual <span>2 meses de economia</span></> }]} />
          <div className="sales-plan-grid" aria-live="polite">
            {plans.map(plan => {
              const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              return <article key={plan.name} className={`sales-plan${plan.name === 'Plus' ? ' sales-plan-featured' : ''}`}>
                <div className="sales-plan-label"><h3>{plan.name}</h3>{plan.name === 'Plus' && <span>PARA SUA EQUIPE</span>}</div><p>{plan.intro}</p>
                <div className="sales-plan-price"><AnimatedValue value={money(annual ? plan.cents * 10 : plan.cents)} /><small>/{annual ? 'ano' : 'mês'}</small></div>
                <p className="sales-plan-billing">{annual ? `${money(plan.cents * 10 / 12)}/mês equivalente · pagamento anual` : 'Pagamento mensal'}</p>
                <p className="sales-plan-saving">{annual ? `Economize ${money(plan.cents * 2)} por ano` : `Ou ${money(plan.cents * 10)} no plano anual`}</p>
                <ul>{[`${plan.people === 1 ? '1 profissional' : `Até ${plan.people} profissionais`}`, '1 barbearia', 'Agenda e cadastro de clientes', 'Serviços e comissões', 'Caixa e controle de estoque', 'Dashboard e relatórios'].map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
                <a href={purchaseUrl('/cadastro', plan.id, annual ? 'annual' : 'monthly')} className="sales-button">Escolher {plan.name} <ArrowRight size={16} /></a>
              </article>;
            })}
          </div>
          <p className="sales-pricing-note">{billingEnabled ? 'Cadastre sua barbearia e revise o plano antes de continuar para o pagamento na Stripe.' : 'Experimente o cadastro e o checkout demonstrativo. Nenhuma cobrança será realizada.'}</p>
          <div className="sales-compare"><table><caption>Compare os planos</caption><thead><tr><th scope="col">O que está incluído</th><th scope="col">Básico</th><th scope="col">Plus</th><th scope="col">Pro</th></tr></thead><tbody>
            <tr><th scope="row">Profissionais</th><td>1</td><td>Até 3</td><td>Até 8</td></tr>
            {['Agenda e clientes', 'Serviços e comissões', 'Caixa / PDV', 'Produtos e estoque', 'Dashboard e relatórios'].map(feature => <tr key={feature}><th scope="row">{feature}</th>{['basico', 'plus', 'pro'].map(plan => <td key={plan}><Check size={17} aria-label="Incluído" /></td>)}</tr>)}
          </tbody></table></div>
        </section>

        <section id="duvidas" className="sales-faq sales-container"><div><p className="sales-eyebrow">ANTES DE COMEÇAR</p><h2>Vamos tirar<br />suas dúvidas.</h2></div><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronRight size={18} /></summary><p>{answer}</p></details>)}</div></section>

        <section className="sales-final"><div className="sales-container"><Scissors size={34} strokeWidth={1.4} /><p className="sales-eyebrow">A PRÓXIMA FASE DA SUA BARBEARIA</p><h2>Capriche no corte.<br />Tenha o negócio nas mãos.</h2><p>Agenda, clientes, caixa e estoque. Comece a organizar sua operação com a LsBarber.</p><a href="/" className="sales-button">Acessar a LsBarber <ArrowRight size={18} /></a><span className="sales-micro">Seu primeiro passo: cadastrar os profissionais e serviços.</span></div></section>
      </main>
      <footer className="sales-footer sales-container"><a className="sales-logo" href="/apresentacao"><Scissors aria-hidden="true" /><span>LsBarber<span className="logo-dot">.</span></span></a><span>Gestão para quem entende de estilo.</span><a href="#conteudo">Voltar ao topo ↑</a></footer>
      <dialog ref={dialog} className="sales-dialog" aria-label={expanded ? `Tela ampliada: ${expanded.name}` : 'Tela ampliada'} onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) setExpanded(null); }}>
        <button className="sales-dialog-close" onClick={() => setExpanded(null)} aria-label="Fechar imagem ampliada"><X /></button>
        {expanded && <><ProductImage module={expanded} full /><p>{expanded.name} · Dados ilustrativos</p></>}
      </dialog>
    </div>
  );
}
