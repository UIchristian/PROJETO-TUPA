import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../../firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_SIZE = 10;

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
  documentoMotivoRejeicao?: string;
};

type StatusFilter = "todos" | "pendente" | "validado" | "invalido";

export const Route = createFileRoute("/backoffice")({
  head: () => ({
    meta: [{ title: "Backoffice - Validação de documentos" }],
  }),
  component: BackofficeScreen,
});

// ─── helpers ────────────────────────────────────────────────────────────────

function toDate(value: any): Date | null {
  try {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    return new Date(value);
  } catch {
    return null;
  }
}

function formatDate(value: any) {
  const d = toDate(value);
  return d ? d.toLocaleString("pt-BR") : "-";
}

function pendingDuration(value: any): string {
  const d = toDate(value);
  if (!d) return "-";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor(ms / 60_000);
  if (days >= 1) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  if (mins >= 1) return `${mins}min`;
  return "agora";
}

function pendingUrgency(value: any): "high" | "medium" | "low" {
  const d = toDate(value);
  if (!d) return "low";
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days >= 3) return "high";
  if (days >= 1) return "medium";
  return "low";
}

// ─── small components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: boolean | string }) {
  if (status === "pendente")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Pendente
      </span>
    );
  if (status === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 size={11} /> Validado
      </span>
    );
  if (status === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
        <XCircle size={11} /> Não válido
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      Sem documento
    </span>
  );
}

