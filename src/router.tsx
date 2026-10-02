import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

/** Classroom snapshot is served at /drift/ with relative asset URLs. */
const classroomDoor = import.meta.env.BASE_URL === "./";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Keep /drift/ so ./assets resolves. "never" rewrote classic links to /drift?… and 404ed.
    trailingSlash: "always",
    ...(classroomDoor ? { basepath: "/drift" } : {}),
  });
}
