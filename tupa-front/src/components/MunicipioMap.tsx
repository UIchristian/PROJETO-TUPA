import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function scoreColor(score: number) {
  if (score >= 90) return "#22c55e";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

const OVERLAY_STYLES: Record<string, { color: string; fillColor: string }> = {
  APP_CURSO_DAGUA:        { color: "#3b82f6", fillColor: "#3b82f6" },
  USO_RESTRITO_ENCOSTA:   { color: "#f97316", fillColor: "#f97316" },
  RESERVA_LEGAL_PROPOSTA: { color: "#16a34a", fillColor: "#16a34a" },
};

interface MunicipioMapProps {
  featureCollection: any;
  overlays: Record<string, any>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FitBounds({ data }: { data: any }) {
  const map = useMap();
  useEffect(() => {
    if (!data?.features?.length) return;
    try {
      const bounds = L.geoJSON(data).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    } catch {}
  }, [data, map]);
  return null;
}

export default function MunicipioMap({ featureCollection, overlays, selectedId, onSelect }: MunicipioMapProps) {
  return (
    <MapContainer
      center={[-18.5, -47.4]}
      zoom={11}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="&copy; Esri"
        maxZoom={19}
      />

      {featureCollection && (
        <GeoJSON
          key={selectedId ?? "none"}
          data={featureCollection}
          style={(feature) => {
            const score = feature?.properties?.score ?? 100;
            const isSelected = feature?.properties?.id === selectedId;
            const c = scoreColor(score);
            return {
              fillColor: c,
              color: isSelected ? "#ffffff" : c,
              weight: isSelected ? 3 : 0.8,
              opacity: isSelected ? 1 : 0.6,
              fillOpacity: isSelected ? 0.55 : 0.25,
            };
          }}
          onEachFeature={(feature, layer) => {
            const { score, n_divergencias } = feature.properties;
            layer.bindTooltip(
              `<div style="font-family:monospace;font-size:11px;line-height:1.5">
                <b style="color:${scoreColor(score)}">${score}/100</b>
                &nbsp;&nbsp;${n_divergencias} divergência${n_divergencias !== 1 ? "s" : ""}
              </div>`,
              { sticky: true, className: "tupa-tooltip" }
            );
            layer.on("click", () => onSelect(feature.properties.id));
          }}
        />
      )}

      {Object.entries(overlays).map(([tipo, data]) => {
        if (!data?.features?.length) return null;
        const s = OVERLAY_STYLES[tipo] ?? { color: "#888", fillColor: "#888" };
        return (
          <GeoJSON
            key={tipo}
            data={data}
            style={() => ({
              color: s.color,
              fillColor: s.fillColor,
              weight: 1.5,
              fillOpacity: 0.18,
              opacity: 0.85,
            })}
          />
        );
      })}

      {featureCollection && <FitBounds data={featureCollection} />}
    </MapContainer>
  );
}
