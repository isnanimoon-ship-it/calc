import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillSplitCalculatorUi from "./ui";

// 이미지 저장 실패 경로(Medium 회귀 테스트)를 결정적으로 재현하기 위해 `html-to-image`를
// 항상 실패하도록 모킹한다(handleSaveImage가 동적 import하는 모듈, ui.tsx 참고).
vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockRejectedValue(new Error("이미지 생성 실패(테스트용)")),
}));

/**
 * 더치페이 계산기 — UI 스모크 테스트(loan-interest-calculator/ui.test.tsx 선례).
 * 계산 정확성 자체는 logic.test.ts가 다루고, 여기서는 화면이 렌더링되고 폼 → 결과 흐름이
 * 끊기지 않는지만 확인한다. 최종 판정은 QA의 몫이다.
 *
 * `prefers-reduced-motion: reduce`를 항상 true로 모킹해 몰아주기/사다리타기도 애니메이션
 * 대기 없이 즉시 결과가 확정되도록 한다(jsdom은 실제 CSS 트랜지션을 실행하지 않으므로, 이
 * 경로가 "애니메이션 유무와 무관하게 결과가 같아야 한다"는 요건도 함께 검증한다).
 */
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("BillSplitCalculatorUi", () => {
  it("필수값 없이 계산하면 필드별 오류를 표시한다(균등 분배 기본 모드)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));
    expect(screen.getByText("총 금액을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getAllByText("이름을 입력해 주세요.").length).toBeGreaterThan(0);
  });

  it("균등 분배 샘플 값으로 계산하면 3,334/3,333/3,333원을 보여준다(FORMULA 예제 2, 애니메이션 없음)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));

    const heading = screen.getByRole("heading", { name: "멤버별 부담 금액" });
    const card = heading.closest("section") as HTMLElement;
    expect(card.textContent).toContain("민준");
    expect(card.textContent).toContain("3,334원");
    expect(card.textContent).toContain("3,333원");

    fireEvent.click(screen.getByRole("button", { name: "초기화" }));
    expect(screen.queryByRole("heading", { name: "멤버별 부담 금액" })).not.toBeInTheDocument();
  });

  it("한명 몰아주기 — 샘플 값으로 계산하면 선정된 한 명이 전액을 부담하는 결과를 즉시 보여준다(reduced-motion)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: /한명 몰아주기/ }));
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));

    const heading = screen.getByRole("heading", { name: "선정된 멤버" });
    const card = heading.closest("section") as HTMLElement;
    expect(card.textContent).toContain("40,000원 전액 부담");
    expect(card.textContent).toContain("나머지 멤버는 0원입니다.");
    expect(["민준", "서연", "도윤", "하은"].some((name) => card.textContent?.includes(name))).toBe(true);
  });

  it("사다리타기 — 샘플 값으로 계산하면 멤버-금액 매칭 결과와 참고 합계를 보여준다(reduced-motion)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: /사다리타기/ }));
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));

    const heading = screen.getByRole("heading", { name: "멤버-금액 매칭 결과" });
    const card = heading.closest("section") as HTMLElement;
    expect(card.textContent).toContain("민준");
    expect(card.textContent).toContain("서연");
    expect(card.textContent).toContain("도윤");
    expect(card.textContent).toContain("참고 합계: 60,000원");
  });

  it("멤버를 최소 인원(2명) 아래로 삭제할 수 없다", () => {
    render(<BillSplitCalculatorUi />);
    const deleteButtons = screen.getAllByRole("button", { name: /삭제/ });
    expect(deleteButtons).toHaveLength(2);
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).toBeDisabled();
  });

  it("멤버 추가 버튼을 누르면 입력 필드가 하나 늘어난다", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "+ 멤버 추가" }));
    expect(screen.getAllByPlaceholderText(/멤버 \d 이름/)).toHaveLength(3);
  });

  it("계산 후 입력을 바꾸면 이전 결과를 숨긴다", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));
    expect(screen.getByRole("heading", { name: "멤버별 부담 금액" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ 멤버 추가" }));
    expect(screen.queryByRole("heading", { name: "멤버별 부담 금액" })).not.toBeInTheDocument();
  });

  it("균등/몰아주기 모드에서는 멤버 입력 행이 기존 flex 레이아웃을 유지한다(회귀, UX/UI Critic Q10 수정 이전 동작)", () => {
    render(<BillSplitCalculatorUi />);
    const nameWrapper = screen.getByLabelText("멤버 1 이름").closest("div") as HTMLElement;
    const row = nameWrapper.parentElement as HTMLElement;
    expect(row.className).toContain("flex items-start gap-2");
  });

  it("사다리타기 모드에서는 320px에서도 이름/금액 입력이 좁아지지 않도록 행이 세로 스택 그리드로 바뀐다(UX/UI Critic Q10 회귀)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: /사다리타기/ }));

    const nameWrapper = screen.getByLabelText("멤버 1 이름").closest("div") as HTMLElement;
    const row = nameWrapper.parentElement as HTMLElement;
    // 640px(sm) 미만에서는 grid-cols-1(세로 스택)이라 각 입력이 행 전체 폭을 쓴다 — 이전의
    // `flex-1` 2분할(320px에서 필드당 100px 미만으로 추정됐던 문제)로 되돌아가지 않는다.
    expect(row.className).toContain("grid-cols-1");
    expect(row.className).toContain("sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]");
  });

  it("사다리타기 금액 입력 placeholder에 예시 숫자가 있다(UX/UI Critic Q8 회귀)", () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("radio", { name: /사다리타기/ }));
    expect(screen.getByLabelText("멤버 1 금액")).toHaveAttribute("placeholder", "예: 10,000");
  });

  it("이미지 저장에 실패하면 방향에 의존하지 않는 문구로 대체 공유 경로를 안내한다(UX/UI Critic Q14 Medium 회귀)", async () => {
    render(<BillSplitCalculatorUi />);
    fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
    fireEvent.click(screen.getByRole("button", { name: "계산하기" }));
    fireEvent.click(screen.getByRole("button", { name: "결과 이미지 저장" }));

    const notice = await screen.findByText(/공유 영역의 '링크 복사'로 결과를 대신/);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).not.toContain("아래");
  });
});
