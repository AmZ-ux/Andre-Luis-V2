# Setup Local — Transporte André Luis

## Pré-requisitos

- Node.js **22.x** (Node 24+ quebra `better-sqlite3`)
- npm 10+
- Git

## Instalação

```bash
# Clonar
git clone https://github.com/AmZ-ux/Andre-Luis-V2.git
cd "Transportes André Luis"

# Instalar dependências (postinstall instala server automaticamente)
npm ci
```

## Variáveis de Ambiente

```bash
# Servidor (obrigatório para rodar)
cp server/.env.example server/.env
# Editar server/.env — no mínimo definir JWT_SECRET

# Frontend (opcional — defaults funcionam)
cp .env.example .env
```

Variáveis mínimas para funcionar:

| Variável | Arquivo | Valor padrão |
|----------|---------|--------------|
| `JWT_SECRET` | server/.env | (definir um valor seguro) |
| `DATABASE_PATH` | server/.env | `./data/database.sqlite` |
| `PORT` | server/.env | `3001` |
| `VITE_REAL_API` | .env | `false` (modo mock) |

## Execução

```bash
# Frontend + backend juntos (recomendado)
npm run dev:all

# Ou separados:
npm run dev          # Frontend: http://localhost:5173
npm run dev:server   # API: http://localhost:3001
```

### Modo Mock vs API Real

- `VITE_REAL_API=false` (default em dev): dados em localStorage, sem backend
- `VITE_REAL_API=true`: conecta ao backend em `VITE_API_URL`

## Testes

```bash
npm test              # 479 testes (26 arquivos)
npm run test:watch    # Modo watch
npm run test:coverage # Cobertura
npm run lint          # Oxlint
npm run typecheck     # TypeScript
```

## Build

```bash
npm run build           # Frontend (tsc -b && vite build)
cd server && npm run build  # Backend (tsc)
```

## Docker

```bash
docker compose up -d --build
# Requer JWT_SECRET e SUPER_ADMIN_PASSWORD no ambiente
# Frontend: http://localhost:3001 (servido pelo Express)
```

## Troubleshooting

### better-sqlite3 não instala
- Verificar Node.js 22.x (`node -v`)
- Node 24+ não tem prebuilds para better-sqlite3

### Porta 3001 em uso
- Alterar `PORT` em `server/.env`

### Testes falham
- Verificar se `DATABASE_PATH=:memory:` está configurado (já é default nos testes)
- Rodar `npm run typecheck` primeiro
