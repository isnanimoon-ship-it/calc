/**
 * 더치페이 계산기 — 표시용 포맷팅 + 방식별 핵심 결과 한 줄 요약 + 계산 근거(breakdown) 조립.
 *
 * ARCHITECTURE.md "11. Builder 인수인계 요약" 5번: `Intl.NumberFormat('ko-KR')` 통화 포맷,
 * `result.mode`별 핵심 결과 요약(공유 텍스트에도 재사용), breakdown 문구만 조립한다 — 숫자를
 * 새로 계산하지 않는다(이미 logic.ts가 확정한 값만 문자열로 가공).
 */

import type { BillSplitResult, EqualSplitResult, LadderSplitResult, WinnerTakeAllResult } from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 금액(원)을 "1,234,567원"으로 표시한다. */
export function formatWon(amount: number): string {
  return `${wonFormatter.format(amount)}원`;
}

/**
 * 짧은 문맥(핵심 결과 카드 eyebrow 배지, 애니메이션 진행 중 `SectionCard` 제목 등)에서 쓰는
 * 축약 라벨. 방식 선택 UI(라디오 라벨)의 풀네임은 이 상수가 아니라 `content.ts`의
 * `billSplitModeShortLabels`("인원별 금액설정(사다리타기)")를 쓴다 — 두 상수의 용도를
 * 섞어 쓰지 않는다(UX/UI Critic Q6, 모드명 표기 불일치 정리).
 */
export const billSplitModeLabels = {
  equal: "균등 분배",
  "winner-take-all": "한명 몰아주기",
  ladder: "사다리타기",
} as const;

/** 사다리타기의 "참고용 합계"(SPEC.md Should Have) — 재계산이 아니라 단순 합산 표시. */
export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * 핵심 결과 카드/공유 텍스트에 공통으로 쓰는 한 줄 요약(SPEC.md Should Have "핵심 결과 문구
 * 공유"). 계산 후 `ShareActions`의 `text`와 결과 카드 캡션이 항상 같은 문구를 쓰도록 이
 * 함수 하나로 통일한다.
 */
export function formatResultSummary(result: BillSplitResult): string {
  switch (result.mode) {
    case "equal":
      return `${result.members.length}명이 총 ${formatWon(result.totalAmount)}을 나눠 1인당 ${formatWon(result.baseShare)}${
        result.remainderCount > 0 ? `(일부는 +1원)` : ""
      }씩 부담합니다.`;
    case "winner-take-all":
      return `${result.selectedName}님이 ${formatWon(result.totalAmount)} 전액을 부담합니다.`;
    case "ladder":
      return `사다리타기로 ${result.members.length}명의 부담 금액(합계 ${formatWon(sumAmounts(result.amounts))})이 정해졌습니다.`;
  }
}

export interface BreakdownLine {
  label: string;
  detail: string;
}

/** 균등 분배 계산 근거(FORMULA.md "공식 ①" 나머지 처리 규칙을 일반 사용자용 문장으로). */
function buildEqualSplitBreakdown(result: EqualSplitResult): BreakdownLine[] {
  const n = result.members.length;
  const lines: BreakdownLine[] = [
    {
      label: "기본 배분액 계산",
      detail: `${formatWon(result.totalAmount)} ÷ ${n}명 = ${formatWon(result.baseShare)}(1인당 기본 금액, 나머지는 아래에서 배분)`,
    },
  ];
  if (result.remainderCount > 0) {
    const extraNames = result.members.slice(0, result.remainderCount).join(", ");
    lines.push({
      label: "나머지 배분",
      detail: `나누어떨어지지 않는 나머지 ${result.remainderCount}원은 입력 순서상 앞쪽 ${result.remainderCount}명(${extraNames})에게 1원씩 추가로 배분되어 총액과 정확히 일치합니다.`,
    });
  } else {
    lines.push({
      label: "나머지 배분",
      detail: "총 금액이 인원수로 정확히 나누어떨어져 추가 배분이 없습니다.",
    });
  }
  return lines;
}

/** 몰아주기 계산 근거(FORMULA.md "공식 ②" 공정성 논증을 일반 사용자용 문장으로). */
function buildWinnerTakeAllBreakdown(result: WinnerTakeAllResult): BreakdownLine[] {
  const n = result.members.length;
  return [
    {
      label: "무작위 선정",
      detail: `앱이 멤버 ${n}명 중 한 명을 완전히 무작위로 선정합니다(각자 선정될 확률 정확히 1/${n}, 표준 균등 난수 알고리즘).`,
    },
    {
      label: "선정 결과",
      detail: `이번 계산에서는 ${result.selectedName}님이 선정되어 총 금액 ${formatWon(result.totalAmount)} 전액을 부담하고, 나머지 멤버는 0원입니다.`,
    },
  ];
}

/** 사다리타기 계산 근거(FORMULA.md "공식 ③" Fisher-Yates 논증을 일반 사용자용 문장으로). */
function buildLadderBreakdown(result: LadderSplitResult): BreakdownLine[] {
  const n = result.members.length;
  return [
    {
      label: "무작위 매칭",
      detail: `Fisher-Yates 셔플(편향 없는 균등 무작위 순열 알고리즘)로 멤버와 금액을 1:1로 무작위 매칭합니다 — ${n}명이면 가능한 ${n}!가지 매칭이 모두 동일한 확률로 나올 수 있습니다.`,
    },
    {
      label: "매칭 결과",
      detail: "이번 계산에서 확정된 매칭은 위 결과 목록과 같습니다. 모든 멤버가 정확히 하나의 금액과 연결되며 중복·누락이 없습니다.",
    },
  ];
}

/** `result.mode`로 분기해 방식별 계산 근거 목록을 조립한다(화면 구성 10번, SPEC.md). */
export function buildBillSplitBreakdown(result: BillSplitResult): BreakdownLine[] {
  switch (result.mode) {
    case "equal":
      return buildEqualSplitBreakdown(result);
    case "winner-take-all":
      return buildWinnerTakeAllBreakdown(result);
    case "ladder":
      return buildLadderBreakdown(result);
  }
}
