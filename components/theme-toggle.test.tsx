import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.clear();
  });

  it("테마 클래스와 사용자 선택을 함께 갱신한다", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "라이트/다크 모드 전환" });

    fireEvent.click(button);
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(button);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("light");
  });
});
