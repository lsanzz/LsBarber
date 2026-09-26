import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const url = env.VITE_SUPABASE_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
    let validUrl = false;
    try { validUrl = new URL(url).protocol === 'https:'; } catch { /* Missing or malformed URL. */ }
    if (!validUrl || !publishableKey || /^(SUA_|SEU-|REPLACE)/i.test(publishableKey)) {
      throw new Error('Build comercial bloqueado: configure VITE_SUPABASE_URL (HTTPS) e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente de build.');
    }
  }
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), tsConfigPaths()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "@tanstack/react-router"],
    },
  };
});
