import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" alias straight from tsconfig.json — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
