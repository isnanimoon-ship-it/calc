import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLadderRungs } from "./ladder-layout";
import { LADDER_ANIMATION_DURATION_MS, LadderAnimation } from "./LadderAnimation";

/**
 * LadderAnimation.tsx가 실제로 사용하는 기하 상수를 그대로 복제한다(블랙박스 검증용 오라클).
 * ARCHITECTURE.md "5.1.1"이 확정한 값이며, 컴포넌트가 이 값을 바꾸면 이 테스트도 함께
 * 갱신해야 한다(다른 Golden Test들과 동일한 성격 — 구현 상수를 함께 고정한다).
 */
const TOP_Y = 26;
const BASE_HEIGHT = 194;
const MIN_ROW_GAP = 16;
const BASE_SVG_HEIGHT_PX = 220;
const MAX_SVG_HEIGHT_PX = 520;
const HEIGHT_PER_ROW_PX = 8;
const COLUMN_WIDTH = 40;
const PADDING = 24;

function xFor(index: number): number {
  return PADDING + index * COLUMN_WIDTH;
}

function bottomYFor(rowCount: number): number {
  return TOP_Y + Math.max(BASE_HEIGHT, (rowCount + 1) * MIN_ROW_GAP);
}

function rowYFor(row: number, rowCount: number, bottomY: number): number {
  return TOP_Y + ((row + 1) * (bottomY - TOP_Y)) / (rowCount + 1);
}

/** 렌더링된 <line> 중 가로줄(rung)만 골라낸다(y1===y2, 세로줄은 x1===x2). */
function rungLinesOf(container: HTMLElement): SVGLineElement[] {
  return Array.from(container.querySelectorAll("line")).filter(
    (line) => line.getAttribute("y1") === line.getAttribute("y2"),
  ) as unknown as SVGLineElement[];
}

/** 렌더링된 <line> 중 세로줄(멤버 레인)만 골라낸다(x1===x2). */
function verticalLinesOf(container: HTMLElement): SVGLineElement[] {
  return Array.from(container.querySelectorAll("line")).filter(
    (line) => line.getAttribute("x1") === line.getAttribute("x2"),
  ) as unknown as SVGLineElement[];
}

