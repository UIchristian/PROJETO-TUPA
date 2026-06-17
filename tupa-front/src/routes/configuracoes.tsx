import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileFrame } from "@/components/MobileFrame";
import AccessibilityControls from "@/components/AccessibilityControls";
import { useAppState, appStore } from "@/lib/app-store";
import { useTranslation } from "@/lib/i18n";
import { deleteUser, signOut } from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useState } from "react";
import { LogOut, ChevronLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => {
    const lang = appStore.get().language || "es";
    const title = lang === "es" ? "Configuraciones" : lang === "en" ? "Settings" : "Configurações";
    return {
      meta: [{ title: `${title} · Tupã` }],
    };
  },
  component: ConfiguracoesScreen,
});

function ConfiguracoesScreen() {
  const { t, language, setLanguage } = useTranslation();
  const { farmer } = useAppState();
  const navigate = useNavigate();
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [satelliteAlerts, setSatelliteAlerts] = useState(true);
  const [monthlyReports, setMonthlyReports] = useState(false);
  const [whatsAppNotif, setWhatsAppNotif] = useState(true);

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
        setDeleteError(t("settings.reauthError") as string);
      } else {
        setDeleteError(t("settings.deleteError") as string);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MobileFrame withNav>
      <header className="px-5 pt-6 pb-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/perfil" })}
            className="p-1 rounded-lg hover:bg-secondary/20 text-foreground transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none"
            aria-label={t("profile.backBtn") || "Voltar"}
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-foreground">{t("settings.title")}</h1>
        </div>
        <p className="text-sm text-navy font-semibold leading-snug">{t("settings.subtitle")}</p>
      </header>

      <div className="px-5 pb-6 flex flex-col gap-4 mt-2 overflow-y-auto flex-1">
        {/* Accessibility Panel */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("settings.accessibilityTitle")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {t("settings.accessibilityDescription")}
              </p>
            </div>
            <div className="mt-1">
              <AccessibilityControls />
            </div>
          </div>
        </div>

        {/* Preferences & Notifications */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.notificationsTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("settings.notificationsDescription")}
            </p>
          </div>

          <form className="mt-4 flex flex-col gap-3.5">
            <label
              htmlFor="satellite-alerts"
              className="flex items-center justify-between cursor-pointer py-1 select-none"
            >
              <div className="flex flex-col pr-4 min-w-0">
                <span className="text-sm font-semibold text-foreground">
                  {t("settings.satelliteAlerts")}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {t("settings.satelliteAlertsDesc")}
                </span>
              </div>
              <input
                id="satellite-alerts"
                type="checkbox"
                checked={satelliteAlerts}
                onChange={(e) => setSatelliteAlerts(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
              />
            </label>

            <div className="h-px bg-border/60" />

            <label
              htmlFor="monthly-reports"
              className="flex items-center justify-between cursor-pointer py-1 select-none"
            >
              <div className="flex flex-col pr-4 min-w-0">
                <span className="text-sm font-semibold text-foreground">
                  {t("settings.monthlyReports")}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {t("settings.monthlyReportsDesc")}
                </span>
              </div>
              <input
                id="monthly-reports"
                type="checkbox"
                checked={monthlyReports}
                onChange={(e) => setMonthlyReports(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
              />
            </label>

            <div className="h-px bg-border/60" />

            <label
              htmlFor="whatsapp-notifications"
              className="flex items-center justify-between cursor-pointer py-1 select-none"
            >
              <div className="flex flex-col pr-4 min-w-0">
                <span className="text-sm font-semibold text-foreground">
                  {t("settings.whatsappNotif")}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {t("settings.whatsappNotifDesc")}
                </span>
              </div>
              <input
                id="whatsapp-notifications"
                type="checkbox"
                checked={whatsAppNotif}
                onChange={(e) => setWhatsAppNotif(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer shrink-0"
              />
            </label>
          </form>
        </div>

        {/* Language Selection */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div>
            <label
              htmlFor="language-select"
              className="block text-base font-semibold text-foreground"
            >
              {t("settings.languageTitle")}
            </label>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("settings.languageDescription")}
            </p>
          </div>

          <div className="mt-4">
            <div className="relative">
              <select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="appearance-none w-full bg-secondary/80 border border-border/80 text-foreground text-sm font-semibold rounded-xl py-3 pl-4 pr-10 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="pt">🇧🇷 Português</option>
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇺🇸 English</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Account panel */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("settings.accountTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("settings.accountDescription")}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="h-12 w-full rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none"
            >
              <LogOut size={16} />
              {t("profile.signOut")}
            </button>
            <button
              type="button"
              onClick={() => setDeleteDrawerOpen(true)}
              className="h-12 w-full rounded-xl border border-destructive/20 bg-destructive/5 text-destructive font-semibold text-sm transition-all hover:bg-destructive/10 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-destructive outline-none"
            >
              <Trash2 size={16} />
              {t("profile.deleteDataBtn")}
            </button>
          </div>
        </div>
      </div>

      {deleteDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-background w-full max-w-[390px] rounded-t-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] shadow-2xl border-t border-border">
            <header className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <h3 className="font-bold text-base text-destructive">
                {language === "es"
                  ? "Eliminar cuenta"
                  : language === "en"
                    ? "Delete account"
                    : "Excluir conta"}
              </h3>
              <button
                type="button"
                onClick={() => setDeleteDrawerOpen(false)}
                disabled={deleting}
                className="text-sm text-muted-foreground hover:underline disabled:opacity-50 cursor-pointer"
              >
                {language === "es" ? "Cerrar" : language === "en" ? "Close" : "Fechar"}
              </button>
            </header>

            <p className="text-sm text-foreground leading-relaxed">
              {language === "es"
                ? "¿Está seguro de que desea eliminar su cuenta? Se borrarán sus datos del perfil y no podrá iniciar sesión nuevamente con este CPF/CNPJ. Esta acción no se puede deshacer."
                : language === "en"
                  ? "Are you sure you want to delete your account? Your profile data will be removed and you will not be able to sign in again with this CPF/CNPJ. This action cannot be undone."
                  : "Tem certeza que deseja excluir sua conta? Seus dados de perfil serão removidos e você não poderá mais entrar com este CPF/CNPJ. Esta ação não pode ser desfeita."}
            </p>

            {deleteError && <p className="text-sm text-destructive font-medium">{deleteError}</p>}

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setDeleteDrawerOpen(false)}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl border border-border font-semibold text-sm text-foreground/80 hover:bg-secondary active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {language === "es" ? "Cancelar" : language === "en" ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 h-12 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm hover:bg-destructive/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
              >
                {deleting ? (
                  <span className="block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : language === "es" ? (
                  "Eliminar"
                ) : language === "en" ? (
                  "Delete"
                ) : (
                  "Excluir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
