import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WeeklyHolidayAllowanceCalculatorUi from "./ui";

/**
 * 주휴수당 계산기 — UI 스모크 테스트(severance-pay/ui.test.tsx 선례).
 * 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고 폼→결과→경고 흐름이
 * 끊기지 않는지만 확인한다. 최종 판정은 QA의 몫이다.
 */
describe("WeeklyHolidayAllowanceCalculatorUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "주휴수당 계산하기" }));
    expect(screen.getByText("시급을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("주 근무시간을 입력해 주세요.")).toBeInTheDocument();
  });

  it("샘플 값(예제 1)으로 계산하면 1주치 주휴수당 82,560원을 보여주고 초기화된다", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/시급/)).toHaveValue("10,320");
    expect(screen.getByLabelText(/주 근무시간/)).toHaveValue("40");

    fireEvent.click(screen.getByRole("button", { name: "주휴수당 계산하기" }));
    const card = screen.getByRole("heading", { name: "1주치 주휴수당" })
      .parentElement as HTMLElement;
    expect(within(card).getByText("82,560원")).toBeInTheDocument();
    // 경고 카드가 뜨지 않아야 한다(정상 시급·40시간).
    expect(
      screen.queryByRole("heading", { name: /주 15시간 미만/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /최저임금보다 낮습니다/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/시급/)).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "1주치 주휴수당" }),
    ).not.toBeInTheDocument();
  });

  it("15시간 미만·최저임금 미만 입력은 계산을 막지 않고 경고 카드 2종을 함께 보여준다", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);
    fireEvent.change(screen.getByLabelText(/시급/), { target: { value: "9000" } });
    fireEvent.change(screen.getByLabelText(/주 근무시간/), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "주휴수당 계산하기" }));

    expect(
      screen.getByRole("heading", { name: "1주치 주휴수당" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /주 15시간 미만/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /최저임금보다 낮습니다/ }),
    ).toBeInTheDocument();
  });

  it("시급 필드에 소수점을 입력하면 정수부만 반영해 10배 왜곡을 막는다(QA-L2)", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);
    const wageInput = screen.getByLabelText(/시급/);
    fireEvent.change(wageInput, { target: { value: "10320.5" } });
    // "10320.5"가 콤마 제거로 "103,205"(10배)가 되면 안 된다 — 정수부만 취해 "10,320".
    expect(wageInput).toHaveValue("10,320");
  });

  it("15시간 미만이면 핵심 결과 카드 안에도 전제 한 줄이 표시된다(M1)", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);
    fireEvent.change(screen.getByLabelText(/시급/), { target: { value: "12000" } });
    fireEvent.change(screen.getByLabelText(/주 근무시간/), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "주휴수당 계산하기" }));

    const card = screen.getByRole("heading", { name: "1주치 주휴수당" })
      .parentElement as HTMLElement;
    expect(
      within(card).getByText(
        /주 15시간 미만이라 실제로는 주휴수당이 발생하지 않습니다 — 아래 안내를 확인하세요\./,
      ),
    ).toBeInTheDocument();
  });

  it("주 40시간 초과 입력은 8시간 상한 고지를 계산 근거에 표시한다", () => {
    render(<WeeklyHolidayAllowanceCalculatorUi />);
    fireEvent.change(screen.getByLabelText(/시급/), { target: { value: "15000" } });
    fireEvent.change(screen.getByLabelText(/주 근무시간/), {
      target: { value: "48" },
    });
    fireEvent.click(screen.getByRole("button", { name: "주휴수당 계산하기" }));

    expect(
      screen.getByText(/주휴수당 산정에 포함되지 않습니다/),
    ).toBeInTheDocument();
  });
});
