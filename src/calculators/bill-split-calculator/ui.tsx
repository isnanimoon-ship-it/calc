"use client";

/**
 * 더치페이 계산기 — 입력/결과 UI.
 *
 * tasks/bill-split-calculator/ARCHITECTURE.md "9. UI 구조"를 그대로 구현한다. 계산 공식/RNG
 * 로직은 이 파일에 두지 않는다(logic.ts) — 이 파일은 폼 상태 관리와 표시, 애니메이션
 * 오케스트레이션만 담당한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * 핵심 흐름(ARCHITECTURE.md "2.3"/"5.4"과 동일한 원칙): 먼저 `calculate*`로 결과를 확정한
 * 뒤(RNG 호출은 이 시점 1회뿐), 그 결과를 애니메이션 컴포넌트에 props로 넘긴다. 애니메이션은
 * `onAnimationEnd`를 호출한 뒤에야 핵심 결과 카드가 나타나고, 그 이후에만 이미지 저장 버튼이
 * 활성화된다(SPEC.md 화면 구성 6→7→8 순서, ARCHITECTURE.md "5.5").
 */

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { IntroSection } from "@/components/calculator/IntroSection";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import {
  BILL_SPLIT_ASSUMPTION_NOTICES,
  BILL_SPLIT_INTRO_PARAGRAPHS,
  BILL_SPLIT_USAGE_STEPS,
  billSplitCalculatorFaqItems,
  billSplitModeDescriptions,
  billSplitModeShortLabels,
} from "./content";
import {
  billSplitModeLabels,
  buildBillSplitBreakdown,
  formatResultSummary,
  formatWon,
  sumAmounts,
} from "./formatting";
import { LadderAnimation } from "./LadderAnimation";
import {
  calculateEqualSplit,
  calculateLadderSplit,
  calculateWinnerTakeAll,
  restoreBillSplitResult,
} from "./logic";
import { RouletteWheel } from "./RouletteWheel";
import type { BillSplitInput, BillSplitMode, BillSplitResult, BillSplitShareState } from "./types";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import {
  MAX_MEMBERS,
  MIN_MEMBERS,
  parseBillSplitShareState,
  validateBillSplitInput,
  type BillSplitValidationField,
  type BillSplitValidationFieldError,
  type RawBillSplitFormInput,
} from "./validation";

const FIELD_CLASS =
  "mt-1 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";

const MODE_OPTIONS: BillSplitMode[] = ["equal", "winner-take-all", "ladder"];

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600 dark:text-red-400">
      {" "}
      *
    </span>
  );
}

