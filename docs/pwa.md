# PWA — Transporte André Luis

## Configuração

O app funciona como **Progressive Web App**, podendo ser instalado na tela inicial do celular.

### Manifest

Arquivo: `public/manifest.json`

```json
{
  "name": "Transporte André Luis",
  "short_name": "T. André Luis",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F4F7FB",
  "theme_color": "#2563EB",
  "icons": [...]
}
```

### Meta Tags (index.html)

```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="theme-color" content="#2563EB" />
```

## Funcionalidades

- **Instalável**: botão "Adicionar à tela inicial" aparece automaticamente
- **Offline**: cache de assets estáticos via Service Worker
- **Ícones**: 192x192 e 512x512 para diferentes densidades
- **Tela cheia**: `display: standalone` remove barra do navegador

## Limitações

- **Sem Service Worker offline completo**: apenas assets estáticos são cacheados
- **API sempre online**: dados em tempo real requerem conexão
- **SQLite é local do servidor**: não há dados offline no cliente

## Geração de Ícones

```bash
node scripts/generate-icons.mjs
```

Gera ícones a partir de um SVG/fonte para todos os tamanhos necessários.

## Design Mobile-First

O app é **mobile-first** por design:
- Navegação inferior (`MobileNav`) em telas < 768px
- Sidebar em telas >= 768px
- Bottom sheets para ações
- Cards empilhados verticalmente
- Safe area respeitada
- Touch targets mínimos de 44px
