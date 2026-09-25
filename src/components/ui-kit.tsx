import * as React from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatedValue } from './motion-kit';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-3xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`ui-card bg-card border rounded-xl shadow-soft ${className}`}>{children}</div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${accent ? "text-gold" : ""}`}><AnimatedValue value={value} /></div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "gold" | "danger";
  size?: "sm" | "md";
};
export function Button({ variant = "primary", size = "md", className = "", ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" }[size];
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-glow",
    gold: "bg-gold text-gold-foreground hover:opacity-90",
    outline: "border border-input bg-background hover:bg-accent",
    ghost: "hover:bg-accent text-foreground",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  }[variant];
  return <button className={`ui-button ${base} ${sizes} ${variants} ${className}`} {...rest} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "gold" | "success" | "warning" | "danger" | "muted" }) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    gold: "bg-gold/15 text-gold border border-gold/30",
    success: "bg-success/15 text-success border border-success/30",
    warning: "bg-warning/20 text-warning-foreground border border-warning/40",
    danger: "bg-destructive/15 text-destructive border border-destructive/30",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${tones}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const trigger = React.useRef<HTMLElement | null>(typeof document !== 'undefined' ? document.activeElement as HTMLElement : null);
  return (
    <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay" />
        <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="ui-dialog-content bg-card rounded-xl shadow-elegant">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <Dialog.Title className="font-display text-xl">{title}</Dialog.Title>
          <Dialog.Close aria-label="Fechar janela" className="ui-button h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent">✕</Dialog.Close>
        </div>
        <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-16 border-2 border-dashed rounded-xl">
      <div className="font-display text-lg">{title}</div>
      {hint && <div className="text-sm text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
