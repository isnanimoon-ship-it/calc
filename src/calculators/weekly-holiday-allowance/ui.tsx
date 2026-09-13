"use client";

/**
 * 주휴수당 계산기 — 입력/결과 UI.
 *
 * docs/DESIGN_SYSTEM.md 공통 화면 순서(소개 → 사용 방법 → 입력 → 결과 → 계산 근거 → 정책 안내
 * → FAQ)를 따른다. 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와
 * 표시만 담당한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * SPEC.md "설계상 핵심 결정" — 지급요건(15시간 이상·개근)으로 계산을 게이팅하지 않는다.
 * 검증만 통과하면 항상 결과를 보여주고, 15시간 미만·최저임금 미만은 결과 화면의 경고 카드로만
 * 알린다(unemployment-benefit v2 "게이팅 없이 항상 계산, 전제는 고지" 방식).
 *
 * 소개 문구는 tasks/weekly-holiday-allowance/FORMULA.md "소개 문구" 절, FAQ는 같은 문서
 * "FAQ 콘텐츠" 절(seo-content.ts에 SSOT로 옮김)을 그대로 사용한다 — 새로 지어내지 않았다.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { APPLICABLE_RATE_YEAR, calculateWeeklyHolidayAllowance } from "./logic";
import {
  validateWeeklyHolidayAllowanceInput,
  type RawWeeklyHolidayAllowanceFormInput,
  type ValidationFieldError,
} from "./validation";
import {
  buildBelowMinimumWageWarning,
  buildKeyResultCaveat,
  buildMinHoursWarning,
  buildWeeklyHolidayBreakdown,
  EFFECTIVE_WAGE_NOTE,
  formatHourlyWage,
  formatHours,
  formatWon,
  MONTHLY_HOLIDAY_PAY_LABEL,
  MONTHLY_REFERENCE_NOTE,
  MONTHLY_TOTAL_PAY_LABEL,
  STATUTORY_LIMIT_NOTICE,
  type WarningCardContent,
} from "./formatting";
import type {
  WeeklyHolidayAllowanceInput,
  WeeklyHolidayAllowanceResult,
} from "./types";
import { weeklyHolidayAllowanceFaqItems } from "./seo-content";
import { IntroSection } from "@/components/calculator/IntroSection";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { SectionCard } from "@/components/calculator/SectionCard";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";

const EMPTY_FORM: RawWeeklyHolidayAllowanceFormInput = {
  hourlyWage: "",
  weeklyHours: "",
};

/**
 * docs/DESIGN_SYSTEM.md "Reset / Sample" — FORMULA.md 검증 예제 1(주 40시간 풀타임, 2026년
 * 최저임금)을 그대로 샘플로 쓴다(ARCHITECTURE.md "입력 필드 설계" 권장). 두 경고(15시간
 * 미만·최저임금 미만)가 모두 뜨지 않아 첫인상이 깔끔하고 핵심 결과가 정수(82,560원)다.
 */
const SAMPLE_FORM: RawWeeklyHolidayAllowanceFormInput = {
  hourlyWage: "10,320",
  weeklyHours: "40",
};

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";

interface FieldConfig {
  name: keyof RawWeeklyHolidayAllowanceFormInput;
  label: string;
  unit: string;
  helpText: string;
  inputMode: "numeric" | "decimal";
  placeholder: string;
  /** 실시간 천 단위 콤마 표시 대상(금액 필드). */
  amount?: boolean;
}

/** 입력 2필드, 순서: 시급 → 주 근무시간(ARCHITECTURE.md "입력 필드 설계"). */
const FIELDS: FieldConfig[] = [
  {
    name: "hourlyWage",
    label: "시급",
    unit: "원",
    helpText:
      "세금·4대보험 공제 전 시간당 임금을 원 단위 정수로 입력하세요(소수점 이하는 반영되지 않습니다).",
    inputMode: "numeric",
    placeholder: "예: 10,320",
    amount: true,
  },
  {
    name: "weeklyHours",
    label: "주 근무시간",
    unit: "시간",
    helpText:
      "일하기로 정한 1주 근무시간(휴게시간 제외)입니다. 근로계약서의 '소정근로시간'과 같은 값이며, 소수점(예: 13.5)도 입력할 수 있습니다.",
    inputMode: "decimal",
    placeholder: "예: 20",
  },
];

