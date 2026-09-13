import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MAX_MEMBERS,
  MIN_AMOUNT,
  MIN_MEMBERS,
  parseBillSplitShareState,
  validateBillSplitInput,
  type RawBillSplitFormInput,
} from "./validation";

describe("validateBillSplitInput — 균등 분배/한명 몰아주기", () => {
  it("유효한 값이면 통과하고 숫자로 변환된 데이터를 반환한다", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "10,000", members: ["A", "B", "C"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ mode: "equal", totalAmount: 10_000, members: ["A", "B", "C"] });
    }
  });

  it("멤버 이름의 앞뒤 공백을 trim한다", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "1000", members: [" A ", "B"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.members).toEqual(["A", "B"]);
  });

  it("멤버 수 1명(최소 미달)은 오류", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "1000", members: ["A"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "members")).toBe(true);
  });

  it(`멤버 수 ${MIN_MEMBERS}명(경계값)은 통과`, () => {
    const raw: RawBillSplitFormInput = {
      mode: "equal",
      totalAmount: "1000",
      members: Array.from({ length: MIN_MEMBERS }, (_, i) => `M${i}`),
    };
    expect(validateBillSplitInput(raw).success).toBe(true);
  });

  it(`멤버 수 ${MAX_MEMBERS}명(경계값)은 통과, ${MAX_MEMBERS + 1}명(경계 초과)은 오류`, () => {
    const okRaw: RawBillSplitFormInput = {
      mode: "equal",
      totalAmount: "1000",
      members: Array.from({ length: MAX_MEMBERS }, (_, i) => `M${i}`),
    };
    expect(validateBillSplitInput(okRaw).success).toBe(true);

    const overRaw: RawBillSplitFormInput = {
      mode: "equal",
      totalAmount: "1000",
      members: Array.from({ length: MAX_MEMBERS + 1 }, (_, i) => `M${i}`),
    };
    const overResult = validateBillSplitInput(overRaw);
    expect(overResult.success).toBe(false);
  });

  it("빈 이름이 있으면 해당 인덱스에 오류를 태그한다", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "1000", members: ["A", "", "C"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "member-1")).toBe(true);
  });

  it("총 금액 누락은 오류", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "", members: ["A", "B"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "totalAmount")).toBe(true);
  });

  it("총 금액이 숫자가 아니면 오류", () => {
    const raw: RawBillSplitFormInput = { mode: "equal", totalAmount: "abc", members: ["A", "B"] };
    expect(validateBillSplitInput(raw).success).toBe(false);
  });

  it(`총 금액 하한(${MIN_AMOUNT}) 미만은 오류, 하한 그대로는 통과`, () => {
    expect(
      validateBillSplitInput({ mode: "equal", totalAmount: "0", members: ["A", "B"] }).success,
    ).toBe(false);
    expect(
      validateBillSplitInput({ mode: "equal", totalAmount: String(MIN_AMOUNT), members: ["A", "B"] }).success,
    ).toBe(true);
  });

  it(`총 금액 상한(${MAX_AMOUNT}) 초과는 오류, 상한 그대로는 통과`, () => {
    expect(
      validateBillSplitInput({ mode: "equal", totalAmount: String(MAX_AMOUNT + 1), members: ["A", "B"] }).success,
    ).toBe(false);
    expect(
      validateBillSplitInput({ mode: "equal", totalAmount: String(MAX_AMOUNT), members: ["A", "B"] }).success,
    ).toBe(true);
  });

  it("winner-take-all 모드도 동일한 규칙을 적용한다", () => {
    const raw: RawBillSplitFormInput = { mode: "winner-take-all", totalAmount: "5,000", members: ["A", "B"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ mode: "winner-take-all", totalAmount: 5000, members: ["A", "B"] });
  });
});

describe("validateBillSplitInput — 사다리타기", () => {
  it("유효한 값이면 통과한다", () => {
    const raw: RawBillSplitFormInput = {
      mode: "ladder",
      members: ["A", "B", "C"],
      amounts: ["1,000", "2,000", "3,000"],
    };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ mode: "ladder", members: ["A", "B", "C"], amounts: [1000, 2000, 3000] });
    }
  });

  it("amounts 길이가 members와 다르면 오류(UI 동기화 실패 방어)", () => {
    const raw: RawBillSplitFormInput = { mode: "ladder", members: ["A", "B", "C"], amounts: ["1000", "2000"] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "amounts")).toBe(true);
  });

  it("개별 금액이 빈 값/숫자가 아니면 해당 인덱스에 오류를 태그한다", () => {
    const raw: RawBillSplitFormInput = { mode: "ladder", members: ["A", "B"], amounts: ["1000", ""] };
    const result = validateBillSplitInput(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "amount-1")).toBe(true);
  });

  it("중복된 금액 값은 오류가 아니다(FORMULA.md 예외)", () => {
    const raw: RawBillSplitFormInput = { mode: "ladder", members: ["A", "B"], amounts: ["5,000", "5,000"] };
    expect(validateBillSplitInput(raw).success).toBe(true);
  });
});

describe("parseBillSplitShareState", () => {
  it("equal 상태를 정상 파싱한다", () => {
    const parsed = parseBillSplitShareState({ mode: "equal", totalAmount: 10_000, members: ["A", "B"] });
    expect(parsed).toEqual({ mode: "equal", totalAmount: 10_000, members: ["A", "B"] });
  });

  it("winner-take-all 상태를 정상 파싱한다", () => {
    const parsed = parseBillSplitShareState({
      mode: "winner-take-all",
      totalAmount: 10_000,
      members: ["A", "B", "C"],
      selectedIndex: 1,
    });
    expect(parsed).toEqual({ mode: "winner-take-all", totalAmount: 10_000, members: ["A", "B", "C"], selectedIndex: 1 });
  });

  it("winner-take-all에서 selectedIndex가 범위를 벗어나면 null", () => {
    const parsed = parseBillSplitShareState({
      mode: "winner-take-all",
      totalAmount: 10_000,
      members: ["A", "B"],
      selectedIndex: 5,
    });
    expect(parsed).toBeNull();
  });

  it("ladder 상태를 정상 파싱한다", () => {
    const parsed = parseBillSplitShareState({
      mode: "ladder",
      members: ["A", "B", "C"],
      amounts: [100, 200, 300],
      permutation: [2, 0, 1],
    });
    expect(parsed).toEqual({ mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300], permutation: [2, 0, 1] });
  });

  it("ladder에서 permutation이 완전한 순열이 아니면(중복/누락) null", () => {
    const parsed = parseBillSplitShareState({
      mode: "ladder",
      members: ["A", "B", "C"],
      amounts: [100, 200, 300],
      permutation: [0, 0, 2],
    });
    expect(parsed).toBeNull();
  });

  it("mode가 없거나 알 수 없는 값이면 null", () => {
    expect(parseBillSplitShareState({})).toBeNull();
    expect(parseBillSplitShareState({ mode: "unknown" })).toBeNull();
    expect(parseBillSplitShareState(null)).toBeNull();
    expect(parseBillSplitShareState("not-an-object")).toBeNull();
    expect(parseBillSplitShareState([1, 2, 3])).toBeNull();
  });

  it("멤버 수가 허용 범위를 벗어나면 null", () => {
    const parsed = parseBillSplitShareState({ mode: "equal", totalAmount: 1000, members: ["A"] });
    expect(parsed).toBeNull();
  });
});