function SectionIcon({ name }: { name: "shuffle" | "formula" | "info" }) {
  const paths = {
    shuffle: (
      <>
        <path d="M4 7h4l3 3M4 17h4l3-3" />
        <path d="M11 7h5l4 10h-5M11 17h5l4-10h-5" />
      </>
    ),
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

interface ComputedState {
  result: BillSplitResult;
  /** 이 계산에서 애니메이션을 재생할지(균등 분배·prefers-reduced-motion이면 false). */
  playAnimation: boolean;
  /** 애니메이션 컴포넌트의 React key — 같은 결과라도 매 계산마다 다시 마운트해 재생하기 위함. */
  runId: number;
}

function toShareState(result: BillSplitResult): BillSplitShareState {
  switch (result.mode) {
    case "equal":
      return { mode: "equal", totalAmount: result.totalAmount, members: result.members };
    case "winner-take-all":
      return {
        mode: "winner-take-all",
        totalAmount: result.totalAmount,
        members: result.members,
        selectedIndex: result.selectedIndex,
      };
    case "ladder":
      return {
        mode: "ladder",
        members: result.members,
        amounts: result.amounts,
        permutation: result.permutation,
      };
  }
}

function runCalculation(data: BillSplitInput): BillSplitResult {
  switch (data.mode) {
    case "equal":
      return calculateEqualSplit(data);
    case "winner-take-all":
      return calculateWinnerTakeAll(data);
    case "ladder":
      return calculateLadderSplit(data);
  }
}

/** 핵심 결과 카드의 방식별 본문(SPEC.md "화면 구성" 7번, ARCHITECTURE.md "9.7"). */
function KeyResultBody({ result }: { result: BillSplitResult }) {
  switch (result.mode) {
    case "equal":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">멤버별 부담 금액</h2>
          <ul className="mt-3 space-y-1.5">
            {result.shares.map((share) => (
              <li key={share.index} className="flex items-center justify-between gap-3 text-lg font-semibold tabular-nums">
                <span className="truncate text-base font-medium opacity-90">{share.name}</span>
                <span>{formatWon(share.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      );
    case "winner-take-all":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">선정된 멤버</h2>
          <p className="mt-2 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{result.selectedName}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatWon(result.totalAmount)} 전액 부담</p>
          <p className="mt-3 text-sm opacity-80">나머지 멤버는 0원입니다.</p>
        </>
      );
    case "ladder":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">멤버-금액 매칭 결과</h2>
          <p className="mt-0.5 text-xs opacity-80">사다리타기로 무작위로 배정된 결과입니다.</p>
          <ul className="mt-3 space-y-1.5">
            {result.matches.map((match) => (
              <li
                key={match.memberIndex}
                className="flex items-center justify-between gap-3 text-lg font-semibold tabular-nums"
              >
                <span className="truncate text-base font-medium opacity-90">{match.memberName}</span>
                <span>{formatWon(match.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm opacity-80">참고 합계: {formatWon(sumAmounts(result.amounts))}</p>
        </>
      );
  }
}

export default function BillSplitCalculatorUi() {
  const formId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);

  const [mode, setMode] = useState<BillSplitMode>("equal");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [totalAmount, setTotalAmount] = useState("");
  const [amounts, setAmounts] = useState<string[]>(["", ""]);
  const [errors, setErrors] = useState<BillSplitValidationFieldError[]>([]);
  const [computed, setComputed] = useState<ComputedState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [imageSaveStatus, setImageSaveStatus] = useState<"idle" | "saving" | "error">("idle");

  function nextRunId(): number {
    runIdRef.current += 1;
    return runIdRef.current;
  }

  function clearResult() {
    setComputed(null);
    setRevealed(false);
    setImageSaveStatus("idle");
  }

  const baseUrl = useCalculatorShare((state) => {
    const parsed = parseBillSplitShareState(state);
    if (!parsed) return;
    setMode(parsed.mode);
    setErrors([]);
    if (parsed.mode === "ladder") {
      setMembers(parsed.members);
      setAmounts(parsed.amounts.map((amount) => amount.toLocaleString("ko-KR")));
      setTotalAmount("");
    } else {
      setMembers(parsed.members);
      setAmounts(parsed.members.map(() => ""));
      setTotalAmount(parsed.totalAmount.toLocaleString("ko-KR"));
    }
    // 공유 링크 복원은 RNG를 다시 호출하지 않는다(restoreBillSplitResult, ARCHITECTURE.md
    // "2.3") — 애니메이션도 재생하지 않고 확정된 결과를 즉시 보여준다.
    const restored = restoreBillSplitResult(parsed);
    setComputed({ result: restored, playAnimation: false, runId: nextRunId() });
    setRevealed(true);
  });

  function errorFor(field: BillSplitValidationField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  function handleModeChange(next: BillSplitMode) {
    setMode(next);
    setErrors([]);
    clearResult();
  }

  function handleAddMember() {
    if (members.length >= MAX_MEMBERS) return;
    setMembers((prev) => [...prev, ""]);
    setAmounts((prev) => [...prev, ""]);
    clearResult();
  }

  function handleRemoveMember(index: number) {
    if (members.length <= MIN_MEMBERS) return;
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setAmounts((prev) => prev.filter((_, i) => i !== index));
    clearResult();
  }

  function handleMemberNameChange(index: number, value: string) {
    setMembers((prev) => prev.map((name, i) => (i === index ? value : name)));
    clearResult();
  }

  function handleTotalAmountChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setTotalAmount(digits ? Number(digits).toLocaleString("ko-KR") : "");
    clearResult();
  }

  function handleAmountChange(index: number, value: string) {
    const digits = value.replace(/[^0-9]/g, "");
    const formatted = digits ? Number(digits).toLocaleString("ko-KR") : "";
    setAmounts((prev) => prev.map((amount, i) => (i === index ? formatted : amount)));
    clearResult();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw: RawBillSplitFormInput =
      mode === "ladder" ? { mode: "ladder", members, amounts } : { mode, members, totalAmount };
    const validation = validateBillSplitInput(raw);
    if (!validation.success) {
      setErrors(validation.errors);
      clearResult();
      return;
    }
    setErrors([]);
    const result = runCalculation(validation.data);
    const playAnimation = result.mode !== "equal" && !prefersReducedMotion;
    setComputed({ result, playAnimation, runId: nextRunId() });
    setRevealed(!playAnimation);
  }

  function handleReset() {
    setMode("equal");
    setMembers(["", ""]);
    setAmounts(["", ""]);
    setTotalAmount("");
    setErrors([]);
    clearResult();
  }

  function handleFillSample() {
    setErrors([]);
    if (mode === "equal") {
      // FORMULA.md 검증 예제 2(3명, 총액 10,000원 → 3,334/3,333/3,333원).
      setMembers(["민준", "서연", "도윤"]);
      setAmounts(["", "", ""]);
      setTotalAmount("10,000");
    } else if (mode === "winner-take-all") {
      setMembers(["민준", "서연", "도윤", "하은"]);
      setAmounts(["", "", "", ""]);
      setTotalAmount("40,000");
    } else {
      setMembers(["민준", "서연", "도윤"]);
      setAmounts(["10,000", "20,000", "30,000"]);
      setTotalAmount("");
    }
    clearResult();
  }

  function handleAnimationEnd() {
    setRevealed(true);
  }

  async function handleSaveImage() {
    if (!cardRef.current) return;
    setImageSaveStatus("saving");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "더치페이-결과.png";
      link.click();
      setImageSaveStatus("idle");
    } catch {
      setImageSaveStatus("error");
    }
  }

  const ladderAmountsSum =
    mode === "ladder" ? sumAmounts(amounts.map((raw) => Number(raw.replace(/,/g, "")) || 0)) : 0;
  const canSaveImage = computed !== null && revealed && imageSaveStatus !== "saving";
  const breakdown = computed ? buildBillSplitBreakdown(computed.result) : [];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/life" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">생활</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">더치페이 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          균등 분배·한명 몰아주기·사다리타기 세 가지 방식으로 모임 비용을 나눠 보세요. 결과는
          참고·재미 목적이며 실제 결제·송금 의무를 만들지 않습니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <fieldset>
          <legend className={LABEL_CLASS}>
            분배 방식
            <RequiredMark />
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => (
              <label
                key={option}
                className={`cursor-pointer rounded-xl border p-4 text-sm transition focus-within:ring-2 focus-within:ring-primary ${
                  mode === option ? "border-primary bg-primary-soft" : "border-border bg-background"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-mode`}
                  className="sr-only"
                  checked={mode === option}
                  onChange={() => handleModeChange(option)}
                />
                <span className="block font-semibold">{billSplitModeShortLabels[option]}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  {billSplitModeDescriptions[option]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 멤버 이름 목록(공통, 추가/삭제 가능) */}
        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <span className={LABEL_CLASS}>
              멤버 이름
              <RequiredMark />
            </span>
            <span className="text-xs text-muted">
              {members.length}/{MAX_MEMBERS}명
            </span>
          </div>
          {errorFor("members") && (
            <p role="alert" className={ERROR_CLASS}>
              {errorFor("members")}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {members.map((name, index) => (
              <div
                key={index}
                className={
                  mode === "ladder"
                    ? // 사다리타기 모드는 이름+금액 두 입력이 한 행에 들어가 320px에서 각 입력이
                      // 100px 미만으로 좁아지는 문제가 있었다(UX/UI Critic Q10, High) — 640px
                      // 미만에서는 이름/금액/삭제를 세로로 쌓고, sm 이상에서만 한 행으로 합친다.
                      "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
                    : "flex items-start gap-2"
                }
              >
                <div className={mode === "ladder" ? "min-w-0" : "flex-1"}>
                  <label htmlFor={`${formId}-member-${index}`} className="sr-only">
                    멤버 {index + 1} 이름
                  </label>
                  <input
                    id={`${formId}-member-${index}`}
                    value={name}
                    aria-invalid={errorFor(`member-${index}`) ? true : undefined}
                    aria-describedby={errorFor(`member-${index}`) ? `${formId}-member-${index}-error` : undefined}
                    onChange={(event) => handleMemberNameChange(index, event.target.value)}
                    placeholder={`멤버 ${index + 1} 이름`}
                    className={FIELD_CLASS}
                  />
                  {errorFor(`member-${index}`) && (
                    <p id={`${formId}-member-${index}-error`} role="alert" className={ERROR_CLASS}>
                      {errorFor(`member-${index}`)}
                    </p>
                  )}
                </div>
                {mode === "ladder" && (
                  <div className="min-w-0">
                    <label htmlFor={`${formId}-amount-${index}`} className="sr-only">
                      멤버 {index + 1} 금액
                    </label>
                    <input
                      id={`${formId}-amount-${index}`}
                      inputMode="numeric"
                      value={amounts[index] ?? ""}
                      aria-invalid={errorFor(`amount-${index}`) ? true : undefined}
                      aria-describedby={errorFor(`amount-${index}`) ? `${formId}-amount-${index}-error` : undefined}
                      onChange={(event) => handleAmountChange(index, event.target.value)}
                      placeholder="예: 10,000"
                      className={FIELD_CLASS}
                    />
                    {errorFor(`amount-${index}`) && (
                      <p id={`${formId}-amount-${index}-error`} role="alert" className={ERROR_CLASS}>
                        {errorFor(`amount-${index}`)}
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveMember(index)}
                  disabled={members.length <= MIN_MEMBERS}
                  aria-label={`멤버 ${index + 1} 삭제`}
                  className="mt-1 shrink-0 justify-self-start rounded-xl border border-border px-3 py-3 text-sm font-semibold text-muted transition hover:border-border-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddMember}
            disabled={members.length >= MAX_MEMBERS}
            className="mt-3 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:border-border-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            + 멤버 추가
          </button>
          {errorFor("amounts") && (
            <p role="alert" className={`${ERROR_CLASS} mt-2`}>
              {errorFor("amounts")}
            </p>
          )}
          {mode === "ladder" && <p className={HELP_CLASS}>금액 목록 합계(참고): {formatWon(ladderAmountsSum)}</p>}
        </div>

        {/* 총 금액(균등/몰아주기 전용 — 사다리타기는 총 금액 입력 필드가 없다, SPEC.md) */}
        {mode !== "ladder" && (
          <div className="border-t border-border pt-6">
            <label htmlFor={`${formId}-totalAmount`} className={LABEL_CLASS}>
              총 금액
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-totalAmount`}
              inputMode="numeric"
              value={totalAmount}
              aria-required="true"
              aria-invalid={errorFor("totalAmount") ? true : undefined}
              aria-describedby={errorFor("totalAmount") ? `${formId}-totalAmount-error` : undefined}
              onChange={handleTotalAmountChange}
              placeholder="예: 30,000"
              className={FIELD_CLASS}
            />
            {errorFor("totalAmount") && (
              <p id={`${formId}-totalAmount-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("totalAmount")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            계산하기
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-border-strong hover:bg-surface-subtle"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleFillSample}
            className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:border-border-strong hover:bg-surface-subtle hover:text-foreground"
          >
            샘플 값 채우기
          </button>
        </div>
      </form>

      <ShareActions
        className="mt-5"
        title="더치페이 계산기"
        text={
          computed && revealed
            ? formatResultSummary(computed.result)
            : "회식비를 균등하게 나누거나, 한 명에게 몰아주거나, 사다리타기로 정해보세요."
        }
        url={
          baseUrl
            ? computed && revealed
              ? buildStateShareUrl(baseUrl, toShareState(computed.result))
              : baseUrl
            : undefined
        }
        mode={computed && revealed ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {/* 이미지 캡처 대상 컨테이너 — 애니메이션 재생 영역(SPEC.md 화면 구성 6번)과 핵심 결과
            카드(7번)를 함께 감싼다(2026-09-07 갱신, ARCHITECTURE.md "4."/"9." — 실제 브라우저
            테스트에서 사용자가 "이미지 저장 영역에 룰렛/사다리타기 그림도 포함됐으면 좋겠다"고
            요청해 캡처 대상 결정을 뒤집었다). 균등 분배는 애니메이션 섹션 자체가 렌더링되지
            않으므로 기존과 동일하게 결과 카드만 캡처된다. */}
        <div ref={cardRef} className="space-y-5">
          {computed && computed.result.mode !== "equal" && (
            <SectionCard
              // 애니메이션 진행 중 제목은 "짧은 문맥"이라 billSplitModeShortLabels(방식 선택
              // 라디오의 풀네임, 예: "인원별 금액설정(사다리타기)")가 아니라 결과 카드 eyebrow와
              // 같은 짧은 billSplitModeLabels("사다리타기")를 쓴다(UX/UI Critic Q6 — 모드명
              // 표기를 "풀네임이 필요한 곳"과 "짧아도 되는 곳"으로 나눠 일관되게 정리).
              title={`${billSplitModeLabels[computed.result.mode]} 진행`}
              icon={<SectionIcon name="shuffle" />}
            >
              {computed.result.mode === "winner-take-all" ? (
                <RouletteWheel
                  key={computed.runId}
                  members={computed.result.members}
                  selectedIndex={computed.result.selectedIndex}
                  playAnimation={computed.playAnimation}
                  onAnimationEnd={handleAnimationEnd}
                />
              ) : (
                <LadderAnimation
                  key={computed.runId}
                  members={computed.result.members}
                  amounts={computed.result.amounts}
                  permutation={computed.result.permutation}
                  playAnimation={computed.playAnimation}
                  onAnimationEnd={handleAnimationEnd}
                />
              )}
            </SectionCard>
          )}

          {computed && revealed && (
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {billSplitModeLabels[computed.result.mode]}
              </p>
              <div className="mt-2">
                <KeyResultBody result={computed.result} />
              </div>
              <p className="mt-4 text-sm opacity-90 dark:text-foreground dark:opacity-100">
                {formatResultSummary(computed.result)}
              </p>
            </section>
          )}
        </div>

        {computed && revealed && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={!canSaveImage}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {imageSaveStatus === "saving" ? "이미지 생성 중…" : "결과 이미지 저장"}
              </button>
              {imageSaveStatus === "error" && (
                <p role="alert" className="text-sm text-danger">
                  이미지를 저장하지 못했습니다. 공유 영역의 &apos;링크 복사&apos;로 결과를 대신
                  공유해 보세요.
                </p>
              )}
            </div>

            <SectionCard title="계산 근거" icon={<SectionIcon name="formula" />}>
              <ul className="space-y-4">
                {breakdown.map((line) => (
                  <li key={line.label} className="text-sm">
                    <p className="font-medium">{line.label}</p>
                    <p className="mt-0.5 leading-6 text-muted">{line.detail}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 소개 · 사용 방법 ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <UsageGuide description="분배 방식을 고르고 멤버·금액만 입력하면 자동으로 계산합니다." steps={BILL_SPLIT_USAGE_STEPS} />
        <IntroSection title="더치페이, 세 가지 방식 중 어떻게 고를까요?" paragraphs={BILL_SPLIT_INTRO_PARAGRAPHS} />
      </div>

      {/* ── 이용 안내 고지 + FAQ ─────────────────────────────────────── */}
      <SectionCard title="이용 안내" icon={<SectionIcon name="info" />} className="mt-8">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {BILL_SPLIT_ASSUMPTION_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </SectionCard>
      <div className="mt-5">
        <FaqAccordion items={billSplitCalculatorFaqItems} />
      </div>
    </div>
  );
}
