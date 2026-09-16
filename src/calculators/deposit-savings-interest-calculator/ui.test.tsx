import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DepositSavingsInterestCalculatorUi from "./ui";

/**
 * 예금·적금 이자 계산기 — UI 스모크 테스트(loan-interest-calculator/ui.test.tsx 선례).
 * 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고 모드 전환·폼 →
 * 결과 흐름이 끊기지 않는지만 확인한다. 최종 판정은 QA의 몫이다.
 */
describe("DepositSavingsInterestCalculatorUi", () => {
  it("필수값 없이 예금을 계산하면 필드별 오류를 표시한다", () => {
    render(<DepositSavingsInterestCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "예금 이자 계산하기" }));
    expect(screen.getByText("연이율을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("기간(개월)을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("예치 원금을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("이자 계산 방식(단리/월복리)을 선택해 주세요.")).toBeInTheDocument();
  });

  it("샘플 값(FORMULA 예제 1, 예금 단리)으로 계산하면 세후 만기수령액 10,253,800원을 보여준다", () => {
    render(<DepositSavingsInterestCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/예치 원금/)).toHaveValue("10,000,000");

    fireEvent.click(screen.getByRole("button", { name: "예금 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "세후 만기수령액" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("10,253,800원");
    expect(keyResultCard.textContent).toContain("단리");

    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "회차별 납입·이자 내역" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/예치 원금/)).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "세후 만기수령액" })).not.toBeInTheDocument();
  });

  it("월복리를 선택하면 결과에 월이율이 함께 표시된다(예제 5 정밀 재계산 확정값)", () => {
    render(<DepositSavingsInterestCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("radio", { name: /월복리/ }));
    fireEvent.click(screen.getByRole("button", { name: "예금 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "세후 만기수령액" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("10,257,319원");
    expect(keyResultCard.textContent).toContain("월복리");
    expect(keyResultCard.textContent).toContain("월이율");
  });

  it("적금 모드로 전환해 샘플(예제 7)로 계산하면 세후 만기수령액과 회차별 표를 보여준다", () => {
    render(<DepositSavingsInterestCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "적금 계산" }));
    expect(screen.queryByLabelText(/예치 원금/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/월 납입액/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/월 납입액/)).toHaveValue("500,000");

    fireEvent.click(screen.getByRole("button", { name: "적금 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "세후 만기수령액" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("6,082,485원");

    const scheduleSection = screen
      .getByRole("heading", { name: "회차별 납입·이자 내역" })
      .closest("section") as HTMLElement;
    const rows = within(scheduleSection).getAllByRole("row");
    // 헤더 1행 + 12회차 = 13행.
    expect(rows).toHaveLength(13);
  });

  it("적금 모드에서 월 납입액 없이 계산하면 오류를 표시하고 계산하지 않는다", () => {
    render(<DepositSavingsInterestCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "적금 계산" }));
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/기간/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "적금 이자 계산하기" }));

    expect(screen.getByText("월 납입액을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "세후 만기수령액" })).not.toBeInTheDocument();
  });

  it("필수 입력에는 aria-required가 붙는다(이자 계산 방식 라디오 포함)", () => {
    render(<DepositSavingsInterestCalculatorUi />);

    expect(screen.getByLabelText(/연이율/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/기간/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/예치 원금/)).toHaveAttribute("aria-required", "true");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-required", "true");
    }
  });
});
