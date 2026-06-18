# Tupã Frontend

Interface React para diagnóstico ambiental de imóveis rurais.

## Stack

- React 19, TypeScript, Vite
- TanStack Router, TanStack Query
- Tailwind CSS v4, shadcn/ui
- react-leaflet (mapas)
- Bun (package manager)

## Setup

```bash
cd tupa-front

# Instalar dependências
bun install

# Configurar variáveis de ambiente
copy .env.example .env
# Editar .env conforme necessário
```

## Rodar

```bash
# Modo desenvolvimento (com API real — backend precisa estar rodando)
bun run dev

# Modo mock (sem backend)
# Em .env, setar VITE_USE_MOCK=true
bun run dev
```

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_API_URL` | `http://localhost:8000` | URL do backend FastAPI |
| `VITE_USE_MOCK` | `false` | `true` = usa dados mock, `false` = chama API real |

## Camada de dados

A camada de dados em `src/api/index.ts` abstrai a origem:

```
VITE_USE_MOCK=true  → src/mock/index.ts (dados estáticos)
VITE_USE_MOCK=false → src/api/client.ts (HTTP → backend FastAPI)
```

As telas chamam `getImoveis()`, `getDiagnostico()`, `getLayers()` sem saber a origem.

## i18n

Três idiomas: Português (pt), Espanhol (es), Inglês (en).
Arquivos em `src/lib/translations/{pt,es,en}.json`.

## Estrutura

```
src/
├── api/               # Cliente HTTP + toggle mock/real
│   ├── client.ts      # Chamadas ao backend FastAPI
│   └── index.ts       # Abstração mock ↔ API
├── types/
│   └── imovel.ts      # Tipos compartilhados (espelha schemas.py)
├── mock/
│   └── index.ts       # Dados mock estáticos
├── components/        # Componentes React
├── routes/            # Páginas (TanStack Router)
└── lib/               # Utilitários, i18n, store
```
