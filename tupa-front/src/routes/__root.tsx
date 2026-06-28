import { useSyncExternalStore } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { fallbackBus } from "@/lib/fallback-bus";

import appCss from "../styles.css?url";
import {
  ShieldCheck,
  LogOut,
  Menu,
  UserCircle,
  Headset,
  Laptop,
  TreePine,
  Sailboat,
  Tent,
  Wheat,
} from "lucide-react";
import { useAppState } from "@/lib/app-store";
import AccessibilityBar from "@/components/AccessibilityBar";
import { BottomNav } from "@/components/BottomNav";

const PRESET_AVATARS = [
  { id: "headset", icon: Headset, bg: "bg-blue-500/20", color: "text-blue-500" },
  { id: "computador", icon: Laptop, bg: "bg-indigo-500/20", color: "text-indigo-500" },
  { id: "arvore", icon: TreePine, bg: "bg-emerald-500/20", color: "text-emerald-500" },
  { id: "barco", icon: Sailboat, bg: "bg-cyan-500/20", color: "text-cyan-500" },
  { id: "oca", icon: Tent, bg: "bg-amber-500/20", color: "text-amber-500" },
  { id: "plantacao", icon: Wheat, bg: "bg-lime-500/20", color: "text-lime-500" },
];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h2 className="text-7xl font-bold text-foreground">404</h2>
        <h3 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h3>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Erro ao carregar a página
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente atualizar a página ou voltar para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Tupã Backoffice" },
      {
        name: "description",
        content: "Tupã Backoffice - Sistema de análise de Cadastro Ambiental Rural (CAR)",
      },
      { property: "og:title", content: "Tupã Backoffice" },
      {
        property: "og:description",
        content: "Tupã Backoffice - Sistema de análise de Cadastro Ambiental Rural (CAR)",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://cdngovbr-ds.estaleiro.serpro.gov.br" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://cdngovbr-ds.estaleiro.serpro.gov.br/design-system/fonts/rawline/css/rawline.css",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const applyAccessibilityScript = `
  (function() {
    try {
      var size = localStorage.getItem("accessibility-size") || "normal";
      var contrast = localStorage.getItem("accessibility-contrast") === "1";
      var theme = localStorage.getItem("accessibility-theme") || "light";
      
      var root = document.documentElement;
      
      if (size === "large") root.classList.add("accessibility-large");
      if (size === "xlarge") root.classList.add("accessibility-xlarge");
      
      if (contrast) root.classList.add("accessibility-high-contrast");
      
      if (theme === "dark") root.classList.add("dark");
    } catch (e) {}
  })();
`;

function MockFallbackBanner() {
  const occurred = useSyncExternalStore(
    fallbackBus.subscribe,
    () => fallbackBus.occurred,
    () => false,
  );
  if (!occurred) return null;
  return (
    <div className="w-full bg-amber-400 text-amber-900 text-xs font-bold text-center py-1 px-4 flex items-center justify-center gap-2">
      <span>⚠ DADOS SIMULADOS (MOCK) — backend não respondeu. Verifique se o servidor está rodando.</span>
      <button
        onClick={() => fallbackBus.reset()}
        className="ml-3 underline opacity-70 hover:opacity-100"
      >
        Fechar
      </button>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  const { backofficeUser } = useAppState();
  const activeAvatar = PRESET_AVATARS.find((a) => a.id === backofficeUser.avatarId);
  const router = useRouter();
  const isPortal = router.state.location.pathname.startsWith("/portal");

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: applyAccessibilityScript }} />
      </head>
      <body className="bg-background text-foreground h-screen overflow-hidden flex flex-col font-sans">
        {/* Faixa institucional gov.br */}
        <div className="w-full bg-navy text-navy-foreground flex items-center justify-between px-6 py-1.5 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold">gov.br</span>
            <span className="w-px h-3 bg-white/30"></span>
            <span className={isPortal ? "hidden sm:block" : ""}>
              {isPortal ? "Ministério do Meio Ambiente e Mudança do Clima" : "Serviço Florestal Brasileiro"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isPortal && (
              <>
                <a href="#" className="hover:underline hidden sm:block">Acesso à Informação</a>
                <a href="#" className="hover:underline hidden sm:block">Acessibilidade</a>
              </>
            )}
            <AccessibilityBar />
          </div>
        </div>

        <MockFallbackBanner />

        {!isPortal && (
          <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-soft">
            <div className="flex h-16 items-center px-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <ShieldCheck className="text-primary w-6 h-6" />
              </div>
              <div>
                <span className="block text-xl font-bold tracking-tight leading-none text-foreground">
                  Tupã
                </span>
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">
                  Base de Referência Ambiental
                </span>
              </div>
            </Link>

            <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
              <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground">
                <Link
                  to="/"
                  className="hover:text-primary transition-colors [&.active]:text-primary"
                >
                  Painel de cobertura
                </Link>
                <Link
                  to="/configuracoes"
                  className="hover:text-primary transition-colors [&.active]:text-primary"
                >
                  Configurações
                </Link>
              </div>
              <Link
                to="/perfil"
                className="flex items-center gap-3 pl-4 md:pl-6 border-l border-border hover:opacity-80 transition-opacity cursor-pointer group"
              >
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-bold leading-none">{backofficeUser.nome}</span>
                  <span className="text-xs text-muted-foreground mt-1">{backofficeUser.cargo}</span>
                </div>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${activeAvatar ? `${activeAvatar.bg} border-transparent group-hover:border-primary/50` : "bg-secondary/20 border-secondary/30 text-secondary-foreground group-hover:bg-secondary/30"}`}
                >
                  {activeAvatar ? (
                    <activeAvatar.icon className={`w-5 h-5 ${activeAvatar.color}`} />
                  ) : (
                    <UserCircle size={24} />
                  )}
                </div>
              </Link>
            </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</main>

        {/* Rodapé gov.br */}
        {!isPortal && (
          <>
            <footer className="w-full bg-navy text-navy-foreground py-2 px-6 hidden md:flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-white/80" />
                <span className="text-xs font-bold text-white/90">Tupã</span>
                <span className="text-xs text-white/50">— haCARthon · ENAP / Dataprev / SFB</span>
              </div>
              <span className="text-xs text-white/50">Sentinel-2 (Copernicus) · MapBiomas</span>
            </footer>
            <BottomNav />
          </>
        )}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
