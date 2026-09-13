import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FaqAccordion } from "./FaqAccordion";

describe("FaqAccordion", () => {
  it("질문 버튼으로 답변을 열고 닫으며 접근성 상태를 갱신한다", () => {
    render(
      <FaqAccordion
        items={[{ question: "테스트 질문", answer: ["테스트 답변"] }]}
      />,
    );

    const button = screen.getByRole("button", { name: "테스트 질문" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("테스트 답변")).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("테스트 답변")).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
