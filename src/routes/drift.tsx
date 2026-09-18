import { createFileRoute } from "@tanstack/react-router";
import { DriftExperience } from "@/components/drift/DriftExperience";

/** Portal hosts the game at /drift/ — same experience as `/`. */
export const Route = createFileRoute("/drift")({
  component: DriftExperience,
});
