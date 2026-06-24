import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ShieldCheck, LogOut, Menu, UserCircle, Headset, Laptop, TreePine, Sailboat, Tent, Wheat, Map as MapIcon } from "lucide-react";
import { useAppState } from "@/lib/app-store";

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
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Erro ao carregar a página
        </h1>
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
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const { backofficeUser } = useAppState();
  const activeAvatar = PRESET_AVATARS.find(a => a.id === backofficeUser.avatarId);

  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col font-sans">
        {/* Navbar */}
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card shadow-soft">
          <div className="flex h-16 items-center px-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <ShieldCheck className="text-primary w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight leading-none text-foreground">Tupã</h1>
                <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">Backoffice CAR</span>
              </div>
            </Link>
            
            <div className="flex flex-1 items-center justify-end space-x-4">
              <div className="flex items-center gap-6 text-sm font-semibold text-muted-foreground">
                <Link to="/" className="hover:text-primary transition-colors [&.active]:text-primary">Fila de Imóveis</Link>
                <Link to="/configuracoes" className="hover:text-primary transition-colors [&.active]:text-primary">Configurações</Link>
              </div>
              <Link to="/perfil" className="flex items-center gap-3 pl-6 border-l border-border hover:opacity-80 transition-opacity cursor-pointer group">
                <div className="flex flex-col text-right">
                  <span className="text-sm font-bold leading-none">{backofficeUser.nome}</span>
                  <span className="text-xs text-muted-foreground mt-1">{backofficeUser.cargo}</span>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${activeAvatar ? `${activeAvatar.bg} border-transparent group-hover:border-primary/50` : 'bg-secondary/20 border-secondary/30 text-secondary-foreground group-hover:bg-secondary/30'}`}>
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

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
        
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
