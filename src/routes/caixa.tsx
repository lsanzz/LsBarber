import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui-kit";
import { SaleItem, formatBRL, store, useStore } from "@/lib/store";
import { Minus, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/caixa")({ component: CaixaPage });

function CaixaPage() {
  const state = useStore((s) => s);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<"dinheiro" | "pix" | "debito" | "credito">("pix");
  const [proId, setProId] = useState(state.professionals.find((p) => p.active)?.id ?? state.professionals[0]?.id ?? "");

  const activePros = state.professionals.filter((p) => p.active);
  const activeServices = state.services.filter((s) => s.active);
  const activeProducts = state.products.filter((p) => p.active);

  const productQtyInCart = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (item.kind === "product") map.set(item.refId, (map.get(item.refId) ?? 0) + item.quantity);
    }
    return map;
  }, [items]);

  const addService = (id: string) => {
    const s = state.services.find((x) => x.id === id && x.active);
    if (!s || !proId) return;
    setItems((it) => [...it, { kind: "service", refId: s.id, name: s.name, price: s.price, quantity: 1, professionalId: proId, commissionPct: s.commission }]);
  };

  const addProduct = (id: string) => {
    const p = state.products.find((x) => x.id === id && x.active);
    if (!p || !proId) return;
    const already = productQtyInCart.get(p.id) ?? 0;
    if (p.stock <= already) {
      alert(`Estoque insuficiente para ${p.name}.`);
      return;
    }
    setItems((current) => {
      const index = current.findIndex((it) => it.kind === "product" && it.refId === p.id && it.professionalId === proId);
      if (index >= 0) {
        return current.map((it, i) => i === index ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...current, { kind: "product", refId: p.id, name: p.name, price: p.price, quantity: 1, professionalId: proId, commissionPct: 10 }];
    });
  };

  const remove = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const changeQty = (i: number, next: number) => {
    const qty = Math.max(1, Math.floor(next || 1));
    const item = items[i];
    if (!item) return;
    if (item.kind === "product") {
      const product = state.products.find((p) => p.id === item.refId);
      const otherQty = items.reduce((sum, cur, idx) => idx !== i && cur.kind === "product" && cur.refId === item.refId ? sum + cur.quantity : sum, 0);
      if (product && otherQty + qty > product.stock) {
        alert(`Estoque disponível: ${product.stock}.`);
        return;
      }
    }
    setItems((current) => current.map((it, idx) => idx === i ? { ...it, quantity: qty } : it));
  };

  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = Math.max(0, subtotal - safeDiscount);

  const finalize = () => {
    if (items.length === 0) return;
    try {
      store.addSale({ clientId: clientId || undefined, items, discount: safeDiscount, total, paymentMethod: payment });
      setItems([]);
      setDiscount(0);
      setClientId("");
      alert("Venda finalizada com sucesso!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível finalizar a venda.");
    }
  };

  return (
    <div>
      <PageHeader title="Caixa / PDV" subtitle="Comanda rápida para serviços e produtos" />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-display text-lg mb-4">Itens da comanda</h2>
          {items.length === 0 ? (
            <EmptyState title="Comanda vazia" hint="Adicione serviços ou produtos ao lado" />
          ) : (
            <ul className="divide-y">
              {items.map((it, i) => (
                <li key={`${it.kind}-${it.refId}-${i}`} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.kind === "service" ? "Serviço" : "Produto"} · {state.professionals.find((p) => p.id === it.professionalId)?.name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => changeQty(i, it.quantity - 1)} className="h-8 w-8 rounded border flex items-center justify-center hover:bg-accent">
                      <Minus className="h-3 w-3" />
                    </button>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => changeQty(i, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <button type="button" onClick={() => changeQty(i, it.quantity + 1)} className="h-8 w-8 rounded border flex items-center justify-center hover:bg-accent">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="font-medium w-24 text-right">{formatBRL(it.price * it.quantity)}</div>
                  <button onClick={() => remove(i)} className="text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t mt-4 pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
            <div className="flex justify-between items-center gap-3">
              <span>Desconto</span>
              <Input type="number" min={0} max={subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-8 w-28 text-right" />
            </div>
            {discount > subtotal && <div className="text-xs text-warning-foreground text-right">Desconto limitado ao subtotal.</div>}
            <div className="flex justify-between font-display text-2xl pt-2"><span>Total</span><span className="text-gold">{formatBRL(total)}</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <Field label="Forma de pagamento">
              <Select value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Cartão débito</option>
                <option value="credito">Cartão crédito</option>
              </Select>
            </Field>
            <Field label="Cliente (opcional)">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Sem cliente</option>
                {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>
          <Button variant="gold" className="w-full mt-4 h-12" onClick={finalize} disabled={items.length === 0}>
            Finalizar venda · {formatBRL(total)}
          </Button>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg mb-3">Profissional</h3>
            <Select value={proId} onChange={(e) => setProId(e.target.value)} disabled={activePros.length === 0}>
              {activePros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-lg mb-3">+ Adicionar serviço</h3>
            <Select onChange={(e) => { if (e.target.value) { addService(e.target.value); e.target.value = ""; } }} disabled={!proId}>
              <option value="">Escolha um serviço...</option>
              {activeServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatBRL(s.price)}</option>)}
            </Select>
          </Card>
          <Card className="p-5">
            <h3 className="font-display text-lg mb-3">+ Adicionar produto</h3>
            <Select onChange={(e) => { if (e.target.value) { addProduct(e.target.value); e.target.value = ""; } }} disabled={!proId}>
              <option value="">Escolha um produto...</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock <= (productQtyInCart.get(p.id) ?? 0)}>
                  {p.name} · {formatBRL(p.price)} · {p.stock} un
                </option>
              ))}
            </Select>
          </Card>
        </div>
      </div>
    </div>
  );
}
