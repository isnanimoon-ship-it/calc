"use client";

/**
 * 국민연금 예상수령액 계산기 — 입력/결과 UI.
 *
 * tasks/national-pension-benefit-estimate/ARCHITECTURE.md "8.", "9.", "10."이 정한 구조를
 * 그대로 구현한다. docs/DESIGN_SYSTEM.md 공통 화면 순서(입력 → 결과 → 계산 근거 → 소개·
 * 사용 방법 → 정책 안내 → FAQ)를 따른다.
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
 *
 * **중요 — published 게이트**: 이 계산기는 tasks/national-pension-benefit-estimate/
 * ARCHITECTURE.md "1. PUBLISHED 전환 게이트"가 해소되기 전까지 registry.ts의 status가
 * "draft"로 유지된다. 이 파일의 UI 구현이 끝났다는 사실이 published 전환을 의미하지 않는다.
 */

import { useId, useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { IntroSection } from "@/components/calculator/IntroSection";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import {
  NPB_INTRO_HIGHLIGHTS,
  NPB_INTRO_PARAGRAPHS,
  NPB_POLICY_NOTICES,
  NPB_RESULT_APPROX_CAPTION,
  NPB_USAGE_STEPS,
  npbFaqItems,
} from "./content";
import {
  buildBValueClampNotice,
  buildCalculationSteps,
  EARLY_OR_DEFERRED_OPTIONS,
  formatAge,
  formatContributionAdjustmentFactor,
  formatContributionPeriod,
  formatMonths,
  formatProportionalConstant,
  formatSignedRate,
  formatWon,
  formatYear,
} from "./formatting";
import { calculateNationalPensionBenefit } from "./logic";
import type {
  NationalPensionBenefitFormInput,
  NationalPensionBenefitResult,
} from "./types";
import {
  validateNationalPensionBenefitInput,
  type RawNationalPensionBenefitFormInput,
  type ValidationFieldError,
} from "./validation";

const EMPTY_FORM: RawNationalPensionBenefitFormInput = {
  birthYear: "",
  totalContributionMonths: "",
  averageMonthlyIncome: "",
  earlyOrDeferredMonths: "0",
};

/** DESIGN_SYSTEM.md "Reset / Sample" — FORMULA.md 검증 예제 2를 그대로 가져왔다. */
const SAMPLE_FORM: RawNationalPensionBenefitFormInput = {
  birthYear: "1965",
  totalContributionMonths: "240",
  averageMonthlyIncome: "3,000,000",
  earlyOrDeferredMonths: "0",
};

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";

function SectionIcon({ name }: { name: "chart" | "document" | "formula" | "info" | "warning" }) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
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

/** 경고/안내 카드(docs/DESIGN_SYSTEM.md "경고/미충족 카드", 다른 계산기들과 동일 패턴). */
function WarningCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-warning-border bg-warning-surface p-5 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
          <SectionIcon name="warning" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 leading-6 text-zinc-700 dark:text-zinc-300">{body}</p>
    </section>
  );
}

