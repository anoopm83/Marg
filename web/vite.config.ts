import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Front-end dev server proxies /api to the Express backend (port 5175),
// so the app can call the real API with no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:5175" },
  },
});
