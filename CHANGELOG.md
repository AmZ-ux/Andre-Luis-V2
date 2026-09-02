# Changelog — Transporte André Luis

Histórico de mudanças agrupadas por domínio.

---

## Auth

| Commit | Data | Descrição |
|--------|------|-----------|
| `61efd87` | 2025 | Verificação de email opcional + `EMAIL_DISABLED` para demos |
| `2b526ad` | 2025 | Verificação de email obrigatória para passageiros + emails reais (Resend) |
| `9ef87e0` | 2025 | Lockout de conta após 5 tentativas + validação POST /monthly-fees |
| `45dba9e` | 2025 | Frontend route guards baseados em role |
| `b930b3c` | 2026-09 | Timeout de lock test aumentado (bcryptjs puro JS) |

## Passengers

| Commit | Data | Descrição |
|--------|------|-----------|
| `d1689ff` | 2025 | Autorização por papel (requireAdmin) |
| `b9ad62c` | 2025 | Dashboard do passageiro + self-service profile |
| `dcd8a12` | 2025 | Hard delete restrito a super admin |
| `81b38e5` | 2025 | Validação de status do passageiro + proteção de deleção |

## Monthly Fees

| Commit | Data | Descrição |
|--------|------|-----------|
| `1aba13b` | 2025 | Mensalidade por contrato (primeiro vencimento 1 mês após início) |
| `9a9c8f5` | 2025 | Mensalidades de responsabilidade do passageiro |
| `912e34d` | 2025 | Primeira mensalidade criada no mês atual do cadastro |
| `7ebf175` | 2025 | Rejeição de status=paid no PUT admin (gateway-only) |
| `39a1b9a` | 2025 | Endpoint self-service /me |
| `b930b3c` | 2026-09 | UNIQUE constraint (passenger/month/year) fail-safe + dedup migration |

## Payments

| Commit | Data | Descrição |
|--------|------|-----------|
| `7e2fa11` | 2025 | Automação de pagamentos, PIX Stripe |
| `5740802` | 2025 | Troca Asaas por Mercado Pago (PIX + cartão) |
| `955eb83` | 2025 | Remoção de fee settlement manual |
| `17070d0` | 2025 | Validação de valor recebido antes de processar |
| `96634be` | 2025 | Prevenção de PIX charges duplicados + overpayments |
| `63f1597` | 2026-08 | Validação de assinatura do webhook + bind de payment ID |
| `b930b3c` | 2026-09 | SUBPAYMENT não impede mais marcação como overdue |

## PIX

| Commit | Data | Descrição |
|--------|------|-----------|
| `96634be` | 2025 | PIX charges deduplicados + rastreamento de overpayments |
| `fff05d6` | 2025 | Expiração de PIX (cobranças >24h marcadas expired) |

## Security

| Commit | Data | Descrição |
|--------|------|-----------|
| `46f7c41` | 2025 | Webhook Asaas com token de autenticação |
| `5740802` | 2025 | Webhook MP com verificação reversa |
| `ab1c845` | 2025 | CSP habilitada, rate limit global, admin123 bloqueado |
| `81b38e5` | 2026-08 | Validação de status do passageiro + proteção de audit deletion |
| `4173be4` | 2026-08 | Operações destrutivas de backup restritas a super admin |

## Database

| Commit | Data | Descrição |
|--------|------|-----------|
| `53eb12e` | 2025 | sql.js trocado por better-sqlite3 (WAL) |
| `9ef87e0` | 2025 | Colunas failed_login_attempts/locked_until + cascade delete |
| `b930b3c` | 2026-09 | Índices únicos (payments, pix_charges, monthly_fees) |

## Backup

| Commit | Data | Descrição |
|--------|------|-----------|
| `fff05d6` | 2025 | Backup off-site via S3/R2 (gzip + retenção) |
| `4173be4` | 2026-08 | Backup/restore restrito a super admin |
| `b930b3c` | 2026-09 | Restore atômico (db.transaction) |

## Communication

| Commit | Data | Descrição |
|--------|------|-----------|
| `8992eb5` | 2025 | WhatsApp via Evolution API |
| `e827bef` | 2025 | Notificações reais (push VAPID + in-app) |
| `fff05d6` | 2025 | Canais de comunicação reais (email Resend) |

## PWA

| Commit | Data | Descrição |
|--------|------|-----------|
| `e6a384f` | 2025 | Lazy loading de todas as páginas (bundle 1.28MB → 513KB) |
| `273ac8e` | 2025 | Imports namespace lucide otimizados (643KB → 24KB) |

## UI/UX

| Commit | Data | Descrição |
|--------|------|-----------|
| `a9f97e0` | 2025 | Correção de textos da página de mensalidades |
| `9a9c8f5` | 2025 | Unificação de cards, chips, tabs e menus ao design system |
| `e189b6f` | 2025 | Redesign completo — identidade app financeiro |
| `2319dba` | 2025 | Dashboard: resumo financeiro limpo |
| `b80c9b5` | 2025 | Barra inferior mobile com brecha interna |

## Infrastructure

| Commit | Data | Descrição |
|--------|------|-----------|
| `c92bca5` | 2025 | Fix Dockerfile: runtime sem --ignore-scripts |
| `c8bd760` | 2025 | Deploy único no Railway (remove Vercel) |
| `53eb12e` | 2025 | Volume persistente no Railway |
| `0479dc5` | 2026-08 | Seed roda de runtime compilado |

## Staging

| Commit | Data | Descrição |
|--------|------|-----------|
| `3c8e0ce` | 2026-08 | Seed seguro + suite de validação |
| `0479dc5` | 2026-08 | Seed de runtime compilado |
