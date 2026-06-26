import { useEffect, useState } from "react";
import { Contrast, Moon, Volume2, VolumeX } from "lucide-react";

export default function AccessibilityControls() {
  const [size, setSize] = useState<"normal" | "large" | "xlarge">(() => {
    try {
      const storedSize = localStorage.getItem("accessibility-size");
      return storedSize === "large" || storedSize === "xlarge" ? storedSize : "normal";
    } catch {
      return "normal";
    }
  });

  const [contrast, setContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem("accessibility-contrast") === "1";
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("accessibility-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const [voiceReader, setVoiceReader] = useState<boolean>(() => {
    try {
      return localStorage.getItem("accessibility-voice") === "1";
    } catch {
      return false;
    }
  });

  // Size
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("accessibility-large", "accessibility-xlarge");
    if (size === "large") root.classList.add("accessibility-large");
    if (size === "xlarge") root.classList.add("accessibility-xlarge");
    try {
      localStorage.setItem("accessibility-size", size);
    } catch (e) {
      console.warn(e);
    }
  }, [size]);

  // Contrast
  useEffect(() => {
    const root = document.documentElement;
    if (contrast) root.classList.add("accessibility-high-contrast");
    else root.classList.remove("accessibility-high-contrast");
    try {
      localStorage.setItem("accessibility-contrast", contrast ? "1" : "0");
    } catch (e) {
      console.warn(e);
    }
  }, [contrast]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("accessibility-theme", theme);
    } catch (e) {
      console.warn(e);
    }
  }, [theme]);

  // Leitura de Voz (Text-to-Speech)
  useEffect(() => {
    try {
      localStorage.setItem("accessibility-voice", voiceReader ? "1" : "0");
    } catch (e) {
      console.warn(e);
    }

    const handleMouseUp = () => {
      if (!voiceReader) return;
      const text = window.getSelection()?.toString();
      if (text && text.trim().length > 0) {
        window.speechSynthesis.cancel(); // Stop current speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        window.speechSynthesis.speak(utterance);
      }
    };

    if (voiceReader) {
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      window.speechSynthesis.cancel();
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [voiceReader]);

  return (
    <div className="flex flex-col gap-8">
      {/* Bloco 1: Tamanho da Fonte */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Tamanho da Fonte</h4>
        <div
          className="accessibility-bar inline-flex bg-card"
          role="toolbar"
          aria-label="Acessibilidade Tamanho"
        >
          <button
            aria-pressed={size === "normal"}
            title="Tamanho normal"
            onClick={() => setSize("normal")}
          >
            A
          </button>
          <button
            aria-pressed={size === "large"}
            title="Aumentar fonte"
            onClick={() => setSize("large")}
          >
            A+
          </button>
          <button
            aria-pressed={size === "xlarge"}
            title="Fonte muito grande"
            onClick={() => setSize("xlarge")}
          >
            A++
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Ajusta o tamanho dos textos do sistema para melhor legibilidade.
        </p>
      </div>

      {/* Bloco 2: Autocontraste e Cores */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Contraste e Cores</h4>
        <div className="flex items-center gap-3">
          <button
            aria-pressed={contrast}
            title="Alto contraste"
            onClick={() => setContrast((value) => !value)}
            className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-all flex items-center gap-2 ${contrast ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground"}`}
          >
            <Contrast size={18} />
            Alto Contraste
          </button>

          <button
            type="button"
            aria-pressed={theme === "light"}
            title="Modo claro"
            onClick={() => setTheme("light")}
            className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-all ${theme === "light" ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground"}`}
          >
            Claro
          </button>

          <button
            type="button"
            aria-pressed={theme === "dark"}
            title="Modo escuro"
            onClick={() => setTheme("dark")}
            className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-all ${theme === "dark" ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground"}`}
          >
            <Moon size={16} className="inline-block mr-1" /> Escuro
          </button>
        </div>
      </div>

      {/* Bloco 3: Leitura de texto por voz */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Leitura de Texto (Voz)</h4>
        <button
          aria-pressed={voiceReader}
          onClick={() => {
            if (!voiceReader) {
              const u = new SpeechSynthesisUtterance(
                "Leitura por voz ativada. Selecione um texto na tela para ouvir.",
              );
              u.lang = "pt-BR";
              window.speechSynthesis.speak(u);
            } else {
              window.speechSynthesis.cancel();
            }
            setVoiceReader(!voiceReader);
          }}
          className={`h-11 rounded-xl border px-4 text-sm font-semibold transition-all flex items-center gap-2 ${voiceReader ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground"}`}
        >
          {voiceReader ? <Volume2 size={18} /> : <VolumeX size={18} />}
          {voiceReader ? "Voz Ativada" : "Ativar Leitura por Voz"}
        </button>
        <p className="text-xs text-muted-foreground mt-2 max-w-sm leading-relaxed">
          Quando ativado, selecione qualquer texto na tela para que o sistema leia em voz alta.
          Funcionalidade desenvolvida para analistas com visão subnormal.
        </p>
      </div>
    </div>
  );
}
