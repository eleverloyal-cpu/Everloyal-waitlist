// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// STATIC_EXPORT=1 (bun run package:deploy) pre-renders every page to plain HTML for a static
// host (DigitalOcean App Platform). Without it, the Lovable/Cloudflare build is unchanged.
const staticExport = process.env["STATIC_EXPORT"] === "1";
const PAGES = ["/", "/welcome", "/privacy-policy", "/admin"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(staticExport
      ? {
          prerender: {
            enabled: true,
            crawlLinks: false,
            autoStaticPathsDiscovery: false,
            failOnError: true,
          },
          pages: PAGES.map((path) => ({ path })),
        }
      : {}),
  },
});
