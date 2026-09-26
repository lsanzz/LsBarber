// The commercial workspace is isolated by Supabase Auth and database RLS.
// Demo mode remains local-only when billing is disabled.

import { useSyncExternalStore } from "react";

import { isSupabaseConfigured, supabase } from "./supabase";
import { billingEnabled } from "./purchase";

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
const SUPABASE_TABLE = "salon_workspaces";
const uid = () => crypto.randomUUID?.()
  ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

export type SupabaseSyncStatus = "local" | "conectando" | "conectado" | "salvando" | "erro";

export interface SupabaseSyncState {
  configured: boolean;
  status: SupabaseSyncStatus;
  message: string;
  lastSync?: string;
  conflict?: boolean;
}

let syncState: SupabaseSyncState = {
  configured: isSupabaseConfigured && billingEnabled,
  status: billingEnabled ? "conectando" : "local",
  message: billingEnabled ? "Aguardando autenticação da conta." : "Demonstração local neste navegador.",
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

let state: State = seed();
if (!billingEnabled) {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LEGACY_KEY);
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    state = raw ? normalizeState(JSON.parse(raw)) : seed();
  } catch { state = seed(); }
}

const listeners = new Set<() => void>();

const saveLocal = () => {
  if (billingEnabled) return;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {}
};

const notify = () => listeners.forEach((listener) => listener());

let supabaseReady = false;
let activeUserId: string | null = null;
let planLimit = 0;
let serverVersion = 0;
let generation = 0;
let saveInFlight = false;
let savePromise: Promise<void> | null = null;
let dirty = false;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let initPromise: Promise<SupabaseSyncState> | null = null;

if (billingEnabled && typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (!dirty && !saveInFlight) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

const saveToSupabase = (): Promise<void> => {
  if (savePromise) return savePromise;
  if (!supabase || !supabaseReady || !activeUserId || !dirty) return Promise.resolve();
  const currentGeneration = generation;
  const ownerId = activeUserId;
  const snapshot = state;
  dirty = false;
  saveInFlight = true;

  setSyncState({ status: "salvando", message: "Salvando alterações no Supabase..." });
  const operation = (async () => {
    try {
      const { data, error } = await supabase.rpc('save_workspace_state', {
        p_owner: ownerId,
        p_expected_version: serverVersion,
        p_data: snapshot,
      });
      if (currentGeneration !== generation) return;
      if (error) {
        dirty = true;
        setSyncState({
          status: "erro",
          message: error.code === 'P0001'
            ? 'Outra aba alterou estes dados. Não feche esta aba; exporte seus dados e recarregue antes de editar novamente.'
            : error.code === '42501'
              ? 'Sua assinatura ou o limite de profissionais não permite salvar esta alteração.'
              : `Não foi possível salvar no Supabase: ${error.message}`,
          conflict: error.code === 'P0001',
        });
        return;
      }
      serverVersion = Number(data);
      setSyncState({
        status: "conectado",
        message: "Dados da sua barbearia sincronizados.",
        lastSync: new Date().toISOString(),
        conflict: false,
      });
    } catch {
      if (currentGeneration !== generation) return;
      dirty = true;
      setSyncState({ status: 'erro', message: 'A conexão falhou antes de confirmar a gravação. Tente salvar novamente; se persistir, baixe uma cópia dos dados.', conflict: false });
    } finally {
      if (currentGeneration === generation) {
        saveInFlight = false;
        if (dirty && syncState.status !== 'erro') scheduleSupabaseSave();
      }
    }
  })();
  savePromise = operation;
  void operation.finally(() => { if (savePromise === operation) savePromise = null; });
  return operation;
};

const scheduleSupabaseSave = () => {
  if (!supabase || !supabaseReady || !activeUserId) return;
  dirty = true;
  setSyncState({ status: 'salvando', message: 'Alterações pendentes de sincronização.' });
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

export const disconnectSupabaseSync = () => {
  generation++;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  activeUserId = null;
  planLimit = 0;
  serverVersion = 0;
  supabaseReady = false;
  dirty = false;
  saveInFlight = false;
  savePromise = null;
  initPromise = null;
  state = seed();
  notify();
  setSyncState({ status: billingEnabled ? 'conectando' : 'local', message: 'Aguardando autenticação da conta.', lastSync: undefined, conflict: false });
};

export const setWorkspacePlanLimit = (limit: number) => { planLimit = Math.max(0, Math.floor(limit)); };
export const getWorkspacePlanLimit = () => planLimit;

export const initSupabaseSync = async (userId?: string, businessName?: string): Promise<SupabaseSyncState> => {
  if (!billingEnabled) return syncState;
  if (!supabase || !userId) {
    disconnectSupabaseSync();
    setSyncState({ status: 'erro', message: 'Não foi possível conectar esta conta ao Supabase.' });
    return syncState;
  }
  if (activeUserId === userId && supabaseReady) return syncState;
  if (activeUserId === userId && initPromise) return initPromise;
  disconnectSupabaseSync();
  activeUserId = userId;
  const currentGeneration = generation;
  setSyncState({ configured: true, status: 'conectando', message: 'Carregando os dados da sua barbearia...' });
  initPromise = (async () => {
    const { data, error } = await supabase.from(SUPABASE_TABLE)
      .select('data, version').eq('owner_id', userId).maybeSingle();
    if (currentGeneration !== generation) return syncState;
    if (error) {
      setSyncState({ status: 'erro', message: `Não foi possível carregar sua barbearia: ${error.message}` });
      return syncState;
    }
    if (data) {
      state = normalizeState(data.data as State);
      serverVersion = Number(data.version);
    } else {
      if (businessName?.trim()) state = { ...state, settings: { ...state.settings, name: businessName.trim().slice(0, 120) } };
      const { data: createdVersion, error: createError } = await supabase.rpc('save_workspace_state', {
        p_owner: userId, p_expected_version: 0, p_data: state,
      });
      if (currentGeneration !== generation) return syncState;
      if (createError) {
        setSyncState({ status: 'erro', message: `Não foi possível criar sua barbearia: ${createError.message}` });
        return syncState;
      }
      serverVersion = Number(createdVersion);
    }
    supabaseReady = true;
    notify();
    setSyncState({ status: 'conectado', message: 'Sua barbearia está sincronizada.', lastSync: new Date().toISOString() });
    return syncState;
  })();
  try { return await initPromise; }
  finally { if (currentGeneration === generation) initPromise = null; }
};

export const retrySupabaseSave = () => { if (dirty) void saveToSupabase(); };

export const flushPendingWorkspace = async (): Promise<boolean> => {
  if (!billingEnabled) return true;
  if (!supabaseReady || !activeUserId) return false;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  const deadline = Date.now() + 15_000;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!dirty && !saveInFlight) return true;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finished = await Promise.race([
      saveToSupabase().then(() => true),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), remaining); }),
    ]);
    if (timer) clearTimeout(timer);
    if (!finished || syncState.status === 'erro') return false;
  }
  return !dirty && !saveInFlight;
};

export const downloadWorkspaceData = (data: State) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lsbarber-dados-${toDateInputValue(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const exportWorkspaceData = () => downloadWorkspaceData(state);

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
    if (billingEnabled && state.professionals.length >= planLimit) {
      throw new Error(`Seu plano permite até ${planLimit} profissional${planLimit === 1 ? '' : 'is'}. Gerencie o plano antes de adicionar outro.`);
    }
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
