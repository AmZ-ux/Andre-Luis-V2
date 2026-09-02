# Arquitetura — Transporte André Luis

## Visão Geral

Monorepo com frontend React e backend Express, rodando no mesmo processo em produção.

```
┌─────────────────────────────────────────────────┐
│                   Browser / PWA                  │
│  React 19 + React Router + Tailwind CSS 4       │
└───────────────────┬─────────────────────────────┘
                    │ HTTP (fetch)
                    │ /api/*
┌───────────────────▼─────────────────────────────┐
│              Express API (porta 3001)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Routes   │ │Middleware│ │    Services      │ │
│  │ 12 módulos│ │ auth     │ │ mercadopago      │ │
│  │ + webhook │ │ roles    │ │ email (Resend)   │ │
│  │           │ │ validate │ │ WhatsApp (Evol.) │ │
│  │           │ │ errors   │ │ push (VAPID)     │ │
│  │           │ │          │ │ backup (S3)      │ │
│  │           │ │          │ │ scheduler        │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│                    │                             │
│              ┌─────▼─────┐                      │
│              │   SQLite   │                      │
│              │ (better-   │                      │
│              │ sqlite3)   │                      │
│              │ WAL mode   │                      │
│              └───────────┘                      │
└─────────────────────────────────────────────────┘
```

## Integrações Externas

```
Mercado Pago ──── PIX QR Code + Cartão (link hospedado)
                  Webhook → /api/payments/webhook
                  Polling → a cada 10min (conciliação)

Evolution API ─── WhatsApp (mensagens, notificações)

Resend ────────── Email (verificação, forgot password, notificações)

Cloudflare R2 ─── Backup off-site (S3-compatible)

VAPID ─────────── Web Push (notificações no celular)

Railway ───────── Deploy, volume persistente, healthcheck
```

## Frontend (`src/`)

### Camadas

| Camada | Responsabilidade | Exemplo |
|--------|-----------------|---------|
| **pages/** | Composição de componentes, rotas | `Mensalidades.tsx` |
| **components/** | UI específica por domínio | `MonthlyFeeCard.tsx` |
| **components/ui/** | Componentes genéricos reutilizáveis | `Button`, `Modal`, `Card` |
| **hooks/** | Lógica de estado e efeitos | `useMonthlyFees` |
| **services/** | Chamadas à API, transformação de dados | `monthlyFeeService.ts` |
| **types/** | Definições TypeScript | `monthlyFee.ts` |
| **utils/** | Funções puras | `validators.ts`, `cn.ts` |

### Roteamento

React Router DOM 7 com lazy loading em todas as páginas:

```tsx
// src/router.tsx
const Mensalidades = React.lazy(() => import('./pages/Mensalidades'))
```

### Autenticação (Frontend)

- `AuthContext` — estado global de autenticação
- `ProtectedRoute` — verificação de token
- `PermissionGuard` — RBAC (admin vs passenger)
- Token armazenado em `localStorage`
- Timeout de sessão (logout automático)

## Backend (`server/src/`)

### Camadas

| Camada | Arquivos | Responsabilidade |
|--------|----------|-----------------|
| **routes/** | 12 módulos | Definição de endpoints, validação de input |
| **middleware/** | 4 arquivos | JWT auth, RBAC, validação, error handling |
| **services/** | 16 módulos | Lógica de negócio, integrações externas |
| **database/** | 3 arquivos | Conexão SQLite, schema, migrations |
| **utils/** | 1 arquivo | Logger (Pino) |

### Rotas Principais

| Prefixo | Módulo | Acesso |
|---------|--------|--------|
| `/api/auth` | Autenticação | Público (rate limit) |
| `/api/passengers` | Passageiros | Admin |
| `/api/monthly-fees` | Mensalidades | Admin + passenger (próprias) |
| `/api/payments` | Pagamentos | Autenticado + webhook público |
| `/api/availability` | Disponibilidade | Admin + passenger (próprias) |
| `/api/dashboard` | Dashboard | Admin |
| `/api/communication` | Comunicação | Admin + passenger (notificações) |
| `/api/settings` | Configurações | Admin |
| `/api/reports` | Relatórios | Admin |
| `/api/admin` | Admin management | Super Admin |
| `/api/payments/webhook` | Webhook MP | Público (HMAC verificado) |

### Middleware Stack

```
Request → Helmet → CORS → JSON Parser → Rate Limit → Router → Response
                                  ↓
                           authMiddleware (JWT verify)
                                  ↓
                           roleMiddleware (admin/passenger)
                                  ↓
                           Route Handler
                                  ↓
                           errorHandler (catch all)
```

## SQLite

- **WAL mode** para concorrência de leitura
- **Migrations idempotentes** (try/catch em cada ALTER TABLE)
- **foreign_keys = OFF** para compatibilidade com seed/restore
- **busy_timeout = 5000ms** para lidar com concorrência
- **Volume persistente** em produção (`/app/server/data`)

### Índices Únicos

| Tabela | Índice | Proteção |
|--------|--------|----------|
| `monthly_fees` | `(passenger_id, month, year)` | Uma fee por passageiro/mês/ano |
| `payments` | `(external_payment_id, entry_type)` WHERE NOT NULL | Dedup de pagamentos |
| `pix_charges` | `(monthly_fee_id)` WHERE status='pending' | Uma cobrança pendente por fee |

## Deploy

```
git push origin master
       ↓
Railway detecta push
       ↓
Dockerfile multi-stage:
  Stage 1: node:22-alpine → npm ci (frontend) → tsc + vite build
  Stage 2: node:22-alpine → npm ci (server) → tsc
  Stage 3: node:22-alpine → runtime (copiar dist de ambos)
       ↓
Healthcheck: GET /api/health
       ↓
Volume: /app/server/data (SQLite + backups)
```
