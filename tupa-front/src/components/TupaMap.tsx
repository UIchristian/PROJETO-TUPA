import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import type { Imovel, LayerGeometries } from "@/types/imovel";
import { useEffect } from "react";
import L from "leaflet";

interface TupaMapProps {
  imovel: Imovel;
  layers: LayerGeometries;
  showDeclared: boolean;
  showApp: boolean;
  showRestrito: boolean;
  showUsoCobertura: boolean;
  showDivergencias: boolean;
  showHidrografia?: boolean;
  showTerraIndigena?: boolean;
  showMineracao?: boolean;
  showUC?: boolean;
}

import type { GeoJSONGeometry } from "@/types/imovel";

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

// Component to dynamically fit map view to the current declared boundary
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

export default function TupaMap({
  imovel,
  layers,
  showDeclared,
  showApp,
  showRestrito,
  showUsoCobertura,
  showDivergencias,
  showHidrografia,
  showTerraIndigena,
  showMineracao,
  showUC,
}: TupaMapProps) {
  const declaredRings = geomToRings(layers.poligonoDeclarado);
  const appRings = geomToRings(layers.app);
  const restritoRings = layers.usoRestrito ? geomToRings(layers.usoRestrito) : [];
  const allDeclaredPositions = declaredRings.flat();

  return (
    <div className="relative w-full h-full select-none bg-black">
      <MapContainer
        center={[-16.354, -46.885]}
        zoom={14}
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Esri World Imagery Base Satellite Layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community"
        />

        {/* Fit map to property bounds */}
        <FitBounds positions={allDeclaredPositions} />

        {/* 1. Land Use / Cover */}
        {showUsoCobertura &&
          layers.coberturaPoligonos?.map((poly, idx) =>
            geomToRings(poly.geometry).map((positions, ri) => (
              <Polygon
                key={`cover-${idx}-${ri}-${imovel.id}`}
                positions={positions}
                pathOptions={{
                  color: "transparent",
                  fillColor: poly.corHex,
                  fillOpacity: 0.45,
                  weight: 0,
                }}
              />
            )),
          )}

        {/* 2. APP */}
        {showApp &&
          appRings.map((positions, i) => (
            <Polygon
              key={`app-${i}`}
              positions={positions}
              pathOptions={{
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.2,
                weight: 2.5,
                dashArray: "6, 6",
              }}
            />
          ))}

        {/* 3. Uso Restrito */}
        {showRestrito &&
          restritoRings.map((positions, i) => (
            <Polygon
              key={`restrito-${i}`}
              positions={positions}
              pathOptions={{
                color: "#c68a35",
                fillColor: "#c68a35",
                fillOpacity: 0.15,
                weight: 2,
                dashArray: "4, 4",
              }}
            />
          ))}

        {/* 4. Divergências */}
        {showDivergencias &&
          layers.divergencias?.map((div) =>
            geomToRings(div.poligonoDivergencia).map((positions, ri) => (
              <Polygon
                key={`${div.id}-${ri}`}
                positions={positions}
                pathOptions={{
                  color: "#ef4444",
                  fillColor: "#ef4444",
                  fillOpacity: 0.35,
                  weight: 3,
                }}
              />
            )),
          )}

        {/* 5. Limite declarado CAR */}
        {showDeclared &&
          declaredRings.map((positions, i) => (
            <Polygon
              key={`declared-${i}`}
              positions={positions}
              pathOptions={{ color: "var(--primary)", fillColor: "transparent", weight: 3 }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
