import { describe, expect, it } from "vitest";
import {
  calculatorRegistry,
  getCalculatorBySlug,
  getPublishedCalculators,
} from "./registry";

describe("calculatorRegistry", () => {
  // (2026-09-02 정정) severance-pay는 tasks/severance-pay/EVALUATION.md 최종 판정(PASS)에 따라
  // status가 draft→published로 전환됐다(registry.ts 주석·최종 판정 근거 참고). 이 테스트는 원래
  // "severance-pay가 draft일 때 목록에서 제외되는지"를 확인했으나, 그 전제 자체가 더 이상 사실이
  // 아니므로 현재 상태(published)에 맞게 갱신한다. getPublishedCalculators()의 필터 로직
  // 자체("status가 published인 항목만 반환")는 아래에서 일반적으로 검증한다.
  it("getPublishedCalculators()는 status가 published인 항목만 반환한다", () => {
    const published = getPublishedCalculators();
    expect(published.length).toBeGreaterThan(0);
    expect(published.every((c) => c.status === "published")).toBe(true);
    expect(
      calculatorRegistry
        .filter((c) => c.status !== "published")
        .every((c) => !published.some((p) => p.slug === c.slug)),
    ).toBe(true);
  });

  it("severance-pay는 published 상태이며 공개 목록에 포함된다", () => {
    const severancePay = calculatorRegistry.find(
      (c) => c.slug === "severance-pay",
    );
    expect(severancePay?.status).toBe("published");
    expect(
      getPublishedCalculators().some((c) => c.slug === "severance-pay"),
    ).toBe(true);
  });

  it("finds a calculator by slug regardless of status", () => {
    expect(getCalculatorBySlug("severance-pay")?.slug).toBe("severance-pay");
    expect(getCalculatorBySlug("does-not-exist")).toBeUndefined();
  });
});
