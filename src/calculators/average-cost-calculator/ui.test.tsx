import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AverageCostCalculatorUi from "./ui";

/**
 * 평단가(물타기) 계산기 — UI 스모크 테스트(loan-interest-calculator/ui.test.tsx 선례와 동일
 * 성격). 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고 폼 → 결과
 * 흐름이 끊기지 않는지, 그리고 "상승"(불타기)이 오류로 취급되지 않는지만 확인한다. 최종
 * 판정은 QA의 몫이다.
 */
describe("AverageCostCalculatorUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다", () => {
    render(<AverageCostCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "평단가 계산하기" }));
    expect(screen.getByText("보유 수량을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("보유 평단가를 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("추가 매수 수량을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("추가 매수 단가를 입력해 주세요.")).toBeInTheDocument();
  });

  it("샘플 값(FORMULA 예제 1)으로 계산하면 새 평단가 7,500원과 '평단가 하락'을 보여준다", () => {
    render(<AverageCostCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/보유 수량/)).toHaveValue("10");
    expect(screen.getByLabelText(/보유 평단가/)).toHaveValue("10,000");

    fireEvent.click(screen.getByRole("button", { name: "평단가 계산하기" }));

    const keyResultCard = screen.getByRole("heading", { name: "매수 후 새 평단가" }).closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("7,500원");
    expect(keyResultCard.textContent).toContain("평단가 하락");

    expect(screen.getByRole("heading", { name: "보유 현황 변화" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/보유 수량/)).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "매수 후 새 평단가" })).not.toBeInTheDocument();
  });

  it("추가 매수 단가가 더 높으면(불타기) 오류 없이 '평단가 상승'을 정상 결과로 보여준다", () => {
    render(<AverageCostCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/보유 수량/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/보유 평단가/), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/추가 매수 수량/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/추가 매수 단가/), { target: { value: "15000" } });
    fireEvent.click(screen.getByRole("button", { name: "평단가 계산하기" }));

    const keyResultCard = screen.getByRole("heading", { name: "매수 후 새 평단가" }).closest("section") as HTMLElement;
    expect(keyResultCard.textContent).toContain("12,500원");
    expect(keyResultCard.textContent).toContain("평단가 상승");
    // "상승"은 오류가 아니므로 role="alert" 오류 메시지가 없어야 한다.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("소수점 8자리 초과 입력은 오류를 표시하고 계산하지 않는다", () => {
    render(<AverageCostCalculatorUi />);

    fireEvent.change(screen.getByLabelText(/보유 수량/), { target: { value: "0.123456789" } });
    fireEvent.change(screen.getByLabelText(/보유 평단가/), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/추가 매수 수량/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/추가 매수 단가/), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "평단가 계산하기" }));

    expect(screen.getByText("보유 수량은 소수점 8자리까지 입력할 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "매수 후 새 평단가" })).not.toBeInTheDocument();
  });

  it("금액 입력 중 실시간으로 천 단위 콤마를 표시한다", () => {
    render(<AverageCostCalculatorUi />);
    fireEvent.change(screen.getByLabelText(/보유 평단가/), { target: { value: "52340000" } });
    expect(screen.getByLabelText(/보유 평단가/)).toHaveValue("52,340,000");
  });
});
