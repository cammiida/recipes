import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    environment: "node",
    env: {
      BETTER_AUTH_URL: "http://localhost:4321",
    },
  },
});
