"use client";

/**
 * 예금·적금 이자 계산기 — 입력/결과 UI.
 *
 * tasks/deposit-savings-interest-calculator/ARCHITECTURE.md "8. UI 레이아웃"을 그대로
 * 구현한다. 계산 공식은 이 파일에 두지 않는다(logic.ts) — 이 파일은 폼 상태 관리와 표시만
 * 담당한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * 화면 순서(docs/DESIGN_SYSTEM.md "공통 화면 순서"): 헤더 → 모드 토글 → 입력 폼 → 공유 →
 * 계산 버튼 → 핵심 결과 카드 → (적금) 회차별 표 → 계산 근거 → 소개·사용 방법 → 정책 안내 →
 * FAQ.
 */

import Link from "next/link";
import { useId, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { IntroSection } from "@/components/calculator/IntroSection";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import {
  ANNUAL_RATE_HELP_TEXT,
  DEPOSIT_SAVINGS_ASSUMPTION_NOTICES,
  DEPOSIT_SAVINGS_INTRO_PARAGRAPHS,
  DEPOSIT_SAVINGS_USAGE_STEPS,
  MONTHLY_CONTRIBUTION_HELP_TEXT,
  SAVINGS_INTEREST_TYPE_NOTE,
  depositInterestTypeSummaries,
  depositSavingsInterestCalculatorFaqItems,
} from "./content";
import {
  buildDepositSavingsInterestBreakdown,
  buildSavingsScheduleDisplayRows,
  depositInterestTypeLabels,
  formatAnnualRatePercent,
  formatMonthlyRatePercent,
  formatScheduleSumNotice,
  formatTermMonths,
  formatWon,
} from "./formatting";
import { calculateDepositSavingsInterest } from "./logic";
import type {
  DepositInterestType,
  DepositSavingsInterestCalculatorInput,
  DepositSavingsInterestCalculatorMode,
  DepositSavingsInterestCalculatorResult,
} from "./types";
import {
  MAX_TERM_MONTHS,
  validateDepositSavingsInterestCalculatorInput,
  type DepositSavingsInterestField,
  type RawDepositSavingsInterestCalculatorFormInput,
  type ValidationFieldError,
} from "./validation";

const EMPTY_FORM: RawDepositSavingsInterestCalculatorFormInput = {
  mode: "deposit",
  annualRatePercent: "",
  termMonths: "",
  principal: "",
  interestType: "",
  monthlyContribution: "",
};

/** FORMULA.md 검증 예제 1(예금 단리) — 원금 1,000만원·연3%·12개월. */
const DEPOSIT_SAMPLE_FORM: RawDepositSavingsInterestCalculatorFormInput = {
  mode: "deposit",
  annualRatePercent: "3",
  termMonths: "12",
  principal: "10,000,000",
  interestType: "simple",
  monthlyContribution: "",
};

/** FORMULA.md 검증 예제 7(적금 단리 후취식) — 월 50만원·연3%·12개월. */
const SAVINGS_SAMPLE_FORM: RawDepositSavingsInterestCalculatorFormInput = {
  mode: "savings",
  annualRatePercent: "3",
  termMonths: "12",
  principal: "",
  interestType: "",
  monthlyContribution: "500,000",
};

const INTEREST_TYPE_OPTIONS: DepositInterestType[] = ["simple", "compound"];

const FIELD_CLASS =
  "mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-600 dark:text-red-400">
      {" "}
      *
    </span>
  );
}

