# RELATÓRIO DE ESTADO — Transporte André Luis

> Data: 17/08/2026 · Documento vivo — atualizar a cada marco concluído.

---

## 1. Resumo Executivo

O sistema está **funcionando em produção** (Railway: `https://andre-luis-v2-production.up.railway.app`), com build Docker OK, health check verde e 311 testes automatizados passando. O app é um monorepo React 19 + Express 4 + SQLite, com pagamentos via **Mercado Pago** (PIX QR Code + cartão por link), comunicação multicanal (email/WhatsApp/push/in-app) e backup automatizado.

**Nível atual de prontidão estimado: ~80%.** O que falta para 100% é majoritariamente **configuração de contas externas** (chaves já previstas no código), validação de fluxos de produção, qualidade (E2E/monitoramento) e melhorias de backlog.

---

## 2. Estado Atual (métricas)

| Métrica | Valor |
|---------|-------|
| Testes automatizados | **311 passando** (24 arquivos) |
| Lint (oxlint) | 0 warnings / 0 errors |
| Typecheck (tsc) | limpo |
| Build de produção | OK (`tsc -b && vite build`) |
| Bundle inicial (gzip) | ~168 KB (lazy loading em todas as páginas) |
| Produção | Health `healthy`, frontend HTTP 200, auth ativa (401 sem token) |
| Banco de dados | SQLite (WAL) — migrations idempotentes no boot |
| CI | lint → typecheck → test → build → docker compose build |

---

## 3. O Que Já Foi Feito

### 3.1 Saneamento do ambiente (Fase 0) — CONCLUÍDA
- Node.js **22.23.2** + Git 2.55 instalados (Node 24+ quebra `better-sqlite3`)
- `better-sqlite3` **pinado em 12.11.1** (v13.0.3 não tem prebuilds Windows/Alpine)
- `npm ci` limpo na raiz e no server; suíte completa verde
- Removidos artefatos órfãos: `dist` de sessões antigas, PDFs placeholder, rotas mortas (Asaas/Stripe/PIX antigos), variáveis mortas (TWILIO/SMTP) do `.env`
- `server/.env` reescrito alinhado ao `.env.example`

### 3.2 Comprovantes — IMPLEMENTADO E DEPOIS REMOVIDO (decisão do cliente)
- Fluxo completo de upload/aprovação de comprovantes foi implementado (Fase 3) e testado (13 testes)
- **Removido por decisão do cliente** (commit `3f85601`): com gateway de pagamento, receber/aprovar comprovante é redundante. Removidos: rotas `/api/receipts`, middleware multer, `ReceiptViewer`, campo `receipt`/`receipt_status` (schema/API/UI), badges de status, upload no `ManualPaymentModal`, 13 testes e a dependência `multer`

### 3.3 Performance (Fase 4) — CONCLUÍDA
- `React.lazy` + Suspense em **todas** as páginas (`src/router.tsx`)
- Bundle inicial: **1.28 MB → 513 KB bruto (~168 KB gzip)**
- `index.js`: 430 KB → 76 KB; `recharts` (441 KB) só carrega no dashboard/relatórios

### 3.4 Deploy (Fase 2 — parcial) — CONCLUÍDA A PARTE CRÍTICA
- **Fix do Dockerfile** (commit `c92bca5`): runtime `npm ci` sem `--ignore-scripts` — o prebuild nativo do `better-sqlite3` (ABI `node-v127`, `linuxmusl-x64`) nunca era baixado, causando crash no boot e **502 desde o primeiro deploy**. Após o fix: app **no ar** (health verde)
- Commit + push do repositório (branch `master`) — Railway conectado ao GitHub com deploy automático

### 3.5 Segurança e infraestrutura (já existentes no repo)
- Helmet + CSP self-only em produção, CORS restrito, rate limit global e por rota
- Login: bcrypt + JWT 24h + lockout (5 tentativas/15 min) + verificação de email
- Webhook MP com verificação reversa (nunca confia no payload)
- Auditoria (`audit_logs`) + logs pino JSON + `app_logs`
- Backup diário 02:00 + manual, restore, upload off-site S3/R2, retenção 30
- PWA (service worker + manifest), tema claro/escuro, responsivo

---

## 4. O Que Ainda Falta (por fase)

> Ordem sugerida: 1 → 2 → 3 → 4. Cada item tem passo a passo na seção 5.

