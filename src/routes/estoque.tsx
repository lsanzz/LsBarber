import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader } from "@/components/ui-kit";
import { Product, formatBRL, store, useStore } from "@/lib/store";

export const Route = createFileRoute("/estoque")({ component: EstoquePage });

function EstoquePage() {
  const products = useStore((s) => s.products);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle={`${products.length} produtos cadastrados`}
        action={<Button variant="gold" onClick={() => { setEditing(null); setOpen(true); }}>+ Novo produto</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Produto</th>
                <th className="p-3">Marca</th>
                <th className="p-3">Estoque</th>
                <th className="p-3">Custo</th>
                <th className="p-3">Venda</th>
                <th className="p-3">Margem</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="border-t hover:bg-accent/20">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{p.brand}</td>
                    <td className="p-3">{p.stock} <span className="text-xs text-muted-foreground">/ mín {p.minStock}</span></td>
                    <td className="p-3">{formatBRL(p.cost)}</td>
                    <td className="p-3 font-medium">{formatBRL(p.price)}</td>
                    <td className="p-3 text-muted-foreground">{formatBRL(Math.max(0, p.price - p.cost))}</td>
                    <td className="p-3"><Badge tone={!p.active ? "muted" : low ? "danger" : "success"}>{!p.active ? "Inativo" : low ? "Baixo" : "OK"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>Editar</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <ProductForm prod={editing} onClose={() => { setOpen(false); setEditing(null); }} />}
    </div>
  );
}

function ProductForm({ prod, onClose }: { prod: Product | null; onClose: () => void }) {
  const [f, setF] = useState<Omit<Product, "id">>({
    name: prod?.name ?? "",
    brand: prod?.brand ?? "",
    category: prod?.category ?? "Cabelo",
    stock: prod?.stock ?? 0,
    cost: prod?.cost ?? 0,
    price: prod?.price ?? 0,
    minStock: prod?.minStock ?? 3,
    active: prod?.active ?? true,
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prod) store.updateProduct(prod.id, f);
    else store.addProduct(f);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={prod ? "Editar produto" : "Novo produto"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca"><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
          <Field label="Categoria"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estoque atual"><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: +e.target.value })} /></Field>
          <Field label="Estoque mínimo"><Input type="number" value={f.minStock} onChange={(e) => setF({ ...f, minStock: +e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Custo (R$)"><Input type="number" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></Field>
          <Field label="Preço de venda (R$)"><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: +e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Produto ativo
        </label>
        <div className="flex justify-between pt-2">
          {prod ? <Button type="button" variant="danger" onClick={() => { if (confirm("Excluir este produto?")) { store.removeProduct(prod.id); onClose(); } }}>Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="gold">Salvar</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
