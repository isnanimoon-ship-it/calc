"use client";

/**
 * 평단가(물타기) 계산기 — 입력/결과 UI.
 *
 * tasks/average-cost-calculator/ARCHITECTURE.md "10. Builder 인수인계 요약" 9번을 그대로
 * 구현한다. 계산 공식은 이 파일에 두지 않는다(logic.ts) — 이 파일은 폼 상태 관리와 표시만
 * 담당한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * **이 계산기는 어디에도 `Number(raw)` 변환이 없다** — 폼 상태는 항상 문자열로 유지하고,
 * 콤마는 표시용으로만 삽입/제거한다(순수 문자열 처리, ARCHITECTURE.md "4." 마지막 문단).
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
  AVERAGE_COST_ASSUMPTION_NOTICES,
  AVERAGE_COST_INTRO_PARAGRAPHS,
  AVERAGE_COST_USAGE_STEPS,
  averageCostCalculatorFaqItems,
} from "./content";
import {
  buildAverageCostBreakdown,
  directionDescriptions,
  directionLabels,
  formatPercent,
  formatQty,
  formatResultSummary,
  formatWon,
  ROUNDED_TO_ZERO_BUT_CHANGED_NOTE,
} from "./formatting";
import { calculateAverageCost, restoreAverageCostResult } from "./logic";
import type { AverageCostCalculatorInput, AverageCostCalculatorResult, AverageCostDirection } from "./types";
import {
  parseAverageCostShareState,
  validateAverageCostInput,
  type AverageCostField,
  type AverageCostValidationFieldError,
  type RawAverageCostFormInput,
} from "./validation";

const EMPTY_FORM: RawAverageCostFormInput = {
  holdingQty: "",
  holdingPrice: "",
  additionalQty: "",
  additionalPrice: "",
};

/** FORMULA.md 검증 예제 1(물타기 기본, brainc.me 대조)을 그대로 샘플로 쓴다. */
const SAMPLE_FORM: RawAverageCostFormInput = {
  holdingQty: "10",
  holdingPrice: "10,000",
  additionalQty: "10",
  additionalPrice: "5,000",
};

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

