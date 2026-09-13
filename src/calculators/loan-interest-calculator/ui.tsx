"use client";

/**
 * 대출 이자 계산기 — 입력/결과 UI.
 *
 * tasks/loan-interest-calculator/ARCHITECTURE.md "7. UI 구조"를 그대로 구현한다. 소개
 * (IntroSection)·사용 방법(UsageGuide)은 다른 계산기들과 통일된 위치(결과·계산 근거 아래,
 * 계산 전제 고지 바로 앞)에 배치한다(2026-09-07 정정 — 최초 구현은 ARCHITECTURE.md 문구를
 * 따라 입력 폼보다 앞에 뒀으나, 실제로는 이 사이트의 다른 모든 계산기가 결과 아래에 두고
 * 있어 시각적 일관성이 깨졌다).
 *
 * 계산 공식은 이 파일에 두지 않는다(logic/). 이 파일은 폼 상태 관리와 표시만 담당한다
 * (docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 */

import Link from "next/link";
import { useId, useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { IntroSection } from "@/components/calculator/IntroSection";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import {
  LOAN_INTEREST_ASSUMPTION_NOTICES,
  LOAN_INTEREST_INTRO_PARAGRAPHS,
  LOAN_INTEREST_USAGE_STEPS,
  loanInterestCalculatorFaqItems,
  repaymentMethodSummaries,
} from "./content";
import {
  buildLoanInterestBreakdown,
  buildYearlySummaryDisplayRows,
  formatAnnualRatePercent,
  formatLoanTerm,
  formatWon,
  LAST_INSTALLMENT_ROUNDING_NOTE,
  repaymentMethodLabels,
} from "./formatting";
import { calculateLoanInterest } from "./logic";
import type { LoanInterestCalculatorInput, LoanInterestCalculatorResult, RepaymentMethod } from "./types";
import {
  MAX_MONTHS_FIELD,
  MAX_YEARS_FIELD,
  validateLoanInterestCalculatorInput,
  type LoanInterestValidationField,
  type RawLoanInterestCalculatorFormInput,
  type ValidationFieldError,
} from "./validation";

const EMPTY_FORM: RawLoanInterestCalculatorFormInput = {
  principal: "",
  annualRatePercent: "",
  years: "",
  months: "",
  repaymentMethod: "",
};

/**
 * FORMULA.md 검증 예제 5(원리금균등상환, 토스피드 실사례 — 1억원·연5%·20년 →
 * 월상환액 659,956원)를 그대로 샘플로 쓴다(docs/DESIGN_SYSTEM.md "Reset / Sample").
 */
const SAMPLE_FORM: RawLoanInterestCalculatorFormInput = {
  principal: "100,000,000",
  annualRatePercent: "5",
  years: "20",
  months: "0",
  repaymentMethod: "equalInstallment",
};

const REPAYMENT_METHOD_OPTIONS: RepaymentMethod[] = ["equalInstallment", "equalPrincipal", "bullet"];

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

function SectionIcon({ name }: { name: "chart" | "formula" | "document" | "info" }) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

/** 결과 화면 핵심 카드의 방식별 제목/큰 숫자(SPEC.md "계산 결과" 절, ARCHITECTURE.md "7."). */
function KeyResultPrimary({ result }: { result: LoanInterestCalculatorResult }) {
  switch (result.repaymentMethod) {
    case "equalInstallment":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">매월 상환액</h2>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
            {formatWon(result.fixedMonthlyPayment)}
          </p>
        </>
      );
    case "equalPrincipal": {
      // 연이율 0% 경계값에서는 매 회차 이자가 0원이라 첫 회차·마지막 회차 상환액이 완전히
      // 같아진다 — "N원 ~ N원"처럼 무의미한 범위로 보이지 않도록 단일 값 + "동일" 안내로
      // 바꿔 표시한다(UX/UI Critic Low #8).
      const isFlat = result.firstPayment === result.lastPayment;
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
            {isFlat ? "매 회차 상환액" : "첫 회차 ~ 마지막 회차 상환액"}
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-4xl">
            {isFlat
              ? `${formatWon(result.firstPayment)} (동일)`
              : `${formatWon(result.firstPayment)} ~ ${formatWon(result.lastPayment)}`}
          </p>
          {isFlat && (
            <p className="mt-2 text-xs opacity-75 dark:text-muted dark:opacity-100">
              연이율이 0%라 이자가 없어 매 회차 상환액이 동일합니다.
            </p>
          )}
        </>
      );
    }
    case "bullet":
      return (
        <>
          <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
            매월 이자(만기 전, 고정)
          </h2>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
            {formatWon(result.monthlyInterestBeforeMaturity)}
          </p>
          <p className="mt-3 text-sm opacity-90 dark:text-foreground dark:opacity-100">
            만기 상환액(원금 전액 + 마지막 달 이자){" "}
            <strong className="text-base">{formatWon(result.maturityPayment)}</strong>
          </p>
        </>
      );
    default: {
      const exhaustiveCheck: never = result;
      return exhaustiveCheck;
    }
  }
}

