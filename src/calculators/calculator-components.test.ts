import { describe, expect, it } from "vitest";
import { calculatorRegistry } from "./registry";
import { hasCalculatorComponent } from "./calculator-components";

describe("calculator component mapping", () => {
  it("모든 published 계산기에 연결된 UI 컴포넌트가 있다", () => {
    const missing = calculatorRegistry
      .filter((calculator) => calculator.status === "published")
      .filter((calculator) => !hasCalculatorComponent(calculator.slug))
      .map((calculator) => calculator.slug);

    expect(missing).toEqual([]);
  });
});
