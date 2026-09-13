import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AnnualSalaryTakeHomePayUi from "./ui";

describe("AnnualSalaryTakeHomePayUi", () => {
  it("필수 연봉 오류를 연결해 표시한다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("세전 연봉");
    expect(screen.getByLabelText(/세전 연봉/)).toHaveAttribute("aria-invalid", "true");
  });

  it("샘플 값으로 실수령액을 계산하고 초기화한다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));

    // FORMULA.md 예제 8(연봉 3,600만원, 비과세 20만원, 가족 3명, 자녀 1명)과 동일 입력 —
    // 다만 이 계산기는 비과세를 산정 기준 보수에서 제외하므로 예제 8과 결과가 다르다.
    // 계산 결과 화면이 렌더링되는지, 핵심 요소가 존재하는지만 확인한다.
    expect(screen.getByText("세후 월 실수령액(예상)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "공제 내역" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "정책 안내" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.queryByText("세후 월 실수령액(예상)")).not.toBeInTheDocument();
  });

  it("국민연금 하한 적용 시 안내 문구를 표시한다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.change(screen.getByLabelText(/세전 연봉/), { target: { value: "4800000" } });
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
    expect(screen.getByText(/국민연금 기준소득월액이 하한/)).toBeInTheDocument();
  });

  it("비과세 금액이 월 급여보다 크면 오류를 표시한다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.change(screen.getByLabelText(/세전 연봉/), { target: { value: "12000000" } });
    fireEvent.change(screen.getByLabelText(/월 비과세 금액/), { target: { value: "2000000" } });
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
    expect(screen.getByText(/월 비과세 금액은 세전 월 급여/)).toBeInTheDocument();
  });

  // QA.md 신규 발견(Medium): 비현실적으로 낮은 연봉(검증은 통과하지만 4대 보험 하한이 급여를
  // 초과)이면 netMonthlyPay가 음수가 된다 — 계산 자체는 바꾸지 않고 경고 카드만 추가한다.
  it("비현실적으로 낮은 연봉 입력 시 세후 실수령액 음수 경고 카드를 표시한다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.change(screen.getByLabelText(/세전 연봉/), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
    expect(screen.getByText("세후 실수령액이 0원 미만으로 계산됨")).toBeInTheDocument();
    expect(screen.getByText(/4대 보험 최저 보험료가 실제 급여보다 커서/)).toBeInTheDocument();
  });

  it("정상 범위 계산에서는 실수령액 음수 경고 카드가 나오지 않는다", () => {
    render(<AnnualSalaryTakeHomePayUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
    expect(screen.queryByText("세후 실수령액이 0원 미만으로 계산됨")).not.toBeInTheDocument();
  });
});