| # | Item | Prioridade | Esforço | Bloqueado por |
|---|------|-----------|---------|---------------|
| 1 | Chaves de integração no Railway (MP, Resend, VAPID, Evolution, S3) | 🔴 Alta | 1–2 h | Contas do cliente |
| 2 | Webhook do Mercado Pago configurado | 🔴 Alta | 10 min | Item 1 (token) |
| 3 | Validação E2E em produção (login, PIX, cartão, comunicação) | 🔴 Alta | 1 h | Item 1 |
| 4 | Domínio próprio + SSL | 🟠 Média | 30 min | Compra do domínio |
| 5 | Playwright E2E (login, CRUD, pagamento, disponibilidade) | 🟠 Média | 1 dia | — |
| 6 | Sentry (erros de produção) | 🟠 Média | 30 min | Conta Sentry |
| 7 | CI com deploy automático no Railway | 🟠 Média | 1 h | Token Railway |
| 8 | Lighthouse/performance em produção | 🟢 Baixa | 30 min | Item 4 |
| 9 | Backlog de melhorias (seção 4.4) | 🟢 Baixa | variado | — |

### 4.1 Pendências de integração (alta prioridade)

| Integração | Estado | O que falta |
|------------|--------|-------------|
| **Mercado Pago** | Código pronto (`mercadopagoService`, PIX QR + cartão por link, webhook + polling) | `MERCADO_PAGO_ACCESS_TOKEN` **de produção** no Railway; webhook registrado; teste real de PIX |
| **Resend (email)** | Código pronto (`emailService`) | `RESEND_API_KEY`; verificar remetente `RESEND_FROM`; domínio verificado na Resend para sair do `onboarding@resend.dev` |
| **Web Push (VAPID)** | Código pronto (`push.ts` + hook) | Gerar chaves (`npx web-push generate-vapid-keys`) e preencher `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` |
| **Evolution API (WhatsApp)** | Código pronto (`whatsapp.ts`, mock silencioso sem config) | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` de uma instância real |
| **S3/R2 (backup off-site)** | Código pronto (`backupService`) | Bucket + credenciais; backups hoje ficam só no volume do Railway |

### 4.2 Pendências de qualidade

- **Playwright E2E**: não existe nenhum teste de ponta a ponta (o CI cobre lint/typecheck/test/build)
- **Sentry**: nenhum rastreamento de erros em produção (só `client-error` no pino)
- **CI deploy**: o CI valida, mas quem publica é o push manual; não há deploy automático com token Railway
- **Lighthouse**: performance nunca medida em produção
- **Testes de cobertura**: sem meta definida (coverage existe via vitest, mas sem threshold)

### 4.3 Pendências de produção

- **Deploy do commit mais recente**: verificar no painel Railway se o deployment do commit `3f85601` (remoção comprovantes) concluiu — em monitoramento
- **Domínio próprio**: hoje usa subdomínio grátis do Railway (SSL automático); domínio próprio dá credibilidade e evita mudanças de URL
- **Backup do volume**: o SQLite vive no volume do Railway; validar restore manual em cenário de desastre
- **Teste real do cartão**: link de cartão MP exige `APP_URL` correto (back_urls)

### 4.4 Backlog de melhorias (baixa prioridade)

- Migrar SQLite → **PostgreSQL** (Railway oferece; melhor concorrência/backup)
- **Boletos** como forma de pagamento (MP suporta)
- **Cobrança automática** de inadimplentes (agendamento de mensagens/links)
- **Importação em massa** de passageiros (CSV)
- **Multi-empresa** (hoje o app é de uma transportadora)
- Notificações **WhatsApp com mídia** (recibos, lembretes com anexo)
- Remover arquivos não roteados (`src/pages/Dashboard.tsx`, `CentralDisponibilidade.tsx`, `Relatorios.tsx`) ou roteá-los
- Padronizar `/api/availability` (rota) vs `/api/availabilities` (usada só nos testes)
- Templates `nginx.conf`/`nginx.ssl.conf` atualizar para o app atual (usados só em VPS)
- `CHECKLIST_PRODUCAO.md` está desatualizado (menciona comprovantes — atualizar)

---

## 5. Passo a Passo Detalhado para 100%

### Etapa 1 — Mercado Pago (pagamentos reais) — 🔴

1. Acesse `https://developers.mercadopago.com.br` → selecione a aplicação → **Credenciais de produção**
2. Copie o `Access Token` (formato `APP_USR-...`)
3. Painel Railway → serviço → **Variables** → adicione/atualize:
   - `MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...`
   - `MERCADO_PAGO_API_URL=https://api.mercadopago.com` (sem `/sandbox`)
   - `APP_URL=https://SEU-APP.up.railway.app`
