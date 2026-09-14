"use client";

/**
 * 연차수당 계산기 — 입력/결과 UI.
 *
 * tasks/annual-leave-allowance/ARCHITECTURE.md "12."가 정한 화면 순서를 그대로 구현한다:
 * 입력(입사일 → 기준일 → 사용일수 → 1일 통상임금) → 핵심 결과 카드(allowance 유무로 전환) →
 * 보조 정보(발생일수·미사용일수, 항상 노출) → 계산 근거(4단계) → 정책 고지(5종, 항상 노출) →
 * 소개·사용법·FAQ. docs/DESIGN_SYSTEM.md 공통 화면 순서를 따른다.
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { IntroSection } from "@/components/calculator/IntroSection";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import { buildStateShareUrl } from "@/src/lib/share";
import {
  ANNUAL_LEAVE_DATA_REVIEW_NOTICE,
  ANNUAL_LEAVE_INTRO_HIGHLIGHTS,
  ANNUAL_LEAVE_INTRO_PARAGRAPHS,
  ANNUAL_LEAVE_POLICY_NOTICES,
  ANNUAL_LEAVE_USAGE_STEPS,
  ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT,
  annualLeaveAllowanceFaqItems,
} from "./content";
import {
  buildAllowanceBreakdown,
  buildBelowMinimumWageWarning,
  buildOver2YearsAccrualBreakdown,
  buildServicePeriodBreakdown,
  buildUnder1YearAccrualBreakdown,
  buildUnusedDaysBreakdown,
  buildYear1To2AccrualBreakdown,
  CONTINUOUS_SERVICE_REGIME_LABELS,
  formatDays,
  formatWon,
  USED_MORE_THAN_ACCRUED_WARNING_TEXT,
} from "./formatting";
import { calculateAnnualLeaveAllowance } from "./logic";
import type { AnnualLeaveAllowanceInput, AnnualLeaveAllowanceResult } from "./types";
import {
  getMaxAllowedDate,
  MIN_ALLOWED_DATE,
  validateAnnualLeaveAllowanceInput,
  type RawAnnualLeaveAllowanceFormInput,
  type ValidationFieldError,
} from "./validation";

/** 한국 표준시(KST) 기준 "오늘"을 "YYYY-MM-DD"로 반환한다(age-calculator의 동일 패턴을
 *  이 계산기 전용으로 독립 재정의 — cross-import 금지 관례). */
