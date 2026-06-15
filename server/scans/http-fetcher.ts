import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import {
  brotliDecompressSync,
  gunzipSync,
  inflateSync,
} from "node:zlib";
import {
  validatePublicSiteUrl,
  type DnsResolver,
} from "../sites/url-safety";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_USER_AGENT =
  "SiteAIScoreBot/0.1 (+https://siteaiscore.com/bot)";

export interface SafeHttpResponse {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string | string[]>;
  contentType: string | null;
  body: Buffer;
  redirects: string[];
}

export interface SafeFetchRequestOptions {
  userAgent?: string;
  accept?: string;
}

export interface SafeHttpFetcher {
  fetch(
    url: string,
    options?: SafeFetchRequestOptions,
  ): Promise<SafeHttpResponse>;
}

export interface TransportRequest {
  url: URL;
  pinnedAddress: string;
  family: 4 | 6;
  timeoutMs: number;
  maxBodyBytes: number;
  userAgent: string;
  accept: string;
}

export interface TransportResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
}

export type HttpTransport = (
  request: TransportRequest,
) => Promise<TransportResponse>;

export class HttpFetchError extends Error {
  constructor(
    public readonly code:
      | "HTTP_REQUEST_FAILED"
      | "HTTP_TIMEOUT"
      | "HTTP_BODY_TOO_LARGE"
      | "HTTP_REDIRECT_LIMIT"
      | "HTTP_REDIRECT_INVALID"
      | "HTTP_CONTENT_ENCODING_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "HttpFetchError";
  }
}

export interface CreateSafeHttpFetcherOptions {
  resolver?: DnsResolver;
  transport?: HttpTransport;
  timeoutMs?: number;
  maxBodyBytes?: number;
  maxRedirects?: number;
}

function normalizeHeaders(
  headers: http.IncomingHttpHeaders,
): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string" || Array.isArray(value)) {
      normalized[name.toLowerCase()] = value;
    }
  }

  return normalized;
}

function readHeader(
  headers: Record<string, string | string[]>,
  name: string,
): string | null {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ?? null;
}

function decodeBody(
  body: Buffer,
  contentEncoding: string | null,
  maxBodyBytes: number,
): Buffer {
  const encoding = contentEncoding
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();

  let decoded = body;

  try {
    if (!encoding || encoding === "identity") {
      decoded = body;
    } else if (encoding === "gzip" || encoding === "x-gzip") {
      decoded = gunzipSync(body);
    } else if (encoding === "deflate") {
      decoded = inflateSync(body);
    } else if (encoding === "br") {
      decoded = brotliDecompressSync(body);
    } else {
      throw new HttpFetchError(
        "HTTP_CONTENT_ENCODING_UNSUPPORTED",
        "지원하지 않는 응답 압축 형식입니다.",
      );
    }
  } catch (error) {
    if (error instanceof HttpFetchError) {
      throw error;
    }

    throw new HttpFetchError(
      "HTTP_REQUEST_FAILED",
      "응답 본문의 압축을 해제하지 못했습니다.",
    );
  }

  if (decoded.length > maxBodyBytes) {
    throw new HttpFetchError(
      "HTTP_BODY_TOO_LARGE",
      "응답 본문이 허용 크기를 초과했습니다.",
    );
  }

  return decoded;
}

