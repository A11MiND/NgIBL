# IBL Platform — Enterprise Inquiry-Based Learning

A production-grade **Inquiry-Based Learning** platform built with Next.js 16, featuring AI-powered tutoring, interactive simulations, RAG-enhanced context retrieval, and real-time analytics for STEM education.

**Live** → [ibl-five.vercel.app](https://ibl-five.vercel.app)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 App Router                │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────┐  │
│  │ Dashboard │  │Experiment│  │  Sandbox  │  │  API  │  │
│  │  (CRUD)  │  │ (Student)│  │(Sim Gen)  │  │Routes │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └───┬───┘  │
│       │              │              │             │      │
│  ┌────▼──────────────▼──────────────▼─────────────▼───┐  │
│  │              Server Actions / API Layer            │  │
│  │  Error Handling │ Rate Limiting │ Auth Guards      │  │
│  └────┬──────────────┬──────────────┬─────────────────┘  │
│       │              │              │                    │
│  ┌────▼────┐  ┌──────▼──────┐  ┌───▼────┐  ┌────────┐  │
│  │ Prisma  │  │  AI Layer   │  │ Cache  │  │  RAG   │  │
│  │   ORM   │  │Gemini/Deep- │  │Vercel  │  │pgvector│  │
│  │         │  │Seek/Ollama  │  │  KV    │  │        │  │
│  └────┬────┘  └─────────────┘  └────────┘  └────────┘  │
└───────┼─────────────────────────────────────────────────┘
        │
   ┌────▼─────────┐
   │  PostgreSQL   │
   │  + pgvector   │
   └──────────────┘
```

---

## Features

### For Teachers

| Feature | Description |
|---------|-------------|
| **Experiment Builder** | Create experiments with title, subject, simulation, AI context, and worksheet questions (MCQ, Short Answer, Long Answer, Fill-in-the-Blank) |
| **AI Question Generation** | One-click question generation using Gemini, DeepSeek, Qwen, or Ollama |
| **AI-Powered Analysis** | Class-wide and per-student analysis of submitted answers with caching |
| **Custom Simulations** | Write React or GeoGebra simulations in-browser with live preview |
| **Multi-Agent Sim Generation** | Planner → Code Generator → Validator → Refiner pipeline with self-healing |
| **Community Library** | Share simulations publicly, fork and modify others' work |
| **CSV Export** | Export all student submission data for gradebook integration |
| **QR Code Sharing** | Generate QR codes for students to access experiments |

### For Students

| Feature | Description |
|---------|-------------|
| **Interactive Simulations** | Manipulate physics, chemistry, and biology simulations with adjustable parameters |
| **AI Tutor** | Context-aware chatbot using RAG—guides without giving away answers |
| **Digital Worksheets** | Submit answers online with real-time validation |
| **Image Upload** | Attach photos/diagrams to long-answer questions |
| **Guest Access** | Preview experiments without account creation |

### Platform

| Feature | Description |
|---------|-------------|
| **Bilingual UI** | English ↔ Traditional Chinese (繁體中文) toggle |
| **Dark Mode** | System-aware with manual toggle |
| **Per-Function Model Selection** | Choose different AI models for simulation, chatbot, and analysis tasks |
| **RBAC** | Role hierarchy: Student → Teacher → Admin |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.1.6 (App Router, Turbopack, React 19) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL + pgvector (via Prisma 6.19) |
| **Auth** | NextAuth.js v5 (JWT, Credentials provider) |
| **AI** | Google Gemini, DeepSeek, Qwen, Ollama (multi-provider) |
| **RAG** | pgvector embeddings (768-dim), sentence-aware chunking |
| **Cache** | Vercel KV (Redis-compatible, free tier) |
| **Logging** | Pino (structured JSON in prod, pretty in dev) |
| **Styling** | Tailwind CSS 4 + Shadcn/UI + Radix primitives |
| **Charts** | Recharts 3.7 |
| **Simulations** | react-runner (sandboxed React execution) |
| **Testing** | Vitest + Testing Library |
| **Deployment** | Vercel (Analytics + Speed Insights) |
| **Validation** | Zod 4 |

---

## Enterprise Infrastructure

### Centralized Error Handling

All server actions and API routes use typed error classes with consistent `ActionResult<T>` responses:

```
AppError (base)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ValidationError (400)  — with optional field-level details
├── RateLimitError (429)   — with retryAfter
└── AIProviderError (502)  — with provider name
```

- `withErrorHandling()` wraps server actions → returns `{success, data} | {success: false, error}`
- `withApiErrorHandling()` wraps API routes → returns proper HTTP Response objects
- Production error messages are sanitized (no stack traces leak to clients)

### Structured Logging

Pino-based logging with automatic sensitive field redaction:

```typescript
logger.info({ experimentId }, 'Experiment created')
logAI('chatbot', { provider: 'gemini', model: 'gemini-2.0-flash', duration: 1200 })
logDB('query', { table: 'Experiment', duration: 45 })
logAuth('login', { email, success: true })
logRateLimit({ identifier: userId, action: 'chatbot', remaining: 15 })
```

- JSON format in production (Vercel log drain compatible)
- Pretty-printed in development
- Redacts: apiKey, password, token, secret, all provider keys

### Caching (Vercel KV)

Redis-compatible caching with graceful fallback when KV is not configured:

| Cache Key Pattern | TTL | Used For |
|---|---|---|
| `analysis:class:{id}` | 1 hour | Class analysis results |
| `analysis:student:{id}:{subId}` | 1 hour | Per-student analysis |
| `experiment:{id}` | 1 hour | Experiment data |
| `simulation:{id}` | 1 hour | Simulation data |
| `user:settings:{id}` | 1 hour | User preferences |

Cache invalidation triggers on experiment update, delete, and new submission.

### Rate Limiting

Sliding-window rate limiter via Vercel KV:

| Action | Limit | Window |
|--------|-------|--------|
| Chatbot messages | 20 | 1 min |
| AI Analysis | 5 | 5 min |
| Simulation generation | 10 | 10 min |
| Login attempts | 5 | 15 min |
| Registration | 3 | 1 hour |
| API requests | 100 | 1 min |

Graceful degradation: allows all requests when KV is unavailable.

### RBAC & Audit Logging

Role hierarchy with cumulative permissions:

```
STUDENT (0) → TEACHER (1) → ADMIN (2)
```

Guards: `requireAuth()`, `requireRole()`, `requireExperimentOwner()`, `requireSimulationOwner()`

All mutations log to `AuditLog` table (fire-and-forget, non-blocking).

### RAG Pipeline

Replaces naive context concatenation with semantic retrieval:

1. **Chunk** — Sentence-aware splitting (400 tokens, 50-token overlap)
2. **Embed** — Multi-provider embeddings (Gemini `text-embedding-004` free, DeepSeek, Ollama)
3. **Store** — pgvector `vector(768)` columns in PostgreSQL
4. **Search** — Cosine similarity via `<=>` operator, configurable min similarity threshold
5. **Fallback** — If no embeddings exist, uses full context string (backward compatible)

### Multi-Agent Simulation Generation

Self-healing pipeline for generating simulation code:

```
Planner → Code Generator → Validator → Refiner (up to 3 attempts)
```

- **Planner**: Breaks prompt into 3-7 implementation steps
- **Code Generator**: Produces React/GeoGebra code from plan
- **Validator**: Local syntax check (bracket matching, forbidden imports) + AI semantic validation
- **Refiner**: Fixes errors found by validator, resubmits to validator

---

## Database Schema

```
User ──────┬──→ Experiment ──┬──→ WorksheetQuestion
  │        │       │         └──→ StudentSubmission ──→ Answer
  │        │       └──→ Embedding (pgvector)
  │        └──→ Simulation (forks via parentId)
  └──→ AuditLog
```

**Key models**: User (with multi-provider AI config), Experiment (with AI context + simulation), Simulation (React/GeoGebra with community features), Embedding (768-dim vectors), AuditLog.

Comprehensive indexes on all models for query performance.

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL with pgvector extension
- (Optional) Vercel KV for caching and rate limiting
- At least one AI provider API key (Gemini recommended—free tier)

### Installation

```bash
git clone https://github.com/A11MiND/NgIBL.git
cd NgIBL
npm install
```

### Environment Variables

Create a `.env` file:

```env
# Required
DATABASE_URL="postgresql://user:password@host:5432/ibl?schema=public"
AUTH_SECRET="generate-with-openssl-rand-base64-32"

# Optional — Vercel KV (enables caching + rate limiting)
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."

# Optional — AI providers (configure per-user in Settings)
GEMINI_API_KEY="..."
DEEPSEEK_API_KEY="..."

# Optional — Logging
LOG_LEVEL="debug"  # debug | info | warn | error
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

> **Note**: pgvector extension must be enabled on your PostgreSQL instance for RAG embeddings. On Vercel Postgres, it's available by default.

### Development

```bash
npm run dev        # Start dev server (Turbopack)
npm run test       # Run tests (watch mode)
npm run test:run   # Run tests once
npm run lint       # ESLint
```

### Production Build

```bash
npm run build      # prisma db push + next build
npm start          # Start production server
```

### Deployment (Vercel)

1. Connect repo to Vercel
2. Set environment variables in Vercel dashboard
3. Enable Vercel KV addon (free tier: 30k requests/month)
4. Deploy — `prisma db push` runs automatically in build script

Function timeouts are configured to 60s in `vercel.json` for AI-heavy routes.

---

## Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes (experiments CRUD, auth, upload)
│   ├── dashboard/              # Teacher dashboard (CRUD, settings, results)
│   ├── experiment/[slug]/      # Student experiment view + chatbot
│   ├── sandbox/                # Simulation builder + community
│   ├── login/ & register/      # Auth pages
│   └── layout.tsx              # Root layout (analytics, themes, i18n)
├── components/
│   ├── simulations/            # Built-in sims (Cell, Chemistry, Friction)
│   ├── ui/                     # Shadcn/UI components
│   ├── student-chatbot.tsx     # AI tutor interface
│   ├── simulation-runner.tsx   # Sandboxed React runner
│   └── export-button.tsx       # CSV export
├── lib/
│   ├── ai.ts                   # Multi-provider AI abstraction
│   ├── agents.ts               # Multi-agent simulation pipeline
│   ├── auth-guards.ts          # RBAC + audit logging
│   ├── cache.ts                # Vercel KV caching
│   ├── error-handler.ts        # Typed error classes + wrappers
│   ├── logger.ts               # Pino structured logging
│   ├── prisma.ts               # Database client (connection pooling)
│   ├── rag.ts                  # RAG pipeline (chunk, embed, search)
│   ├── rate-limit.ts           # Sliding-window rate limiter
│   ├── dictionary.ts           # i18n dictionaries (en/zh-TW)
│   └── utils.ts                # Shared utilities
├── __tests__/                  # Vitest test suites
└── middleware.ts               # Auth middleware
```

---

## Testing

```bash
npm run test           # Watch mode
npm run test:run       # Single run
npm run test:coverage  # With coverage report
```

Coverage targets `src/lib/**/*.ts` and `src/app/**/actions.ts`.

Current test suites:
- Error handler — custom error classes, `withErrorHandling` wrapper
- RAG — `chunkText` edge cases (empty input, splitting, overlap, size limits)
- Cache — `CacheKeys` generation

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/experiments` | List published experiments |
| POST | `/api/experiments` | Create experiment (authenticated) |
| PATCH | `/api/experiments/[id]` | Update experiment |
| DELETE | `/api/experiments/[id]` | Delete experiment |
| POST | `/api/experiments/[id]/submit` | Submit student answers |

All routes use `withApiErrorHandling` for consistent error responses and structured logging. Mutations include audit logging and cache invalidation.

---

## License

MIT
