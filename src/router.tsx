import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    // Keep /drift/ so ./assets resolves. "never" rewrote classic links to /drift?… and 404ed.
    trailingSlash: "always",
  });
}
