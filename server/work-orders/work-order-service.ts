import { randomInt } from "node:crypto";
import {
  Prisma,
  type FindingSeverity,
  type FindingStatus,
  type WorkOrderItemStatus,
  type WorkOrderStatus,
} from "@prisma/client";
import type { PublicUser } from "../auth/auth-service";
import { getDatabase } from "../db";
import {
  buildRenderedDomImprovementPlans,
  scanResultRenderedDomComparison,
} from "../scans/scan-result-pdf";
import { getRuleDefinition } from "../scans/scoring";
import {
  SiteUrlError,
  validatePublicSiteUrl,
  type DnsResolver,
} from "../sites/url-safety";
import {
  buildRenderedImprovementWorkOrderTemplate,
  buildWorkOrderTemplate,
  type AcceptanceCriterion,
} from "./work-order-templates";

const WORK_ORDER_ITEM_TITLES_EN: Record<string, string> = {
  "STRUCT-H1-001": "Add one representative H1 to the initial HTML",
  "CONTENT-HEADINGS-001": "Build a clear H1/H2 heading hierarchy",
  "CONTENT-INITIAL-001": "Provide meaningful body content in the initial HTML",
  "CONTENT-ANSWERABILITY-001":
    "Add answerable service information to the initial HTML",
  "STRUCT-LINKS-001": "Expose key internal pages as standard links",
  "ACCESS-SITEMAP-001": "Declare and serve a public XML sitemap",
  "META-CANONICAL-001": "Add a canonical link to the initial HTML head",
  "META-OG-001": "Add Open Graph title and description",
  "STRUCT-JSONLD-001": "Add valid Schema.org JSON-LD",
  "STRUCT-JSONLD-TYPES-001": "Specify appropriate Schema.org @type values",
};

function workOrderItemTitle(
  ruleCode: string,
  fallbackTitle: string,
  locale: "ko" | "en" = "ko",
): string {
  if (locale === "en") {
    return WORK_ORDER_ITEM_TITLES_EN[ruleCode] ?? ruleCode;
  }

  return fallbackTitle;
}

