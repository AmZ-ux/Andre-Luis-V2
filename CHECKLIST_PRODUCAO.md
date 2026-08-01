# ============================================
# PRODUCTION CHECKLIST
# Sistema de Gerenciamento de Mensalidades
# ============================================
#
# Marque cada item antes de realizar o deploy
# para ambiente de produção.
#
# ============================================

## PRÉ-REQUISITOS
- [ ] Node.js 22+ instalado
- [ ] Docker instalado (para deploy conteinerizado)
- [ ] Acesso ao repositório do código
- [ ] Domínio configurado (DNS apontando para o servidor)

## AMBIENTE
- [ ] Arquivo .env criado a partir do .env.example
- [ ] VITE_APP_ENV=production
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Variáveis sensíveis protegidas (não versionadas)

## SEGURANÇA
- [ ] HTTPS configurado (certificado SSL/TLS válido)
- [ ] Headers de segurança aplicados (via nginx ou reverse proxy)
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - Strict-Transport-Security
  - Content-Security-Policy
- [ ] Rate limiting implementado
- [ ] Tentativas de login limitadas (5 tentativas)
- [ ] Sessões com expiração configurada
- [ ] Validação de entrada em todos os formulários
- [ ] Upload de arquivos validado (tipo e tamanho)
- [ ] Console logs removidos no build de produção

## BUILD
- [ ] Build executado sem erros: npm run build
- [ ] Code splitting ativo (vendor, UI, charts separados)
- [ ] Minificação habilitada
- [ ] Source maps desabilitados (produção)
- [ ] Tree shaking efetivo
- [ ] Bundle size dentro do limite (500KB warning)

## BANCO DE DADOS (futuro)
- [ ] Migrações executadas
- [ ] Backup inicial realizado
- [ ] Usuário administrador criado
- [ ] Conexão testada

## LOGS
- [ ] Nível de log configurado (VITE_LOG_LEVEL)
- [ ] Logs estruturados (JSON)
- [ ] Separação por nível (info, warn, error, critical, audit)
- [ ] Rotação de logs configurada

## MONITORAMENTO
- [ ] Health check configurado
- [ ] Endpoint de status disponível
- [ ] Monitoramento de memória ativo
- [ ] Monitoramento de storage ativo

## BACKUP
- [ ] Rotina de backup configurada
- [ ] Retenção configurada (30 dias)
- [ ] Backup de dados do localStorage funcional
- [ ] Restauração testada

## DOCKER
- [ ] Dockerfile configurado (multi-stage)
- [ ] Docker Compose configurado
- [ ] Health check no container
- [ ] Imagem construída sem erros
- [ ] Container iniciando corretamente

## DOCUMENTAÇÃO
- [ ] README atualizado
- [ ] Variáveis de ambiente documentadas
- [ ] Guia de instalação atualizado
- [ ] Guia de deploy atualizado
- [ ] Arquitetura documentada

## TESTES DE FLUXO
- [ ] Login funcional
- [ ] Dashboard carregando corretamente
- [ ] CRUD de passageiros operacional
- [ ] Geração de mensalidades funcional
- [ ] Upload e aprovação de comprovantes
- [ ] Gestão de disponibilidade
- [ ] Relatórios gerando dados
- [ ] Comunicação enviando mensagens
- [ ] Configurações persistindo
- [ ] Logout e expiração de sessão

## PÓS-DEPLOY
- [ ] Aplicação acessível via domínio
- [ ] Página 404 configurada
- [ ] Página 500 configurada
- [ ] Redirecionamento HTTPS ativo
- [ ] Performance validada (Lighthouse)
- [ ] Responsividade testada (320px - 1920px)
- [ ] Tema escuro funcional
