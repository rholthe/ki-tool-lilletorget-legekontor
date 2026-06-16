import "dotenv/config"
import { defineConfig, env } from "prisma/config"

// Prisma 7 leser ikke .env automatisk lenger; dotenv lastes eksplisitt over.
// Tilkoblingsstrengen brukes av Prisma CLI (db push, generate). I appen (runtime)
// settes tilkoblingen opp via mariadb-driveradapteren i src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
})
