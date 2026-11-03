import { describe, expect, it } from "vitest";
import { describeDevice } from "@/lib/device";

const UA = {
  androidReduced:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidOld:
    "Mozilla/5.0 (Linux; Android 11; RMX2001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 321.0.0.13.112 (iPhone14,5; iOS 17_4; en_IN; en-IN; scale=3.00; 1170x2532; 574283445)",
  iphoneFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.33.116;FBBV/123;FBDV/iPhone12,1;FBMD/iPhone;FBSN/iOS;FBSV/16.6]",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  windowsFirefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  chromebook:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linuxOpera:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
};

describe("describeDevice", () => {
  it("uses the exact Android model and version from Chrome's client hints", () => {
    expect(
      describeDevice({
        userAgent: UA.androidReduced,
        model: "SM-A525F",
        platformVersion: "14.0.0",
      }),
    ).toBe("SM-A525F (Android 14, Chrome)");
  });

  it("doesn't trust Chrome's frozen 'Android 10; K' when hints are missing", () => {
    expect(describeDevice({ userAgent: UA.androidReduced })).toBe("Android phone (Chrome)");
  });

  it("reads the model from older Android user agents", () => {
    expect(describeDevice({ userAgent: UA.androidOld })).toBe("RMX2001 (Android 11, Chrome)");
  });

  it("recognises Android tablets", () => {
    expect(describeDevice({ userAgent: UA.androidTablet })).toBe("SM-X200 (Android 13, Chrome)");
  });

  it("recognises Samsung Internet", () => {
    expect(describeDevice({ userAgent: UA.samsungInternet, model: "SM-S911B" })).toBe(
      "SM-S911B (Android, Samsung Internet)",
    );
  });

  it("describes an iPhone on Safari", () => {
    expect(describeDevice({ userAgent: UA.iphoneSafari })).toBe("iPhone (iOS 17.4, Safari)");
  });

  it("picks up the iPhone hardware model and the Instagram in-app browser", () => {
    expect(describeDevice({ userAgent: UA.iphoneInstagram })).toBe(
      "iPhone14,5 (iOS 17.4, Instagram app)",
    );
  });

  it("picks up the Facebook in-app browser", () => {
    expect(describeDevice({ userAgent: UA.iphoneFacebook })).toBe(
      "iPhone12,1 (iOS 16.6, Facebook app)",
    );
  });

  it("recognises Chrome on iPhone", () => {
    expect(describeDevice({ userAgent: UA.iphoneChrome })).toBe("iPhone (iOS 17.4, Chrome)");
  });

  it("tells an iPad (which reports itself as a Mac) from a real Mac by touch support", () => {
    expect(describeDevice({ userAgent: UA.macSafari, maxTouchPoints: 5 })).toBe(
      "iPad (iPadOS, Safari)",
    );
    expect(describeDevice({ userAgent: UA.macSafari, maxTouchPoints: 0 })).toBe(
      "Mac (macOS, Safari)",
    );
  });

  it("describes Windows PCs, using hints to tell Windows 11 from 10", () => {
    expect(describeDevice({ userAgent: UA.windowsEdge, platformVersion: "15.0.0" })).toBe(
      "Windows PC (Windows 11, Edge)",
    );
    expect(describeDevice({ userAgent: UA.windowsEdge, platformVersion: "10.0.0" })).toBe(
      "Windows PC (Windows 10, Edge)",
    );
    expect(describeDevice({ userAgent: UA.windowsFirefox })).toBe("Windows PC (Windows, Firefox)");
  });

  it("describes Chromebooks and Linux PCs", () => {
    expect(describeDevice({ userAgent: UA.chromebook })).toBe("Chromebook (ChromeOS, Chrome)");
    expect(describeDevice({ userAgent: UA.linuxOpera })).toBe("Linux PC (Linux, Opera)");
  });

  it("falls back to 'Unknown device' for empty or odd user agents", () => {
    expect(describeDevice({ userAgent: "" })).toBe("Unknown device");
    expect(describeDevice({ userAgent: "curl/8.4.0" })).toBe("Unknown device");
  });
});
