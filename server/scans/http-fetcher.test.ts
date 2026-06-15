import { once } from "node:events";
import { createServer } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  createSafeHttpFetcher,
  HttpFetchError,
  nodeHttpTransport,
  type HttpTransport,
} from "./http-fetcher";
import type { DnsResolver } from "../sites/url-safety";

function resolver(
  mapping: Record<string, string>,
): DnsResolver {
  return vi.fn(async (hostname) => {
    const address = mapping[hostname];

    if (!address) {
      return [];
    }

    return [
      {
        address,
        family: address.includes(":") ? 6 : 4,
      },
    ] as const;
  });
}

describe("safe HTTP fetcher", () => {
  it("검증된 IPv4 주소로 실제 소켓 연결을 고정한다", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("pinned connection ok");
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("테스트 서버 주소를 확인하지 못했습니다.");
      }

      const response = await nodeHttpTransport({
        url: new URL(`http://pinned.test:${address.port}/`),
        pinnedAddress: "127.0.0.1",
        family: 4,
        timeoutMs: 2_000,
        maxBodyBytes: 1_024,
        userAgent: "SiteAIScoreTest/1.0",
        accept: "text/plain",
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString("utf8")).toBe(
        "pinned connection ok",
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("검증된 공개 IP를 실제 연결 주소로 고정한다", async () => {
    const transport: HttpTransport = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
      body: Buffer.from("<html></html>"),
    });

    const fetcher = createSafeHttpFetcher({
      resolver: resolver({
        "example.com": "93.184.216.34",
      }),
      transport,
    });

    const response = await fetcher.fetch("example.com");

    expect(response.finalUrl).toBe("https://example.com/");
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        pinnedAddress: "93.184.216.34",
        family: 4,
      }),
    );
  });

  it("공개 리디렉션 대상의 DNS를 다시 검사한다", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockResolvedValueOnce({
        statusCode: 302,
        headers: {
          location: "https://www.example.org/final",
        },
        body: Buffer.alloc(0),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {
          "content-type": "text/html",
        },
        body: Buffer.from("<html></html>"),
      });

    const fetcher = createSafeHttpFetcher({
      resolver: resolver({
        "example.com": "93.184.216.34",
        "www.example.org": "93.184.216.35",
      }),
      transport,
    });

    const response = await fetcher.fetch(
      "https://example.com/start",
    );

    expect(response.finalUrl).toBe(
      "https://www.example.org/final",
    );
    expect(response.redirects).toEqual([
      "https://www.example.org/final",
    ]);
    expect(transport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pinnedAddress: "93.184.216.35",
      }),
    );
  });

  it("리디렉션 후 내부 IP는 두 번째 요청 전에 차단한다", async () => {
    const transport = vi
      .fn<HttpTransport>()
      .mockResolvedValueOnce({
        statusCode: 302,
        headers: {
          location: "http://169.254.169.254/latest/meta-data",
        },
        body: Buffer.alloc(0),
      });

    const fetcher = createSafeHttpFetcher({
      resolver: resolver({
        "example.com": "93.184.216.34",
      }),
      transport,
    });

    await expect(
      fetcher.fetch("https://example.com"),
    ).rejects.toMatchObject({
      code: "SITE_URL_BLOCKED",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("리디렉션 횟수 제한을 적용한다", async () => {
    const transport: HttpTransport = vi.fn(async ({ url }) => ({
      statusCode: 302,
      headers: {
        location: new URL(
          `/next-${Math.random()}`,
          url,
        ).toString(),
      },
      body: Buffer.alloc(0),
    }));

    const fetcher = createSafeHttpFetcher({
      resolver: resolver({
        "example.com": "93.184.216.34",
      }),
      transport,
      maxRedirects: 1,
    });

    await expect(
      fetcher.fetch("https://example.com"),
    ).rejects.toBeInstanceOf(HttpFetchError);
  });
});
