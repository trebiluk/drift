import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";
import { bootLang } from "@/components/drift/LangRoot";

/** Portal hosts the game at /drift/ — same experience as `/`. */
export const Route = createFileRoute("/drift")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: typeof search.lang === "string" ? search.lang : "",
    theme: typeof search.theme === "string" ? search.theme : "",
    hub: typeof search.hub === "string" ? search.hub : "",
  }),
  component: DriftDoor,
});

function DriftDoor() {
  const search = Route.useSearch();
  const boot = bootLang(search);
  return <DriftExperience boot={boot.lang} classic={boot.classic} />;
}
