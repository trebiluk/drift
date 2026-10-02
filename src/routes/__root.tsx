import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { bootLang } from "@/components/drift/LangRoot";
import { dirOf } from "@/game/copy";
import appCss from "../styles.css?url";

const APP_NAME = "Drift";

/** Classroom snapshot is built with base `./` and served under /drift/. */
const classroomDoor = import.meta.env.BASE_URL === "./";

function RootDocument() {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const q = new URLSearchParams(searchStr);
  const boot = bootLang({
    lang: q.get("lang") || undefined,
    theme: q.get("theme") || undefined,
    hub: q.get("hub") || undefined,
  });
  const dir = dirOf(boot.lang);

  return (
    <html
      lang={boot.lang === "simple" ? "en" : boot.lang}
      dir={dir}
      data-kp-lang={boot.lang}
      suppressHydrationWarning
      className="antialiased"
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=window.innerWidth<720||/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(matchMedia("(pointer: coarse)").matches&&matchMedia("(hover: none)").matches);document.documentElement.dataset.input=t?"touch":"desk";}catch(e){}})();`,
          }}
        />
        {classroomDoor ? <script src="/shared/kw-who.js?v=2026-10-01-v2" /> : null}
        {classroomDoor ? <script src="/shared/kulibert-i18n.js?v=2026-10-04-i18n" /> : null}
        {classroomDoor ? <script src="/shared/kulibert-prefs.js?v=2026-10-04-i18n" /> : null}
        {classroomDoor ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var q=new URLSearchParams(location.search);var classic=q.get("theme")==="classic"||q.get("hub")==="classic";var ok={en:1,simple:1,uk:1,ru:1,es:1,ar:1,"fa-AF":1,rw:1,ti:1};var lang="en";if(!classic){var u=q.get("lang")||"";if(ok[u])lang=u;}var el=document.documentElement;el.lang=lang==="simple"?"en":lang;el.dir=(lang==="ar"||lang==="fa-AF")?"rtl":"ltr";el.setAttribute("data-kp-lang",lang);}catch(e){}})();`,
            }}
          />
        ) : null}
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
