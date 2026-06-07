import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { CheckCircle2, Leaf, Landmark, ShieldCheck, ChevronLeft, ArrowRight } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/onboarding")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: t("onboarding.headTitle", lang) }],
    };
  },
  component: OnboardingScreen,
});

function OnboardingScreen() {
  const navigate = useNavigate();
  const { farmer } = useAppState();
  const { t } = useTranslation();

  return (
    <MobileFrame>
      <header className="px-5 pt-5 pb-3 flex items-center">
        <Link to="/cadastro" className="-ml-2 p-2 text-navy">
          <ChevronLeft size={22} />
        </Link>
      </header>

      <div className="px-5 pb-8 flex-1 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">
              {t("onboarding.title", { name: farmer.name.split(" ")[0] })}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t("onboarding.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <PathCard
            active
            icon={<Leaf size={22} className="text-primary" />}
            title={t("onboarding.path1_title")}
            subtitle={t("onboarding.path1_subtitle")}
            badge={t("onboarding.path1_badge")}
          />
          <PathCard
            icon={<Landmark size={22} className="text-navy" />}
            title={t("onboarding.path2_title")}
            subtitle={t("onboarding.path2_subtitle")}
          />
          <PathCard
            icon={<ShieldCheck size={22} className="text-navy" />}
            title={t("onboarding.path3_title")}
            subtitle={t("onboarding.path3_subtitle")}
          />
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{t("onboarding.footer")}</p>

        <div className="flex-1" />

        <button
          onClick={() => navigate({ to: "/lavoura" })}
          className="h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.99] shadow-soft shrink-0"
        >
          {t("onboarding.btnStart")} <ArrowRight size={18} />
        </button>
      </div>
    </MobileFrame>
  );
}

function PathCard({
  icon,
  title,
  subtitle,
  badge,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-card p-4 shadow-card border-2 transition-colors ${
        active ? "border-primary" : "border-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-soft flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-base">{title}</h3>
            {badge && (
              <span className="text-sm font-bold tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
