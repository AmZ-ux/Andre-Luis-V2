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
| Testes | Vitest + Supertest (311 testes) |
| Lint | Oxlint |
| Logs | Pino (JSON estruturado) |
| Deploy | Docker multi-stage, Railway / Docker Compose |

## Arquitetura

Monorepo simples: frontend e backend no mesmo processo em produção (o Express serve o build do frontend).

```
.
├── src/                  # Frontend (React + Vite)
│   ├── auth/             # Contexto de autenticação, sessão (localStorage), serviço
│   ├── components/       # Componentes por domínio + UI atômica (ui/)
│   ├── config/           # Config centralizada (import.meta.env)
│   ├── constants/        # Navegação, permissões (RBAC), tema
│   ├── contexts/         # Tema e Toast globais
│   ├── guards/           # ProtectedRoute + PermissionGuard (RBAC)
│   ├── hooks/            # 15 hooks de domínio (mensalidades, passageiros, etc.)
│   ├── lib/              # Segurança, logger, monitoramento, backup, PWA
│   ├── pages/            # Páginas (admin + passageiro + auth + legal + erros)
│   ├── services/         # apiClient + realApi (camada real) + serviços de domínio
│   ├── styles/           # globals.css (Tailwind v4, tema claro/escuro)
│   ├── types/            # Tipos compartilhados
│   ├── utils/            # cn, transformKeys, validators, errorReporter
│   └── validators/       # Validação de formulários
├── server/               # Backend (Express, ESM)
│   ├── src/
│   │   ├── database/     # connection (WAL), schema (migrations idempotentes), migrate
│   │   ├── middleware/   # auth (JWT), roles, validation, errorHandler
│   │   ├── routes/       # 12 módulos de rotas + webhook MP
│   │   ├── services/     # Mercado Pago, Resend, Evolution, web-push, backup S3, scheduler...
│   │   └── utils/        # logger (pino)
│   └── scripts/          # backup.mjs (CLI de backup)
├── scripts/              # build/deploy helpers (bat/sh)
├── .github/workflows/    # CI (lint, typecheck, test, build, docker)
├── Dockerfile            # Multi-stage (frontend-build → server-build → runtime)
├── docker-compose.yml    # Volume persistente + healthcheck
└── railway.json          # Configuração do deploy Railway
```

### Banco de dados (SQLite)

Tabelas: `users`, `passengers`, `monthly_fees`, `payments`, `availabilities`, `availability_history`, `messages`, `notifications`, `settings`, `audit_logs`, `pix_charges`, `message_templates`, `message_history`, `app_logs`.

Migrations são **idempotentes** (try/catch) e rodam no boot (`runMigrations`).

## Fluxos Principais

1. **Autenticação** — Login por email ou CPF (bcrypt + JWT 24h), lockout após tentativas falhas, verificação de email por código, recuperação de senha por link, auto-cadastro do passageiro (valor da mensalidade vem do servidor, nunca do cliente)
2. **Dashboard** — KPIs (passageiros, pendências, receita, adimplência), gráficos 7d/30d/12m, atividades recentes, próximos pagamentos, notificações
3. **Passageiros** — CRUD completo (admin); cadastro inicial exclusivo via `/cadastro`; encerramento de contrato pelo próprio passageiro (exige mensalidades quitadas)
4. **Mensalidades** — Geração automática por contrato (scheduler diário 09:00), cálculo de multa/juros por dias de atraso (`billingRules`), status: pendente / paga / atrasada / cancelada / isenta, pagamento manual ou via gateway
5. **Pagamento online** — Mercado Pago: PIX com QR Code (payload copia-e-cola) e cartão via link de pagamento; cobranças em `pix_charges`; **webhook** `/api/payments/webhook` (com verificação reversa no MP) + conciliação por polling (a cada 10 min, com claim atômico diário)
6. **Disponibilidade** — Períodos de férias/ausência (sem sobreposição, não retroativo), cancelamento com histórico, contadores (em férias, retornando hoje, começando hoje)
7. **Relatórios** — Financeiro (previsto/recebido/inadimplência/por mês/por forma), passageiros (cidade/instituição/empresa/tipo), disponibilidade
8. **Comunicação** — Mensagens com agendamento, templates com variáveis `{{var}}`, canais: notificação in-app, **email (Resend)**, **WhatsApp (Evolution API)**, **Web Push (VAPID)**, agendados via cron
9. **Configurações** — Empresa, financeiro, cobrança (vencimento/multa/juros), comunicação, segurança, sistema, aparência (tema), gestão de admins, auditoria, logs, **backup/restore JSON** (diário 02:00 + manual, com upload off-site para S3/R2, retenção 30)

