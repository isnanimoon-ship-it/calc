import { describe, expect, it } from "vitest";
import { buildStateShareUrl, decodeShareState, encodeShareState } from "./share";

describe("share state", () => {
  it("한글과 계산기 입력 상태를 Base64URL로 왕복한다", () => {
    const state = { birthDate: "2013-06-05", label: "만 나이", amount: 3_000_000 };
    const encoded = encodeShareState(state);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(state);
  });

  it("결과 URL에는 s 파라미터만 유지한다", () => {
    const result = new URL(buildStateShareUrl("https://example.com/calculators/age?old=value#result", { b: "2013-06-05" }));
    expect([...result.searchParams.keys()]).toEqual(["s"]);
    expect(result.hash).toBe("");
    expect(decodeShareState(result.searchParams.get("s")!)).toEqual({ b: "2013-06-05" });
  });

  it("손상되거나 지원하지 않는 상태를 오류 없이 거부한다", () => {
    expect(decodeShareState("not!base64")).toBeNull();
    const unsupportedVersion = btoa(JSON.stringify({ v: 2, d: {} }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    expect(decodeShareState(unsupportedVersion)).toBeNull();
  });
});
