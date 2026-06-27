import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { getImoveis, getImovel } from "@/api";
import { Search, MapPin, Loader2, Satellite, ChevronRight, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GeoJSONGeometry } from "@/types/imovel";

const CarPreviewMap = !import.meta.env.SSR
  ? lazy(() => import("@/components/CarPreviewMap"))
  : null;

export const Route = createFileRoute("/")({
  component: PainelCobertura,
});

function PainelCobertura() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: imoveis = [], isLoading } = useQuery({
    queryKey: ["imoveis"],
    queryFn: getImoveis,
  });

  const filtered = useMemo(() => {
    if (!search) return imoveis;
    const q = search.toLowerCase();
    return imoveis.filter(
      (i) => i.municipio.toLowerCase().includes(q) || i.numeroCAR.toLowerCase().includes(q),
    );
  }, [imoveis, search]);

  const selected = imoveis.find((i) => i.id === selectedId);

  const hasCoords = (g: GeoJSONGeometry | null | undefined) =>
    !!g && Array.isArray(g.coordinates) && g.coordinates.length > 0;

  const needsDetail = !!selectedId && !hasCoords(selected?.poligonoDeclarado);
  const { data: selectedDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["imovel-detail", selectedId],
    queryFn: () => getImovel(selectedId!),
    enabled: needsDetail,
  });

  const geometry: GeoJSONGeometry | null =
    hasCoords(selected?.poligonoDeclarado)
      ? selected!.poligonoDeclarado
      : hasCoords(selectedDetail?.poligonoDeclarado)
        ? selectedDetail!.poligonoDeclarado
        : null;

  const municipiosCount = useMemo(
    () => new Set(imoveis.map((i) => i.municipio)).size,
    [imoveis],
  );

  function handleGerar() {
    if (!selected) return;
    navigate({
      to: "/gerar",
      search: { car: selected.numeroCAR, municipio: selected.municipio },
    });
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: CAR list */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">Painel de Cobertura</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione um CAR para gerar a base de referência ambiental
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 border-b border-border">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-2xl font-bold tabular-nums">
              {isLoading ? "—" : imoveis.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">CARs disponíveis</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-2xl font-bold tabular-nums">
              {isLoading ? "—" : municipiosCount}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Municípios de MG</div>
          </div>
        </div>

        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar município ou número CAR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum CAR encontrado
            </div>
          ) : (
            filtered.map((imovel) => {
              const isSelected = selectedId === imovel.id;
              return (
                <button
                  key={imovel.id}
                  onClick={() => setSelectedId(imovel.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3 border-l-2 ${
                    isSelected ? "bg-primary/10 border-primary" : "border-transparent"
                  }`}
                >
                  <MapPin
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {imovel.municipio} — MG
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {imovel.numeroCAR}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-primary" : "text-muted-foreground/50"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: satellite preview + action */}
      <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
        {selectedId ? (
          <>
            <div className="flex-1 relative overflow-hidden">
              {(needsDetail && loadingDetail) || (!geometry && !loadingDetail && needsDetail) ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : geometry && CarPreviewMap ? (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <CarPreviewMap geometry={geometry} />
                </Suspense>
              ) : !geometry ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : null}
            </div>

            <div className="shrink-0 p-5 border-t border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">
                    {selected?.municipio} — MG
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate max-w-[420px]">
                  {selected?.numeroCAR}
                </div>
              </div>
              <Button size="lg" onClick={handleGerar} className="gap-2 shrink-0">
                <Satellite className="w-4 h-4" />
                Gerar base de referência
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
              <Map className="w-10 h-10 text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Prévia Espacial</p>
              <p className="text-sm mt-1">
                Selecione um CAR na lista para visualizar seu polígono
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