const workOrderInclude = {
  site: true,
  initialScan: true,
  customerOrganization: true,
  agencyOrganization: true,
  items: {
    include: {
      finding: {
        include: {
          scanPage: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  verificationAttempts: {
    include: {
      scan: true,
      itemResults: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      attemptNumber: "desc",
    },
  },
} satisfies Prisma.WorkOrderInclude;

type WorkOrderRecord = Prisma.WorkOrderGetPayload<{
  include: typeof workOrderInclude;
}>;

export interface PublicWorkOrderItem {
  id: string;
  findingId: string | null;
  itemCode: string;
  targetUrl: string;
  title: string;
  requirement: string;
  developerMessage: string;
  acceptanceCriteria: AcceptanceCriterion[];
  isRequired: boolean;
  weight: number;
  status: WorkOrderItemStatus;
  finding: {
    ruleCode: string;
    category: string;
    severity: FindingSeverity;
    status: FindingStatus;
    description: string;
    evidence: unknown;
    recommendation: string | null;
  } | null;
}

export interface PublicVerificationItemResult {
  id: string;
  workOrderItemId: string;
  status: string;
  criteriaResults: unknown;
  evidence: unknown;
  message: string | null;
  createdAt: string;
}

export interface PublicVerificationAttempt {
  id: string;
  attemptNumber: number;
  submittedUrl: string;
  status: string;
  scoreAfter: number | null;
  gradeAfter: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  createdAt: string;
  scan: {
    id: string;
    type: string;
    status: string;
    targetUrl: string | null;
    score: number | null;
    grade: string | null;
    startedAt: string | null;
    completedAt: string | null;
    errorCode: string | null;
  };
  itemResults: PublicVerificationItemResult[];
}

export interface PublicWorkOrder {
  id: string;
  orderNumber: string;
  version: number;
  status: WorkOrderStatus;
  rulesVersion: string;
  scoreBefore: number | null;
  gradeBefore: string | null;
  expectedScoreMin: number;
  expectedScoreMax: number;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  site: {
    id: string;
    name: string;
    baseUrl: string;
    finalUrl: string | null;
  };
  initialScan: {
    id: string;
    score: number | null;
    grade: string | null;
    rulesVersion: string;
    targetUrl: string | null;
    completedAt: string | null;
  };
  customerOrganization: {
    id: string;
    name: string;
  };
  agencyOrganization: {
    id: string;
    name: string;
  } | null;
  items: PublicWorkOrderItem[];
  verificationAttempts: PublicVerificationAttempt[];
}

export interface PublicWorkOrderSummary {
  id: string;
  orderNumber: string;
  version: number;
  status: WorkOrderStatus;
  scoreBefore: number | null;
  expectedScoreMin: number;
  expectedScoreMax: number;
  createdAt: string;
  issuedAt: string | null;
  itemCount: number;
  site: {
    id: string;
    name: string;
  };
  initialScan: {
    id: string;
  };
}

export interface CreateWorkOrderInput {
  scanId: string;
  findingIds: string[];
  renderedImprovementCodes: string[];
  locale?: "ko" | "en";
}

export interface SubmitVerificationInput {
  submittedUrl: string;
}

export interface WorkOrderExport {
  formatVersion: "site-ai-score-work-order-v1";
  generatedAt: string;
  workOrder: PublicWorkOrder;
  disclaimer: string;
}

export interface WorkOrderService {
  listWorkOrders(user: PublicUser): Promise<PublicWorkOrderSummary[]>;
  createWorkOrder(
    user: PublicUser,
    input: CreateWorkOrderInput,
  ): Promise<PublicWorkOrder>;
  getWorkOrder(user: PublicUser, workOrderId: string): Promise<PublicWorkOrder>;
  getLatestWorkOrderByScan(
    user: PublicUser,
    scanId: string,
  ): Promise<PublicWorkOrder>;
  getLatestWorkOrderForAdminByScan?(scanId: string): Promise<PublicWorkOrder>;
  issueWorkOrder(
    user: PublicUser,
    workOrderId: string,
  ): Promise<PublicWorkOrder>;
  submitVerification(
    user: PublicUser,
    workOrderId: string,
    input: SubmitVerificationInput,
  ): Promise<PublicWorkOrder>;
  reviseWorkOrder(
    user: PublicUser,
    workOrderId: string,
  ): Promise<PublicWorkOrder>;
  cancelWorkOrder(user: PublicUser, workOrderId: string): Promise<void>;
  exportJson(user: PublicUser, workOrderId: string): Promise<WorkOrderExport>;
  exportCsv(user: PublicUser, workOrderId: string): Promise<string>;
}

export class WorkOrderServiceError extends Error {
  constructor(
    public readonly code:
      | "WORK_ORDER_NOT_FOUND"
      | "WORK_ORDER_INVALID_SCAN"
      | "WORK_ORDER_INVALID_FINDINGS"
      | "WORK_ORDER_INVALID_STATUS"
      | "WORK_ORDER_INVALID_VERIFICATION_URL"
      | "WORK_ORDER_VERIFICATION_ALREADY_RUNNING",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorkOrderServiceError";
  }
}

function acceptanceCriteria(value: Prisma.JsonValue): AcceptanceCriterion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;

    if (typeof record.code !== "string" || typeof record.label !== "string") {
      return [];
    }

    return [
      {
        code: record.code,
        label: record.label,
        required: record.required !== false,
      },
    ];
  });
}

function publicWorkOrder(record: WorkOrderRecord): PublicWorkOrder {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    version: record.version,
    status: record.status,
    rulesVersion: record.rulesVersion,
    scoreBefore: record.scoreBefore,
    gradeBefore: record.gradeBefore,
    expectedScoreMin: record.expectedScoreMin,
    expectedScoreMax: record.expectedScoreMax,
    issuedAt: record.issuedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    site: {
      id: record.site.id,
      name: record.site.name,
      baseUrl: record.site.baseUrl,
      finalUrl: record.site.finalUrl,
    },
    initialScan: {
      id: record.initialScan.id,
      score: record.initialScan.score,
      grade: record.initialScan.grade,
      rulesVersion: record.initialScan.rulesVersion,
      targetUrl: record.initialScan.targetUrl,
      completedAt: record.initialScan.completedAt?.toISOString() ?? null,
    },
    customerOrganization: {
      id: record.customerOrganization.id,
      name: record.customerOrganization.name,
    },
    agencyOrganization: record.agencyOrganization
      ? {
          id: record.agencyOrganization.id,
          name: record.agencyOrganization.name,
        }
      : null,
    items: record.items.map((item) => ({
      id: item.id,
      findingId: item.findingId,
      itemCode: item.itemCode,
      targetUrl: item.targetUrl,
      title: item.title,
      requirement: item.requirement,
      developerMessage: item.developerMessage,
      acceptanceCriteria: acceptanceCriteria(item.acceptanceCriteriaJson),
      isRequired: item.isRequired,
      weight: item.weight,
      status: item.status,
      finding: item.finding
        ? {
            ruleCode: item.finding.ruleCode,
            category: item.finding.category,
            severity: item.finding.severity,
            status: item.finding.status,
            description: item.finding.description,
            evidence: item.finding.evidenceJson,
            recommendation: item.finding.recommendation,
          }
        : null,
    })),
    verificationAttempts: record.verificationAttempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      submittedUrl: attempt.submittedUrl,
      status: attempt.status,
      scoreAfter: attempt.scoreAfter,
      gradeAfter: attempt.gradeAfter,
      startedAt: attempt.startedAt?.toISOString() ?? null,
      completedAt: attempt.completedAt?.toISOString() ?? null,
      errorCode: attempt.errorCode,
      createdAt: attempt.createdAt.toISOString(),
      scan: {
        id: attempt.scan.id,
        type: attempt.scan.type,
        status: attempt.scan.status,
        targetUrl: attempt.scan.targetUrl,
        score: attempt.scan.score,
        grade: attempt.scan.grade,
        startedAt: attempt.scan.startedAt?.toISOString() ?? null,
        completedAt: attempt.scan.completedAt?.toISOString() ?? null,
        errorCode: attempt.scan.errorCode,
      },
      itemResults: attempt.itemResults.map((result) => ({
        id: result.id,
        workOrderItemId: result.workOrderItemId,
        status: result.status,
        criteriaResults: result.criteriaResultsJson,
        evidence: result.evidenceJson,
        message: result.message,
        createdAt: result.createdAt.toISOString(),
      })),
    })),
  };
}

function formatKstDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${value.year}${value.month}${value.day}`;
}

async function createOrderNumber(): Promise<string> {
  const prisma = getDatabase();
  const datePart = formatKstDate(new Date());

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `WO-${datePart}-${randomInt(10_000, 100_000)}`;
    const exists = await prisma.workOrder.findFirst({
      where: {
        orderNumber: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("작업지시서 번호를 생성하지 못했습니다.");
}

function expectedScoreRange(
  scoreBefore: number | null,
  totalWeight: number,
): { min: number; max: number } {
  const current = Math.max(0, Math.min(100, Math.round(scoreBefore ?? 0)));

  if (totalWeight <= 0) {
    return { min: current, max: current };
  }

  if (current < 70) {
    return { min: 70, max: 100 };
  }

  if (current < 80) {
    return { min: 80, max: 100 };
  }

  if (current < 90) {
    return { min: 90, max: 100 };
  }

  return { min: current, max: 100 };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(workOrder: PublicWorkOrder): string {
  const headers = [
    "작업지시서 번호",
    "버전",
    "상태",
    "사이트",
    "규칙 버전",
    "항목 코드",
    "대상 URL",
    "제목",
    "필수 여부",
    "배점",
    "수정 요구사항",
    "개발자 전달 문구",
    "완료 기준",
  ];

  const rows = workOrder.items.map((item) => [
    workOrder.orderNumber,
    workOrder.version,
    workOrder.status,
    workOrder.site.name,
    workOrder.rulesVersion,
    item.itemCode,
    item.targetUrl,
    item.title,
    item.isRequired ? "필수" : "일반",
    item.weight,
    item.requirement,
    item.developerMessage,
    item.acceptanceCriteria
      .map(
        (criterion) =>
          `${criterion.code} ${criterion.label}${
            criterion.required ? " [필수]" : ""
          }`,
      )
      .join(" | "),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}`;
}

