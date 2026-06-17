import { describe, expect, it } from "vitest";
import {
  scanExecutionUrl,
  shouldUpdateSiteFinalUrl,
} from "./scan-worker";

describe("scan worker target URL", () => {
  it("검사별 대상 URL이 있으면 사이트 기본 URL보다 우선한다", () => {
    expect(
      scanExecutionUrl({
        targetUrl: "https://deploy.example.com/release",
        site: {
          baseUrl: "https://example.com/",
        },
      }),
    ).toBe("https://deploy.example.com/release");
  });

  it("검사별 대상 URL이 없으면 사이트 기본 URL을 사용한다", () => {
    expect(
      scanExecutionUrl({
        targetUrl: null,
        site: {
          baseUrl: "https://example.com/",
        },
      }),
    ).toBe("https://example.com/");
  });

  it("검수 검사는 사이트의 최종 URL을 변경하지 않는다", () => {
    expect(shouldUpdateSiteFinalUrl("VERIFICATION")).toBe(false);
  });

  it.each(["QUICK", "DEEP", "MONITORING"] as const)(
    "%s 검사는 사이트의 최종 URL을 갱신할 수 있다",
    (type) => {
      expect(shouldUpdateSiteFinalUrl(type)).toBe(true);
    },
  );
});
