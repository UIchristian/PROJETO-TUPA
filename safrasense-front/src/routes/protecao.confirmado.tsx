import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Share2, ArrowRight } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { useAppState, appStore } from "@/lib/app-store";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/protecao/confirmado")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [
        {
          title:
            lang === "es"
              ? "Propuesta y Evidencias"
              : lang === "en"
                ? "Proposal & Evidence"
                : "Proposta e Evidências",
        },
      ],
    };
  },
  component: ConfirmadoScreen,
});

function ConfirmadoScreen() {
  const navigate = useNavigate();
  const { farmer, selectedCooperative } = useAppState();
  const { language } = useTranslation();

  const insurerName = selectedCooperative || "Mapfre";

  const whatsappMsg = encodeURIComponent(
    language === "es"
      ? `Hola, soy ${farmer.name} de la propiedad ${farmer.property} (CAR: ${farmer.car || "BR-MG-3170107-123456-78"}). Me gustaría solicitar una cotización de seguro paramétrico con base en las evidencias de satélite de SafraSense (Déficit de NDVI del -24%).`
      : language === "en"
        ? `Hello, I am ${farmer.name} from the property ${farmer.property} (CAR: ${farmer.car || "BR-MG-3170107-123456-78"}). I would like to request a parametric insurance quote based on the satellite evidence from SafraSense (NDVI Deficit of -24%).`
        : `Olá, sou ${farmer.name} da propriedade ${farmer.property} (CAR: ${farmer.car || "BR-MG-3170107-123456-78"}). Gostaria de solicitar uma cotação de seguro paramétrico com base nas evidências de satélite geradas pelo SafraSense (Déficit de NDVI de -24% em Maio).`,
  );

  const whatsappUrl = `https://wa.me/5561999999999?text=${whatsappMsg}`;

  return (
    <MobileFrame>
      <header className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-border bg-white shadow-sm shrink-0">
        <button
          onClick={() => window.history.back()}
          className="-ml-2 p-2 text-navy hover:bg-secondary rounded-lg shrink-0"
          type="button"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold text-foreground">
          {language === "es"
            ? "Propuesta y Evidencias"
            : language === "en"
              ? "Proposal & Evidence"
              : "Proposta e Evidências"}
        </h1>
      </header>

      <div className="p-5 flex-1 flex flex-col gap-5 overflow-y-auto">
        {/* Intro */}
        <div className="flex flex-col gap-1 text-left">
          <h2 className="text-[20px] font-extrabold text-foreground leading-tight">
            {language === "es"
              ? "Tus Evidencias para Contato"
              : language === "en"
                ? "Your Evidence for Contact"
                : "Suas Evidências para Contato"}
          </h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
            {language === "es"
              ? `Compilamos los datos de satélite y registro CAR para que solicites tu cotización directamente con ${insurerName}.`
              : language === "en"
                ? `We compiled satellite and CAR registry data so you can request your quote directly with ${insurerName}.`
                : `Compilamos os dados de satélite e registro CAR para que você solicite sua cotação diretamente com a ${insurerName}.`}
          </p>
        </div>

        {/* Insurer Info */}
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border flex flex-col gap-2 text-left">
          <div className="flex items-center gap-2 text-navy font-bold text-[13.5px]">
            🛡️{" "}
            {language === "es"
              ? "Seguradora Seleccionada"
              : language === "en"
                ? "Selected Insurer"
                : "Seguradora Selecionada"}
          </div>
          <p className="text-[14px] font-bold text-foreground">{insurerName}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {insurerName === "Mapfre"
              ? language === "es"
                ? "Operador autorizado por la SUSEP con amplia cobertura de riesgos climáticos agrícolas."
                : language === "en"
                  ? "SUSEP authorized operator with extensive agricultural climate risk coverage."
                  : "Operadora autorizada pela SUSEP com ampla cobertura de riscos climáticos agrícolas."
              : language === "es"
                ? "Pionera insurtech brasileña enfocada en agricultura familiar y seguros paramétricos por satélite."
                : language === "en"
                  ? "Pioneering Brazilian insurtech focused on family farming and satellite parametric insurance."
                  : "Insurtech brasileira pioneira focada em agricultura familiar e seguros paramétricos por satélite."}
          </p>
        </div>

        {/* Compiled Evidences Section */}
        <div className="p-4 rounded-2xl bg-card border border-border/85 flex flex-col gap-3 shadow-soft text-left">
          <div className="text-[12.5px] font-bold text-primary uppercase tracking-wider block">
            📊{" "}
            {language === "es"
              ? "Evidencias Técnicas"
              : language === "en"
                ? "Technical Evidence"
                : "Evidências Técnicas Compiladas"}
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-[12px] text-slate-700">
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">
                {language === "es"
                  ? "Beneficiario"
                  : language === "en"
                    ? "Beneficiary"
                    : "Produtor Beneficiário"}
              </span>
              <span className="font-bold text-foreground">{farmer.name}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">
                {language === "es"
                  ? "Propiedad"
                  : language === "en"
                    ? "Property"
                    : "Propriedade (CAR)"}
              </span>
              <span className="font-bold text-foreground">{farmer.property}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">Registro CAR</span>
              <span className="font-mono font-semibold text-foreground text-[11px] truncate block max-w-[160px]">
                {farmer.car || "BR-MG-3170107-123456-78"}
              </span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">
                {language === "es"
                  ? "Área Mapeada"
                  : language === "en"
                    ? "Mapped Area"
                    : "Área Mapeada"}
              </span>
              <span className="font-bold text-foreground">{farmer.area} ha</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted-foreground">
                {language === "es"
                  ? "Desviación NDVI"
                  : language === "en"
                    ? "NDVI Deviation"
                    : "Desvio NDVI (Maio)"}
              </span>
              <span className="font-bold text-red-600">-24% (Crítico)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {language === "es"
                  ? "Acuracidad Mapeo"
                  : language === "en"
                    ? "Mapping Accuracy"
                    : "Acurácia do Mapeamento"}
              </span>
              <span className="font-bold text-emerald-600">96% (Homologado)</span>
            </div>
          </div>
        </div>

        {/* CTA Callout */}
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-[12px] text-muted-foreground leading-relaxed text-left">
          {language === "es"
            ? "Oprimir el botón enviará un mensaje pre-formateado a la seguradora con la clave de tu CAR y las evidencias Copernicus para agilizar la cotización."
            : language === "en"
              ? "Clicking the button will send a pre-formatted message to the insurer with your CAR key and Copernicus evidence to speed up quoting."
              : "Ao clicar no botão abaixo, você iniciará uma conversa no WhatsApp enviando automaticamente a identificação da sua terra (CAR) e o laudo de satélite Copernicus para que a seguradora elabore a proposta."}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-soft cursor-pointer text-center"
          >
            💬{" "}
            {language === "es"
              ? "Enviar Datos y Contactar"
              : language === "en"
                ? "Send Data & Contact"
                : "Enviar Evidências e Contatar"}
          </a>

          <button
            onClick={() => navigate({ to: "/lavoura" })}
            className="h-12 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground font-medium text-[13px] transition-colors cursor-pointer"
          >
            {language === "es"
              ? "Volver a mi propiedad"
              : language === "en"
                ? "Back to my property"
                : "Voltar para minha propriedade"}
          </button>
        </div>
      </div>
    </MobileFrame>
  );
}
