# Deploy — Transporte André Luis

## Railway (Produção)

### Fluxo

1. Push para `master` → deploy automático
2. Railway usa `railway.json` → `Dockerfile` multi-stage
3. Volume `data` montado em `/app/server/data`
4. Healthcheck em `/api/health`

### Variáveis de Ambiente (Railway)

Configurar no painel do Railway → Variables:

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `NODE_ENV` | ✅ | `production` |
| `PORT` | ✅ | `3001` (Railway injeta automaticamente) |
| `JWT_SECRET` | ✅ | Segredo forte (256+ bits) |
| `SUPER_ADMIN_PASSWORD` | ✅ | Senha do super admin |
| `DATABASE_PATH` | ✅ | `/app/server/data/database.sqlite` |
| `CORS_ORIGIN` | ✅ | Domínio do app |
| `APP_URL` | ✅ | URL pública do app |
| `MERCADO_PAGO_ACCESS_TOKEN` | ✅ | Token de produção |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ✅ | Secret do webhook HMAC |
| `RESEND_API_KEY` | ✅ | Chave Resend |
| `VAPID_*` | ✅ | Chaves VAPID para push |
| `S3_*` | ✅ | Configuração off-site backup |

### Webhook Mercado Pago

1. Mercado Pago → App → Webhooks
2. URL: `POST https://SEU-DOMINIO/api/payments/webhook`
3. Evento: `payment`
4. Secret Key: copiar para `MERCADO_PAGO_WEBHOOK_SECRET`

### Volume

O volume `data` em `/app/server/data` persiste:
- `database.sqlite` (banco de dados)
- `backups/` (backups JSON locais)

## Docker (VPS)

```bash
# Criar .env com variáveis obrigatórias
cp server/.env.example server/.env
# Editar com valores de produção

# Build e subir
docker compose up -d --build

# Logs
docker compose logs -f

# Parar
docker compose down
```

### Dockerfile Multi-Stage

```
Stage 1 (builder-frontend):
  node:22-alpine → npm ci → tsc -b && vite build

Stage 2 (builder-server):
  node:22-alpine → npm ci → tsc

Stage 3 (runtime):
  node:22-alpine → copiar dist de ambos → npm ci --omit=dev
  Porta 3001, healthcheck /api/health
```

> **IMPORTANTE:** `npm ci` no runtime NÃO usa `--ignore-scripts` — necessário para o prebuild nativo do `better-sqlite3`.

## Nginx (Opcional)

Templates em `nginx.conf` e `nginx.ssl.conf`:
- Proxy reverso para porta 3001
- Headers de segurança
- SSL/TLS (substituir `example.com`)

## CI/CD

`.github/workflows/ci.yml` — em todo push/PR:
1. Lint (oxlint)
2. Typecheck (tsc)
3. Testes (vitest)
4. Build (tsc + vite)
5. Docker compose build (apenas push direto)

## Staging

Branch `staging` para homologação:
- Deploy manual ou automático (configurar no Railway)
- Dados separados de produção
- Testes de integração antes de ir para master
