import {
  Prisma,
  type PaidPlan,
  type Scan,
  type ScanType,
  type Site,
} from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";
import { CURRENT_RULES_VERSION } from "../scans/scoring";
import {
  SiteUrlError,
  validatePublicSiteUrl,
  type DnsResolver,
} from "./url-safety";
import { isDevUserPreviewPublicUser } from "../auth/dev-user-preview";

export interface CreateSiteInput {
  name: string;
  baseUrl: string;
  description?: string;
  siteType?: string;
  country: string;
  region?: string;
  primaryLocale: string;
}

export interface UpdateSiteInput {
  name?: string;
  baseUrl?: string;
  description?: string | null;
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
  linkedWorkOrderId: string | null;
  verificationWorkOrderId: string | null;
  locale: "ko" | "en";
  score: number | null;
  grade: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface PublicSiteDiagnosticProgress {
  diagnosticNumber: number;
  sourceWorkOrderVersion: number;
  source: "WORK_ORDER_INITIAL" | "WORK_ORDER_VERIFICATION";
  scanId: string;
  scanType: string;
  status: string;
  score: number | null;
  grade: string | null;
  rulesVersion: string;
  targetUrl: string | null;
  completedAt: string | null;
  createdAt: string;
  reportAvailable: boolean;
  verificationAttemptId: string | null;
  verificationStatus: string | null;
}

export interface PublicSiteWorkOrderProgress {
  id: string;
  orderNumber: string;
  version: number;
  status: string;
  rulesVersion: string;
  issuedAt: string | null;
  createdAt: string;
  itemCount: number;
  requiredItemCount: number;
  latestVerificationAttemptId: string | null;
  latestVerificationStatus: string | null;
}

export type PublicSiteProgressStageKind =
  | "REGISTERED"
  | "QUICK_SCAN"
  | "INITIAL_PAYMENT"
  | "DIAGNOSTIC"
  | "WORK_ORDER"
  | "EXTRA_PAYMENT"
  | "COMPLETED";

export type PublicSiteProgressNextAction =
  | "START_QUICK_SCAN"
  | "WAIT"
  | "PURCHASE_INITIAL"
  | "VIEW_WORK_ORDER"
  | "CREATE_NEXT_WORK_ORDER"
  | "PURCHASE_EXTRA"
  | "NONE";

export interface PublicSiteProgress {
  payment: {
    initialPaid: boolean;
    extraPaid: boolean;
  };
  diagnostics: PublicSiteDiagnosticProgress[];
  workOrders: PublicSiteWorkOrderProgress[];
  latestDiagnosticNumber: number | null;
  latestWorkOrderVersion: number | null;
  currentStage: {
    kind: PublicSiteProgressStageKind;
    number: number | null;
    status: string;
    nextAction: PublicSiteProgressNextAction;
  };
}

export interface PublicSite {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  baseUrl: string;
  finalUrl: string | null;
  siteType: string | null;
  description: string | null;
  country: string;
  region: string | null;
  primaryLocale: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  latestScan: PublicScan | null;
  progress?: PublicSiteProgress;
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
  scans: Array<Scan & { verificationAttempt?: { workOrderId: string } | null }>;
}

const siteProgressScanSelect = {
  id: true,
  type: true,
  status: true,
  rulesVersion: true,
  score: true,
  grade: true,
  targetUrl: true,
  completedAt: true,
  createdAt: true,
} satisfies Prisma.ScanSelect;

const siteProgressWorkOrderSelect = {
  id: true,
  orderNumber: true,
  version: true,
  status: true,
  rulesVersion: true,
  issuedAt: true,
  createdAt: true,
  initialScan: {
    select: siteProgressScanSelect,
  },
  items: {
    select: {
      isRequired: true,
    },
  },
  verificationAttempts: {
    orderBy: {
      attemptNumber: "asc",
    },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      scoreAfter: true,
      gradeAfter: true,
      completedAt: true,
      createdAt: true,
      scan: {
        select: siteProgressScanSelect,
      },
    },
  },
} satisfies Prisma.WorkOrderSelect;

type SiteProgressWorkOrderRecord = Prisma.WorkOrderGetPayload<{
  select: typeof siteProgressWorkOrderSelect;
}>;

export interface SiteProgressSource {
  latestScan: PublicScan | null;
  workOrders: readonly SiteProgressWorkOrderRecord[];
  paidPlans: readonly PaidPlan[];
  hasAdminAccess?: boolean;
  initialPaidOverride?: boolean;
  extraPaidOverride?: boolean;
}

function progressDiagnostic(
  diagnosticNumber: number,
  sourceWorkOrderVersion: number,
  source: PublicSiteDiagnosticProgress["source"],
  scan: SiteProgressWorkOrderRecord["initialScan"],
  verificationAttemptId: string | null,
  verificationStatus: string | null,
): PublicSiteDiagnosticProgress {
  return {
    diagnosticNumber,
    sourceWorkOrderVersion,
    source,
    scanId: scan.id,
    scanType: scan.type,
    status: scan.status,
    score: scan.score,
    grade: scan.grade,
    rulesVersion: scan.rulesVersion,
    targetUrl: scan.targetUrl,
    completedAt: scan.completedAt?.toISOString() ?? null,
    createdAt: scan.createdAt.toISOString(),
    reportAvailable:
      scan.score !== null &&
      scan.completedAt !== null &&
      ["COMPLETED", "PARTIAL"].includes(scan.status),
    verificationAttemptId,
    verificationStatus,
  };
}

