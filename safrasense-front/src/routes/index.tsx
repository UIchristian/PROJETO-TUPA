import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { X } from "lucide-react";
import { useAppState, appStore } from "@/lib/app-store";
import { t, useTranslation } from "@/lib/i18n";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "../../firebase";

export const Route = createFileRoute("/")({
  head: () => {
    const lang = appStore.get().language || "es";
    return {
      meta: [
        { title: t("login.title", lang) },
        { name: "description", content: t("login.description", lang) },
      ],
    };
  },
  component: LoginScreen,
});

function maskCpfCnpj(v: string) {
  const clean = v.replace(/\D/g, "");
  if (clean.length <= 11) {
    return clean
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return clean
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

function LoginScreen() {
  const navigate = useNavigate();
  const state = useAppState();
  const { t, language, setLanguage } = useTranslation();

  // false = Cadastro (Registration), true = Login (Acesse sua conta)
  const [isLogin, setIsLogin] = useState(false);

  const [fullName, setFullName] = useState(state.farmer.name || "");
  const [cpf, setCpf] = useState(state.farmer.cpf || "");
  const [phone, setPhone] = useState(state.farmer.phone || "");
  const [password, setPassword] = useState(state.password || "");
  const [error, setError] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanCpf = cpf.replace(/\D/g, "");

    if (isLogin) {
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        setError(t("login.errorIdentifier"));
        return;
      }

      if (!password.trim()) {
        setError(t("login.errorPassword"));
        return;
      }

      try {
        const email = `${cleanCpf}@safrasense.local`;

        const credential = await signInWithEmailAndPassword(auth, email, password.trim());

        console.log("Login efetuado:", credential.user.uid);

        appStore.set({
          farmer: {
            ...state.farmer,
            cpf,
          },
        });

        navigate({ to: "/lavoura" });
      } catch (err: any) {
        console.error(err);

        switch (err.code) {
          case "auth/invalid-credential":
          case "auth/user-not-found":
          case "auth/wrong-password":
            setError("CPF/CNPJ ou senha inválidos.");
            break;

          default:
            setError(err.message);
        }
      }

      return;
    } else {
      // REGISTRATION VALIDATIONS
      if (!fullName.trim()) {
        setError(t("login.errorFullName"));
        return;
      }

      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        setError(t("login.errorIdentifier"));
        return;
      }

      if (!phone.trim() || phone.replace(/\D/g, "").length < 10) {
        setError(t("login.errorPhone"));
        return;
      }

      if (!password.trim()) {
        setError(t("login.errorPassword"));
        return;
      }

      if (!consentAccepted) {
        setError(t("login.consentError"));
        return;
      }

      try {
        const email = `${cleanCpf}@safrasense.local`;

        const credential = await createUserWithEmailAndPassword(auth, email, password.trim());
        await setDoc(doc(db, "usuarios", credential.user.uid), {
          nome: fullName,
          cpf,
          telefone: phone,
          documentoValidado: false,
          criadoEm: new Date(),
        });
        console.log("Usuário criado:", credential.user.uid);

        appStore.set({
          status: "alert",
          activeTerrenoId: "1",
          farmer: {
            ...state.farmer,
            name: fullName,
            cpf,
            phone,
            firebaseUid: credential.user.uid,
            car: cleanCpf.length === 14 ? "BR-MG-3170107-999999-99" : "BR-MG-3170107-123456-78",
            terrenos: [
              {
                id: "1",
                name: "Terreno 1",
                points: [],
                sizeVal: "12",
                sizeUnit: "ha",
                hectares: 12,
                carNumber: "",
                address: "Unaí, MG",
                status: "alert",
                selectedCar: null,
                crops: ["Milho"],
                system: "Safrinha",
              },
            ],
          },
        });

        navigate({ to: "/cadastro" });
      } catch (err: any) {
        console.error(err);

        switch (err.code) {
          case "auth/email-already-in-use":
            setError("Este CPF/CNPJ já está cadastrado.");
            break;

          case "auth/weak-password":
            setError("A senha deve ter pelo menos 6 caracteres.");
            break;

          default:
            setError(err.message);
        }
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center bg-secondary">
      <div className="relative w-full max-w-[390px] min-h-screen field-bg flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]">
        {/* Logo block */}
        <div className="flex-1 flex flex-col items-center justify-end px-6 pb-6 pt-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-soft animate-pop bg-card p-1">
              <img
                src="/logo.png"
                alt="SafraSense Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2 text-navy mt-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-navy">SafraSense</h1>
            </div>
          </div>
          <p className="mt-3 text-sm text-navy/80 text-center max-w-[280px]">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Form Container */}
        <form
          onSubmit={handleSubmit}
          className="px-6 pb-8 flex flex-col gap-3 bg-card/85 backdrop-blur-md rounded-t-3xl pt-7 shadow-[0_-8px_24px_rgba(0,0,0,0.05)]"
        >
          <h2 className="text-lg font-bold text-navy mb-1">
            {isLogin ? t("login.loginTitle") : t("login.registerTitle")}
          </h2>

          {error && (
            <div className="text-sm text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
              ⚠️ {error}
            </div>
          )}

          {/* Registration specific field: Full Name */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label htmlFor="full-name" className="text-sm font-semibold text-foreground/90">
                {t("login.fullName")}
              </label>
              <input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("login.fullNamePlaceholder")}
                className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
              />
            </div>
          )}

          {/* Shared field: CPF / CNPJ */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpf-input" className="text-sm font-semibold text-foreground/90">{t("login.cpf")}</label>
            <input
              id="cpf-input"
              value={cpf}
              onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00 / 00.000.000/0000-00"
              className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
            />
          </div>

          {/* Registration specific field: Phone */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label htmlFor="phone-input" className="text-sm font-semibold text-foreground/90">
                {t("login.phone")}
              </label>
              <input
                id="phone-input"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
              />
            </div>
          )}

          {/* Shared field: Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password-input" className="text-sm font-semibold text-foreground/90">
              {t("login.password")}
            </label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isLogin
                  ? t("login.passwordPlaceholder").replace("Crie", "Digite")
                  : t("login.passwordPlaceholder")
              }
              className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
            />
          </div>

          {/* Registration specific: LGPD Consent Checkbox */}
          {!isLogin && (
            <div className="flex items-start gap-3 mt-1.5 px-0.5 select-none animate-in fade-in duration-200">
              <input
                type="checkbox"
                id="consent"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 w-5.5 h-5.5 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
              />
              <label
                htmlFor="consent"
                className="text-sm leading-snug text-foreground/90 cursor-pointer"
              >
                {t("login.consent")}{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setPrivacyModalOpen(true);
                  }}
                  className="text-primary font-semibold hover:underline focus:outline-none"
                >
                  {t("login.consentLearnMore")}
                </button>
              </label>
            </div>
          )}

          {/* Main Action Button */}
          <button
            type="submit"
            className="mt-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base active:scale-[0.99] transition-transform shadow-soft"
          >
            {isLogin ? t("login.btnEntrar") : t("login.btnRegister")}
          </button>

          {/* Switch flow link text */}
          <div className="text-center text-sm text-muted-foreground mt-2.5">
            {isLogin ? (
              <>
                {t("login.noAccount")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  {t("login.cadastrar")}
                </button>
              </>
            ) : (
              <>
                {t("login.hasAccount")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                  }}
                  className="text-primary font-bold hover:underline"
                >
                  {t("login.fazerLogin")}
                </button>
              </>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground/90 mt-1">
            {t("login.freeRegistration")}
          </p>

          {/* Language Selector */}
          <div className="flex justify-center gap-4 mt-2 border-t border-border/40 pt-4 shrink-0">
            {(["es", "pt", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-extrabold tracking-wider transition-all duration-200 ${
                  language === lang
                    ? "bg-primary text-primary-foreground shadow-soft scale-105"
                    : "bg-soft text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Privacy Policy Modal */}
      {privacyModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-[390px] rounded-t-3xl shadow-2xl border border-border/80 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-foreground">{t("login.privacyTitle")}</h2>
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 text-sm text-foreground/90 leading-relaxed">
              {/* Last updated */}
              <p className="text-xs text-muted-foreground">
                {language === "es"
                  ? "Última actualización: junio de 2025"
                  : language === "en"
                    ? "Last updated: June 2025"
                    : "Última atualização: junho de 2025"}
              </p>

              {/* Section 1 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "1. Quiénes somos" : language === "en" ? "1. Who We Are" : "1. Quem somos"}
                </h3>
                <p>
                  {language === "es"
                    ? "SafraSense es una plataforma de monitoreo agrícola que conecta productores rurales con datos satelitales, seguros paramétricos y programas gubernamentales de apoyo al campo."
                    : language === "en"
                      ? "SafraSense is an agricultural monitoring platform that connects rural producers with satellite data, parametric insurance, and government programs supporting the agricultural sector."
                      : "O SafraSense é uma plataforma de monitoramento agrícola que conecta produtores rurais com dados de satélite, seguros paramétricos e programas governamentais de apoio ao campo."}
                </p>
              </section>

              {/* Section 2 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "2. Datos que recopilamos" : language === "en" ? "2. Data We Collect" : "2. Dados que coletamos"}
                </h3>
                <p>
                  {language === "es"
                    ? "Recopilamos los siguientes datos para la prestación del servicio:"
                    : language === "en"
                      ? "We collect the following data to provide the service:"
                      : "Coletamos os seguintes dados para a prestação do serviço:"}
                </p>
                <ul className="list-disc list-inside space-y-1 text-foreground/80 pl-1">
                  {language === "es" ? (
                    <>
                      <li>Nombre completo, CPF/CNPJ y teléfono</li>
                      <li>Ubicación y delimitación de la propiedad rural</li>
                      <li>Número del CAR y documentos adjuntos</li>
                      <li>Datos de cultivos y producción</li>
                      <li>Imágenes satelitales del área demarcada</li>
                    </>
                  ) : language === "en" ? (
                    <>
                      <li>Full name, CPF/CNPJ, and phone number</li>
                      <li>Location and boundary of rural property</li>
                      <li>CAR registration number and attached documents</li>
                      <li>Crop and production data</li>
                      <li>Satellite imagery of the demarcated area</li>
                    </>
                  ) : (
                    <>
                      <li>Nome completo, CPF/CNPJ e telefone</li>
                      <li>Localização e delimitação da propriedade rural</li>
                      <li>Número do CAR e documentos anexados</li>
                      <li>Dados de cultivo e produção</li>
                      <li>Imagens de satélite da área demarcada</li>
                    </>
                  )}
                </ul>
              </section>

              {/* Section 3 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "3. Finalidad del tratamiento" : language === "en" ? "3. Purpose of Processing" : "3. Finalidade do tratamento"}
                </h3>
                <p>
                  {language === "es"
                    ? "Sus datos se utilizan exclusivamente para: proveer análisis satelitales de su propiedad, conectarlo con seguros paramétricos y programas gubernamentales, validar la titularidad rural y generar informes técnicos."
                    : language === "en"
                      ? "Your data is used exclusively to: provide satellite analysis of your property, connect you with parametric insurance and government programs, validate rural ownership, and generate technical reports."
                      : "Seus dados são utilizados exclusivamente para: prover análises de satélite da sua propriedade, conectá-lo a seguros paramétricos e programas de governo, validar a titularidade rural e gerar laudos técnicos."}
                </p>
              </section>

              {/* Section 4 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "4. Compartición de datos" : language === "en" ? "4. Data Sharing" : "4. Compartilhamento de dados"}
                </h3>
                <p>
                  {language === "es"
                    ? "Compartimos sus datos únicamente con operadoras de seguros y órganos gubernamentales cuando sea necesario para la prestación del servicio y siempre con su consentimiento previo. No vendemos datos a terceros."
                    : language === "en"
                      ? "We share your data only with insurance operators and government agencies when necessary for service delivery and always with your prior consent. We do not sell data to third parties."
                      : "Compartilhamos seus dados somente com operadoras de seguro e órgãos governamentais quando necessário para a prestação do serviço e sempre com seu consentimento prévio. Não vendemos dados a terceiros."}
                </p>
              </section>

              {/* Section 5 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "5. Almacenamiento y seguridad" : language === "en" ? "5. Storage & Security" : "5. Armazenamento e segurança"}
                </h3>
                <p>
                  {language === "es"
                    ? "Sus datos se almacenan en infraestructura segura de Google Firebase / Google Cloud, con cifrado en tránsito y en reposo. Adoptamos medidas técnicas y organizativas para prevenir accesos no autorizados."
                    : language === "en"
                      ? "Your data is stored on secure Google Firebase / Google Cloud infrastructure, with encryption in transit and at rest. We adopt technical and organizational measures to prevent unauthorized access."
                      : "Seus dados são armazenados em infraestrutura segura do Google Firebase / Google Cloud, com criptografia em trânsito e em repouso. Adotamos medidas técnicas e organizacionais para prevenir acessos não autorizados."}
                </p>
              </section>

              {/* Section 6 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es"
                    ? "6. Sus derechos (LGPD)"
                    : language === "en"
                      ? "6. Your Rights (LGPD)"
                      : "6. Seus direitos (LGPD)"}
                </h3>
                <p>
                  {language === "es"
                    ? "De acuerdo con la Ley General de Protección de Datos (LGPD), usted tiene derecho a: acceder a sus datos, corregirlos, solicitar su eliminación, revocar el consentimiento y obtener información sobre el tratamiento realizado."
                    : language === "en"
                      ? "Under the Brazilian General Data Protection Law (LGPD), you have the right to: access your data, correct it, request its deletion, revoke consent, and obtain information about the processing performed."
                      : "Conforme a Lei Geral de Proteção de Dados (LGPD), você tem direito a: acessar seus dados, corrigi-los, solicitar sua exclusão, revogar o consentimento e obter informações sobre o tratamento realizado."}
                </p>
              </section>

              {/* Section 7 */}
              <section className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">
                  {language === "es" ? "7. Contacto" : language === "en" ? "7. Contact" : "7. Contato"}
                </h3>
                <p>
                  {language === "es"
                    ? "Para ejercer sus derechos o aclarar dudas, contáctenos:"
                    : language === "en"
                      ? "To exercise your rights or clarify questions, contact us:"
                      : "Para exercer seus direitos ou esclarecer dúvidas, entre em contato:"}
                </p>
                <p className="font-semibold text-primary">contato@safrasense.com.br</p>
              </section>
            </div>

            {/* Footer close button */}
            <div className="p-4 border-t border-border bg-soft shrink-0">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="h-12 w-full bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-all cursor-pointer"
              >
                {t("login.privacyClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
