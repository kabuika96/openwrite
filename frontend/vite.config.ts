import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, "../", ""), ...process.env };
  const backendPort = env.OPENWRITE_BACKEND_PORT || "8787";
  const backendHttpOrigin = env.OPENWRITE_BACKEND_HTTP_ORIGIN || `http://127.0.0.1:${backendPort}`;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(backendHttpOrigin).hostname)) throw new Error('OpenWrite requires a loopback backend');

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: parsePort(env.OPENWRITE_FRONTEND_PORT, 5173),
      allowedHosts: ['localhost', '127.0.0.1'],
      proxy: {
        "/api": backendHttpOrigin,
      },
    },
  };
});

function parsePort(value: string | undefined, fallback: number) {
  const port = Number.parseInt(value ?? "", 10);
  return Number.isFinite(port) ? port : fallback;
}
