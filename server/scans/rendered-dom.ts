import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import {
  SiteUrlError,
  validateRedirectTarget,
  type ValidatedPublicUrl,
} from "../sites/url-safety";
import {
  analyzeHtml,
  type HtmlAnalysis,
} from "./html-analyzer";

export type RenderedDomResult =
  | {
      status: "SUCCESS";
      browserVersion: string;
      durationMs: number;
      statusCode: number | null;
      finalUrl: string;
      allowedRequests: number;
      blockedRequests: number;
      pageErrorCount: number;
      pageErrorNames: string[];
      analysis: HtmlAnalysis;
    }
  | {
      status: "FAILED";
      errorCode:
        | "RENDERED_DOM_BROWSER_UNAVAILABLE"
        | "RENDERED_DOM_URL_BLOCKED"
        | "RENDERED_DOM_TIMEOUT"
        | "RENDERED_DOM_TOO_LARGE"
        | "RENDERED_DOM_FAILED";
      message: string;
    }
  | {
      status: "NOT_RUN";
      reason: string;
    };

export interface RenderedDomCollector {
  collect(url: string): Promise<RenderedDomResult>;
}

type UrlValidator = (
  url: string,
) => Promise<ValidatedPublicUrl>;

export interface CreatePlaywrightRenderedDomCollectorOptions {
  executablePath?: string;
  navigationTimeoutMs?: number;
  settleMs?: number;
  maxRequests?: number;
  maxHtmlBytes?: number;
  validateUrl?: UrlValidator;
}

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_SETTLE_MS = 3_000;
const DEFAULT_MAX_REQUESTS = 300;
const DEFAULT_MAX_HTML_BYTES = 5_000_000;
const BLOCKED_RESOURCE_TYPES = new Set([
  "image",
  "media",
  "font",
  "websocket",
  "eventsource",
]);

function executableCandidates(
  configured?: string,
): string[] {
  if (configured) {
    return [configured];
  }

  if (process.env.CHROMIUM_PATH) {
    return [process.env.CHROMIUM_PATH];
  }

  const candidates: string[] = [];

  for (const command of [
    "chromium",
    "chromium-browser",
    "google-chrome-stable",
    "google-chrome",
  ]) {
    const resolved = spawnSync("which", [command], {
      encoding: "utf8",
    }).stdout.trim();

    if (resolved) {
      candidates.push(resolved);
    }
  }

  return [...new Set(candidates)];
}

function findExecutable(configured?: string): string | null {
  return (
    executableCandidates(configured).find((candidate) =>
      existsSync(candidate),
    ) ?? null
  );
}

function failure(
  errorCode: Extract<
    RenderedDomResult,
    { status: "FAILED" }
  >["errorCode"],
  message: string,
): RenderedDomResult {
  return {
    status: "FAILED",
    errorCode,
    message,
  };
}

function errorName(error: unknown): string {
  return error instanceof Error
    ? error.name.slice(0, 100)
    : "UnknownError";
}

