# Testes — Transporte André Luis

## Visão Geral

- **479 testes** em **26 arquivos**
- Framework: **Vitest** + **Supertest**
- Banco: SQLite **in-memory** (`DATABASE_PATH=:memory:`)
- Runner: Vitest 3.x com `vitest.config.ts` unificado

## Comandos

```bash
npm test              # Roda todos os testes (frontend + server)
npm run test:watch    # Modo watch
npm run test:coverage # Cobertura (v8 provider)
npm run lint          # Oxlint (0 errors)
npm run typecheck     # TypeScript strict
```

## Estrutura

### Root `vitest.config.ts`

Inclui **todos** os testes:
- `src/**/*.test.ts` (frontend: 5 arquivos, ~55 testes)
- `server/src/**/*.test.ts` (server: 21 arquivos, ~424 testes)

### Server `vitest.config.ts`

Apenas testes do server:
- `src/**/*.test.ts`
- `DATABASE_PATH=:memory:`
- `BACKUP_DIR` em diretório temporário do OS

## Arquivos de Teste

### Auth (auth.test.ts — 40 testes)

- Registro de usuário
- Login (email + CPF)
- Lockout após 5 tentativas
- Verificação de email
- Recuperação de senha
- End-contract

### Authorization (authorization.test.ts — 18 testes)

- Rotas admin bloqueiam passenger
- Passenger só acessa próprios dados
- Self-service `/me`

### Monthly Fees (monthlyFees.test.ts — 44 testes)

- CRUD completo
- Filtros (status, mês, ano)
- UNIQUE constraint (passenger/month/year)
- Ensure-current (geração sob demanda)
- Self-service `/me`
- Fail-safe dedup migration

### Payments (payments.test.ts — 42 testes)

- Finalização via gateway
- Webhook (assinatura HMAC)
- PIX charges
- Deduplicação
- Overpayment
- Validação de valores

### Availability (availability.test.ts — 13 testes)

- CRUD
- Regras de sobreposição
- Retroactive check
- Cancelamento com histórico

### Dashboard (dashboard.test.ts — 9 testes)

- KPIs
- Chart 7d/30d/12m
- Agregação de múltiplos passageiros

### Settings (settings.test.ts — 53 testes)

- Company, billing, communication
- Audit, logs
- Backup/restore

### Outros

| Arquivo | Testes | Descrição |
|---------|--------|-----------|
| admin.test.ts | 14 | Admin management |
| communication.test.ts | 18 | Mensagens, templates |
| passengers.test.ts | 34 | CRUD, self-service |
| reports.test.ts | 4 | Relatórios |
| staging.test.ts | 24 | Seed validation |
| backupService.test.ts | 7 | Backup, restore atômico |
| billingRules.test.ts | 9 | Multa/juros |
| feeAutomation.test.ts | 23 | Marcação overdue, subpayment |
| mercadopagoService.test.ts | 13 | Integração MP |
| push.test.ts | 4 | Web push |
| scheduler.test.ts | 8 | Cron jobs |
| webhookSignature.test.ts | 15 | HMAC verification |
| whatsapp.test.ts | 5 | Evolution API |
| apiClient.test.ts | 6 | Frontend API client |
| validators.test.ts | 25 | Validações frontend |
| transformKeys.test.ts | 9 | Transformação de dados |
| security.test.ts | 13 | Segurança frontend |
| dashboardIcons.test.ts | 2 | Ícones do dashboard |

## Escrevendo Testes

### Padrão

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { runMigrations } from '../database/schema.js'
import { resetDb, getDb } from '../database/connection.js'

process.env.DATABASE_PATH = ':memory:'

beforeAll(async () => {
  await runMigrations()
})

beforeEach(() => {
  resetDb()
})

it('deve retornar 200', async () => {
  const res = await request(app).get('/api/resource')
    .set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(200)
})
```

### Regras

1. Cada teste roda em isolamento (`resetDb()` antes de cada teste)
2. Tokens JWT são gerados por teste (`jwt.sign`)
3. Dados são criados via `seed*` helpers ou SQL direto
4. Nunca dependa de ordem de execução
5. Use `:memory:` — nunca banco real