export const nodeHttpTransport: HttpTransport = async ({
  url,
  pinnedAddress,
  family,
  timeoutMs,
  maxBodyBytes,
  userAgent,
  accept,
}) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const requestModule = url.protocol === "https:" ? https : http;
    const hostname = url.hostname
      .replace(/^\[/, "")
      .replace(/\]$/, "");

    const requestOptions: http.RequestOptions = {
      method: "GET",
      headers: {
        Accept: accept,
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "User-Agent": userAgent,
      },
      lookup: ((
        _hostname: string,
        lookupOptions: { all?: boolean } | number,
        callback: (
          error: NodeJS.ErrnoException | null,
          address:
            | string
            | Array<{ address: string; family: number }>,
          addressFamily?: number,
        ) => void,
      ) => {
        if (
          typeof lookupOptions === "object" &&
          lookupOptions !== null &&
          lookupOptions.all
        ) {
          callback(null, [{ address: pinnedAddress, family }]);
          return;
        }

        callback(null, pinnedAddress, family);
      }) as http.RequestOptions["lookup"],
    };

    if (url.protocol === "https:" && isIP(hostname) === 0) {
      (requestOptions as https.RequestOptions).servername = hostname;
    }

    const clientRequest = requestModule.request(
      url,
      requestOptions,
      (response) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let completed = false;

        const rejectOnce = (error: Error) => {
          if (completed) {
            return;
          }

          completed = true;
          reject(error);
        };

        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);
          totalBytes += buffer.length;

          if (totalBytes > maxBodyBytes) {
            response.destroy();
            rejectOnce(
              new HttpFetchError(
                "HTTP_BODY_TOO_LARGE",
                "응답 본문이 허용 크기를 초과했습니다.",
              ),
            );
            return;
          }

          chunks.push(buffer);
        });

        response.on("end", () => {
          if (completed) {
            return;
          }

          try {
            const headers = normalizeHeaders(response.headers);
            const decoded = decodeBody(
              Buffer.concat(chunks),
              readHeader(headers, "content-encoding"),
              maxBodyBytes,
            );

            completed = true;
            resolve({
              statusCode: response.statusCode ?? 0,
              headers,
              body: decoded,
            });
          } catch (error) {
            rejectOnce(
              error instanceof Error
                ? error
                : new Error(String(error)),
            );
          }
        });

        response.on("error", (error) => {
          rejectOnce(
            new HttpFetchError(
              "HTTP_REQUEST_FAILED",
              `HTTP 응답 처리 실패: ${error.message}`,
            ),
          );
        });
      },
    );

    clientRequest.setTimeout(timeoutMs, () => {
      clientRequest.destroy(
        new HttpFetchError(
          "HTTP_TIMEOUT",
          "사이트 응답 시간이 제한을 초과했습니다.",
        ),
      );
    });

    clientRequest.on("error", (error) => {
      if (error instanceof HttpFetchError) {
        reject(error);
        return;
      }

      reject(
        new HttpFetchError(
          "HTTP_REQUEST_FAILED",
          `사이트 요청 실패: ${error.message}`,
        ),
      );
    });

    clientRequest.end();
  });

function isRedirectStatus(statusCode: number): boolean {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

export function createSafeHttpFetcher(
  options: CreateSafeHttpFetcherOptions = {},
): SafeHttpFetcher {
  const resolver = options.resolver;
  const transport = options.transport ?? nodeHttpTransport;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBodyBytes =
    options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxRedirects =
    options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  return {
    async fetch(input, requestOptions = {}) {
      const requestedUrl = input;
      let currentUrl = input;
      const redirects: string[] = [];

      for (let redirectCount = 0; ; redirectCount += 1) {
        const validated = await validatePublicSiteUrl(
          currentUrl,
          resolver,
        );
        const pinnedAddress = validated.addresses[0];

        if (!pinnedAddress) {
          throw new HttpFetchError(
            "HTTP_REQUEST_FAILED",
            "검증된 공개 IP 주소가 없습니다.",
          );
        }

        const family = isIP(pinnedAddress);

        if (family !== 4 && family !== 6) {
          throw new HttpFetchError(
            "HTTP_REQUEST_FAILED",
            "검증된 IP 주소 형식이 올바르지 않습니다.",
          );
        }

        const normalizedUrl = new URL(validated.normalizedUrl);
        const response = await transport({
          url: normalizedUrl,
          pinnedAddress,
          family,
          timeoutMs,
          maxBodyBytes,
          userAgent:
            requestOptions.userAgent ?? DEFAULT_USER_AGENT,
          accept:
            requestOptions.accept ??
            "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        });

        const location = readHeader(response.headers, "location");

        if (
          isRedirectStatus(response.statusCode) &&
          location
        ) {
          if (redirectCount >= maxRedirects) {
            throw new HttpFetchError(
              "HTTP_REDIRECT_LIMIT",
              "리디렉션 횟수가 허용 범위를 초과했습니다.",
            );
          }

          let targetUrl: URL;

          try {
            targetUrl = new URL(location, normalizedUrl);
          } catch {
            throw new HttpFetchError(
              "HTTP_REDIRECT_INVALID",
              "리디렉션 주소가 올바르지 않습니다.",
            );
          }

          currentUrl = targetUrl.toString();
          redirects.push(currentUrl);
          continue;
        }

        return {
          requestedUrl,
          finalUrl: normalizedUrl.toString(),
          statusCode: response.statusCode,
          headers: response.headers,
          contentType: readHeader(
            response.headers,
            "content-type",
          ),
          body: response.body,
          redirects,
        };
      }
    },
  };
}

export function selectEvidenceHeaders(
  headers: Record<string, string | string[]>,
): Record<string, string | null> {
  const names = [
    "content-type",
    "content-length",
    "cache-control",
    "server",
    "x-robots-tag",
    "content-language",
  ];

  return Object.fromEntries(
    names.map((name) => [name, readHeader(headers, name)]),
  );
}