/** FORMULA.md "소개 문구" 원문을 문장 경계에서만 두 문단으로 나눈 것(단어는 그대로). */
const INTRO_PARAGRAPHS = [
  "주휴수당은 1주 동안 정해진 근무일을 모두 채운(개근한) 근로자에게, 일하지 않는 유급 휴일 하루치 임금을 추가로 지급하는 제도입니다(근로기준법 제55조). 1주 소정근로시간이 15시간 이상이면 아르바이트·시간제 근로자도 대상이며, 사업장 규모(5인 미만 포함)와 무관하게 적용됩니다.",
  "이 계산기는 시급과 1주 근무시간만 입력하면 1주치 주휴수당, 한 달치로 환산한 참고 금액, 주휴수당을 포함한 총 급여와 실질 시급을 계산 과정과 함께 보여줍니다. 다만 이 계산기는 개근을 전제로 한 참고용 도구이며, 실제 지급 여부는 개근 여부·근로계약 내용에 따라 달라질 수 있습니다.",
];

const USAGE_STEPS = [
  {
    title: "시급 입력",
    description:
      "세금·4대보험 공제 전 시간당 임금을 원 단위로 입력합니다. 채용공고나 근로계약서에 적힌 시급을 그대로 넣으면 됩니다.",
  },
  {
    title: "주 근무시간 입력",
    description:
      "근로계약서상 1주 소정근로시간을 입력합니다. 휴게시간은 빼고 실제로 일하기로 정한 시간만 넣습니다(예: 하루 5시간 근무·30분 휴게로 주 3일이면 13.5시간).",
  },
  {
    title: "결과·계산 근거 확인",
    description:
      "계산하기를 누르면 1주치 주휴수당과 월 환산 주휴수당(참고), 주휴수당을 포함한 총 급여·실질 시급, 그리고 각 단계의 계산식과 근거 법령을 확인할 수 있습니다.",
  },
];

function SectionIcon({
  name,
}: {
  name: "chart" | "document" | "formula" | "info" | "warning";
}) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    // unemployment-benefit/ui.tsx의 info 아이콘과 동일(원 안 느낌표) — 경고 카드 2종 구분용.
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    warning: (
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
    ),
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

/**
 * 경고/미충족 카드(docs/DESIGN_SYSTEM.md "경고/미충족 카드"). 두 종류가 동시에 뜰 수 있어,
 * 제목을 읽지 않아도 구분되도록 아이콘 모양·배지 색을 달리한다(UX/UI Critic L2):
 * - `info`(15시간 미만): 원 안 느낌표 + 파란 배지 — "이 제도가 적용되지 않는다"는 설명형 안내.
 * - `warning`(최저임금 미만): 경고 삼각형 + amber 배지 — 지급액에 문제가 있다는 경고.
 * heading은 핵심 결과 카드(h2)·계산 상세 카드(h2)와 형제 성격이라 h2로 둔다(UX/UI Critic L7).
 */
function WarningCard({ content }: { content: WarningCardContent }) {
  const badgeClass =
    content.icon === "info"
      ? "bg-primary-soft text-primary"
      : "bg-warning-border/40 text-amber-800 dark:text-amber-300";
  return (
    <section className="rounded-2xl border border-warning-border bg-warning-surface p-6 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}
        >
          <SectionIcon name={content.icon} />
        </span>
        <h2 className="text-base font-semibold">{content.title}</h2>
      </div>
      <p className="mt-3 text-zinc-700 dark:text-zinc-300">{content.body}</p>
      {content.note && (
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{content.note}</p>
      )}
      <p className="mt-3 text-xs text-muted">근거: {content.legalBasis}</p>
    </section>
  );
}

export default function WeeklyHolidayAllowanceCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawWeeklyHolidayAllowanceFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<WeeklyHolidayAllowanceResult | null>(null);
  const [appliedInput, setAppliedInput] =
    useState<WeeklyHolidayAllowanceInput | null>(null);
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const saved = asShareRecord(root?.f);
    if (!saved || typeof saved.hourlyWage !== "string" || typeof saved.weeklyHours !== "string") return;
    const restored = saved as unknown as RawWeeklyHolidayAllowanceFormInput; const validation = validateWeeklyHolidayAllowanceInput(restored); if (!validation.success) return;
    setForm(restored); setErrors([]); setAppliedInput(validation.data); setResult(calculateWeeklyHolidayAllowance(validation.data));
  });

  function errorFor(
    field: keyof RawWeeklyHolidayAllowanceFormInput,
  ): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleChange(field: keyof RawWeeklyHolidayAllowanceFormInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null); setAppliedInput(null);
    };
  }

  /**
   * 금액(원) 입력 필드 실시간 천 단위 콤마 표시(severance-pay `handleAmountChange` 패턴).
   *
   * QA-L2: 소수점을 그대로 지우면 "10320.5"가 "103205"(10배)로 조용히 왜곡된다. 이 계산기의
   * 시급은 정수만 받으므로(validation), 소수점이 있으면 **정수부만** 취해 왜곡을 막는다
   * ("10320.5" → "10,320"). severance-pay/unemployment-benefit의 공용 패턴은 이번에 건드리지
   * 않고 이 계산기 안에서만 좁혀 방어한다. validation.ts가 콤마를 제거하고 파싱하므로
   * 계산/검증 결과에는 영향이 없다(표시 전용).
   */
  function handleAmountChange(field: keyof RawWeeklyHolidayAllowanceFormInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const dotIndex = raw.indexOf(".");
      const integerPart = dotIndex === -1 ? raw : raw.slice(0, dotIndex);
      const digitsOnly = integerPart.replace(/[^0-9]/g, "");
      const formatted = digitsOnly
        ? Number(digitsOnly).toLocaleString("ko-KR")
        : "";
      setForm((prev) => ({ ...prev, [field]: formatted }));
      setResult(null); setAppliedInput(null);
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateWeeklyHolidayAllowanceInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateWeeklyHolidayAllowance(validation.data));
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

  function renderField(field: FieldConfig) {
    const inputId = `${formId}-${field.name}`;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;
    const message = errorFor(field.name);
    const value = form[field.name] ?? "";

    return (
      <div key={field.name}>
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {field.label}
          <span aria-hidden="true" className="text-red-600 dark:text-red-400">
            {" "}
            *
          </span>
          <span className="ml-1 text-xs font-normal text-muted">
            ({field.unit})
          </span>
        </label>
        <input
          id={inputId}
          type="text"
          inputMode={field.inputMode}
          /* type="text"라 `step`은 동작하지 않으므로 두지 않는다(UX/UI Critic L6 — inert 속성
             제거). 0.5 단위 소수 입력이 자연스럽다는 힌트는 helpText·사용 안내에 문구로 있다. */
          value={value}
          onChange={
            field.amount
              ? handleAmountChange(field.name)
              : handleChange(field.name)
          }
          aria-required="true"
          aria-invalid={message ? true : undefined}
          aria-describedby={
            [message ? errorId : null, helpId].filter(Boolean).join(" ") ||
            undefined
          }
          className={INPUT_CLASS}
          placeholder={field.placeholder}
        />
        <p id={helpId} className="mt-1 text-xs text-muted">
          {field.helpText}
        </p>
        {message && (
          <p id={errorId} role="alert" className={ERROR_CLASS}>
            {message}
          </p>
        )}
      </div>
    );
  }

  const breakdown =
    result && appliedInput
      ? buildWeeklyHolidayBreakdown(appliedInput, result)
      : [];
  const keyResultCaveat = result ? buildKeyResultCaveat(result) : null;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/labor" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">노동/근로</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          주휴수당 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          시급과 1주 근무시간만 입력하면 1주치 주휴수당과 월 환산 주휴수당(참고), 주휴수당을
          포함한 총 급여를 산출 근거와 함께 계산합니다.
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
            <p className="mt-1 text-sm text-muted">
              시급과 주 근무시간 두 가지만 입력하면 됩니다.
            </p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            필수 2개
          </span>
        </div>

        <div className="space-y-5">{FIELDS.map((field) => renderField(field))}</div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            주휴수당 계산하기
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

      <ShareActions className="mt-5" title="주휴수당 계산기" text={result ? `예상 1주 주휴수당은 ${formatWon(result.weeklyHolidayPay)}입니다.` : "시급과 주 근무시간으로 예상 주휴수당을 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} onKakaoShare={kakaoShareAdapter} />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && (
          <>
            {/* 핵심 결과 카드 — 1주치 주휴수당 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">1주치 주휴수당</h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.weeklyHolidayPay)}
              </p>
              <p className="mt-3 text-sm opacity-75 dark:text-foreground dark:opacity-100">
                주휴시간 {formatHours(result.weeklyHolidayHours)} × 시급{" "}
                {formatHourlyWage(appliedInput.hourlyWage)} 기준으로 계산합니다.
              </p>
              {/* UX/UI Critic M1 — 큰 숫자만 보고 아래 경고 카드를 지나칠 수 있으므로 전제를
                  핵심 카드 안에도 한 줄로 넣는다. */}
              {keyResultCaveat && (
                <p className="mt-3 text-xs opacity-75 dark:text-muted dark:opacity-100">{keyResultCaveat}</p>
              )}
            </section>

            {/* 경고 카드 2종(독립 조건, 동시 표시 가능) */}
            {!result.meetsMinHoursRequirement && (
              <WarningCard content={buildMinHoursWarning(appliedInput)} />
            )}
            {result.belowMinimumWage && (
              <WarningCard content={buildBelowMinimumWageWarning(result)} />
            )}

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* UX/UI Critic L6 — "계산 상세"는 핵심 결과값(1주치 주휴수당 외 나머지)만
                  나열하고, 산출 수식·근거는 아래 "계산 방법"으로 역할을 나눈다. 1주 주휴시간·
                  1주치 주휴수당은 핵심 카드와 "계산 방법"에 이미 있어 여기서는 뺐다. */}
              <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">{MONTHLY_HOLIDAY_PAY_LABEL}</dt>
                    <dd className="text-sm font-medium">
                      {formatWon(result.monthlyHolidayPay)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">주휴수당 포함 주급</dt>
                    <dd className="text-sm font-medium">
                      {formatWon(result.weeklyTotalPay)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{MONTHLY_TOTAL_PAY_LABEL}</dt>
                    <dd className="text-sm font-medium">
                      {formatWon(result.monthlyTotalPay)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">주휴수당 포함 실질 시급</dt>
                    <dd className="text-sm font-medium">
                      {formatHourlyWage(result.effectiveHourlyWage)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">{EFFECTIVE_WAGE_NOTE}</p>
                <p className="mt-2 text-xs text-muted">{MONTHLY_REFERENCE_NOTE}</p>
                {result.cappedAtStatutoryLimit && (
                  <p className="mt-2 text-xs text-muted">{STATUTORY_LIMIT_NOTICE}</p>
                )}
              </SectionCard>

              <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
                <ol className="space-y-4">
                  {breakdown.map((row) => (
                    <li key={row.label} className="text-sm">
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        근거: {row.legalBasis}
                      </p>
                      <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {row.expression}
                      </p>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              <SectionCard
                title="적용된 입력값"
                icon={<SectionIcon name="document" />}
              >
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">시급</dt>
                    <dd>{formatHourlyWage(appliedInput.hourlyWage)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">주 근무시간</dt>
                    <dd>{formatHours(appliedInput.weeklyHours)}</dd>
                  </div>
                </dl>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="시급과 1주 근무시간 두 가지만 입력하면 주휴수당을 자동으로 계산합니다."
          steps={USAGE_STEPS}
        />
        <IntroSection
          title="주휴수당이란 무엇인가요?"
          paragraphs={INTRO_PARAGRAPHS}
        />
      </div>

      {/* ── 정책 안내 ────────────────────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        <p>
          주휴수당은 (1) 1주 소정근로시간이 15시간 이상이고 (2) 1주간 소정근로일을
          개근한 경우에 발생합니다(근로기준법 제55조제1항, 같은 법 시행령 제30조제1항).
          4주 동안을 평균한 1주 소정근로시간이 15시간 미만이면 주휴수당 지급 대상이
          아닙니다(근로기준법 제18조제3항).
        </p>
        <p>
          이 계산기는 지급요건 충족 여부를 판정하지 않고, 요건을 충족한다고 가정했을
          때의 금액을 보여주는 참고용 도구입니다. 개근 여부(지각·조퇴·결근)와 4주 평균
          소정근로시간은 사용자만 알 수 있습니다.
        </p>
        <p>
          1주 주휴시간은 통상근로자가 주 40시간·주 5일 근무한다는 기준으로 산정합니다.
          소속 사업장의 통상근로자가 이보다 짧게 일하거나 본인의 소정근로일이 6일이면
          실제 주휴시간이 이 계산과 달라질 수 있습니다. 주 40시간을 초과한 시간은
          주휴수당 산정에 포함되지 않으며, 연장·야간·휴일근로 가산수당은 이 계산기에서
          다루지 않습니다.
        </p>
        <p>
          고용노동부의 승인을 받은 감시·단속적 근로 종사자, 농림·축산·수산업 종사자 등
          일부 근로자(근로기준법 제63조)는 주휴일 규정이 적용되지 않아 주휴수당이
          발생하지 않을 수 있습니다. 세금·4대보험 공제 후 실수령액, 월급제 계약에 포함된
          주휴수당분 역산은 이 계산기의 범위 밖입니다.
        </p>
        <p>
          이 계산은 {APPLICABLE_RATE_YEAR}년 기준이며, 최저임금 등 관련 수치는 매년
          갱신될 수 있습니다.
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={weeklyHolidayAllowanceFaqItems} />
      </div>
    </div>
  );
}
