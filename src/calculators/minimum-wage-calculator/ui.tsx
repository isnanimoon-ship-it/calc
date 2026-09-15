"use client";

/**
 * 최저임금·시급↔월급 계산기 — 입력/결과 UI.
 *
 * docs/DESIGN_SYSTEM.md 공통 화면 순서(입력 → 결과 → 계산 근거 → 소개·사용 방법 → 정책 안내 →
 * FAQ)를 따른다. 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와
 * 표시만 담당한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * tasks/minimum-wage-calculator/ARCHITECTURE.md "3.3" — **모드를 전환하면 금액 입력 필드는
 * 항상 빈 값으로 초기화한다.** 직전 결과의 환산값을 새 모드의 입력 필드에 자동으로 채워 넣지
 * 않는다(체이닝 방지 UX 규칙). `weeklyHours`(공통 입력)는 모드 전환과 무관하게 유지한다.
 *
 * SPEC.md Must Have — 게이팅 없이 항상 계산하고, 최저임금 미만 여부는 결과 화면의 경고 카드로만
 * 안내한다(weekly-holiday-allowance·unemployment-benefit과 동일한 "게이팅 없이 항상 계산"
 * 원칙). 입력값과 환산값은 배지로 명확히 구분한다.
 */

import Link from "next/link";
import { useId, useState } from "react";
import {
  buildMinimumWageBreakdown,
  buildBelowMinimumWageWarning,
  buildJudgmentMismatchNotice,
  formatHours,
  formatWon,
} from "./formatting";
import { calculateMinimumWageComparison } from "./logic";
import {
  validateMinimumWageCalculatorInput,
  type ValidationFieldError,
} from "./validation";
import type { CalculationMode, MinimumWageCalculatorResult } from "./types";
import {
  MINIMUM_WAGE_DATA_REVIEW_NOTICE,
  MINIMUM_WAGE_HOURS_HINT,
  MINIMUM_WAGE_INCLUSION_SCOPE_NOTICE,
  MINIMUM_WAGE_INTRO_HIGHLIGHTS,
  MINIMUM_WAGE_INTRO_PARAGRAPHS,
  MINIMUM_WAGE_POLICY_NOTICES,
  MINIMUM_WAGE_USAGE_STEPS,
  minimumWageCalculatorFaqItems,
} from "./content";
import { IntroSection } from "@/components/calculator/IntroSection";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { SectionCard } from "@/components/calculator/SectionCard";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";

/** ui.tsx 로컬 폼 상태. 두 금액 필드를 모두 두되, 현재 `mode`에 해당하는 하나만 화면에 보여준다. */
interface FormState {
  mode: CalculationMode;
  hourlyWage: string;
  monthlyWage: string;
  weeklyHours: string;
}

const EMPTY_FORM: FormState = {
  mode: "HOURLY",
  hourlyWage: "",
  monthlyWage: "",
  weeklyHours: "40",
};

/**
 * docs/DESIGN_SYSTEM.md "Reset / Sample" — FORMULA.md 검증 예제 A1(정확히 최저임금, 주
 * 40시간)을 그대로 샘플로 쓴다. 경계값이지만 "이상" 판정이라 경고 카드가 뜨지 않아 첫인상이
 * 깔끔하다(weekly-holiday-allowance 샘플 선정 기준과 동일).
 */
const SAMPLE_FORM: FormState = {
  mode: "HOURLY",
  hourlyWage: "10,320",
  monthlyWage: "",
  weeklyHours: "40",
};

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";

function SectionIcon({
  name,
}: {
  name: "chart" | "document" | "formula" | "warning" | "info";
}) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    warning: (
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
    ),
    /** [Optimizer] 이중 배지 안내(`judgmentMismatchNotice`)를 "경고"가 아니라 "참고 설명"으로
     * 구분해 보여주기 위한 정보 아이콘 — `warning`(느낌표 삼각형)과 시각적으로 다른 원형
     * i 아이콘을 쓴다. */
    info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
    >
      {paths[name]}
    </svg>
  );
}