## Instalação

### Pré-requisitos

- Node.js **22.x** (Node 24+ quebra o `better-sqlite3` — sem prebuild)
- npm 10+
- Docker (opcional, para deploy conteinerizado)

### Desenvolvimento local

```bash
# 1. Instalar dependências (raiz instala o server via postinstall)
npm ci

# 2. Variáveis de ambiente
#    - servidor: cp server/.env.example server/.env
#    - frontend: cp .env.example .env   (opcional — defaults já funcionam)

# 3. Subir frontend + backend juntos (dev com hot reload)
npm run dev:all

# OU separados:
#   npm run dev          # frontend em http://localhost:5173
#   npm run dev:server   # API em http://localhost:3001
```

O frontend em modo dev aponta para a API via proxy do Vite (`/api` → `localhost:3001`). Com `VITE_REAL_API=false` (default em dev), o app roda em **modo mock** (dados em localStorage) — útil para demonstrações.

### Testes, lint e typecheck

```bash
npm test          # 311 testes (rotas com supertest + banco :memory:)
npm run test:watch
npm run lint      # oxlint (0 warnings/errors)
npm run typecheck # tsc --noEmit
npm run test:coverage
```

## Variáveis de Ambiente

### Servidor (`server/.env` — ver `server/.env.example`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `JWT_SECRET` | ✅ produção | Segredo dos tokens JWT |
| `SUPER_ADMIN_PASSWORD` | ✅ produção | Senha do super admin criada no seed |
| `SUPER_ADMIN_EMAIL` | produção | Email do super admin (default `admin@transporte.com`) |
| `SEED` | — | `true` cria o super admin no boot (idempotente, banco vazio) |
| `DATABASE_PATH` | — | Caminho do SQLite (default `./data/database.sqlite`) |
| `BACKUP_DIR` / `DATA_DIR` | — | Diretórios de dados/backups |
| `PORT` | — | Porta do Express (default 3001; Railway injeta `PORT`) |
| `CORS_ORIGIN` | produção | Origem permitida (ex: domínio do app) |
| `APP_URL` | produção | URL pública (links de email, back_urls do cartão) |
| `JWT_EXPIRES_IN` | — | Expiração do token (default 24h) |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | — | Lockout de login (defaults 5 / 15) |
| `GLOBAL_RATE_LIMIT_MAX` | — | Rate limit global /api (default 300) |
| `RESEND_API_KEY` | para email | Chave da Resend (verificação, forgot, notificações) |
| `RESEND_FROM` | — | Remetente (default `Transporte André Luis <onboarding@resend.dev>`) |
| `EMAIL_DISABLED` | — | `true` força modo demonstração (códigos via `demoCode` na UI) |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | para WhatsApp | Evolution API (sem elas, envio silencioso/mock) |
| `MERCADO_PAGO_ACCESS_TOKEN` | para pagamentos | Token de produção (`APP_USR-...`) |
| `MERCADO_PAGO_API_URL` | — | Default `https://api.mercadopago.com` (sandbox: `.../sandbox`) |
| `MP_PIX_EXPIRY_HOURS` | — | Expiração do PIX (default 24) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | para push | Gerar com `npx web-push generate-vapid-keys` |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PREFIX` | para backup off-site | S3 ou Cloudflare R2 |
| `MAX_BACKUPS` | — | Retenção de backups (default 30) |
| `LOG_LEVEL` | — | Nível de log pino |

### Frontend (`.env` — ver `.env.example` na raiz)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_APP_ENV` | `development` | Ambiente |
| `VITE_REAL_API` | `false` | `true` = usar API real; `false` = mock localStorage |
| `VITE_API_URL` | `/api` | Base URL da API (same-origin em produção) |
| `VITE_PORT` | `5173` | Porta do dev server |
| `VITE_SESSION_TIMEOUT` | `1800000` | Timeout da sessão (ms) |
| `VITE_MAX_LOGIN_ATTEMPTS` | `5` | Tentativas de login no cliente |
| `VITE_LOGIN_BLOCK_DURATION` | `900000` | Bloqueio após tentativas (ms) |
| `VITE_PAGE_SIZE` | `15` | Paginação padrão |
| `VITE_LOG_LEVEL` | `info` | Nível de log |
| `VITE_MONITORING_ENABLED` | `false` | Monitoramento de memória/storage |
| `VITE_MAX_BACKUPS` | `10` | Limite de backups na UI |
| `VITE_BACKUP_RETENTION_DAYS` | `30` | Retenção na UI |

