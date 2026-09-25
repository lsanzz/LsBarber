import { isSupabaseConfigured, supabase } from './supabase';
export const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true';
export const billingConfigured = isSupabaseConfigured;
export interface Registration { name: string; business: string; email: string; phone: string }
const draftKey = 'lsbarber-registration-draft-v1';
export const demoReceiptKey = 'lsbarber-demo-receipt-v1';
export function readDraft(): Registration {
  try {
    const data = JSON.parse(sessionStorage.getItem(draftKey) || '{}');
    return { name: typeof data.name === 'string' ? data.name : '', business: typeof data.business === 'string' ? data.business : '', email: typeof data.email === 'string' ? data.email : '', phone: typeof data.phone === 'string' ? data.phone : '' };
  } catch { return { name: '', business: '', email: '', phone: '' }; }
}
export function saveDraft(draft: Registration) {
  try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); }
  catch { throw new Error('Permita o armazenamento nesta aba para continuar o cadastro.'); }
}
export async function billingRequest(body: Record<string, unknown>) {
  if (!supabase) throw new Error('A integração de pagamento ainda não foi configurada.');
  const { data, error } = await supabase.functions.invoke('billing', { body });
  if (error) {
    let message = 'Não foi possível conectar ao pagamento. Tente novamente em instantes.';
    if (error.context instanceof Response) {
      const response = await error.context.json().catch(() => null);
      if (typeof response?.error === 'string') message = response.error;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
