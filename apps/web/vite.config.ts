import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
    strictPort: false,
    proxy: {
      "/api": process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8787"
    }
  }
});
