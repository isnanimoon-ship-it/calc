import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SeverancePayCalculatorUi from "./ui";

describe("SeverancePayCalculatorUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다", () => {
    render(<SeverancePayCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "퇴직금 계산하기" }));

    expect(screen.getByText("입사일을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("퇴사일을 입력해 주세요.")).toBeInTheDocument();
    expect(
      screen.getByText("퇴사일 이전 3개월 임금총액을(를) 입력해 주세요."),
    ).toBeInTheDocument();
  });

  it("샘플 값을 채워 계산하고 초기화할 수 있다", () => {
    render(<SeverancePayCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/입사일/)).toHaveValue("2023-01-01");
    expect(screen.getByLabelText(/3개월 임금총액/)).toHaveValue("9,200,000");

    fireEvent.click(screen.getByRole("button", { name: "퇴직금 계산하기" }));
    const result = screen.getByRole("heading", { name: "예상 퇴직금" }).parentElement;
    expect(result).not.toBeNull();
    expect(within(result!).getByText(/원$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/입사일/)).toHaveValue("");
    expect(screen.queryByRole("heading", { name: "예상 퇴직금" })).not.toBeInTheDocument();
  });

  it("주 15시간 미만 자진신고를 결과에 반영한다", () => {
    render(<SeverancePayCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "저는 4주 평균 주 15시간 미만으로 근무합니다.",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "퇴직금 계산하기" }));

    expect(screen.getByRole("heading", { name: "지급대상 아님" })).toBeInTheDocument();
    expect(screen.getByText(/자진신고하신 내용에 따라 판정/)).toBeInTheDocument();
  });
});
