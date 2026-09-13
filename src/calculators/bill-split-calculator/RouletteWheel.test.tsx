import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ROULETTE_ANIMATION_DURATION_MS, RouletteWheel } from "./RouletteWheel";

/**
 * ARCHITECTURE.md "5.4" — onAnimationEnd는 실제 transitionend 이벤트가 아니라 CSS 트랜지션
 * 시간과 값이 같은 setTimeout 기반이므로, jsdom + vitest fake timers로 결정적으로 검증한다.
 * 이 컴포넌트는 순수 연출이므로 실제 선정 로직(logic.test.ts)과 독립적으로 props 계약만
 * 검증한다(SPEC.md "애니메이션 유무와 무관하게 결과가 같아야 한다").
 */
describe("RouletteWheel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("playAnimation=false면 마운트 즉시 onAnimationEnd를 호출한다", () => {
    const onAnimationEnd = vi.fn();
    render(
      <RouletteWheel members={["A", "B", "C"]} selectedIndex={1} playAnimation={false} onAnimationEnd={onAnimationEnd} />,
    );
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("playAnimation=true면 애니메이션 지속시간이 지나야 onAnimationEnd를 호출한다", () => {
    const onAnimationEnd = vi.fn();
    render(
      <RouletteWheel members={["A", "B", "C"]} selectedIndex={1} playAnimation={true} onAnimationEnd={onAnimationEnd} />,
    );
    expect(onAnimationEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ROULETTE_ANIMATION_DURATION_MS - 1);
    expect(onAnimationEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it("멤버 수만큼 부채꼴(path)과 범례 항목을 렌더링하고, SVG는 aria-hidden이다", () => {
    const members = ["철수", "영희", "민수", "지은"];
    const { container } = render(
      <RouletteWheel members={members} selectedIndex={0} playAnimation={false} onAnimationEnd={() => {}} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("path")).toHaveLength(members.length);
    expect(container.querySelectorAll("li")).toHaveLength(members.length);
    members.forEach((name) => {
      expect(container.textContent).toContain(name);
    });
  });

  it("N=2에서도 정상 렌더링된다(경계값)", () => {
    const onAnimationEnd = vi.fn();
    const { container } = render(
      <RouletteWheel members={["A", "B"]} selectedIndex={0} playAnimation={false} onAnimationEnd={onAnimationEnd} />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });
});
