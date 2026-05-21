import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "github-pages" ? "/mapping_star/" : "/",
  plugins: [react()],
  test: {
    environment: "node",
    globals: true
  }
}));
