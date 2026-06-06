import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, LogOut, MapPin, CheckCircle2, ChevronLeft, Search } from "lucide-react";
import { useEffect, useState, lazy, Suspense } from "react";
import type { LatLngLiteral } from "leaflet";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore, Terreno, CropStatus } from "@/lib/app-store";
import { sendWhatsAppVerificationCode } from "@/lib/whatsapp";
import { t, useTranslation, translateCropString } from "@/lib/i18n";
import { deleteUser, signOut } from "firebase/auth";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

const FarmMap = lazy(() => import("@/components/FarmMap"));

const BUSCAR_CARS_ENDPOINT = "http://localhost:8000/buscar-cars";

type CarItem = {
  codigo_imovel?: string;
  codigo?: string;
  numero?: string;
  cod_imovel?: string;
  municipio?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  area_ha?: number;
  area_imovel_ha?: number;
  area?: number;
  [key: string]: any;
};

function getCarCode(car: CarItem, fallback: string) {
  return String(car.codigo_imovel ?? car.codigo ?? car.numero ?? car.cod_imovel ?? fallback);
}

function getCarLocation(car: CarItem) {
  const municipio = car.municipio ?? car.cidade ?? car.municipio_nome ?? "";
  const uf = car.uf ?? car.estado ?? "";
  return [municipio, uf].filter(Boolean).join(" - ");
}

function getCarArea(car: CarItem): number | null {
  const value = car.area_ha ?? car.area_imovel_ha ?? car.area;
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(value);
}

export const Route = createFileRoute("/perfil")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: `${t("profile.title", lang)} — SafraSense` }],
    };
  },
  component: PerfilScreen,
});

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

function maskCpfLgpd(cpf: string) {
  if (!cpf) return "***.***.***-**";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  if (clean.length === 14) {
    return `**.***.${clean.slice(5, 8)}/${clean.slice(8, 12)}-**`;
  }
  return cpf;
}

function maskPhoneLgpd(phone: string) {
  if (!phone) return "(**) *****-****";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) *****-${clean.slice(7)}`;
  } else if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ****-${clean.slice(6)}`;
  }
  return phone;
}

