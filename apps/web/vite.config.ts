import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_PORT ?? 3000),
    strictPort: true,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8787"
    }
  }
});
