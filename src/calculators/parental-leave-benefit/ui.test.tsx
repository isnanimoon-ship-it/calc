import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParentalLeaveBenefitUi from "./ui";

describe("ParentalLeaveBenefitUi", () => {
  it("필수 입력 오류를 표시한다", () => {
    render(<ParentalLeaveBenefitUi />);
    fireEvent.click(screen.getByRole("button", { name: "예상 급여 계산하기" }));
    expect(screen.getByText("육아휴직 시작일을 입력해 주세요.")).toHaveAttribute("role", "alert");
    expect(screen.getByText("월 통상임금은 1원 이상 10억 원 이하의 정수로 입력해 주세요.")).toHaveAttribute("role", "alert");
  });

  it("일반 12개월 샘플의 총액과 상세 내역을 표시한다", () => {
    render(<ParentalLeaveBenefitUi />);
    fireEvent.click(screen.getByRole("button", { name: "예시 입력" }));
    fireEvent.click(screen.getByRole("button", { name: "예상 급여 계산하기" }));
    expect(screen.getByText("23,100,000원", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "월별 상세 내역" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();
  });

  it("부모 함께 유형을 선택하면 추가 입력을 표시한다", () => {
    render(<ParentalLeaveBenefitUi />);
    fireEvent.click(screen.getByRole("radio", { name: "부모 함께" }));
    expect(screen.getByLabelText(/자녀 생년월일/)).toBeInTheDocument();
    expect(screen.getByLabelText(/배우자 육아휴직 시작일/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "사용 예정" })).toBeInTheDocument();
  });

  it("13개월 입력 시 연장 요건을 표시한다", () => {
    render(<ParentalLeaveBenefitUi />);
    fireEvent.change(screen.getByLabelText(/이번 육아휴직 기간/), { target: { value: "13" } });
    expect(screen.getByText("13~18개월 연장 요건 확인")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /부모 모두 동일 자녀/ })).toBeInTheDocument();
  });
});
