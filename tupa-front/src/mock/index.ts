// Types are now defined in @/types/imovel.ts — re-exported here for backward compatibility
export type {
  GeoJSONGeometry,
  Imovel,
  CoberturaClasse,
  Divergencia,
  Diagnostico,
  CoberturaPoligono,
  LayerGeometries,
} from "@/types/imovel";

import type {
  GeoJSONGeometry,
  Imovel,
  Diagnostico,
  LayerGeometries,
} from "@/types/imovel";

// Coordinate coordinates centered around Unaí, MG: lat -16.354, lng -46.885

// Imóvel 1 Geometries
const imovel1DeclaredCoords: number[][][] = [
  [
    [-46.895, -16.35],
    [-46.875, -16.35],
    [-46.875, -16.36],
    [-46.895, -16.36],
    [-46.895, -16.35],
  ],
];

const imovel1AppCoords: number[][][] = [
  [
    [-46.888, -16.35],
    [-46.884, -16.35],
    [-46.884, -16.36],
    [-46.888, -16.36],
    [-46.888, -16.35],
  ],
];

const imovel1UsoRestritoCoords: number[][][] = [
  [
    [-46.894, -16.352],
    [-46.89, -16.352],
    [-46.89, -16.358],
    [-46.894, -16.358],
    [-46.894, -16.352],
  ],
];

const imovel1Divergencia1Coords: number[][][] = [
  [
    [-46.886, -16.353],
    [-46.884, -16.353],
    [-46.884, -16.356],
    [-46.886, -16.356],
    [-46.886, -16.353],
  ],
];

const imovel1Divergencia2Coords: number[][][] = [
  [
    [-46.879, -16.352],
    [-46.876, -16.352],
    [-46.876, -16.355],
    [-46.879, -16.355],
    [-46.879, -16.352],
  ],
];

// Imóvel 2 Geometries (Smaller property next to Imóvel 1)
const imovel2DeclaredCoords: number[][][] = [
  [
    [-46.873, -16.351],
    [-46.863, -16.351],
    [-46.863, -16.357],
    [-46.873, -16.357],
    [-46.873, -16.351],
  ],
];

const imovel2AppCoords: number[][][] = [
  [
    [-46.868, -16.351],
    [-46.866, -16.351],
    [-46.866, -16.357],
    [-46.868, -16.357],
    [-46.868, -16.351],
  ],
];

// Mock Fixtures Database
export const MOCK_IMOVEIS: Imovel[] = [
  {
    id: "propriedade-1",
    nome: "Propriedade 1",
    municipio: "Unaí",
    uf: "MG",
    areaHectares: 345,
    numeroCAR: "BR-MG-3170107-123456-78",
    poligonoDeclarado: {
      type: "Polygon",
      coordinates: imovel1DeclaredCoords,
    },
  },
  {
    id: "propriedade-2",
    nome: "Propriedade 2",
    municipio: "Unaí",
    uf: "MG",
    areaHectares: 52,
    numeroCAR: "BR-MG-3170107-888888-99",
    poligonoDeclarado: {
      type: "Polygon",
      coordinates: imovel2DeclaredCoords,
    },
  },
];

export const MOCK_DIAGNOSTICOS: Record<string, Diagnostico> = {
  "fazenda-sol-nascente": {
    imovelId: "fazenda-sol-nascente",
    scoreConformidade: 68, // Alert
    coberturaSolo: [
      { classe: "Floresta Nativa (Cerrado)", percentual: 42, corHex: "#15803D" },
      { classe: "Lavoura Temporária (Grãos)", percentual: 38, corHex: "#EAB308" },
      { classe: "Pastagem", percentual: 15, corHex: "#86EFAC" },
      { classe: "Corpos d'Água", percentual: 3.5, corHex: "#3B82F6" },
      { classe: "Solo Exposto / Benfeitorias", percentual: 1.5, corHex: "#B45309" },
    ],
    divergencias: [
      {
        id: "div-1",
        tipo: "Cultivo Agrícola em APP Degradada",
        areaHectares: 2.4,
        severidade: "alta",
        textoLinguagemSimples:
          "Foi identificado cultivo agrícola comercial (soja/milho) ativo na faixa de 30 metros marginal de rio de preservação permanente (APP). O Código Florestal exige vegetação nativa nesta área.",
        baseLegal: "Art. 4º, inciso I, alínea 'a' da Lei 12.651/2012",
        caminhoRetificacao:
          "Cessar o cultivo comercial na área delimitada de 2.4 ha, isolar os limites da APP para permitir a regeneração natural e submeter um Projeto de Recomposição de Áreas Degradadas e Alteradas (PRADA).",
        poligonoDivergencia: {
          type: "Polygon",
          coordinates: imovel1Divergencia1Coords,
        },
      },
      {
        id: "div-2",
        tipo: "Supressão não autorizada de vegetação",
        areaHectares: 5.1,
        severidade: "media",
        textoLinguagemSimples:
          "Diferença detectada entre o histórico florestal e imagens recentes de satélite aponta desmatamento de 5.1 ha de Cerrado sem registro de Autorização de Supressão de Vegetação (ASV) no sistema ambiental estadual.",
        baseLegal: "Art. 7º e Art. 8º da Lei 12.651/2012",
        caminhoRetificacao:
          "Apresentar a licença/ASV obtida à época junto à Secretaria de Meio Ambiente ou iniciar processo de regularização com reposição florestal equivalente.",
        poligonoDivergencia: {
          type: "Polygon",
          coordinates: imovel1Divergencia2Coords,
        },
      },
    ],
  },
  "sitio-primavera": {
    imovelId: "sitio-primavera",
    scoreConformidade: 98, // Healthy / Clean
    coberturaSolo: [
      { classe: "Floresta Nativa (Cerrado)", percentual: 65, corHex: "#15803D" },
      { classe: "Lavoura Temporária (Grãos)", percentual: 20, corHex: "#EAB308" },
      { classe: "Pastagem", percentual: 10, corHex: "#86EFAC" },
      { classe: "Corpos d'Água", percentual: 4, corHex: "#3B82F6" },
      { classe: "Solo Exposto / Benfeitorias", percentual: 1, corHex: "#B45309" },
    ],
    divergencias: [],
  },
};

