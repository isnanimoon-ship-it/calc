"use client";

import { useEffect, useMemo, useState } from "react";
import { buildXIntentUrl, getShareUrl, type SharePayload } from "@/src/lib/share";

type Feedback = "idle" | "copied" | "shared" | "cancelled" | "error";

export interface ShareActionsProps {
  title: string;
  /** 계산 전에는 기능 소개, 계산 후에는 결과 요약을 전달한다. */
  text: string;
  /** 결과 복원 쿼리를 포함할 수 있다. 생략하면 현재 주소를 쓴다. */
  url?: string;
  mode?: "calculator" | "result";
  /** 운영 도메인에서 Kakao SDK를 초기화한 뒤 연결할 어댑터. */
  onKakaoShare?: (payload: SharePayload) => void | Promise<void>;
  className?: string;
}

function ShareIcon({ name }: { name: "x" | "kakao" | "link" | "more" }) {
  if (name === "x") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.25-8.29L2.97 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.84h1.73L8.43 4.05H6.58L17.8 19.84Z" /></svg>;
  const paths = {
    kakao: <path d="M21 11.2c0 4.53-4.03 8.2-9 8.2-1.04 0-2.04-.16-2.97-.45L4.4 21l1.35-3.57C4.04 15.94 3 13.73 3 11.2 3 6.67 7.03 3 12 3s9 3.67 9 8.2Z" />,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" /><path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.14-1.14" /></>,
    more: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

export function ShareActions({ title, text, url, mode = "calculator", onKakaoShare, className }: ShareActionsProps) {
  const [resolvedUrl, setResolvedUrl] = useState(url ?? "");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  useEffect(() => {
    // 서버 렌더 결과와 첫 클라이언트 렌더를 일치시킨 뒤 브라우저 전용 기능을 활성화한다.
    const timer = window.setTimeout(() => {
      setResolvedUrl(getShareUrl(url));
      setCanNativeShare(typeof navigator.share === "function");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [url]);
  const payload = useMemo<SharePayload>(() => ({ title, text, url: resolvedUrl }), [title, text, resolvedUrl]);
  const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold transition hover:border-border-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45";

  async function handleCopy() { try { await copyText(payload.url); setFeedback("copied"); } catch { setFeedback("error"); } }
  async function handleKakao() { if (!onKakaoShare) return; try { await onKakaoShare(payload); setFeedback("shared"); } catch { setFeedback("error"); } }
  async function handleNativeShare() { try { await navigator.share(payload); setFeedback("shared"); } catch (error) { setFeedback(error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "error"); } }
  const feedbackText = { idle: "", copied: "링크를 복사했습니다.", shared: mode === "result" ? "계산 결과를 공유했습니다." : "계산기를 공유했습니다.", cancelled: "공유를 취소했습니다.", error: "공유하지 못했습니다. 링크 복사를 다시 시도해 주세요." }[feedback];

  return <section aria-label={mode === "result" ? "계산 결과 공유" : "계산기 공유"} className={className}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-semibold text-muted">{mode === "result" ? "결과 공유" : "공유"}</span>
      <a className={buttonClass} href={buildXIntentUrl(payload)} target="_blank" rel="noopener noreferrer" aria-label="X로 공유"><ShareIcon name="x" /> X</a>
      <button type="button" className={buttonClass} onClick={handleKakao} disabled={!onKakaoShare} title={!onKakaoShare ? "카카오 JavaScript SDK 설정 후 사용할 수 있습니다." : undefined}><ShareIcon name="kakao" /> 카카오톡</button>
      <button type="button" className={buttonClass} onClick={handleCopy} disabled={!resolvedUrl}><ShareIcon name="link" /> 링크 복사</button>
      {canNativeShare && <button type="button" className={buttonClass} onClick={handleNativeShare} disabled={!resolvedUrl}><ShareIcon name="more" /> 다른 앱</button>}
    </div>
    <p aria-live="polite" className={`mt-2 min-h-5 text-xs ${feedback === "error" ? "text-danger" : "text-muted"}`}>{feedbackText}</p>
  </section>;
}
