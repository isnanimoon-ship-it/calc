import { describe, expect, it } from "vitest";
import { getGeneralPolicy, getParentsTogetherPolicy, parentsTogetherCaps } from "./policy";

describe("육아휴직급여 정책", () => {
  it("1~3개월 일반 상한", () => expect(getGeneralPolicy(3)).toMatchObject({ ratePercent:100, capWon:2_500_000 }));
  it("4~6개월 일반 상한", () => expect(getGeneralPolicy(4)).toMatchObject({ ratePercent:100, capWon:2_000_000 }));
  it("7개월 이후 일반 지급률과 상한", () => expect(getGeneralPolicy(18)).toMatchObject({ ratePercent:80, capWon:1_600_000 }));
  it("부모 함께 월별 상한", () => expect(parentsTogetherCaps).toEqual([2_500_000,2_500_000,3_000_000,3_500_000,4_000_000,4_500_000]));
  it("부모 함께 6개월째 상한", () => expect(getParentsTogetherPolicy(6).capWon).toBe(4_500_000));
});
