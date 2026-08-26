# AGENTS.md — Regras do Projeto Transporte André Luis

## 1. OBJETIVO

Este projeto é um aplicativo web/PWA de gerenciamento de mensalidades de transporte.

O aplicativo deve funcionar prioritariamente como uma experiência mobile-first, podendo ser instalado/adicionado à tela inicial do celular e utilizado como um aplicativo.

A interface deve transmitir:
- simplicidade;
- confiança;
- organização;
- clareza financeira;
- rapidez;
- aparência profissional;
- experiência semelhante a um aplicativo móvel moderno.

---

# 2. REGRA MAIS IMPORTANTE

NÃO faça alterações fora do escopo solicitado.

Se o usuário pedir uma alteração de UI/UX:

- não altere regras de negócio;
- não altere APIs;
- não altere banco de dados;
- não altere serviços;
- não altere autenticação;
- não altere permissões;
- não altere cálculos financeiros;
- não altere rotas;
- não altere comportamentos funcionais que não estejam relacionados à solicitação.

Se uma alteração funcional for necessária para resolver o problema visual, explique antes de executá-la.

---

# 3. ANALISAR ANTES DE EDITAR

Antes de modificar arquivos:

1. entenda o problema;
2. localize os componentes envolvidos;
3. verifique se já existe um componente reutilizável;
4. verifique o design system existente;
5. identifique possíveis impactos;
6. defina o menor conjunto possível de arquivos que precisa ser alterado.

Não comece uma grande refatoração quando uma alteração localizada resolve o problema.

---

# 4. NÃO ALTERAR ARQUITETURA DESNECESSARIAMENTE

A estrutura atual do frontend deve ser respeitada.

Principais áreas:

- src/components/auth
- src/components/dashboard
- src/components/layout
- src/components/monthlyFees
- src/components/passengers
- src/components/reports
- src/components/settings
- src/components/ui
- src/pages
- src/services
- src/hooks
- src/constants
- src/styles

Não mover, renomear ou reorganizar arquivos apenas por preferência estética.

---

# 5. DESIGN SYSTEM

Antes de criar qualquer componente novo, procure primeiro em:

src/components/ui/

Componentes reutilizáveis existentes incluem:

- Button
- Card
- Input
- Select
- Modal
- BottomSheet
- Drawer
- Badge
- Avatar
- Checkbox
- ConfirmDialog
- Container
- EmptyState
- PageHeader
- PageTabs
- Pagination
- Skeleton
- Spinner
- Switch
- Textarea
- Toast

Se existir um componente adequado, reutilize-o.

Não crie uma segunda versão do mesmo componente sem justificativa técnica clara.

---

# 6. MOBILE-FIRST É OBRIGATÓRIO

O mobile é a prioridade principal do produto.

Sempre pense nesta ordem:

1. celular;
2. tablet;
3. desktop.

Nunca faça uma interface desktop e tente simplesmente "encaixá-la" no mobile.

Todo componente novo ou alterado deve ser analisado em pelo menos:

- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px

---

# 7. NAVEGAÇÃO MOBILE

O projeto já possui:

src/components/layout/MobileNav.tsx

e

src/components/ui/BottomSheet.tsx

A navegação inferior existente deve ser preservada.

Não substituir a navegação mobile por outra arquitetura sem solicitação explícita.

O conteúdo da aplicação não pode ficar escondido atrás da navegação inferior.

Respeitar safe-area do dispositivo.

---

# 8. LAYOUT DESKTOP

O projeto possui:

src/components/layout/AppLayout.tsx
src/components/layout/Sidebar.tsx

A sidebar desktop existente deve ser preservada.

Não criar outra sidebar para resolver problemas específicos de uma página.

---

# 9. CORES

Usar os tokens existentes.

Cores principais:

Primary:
#2563EB

Primary Light:
#3B82F6

Primary Dark:
#1D4ED8

Background:
#F4F7FB

Deep:
#123272

Navy:
#0F2D66

Success:
#22C55E

Warning:
#F59E0B

Error:
#EF4444

Text:
#0F172A

Não inventar novas cores sem necessidade.

---

# 10. TIPOGRAFIA

A aplicação utiliza:

IBM Plex Sans

Não substituir a fonte globalmente.

Não criar estilos tipográficos aleatórios.

Priorizar hierarquia clara:

- título de página;
- título de seção;
- informação principal;
- informação secundária;
- texto auxiliar.

