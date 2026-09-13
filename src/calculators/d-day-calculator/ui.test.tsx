import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DdayCalculatorUi from "./ui";

/**
 * 디데이 계산기 — UI 스모크 테스트(average-cost-calculator/loan-interest-calculator의
 * ui.test.tsx 선례와 동일 성격). 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이
 * 렌더링되고 모드 전환·폼 → 결과 흐름이 끊기지 않는지, 모드 전환 시 서로의 상태가 보존되는지만
 * 확인한다. 최종 판정은 QA의 몫이다.
 */
describe("DdayCalculatorUi", () => {
  it("기본 모드(디데이 계산)로 렌더링되고 목표일 없이 계산하면 오류를 표시한다", () => {
    render(<DdayCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "디데이 계산하기" }));
    expect(screen.getByText("목표일을 입력해 주세요.")).toBeInTheDocument();
  });

  it("모드 A: 샘플 값 채우기 후 계산하면 D-Day 표기와 계산 방법을 보여준다", () => {
    render(<DdayCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "디데이 계산하기" }));

    expect(screen.getByRole("heading", { name: "디데이" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "날짜 요약" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.queryByRole("heading", { name: "디데이" })).not.toBeInTheDocument();
  });

  it("모드 B로 전환해 샘플 값(오늘부터 100일 뒤)으로 계산하면 계산된 날짜를 보여준다", () => {
    render(<DdayCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: "날짜 계산" }));
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/일수/)).toHaveValue("100");

    fireEvent.click(screen.getByRole("button", { name: "날짜 계산하기" }));
    expect(screen.getByRole("heading", { name: "계산된 날짜" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "입력 요약" })).toBeInTheDocument();
  });

  it("모드를 전환해도 각 모드의 입력·결과가 서로 보존된다", () => {
    render(<DdayCalculatorUi />);

    // 모드 A 계산
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "디데이 계산하기" }));
    expect(screen.getByRole("heading", { name: "디데이" })).toBeInTheDocument();

    // 모드 B로 전환 — 아직 계산 전이므로 결과 없음
    fireEvent.click(screen.getByRole("radio", { name: "날짜 계산" }));
    expect(screen.queryByRole("heading", { name: "디데이" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "계산된 날짜" })).not.toBeInTheDocument();

    // 모드 B 계산
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "날짜 계산하기" }));
    expect(screen.getByRole("heading", { name: "계산된 날짜" })).toBeInTheDocument();

    // 모드 A로 되돌아가면 이전 계산 결과가 그대로 남아있어야 한다(상태 보존 요건).
    fireEvent.click(screen.getByRole("radio", { name: "디데이 계산" }));
    expect(screen.getByRole("heading", { name: "디데이" })).toBeInTheDocument();
  });

  it("모드 B: 일수 상한(100,000) 초과 입력은 오류를 표시하고 계산하지 않는다", () => {
    render(<DdayCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: "날짜 계산" }));
    fireEvent.change(screen.getByLabelText(/일수/), { target: { value: "100001" } });
    fireEvent.click(screen.getByRole("button", { name: "날짜 계산하기" }));
    expect(screen.getByText("일수는 100,000일까지 입력할 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "계산된 날짜" })).not.toBeInTheDocument();
  });
});
