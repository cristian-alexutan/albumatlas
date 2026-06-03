import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Clear DATABASE_URL so tests run against in-memory storage by default.
    // Use `npm run test:db` (which sets DATABASE_URL explicitly) for DB-backed tests.
    env: {
      DATABASE_URL: "",
    },
  },
});
