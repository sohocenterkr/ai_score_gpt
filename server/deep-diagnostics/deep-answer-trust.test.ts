import { describe, expect, it } from "vitest";
import {
  answerExplicitlyDoesNotIdentifyTarget,
} from "./deep-answer-trust";

describe("deep answer trust rules", () => {
  it("정확한 서비스를 확인하지 못했다는 답변을 식별 실패 신호로 찾는다", () => {
    expect(
      answerExplicitlyDoesNotIdentifyTarget(
        "정확히는 PostDrafter라는 서비스를 확인하지 못했습니다. 검색 결과에서는 비슷한 이름의 서비스가 보였습니다.",
      ),
    ).toBe(true);
  });

  it("정상적으로 서비스를 설명한 답변은 식별 실패로 보지 않는다", () => {
    expect(
      answerExplicitlyDoesNotIdentifyTarget(
        "PostDrafter는 사진과 음성 메모를 바탕으로 블로그 초안을 만드는 서비스입니다.",
      ),
    ).toBe(false);
  });
});
