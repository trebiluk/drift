import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";
import { bootLang } from "@/components/drift/LangRoot";

/** Portal hosts the game at /drift/ — same experience as `/`. */
export const Route = createFileRoute("/drift")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { lang?: string; theme?: string; hub?: string } = {};
    if (typeof search.lang === "string" && search.lang) out.lang = search.lang;
    if (typeof search.theme === "string" && search.theme) out.theme = search.theme;
    if (typeof search.hub === "string" && search.hub) out.hub = search.hub;
    return out;
  },
  component: DriftDoor,
});

function DriftDoor() {
  const search = Route.useSearch();
  const boot = bootLang(search);
  return <DriftExperience boot={boot.lang} classic={boot.classic} />;
}