function PendingTimer({ value }: { value: any }) {
  const label = pendingDuration(value);
  const urgency = pendingUrgency(value);
  const cls = {
    high: "text-rose-600 bg-rose-50 border-rose-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-slate-500 bg-slate-50 border-slate-200",
  }[urgency];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <Clock size={11} /> {label}
    </span>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`w-8 h-8 rounded-md text-xs font-semibold cursor-pointer ${
                p === page ? "bg-slate-900 text-white" : "hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  nome,
  loading,
  onConfirm,
  onCancel,
}: {
  nome: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Confirmar validação</p>
            <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-6">
          Deseja validar o documento de <strong>{nome}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectDialog({
  nome,
  loading,
  onConfirm,
  onCancel,
}: {
  nome: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-rose-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Rejeitar documento</p>
            <p className="text-sm text-slate-500">O motivo será exibido ao usuário.</p>
          </div>
        </div>
        <p className="text-sm text-slate-700 mb-3">
          Rejeitando documento de <strong>{nome}</strong>.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo da rejeição (opcional)"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Salvando..." : "Rejeitar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

function BackofficeScreen() {
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string>("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<BackofficeUser[]>([]);
  const [viewingDocument, setViewingDocument] = useState<{ url: string; nome: string } | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [pendentePage, setPendentePage] = useState(1);
  const [arquivosPage, setArquivosPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<{ uid: string; nome: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ uid: string; nome: string } | null>(null);

  const pendingRows = useMemo(() => rows.filter((u) => u.documentoValidado === "pendente"), [rows]);
  const allFileRows = useMemo(() => rows.filter((u) => !!u.documentoArquivoNome), [rows]);

  const normalizeSearch = (s: string) => s.toLowerCase().trim();
  const matchesSearch = (u: BackofficeUser, q: string) => {
    if (!q) return true;
    return (
      u.nome.toLowerCase().includes(q) ||
      u.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
    );
  };

  const filteredPendentes = useMemo(() => {
    const q = normalizeSearch(search);
    return pendingRows.filter((u) => matchesSearch(u, q));
  }, [pendingRows, search]);

  const filteredArquivos = useMemo(() => {
    const q = normalizeSearch(search);
    return allFileRows.filter((u) => {
      if (!matchesSearch(u, q)) return false;
      if (statusFilter === "pendente") return u.documentoValidado === "pendente";
      if (statusFilter === "validado") return u.documentoValidado === true;
      if (statusFilter === "invalido") return u.documentoValidado === false;
      return true;
    });
  }, [allFileRows, search, statusFilter]);

  const paginatedPendentes = useMemo(() => {
    const start = (pendentePage - 1) * PAGE_SIZE;
    return filteredPendentes.slice(start, start + PAGE_SIZE);
  }, [filteredPendentes, pendentePage]);

  const paginatedArquivos = useMemo(() => {
    const start = (arquivosPage - 1) * PAGE_SIZE;
    return filteredArquivos.slice(start, start + PAGE_SIZE);
  }, [filteredArquivos, arquivosPage]);

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
          documentoMotivoRejeicao: data.documentoMotivoRejeicao || "",
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

  const updateStatus = async (uid: string, value: boolean | string, motivo?: string) => {
    setSavingUid(uid);
    setError("");
    try {
      await setDoc(
        doc(db, "usuarios", uid),
        {
          documentoValidado: value,
          atualizadoEm: serverTimestamp(),
          ...(motivo !== undefined ? { documentoMotivoRejeicao: motivo } : {}),
        },
        { merge: true },
      );
      setRows((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? { ...u, documentoValidado: value, ...(motivo !== undefined ? { documentoMotivoRejeicao: motivo } : {}) }
            : u,
        ),
      );
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
      setViewingDocument({ url, nome: user.documentoArquivoNome || "documento.pdf" });
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o documento para visualização.");
    }
  };

  const handleConfirmValidar = async () => {
    if (!confirmTarget) return;
    await updateStatus(confirmTarget.uid, true);
    setConfirmTarget(null);
  };

  const handleConfirmRejeitar = async (motivo: string) => {
    if (!rejectTarget) return;
    await updateStatus(rejectTarget.uid, false, motivo);
    setRejectTarget(null);
  };

  const renderActions = (user: BackofficeUser) => (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => handleViewDocument(user)}
        className="h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer text-xs"
      >
        <Eye size={13} /> Visualizar
      </button>
      {user.documentoValidado === "pendente" && (
        <>
          <button
            type="button"
            onClick={() => setConfirmTarget({ uid: user.uid, nome: user.nome })}
            disabled={savingUid === user.uid}
            className="h-9 px-3 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <CheckCircle2 size={13} /> Validar
          </button>
          <button
            type="button"
            onClick={() => setRejectTarget({ uid: user.uid, nome: user.nome })}
            disabled={savingUid === user.uid}
            className="h-9 px-3 rounded-md bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <XCircle size={13} /> Rejeitar
          </button>
        </>
      )}
    </div>
  );

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPendentePage(1);
    setArquivosPage(1);
  };

  const statusFilterLabels: Record<StatusFilter, string> = {
    todos: "Todos",
    pendente: "Pendentes",
    validado: "Validados",
    invalido: "Não válidos",
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Backoffice</h1>
            <p className="text-sm text-slate-500">Painel interno para validação de documentos dos usuários.</p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Usuários cadastrados</p>
            <p className="text-2xl font-bold mt-1">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-700">Documentos pendentes</p>
            <p className="text-2xl font-bold mt-1 text-amber-900">{pendingRows.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Arquivos enviados</p>
            <p className="text-2xl font-bold mt-1">{allFileRows.length}</p>
          </div>
        </section>

        {/* Global search */}
        <div className="mb-4 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <Tabs defaultValue="pendentes">
          <TabsList className="mb-4 bg-white border border-slate-200 h-10 p-1">
            <TabsTrigger value="pendentes" className="gap-1.5">
              Pendentes
              {pendingRows.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                  {pendingRows.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="arquivos" className="gap-1.5">
              <FileText size={14} /> Arquivos enviados
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Pendentes ── */}
          <TabsContent value="pendentes">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                Carregando usuários...
              </div>
            ) : filteredPendentes.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                {search ? "Nenhum resultado para a busca." : "Nenhum documento pendente no momento."}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Usuário</th>
                        <th className="text-left px-4 py-3 font-semibold">CPF</th>
                        <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                        <th className="text-left px-4 py-3 font-semibold">Documento</th>
                        <th className="text-left px-4 py-3 font-semibold">Enviado em</th>
                        <th className="text-left px-4 py-3 font-semibold">Aguardando</th>
                        <th className="text-left px-4 py-3 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPendentes.map((user) => (
                        <tr key={user.uid} className="border-b last:border-b-0 border-slate-100 align-top">
                          <td className="px-4 py-3 font-medium">{user.nome}</td>
                          <td className="px-4 py-3">{user.cpf}</td>
                          <td className="px-4 py-3">{user.telefone}</td>
                          <td className="px-4 py-3 max-w-[180px] truncate" title={user.documentoArquivoNome}>
                            {user.documentoArquivoNome || "Arquivo sem nome"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(user.documentoEnviadoEm)}</td>
                          <td className="px-4 py-3">
                            <PendingTimer value={user.documentoEnviadoEm} />
                          </td>
                          <td className="px-4 py-3">{renderActions(user)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={pendentePage}
                  total={filteredPendentes.length}
                  pageSize={PAGE_SIZE}
                  onChange={setPendentePage}
                />
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Arquivos enviados ── */}
          <TabsContent value="arquivos">
            {/* Status filter pills */}
            <div className="mb-3 flex gap-2 flex-wrap">
              {(Object.keys(statusFilterLabels) as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setStatusFilter(f); setArquivosPage(1); }}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                    statusFilter === f
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {statusFilterLabels[f]}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                Carregando arquivos...
              </div>
            ) : filteredArquivos.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                {search || statusFilter !== "todos"
                  ? "Nenhum resultado para os filtros aplicados."
                  : "Nenhum arquivo enviado ainda."}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Usuário</th>
                        <th className="text-left px-4 py-3 font-semibold">CPF</th>
                        <th className="text-left px-4 py-3 font-semibold">Arquivo</th>
                        <th className="text-left px-4 py-3 font-semibold">Enviado em</th>
                        <th className="text-left px-4 py-3 font-semibold">Status</th>
                        <th className="text-left px-4 py-3 font-semibold">Motivo rejeição</th>
                        <th className="text-left px-4 py-3 font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedArquivos.map((user) => (
                        <tr key={user.uid} className="border-b last:border-b-0 border-slate-100 align-top">
                          <td className="px-4 py-3 font-medium">{user.nome}</td>
                          <td className="px-4 py-3">{user.cpf}</td>
                          <td className="px-4 py-3 max-w-[160px] truncate" title={user.documentoArquivoNome}>
                            {user.documentoArquivoNome || "Arquivo sem nome"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDate(user.documentoEnviadoEm)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={user.documentoValidado} />
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            {user.documentoValidado === false && user.documentoMotivoRejeicao ? (
                              <span className="text-xs text-slate-600 italic">{user.documentoMotivoRejeicao}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{renderActions(user)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={arquivosPage}
                  total={filteredArquivos.length}
                  pageSize={PAGE_SIZE}
                  onChange={setArquivosPage}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Document viewer modal ── */}
      {viewingDocument && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-900 truncate max-w-[500px]">Visualizar Documento</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{viewingDocument.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </header>

            <div className="flex-1 p-6 bg-slate-100 overflow-y-auto flex items-center justify-center min-h-[300px]">
              {viewingDocument.nome.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={`${viewingDocument.url}#toolbar=0`}
                  className="w-full h-[65vh] border-0 rounded-xl bg-white shadow-sm"
                  title={viewingDocument.nome}
                />
              ) : /\.(jpg|jpeg|png|webp|gif)$/i.test(viewingDocument.nome) ? (
                <img
                  src={viewingDocument.url}
                  alt={viewingDocument.nome}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md border border-slate-200"
                />
              ) : (
                <div className="text-center py-10 flex flex-col items-center gap-4 w-full">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <Eye size={32} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Formatos alternativos</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-[280px]">
                      Este arquivo não é uma imagem ou PDF. O navegador tentará carregá-lo abaixo.
                    </p>
                  </div>
                  <iframe
                    src={viewingDocument.url}
                    className="w-full h-[65vh] border-0 rounded-xl bg-white shadow-sm mt-4"
                    title={viewingDocument.nome}
                  />
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setViewingDocument(null)}
                className="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Confirm validar dialog ── */}
      {confirmTarget && (
        <ConfirmDialog
          nome={confirmTarget.nome}
          loading={savingUid === confirmTarget.uid}
          onConfirm={handleConfirmValidar}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* ── Reject dialog ── */}
      {rejectTarget && (
        <RejectDialog
          nome={rejectTarget.nome}
          loading={savingUid === rejectTarget.uid}
          onConfirm={handleConfirmRejeitar}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
