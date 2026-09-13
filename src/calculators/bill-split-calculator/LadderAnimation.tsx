"use client";

/**
 * 사다리타기 — 사다리타기(래더 게임) 애니메이션.
 *
 * ARCHITECTURE.md "5. 애니메이션 컴포넌트 구조" 계약을 그대로 구현한다: 이 컴포넌트는
 * `permutation`(이미 확정된 결과, calculateLadderSplit의 출력 필드 그대로)을 입력받아 그
 * 결과에 맞는 경로만 "그려서" 보여줄 뿐, 내부에서 매칭을 결정하지 않는다 — RNG 인자를 아예
 * 받지 않는다. ARCHITECTURE.md "5.1"이 명시한 "매칭 결과를 먼저 정하고 사다리 형태로만
 * 시각화하는 방식"을 채택한다(실제 가로줄 경로를 물리적으로 시뮬레이션하지 않음).
 *
 * **가로줄(rung) 배치는 2026-09-07부로 더 이상 무작위 장식이 아니다**(ARCHITECTURE.md
 * "5.1.1"). `ladder-layout.ts`의 `buildLadderRungs(permutation)`이 결정적으로 유도하는
 * `{ rungs, rowCount }`를 그대로 렌더링하고, 매칭 경로는 그 가로줄을 실제로 지나가는
 * rounded-corner 꺾은선으로 그린다 — "그려진 사다리를 실제로 타고 내려간다"는 시각적 근거를
 * 만들기 위함이다(사용자가 실제 브라우저 테스트에서 지적한 문제 수정).
 *
 * SVG + CSS 트랜지션만 사용한다(Canvas 금지). `onAnimationEnd` 호출 시점은 실제
 * `transitionend` 이벤트가 아니라 `LADDER_ANIMATION_DURATION_MS`와 값이 같은 `setTimeout`
 * 기반이다(jsdom 결정적 테스트 가능성, ARCHITECTURE.md "5.4").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { buildLadderRungs } from "./ladder-layout";
import type { LadderRung } from "./types";

export interface LadderAnimationProps {
  members: string[];
  amounts: number[];
  /** 이미 확정된 결과(calculateLadderSplit의 출력 필드 그대로). */
  permutation: number[];
  playAnimation: boolean;
  onAnimationEnd: () => void;
}

/** 경로 "그려지는" 애니메이션 지속시간(ms) — onAnimationEnd 타이밍 기준값이기도 하다. */
export const LADDER_ANIMATION_DURATION_MS = 2600;

/** ARCHITECTURE.md "7." 가이드라인 — 멤버 10명 초과면 세로줄 위에는 번호만 표시. */
const NAME_LABEL_THRESHOLD = 10;

const TOP_Y = 26;
/** rowCount가 작을 때(대략 11행 이하) 기존 고정 높이(194)를 그대로 유지(ARCHITECTURE.md "5.1.1"). */
const BASE_HEIGHT = 194;
/** 가로줄 사이 최소 간격 — 라벨·터치 여백 없이도 시각적으로 구분될 최소값. */
const MIN_ROW_GAP = 16;
/** 렌더링 CSS 높이(px) 하한 — rowCount=0일 때 기존 h-64(256px) 수준을 유지. */
const BASE_SVG_HEIGHT_PX = 220;
/** 렌더링 CSS 높이(px) 상한 — N=20 역순(37행)에서도 페이지 레이아웃이 과도하게 늘어나지 않게. */
const MAX_SVG_HEIGHT_PX = 520;
/** rowCount 1당 CSS 높이 증가폭(px). */
const HEIGHT_PER_ROW_PX = 8;
const COLUMN_WIDTH = 40;
const PADDING = 24;
/** 경로가 rung 교차 지점에서 꺾이는 코너의 둥근 반경(px) — MIN_ROW_GAP보다 확실히 작게 고정해
 * 위아래 다른 교차와 겹치지 않게 한다(ARCHITECTURE.md "5.1.1" "렌더링 — 매칭 경로"). */
const CORNER_RADIUS = 5;

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 매칭 경로 색상 — 룰렛과 동일한 이유로 절차적 HSL 팔레트를 쓴다(순수 장식). */
function laneColor(index: number, total: number): string {
  const hue = Math.round((360 / total) * index);
  return `hsl(${hue} 60% 50%)`;
}

