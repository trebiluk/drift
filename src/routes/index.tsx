import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";
import { bootLang } from "@/components/drift/LangRoot";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { lang?: string; theme?: string; hub?: string } = {};
    if (typeof search.lang === "string" && search.lang) out.lang = search.lang;
    if (typeof search.theme === "string" && search.theme) out.theme = search.theme;
    if (typeof search.hub === "string" && search.hub) out.hub = search.hub;
    return out;
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  const boot = bootLang(search);
  return <DriftExperience boot={boot.lang} classic={boot.classic} />;
}
