// Local-first store for Sistema LsBarber.
// A estrutura foi mantida simples para a entrega inicial e pode ser migrada para backend/banco depois.

import { useSyncExternalStore } from "react";

import { isSupabaseConfigured, supabase } from "./supabase";

export type Gender = "masculino" | "feminino" | "unissex";
export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "aguardando"
  | "em_atendimento"
  | "finalizado"
  | "faltou"
  | "cancelado";

export interface Professional {
  id: string;
  name: string;
  phone?: string;
  specialty: string;
  attendance: Gender;
  commission: number; // %
  color: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  gender: Gender;
  duration: number; // minutes
  price: number;
  commission: number; // %
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  gender?: Gender;
  notes?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  start: string; // ISO
  status: AppointmentStatus;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string;
  stock: number;
  cost: number;
  price: number;
  minStock: number;
  active: boolean;
}

export interface SaleItem {
  kind: "service" | "product";
  refId: string;
  name: string;
  price: number;
  quantity: number;
  professionalId?: string;
  commissionPct: number;
}

export interface Sale {
  id: string;
  clientId?: string;
  items: SaleItem[];
  discount: number;
  total: number;
  paymentMethod: "dinheiro" | "pix" | "debito" | "credito";
  createdAt: string;
}

export interface SalonSettings {
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  openHour: number;
  closeHour: number;
  workDays: number[]; // 0=Dom..6=Sáb
}

export interface State {
  settings: SalonSettings;
  professionals: Professional[];
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  products: Product[];
  sales: Sale[];
}

const KEY = "lsbarber-state-v1";
const LEGACY_KEY = "novo-stilo-state-v1";
const SUPABASE_TABLE = "lsbarber_state";
const SUPABASE_ROW_ID = "lsbarber";
const uid = () => Math.random().toString(36).slice(2, 10);

export type SupabaseSyncStatus = "local" | "conectando" | "conectado" | "salvando" | "erro";

export interface SupabaseSyncState {
  configured: boolean;
  status: SupabaseSyncStatus;
  message: string;
  lastSync?: string;
}

let syncState: SupabaseSyncState = {
  configured: isSupabaseConfigured,
  status: isSupabaseConfigured ? "conectando" : "local",
  message: isSupabaseConfigured
    ? "Preparando conexão com o Supabase."
    : "Rodando em modo local. Configure o .env.local para sincronizar com o Supabase.",
};

const syncListeners = new Set<() => void>();
const setSyncState = (patch: Partial<SupabaseSyncState>) => {
  syncState = { ...syncState, ...patch };
  syncListeners.forEach((listener) => listener());
};

const subscribeSync = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};

const seed = (): State => ({
  settings: {
    name: "LsBarber",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    openHour: 9,
    closeHour: 20,
    workDays: [1, 2, 3, 4, 5, 6],
  },
  professionals: [],
  services: [],
  clients: [],
  appointments: [],
  products: [],
  sales: [],
});

const normalizeSaleItem = (item: SaleItem): SaleItem => ({
  ...item,
  quantity: Math.max(1, Number(item.quantity || 1)),
  price: Math.max(0, Number(item.price || 0)),
  commissionPct: Math.max(0, Number(item.commissionPct || 0)),
});

const normalizeState = (loaded: State): State => ({
  ...seed(),
  ...loaded,
  settings: { ...seed().settings, ...(loaded.settings ?? {}) },
  professionals: (loaded.professionals ?? []).map((p) => ({ ...p, commission: Math.max(0, Number(p.commission || 0)) })),
  services: (loaded.services ?? []).map((s) => ({ ...s, duration: Math.max(5, Number(s.duration || 30)), price: Math.max(0, Number(s.price || 0)), commission: Math.max(0, Number(s.commission || 0)) })),
  clients: loaded.clients ?? [],
  appointments: loaded.appointments ?? [],
  products: (loaded.products ?? []).map((p) => ({ ...p, stock: Math.max(0, Number(p.stock || 0)), cost: Math.max(0, Number(p.cost || 0)), price: Math.max(0, Number(p.price || 0)), minStock: Math.max(0, Number(p.minStock || 0)) })),
  sales: (loaded.sales ?? []).map((sale) => ({ ...sale, items: sale.items.map(normalizeSaleItem) })),
});

