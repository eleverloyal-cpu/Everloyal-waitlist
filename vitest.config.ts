import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 15000, // sign-up tests sit through the 4 s success screen
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@everloyal/shared": path.resolve(__dirname, "./packages/shared/src"),
    },
  },
});
