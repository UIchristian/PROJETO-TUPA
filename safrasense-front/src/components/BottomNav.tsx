import { Link, useRouterState } from "@tanstack/react-router";
import { Sprout, Landmark, ShieldCheck, User, Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { language } = useTranslation();

  // Labels da navegação em texto fixo, por idioma, DE PROPÓSITO.
  // NÃO converter para t("nav.x"): se a chave faltar em algum idioma,
  // o botão volta a mostrar texto cru tipo "nav.settings".
  const navLabels = {
    property: { pt: "Propriedade", es: "Propiedad", en: "Property" },
    programs: { pt: "Programas", es: "Programas", en: "Programs" },
    protection: { pt: "Seguros", es: "Seguros", en: "Insurance" },
    profile: { pt: "Perfil", es: "Perfil", en: "Profile" },
    settings: { pt: "Ajustes", es: "Ajustes", en: "Settings" },
  } as const;

  const lbl = (key: keyof typeof navLabels) =>
    navLabels[key][language as "pt" | "es" | "en"] ?? navLabels[key].pt;

  const tabs = [
    { to: "/lavoura", label: lbl("property"), Icon: Sprout },
    { to: "/programas", label: lbl("programs"), Icon: Landmark },
    { to: "/protecao", label: lbl("protection"), Icon: ShieldCheck },
    { to: "/perfil", label: lbl("profile"), Icon: User },
    { to: "/configuracoes", label: lbl("settings"), Icon: Settings },
  ];

  return (
    <nav
      className="sticky bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_12px_rgba(0,0,0,0.04)] z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 min-h-[60px]"
                style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
              >
                <Icon className="w-[1.375rem] h-[1.375rem]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-xs font-semibold text-center leading-tight break-words max-w-full">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