export const MOCK_LAYERS: Record<string, LayerGeometries> = {
  "fazenda-sol-nascente": {
    poligonoDeclarado: { type: "Polygon", coordinates: imovel1DeclaredCoords },
    app: { type: "Polygon", coordinates: imovel1AppCoords },
    usoRestrito: { type: "Polygon", coordinates: imovel1UsoRestritoCoords },
    divergencias: [
      {
        id: "div-1",
        tipo: "Cultivo Agrícola em APP Degradada",
        areaHectares: 2.4,
        severidade: "alta",
        textoLinguagemSimples:
          "Foi identificado cultivo agrícola comercial (soja/milho) ativo na faixa de 30 metros marginal de rio de preservação permanente (APP). O Código Florestal exige vegetação nativa nesta área.",
        baseLegal: "Art. 4º, inciso I, alínea 'a' da Lei 12.651/2012",
        caminhoRetificacao:
          "Cessar o cultivo comercial na área delimitada de 2.4 ha, isolar os limites da APP para permitir a regeneração natural e submeter um Projeto de Recomposição de Áreas Degradadas e Alteradas (PRADA).",
        poligonoDivergencia: { type: "Polygon", coordinates: imovel1Divergencia1Coords },
      },
      {
        id: "div-2",
        tipo: "Supressão não autorizada de vegetação",
        areaHectares: 5.1,
        severidade: "media",
        textoLinguagemSimples:
          "Diferença detectada entre o histórico florestal e imagens recentes de satélite aponta desmatamento de 5.1 ha de Cerrado sem registro de Autorização de Supressão de Vegetação (ASV) no sistema ambiental estadual.",
        baseLegal: "Art. 7º e Art. 8º da Lei 12.651/2012",
        caminhoRetificacao:
          "Apresentar a licença/ASV obtida à época junto à Secretaria de Meio Ambiente ou iniciar processo de regularização com reposição florestal equivalente.",
        poligonoDivergencia: { type: "Polygon", coordinates: imovel1Divergencia2Coords },
      },
    ],
    coberturaPoligonos: [
      {
        classe: "Floresta Nativa (Cerrado)",
        corHex: "#15803D",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.895, -16.35],
              [-46.885, -16.35],
              [-46.885, -16.36],
              [-46.895, -16.36],
              [-46.895, -16.35],
            ],
          ],
        },
      },
      {
        classe: "Lavoura Temporária (Grãos)",
        corHex: "#EAB308",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.885, -16.35],
              [-46.875, -16.35],
              [-46.875, -16.356],
              [-46.885, -16.356],
              [-46.885, -16.35],
            ],
          ],
        },
      },
      {
        classe: "Pastagem",
        corHex: "#86EFAC",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.885, -16.356],
              [-46.875, -16.356],
              [-46.875, -16.359],
              [-46.885, -16.359],
              [-46.885, -16.356],
            ],
          ],
        },
      },
      {
        classe: "Solo Exposto / Benfeitorias",
        corHex: "#B45309",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.885, -16.359],
              [-46.875, -16.359],
              [-46.875, -16.36],
              [-46.885, -16.36],
              [-46.885, -16.359],
            ],
          ],
        },
      },
    ],
  },
  "sitio-primavera": {
    poligonoDeclarado: { type: "Polygon", coordinates: imovel2DeclaredCoords },
    app: { type: "Polygon", coordinates: imovel2AppCoords },
    divergencias: [],
    coberturaPoligonos: [
      {
        classe: "Floresta Nativa (Cerrado)",
        corHex: "#15803D",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.873, -16.351],
              [-46.867, -16.351],
              [-46.867, -16.357],
              [-46.873, -16.357],
              [-46.873, -16.351],
            ],
          ],
        },
      },
      {
        classe: "Lavoura Temporária (Grãos)",
        corHex: "#EAB308",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.867, -16.351],
              [-46.863, -16.351],
              [-46.863, -16.354],
              [-46.867, -16.354],
              [-46.867, -16.351],
            ],
          ],
        },
      },
      {
        classe: "Pastagem",
        corHex: "#86EFAC",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-46.867, -16.354],
              [-46.863, -16.354],
              [-46.863, -16.357],
              [-46.867, -16.357],
              [-46.867, -16.354],
            ],
          ],
        },
      },
    ],
  },
};

// Asynchronous mock APIs, ready to be swapped with Firestore & backend geospatial queries
export async function getImoveis(): Promise<Imovel[]> {
  await new Promise((resolve) => setTimeout(resolve, 350)); // Simulating network latency
  return [...MOCK_IMOVEIS];
}

export async function getImovel(id: string): Promise<Imovel | null> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const found = MOCK_IMOVEIS.find((item) => item.id === id);
  return found ? { ...found } : null;
}

export async function getDiagnostico(imovelId: string): Promise<Diagnostico | null> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const found = MOCK_DIAGNOSTICOS[imovelId];
  return found ? { ...found } : null;
}

export async function getLayers(imovelId: string): Promise<LayerGeometries | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const found = MOCK_LAYERS[imovelId];
  return found ? { ...found } : null;
}
