import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FourMajorInsuranceUi from "./ui";

describe("FourMajorInsuranceUi", () => {
  it("필수 급여 오류를 연결해 표시한다", () => {
    render(<FourMajorInsuranceUi />);
    fireEvent.click(screen.getByRole("button", { name: "보험료 계산하기" }));
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent("세전 월 급여");
    expect(screen.getByLabelText(/세전 월 급여/)).toHaveAttribute("aria-invalid", "true");
  });

  it("샘플 값으로 보험료를 계산하고 초기화한다", () => {
    render(<FourMajorInsuranceUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값" }));
    fireEvent.click(screen.getByRole("button", { name: "보험료 계산하기" }));
    expect(screen.getAllByText("272,080원")).toHaveLength(2);
    expect(screen.getByText("2,727,920원")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "보험별 상세 내역" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();
    expect(screen.getByText("1. 보험료 산정 보수 계산")).toBeInTheDocument();
    expect(screen.getByText(/3,000,000원 − 200,000원 = 2,800,000원/)).toBeInTheDocument();
    expect(screen.getByText("551,160원")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.queryByText("272,080원")).not.toBeInTheDocument();
  });

  it("고용보험 선택을 끄면 사업장 규모 입력을 비활성화한다", () => {
    render(<FourMajorInsuranceUi />);
    fireEvent.click(screen.getByRole("checkbox", { name: "고용보험" }));
    expect(screen.getByRole("combobox", { name: /사업장 규모/ })).toBeDisabled();
  });

  it("보험을 모두 끄면 계산하지 않고 안내한다", () => {
    render(<FourMajorInsuranceUi />);
    for (const name of ["국민연금", "건강·장기요양보험", "고용보험"])
      fireEvent.click(screen.getByRole("checkbox", { name }));
    fireEvent.click(screen.getByRole("button", { name: "보험료 계산하기" }));
    expect(screen.getByText("계산할 보험을 하나 이상 선택해 주세요.")).toBeInTheDocument();
  });
});
