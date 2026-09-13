import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BusinessDaysUi from "./ui";

describe("BusinessDaysUi", () => {
  it("필수 날짜 오류를 표시한다", () => { render(<BusinessDaysUi />); fireEvent.click(screen.getByRole("button", { name:"영업일 계산하기" })); expect(screen.getAllByRole("alert")).toHaveLength(2); });
  it("샘플 기간의 영업일과 제외 내역을 표시한다", () => { render(<BusinessDaysUi />); fireEvent.click(screen.getByRole("button", { name:"샘플 값" })); fireEvent.click(screen.getByRole("button", { name:"영업일 계산하기" })); expect(screen.getByText("2일", { selector:"p" })).toBeInTheDocument(); expect(screen.getByText(/광복절 대체공휴일/)).toBeInTheDocument(); expect(screen.getByRole("heading", { name:"계산 방법" })).toBeInTheDocument(); });
  it("영업일 기준 날짜 찾기 모드를 설명하고 도착일을 계산한다", () => { render(<BusinessDaysUi />); fireEvent.click(screen.getByRole("radio", { name:"영업일 기준 날짜 찾기" })); expect(screen.getByText(/주말과 공휴일을 건너뛰고/)).toBeInTheDocument(); expect(screen.getByText(/1영업일 후는.*8월 18일/)).toBeInTheDocument(); fireEvent.change(screen.getAllByLabelText(/기준일/)[0], { target:{ value:"2026-08-14" } }); fireEvent.click(screen.getByRole("button", { name:"영업일 계산하기" })); expect(screen.getByText("2026년 8월 18일")).toBeInTheDocument(); });
  it("사용자 휴무일을 추가하고 삭제한다", () => { render(<BusinessDaysUi />); fireEvent.change(screen.getByLabelText("사용자 지정 휴무일"), { target:{ value:"2026-09-01" } }); fireEvent.click(screen.getByRole("button", { name:"추가" })); expect(screen.getByText("2026.09.01")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name:"2026-09-01 삭제" })); expect(screen.queryByText("2026.09.01")).not.toBeInTheDocument(); });
});
