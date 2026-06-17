import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { useAppState } from "@/lib/app-store";
import { auth } from "../../firebase";
import appCss from "../styles.css?url";

// Rotas publicas (acessiveis sem login). Tudo o que nao estiver aqui exige autenticacao.
const PUBLIC_PATHS = new Set<string>(["/", "/backoffice"]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { title: "Tupã: Gabarito Vivo do CAR" },
      {
        name: "description",
        content:
          "Comparação do uso e cobertura do solo declarados no Cadastro Ambiental Rural com a realidade vista por satélite, apontando divergências e guiando a retificação.",
      },
      { name: "theme-color", content: "#154c30" },
      { property: "og:title", content: "Tupã: Gabarito Vivo do CAR" },
      {
        property: "og:description",
        content:
          "Comparação do uso e cobertura do solo declarados no Cadastro Ambiental Rural com a realidade vista por satélite, apontando divergências e guiando a retificação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Tupã: Gabarito Vivo do CAR" },
      {
        name: "twitter:description",
        content:
          "Comparação do uso e cobertura do solo declarados no Cadastro Ambiental Rural com a realidade vista por satélite, apontando divergências e guiando a retificação.",
      },
      {
        property: "og:image",
        content: "/logo.png",
      },
      {
        name: "twitter:image",
        content: "/logo.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
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
  const state = useAppState();
  const langCode = state.language === "es" ? "es" : state.language === "en" ? "en" : "pt-BR";
  return (
    <html lang={langCode}>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
            try {
              const theme = localStorage.getItem('accessibility-theme');
              const size = localStorage.getItem('accessibility-size');
              const contrast = localStorage.getItem('accessibility-contrast');
              
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
              if (size === 'large') {
                document.documentElement.classList.add('accessibility-large');
              }
              if (size === 'xlarge') {
                document.documentElement.classList.add('accessibility-xlarge');
              }
              if (contrast === '1') {
                document.documentElement.classList.add('accessibility-high-contrast');
              }
            } catch (e) {}
          `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </AuthGate>
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(() => !!auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthed(!!user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthed && !isPublic) {
      router.navigate({ to: "/" });
    }
  }, [authReady, isAuthed, isPublic, pathname, router]);

  // Enquanto resolvemos o estado do Firebase Auth nao renderizamos rotas protegidas
  // para evitar flash de conteudo privado.
  if (!authReady && !isPublic) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#E2D9CD] text-navy text-sm">
        Carregando...
      </div>
    );
  }

  if (authReady && !isAuthed && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
