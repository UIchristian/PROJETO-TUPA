import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { LatLngLiteral } from "leaflet";
import { useEffect } from "react";

interface FarmMapProps {
  points: LatLngLiteral[];
  setPoints: React.Dispatch<React.SetStateAction<LatLngLiteral[]>>;
  center?: LatLngLiteral | null;
}

function ClickHandler({ setPoints }: Pick<FarmMapProps, "setPoints">) {
  useMapEvents({
    click(e) {
      setPoints((current) => [
        ...current,
        {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        },
      ]);
    },
  });

  return null;
}

function MapController({ center }: { center?: LatLngLiteral | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 16);
    }
  }, [center, map]);

  return null;
}

export default function FarmMap({ points, setPoints, center }: FarmMapProps) {
  return (
    <MapContainer
      center={[-16.359, -46.902]}
      zoom={14}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap"
      />

      <MapController center={center} />

      <ClickHandler setPoints={setPoints} />

      {points.length > 1 && (
        <Polyline positions={points} pathOptions={{ color: "#15803D", weight: 3 }} />
      )}

      {points.length > 2 && (
        <Polygon
          positions={points}
          pathOptions={{ color: "#15803D", fillColor: "#15803D", fillOpacity: 0.2, weight: 3 }}
        />
      )}

      {points.map((point, index) => (
        <CircleMarker
          key={`${point.lat}-${point.lng}-${index}`}
          center={point}
          radius={6}
          pathOptions={{ color: "#15803D", fillColor: "#ffffff", fillOpacity: 1, weight: 2 }}
        />
      ))}
    </MapContainer>
  );
}
