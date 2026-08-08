# Backup e Restore

## Como funciona

- **Backup automático**: todos os dias às 02:00 BRT o scheduler exporta todas as tabelas
  do banco em um único JSON (`backup_<uuid>.json`) em `BACKUP_DIR`
  (padrão: `./data/backups`, configurável por `DATA_DIR`/`BACKUP_DIR`).
- **Backup manual**: Administração > Configurações > Backups > "Criar backup".
- **Retenção local**: os 30 backups mais recentes são mantidos (`MAX_BACKUPS`).
- **Off-site (opcional, recomendado)**: a cada backup criado, o arquivo é comprimido
  (gzip) e enviado para um bucket S3/R2 (compatível com a API S3). Ver variáveis
  abaixo. Sem configuração, o backup fica apenas local.

## Configuração do off-site (R2/Cloudflare ou S3)

No `server/.env` (produção) — ex. Cloudflare R2:

```
S3_BUCKET=andre-luis-backups
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
S3_PREFIX=backups
MAX_BACKUPS=30
```

Se o envio falhar, o backup local continua válido e os administradores recebem
uma notificação de alerta de integração.

## Como restaurar (procedimento)

> Restaurar SUBSTITUI todos os dados atuais pelas versões do backup.

### Via interface (produção)

1. Administração > Configurações > Backups.
2. Escolha o backup desejado (pela data) e clique em **Restaurar**.
3. Confirme a ação. O sistema apaga os dados atuais e insere os do backup.

### Via linha de comando (recuperação de desastre, sem interface)

1. Baixe o backup desejado (interface ou direto do bucket off-site).
2. Coloque o arquivo em `data/backups/backup_<id>.json`.
3. Rode com o banco parado:

```bash
cd server
npx tsx -e "
  import { initDatabase, getDb } from './src/database/connection.js';
  import { listBackups, restoreBackup } from './src/services/backupService.js';
  import { runMigrations } from './src/database/schema.js';
  await runMigrations();
  const db = getDb();
  const b = listBackups()[0];
  restoreBackup(db, b.id);
  console.log('Restaurado:', b.id, b.timestamp);
"
```

## Verificação (testes)

- `server/src/routes/settings.test.ts` cobre backup/restore de ponta a ponta:
  cria passageiro → backup → altera/remove dados → restaura → confere que os
  dados originais voltaram.
- `server/src/services/backupService.test.ts` cobre o upload off-site
  (gzip + envio + retenção remota) e o skip quando não configurado.

Rode com: `cd server && npm run test`
