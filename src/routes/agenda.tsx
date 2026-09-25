import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from "@/components/ui-kit";
import {
  Appointment,
  AppointmentStatus,
  canProfessionalPerformService,
  formatBRL,
  formatTime,
  getAppointmentEnd,
  store,
  toDateInputValue,
  useStore,
  validateAppointment,
} from "@/lib/store";

export const Route = createFileRoute("/agenda")({ component: AgendaPage });

const STATUS_TONE: Record<AppointmentStatus, "default" | "gold" | "success" | "warning" | "danger" | "muted"> = {
  agendado: "default",
  confirmado: "gold",
  aguardando: "warning",
  em_atendimento: "warning",
  finalizado: "success",
  faltou: "danger",
  cancelado: "muted",
};
const STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  aguardando: "Aguardando",
  em_atendimento: "Em atendimento",
  finalizado: "Finalizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

function AgendaPage() {
  const state = useStore((s) => s);
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [filterPro, setFilterPro] = useState<string>("");
  const [filterGender, setFilterGender] = useState<string>("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const selectedDate = new Date(`${date}T12:00:00`);
  const isWorkDay = state.settings.workDays.includes(selectedDate.getDay());

  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = state.settings.openHour; h < state.settings.closeHour; h++) arr.push(h);
    return arr;
  }, [state.settings.openHour, state.settings.closeHour]);

  const pros = state.professionals.filter((p) => p.active && (!filterPro || p.id === filterPro));

  const dayApps = state.appointments
    .filter((a) => {
      if (toDateInputValue(new Date(a.start)) !== date) return false;
      if (filterPro && a.professionalId !== filterPro) return false;
      if (filterGender) {
        const s = state.services.find((x) => x.id === a.serviceId);
        if (s?.gender !== filterGender) return false;
      }
      return true;
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  const activeCount = dayApps.filter((a) => a.status !== "cancelado" && a.status !== "faltou").length;

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={`${activeCount} atendimento${activeCount === 1 ? "" : "s"} no dia selecionado`}
        action={<Button variant="gold" onClick={() => setOpenNew(true)}>+ Novo agendamento</Button>}
      />

      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-end">
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Profissional">
          <Select value={filterPro} onChange={(e) => setFilterPro(e.target.value)}>
            <option value="">Todos</option>
            {state.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Público">
          <Select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
            <option value="">Todos</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="unissex">Unissex</option>
          </Select>
        </Field>
        {!isWorkDay && (
          <div className="rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm">
            O salão não atende neste dia.
          </div>
        )}
      </Card>

      {pros.length === 0 ? (
        <EmptyState title="Nenhum profissional disponível" hint="Cadastre ou ative profissionais para montar a agenda." />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid" style={{ gridTemplateColumns: `86px repeat(${pros.length}, minmax(180px, 1fr))` }}>
              <div className="p-3 border-b border-r bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">Hora</div>
              {pros.map((p) => (
                <div key={p.id} className="p-3 border-b text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </div>
              ))}

              {hours.map((h) => (
                <div key={h} className="contents">
                  <div className="p-2 border-b border-r text-xs text-muted-foreground bg-muted/20">{String(h).padStart(2, "0")}:00</div>
                  {pros.map((p) => {
                    const slots = dayApps.filter((a) => {
                      const d = new Date(a.start);
                      return a.professionalId === p.id && d.getHours() === h;
                    });
                    return (
                      <div key={p.id + h} className="border-b p-1 min-h-[72px] hover:bg-accent/30 transition-colors space-y-1">
                        {slots.map((slot) => {
                          const client = state.clients.find((c) => c.id === slot.clientId);
                          const service = state.services.find((s) => s.id === slot.serviceId);
                          const end = getAppointmentEnd(state, slot);
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setEditing(slot)}
                              className="w-full text-left p-2 rounded-md text-xs leading-tight"
                              style={{ background: p.color + "22", borderLeft: `3px solid ${p.color}` }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{client?.name ?? "Cliente removido"}</span>
                                <span className="text-muted-foreground shrink-0">{formatTime(slot.start)}</span>
                              </div>
                              <div className="text-muted-foreground truncate">
                                {service?.name ?? "Serviço removido"} · até {formatTime(end)}
                              </div>
                              <div className="mt-1"><Badge tone={STATUS_TONE[slot.status]}>{STATUS_LABEL[slot.status]}</Badge></div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {openNew && <NewAppointmentModal date={date} onClose={() => setOpenNew(false)} />}
      {editing && <EditAppointmentModal appt={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NewAppointmentModal({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useStore((s) => s);
  const activeServices = state.services.filter((s) => s.active);
  const activeClients = state.clients;
  const [clientId, setClientId] = useState(activeClients[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState("");
  const [time, setTime] = useState(`${String(state.settings.openHour).padStart(2, "0")}:00`);

  const selectedService = state.services.find((s) => s.id === serviceId);
  const compatiblePros = selectedService
    ? state.professionals.filter((p) => canProfessionalPerformService(p, selectedService))
    : [];

  useEffect(() => {
    if (!compatiblePros.some((p) => p.id === professionalId)) {
      setProfessionalId(compatiblePros[0]?.id ?? "");
    }
  }, [compatiblePros, professionalId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !serviceId || !professionalId) return;
    const start = new Date(`${date}T${time}:00`).toISOString();
    const error = validateAppointment(state, { clientId, serviceId, professionalId, start });
    if (error) {
      alert(error);
      return;
    }
    try {
      store.addAppointment({ clientId, serviceId, professionalId, start });
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível criar o agendamento.");
    }
  };

  const disabled = activeClients.length === 0 || activeServices.length === 0 || compatiblePros.length === 0;

  return (
    <Modal open onClose={onClose} title="Novo agendamento">
      <form onSubmit={submit} className="space-y-4">
        {disabled && (
          <div className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm">
            Cadastre ao menos um cliente, serviço ativo e profissional compatível antes de agendar.
          </div>
        )}
        <Field label="Cliente">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required disabled={activeClients.length === 0}>
            {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Serviço">
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required disabled={activeServices.length === 0}>
            {activeServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration}min · {formatBRL(s.price)}</option>)}
          </Select>
        </Field>
        <Field label="Profissional">
          <Select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required disabled={compatiblePros.length === 0}>
            {compatiblePros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><Input type="date" value={date} disabled /></Field>
          <Field label="Hora"><Input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="gold" disabled={disabled}>Agendar</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditAppointmentModal({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const state = useStore((s) => s);
  const c = state.clients.find((x) => x.id === appt.clientId);
  const s = state.services.find((x) => x.id === appt.serviceId);
  const p = state.professionals.find((x) => x.id === appt.professionalId);
  const end = getAppointmentEnd(state, appt);

  const update = (status: AppointmentStatus) => {
    store.updateAppointment(appt.id, { status });
  };

  return (
    <Modal open onClose={onClose} title="Detalhes do atendimento">
      <div className="space-y-3 text-sm">
        <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{c?.name ?? "—"}</span></div>
        <div><span className="text-muted-foreground">Serviço:</span> {s?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Profissional:</span> {p?.name ?? "—"}</div>
        <div><span className="text-muted-foreground">Horário:</span> {formatTime(appt.start)} até {formatTime(end)}</div>
        <div><span className="text-muted-foreground">Valor:</span> {s ? formatBRL(s.price) : "—"}</div>
        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-2">Status</div>
          <div className="flex flex-wrap gap-2">
            {(["agendado", "confirmado", "aguardando", "em_atendimento", "finalizado", "faltou", "cancelado"] as AppointmentStatus[]).map((st) => (
              <Button key={st} size="sm" variant={appt.status === st ? "primary" : "outline"} onClick={() => update(st)}>
                {STATUS_LABEL[st]}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex justify-between pt-4 border-t">
          <Button variant="danger" size="sm" onClick={() => { if (confirm("Excluir este agendamento?")) { store.removeAppointment(appt.id); onClose(); } }}>Excluir</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}
