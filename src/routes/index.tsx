import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";
import { bootLang } from "@/components/drift/LangRoot";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: typeof search.lang === "string" ? search.lang : "",
    theme: typeof search.theme === "string" ? search.theme : "",
    hub: typeof search.hub === "string" ? search.hub : "",
  }),
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  const boot = bootLang(search);
  return <DriftExperience boot={boot.lang} classic={boot.classic} />;
}
