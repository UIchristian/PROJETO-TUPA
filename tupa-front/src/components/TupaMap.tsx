import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import { Imovel, LayerGeometries } from "@/mock";
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
}

// Helper to convert GeoJSON coords [lng, lat] to Leaflet positions [lat, lng]
const convertGeoJSONCoords = (coords: number[][][]): [number, number][] => {
  if (!coords || coords.length === 0) return [];
  return coords[0].map(([lng, lat]) => [lat, lng] as [number, number]);
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
}: TupaMapProps) {
  const declaredPositions = convertGeoJSONCoords(layers.poligonoDeclarado.coordinates);
  const appPositions = convertGeoJSONCoords(layers.app.coordinates);
  const restritoPositions = layers.usoRestrito
    ? convertGeoJSONCoords(layers.usoRestrito.coordinates)
    : [];

  return (
    <div className="relative w-full h-full select-none rounded-2xl overflow-hidden border border-border bg-muted">
      <MapContainer
        center={[-16.354, -46.885]}
        zoom={14}
        zoomControl={false} // Clean custom UI
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {/* Esri World Imagery Base Satellite Layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, USDA, USGS, and the GIS User Community"
        />

        {/* Dynamic center & fit bounds */}
        <FitBounds positions={declaredPositions} />

        {/* 1. Actual Land Use / Cover Thematic Layer (rendered as sub-polygons) */}
        {showUsoCobertura &&
          layers.coberturaPoligonos &&
          layers.coberturaPoligonos.map((poly, idx) => {
            const positions = convertGeoJSONCoords(poly.geometry.coordinates);
            return (
              <Polygon
                key={`cover-${idx}-${imovel.id}`}
                positions={positions}
                pathOptions={{
                  color: "transparent",
                  fillColor: poly.corHex,
                  fillOpacity: 0.45,
                  weight: 0,
                }}
              />
            );
          })}

        {/* 2. APP (Permanent Preservation Area) Layer */}
        {showApp && appPositions.length > 0 && (
          <Polygon
            positions={appPositions}
            pathOptions={{
              color: "#3b82f6", // cyan/blue
              fillColor: "#3b82f6",
              fillOpacity: 0.2,
              weight: 2.5,
              dashArray: "6, 6",
            }}
          />
        )}

        {/* 3. Uso Restrito (Restricted Use) Layer */}
        {showRestrito && restritoPositions.length > 0 && (
          <Polygon
            positions={restritoPositions}
            pathOptions={{
              color: "#c68a35", // earthy gold
              fillColor: "#c68a35",
              fillOpacity: 0.15,
              weight: 2,
              dashArray: "4, 4",
            }}
          />
        )}

        {/* 4. Divergencias Layer (Highlighted in red) */}
        {showDivergencias &&
          layers.divergencias &&
          layers.divergencias.map((div) => {
            const positions = convertGeoJSONCoords(div.poligonoDivergencia.coordinates);
            return (
              <Polygon
                key={div.id}
                positions={positions}
                pathOptions={{
                  color: "#ef4444", // strong red
                  fillColor: "#ef4444",
                  fillOpacity: 0.35,
                  weight: 3,
                }}
              />
            );
          })}

        {/* 5. Declared Boundary (CAR) Layer (Drawn on top as reference outline) */}
        {showDeclared && declaredPositions.length > 0 && (
          <Polygon
            positions={declaredPositions}
            pathOptions={{
              color: "var(--primary)", // Deep Forest Green
              fillColor: "transparent",
              weight: 3,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