/**
 * 임의의 행 `row`(0-indexed)의 Y좌표(ARCHITECTURE.md "5.1.1"):
 * `rowY(row) = TOP_Y + (row + 1) * (BOTTOM_Y - TOP_Y) / (rowCount + 1)`
 * 분모를 항상 `rowCount + 1`로 고정하므로(rowCount 단독이 아니라) `rowCount = 0`에서도 0으로
 * 나누지 않는다. `rowCount = 0`이면 `rungs`도 비어 있어 이 함수가 실제로 호출될 일이 없다.
 */
function rowY(row: number, rowCount: number, topY: number, bottomY: number): number {
  return topY + ((row + 1) * (bottomY - topY)) / (rowCount + 1);
}

interface PathPoint {
  x: number;
  y: number;
}

/**
 * 여러 직선 구간(폴리라인)을 각 교차 지점에서 작은 반경으로 둥글게 처리한 SVG `d` 문자열로
 * 만든다(ARCHITECTURE.md "5.1.1" "렌더링 — 매칭 경로" 절충안). 코너 반경은 인접한 두 구간
 * 길이의 절반을 넘지 않도록 잘라(`Math.min`) 짧은 구간에서 곡선이 겹치거나 넘치지 않게 한다.
 */
function roundedPolylinePath(points: PathPoint[], radius: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const toCurr = { x: curr.x - prev.x, y: curr.y - prev.y };
    const toNext = { x: next.x - curr.x, y: next.y - curr.y };
    const lenToCurr = Math.hypot(toCurr.x, toCurr.y);
    const lenToNext = Math.hypot(toNext.x, toNext.y);
    const r = Math.min(radius, lenToCurr / 2, lenToNext / 2);

    if (r <= 0.001 || lenToCurr === 0 || lenToNext === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const beforeCorner = {
      x: curr.x - (toCurr.x / lenToCurr) * r,
      y: curr.y - (toCurr.y / lenToCurr) * r,
    };
    const afterCorner = {
      x: curr.x + (toNext.x / lenToNext) * r,
      y: curr.y + (toNext.y / lenToNext) * r,
    };
    d += ` L ${beforeCorner.x} ${beforeCorner.y} Q ${curr.x} ${curr.y}, ${afterCorner.x} ${afterCorner.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * 멤버 한 명의 실제 경로 좌표(waypoint) 목록을 만든다 — `row` 오름차순으로 순회하며(정확히
 * `simulateFinalColumn`과 같은 순회 규칙) 그 멤버에 실제로 영향을 준 교차만 반영한다
 * ("현재 열 유지(수직 구간) → 교차 지점에서 인접 열로 이동(수평 구간)"의 반복). 결과 경로는
 * 화면에 그려지는 rung들을 정확히 지나가며, 도착 열은 `permutation[memberIndex]`와 항상
 * 일치한다(ladder-layout.ts "정확성 증명" — simulateFinalColumn과 동일한 순회 규칙이므로).
 */
function buildMemberPathPoints(
  startColumn: number,
  sortedRungs: LadderRung[],
  rowCount: number,
  topY: number,
  bottomY: number,
  xFor: (column: number) => number,
): PathPoint[] {
  let col = startColumn;
  const points: PathPoint[] = [{ x: xFor(col), y: topY }];

  for (const rung of sortedRungs) {
    let nextCol: number | null = null;
    if (rung.column === col) {
      nextCol = col + 1;
    } else if (rung.column + 1 === col) {
      nextCol = col - 1;
    }
    if (nextCol === null) continue;

    const y = rowY(rung.row, rowCount, topY, bottomY);
    points.push({ x: xFor(col), y }); // 수직 구간 끝(현재 열, 이 행까지 유지)
    points.push({ x: xFor(nextCol), y }); // 수평 구간 끝(인접 열로 교차)
    col = nextCol;
  }

  points.push({ x: xFor(col), y: bottomY }); // 마지막 수직 구간(최종 열까지)
  return points;
}

/** 경로 길이(line-drawing 애니메이션의 dash 길이 산정용) — 각 직선 구간 길이의 합. 코너의
 * 둥근 보정은 반경이 작아 무시해도 되는 수준이다(ARCHITECTURE.md "5.1.1"). */
function pathLength(points: PathPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

export function LadderAnimation({ members, amounts, permutation, playAnimation, onAnimationEnd }: LadderAnimationProps) {
  const n = members.length;
  const width = PADDING * 2 + COLUMN_WIDTH * Math.max(n - 1, 0);
  const xFor = (index: number) => PADDING + index * COLUMN_WIDTH;

  const { rungs, rowCount } = useMemo(() => buildLadderRungs(permutation), [permutation]);
  const bottomY = TOP_Y + Math.max(BASE_HEIGHT, (rowCount + 1) * MIN_ROW_GAP);
  const svgHeightPx = Math.min(MAX_SVG_HEIGHT_PX, BASE_SVG_HEIGHT_PX + rowCount * HEIGHT_PER_ROW_PX);

  const sortedRungs = useMemo(() => [...rungs].sort((a, b) => a.row - b.row), [rungs]);

  // playAnimation=true면 "숨김"에서 시작해 CSS 트랜지션으로 드러나야 한다(초기 플래시 방지).
  // 이 컴포넌트는 매 계산마다 ui.tsx가 `key`를 바꿔 다시 마운트하는 것을 전제로 한다.
  const [revealed, setRevealed] = useState(() => !playAnimation);
  const onAnimationEndRef = useRef(onAnimationEnd);
  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    if (!playAnimation) {
      onAnimationEndRef.current();
      return;
    }
    const startTimer = window.setTimeout(() => setRevealed(true), 20);
    const endTimer = window.setTimeout(() => onAnimationEndRef.current(), LADDER_ANIMATION_DURATION_MS);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [playAnimation]);

  const paths = useMemo(
    () =>
      members.map((_, memberIndex) => {
        const points = buildMemberPathPoints(memberIndex, sortedRungs, rowCount, TOP_Y, bottomY, xFor);
        return {
          memberIndex,
          d: roundedPolylinePath(points, CORNER_RADIUS),
          length: pathLength(points),
        };
      }),
    [members, sortedRungs, rowCount, bottomY],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${bottomY + 26}`}
        className="w-full max-w-full"
        style={{ height: `${svgHeightPx}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 세로줄(정적, 사다리의 "다리") */}
        {members.map((_, index) => (
          <line key={index} x1={xFor(index)} y1={TOP_Y} x2={xFor(index)} y2={bottomY} stroke="var(--border-strong)" strokeWidth={2} />
        ))}
        {/* 가로줄(rung) — buildLadderRungs(permutation)의 결정적 출력(더 이상 무작위 장식이
            아니다, ARCHITECTURE.md "5.1.1"). rungs가 비어 있으면(항등순열) 렌더링 루프 자체를
            건너뛴다(방어적 코딩 — 세로선만 그려진 사다리도 정상 케이스). */}
        {rungs.length > 0 &&
          rungs.map((rung, i) => {
            const y = rowY(rung.row, rowCount, TOP_Y, bottomY);
            return (
              <line key={i} x1={xFor(rung.column)} y1={y} x2={xFor(rung.column + 1)} y2={y} stroke="var(--border)" strokeWidth={2} />
            );
          })}
        {/* 상단 라벨 — 멤버 번호(또는 이름, N>10이면 번호만, ARCHITECTURE.md "7.") */}
        {members.map((name, index) => (
          <text key={index} x={xFor(index)} y={TOP_Y - 10} textAnchor="middle" fontSize={n > NAME_LABEL_THRESHOLD ? 9 : 11} fill="var(--foreground)">
            {n > NAME_LABEL_THRESHOLD ? index + 1 : name}
          </text>
        ))}
        {/* 하단 라벨 — 금액(원래 amounts 순서, 매칭 전 목록) */}
        {amounts.map((amount, index) => (
          <text key={index} x={xFor(index)} y={bottomY + 18} textAnchor="middle" fontSize={9} fill="var(--muted)">
            {wonFormatter.format(amount)}
          </text>
        ))}
        {/* 매칭 경로(멤버별, line-drawing 애니메이션) — 실제 rung 교차점을 지나는 꺾은선 */}
        {paths.map(({ memberIndex, d, length }) => (
          <path
            key={memberIndex}
            d={d}
            fill="none"
            stroke={laneColor(memberIndex, n)}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: length,
              strokeDashoffset: revealed ? 0 : length,
              transition: playAnimation ? `stroke-dashoffset ${LADDER_ANIMATION_DURATION_MS}ms ease-in-out` : "none",
            }}
          />
        ))}
      </svg>
      {/* RouletteWheel의 이름-번호 범례와 보조 정보 수준을 맞추기 위한 스크린리더 전용 목록
          (UX/UI Critic Q15 Low) — SVG 전체가 aria-hidden이라 시각 사용자에게는 이미 보이는
          참여 멤버·금액 후보 정보를 스크린리더 사용자에게도 동일하게 제공한다. */}
      <ul className="sr-only">
        <li>참여 멤버: {members.join(", ")}</li>
        <li>금액 후보: {amounts.map((amount) => `${wonFormatter.format(amount)}원`).join(", ")}</li>
      </ul>
    </div>
  );
}
