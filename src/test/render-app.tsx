import type { ComponentType } from "react";
import { render } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Route as IndexRoute } from "@/routes/index";
import { Route as WelcomeRoute } from "@/routes/welcome";
import { Route as PrivacyRoute } from "@/routes/privacy-policy";
import { Route as AdminRoute } from "@/routes/admin";

// Renders the real page components inside a lightweight router (no HTML shell or
// stylesheets, which jsdom can't load) so tests can follow real navigations.
export function renderApp(path = "/") {
  const root = createRootRoute({ component: Outlet });
  const page = (p: string, component: unknown) =>
    createRoute({ getParentRoute: () => root, path: p, component: component as ComponentType });
  const router = createRouter({
    routeTree: root.addChildren([
      page("/", IndexRoute.options.component),
      page("/welcome", WelcomeRoute.options.component),
      page("/privacy-policy", PrivacyRoute.options.component),
      page("/admin", AdminRoute.options.component),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router as never} />);
  return router;
}
