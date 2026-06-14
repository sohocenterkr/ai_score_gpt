import { describe, expect, it } from "vitest";
import {
  getEndOfKSTDay,
  getNextKSTMidnight,
  getTodayKST,
  toKSTDateTime,
} from "./kst";

describe("KST date helpers", () => {
  it("KST 자정 직전과 직후의 날짜를 구분한다", () => {
    expect(getTodayKST("2026-06-14T14:59:59.000Z")).toBe("2026-06-14");
    expect(getTodayKST("2026-06-14T15:00:00.000Z")).toBe("2026-06-15");
  });

  it("연말 경계를 KST 기준으로 처리한다", () => {
    expect(getTodayKST("2025-12-31T15:00:00.000Z")).toBe("2026-01-01");
  });

  it("윤년 날짜를 보존한다", () => {
    expect(getTodayKST("2024-02-29T10:30:00.000Z")).toBe("2024-02-29");
  });

  it("KST 오프셋을 포함한 문자열을 반환한다", () => {
    expect(toKSTDateTime("2026-06-14T00:00:00.000Z")).toBe(
      "2026-06-14T09:00:00.000+09:00",
    );
  });

  it("KST 하루의 마지막 시각과 다음 자정을 계산한다", () => {
    expect(getEndOfKSTDay("2026-06-14").toISOString()).toBe(
      "2026-06-14T14:59:59.999Z",
    );
    expect(getNextKSTMidnight("2026-06-14T03:00:00.000Z").toISOString()).toBe(
      "2026-06-14T15:00:00.000Z",
    );
  });
});
