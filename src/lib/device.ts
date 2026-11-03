// Readable device name, e.g. "SM-A525F (Android 14, Chrome)" or "iPhone (iOS 17.4, Safari)".
// Uses only what the browser already exposes (user agent + Chrome's client hints):
// no permission prompt and no third-party service.

export type DeviceSignals = {
  userAgent: string;
  maxTouchPoints?: number;
  model?: string; // Chrome client hint (Android only)
  platformVersion?: string; // Chrome client hint
};

const major = (v?: string) => v?.split(".")[0] ?? "";

function browserOf(ua: string) {
  if (/Instagram/.test(ua)) return "Instagram app";
  if (/FBAN|FBAV/.test(ua)) return "Facebook app";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\/|FxiOS/.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS/.test(ua)) return "Chrome";
  if (/Version\/[\d.]+.*Safari/.test(ua)) return "Safari";
  return "";
}

export function describeDevice({
  userAgent: ua,
  maxTouchPoints = 0,
  model,
  platformVersion,
}: DeviceSignals): string {
  const browser = browserOf(ua);
  let device = "";
  let os = "";

  if (/iPhone|iPad|iPod/.test(ua)) {
    const kind = ua.match(/iPhone|iPad|iPod/)?.[0] ?? "iPhone";
    // In-app browsers (Instagram, Facebook) include the hardware ID, e.g. "iPhone14,5".
    device = ua.match(/\b(iPhone|iPad)\d+,\d+/)?.[0] ?? kind;
    const v = ua.match(/OS (\d+)_(\d+)/);
    os = `${kind === "iPad" ? "iPadOS" : "iOS"}${v ? ` ${v[1]}.${v[2]}` : ""}`;
  } else if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+);\s*([^;)]+)/);
    // Chrome freezes the UA to "Android 10; K": only the client hints are real then.
    const frozen = !m || m[2]?.trim() === "K";
    const uaModel = frozen ? "" : (m?.[2]?.trim() ?? "");
    const version = platformVersion ? major(platformVersion) : frozen ? "" : major(m?.[1]);
    const tablet = !/Mobile/.test(ua);
    device = model?.trim() || uaModel || (tablet ? "Android tablet" : "Android phone");
    os = version ? `Android ${version}` : model || uaModel ? "Android" : "";
  } else if (/Macintosh/.test(ua)) {
    // iPads ask for the desktop site and report as a Mac; touch support gives them away.
    const ipad = maxTouchPoints > 1;
    device = ipad ? "iPad" : "Mac";
    os = ipad ? "iPadOS" : "macOS";
  } else if (/Windows/.test(ua)) {
    device = "Windows PC";
    const v = Number(major(platformVersion));
    os = platformVersion ? (v >= 13 ? "Windows 11" : "Windows 10") : "Windows";
  } else if (/CrOS/.test(ua)) {
    device = "Chromebook";
    os = "ChromeOS";
  } else if (/Linux/.test(ua)) {
    device = "Linux PC";
    os = "Linux";
  }

  if (!device) return "Unknown device";
  const details = [os, browser].filter(Boolean).join(", ");
  return details ? `${device} (${details})` : device;
}

type UAData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }>;
};

let cached: Promise<string> | null = null;

/** Starts reading the device name (Chrome's model hint is async); safe to call repeatedly. */
export function loadDeviceName(): Promise<string> {
  cached ??= (async () => {
    const nav = navigator as Navigator & { userAgentData?: UAData };
    let hints: { model?: string; platformVersion?: string } = {};
    try {
      hints = (await nav.userAgentData?.getHighEntropyValues?.(["model", "platformVersion"])) ?? {};
    } catch {
      // hints are a bonus; the user agent alone is enough
    }
    return describeDevice({
      userAgent: nav.userAgent,
      maxTouchPoints: nav.maxTouchPoints,
      ...(hints.model ? { model: hints.model } : {}),
      ...(hints.platformVersion ? { platformVersion: hints.platformVersion } : {}),
    });
  })();
  return cached;
}
