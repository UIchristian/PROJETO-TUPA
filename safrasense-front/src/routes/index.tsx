import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
    <div className="min-h-screen w-full flex justify-center bg-[#E2D9CD]">
      <div className="relative w-full max-w-[390px] min-h-screen field-bg flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]">
        {/* Logo block */}
        <div className="flex-1 flex flex-col items-center justify-end px-6 pb-6 pt-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-soft animate-pop bg-white p-1">
              <img
                src="/logo.png"
                alt="SafraSense Logo"
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2 text-navy mt-1">
              <h1 className="text-[28px] font-extrabold tracking-tight text-navy">SafraSense</h1>
            </div>
          </div>
          <p className="mt-3 text-[14px] text-navy/80 text-center max-w-[280px]">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Form Container */}
        <form
          onSubmit={handleSubmit}
          className="px-6 pb-8 flex flex-col gap-3 bg-white/85 backdrop-blur-md rounded-t-3xl pt-7 shadow-[0_-8px_24px_rgba(0,0,0,0.05)]"
        >
          <h2 className="text-[18px] font-bold text-navy mb-1">
            {isLogin ? t("login.loginTitle") : t("login.registerTitle")}
          </h2>

          {error && (
            <div className="text-[14px] text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded-xl p-2.5 text-center animate-in fade-in duration-200">
              ⚠️ {error}
            </div>
          )}

          {/* Registration specific field: Full Name */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label className="text-[14px] font-semibold text-foreground/90">
                {t("login.fullName")}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("login.fullNamePlaceholder")}
                className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[16px]"
              />
            </div>
          )}

          {/* Shared field: CPF / CNPJ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-foreground/90">{t("login.cpf")}</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00 / 00.000.000/0000-00"
              className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[16px]"
            />
          </div>

          {/* Registration specific field: Phone */}
          {!isLogin && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-200">
              <label className="text-[14px] font-semibold text-foreground/90">
                {t("login.phone")}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[16px]"
              />
            </div>
          )}

          {/* Shared field: Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-foreground/90">
              {t("login.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isLogin
                  ? t("login.passwordPlaceholder").replace("Crie", "Digite")
                  : t("login.passwordPlaceholder")
              }
              className="h-12 px-4 rounded-xl bg-soft border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-[16px]"
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
                className="text-[13px] leading-snug text-foreground/90 cursor-pointer"
              >
                {t("login.consent")}
              </label>
            </div>
          )}

          {/* Main Action Button */}
          <button
            type="submit"
            className="mt-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-[16px] active:scale-[0.99] transition-transform shadow-soft"
          >
            {isLogin ? t("login.btnEntrar") : t("login.btnRegister")}
          </button>

          {/* Switch flow link text */}
          <div className="text-center text-[14px] text-muted-foreground mt-2.5">
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

          <p className="text-center text-[12px] text-muted-foreground/90 mt-1">
            {t("login.freeRegistration")}
          </p>

          {/* Language Selector */}
          <div className="flex justify-center gap-4 mt-2 border-t border-border/40 pt-4 shrink-0">
            {(["es", "pt", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-extrabold tracking-wider transition-all duration-200 ${
                  language === lang
                    ? "bg-primary text-white shadow-soft scale-105"
                    : "bg-soft text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
