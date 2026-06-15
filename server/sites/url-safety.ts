import { lookup as lookupDns } from "node:dns/promises";
import { isIP } from "node:net";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type DnsResolver = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export interface ValidatedPublicUrl {
  normalizedUrl: string;
  hostname: string;
  addresses: string[];
}

export class SiteUrlError extends Error {
  constructor(
    public readonly code:
      | "SITE_URL_INVALID"
      | "SITE_URL_BLOCKED"
      | "SITE_URL_UNRESOLVED",
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "SiteUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".intranet",
  ".test",
  ".invalid",
  ".onion",
];

const BLOCKED_METADATA_IPV4 = new Set([
  "168.63.129.16",
  "169.254.169.254",
  "100.100.100.200",
]);

const defaultResolver: DnsResolver = async (hostname) => {
  const results = await lookupDns(hostname, {
    all: true,
    verbatim: true,
  });

  return results.map((result) => ({
    address: result.address,
    family: result.family as 4 | 6,
  }));
};

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const values = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return Number.NaN;
    }

    const value = Number(part);
    return value >= 0 && value <= 255 ? value : Number.NaN;
  });

  return values.every(Number.isFinite) ? values : null;
}

function isPublicIpv4(address: string): boolean {
  const parts = parseIpv4(address);

  if (!parts) {
    return false;
  }

  const [a, b, c] = parts;

  if (BLOCKED_METADATA_IPV4.has(address)) {
    return false;
  }

  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  ) {
    return false;
  }

  if (
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  ) {
    return false;
  }

  return true;
}

function parseIpv6(address: string): number[] | null {
  let value = address.toLowerCase().split("%", 1)[0];

  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = parseIpv4(value.slice(lastColon + 1));

    if (lastColon < 0 || !ipv4) {
      return null;
    }

    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    value = `${value.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = value.split("::");

  if (halves.length > 2) {
    return null;
  }

  const left = halves[0]
    ? halves[0].split(":").filter(Boolean)
    : [];
  const right =
    halves.length === 2 && halves[1]
      ? halves[1].split(":").filter(Boolean)
      : [];

  if (halves.length === 1 && left.length !== 8) {
    return null;
  }

  const missing = 8 - left.length - right.length;

  if (missing < 0 || (halves.length === 2 && missing < 1)) {
    return null;
  }

  const groups = [
    ...left,
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"),
    ...right,
  ];

  if (groups.length !== 8) {
    return null;
  }

  const parsed = groups.map((group) => {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      return Number.NaN;
    }

    return Number.parseInt(group, 16);
  });

  return parsed.every(Number.isFinite) ? parsed : null;
}

function ipv4FromIpv6Groups(groups: number[], start: number): string {
  return [
    groups[start] >> 8,
    groups[start] & 0xff,
    groups[start + 1] >> 8,
    groups[start + 1] & 0xff,
  ].join(".");
}

function isPublicIpv6(address: string): boolean {
  const groups = parseIpv6(address);

  if (!groups) {
    return false;
  }

  const allZero = groups.every((group) => group === 0);

  if (allZero) {
    return false;
  }

  const isIpv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff;
  const isIpv4Compatible =
    groups.slice(0, 6).every((group) => group === 0);

  if (isIpv4Mapped || isIpv4Compatible) {
    return isPublicIpv4(ipv4FromIpv6Groups(groups, 6));
  }

  const first = groups[0];

  if (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00
  ) {
    return false;
  }

  if (
    (groups[0] === 0x2001 && groups[1] === 0x0db8) ||
    (groups[0] === 0x2001 && groups[1] <= 0x01ff)
  ) {
    return false;
  }

  if (groups[0] === 0x2002) {
    return isPublicIpv4(ipv4FromIpv6Groups(groups, 1));
  }

  return (first & 0xe000) === 0x2000;
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);

  if (family === 4) {
    return isPublicIpv4(normalized);
  }

  if (family === 6) {
    return isPublicIpv6(normalized);
  }

  return false;
}

function assertHostnameAllowed(hostname: string): void {
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SiteUrlError(
      "SITE_URL_BLOCKED",
      "내부망이나 로컬 주소는 검사할 수 없습니다.",
    );
  }

  if (!isIP(hostname) && !hostname.includes(".")) {
    throw new SiteUrlError(
      "SITE_URL_BLOCKED",
      "공개 인터넷 도메인만 등록할 수 있습니다.",
    );
  }
}

export function normalizeSiteUrl(input: string): URL {
  const trimmed = input.trim();

  if (!trimmed || trimmed.length > 2_048) {
    throw new SiteUrlError(
      "SITE_URL_INVALID",
      "올바른 사이트 주소를 입력해 주세요.",
    );
  }

  const schemeMatch = trimmed.match(/^([a-z][a-z\d+.-]*):/i);
  const hasExplicitScheme = Boolean(
    schemeMatch && !schemeMatch[1].includes("."),
  );
  const candidate = hasExplicitScheme
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new SiteUrlError(
      "SITE_URL_INVALID",
      "올바른 사이트 주소를 입력해 주세요.",
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SiteUrlError(
      "SITE_URL_BLOCKED",
      "공개 HTTP 또는 HTTPS 주소만 등록할 수 있습니다.",
    );
  }

  if (url.username || url.password) {
    throw new SiteUrlError(
      "SITE_URL_BLOCKED",
      "사용자 정보가 포함된 주소는 등록할 수 없습니다.",
    );
  }

  const hostname = normalizeHostname(url.hostname);

  if (!hostname) {
    throw new SiteUrlError(
      "SITE_URL_INVALID",
      "사이트 도메인을 확인해 주세요.",
    );
  }

  assertHostnameAllowed(hostname);
  url.hostname = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  url.hash = "";

  return url;
}

export async function validatePublicSiteUrl(
  input: string,
  resolver: DnsResolver = defaultResolver,
): Promise<ValidatedPublicUrl> {
  const url = normalizeSiteUrl(input);
  const hostname = normalizeHostname(url.hostname);
  const ipFamily = isIP(hostname);

  if (ipFamily) {
    if (!isPublicIpAddress(hostname)) {
      throw new SiteUrlError(
        "SITE_URL_BLOCKED",
        "사설 IP나 내부 주소는 검사할 수 없습니다.",
      );
    }

    return {
      normalizedUrl: url.toString(),
      hostname,
      addresses: [hostname],
    };
  }

  let resolved: readonly ResolvedAddress[];

  try {
    resolved = await resolver(hostname);
  } catch {
    throw new SiteUrlError(
      "SITE_URL_UNRESOLVED",
      "도메인의 공개 IP 주소를 확인할 수 없습니다.",
    );
  }

  if (resolved.length === 0) {
    throw new SiteUrlError(
      "SITE_URL_UNRESOLVED",
      "도메인의 공개 IP 주소를 확인할 수 없습니다.",
    );
  }

  const addresses = [...new Set(resolved.map((item) => item.address))];

  if (addresses.some((address) => !isPublicIpAddress(address))) {
    throw new SiteUrlError(
      "SITE_URL_BLOCKED",
      "도메인이 내부망 또는 사설 IP로 연결되어 등록할 수 없습니다.",
    );
  }

  return {
    normalizedUrl: url.toString(),
    hostname,
    addresses,
  };
}

export async function validateRedirectTarget(
  targetUrl: string,
  resolver: DnsResolver = defaultResolver,
): Promise<ValidatedPublicUrl> {
  return validatePublicSiteUrl(targetUrl, resolver);
}
