import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dirOf, normalizeLang, sharedLine, type Lang } from "@/game/copy";

const LangCtx = createContext<Lang>("en");

type PrefsApi = { lang?: string; say?: (text: string) => void; voiceFor?: (lang: string) => unknown };

function prefs(): PrefsApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { KulibertPrefs?: PrefsApi }).KulibertPrefs ?? null;
}

export function bootLang(search: { lang?: string; theme?: string; hub?: string }): { lang: Lang; classic: boolean } {
  const classic = search.theme === "classic" || search.hub === "classic";
  if (classic) return { lang: "en", classic: true };
  return { lang: normalizeLang(search.lang), classic: false };
}

export function LangRoot({
  boot,
  classic,
  children,
}: {
  boot: Lang;
  classic: boolean;
  children: ReactNode;
}) {
  const [lang, setLang] = useState<Lang>(classic ? "en" : boot);

  useEffect(() => {
    if (classic) {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
      document.documentElement.setAttribute("data-kp-lang", "en");
      return;
    }
    const apply = (raw?: string) => {
      const next = normalizeLang(raw || prefs()?.lang || boot);
      setLang(next);
      document.documentElement.lang = next === "simple" ? "en" : next;
      document.documentElement.dir = dirOf(next);
      document.documentElement.setAttribute("data-kp-lang", next);
    };
    apply();
    const onLang = (ev: Event) => {
      const detail = (ev as CustomEvent<{ lang?: string }>).detail;
      apply(detail?.lang);
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; lang?: string } | null;
      if (!data || data.type !== "kp-lang") return;
      apply(data.lang);
    };
    window.addEventListener("kulibert-lang", onLang);
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("kulibert-lang", onLang);
      window.removeEventListener("message", onMsg);
    };
  }, [boot, classic]);

  return <LangCtx.Provider value={classic ? "en" : lang}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function speakLine(text: string, lang: Lang) {
  const api = prefs();
  if (api?.say) {
    api.say(text);
    return api.voiceFor ? api.voiceFor(lang) != null : true;
  }
  return false;
}

export function noVoiceLine() {
  return sharedLine("noVoice");
}
