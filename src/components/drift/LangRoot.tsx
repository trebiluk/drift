import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dirOf, markSharedReady, normalizeLang, sharedLine, type Lang } from "@/game/copy";

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
  // First paint matches the English door file. The Hub language applies after mount.
  const [lang, setLang] = useState<Lang>("en");
  const [sharedTick, setSharedTick] = useState(0);

  useEffect(() => {
    const locked = classic || classicStored();
    const paint = (nextLang: Lang) => {
      const shown: Lang = locked ? "en" : nextLang;
      markSharedReady();
      setLang(shown);
      document.documentElement.lang = shown === "simple" ? "en" : shown;
      document.documentElement.dir = dirOf(shown);
      document.documentElement.setAttribute("data-kp-lang", shown);
      i18n()?.ready?.(shown, () => setSharedTick((n) => n + 1));
    };

    const fromUrl = () => {
      if (locked) return "en" as Lang;
      try {
        const urlLang = new URLSearchParams(window.location.search).get("lang");
        if (urlLang) return normalizeLang(urlLang);
        if (prefs()?.lang) return normalizeLang(prefs()?.lang);
      } catch {
        /* keep English */
      }
      return boot;
    };

    paint(fromUrl());

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
    const onShared = () => paint(fromUrl());
    window.addEventListener("kulibert-lang", onLang);
    window.addEventListener("message", onMsg);
    window.addEventListener("drift-shared-ready", onShared);
    return () => {
      window.removeEventListener("kulibert-lang", onLang);
      window.removeEventListener("message", onMsg);
      window.removeEventListener("drift-shared-ready", onShared);
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

/** Explicit Read aloud. The room read switch only gates KulibertPrefs.say;
 *  a tap still speaks unless sound is off. rw and ti have no voice. */
export function speakLine(text: string, lang: Lang) {
  const api = prefs();
  if (api?.say) api.say(text);
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const readOn = root?.getAttribute("data-kp-read") === "1";
  if (readOn) return api?.voiceFor ? api.voiceFor(lang) != null : lang !== "rw" && lang !== "ti";
  if (lang === "rw" || lang === "ti" || typeof window === "undefined") return false;
  if (root?.getAttribute("data-kp-sound") === "0") return false;
  const synth = window.speechSynthesis;
  if (!synth) return false;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const voice = api?.voiceFor?.(lang) as SpeechSynthesisVoice | undefined;
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    synth.cancel();
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function noVoiceLine() {
  return sharedLine("noVoice");
}
