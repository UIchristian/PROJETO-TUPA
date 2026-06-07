import { Link, useRouterState } from "@tanstack/react-router";
import { Sprout, Landmark, ShieldCheck, User, Settings, MessageSquare } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t, language } = useTranslation();

  const settingsLabel = language === "pt" ? "Configurações" : language === "en" ? "Settings" : "Configuraciones";
  const protectionLabel = language === "pt" ? "Seguros" : language === "en" ? "Insurance" : "Seguros";

  const tabs = [
    { to: "/lavoura", label: t("nav.property"), Icon: Sprout },
    { to: "/programas", label: t("nav.programs"), Icon: Landmark },
    { to: "/protecao", label: protectionLabel, Icon: ShieldCheck },
    { to: "/perfil", label: t("nav.profile"), Icon: User },
    { to: "/configuracoes", label: settingsLabel, Icon: Settings },
  ];

  return (
    <>
      <nav
        className="sticky bottom-0 left-0 right-0 bg-white dark:bg-[#2a241a] border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.04)] z-30"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map(({ to, label, Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px]"
                  style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[11px] font-medium">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* WhatsApp quick contact floating button */}
      <a
        href="https://wa.me/5511999999999?text=Ol%C3%A1%20preciso%20de%20ajuda%20no%20SafraSense"
        target="_blank"
        rel="noreferrer"
        className="accessibility-floating-whatsapp"
        aria-label={t("contact.whatsapp")}
      >
        <MessageSquare size={20} />
      </a>
    </>
  );
}
