import { describe, expect, it } from "vitest";
import { buildLadderRungs, generateAdjacentSwaps, scheduleSwapsIntoRows, simulateFinalColumn } from "./ladder-layout";

/**
 * FORMULA.md "사다리타기 시각화 경로 재구성 알고리즘" Golden Test L1~L7을 그대로 옮긴다.
 * 모두 `buildLadderRungs`(1+2단계)와 `simulateFinalColumn`을 손으로 직접 추적해 확인한 값
 * 이다(FORMULA.md 문서 참고).
 */

/** 결정적 시드 기반 PRNG(mulberry32) — CI에서 매번 같은 무작위 순열을 재현하기 위함. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 테스트 전용 랜덤 순열 생성기(Fisher-Yates) — 알고리즘 검증용 입력 생성일 뿐, 공정성 검증
 * 대상이 아니다(그 검증은 logic.test.ts/Calculation Auditor 영역). */
function randomPermutation(n: number, rng: () => number): number[] {
  const result = Array.from({ length: n }, (_, i) => i);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

describe("ladder-layout — Golden Test L1~L7", () => {
  it("L1 — N=2, 항등순열(교차 없음)", () => {
    const permutation = [0, 1];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([]);
    expect(rowCount).toBe(0);
    expect(simulateFinalColumn(rungs, 0)).toBe(permutation[0]);
    expect(simulateFinalColumn(rungs, 1)).toBe(permutation[1]);
  });

  it("L2 — N=2, 역순(교차 1회)", () => {
    const permutation = [1, 0];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([0]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([{ row: 0, column: 0 }]);
    expect(rowCount).toBe(1);
    expect(simulateFinalColumn(rungs, 0)).toBe(permutation[0]);
    expect(simulateFinalColumn(rungs, 1)).toBe(permutation[1]);
  });

  it("L3 — N=3, 역순(permutation=[2,1,0])", () => {
    const permutation = [2, 1, 0];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([1, 0, 1]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 2, column: 1 },
    ]);
    expect(rowCount).toBe(3);
    for (let i = 0; i < permutation.length; i++) {
      expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
    }
  });

  it("L4 — N=3, 비-역순 순환(permutation=[1,2,0])", () => {
    const permutation = [1, 2, 0];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([1, 0]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ]);
    expect(rowCount).toBe(2);
    for (let i = 0; i < permutation.length; i++) {
      expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
    }
  });

  it("L5 — N=4, 역순(permutation=[3,2,1,0]), 4명 전원 시뮬레이션", () => {
    const permutation = [3, 2, 1, 0];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([2, 1, 0, 2, 1, 2]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([
      { row: 0, column: 2 },
      { row: 1, column: 1 },
      { row: 2, column: 0 },
      { row: 2, column: 2 },
      { row: 3, column: 1 },
      { row: 4, column: 2 },
    ]);
    expect(rowCount).toBe(5);
    for (let i = 0; i < permutation.length; i++) {
      expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
    }
  });

  it("L6 — N=5, 역순(permutation=[4,3,2,1,0]), 5명 전원 시뮬레이션", () => {
    const permutation = [4, 3, 2, 1, 0];
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps).toEqual([3, 2, 1, 0, 3, 2, 1, 3, 2, 3]);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs).toEqual([
      { row: 0, column: 3 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
      { row: 3, column: 0 },
      { row: 2, column: 3 },
      { row: 3, column: 2 },
      { row: 4, column: 1 },
      { row: 4, column: 3 },
      { row: 5, column: 2 },
      { row: 6, column: 3 },
    ]);
    expect(rowCount).toBe(7);
    for (let i = 0; i < permutation.length; i++) {
      expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
    }
  });

  it("L7 — N=20, 역순 순열, 행 수 상한 확인(37행)", () => {
    const n = 20;
    const permutation = Array.from({ length: n }, (_, i) => n - 1 - i);
    const swaps = generateAdjacentSwaps(permutation);
    expect(swaps.length).toBe((n * (n - 1)) / 2); // 190
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rowCount).toBe(2 * n - 3); // 37
    for (let i = 0; i < permutation.length; i++) {
      expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
    }
  });
});

describe("ladder-layout — 중간 단계 함수(합성 확인)", () => {
  it("buildLadderRungs(permutation)은 scheduleSwapsIntoRows(generateAdjacentSwaps(permutation), n)와 동일하다", () => {
    const permutation = [2, 0, 3, 1];
    const swaps = generateAdjacentSwaps(permutation);
    const viaComposition = scheduleSwapsIntoRows(swaps, permutation.length);
    const viaBuild = buildLadderRungs(permutation);
    expect(viaBuild).toEqual(viaComposition);
  });

  it("generateAdjacentSwaps는 입력 permutation 배열을 변경하지 않는다", () => {
    const permutation = [2, 1, 0];
    const snapshot = [...permutation];
    generateAdjacentSwaps(permutation);
    expect(permutation).toEqual(snapshot);
  });
});

describe("ladder-layout — 핵심 불변식(N=2~20, 무작위 순열 대량 검증)", () => {
  const rng = mulberry32(20260907);
  const TRIALS_PER_N = 200;

  for (let n = 2; n <= 20; n++) {
    it(`N=${n} — simulateFinalColumn(buildLadderRungs(permutation).rungs, i) === permutation[i] (모든 i, ${TRIALS_PER_N}회 무작위 순열)`, () => {
      for (let trial = 0; trial < TRIALS_PER_N; trial++) {
        const permutation = randomPermutation(n, rng);
        const { rungs } = buildLadderRungs(permutation);
        for (let i = 0; i < n; i++) {
          expect(simulateFinalColumn(rungs, i)).toBe(permutation[i]);
        }
      }
    });
  }

  it("항상 rowCount = (rungs.length === 0 ? 0 : max(row) + 1)이 성립한다(무작위 순열, N=2~20)", () => {
    for (let n = 2; n <= 20; n++) {
      for (let trial = 0; trial < 20; trial++) {
        const permutation = randomPermutation(n, rng);
        const { rungs, rowCount } = buildLadderRungs(permutation);
        const expected = rungs.length === 0 ? 0 : Math.max(...rungs.map((r) => r.row)) + 1;
        expect(rowCount).toBe(expected);
      }
    }
  });

  it("같은 행에 배정된 두 rung은 열을 공유하지 않는다(요구사항 4번, 무작위 순열, N=2~20)", () => {
    for (let n = 2; n <= 20; n++) {
      for (let trial = 0; trial < 20; trial++) {
        const permutation = randomPermutation(n, rng);
        const { rungs } = buildLadderRungs(permutation);
        const byRow = new Map<number, number[]>();
        for (const rung of rungs) {
          const columns = byRow.get(rung.row) ?? [];
          columns.push(rung.column);
          byRow.set(rung.row, columns);
        }
        for (const columns of byRow.values()) {
          const touched = new Set<number>();
          for (const column of columns) {
            expect(touched.has(column)).toBe(false);
            expect(touched.has(column + 1)).toBe(false);
            touched.add(column);
            touched.add(column + 1);
          }
        }
      }
    }
  });
});
