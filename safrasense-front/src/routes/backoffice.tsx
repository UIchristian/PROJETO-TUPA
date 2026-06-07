import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCcw, XCircle } from "lucide-react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../../firebase";

type BackofficeUser = {
  uid: string;
  nome: string;
  cpf: string;
  telefone: string;
  documentoValidado: boolean | string;
  documentoArquivoNome?: string;
  documentoDownloadURL?: string;
  documentoStoragePath?: string;
  documentoEnviadoEm?: any;
};

export const Route = createFileRoute("/backoffice")({
  head: () => ({
    meta: [{ title: "teste leo bobao- Validacao de documentos" }],
  }),
  component: BackofficeScreen,
});

function formatDate(value: any) {
  try {
    if (!value) return "-";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("pt-BR");
    }
    if (value instanceof Date) {
      return value.toLocaleString("pt-BR");
    }
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function BackofficeScreen() {
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string>("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<BackofficeUser[]>([]);
  const [viewingDocument, setViewingDocument] = useState<{
    url: string;
    nome: string;
  } | null>(null);

  const pendingRows = useMemo(() => rows.filter((u) => u.documentoValidado === "pendente"), [rows]);

  const loadUsers = async () => {
    setError("");
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "usuarios"));
      const all = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: d.id,
          nome: data.nome || "-",
          cpf: data.cpf || "-",
          telefone: data.telefone || "-",
          documentoValidado: data.documentoValidado ?? false,
          documentoArquivoNome: data.documentoArquivoNome || "",
          documentoDownloadURL: data.documentoDownloadURL || "",
          documentoStoragePath: data.documentoStoragePath || "",
          documentoEnviadoEm: data.documentoEnviadoEm,
        } satisfies BackofficeUser;
      });
      setRows(all);
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel carregar usuarios do Firebase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateStatus = async (uid: string, value: boolean | string) => {
    setSavingUid(uid);
    setError("");
    try {
      await setDoc(
        doc(db, "usuarios", uid),
        {
          documentoValidado: value,
          atualizadoEm: serverTimestamp(),
        },
        { merge: true },
      );

      setRows((prev) => prev.map((u) => (u.uid === uid ? { ...u, documentoValidado: value } : u)));
    } catch (err) {
      console.error(err);
      setError("Nao foi possivel atualizar o status do documento.");
    } finally {
      setSavingUid("");
    }
  };

  const handleViewDocument = async (user: BackofficeUser) => {
    try {
      let url = user.documentoDownloadURL || "";

      if (!url && user.documentoStoragePath) {
        url = await getDownloadURL(ref(storage, user.documentoStoragePath));
      }

      if (!url) {
        setError("Documento sem URL de visualização disponível.");
        return;
      }

      setViewingDocument({
        url,
        nome: user.documentoArquivoNome || "documento.pdf",
      });
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o documento para visualização.");
    }
  };

  return (
    <div className="min-h-screen bg-soft text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Backoffice - Documentos pendentes</h1>
            <p className="text-sm text-muted-foreground">
              Painel interno para validacao de documentos dos usuarios.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="h-10 px-4 rounded-lg border border-border bg-card text-foreground text-sm font-semibold hover:bg-soft disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCcw size={15} /> Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Usuarios cadastrados</p>
            <p className="text-2xl font-bold mt-1">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-amber-warn/20 bg-amber-warn/10 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-warn">Documentos pendentes</p>
            <p className="text-2xl font-bold mt-1 text-amber-warn">{pendingRows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultima acao</p>
            <p className="text-sm font-semibold mt-2 text-muted-foreground">
              {loading ? "Carregando..." : "Dados sincronizados"}
            </p>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Carregando usuarios...
          </div>
        ) : pendingRows.length === 0 ? (
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-5 text-sm text-primary">
            Nenhum documento pendente no momento.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-soft border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold">CPF</th>
                    <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                    <th className="text-left px-4 py-3 font-semibold">Documento</th>
                    <th className="text-left px-4 py-3 font-semibold">Enviado em</th>
                    <th className="text-left px-4 py-3 font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((user) => (
                    <tr
                      key={user.uid}
                      className="border-b last:border-b-0 border-border align-top"
                    >
                      <td className="px-4 py-3 font-medium">{user.nome || "-"}</td>
                      <td className="px-4 py-3">{user.cpf || "-"}</td>
                      <td className="px-4 py-3">{user.telefone || "-"}</td>
                      <td
                        className="px-4 py-3 max-w-[220px] truncate"
                        title={user.documentoArquivoNome || ""}
                      >
                        {user.documentoArquivoNome || "Arquivo sem nome"}
                      </td>
                      <td className="px-4 py-3">{formatDate(user.documentoEnviadoEm)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewDocument(user)}
                            className="h-9 px-3 rounded-md border border-border bg-card text-foreground font-semibold hover:bg-soft inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={14} /> Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(user.uid, true)}
                            disabled={savingUid === user.uid}
                            className="h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 size={14} /> Validar
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(user.uid, false)}
                            disabled={savingUid === user.uid}
                            className="h-9 px-3 rounded-md bg-destructive text-destructive-foreground font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <XCircle size={14} /> Não válido
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {viewingDocument && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-border">
            <header className="px-6 py-4 border-b border-border flex justify-between items-center bg-soft">
              <div>
                <h3 className="font-bold text-base text-foreground truncate max-w-[500px]">
                  Visualizar Documento
                </h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {viewingDocument.nome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </header>

            <div className="flex-1 p-6 bg-soft overflow-y-auto flex items-center justify-center min-h-[300px]">
              {viewingDocument.nome.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`${viewingDocument.url}#toolbar=0`}
                  className="w-full h-[65vh] border-0 rounded-xl bg-card shadow-sm"
                  title={viewingDocument.nome}
                />
              ) : /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingDocument.nome) ? (
                <img
                  src={viewingDocument.url}
                  alt={viewingDocument.nome}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md border border-border"
                />
              ) : (
                <div className="text-center py-10 flex flex-col items-center gap-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    <Eye size={32} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Formatos alternativos
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
                      Este arquivo não é uma imagem comum ou PDF. O navegador tentará carregá-lo
                      abaixo.
                    </p>
                  </div>
                  <iframe
                    src={viewingDocument.url}
                    className="w-full h-[65vh] border-0 rounded-xl bg-card shadow-sm mt-4"
                    title={viewingDocument.nome}
                  />
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-soft">
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="h-10 px-4 rounded-lg bg-feature hover:opacity-90 text-feature-foreground font-semibold text-sm transition-all cursor-pointer"
              >
                Concluir
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
