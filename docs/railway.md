# Railway — Deploy na Railway

## Visão Geral

Produção roda na Railway com deploy automático via GitHub.

**URL**: `https://andre-luis-v2-production.up.railway.app`

## Configuração

### railway.json

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100
  },
  "volumes": [
    {
      "mountPath": "/app/server/data",
      "name": "data"
    }
  ]
}
```

### Componentes

| Componente | Configuração |
|-----------|-------------|
| **Build** | Dockerfile multi-stage |
| **Runtime** | node:22-alpine |
| **Porta** | 3001 (injetada via `PORT`) |
| **Volume** | `/app/server/data` (SQLite + backups) |
| **Healthcheck** | `GET /api/health` |
| **Restart** | ON_FAILURE, máx 10 tentativas |

## Variáveis de Ambiente

Configurar no painel Railway → Service → Variables:

### Obrigatórias

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (seguro, 256+ bits) |
| `SUPER_ADMIN_PASSWORD` | (seguro) |
| `DATABASE_PATH` | `/app/server/data/database.sqlite` |
| `CORS_ORIGIN` | `https://andre-luis-v2-production.up.railway.app` |
| `APP_URL` | `https://andre-luis-v2-production.up.railway.app` |
| `SEED` | `true` (cria super admin no boot) |

### Pagamentos

| Variável | Valor |
|----------|-------|
| `MERCADO_PAGO_ACCESS_TOKEN` | `APP_USR-...` |
| `MERCADO_PAGO_WEBHOOK_SECRET` | (secret do webhook) |

### Comunicação

| Variável | Valor |
|----------|-------|
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | `Transporte André Luis <onboarding@resend.dev>` |
| `EVOLUTION_API_URL` | (opcional) |
| `EVOLUTION_API_KEY` | (opcional) |
| `EVOLUTION_INSTANCE` | (opcional) |

### Push

| Variável | Valor |
|----------|-------|
| `VAPID_PUBLIC_KEY` | (gerar com `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | (correspondente) |
| `VAPID_SUBJECT` | `mailto:admin@transportesandreluis.com.br` |

### Backup Off-site

| Variável | Valor |
|----------|-------|
| `S3_BUCKET` | (bucket name) |
| `S3_ENDPOINT` | (R2/S3 endpoint) |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | (chave) |
| `S3_SECRET_ACCESS_KEY` | (segredo) |

## Deploy

### Automático

1. Push para `master`
2. Railway detecta mudança
3. Build Docker (3 estágios)
4. Deploy com healthcheck
5. Volume preservado entre deploys

### Manual

No painel Railway: Deploy → Deploy Now

## Logs

No painel Railway: Service → Logs

Logs também via Pino (JSON estruturado) — úteis para debugging.

## Monitoramento

- Healthcheck: `GET /api/health` (uptime, versão, memória)
- Logs estruturados via Pino
- Integration alerts para admins (Mercado Pago, email, WhatsApp)

## Troubleshooting

### 502 Bad Gateway

- Verificar logs do build
- Geralmente: `better-sqlite3` sem prebuild (verificar `npm ci` sem `--ignore-scripts`)

### Deploy falha

- Verificar variáveis de ambiente obrigatórias
- Verificar se o volume está montado

### Webhook não funciona

- Verificar `MERCADO_PAGO_WEBHOOK_SECRET`
- Verificar URL: `POST https://domínio/api/payments/webhook`
- Verificar evento: `payment`
