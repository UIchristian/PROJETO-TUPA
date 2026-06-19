# Tupã Backend

O Tupã é o bloco de construção (building block) oficial de conformidade ambiental do Cadastro Ambiental Rural (CAR) / RER.
Este serviço não substitui o cadastro oficial. Ele serve exclusivamente para confrontar o que foi **declarado** com o **observado** na realidade (satélites e dados oficiais), gerando um score de conformidade e as divergências mapeadas espacialmente.

## Principais Funcionalidades

- **Motor de Divergências com PostGIS:** Todas as lógicas espaciais pesadas (`ST_Intersection`, buffers, áreas) rodam diretamente no banco, não na memória do Python.
- **Fontes Plugáveis:** Integração nativa com:
  - Imagens recentes: Copernicus Data Space Ecosystem (Sentinel-2). *"Contains modified Copernicus Sentinel data 2026"*.
  - MapBiomas (cobertura do solo).
  - Hidrografia (ANA/IBGE).
  - Elevação e declividade (Copernicus DEM).
  - Imóvel declarado (GeoJSON, SHP).
- **Regras Configuráveis:** Parâmetros do Código Florestal (larguras de APP, percentuais de Reserva Legal) são controlados via `config/regras_florestais.yaml`.
- **Pré-Computação:** Suporte a processamento em batch de municípios inteiros que estão travados no CAR.
- **Padrões Abertos (OGC):** Preparado para gerar tabelas/views compatíveis para exposição via WMS e WFS no GeoServer, alimentando o `dpg-mapa` (frontend).

## Estrutura do Projeto

```
tupa-back/
├── config/              # Parâmetros das regras florestais em YAML
├── data/                # Bases de dados locais por município (fontes plugáveis)
├── db/                  # Modelos SQLAlchemy + GeoAlchemy2 (PostGIS)
├── ogc/                 # Exportador e preparador de views WMS/WFS
├── scripts/             # Scripts de pré-computação em batch
├── sources/             # Adaptadores de fontes (MapBiomas, Sentinel, Hidrografia)
├── engine.py            # Motor principal acionando queries espaciais no PostGIS
├── main.py              # API FastAPI
└── requirements.txt     # Dependências (FastAPI, SQLAlchemy, GeoAlchemy2, etc)
```

## Como Rodar

### 1. Requisitos
- **PostgreSQL 14+** com a extensão **PostGIS** instalada.
- Python 3.10+

### 2. Configuração do Banco e Ambiente
Crie um arquivo `.env` na raiz do `tupa-back/` (você pode copiar o `.env.example` e ajustar):
```env
DATABASE_URL=postgresql://postgres:sua_senha@localhost:5432/tupa
COPERNICUS_CLIENT_ID=seu_client_id
COPERNICUS_CLIENT_SECRET=seu_client_secret
CORS_ORIGINS=http://localhost:5173
```

### 3. Instalação
```bash
pip install -r requirements.txt
```

### 4. Preparando Dados Locais
A arquitetura busca dados municipais na pasta `/data/<municipio>/`. Crie a estrutura necessária:
```bash
mkdir -p data/unai
```
Dentro de `data/unai/`, você colocará os arquivos do MapBiomas, rede de drenagem, etc. (ajustar caminhos dentro dos sources se usar shapefiles, geojson ou gpkg).

### 5. Executando a Pré-Computação (Batch)
Para processar os imóveis de um município e gerar os resultados no banco:
```bash
python scripts/pre_computar_municipio.py unai
```
*Isso executará a importação e salvará o diagnóstico de cada imóvel no PostGIS.*

### 6. Subindo a API FastAPI
```bash
uvicorn main:app --reload
```
Acesse `http://localhost:8000/docs` para ver o Swagger com os endpoints `/imoveis` e `/imovel/{id}/diagnostico`.

### 7. Serviço de Camadas OGC (GeoServer)
1. Instale o GeoServer.
2. Crie um "Store" conectado ao banco PostGIS (o mesmo do `DATABASE_URL`).
3. Publique a view `wms_divergencias` criada pelo sistema como uma camada WMS. O front-end RER usará a URL dessa camada OGC diretamente.