export default function NationalPensionBenefitEstimateUi() {
  const formId = useId();
  const [currentYear] = useState(() => new Date().getFullYear());
  const [form, setForm] = useState<RawNationalPensionBenefitFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<NationalPensionBenefitResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<NationalPensionBenefitFormInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    const restored = saved as unknown as RawNationalPensionBenefitFormInput;
    const validation = validateNationalPensionBenefitInput(restored, currentYear);
    if (!validation.success) return;
    setForm(restored);
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateNationalPensionBenefit(validation.data));
  });

  function errorFor(field: ValidationFieldError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleChange(field: "birthYear" | "totalContributionMonths") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null);
      setAppliedInput(null);
    };
  }

  /** 금액(원) 입력 필드 실시간 천 단위 콤마 표시(severance-pay/unemployment-benefit과 동일 패턴). */
  function handleAmountChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/[^0-9]/g, "");
    const formatted = digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "";
    setForm((prev) => ({ ...prev, averageMonthlyIncome: formatted }));
    setResult(null);
    setAppliedInput(null);
  }

  function handleEarlyOrDeferredChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, earlyOrDeferredMonths: event.target.value }));
    setResult(null);
    setAppliedInput(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNationalPensionBenefitInput(form, currentYear);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateNationalPensionBenefit(validation.data));
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

  const shareText = (() => {
    if (!result) return "출생연도·가입기간·평균 월소득으로 예상 노령연금 월 수령액을 계산해 보세요.";
    if (!result.eligible) return "입력한 가입기간은 노령연금 법정 최소 가입기간(120개월)에 못 미칩니다.";
    const amount = result.earlyOrDeferredMonths !== 0 && result.adjustedPensionMonthly !== undefined
      ? result.adjustedPensionMonthly
      : result.basicPensionMonthly;
    return `가입기간 ${formatMonths(appliedInput?.totalContributionMonths ?? 0)} 기준 예상 노령연금은 월 ${formatWon(amount)}입니다(${formatAge(result.pensionableAge)}부터).`;
  })();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold text-primary">세금/정책</p>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          국민연금 예상수령액 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          출생연도·총 가입기간·평균 월소득만 입력하면 예상 노령연금 월 수령액(세전)과
          수급개시연령을 계산 근거와 함께 확인할 수 있습니다.
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
            <p className="mt-1 text-sm text-muted">별표가 있는 항목은 모두 입력해야 계산할 수 있습니다.</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">필수 3개</span>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor={`${formId}-birthYear`} className={LABEL_CLASS}>
              출생연도{" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">*</span>
              <span className="ml-1 text-xs font-normal text-muted">(년)</span>
            </label>
            <input
              id={`${formId}-birthYear`}
              inputMode="numeric"
              value={form.birthYear ?? ""}
              onChange={handleChange("birthYear")}
              placeholder="예: 1975"
              aria-required="true"
              aria-invalid={errorFor("birthYear") ? true : undefined}
              aria-describedby={`${formId}-birthYear-help${errorFor("birthYear") ? ` ${formId}-birthYear-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-birthYear-help`} className={HELP_CLASS}>
              태어난 연도만 입력하세요(생년월일까지 필요하지 않습니다). 몇 살부터 국민연금을
              받을 수 있는지(수급개시연령) 판정에 사용됩니다.
            </p>
            {errorFor("birthYear") && (
              <p id={`${formId}-birthYear-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("birthYear")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-totalContributionMonths`} className={LABEL_CLASS}>
              국민연금 총 가입기간{" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">*</span>
              <span className="ml-1 text-xs font-normal text-muted">(개월)</span>
            </label>
            <input
              id={`${formId}-totalContributionMonths`}
              inputMode="numeric"
              value={form.totalContributionMonths ?? ""}
              onChange={handleChange("totalContributionMonths")}
              placeholder="예: 300"
              aria-required="true"
              aria-invalid={errorFor("totalContributionMonths") ? true : undefined}
              aria-describedby={`${formId}-totalContributionMonths-help${errorFor("totalContributionMonths") ? ` ${formId}-totalContributionMonths-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-totalContributionMonths-help`} className={HELP_CLASS}>
              이미 낸 기간과 앞으로 낼 예정 기간을 합친 총 개월수를 입력하세요(예: 25년이면
              300개월). 국민연금 노령연금은 이 기간이 120개월(10년) 이상이어야 받을 수 있습니다.
            </p>
            {errorFor("totalContributionMonths") && (
              <p id={`${formId}-totalContributionMonths-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("totalContributionMonths")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-averageMonthlyIncome`} className={LABEL_CLASS}>
              평균 월소득(근사치){" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">*</span>
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-averageMonthlyIncome`}
              inputMode="numeric"
              value={form.averageMonthlyIncome ?? ""}
              onChange={handleAmountChange}
              placeholder="예: 3,000,000"
              aria-required="true"
              aria-invalid={errorFor("averageMonthlyIncome") ? true : undefined}
              aria-describedby={`${formId}-averageMonthlyIncome-help${errorFor("averageMonthlyIncome") ? ` ${formId}-averageMonthlyIncome-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-averageMonthlyIncome-help`} className={HELP_CLASS}>
              실제 가입기간 전체의 평균 수준 소득을 대략 입력하세요(현재 또는 최근 소득
              기준을 권장합니다). 국민연금 기준소득월액 상·하한을 벗어나면 자동으로 조정되어
              계산됩니다.
            </p>
            {errorFor("averageMonthlyIncome") && (
              <p id={`${formId}-averageMonthlyIncome-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("averageMonthlyIncome")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-earlyOrDeferredMonths`} className={LABEL_CLASS}>
              수급 시기 <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
            </label>
            <select
              id={`${formId}-earlyOrDeferredMonths`}
              value={form.earlyOrDeferredMonths ?? "0"}
              onChange={handleEarlyOrDeferredChange}
              aria-describedby={`${formId}-earlyOrDeferredMonths-help`}
              className={INPUT_CLASS}
            >
              {EARLY_OR_DEFERRED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p id={`${formId}-earlyOrDeferredMonths-help`} className={HELP_CLASS}>
              법정 수급개시연령보다 최대 5년까지 앞당겨 받으면(조기노령연금) 감액되고, 최대
              5년까지 늦춰 받으면(연기연금) 가산됩니다. 그대로 받으려면 기본값을 유지하세요.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            예상 연금액 계산하기
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
        title="국민연금 예상수령액 계산기"
        text={shareText}
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && !result.eligible && (
          <section className="rounded-2xl border border-warning-border bg-warning-surface p-6 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
                <SectionIcon name="warning" />
              </span>
              <h2 className="text-lg font-semibold">지급대상 아님</h2>
            </div>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              입력하신 가입기간({formatMonths(result.totalContributionMonths)})은 노령연금
              수급을 위한 법정 최소 가입기간({formatMonths(result.minEligibleMonths)})에 못
              미쳐 예상 연금액을 계산하지 않았습니다.
            </p>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              다만 출생연도 기준 수급개시연령은{" "}
              <strong>
                {formatAge(result.pensionableAge)}({formatYear(result.pensionableYear)}부터)
              </strong>
              로 계산됩니다.
            </p>
            <p className="mt-3 text-xs text-muted">
              가입기간이 짧으면 반환일시금 등 다른 제도가 있을 수 있습니다(이 계산기의 범위
              밖이며, 계산하지 않습니다). 근거: 국민연금법 제61조제1항.
            </p>
          </section>
        )}

        {result && result.eligible && appliedInput && (
          <>
            {/* 공통 헤더 — 수급개시연령 */}
            <section className="rounded-2xl bg-surface-subtle px-6 py-4 text-sm text-muted">
              법정 수급개시연령:{" "}
              <span className="font-semibold text-foreground">
                {formatAge(result.pensionableAge)}
              </span>
              ({formatYear(result.pensionableYear)}부터)
            </section>

            {/* 핵심 결과 카드 */}
            {result.earlyOrDeferredMonths === 0 || result.adjustedPensionMonthly === undefined ? (
              <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
                <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                  예상 노령연금 월 수령액(세전, 현재가치·오늘 물가 기준)
                </h2>
                <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                  {formatWon(result.basicPensionMonthly)}
                </p>
                <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                  {formatAge(result.pensionableAge)}({formatYear(result.pensionableYear)})부터
                  받는 금액 기준입니다.
                </p>
                <p className="mt-1 text-xs opacity-70 dark:text-muted dark:opacity-100">
                  {NPB_RESULT_APPROX_CAPTION}
                </p>
              </section>
            ) : (
              <>
                <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
                  <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                    {result.earlyOrDeferredMonths < 0
                      ? "조기노령연금 반영 예상 월 수령액(세전)"
                      : "연기연금 반영 예상 월 수령액(세전)"}
                  </h2>
                  <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                    {formatWon(result.adjustedPensionMonthly)}
                  </p>
                  <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                    조정률 {formatSignedRate(result.earlyOrDeferredAdjustmentRate ?? 0)} 반영
                    ({formatMonths(Math.abs(result.earlyOrDeferredMonths))}{" "}
                    {result.earlyOrDeferredMonths < 0 ? "조기" : "연기"})
                  </p>
                  <p className="mt-1 text-xs opacity-70 dark:text-muted dark:opacity-100">
                    {NPB_RESULT_APPROX_CAPTION}
                  </p>
                </section>
                <p className="text-sm text-muted">
                  참고: 법정 수급개시연령({formatAge(result.pensionableAge)}) 기준 금액은{" "}
                  <strong className="text-foreground">{formatWon(result.basicPensionMonthly)}</strong>
                  입니다.
                </p>
              </>
            )}

            {buildBValueClampNotice(appliedInput.averageMonthlyIncome, result) && (
              <WarningCard
                title="입력하신 소득이 기준소득월액(국민연금 보험료 산정 기준 소득) 범위 밖이라 조정되었습니다"
                body={buildBValueClampNotice(appliedInput.averageMonthlyIncome, result) as string}
              />
            )}

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">적용된 A값(전체가입자 평균소득월액 평균)</dt>
                  <dd className="text-sm font-medium">{formatWon(result.aValue)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">적용된 B값 근사치(평균 월소득)</dt>
                  <dd className="text-sm font-medium">{formatWon(result.bValueApprox)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">적용된 비례상수</dt>
                  <dd className="text-sm font-medium">
                    {formatProportionalConstant(result.proportionalConstant)}(소득대체율 43%)
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">가입기간 보정계수(20년 기준 대비)</dt>
                  <dd className="text-sm font-medium">
                    {formatContributionAdjustmentFactor(result.contributionAdjustmentFactor)}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {buildCalculationSteps(appliedInput, result).map((step) => (
                  <li key={step.label} className="text-sm">
                    <p className="font-medium">{step.label}</p>
                    <p className="mt-0.5 text-xs text-muted">근거: {step.legalBasis}</p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {step.expression}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">출생연도</dt>
                  <dd>{formatYear(appliedInput.birthYear)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">국민연금 총 가입기간</dt>
                  <dd>{formatContributionPeriod(appliedInput.totalContributionMonths)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">평균 월소득(입력값)</dt>
                  <dd>{formatWon(appliedInput.averageMonthlyIncome)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">수급 시기</dt>
                  <dd>
                    {
                      EARLY_OR_DEFERRED_OPTIONS.find(
                        (o) => o.value === appliedInput.earlyOrDeferredMonths,
                      )?.label ?? "그대로(법정 수급개시연령)"
                    }
                  </dd>
                </div>
              </dl>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide description="출생연도·가입기간·평균 월소득만 입력하면 자동으로 계산합니다." steps={NPB_USAGE_STEPS} />
        <IntroSection
          title="국민연금 예상수령액 계산기란 무엇인가요?"
          paragraphs={NPB_INTRO_PARAGRAPHS}
          highlights={NPB_INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── 정책 안내 ────────────────────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface px-3 py-1 font-medium text-foreground">
            기준연도 2026년(A값 3,193,511원)
          </span>
          <span className="rounded-full bg-surface px-3 py-1 font-medium text-foreground">
            데이터 마지막 검토일 2026-09-13
          </span>
        </p>
        {NPB_POLICY_NOTICES.map((notice) => (
          <p key={notice}>{notice}</p>
        ))}
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={npbFaqItems} />
      </div>
    </div>
  );
}
