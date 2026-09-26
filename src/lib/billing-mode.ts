// Marketing can read the environment mode without loading the Supabase client.
export const billingEnabled = import.meta.env.PROD || import.meta.env.VITE_BILLING_ENABLED === 'true';
