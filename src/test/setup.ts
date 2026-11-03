import "@testing-library/jest-dom/vitest";

// Server-side tests (e.g. the DigitalOcean function) run in the plain node environment.
if (typeof window !== "undefined") {
  // Join plays a ~2.3 s success moment before /welcome, so async queries wait up to 4 s.
  const { configure } = await import("@testing-library/react");
  configure({ asyncUtilTimeout: 7000 });

  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: () => {},
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
