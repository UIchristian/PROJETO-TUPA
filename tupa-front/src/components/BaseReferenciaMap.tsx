import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import type { FeicaoReferencia, GeoJSONGeometry, TipoFeicao, NivelConfianca } from "@/types/imovel";

interface LimiteImovel {
  id: string;
  geometry: GeoJSONGeometry;
}

interface BaseReferenciaMapProps {
  limites: LimiteImovel[];
  feicoes: FeicaoReferencia[];
  tiposVisiveis: Set<TipoFeicao>;
  confiancasVisiveis: Set<NivelConfianca>;
  selectedId?: string;
  onSelectFeicao?: (f: FeicaoReferencia) => void;
}

// Converts any GeoJSON geometry (Polygon or MultiPolygon) to an array of
// Leaflet position rings so each ring can be rendered as a <Polygon>.
const geomToRings = (geometry: GeoJSONGeometry | undefined): [number, number][][] => {
  if (!geometry?.coordinates?.length) return [];
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as unknown as number[][][][]).map((poly) =>
      poly[0].map(([lng, lat]) => [lat, lng] as [number, number]),
    );
  }
  // Polygon — take outer ring only
  const outer = (geometry.coordinates as number[][][])[0];
  return outer ? [outer.map(([lng, lat]) => [lat, lng] as [number, number])] : [];
};

// Component to dynamically fit map view to the current limits
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [16, 16], maxZoom: 16 });
    }
  }, [positions, map]);
  return null;
}

function useThemeTokens() {
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTokens = () => {
      const style = getComputedStyle(document.documentElement);
      setTokens({
        app: style.getPropertyValue("--app").trim(),
        rl: style.getPropertyValue("--rl").trim(),
        usoRestrito: style.getPropertyValue("--uso-restrito").trim(),
        limite: style.getPropertyValue("--limite").trim(),
        confAlta: style.getPropertyValue("--conf-alta").trim(),
        confMedia: style.getPropertyValue("--conf-media").trim(),
        confBaixa: style.getPropertyValue("--conf-baixa").trim(),
      });
    };

    updateTokens();

    const observer = new MutationObserver(updateTokens);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return tokens;
}

function getFeicaoStyle(f: FeicaoReferencia, tokens: Record<string, string>, isSelected: boolean) {
  let color = "#3b82f6";
  let fillColor = "#3b82f6";
  let dashArray = undefined;
  let weight = isSelected ? 4 : 2;
  let fillOpacity = 0.3;

  if (f.tipo.startsWith("APP_")) {
    color = tokens.app || "#00e1ff";
    fillColor = color;
  } else if (f.tipo === "USO_RESTRITO_ENCOSTA") {
    color = tokens.usoRestrito || "#ff8800";
    fillColor = color;
  } else if (f.tipo === "RESERVA_LEGAL_PROPOSTA") {
    color = tokens.rl || "#00ff00";
    fillColor = color;
    dashArray = "4, 4"; // sugerir hachura
  } else if (f.tipo === "COBERTURA") {
    color = "transparent";
    fillColor = tokens.rl || "#00ff00"; // preenchimento verde suave
    weight = 0;
    fillOpacity = 0.15; // baixa opacidade
  }

  // Modulate by confianca
  if (f.confianca === "alta") {
    fillOpacity = Math.max(0.2, fillOpacity * 1.5);
  } else if (f.confianca === "media") {
    // defaults are fine
  } else if (f.confianca === "baixa") {
    color = tokens.confBaixa || "#ef4444";
    dashArray = "2, 4";
    if (weight > 0) weight = isSelected ? 5 : 3;
    fillOpacity = fillOpacity * 0.5; // less fill to highlight the border
  }

  if (isSelected && weight > 0) {
    color = "#ffffff"; // highlight selection border
  }

  return { color, fillColor, dashArray, weight, fillOpacity };
}

export default function BaseReferenciaMap({
  limites,
  feicoes,
  tiposVisiveis,
  confiancasVisiveis,
  selectedId,
  onSelectFeicao,
}: BaseReferenciaMapProps) {
  const tokens = useThemeTokens();

  const limitesPositions = useMemo(() => {
    return limites.map((l) => geomToRings(l.geometry)).flat(2);
  }, [limites]);

  const visibleFeicoes = useMemo(() => {
    return feicoes.filter((f) => tiposVisiveis.has(f.tipo) && confiancasVisiveis.has(f.confianca));
  }, [feicoes, tiposVisiveis, confiancasVisiveis]);

  return (
    <div className="relative w-full h-full select-none bg-black">
      <MapContainer
        center={[-16.354, -46.885]}
        zoom={14}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community"
        />

        <FitBounds positions={limitesPositions} />

        {/* 1. Feições (Rendered first so they are under the limits, or maybe limits first. 
             Usually polygons are filled, so boundaries over polygons. ) */}
        {visibleFeicoes.map((f) => {
          const style = getFeicaoStyle(f, tokens, selectedId === f.id);
          const rings = geomToRings(f.geometry);
          return rings.map((positions, ri) => (
            <Polygon
              key={`feicao-${f.id}-${ri}`}
              positions={positions}
              pathOptions={{
                color: style.color,
                fillColor: style.fillColor,
                fillOpacity: style.fillOpacity,
                weight: style.weight,
                dashArray: style.dashArray,
              }}
              eventHandlers={{
                click: () => onSelectFeicao?.(f),
              }}
            />
          ));
        })}

        {/* 2. Limites do Imóvel */}
        {limites.map((limite) => {
          const rings = geomToRings(limite.geometry);
          return rings.map((positions, ri) => (
            <Polygon
              key={`limite-${limite.id}-${ri}`}
              positions={positions}
              pathOptions={{
                color: tokens.limite || "#fde047",
                fillColor: "transparent",
                weight: 3,
                interactive: false, // Don't block clicks on features inside
              }}
            />
          ));
        })}
      </MapContainer>
    </div>
  );
}