let state: State;
try {
  if (typeof localStorage !== "undefined") localStorage.removeItem(LEGACY_KEY);
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  state = raw ? normalizeState(JSON.parse(raw)) : seed();
} catch {
  state = seed();
}

const listeners = new Set<() => void>();

const saveLocal = () => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {}
};

const notify = () => listeners.forEach((listener) => listener());

let supabaseReady = false;
let syncingFromRemote = false;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const saveToSupabase = async () => {
  if (!supabase || !supabaseReady || syncingFromRemote) return;

  setSyncState({ status: "salvando", message: "Salvando alterações no Supabase..." });

  const { error } = await supabase.from(SUPABASE_TABLE).upsert({
    id: SUPABASE_ROW_ID,
    data: state,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    setSyncState({
      status: "erro",
      message: `Erro ao salvar no Supabase: ${error.message}`,
    });
    return;
  }

  setSyncState({
    status: "conectado",
    message: "Dados sincronizados com o Supabase.",
    lastSync: new Date().toISOString(),
  });
};

const scheduleSupabaseSave = () => {
  if (!supabase || !supabaseReady || syncingFromRemote) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    void saveToSupabase();
  }, 450);
};

const persist = () => {
  saveLocal();
  notify();
  scheduleSupabaseSave();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let supabaseInitStarted = false;

export const initSupabaseSync = async () => {
  if (supabaseInitStarted) return syncState;
  supabaseInitStarted = true;

  if (!supabase) {
    setSyncState({
      configured: false,
      status: "local",
      message: "Supabase não configurado. O sistema está salvando apenas neste navegador.",
    });
    return syncState;
  }

  setSyncState({
    configured: true,
    status: "conectando",
    message: "Conectando ao Supabase...",
  });

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("data")
    .eq("id", SUPABASE_ROW_ID)
    .maybeSingle();

  if (error) {
    setSyncState({
      status: "erro",
      message: `Não foi possível carregar dados do Supabase: ${error.message}`,
    });
    return syncState;
  }

  if (data?.data) {
    syncingFromRemote = true;
    state = normalizeState(data.data as State);
    saveLocal();
    notify();
    syncingFromRemote = false;
  } else {
    const { error: insertError } = await supabase.from(SUPABASE_TABLE).insert({
      id: SUPABASE_ROW_ID,
      data: state,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      setSyncState({
        status: "erro",
        message: `Não foi possível criar o registro inicial no Supabase: ${insertError.message}`,
      });
      return syncState;
    }
  }

  supabaseReady = true;
  setSyncState({
    status: "conectado",
    message: "Sistema conectado ao Supabase.",
    lastSync: new Date().toISOString(),
  });
  return syncState;
};

const appointmentRange = (s: State, a: Pick<Appointment, "serviceId" | "start">) => {
  const service = s.services.find((x) => x.id === a.serviceId);
  const start = new Date(a.start);
  const minutes = service?.duration ?? 30;
  const end = new Date(start.getTime() + minutes * 60_000);
  return { start, end, service };
};

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd;

export const toDateInputValue = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const formatTime = (date: string | Date) =>
  new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (date: string | Date) =>
  new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const canProfessionalPerformService = (professional: Professional, service: Service) =>
  professional.active &&
  service.active &&
  (professional.attendance === "unissex" || service.gender === "unissex" || professional.attendance === service.gender);

export const validateAppointment = (
  s: State,
  input: Pick<Appointment, "clientId" | "professionalId" | "serviceId" | "start"> & { id?: string },
) => {
  const client = s.clients.find((x) => x.id === input.clientId);
  const professional = s.professionals.find((x) => x.id === input.professionalId);
  const service = s.services.find((x) => x.id === input.serviceId);
  const start = new Date(input.start);

  if (!client) return "Selecione um cliente válido.";
  if (!professional) return "Selecione um profissional válido.";
  if (!service) return "Selecione um serviço válido.";
  if (!professional.active) return "Este profissional está inativo.";
  if (!service.active) return "Este serviço está inativo.";
  if (!canProfessionalPerformService(professional, service)) {
    return "Este profissional não atende o público definido para esse serviço.";
  }
  if (Number.isNaN(start.getTime())) return "Informe uma data e hora válidas.";
  if (!s.settings.workDays.includes(start.getDay())) return "O salão não atende neste dia da semana.";

  const { end } = appointmentRange(s, input);
  const open = new Date(start);
  open.setHours(s.settings.openHour, 0, 0, 0);
  const close = new Date(start);
  close.setHours(s.settings.closeHour, 0, 0, 0);
  if (start < open || end > close) return "O horário escolhido fica fora do funcionamento do salão.";

  const conflict = s.appointments.some((a) => {
    if (a.id === input.id) return false;
    if (a.professionalId !== input.professionalId) return false;
    if (a.status === "cancelado" || a.status === "faltou") return false;
    const current = appointmentRange(s, a);
    return overlaps(start, end, current.start, current.end);
  });

  if (conflict) return "Esse profissional já possui um atendimento neste período.";
  return null;
};

export const getAppointmentEnd = (s: State, appointment: Pick<Appointment, "serviceId" | "start">) =>
  appointmentRange(s, appointment).end;

export const store = {
  get: () => state,
  reset: () => {
    state = seed();
    persist();
  },

  // settings
  updateSettings: (s: Partial<SalonSettings>) => {
    const openHour = Math.max(0, Math.min(23, Number(s.openHour ?? state.settings.openHour)));
    const closeHour = Math.max(openHour + 1, Math.min(24, Number(s.closeHour ?? state.settings.closeHour)));
    state = { ...state, settings: { ...state.settings, ...s, openHour, closeHour } };
    persist();
  },

  // professionals
  addProfessional: (p: Omit<Professional, "id">) => {
    state = { ...state, professionals: [...state.professionals, { ...p, id: uid(), commission: Math.max(0, Number(p.commission || 0)) }] };
    persist();
  },
  updateProfessional: (id: string, patch: Partial<Professional>) => {
    state = { ...state, professionals: state.professionals.map((x) => (x.id === id ? { ...x, ...patch, commission: Math.max(0, Number(patch.commission ?? x.commission)) } : x)) };
    persist();
  },
  removeProfessional: (id: string) => {
    state = { ...state, professionals: state.professionals.filter((x) => x.id !== id) };
    persist();
  },

  // services
  addService: (s: Omit<Service, "id">) => {
    state = { ...state, services: [...state.services, { ...s, id: uid(), duration: Math.max(5, Number(s.duration || 30)), price: Math.max(0, Number(s.price || 0)), commission: Math.max(0, Number(s.commission || 0)) }] };
    persist();
  },
  updateService: (id: string, patch: Partial<Service>) => {
    state = { ...state, services: state.services.map((x) => (x.id === id ? { ...x, ...patch, duration: Math.max(5, Number(patch.duration ?? x.duration)), price: Math.max(0, Number(patch.price ?? x.price)), commission: Math.max(0, Number(patch.commission ?? x.commission)) } : x)) };
    persist();
  },
  removeService: (id: string) => {
    state = { ...state, services: state.services.filter((x) => x.id !== id) };
    persist();
  },

  // clients
  addClient: (c: Omit<Client, "id" | "createdAt">) => {
    const client = { ...c, id: uid(), createdAt: new Date().toISOString() };
    state = { ...state, clients: [...state.clients, client] };
    persist();
    return client;
  },
  updateClient: (id: string, patch: Partial<Client>) => {
    state = { ...state, clients: state.clients.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
    persist();
  },
  removeClient: (id: string) => {
    state = { ...state, clients: state.clients.filter((x) => x.id !== id) };
    persist();
  },

  // appointments
  addAppointment: (a: Omit<Appointment, "id" | "status"> & { status?: AppointmentStatus }) => {
    const error = validateAppointment(state, a);
    if (error) throw new Error(error);
    const appt: Appointment = { ...a, id: uid(), status: a.status ?? "agendado" };
    state = { ...state, appointments: [...state.appointments, appt] };
    persist();
    return appt;
  },
  updateAppointment: (id: string, patch: Partial<Appointment>) => {
    const current = state.appointments.find((x) => x.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    if (patch.clientId || patch.professionalId || patch.serviceId || patch.start) {
      const error = validateAppointment(state, next);
      if (error) throw new Error(error);
    }
    state = { ...state, appointments: state.appointments.map((x) => (x.id === id ? next : x)) };
    persist();
  },
  removeAppointment: (id: string) => {
    state = { ...state, appointments: state.appointments.filter((x) => x.id !== id) };
    persist();
  },

  // products
  addProduct: (p: Omit<Product, "id">) => {
    state = { ...state, products: [...state.products, { ...p, id: uid(), stock: Math.max(0, Number(p.stock || 0)), cost: Math.max(0, Number(p.cost || 0)), price: Math.max(0, Number(p.price || 0)), minStock: Math.max(0, Number(p.minStock || 0)) }] };
    persist();
  },
  updateProduct: (id: string, patch: Partial<Product>) => {
    state = { ...state, products: state.products.map((x) => (x.id === id ? { ...x, ...patch, stock: Math.max(0, Number(patch.stock ?? x.stock)), cost: Math.max(0, Number(patch.cost ?? x.cost)), price: Math.max(0, Number(patch.price ?? x.price)), minStock: Math.max(0, Number(patch.minStock ?? x.minStock)) } : x)) };
    persist();
  },
  removeProduct: (id: string) => {
    state = { ...state, products: state.products.filter((x) => x.id !== id) };
    persist();
  },

  // sales
  addSale: (s: Omit<Sale, "id" | "createdAt">) => {
    const items = s.items.map(normalizeSaleItem);
    const productQty = new Map<string, number>();
    for (const item of items) {
      if (item.kind !== "product") continue;
      productQty.set(item.refId, (productQty.get(item.refId) ?? 0) + item.quantity);
    }

    for (const [productId, qty] of productQty) {
      const product = state.products.find((p) => p.id === productId);
      if (!product) throw new Error("Produto não encontrado no estoque.");
      if (!product.active) throw new Error(`${product.name} está inativo no estoque.`);
      if (product.stock < qty) throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
    }

    const sale: Sale = {
      ...s,
      items,
      discount: Math.max(0, Number(s.discount || 0)),
      total: Math.max(0, Number(s.total || 0)),
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    const products = state.products.map((p) => {
      const qty = productQty.get(p.id) ?? 0;
      return qty ? { ...p, stock: Math.max(0, p.stock - qty) } : p;
    });
    state = { ...state, sales: [...state.sales, sale], products };
    persist();
    return sale;
  },
};

export const useStore = <T,>(selector: (s: State) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );

export const useSupabaseSyncStatus = () =>
  useSyncExternalStore(
    subscribeSync,
    () => syncState,
    () => syncState,
  );

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const computeCommissions = (sales: Sale[]) => {
  const map = new Map<string, number>();
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!item.professionalId) continue;
      const quantity = item.quantity || 1;
      const value = (item.price * quantity * item.commissionPct) / 100;
      map.set(item.professionalId, (map.get(item.professionalId) ?? 0) + value);
    }
  }
  return map;
};