4. **Webhook** (após redeploy): `developers.mercadopago.com.br` → App → **Webhooks** → URL: `https://SEU-APP.up.railway.app/api/payments/webhook`, evento **`payment`**, ativar
5. Redeploy (ou aguardar o automático) e validar na Etapa 3

### Etapa 2 — Demais integrações — 🔴

**Resend (email):**
1. Crie conta em `resend.com` → **API Keys** → chave `re_...`
2. (Recomendado) Adicione e verifique o domínio (DNS) para enviar de `Transporte André Luis <noreply@SEU-DOMINIO>`; enquanto não verificar, use o `onboarding@resend.dev`
3. Railway → Variables: `RESEND_API_KEY=re_...`, `RESEND_FROM=Transporte André Luis <onboarding@resend.dev>`
4. Teste: tela de login → "Esqueci minha senha" → deve chegar email com link

**Web Push (VAPID):**
1. No terminal: `npx web-push generate-vapid-keys` → copie as duas chaves
2. Railway → Variables: `VAPID_PUBLIC_KEY=...`, `VAPID_PRIVATE_KEY=...`, `VAPID_SUBJECT=mailto:seu@email.com`
3. Teste: logado → Configurações/Notificações → permitir push → enviar mensagem de teste

**WhatsApp (Evolution API):**
1. Tenha uma instância Evolution (ex: `evolution-api.com` ou self-hosted) com QR code conectado
2. Railway → Variables: `EVOLUTION_API_URL=https://...`, `EVOLUTION_API_KEY=...`, `EVOLUTION_INSTANCE=nome-da-instancia`
3. Teste: Central de Comunicação → enviar WhatsApp avulso (sem essas variáveis o envio é mock silencioso)

**Backup off-site (Cloudflare R2 gratuito):**
1. `dash.cloudflare.com` → R2 → crie bucket `andre-luis-backups` → **Manage R2 API Tokens** → token com permissão de leitura/escrita no bucket
2. Railway → Variables: `S3_BUCKET=andre-luis-backups`, `S3_ENDPOINT=https://<conta>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID=...`, `S3_SECRET_ACCESS_KEY=...`, `S3_PREFIX=backups`, `MAX_BACKUPS=30`
3. Teste: Configurações → Backup → "Criar backup" → deve aparecer `offsite: true`

### Etapa 3 — Validação E2E em produção — 🔴

Com as chaves no lugar, validar na URL de produção:

1. **Admin**: login → dashboard carrega (KPIs + gráficos) → criar passageiro → mensalidade gerada automaticamente
2. **Pagamento PIX**: abrir a mensalidade → PIX → QR Code aparece → simular pagamento real (PIX de valor baixo) → webhook/polling marca como pago (até 10 min)
3. **Pagamento cartão**: abrir mensalidade → cartão → link do MP abre → pagar com cartão de teste → status pago
4. **Passageiro**: cadastro novo via `/cadastro` → verifica email → login → painel próprio → "minhas mensalidades"
5. **Comunicação**: enviar notificação in-app (instantânea), email (chega), push (chega no navegador), WhatsApp (chega se configurado)
6. **Disponibilidade**: criar férias → aparece no summary do admin → cancelar
7. **Relatórios**: `/relatorios` → dados coerentes com o financeiro
8. **Backup**: criar → baixar → restaurar → dados voltam
9. **Sessão**: deixar inativo → timeout → logout automático

### Etapa 4 — Domínio próprio (opcional, recomendado) — 🟠