> Produção (Docker/Railway): `VITE_REAL_API=true`, `VITE_API_URL=/api`, `VITE_APP_ENV=production` (injetados como `ARG` no Dockerfile).

## API — Endpoints principais

| Prefixo | Métodos | Acesso |
|---------|---------|--------|
| `/api/auth` | login, register, me, profile, verify-email, change-password, refresh, logout, forgot/reset-password, end-contract | Público (com rate limit) |
| `/api/passengers` | GET lista/detalhe, PUT, DELETE | Admin |
| `/api/monthly-fees` | GET/POST/PUT/DELETE, `/:id/pay`, `/ensure-current`, `/passenger/:id` | Admin + passageiro (próprias) |
| `/api/availability` | CRUD, cancel, summary, active, my | Admin + passageiro (próprias) |
| `/api/dashboard` | GET `/` e `/chart?period=7d\|30d\|12m` | Admin |
| `/api/communication` | messages, templates, schedules, whatsapp, push, notifications, preferences, channels | Admin + passageiro (notificações próprias) |
| `/api/settings` | settings, audit, users, backup/restore, logs | Admin |
| `/api/reports/overview` | Relatório consolidado | Admin |
| `/api/payments` | `POST /create`, `GET /status`, `POST /webhook` (público) | Autenticado + webhook público |
| `/api/admin` | admins, promote, demote, reset-data | Super admin |
| `/api/client-error` | POST (erros de runtime do frontend) | Público (rate limit) |
| `/api/health` | Status/uptime/versão | Público |

## Segurança

- Helmet (CSP `self`-only em produção), CORS restrito, rate limit global e por rota
- Login com bcrypt + lockout + rate limit (5/15min); `admin123` bloqueado em produção
- JWT com expiração; sessão no cliente com timeout e logout em inatividade
- Validação de entrada em todas as rotas; SQL parametrizado
- Webhook do Mercado Pago **nunca confia no payload** — consulta o MP de volta
- Auditoria: `audit_logs` (settings/admin) e `app_logs` (ações operacionais)
- Backup JSON criptografável por acesso autenticado (admin), download/restore com retenção
- Uploads de arquivos: **não existem mais** — pagamento é exclusivamente via gateway (Mercado Pago) ou registro manual de admin

## Docker

```bash
# Build da imagem multi-stage
docker build -t transporte-andre-luis .

# Subir com docker-compose (volume persistente + healthcheck)
docker compose up -d --build
# requer JWT_SECRET e SUPER_ADMIN_PASSWORD no ambiente
```

- Runtime: `node:22-alpine`, `npm ci --omit=dev` **sem `--ignore-scripts`** (necessário para o prebuild do `better-sqlite3` — linuxmusl-x64)
- Porta 3001; dados em `/app/data` (volume `server-data`)
- Healthcheck: `GET /api/health`

## Deploy

### Railway (recomendado — usado em produção)

1. Push para `master` → deploy automático (Dockerfile via `railway.json`)
2. Volume `data` montado em `/app/server/data` (persistência do SQLite e backups)
3. Variáveis do serviço: veja a tabela do servidor acima (não versionar segredos)
4. Domínio: `Settings → Networking → Generate Domain` ou domínio próprio
5. Webhook do Mercado Pago: `POST https://SEU-DOMINIO/api/payments/webhook` (evento `payment`)

### VPS com Docker

```bash
cp .env.example .env   # preencha JWT_SECRET, SUPER_ADMIN_PASSWORD etc.
docker compose up -d --build
```

Nginx reverso opcional: templates em `nginx.conf` / `nginx.ssl.conf` (substituir `example.com`).

## CI

`.github/workflows/ci.yml` — em todo push/PR para `main`/`master`: lint (oxlint) → typecheck → testes (vitest) → build (tsc + vite) → `docker compose build` (somente push direto).

## Backup

- **Automático:** cron diário 02:00 BRT (`scheduler.ts`) + backup manual em Configurações
- **Off-site:** upload gzip para S3/R2 se configurado; retenção `MAX_BACKUPS` (default 30)
- **Restore:** JSON em Configurações (admin) ou `npm run server:backup` no server

## Documentação Complementar

- `server/docs/BACKUP.md` — detalhes do sistema de backup
- `CHECKLIST_PRODUCAO.md` — checklist de produção
- `RELATORIO.md` — relatório de estado do projeto (feito/pendente) e passo a passo para 100%

## Licença

Uso interno — Transporte André Luis.