import { appStore, useAppState, type Language } from "./app-store";
import es from "./translations/es.json";
import pt from "./translations/pt.json";
import en from "./translations/en.json";

const translations = { es, pt, en } as const;

/**
 * Translates a given key with optional dynamic arguments.
 * Falls back to Spanish (es) if translation is missing.
 */
export function t(
  key: string,
  currentLang: Language = "es",
  args?: Record<string, string | number>,
): string {
  const keys = key.split(".");

  // 1. Try current language
  let val: any = translations[currentLang];
  for (const k of keys) {
    if (val && typeof val === "object" && k in val) {
      val = val[k];
    } else {
      val = undefined;
      break;
    }
  }

  // 2. Try fallback (es)
  if (typeof val !== "string" && currentLang !== "es") {
    let fallbackVal: any = translations["es"];
    for (const k of keys) {
      if (fallbackVal && typeof fallbackVal === "object" && k in fallbackVal) {
        fallbackVal = fallbackVal[k];
      } else {
        fallbackVal = undefined;
        break;
      }
    }
    if (typeof fallbackVal === "string") {
      val = fallbackVal;
    }
  }

  // 3. Fallback to key itself
  if (typeof val !== "string") {
    return key;
  }

  // Replace dynamic template arguments like {name}
  if (args) {
    let result = val;
    for (const [k, v] of Object.entries(args)) {
      result = result.replace(new RegExp(`{${k}}`, "g"), String(v));
    }
    return result;
  }

  return val;
}

export function useTranslation() {
  const state = useAppState();
  const language = state.language || "es";

  const setLanguage = (lang: Language) => {
    appStore.set({ language: lang });
  };

  return {
    t: (key: string, args?: Record<string, string | number>) => t(key, language, args),
    language,
    setLanguage,
  };
}

/**
 * Translates a composite crop string like "Milho + Soja (Safrinha)" dynamically.
 */
export function translateCropString(crop: string, t: any): string {
  if (!crop) return "";
  let result = crop;

  // Replace systems (all languages to current lang)
  result = result
    .replace(/Safrinha/g, t("cadastro.second_harvest"))
    .replace(/Primeira safra/g, t("cadastro.first_harvest"))
    .replace(/Rotação/g, t("cadastro.rotation"))
    .replace(/second harvest/g, t("cadastro.second_harvest"))
    .replace(/first harvest/g, t("cadastro.first_harvest"))
    .replace(/rotation/g, t("cadastro.rotation"))
    .replace(/segunda zafra/g, t("cadastro.second_harvest"))
    .replace(/primera zafra/g, t("cadastro.first_harvest"))
    .replace(/rotación/g, t("cadastro.rotation"));

  // Crop translation mapping helper
  const cropMap: Record<string, string> = {
    Milho: "Milho",
    Corn: "Milho",
    Maíz: "Milho",
    Soja: "Soja",
    Soy: "Soja",
    Soya: "Soja",
    Café: "Café",
    Coffee: "Café",
    Feijão: "Feijão",
    Beans: "Feijão",
    Frijol: "Feijão",
    "Cana-de-açúcar": "Cana-de-açúcar",
    Sugarcane: "Cana-de-açúcar",
    "Caña de azúcar": "Cana-de-açúcar",
    Laranja: "Laranja",
    Orange: "Laranja",
    Naranja: "Laranja",
    Batata: "Batata",
    Potato: "Batata",
    Papa: "Batata",
    Mandioca: "Mandioca",
    Cassava: "Mandioca",
    Algodão: "Algodão",
    Cotton: "Algodão",
    Algodón: "Algodão",
    Outro: "Outro",
    Other: "Outro",
    Otro: "Outro",
  };

  // Replace each crop name dynamically
  Object.keys(cropMap).forEach((cropName) => {
    const translationKey = cropMap[cropName];
    // Simple replacement
    if (result.includes(cropName)) {
      result = result.replace(new RegExp(cropName, "g"), t(`crops.${translationKey}`));
    }
  });

  return result;
}
