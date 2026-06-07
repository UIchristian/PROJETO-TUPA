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
import { useTranslation } from "@/lib/i18n";
import { Undo2, Trash2 } from "lucide-react";

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
  const { t } = useTranslation();

  return (
    <div className="relative w-full h-full select-none">
      {/* Floating instruction banner */}
      <div className="absolute top-12 left-3 right-3 z-[1000] bg-navy/85 backdrop-blur text-navy-foreground text-sm px-3.5 py-2 rounded-lg shadow-md pointer-events-none text-center font-bold">
        {t("cadastro.map_instruction")}
      </div>

      {/* Floating Undo/Clear controls */}
      {points.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPoints((prev) => prev.slice(0, -1));
            }}
            className="h-10 px-3 rounded-lg bg-card border border-border font-bold text-sm text-foreground/80 hover:bg-secondary active:scale-95 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            title={t("cadastro.undo_btn")}
          >
            <Undo2 size={16} />
            {t("cadastro.undo_btn")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPoints([]);
            }}
            className="h-10 px-3 rounded-lg bg-card border border-border font-bold text-sm text-destructive hover:bg-destructive/5 active:scale-95 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            title={t("cadastro.clear_btn")}
          >
            <Trash2 size={16} />
            {t("cadastro.clear_btn")}
          </button>
        </div>
      )}

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
    </div>
  );
}
