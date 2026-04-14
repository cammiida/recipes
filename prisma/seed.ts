import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auth } from "../src/lib/auth";

interface SeedUser {
  email: string;
  password: string;
  name: string;
}

function loadUsers(path: string): SeedUser[] {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

export async function seed(
  usersPath = resolve(import.meta.dirname!, "seed-users.json"),
) {
  const users = loadUsers(usersPath);

  for (const user of users) {
    const existing = await auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      asResponse: true,
    });

    if (existing.status === 200) {
      console.log(`Already exists: ${user.email}`);
      continue;
    }

    await auth.api.signUpEmail({
      body: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    console.log(`Created: ${user.email}`);
  }
}

const isDirectRun =
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js");

if (isDirectRun) {
  seed();
}
