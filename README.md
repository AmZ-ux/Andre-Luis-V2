# Transporte André Luis

Sistema de gerenciamento de mensalidades de transporte escolar e passageiros — aplicação web completa (PWA) com área administrativa e área do passageiro.

> **Produção (Railway):** `https://andre-luis-v2-production.up.railway.app`

---

## Visão Geral

O sistema atende dois perfis de usuário:

| Perfil | Acessos |
|--------|---------|
| **Admin** | Dashboard financeiro, passageiros, mensalidades (geração automática, multa/juros), disponibilidade, comunicação (email/WhatsApp/push/notificação in-app), relatórios, configurações (empresa, cobrança, segurança, usuários, auditoria, logs, backups) |
| **Passageiro** | Painel próprio, minhas mensalidades (pagamento PIX via Mercado Pago ou cartão), minha disponibilidade (férias/ausências), notificações, perfil, encerramento de contrato |

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite 8 |
| Estilos | Tailwind CSS 4 (via plugin Vite) |
| Gráficos | Recharts 3 |
| Animações | Framer Motion |
| Roteamento | React Router DOM 7 (com `React.lazy` + Suspense) |
| Backend | Node.js 22 + Express 4 (ESM) |
| Banco de dados | SQLite via better-sqlite3 **12.11.1** (fixa — v13 não tem prebuilds) |
| Autenticação | JWT + bcrypt, rate limit + lockout, verificação de email |
| Testes | Vitest + Supertest (479 testes, 26 arquivos) |
| Lint | Oxlint |
| Logs | Pino (JSON estruturado) |
| Deploy | Docker multi-stage, Railway / Docker Compose |

## Arquitetura

Monorepo simples: frontend e backend no mesmo processo em produção (o Express serve o build do frontend).

```
Browser/PWA
    ↓
React frontend (Vite dev server em dev, static files em prod)
    ↓ HTTP (fetch via apiClient)
Express API (porta 3001)
    ↓
Services (mercadopagoService, emailService, whatsapp, push, backup...)
    ↓
SQLite (better-sqlite3, WAL mode, single replica)
```

### Estrutura de Pastas

```
.
├── src/                  # Frontend (React + Vite)
│   ├── components/       # Componentes por domínio + UI atômica (ui/)
│   │   ├── auth/         # Login, registro, perfil, sessão
│   │   ├── availability/ # Férias/ausências
│   │   ├── communication/ # Mensagens, templates, push
│   │   ├── dashboard/    # KPIs, gráficos, atividades
│   │   ├── layout/       # AppLayout, Sidebar, MobileNav
│   │   ├── monthlyFees/  # Cards, filtros, checkout PIX/cartão
│   │   ├── passengers/   # CRUD, cards, filtros
│   │   ├── reports/      # Gráficos, filtros, exportação
│   │   ├── settings/     # Empresa, billing, segurança, backups
│   │   └── ui/           # 26 componentes reutilizáveis
│   ├── hooks/            # 15 hooks de domínio
│   ├── pages/            # 25 páginas (admin + passageiro + auth + legal)
│   ├── services/         # apiClient + serviços de domínio
│   ├── types/            # Tipos TypeScript
│   ├── utils/            # cn, validators, errorReporter
│   └── styles/           # globals.css (Tailwind v4)
├── server/               # Backend (Express, ESM)
│   └── src/
│       ├── database/     # connection (WAL), schema (migrations), migrate
│       ├── middleware/   # auth (JWT), roles, validation, errorHandler
│       ├── routes/       # 12 módulos de rotas + webhook MP
│       ├── services/     # Mercado Pago, Resend, Evolution, web-push, backup S3, scheduler
│       └── utils/        # logger (pino)
├── scripts/              # build/deploy helpers (bat/sh)
├── docs/                 # Documentação detalhada
├── Dockerfile            # Multi-stage (frontend-build → server-build → runtime)
├── docker-compose.yml    # Volume persistente + healthcheck
└── railway.json          # Configuração do deploy Railway
```

### Banco de Dados (SQLite)

