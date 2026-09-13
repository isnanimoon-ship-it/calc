import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HousingSubscriptionScoreUi from "./ui";

/**
 * 청약가점 계산기 — UI 스모크 테스트(weekly-holiday-allowance/ui.test.tsx 선례).
 * 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고
 * 폼 → 결과 → 경고 흐름이 끊기지 않는지만 확인한다. 최종 판정은 QA의 몫이다.
 */
describe("HousingSubscriptionScoreUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다", () => {
    render(<HousingSubscriptionScoreUi />);
    fireEvent.click(screen.getByRole("button", { name: "가점 계산하기" }));
    expect(screen.getByText("생년월일을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("주택 소유 이력을 선택해 주세요.")).toBeInTheDocument();
  });

  it("샘플 값(FORMULA 예제 12)으로 계산하면 총점 48점과 항목별 점수를 보여준다", () => {
    render(<HousingSubscriptionScoreUi />);

    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    expect(screen.getByLabelText(/생년월일/)).toHaveValue("1991-06-15");

    fireEvent.click(screen.getByRole("button", { name: "가점 계산하기" }));

    const totalCard = screen
      .getByRole("heading", { name: "예상 청약가점 합계" })
      .closest("section") as HTMLElement;
    expect(totalCard.textContent).toContain("48");
    expect(totalCard.textContent).toContain("무주택기간 16점");
    expect(totalCard.textContent).toContain("부양가족수 20점");
    expect(totalCard.textContent).toContain("가입기간 12점");

    const homelessCard = screen
      .getByRole("heading", { name: "무주택기간" })
      .closest("div.rounded-2xl") as HTMLElement;
    expect(within(homelessCard).getByText("16")).toBeInTheDocument();

    // 정상 케이스라 경고 카드가 뜨지 않아야 한다.
    expect(
      screen.queryByRole("heading", { name: /확인 필요/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.getByLabelText(/생년월일/)).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "예상 청약가점 합계" }),
    ).not.toBeInTheDocument();
  });

  it("혼인을 선택하면 혼인신고일 입력이 나타난다(조건부 필드)", () => {
    render(<HousingSubscriptionScoreUi />);
    expect(screen.queryByLabelText(/혼인신고일/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "혼인" }));
    expect(screen.getByLabelText(/혼인신고일/)).toBeInTheDocument();
  });

  it("과거 소유 후 처분을 선택하면 최근 처분일 입력이 나타난다(조건부 필드)", () => {
    render(<HousingSubscriptionScoreUi />);
    expect(screen.queryByLabelText(/최근 처분일/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "과거 소유 후 처분" }));
    expect(screen.getByLabelText(/최근 처분일/)).toBeInTheDocument();
  });

  it("현재 소유 중을 선택하면 소형·저가주택 특례 확인 체크박스가 나타난다(조건부 필드)", () => {
    render(<HousingSubscriptionScoreUi />);
    fireEvent.click(screen.getByRole("radio", { name: "현재 소유 중" }));
    expect(
      screen.getByText(/소형·저가 주택 등 무주택 간주 특례 요건을 확인했습니다/),
    ).toBeInTheDocument();
  });

  it("현재 주택 소유 중이면 계산 후 무주택기간 0점과 경고 카드를 보여준다(계산은 막지 않음)", () => {
    render(<HousingSubscriptionScoreUi />);
    fireEvent.change(screen.getByLabelText(/생년월일/), {
      target: { value: "1980-01-01" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "현재 소유 중" }));
    fireEvent.click(screen.getByRole("radio", { name: "미보유" }));

    fireEvent.click(screen.getByRole("button", { name: "가점 계산하기" }));

    const homelessCard = screen
      .getByRole("heading", { name: "무주택기간" })
      .closest("div.rounded-2xl") as HTMLElement;
    expect(within(homelessCard).getByText("0")).toBeInTheDocument();
    const warningCard = screen
      .getByRole("heading", { name: "무주택기간 확인 필요" })
      .closest("section") as HTMLElement;
    expect(within(warningCard).getByText(/현재 주택을 소유하고 있어/)).toBeInTheDocument();
  });

  it("청약통장 미보유를 선택하면 계산 후 가입기간 경고 카드를 보여준다", () => {
    render(<HousingSubscriptionScoreUi />);
    fireEvent.change(screen.getByLabelText(/생년월일/), {
      target: { value: "1980-01-01" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "무주택 유지" }));
    fireEvent.click(screen.getByRole("radio", { name: "미보유" }));

    fireEvent.click(screen.getByRole("button", { name: "가점 계산하기" }));

    expect(
      screen.getByRole("heading", { name: "청약통장 가입기간 확인 필요" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/청약통장 미가입 상태에서는/)).toBeInTheDocument();
  });

  it("혼인 여부를 '혼인'으로 바꾸면 배우자 부양가족 인정이 자동으로 '예'가 된다(QA M-2 회귀)", () => {
    render(<HousingSubscriptionScoreUi />);

    // 초기 상태(미혼)에서는 "아니요"가 선택되어 있다.
    expect(screen.getByRole("radio", { name: "아니요" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "혼인" }));
    expect(screen.getByRole("radio", { name: "예" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "아니요" })).not.toBeChecked();

    // 다시 미혼으로 되돌리면 배우자 부양가족 인정도 "아니요"로 되돌아간다.
    fireEvent.click(screen.getByRole("radio", { name: "미혼" }));
    expect(screen.getByRole("radio", { name: "아니요" })).toBeChecked();
  });

  it("정책 특례 고지 3종은 계산 결과와 무관하게 항상 표시된다", () => {
    render(<HousingSubscriptionScoreUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "가점 계산하기" }));

    expect(screen.getByText(/소형·저가주택 등 무주택 간주 특례/)).toBeInTheDocument();
    expect(screen.getByText(/배우자 청약통장 가입기간 합산 특례/)).toBeInTheDocument();
    expect(screen.getByText(/미성년자 시절 가입기간 인정 상한/)).toBeInTheDocument();
  });
});