export function createPlaywrightRenderedDomCollector(
  options: CreatePlaywrightRenderedDomCollectorOptions = {},
): RenderedDomCollector {
  const navigationTimeoutMs =
    options.navigationTimeoutMs ??
    DEFAULT_NAVIGATION_TIMEOUT_MS;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const maxRequests =
    options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const maxHtmlBytes =
    options.maxHtmlBytes ?? DEFAULT_MAX_HTML_BYTES;
  const validateUrl =
    options.validateUrl ?? validateRedirectTarget;

  return {
    async collect(url): Promise<RenderedDomResult> {
      try {
        await validateUrl(url);
      } catch (error) {
        return failure(
          "RENDERED_DOM_URL_BLOCKED",
          error instanceof SiteUrlError
            ? "렌더링 대상 URL이 공개 인터넷 주소가 아닙니다."
            : "렌더링 대상 URL을 안전하게 확인하지 못했습니다.",
        );
      }

      const executablePath = findExecutable(
        options.executablePath,
      );

      if (!executablePath) {
        return failure(
          "RENDERED_DOM_BROWSER_UNAVAILABLE",
          "JavaScript 렌더링용 Chromium을 찾지 못했습니다.",
        );
      }

      const startedAt = Date.now();
      let browser:
        | Awaited<ReturnType<typeof chromium.launch>>
        | undefined;

      try {
        browser = await chromium.launch({
          executablePath,
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        });

        const context = await browser.newContext({
          viewport: {
            width: 1_365,
            height: 768,
          },
          locale: "ko-KR",
          serviceWorkers: "block",
        });

        const validationCache = new Map<
          string,
          Promise<ValidatedPublicUrl>
        >();
        let allowedRequests = 0;
        let blockedRequests = 0;

        await context.route("**/*", async (route) => {
          const request = route.request();
          const requestUrl = request.url();
          let parsed: URL;

          try {
            parsed = new URL(requestUrl);
          } catch {
            blockedRequests += 1;
            await route.abort("blockedbyclient");
            return;
          }

          if (
            ["data:", "blob:", "about:"].includes(
              parsed.protocol,
            )
          ) {
            allowedRequests += 1;
            await route.continue();
            return;
          }

          if (
            !["http:", "https:"].includes(parsed.protocol) ||
            !["GET", "HEAD"].includes(request.method()) ||
            BLOCKED_RESOURCE_TYPES.has(request.resourceType()) ||
            allowedRequests + blockedRequests >= maxRequests
          ) {
            blockedRequests += 1;
            await route.abort("blockedbyclient");
            return;
          }

          const cacheKey = parsed.origin;
          let validation = validationCache.get(cacheKey);

          if (!validation) {
            validation = validateUrl(requestUrl);
            validationCache.set(cacheKey, validation);
          }

          try {
            await validation;
            allowedRequests += 1;
            await route.continue();
          } catch {
            blockedRequests += 1;
            await route.abort("blockedbyclient");
          }
        });

        await context.addInitScript(() => {
          const deny = () => {
            throw new Error("비필수 실시간 연결이 차단되었습니다.");
          };

          try {
            Object.defineProperty(window, "WebSocket", {
              configurable: false,
              value: class {
                constructor() {
                  deny();
                }
              },
            });
          } catch {
            // 브라우저가 재정의를 허용하지 않으면 요청 라우팅으로 차단한다.
          }

          try {
            Object.defineProperty(window, "EventSource", {
              configurable: false,
              value: class {
                constructor() {
                  deny();
                }
              },
            });
          } catch {
            // 브라우저가 재정의를 허용하지 않으면 요청 라우팅으로 차단한다.
          }
        });

        const page = await context.newPage();
        page.setDefaultTimeout(navigationTimeoutMs);

        const pageErrorNames: string[] = [];
        page.on("pageerror", (error) => {
          if (pageErrorNames.length < 10) {
            pageErrorNames.push(errorName(error));
          }
        });

        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeoutMs,
        });

        if (settleMs > 0) {
          await page.waitForTimeout(settleMs);
        }

        const finalUrl = page.url();
        await validateUrl(finalUrl);

        const html = await page.content();
        const body = Buffer.from(html, "utf8");

        if (body.length > maxHtmlBytes) {
          await context.close();
          return failure(
            "RENDERED_DOM_TOO_LARGE",
            "렌더링된 DOM이 허용 크기를 초과했습니다.",
          );
        }

        const analysis = analyzeHtml(body, finalUrl);
        const browserVersion = await browser.version();

        await context.close();

        return {
          status: "SUCCESS",
          browserVersion,
          durationMs: Date.now() - startedAt,
          statusCode: response?.status() ?? null,
          finalUrl,
          allowedRequests,
          blockedRequests,
          pageErrorCount: pageErrorNames.length,
          pageErrorNames,
          analysis,
        };
      } catch (error) {
        const name = errorName(error);
        const timedOut =
          name === "TimeoutError" ||
          (error instanceof Error &&
            /timeout/i.test(error.message));

        return failure(
          timedOut
            ? "RENDERED_DOM_TIMEOUT"
            : "RENDERED_DOM_FAILED",
          timedOut
            ? "JavaScript 렌더링 제한 시간을 초과했습니다."
            : `JavaScript 렌더링을 완료하지 못했습니다. (${name})`,
        );
      } finally {
        await browser?.close().catch(() => undefined);
      }
    },
  };
}
