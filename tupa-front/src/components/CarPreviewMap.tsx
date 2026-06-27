import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJSONGeometry } from "@/types/imovel";

function FitBounds({ geometry }: { geometry: GeoJSONGeometry }) {
  const map = useMap();
  useEffect(() => {
    try {
      const layer = L.geoJSON({ type: "Feature", geometry, properties: {} } as any);
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48] });
    } catch {}
  }, [geometry, map]);
  return null;
}

export default function CarPreviewMap({ geometry }: { geometry: GeoJSONGeometry }) {
  const geojson = {
    type: "FeatureCollection" as const,
    features: [{ type: "Feature" as const, geometry, properties: {} }],
  };

  return (
    <MapContainer
      center={[-18.5, -44]}
      zoom={10}
      style={{ width: "100%", height: "100%" }}
      zoomControl
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Esri, Maxar, Earthstar Geographics"
        maxZoom={19}
      />
      <GeoJSON
        key={JSON.stringify(geometry).slice(0, 60)}
        data={geojson}
        style={{ color: "#22d3ee", weight: 2.5, fillColor: "#22d3ee", fillOpacity: 0.15 }}
      />
      <FitBounds geometry={geometry} />
    </MapContainer>
  );
}
