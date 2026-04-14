# Admin Authentication & Recipe Management

## Overview

Add admin authentication and a recipe management panel to the recipes app. The public site remains statically generated. Admin routes are server-rendered behind better-auth sessions. Recipe edits trigger a site rebuild. Future: LLM-powered recipe generation from screenshots/URLs.

## Architecture

```
Browser ──(cookies)──> CloudFront ──> Lambda Function URL ──> Astro SSR ──> Neon PostgreSQL
```

- **Public site**: Static (Astro hybrid mode), prerendered at build time from the database. Served via CloudFront.
- **Admin panel**: Astro SSR routes under `/admin/*`, behind better-auth session validation.
- **Auth**: better-auth v1.5.6, email/password, HTTP-only cookie sessions. No separate API — everything runs inside Astro.
- **Data**: Neon PostgreSQL via Prisma. Recipes and auth tables in the same database.
- **Hosting**: AWS Lambda via Function URL (no API Gateway). CloudFront in front.
- **Infrastructure**: Terraform (extending existing config).

## Authentication

- better-auth handles signup, signin, signout, and session management.
- Sessions stored server-side in PostgreSQL, delivered as HTTP-only cookies.
- No open registration. Admin accounts created via a Prisma seed script.
- Auth routes exposed via a catch-all Astro API route at `/api/auth/*`.

## Database Schema (Prisma)

```prisma
// better-auth required models

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  recipes       Recipe[]
}

model Session {
  id        String   @id @default(uuid())
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id           String    @id @default(uuid())
  providerId   String
  accountId    String
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken  String?
  refreshToken String?
  idToken      String?
  scope        String?
  password     String?
  expiresAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Verification {
  id         String   @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

// Application model

model Recipe {
  id          String   @id @default(uuid())
  title       String
  description String
  category    String
  cookTimeMin Int      @map("cook_time_min")
  kcal        Int
  proteinG    Int      @map("protein_g")
  carbsG      Int      @map("carbs_g")
  fatG        Int      @map("fat_g")
  tags        String[]
  ingredients Json     // JSONB — array of {name, amount, unit, weight_g}
  steps       Json     // JSONB — array of strings
  createdById String?  @map("created_by")
  createdBy   User?    @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## Route Structure

| Route | Auth | Rendering | Description |
|---|---|---|---|
| `/` | No | Static | Recipe listing |
| `/recipe/[id]` | No | Static | Recipe detail |
| `/login` | No | SSR | Login form |
| `/admin` | Yes | SSR | Admin dashboard |
| `/admin/recipes` | Yes | SSR | Recipe CRUD |
| `/admin/generate` | Yes | SSR | LLM recipe generation (future) |
| `/api/auth/*` | — | SSR | better-auth catch-all handler |

No auth awareness on public pages. Admin section is completely separate.

## Frontend

- React added via `@astrojs/react` for Astro islands.
- React used only for interactive components: login form, admin UI, future LLM chat.
- Public recipe pages remain zero-JS static HTML.
- Auth client uses `better-auth/react` (`useSession`, `signIn`, `signOut`).

## Rebuild Flow

1. Admin saves a recipe via the admin panel.
2. Astro API route writes to Neon via Prisma.
3. API route triggers a GitHub Actions `workflow_dispatch` via the GitHub API.
4. GitHub Actions builds the Astro site (reads recipes from Neon at build time), deploys to S3, invalidates CloudFront.

## Infrastructure (Terraform)

Extending existing Terraform config with:
- **Lambda function** running the `@astrojs/node` Astro build
- **Lambda Function URL** (no API Gateway — free, no timeout limits, supports streaming)
- **IAM role/policy** for Lambda
- **SSM Parameter Store** for secrets: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_TOKEN`
- **CloudFront** updated to route to Lambda Function URL instead of (or in addition to) S3

Existing S3 bucket retained for static asset serving if needed.

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | SSM → Lambda | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | SSM → Lambda | Session signing secret |
| `BETTER_AUTH_URL` | SSM → Lambda | App public URL |
| `GITHUB_TOKEN` | SSM → Lambda | Triggering rebuild workflows |

Local development uses `.env` with a Neon dev branch connection string.

## Dependencies

New packages:
- `better-auth` — auth library (server + client)
- `@prisma/client` — database client
- `prisma` (dev) — schema management, migrations
- `@astrojs/node` — SSR adapter
- `@astrojs/react` — React island support
- `react`, `react-dom` — React runtime

## Migration

- 42 existing recipes migrated from `recipes.json` into PostgreSQL via a seed script.
- Existing Lambda API (`api/` directory) retired after migration.
- `recipes.json` removed from the build process once pages read from the database.

## Future: LLM Recipe Generation

Not in scope for initial implementation. Lambda Function URLs chosen partly to support streaming LLM responses later. Admin route at `/admin/generate` reserved for this feature.
