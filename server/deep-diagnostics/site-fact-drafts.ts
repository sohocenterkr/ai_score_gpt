import type { SiteFactKey } from "./deep-diagnostic-admin-service";

interface FindingLike {
  ruleCode: string;
  evidence: unknown;
}

function evidenceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArrayValue(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim()),
  );
}

/**
 * QUICK 진단이 끝나면 원본 HTML은 저장하지 않고 해시만 남기므로, 초안은
 * Finding에 이미 구조화되어 저장된 원문(title, metaDescription, h1, h2)만
 * 사용합니다. 신뢰할 원문이 없는 필드(가격·문의방법·운영주체 등)는 잘못된
 * 내용이 "정답 기준"으로 굳어질 위험이 있어 초안을 만들지 않습니다.
 */
export function buildSiteFactDrafts(
  findings: readonly FindingLike[],
): Partial<Record<SiteFactKey, string>> {
  const findingsByRule = new Map(
    findings.map((finding) => [finding.ruleCode, evidenceRecord(finding.evidence)]),
  );

  const metaDescription = stringValue(
    findingsByRule.get("META-DESCRIPTION-001") ?? {},
    "metaDescription",
  );
  const h1Evidence =
    findingsByRule.get("STRUCT-H1-001") ??
    findingsByRule.get("CONTENT-HEADINGS-001") ??
    {};
  const h1 = stringArrayValue(h1Evidence, "h1")[0] ?? null;

  const drafts: Partial<Record<SiteFactKey, string>> = {};

  const definitionLines = [h1, metaDescription].filter(
    (line): line is string => Boolean(line),
  );

  if (definitionLines.length > 0) {
    drafts.service_definition = definitionLines.join("\n\n");
  }

  if (metaDescription) {
    drafts.primary_features = metaDescription;
  }

  return drafts;
}
