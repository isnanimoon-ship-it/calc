import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoanInterestCalculatorUi from "./ui";

/**
 * 대출 이자 계산기 — UI 스모크 테스트(housing-subscription-score/ui.test.tsx 선례).
 * 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고 폼 → 결과 흐름이
 * 끊기지 않는지만 확인한다. 최종 판정은 QA의 몫이다.
 */
describe("LoanInterestCalculatorUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다", () => {
    render(<LoanInterestCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));
    expect(screen.getByText("대출 원금을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("연이율을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("상환방식을 선택해 주세요.")).toBeInTheDocument();
  });

  it("샘플 값(FORMULA 예제 5, 원리금균등상환)으로 계산하면 매월 상환액 659,956원을 보여준다", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/대출 원금/)).toHaveValue("100,000,000");
    expect(screen.getByLabelText("년")).toHaveValue("20");

    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "매월 상환액" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("659,956원");
    expect(keyResultCard.textContent).toContain("원리금균등상환");

    expect(screen.getByRole("heading", { name: "연도별 상환 스케줄 요약" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/대출 원금/)).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "매월 상환액" })).not.toBeInTheDocument();
  });

  it("원금균등상환을 선택하면 핵심 결과가 '첫 회차 ~ 마지막 회차 상환액' 범위로 표시된다", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/대출 원금/), { target: { value: "12000000" } });
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("년"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: /원금균등상환/ }));
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "첫 회차 ~ 마지막 회차 상환액" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("1,120,000원 ~ 1,010,000원");
  });

  it("만기일시상환을 선택하면 '매월 이자'와 '만기 상환액'이 구분되어 표시된다", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/대출 원금/), { target: { value: "10000000" } });
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("년"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: /만기일시상환/ }));
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    const keyResultCard = screen
      .getByRole("heading", { name: "매월 이자(만기 전, 고정)" })
      .closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("50,000원");
    expect(keyResultCard.textContent).toContain("만기 상환액");
    expect(keyResultCard.textContent).toContain("10,050,000원");
  });

  it("대출 기간 합계가 480개월을 초과하면 오류를 표시하고 계산하지 않는다(40년 1개월)", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/대출 원금/), { target: { value: "10000000" } });
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("년"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: /원리금균등상환/ }));
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    expect(screen.getByText(/480개월\(40년\) 이하로 입력해 주세요\./)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "매월 상환액" })).not.toBeInTheDocument();
  });

  it("'개월' 필드에 12 이상을 입력하면 자동으로 '년'을 올리고 나머지 개월로 정규화한다(UX/UI Critic Medium #6)", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "18" } });

    expect(screen.getByLabelText("년")).toHaveValue("1");
    expect(screen.getByLabelText("개월")).toHaveValue("6");
  });

  it("'년'에 이미 값이 있는 상태에서 '개월'에 12 이상을 입력하면 기존 '년' 값에 더해 정규화한다", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText("년"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "30" } });

    // 2년 + (30개월 = 2년 6개월) = 4년 6개월
    expect(screen.getByLabelText("년")).toHaveValue("4");
    expect(screen.getByLabelText("개월")).toHaveValue("6");
  });

  it("'개월'에 11 이하 값은 정규화 없이 그대로 반영된다(회귀 확인)", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "11" } });

    expect(screen.getByLabelText("년")).toHaveValue("");
    expect(screen.getByLabelText("개월")).toHaveValue("11");
  });

  it("년+개월 합산 오류는 '년'·'개월' 두 입력 모두의 aria-describedby에 연결된다(UX/UI Critic Low #5)", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/대출 원금/), { target: { value: "10000000" } });
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("년"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: /원리금균등상환/ }));
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    const groupError = screen.getByText(/480개월\(40년\) 이하로 입력해 주세요\./);
    const errorId = groupError.getAttribute("id");
    expect(errorId).toBeTruthy();
    expect(screen.getByLabelText("년").getAttribute("aria-describedby")).toContain(errorId);
    expect(screen.getByLabelText("개월").getAttribute("aria-describedby")).toContain(errorId);
    expect(screen.getByLabelText("년")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("개월")).toHaveAttribute("aria-invalid", "true");
  });

  it("연이율 0%에서 원금균등상환은 첫 회차~마지막 회차 대신 '매 회차 상환액'을 단일 값으로 보여준다(UX/UI Critic Low #8)", () => {
    render(<LoanInterestCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/대출 원금/), { target: { value: "6000000" } });
    fireEvent.change(screen.getByLabelText(/연이율/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("년"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("개월"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("radio", { name: /원금균등상환/ }));
    fireEvent.click(screen.getByRole("button", { name: "대출 이자 계산하기" }));

    const keyResultCard = screen.getByRole("heading", { name: "매 회차 상환액" }).closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("1,000,000원 (동일)");
    expect(keyResultCard.textContent).not.toContain("~");
  });

  it("필수 입력에는 aria-required가 붙는다(대출 기간·상환방식 포함)", () => {
    render(<LoanInterestCalculatorUi />);

    expect(screen.getByLabelText("년")).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("개월")).toHaveAttribute("aria-required", "true");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-required", "true");
    }
  });
});
