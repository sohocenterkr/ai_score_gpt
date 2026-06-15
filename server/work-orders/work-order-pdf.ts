import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import type {
  PublicWorkOrder,
  PublicWorkOrderItem,
} from "./work-order-service";

const FONT_MAIN_NAME = "SiteAiScoreNotoMedium";
const FONT_REGULAR_NAME = FONT_MAIN_NAME;
const FONT_BOLD_NAME = FONT_MAIN_NAME;

const COLORS = {
  primary: "#3157E5",
  primaryDark: "#243B91",
  primarySoft: "#EEF2FF",
  text: "#172033",
  muted: "#64748B",
  border: "#DCE3EE",
  surface: "#F8FAFC",
  success: "#166534",
  warning: "#92400E",
  white: "#FFFFFF",
};

const STATUS_LABELS: Record<PublicWorkOrder["status"], string> = {
  DRAFT: "초안",
  ISSUED: "발급",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업 중",
  SUBMITTED: "제출",
  VERIFYING: "검수 중",
  REWORK_REQUIRED: "재작업 필요",
  PASSED: "통과",
  CANCELLED: "취소",
};

const FINDING_STATUS_LABELS: Record<string, string> = {
  PASS: "통과",
  FAIL: "실패",
  BLOCKED: "확인 불가",
  NA: "감점 제외",
};

const SEVERITY_LABELS: Record<string, string> = {
  INFO: "참고",
  LOW: "낮음",
  MEDIUM: "주의",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};

function fontPath(weight: 400 | 500 | 700): string {
  return join(
    process.cwd(),
    "node_modules",
    "@fontsource",
    "noto-sans-kr",
    "files",
    `noto-sans-kr-korean-${weight}-normal.woff2`,
  );
}