---

# 11. ESPAÇAMENTO E COMPONENTES

Priorizar consistência.

Evitar valores arbitrários quando já existir um padrão equivalente.

Não criar:

- cards com bordas diferentes sem necessidade;
- botões com formatos diferentes;
- raios diferentes sem justificativa;
- sombras diferentes sem necessidade;
- tamanhos de texto aleatórios.

---

# 12. RESPONSIVIDADE

Evitar:

- largura fixa desnecessária;
- overflow horizontal;
- tabelas quebrando a tela;
- textos cortados;
- botões impossíveis de tocar;
- elementos sobrepostos;
- modais maiores que a viewport;
- conteúdo escondido atrás da MobileNav.

Em mobile:

- priorizar cards;
- empilhar informações quando necessário;
- reduzir complexidade visual;
- manter ações importantes acessíveis;
- manter áreas de toque confortáveis.

---

# 13. TABELAS

Tabelas não devem simplesmente ultrapassar a tela no mobile.

Quando uma tabela não puder ser adaptada adequadamente:

- transformar registros em cards;
- permitir scroll horizontal controlado;
- ou utilizar uma apresentação responsiva equivalente.

Escolher a solução mais adequada ao contexto.

---

# 14. FORMULÁRIOS

Formulários devem ser confortáveis no celular.

Inputs devem:

- possuir altura adequada;
- possuir labels claros;
- apresentar estados de erro;
- apresentar estados de foco;
- evitar elementos pequenos demais para toque.

Botões de ações principais devem ser facilmente acessíveis.

---

# 15. MODAIS E BOTTOM SHEETS

No mobile, priorizar BottomSheet quando o componente existente for adequado.

Modais não devem:

- ultrapassar a viewport;
- esconder ações importantes;
- impedir rolagem do conteúdo;
- ficar atrás da navegação;
- apresentar botões pequenos.

---

# 16. ANIMAÇÕES

O projeto utiliza Framer Motion.

Animações devem ser:

- rápidas;
- discretas;
- funcionais.

Não adicionar animações excessivas.

Não animar elementos simplesmente porque é possível.

---

# 17. ACESSIBILIDADE

Preservar:

- foco visível;
- aria-label quando necessário;
- navegação por teclado;
- contraste adequado;
- áreas de toque adequadas;
- labels associados aos inputs.

Não remover estados de foco existentes.

---

# 18. ESCOPO DE ALTERAÇÃO

Quando o usuário pedir:

"corrija o botão"

corrija o botão.

Não redesenhe a página.

Quando pedir:

"melhore o card"

melhore o card.

Não altere o layout inteiro.

Quando pedir:

"deixe responsivo"

corrija a responsividade.

Não refatore a arquitetura inteira.

---

# 19. COMPONENTES GLOBAIS

Tenha cuidado especial ao modificar:

- Button
- Card
- Input
- Modal
- BottomSheet
- Container
- PageHeader
- globals.css
- theme.ts

Uma alteração nesses arquivos pode afetar muitas telas.

Antes de modificar um componente global:

1. identifique onde ele é utilizado;
2. avalie possíveis regressões;
3. prefira uma solução localizada quando possível.

---

# 20. VALIDAÇÃO

Depois de uma alteração:

1. execute typecheck;
2. execute lint quando aplicável;
3. execute testes relevantes;
4. verifique a página alterada;
5. verifique mobile;
6. verifique desktop;
7. procure regressões visuais.

Comandos disponíveis:

npm run typecheck
npm run lint
npm test
npm run build

---

# 21. REGRA CONTRA REGRESSÕES

Uma alteração não está concluída apenas porque o código compila.

Também é necessário verificar:

- layout;
- responsividade;
- navegação;
- estados;
- loading;
- erro;
- empty state;
- ações;
- acessibilidade.

---

# 22. QUANDO O PEDIDO FOR AMBÍGUO

Se uma solicitação puder causar uma alteração estrutural grande, não assuma.

Explique:

- o que foi identificado;
- qual é a solução mais segura;
- quais arquivos seriam alterados;
- quais riscos existem.

Só então implemente.

---

# 23. PRINCÍPIO FINAL

Preservar o que já funciona.

Melhorar somente o que precisa ser melhorado.

Preferir pequenas alterações controladas a grandes refatorações.

A consistência visual é mais importante do que criar uma interface diferente em cada tela.