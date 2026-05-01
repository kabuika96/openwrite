import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../", "");
  const backendPort = env.OPENWRITE_BACKEND_PORT || "8787";
  const backendHttpOrigin = env.OPENWRITE_BACKEND_HTTP_ORIGIN || `http://127.0.0.1:${backendPort}`;
  const backendWsOrigin = env.OPENWRITE_BACKEND_WS_ORIGIN || toWebSocketOrigin(backendHttpOrigin);
  const allowedHosts = parseCsv(env.OPENWRITE_ALLOWED_HOSTS);

  return {
    plugins: [react()],
    server: {
      host: env.OPENWRITE_FRONTEND_HOST || "0.0.0.0",
      port: parsePort(env.OPENWRITE_FRONTEND_PORT, 5173),
      ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
      proxy: {
        "/api": backendHttpOrigin,
        "/sync": {
          target: backendWsOrigin,
          ws: true,
        },
      },
    },
  };
});

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePort(value: string | undefined, fallback: number) {
  const port = Number.parseInt(value ?? "", 10);
  return Number.isFinite(port) ? port : fallback;
}

function toWebSocketOrigin(origin: string) {
  if (origin.startsWith("https://")) return `wss://${origin.slice("https://".length)}`;
  if (origin.startsWith("http://")) return `ws://${origin.slice("http://".length)}`;
  return origin;
}