async function accessibleRecord(
  user: PublicUser,
  workOrderId: string,
): Promise<WorkOrderRecord> {
  const prisma = getDatabase();
  const record = await prisma.workOrder.findFirst({
    where: {
      id: workOrderId,
      site: {
        organization: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    },
    include: workOrderInclude,
  });

  if (!record) {
    throw new WorkOrderServiceError(
      "WORK_ORDER_NOT_FOUND",
      "작업지시서를 찾을 수 없습니다.",
      404,
    );
  }

  return record;
}

export function createPrismaWorkOrderService(
  resolver?: DnsResolver,
): WorkOrderService {
  return {
    async listWorkOrders(user) {
      const prisma = getDatabase();
      const records = await prisma.workOrder.findMany({
        where: {
          site: {
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
        include: {
          site: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return records.map((record) => ({
        id: record.id,
        orderNumber: record.orderNumber,
        version: record.version,
        status: record.status,
        scoreBefore: record.scoreBefore,
        expectedScoreMin: record.expectedScoreMin,
        expectedScoreMax: record.expectedScoreMax,
        createdAt: record.createdAt.toISOString(),
        issuedAt: record.issuedAt?.toISOString() ?? null,
        itemCount: record._count.items,
        site: record.site,
        initialScan: {
          id: record.initialScanId,
        },
      }));
    },

    async createWorkOrder(user, input) {
      const prisma = getDatabase();
      const findingIds = [...new Set(input.findingIds)];
      const renderedImprovementCodes = [
        ...new Set(input.renderedImprovementCodes),
      ];
      const selectedCount = findingIds.length + renderedImprovementCodes.length;

      if (
        selectedCount === 0 ||
        selectedCount > 50 ||
        renderedImprovementCodes.length > 3
      ) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_FINDINGS",
          "작업지시서에 포함할 항목을 1개 이상 선택해 주세요.",
          400,
        );
      }

      const scan = await prisma.scan.findFirst({
        where: {
          id: input.scanId,
          status: {
            in: ["COMPLETED", "PARTIAL"],
          },
          site: {
            status: "ACTIVE",
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
        include: {
          site: true,
          findings: {
            include: {
              scanPage: true,
            },
          },
        },
      });

      if (!scan || scan.score === null) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_SCAN",
          "점수가 계산된 완료 검사에서만 작업지시서를 만들 수 있습니다.",
          400,
        );
      }

      const existingWorkOrders = await prisma.workOrder.findMany({
        where: {
          initialScanId: scan.id,
          status: {
            not: "CANCELLED",
          },
          site: {
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
        include: workOrderInclude,
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      });
      const existingWorkOrder =
        existingWorkOrders.find((record) => record.status !== "DRAFT") ??
        existingWorkOrders[0];

      if (existingWorkOrder) {
        return publicWorkOrder(existingWorkOrder);
      }

      const autoIncludedFindingIds = scan.findings
        .filter((finding) => {
          const definition = getRuleDefinition(finding.ruleCode);

          return (
            definition !== undefined &&
            definition.weight > 0 &&
            (finding.status === "FAIL" || finding.status === "BLOCKED")
          );
        })
        .map((finding) => finding.id);
      const effectiveFindingIds = [
        ...new Set([...findingIds, ...autoIncludedFindingIds]),
      ];

      if (effectiveFindingIds.length + renderedImprovementCodes.length > 50) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_FINDINGS",
          "작업지시서 대상 항목은 최대 50개입니다.",
          400,
        );
      }

      const selectedFindings = scan.findings.filter((finding) =>
        effectiveFindingIds.includes(finding.id),
      );

      if (selectedFindings.length !== effectiveFindingIds.length) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_FINDINGS",
          "선택한 문제 중 현재 검사에 속하지 않는 항목이 있습니다.",
          400,
        );
      }

      const comparison = scanResultRenderedDomComparison({
        findings: scan.findings.map((finding) => ({
          ruleCode: finding.ruleCode,
          evidence: finding.evidenceJson,
        })),
      });
      const availablePlans = new Map(
        buildRenderedDomImprovementPlans(comparison, input.locale ?? "ko").map(
          (plan) => [plan.code, plan],
        ),
      );
      const selectedPlans = renderedImprovementCodes.map((code) => {
        const plan = availablePlans.get(code);

        if (!plan) {
          throw new WorkOrderServiceError(
            "WORK_ORDER_INVALID_FINDINGS",
            "선택한 AI 수집 개선안이 현재 검사 결과와 일치하지 않습니다.",
            400,
          );
        }

        return plan;
      });

      const findingItemInputs = selectedFindings.map((finding) => {
        const definition = getRuleDefinition(finding.ruleCode);

        if (
          !definition ||
          definition.weight <= 0 ||
          (finding.status !== "FAIL" && finding.status !== "BLOCKED")
        ) {
          throw new WorkOrderServiceError(
            "WORK_ORDER_INVALID_FINDINGS",
            "실패 또는 확인 불가 상태의 점수 항목만 선택할 수 있습니다.",
            400,
          );
        }

        const template = buildWorkOrderTemplate(finding, input.locale ?? "ko");
        const targetUrl =
          finding.scanPage?.finalUrl ??
          finding.scanPage?.url ??
          scan.site.finalUrl ??
          scan.site.baseUrl;

        return {
          findingId: finding.id,
          itemCode: finding.ruleCode,
          targetUrl,
          title: workOrderItemTitle(
            finding.ruleCode,
            finding.title,
            input.locale ?? "ko",
          ),
          requirement: template.requirement,
          developerMessage: template.developerMessage,
          acceptanceCriteriaJson:
            template.acceptanceCriteria as unknown as Prisma.InputJsonValue,
          isRequired: template.isRequired,
          weight: definition.weight,
        };
      });

      const renderedItemInputs = selectedPlans.map((plan) => {
        const template = buildRenderedImprovementWorkOrderTemplate(
          plan,
          input.locale ?? "ko",
        );

        return {
          findingId: null,
          itemCode: plan.code,
          targetUrl: scan.site.finalUrl ?? scan.site.baseUrl,
          title: plan.title,
          requirement: template.requirement,
          developerMessage: template.developerMessage,
          acceptanceCriteriaJson:
            template.acceptanceCriteria as unknown as Prisma.InputJsonValue,
          isRequired: template.isRequired,
          weight: 0,
        };
      });
      const itemInputs = [...findingItemInputs, ...renderedItemInputs];

      const totalWeight = itemInputs.reduce(
        (total, item) => total + item.weight,
        0,
      );
      const range = expectedScoreRange(scan.score, totalWeight);
      const orderNumber = await createOrderNumber();

      const created = await prisma.workOrder.create({
        data: {
          orderNumber,
          siteId: scan.siteId,
          initialScanId: scan.id,
          customerOrganizationId: scan.site.organizationId,
          version: 1,
          status: "DRAFT",
          rulesVersion: scan.rulesVersion,
          scoreBefore: scan.score,
          gradeBefore: scan.grade,
          expectedScoreMin: range.min,
          expectedScoreMax: range.max,
          createdBy: user.id,
          items: {
            create: itemInputs,
          },
        },
        include: workOrderInclude,
      });

      return publicWorkOrder(created);
    },

    async getWorkOrder(user, workOrderId) {
      return publicWorkOrder(await accessibleRecord(user, workOrderId));
    },

    async getLatestWorkOrderByScan(user, scanId) {
      const prisma = getDatabase();
      const record = await prisma.workOrder.findFirst({
        where: {
          status: {
            not: "CANCELLED",
          },
          site: {
            organization: {
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
          OR: [
            { initialScanId: scanId },
            {
              verificationAttempts: {
                some: {
                  scanId,
                },
              },
            },
          ],
        },
        include: workOrderInclude,
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!record) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_NOT_FOUND",
          "해당 진단으로 연결된 작업지시서를 찾을 수 없습니다.",
          404,
        );
      }

      return publicWorkOrder(record);
    },

    async getLatestWorkOrderForAdminByScan(scanId) {
      const prisma = getDatabase();
      const record = await prisma.workOrder.findFirst({
        where: {
          initialScanId: scanId,
        },
        include: workOrderInclude,
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      });

      if (!record) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_NOT_FOUND",
          "해당 진단으로 생성된 작업지시서를 찾을 수 없습니다.",
          404,
        );
      }

      return publicWorkOrder(record);
    },

    async issueWorkOrder(user, workOrderId) {
      const current = await accessibleRecord(user, workOrderId);

      if (current.status !== "DRAFT") {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_STATUS",
          "초안 상태의 작업지시서만 발급할 수 있습니다.",
          409,
        );
      }

      const updated = await getDatabase().workOrder.update({
        where: {
          id: current.id,
        },
        data: {
          status: "ISSUED",
          issuedAt: new Date(),
        },
        include: workOrderInclude,
      });

      return publicWorkOrder(updated);
    },

    async submitVerification(user, workOrderId, input) {
      const prisma = getDatabase();
      const current = await accessibleRecord(user, workOrderId);

      if (
        ![
          "ISSUED",
          "ASSIGNED",
          "IN_PROGRESS",
          "SUBMITTED",
          "REWORK_REQUIRED",
        ].includes(current.status)
      ) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_STATUS",
          "발급된 작업지시서만 수정 URL을 제출할 수 있습니다.",
          409,
        );
      }

      let submittedUrl: string;

      try {
        submittedUrl = (
          await validatePublicSiteUrl(input.submittedUrl, resolver)
        ).normalizedUrl;
      } catch (error) {
        if (error instanceof SiteUrlError) {
          throw new WorkOrderServiceError(
            "WORK_ORDER_INVALID_VERIFICATION_URL",
            error.message,
            error.status,
          );
        }

        throw error;
      }

      const activeScan = await prisma.scan.findFirst({
        where: {
          siteId: current.siteId,
          status: {
            in: ["QUEUED", "RUNNING"],
          },
        },
        select: {
          id: true,
        },
      });

      if (activeScan) {
        throw new WorkOrderServiceError(
          "WORK_ORDER_VERIFICATION_ALREADY_RUNNING",
          "이 사이트에서 이미 대기 중이거나 실행 중인 검사가 있습니다.",
          409,
        );
      }

      const latest = await prisma.verificationAttempt.aggregate({
        where: {
          workOrderId: current.id,
        },
        _max: {
          attemptNumber: true,
        },
      });
      const attemptNumber = (latest._max.attemptNumber ?? 0) + 1;

      const updated = await prisma.$transaction(async (transaction) => {
        const scan = await transaction.scan.create({
          data: {
            siteId: current.siteId,
            targetUrl: submittedUrl,
            type: "VERIFICATION",
            status: "QUEUED",
            rulesVersion: current.rulesVersion,
            createdBy: user.id,
          },
        });

        await transaction.verificationAttempt.create({
          data: {
            workOrderId: current.id,
            scanId: scan.id,
            attemptNumber,
            submittedUrl,
            status: "QUEUED",
            createdBy: user.id,
          },
        });

        return transaction.workOrder.update({
          where: {
            id: current.id,
          },
          data: {
            status: "VERIFYING",
          },
          include: workOrderInclude,
        });
      });

      return publicWorkOrder(updated);
    },

    async reviseWorkOrder(user, workOrderId) {
      const current = await accessibleRecord(user, workOrderId);

      if (current.status === "CANCELLED") {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_STATUS",
          "취소된 작업지시서는 새 버전을 만들 수 없습니다.",
          409,
        );
      }

      const latest = await getDatabase().workOrder.aggregate({
        where: {
          orderNumber: current.orderNumber,
        },
        _max: {
          version: true,
        },
      });
      const nextVersion = (latest._max.version ?? current.version) + 1;

      const created = await getDatabase().workOrder.create({
        data: {
          orderNumber: current.orderNumber,
          siteId: current.siteId,
          initialScanId: current.initialScanId,
          customerOrganizationId: current.customerOrganizationId,
          agencyOrganizationId: current.agencyOrganizationId,
          version: nextVersion,
          status: "DRAFT",
          rulesVersion: current.rulesVersion,
          scoreBefore: current.scoreBefore,
          gradeBefore: current.gradeBefore,
          expectedScoreMin: current.expectedScoreMin,
          expectedScoreMax: current.expectedScoreMax,
          createdBy: user.id,
          items: {
            create: current.items.map((item) => ({
              findingId: item.findingId,
              itemCode: item.itemCode,
              targetUrl: item.targetUrl,
              title: item.title,
              requirement: item.requirement,
              developerMessage: item.developerMessage,
              acceptanceCriteriaJson:
                item.acceptanceCriteriaJson as Prisma.InputJsonValue,
              isRequired: item.isRequired,
              weight: item.weight,
              status: "PENDING",
            })),
          },
        },
        include: workOrderInclude,
      });

      return publicWorkOrder(created);
    },

    async cancelWorkOrder(user, workOrderId) {
      const current = await accessibleRecord(user, workOrderId);

      if (current.status !== "DRAFT") {
        throw new WorkOrderServiceError(
          "WORK_ORDER_INVALID_STATUS",
          "초안 상태의 작업지시서만 취소할 수 있습니다.",
          409,
        );
      }

      await getDatabase().workOrder.update({
        where: {
          id: current.id,
        },
        data: {
          status: "CANCELLED",
        },
      });
    },

    async exportJson(user, workOrderId) {
      const workOrder = publicWorkOrder(
        await accessibleRecord(user, workOrderId),
      );

      return {
        formatVersion: "site-ai-score-work-order-v1",
        generatedAt: new Date().toISOString(),
        workOrder,
        disclaimer:
          "예상 개선 범위는 현재 규칙 배점을 기준으로 계산한 참고값이며 실제 점수 상승이나 AI 검색 노출을 보장하지 않습니다.",
      };
    },

    async exportCsv(user, workOrderId) {
      return toCsv(publicWorkOrder(await accessibleRecord(user, workOrderId)));
    },
  };
}
