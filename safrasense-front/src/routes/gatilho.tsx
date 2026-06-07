import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Siren, Check, ArrowRight, Banknote, Satellite, Clock } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { CountUp } from "@/components/CountUp";
import { appStore, useAppState } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/gatilho")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [{ title: t("gatilho.headTitle", lang) }],
    };
  },
  component: GatilhoScreen,
});

function GatilhoScreen() {
  const { farmer, payout } = useAppState();
  const { t } = useTranslation();

  // Auto-progress payment status for demo: pending → sent → received
  useEffect(() => {
    if (payout === "pending") {
      const t = setTimeout(() => appStore.set({ payout: "sent" }), 2200);
      return () => clearTimeout(t);
    }
    if (payout === "sent") {
      const t = setTimeout(() => appStore.set({ payout: "received" }), 2800);
      return () => clearTimeout(t);
    }
  }, [payout]);

  const steps: { key: typeof payout; label: string; hint: string }[] = [
    { key: "pending", label: t("gatilho.step1"), hint: t("gatilho.step1_hint") },
    { key: "sent", label: t("gatilho.step2"), hint: t("gatilho.step2_hint") },
    { key: "received", label: t("gatilho.step3"), hint: t("gatilho.step3_hint") },
  ];
  const currentIdx = steps.findIndex((s) => s.key === payout);

  return (
    <MobileFrame withNav>
      {/* Top alert banner */}
      <section className="bg-alert text-alert-foreground px-5 pt-6 pb-8">
        <div className="flex items-center gap-2 text-sm tracking-[0.15em] font-bold text-white">
          <Siren size={14} /> {t("gatilho.main_title").toUpperCase()}
        </div>
        <h1 className="text-xl font-bold mt-2 leading-tight">
          {t("gatilho.h1_title", { name: farmer.name.split(" ")[0] })}
        </h1>
        <p className="text-sm text-white/95 mt-2 leading-relaxed">{t("gatilho.payout_desc")}</p>
      </section>

      <section className="bg-background rounded-t-3xl -mt-5 px-5 pt-6 pb-6 flex flex-col gap-5 relative z-10">
        {/* Payout amount card */}
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 shadow-soft">
          <p className="text-sm text-primary-foreground/90 font-medium">{t("gatilho.value")}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base money">R$</span>
            <CountUp to={4000} className="text-4xl money leading-none" />
          </div>
          <p className="text-base text-primary-foreground/95 mt-1.5 flex items-center gap-1.5 font-semibold">
            <Banknote size={14} /> {t("gatilho.payout_pix_desc")}
          </p>
        </div>

        {/* Status tracker */}
        <div>
          <h2 className="text-base font-bold mb-3">{t("gatilho.card_status")}</h2>
          <ol className="flex flex-col gap-3.5">
            {steps.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-amber-warn text-amber-warn-foreground animate-pulse"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <Check size={18} strokeWidth={3} />
                    ) : (
                      <span className="text-sm font-bold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p
                      className={`text-base font-bold ${
                        done || active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                      {active && (
                        <span className="ml-2 text-sm font-bold text-amber-warn">
                          {t("gatilho.in_progress")}
                        </span>
                      )}
                      {done && (
                        <span className="ml-2 text-sm font-bold text-primary">
                          {t("gatilho.completed")}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-foreground/80 mt-0.5">{s.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Event summary */}
        <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-card">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Satellite size={16} className="text-navy" /> {t("gatilho.event_summary")}
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <Metric value="21" label={t("gatilho.days_stress")} />
            <Metric
              value="0.34"
              label={t("gatilho.min_vigor")}
              hint={t("gatilho.historical_avg")}
            />
            <Metric value="−53%" label={t("gatilho.below_normal")} />
          </div>
          <p className="text-sm text-foreground/80 mt-3 leading-relaxed">
            {t("gatilho.event_desc")}
          </p>
        </div>

        {/* Help line */}
        <div className="rounded-xl bg-soft border border-border/60 p-3 flex items-start gap-2">
          <Clock size={16} className="text-navy mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80 leading-relaxed">{t("gatilho.help_line")}</p>
        </div>

        <Link
          to="/lavoura"
          className="h-14 rounded-2xl bg-navy text-navy-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.99] shadow-soft"
        >
          {t("gatilho.button_back")} <ArrowRight size={18} />
        </Link>
      </section>
    </MobileFrame>
  );
}

function Metric({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div>
      <div className="text-xl money text-navy leading-none">{value}</div>
      <div className="text-sm text-foreground/80 font-bold mt-1.5 leading-tight">{label}</div>
      {hint && <div className="text-sm text-foreground/70 font-semibold mt-0.5">{hint}</div>}
    </div>
  );
}
