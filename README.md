# NgIBL — Inquiry-Based Learning Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

A Next.js platform for inquiry-based STEM learning: teachers build experiments with AI-generated worksheets and interactive simulations, students work through them with an AI tutor, and a multi-agent pipeline generates and self-corrects the simulation code.

**Live**: [ibl-five.vercel.app](https://ibl-five.vercel.app)

## Overview

NgIBL lets a teacher create an "experiment" — a subject, an AI context (source material), a simulation, and a worksheet (MCQ, short answer, long answer, fill-in-the-blank). Students open the experiment, interact with the simulation, and answer the worksheet with help from a RAG-backed AI tutor that is prompted to guide rather than give away answers. Teachers get AI-assisted question generation, per-student and class-wide answer analysis, and CSV export for gradebooks.

The distinctive piece is the **simulation sandbox**: instead of hand-coding every STEM simulation, teachers describe what they want and a multi-agent pipeline generates working React or GeoGebra code, validates it, and repairs it automatically when it's wrong — so a non-technical teacher (and a lightweight/free-tier AI model) can still produce a working interactive simulation.

## Multi-agent simulation generation

Simulation code is produced by an orchestrated pipeline rather than a single model call (`src/lib/agents.ts`, `src/lib/ai-simulation.ts`):

1. **Planner** — breaks the request into 3–7 implementation steps.
2. **Code Generator** — produces React or GeoGebra code from the plan, using subject/engine-specific prompt templates and worked examples (`src/lib/template-packs`, `src/lib/model-provider-templates.ts`).
3. **Validator** — checks the output locally (bracket matching, forbidden imports, JSON validity for GeoGebra) and via an AI semantic check.
4. **Refiner** — feeds validator errors back to the model and retries, up to 3 attempts, before surfacing the failure.

On top of that base loop:

- **Auto-fix on preview errors**: if a generated simulation throws at runtime, the studio UI offers a one-click "Auto-Fix Error" action that re-runs the refiner against the actual runtime error.
- **Checkpoints and version history**: every save/auto-fix can be checkpointed; simulations keep a version history (capped at 80 entries) that can be rolled back.
- **Continuous iteration**: simulations can be forked, modified, and re-generated repeatedly rather than treated as one-shot output.
- **Engine routing**: prompts and validation are engine-aware — supported engines include a sandboxed React runner, Matter.js (physics), JSXGraph (geometry), Kekule.js (chemistry), 3Dmol.js (molecular structures), and GeoGebra.
- **Multi-provider AI**: Gemini, DeepSeek, Qwen/Tongyi, and other OpenAI-compatible providers, plus local models via Ollama — so the pipeline is not tied to a single paid API.

## Features

### For teachers

- Experiment builder: title, subject, simulation, AI context, and worksheet questions (MCQ, short answer, long answer, fill-in-the-blank)
- One-click AI question generation from the experiment's context
- Class-wide and per-student answer analysis, with caching
- In-browser simulation builder (sandbox) with live preview, described above
- Community library: publish simulations, fork and modify others' work
- CSV export of student submissions
- QR code generation for sharing an experiment with students

### For students

- Interactive simulations with adjustable parameters
- AI tutor chatbot that uses retrieval-augmented context from the teacher's material, prompted to guide rather than answer directly
- Digital worksheets with image upload for long-answer questions
- Guest access to preview experiments without an account

### Platform

- Bilingual UI: English / Traditional Chinese (繁體中文)
- Dark mode (system-aware, manual toggle)
- Per-function AI model selection (different models for simulation generation, chatbot, and analysis)
- Role hierarchy: Student → Teacher → Admin (RBAC)
- Platform adapter API (`/api/adapter/*`) for external system integration: SSO launch, user/class sync, entitlement checks, and event export

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript |
| Database | PostgreSQL + pgvector, via Prisma |
| Auth | NextAuth.js v5 (JWT, credentials provider) |
| AI | Google Gemini, DeepSeek, Qwen, Ollama (multi-provider) |
| RAG | pgvector embeddings, sentence-aware chunking |
| Cache / rate limiting | Vercel KV (Redis-compatible) |
| Logging | Pino (structured JSON in prod, pretty-printed in dev) |
| Styling | Tailwind CSS + Shadcn/UI + Radix primitives |
| Charts | Recharts |
| Simulation sandbox | react-runner (sandboxed React execution) |
| Testing | Vitest + Testing Library |
| Deployment | Vercel |

## Platform internals

A few implementation details worth calling out for anyone reading the code:

- **Typed error handling** — server actions and API routes go through `withErrorHandling()` / `withApiErrorHandling()`, which map a small hierarchy of typed errors (`UnauthorizedError`, `ForbiddenError`, `ValidationError`, `RateLimitError`, `AIProviderError`, ...) to consistent responses and sanitize error messages in production.
- **Structured logging** — Pino-based logger with helpers for AI calls, DB queries, auth events, and rate-limit events; sensitive fields (API keys, passwords, tokens) are redacted.
- **Caching** — Vercel KV with a 1-hour TTL for experiment/simulation/analysis data, invalidated on update/delete/new submission, with graceful fallback (no caching, not a hard failure) when KV isn't configured.
- **Rate limiting** — sliding-window limits per action (e.g. chatbot messages, AI analysis, simulation generation, login attempts), also degrading gracefully when KV is unavailable.
- **RBAC + audit log** — `requireAuth()` / `requireRole()` / `requireExperimentOwner()` / `requireSimulationOwner()` guards, with mutations logged to an `AuditLog` table.
- **RAG pipeline** — sentence-aware chunking (400 tokens, 50-token overlap), multi-provider embeddings, pgvector cosine-similarity search, with a fallback to full-context concatenation if no embeddings exist yet.

## Database schema

```
User ──────┬──→ Experiment ──┬──→ WorksheetQuestion
  │        │       │         └──→ StudentSubmission ──→ Answer
  │        │       └──→ Embedding (pgvector)
  │        └──→ Simulation (forks via parentId, version history)
  └──→ AuditLog
```

Key models: `User` (multi-provider AI config), `Experiment` (AI context + simulation), `Simulation` (React/GeoGebra, with community/fork fields), `Embedding` (vector columns for RAG), `AuditLog`.

## Getting started

### Prerequisites

- Node.js 18+
- PostgreSQL with the `pgvector` extension enabled
- (Optional) Vercel KV for caching and rate limiting
- At least one AI provider API key (Gemini has a usable free tier), or a local Ollama install

### Installation

```bash
git clone https://github.com/A11MiND/NgIBL.git
cd NgIBL
npm install
```

### Environment variables

Create a `.env` file:

```env
# Required
DATABASE_URL="postgresql://user:password@host:5432/ibl?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"

# Optional — Vercel KV (enables caching + rate limiting)
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."

# Optional — AI providers (can also be configured per-user in Settings)
GEMINI_API_KEY="..."
DEEPSEEK_API_KEY="..."

# Optional — logging
LOG_LEVEL="debug"  # debug | info | warn | error
```

### Database setup

```bash
npx prisma generate
npx prisma db push
```

`pgvector` must be enabled on the target PostgreSQL instance for RAG embeddings to work.

### Development

```bash
npm run dev        # start dev server (Turbopack)
npm run test        # run tests (watch mode)
npm run test:run    # run tests once
npm run lint         # ESLint
```

### Production build

```bash
npm run build   # prisma db push + next build
npm start        # start production server
```

### Deployment (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables in the Vercel dashboard.
3. (Optional) Enable the Vercel KV add-on for caching and rate limiting.
4. Deploy — `prisma db push` runs automatically as part of the build script.

`vercel.json` sets a 60-second function timeout on the AI-heavy API routes and server actions.

## Testing

```bash
npm run test           # watch mode
npm run test:run        # single run
npm run test:coverage    # with coverage report
```

Current test suites (`src/__tests__/`) cover the typed error handler, the RAG chunking logic (`chunkText` edge cases), and cache key generation.

## API routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/experiments` | Create an experiment (authenticated) |
| PATCH | `/api/experiments/[id]` | Update an experiment |
| DELETE | `/api/experiments/[id]` | Delete an experiment |
| POST | `/api/experiments/[id]/submit` | Submit student worksheet answers |
| POST | `/api/upload` | File upload |
| * | `/api/auth/[...nextauth]` | NextAuth.js handlers |
| GET | `/api/adapter/health` | Adapter health check |
| POST | `/api/adapter/users/sync` | Sync users from an external platform |
| POST | `/api/adapter/classes/sync` | Sync classes from an external platform |
| POST | `/api/adapter/sso/launch` | Single sign-on launch |
| POST | `/api/adapter/entitlements/apply` | Apply subscription/entitlement state |
| GET | `/api/adapter/students/[globalUserId]/summary` | Per-student summary for an external platform |
| POST | `/api/adapter/events/export` | Export learning events |

Most other reads (experiment/simulation listings, dashboards) go through server components and server actions rather than REST endpoints.

## Project structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes (experiments, adapter, auth, upload)
│   ├── dashboard/               # Teacher dashboard (CRUD, settings, results)
│   ├── experiment/[slug]/       # Student experiment view + chatbot
│   ├── sandbox/                 # Simulation builder + community
│   ├── login/ & register/       # Auth pages
│   └── layout.tsx               # Root layout (analytics, themes, i18n)
├── components/
│   ├── simulations/              # Built-in simulations (cell, chemistry, friction, ...)
│   ├── ui/                        # Shadcn/UI components
│   ├── student-chatbot.tsx        # AI tutor interface
│   ├── simulation-runner.tsx       # Sandboxed simulation runner
│   └── export-button.tsx           # CSV export
├── lib/
│   ├── ai.ts                     # Multi-provider AI abstraction
│   ├── agents.ts                  # Multi-agent simulation pipeline
│   ├── ai-simulation.ts            # Simulation prompts, examples, auto-fix
│   ├── engine-scoring.ts            # Simulation engine routing
│   ├── template-packs/               # Subject/engine prompt templates
│   ├── auth-guards.ts                # RBAC + audit logging
│   ├── cache.ts                       # Vercel KV caching
│   ├── error-handler.ts                # Typed error classes + wrappers
│   ├── logger.ts                        # Pino structured logging
│   ├── prisma.ts                         # Database client
│   ├── rag.ts                             # RAG pipeline (chunk, embed, search)
│   ├── rate-limit.ts                       # Sliding-window rate limiter
│   ├── dictionary.ts                        # i18n dictionaries (en/zh-TW)
│   └── utils.ts                              # Shared utilities
├── __tests__/                  # Vitest test suites
└── middleware.ts                # Auth middleware
```
