import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select } from "@/components/ui-kit";
import { Gender, Professional, store, useStore } from "@/lib/store";

export const Route = createFileRoute("/profissionais")({ component: ProfPage });

const COLORS = ["#b8860b", "#c97b63", "#6b8e9e", "#7a6f9b", "#5a8a5c", "#a06262"];

function ProfPage() {
  const professionals = useStore((s) => s.professionals);
  const list = [...professionals].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const [editing, setEditing] = useState<Professional | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Profissionais"
        subtitle={`${list.filter((p) => p.active).length} ativos`}
        action={<Button variant="gold" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo profissional</Button>}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center font-display text-lg" style={{ background: p.color + "33", color: p.color }}>
                {p.name[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.specialty}</div>
              </div>
              <Badge tone={p.active ? "success" : "muted"}>{p.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <div>📱 {p.phone || "—"}</div>
              <div>✂️ Atende: {p.attendance}</div>
              <div>💰 Comissão: {p.commission}%</div>
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
          </Card>
        ))}
      </div>
      {open && <ProForm pro={editing} onClose={() => { setOpen(false); setEditing(null); }} />}
    </div>
  );
}

function ProForm({ pro, onClose }: { pro: Professional | null; onClose: () => void }) {
  const [name, setName] = useState(pro?.name ?? "");
  const [phone, setPhone] = useState(pro?.phone ?? "");
  const [specialty, setSpecialty] = useState(pro?.specialty ?? "");
  const [attendance, setAttendance] = useState<Gender>(pro?.attendance ?? "unissex");
  const [commission, setCommission] = useState(pro?.commission ?? 40);
  const [color, setColor] = useState(pro?.color ?? COLORS[0]);
  const [active, setActive] = useState(pro?.active ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, phone, specialty, attendance, commission, color, active };
    if (pro) store.updateProfessional(pro.id, data);
    else store.addProfessional(data);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={pro ? "Editar profissional" : "Novo profissional"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Especialidade"><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de atendimento">
            <Select value={attendance} onChange={(e) => setAttendance(e.target.value as Gender)}>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="unissex">Ambos</option>
            </Select>
          </Field>
          <Field label="Comissão padrão (%)"><Input type="number" value={commission} onChange={(e) => setCommission(+e.target.value)} /></Field>
        </div>
        <Field label="Cor na agenda">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
        </label>
        <div className="flex justify-between pt-2">
          {pro ? <Button type="button" variant="danger" onClick={() => { if (confirm("Excluir este profissional?")) { store.removeProfessional(pro.id); onClose(); } }}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="gold">Salvar</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