function PerfilScreen() {
  const { farmer, password, protected: isProtected, status } = useAppState();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState<{
    nome: string;
    cpf: string;
    telefone: string;
    nomePropriedade: string;
    regiaoMapa: string;
    enderecoInformado: string;
    produtosCultivados: string[];
    sistema: string;
    hectares: number;
    numeroCAR: string;
    avatar: string;
    terrenos?: Terreno[];
    areaPolygon?: { lat: number; lng: number }[];
  } | null>(null);

  const [editPersonalOpen, setEditPersonalOpen] = useState(false);
  const [tempPhone, setTempPhone] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempProperty, setTempProperty] = useState("");
  const [drawerError, setDrawerError] = useState("");

  // Map overlay re-demarcation states
  const [mapOpen, setMapOpen] = useState(false);
  const [editingTerrenoId, setEditingTerrenoId] = useState<string | null>(null);
  const [points, setPoints] = useState<LatLngLiteral[]>([]);
  const [address, setAddress] = useState("");

  // Address Nominatim search states
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [searchAddressError, setSearchAddressError] = useState("");
  const [mapCenter, setMapCenter] = useState<LatLngLiteral | null>(null);

  const handleSearchAddress = async () => {
    if (!address.trim()) return;
    setSearchingAddress(true);
    setSearchAddressError("");
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      );
      if (!resp.ok) throw new Error("Erro de rede");
      const list = await resp.json();
      if (list && list.length > 0) {
        const item = list[0];
        const newCenter = {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
        setMapCenter(newCenter);
        if (item.display_name) {
          setAddress(item.display_name);
        }
      } else {
        setSearchAddressError(
          language === "es"
            ? "Dirección no encontrada."
            : language === "en"
              ? "Address not found."
              : "Endereço não encontrado.",
        );
      }
    } catch (e) {
      console.error(e);
      setSearchAddressError(
        language === "es"
          ? "No se pudo buscar la dirección."
          : language === "en"
            ? "Could not search the address."
            : "Não foi possível buscar o endereço.",
      );
    } finally {
      setSearchingAddress(false);
    }
  };

  // Unified Terrain editing drawer states
  const [editTerrenoOpen, setEditTerrenoOpen] = useState(false);
  const [tempTerrenoName, setTempTerrenoName] = useState("");
  const [tempTerrenoSizeVal, setTempTerrenoSizeVal] = useState("");
  const [tempTerrenoSizeUnit, setTempTerrenoSizeUnit] = useState<
    "ha" | "alqueire_mg" | "alqueire_sp" | "modulo_fiscal"
  >("ha");
  const [tempTerrenoCarVal, setTempTerrenoCarVal] = useState("");
  const [tempTerrenoSelectedCar, setTempTerrenoSelectedCar] = useState<CarItem | null>(null);
  const [tempTerrenoCropsVal, setTempTerrenoCropsVal] = useState<string[]>([]);
  const [tempTerrenoSystemVal, setTempTerrenoSystemVal] = useState("");

  // Terrain CAR search states
  const [carSearchingId, setCarSearchingId] = useState<string | null>(null);
  const [carsFound, setCarsFound] = useState<CarItem[]>([]);
  const [carError, setCarError] = useState("");
  const [tempSelectedCar, setTempSelectedCar] = useState<CarItem | null>(null);

  // Avatar picker state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Delete account confirmation
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Password drawer states
  const [passwordDrawerOpen, setPasswordDrawerOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [validationCode, setValidationCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [validationError, setValidationError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Push notification banner state
  const [pushNotification, setPushNotification] = useState(false);
  const firebaseUid = farmer.firebaseUid || auth.currentUser?.uid || "";

  const syncAppStoreFromProfile = (next: {
    nome: string;
    cpf: string;
    telefone: string;
    nomePropriedade: string;
    regiaoMapa: string;
    enderecoInformado: string;
    produtosCultivados: string[];
    sistema: string;
    hectares: number;
    numeroCAR: string;
    avatar: string;
    terrenos?: Terreno[];
    areaPolygon?: { lat: number; lng: number }[];
  }) => {
    appStore.set({
      farmer: {
        ...farmer,
        firebaseUid,
        name: next.nome,
        cpf: next.cpf,
        phone: next.telefone,
        property: next.nomePropriedade || next.regiaoMapa,
        avatar: next.avatar,
        terrenos: next.terrenos,
      },
    });
  };

  useEffect(() => {
    const loadProfile = async () => {
      setProfileError("");

      if (!firebaseUid) {
        setProfileError(
          language === "es"
            ? "No se pudo identificar el usuario autenticado."
            : language === "en"
              ? "Could not identify the authenticated user."
              : "Não foi possível identificar o usuário autenticado.",
        );
        setProfileLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", firebaseUid));

        if (!snap.exists()) {
          setProfileError(
            language === "es"
              ? "No encontramos tus datos en la base."
              : language === "en"
                ? "We could not find your data in the database."
                : "Não encontramos seus dados no banco.",
          );
          setProfileLoading(false);
          return;
        }

        const data = snap.data() as any;

        const normalized = {
          nome: data.nome || "",
          cpf: data.cpf || "",
          telefone: data.telefone || "",
          nomePropriedade: data.nomePropriedade || "",
          regiaoMapa: data.regiaoMapa || "",
          enderecoInformado: data.enderecoInformado || "",
          produtosCultivados: Array.isArray(data.produtosCultivados) ? data.produtosCultivados : [],
          sistema: data.sistema || "",
          hectares: Number(data.hectares || 0),
          numeroCAR: data.numeroCAR || "",
          avatar: data.avatar || "",
          terrenos: Array.isArray(data.terrenos) ? data.terrenos : [],
          areaPolygon: Array.isArray(data.areaPolygon) ? data.areaPolygon : [],
        };

        setProfileData(normalized);
        syncAppStoreFromProfile(normalized);
      } catch (error) {
        console.error(error);
        setProfileError(
          language === "es"
            ? "Error al cargar tu perfil."
            : language === "en"
              ? "Failed to load your profile."
              : "Falha ao carregar seu perfil.",
        );
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [firebaseUid]);

  const updateProfileFields = async (patch: Partial<NonNullable<typeof profileData>>) => {
    if (!profileData) return;

    if (!firebaseUid) {
      setProfileError(
        language === "es"
          ? "No se pudo identificar el usuario autenticado."
          : language === "en"
            ? "Could not identify the authenticated user."
            : "Nao foi possivel identificar o usuario autenticado.",
      );
      return;
    }

    setProfileSaving(true);
    setProfileError("");

    try {
      await setDoc(
        doc(db, "usuarios", firebaseUid),
        {
          ...patch,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );

      const merged = {
        ...profileData,
        ...patch,
      };

      setProfileData(merged);
      syncAppStoreFromProfile(merged);
    } catch (error) {
      console.error(error);
      setProfileError(
        language === "es"
          ? "No se pudo guardar los cambios."
          : language === "en"
            ? "Could not save the changes."
            : "Nao foi possivel salvar as alteracoes.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleConfirmMap = async () => {
    if (!profileData) return;
    const targetId = editingTerrenoId;
    if (!targetId) return;

    const parsedTerrenos =
      profileData.terrenos && profileData.terrenos.length > 0
        ? profileData.terrenos
        : [
            {
              id: "1",
              name: "Terreno 1",
              points: profileData.areaPolygon || [],
              sizeVal: String(profileData.hectares || 0),
              sizeUnit: "ha" as const,
              hectares: profileData.hectares || 0,
              carNumber: profileData.numeroCAR || "",
              address: profileData.enderecoInformado || "",
              status: status || "healthy",
            },
          ];

    const exists = parsedTerrenos.some((t) => t.id === targetId);
    let updatedTerrenos = [...parsedTerrenos];

    if (exists) {
      updatedTerrenos = updatedTerrenos.map((t) =>
        t.id === targetId
          ? {
              ...t,
              points,
              address,
            }
          : t,
      );
    } else {
      const newName =
        language === "es"
          ? `Terreno ${parsedTerrenos.length + 1}`
          : language === "en"
            ? `Terrain ${parsedTerrenos.length + 1}`
            : `Terreno ${parsedTerrenos.length + 1}`;
      updatedTerrenos.push({
        id: targetId,
        name: newName,
        points,
        sizeVal: "0",
        sizeUnit: "ha",
        hectares: 0,
        carNumber: "",
        address,
        status: "healthy",
        crops: ["Milho"],
        system: "Safrinha",
      });
    }

    const totalHectares = Number(
      updatedTerrenos.reduce((sum, t) => sum + (t.hectares || 0), 0).toFixed(2),
    );

    await updateProfileFields({
      terrenos: updatedTerrenos,
      hectares: totalHectares,
      enderecoInformado: updatedTerrenos[0]?.address || address,
      areaPolygon: updatedTerrenos[0]?.points || points,
      numeroCAR: updatedTerrenos[0]?.carNumber || profileData.numeroCAR,
    });

    setMapOpen(false);
    setEditingTerrenoId(null);
  };

  const handleRemoveTerrenoProfile = async (idToRemove: string) => {
    if (!profileData) return;
    const parsedTerrenos =
      profileData.terrenos && profileData.terrenos.length > 0 ? profileData.terrenos : [];
    if (parsedTerrenos.length <= 1) return;

    const filtered = parsedTerrenos.filter((t) => t.id !== idToRemove);
    const total = Number(filtered.reduce((sum, curr) => sum + curr.hectares, 0).toFixed(2));

    await updateProfileFields({
      terrenos: filtered,
      hectares: total,
      enderecoInformado: filtered[0]?.address || "",
      areaPolygon: filtered[0]?.points || [],
      numeroCAR: filtered[0]?.carNumber || "",
    });
  };

  const handleFetchCarForTerreno = async (
    terrenoId: string,
    terrenoPoints: { lat: number; lng: number }[],
  ) => {
    if (!terrenoPoints || terrenoPoints.length < 3) {
      setCarError(
        language === "es"
          ? "Por favor, demarca al menos 3 pontos en el mapa antes de buscar el CAR."
          : language === "en"
            ? "Please outline at least 3 points on the map before searching for the CAR."
            : "Demarque pelo menos 3 pontos no mapa antes de buscar o CAR.",
      );
      return;
    }
    setCarError("");
    setCarSearchingId(terrenoId);
    setCarsFound([]);

    try {
      const response = await fetch(BUSCAR_CARS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poligono: terrenoPoints,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const list: CarItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.cars)
          ? data.cars
          : Array.isArray(data?.resultados)
            ? data.resultados
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.data)
                ? data.data
                : [];

      setCarsFound(list);

      if (list.length === 0) {
        setCarError(
          language === "es"
            ? "Ningún CAR encontrado en el área demarcada."
            : language === "en"
              ? "No CAR found in the outlined area."
              : "Nenhum CAR encontrado na área demarcada.",
        );
      }
    } catch (err) {
      console.error("Falha ao buscar CAR no backend:", err);
      setCarError(
        language === "es"
          ? "Não foi possível fazer a verificação de dados. Verifique se o servidor está ativo."
          : language === "en"
            ? "Could not complete data verification. Make sure the server is running."
            : "Não foi possível fazer a verificação de dados. Verifique se o servidor está ativo.",
      );
    } finally {
      setCarSearchingId(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("signOut error", err);
    }
    appStore.reset();
    navigate({ to: "/" });
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      const currentUser = auth.currentUser;
      const uid = currentUser?.uid || farmer.firebaseUid;

      if (uid) {
        try {
          await deleteDoc(doc(db, "usuarios", uid));
        } catch (err) {
          console.error("deleteDoc error", err);
        }
      }

      if (currentUser) {
        await deleteUser(currentUser);
      }

      appStore.reset();

      setDeleteDrawerOpen(false);
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("deleteUser error", err);
      if (err?.code === "auth/requires-recent-login") {
        setDeleteError(
          language === "es"
            ? "Por seguridad, vuelva a iniciar sesión y reintente eliminar la cuenta."
            : language === "en"
              ? "For security, please sign in again and retry deleting the account."
              : "Por seguranca, faca login novamente e tente excluir a conta de novo.",
        );
      } else {
        setDeleteError(
          language === "es"
            ? "No fue posible eliminar la cuenta. Intente nuevamente."
            : language === "en"
              ? "Could not delete the account. Please try again."
              : "Nao foi possivel excluir a conta. Tente novamente.",
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const profileName = profileData?.nome || "";
  const profileCpf = profileData?.cpf || "";
  const profilePhone = profileData?.telefone || "";
  const profileProperty = profileData?.nomePropriedade || profileData?.regiaoMapa || "";
  const profileLocation = profileData?.enderecoInformado || "";
  const profileAvatar = profileData?.avatar || "";
  const profileCropRaw = profileData
    ? profileData.sistema
      ? `${profileData.produtosCultivados.join(" + ")} (${profileData.sistema})`
      : profileData.produtosCultivados.join(" + ")
    : "";
  const profileArea = profileData?.hectares || 0;
  const profileCrops = profileData?.produtosCultivados || [];
  const profileSystem = profileData?.sistema || "";
  const profileCar = profileData?.numeroCAR || "";

  const parsedTerrenos: Terreno[] =
    profileData?.terrenos && profileData.terrenos.length > 0
      ? profileData.terrenos
      : [
          {
            id: "1",
            name: "Terreno 1",
            points: profileData?.areaPolygon || [],
            sizeVal: String(profileData?.hectares || 0),
            sizeUnit: "ha" as const,
            hectares: profileData?.hectares || 0,
            carNumber: profileData?.numeroCAR || "",
            address: profileData?.enderecoInformado || "",
            status: status || "healthy",
          },
        ];
  const cropOptions = [
    "Milho",
    "Soja",
    "Café",
    "Feijão",
    "Cana-de-açúcar",
    "Laranja",
    "Batata",
    "Mandioca",
    "Algodão",
    "Outro",
  ];

  if (profileLoading) {
    return (
      <MobileFrame withNav>
        <div className="px-5 pt-6 pb-6 text-[14px] text-muted-foreground">
          {language === "es"
            ? "Cargando perfil..."
            : language === "en"
              ? "Loading profile..."
              : "Carregando perfil..."}
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame withNav>
      {/* Simulated WhatsApp Notification Banner */}
      {pushNotification && (
        <div className="absolute top-4 left-4 right-4 z-50 bg-white/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-card animate-in slide-in-from-top-12 duration-300 flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[16px] shrink-0">
            💬
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[13px] text-foreground">WhatsApp</span>
              <span className="text-[10px] text-muted-foreground">
                {language === "es" ? "ahora" : language === "en" ? "now" : "agora"}
              </span>
            </div>
            <p className="text-[12px] text-foreground/90 mt-0.5 leading-snug">
              <strong>SafraSense:</strong>{" "}
              {language === "es"
                ? "Tu código de confirmación es:"
                : language === "en"
                  ? "Your confirmation code is:"
                  : "Seu código de confirmação é:"}{" "}
              <span className="font-bold text-[14px] text-primary">{validationCode}</span>
            </p>
          </div>
        </div>
      )}

      <header className="px-5 pt-6 pb-4 flex justify-between items-center">
        <h1 className="text-[22px] font-bold">{t("profile.title")}</h1>
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="appearance-none bg-secondary/80 border border-border/80 text-foreground text-[14px] font-semibold rounded-full py-1.5 pl-3 pr-8 shadow-sm outline-none focus:border-primary transition-all cursor-pointer"
          >
            <option value="es">🇪🇸 Español</option>
            <option value="pt">🇧🇷 Português</option>
            <option value="en">🇺🇸 English</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </header>
      <div className="px-5 pb-6 flex-1 flex flex-col gap-4">
        {profileError && (
          <div className="text-[12.5px] text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
            {profileError}
          </div>
        )}

        <div className="rounded-2xl bg-card p-4 shadow-card border border-border/60 flex items-center gap-3 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border/60 shrink-0">
            {profileAvatar ? (
              <img
                src={profileAvatar}
                alt={t("profile.changePhoto")}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={22} className="text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[16px]">{profileName}</h2>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin size={12} /> {profileProperty} · {profileLocation}
            </p>
          </div>
          <button
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="text-[13.5px] text-primary hover:underline font-bold shrink-0 cursor-pointer"
          >
            {t("profile.changePhoto")}
          </button>
        </div>

        {/* Avatar selector block */}
        {showAvatarPicker && (
          <div className="rounded-2xl bg-card p-4 shadow-card border border-border/60 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="font-bold text-[14.5px] text-foreground">
                {t("profile.avatarTitle")}
              </h3>
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="text-[13px] text-primary hover:underline font-bold cursor-pointer"
              >
                {t("profile.avatarDone")}
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {[
                { name: "sprout", path: "/avatars/sprout.png" },
                { name: "tractor", path: "/avatars/tractor.png" },
                { name: "satellite", path: "/avatars/satellite.png" },
                { name: "windmill", path: "/avatars/windmill.png" },
                { name: "harvest", path: "/avatars/harvest.png" },
                { name: "field", path: "/avatars/field.png" },
              ].map((av) => {
                const active = profileAvatar === av.path;
                return (
                  <button
                    key={av.name}
                    type="button"
                    onClick={() => updateProfileFields({ avatar: av.path })}
                    className={`relative w-11 h-11 rounded-full overflow-hidden border-2 active:scale-95 transition-all ${
                      active
                        ? "border-primary scale-105 shadow"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    disabled={profileSaving}
                  >
                    <img src={av.path} alt={av.name} className="w-full h-full object-cover" />
                    {active && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Personal data card */}
        <div className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <h3 className="font-bold text-[15.5px] text-foreground mb-3">
            {t("profile.personalData")}
          </h3>
          <dl className="text-[14.5px] font-semibold grid grid-cols-2 gap-y-3.5 items-center">
            <dt className="text-foreground/85 font-normal">{t("profile.nameLabel")}</dt>
            <dd className="font-bold text-foreground truncate max-w-[150px]">{profileName}</dd>

            <dt className="text-foreground/85 font-normal">{t("profile.cpf")}</dt>
            <dd className="font-bold text-foreground">{maskCpfLgpd(profileCpf)}</dd>

            <dt className="text-foreground/85 font-normal">{t("profile.phone")}</dt>
            <dd className="font-bold text-foreground">{maskPhoneLgpd(profilePhone)}</dd>

            <dt className="text-foreground/85 font-normal">{t("profile.password")}</dt>
            <dd>
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-bold text-foreground">
                  {password ? "••••••••" : t("profile.notRegistered")}
                </span>
                <button
                  onClick={() => {
                    setNewPasswordInput("");
                    setConfirmPasswordInput("");
                    setCodeSent(false);
                    setInputCode("");
                    setValidationError("");
                    setValidationCode("");
                    setPasswordSuccess(false);
                    setPasswordDrawerOpen(true);
                  }}
                  className="text-[13px] text-primary hover:underline font-bold transition-colors cursor-pointer"
                >
                  {t("profile.edit")}
                </button>
              </div>
            </dd>
          </dl>

          <button
            type="button"
            onClick={() => {
              setTempName(profileName);
              setTempPhone(profilePhone);
              setEditPersonalOpen(true);
            }}
            className="w-full mt-4 h-11 bg-primary text-white rounded-xl text-[14px] font-bold active:scale-[0.99] transition-all shadow-soft flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {language === "es"
              ? "Editar Datos Personales"
              : language === "en"
                ? "Edit Personal Data"
                : "Editar Dados Pessoais"}
          </button>
        </div>

        {/* Terrains Section */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1 mt-1">
            <h3 className="font-bold text-[14px] text-foreground">
              {language === "es"
                ? "Tus Terrenos"
                : language === "en"
                  ? "Your Terrains"
                  : "Meus Terrenos"}
            </h3>
            <span className="text-[11.5px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full shrink-0">
              Total: {parsedTerrenos.reduce((sum, t) => sum + (parseFloat(t.sizeVal) || 0), 0)} ha
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {parsedTerrenos.map((terreno) => (
              <div
                key={terreno.id}
                className="rounded-2xl bg-card p-4 shadow-card border border-border/60 flex flex-col gap-3 relative overflow-hidden text-left"
              >
                {/* Terrain Header */}
                <div className="flex justify-between items-center border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-foreground">{terreno.name}</span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTerrenoId(terreno.id);
                        setTempTerrenoName(terreno.name);
                        setTempTerrenoSizeVal(terreno.sizeVal);
                        setTempTerrenoSizeUnit(terreno.sizeUnit || "ha");
                        setTempTerrenoCarVal(terreno.carNumber || "");
                        setTempTerrenoSelectedCar(terreno.selectedCar || null);
                        setTempTerrenoCropsVal(terreno.crops || []);
                        setTempTerrenoSystemVal(terreno.system || "");
                        setCarsFound([]);
                        setCarError("");
                        setEditTerrenoOpen(true);
                      }}
                      className="text-[11.5px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      ✏️ {language === "es" ? "Editar" : language === "en" ? "Edit" : "Editar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTerrenoId(terreno.id);
                        setPoints(terreno.points || []);
                        setAddress(terreno.address || "");
                        setMapCenter(terreno.points?.[0] || null);
                        setMapOpen(true);
                      }}
                      className="text-[11.5px] text-primary font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      🗺️{" "}
                      {language === "es"
                        ? "Redimitar"
                        : language === "en"
                          ? "Redemarcate"
                          : "Redimitar"}
                    </button>

                    {parsedTerrenos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTerrenoProfile(terreno.id)}
                        className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-[12px] font-extrabold flex items-center justify-center border border-white shadow cursor-pointer shrink-0"
                        title={
                          language === "es" ? "Eliminar" : language === "en" ? "Delete" : "Excluir"
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Details layout */}
                <dl className="text-[13px] grid grid-cols-2 gap-y-2.5 items-center">
                  <dt className="text-muted-foreground font-normal">{t("profile.size")}</dt>
                  <dd className="font-semibold text-foreground">
                    {terreno.sizeVal}{" "}
                    {terreno.sizeUnit === "alqueire_mg"
                      ? t("cadastro.unit_alqueire_mg")
                      : terreno.sizeUnit === "alqueire_sp"
                        ? t("cadastro.unit_alqueire_sp")
                        : terreno.sizeUnit === "modulo_fiscal"
                          ? t("cadastro.unit_modulo_fiscal")
                          : t("cadastro.unit_ha")}
                  </dd>

                  <dt className="text-muted-foreground font-normal">{t("cadastro.car_number")}</dt>
                  <dd className="font-semibold text-foreground truncate max-w-[140px]">
                    {terreno.carNumber || "-"}
                  </dd>

                  <dt className="text-muted-foreground font-normal">{t("profile.crop")}</dt>
                  <dd className="font-semibold text-foreground truncate max-w-[140px]">
                    {translateCropString((terreno.crops || []).join(" + "), t)}
                  </dd>

                  <dt className="text-muted-foreground font-normal">{t("cadastro.system")}</dt>
                  <dd className="font-semibold text-foreground truncate max-w-[140px]">
                    {terreno.system === "Primeira safra"
                      ? t("cadastro.first_harvest")
                      : terreno.system === "Safrinha"
                        ? t("cadastro.second_harvest")
                        : terreno.system === "Rotação"
                          ? t("cadastro.rotation")
                          : "-"}
                  </dd>
                </dl>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                const nextId = String(Date.now());
                setEditingTerrenoId(nextId);
                setPoints([]);
                setAddress("");
                setMapCenter(null);
                setMapOpen(true);
              }}
              className="h-11 rounded-xl flex items-center justify-center gap-2 text-primary font-bold text-[13px] border border-dashed border-primary hover:bg-primary/5 transition-all cursor-pointer w-full bg-card"
            >
              +{" "}
              {language === "es"
                ? "Añadir Terreno"
                : language === "en"
                  ? "Add Terrain"
                  : "Adicionar Terreno"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-2 h-12 rounded-xl flex items-center justify-center gap-2 text-destructive font-medium text-[14px] border border-border bg-card w-full cursor-pointer shrink-0"
        >
          <LogOut size={16} /> {t("profile.signOut")}
        </button>

        <button
          onClick={() => {
            setDeleteError("");
            setDeleteDrawerOpen(true);
          }}
          className="mt-2 h-12 rounded-xl flex items-center justify-center gap-2 text-destructive font-medium text-[14px] border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors w-full cursor-pointer animate-in fade-in duration-200 shrink-0"
        >
          🗑️ {t("profile.deleteDataBtn")}
        </button>
      </div>

      {deleteDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh]">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-[16px] text-destructive">
                {language === "es"
                  ? "Eliminar cuenta"
                  : language === "en"
                    ? "Delete account"
                    : "Excluir conta"}
              </h3>
              <button
                onClick={() => setDeleteDrawerOpen(false)}
                disabled={deleting}
                className="text-[13px] text-muted-foreground hover:underline disabled:opacity-50"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            <p className="text-[13px] text-foreground leading-relaxed">
              {language === "es"
                ? "¿Está seguro de que desea eliminar su cuenta? Se borrarán sus datos del perfil y no podrá iniciar sesión nuevamente con este CPF/CNPJ. Esta acción no se puede deshacer."
                : language === "en"
                  ? "Are you sure you want to delete your account? Your profile data will be removed and you will not be able to sign in again with this CPF/CNPJ. This action cannot be undone."
                  : "Tem certeza que deseja excluir sua conta? Seus dados de perfil serao removidos e voce nao podera mais entrar com este CPF/CNPJ. Esta acao nao pode ser desfeita."}
            </p>

            {deleteError && (
              <p className="text-[12px] text-destructive font-medium">{deleteError}</p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setDeleteDrawerOpen(false)}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl border border-border font-semibold text-[14px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-50"
              >
                {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl bg-destructive text-white font-semibold text-[14px] active:scale-95 transition-all shadow-soft disabled:opacity-60"
              >
                {deleting
                  ? language === "es"
                    ? "Eliminando..."
                    : language === "en"
                      ? "Deleting..."
                      : "Excluindo..."
                  : language === "es"
                    ? "Sí, eliminar"
                    : language === "en"
                      ? "Yes, delete"
                      : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editPersonalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-[16px] text-foreground">
                {language === "es"
                  ? "Editar Datos Personales"
                  : language === "en"
                    ? "Edit Personal Data"
                    : "Editar Dados Pessoais"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditPersonalOpen(false);
                  setDrawerError("");
                }}
                disabled={profileSaving}
                className="text-[13px] text-muted-foreground hover:underline disabled:opacity-50"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            {drawerError && (
              <div className="text-[12.5px] text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
                {drawerError}
              </div>
            )}

            <div className="flex flex-col gap-4 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {t("profile.nameLabel")}
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  disabled={profileSaving}
                  placeholder={
                    language === "es"
                      ? "Ej: Geraldo Dias"
                      : language === "en"
                        ? "e.g., Geraldo Dias"
                        : "Ex: Geraldo Dias"
                  }
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {t("profile.phone")}
                </label>
                <input
                  type="text"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(maskPhone(e.target.value))}
                  disabled={profileSaving}
                  placeholder="(99) 99999-9999"
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditPersonalOpen(false);
                  setDrawerError("");
                }}
                disabled={profileSaving}
                className="flex-1 h-12 rounded-xl border border-border font-semibold text-[14px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-50"
              >
                {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDrawerError("");
                  if (!tempName.trim()) {
                    setDrawerError(
                      language === "es"
                        ? "El nombre es obligatorio."
                        : language === "en"
                          ? "Name is required."
                          : "O nome é obrigatório.",
                    );
                    return;
                  }
                  const cleanPhone = tempPhone.replace(/\D/g, "");
                  if (!tempPhone.trim() || cleanPhone.length < 10) {
                    setDrawerError(
                      language === "es"
                        ? "El teléfono no es válido."
                        : language === "en"
                          ? "Phone number is not valid."
                          : "O telefone não é válido.",
                    );
                    return;
                  }

                  try {
                    await updateProfileFields({
                      nome: tempName.trim(),
                      telefone: tempPhone.trim(),
                    });
                    setEditPersonalOpen(false);
                  } catch (e) {
                    setDrawerError(
                      language === "es"
                        ? "Error al guardar los datos."
                        : language === "en"
                          ? "Failed to save data."
                          : "Erro ao salvar os dados.",
                    );
                  }
                }}
                disabled={profileSaving}
                className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-[14px] active:scale-95 transition-all shadow-soft disabled:opacity-60 flex items-center justify-center"
              >
                {profileSaving ? (
                  <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : language === "es" ? (
                  "Guardar"
                ) : language === "en" ? (
                  "Save"
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Terrain Drawer */}
      {editTerrenoOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-[16px] text-foreground">
                {language === "es"
                  ? "Editar Terreno"
                  : language === "en"
                    ? "Edit Terrain"
                    : "Editar Terreno"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditTerrenoOpen(false);
                  setCarsFound([]);
                  setCarError("");
                }}
                className="text-[13px] text-muted-foreground hover:underline"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            {carError && (
              <div className="text-[12px] font-bold text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-2 text-center">
                ⚠️ {carError}
              </div>
            )}

            <div className="flex flex-col gap-4 flex-1">
              {/* Terrain Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {language === "es"
                    ? "Nombre de la Tierra"
                    : language === "en"
                      ? "Terrain Name"
                      : "Nome do Terreno"}
                </label>
                <input
                  type="text"
                  value={tempTerrenoName}
                  onChange={(e) => setTempTerrenoName(e.target.value)}
                  placeholder="Ex: Terreno 1"
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold"
                />
              </div>

              {/* Terrain Size */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {t("cadastro.size_label_v2")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tempTerrenoSizeVal}
                    onChange={(e) => setTempTerrenoSizeVal(e.target.value)}
                    placeholder="0"
                    className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] flex-1 font-semibold"
                  />
                  <select
                    value={tempTerrenoSizeUnit}
                    onChange={(e) => setTempTerrenoSizeUnit(e.target.value as any)}
                    className="h-12 px-3 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[14px] font-semibold cursor-pointer"
                  >
                    <option value="ha">{t("cadastro.unit_ha")}</option>
                    <option value="alqueire_mg">{t("cadastro.unit_alqueire_mg")}</option>
                    <option value="alqueire_sp">{t("cadastro.unit_alqueire_sp")}</option>
                    <option value="modulo_fiscal">{t("cadastro.unit_modulo_fiscal")}</option>
                  </select>
                </div>
              </div>

              {/* CAR Number */}
              <div className="flex flex-col gap-1.5 bg-soft/30 p-3 rounded-2xl border border-border/40">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium text-foreground/80">
                    {t("cadastro.car_number")}
                  </label>
                  {/* Fetch CAR trigger */}
                  <button
                    type="button"
                    onClick={async () => {
                      const terrainToFind = parsedTerrenos.find((t) => t.id === editingTerrenoId);
                      if (terrainToFind) {
                        await handleFetchCarForTerreno(terrainToFind.id, terrainToFind.points);
                      }
                    }}
                    disabled={
                      carSearchingId === editingTerrenoId ||
                      !parsedTerrenos.find((t) => t.id === editingTerrenoId)?.points ||
                      (parsedTerrenos.find((t) => t.id === editingTerrenoId)?.points?.length || 0) <
                        3
                    }
                    className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5 active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {carSearchingId === editingTerrenoId
                      ? `🔍 ${t("cadastro.searching")}`
                      : "🔍 Buscar na área demarcada"}
                  </button>
                </div>

                {carSearchingId === editingTerrenoId && (
                  <div className="text-[11px] text-muted-foreground bg-soft border border-border rounded-lg p-2.5 text-center mt-1">
                    Verificando dados. Pode levar até 2 minutos...
                  </div>
                )}

                {carsFound.length > 0 && !tempTerrenoSelectedCar ? (
                  <div className="flex flex-col gap-1.5 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg animate-in fade-in duration-200 mt-1">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      {carsFound.length} CAR(s) encontrado(s). Escolha seu CAR:
                    </span>
                    <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-1">
                      {carsFound.map((car, idx) => {
                        const code = getCarCode(car, `CAR-${idx + 1}`);
                        const location = getCarLocation(car);
                        const area = getCarArea(car);
                        return (
                          <button
                            key={`${code}-${idx}`}
                            type="button"
                            onClick={() => {
                              setTempTerrenoSelectedCar(car);
                              setTempTerrenoCarVal(code);
                            }}
                            className="w-full text-left px-2.5 py-1.5 bg-white dark:bg-soft hover:bg-secondary rounded-lg border border-border text-[11px] font-medium flex justify-between items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span className="flex flex-col min-w-0">
                              <span className="text-foreground font-semibold truncate">{code}</span>
                              {location && (
                                <span className="text-muted-foreground text-[10px] truncate">
                                  {location}
                                </span>
                              )}
                            </span>
                            {area !== null && (
                              <span className="text-primary font-bold whitespace-nowrap text-[10px]">
                                {area.toFixed(2)} ha
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <input
                      value={tempTerrenoCarVal}
                      onChange={(e) => {
                        setTempTerrenoCarVal(e.target.value);
                        if (tempTerrenoSelectedCar) setTempTerrenoSelectedCar(null);
                      }}
                      placeholder="Ex: BR-MG-3170107-..."
                      className="h-11 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[14px] w-full font-semibold"
                    />
                    {tempTerrenoSelectedCar && (
                      <div className="flex items-center justify-between gap-1.5 bg-primary/5 p-1 px-2 rounded-lg border border-primary/20">
                        <span className="text-[10px] text-primary font-bold">
                          CAR selecionado e pronto para salvar.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTempTerrenoSelectedCar(null);
                            setTempTerrenoCarVal("");
                            setCarsFound([]);
                          }}
                          className="text-[9.5px] text-muted-foreground hover:underline font-bold"
                        >
                          Trocar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Crops Checklist */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {t("profile.crop")}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1">
                  {cropOptions.map((crop) => {
                    const active = tempTerrenoCropsVal.includes(crop);
                    return (
                      <button
                        key={crop}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setTempTerrenoCropsVal(tempTerrenoCropsVal.filter((x) => x !== crop));
                          } else {
                            setTempTerrenoCropsVal([...tempTerrenoCropsVal, crop]);
                          }
                        }}
                        className={`h-8 px-3 rounded-lg text-[11px] font-semibold border active:scale-95 transition-all cursor-pointer ${
                          active
                            ? "bg-primary border-primary text-primary-foreground font-bold"
                            : "bg-soft border-border text-foreground/80 hover:bg-secondary"
                        }`}
                      >
                        {active ? `✓ ${t("crops." + crop)}` : t("crops." + crop)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Crop System Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-foreground/80">
                  {t("cadastro.system")}
                </label>
                <select
                  value={tempTerrenoSystemVal}
                  onChange={(e) => setTempTerrenoSystemVal(e.target.value)}
                  className="h-12 px-3 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[14px] font-semibold cursor-pointer"
                >
                  <option value="">
                    {language === "es"
                      ? "Seleccionar"
                      : language === "en"
                        ? "Select"
                        : "Selecionar"}
                  </option>
                  <option value="Primeira safra">{t("cadastro.first_harvest")}</option>
                  <option value="Safrinha">{t("cadastro.second_harvest")}</option>
                  <option value="Rotação">{t("cadastro.rotation")}</option>
                </select>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex gap-2 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditTerrenoOpen(false);
                  setCarsFound([]);
                  setCarError("");
                }}
                className="flex-1 h-12 rounded-xl border border-border font-semibold text-[14px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all"
              >
                {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!tempTerrenoName.trim()) {
                    return;
                  }

                  const size = parseFloat(tempTerrenoSizeVal) || 0;
                  let tHectares = size;
                  if (tempTerrenoSizeUnit === "alqueire_mg") tHectares = size * 4.84;
                  else if (tempTerrenoSizeUnit === "alqueire_sp") tHectares = size * 2.42;
                  else if (tempTerrenoSizeUnit === "modulo_fiscal") tHectares = size * 60;

                  const updated = parsedTerrenos.map((t) =>
                    t.id === editingTerrenoId
                      ? {
                          ...t,
                          name: tempTerrenoName.trim(),
                          sizeVal: tempTerrenoSizeVal,
                          sizeUnit: tempTerrenoSizeUnit,
                          hectares: Number(tHectares.toFixed(2)),
                          carNumber: tempTerrenoCarVal.trim(),
                          selectedCar: tempTerrenoSelectedCar,
                          crops: tempTerrenoCropsVal,
                          system: tempTerrenoSystemVal,
                        }
                      : t,
                  );

                  const totalH = Number(
                    updated.reduce((sum, t) => sum + (t.hectares || 0), 0).toFixed(2),
                  );

                  await updateProfileFields({
                    terrenos: updated,
                    hectares: totalH,
                    numeroCAR: updated[0]?.carNumber || profileData?.numeroCAR || "",
                    produtosCultivados: updated[0]?.crops || profileData?.produtosCultivados || [],
                    sistema: updated[0]?.system || profileData?.sistema || "",
                  });

                  setEditTerrenoOpen(false);
                  setCarsFound([]);
                  setCarError("");
                }}
                className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-[14px] active:scale-95 transition-all shadow-soft flex items-center justify-center"
              >
                {profileSaving ? (
                  <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : language === "es" ? (
                  "Guardar"
                ) : language === "en" ? (
                  "Save"
                ) : (
                  "Salvar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Drawer Overlay */}
      {passwordDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-[16px] text-foreground">
                {password ? t("profile.drawerTitle_edit") : t("profile.drawerTitle_create")}
              </h3>
              <button
                type="button"
                onClick={() => setPasswordDrawerOpen(false)}
                className="text-[13px] text-muted-foreground hover:underline"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            {validationError && (
              <div className="text-[12.5px] text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
                {validationError}
              </div>
            )}

            {passwordSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="font-bold text-[16px] text-foreground">
                  {t("profile.successTitle")}
                </h4>
                <p className="text-[13px] text-muted-foreground leading-relaxed px-4">
                  {t("profile.successDesc")}
                </p>
                <button
                  type="button"
                  onClick={() => setPasswordDrawerOpen(false)}
                  className="w-full mt-4 h-12 bg-primary text-white font-semibold rounded-xl text-[14px] active:scale-95 transition-all shadow-soft flex items-center justify-center"
                >
                  OK
                </button>
              </div>
            ) : !codeSent ? (
              // Step 1: Input New Password
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {t("profile.drawerDesc")}
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-foreground/80">
                    {t("profile.newPassword")}
                  </label>
                  <input
                    type="password"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder={t("profile.newPasswordPlaceholder")}
                    className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-foreground/80">
                    {t("profile.confirmPassword")}
                  </label>
                  <input
                    type="password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder={t("profile.confirmPasswordPlaceholder")}
                    className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold"
                  />
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setValidationError("");
                    if (!newPasswordInput.trim()) {
                      setValidationError(t("profile.errorEmpty"));
                      return;
                    }
                    if (newPasswordInput !== confirmPasswordInput) {
                      setValidationError(t("profile.errorMismatch"));
                      return;
                    }

                    const code = Math.floor(1000 + Math.random() * 9000).toString();
                    setValidationCode(code);

                    try {
                      const success = await sendWhatsAppVerificationCode(profilePhone, code);
                      if (success) {
                        setCodeSent(true);
                        setPushNotification(true);
                        setTimeout(() => setPushNotification(false), 8000);
                      } else {
                        setValidationError(
                          language === "es"
                            ? "Error al enviar el código de confirmación."
                            : language === "en"
                              ? "Failed to send confirmation code."
                              : "Erro ao enviar código de confirmação.",
                        );
                      }
                    } catch (err) {
                      setValidationError(
                        language === "es"
                          ? "Error al enviar el código."
                          : language === "en"
                            ? "Failed to send code."
                            : "Erro ao enviar o código.",
                      );
                    }
                  }}
                  className="w-full mt-2 h-12 bg-primary text-white font-semibold rounded-xl text-[14px] active:scale-95 transition-all shadow-soft flex items-center justify-center gap-1.5"
                >
                  {t("profile.sendCodeBtn")}
                </button>
              </div>
            ) : (
              // Step 2: Verification Code
              <div className="flex flex-col gap-4">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {t("profile.codeSentDesc").replace("{phone}", maskPhoneLgpd(profilePhone))}
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-foreground/80">
                    {t("profile.codeLabel")}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                    placeholder={t("profile.codePlaceholder")}
                    className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full font-semibold text-center tracking-widest"
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeSent(false);
                      setInputCode("");
                      setValidationError("");
                    }}
                    className="flex-1 h-12 rounded-xl border border-border font-semibold text-[14px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all"
                  >
                    {t("profile.backBtn")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError("");
                      if (inputCode !== validationCode) {
                        setValidationError(t("profile.codeError"));
                        return;
                      }

                      // Save password
                      appStore.set({ password: newPasswordInput.trim() });
                      setPasswordSuccess(true);
                    }}
                    className="flex-1 h-12 rounded-xl bg-primary text-white font-semibold text-[14px] active:scale-95 transition-all shadow-soft flex items-center justify-center"
                  >
                    {t("profile.confirmBtn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expanded Map Drawer Overlay */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-300">
          <header className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-border bg-white shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                setMapOpen(false);
                setEditingTerrenoId(null);
              }}
              className="p-1.5 hover:bg-secondary rounded-lg text-navy shrink-0"
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-[16px] font-bold text-foreground">
              {editingTerrenoId && parsedTerrenos.some((t) => t.id === editingTerrenoId)
                ? language === "es"
                  ? "Redimitar Terreno"
                  : language === "en"
                    ? "Redemarcate Terrain"
                    : "Redimitar Terreno"
                : language === "es"
                  ? "Añadir Terreno"
                  : language === "en"
                    ? "Add Terrain"
                    : "Adicionar Terreno"}
            </h2>
          </header>

          <div className="p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-foreground/80">
                {t("cadastro.address_label")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchAddress();
                    }
                  }}
                  placeholder={t("cadastro.address_placeholder")}
                  className="h-12 pl-4 pr-12 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[15px] w-full"
                />
                <button
                  type="button"
                  onClick={handleSearchAddress}
                  disabled={searchingAddress || !address.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-primary active:scale-95 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center"
                  title="Buscar no mapa"
                >
                  {searchingAddress ? (
                    <span className="block w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                </button>
              </div>
              {searchAddressError && (
                <p className="text-[11px] font-semibold text-red-500 animate-in fade-in duration-200 mt-0.5">
                  ⚠️ {searchAddressError}
                </p>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-h-[240px]">
              <label className="text-[13px] font-medium text-foreground/80 flex items-center justify-between">
                <span>{t("cadastro.outline_label")}</span>
                <span className="text-[11px] text-muted-foreground">
                  {points.length} {points.length === 1 ? t("cadastro.point") : t("cadastro.points")}
                </span>
              </label>

              <div className="relative flex-1 rounded-2xl overflow-hidden border border-border select-none min-h-[260px] bg-secondary">
                <div className="absolute top-3 left-3 z-[500] bg-navy/80 backdrop-blur text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow pointer-events-none">
                  {t("cadastro.map_helper")}
                </div>

                <Suspense
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-muted-foreground bg-soft/40">
                      Carregando mapa...
                    </div>
                  }
                >
                  <FarmMap points={points} setPoints={setPoints} center={mapCenter} />
                </Suspense>

                {points.length === 0 && (
                  <div className="absolute inset-x-4 bottom-4 z-[500] rounded-xl bg-white/90 backdrop-blur px-3 py-2 text-[12px] font-medium text-navy shadow pointer-events-none text-center">
                    {t("cadastro.map_empty")}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPoints([])}
                disabled={points.length === 0}
                className="h-12 px-3 rounded-xl border border-border font-semibold text-[13px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                {t("cadastro.clear_btn")}
              </button>
              <button
                type="button"
                onClick={() => setPoints(points.slice(0, -1))}
                disabled={points.length === 0}
                className="h-12 px-3 rounded-xl border border-border font-semibold text-[13px] text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-40"
              >
                {t("cadastro.undo_btn")}
              </button>
              <button
                type="button"
                onClick={handleConfirmMap}
                className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                {t("cadastro.confirm_land_btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