function requireFontPath(weight: 400 | 500 | 700): string {
  const value = fontPath(weight);

  if (!existsSync(value)) {
    throw new Error(
      `PDF 한글 글꼴을 찾을 수 없습니다: ${value}`,
    );
  }

  return value;
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function formatKST(value: string | null): string {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function contentWidth(document: PDFKit.PDFDocument): number {
  return (
    document.page.width -
    document.page.margins.left -
    document.page.margins.right
  );
}

function bottomLimit(document: PDFKit.PDFDocument): number {
  return document.page.height - document.page.margins.bottom - 26;
}

function ensureSpace(
  document: PDFKit.PDFDocument,
  requiredHeight: number,
): void {
  if (document.y + requiredHeight > bottomLimit(document)) {
    document.addPage();
  }
}

function setRegular(
  document: PDFKit.PDFDocument,
  size = 9.5,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document
    .font(FONT_REGULAR_NAME)
    .fontSize(size)
    .fillColor(color);
}

function setBold(
  document: PDFKit.PDFDocument,
  size = 9.5,
  color = COLORS.text,
): PDFKit.PDFDocument {
  return document
    .font(FONT_BOLD_NAME)
    .fontSize(size)
    .fillColor(color);
}

function writeSectionTitle(
  document: PDFKit.PDFDocument,
  title: string,
): void {
  ensureSpace(document, 30);
  setBold(document, 12, COLORS.text).text(cleanText(title), {
    width: contentWidth(document),
  });
  document
    .moveDown(0.35)
    .strokeColor(COLORS.border)
    .lineWidth(0.7)
    .moveTo(document.page.margins.left, document.y)
    .lineTo(
      document.page.width - document.page.margins.right,
      document.y,
    )
    .stroke()
    .moveDown(0.65);
}

function writeLabelValue(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  const width = contentWidth(document);
  const labelWidth = 105;
  const x = document.page.margins.left;
  const y = document.y;
  const safeValue = cleanText(value) || "-";
  const valueHeight = document.heightOfString(safeValue, {
    width: width - labelWidth,
    lineGap: 2,
  });
  const rowHeight = Math.max(18, valueHeight + 2);

  ensureSpace(document, rowHeight + 5);
  const rowY = document.y;

  setBold(document, 8.2, COLORS.muted).text(cleanText(label), x, rowY, {
    width: labelWidth - 10,
    lineBreak: false,
  });
  setRegular(document, 9.2, COLORS.text).text(
    safeValue,
    x + labelWidth,
    rowY,
    {
      width: width - labelWidth,
      lineGap: 2,
    },
  );

  document.y = rowY + rowHeight + 5;
}

function writeTextBox(
  document: PDFKit.PDFDocument,
  title: string,
  text: string,
  options: {
    background?: string;
    border?: string;
    accent?: string;
  } = {},
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const padding = 14;
  const titleHeight = 15;
  const safeText = cleanText(text) || "-";

  setRegular(document, 9.3);
  const bodyHeight = document.heightOfString(safeText, {
    width: width - padding * 2,
    lineGap: 3,
  });
  const boxHeight = padding + titleHeight + 7 + bodyHeight + padding;

  ensureSpace(document, boxHeight + 12);
  const y = document.y;

  document
    .roundedRect(x, y, width, boxHeight, 8)
    .fillAndStroke(
      options.background ?? COLORS.surface,
      options.border ?? COLORS.border,
    );

  if (options.accent) {
    document
      .roundedRect(x, y, 4, boxHeight, 2)
      .fill(options.accent);
  }

  setBold(document, 8.7, COLORS.muted).text(
    cleanText(title),
    x + padding,
    y + padding,
    {
      width: width - padding * 2,
      lineBreak: false,
    },
  );

  setRegular(document, 9.3, COLORS.text).text(
    safeText,
    x + padding,
    y + padding + titleHeight + 7,
    {
      width: width - padding * 2,
      lineGap: 3,
    },
  );

  document.y = y + boxHeight + 12;
}

function writeCriteria(
  document: PDFKit.PDFDocument,
  item: PublicWorkOrderItem,
): void {
  writeSectionTitle(document, "완료 판정 기준");

  for (const criterion of item.acceptanceCriteria) {
    const x = document.page.margins.left;
    const width = contentWidth(document);
    const codeWidth = 92;
    const requiredWidth = 40;
    const padding = 10;
    const labelWidth =
      width - codeWidth - requiredWidth - padding * 4;
    const label = cleanText(criterion.label);
    const labelHeight = document.heightOfString(label, {
      width: labelWidth,
      lineGap: 2,
    });
    const rowHeight = Math.max(32, labelHeight + padding * 2);

    ensureSpace(document, rowHeight + 7);
    const y = document.y;

    document
      .roundedRect(x, y, width, rowHeight, 7)
      .fillAndStroke(COLORS.white, COLORS.border);

    setBold(document, 7.7, COLORS.primary).text(
      cleanText(criterion.code),
      x + padding,
      y + padding,
      {
        width: codeWidth - padding,
      },
    );

    setRegular(document, 8.8, COLORS.text).text(
      label,
      x + codeWidth + padding,
      y + padding,
      {
        width: labelWidth,
        lineGap: 2,
      },
    );

    setBold(
      document,
      7.4,
      criterion.required ? COLORS.primaryDark : COLORS.muted,
    ).text(
      criterion.required ? "필수" : "권장",
      x + width - requiredWidth - padding,
      y + padding,
      {
        width: requiredWidth,
        align: "right",
      },
    );

    document.y = y + rowHeight + 7;
  }

  document.moveDown(0.4);
}

function evidenceText(value: unknown): string {
  if (value === null || value === undefined) {
    return "저장된 최초 검사 증거가 없습니다.";
  }

  try {
    return cleanText(JSON.stringify(value, null, 2));
  } catch {
    return cleanText(value);
  }
}

function writeEvidence(
  document: PDFKit.PDFDocument,
  item: PublicWorkOrderItem,
): void {
  const text = evidenceText(item.finding?.evidence);
  const width = contentWidth(document);

  setRegular(document, 7.4, COLORS.muted);
  const evidenceHeight = document.heightOfString(text, {
    width,
    lineGap: 2,
  });
  const requiredHeight = 34 + evidenceHeight + 14;
  const pageBodyHeight =
    document.page.height -
    document.page.margins.top -
    document.page.margins.bottom -
    40;

  if (
    requiredHeight <= pageBodyHeight &&
    document.y + requiredHeight > bottomLimit(document)
  ) {
    document.addPage();
  }

  writeSectionTitle(document, "최초 검사 증거");

  setRegular(document, 7.4, COLORS.muted).text(text, {
    width,
    lineGap: 2,
  });
  document.moveDown(0.8);
}

function writeCover(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
): void {
  const x = document.page.margins.left;
  const width = contentWidth(document);
  const top = document.page.margins.top;

  document
    .roundedRect(x, top, width, 116, 12)
    .fill(COLORS.primary);

  setBold(document, 10, COLORS.white).text(
    "SITE AI SCORE",
    x + 22,
    top + 19,
    {
      width: width - 44,
      characterSpacing: 1.2,
    },
  );

  setBold(document, 24, COLORS.white).text(
    `${cleanText(workOrder.site.name)} 수정 작업지시서`,
    x + 22,
    top + 43,
    {
      width: width - 44,
      lineGap: 3,
    },
  );

  setRegular(document, 9.2, "#DDE5FF").text(
    `${cleanText(workOrder.orderNumber)} / v${workOrder.version} / ${
      STATUS_LABELS[workOrder.status]
    }`,
    x + 22,
    top + 89,
    {
      width: width - 44,
    },
  );

  document.y = top + 142;

  const gap = 12;
  const scoreWidth = (width - gap) / 2;
  const scoreY = document.y;
  const scoreHeight = 78;

  document
    .roundedRect(x, scoreY, scoreWidth, scoreHeight, 10)
    .fillAndStroke(COLORS.white, COLORS.border);
  document
    .roundedRect(
      x + scoreWidth + gap,
      scoreY,
      scoreWidth,
      scoreHeight,
      10,
    )
    .fillAndStroke(COLORS.primarySoft, "#C7D2FE");

  setBold(document, 8.4, COLORS.muted).text(
    "현재 점수",
    x + 14,
    scoreY + 13,
    {
      width: scoreWidth - 28,
    },
  );
  setBold(document, 26, COLORS.text).text(
    workOrder.scoreBefore === null
      ? "-"
      : String(workOrder.scoreBefore),
    x + 14,
    scoreY + 31,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );
  setRegular(document, 8.2, COLORS.muted).text(
    cleanText(workOrder.gradeBefore ?? "미계산"),
    x + 70,
    scoreY + 44,
    {
      width: scoreWidth - 84,
    },
  );

  setBold(document, 8.4, COLORS.primaryDark).text(
    "예상 점수 범위",
    x + scoreWidth + gap + 14,
    scoreY + 13,
    {
      width: scoreWidth - 28,
    },
  );
  setBold(document, 23, COLORS.primary).text(
    `${workOrder.expectedScoreMin} - ${workOrder.expectedScoreMax}`,
    x + scoreWidth + gap + 14,
    scoreY + 33,
    {
      width: scoreWidth - 28,
      lineBreak: false,
    },
  );

  document.y = scoreY + scoreHeight + 22;

  writeSectionTitle(document, "작업지시서 정보");
  writeLabelValue(document, "고객", workOrder.customerOrganization.name);
  writeLabelValue(
    document,
    "사이트",
    `${workOrder.site.name} (${workOrder.site.baseUrl})`,
  );
  writeLabelValue(
    document,
    "검사 URL",
    workOrder.site.finalUrl ?? workOrder.site.baseUrl,
  );
  writeLabelValue(document, "규칙 버전", workOrder.rulesVersion);
  writeLabelValue(document, "발급 시각(KST)", formatKST(workOrder.issuedAt));
  writeLabelValue(
    document,
    "PDF 생성 시각(KST)",
    formatKST(new Date().toISOString()),
  );

  writeSectionTitle(document, "작업 항목 요약");

  workOrder.items.forEach((item, index) => {
    ensureSpace(document, 27);
    const y = document.y;
    setBold(document, 8.1, COLORS.primary).text(
      String(index + 1).padStart(2, "0"),
      x,
      y,
      {
        width: 28,
        lineBreak: false,
      },
    );
    setBold(document, 9.2, COLORS.text).text(
      `${cleanText(item.itemCode)} / ${cleanText(item.title)}`,
      x + 34,
      y,
      {
        width: width - 112,
      },
    );
    setBold(document, 8.1, COLORS.primaryDark).text(
      `${item.weight}점`,
      x + width - 66,
      y,
      {
        width: 66,
        align: "right",
      },
    );
    document.y = Math.max(document.y, y + 18) + 7;
  });

  document.moveDown(0.5);
  setRegular(document, 7.8, COLORS.muted).text(
    "예상 점수 범위는 선택된 규칙 배점을 기준으로 계산한 참고값이며 실제 점수 상승이나 AI 검색 노출을 보장하지 않습니다.",
    {
      width,
      lineGap: 2,
    },
  );
}

function writeItemPage(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
  item: PublicWorkOrderItem,
  index: number,
): void {
  document.addPage();
  const x = document.page.margins.left;
  const width = contentWidth(document);

  setBold(document, 8.2, COLORS.primary).text(
    `작업 항목 ${index + 1} / ${workOrder.items.length}`,
    {
      width,
      characterSpacing: 0.7,
    },
  );
  document.moveDown(0.45);

  setBold(document, 18, COLORS.text).text(cleanText(item.title), {
    width,
    lineGap: 3,
  });
  document.moveDown(0.35);

  setRegular(document, 8.3, COLORS.muted).text(
    `${cleanText(item.itemCode)} / ${
      item.isRequired ? "필수 항목" : "일반 항목"
    } / 예상 ${item.weight}점`,
    {
      width,
    },
  );
  document.moveDown(1.1);

  document
    .roundedRect(x, document.y, width, 73, 9)
    .fillAndStroke(COLORS.surface, COLORS.border);
  const metaY = document.y + 12;

  setBold(document, 7.6, COLORS.muted).text("대상 URL", x + 13, metaY, {
    width: 70,
  });
  setRegular(document, 8.2, COLORS.text).text(
    cleanText(item.targetUrl),
    x + 83,
    metaY,
    {
      width: width - 96,
      lineGap: 2,
    },
  );

  setBold(document, 7.6, COLORS.muted).text(
    "최초 판정",
    x + 13,
    metaY + 32,
    {
      width: 70,
    },
  );
  const findingStatus = item.finding?.status
    ? FINDING_STATUS_LABELS[item.finding.status] ??
      cleanText(item.finding.status)
    : "원본 없음";
  const findingSeverity = item.finding?.severity
    ? SEVERITY_LABELS[item.finding.severity] ??
      cleanText(item.finding.severity)
    : "미확인";

  setRegular(document, 8.2, COLORS.text).text(
    `${findingStatus} / ${findingSeverity}`,
    x + 83,
    metaY + 32,
    {
      width: width - 96,
    },
  );

  document.y = metaY + 76;

  if (item.finding?.description) {
    writeTextBox(
      document,
      "현재 문제",
      item.finding.description,
      {
        background: "#FFF7ED",
        border: "#FED7AA",
        accent: "#F59E0B",
      },
    );
  }

  writeTextBox(document, "수정 요구사항", item.requirement, {
    background: COLORS.white,
    border: COLORS.border,
    accent: COLORS.primary,
  });

  writeTextBox(
    document,
    "개발자 전달용 문구",
    item.developerMessage,
    {
      background: COLORS.primarySoft,
      border: "#C7D2FE",
      accent: COLORS.primary,
    },
  );

  writeCriteria(document, item);
  writeEvidence(document, item);
}

function addFooters(
  document: PDFKit.PDFDocument,
  workOrder: PublicWorkOrder,
): void {
  const range = document.bufferedPageRange();

  for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
    document.switchToPage(range.start + pageIndex);
    const left = document.page.margins.left;
    const width = contentWidth(document);
    const y =
      document.page.height -
      document.page.margins.bottom -
      12;

    document
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .moveTo(left, y - 7)
      .lineTo(left + width, y - 7)
      .stroke();

    setRegular(document, 7.2, COLORS.muted).text(
      `${cleanText(workOrder.orderNumber)} / v${workOrder.version}`,
      left,
      y,
      {
        width: width * 0.7,
        lineBreak: false,
      },
    );

    setRegular(document, 7.2, COLORS.muted).text(
      `${pageIndex + 1} / ${range.count}`,
      left + width * 0.7,
      y,
      {
        width: width * 0.3,
        align: "right",
        lineBreak: false,
      },
    );
  }
}

export function workOrderPdfFilename(
  workOrder: Pick<PublicWorkOrder, "orderNumber" | "version">,
): string {
  return `${workOrder.orderNumber}-v${workOrder.version}.pdf`.replace(
    /[^A-Za-z0-9._-]/g,
    "-",
  );
}

export async function renderWorkOrderPdf(
  workOrder: PublicWorkOrder,
): Promise<Buffer> {
  const mainFontPath = requireFontPath(500);

  const document = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: {
      top: 45,
      right: 46,
      bottom: 50,
      left: 46,
    },
    info: {
      Title: `${cleanText(workOrder.site.name)} 수정 작업지시서`,
      Author: "Site AI Score",
      Subject: `${cleanText(workOrder.orderNumber)} v${workOrder.version}`,
      Keywords: "Site AI Score, AEO, 작업지시서",
      CreationDate: new Date(),
    },
  });

  document.registerFont(FONT_MAIN_NAME, mainFontPath);

  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);
  });

  writeCover(document, workOrder);

  workOrder.items.forEach((item, index) => {
    writeItemPage(document, workOrder, item, index);
  });

  document.addPage();
  writeSectionTitle(document, "이용 안내 및 면책");
  setRegular(document, 9.2, COLORS.text).text(
    "이 작업지시서는 명시된 검사 URL과 규칙 버전에서 발견된 문제를 기준으로 작성되었습니다. 고객 사이트의 소스코드를 제출할 필요는 없으며, 수정 후 배포된 공개 URL에서 완료 기준을 자동검수할 수 있어야 합니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
  document.moveDown(0.9);
  setRegular(document, 9.2, COLORS.text).text(
    "예상 점수 범위는 현재 규칙 배점을 기준으로 계산한 참고값입니다. 실제 점수 상승, AI 검색 노출, 추천 결과, 사이트 전체 보안성과 모든 기능의 무결성을 보장하지 않습니다.",
    {
      width: contentWidth(document),
      lineGap: 4,
    },
  );
  document.moveDown(1.2);
  setBold(document, 9, COLORS.primaryDark).text(
    "Site AI Score - 진단, 작업지시서, 독립 자동검수",
    {
      width: contentWidth(document),
    },
  );

  addFooters(document, workOrder);
  document.end();

  return completed;
}
