import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Third arg "" loads every key from .env / .env.local, not just VITE_* ones.
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.DEV_PORT) || 5178;
  console.log(`🐉 dev server pinned to port ${port} (DEV_PORT in .env)`);

  return {
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: {
      rollupOptions: {
        input: {
          main: new URL("./index.html", import.meta.url).pathname,
        },
      },
    },
  };
});
