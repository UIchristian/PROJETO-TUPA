import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  User,
  MapPin,
  ChevronRight,
  LogOut,
  Phone,
  FileText,
  Settings,
  Camera,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { MOCK_IMOVEIS, MOCK_DIAGNOSTICOS } from "@/mock";

export const Route = createFileRoute("/perfil")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: `${t("profile.title", lang)} · Tupã` }],
    };
  },
  component: PerfilScreen,
});

function maskCpfCnpj(v: string) {
  const clean = v.replace(/\D/g, "");
  if (clean.length <= 11) {
    return clean
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return clean
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
}

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
  const { farmer } = useAppState();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  // Edit fields temp state
  const [tempName, setTempName] = useState("");
  const [tempCpf, setTempCpf] = useState("");
  const [tempPhone, setTempPhone] = useState("");

  // Load Firestore data if logged in
  useEffect(() => {
    const loadProfileData = async (uid: string) => {
      try {
        const snap = await getDoc(doc(db, "usuarios", uid));
        if (snap.exists()) {
          const data = snap.data();
          appStore.set({
            farmer: {
              ...appStore.get().farmer,
              firebaseUid: uid,
              name: data.nome || appStore.get().farmer.name || "Geraldo Dias",
              cpf: data.cpf || appStore.get().farmer.cpf || "123.456.789-00",
              phone: data.telefone || appStore.get().farmer.phone || "(61) 99999-9999",
              avatar: data.avatar || appStore.get().farmer.avatar || "",
            },
          });
        }
      } catch (err) {
        console.error("Firestore getDoc failed", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    const uid = auth.currentUser?.uid || farmer.firebaseUid;
    if (uid) {
      loadProfileData(uid);
    } else {
      setLoadingProfile(false);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase signOut failed", e);
    }
    appStore.reset();
    navigate({ to: "/" });
  };

  const handleSelectProperty = (id: string) => {
    const mockImovel = MOCK_IMOVEIS.find((im) => im.id === id);

    if (mockImovel) {
      const mockPoints = mockImovel.poligonoDeclarado.coordinates[0].map((coords) => ({
        lat: coords[1],
        lng: coords[0],
      }));

      const nextTerrenos = [
        {
          id: mockImovel.id,
          name: mockImovel.nome,
          points: mockPoints,
          sizeVal: String(mockImovel.areaHectares),
          sizeUnit: "ha" as const,
          hectares: mockImovel.areaHectares,
          carNumber: mockImovel.numeroCAR,
          address: `${mockImovel.municipio}, ${mockImovel.uf}`,
          status: id === "fazenda-sol-nascente" ? ("alert" as const) : ("healthy" as const),
          selectedCar: mockImovel,
        },
      ];

      appStore.set({
        activeTerrenoId: mockImovel.id,
        status: id === "fazenda-sol-nascente" ? "alert" : "healthy",
        farmer: {
          ...farmer,
          name: farmer.name || "Geraldo Dias",
          cpf: farmer.cpf || "123.456.789-00",
          phone: farmer.phone || "(61) 99999-9999",
          property: mockImovel.nome,
          location: `${mockImovel.municipio}, ${mockImovel.uf}`,
          area: mockImovel.areaHectares,
          car: mockImovel.numeroCAR,
          areaPolygon: mockPoints,
          terrenos: nextTerrenos,
        },
      });
    } else {
      appStore.setActiveTerreno(id);
    }

    navigate({ to: "/diagnostico" });
  };

  const getComplianceInfo = (imovelId: string) => {
    const diag = MOCK_DIAGNOSTICOS[imovelId];
    const score = diag ? diag.scoreConformidade : 100;

    if (score >= 90) {
      return {
        score,
        label: language === "es" ? "Regular" : language === "en" ? "Compliant" : "Regular",
        colorClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      };
    } else if (score >= 60) {
      return {
        score,
        label: language === "es" ? "Atención" : language === "en" ? "Warning" : "Atenção",
        colorClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      };
    } else {
      return {
        score,
        label: language === "es" ? "Crítico" : language === "en" ? "Critical" : "Crítico",
        colorClass: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      };
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingPhoto(true);
    setPhotoError("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;

      // Simulate upload to Firebase Storage
      setTimeout(async () => {
        appStore.set({
          farmer: {
            ...farmer,
            avatar: base64Data,
          },
        });

        const uid = auth.currentUser?.uid || farmer.firebaseUid;
        if (uid) {
          try {
            await setDoc(
              doc(db, "usuarios", uid),
              {
                avatar: base64Data,
                atualizadoEm: new Date(),
              },
              { merge: true },
            );
          } catch (err) {
            console.error("Firestore setDoc avatar failed", err);
            setPhotoError(
              language === "es"
                ? "Error al guardar en el servidor."
                : language === "en"
                  ? "Failed to save to server."
                  : "Erro ao salvar no servidor.",
            );
          }
        }

        setSavingPhoto(false);
      }, 1000);
    };

    reader.onerror = () => {
      setPhotoError(
        language === "es"
          ? "Error al leer el archivo de imagen."
          : language === "en"
            ? "Error reading image file."
            : "Erro ao ler o arquivo de imagem.",
      );
      setSavingPhoto(false);
    };

    reader.readAsDataURL(file);
  };

  const handleOpenEdit = () => {
    setTempName(farmer.name || "Geraldo Dias");
    setTempCpf(farmer.cpf || "123.456.789-00");
    setTempPhone(farmer.phone || "(61) 99999-9999");
    setDrawerError("");
    setEditOpen(true);
  };

  const handleSavePersonalData = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrawerError("");
    setDrawerSaving(true);

    if (!tempName.trim()) {
      setDrawerError(
        language === "es"
          ? "El nombre es obligatorio."
          : language === "en"
            ? "Name is required."
            : "O nome é obrigatório.",
      );
      setDrawerSaving(false);
      return;
    }

    const cleanCpf = tempCpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
      setDrawerError(
        language === "es"
          ? "Por favor, digite un CPF o CNPJ válido."
          : language === "en"
            ? "Please enter a valid CPF or CNPJ."
            : "Por favor, digite um CPF ou CNPJ válido.",
      );
      setDrawerSaving(false);
      return;
    }

    const cleanPhone = tempPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setDrawerError(
        language === "es"
          ? "Por favor, digite un teléfono de contacto válido."
          : language === "en"
            ? "Please enter a valid contact phone."
            : "Por favor, digite um telefone de contato válido.",
      );
      setDrawerSaving(false);
      return;
    }

    // Update locally
    appStore.set({
      farmer: {
        ...farmer,
        name: tempName.trim(),
        cpf: tempCpf.trim(),
        phone: tempPhone.trim(),
      },
    });

    // Update Firestore if user has UID
    const uid = auth.currentUser?.uid || farmer.firebaseUid;
    if (uid) {
      try {
        await setDoc(
          doc(db, "usuarios", uid),
          {
            nome: tempName.trim(),
            cpf: tempCpf.trim(),
            telefone: tempPhone.trim(),
            atualizadoEm: new Date(),
          },
          { merge: true },
        );
      } catch (err) {
        console.error("Firestore setDoc details failed", err);
      }
    }

    setDrawerSaving(false);
    setEditOpen(false);
  };

  const initials = (farmer.name || "Geraldo Dias")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <MobileFrame withNav>
      <header className="px-5 pt-6 pb-4 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-foreground">{t("profile.title")}</h1>
        <button
          onClick={() => navigate({ to: "/configuracoes" })}
          className="h-10 w-10 rounded-2xl bg-secondary/15 text-primary flex items-center justify-center hover:bg-secondary/25 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none"
          aria-label={t("settings.title") || "Configurações"}
        >
          <Settings size={20} />
        </button>
      </header>

      <div className="px-5 pb-6 flex-1 flex flex-col gap-6 overflow-y-auto">
        {/* Photo & Identity Section */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card flex flex-col items-center gap-4 animate-in fade-in duration-200">
          <div className="relative group">
            <button
              onClick={handlePhotoClick}
              disabled={savingPhoto}
              className="w-24 h-24 rounded-full border-2 border-border/60 bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-soft overflow-hidden relative active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none"
              aria-label={t("profile.changePhoto") || "Alterar Foto"}
            >
              {farmer.avatar ? (
                <img
                  src={farmer.avatar}
                  alt={farmer.name || "Avatar"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}

              {savingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              )}
            </button>

            <button
              onClick={handlePhotoClick}
              disabled={savingPhoto}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground border border-background shadow flex items-center justify-center hover:bg-primary/95 transition-all cursor-pointer"
              title={t("profile.changePhoto") || "Alterar Foto"}
            >
              <Camera size={14} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {photoError && (
            <span className="text-xs text-destructive font-semibold">{photoError}</span>
          )}

          <div className="text-center w-full min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {farmer.name || "Geraldo Dias"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              {farmer.property || "Sítio Boa Esperança"}
            </p>
          </div>
        </div>

        {/* Personal Details Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-card flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center border-b border-border/50 pb-2">
            <h3 className="text-base font-bold text-foreground">
              {t("profile.personalData") || "Dados Pessoais"}
            </h3>
            <button
              onClick={handleOpenEdit}
              className="text-sm font-bold text-primary hover:underline cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none px-1 rounded"
            >
              {t("profile.edit") || "Alterar"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground font-medium">
                {t("profile.nameLabel") || "Nome"}
              </span>
              <span className="text-sm font-bold text-foreground truncate">
                {farmer.name || "Geraldo Dias"}
              </span>
            </div>

            <div className="h-px bg-border/40" />

            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground font-medium">
                {t("profile.cpf") || "CPF / CNPJ"}
              </span>
              <span className="text-sm font-bold text-foreground">
                {maskCpfLgpd(farmer.cpf || "123.456.789-00")}
              </span>
            </div>

            <div className="h-px bg-border/40" />

            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground font-medium">
                {t("profile.phone") || "Telefone"}
              </span>
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Phone size={14} className="text-primary/70" />
                {maskPhoneLgpd(farmer.phone || "(61) 99999-9999")}
              </span>
            </div>
          </div>
        </div>

        {/* Lands / Property Section */}
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold text-foreground/90 px-1">
            {language === "es" ? "Mis Tierras" : language === "en" ? "My Lands" : "Minhas Terras"}
          </h3>

          <div className="flex flex-col gap-3">
            {MOCK_IMOVEIS.map((imovel) => {
              const compliance = getComplianceInfo(imovel.id);
              const isActive = farmer.property === imovel.nome;

              return (
                <button
                  key={imovel.id}
                  onClick={() => handleSelectProperty(imovel.id)}
                  className={`w-full text-left p-4 bg-card rounded-2xl border-2 transition-all flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary outline-none ${
                    isActive ? "border-primary" : "border-border/60 hover:border-border"
                  }`}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="font-bold text-foreground text-base truncate">
                      {imovel.nome}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                      <MapPin size={13} className="text-primary shrink-0" />
                      {imovel.municipio} - {imovel.uf} · {imovel.areaHectares} ha
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${compliance.colorClass}`}
                    >
                      {compliance.label} ({compliance.score}%)
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sign Out Card */}
        <button
          onClick={handleSignOut}
          className="h-12 rounded-xl bg-destructive/10 text-destructive font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-destructive/20 mt-4 shrink-0 hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-destructive outline-none"
        >
          <LogOut size={16} />
          {t("profile.signOut")}
        </button>
      </div>

      {/* Edit Drawer Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto shadow-2xl border-t border-border">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-base text-foreground">
                {language === "es"
                  ? "Editar Datos Personales"
                  : language === "en"
                    ? "Edit Personal Data"
                    : "Editar Dados Pessoais"}
              </h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={drawerSaving}
                className="text-sm text-muted-foreground hover:underline disabled:opacity-50 cursor-pointer"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            {drawerError && (
              <div className="text-sm text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
                {drawerError}
              </div>
            )}

            <form onSubmit={handleSavePersonalData} className="flex flex-col gap-4 flex-1">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="edit-profile-name"
                  className="text-sm font-medium text-foreground/80"
                >
                  {t("profile.nameLabel") || "Nome do Produtor"}
                </label>
                <input
                  id="edit-profile-name"
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  disabled={drawerSaving}
                  placeholder={
                    language === "es"
                      ? "Ej: Geraldo Dias"
                      : language === "en"
                        ? "e.g., Geraldo Dias"
                        : "Ex: Geraldo Dias"
                  }
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full font-semibold text-foreground"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="edit-profile-cpf"
                  className="text-sm font-medium text-foreground/80"
                >
                  {t("profile.cpf") || "CPF / CNPJ"}
                </label>
                <input
                  id="edit-profile-cpf"
                  type="text"
                  value={tempCpf}
                  onChange={(e) => setTempCpf(maskCpfCnpj(e.target.value))}
                  disabled={drawerSaving}
                  placeholder="000.000.000-00"
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full font-semibold text-foreground"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="edit-profile-phone"
                  className="text-sm font-medium text-foreground/80"
                >
                  {t("profile.phone") || "Telefone"}
                </label>
                <input
                  id="edit-profile-phone"
                  type="tel"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(maskPhone(e.target.value))}
                  disabled={drawerSaving}
                  placeholder="(61) 99999-9999"
                  className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base w-full font-semibold text-foreground"
                />
              </div>

              <div className="flex gap-2 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  disabled={drawerSaving}
                  className="flex-1 h-12 rounded-xl border border-border font-semibold text-sm text-foreground/80 hover:bg-secondary/40 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={drawerSaving}
                  className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-95 transition-all shadow-soft disabled:opacity-60 flex items-center justify-center cursor-pointer"
                >
                  {drawerSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : language === "es" ? (
                    "Guardar"
                  ) : language === "en" ? (
                    "Save"
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
