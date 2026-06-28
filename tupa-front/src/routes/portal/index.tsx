import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Search, UserCircle2, Map as MapIcon, ShieldCheck, Droplets, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/portal/")({
  component: PortalIndex,
});

function PortalIndex() {
  const [car, setCar] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!car.trim()) return;
    router.navigate({ to: `/portal/imovel/${encodeURIComponent(car.trim())}` });
  };

  return (
    <div className="flex-1 w-full bg-muted/20">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
            Veja as informações ambientais da sua propriedade rural
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Consultamos dados de satélite e cruzamos com as regras ambientais para ajudar você a
            entender a situação da sua terra, de forma simples e transparente.
          </p>

          {/* Search Box */}
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row max-w-xl mx-auto gap-3 p-2 bg-card text-card-foreground rounded-2xl shadow-sm border border-border"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                type="text"
                value={car}
                onChange={(e) => setCar(e.target.value)}
                placeholder="Digite o número do seu CAR..."
                className="pl-11 h-12 md:h-14 border-0 focus-visible:ring-0 shadow-none text-base md:text-lg bg-transparent w-full"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 md:h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl w-full sm:w-auto font-semibold text-base"
            >
              Consultar
            </Button>
          </form>
          <div className="mt-3 text-sm text-muted-foreground">
            Exemplo:{" "}
            <button
              type="button"
              onClick={() => setCar("MG-3100104-E9954CB333FD4FF1B66DF696BA778990")}
              className="text-primary hover:underline"
            >
              MG-3100104-E9954CB333FD4FF1B66DF696BA778990
            </button>
          </div>
        </div>

        {/* Bloco "Entrar com gov.br" */}
        <div className="bg-card text-card-foreground rounded-2xl p-6 md:p-8 border border-border shadow-sm text-center max-w-md mx-auto mb-16">
          <h2 className="font-semibold text-foreground mb-2">Acesse seus dados protegidos</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Para solicitar correções e ver dados sensíveis, faça login.
          </p>
          {/* Note: Autenticação real com gov.br está fora de escopo para esta demo */}
          <Button
            className="w-full h-12 bg-[#1351b4] hover:bg-[#0c326f] text-white flex items-center justify-center gap-3 font-medium rounded-full shadow-sm transition-colors"
            onClick={() =>
              alert("A integração real com o Gov.br está fora do escopo desta demonstração.")
            }
          >
            <UserCircle2 className="w-5 h-5" />
            <span>Entrar com <span className="font-extrabold">gov.br</span></span>
          </Button>
        </div>

        {/* Bloco "Como lemos sua terra" */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <MapIcon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Imagens de Satélite</h3>
            <p className="text-sm text-muted-foreground">
              Usamos imagens gratuitas e públicas do satélite Sentinel-2 para ver a cobertura atual
              da sua terra (vegetação, lavoura ou pastagem).
            </p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <Droplets className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Hidrografia e Relevo</h3>
            <p className="text-sm text-muted-foreground">
              Mapeamos rios e encostas para calcular automaticamente as Áreas de Preservação e de
              Uso Restrito da sua propriedade.
            </p>
          </div>

          <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Código Florestal</h3>
            <p className="text-sm text-muted-foreground">
              Cruzamos as informações com as regras da lei florestal. Tudo para facilitar a sua
              adequação e transparência.
            </p>
          </div>
        </div>

        {/* Categoria: Legislações CAR */}
        <div className="mt-16 bg-card text-card-foreground rounded-2xl p-6 md:p-8 border border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Legislações CAR</h2>
              <p className="text-sm text-muted-foreground">
                Acesse as principais leis e normas que orientam o Cadastro Ambiental Rural.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <a
              href="https://www.planalto.gov.re/ccivil_03/_ato2011-2014/2012/lei/l12651.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 transition-all hover:shadow-sm hover:-translate-y-1 group"
            >
              <div className="mt-1 p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Lei nº 12.651/2012</h3>
                <p className="text-sm text-muted-foreground">
                  Institui o Novo Código Florestal e dispõe sobre a proteção da vegetação nativa.
                </p>
              </div>
            </a>

            <a
              href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/decreto/d7830.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 transition-all hover:shadow-sm hover:-translate-y-1 group"
            >
              <div className="mt-1 p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Decreto nº 7.830/2012</h3>
                <p className="text-sm text-muted-foreground">
                  Dispõe sobre o Sistema de Cadastro Ambiental Rural (SICAR) e estabelece regras gerais.
                </p>
              </div>
            </a>
            
            <a
              href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/decreto/d8235.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 transition-all hover:shadow-sm hover:-translate-y-1 group"
            >
              <div className="mt-1 p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Decreto nº 8.235/2014</h3>
                <p className="text-sm text-muted-foreground">
                  Normas gerais complementares aos Programas de Regularização Ambiental (PRA).
                </p>
              </div>
            </a>
            
            <a
              href="https://www.in.gov.br/web/dou/-/instrucao-normativa-n-2-de-6-de-maio-de-2014-27514300"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-indigo-200 hover:bg-indigo-50/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 transition-all hover:shadow-sm hover:-translate-y-1 group"
            >
              <div className="mt-1 p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Instrução Normativa nº 2/2014</h3>
                <p className="text-sm text-muted-foreground">
                  Procedimentos para a integração, o registro e a análise dos dados do CAR.
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
