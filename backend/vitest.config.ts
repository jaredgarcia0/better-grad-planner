import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Threads avoid the child-process worker startup that fails in restricted
    // environments while still keeping the test runner isolated from Node's
    // main process.
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    clearMocks: true,
    restoreMocks: true,
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/integration/**"],
    coverage: {
      provider: "v8",
      exclude: ["tests/**"],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
