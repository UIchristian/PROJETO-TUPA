import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Eye, Landmark, ShieldCheck, ArrowRight } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { t, useTranslation } from "@/lib/i18n";
import { appStore } from "@/lib/app-store";

export const Route = createFileRoute("/lavoura/acao")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: `${t("action.title", lang)} — SafraSense` }],
    };
  },
  component: AcaoScreen,
});

function AcaoScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleAction = () => {
    appStore.set({
      protected: true,
      selectedCooperative: "CAUNA", // Aliado default
    });
    navigate({ to: "/protecao/confirmado" });
  };

  return (
    <MobileFrame withNav>
      <header className="px-5 pt-5 pb-2 flex items-center gap-2">
        <Link to="/lavoura" className="-ml-2 p-2 text-navy">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-lg font-bold">{t("action.title")}</h1>
      </header>

      <div className="px-5 pb-6 flex-1 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("action.subtitle")}</p>

        {/* Card 1 */}
        <div className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center">
              <Eye size={20} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t("action.card1_title")}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t("action.card1_desc")}
              </p>
              <Link
                to="/lavoura"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-navy"
              >
                {t("action.card1_btn")} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-l-4 border-navy">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center">
              <Landmark size={20} className="text-navy" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{t("action.card2_title")}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t("action.card2_desc")}
              </p>
              <Link
                to="/programas"
                className="inline-flex items-center gap-1.5 mt-3 h-9 px-3 rounded-lg bg-navy text-navy-foreground text-sm font-semibold"
              >
                {t("action.card2_btn")} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3 — Seguro Paramétrico Climático */}
        <article className="rounded-2xl bg-card p-4 shadow-card border border-border/60">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base">{t("protection.title")}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {t("protection.status")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {t("protection.subtitle")}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-soft px-3 py-2.5 text-sm text-foreground/80 font-medium">
            {t("protection.benefit")}
          </div>

          <div className="mt-4 border-t border-border/40 pt-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("protection.disclaimer")}
            </p>

            <button
              onClick={handleAction}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform shadow-soft"
            >
              {t("protection.btn_know_conditions")} <ArrowRight size={14} />
            </button>
          </div>
        </article>
      </div>
    </MobileFrame>
  );
}
