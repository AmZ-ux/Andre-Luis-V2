# Transporte André Luis

Sistema de Gerenciamento de Mensalidades de Transporte — Aplicação web para administração de transporte de passageiros.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Estilos | Tailwind CSS 4 |
| Animações | Framer Motion |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Roteamento | React Router DOM 7 |
| Linter | Oxlint |

## Arquitetura

```
src/
├── auth/           # Autenticação (contexto, serviço, gerenciador de sessão)
├── components/     # Componentes por domínio + UI atômica
├── config/         # Configuração centralizada da aplicação
├── constants/      # Constantes e regras de negócio
├── contexts/       # Contextos globais (tema, toast)
├── guards/         # Rotas protegidas por RBAC
├── hooks/          # Hooks compartilhados
├── lib/            # Utilitários de infraestrutura (logger, monitor, backup, segurança)
├── pages/          # Páginas da aplicação
├── services/       # Serviços mockados
├── styles/         # Estilos globais (Tailwind)
├── types/          # Tipos TypeScript
├── utils/          # Utilitários diversos
└── validators/     # Validadores
```

## Fluxos Principais

1. **Autenticação** — Login com SHA-256 + salt, sessão com expiração, RBAC (admin/passenger)
2. **Dashboard** — Resumo financeiro, indicadores, gráficos, atividades recentes
3. **Passageiros** — CRUD com 7 seções no formulário (dados pessoais, endereço, contato, documento, transporte, responsável, observações)
4. **Mensalidades** — Geração automática, status (pendente, pago, atrasado, isento, cancelado)
5. **Comprovantes** — Upload (imagem/PDF), aprovação/rejeição, substituição
6. **Disponibilidade** — Períodos de ausência, cancelamento
7. **Relatórios** — Analíticos financeiros, passageiros, comprovantes, disponibilidade
8. **Comunicação** — Mensagens, modelos, notificações, agendamento
9. **Configurações** — Sistema, auditoria, logs, backup, aparência

## Instalação

### Pré-requisitos

- Node.js 22+
- npm 10+
- Docker (opcional)

### Desenvolvimento

```bash
# Clone o repositório
git clone <url>
cd transporte-andre-luis

# Configure as variáveis de ambiente
cp .env.example .env

# Instale as dependências
npm ci

# Inicie o servidor de desenvolvimento
npm run dev
```

### Build

```bash
# Build de produção
npm run build

# Preview do build
npm run preview
```

## Docker

```bash
# Construir imagem
docker build -t transporte-andre-luis .

# Executar com Docker Compose
docker-compose up -d
```

## Deploy

### Scripts

```bash
# Windows
scripts\build.bat
scripts\deploy.bat

# Linux/Mac
chmod +x scripts/build.sh scripts/deploy.sh
./scripts/build.sh
./scripts/deploy.sh
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `VITE_APP_ENV` | Ambiente (development/staging/production) | `development` |
| `VITE_APP_NAME` | Nome da aplicação | Transporte André Luis |
| `VITE_APP_VERSION` | Versão | 1.0.0 |
| `VITE_API_URL` | URL da API (futura) | — |
| `VITE_PORT` | Porta do servidor dev | 5173 |
| `VITE_SESSION_TIMEOUT` | Timeout da sessão (ms) | 1800000 |
| `VITE_MAX_LOGIN_ATTEMPTS` | Tentativas máximas de login | 5 |
| `VITE_LOGIN_BLOCK_DURATION` | Bloqueio após tentativas (ms) | 900000 |
| `VITE_MAX_FILE_SIZE` | Tamanho máximo de upload (bytes) | 5242880 |
| `VITE_ALLOWED_FILE_TYPES` | Tipos de arquivo permitidos | image/jpeg,image/png,application/pdf |
| `VITE_PAGE_SIZE` | Itens por página | 15 |
| `VITE_MAX_PAGE_SIZE` | Máximo itens por página | 100 |
| `VITE_CACHE_TTL` | Cache TTL (ms) | 300000 |
| `VITE_CACHE_PREFIX` | Prefixo cache localStorage | app_cache_ |
| `VITE_LOG_LEVEL` | Nível de log | info |
| `VITE_MONITORING_ENABLED` | Monitoramento ativo | false |
| `VITE_MONITORING_INTERVAL` | Intervalo monitoramento (ms) | 30000 |
| `VITE_BACKUP_RETENTION_DAYS` | Retenção de backups (dias) | 30 |
| `VITE_MAX_BACKUPS` | Máximo de backups | 10 |

## Checklist de Produção

- [ ] Ambiente configurado (.env)
- [ ] Build validado (`npm run build`)
- [ ] HTTPS configurado (reverse proxy)
- [ ] Backups habilitados
- [ ] Logs estruturados ativos
- [ ] Monitoramento configurado
- [ ] Headers de segurança aplicados
- [ ] Rate limiting implementado
- [ ] Docker image construída
- [ ] Health check funcional
- [ ] Usuário administrador criado
- [ ] Testes de fluxo executados
- [ ] Documentação atualizada
