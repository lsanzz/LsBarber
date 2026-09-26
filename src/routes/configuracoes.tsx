import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui-kit";
import { exportWorkspaceData, store, useStore, useSupabaseSyncStatus } from "@/lib/store";
import { billingEnabled } from '@/lib/purchase';

export const Route = createFileRoute("/configuracoes")({ component: SettingsPage });

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const sync = useSupabaseSyncStatus();
  const [f, setF] = useState(settings);

  const toggleDay = (d: number) => {
    const wd = f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d];
    setF({ ...f, workDays: wd.sort() });
  };

  const save = () => {
    store.updateSettings(f);
    if (!billingEnabled) alert("Configurações salvas neste navegador.");
  };

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Dados da LsBarber" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-display text-lg">Identificação</h2>
          <Field label="Nome do salão"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="WhatsApp"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
          </div>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Endereço"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-display text-lg">Funcionamento</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Abre às"><Input type="number" min={0} max={23} value={f.openHour} onChange={(e) => setF({ ...f, openHour: +e.target.value })} /></Field>
            <Field label="Fecha às"><Input type="number" min={0} max={23} value={f.closeHour} onChange={(e) => setF({ ...f, closeHour: +e.target.value })} /></Field>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Dias de atendimento</div>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-10 w-12 rounded-lg border text-sm font-medium ${
                    f.workDays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={exportWorkspaceData}>Baixar cópia dos dados</Button>
        {!billingEnabled && <Button variant="outline" onClick={() => { if (confirm("Restaurar os dados iniciais? Essa ação substitui os dados salvos neste navegador.")) store.reset(); }}>
          Restaurar dados iniciais
        </Button>}
        <Button variant="gold" onClick={save}>Salvar configurações</Button>
      </div>
      {billingEnabled && <p className="mt-3 text-right text-sm text-muted-foreground" role="status">
        {sync.status === 'salvando' ? 'Salvando alterações no Supabase…'
          : sync.status === 'conectado' ? 'Dados sincronizados com o Supabase.'
            : sync.status === 'erro' ? 'Não foi possível salvar. Veja o aviso no topo da página.'
              : 'Verificando a conexão…'}
      </p>}
    </div>
  );
}