1. Compre domínio (ex: `transportesandreluis.com.br` ~R$ 40/ano)
2. Railway → serviço → Settings → **Networking → Custom Domain** → adicione o domínio
3. Siga as instruções de DNS (registrar CNAME `www` → domínio do Railway)
4. O Railway emite SSL automático (Let's Encrypt) — HTTPS imediato
5. Atualize no Railway: `CORS_ORIGIN`, `APP_URL` para o novo domínio
6. Atualize o webhook do MP e o `RESEND_FROM` se aplicável

### Etapa 5 — Playwright E2E — 🟠 (1 dia)

1. `npm i -D @playwright/test` + `npx playwright install chromium`
2. Criar `e2e/` com specs: `auth.spec.ts` (login, cadastro, forgot), `passengers.spec.ts` (CRUD), `fees.spec.ts` (geração, pagamento manual), `availability.spec.ts`, `communication.spec.ts`
3. Configurar baseURL para o dev server (`npm run dev:all`) e para produção (variável `BASE_URL`)
4. Adicionar job no CI: `npx playwright install --with-deps && npx playwright test`
5. Meta: cobrir os fluxos da Etapa 3 de forma automatizada

### Etapa 6 — Sentry — 🟠 (30 min)

1. Crie conta em `sentry.io` → projeto JS/Vite → copie o DSN
2. Frontend: `npm i -D @sentry/vite-plugin` + `@sentry/react`; inicializar em `main.tsx` (condicionado a produção)
3. Backend: `npm i @sentry/node` no server; inicializar em `index.ts` com `SENTRY_DSN` (variável opcional)
4. Railway → Variables: `SENTRY_DSN=...` (server); frontend embutido no build via env
5. Validar: forçar erro → aparece no Sentry

### Etapa 7 — CI com deploy automático — 🟠 (1 h)

1. Railway → **Settings → API/CLI** → copie o **Account Token** (ou use `railway token`)
2. GitHub → repo → Settings → **Secrets and variables** → `RAILWAY_TOKEN`
3. Em `.github/workflows/ci.yml`, após o job `docker`, adicionar:
   ```yaml
   deploy:
     needs: [docker]
     if: github.ref == 'refs/heads/master' && github.event_name == 'push'
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: railwayapp/railway-action@v3
         with:
           railway_token: ${{ secrets.RAILWAY_TOKEN }}
   ```
   (Ajustar `serviceId`/`projectId` se o repo tiver múltiplos serviços; hoje o push manual já dispara deploy — este passo é para ter o token versionado no GitHub e deploy explícito)
4. Testar: push em `master` → CI valida → deploy automático

### Etapa 8 — Performance (Lighthouse) — 🟢 (30 min)

1. `npm i -D lighthouse` (ou Chrome DevTools → Lighthouse)
2. Rodar contra a URL de produção (com login via `--extra-headers` ou gravação de perfil)
3. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 90, SEO ≥ 90
4. Corrigir o que aparecer (ex: tamanho de imagens, cache headers no Express)

### Etapa 9 — Backlog — 🟢 (contínuo)

Priorizar com o cliente: Postgres, boletos, cobrança automática, importação CSV. Detalhes na seção 4.4.

---

## 6. Riscos e Observações Técnicas

1. **SQLite em produção**: funciona perfeitamente para esse volume (dezenas de passageiros), mas o backup do volume do Railway é essencial (S3 off-site). Se crescer, migrar para Postgres (scheduler e queries são agnósticos via `db` wrapper)
2. **`better-sqlite3` 12.11.1 pinado**: qualquer upgrade de major pode quebrar o Docker (prebuilds). Nunca rodar `npm update` sem testar o build Docker
3. **Node 22 obrigatório**: Node 24+ não tem prebuild para `better-sqlite3` 12.x no Windows; manter `.nvmrc`/Dockerfile em 22
4. **Deploy do Railway**: monitorar o deployment do commit `3f85601` (remoção de comprovantes) — bundle esperado `index-CTU5krts.js` (o servido ainda era `index-DNyGE8ps.js` na última checagem)
5. **Segredos**: nunca versionar `.env`; todas as chaves de produção vivem apenas no painel do Railway

---

## 7. Histórico de Mudanças Relevantes (git)

| Commit | O que fez |
|--------|-----------|
| `e6a384f` | Comprovantes em arquivo + aprovação (depois revertido), lazy loading, pin better-sqlite3 12.11.1, base URL `/api` |
| `c92bca5` | **Fix Dockerfile** — `npm ci` no runtime sem `--ignore-scripts` (corrige 502 no Railway) |
| `3f85601` | **Remoção total da lógica de comprovantes** (gateway de pagamento) — −595 linhas |
| `3f85601+` | Documentação (README.md, RELATORIO.md) e remoção do `multer` órfão |