14 tabelas: `users`, `passengers`, `monthly_fees`, `payments`, `pix_charges`, `availabilities`, `availability_history`, `messages`, `notifications`, `settings`, `audit_logs`, `message_templates`, `message_history`, `app_logs`.

Migrations são **idempotentes** (try/catch) e rodam no boot (`runMigrations`). Índices únicos garantem: `monthly_fees(passenger_id, month, year)`, `payments(external_payment_id, entry_type)`, `pix_charges(monthly_fee_id) WHERE status='pending'`.

## Fluxos Principais

1. **Autenticação** — Login por email ou CPF (bcrypt + JWT 24h), lockout após tentativas falhas, verificação de email por código, recuperação de senha por link, auto-cadastro do passageiro
2. **Dashboard** — KPIs (passageiros, pendências, receita, adimplência), gráficos 7d/30d/12m, atividades recentes, próximos pagamentos
3. **Passageiros** — CRUD completo (admin); cadastro inicial via `/cadastro`; encerramento de contrato pelo passageiro (exige mensalidades quitadas)
4. **Mensalidades** — Geração automática por contrato (scheduler 09:00 BRT), cálculo de multa/juros (`billingRules`), status: pending/paid/overdue/cancelled/exempt
5. **Pagamento online** — Mercado Pago: PIX com QR Code + cartão via link; webhook `/api/payments/webhook` + polling a cada 10min
6. **Disponibilidade** — Períodos de férias/ausência (sem sobreposição, não retroativo), cancelamento com histórico
7. **Relatórios** — Financeiro (previsto/recebido/inadimplência), passageiros, disponibilidade
8. **Comunicação** — Mensagens com agendamento, templates, canais: email (Resend), WhatsApp (Evolution API), Web Push (VAPID), in-app
9. **Configurações** — Empresa, financeiro, cobrança, comunicação, segurança, sistema, auditoria, logs, backup/restore (diário 02:00 + manual, off-site S3/R2)

## Pré-requisitos

- Node.js **22.x** (Node 24+ quebra o `better-sqlite3` — sem prebuilds)
- npm 10+
- Docker (opcional, para deploy conteinerizado)

## Instalação Local

```bash
# 1. Clonar o repositório
git clone https://github.com/AmZ-ux/Andre-Luis-V2.git
cd Transportes André Luis

# 2. Instalar dependências (raiz instala o server via postinstall)
npm ci

# 3. Variáveis de ambiente
cp server/.env.example server/.env   # obrigatório: JWT_SECRET
cp .env.example .env                 # opcional — defaults já funcionam

# 4. Subir frontend + backend juntos
npm run dev:all
```

O frontend em modo dev aponta para a API via proxy do Vite (`/api` → `localhost:3001`). Com `VITE_REAL_API=false` (default em dev), o app roda em **modo mock** (dados em localStorage).

## Variáveis de Ambiente

Veja `.env.example` (frontend) e `server/.env.example` (servidor) para a lista completa.

Variáveis críticas para produção:

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `JWT_SECRET` | ✅ | Segredo dos tokens JWT |
| `SUPER_ADMIN_PASSWORD` | ✅ | Senha do super admin |
| `MERCADO_PAGO_ACCESS_TOKEN` | ✅ pagamentos | Token de produção |
| `RESEND_API_KEY` | ✅ email | Chave da Resend |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | ✅ push | Chaves VAPID |
| `S3_BUCKET` + credenciais | ✅ backup off-site | S3 ou Cloudflare R2 |

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Frontend em http://localhost:5173 |
| `npm run dev:server` | API em http://localhost:3001 |
| `npm run dev:all` | Frontend + backend juntos |
| `npm run build` | Build de produção (`tsc -b && vite build`) |
| `npm test` | 479 testes (vitest, inclui frontend + server) |
| `npm run lint` | Oxlint (0 errors) |
| `npm run typecheck` | TypeScript strict check |
| `cd server && npm run build` | Build do servidor |
| `cd server && npm run seed` | Seed do banco de dados |

## Testes

```bash
npm test              # 479 testes (26 arquivos)
npm run test:watch    # Modo watch
npm run test:coverage # Cobertura (v8)
```

