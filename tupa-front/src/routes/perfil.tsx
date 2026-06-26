import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  UserCircle,
  Camera,
  Lock,
  Mail,
  Building,
  Key,
  Headset,
  Laptop,
  TreePine,
  Sailboat,
  Tent,
  Wheat,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAppState, appStore } from "@/lib/app-store";

export const Route = createFileRoute("/perfil")({
  component: PerfilBackofficeScreen,
});

const PRESET_AVATARS = [
  { id: "headset", icon: Headset, bg: "bg-blue-500/20", color: "text-blue-500" },
  { id: "computador", icon: Laptop, bg: "bg-indigo-500/20", color: "text-indigo-500" },
  { id: "arvore", icon: TreePine, bg: "bg-emerald-500/20", color: "text-emerald-500" },
  { id: "barco", icon: Sailboat, bg: "bg-cyan-500/20", color: "text-cyan-500" },
  { id: "oca", icon: Tent, bg: "bg-amber-500/20", color: "text-amber-500" },
  { id: "plantacao", icon: Wheat, bg: "bg-lime-500/20", color: "text-lime-500" },
];

function PerfilBackofficeScreen() {
  const navigate = useNavigate();
  const { backofficeUser } = useAppState();

  const [nome, setNome] = useState(backofficeUser.nome);
  const [cargo, setCargo] = useState(backofficeUser.cargo);
  const [email, setEmail] = useState(backofficeUser.email);
  const [avatarId, setAvatarId] = useState<string | null>(backofficeUser.avatarId);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  useEffect(() => {
    setNome(backofficeUser.nome);
    setCargo(backofficeUser.cargo);
    setEmail(backofficeUser.email);
    setAvatarId(backofficeUser.avatarId);
  }, [backofficeUser]);

  const activeAvatar = PRESET_AVATARS.find((a) => a.id === avatarId);

  return (
    <div className="flex-1 flex flex-col p-8 bg-muted/30 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <UserCircle className="text-primary w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                Perfil Profissional
              </h2>
              <p className="text-muted-foreground mt-1">
                Gerencie suas informações e credenciais de acesso do backoffice.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden p-6 mt-4 relative">
          {/* Avatar Section */}
          <div className="flex items-center gap-6 pb-6 border-b border-border">
            <div className="relative group">
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className={`w-24 h-24 rounded-full border-2 border-border/60 flex items-center justify-center font-bold text-3xl shadow-soft overflow-hidden relative active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none ${activeAvatar ? activeAvatar.bg : "bg-secondary/20 text-secondary-foreground"}`}
              >
                {activeAvatar ? (
                  <activeAvatar.icon className={`w-12 h-12 ${activeAvatar.color}`} />
                ) : (
                  <UserCircle className="w-12 h-12 opacity-50" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Camera size={24} />
                </div>
              </button>
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground border border-background shadow flex items-center justify-center hover:bg-primary/95 transition-all cursor-pointer"
              >
                <Camera size={14} />
              </button>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{nome}</h3>
              <p className="text-muted-foreground font-medium">{cargo}</p>
            </div>
          </div>

          <div className="py-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-primary/70" /> Nome Completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold text-foreground transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary/70" /> Cargo / Função
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold text-foreground transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary/70" /> E-mail Corporativo (Gov)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold text-foreground transition-all"
                />
              </div>
            </div>
          </div>

          <div className="py-6 border-y border-border flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-bold text-foreground flex items-center gap-2 text-base">
                <Lock className="w-4 h-4 text-primary" /> Segurança da Conta
              </h4>
              <p className="text-sm text-muted-foreground">
                Atualize sua senha de acesso ao sistema Tupã.
              </p>
            </div>
            <button
              onClick={() => alert("Ação para trocar de senha abriria um modal aqui.")}
              className="px-5 py-2.5 rounded-xl border border-border font-semibold text-sm hover:bg-secondary/40 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4" /> Alterar Senha
            </button>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2.5 rounded-xl border border-border font-semibold hover:bg-secondary/40 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                appStore.set({
                  backofficeUser: { nome, cargo, email, avatarId },
                });
                alert("Perfil salvo com sucesso!");
                navigate({ to: "/" });
              }}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors shadow-soft cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>

      {/* Select Avatar Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-2xl border border-border animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">Selecione um Avatar</h3>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 text-muted-foreground cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {PRESET_AVATARS.map((avatar) => {
                const Icon = avatar.icon;
                const isSelected = avatarId === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setAvatarId(avatar.id);
                      setIsAvatarModalOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? "border-primary bg-primary/10 scale-105" : "border-border hover:border-primary/50 hover:bg-secondary/20"}`}
                  >
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center ${avatar.bg}`}
                    >
                      <Icon className={`w-7 h-7 ${avatar.color}`} />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground capitalize">
                      {avatar.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