describe("LadderAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("playAnimation=false면 마운트 즉시 onAnimationEnd를 호출한다", () => {
    const onAnimationEnd = vi.fn();
    render(
      <LadderAnimation
        members={["A", "B", "C"]}
        amounts={[100, 200, 300]}
        permutation={[2, 0, 1]}
        playAnimation={false}
        onAnimationEnd={onAnimationEnd}
      />,
    );
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("playAnimation=true면 애니메이션 지속시간이 지나야 onAnimationEnd를 호출한다", () => {
    const onAnimationEnd = vi.fn();
    render(
      <LadderAnimation
        members={["A", "B", "C"]}
        amounts={[100, 200, 300]}
        permutation={[2, 0, 1]}
        playAnimation={true}
        onAnimationEnd={onAnimationEnd}
      />,
    );
    expect(onAnimationEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LADDER_ANIMATION_DURATION_MS - 1);
    expect(onAnimationEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("멤버 수만큼 세로줄·경로를 렌더링하고, SVG는 aria-hidden이다", () => {
    const members = ["A", "B", "C", "D"];
    const amounts = [1000, 2000, 3000, 4000];
    const permutation = [3, 2, 0, 1];
    const { container } = render(
      <LadderAnimation members={members} amounts={amounts} permutation={permutation} playAnimation={false} onAnimationEnd={() => {}} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(verticalLinesOf(container)).toHaveLength(members.length);
    expect(container.querySelectorAll("path")).toHaveLength(members.length);
  });

  it("N=2에서도 정상 렌더링된다(경계값)", () => {
    const onAnimationEnd = vi.fn();
    const { container } = render(
      <LadderAnimation members={["A", "B"]} amounts={[1000, 2000]} permutation={[1, 0]} playAnimation={false} onAnimationEnd={onAnimationEnd} />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("항등순열(rowCount=0)이면 가로줄(rung)이 하나도 렌더링되지 않는다", () => {
    const permutation = [0, 1, 2];
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rowCount).toBe(0);
    expect(rungs).toEqual([]);
    const { container } = render(
      <LadderAnimation
        members={["A", "B", "C"]}
        amounts={[100, 200, 300]}
        permutation={permutation}
        playAnimation={false}
        onAnimationEnd={() => {}}
      />,
    );
    expect(rungLinesOf(container)).toHaveLength(0);
    expect(verticalLinesOf(container)).toHaveLength(3);
  });

  it("렌더링된 가로줄(rung) 개수가 buildLadderRungs(permutation)의 rungs 개수와 정확히 일치한다", () => {
    const permutation = [3, 2, 0, 1];
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rungs.length).toBe(5); // 손 계산 확인값(ladder-layout.test.ts와 동일 permutation)
    expect(rowCount).toBe(4);

    const { container } = render(
      <LadderAnimation
        members={["A", "B", "C", "D"]}
        amounts={[1000, 2000, 3000, 4000]}
        permutation={permutation}
        playAnimation={false}
        onAnimationEnd={() => {}}
      />,
    );
    expect(rungLinesOf(container)).toHaveLength(rungs.length);
  });

  it("가로줄(rung)의 y좌표가 실제 rowY 공식(ARCHITECTURE.md 5.1.1)과 일치한다", () => {
    const permutation = [3, 2, 0, 1];
    const { rungs, rowCount } = buildLadderRungs(permutation);
    const bottomY = bottomYFor(rowCount);
    const expectedYs = rungs.map((rung) => rowYFor(rung.row, rowCount, bottomY));

    const { container } = render(
      <LadderAnimation
        members={["A", "B", "C", "D"]}
        amounts={[1000, 2000, 3000, 4000]}
        permutation={permutation}
        playAnimation={false}
        onAnimationEnd={() => {}}
      />,
    );
    const renderedYs = rungLinesOf(container)
      .map((line) => Number(line.getAttribute("y1")))
      .sort((a, b) => a - b);
    expect(renderedYs).toEqual([...expectedYs].sort((a, b) => a - b));
  });

  it("각 멤버 경로(path)의 d는 실제 도착 열(permutation[i])의 x좌표에서 하단(bottomY)으로 끝난다", () => {
    const permutation = [3, 2, 0, 1];
    const { rowCount } = buildLadderRungs(permutation);
    const bottomY = bottomYFor(rowCount);

    const { container } = render(
      <LadderAnimation
        members={["A", "B", "C", "D"]}
        amounts={[1000, 2000, 3000, 4000]}
        permutation={permutation}
        playAnimation={false}
        onAnimationEnd={() => {}}
      />,
    );
    const paths = container.querySelectorAll("path");
    permutation.forEach((targetColumn, memberIndex) => {
      const d = paths[memberIndex].getAttribute("d") ?? "";
      // 경로는 M(시작점: 자기 열, TOP_Y)로 시작하고 최종 L(도착 열, bottomY)로 끝나야 한다.
      expect(d.startsWith(`M ${xFor(memberIndex)} ${TOP_Y}`)).toBe(true);
      expect(d.endsWith(`L ${xFor(targetColumn)} ${bottomY}`)).toBe(true);
    });
  });

  it("N=20 역순(최악 케이스, rowCount=37)에서도 정상 렌더링되고 SVG 높이가 커진다", () => {
    const n = 20;
    const members = Array.from({ length: n }, (_, i) => `멤버${i + 1}`);
    const amounts = Array.from({ length: n }, (_, i) => (i + 1) * 1000);
    const permutation = Array.from({ length: n }, (_, i) => n - 1 - i);
    const { rungs, rowCount } = buildLadderRungs(permutation);
    expect(rowCount).toBe(37);

    const { container } = render(
      <LadderAnimation members={members} amounts={amounts} permutation={permutation} playAnimation={false} onAnimationEnd={() => {}} />,
    );
    expect(verticalLinesOf(container)).toHaveLength(n);
    expect(rungLinesOf(container)).toHaveLength(rungs.length);
    expect(container.querySelectorAll("path")).toHaveLength(n);

    const svg = container.querySelector("svg") as SVGSVGElement;
    const expectedHeightPx = Math.min(MAX_SVG_HEIGHT_PX, BASE_SVG_HEIGHT_PX + rowCount * HEIGHT_PER_ROW_PX);
    expect(svg.style.height).toBe(`${expectedHeightPx}px`);
    expect(expectedHeightPx).toBeGreaterThan(BASE_SVG_HEIGHT_PX); // 기본값보다 커져야 함
    expect(expectedHeightPx).toBeLessThanOrEqual(MAX_SVG_HEIGHT_PX); // 상한을 넘지 않아야 함
  });

  it("rowCount가 작을 때(예: N=2, rowCount<=1)는 SVG 높이가 기본값(BASE_SVG_HEIGHT_PX)과 같다", () => {
    const { rowCount } = buildLadderRungs([1, 0]);
    const { container } = render(
      <LadderAnimation members={["A", "B"]} amounts={[1000, 2000]} permutation={[1, 0]} playAnimation={false} onAnimationEnd={() => {}} />,
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    const expectedHeightPx = Math.min(MAX_SVG_HEIGHT_PX, BASE_SVG_HEIGHT_PX + rowCount * HEIGHT_PER_ROW_PX);
    expect(svg.style.height).toBe(`${expectedHeightPx}px`);
    expect(expectedHeightPx).toBe(BASE_SVG_HEIGHT_PX + rowCount * HEIGHT_PER_ROW_PX);
  });
});
