/**
 * 사다리타기 시각화 경로 재구성 알고리즘 —
 * tasks/bill-split-calculator/FORMULA.md "사다리타기 시각화 경로 재구성 알고리즘"
 * (2026-09-07 추가)의 의사코드를 그대로 옮긴 순수 함수 모음이다.
 *
 * 이미 확정된 `permutation`(calculateLadderSplit의 출력, Fisher-Yates가 만든 결과)을
 * **읽기 전용 입력**으로만 받아 화면 표시용 좌표 데이터(`LadderRung[]`)를 만든다. RNG를
 * 전혀 쓰지 않는 완전 결정적 함수이며 `permutation`을 바꾸거나 재계산하지 않는다 — 따라서
 * Calculation Auditor의 공정성 통계 검증 대상이 아니다(ARCHITECTURE.md "5.1.1" 참고).
 *
 * `logic.ts`에 두지 않고 이 파일로 분리한 이유는 ARCHITECTURE.md "5.1.1" "함수 배치" 참고 —
 * 돈/RNG를 다루는 `logic.ts`와 도메인 경계가 다르고, 컴포넌트 렌더링 없이 순수 함수로 직접
 * Golden Test(L1~L7, `ladder-layout.test.ts`)를 재현할 수 있어야 하기 때문이다.
 */

import type { LadderRung, LadderRungLayout } from "./types";

/**
 * 1단계 — 인접 전치(스왑) 생성("선택정렬 스타일 버블링"). FORMULA.md 의사코드:
 *
 * ```
 * function generateAdjacentSwaps(permutation):
 *   n = permutation.length
 *   target = new Array(n)
 *   for i in 0..n-1:
 *     target[permutation[i]] = i          // target = permutation의 역함수
 *
 *   current = [0, 1, ..., n-1]
 *   swapsInTimeOrder = []
 *
 *   for c from 0 to n-1:
 *     p = c
 *     while current[p] !== target[c]:
 *       p = p + 1
 *     while p > c:
 *       swapsInTimeOrder.push(p - 1)
 *       swap(current[p - 1], current[p])
 *       p = p - 1
 *
 *   return swapsInTimeOrder
 * ```
 *
 * RNG를 전혀 쓰지 않는 완전 결정적 순수 함수다(무작위성은 이미 `permutation`을 만든
 * Fisher-Yates 단계에서 전부 소비되었다). `permutation` 인자는 읽기만 하고 바꾸지 않는다.
 * 반환값은 시간순으로 정렬된 스왑 목록(각 원소는 "열 c와 c+1 사이"라는 열 번호)이다.
 */
export function generateAdjacentSwaps(permutation: number[]): number[] {
  const n = permutation.length;
  const target = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    target[permutation[i]] = i;
  }

  const current = Array.from({ length: n }, (_, i) => i);
  const swapsInTimeOrder: number[] = [];

  for (let c = 0; c < n; c++) {
    let p = c;
    while (current[p] !== target[c]) {
      p += 1;
    }
    while (p > c) {
      swapsInTimeOrder.push(p - 1);
      const tmp = current[p - 1];
      current[p - 1] = current[p];
      current[p] = tmp;
      p -= 1;
    }
  }

  return swapsInTimeOrder;
}

/**
 * 2단계 — 그리디 행 스케줄링. FORMULA.md 의사코드:
 *
 * ```
 * function scheduleSwapsIntoRows(swapsInTimeOrder, n):
 *   lastUsedRow = new Array(n).fill(-1)
 *   rungs = []
 *   for c of swapsInTimeOrder:
 *     row = max(lastUsedRow[c], lastUsedRow[c + 1]) + 1
 *     rungs.push({ row: row, column: c })
 *     lastUsedRow[c] = row
 *     lastUsedRow[c + 1] = row
 *   return rungs
 * ```
 *
 * (작업 지시 시그니처에 맞춰 `rowCount` 계산도 이 함수 안에서 함께 반환한다 — FORMULA.md의
 * `buildLadderRungs`가 계산하던 `rowCount = rungs.length === 0 ? 0 : max(rungs.map(r =>
 * r.row)) + 1`를 그대로 옮긴 것일 뿐, rung 배치 알고리즘 자체(행 배정 규칙)는 의사코드와
 * 한 글자도 다르지 않다.)
 */
export function scheduleSwapsIntoRows(swaps: number[], n: number): LadderRungLayout {
  const lastUsedRow = new Array<number>(n).fill(-1);
  const rungs: LadderRung[] = [];
  for (const c of swaps) {
    const row = Math.max(lastUsedRow[c], lastUsedRow[c + 1]) + 1;
    rungs.push({ row, column: c });
    lastUsedRow[c] = row;
    lastUsedRow[c + 1] = row;
  }
  const rowCount = rungs.length === 0 ? 0 : Math.max(...rungs.map((r) => r.row)) + 1;
  return { rungs, rowCount };
}

/**
 * `generateAdjacentSwaps` + `scheduleSwapsIntoRows`의 합성(FORMULA.md `buildLadderRungs`).
 * `permutation`을 읽기 전용으로만 받는 순수·결정적 함수 — RNG 없음, `permutation` 불변.
 */
export function buildLadderRungs(permutation: number[]): LadderRungLayout {
  const swaps = generateAdjacentSwaps(permutation);
  return scheduleSwapsIntoRows(swaps, permutation.length);
}

/**
 * 시뮬레이션(검증) 함수 — FORMULA.md 의사코드:
 *
 * ```
 * function simulateFinalColumn(rungs, startColumn):
 *   sorted = rungs를 row 오름차순으로 정렬(같은 row끼리는 서로 순서 무관)
 *   col = startColumn
 *   for rung of sorted:
 *     if rung.column === col:
 *       col = col + 1
 *     else if rung.column + 1 === col:
 *       col = col - 1
 *   return col
 * ```
 *
 * 핵심 불변식(FORMULA.md "요구사항 3번"): 모든 유효한 `permutation`과 모든 `i`
 * (`0 <= i < n`)에 대해 `simulateFinalColumn(buildLadderRungs(permutation).rungs, i)
 * === permutation[i]`가 항상 성립한다(FORMULA.md "정확성 증명" 참고). Builder/Auditor가
 * 이 불변식을 검증할 때 그대로 호출하는 함수다.
 */
export function simulateFinalColumn(rungs: LadderRung[], startColumn: number): number {
  const sorted = [...rungs].sort((a, b) => a.row - b.row);
  let col = startColumn;
  for (const rung of sorted) {
    if (rung.column === col) {
      col += 1;
    } else if (rung.column + 1 === col) {
      col -= 1;
    }
  }
  return col;
}