/** 입력값/환산값 구분 배지(SPEC Must Have). 환산값은 핵심 카드와 같은 primary 색으로 강조한다. */
function ValueSourceBadge({ isConverted }: { isConverted: boolean }) {
  return (
    <span
      className={
        isConverted
          ? "rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary"
          : "rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted"
      }
    >
      {isConverted ? "환산값" : "입력값"}
    </span>
  );
}

/** "이상"/"미만" 판정 텍스트. 미만만 danger 색으로 강조한다(별도 성공 색 토큰이 없음). */
function MeetsBadge({ meets }: { meets: boolean }) {
  return (
    <span className={meets ? "font-semibold" : "font-semibold text-danger"}>
      최저임금 {meets ? "이상" : "미만"}
    </span>
  );
}

export default function MinimumWageCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<MinimumWageCalculatorResult | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (
      !saved ||
      (saved.mode !== "HOURLY" && saved.mode !== "MONTHLY") ||
      typeof saved.hourlyWage !== "string" ||
      typeof saved.monthlyWage !== "string" ||
      typeof saved.weeklyHours !== "string"
    ) {
      return;
    }
    const restored = saved as unknown as FormState;
    const validation = validateMinimumWageCalculatorInput(restored);
    if (!validation.success) return;
    setForm(restored);
    setErrors([]);
    setResult(calculateMinimumWageComparison(validation.data));
  });

  function errorFor(field: ValidationFieldError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  /** 모드 전환 — 금액 입력 필드는 항상 빈 값으로 초기화한다(ARCHITECTURE.md "3.3" 체이닝 방지). */
  function handleModeChange(mode: CalculationMode) {
    setForm((prev) => ({ ...prev, mode, hourlyWage: "", monthlyWage: "" }));
    setErrors([]);
    setResult(null);
  }

  /** 주 근무시간 입력(소수 허용, 콤마 포맷 없음 — weekly-holiday-allowance와 동일 패턴). */
  function handleWeeklyHoursChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, weeklyHours: event.target.value }));
    setResult(null);
  }

  /**
   * 금액(시급/월급) 입력 필드 실시간 천 단위 콤마 표시(severance-pay `handleAmountChange` 패턴).
   * 소수점이 있으면 정수부만 취해 왜곡을 막는다(validation.ts는 정수만 허용하므로 표시 단계에서도
   * 미리 정수로 좁혀 둔다).
   */
  function handleAmountChange(field: "hourlyWage" | "monthlyWage") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const dotIndex = raw.indexOf(".");
      const integerPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
      const digitsOnly = integerPart.replace(/[^0-9]/g, "");
      const formatted = digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "";
      setForm((prev) => ({ ...prev, [field]: formatted }));
      setResult(null);
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateMinimumWageCalculatorInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      return;
    }
    setErrors([]);
    setResult(calculateMinimumWageComparison(validation.data));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors([]);
    setResult(null);
  }

  function handleFillSample() {
    setForm(SAMPLE_FORM);
    setErrors([]);
    setResult(null);
  }

  const breakdown = result ? buildMinimumWageBreakdown(result) : [];
  const belowMinimumWageWarning = result ? buildBelowMinimumWageWarning(result) : null;
  const judgmentMismatchNotice = result ? buildJudgmentMismatchNotice(result) : null;

  const amountField =
    form.mode === "HOURLY"
      ? {
          field: "hourlyWage" as const,
          label: "시급",
          placeholder: "예: 10,320",
          helpText: "세금·4대보험 공제 전 시간당 임금을 원 단위 정수로 입력하세요.",
        }
      : {
          field: "monthlyWage" as const,
          label: "월급",
          placeholder: "예: 2,500,000",
          helpText:
            "세금·4대보험 공제 전 월 급여 총액을 원 단위 정수로 입력하세요. 상여금·수당 등을 나누지 않고 총액 그대로 입력합니다.",
        };

  const amountInputId = `${formId}-amount`;
  const amountErrorId = `${amountInputId}-error`;
  const amountHelpId = `${amountInputId}-help`;
  const amountMessage = errorFor(amountField.field);

  const weeklyHoursInputId = `${formId}-weeklyHours`;
  const weeklyHoursErrorId = `${weeklyHoursInputId}-error`;
  const weeklyHoursHelpId = `${weeklyHoursInputId}-help`;
  const weeklyHoursMessage = errorFor("weeklyHours");

  const shareText = result
    ? result.mode === "HOURLY"
      ? `시급 ${formatWon(result.displayHourlyWage)}은(는) 월급으로 환산하면 ${formatWon(result.convertedMonthlyPay)}입니다.`
      : `월급 ${formatWon(result.displayMonthlyPay)}은(는) 시급으로 환산하면 ${formatWon(result.convertedHourlyWage)}입니다.`
    : "시급 또는 월급 하나만 입력하면 나머지 금액과 최저임금 충족 여부를 계산해 드립니다.";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link
          href="/categories/labor"
          className="mb-3 inline-block text-sm font-semibold text-primary hover:underline"
        >
          노동/근로
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          최저임금·시급↔월급 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          시급 또는 월급 중 아는 값 하나만 입력하면 나머지 금액으로 환산하고, 올해 고시된
          최저임금과 비교해 이상/미만을 알려드립니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <fieldset>
          <legend className={LABEL_CLASS}>계산 방향</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
            {(
              [
                ["HOURLY", "시급으로 계산"],
                ["MONTHLY", "월급으로 계산"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                  form.mode === value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-muted"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-mode`}
                  value={value}
                  checked={form.mode === value}
                  onChange={() => handleModeChange(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            아는 값 하나만 입력하면 나머지는 계산기가 채워 줍니다. 방향을 바꾸면 입력했던
            금액은 새로 입력해야 합니다.
          </p>
        </fieldset>

        <div className="space-y-5">
          <div>
            <label htmlFor={amountInputId} className={LABEL_CLASS}>
              {amountField.label}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                {" "}
                *
              </span>
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={amountInputId}
              type="text"
              inputMode="numeric"
              value={form[amountField.field]}
              onChange={handleAmountChange(amountField.field)}
              aria-required="true"
              aria-invalid={amountMessage ? true : undefined}
              aria-describedby={
                [amountMessage ? amountErrorId : null, amountHelpId]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className={INPUT_CLASS}
              placeholder={amountField.placeholder}
            />
            <p id={amountHelpId} className="mt-1 text-xs text-muted">
              {amountField.helpText}
            </p>
            {amountMessage && (
              <p id={amountErrorId} role="alert" className={ERROR_CLASS}>
                {amountMessage}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={weeklyHoursInputId} className={LABEL_CLASS}>
              주 근무시간
              <span className="ml-1 text-xs font-normal text-muted">
                (시간, 선택 · 기본값 40)
              </span>
            </label>
            <input
              id={weeklyHoursInputId}
              type="text"
              inputMode="decimal"
              value={form.weeklyHours}
              onChange={handleWeeklyHoursChange}
              aria-invalid={weeklyHoursMessage ? true : undefined}
              aria-describedby={
                [weeklyHoursMessage ? weeklyHoursErrorId : null, weeklyHoursHelpId]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className={INPUT_CLASS}
              placeholder="예: 40"
            />
            <p id={weeklyHoursHelpId} className="mt-1 text-xs text-muted">
              1주 소정근로시간(휴게시간 제외)입니다. 통상근로자(주 40시간)라면 비워 두어도
              됩니다. 이 값에 따라 월 환산 시간과 월 환산 최저임금이 달라집니다.
            </p>
            {weeklyHoursMessage && (
              <p id={weeklyHoursErrorId} role="alert" className={ERROR_CLASS}>
                {weeklyHoursMessage}
              </p>
            )}
          </div>
        </div>

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
        title="최저임금·시급↔월급 계산기"
        text={shareText}
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && (
          <>
            {/* 핵심 결과 카드 — 환산값 + 최저임금 이상/미만 배지 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                  {result.mode === "HOURLY" ? "환산 월급" : "환산 시급"}
                </h2>
                <span
                  className={
                    (result.mode === "HOURLY"
                      ? result.monthlyMeetsMinimumWage
                      : result.hourlyMeetsMinimumWage)
                      ? "rounded-full bg-white/20 px-3 py-1 text-xs font-semibold dark:bg-primary-soft dark:text-primary"
                      : "rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-amber-100 dark:bg-warning-border/40 dark:text-amber-300"
                  }
                >
                  최저임금{" "}
                  {(result.mode === "HOURLY"
                    ? result.monthlyMeetsMinimumWage
                    : result.hourlyMeetsMinimumWage)
                    ? "이상"
                    : "미만"}
                </span>
              </div>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {result.mode === "HOURLY"
                  ? formatWon(result.convertedMonthlyPay)
                  : formatWon(result.convertedHourlyWage)}
              </p>
              <p className="mt-3 text-xs opacity-80 dark:text-muted dark:opacity-100">
                직접 입력한 값이 아니라 계산된 환산값입니다.
              </p>
              <p className="mt-3 text-sm opacity-75 dark:text-foreground dark:opacity-100">
                {result.appliedRateYear}년 최저임금 시간당 {formatWon(result.minWageHourly)} ·
                월 환산 {formatWon(result.minWageMonthlyEquivalent)}(
                {formatHours(result.weeklyHours)} 기준) 기준으로 비교합니다.
              </p>
              {/* [Optimizer] UX/UI Critic Q7(Medium) 대응 — 널리 알려진 "약 209시간·
                  2,156,880원"과 다른 월 환산 최저임금이 여기서 처음 눈에 띄는 순간, 바로
                  아래 소개·FAQ로 시선을 유도하는 캡션. */}
              <p className="mt-2 text-xs italic leading-5 opacity-70 dark:text-muted dark:opacity-100">
                {MINIMUM_WAGE_HOURS_HINT}
              </p>
            </section>

            {/* 보조 정보 행 2줄 — 시급/월급을 항상 함께 보여주고 입력값/환산값을 배지로 구분 */}
            <SectionCard title="시급·월급 비교" icon={<SectionIcon name="chart" />}>
              <dl className="divide-y divide-border text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <dt className="flex items-center gap-2 font-medium">
                    시급
                    <ValueSourceBadge isConverted={result.mode === "MONTHLY"} />
                  </dt>
                  <dd className="flex items-center gap-3 tabular-nums">
                    <span className="font-semibold">{formatWon(result.displayHourlyWage)}</span>
                    <MeetsBadge meets={result.hourlyMeetsMinimumWage} />
                  </dd>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <dt className="flex items-center gap-2 font-medium">
                    월급
                    <ValueSourceBadge isConverted={result.mode === "HOURLY"} />
                  </dt>
                  <dd className="flex items-center gap-3 tabular-nums">
                    <span className="font-semibold">{formatWon(result.displayMonthlyPay)}</span>
                    <MeetsBadge meets={result.monthlyMeetsMinimumWage} />
                  </dd>
                </div>
              </dl>
              {/* [Optimizer] UX/UI Critic Q8/Q16(Medium) 대응 — 위 두 배지(시급/월급)가
                  서로 다른 판정을 보여줄 수 있는 바로 그 지점(두 배지 직후)에, "경고"가
                  아니라 "참고 설명"임을 아이콘·배경색으로 눈에 띄게 구분해 배치한다. 판정
                  로직·문구 자체는 변경하지 않는다. */}
              {judgmentMismatchNotice && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary-soft p-3 text-xs leading-6 text-zinc-700 dark:border-primary/25 dark:text-zinc-300">
                  <span className="mt-0.5 shrink-0 text-primary">
                    <SectionIcon name="info" />
                  </span>
                  <p>{judgmentMismatchNotice}</p>
                </div>
              )}
              <p className="mt-3 text-xs text-muted">
                월급 비교는 주 {formatHours(result.weeklyHours)} 기준 월 환산 최저임금(
                {formatWon(result.minWageMonthlyEquivalent)})과 비교한 것입니다.
              </p>
            </SectionCard>

            {/* 최저임금 미충족 경고 카드(조건부, 게이팅 아님) */}
            {belowMinimumWageWarning && (
              <section className="rounded-2xl border border-warning-border bg-warning-surface p-6 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
                    <SectionIcon name="warning" />
                  </span>
                  <h2 className="text-base font-semibold">
                    입력하신 금액이 {result.appliedRateYear}년 최저임금 기준보다 낮습니다
                  </h2>
                </div>
                <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                  {belowMinimumWageWarning}.
                </p>
                <p className="mt-3 text-xs text-muted">
                  근거: 최저임금법 제6조제1항. 이 계산은 게이팅하지 않으며, 위 결과는 이미 모두
                  계산·표시된 상태입니다.
                </p>
              </section>
            )}

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 근거" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {breakdown.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-0.5 text-xs text-muted">근거: {row.legalBasis}</p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.expression}
                    </p>
                  </li>
                ))}
              </ol>
              {result.cappedAtStatutoryLimit && (
                <p className="mt-3 text-xs text-muted">
                  주 40시간을 초과한 시간은 주휴시간 산정에 포함되지 않습니다(주휴시간 8시간
                  상한).
                </p>
              )}
            </SectionCard>

            <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">계산 방향</dt>
                  <dd>{result.mode === "HOURLY" ? "시급으로 계산" : "월급으로 계산"}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">
                    {result.mode === "HOURLY" ? "시급(입력값)" : "월급(입력값)"}
                  </dt>
                  <dd>
                    {result.mode === "HOURLY"
                      ? formatWon(result.displayHourlyWage)
                      : formatWon(result.displayMonthlyPay)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">주 근무시간</dt>
                  <dd>{formatHours(result.weeklyHours)}</dd>
                </div>
              </dl>
            </SectionCard>

            {/* 최저임금 산입범위 안내(SPEC Must Have — 정책 안내 카드 수준으로 눈에 띄게) */}
            <section className="rounded-2xl border border-primary/30 bg-primary-soft p-6 text-sm leading-6 text-primary dark:border-primary/25">
              <h2 className="text-base font-semibold">최저임금 산입범위 안내</h2>
              <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                {MINIMUM_WAGE_INCLUSION_SCOPE_NOTICE}
              </p>
            </section>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="계산 방향을 고르고 아는 금액 하나만 입력하면 나머지는 자동으로 환산합니다."
          steps={MINIMUM_WAGE_USAGE_STEPS}
        />
        <IntroSection
          title="최저임금·시급↔월급 계산기란 무엇인가요?"
          paragraphs={MINIMUM_WAGE_INTRO_PARAGRAPHS}
          highlights={MINIMUM_WAGE_INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── 정책 안내 ────────────────────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        {MINIMUM_WAGE_POLICY_NOTICES.map((notice) => (
          <p key={notice}>{notice}</p>
        ))}
        <p>이 계산은 2026년 기준이며, 최저임금 등 관련 수치는 매년 갱신될 수 있습니다.</p>
        <p className="text-xs">{MINIMUM_WAGE_DATA_REVIEW_NOTICE}</p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={minimumWageCalculatorFaqItems} />
      </div>
    </div>
  );
}
