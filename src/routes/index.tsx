import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <DriftExperience />;
}
