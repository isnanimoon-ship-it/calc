import { describe, expect, it } from "vitest";
import withholdingTable2026 from "@/src/data/withholding-tax-table-2026.json";
import {
  isWithinWithholdingTableRange,
  lookupWithholdingTaxRow,
  WITHHOLDING_TABLE_RANGE,
  type WithholdingTaxRow,
} from "./withholding-table";

// JSON import는 각 행의 taxByFamilyCount를 리터럴 키(1~11) 타입으로 좁혀 추론하므로,
// 문자열 변수로 인덱싱하는 아래 테스트들을 위해 withholding-table.ts와 동일한
// Record<string, number> 타입으로 넓힌다(실제 값은 그대로, 타입만 재선언).
const rows = withholdingTable2026.rows as WithholdingTaxRow[];
const FAMILY_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

describe("withholding-tax-table-2026.json 구조 불변식", () => {
  // 오케스트레이터가 이미 검증했지만(회귀 방지용) Builder도 동일 불변식을 테스트로 고정한다
  // (ARCHITECTURE.md "2. Builder의 파싱 정확성 검증 방법").

  it("행이 minWon 오름차순으로 정렬돼 있다", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].minWon).toBeGreaterThan(rows[i - 1].minWon);
    }
  });

  it("인접 행 사이에 틈이나 겹침이 없다(rows[i].maxWon === rows[i+1].minWon)", () => {
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].maxWon).toBe(rows[i + 1].minWon);
    }
  });

  it("첫 행의 minWon과 마지막 행의 maxWon이 range와 일치한다", () => {
    expect(rows[0].minWon).toBe(WITHHOLDING_TABLE_RANGE.minWon);
    expect(rows[0].minWon).toBe(770_000);
    expect(rows[rows.length - 1].maxWon).toBe(WITHHOLDING_TABLE_RANGE.maxWon);
    expect(rows[rows.length - 1].maxWon).toBe(10_000_000);
  });

  it("모든 행이 '1'~'11' 11개 키를 빠짐없이 갖는다", () => {
    for (const row of rows) {
      expect(Object.keys(row.taxByFamilyCount).sort()).toEqual([...FAMILY_KEYS].sort());
    }
  });

  it("모든 세액 값이 0 이상이고 10원의 배수다", () => {
    for (const row of rows) {
      for (const key of FAMILY_KEYS) {
        const value = row.taxByFamilyCount[key];
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value % 10).toBe(0);
      }
    }
  });

  it("가족 수가 늘어날수록 세액이 비증가한다(동일 행 내)", () => {
    for (const row of rows) {
      for (let i = 1; i < FAMILY_KEYS.length; i++) {
        expect(row.taxByFamilyCount[FAMILY_KEYS[i]]).toBeLessThanOrEqual(
          row.taxByFamilyCount[FAMILY_KEYS[i - 1]],
        );
      }
    }
  });
});

describe("isWithinWithholdingTableRange", () => {
  it("770,000원 이상 10,000,000원 미만이면 true", () => {
    expect(isWithinWithholdingTableRange(770_000)).toBe(true);
    expect(isWithinWithholdingTableRange(9_999_999)).toBe(true);
  });

  it("770,000원 미만 또는 10,000,000원 이상이면 false", () => {
    expect(isWithinWithholdingTableRange(769_999)).toBe(false);
    expect(isWithinWithholdingTableRange(10_000_000)).toBe(false);
  });
});

describe("lookupWithholdingTaxRow — FORMULA.md Golden Test 대조(표 조회 케이스)", () => {
  it("예제 1: [3,000,000, 3,020,000) × 가족1명 = 74,350원", () => {
    const row = lookupWithholdingTaxRow(3_000_000);
    expect(row?.minWon).toBe(3_000_000);
    expect(row?.maxWon).toBe(3_020_000);
    expect(row?.taxByFamilyCount["1"]).toBe(74_350);
  });

  it("예제 2: [4,000,000, 4,020,000) × 가족1명 = 195,960원", () => {
    const row = lookupWithholdingTaxRow(4_000_000);
    expect(row?.taxByFamilyCount["1"]).toBe(195_960);
  });

  it("예제 3: [5,000,000, 5,020,000) × 가족1명 = 335,470원", () => {
    const row = lookupWithholdingTaxRow(5_000_000);
    expect(row?.taxByFamilyCount["1"]).toBe(335_470);
  });

  it("예제 4: [2,000,000, 2,010,000) × 가족1명 = 19,520원", () => {
    const row = lookupWithholdingTaxRow(2_000_000);
    expect(row?.taxByFamilyCount["1"]).toBe(19_520);
  });

  it("예제 5: 1,050,000원 구간은 0원(간이세액표 0원 구간)", () => {
    const row = lookupWithholdingTaxRow(1_050_000);
    expect(row?.taxByFamilyCount["1"]).toBe(0);
  });

  it("예제 6: 1,060,000원(0원→과세 전환 경계값) × 가족1명 = 1,040원", () => {
    const row = lookupWithholdingTaxRow(1_060_000);
    expect(row?.minWon).toBe(1_060_000);
    expect(row?.maxWon).toBe(1_065_000);
    expect(row?.taxByFamilyCount["1"]).toBe(1_040);
  });

  it("경계값: 1,059,999원은 여전히 이전 행(0원 구간)에 속한다", () => {
    const row = lookupWithholdingTaxRow(1_059_999);
    expect(row?.taxByFamilyCount["1"]).toBe(0);
  });

  it("예제 7: [3,000,000, 3,020,000) × 가족2명 = 56,850원", () => {
    const row = lookupWithholdingTaxRow(3_000_000);
    expect(row?.taxByFamilyCount["2"]).toBe(56_850);
  });

  it("예제 8: [3,000,000, 3,020,000) × 가족3명(자녀공제 전) = 31,940원", () => {
    const row = lookupWithholdingTaxRow(3_000_000);
    expect(row?.taxByFamilyCount["3"]).toBe(31_940);
  });

  it("예제 9: [3,000,000, 3,020,000) × 가족4명(자녀공제 전) = 26,690원", () => {
    const row = lookupWithholdingTaxRow(3_000_000);
    expect(row?.taxByFamilyCount["4"]).toBe(26_690);
  });

  it("범위 밖(770,000원 미만, 10,000,000원 이상)은 null을 반환한다", () => {
    expect(lookupWithholdingTaxRow(769_999)).toBeNull();
    expect(lookupWithholdingTaxRow(10_000_000)).toBeNull();
  });
});
