import { useEffect, useState } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { bootLang } from "@/components/drift/LangRoot";
import { dirOf, normalizeLang, type Lang } from "@/game/copy";
import appCss from "../styles.css?url";

const APP_NAME = "Drift";

/** Classroom snapshot is built with base `./` and served under /drift/. */
const classroomDoor = import.meta.env.BASE_URL === "./";

const SHARED_SCRIPTS = [
  "/shared/kw-who.js?v=2026-10-01-v2",
  "/shared/kulibert-i18n.js?v=2026-10-04-i18n",
  "/shared/kulibert-prefs.js?v=2026-10-04-i18n",
];

function loadSharedScripts() {
  const run = (index: number) => {
    if (index >= SHARED_SCRIPTS.length) {
      window.dispatchEvent(new Event("drift-shared-ready"));
      return;
    }
    const node = document.createElement("script");
    node.src = SHARED_SCRIPTS[index];
    node.onload = () => run(index + 1);
    node.onerror = () => run(index + 1);
    document.body.appendChild(node);
  };
  run(0);
}

function readBoot(): { lang: Lang; classic: boolean } {
  const q = new URLSearchParams(window.location.search);
  let classic = q.get("theme") === "classic" || q.get("hub") === "classic";
  try {
    if (localStorage.getItem("tech-room-hub") === "classic") classic = true;
  } catch {
    /* ignore */
  }
  if (classic) return { lang: "en", classic: true };
  const urlLang = q.get("lang");
  if (urlLang) return bootLang({ lang: urlLang });
  const prefsLang = (window as Window & { KulibertPrefs?: { lang?: string } }).KulibertPrefs?.lang;
  if (prefsLang) return { lang: normalizeLang(prefsLang), classic: false };
  return { lang: "en", classic: false };
}

function RootDocument() {
  // English until mount so the first client render matches the saved door HTML.
  const [boot, setBoot] = useState<{ lang: Lang; classic: boolean }>({ lang: "en", classic: false });

  useEffect(() => {
    const apply = () => setBoot(readBoot());
    apply();
    const onLang = () => apply();
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string } | null;
      if (data?.type === "kp-lang") apply();
    };
    window.addEventListener("kulibert-lang", onLang);
    window.addEventListener("drift-shared-ready", onLang);
    window.addEventListener("message", onMsg);
    if (classroomDoor) loadSharedScripts();
    return () => {
      window.removeEventListener("kulibert-lang", onLang);
      window.removeEventListener("drift-shared-ready", onLang);
      window.removeEventListener("message", onMsg);
    };
  }, []);

  return (
    <html
      lang={boot.lang === "simple" ? "en" : boot.lang}
      dir={dirOf(boot.lang)}
      data-kp-lang={boot.lang}
      suppressHydrationWarning
      className="antialiased"
    >
      <head>
        {classroomDoor ? <base href="/drift/" /> : null}
        <HeadContent />
      </head>
      <body className="overflow-hidden bg-sky-deep text-cloud">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Glide through white clouds on a bright sunny day. Click and pull the craft, or drag with a finger. Climb all the way to space.",
      },
      { name: "theme-color", content: "#6EB5E0" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: classroomDoor ? "./favicon.svg" : "/favicon.svg",
      },
      { rel: "stylesheet", href: appCss },
      {
        rel: "manifest",
        href: classroomDoor ? "./__grok/manifest.webmanifest" : "/__grok/manifest.webmanifest",
      },
      {
        rel: "apple-touch-icon",
        href: classroomDoor ? "./__grok/icon-180.png" : "/__grok/icon-180.png",
      },
      ...(classroomDoor
        ? [{ rel: "stylesheet", href: "/fonts/room.css?v=2026-10-04-i18n" }]
        : [
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            {
              rel: "preconnect",
              href: "https://fonts.gstatic.com",
              crossOrigin: "anonymous" as const,
            },
            {
              rel: "stylesheet",
              href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Outfit:wght@400;500;600&display=swap",
            },
          ]),
    ],
  }),
  component: RootDocument,
});
