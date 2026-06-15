import { describe, expect, it, vi } from "vitest";
import {
  isPublicIpAddress,
  normalizeSiteUrl,
  SiteUrlError,
  validatePublicSiteUrl,
  validateRedirectTarget,
  type DnsResolver,
} from "./url-safety";

function resolverFor(...addresses: string[]): DnsResolver {
  return vi.fn().mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: (address.includes(":") ? 6 : 4) as 4 | 6,
    })),
  );
}

describe("site URL safety", () => {
  it("스킴이 없는 공개 도메인은 HTTPS 주소로 정규화한다", async () => {
    const result = await validatePublicSiteUrl(
      "Example.com/path#section",
      resolverFor("93.184.216.34"),
    );

    expect(result.normalizedUrl).toBe("https://example.com/path");
    expect(result.hostname).toBe("example.com");
    expect(result.addresses).toEqual(["93.184.216.34"]);
  });

  it("HTTP·HTTPS 외 프로토콜과 사용자 정보 포함 URL을 차단한다", () => {
    expect(() => normalizeSiteUrl("file:///etc/passwd")).toThrowError(
      SiteUrlError,
    );
    expect(() =>
      normalizeSiteUrl("https://user:password@example.com"),
    ).toThrowError(SiteUrlError);
  });

  it("localhost와 내부용 도메인을 차단한다", async () => {
    await expect(
      validatePublicSiteUrl("http://localhost:5000"),
    ).rejects.toMatchObject({ code: "SITE_URL_BLOCKED" });

    await expect(
      validatePublicSiteUrl(
        "https://service.internal",
        resolverFor("93.184.216.34"),
      ),
    ).rejects.toMatchObject({ code: "SITE_URL_BLOCKED" });
  });

  it("사설·loopback·link-local·메타데이터 IPv4를 차단한다", () => {
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("100.100.100.200")).toBe(false);
    expect(isPublicIpAddress("192.168.0.1")).toBe(false);
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
  });

  it("내부·문서용 IPv6를 차단하고 공개 IPv6를 허용한다", () => {
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("2001:db8::1")).toBe(false);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("DNS 결과 중 하나라도 내부 IP이면 등록을 차단한다", async () => {
    await expect(
      validatePublicSiteUrl(
        "https://example.com",
        resolverFor("93.184.216.34", "10.0.0.5"),
      ),
    ).rejects.toMatchObject({
      code: "SITE_URL_BLOCKED",
    });
  });

  it("DNS 조회에 실패하거나 결과가 없으면 안전한 오류를 반환한다", async () => {
    const failingResolver: DnsResolver = vi
      .fn()
      .mockRejectedValue(new Error("DNS failed"));

    await expect(
      validatePublicSiteUrl("https://example.com", failingResolver),
    ).rejects.toMatchObject({
      code: "SITE_URL_UNRESOLVED",
    });

    await expect(
      validatePublicSiteUrl("https://example.com", resolverFor()),
    ).rejects.toMatchObject({
      code: "SITE_URL_UNRESOLVED",
    });
  });

  it("리디렉션 대상도 동일한 SSRF 규칙으로 다시 검사한다", async () => {
    await expect(
      validateRedirectTarget(
        "http://169.254.169.254/latest/meta-data",
      ),
    ).rejects.toMatchObject({
      code: "SITE_URL_BLOCKED",
    });
  });
});
