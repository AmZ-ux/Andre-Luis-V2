# Banco de Dados — Transporte André Luis

## Tecnologia

- **SQLite** via `better-sqlite3` 12.11.1 (fixa)
- **WAL mode** para concorrência de leitura
- **foreign_keys = OFF** para compatibilidade com seed/restore
- **busy_timeout = 5000ms**

## Schema (14 tabelas)

### Core

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários (admin, passenger) com credenciais |
| `passengers` | Dados dos passageiros (CPF, endereço, contrato) |
| `monthly_fees` | Mensalidades (status, valor, vencimento) |
| `payments` | Pagamentos registrados |
| `pix_charges` | Cobranças PIX criadas |

### Comunicação

| Tabela | Descrição |
|--------|-----------|
| `messages` | Mensagens enviadas |
| `message_templates` | Templates de mensagens |
| `message_history` | Histórico de envios |
| `notifications` | Notificações in-app |

### Outros

| Tabela | Descrição |
|--------|-----------|
| `availabilities` | Períodos de férias/ausência |
| `availability_history` | Histórico de alterações |
| `settings` | Configurações do sistema (JSON) |
| `audit_logs` | Auditoria de ações admin |
| `app_logs` | Logs de operações |

## Migrations

Migrations são **idempotentes** — cada `ALTER TABLE` está envolto em `try/catch` para ignorar erros "column already exists". Rodam automaticamente no boot via `runMigrations()`.

### Fluxo de Boot

```
initDatabase()
  → new Database(path)
  → pragma foreign_keys = OFF
  → pragma journal_mode = WAL
  → runMigrations()
      → db.exec(SCHEMA)           -- CREATE TABLE IF NOT EXISTS
      → ALTER TABLE ... ADD COLUMN (try/catch × 20+)
      → Backfill de dados antigos
      → Dedup de pagamentos (external_payment_id)
      → Dedup de pix_charges (pending)
      → Criar índices únicos
      → Configurações padrão
```

## Índices Únicos

| Índice | Tabela | Condição | Proteção |
|--------|--------|----------|----------|
| `idx_unique_fee_per_passenger` | `monthly_fees` | `(passenger_id, month, year)` | Uma fee por passageiro/mês/ano |
| `idx_payments_external` | `payments` | `(external_payment_id, entry_type)` WHERE NOT NULL | Dedup de pagamentos |
| `idx_one_pending_per_fee` | `pix_charges` | `(monthly_fee_id)` WHERE status='pending' | Uma cobrança pendente por fee |

## Regras de Integridade

### Mensalidades

- **UNIQUE**: `(passenger_id, month, year)` — impossível criar duas fees para o mesmo passageiro no mesmo mês
- **Status**: `pending` → `paid` (somente via gateway), `pending` → `overdue` (scheduler), `pending` → `cancelled`/`exempt` (admin)
- **Fail-safe**: se duplicatas históricas existirem, a migration detecta e LANÇA ERRO (não deleta dados)

### Pagamentos

- **entry_type**: `NORMAL` (quitamento), `SUBPAYMENT` (parcial), `OVERPAYMENT` (excedente)
- **Dedup**: `external_payment_id + entry_type` é único (evita processamento duplicado do webhook)
- **NÃO existem pagamentos manuais novos** — somente via gateway

### Pix Charges

- Uma cobrança `pending` por fee (índice parcial único)
- Cobranças `superseded` são marcadas quando uma nova é criada

## Backup

### Local

- Diretório: `BACKUP_DIR` (default `./data/backups`)
- Formato: JSON com todas as tabelas
- Frequência: diário 02:00 BRT + manual

### Off-site (S3/R2)

- Upload automático a cada backup
- Compressão gzip
- Retenção: `MAX_BACKUPS` (default 30)
- Configuração: `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

### Restore

- Via API: `POST /api/settings/restore` (admin)
- Via CLI: `npm run server:backup`
- **Atômico**: todos DELETEs e INSERTs dentro de `db.transaction()`
- Cria backup pré-restore automaticamente
