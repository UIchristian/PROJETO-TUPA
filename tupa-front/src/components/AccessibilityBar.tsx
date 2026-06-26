import { useEffect, useState } from "react";
import { Contrast, Moon, Sun, Type, ZoomIn, ZoomOut } from "lucide-react";

export default function AccessibilityBar() {
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

  // Effect for Font Size
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

  // Effect for High Contrast
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

  // Effect for Theme
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

  const increaseSize = () => {
    if (size === "normal") setSize("large");
    else if (size === "large") setSize("xlarge");
  };

  const decreaseSize = () => {
    if (size === "xlarge") setSize("large");
    else if (size === "large") setSize("normal");
  };

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas de acessibilidade"
      className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-2 py-1 text-white"
    >
      <button
        onClick={decreaseSize}
        disabled={size === "normal"}
        aria-label="Diminuir fonte"
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ZoomOut size={16} />
      </button>

      <span className="text-xs font-semibold px-1 select-none">A</span>

      <button
        onClick={increaseSize}
        disabled={size === "xlarge"}
        aria-label="Aumentar fonte"
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-4 bg-white/20 mx-1"></div>

      <button
        onClick={() => setContrast(!contrast)}
        aria-pressed={contrast}
        aria-label="Alto contraste"
        className={`p-1.5 rounded-full transition-colors ${contrast ? "bg-white/30" : "hover:bg-white/20"}`}
      >
        <Contrast size={16} />
      </button>

      <button
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-pressed={theme === "dark"}
        aria-label={theme === "light" ? "Modo escuro" : "Modo claro"}
        className={`p-1.5 rounded-full transition-colors ${theme === "dark" ? "bg-white/30" : "hover:bg-white/20"}`}
      >
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );
}
