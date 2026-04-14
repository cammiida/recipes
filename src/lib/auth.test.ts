import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, test, expect, afterAll } from "vitest";
import { auth } from "./auth";
import { prisma } from "./prisma";

const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: "test-password-123",
  name: "Test User",
};

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
  await prisma.$disconnect();
});

describe("session validation", () => {
  test("returns null for unauthenticated request", async () => {
    const session = await auth.api.getSession({
      headers: new Headers(),
    });

    expect(session).toBeNull();
  });

  test("returns user data for authenticated request", async () => {
    await auth.api.signUpEmail({
      body: TEST_USER,
    });

    const signInResponse = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      asResponse: true,
    });

    const sessionCookie = signInResponse.headers.get("set-cookie");
    expect(sessionCookie).toBeTruthy();

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie! }),
    });

    expect(session).not.toBeNull();
    expect(session!.user.email).toBe(TEST_USER.email);
    expect(session!.user.name).toBe(TEST_USER.name);
  });

  test("sign-out invalidates session", async () => {
    const signInResponse = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: TEST_USER.password },
      asResponse: true,
    });

    const sessionCookie = signInResponse.headers.get("set-cookie")!;

    await auth.api.signOut({
      headers: new Headers({ cookie: sessionCookie }),
    });

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie }),
    });

    expect(session).toBeNull();
  });

  test("rejects invalid credentials", async () => {
    const response = await auth.api.signInEmail({
      body: { email: TEST_USER.email, password: "wrong-password" },
      asResponse: true,
    });

    expect(response.status).toBe(401);

    const sessionCookie = response.headers.get("set-cookie");
    expect(sessionCookie).toBeNull();
  });
});

describe("seed script", () => {
  const SEED_USER = {
    email: `seed-${Date.now()}@example.com`,
    password: "seed-test-password",
    name: "Seed User",
  };

  const seedFile = join(tmpdir(), `seed-users-${Date.now()}.json`);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: SEED_USER.email } });
    try { unlinkSync(seedFile); } catch {}
  });

  test("creates accounts from seed-users file", async () => {
    writeFileSync(seedFile, JSON.stringify([SEED_USER]));

    const { seed } = await import("../../prisma/seed");
    await seed(seedFile);

    const user = await prisma.user.findUnique({
      where: { email: SEED_USER.email },
    });
    expect(user).not.toBeNull();
    expect(user!.name).toBe(SEED_USER.name);

    const signInResponse = await auth.api.signInEmail({
      body: { email: SEED_USER.email, password: SEED_USER.password },
      asResponse: true,
    });
    expect(signInResponse.status).toBe(200);
  });
});