function SectionIcon({ name }: { name: "formula" | "document" | "info" | "table" }) {
  const paths = {
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
    table: <path d="M3 4h18v16H3V4Zm0 6h18M9 4v16" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

/**
 * 핵심 결과 카드 본문 — 모드별로 다른 템플릿(SPEC.md "계산 결과", ARCHITECTURE.md "8.1" 6번).
 * `result.mode`로 우선 분기하고(exhaustive), 예금 내부의 `interestType`은 이 함수 안에서
 * `result.interestType === "compound"` 검사로 `monthlyRate` 필드에 안전하게 접근한다 —
 * TypeScript 판별 유니온 덕분에 단리 결과에서는 애초에 `monthlyRate`에 접근할 수 없다
 * (docs/CALCULATOR_RULES.md "서로 다른 계산 방식을 같은 공식으로 처리하지 않는다"를 타입
 * 레벨에서 지킨다 — types.ts 설계 그대로).
 */
function KeyResultCard({ result }: { result: DepositSavingsInterestCalculatorResult }) {
  switch (result.mode) {
    case "deposit":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">세후 만기수령액</h2>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
            {formatWon(result.afterTaxMaturityAmount)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm opacity-90 dark:text-foreground dark:opacity-100 sm:grid-cols-3">
            <div>
              <dt className="text-xs opacity-70">원금</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.principal)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">세전 이자</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.preTaxInterest)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">이자소득세(15.4%)</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.totalTax)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">세후 이자</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.afterTaxInterest)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">적용 연이율</dt>
              <dd className="font-semibold tabular-nums">{formatAnnualRatePercent(result.annualRatePercent)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">기간</dt>
              <dd className="font-semibold tabular-nums">{formatTermMonths(result.termMonths)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">계산방식</dt>
              <dd className="font-semibold">{depositInterestTypeLabels[result.interestType]}</dd>
            </div>
            {result.interestType === "compound" && (
              <div>
                <dt className="text-xs opacity-70">월이율</dt>
                <dd className="font-semibold tabular-nums">{formatMonthlyRatePercent(result.monthlyRate)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs opacity-75 dark:text-muted dark:opacity-100">
            실제 세후 수령액은 참고용 추정치입니다.
          </p>
        </>
      );
    case "savings":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">세후 만기수령액</h2>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
            {formatWon(result.afterTaxMaturityAmount)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm opacity-90 dark:text-foreground dark:opacity-100 sm:grid-cols-3">
            <div>
              <dt className="text-xs opacity-70">납입원금 합계</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.totalPrincipal)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">세전 이자</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.preTaxInterest)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">이자소득세(15.4%)</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.totalTax)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">세후 이자</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.afterTaxInterest)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">월 납입액</dt>
              <dd className="font-semibold tabular-nums">{formatWon(result.monthlyContribution)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">적용 연이율</dt>
              <dd className="font-semibold tabular-nums">{formatAnnualRatePercent(result.annualRatePercent)}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">기간</dt>
              <dd className="font-semibold tabular-nums">{formatTermMonths(result.termMonths)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs opacity-75 dark:text-muted dark:opacity-100">
            실제 세후 수령액은 참고용 추정치입니다.
          </p>
        </>
      );
    default: {
      const exhaustiveCheck: never = result;
      return exhaustiveCheck;
    }
  }
}

export default function DepositSavingsInterestCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawDepositSavingsInterestCalculatorFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<DepositSavingsInterestCalculatorResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<DepositSavingsInterestCalculatorInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    if (!root) return;
    if (
      (root.mode !== "deposit" && root.mode !== "savings") ||
      typeof root.annualRatePercent !== "number" ||
      typeof root.termMonths !== "number"
    ) {
      return;
    }
    const restoredForm: RawDepositSavingsInterestCalculatorFormInput =
      root.mode === "deposit"
        ? {
            mode: "deposit",
            annualRatePercent: String(root.annualRatePercent),
            termMonths: String(root.termMonths),
            principal: typeof root.amount === "number" ? root.amount.toLocaleString("ko-KR") : "",
            interestType: root.interestType === "compound" ? "compound" : "simple",
            monthlyContribution: "",
          }
        : {
            mode: "savings",
            annualRatePercent: String(root.annualRatePercent),
            termMonths: String(root.termMonths),
            principal: "",
            interestType: "",
            monthlyContribution: typeof root.amount === "number" ? root.amount.toLocaleString("ko-KR") : "",
          };
    const validation = validateDepositSavingsInterestCalculatorInput(restoredForm);
    if (!validation.success) return;
    setForm(restoredForm);
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateDepositSavingsInterest(validation.data));
  });

  function errorFor(field: DepositSavingsInterestField): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function clearResult() {
    setResult(null);
    setAppliedInput(null);
  }

  function handleModeChange(mode: DepositSavingsInterestCalculatorMode) {
    setForm((prev) => ({ ...prev, mode }));
    setErrors([]);
    clearResult();
  }

  /** 금액(원) 입력 실시간 천 단위 콤마 표시(severance-pay/loan-interest-calculator 공용 패턴). */
  function handlePrincipalChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setForm((prev) => ({ ...prev, principal: digits ? Number(digits).toLocaleString("ko-KR") : "" }));
    clearResult();
  }

  function handleMonthlyContributionChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setForm((prev) => ({
      ...prev,
      monthlyContribution: digits ? Number(digits).toLocaleString("ko-KR") : "",
    }));
    clearResult();
  }

  /** 연이율은 소수 입력을 허용하되 숫자·소수점 하나만 남긴다(콤마 표시 대상 아님). */
  function handleRateChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/[^0-9.]/g, "");
    const firstDot = raw.indexOf(".");
    const normalized =
      firstDot === -1 ? raw : raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
    setForm((prev) => ({ ...prev, annualRatePercent: normalized }));
    clearResult();
  }

  function handleTermMonthsChange(event: ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, termMonths: event.target.value.replace(/\D/g, "") }));
    clearResult();
  }

  function handleInterestTypeChange(interestType: DepositInterestType) {
    setForm((prev) => ({ ...prev, interestType }));
    clearResult();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateDepositSavingsInterestCalculatorInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      clearResult();
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateDepositSavingsInterest(validation.data));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors([]);
    clearResult();
  }

  function handleFillSample() {
    setForm(form.mode === "savings" ? SAVINGS_SAMPLE_FORM : DEPOSIT_SAMPLE_FORM);
    setErrors([]);
    clearResult();
  }

  const breakdown = result ? buildDepositSavingsInterestBreakdown(result) : [];
  const scheduleRows = result && result.mode === "savings" ? buildSavingsScheduleDisplayRows(result.schedule) : [];

  const shareText = (() => {
    if (!result) {
      return "예금·적금의 세전/세후 이자와 세후 만기수령액을 계산해 보세요.";
    }
    return `${result.mode === "deposit" ? "예금" : "적금"} 세후 만기수령액은 ${formatWon(result.afterTaxMaturityAmount)}입니다.`;
  })();

  const shareData =
    appliedInput &&
    (appliedInput.mode === "deposit"
      ? {
          mode: appliedInput.mode,
          amount: appliedInput.principal,
          annualRatePercent: appliedInput.annualRatePercent,
          termMonths: appliedInput.termMonths,
          interestType: appliedInput.interestType,
        }
      : {
          mode: appliedInput.mode,
          amount: appliedInput.monthlyContribution,
          annualRatePercent: appliedInput.annualRatePercent,
          termMonths: appliedInput.termMonths,
        });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/finance" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
          금융
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">예금·적금 이자 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          예치 원금 또는 월 납입액과 연이율·기간을 입력하면 세전 이자, 이자소득세(15.4%), 세후
          이자, 세후 만기수령액을 계산 근거와 함께 계산합니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        {/* 모드 토글(세그먼트 버튼) — SPEC.md "입력 모델". */}
        <div>
          <span className={LABEL_CLASS}>계산 방식</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["deposit", "savings"] as DepositSavingsInterestCalculatorMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                aria-pressed={form.mode === mode}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  form.mode === mode
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground hover:border-border-strong"
                }`}
              >
                {mode === "deposit" ? "예금 계산" : "적금 계산"}
              </button>
            ))}
          </div>
        </div>

        {/* 공통 입력: 연이율 → 기간(ARCHITECTURE.md "8.1" 3번). */}
        <div>
          <label htmlFor={`${formId}-annualRatePercent`} className={LABEL_CLASS}>
            연이율
            <RequiredMark />
            <span className="ml-1 text-xs font-normal text-muted">(%)</span>
          </label>
          <input
            id={`${formId}-annualRatePercent`}
            inputMode="decimal"
            value={form.annualRatePercent}
            aria-required="true"
            aria-invalid={errorFor("annualRatePercent") ? true : undefined}
            aria-describedby={errorFor("annualRatePercent") ? `${formId}-annualRatePercent-error` : undefined}
            onChange={handleRateChange}
            placeholder="예: 3 또는 3.45"
            className={FIELD_CLASS}
          />
          <p className={HELP_CLASS}>{ANNUAL_RATE_HELP_TEXT}</p>
          {errorFor("annualRatePercent") && (
            <p id={`${formId}-annualRatePercent-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("annualRatePercent")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${formId}-termMonths`} className={LABEL_CLASS}>
            {form.mode === "deposit" ? "예치 기간" : "적립 기간"}
            <RequiredMark />
            <span className="ml-1 text-xs font-normal text-muted">(개월)</span>
          </label>
          <input
            id={`${formId}-termMonths`}
            inputMode="numeric"
            min={1}
            max={MAX_TERM_MONTHS}
            value={form.termMonths}
            aria-required="true"
            aria-invalid={errorFor("termMonths") ? true : undefined}
            aria-describedby={errorFor("termMonths") ? `${formId}-termMonths-error` : undefined}
            onChange={handleTermMonthsChange}
            placeholder="예: 12"
            className={FIELD_CLASS}
          />
          <p className={HELP_CLASS}>최대 {MAX_TERM_MONTHS}개월({MAX_TERM_MONTHS / 12}년)까지 입력할 수 있습니다.</p>
          {errorFor("termMonths") && (
            <p id={`${formId}-termMonths-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("termMonths")}
            </p>
          )}
        </div>

        {/* 모드 전용 입력 */}
        {form.mode === "deposit" ? (
          <>
            <div>
              <label htmlFor={`${formId}-principal`} className={LABEL_CLASS}>
                예치 원금
                <RequiredMark />
                <span className="ml-1 text-xs font-normal text-muted">(원)</span>
              </label>
              <input
                id={`${formId}-principal`}
                inputMode="numeric"
                value={form.principal}
                aria-required="true"
                aria-invalid={errorFor("principal") ? true : undefined}
                aria-describedby={errorFor("principal") ? `${formId}-principal-error` : undefined}
                onChange={handlePrincipalChange}
                placeholder="예: 10,000,000"
                className={FIELD_CLASS}
              />
              {errorFor("principal") && (
                <p id={`${formId}-principal-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("principal")}
                </p>
              )}
            </div>

            <fieldset className="border-t border-border pt-6">
              <legend className={LABEL_CLASS}>
                이자 계산 방식
                <RequiredMark />
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {INTEREST_TYPE_OPTIONS.map((type) => (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                      form.interestType === type
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${formId}-interestType`}
                      className="sr-only"
                      checked={form.interestType === type}
                      aria-required="true"
                      onChange={() => handleInterestTypeChange(type)}
                    />
                    {depositInterestTypeLabels[type]}
                    <span className="mt-1 block text-xs font-normal text-muted">
                      {depositInterestTypeSummaries[type]}
                    </span>
                  </label>
                ))}
              </div>
              {errorFor("interestType") && (
                <p role="alert" className={`${ERROR_CLASS} mt-2`}>
                  {errorFor("interestType")}
                </p>
              )}
            </fieldset>
          </>
        ) : (
          <div>
            <label htmlFor={`${formId}-monthlyContribution`} className={LABEL_CLASS}>
              월 납입액
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-monthlyContribution`}
              inputMode="numeric"
              value={form.monthlyContribution}
              aria-required="true"
              aria-invalid={errorFor("monthlyContribution") ? true : undefined}
              aria-describedby={errorFor("monthlyContribution") ? `${formId}-monthlyContribution-error` : undefined}
              onChange={handleMonthlyContributionChange}
              placeholder="예: 500,000"
              className={FIELD_CLASS}
            />
            <p className={HELP_CLASS}>{MONTHLY_CONTRIBUTION_HELP_TEXT}</p>
            <p className={HELP_CLASS}>{SAVINGS_INTEREST_TYPE_NOTE}</p>
            {errorFor("monthlyContribution") && (
              <p id={`${formId}-monthlyContribution-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("monthlyContribution")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            {form.mode === "deposit" ? "예금 이자 계산하기" : "적금 이자 계산하기"}
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
        title="예금·적금 이자 계산기"
        text={shareText}
        url={baseUrl ? (shareData ? buildStateShareUrl(baseUrl, shareData) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && (
          <>
            {/* 핵심 결과 카드 — 모드별 템플릿(SPEC.md "계산 결과", ARCHITECTURE.md "8.1" 6번). */}
            <section className="min-h-[220px] overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <KeyResultCard result={result} />
            </section>

            {/* (적금 모드) 회차별 breakdown 표 — ARCHITECTURE.md "8.2".
                320~390px 모바일에서는 4개 열을 가진 표가 min-w 없이도 자연스러운 가로
                스크롤 없이 들어가기 어려워(UX/UI Critic 지적) `sm:` 미만에서 세로로 쌓는
                리스트로 대체한다 — loan-interest-calculator "연도별 상환 스케줄 요약"의
                `sm:hidden`/`hidden sm:block` 이중 렌더링 패턴을 그대로 재사용한다. 두
                버전 모두 같은 `scheduleRows` 데이터를 쓰므로 표시되는 값은 동일하다. */}
            {result.mode === "savings" && (
              <SectionCard title="회차별 납입·이자 내역" icon={<SectionIcon name="table" />}>
                <ul className="max-h-[420px] divide-y divide-border overflow-y-auto rounded-xl border border-border sm:hidden">
                  {scheduleRows.map((row) => (
                    <li key={row.key} className="px-3 py-2.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold tabular-nums">{row.installment}회차</span>
                        <span className="text-xs text-muted">잔여 {row.remainingMonths}</span>
                      </div>
                      <dl className="mt-1 space-y-0.5 text-xs text-muted">
                        <div className="flex items-center justify-between gap-2">
                          <dt>납입액</dt>
                          <dd className="tabular-nums text-foreground">{row.contribution}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt>세전 이자</dt>
                          <dd className="tabular-nums text-foreground">{row.interest}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className="hidden max-h-[420px] overflow-x-auto overflow-y-auto rounded-xl border border-border sm:block">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 border-b border-border bg-surface text-muted">
                      <tr>
                        <th className="py-3 pr-3 pl-3">회차</th>
                        <th className="py-3 pr-3 text-right">납입액</th>
                        <th className="py-3 pr-3 text-right">잔여개월</th>
                        <th className="py-3 pr-3 text-right">세전 이자</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {scheduleRows.map((row) => (
                        <tr key={row.key}>
                          <td className="py-2.5 pr-3 pl-3 font-semibold tabular-nums">{row.installment}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{row.contribution}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{row.remainingMonths}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{row.interest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-muted">{formatScheduleSumNotice(result.schedule, result.preTaxInterest)}</p>
              </SectionCard>
            )}

            {/* 계산 근거 */}
            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {breakdown.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-0.5 text-xs text-muted">근거: {row.legalBasis}</p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{row.expression}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 소개 · 사용 방법 ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="예금(거치식)·적금(적립식) 중 하나를 고르고 금액·연이율·기간만 입력하면 자동으로 계산합니다."
          steps={DEPOSIT_SAVINGS_USAGE_STEPS}
        />
        <IntroSection
          title="예금·적금 이자, 세후로 얼마나 받을 수 있나요?"
          paragraphs={DEPOSIT_SAVINGS_INTRO_PARAGRAPHS}
        />
      </div>

      {/* ── 정책 안내 + FAQ ─────────────────────────────────────────── */}
      <SectionCard title="계산 전 확인" icon={<SectionIcon name="info" />} className="mt-8">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {DEPOSIT_SAVINGS_ASSUMPTION_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </SectionCard>
      <section className="mt-5 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">
        입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.
      </section>
      <div className="mt-5">
        <FaqAccordion items={depositSavingsInterestCalculatorFaqItems} />
      </div>
    </div>
  );
}