function todayInKorea(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function buildEmptyForm(today: string): RawAnnualLeaveAllowanceFormInput {
  return { hireDate: "", referenceDate: today, usedDays: "", ordinaryDailyWage: "" };
}

/**
 * FORMULA.md 검증 예제 5(정확히 1년 시점, 이 계산기의 가장 중요한 경계값 — 근로기준법
 * 제60조③ 삭제 효과)를 그대로 샘플로 쓴다(docs/DESIGN_SYSTEM.md "Reset / Sample").
 * hireDate=2025-01-15, referenceDate=2026-01-15, usedDays=0, ordinaryDailyWage=50,000원
 * → accruedDays=26, unusedDays=26, unusedLeaveAllowance=1,300,000원이 나와야 한다.
 */
const SAMPLE_FORM: RawAnnualLeaveAllowanceFormInput = {
  hireDate: "2025-01-15",
  referenceDate: "2026-01-15",
  usedDays: "0",
  ordinaryDailyWage: "50,000",
};

const INPUT_CLASS =
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

function SectionIcon({ name }: { name: "chart" | "formula" | "info" | "warning" }) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    warning: (
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

/** "계산 근거" 2단계(발생일수 산출) 문장 — regime별로 다른 breakdown 함수를 호출한다. */
function buildAccrualStepText(result: AnnualLeaveAllowanceResult): string {
  if (result.continuousServiceRegime === "UNDER_1YEAR") {
    return buildUnder1YearAccrualBreakdown(result.completedMonths, result.accruedDays);
  }
  if (result.continuousServiceRegime === "YEAR_1_TO_2") {
    return buildYear1To2AccrualBreakdown(result.accruedDays);
  }
  return buildOver2YearsAccrualBreakdown(result.completedYears, result.accrualBreakdown, result.accruedDays);
}

export default function AnnualLeaveAllowanceUi() {
  const formId = useId();
  const today = todayInKorea();
  const emptyForm = buildEmptyForm(today);
  const [form, setForm] = useState<RawAnnualLeaveAllowanceFormInput>(emptyForm);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<AnnualLeaveAllowanceResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<AnnualLeaveAllowanceInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    const restored: RawAnnualLeaveAllowanceFormInput = {
      hireDate: typeof saved.hireDate === "string" ? saved.hireDate : "",
      referenceDate: typeof saved.referenceDate === "string" ? saved.referenceDate : today,
      usedDays: typeof saved.usedDays === "string" ? saved.usedDays : "",
      ordinaryDailyWage: typeof saved.ordinaryDailyWage === "string" ? saved.ordinaryDailyWage : "",
    };
    const checked = validateAnnualLeaveAllowanceInput(restored);
    if (!checked.success) return;
    setForm(restored);
    setErrors([]);
    setAppliedInput(checked.data);
    setResult(calculateAnnualLeaveAllowance(checked.data));
  });

  function errorFor(field: ValidationFieldError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleDateChange(field: "hireDate" | "referenceDate") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null);
      setAppliedInput(null);
    };
  }

  /** usedDays는 반차 등 소수를 허용하므로 콤마 포맷팅 없이 그대로 받는다(금액 필드가 아님). */
  function handleUsedDaysChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, usedDays: event.target.value }));
    setResult(null);
    setAppliedInput(null);
  }

  /** 1일 통상임금은 금액 입력이라 severance-pay와 동일하게 실시간 천 단위 콤마를 표시한다. */
  function handleOrdinaryDailyWageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/[^0-9]/g, "");
    const formatted = digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "";
    setForm((prev) => ({ ...prev, ordinaryDailyWage: formatted }));
    setResult(null);
    setAppliedInput(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateAnnualLeaveAllowanceInput(form);
    if (!checked.success) {
      setErrors(checked.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(checked.data);
    setResult(calculateAnnualLeaveAllowance(checked.data));
  }

  function handleReset() {
    setForm(emptyForm);
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

  const shareText = (() => {
    if (!result) {
      return "입사일만 입력해도 연차 발생일수를, 사용일수·1일 통상임금까지 입력하면 미사용 연차수당 금액을 계산해 드립니다.";
    }
    if (result.allowance) {
      return `미사용 연차수당은 ${formatWon(result.allowance.unusedLeaveAllowance)}입니다.`;
    }
    return `연차 발생일수는 ${formatDays(result.accruedDays)}입니다.`;
  })();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/labor" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
          노동/근로
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">연차수당 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          입사일만 입력해도 연차 발생일수를 자동으로 계산하고, 사용한 연차일수와 1일 통상임금을
          추가로 입력하면 미사용 연차수당 금액까지 계산 근거와 함께 보여드립니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">계산 정보 입력</h2>
            <p className="mt-1 text-sm text-muted">입사일만 입력해도 발생일수를 계산할 수 있습니다.</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">필수 1개</span>
        </div>

        {/* 입사일 → 기준일(SPEC.md "입력 라벨·순서" — 날짜 두 개를 시간 순서대로 인접 배치) */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-hireDate`} className={LABEL_CLASS}>
              입사일
              <RequiredMark />
            </label>
            <input
              id={`${formId}-hireDate`}
              type="date"
              min={MIN_ALLOWED_DATE}
              max={getMaxAllowedDate()}
              value={form.hireDate}
              onChange={handleDateChange("hireDate")}
              aria-required="true"
              aria-invalid={errorFor("hireDate") ? true : undefined}
              aria-describedby={`${formId}-hireDate-help${errorFor("hireDate") ? ` ${formId}-hireDate-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-hireDate-help`} className={HELP_CLASS}>
              말일(29~31일)이나 2월 29일에 입사한 경우에도 매달/매년 마지막 날을 기준으로 자동
              계산됩니다.
            </p>
            {errorFor("hireDate") && (
              <p id={`${formId}-hireDate-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("hireDate")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-referenceDate`} className={LABEL_CLASS}>
              연차 산정 기준일
              <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
            </label>
            <input
              id={`${formId}-referenceDate`}
              type="date"
              min={MIN_ALLOWED_DATE}
              max={getMaxAllowedDate()}
              value={form.referenceDate}
              onChange={handleDateChange("referenceDate")}
              aria-invalid={errorFor("referenceDate") ? true : undefined}
              aria-describedby={`${formId}-referenceDate-help${errorFor("referenceDate") ? ` ${formId}-referenceDate-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-referenceDate-help`} className={HELP_CLASS}>
              비워두면 오늘 날짜를 기준으로 계산합니다.
            </p>
            {errorFor("referenceDate") && (
              <p id={`${formId}-referenceDate-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("referenceDate")}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-usedDays`} className={LABEL_CLASS}>
              이미 사용한 연차일수
              <span className="ml-1 text-xs font-normal text-muted">(선택, 일)</span>
            </label>
            <input
              id={`${formId}-usedDays`}
              type="text"
              inputMode="decimal"
              value={form.usedDays ?? ""}
              onChange={handleUsedDaysChange}
              placeholder="미입력 시 0일(전부 미사용)"
              aria-invalid={errorFor("usedDays") ? true : undefined}
              aria-describedby={`${formId}-usedDays-help${errorFor("usedDays") ? ` ${formId}-usedDays-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-usedDays-help`} className={HELP_CLASS}>
              발생일수는 가장 최근 발생한 연차만 기준으로 계산합니다(과거 발생분은 1년 내
              미사용 시 소멸한 것으로 간주). 사용일수도 입사 후 누적 총 사용일수가 아니라 이
              최근 발생분 중 사용한 일수를 입력하세요. 모르면 비워두세요(전부 미사용으로
              계산). 반차 등 0.5일 단위도 입력할 수 있습니다.
            </p>
            {errorFor("usedDays") && (
              <p id={`${formId}-usedDays-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("usedDays")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-ordinaryDailyWage`} className={LABEL_CLASS}>
              1일 통상임금
              <span className="ml-1 text-xs font-normal text-muted">(선택, 원)</span>
            </label>
            <input
              id={`${formId}-ordinaryDailyWage`}
              type="text"
              inputMode="numeric"
              value={form.ordinaryDailyWage ?? ""}
              onChange={handleOrdinaryDailyWageChange}
              placeholder="예: 100,000"
              aria-invalid={errorFor("ordinaryDailyWage") ? true : undefined}
              aria-describedby={`${formId}-ordinaryDailyWage-help${errorFor("ordinaryDailyWage") ? ` ${formId}-ordinaryDailyWage-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-ordinaryDailyWage-help`} className={HELP_CLASS}>
              하루치 통상임금(세전)입니다. 정확한 산정 방법을 모르면 하루 근무시간 × 시급으로
              계산한 값을 입력하세요. 비워두면 금액 계산 없이 발생일수·미사용일수까지만
              보여드립니다.
            </p>
            {errorFor("ordinaryDailyWage") && (
              <p id={`${formId}-ordinaryDailyWage-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("ordinaryDailyWage")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            연차수당 계산하기
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
        title="연차수당 계산기"
        text={shareText}
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && (
          <>
            {/* 핵심 결과 카드 — allowance 유무로 내용이 전환된다(계산기당 하나). */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              {result.allowance ? (
                <>
                  <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                    미사용 연차수당
                  </h2>
                  <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                    {formatWon(result.allowance.unusedLeaveAllowance)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                    연차 발생일수
                  </h2>
                  <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                    {formatDays(result.accruedDays)}
                  </p>
                  <p className="mt-3 text-sm opacity-90 dark:text-muted dark:opacity-100">
                    1일 통상임금을 입력하면 미사용 연차수당 금액까지 이어서 계산해드립니다.
                  </p>
                </>
              )}
              <p className="mt-3 text-sm opacity-75 dark:text-muted dark:opacity-100">
                {CONTINUOUS_SERVICE_REGIME_LABELS[result.continuousServiceRegime]} 기준입니다.
              </p>
            </section>

            {/* 보조 정보 — allowance 유무와 무관하게 발생일수·미사용일수는 항상 함께 노출한다
                (Architect 의도된 설계). allowance가 없을 때는 핵심 카드가 이미 "연차
                발생일수"를 크게 보여주므로, 아래 발생일수 카드에는 핵심 카드와 같은 값임을
                짧게 밝혀 중복이 아니라 의도된 요약임을 알린다(UX/UI Critic Low 권고). */}
            <section className="grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs text-muted">연차 발생일수</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatDays(result.accruedDays)}</p>
                {!result.allowance && (
                  <p className="mt-0.5 text-xs text-muted">위 핵심 결과와 같은 값입니다.</p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs text-muted">미사용 연차일수</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{formatDays(result.unusedDays)}</p>
              </div>
            </section>

            {result.usedMoreThanAccruedWarning && (
              <section className="rounded-2xl border border-warning-border bg-warning-surface p-4 text-sm">
                {USED_MORE_THAN_ACCRUED_WARNING_TEXT}
              </section>
            )}

            {result.minimumWageReference?.belowMinimumWageReference && (
              <section className="rounded-2xl border border-warning-border bg-warning-surface p-4 text-sm">
                {buildBelowMinimumWageWarning(result.minimumWageReference)}
              </section>
            )}

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 근거" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                <li className="text-sm">
                  <p className="font-medium">1. 근속기간 판정</p>
                  <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {buildServicePeriodBreakdown({
                      hireDate: appliedInput.hireDate,
                      referenceDate: appliedInput.referenceDate,
                      completedYears: result.completedYears,
                      completedMonths:
                        result.continuousServiceRegime === "UNDER_1YEAR" ? result.completedMonths : undefined,
                      regime: result.continuousServiceRegime,
                    })}
                  </p>
                </li>
                <li className="text-sm">
                  <p className="font-medium">2. 발생일수 산출</p>
                  <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {buildAccrualStepText(result)}
                  </p>
                  {result.continuousServiceRegime === "OVER_2YEARS" && result.completedYears <= 3 && (
                    <p className="mt-2 rounded-xl border border-primary/20 bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
                      {ANNUAL_LEAVE_YEAR_TRANSITION_HIGHLIGHT}
                    </p>
                  )}
                </li>
                <li className="text-sm">
                  <p className="font-medium">3. 미사용일수 산출</p>
                  <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {buildUnusedDaysBreakdown(result.accruedDays, result.usedDays, result.unusedDays)}
                  </p>
                </li>
                {result.allowance && (
                  <li className="text-sm">
                    <p className="font-medium">4. 미사용 연차수당 계산</p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {buildAllowanceBreakdown(
                        result.unusedDays,
                        result.allowance.ordinaryDailyWage,
                        result.allowance.unusedLeaveAllowance,
                      )}
                    </p>
                  </li>
                )}
              </ol>
            </SectionCard>

            {/* ── 정책 고지(항상 노출, SPEC.md Must Have) ───────────────────── */}
            <SectionCard title="정책 고지" icon={<SectionIcon name="info" />}>
              <ul className="space-y-3 text-sm leading-6 text-muted">
                {ANNUAL_LEAVE_POLICY_NOTICES.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-4 text-xs text-muted">
                {ANNUAL_LEAVE_DATA_REVIEW_NOTICE}
              </p>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="입사일을 입력하면 연차 발생일수를 자동 계산합니다. 사용한 연차일수와 1일 통상임금을 추가로 입력하면 못 쓴 연차를 수당으로 환산한 금액까지 보여줍니다."
          steps={ANNUAL_LEAVE_USAGE_STEPS}
        />
        <IntroSection
          title="연차수당 계산기란 무엇인가요?"
          paragraphs={ANNUAL_LEAVE_INTRO_PARAGRAPHS}
          highlights={ANNUAL_LEAVE_INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={annualLeaveAllowanceFaqItems} />
      </div>
    </div>
  );
}