function SectionIcon({ name }: { name: "coins" | "formula" | "document" | "info" }) {
  const paths = {
    coins: (
      <>
        <ellipse cx="9" cy="7" rx="5" ry="2.5" />
        <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5.7 0 1.4-.1 2-.2M4 11v4c0 1.4 2.2 2.5 5 2.5.5 0 1 0 1.5-.1" />
        <ellipse cx="16" cy="14" rx="4" ry="2" />
        <path d="M12 14v4c0 1.1 1.8 2 4 2s4-.9 4-2v-4" />
      </>
    ),
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

/**
 * 방향 뱃지(하락/상승/변동없음) — 로컬 서브컴포넌트(ARCHITECTURE.md "7.", 아직 사례가
 * 1개뿐이라 components/calculator/로 승격하지 않는다). "상승"을 오류로 취급하지 않으므로
 * `text-danger` 등 에러 색상을 쓰지 않고 중립 토큰 + 방향 아이콘만으로 표현한다.
 */
function DirectionIcon({ direction }: { direction: AverageCostDirection }) {
  if (direction === "하락") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (direction === "상승") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function DirectionBadge({ direction, tone = "default" }: { direction: AverageCostDirection; tone?: "default" | "onPrimary" }) {
  const toneClass =
    tone === "onPrimary"
      ? "border-white/30 bg-white/10 text-primary-foreground"
      : "border-border-strong bg-surface-subtle text-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      <DirectionIcon direction={direction} />
      {directionLabels[direction]}
    </span>
  );
}

/** 순수 문자열 조작으로 정수부에 천 단위 콤마를 삽입한다(Number() 미사용). */
function groupIntegerDigits(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 입력 중인 값에서 콤마를 제거하고, 숫자·소수점 하나만 남긴 뒤 다시 콤마를 붙여 표시한다. */
function normalizeDecimalDisplay(rawValue: string): string {
  const stripped = rawValue.replace(/,/g, "");
  const filtered = stripped.replace(/[^0-9.]/g, "");
  const firstDot = filtered.indexOf(".");
  const singleDot = firstDot === -1 ? filtered : filtered.slice(0, firstDot + 1) + filtered.slice(firstDot + 1).replace(/\./g, "");
  const withLeadingZero = singleDot.startsWith(".") ? `0${singleDot}` : singleDot;
  const dotIndex = withLeadingZero.indexOf(".");
  const integerDigits = dotIndex === -1 ? withLeadingZero : withLeadingZero.slice(0, dotIndex);
  const fractionDigits = dotIndex === -1 ? "" : withLeadingZero.slice(dotIndex + 1);
  const groupedInteger = groupIntegerDigits(integerDigits);
  return dotIndex === -1 ? groupedInteger : `${groupedInteger}.${fractionDigits}`;
}

function stripCommas(value: string): string {
  return value.replace(/,/g, "");
}

export default function AverageCostCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawAverageCostFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<AverageCostValidationFieldError[]>([]);
  const [result, setResult] = useState<AverageCostCalculatorResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<AverageCostCalculatorInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    if (!root) return;
    const parsed = parseAverageCostShareState(root);
    if (!parsed) return;
    setForm({
      holdingQty: normalizeDecimalDisplay(parsed.holdingQty),
      holdingPrice: normalizeDecimalDisplay(parsed.holdingPrice),
      additionalQty: normalizeDecimalDisplay(parsed.additionalQty),
      additionalPrice: normalizeDecimalDisplay(parsed.additionalPrice),
    });
    setErrors([]);
    setAppliedInput(parsed);
    setResult(restoreAverageCostResult(parsed));
  });

  function errorFor(field: AverageCostField): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function clearResult() {
    setResult(null);
    setAppliedInput(null);
  }

  function handleFieldChange(field: AverageCostField) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const display = normalizeDecimalDisplay(event.target.value);
      setForm((prev) => ({ ...prev, [field]: display }));
      clearResult();
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateAverageCostInput({
      holdingQty: stripCommas(form.holdingQty),
      holdingPrice: stripCommas(form.holdingPrice),
      additionalQty: stripCommas(form.additionalQty),
      additionalPrice: stripCommas(form.additionalPrice),
    });
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateAverageCost(validation.data));
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

  const breakdown = result ? buildAverageCostBreakdown(result) : [];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/finance" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">금융</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">평단가(물타기) 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          보유 수량·평단가와 추가 매수 수량·단가를 입력하면, 매수 후 새로운 평단가와 총
          보유수량·총 투자원금을 계산 근거와 함께 계산합니다. 평단가가 낮아지는 경우(물타기)와
          높아지는 경우(불타기) 모두 정확하게 계산합니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <fieldset className="space-y-5">
          <legend className={LABEL_CLASS}>보유 정보</legend>
          <div>
            <label htmlFor={`${formId}-holdingQty`} className={LABEL_CLASS}>
              보유 수량
              <RequiredMark />
            </label>
            <input
              id={`${formId}-holdingQty`}
              inputMode="decimal"
              value={form.holdingQty}
              aria-required="true"
              aria-invalid={errorFor("holdingQty") ? true : undefined}
              aria-describedby={errorFor("holdingQty") ? `${formId}-holdingQty-error` : undefined}
              onChange={handleFieldChange("holdingQty")}
              placeholder="예: 10"
              className={FIELD_CLASS}
            />
            <p className={HELP_CLASS}>0보다 큰 값, 소수점 8자리까지 입력할 수 있습니다(코인 대응).</p>
            {errorFor("holdingQty") && (
              <p id={`${formId}-holdingQty-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("holdingQty")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-holdingPrice`} className={LABEL_CLASS}>
              보유 평단가
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-holdingPrice`}
              inputMode="decimal"
              value={form.holdingPrice}
              aria-required="true"
              aria-invalid={errorFor("holdingPrice") ? true : undefined}
              aria-describedby={errorFor("holdingPrice") ? `${formId}-holdingPrice-error` : undefined}
              onChange={handleFieldChange("holdingPrice")}
              placeholder="예: 10,000"
              className={FIELD_CLASS}
            />
            <p className={HELP_CLASS}>현재 평균 매입단가입니다. 소수점 8자리까지 입력할 수 있습니다.</p>
            {errorFor("holdingPrice") && (
              <p id={`${formId}-holdingPrice-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("holdingPrice")}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className={LABEL_CLASS}>추가 매수 정보</legend>
          <div>
            <label htmlFor={`${formId}-additionalQty`} className={LABEL_CLASS}>
              추가 매수 수량
              <RequiredMark />
            </label>
            <input
              id={`${formId}-additionalQty`}
              inputMode="decimal"
              value={form.additionalQty}
              aria-required="true"
              aria-invalid={errorFor("additionalQty") ? true : undefined}
              aria-describedby={errorFor("additionalQty") ? `${formId}-additionalQty-error` : undefined}
              onChange={handleFieldChange("additionalQty")}
              placeholder="예: 10"
              className={FIELD_CLASS}
            />
            <p className={HELP_CLASS}>이번에 추가로 매수하려는 수량입니다. 소수점 8자리까지 입력할 수 있습니다.</p>
            {errorFor("additionalQty") && (
              <p id={`${formId}-additionalQty-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("additionalQty")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-additionalPrice`} className={LABEL_CLASS}>
              추가 매수 단가
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-additionalPrice`}
              inputMode="decimal"
              value={form.additionalPrice}
              aria-required="true"
              aria-invalid={errorFor("additionalPrice") ? true : undefined}
              aria-describedby={errorFor("additionalPrice") ? `${formId}-additionalPrice-error` : undefined}
              onChange={handleFieldChange("additionalPrice")}
              placeholder="예: 5,000"
              className={FIELD_CLASS}
            />
            <p className={HELP_CLASS}>지금 사려는 가격(현재가)을 입력하세요. 소수점 8자리까지 입력할 수 있습니다.</p>
            {errorFor("additionalPrice") && (
              <p id={`${formId}-additionalPrice-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("additionalPrice")}
              </p>
            )}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            평단가 계산하기
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
        title="평단가(물타기) 계산기"
        text={result ? formatResultSummary(result) : "보유 수량·평단가와 추가 매수 수량·단가로 새 평단가를 계산해 보세요."}
        url={
          baseUrl
            ? result && appliedInput
              ? buildStateShareUrl(baseUrl, appliedInput)
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
            {/* 핵심 결과 카드(SPEC.md "계산 결과" — 계산기당 하나만). */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">매수 후 새 평단가</h2>
              <p className="mt-2 break-words text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.newAveragePrice)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <DirectionBadge direction={result.direction} tone="onPrimary" />
                <p className="break-words text-sm opacity-90 dark:text-foreground dark:opacity-100">
                  {formatWon(result.priceChangeAmount)} ({formatPercent(result.priceChangeRate)})
                </p>
              </div>
              {result.isRoundedToZeroButChanged && (
                <p className="mt-3 text-xs opacity-75 dark:text-muted dark:opacity-100">
                  {ROUNDED_TO_ZERO_BUT_CHANGED_NOTE}
                </p>
              )}
            </section>

            {/* 보조 결과(SPEC.md "계산 결과" — 핵심 결과 카드 밖). */}
            <SectionCard title="보유 현황 변화" icon={<SectionIcon name="coins" />}>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">총 보유수량</dt>
                  <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums">{formatQty(result.totalQty)}</dd>
                </div>
                <div>
                  <dt className="text-muted">총 투자원금</dt>
                  <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums">{formatWon(result.totalCost)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted">평단가 변동</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <DirectionBadge direction={result.direction} />
                    <span className="break-words tabular-nums">
                      {formatWon(result.priceChangeAmount)} ({formatPercent(result.priceChangeRate)})
                    </span>
                  </dd>
                  <p className="mt-1.5 text-xs text-muted">{directionDescriptions[result.direction]}</p>
                  {result.isRoundedToZeroButChanged && (
                    <p className="mt-1.5 text-xs text-muted">{ROUNDED_TO_ZERO_BUT_CHANGED_NOTE}</p>
                  )}
                </div>
              </dl>
            </SectionCard>

            {/* 계산 근거(SPEC.md 화면 구성 7번). */}
            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {breakdown.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 break-words tabular-nums text-zinc-700 dark:text-zinc-300">{row.detail}</p>
                  </li>
                ))}
              </ol>
            </SectionCard>

            <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">보유 수량</dt>
                  <dd className="min-w-0 break-words">{formatQty(appliedInput.holdingQty)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">보유 평단가</dt>
                  <dd className="min-w-0 break-words">{formatWon(appliedInput.holdingPrice)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">추가 매수 수량</dt>
                  <dd className="min-w-0 break-words">{formatQty(appliedInput.additionalQty)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">추가 매수 단가</dt>
                  <dd className="min-w-0 break-words">{formatWon(appliedInput.additionalPrice)}</dd>
                </div>
              </dl>
            </SectionCard>
          </>
        )}
      </div>

      {/*
       * ── 소개 · 사용 방법 ───────────────────────────────────────────
       * Optimizer 노트(2026-09-12): UX/UI Critic Q10·QA가 이 위치(결과·계산근거 뒤)를
       * SPEC.md "화면 구성"·docs/DESIGN_SYSTEM.md "공통 화면 순서"(소개→사용방법→입력→...)
       * 위반(Medium)으로 지적해 "입력 폼보다 앞으로 옮기라"는 지시를 받았으나, 실제 코드를
       * 대조한 결과 이 사이트의 모든 기존 계산기가 이미 동일하게 이 위치(결과 뒤, 정책 안내
       * 바로 앞)를 쓰고 있음을 확인했다 — severance-pay/ui.tsx(DESIGN_SYSTEM.md가 지정한
       * 참고 구현 자체, 줄 791-802), bill-split-calculator/ui.tsx(줄 640-644),
       * loan-interest-calculator/ui.tsx(줄 637-641, "2026-09-07 정정 — 최초 구현은
       * ARCHITECTURE.md 문구를 따라 입력 폼보다 앞에 뒀으나, 실제로는 이 사이트의 다른 모든
       * 계산기가 결과 아래에 두고 있어 시각적 일관성이 깨졌다"는 주석으로 이 위치가 의도적
       * 수정 결과임을 명시). 즉 "다른 계산기를 참고해 동일한 패턴을 따르라"는 지시를 그대로
       * 따르면 오히려 이 위치를 유지해야 한다 — 옮기면 이 계산기만 사이트 전체와 다른
       * 유일한 예외가 되어 동일한 "시각적 일관성 붕괴" 문제가 재발한다. 따라서 이번
       * Optimizer 라운드에서는 위치를 옮기지 않았다. docs/DESIGN_SYSTEM.md "공통 화면 순서"
       * 문구 자체가 실제 관행과 어긋나 있는 문서 정합성 문제이므로, 문서 수정 여부는
       * Optimizer 권한 밖(문서 소유자/Architect/사람 검토) 몫으로 남긴다 — 자세한 근거는
       * tasks/average-cost-calculator/EVALUATION.md "## Optimizer" 절 참고.
       */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="보유 수량·평단가와 추가 매수 수량·단가만 입력하면 자동으로 계산합니다."
          steps={AVERAGE_COST_USAGE_STEPS}
        />
        <IntroSection title="평단가·물타기·불타기란?" paragraphs={AVERAGE_COST_INTRO_PARAGRAPHS} />
      </div>

      {/* ── 계산 전제 고지 + FAQ ─────────────────────────────────────── */}
      <SectionCard title="계산 전 확인" icon={<SectionIcon name="info" />} className="mt-8">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {AVERAGE_COST_ASSUMPTION_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </SectionCard>
      <section className="mt-5 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">
        입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.
      </section>
      <div className="mt-5">
        <FaqAccordion items={averageCostCalculatorFaqItems} />
      </div>
    </div>
  );
}