Testes usam SQLite **in-memory** (`DATABASE_PATH=:memory:`) via Supertest. Cada arquivo de teste roda em isolamento com `resetDb()` entre testes.

Cobertura de testes por domínio:
- **Auth**: registro, login, lockout, verificação de email, recuperação de senha, end-contract
- **Passengers**: CRUD, autorização, self-service `/me`
- **Monthly Fees**: CRUD, geração automática, filtros, UNIQUE constraint, ensure-current
- **Payments**: finalização via gateway, webhook, PIX charges, deduplicação, overpayment
- **Availability**: CRUD, regras de sobreposição, retroactive check, cancelamento
- **Settings**: company, billing, audit, backup/restore, logs
- **Dashboard**: KPIs, chart 7d/30d/12m
- **Communication**: mensagens, templates, WhatsApp, push
- **Backup**: criação, restore atômico, off-site S3

## PWA

O app funciona como Progressive Web App:
- `manifest.json` com ícones e metadados
- Service Worker para cache offline
- Meta tags `apple-mobile-web-app-capable`
- Tema `#2563EB` (primary blue)
- Instalável na tela inicial do celular

Veja [docs/pwa.md](docs/pwa.md) para detalhes.

## Pagamentos (Regras Críticas)

> **NÃO existe pagamento manual.** O status `paid` é resultado exclusivo do gateway de pagamento (Mercado Pago) via `finalizePayment()`.

- SUBPAYMENT (pagamento parcial) **NÃO quita** a mensalidade
- OVERPAYMENT deve ser registrado como pagamento excedente
- Somente `finalizePayment()` pode marcar `monthly_fees.status = 'paid'`
- Administradores podem marcar como `cancelled` ou `exempt` — nunca `paid`

Veja [docs/payments.md](docs/payments.md) para o fluxo completo.

## Segurança

- Helmet (CSP `self`-only em produção), CORS restrito, rate limit global e por rota
- Login com bcrypt + lockout (5 tentativas / 15min) + rate limit
- JWT com expiração; sessão no cliente com timeout e logout em inatividade
- Validação de entrada em todas as rotas; SQL parametrizado
- Webhook do Mercado Pago **nunca confia no payload** — consulta o MP de volta
- Auditoria: `audit_logs` (settings/admin) e `app_logs` (ações operacionais)

Veja [docs/security.md](docs/security.md) para detalhes.

## Deploy

### Railway (recomendado — usado em produção)

1. Push para `master` → deploy automático (Dockerfile via `railway.json`)
2. Volume `data` montado em `/app/server/data` (persistência do SQLite e backups)
3. Variáveis do serviço configuradas no painel do Railway
4. Webhook do Mercado Pago: `POST https://SEU-DOMINIO/api/payments/webhook`

Veja [docs/railway.md](docs/railway.md) para guia completo.

### Docker

```bash
docker compose up -d --build
# requer JWT_SECRET e SUPER_ADMIN_PASSWORD no ambiente
```

## Estrutura de Branches

| Branch | Uso |
|--------|-----|
| `master` | Produção — deploy automático no Railway |
| `staging` | Homologação — testes antes de ir para produção |
| `feature/*` | Features em desenvolvimento |

## Documentação

| Arquivo | Descrição |
|---------|-----------|
| [docs/architecture.md](docs/architecture.md) | Arquitetura detalhada do sistema |
| [docs/setup-local.md](docs/setup-local.md) | Guia de setup local |
| [docs/deployment.md](docs/deployment.md) | Guia de deploy |
| [docs/database.md](docs/database.md) | Schema, migrations, índices |
| [docs/payments.md](docs/payments.md) | Fluxo de pagamentos e regras |
| [docs/security.md](docs/security.md) | Regras de segurança |
| [docs/testing.md](docs/testing.md) | Guia de testes |
| [docs/pwa.md](docs/pwa.md) | Configuração PWA |
| [docs/railway.md](docs/railway.md) | Deploy no Railway |
| [CHANGELOG.md](CHANGELOG.md) | Histórico de mudanças |
| [AGENTS.md](AGENTS.md) | Regras para assistentes de código |

## Licença

Uso interno — Transporte André Luis.