export default function LoanInterestCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawLoanInterestCalculatorFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<LoanInterestCalculatorResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<LoanInterestCalculatorInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    if (!root) return;
    if (
      typeof root.principal !== "number" ||
      typeof root.annualRatePercent !== "number" ||
      typeof root.termMonths !== "number" ||
      typeof root.repaymentMethod !== "string"
    ) {
      return;
    }
    const years = Math.floor(root.termMonths / 12);
    const months = root.termMonths % 12;
    const restoredForm: RawLoanInterestCalculatorFormInput = {
      principal: String(root.principal),
      annualRatePercent: String(root.annualRatePercent),
      years: String(years),
      months: String(months),
      repaymentMethod: root.repaymentMethod as RepaymentMethod,
    };
    const validation = validateLoanInterestCalculatorInput(restoredForm);
    if (!validation.success) return;
    setForm({
      ...restoredForm,
      principal: root.principal.toLocaleString("ko-KR"),
    });
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateLoanInterest(validation.data));
  });

  function errorFor(field: LoanInterestValidationField): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  /** 여러 오류 안내 id를 공백으로 이어붙여 `aria-describedby`에 넘긴다(없으면 undefined). */
  function describedBy(...ids: Array<string | undefined>): string | undefined {
    const present = ids.filter((id): id is string => Boolean(id));
    return present.length > 0 ? present.join(" ") : undefined;
  }

  function clearResult() {
    setResult(null);
    setAppliedInput(null);
  }

  /** 금액(원) 입력 실시간 천 단위 콤마 표시(severance-pay/four-major-insurance 공용 패턴). */
  function handlePrincipalChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setForm((prev) => ({ ...prev, principal: digits ? Number(digits).toLocaleString("ko-KR") : "" }));
    clearResult();
  }

  /** 연이율은 소수 입력을 허용하되 숫자·소수점 하나만 남긴다(콤마 표시 대상 아님). */
  function handleRateChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/[^0-9.]/g, "");
    const firstDot = raw.indexOf(".");
    const normalized =
      firstDot === -1 ? raw : raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
    setForm((prev) => ({ ...prev, annualRatePercent: normalized }));
    clearResult();
  }

  function handleYearsChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, years: event.target.value.replace(/\D/g, "") }));
    clearResult();
  }

  /**
   * "개월" 입력이 12 이상이면(예: 18) ARCHITECTURE.md "5. 대출 기간 입력 UX"가 "가장 친절한
   * 방법"으로 언급한 자동 정규화를 적용한다 — 사용자가 "1년 6개월"로 직접 환산할 필요 없이
   * 년을 올리고 개월을 12로 나눈 나머지로 즉시 바꿔준다(UX/UI Critic Medium #6).
   * `validation.ts`의 검증 로직(합산값 1~480 범위) 자체는 그대로다 — 이 정규화는 입력값을
   * 검증 이전에 UI 레벨에서 다듬을 뿐이다.
   */
  function handleMonthsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    const monthsValue = digits === "" ? 0 : Number(digits);
    if (monthsValue < 12) {
      setForm((prev) => ({ ...prev, months: digits }));
    } else {
      setForm((prev) => {
        const currentYearsDigits = prev.years.replace(/\D/g, "");
        const currentYears = currentYearsDigits === "" ? 0 : Number(currentYearsDigits);
        const extraYears = Math.floor(monthsValue / 12);
        const normalizedMonths = monthsValue % 12;
        return { ...prev, years: String(currentYears + extraYears), months: String(normalizedMonths) };
      });
    }
    clearResult();
  }

  function handleRepaymentMethodChange(method: RepaymentMethod) {
    setForm((prev) => ({ ...prev, repaymentMethod: method }));
    clearResult();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateLoanInterestCalculatorInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateLoanInterest(validation.data));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors([]);
    setResult(null);
    setAppliedInput(null);
  }

  function handleFillSample() {
    setForm(SAMPLE_FORM);
    setErrors([]);
    setResult(null);
    setAppliedInput(null);
  }

  const breakdown = result && appliedInput ? buildLoanInterestBreakdown(appliedInput, result) : [];
  const yearlyRows = result ? buildYearlySummaryDisplayRows(result.yearlySummary) : [];
  const showsLastInstallmentNote =
    result?.repaymentMethod === "equalInstallment" || result?.repaymentMethod === "equalPrincipal";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/finance" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">금융</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">대출 이자 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          대출 원금·연이율·대출 기간과 상환방식을 입력하면 매월(회차별) 상환액과 총 이자·총
          상환금액을 계산 근거와 함께 계산합니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <div>
          <label htmlFor={`${formId}-principal`} className={LABEL_CLASS}>
            대출 원금
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
            placeholder="예: 100,000,000"
            className={FIELD_CLASS}
          />
          {errorFor("principal") && (
            <p id={`${formId}-principal-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("principal")}
            </p>
          )}
        </div>

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
            placeholder="예: 5 또는 4.25"
            className={FIELD_CLASS}
          />
          <p className={HELP_CLASS}>0.05가 아니라 5(%)처럼 입력하세요.</p>
          {errorFor("annualRatePercent") && (
            <p id={`${formId}-annualRatePercent-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("annualRatePercent")}
            </p>
          )}
        </div>

        {/* 대출 기간 — "년+개월" 두 입력(ARCHITECTURE.md "5. 대출 기간 입력 UX", 로컬 서브 구조). */}
        <div>
          <span className={LABEL_CLASS}>
            대출 기간
            <RequiredMark />
          </span>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-years`} className="text-xs font-medium text-muted">
                년
              </label>
              <input
                id={`${formId}-years`}
                inputMode="numeric"
                min={0}
                max={MAX_YEARS_FIELD}
                value={form.years}
                aria-required="true"
                aria-invalid={errorFor("years") || errorFor("termMonths") ? true : undefined}
                aria-describedby={describedBy(
                  errorFor("years") ? `${formId}-years-error` : undefined,
                  errorFor("termMonths") ? `${formId}-termMonths-error` : undefined,
                )}
                onChange={handleYearsChange}
                placeholder="0"
                className={FIELD_CLASS}
              />
              {errorFor("years") && (
                <p id={`${formId}-years-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("years")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${formId}-months`} className="text-xs font-medium text-muted">
                개월
              </label>
              <input
                id={`${formId}-months`}
                inputMode="numeric"
                min={0}
                max={MAX_MONTHS_FIELD}
                value={form.months}
                aria-required="true"
                aria-invalid={errorFor("months") || errorFor("termMonths") ? true : undefined}
                aria-describedby={describedBy(
                  errorFor("months") ? `${formId}-months-error` : undefined,
                  errorFor("termMonths") ? `${formId}-termMonths-error` : undefined,
                )}
                onChange={handleMonthsChange}
                placeholder="0"
                className={FIELD_CLASS}
              />
              {errorFor("months") && (
                <p id={`${formId}-months-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("months")}
                </p>
              )}
            </div>
          </div>
          {/*
            "년+개월" 합산값(termMonths) 검증 오류는 두 필드 중 하나에만 귀속시키지 않고 두
            필드를 감싸는 그룹 레벨에 표시한다 — 원인이 "년" 필드일 수도 있다는 걸 가리지
            않기 위함이다(UX/UI Critic Low #5).
          */}
          {errorFor("termMonths") && (
            <p id={`${formId}-termMonths-error`} role="alert" className={`${ERROR_CLASS} mt-2`}>
              {errorFor("termMonths")}
            </p>
          )}
          <p className={HELP_CLASS}>
            예: 20년 만기 대출은 &apos;20년 0개월&apos;로 입력하세요(최대 {MAX_YEARS_FIELD}년).
            &apos;개월&apos;에 12 이상을 입력하면(예: 18) 자동으로 &apos;년&apos;으로
            환산됩니다.
          </p>
        </div>

        {/* 상환방식 — SPEC.md "입력" 절: 방식별 한 줄 요약 도움말 포함. */}
        <fieldset className="border-t border-border pt-6">
          <legend className={LABEL_CLASS}>
            상환방식
            <RequiredMark />
          </legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {REPAYMENT_METHOD_OPTIONS.map((method) => (
              <label
                key={method}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                  form.repaymentMethod === method
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-repaymentMethod`}
                  className="sr-only"
                  checked={form.repaymentMethod === method}
                  aria-required="true"
                  onChange={() => handleRepaymentMethodChange(method)}
                />
                {repaymentMethodLabels[method]}
                <span className="mt-1 block text-xs font-normal text-muted">
                  {repaymentMethodSummaries[method]}
                </span>
              </label>
            ))}
          </div>
          {errorFor("repaymentMethod") && (
            <p role="alert" className={`${ERROR_CLASS} mt-2`}>
              {errorFor("repaymentMethod")}
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            대출 이자 계산하기
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
        title="대출 이자 계산기"
        text={
          result
            ? `${repaymentMethodLabels[result.repaymentMethod]} 기준 총 이자는 ${formatWon(result.totalInterest)}입니다.`
            : "대출 원금·연이율·대출 기간과 상환방식으로 매월 상환액과 총 이자를 계산해 보세요."
        }
        url={
          baseUrl
            ? result && appliedInput
              ? buildStateShareUrl(baseUrl, {
                  principal: appliedInput.principal,
                  annualRatePercent: appliedInput.annualRatePercent,
                  termMonths: appliedInput.termMonths,
                  repaymentMethod: appliedInput.repaymentMethod,
                })
              : baseUrl
            : undefined
        }
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && (
          <>
            {/* 핵심 결과 카드 — 방식별 템플릿(SPEC.md "계산 결과", ARCHITECTURE.md "7."). */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <KeyResultPrimary result={result} />
              <p className="mt-4 text-sm opacity-90 dark:text-foreground dark:opacity-100">
                총 이자 <strong className="text-base">{formatWon(result.totalInterest)}</strong> · 총
                상환금액 <strong className="text-base">{formatWon(result.totalPayment)}</strong>
              </p>
              {/*
                아래 "적용된 입력값" 카드가 대출 원금·연이율·대출 기간·상환방식 4개 값을 이미
                모두 보여주므로, 이 캡션은 그 값들을 다시 반복하지 않고(UX/UI Critic Low #12 —
                중복 제거) 이 카드 안의 숫자가 "어느 상환방식 기준인지"만 짧게 표시한다(다른
                상환방식으로 바꿔가며 비교할 때 카드 형태가 왜 다른지 바로 알 수 있도록 —
                UX/UI Critic Q7).
              */}
              <p className="mt-3 text-xs opacity-75 dark:text-muted dark:opacity-100">
                {repaymentMethodLabels[result.repaymentMethod]} 기준
              </p>
              {showsLastInstallmentNote && (
                <p className="mt-2 text-xs opacity-70 dark:text-muted dark:opacity-100">
                  {LAST_INSTALLMENT_ROUNDING_NOTE}
                </p>
              )}
            </section>

            {/* 연도별 상환 스케줄 요약표(SPEC.md Must Have) — 모바일 카드, 데스크톱 표. */}
            <SectionCard title="연도별 상환 스케줄 요약" icon={<SectionIcon name="chart" />}>
              <div className="space-y-3 sm:hidden">
                {yearlyRows.map((row) => (
                  <article key={row.key} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{row.yearLabel}</strong>
                      <span className="text-xs text-muted">연말 잔액 {row.endOfYearBalance}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted">원금 합계</dt>
                        <dd className="mt-0.5 font-semibold">{row.principalPaymentTotal}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">이자 합계</dt>
                        <dd className="mt-0.5 font-semibold">{row.interestTotal}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border text-muted">
                    <tr>
                      <th className="py-3 pr-3">연차</th>
                      <th className="py-3 pr-3 text-right">원금 합계</th>
                      <th className="py-3 pr-3 text-right">이자 합계</th>
                      <th className="py-3 text-right">연말 잔액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {yearlyRows.map((row) => (
                      <tr key={row.key}>
                        <td className="py-3 pr-3 font-semibold">{row.yearLabel}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{row.principalPaymentTotal}</td>
                        <td className="py-3 pr-3 text-right tabular-nums">{row.interestTotal}</td>
                        <td className="py-3 text-right font-semibold tabular-nums">{row.endOfYearBalance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

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

            <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">대출 원금</dt>
                  <dd>{formatWon(appliedInput.principal)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">연이율</dt>
                  <dd>{formatAnnualRatePercent(appliedInput.annualRatePercent)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">대출 기간</dt>
                  <dd>{formatLoanTerm(appliedInput.termMonths)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">상환방식</dt>
                  <dd>{repaymentMethodLabels[appliedInput.repaymentMethod]}</dd>
                </div>
              </dl>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 소개 · 사용 방법 (다른 계산기와 동일하게 결과/계산 근거 아래에 배치) ── */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="대출 원금·연이율·대출 기간과 상환방식만 입력하면 자동으로 계산합니다."
          steps={LOAN_INTEREST_USAGE_STEPS}
        />
        <IntroSection title="대출 이자, 상환방식마다 왜 다른가요?" paragraphs={LOAN_INTEREST_INTRO_PARAGRAPHS} />
      </div>

      {/* ── 계산 전제 고지 + FAQ ─────────────────────────────────────── */}
      <SectionCard title="계산 전 확인" icon={<SectionIcon name="info" />} className="mt-8">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {LOAN_INTEREST_ASSUMPTION_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </SectionCard>
      <section className="mt-5 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">
        입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.
      </section>
      <div className="mt-5">
        <FaqAccordion items={loanInterestCalculatorFaqItems} />
      </div>
    </div>
  );
}
