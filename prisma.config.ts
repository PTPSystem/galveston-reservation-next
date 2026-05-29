// Prisma 7+ configuration
// See: https://pris.ly/d/config-datasource
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  // Use DIRECT_URL for migrations (required for Neon pooled connections).
  // Falls back to DATABASE_URL if DIRECT_URL is not set.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
