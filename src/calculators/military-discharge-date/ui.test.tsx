import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MilitaryDischargeDateUi from "./ui";

describe("MilitaryDischargeDateUi", () => {
  it("시작일 누락 오류를 연결해 표시한다", () => {
    render(<MilitaryDischargeDateUi />); fireEvent.click(screen.getByRole("button", { name: "전역일 계산하기" }));
    expect(screen.getByText("복무 시작일을 입력해 주세요.")).toHaveAttribute("role", "alert");
  });
  it("육군 샘플의 종료일과 계산 과정을 표시한다", () => {
    render(<MilitaryDischargeDateUi />);
    fireEvent.change(screen.getByLabelText(/입영일/), { target: { value: "2026-09-04" } });
    fireEvent.change(screen.getByLabelText(/계산 기준일/), { target: { value: "2026-09-04" } });
    fireEvent.click(screen.getByRole("button", { name: "전역일 계산하기" }));
    expect(screen.getByText("2028년 3월 3일")).toBeInTheDocument();
    expect(screen.getAllByText(/D-546/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("heading", { name: "계산 방법" })).toBeInTheDocument();
    expect(screen.getByText(/2026.09.04 \+ 18개월 − 1일 = 2028.03.03/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "복무 진행률" })).toHaveAttribute("aria-valuenow", "0");
  });
  it("사회복무요원에는 계급 일정을 표시하지 않는다", () => {
    render(<MilitaryDischargeDateUi />); fireEvent.click(screen.getByRole("radio", { name: "보충역·대체복무" })); fireEvent.click(screen.getByRole("radio", { name: "사회복무요원" }));
    fireEvent.change(screen.getByLabelText(/소집일/), { target: { value: "2026-09-04" } }); fireEvent.click(screen.getByRole("button", { name: "전역일 계산하기" }));
    expect(screen.queryByText(/일병 진급/)).not.toBeInTheDocument(); expect(screen.getByText("예상 소집해제일")).toBeInTheDocument();
  });
});
