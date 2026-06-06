import { useEffect, useState } from "react";
import { Sun } from "lucide-react";

export default function AccessibilityBar() {
  const [size, setSize] = useState<"normal" | "large" | "xlarge">(() => {
    try {
      const storedSize = localStorage.getItem("accessibility-size");
      return storedSize === "large" || storedSize === "xlarge" ? storedSize : "normal";
    } catch {
      // localStorage may not be available in some environments
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

  return (
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
      <button aria-pressed={contrast} title="Alto contraste" onClick={() => setContrast((v) => !v)}>
        {Sun ? <Sun size={18} /> : "☀"}
      </button>
    </div>
  );
}
