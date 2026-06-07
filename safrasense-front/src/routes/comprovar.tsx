import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { appStore } from "@/lib/app-store";
import { useTranslation } from "@/lib/i18n";
import { auth, db, storage } from "../../firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

export const Route = createFileRoute("/comprovar")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || "/lavoura",
    };
  },
  component: ComprovarScreen,
});

function ComprovarScreen() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/comprovar" });
  const { t, language } = useTranslation();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const uid = auth.currentUser?.uid || appStore.get().farmer.firebaseUid;

    if (!uid) {
      setErrorMessage(
        language === "es"
          ? "No se encontró una sesión autenticada para enviar el documento."
          : language === "en"
            ? "No authenticated session was found to send the document."
            : "Nao foi encontrada uma sessao autenticada para enviar o documento.",
      );
      return;
    }

    setErrorMessage("");
    setUploading(true);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `usuarios/${uid}/documentos/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      const downloadURL = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "usuarios", uid),
        {
          documentoValidado: "pendente",
          documentoArquivoNome: file.name,
          documentoArquivoTipo: file.type || "application/octet-stream",
          documentoArquivoTamanho: file.size,
          documentoStoragePath: storagePath,
          documentoDownloadURL: downloadURL,
          documentoEnviadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );

      // Update store so programas.tsx shows the card immediately on redirect
      appStore.set({
        documentoValidado: "pendente",
        documentoArquivoNome: file.name,
      });

      setSuccess(true);

      setTimeout(() => {
        navigate({ to: search.redirect });
      }, 1200);
    } catch (error) {
      console.error(error);
      const errCode = (error as any)?.code || "";
      const maybePermissionError =
        errCode === "storage/unauthorized" || errCode === "storage/unknown";

      setErrorMessage(
        maybePermissionError
          ? language === "es"
            ? "No fue posible enviar al Storage. Revisa bucket y reglas de Firebase Storage."
            : language === "en"
              ? "Could not upload to Storage. Please check bucket and Firebase Storage rules."
              : "Nao foi possivel enviar para o Storage. Verifique bucket e regras do Firebase Storage."
          : language === "es"
            ? "No fue posible enviar el documento. Inténtalo nuevamente."
            : language === "en"
              ? "Could not upload the document. Please try again."
              : "Nao foi possivel enviar o documento. Tente novamente.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <MobileFrame>
      <header className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-border bg-card shadow-sm shrink-0">
        <button
          onClick={() => window.history.back()}
          className="-ml-2 p-2 text-navy hover:bg-secondary rounded-lg shrink-0"
          type="button"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-foreground">{t("comprovar.title")}</h1>
      </header>

      <div className="p-5 flex-1 flex flex-col gap-5 overflow-y-auto">
        <p className="text-sm text-muted-foreground leading-relaxed">{t("comprovar.desc")}</p>

        {!success ? (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
            <div className="flex-1 flex flex-col min-h-[220px]">
              <label className="flex-1 border-2 border-dashed border-border hover:border-primary/60 rounded-2xl bg-soft/30 flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition-colors select-none">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    setFile(selected || null);
                  }}
                />

                {uploading ? (
                  <div className="flex flex-col items-center gap-2.5 max-w-[280px] mx-auto p-2 w-full animate-in fade-in duration-200">
                    <Loader2 size={20} className="text-primary animate-spin" />
                    <span className="text-sm font-bold text-primary uppercase tracking-wider text-center">
                      {t("comprovar.uploading")}
                    </span>
                    <span className="text-sm text-muted-foreground text-center">
                      {language === "es"
                        ? "Subiendo archivo al almacenamiento seguro..."
                        : language === "en"
                          ? "Uploading file to secure storage..."
                          : "Enviando arquivo para armazenamento seguro..."}
                    </span>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📄</span>
                    <span className="text-sm font-semibold text-primary truncate max-w-[240px]">
                      {file.name}
                    </span>
                    <span className="text-sm text-muted-foreground hover:underline mt-1">
                      {language === "es"
                        ? "Cambiar archivo"
                        : language === "en"
                          ? "Change file"
                          : "Alterar arquivo"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Upload size={22} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {t("comprovar.select_file")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {language === "es"
                        ? "PDF, PNG o JPG de hasta 10MB"
                        : language === "en"
                          ? "PDF, PNG or JPG up to 10MB"
                          : "PDF, PNG ou JPG de até 10MB"}
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="p-3.5 bg-soft/50 border border-border/40 rounded-xl">
              <a
                href="https://www.car.gov.br"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline leading-relaxed font-semibold block"
              >
                {t("comprovar.help_link")}
              </a>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col gap-2 shadow-soft">
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                🛡️{" "}
                {language === "es"
                  ? "¿Cómo se valida?"
                  : language === "en"
                    ? "How is it validated?"
                    : "Como funciona a validacao?"}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {language === "es"
                  ? "El documento se almacena de forma segura y queda con estado pendiente para revisión manual."
                  : language === "en"
                    ? "The document is securely stored and marked as pending for manual review."
                    : "O documento e armazenado de forma segura e fica com status pendente para revisao manual."}
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive font-semibold">
                {errorMessage}
              </div>
            )}

            <div className="flex-1" />

            <button
              type="submit"
              disabled={!file || uploading}
              className="h-14 w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-soft disabled:opacity-40 shrink-0 cursor-pointer"
            >
              {t("comprovar.submit_btn")}
            </button>
          </form>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-8 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pop">
              <CheckCircle2 size={36} />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="font-bold text-lg text-foreground">
                {language === "es"
                  ? "¡Documento Enviado!"
                  : language === "en"
                    ? "Document Submitted!"
                    : "Documento Enviado!"}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                {language === "es"
                  ? "Enviado para revisión manual. Estado actualizado a pendiente. Redireccionando..."
                  : language === "en"
                    ? "Sent for manual review. Status updated to pending. Redirecting..."
                    : "Enviado para revisao manual. Status atualizado para pendente. Redirecionando..."}
              </p>
            </div>
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
