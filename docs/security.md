# Segurança — Transporte André Luis

## Autenticação

### JWT

- Tokens com expiração (default 24h)
- Payload: `{ userId, role }`
- Verificação em todas as rotas autenticadas (`authMiddleware`)

### Senhas

- **bcryptjs** com salt rounds 10
- `admin123` bloqueado em produção
- Reset via token com expiração

### Lockout

- 5 tentativas falhas → conta bloqueada por 15 minutos
- Reset ao redefinir senha
- Configurável: `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`

### Verificação de Email

- Código de 6 dígitos (demo mode: retorna `demoCode` na resposta)
- Opcional em desenvolvimento (`EMAIL_DISABLED=true`)

## Controle de Acesso (RBAC)

| Role | Permissões |
|------|-----------|
| `super_admin` | Tudo + gerenciar admins |
| `admin` | Dashboard, passageiros, mensalidades, configurações |
| `passenger` | Próprios dados, próprias mensalidades, disponibilidade |

### Implementação

- `authMiddleware`: verifica JWT, anexa `req.user`
- `roleMiddleware`: verifica `req.user.role` contra permissões da rota
- `requireAdmin`: middleware para rotas exclusivas de admin

## Rate Limiting

| Escopo | Limite | Janela |
|--------|--------|--------|
| Global `/api` | 300 req | 15 min |
| Login | 5 tentativas | 15 min |
| Verificação email | 5 envios | 15 min |
| Client error | 10 relatórios | 15 min |

## Headers de Segurança

Helmet configura:
- `Content-Security-Policy`: `self`-only em produção
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera(), microphone(), geolocation() desabilitados

## Validação de Entrada

- `sanitizeBody`: remove tags HTML perigosas
- Validação por rota: campos obrigatórios, tipos, formatos
- SQL parametrizado (nunca concatenação de strings)

## Webhook do Mercado Pago

- **HMAC SHA-256**: assinatura verificada contra `MERCADO_PAGO_WEBHOOK_SECRET`
- **Fail closed**: sem secret, webhooks são rejeitados
- **Consulta reversa**: pagamento consultado no MP mesmo com assinatura válida

## Auditoria

| Tabela | Uso |
|--------|-----|
| `audit_logs` | Ações de settings, admin management |
| `app_logs` | Ações operacionais (pagamentos, contratos, etc) |

## Dados Sensíveis

- `.env` nunca versionado
- `JWT_SECRET` e `SUPER_ADMIN_PASSWORD` obrigatórios em produção
- Credenciais Mercado Pago/Resend/S3 no server/.env
- Nenhum secret no frontend (apenas `VITE_*`)

## Backup

- Acesso autenticado (admin)
- Restore cria backup pré-restore
- Off-site: S3/Cloudflare R2 (encriptação em trânsito)
