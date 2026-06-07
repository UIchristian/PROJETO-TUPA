import { useEffect, useState } from "react";
import { Contrast, Moon } from "lucide-react";

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

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("accessibility-large", "accessibility-xlarge");
    if (size === "large") root.classList.add("accessibility-large");
    if (size === "xlarge") root.classList.add("accessibility-xlarge");
    try {
      localStorage.setItem("accessibility-size", size);
    } catch {
      // ignore storage failures
    }
  }, [size]);

  useEffect(() => {
    const root = document.documentElement;
    if (contrast) root.classList.add("accessibility-high-contrast");
    else root.classList.remove("accessibility-high-contrast");
    try {
      localStorage.setItem("accessibility-contrast", contrast ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [contrast]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("accessibility-theme", theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  return (
    <div className="flex flex-col gap-3">
      <div className="accessibility-bar" role="toolbar" aria-label="Acessibilidade">
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
        <button
          aria-pressed={contrast}
          title="Alto contraste"
          onClick={() => setContrast((value) => !value)}
        >
          <Contrast size={18} />
        </button>
      </div>

      <div className="flex items-center gap-2">
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
  );
}
