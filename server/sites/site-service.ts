import { Prisma, type Scan, type ScanType, type Site } from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";
import { CURRENT_RULES_VERSION } from "../scans/scoring";
import {
  SiteUrlError,
  validatePublicSiteUrl,
  type DnsResolver,
} from "./url-safety";

export interface CreateSiteInput {
  name: string;
  baseUrl: string;
  siteType?: string;
  country: string;
  region?: string;
  primaryLocale: string;
}

export interface UpdateSiteInput {
  name?: string;
  baseUrl?: string;
  siteType?: string | null;
  country?: string;
  region?: string | null;
  primaryLocale?: string;
}

export interface PublicScan {
  id: string;
  siteId: string;
  type: "QUICK" | "DEEP" | "VERIFICATION" | "MONITORING";
  status:
    "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  rulesVersion: string;
  isOutdatedRulesVersion: boolean;
  locale: "ko" | "en";
  score: number | null;
  grade: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface PublicSite {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  baseUrl: string;
  finalUrl: string | null;
  siteType: string | null;
  country: string;
  region: string | null;
  primaryLocale: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  latestScan: PublicScan | null;
}

export interface SiteService {
  listSites(user: PublicUser): Promise<PublicSite[]>;
  createSite(user: PublicUser, input: CreateSiteInput): Promise<PublicSite>;
  getSite(user: PublicUser, siteId: string): Promise<PublicSite>;
  updateSite(
    user: PublicUser,
    siteId: string,
    input: UpdateSiteInput,
  ): Promise<PublicSite>;
  archiveSite(user: PublicUser, siteId: string): Promise<void>;
  listScans(user: PublicUser, siteId: string): Promise<PublicScan[]>;
  queueScan(
    user: PublicUser,
    siteId: string,
    type: ScanType,
    locale?: "ko" | "en",
  ): Promise<PublicScan>;
}

export class SiteServiceError extends Error {
  constructor(
    public readonly code:
      | "SITE_NOT_FOUND"
      | "SITE_DUPLICATE"
      | "SCAN_ALREADY_RUNNING"
      | "FREE_QUICK_SCAN_SITE_LIMIT_EXCEEDED",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "SiteServiceError";
  }
}

interface SiteWithSummary extends Site {
  organization: {
    name: string;
  };
  scans: Scan[];
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function toPublicScan(scan: Scan): PublicScan {
  return {
    id: scan.id,
    siteId: scan.siteId,
    type: scan.type,
    status: scan.status,
    rulesVersion: scan.rulesVersion,
    isOutdatedRulesVersion: scan.rulesVersion !== CURRENT_RULES_VERSION,
    locale: scan.locale === "en" ? "en" : "ko",
    score: scan.score,
    grade: scan.grade,
    startedAt: scan.startedAt?.toISOString() ?? null,
    completedAt: scan.completedAt?.toISOString() ?? null,
    errorCode: scan.errorCode,
    createdAt: scan.createdAt.toISOString(),
  };
}

function toPublicSite(site: SiteWithSummary): PublicSite {
  return {
    id: site.id,
    organizationId: site.organizationId,
    organizationName: site.organization.name,
    name: site.name,
    baseUrl: site.baseUrl,
    finalUrl: site.finalUrl,
    siteType: site.siteType,
    country: site.country,
    region: site.region,
    primaryLocale: site.primaryLocale,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    latestScan: site.scans[0] ? toPublicScan(site.scans[0]) : null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const FREE_QUICK_SCAN_SITE_LIMIT = 10;

async function assertFreeQuickScanSiteLimit(
  user: PublicUser,
  siteId: string,
  type: ScanType,
): Promise<void> {
  if (type !== "QUICK" || user.role === "SUPER_ADMIN") {
    return;
  }

  const prisma = getDatabase();

  const existingQuickScanForSite = await prisma.scan.findFirst({
    where: {
      createdBy: user.id,
      siteId,
      type: "QUICK",
    },
    select: { id: true },
  });

  if (existingQuickScanForSite) {
    return;
  }

  const usedSites = await prisma.scan.findMany({
    where: {
      createdBy: user.id,
      type: "QUICK",
    },
    distinct: ["siteId"],
    select: { siteId: true },
    take: FREE_QUICK_SCAN_SITE_LIMIT,
  });

  if (usedSites.length >= FREE_QUICK_SCAN_SITE_LIMIT) {
    throw new SiteServiceError(
      "FREE_QUICK_SCAN_SITE_LIMIT_EXCEEDED",
      `무료 간편진단은 계정당 최대 ${FREE_QUICK_SCAN_SITE_LIMIT}개 사이트까지 사용할 수 있습니다. 이미 진단한 사이트의 재진단은 계속 가능합니다.`,
      403,
    );
  }
}

async function findAccessibleSite(
  userId: string,
  siteId: string,
): Promise<SiteWithSummary> {
  const prisma = getDatabase();
  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      status: "ACTIVE",
      organization: {
        members: {
          some: { userId },
        },
      },
    },
    include: {
      organization: {
        select: { name: true },
      },
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!site) {
    throw new SiteServiceError(
      "SITE_NOT_FOUND",
      "사이트를 찾을 수 없습니다.",
      404,
    );
  }

  return site;
}

async function getOrCreateCustomerOrganization(
  user: PublicUser,
): Promise<{ id: string; name: string }> {
  const prisma = getDatabase();
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      organization: {
        type: "CUSTOMER",
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (membership) {
    return membership.organization;
  }

  return prisma.organization.create({
    data: {
      name: `${normalizeName(user.name)}의 사이트`,
      type: "CUSTOMER",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
}

function duplicateSiteError(): SiteServiceError {
  return new SiteServiceError(
    "SITE_DUPLICATE",
    "같은 사이트 주소가 이미 등록되어 있습니다.",
    409,
  );
}

export function createPrismaSiteService(resolver?: DnsResolver): SiteService {
  return {
    async listSites(user) {
      const prisma = getDatabase();
      const sites = await prisma.site.findMany({
        where: {
          status: "ACTIVE",
          organization: {
            members: {
              some: { userId: user.id },
            },
          },
        },
        include: {
          organization: {
            select: { name: true },
          },
          scans: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return sites.map(toPublicSite);
    },

    async createSite(user, input) {
      const prisma = getDatabase();
      const validated = await validatePublicSiteUrl(input.baseUrl, resolver);
      const organization = await getOrCreateCustomerOrganization(user);

      const existing = await prisma.site.findUnique({
        where: {
          organizationId_baseUrl: {
            organizationId: organization.id,
            baseUrl: validated.normalizedUrl,
          },
        },
      });

      if (existing?.status === "ACTIVE") {
        throw duplicateSiteError();
      }

      try {
        const site = existing
          ? await prisma.site.update({
              where: { id: existing.id },
              data: {
                name: normalizeName(input.name),
                finalUrl: null,
                siteType: normalizeOptionalText(input.siteType),
                country: input.country.trim().toUpperCase(),
                region: normalizeOptionalText(input.region),
                primaryLocale: input.primaryLocale.trim(),
                status: "ACTIVE",
              },
              include: {
                organization: {
                  select: { name: true },
                },
                scans: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            })
          : await prisma.site.create({
              data: {
                organizationId: organization.id,
                name: normalizeName(input.name),
                baseUrl: validated.normalizedUrl,
                finalUrl: null,
                siteType: normalizeOptionalText(input.siteType),
                country: input.country.trim().toUpperCase(),
                region: normalizeOptionalText(input.region),
                primaryLocale: input.primaryLocale.trim(),
              },
              include: {
                organization: {
                  select: { name: true },
                },
                scans: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            });

        return toPublicSite(site);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw duplicateSiteError();
        }

        throw error;
      }
    },

    async getSite(user, siteId) {
      return toPublicSite(await findAccessibleSite(user.id, siteId));
    },

    async updateSite(user, siteId, input) {
      const prisma = getDatabase();
      const current = await findAccessibleSite(user.id, siteId);
      const data: Prisma.SiteUpdateInput = {};

      if (input.name !== undefined) {
        data.name = normalizeName(input.name);
      }

      if (input.baseUrl !== undefined) {
        const validated = await validatePublicSiteUrl(input.baseUrl, resolver);
        data.baseUrl = validated.normalizedUrl;
        data.finalUrl = null;
      }

      if (input.siteType !== undefined) {
        data.siteType = normalizeOptionalText(input.siteType);
      }

      if (input.country !== undefined) {
        data.country = input.country.trim().toUpperCase();
      }

      if (input.region !== undefined) {
        data.region = normalizeOptionalText(input.region);
      }

      if (input.primaryLocale !== undefined) {
        data.primaryLocale = input.primaryLocale.trim();
      }

      try {
        const site = await prisma.site.update({
          where: { id: current.id },
          data,
          include: {
            organization: {
              select: { name: true },
            },
            scans: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        return toPublicSite(site);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw duplicateSiteError();
        }

        throw error;
      }
    },

    async archiveSite(user, siteId) {
      const prisma = getDatabase();
      const current = await findAccessibleSite(user.id, siteId);

      await prisma.site.update({
        where: { id: current.id },
        data: { status: "ARCHIVED" },
      });
    },

    async listScans(user, siteId) {
      const prisma = getDatabase();
      await findAccessibleSite(user.id, siteId);

      const scans = await prisma.scan.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return scans.map(toPublicScan);
    },

    async queueScan(user, siteId, type, locale = "ko") {
      const prisma = getDatabase();
      const site = await findAccessibleSite(user.id, siteId);

      const runningScan = await prisma.scan.findFirst({
        where: {
          siteId: site.id,
          status: {
            in: ["QUEUED", "RUNNING"],
          },
        },
        select: { id: true },
      });

      if (runningScan) {
        throw new SiteServiceError(
          "SCAN_ALREADY_RUNNING",
          "이미 대기 중이거나 실행 중인 검사가 있습니다.",
          409,
        );
      }

      await assertFreeQuickScanSiteLimit(user, site.id, type);
      await validatePublicSiteUrl(site.baseUrl, resolver);

      const scan = await prisma.scan.create({
        data: {
          siteId: site.id,
          type,
          locale,
          status: "QUEUED",
          rulesVersion: CURRENT_RULES_VERSION,
          createdBy: user.id,
        },
      });

      return toPublicScan(scan);
    },
  };
}

export { SiteUrlError };
