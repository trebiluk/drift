import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dirOf, normalizeLang, sharedLine, type Lang } from "@/game/copy";

const LangCtx = createContext<Lang>("en");

type PrefsApi = { lang?: string; say?: (text: string) => void; voiceFor?: (lang: string) => unknown };
type I18nApi = { ready?: (lang: string, cb: () => void) => void };

function prefs(): PrefsApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { KulibertPrefs?: PrefsApi }).KulibertPrefs ?? null;
}

function i18n(): I18nApi | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { KulibertI18n?: I18nApi }).KulibertI18n ?? null;
}

export function bootLang(search: { lang?: string; theme?: string; hub?: string }): { lang: Lang; classic: boolean } {
  const classic = search.theme === "classic" || search.hub === "classic";
  if (classic) return { lang: "en", classic: true };
  return { lang: normalizeLang(search.lang), classic: false };
}

function classicStored(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("theme") === "classic" || q.get("hub") === "classic") return true;
    return localStorage.getItem("tech-room-hub") === "classic";
  } catch {
    return false;
  }
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
  const [sharedTick, setSharedTick] = useState(0);

  useEffect(() => {
    const locked = classic || classicStored();
    const paint = (nextLang: Lang) => {
      const shown: Lang = locked ? "en" : nextLang;
      setLang(shown);
      document.documentElement.lang = shown === "simple" ? "en" : shown;
      document.documentElement.dir = dirOf(shown);
      document.documentElement.setAttribute("data-kp-lang", shown);
      i18n()?.ready?.(shown, () => setSharedTick((n) => n + 1));
    };

    if (locked) {
      paint("en");
      return;
    }

    let initial = boot;
    try {
      const urlLang = new URLSearchParams(window.location.search).get("lang");
      if (urlLang) initial = normalizeLang(urlLang);
      else if (prefs()?.lang) initial = normalizeLang(prefs()?.lang);
    } catch {
      /* keep the first-paint language */
    }
    paint(initial);

    const onLang = (ev: Event) => {
      const detail = (ev as CustomEvent<{ lang?: string }>).detail;
      if (detail?.lang) paint(normalizeLang(detail.lang));
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; lang?: string } | null;
      if (!data || data.type !== "kp-lang" || !data.lang) return;
      paint(normalizeLang(data.lang));
    };
    window.addEventListener("kulibert-lang", onLang);
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("kulibert-lang", onLang);
      window.removeEventListener("message", onMsg);
    };
  }, [boot, classic]);

  const shown = classic ? "en" : lang;
  return (
    <LangCtx.Provider value={shown}>
      <div className="contents" data-kp-copy={sharedTick}>
        {children}
      </div>
    </LangCtx.Provider>
  );
}

export function useLang() {
  return useContext(LangCtx);
}

/** True when this language has a voice. rw and ti do not. */
export function speakLine(text: string, lang: Lang) {
  const api = prefs();
  if (api?.say) {
    api.say(text);
    return api.voiceFor ? api.voiceFor(lang) != null : lang !== "rw" && lang !== "ti";
  }
  return false;
}

export function noVoiceLine() {
  return sharedLine("noVoice");
}
