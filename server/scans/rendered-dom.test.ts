import { describe, expect, it, vi } from "vitest";
import { SiteUrlError } from "../sites/url-safety";
import { createPlaywrightRenderedDomCollector } from "./rendered-dom";

describe("playwright rendered DOM collector", () => {
  it("차단된 URL은 브라우저 실행 전에 거부한다", async () => {
    const validateUrl = vi.fn().mockRejectedValue(
      new SiteUrlError(
        "SITE_URL_BLOCKED",
        "차단된 주소",
      ),
    );
    const collector =
      createPlaywrightRenderedDomCollector({
        executablePath: "/missing/chromium",
        validateUrl,
      });

    const result = await collector.collect(
      "http://127.0.0.1/",
    );

    expect(result).toMatchObject({
      status: "FAILED",
      errorCode: "RENDERED_DOM_URL_BLOCKED",
    });
    expect(validateUrl).toHaveBeenCalledTimes(1);
  });

  it("Chromium이 없으면 비감점 실패 결과를 반환한다", async () => {
    const validateUrl = vi.fn().mockResolvedValue({
      normalizedUrl: "https://example.com/",
      hostname: "example.com",
      addresses: ["93.184.216.34"],
    });
    const collector =
      createPlaywrightRenderedDomCollector({
        executablePath: "/missing/chromium",
        validateUrl,
      });

    const result = await collector.collect(
      "https://example.com/",
    );

    expect(result).toEqual({
      status: "FAILED",
      errorCode: "RENDERED_DOM_BROWSER_UNAVAILABLE",
      message:
        "JavaScript 렌더링용 Chromium을 찾지 못했습니다.",
    });
  });
});
