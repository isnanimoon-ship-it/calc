import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareActions } from "./ShareActions";

describe("ShareActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });

  it("X 공유 링크에 문구와 URL을 인코딩한다", () => {
    render(<ShareActions title="만 나이 계산기" text="결과는 만 13세입니다." url="https://example.com/calculators/age?b=2013-06-05" mode="result" />);
    const href = new URL(screen.getByRole("link", { name: "X로 공유" }).getAttribute("href")!);
    expect(href.origin + href.pathname).toBe("https://x.com/intent/tweet");
    expect(href.searchParams.get("text")).toBe("결과는 만 13세입니다.");
    expect(href.searchParams.get("url")).toBe("https://example.com/calculators/age?b=2013-06-05");
  });

  it("링크를 클립보드에 복사하고 상태를 알린다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ShareActions title="계산기" text="소개" url="https://example.com/calculators/test" />);
    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://example.com/calculators/test"));
    expect(screen.getByText("링크를 복사했습니다.")).toBeInTheDocument();
  });

  it("카카오 어댑터가 없으면 카카오톡 버튼을 비활성화한다", () => {
    render(<ShareActions title="계산기" text="소개" url="https://example.com" />);
    expect(screen.getByRole("button", { name: "카카오톡" })).toBeDisabled();
  });

  it("브라우저 공유 기능이 있으면 다른 앱 버튼으로 payload를 전달한다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<ShareActions title="계산기" text="소개" url="https://example.com/calculators/test" />);
    fireEvent.click(await screen.findByRole("button", { name: "다른 앱" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "계산기", text: "소개", url: "https://example.com/calculators/test" }));
  });
});
