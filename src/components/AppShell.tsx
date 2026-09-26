import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, CalendarDays, Users, Scissors, UserCog,
  Wallet, Package, BarChart3, Settings, Sparkles, Menu, X, CreditCard, LogOut,
} from "lucide-react";
import { useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { exportWorkspaceData, flushPendingWorkspace, retrySupabaseSave, useStore, useSupabaseSyncStatus } from "@/lib/store";
import { billingEnabled } from '@/lib/purchase';
import { supabase } from '@/lib/supabase';

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/profissionais", label: "Profissionais", icon: UserCog },
  { to: "/servicos", label: "Serviços", icon: Scissors },
  { to: "/caixa", label: "Caixa / PDV", icon: Wallet },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/assinatura", label: "Assinatura", icon: CreditCard },
] as const;

export function AppShell() {
  const router = useRouterState();
  const path = router.location.pathname;
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const salonName = useStore((s) => s.settings.name);
  const sync = useSupabaseSyncStatus();
  const reduceMotion = useReducedMotion();

  async function signOutSafely() {
    if (signingOut || !supabase) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      if (!await flushPendingWorkspace()) {
        setSignOutError('Ainda há alterações sem confirmação de gravação. Não saímos da conta. Tente salvar ou baixe uma cópia dos dados antes de sair.');
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) setSignOutError('Não foi possível sair da conta. Tente novamente.');
    } catch {
      setSignOutError('Não foi possível confirmar a gravação dos dados. A conta continua aberta; tente novamente.');
    } finally {
      setSigningOut(false);
    }
  }

  const syncLabel =
    sync.status === "conectado"
      ? "Supabase conectado"
      : sync.status === "salvando"
        ? "Salvando..."
        : sync.status === "erro"
          ? "Erro no Supabase"
          : sync.status === "conectando"
            ? "Conectando..."
            : "Modo local";

  return (
    <div className="app-shell min-h-screen bg-background flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-sidebar text-sidebar-foreground flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gold flex items-center justify-center shadow-soft">
              <Sparkles className="h-5 w-5 text-gold-foreground" />
            </div>
            <div>
              <div className="font-display text-lg leading-none">LsBarber</div>
              <div className="text-xs text-sidebar-foreground/60 mt-1">Gestão da barbearia</div>
            </div>
          </div>
        </div>
        <LayoutGroup id="app-sidebar"><nav aria-label="Menu do sistema" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.filter(item => billingEnabled || item.to !== '/assinatura').map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`app-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                {active && <motion.span className="app-nav-indicator" layoutId="active-nav" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 29 }} />}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold" />}
              </Link>
            );
          })}
        </nav></LayoutGroup>
        <div className="px-6 py-4 border-t border-sidebar-border text-xs text-sidebar-foreground/60">
          <span>Sistema LsBarber</span>
          {billingEnabled && <><button type="button" onClick={() => void signOutSafely()} disabled={signingOut} className="mt-3 flex items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-60"><LogOut size={14} /> {signingOut ? 'Conferindo gravação…' : 'Sair da conta'}</button>{signOutError && <p role="alert" className="mt-2 text-xs leading-5 text-amber-200">{signOutError}</p>}</>}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card/95 backdrop-blur px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div>
            <div className="font-display text-xl leading-none">{salonName}</div>
            <div className="text-xs text-muted-foreground hidden sm:block mt-1">Painel administrativo</div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="text-sm text-muted-foreground capitalize">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <div
              className={`text-[11px] rounded-full px-2 py-0.5 border ${
                sync.status === "conectado" || sync.status === "salvando"
                  ? "border-emerald-500/30 text-emerald-700 bg-emerald-50"
                  : sync.status === "erro"
                    ? "border-destructive/30 text-destructive bg-destructive/10"
                    : "border-border text-muted-foreground bg-muted"
              }`}
              title={sync.message}
            >
              {syncLabel}
            </div>
          </div>
        </header>
        {sync.status === 'erro' && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert"><span>{sync.message}</span><div className="flex gap-3"><button type="button" onClick={exportWorkspaceData} className="underline underline-offset-2">Baixar cópia</button><button type="button" onClick={sync.conflict ? () => window.location.reload() : retrySupabaseSave} className="shrink-0 underline underline-offset-2">{sync.conflict ? 'Recarregar' : 'Tentar salvar'}</button></div></div>}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <motion.div key={path} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .24, ease: 'easeOut' }}><Outlet /></motion.div>
        </main>
      </div>
    </div>
  );
}