export function buildSiteProgress(
  input: SiteProgressSource,
): PublicSiteProgress {
    const initialPaid =
      input.initialPaidOverride ??
      (Boolean(input.hasAdminAccess) ||
        input.paidPlans.some(
          (plan) => plan === "BASIC" || plan === "CASE_STUDY_DISCOUNT",
        ));
    const extraPaid =
      input.extraPaidOverride ??
      (Boolean(input.hasAdminAccess) ||
        input.paidPlans.includes("EXTRA_VERIFICATION"));
  const orderedWorkOrders = [...input.workOrders].sort(
    (left, right) =>
      left.version - right.version ||
      left.createdAt.getTime() - right.createdAt.getTime(),
  );
  const diagnosticsByNumber = new Map<number, PublicSiteDiagnosticProgress>();

  for (const workOrder of orderedWorkOrders) {
    diagnosticsByNumber.set(
      workOrder.version,
      progressDiagnostic(
        workOrder.version,
        workOrder.version,
        "WORK_ORDER_INITIAL",
        workOrder.initialScan,
        null,
        null,
      ),
    );

    for (const attempt of workOrder.verificationAttempts) {
      diagnosticsByNumber.set(
        workOrder.version + 1,
        progressDiagnostic(
          workOrder.version + 1,
          workOrder.version,
          "WORK_ORDER_VERIFICATION",
          attempt.scan,
          attempt.id,
          attempt.status,
        ),
      );
    }
  }

  const diagnostics = [...diagnosticsByNumber.values()].sort(
    (left, right) => left.diagnosticNumber - right.diagnosticNumber,
  );
  const workOrders: PublicSiteWorkOrderProgress[] = orderedWorkOrders.map(
    (workOrder) => {
      const latestAttempt =
        workOrder.verificationAttempts[
          workOrder.verificationAttempts.length - 1
        ] ?? null;

      return {
        id: workOrder.id,
        orderNumber: workOrder.orderNumber,
        version: workOrder.version,
        status: workOrder.status,
        rulesVersion: workOrder.rulesVersion,
        issuedAt: workOrder.issuedAt?.toISOString() ?? null,
        createdAt: workOrder.createdAt.toISOString(),
        itemCount: workOrder.items.length,
        requiredItemCount: workOrder.items.filter((item) => item.isRequired)
          .length,
        latestVerificationAttemptId: latestAttempt?.id ?? null,
        latestVerificationStatus: latestAttempt?.status ?? null,
      };
    },
  );

  let currentStage: PublicSiteProgress["currentStage"];

  if (!input.latestScan) {
    currentStage = {
      kind: "REGISTERED",
      number: null,
      status: "READY",
      nextAction: "START_QUICK_SCAN",
    };
  } else if (orderedWorkOrders.length === 0) {
    if (["QUEUED", "RUNNING"].includes(input.latestScan.status)) {
      currentStage = {
        kind: "QUICK_SCAN",
        number: null,
        status: input.latestScan.status,
        nextAction: "WAIT",
      };
    } else if (input.latestScan.status === "FAILED") {
      currentStage = {
        kind: "QUICK_SCAN",
        number: null,
        status: "FAILED",
        nextAction: "START_QUICK_SCAN",
      };
    } else if (!initialPaid) {
      currentStage = {
        kind: "INITIAL_PAYMENT",
        number: 1,
        status: "REQUIRED",
        nextAction: "PURCHASE_INITIAL",
      };
    } else {
      currentStage = {
        kind: "WORK_ORDER",
        number: 1,
        status: "PENDING",
        nextAction: "CREATE_NEXT_WORK_ORDER",
      };
    }
  } else {
    const latestWorkOrder = orderedWorkOrders[orderedWorkOrders.length - 1];
    const latestAttempt =
      latestWorkOrder.verificationAttempts[
        latestWorkOrder.verificationAttempts.length - 1
      ] ?? null;

    if (
      latestAttempt &&
      ["QUEUED", "RUNNING", "EVALUATING"].includes(latestAttempt.status)
    ) {
      currentStage = {
        kind: "DIAGNOSTIC",
        number: latestWorkOrder.version + 1,
        status: "RUNNING",
        nextAction: "WAIT",
      };
    } else if (latestAttempt?.status === "FAILED") {
      currentStage = {
        kind: "DIAGNOSTIC",
        number: latestWorkOrder.version + 1,
        status: "FAILED",
        nextAction: "VIEW_WORK_ORDER",
      };
    } else if (
      latestAttempt &&
      ["PASSED", "REWORK_REQUIRED"].includes(latestAttempt.status) &&
      latestAttempt.scan.score !== null &&
      latestAttempt.scan.completedAt !== null
    ) {
      const diagnosticNumber = latestWorkOrder.version + 1;

      if (latestAttempt.status === "PASSED") {
        currentStage = {
          kind: "COMPLETED",
          number: diagnosticNumber,
          status: "PASSED",
          nextAction: "NONE",
        };
      } else if (latestWorkOrder.version === 1) {
        currentStage = {
          kind: "WORK_ORDER",
          number: 2,
          status: "PENDING",
          nextAction: "CREATE_NEXT_WORK_ORDER",
        };
      } else if (latestWorkOrder.version === 2 && !extraPaid) {
        currentStage = {
          kind: "EXTRA_PAYMENT",
          number: 3,
          status: "REQUIRED",
          nextAction: "PURCHASE_EXTRA",
        };
      } else if (latestWorkOrder.version === 2) {
        currentStage = {
          kind: "WORK_ORDER",
          number: 3,
          status: "PENDING",
          nextAction: "CREATE_NEXT_WORK_ORDER",
        };
      } else {
        currentStage = {
          kind: "COMPLETED",
          number: diagnosticNumber,
          status: "REVIEW_REQUIRED",
          nextAction: "NONE",
        };
      }
    } else if (latestWorkOrder.version >= 3 && !extraPaid) {
      currentStage = {
        kind: "EXTRA_PAYMENT",
        number: 3,
        status: "REQUIRED",
        nextAction: "PURCHASE_EXTRA",
      };
    } else {
      currentStage = {
        kind: "WORK_ORDER",
        number: latestWorkOrder.version,
        status: latestWorkOrder.status,
        nextAction: "VIEW_WORK_ORDER",
      };
    }
  }

  return {
    payment: {
      initialPaid,
      extraPaid,
    },
    diagnostics,
    workOrders,
    latestDiagnosticNumber:
      diagnostics[diagnostics.length - 1]?.diagnosticNumber ?? null,
    latestWorkOrderVersion: workOrders[workOrders.length - 1]?.version ?? null,
    currentStage,
  };
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

function toPublicScan(
  scan: Scan & { verificationAttempt?: { workOrderId: string } | null },
): PublicScan {
  return {
    id: scan.id,
    siteId: scan.siteId,
    type: scan.type,
    status: scan.status,
    rulesVersion: scan.rulesVersion,
    isOutdatedRulesVersion: scan.rulesVersion !== CURRENT_RULES_VERSION,
    linkedWorkOrderId: scan.verificationAttempt?.workOrderId ?? null,
    verificationWorkOrderId: scan.verificationAttempt?.workOrderId ?? null,
    locale: scan.locale === "en" ? "en" : "ko",
    score: scan.score,
    grade: scan.grade,
    startedAt: scan.startedAt?.toISOString() ?? null,
    completedAt: scan.completedAt?.toISOString() ?? null,
    errorCode: scan.errorCode,
    createdAt: scan.createdAt.toISOString(),
  };
}

function toPublicSite(
  site: SiteWithSummary,
  progress?: PublicSiteProgress,
): PublicSite {
  return {
    id: site.id,
    organizationId: site.organizationId,
    organizationName: site.organization.name,
    name: site.name,
    baseUrl: site.baseUrl,
    finalUrl: site.finalUrl,
    siteType: site.siteType,
    description: site.description,
    country: site.country,
    region: site.region,
    primaryLocale: site.primaryLocale,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    latestScan: site.scans[0] ? toPublicScan(site.scans[0]) : null,
    progress,
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
            include: {
              verificationAttempt: {
                select: {
                  workOrderId: true,
                },
              },
            },
          },
          workOrders: {
            orderBy: [
              {
                version: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
            select: siteProgressWorkOrderSelect,
          },
          paidEntitlements: {
            where: {
              userId: user.id,
              OR: [{ status: "ACTIVE" }, { plan: "EXTRA_VERIFICATION" }],
            },
            select: {
              plan: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return sites.map((site) => {
        const latestScan = site.scans[0] ? toPublicScan(site.scans[0]) : null;

        return toPublicSite(
          site,
          buildSiteProgress({
            latestScan,
            workOrders: site.workOrders,
            paidPlans: site.paidEntitlements.map(
              (entitlement) => entitlement.plan,
            ),
            hasAdminAccess: user.role === "SUPER_ADMIN",
              initialPaidOverride: isDevUserPreviewPublicUser(user)
                ? true
                : undefined,
              extraPaidOverride: isDevUserPreviewPublicUser(user)
                ? false
                : undefined,
          }),
        );
      });
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
                description: normalizeOptionalText(input.description),
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
                description: normalizeOptionalText(input.description),
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

      if (input.description !== undefined) {
        data.description = normalizeOptionalText(input.description);
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
              include: {
                verificationAttempt: {
                  select: {
                    workOrderId: true,
                  },
                },
              },
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
        include: {
          verificationAttempt: {
            select: { workOrderId: true },
          },
        },
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
