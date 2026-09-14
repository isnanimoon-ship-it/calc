"use client";

/**
 * 주택 취득세 계산기 — 입력/결과 UI.
 *
 * tasks/housing-acquisition-tax/ARCHITECTURE.md "9."가 정한 화면 순서를 그대로 구현한다:
 * 스코프 배너 → 입력(조정대상지역 helpText에 자가 확인 책임 포함) → 핵심 카드(총 납부액) →
 * 세목별 내역 카드 → 계산 근거 → 정책 고지 2개 SectionCard("이 결과가 반영하지 않는 것" +
 * "꼭 확인하세요") → 소개/사용법/FAQ.
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
 * 보유 주택 수는 4개 카드형 라디오로 구현한다(select 아님, ARCHITECTURE.md "9.3").
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
  HOUSE_COUNT_CARD_HINTS,
  HOUSE_COUNT_HELP_TEXT,
  HOUSING_TAX_INTRO_PARAGRAPHS,
  HOUSING_TAX_SCOPE_BANNER,
  HOUSING_TAX_USAGE_STEPS,
  ADJUSTMENT_AREA_HELP_TEXT,
  LEGAL_DISCLAIMER_NOTICES,
  NOT_REFLECTED_NOTICES,
  OPEN_QUESTION_NOTICES,
  housingAcquisitionTaxFaqItems,
} from "./content";
import {
  buildTaxCalculationBreakdown,
  describeAppliedRateBasis,
  formatPercent,
  formatWon,
  formatWonInKoreanUnits,
  HOUSE_COUNT_LABELS,
  PRICE_TIER_LABELS,
} from "./formatting";
import { calculateHousingAcquisitionTax } from "./logic";
import type { HouseCountAfterAcquisition, HousingAcquisitionTaxResult } from "./types";
import {
  isValidHouseCount,
  validateHousingAcquisitionTaxInput,
  type RawHousingAcquisitionTaxFormInput,
  type ValidationFieldError,
} from "./validation";

const EMPTY_FORM: RawHousingAcquisitionTaxFormInput = {
  acquisitionPrice: "",
  exclusiveArea: "",
  isAdjustmentTargetArea: null,
  houseCountAfterAcquisition: null,
};

/** FORMULA.md 검증 예제 4(6.5억원/59㎡/비조정/1주택)를 그대로 샘플로 쓴다. */
const SAMPLE_FORM: RawHousingAcquisitionTaxFormInput = {
  acquisitionPrice: "650,000,000",
  exclusiveArea: "59",
  isAdjustmentTargetArea: false,
  houseCountAfterAcquisition: 1,
};

const HOUSE_COUNT_OPTIONS: HouseCountAfterAcquisition[] = [1, 2, 3, 4];

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

/**
 * 정책 고지 문구 중 "molit.go.kr"/"wetax.go.kr" 언급을 실제 클릭 가능한 외부 링크로 바꿔서
 * 렌더링한다(UX/UI Critic Q5 Medium — 텍스트로만 표기돼 클릭할 수 없던 문제). content.ts의
 * 문구 자체는 그대로 두고(도메인 표기가 없어지지 않도록), 렌더링 시점에만 도메인 문자열을
 * 링크로 치환한다 — 계산 로직과 무관한 순수 표시 처리다.
 */
const EXTERNAL_NOTICE_LINK_TARGETS: Record<string, string> = {
  "molit.go.kr": "https://www.molit.go.kr",
  "wetax.go.kr": "https://www.wetax.go.kr",
};
const EXTERNAL_NOTICE_LINK_PATTERN = /(molit\.go\.kr|wetax\.go\.kr)/g;

function LinkedNoticeText({ text }: { text: string }) {
  const parts = text.split(EXTERNAL_NOTICE_LINK_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        const href = EXTERNAL_NOTICE_LINK_TARGETS[part];
        if (!href) return <span key={index}>{part}</span>;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            {part}
          </a>
        );
      })}
    </>
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

export default function HousingAcquisitionTaxUi() {
  const formId = useId();
  const [form, setForm] = useState<RawHousingAcquisitionTaxFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<HousingAcquisitionTaxResult | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    // 공유 URL 복원 경로 — houseCountAfterAcquisition이 1~4 밖이면 즉시 null로 치환한 뒤
    // 검증한다(ARCHITECTURE.md "8.", bmr-calculator activityLevel 방어 패턴과 동일).
    const restored: RawHousingAcquisitionTaxFormInput = {
      acquisitionPrice: String(saved.acquisitionPrice ?? ""),
      exclusiveArea: String(saved.exclusiveArea ?? ""),
      isAdjustmentTargetArea:
        typeof saved.isAdjustmentTargetArea === "boolean" ? saved.isAdjustmentTargetArea : null,
      houseCountAfterAcquisition: isValidHouseCount(saved.houseCountAfterAcquisition)
        ? saved.houseCountAfterAcquisition
        : null,
    };
    const checked = validateHousingAcquisitionTaxInput(restored);
    if (!checked.success) return;
    setForm(restored);
    setErrors([]);
    setResult(calculateHousingAcquisitionTax(checked.data));
  });

  function errorFor(field: ValidationFieldError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleAcquisitionPriceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      acquisitionPrice: digits ? Number(digits).toLocaleString("ko-KR") : "",
    }));
    setResult(null);
  }

  function handleExclusiveAreaChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, exclusiveArea: event.target.value }));
    setResult(null);
  }

  function updateAdjustmentTargetArea(value: boolean) {
    setForm((prev) => ({ ...prev, isAdjustmentTargetArea: value }));
    setResult(null);
  }

  function updateHouseCount(value: HouseCountAfterAcquisition) {
    setForm((prev) => ({ ...prev, houseCountAfterAcquisition: value }));
    setResult(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateHousingAcquisitionTaxInput(form);
    if (!checked.success) {
      setErrors(checked.errors);
      setResult(null);
      return;
    }
    setErrors([]);
    setResult(calculateHousingAcquisitionTax(checked.data));
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

  // 취득가액 자릿수(억/만원) 오입력을 입력 즉시 알아챌 수 있도록 한글 단위로 환산해 보여준다
  // (UX/UI Critic Q7 Medium). 계산에는 쓰이지 않는 표시 전용 값이다.
  const acquisitionPriceInKoreanUnits = formatWonInKoreanUnits(
    Number(form.acquisitionPrice.replace(/,/g, "")),
  );

  const breakdownInput = (() => {
    const checked = validateHousingAcquisitionTaxInput(form);
    return checked.success ? checked.data : null;
  })();
  const breakdownRows =
    result && breakdownInput ? buildTaxCalculationBreakdown(breakdownInput, result) : [];
  const appliedRateBasis =
    result && breakdownInput ? describeAppliedRateBasis(breakdownInput, result) : "";

  const shareText = result
    ? `주택 취득세(취득세+지방교육세+농어촌특별세) 총 납부액은 약 ${formatWon(result.totalTax)}입니다.`
    : "매매가·전용면적·조정대상지역 여부·보유 주택 수로 주택 취득세 총 납부액을 계산해 보세요.";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/tax" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
          세금/정책
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">주택 취득세 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          매매가·전용면적·조정대상지역 해당 여부·취득 후 보유 주택 수로 취득세·지방교육세·
          농어촌특별세와 총 납부액을 계산합니다.
        </p>
      </header>

      {/* ── 스코프 배너 — 결과와 무관하게 항상 노출(ARCHITECTURE.md "9.1") ─────────── */}
      <section className="mt-6 rounded-2xl bg-surface-subtle p-5 text-sm leading-6 text-muted">
        {HOUSING_TAX_SCOPE_BANNER}
      </section>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <div>
          <label htmlFor={`${formId}-acquisitionPrice`} className={LABEL_CLASS}>
            매매가(취득가액) <RequiredMark />
            <span className="ml-1 text-xs font-normal text-muted">(원)</span>
          </label>
          <input
            id={`${formId}-acquisitionPrice`}
            inputMode="numeric"
            value={form.acquisitionPrice}
            onChange={handleAcquisitionPriceChange}
            placeholder="예: 650,000,000"
            aria-required="true"
            aria-invalid={errorFor("acquisitionPrice") ? true : undefined}
            aria-describedby={[
              `${formId}-acquisitionPrice-help`,
              acquisitionPriceInKoreanUnits ? `${formId}-acquisitionPrice-korean-unit` : null,
              errorFor("acquisitionPrice") ? `${formId}-acquisitionPrice-error` : null,
            ]
              .filter(Boolean)
              .join(" ")}
            className={FIELD_CLASS}
          />
          <p id={`${formId}-acquisitionPrice-help`} className={HELP_CLASS}>
            실제 계약서상 매매가를 원 단위로 입력하세요.
          </p>
          {acquisitionPriceInKoreanUnits && (
            <p
              id={`${formId}-acquisitionPrice-korean-unit`}
              className="mt-1 text-xs font-semibold text-primary"
            >
              입력하신 금액은 약 {acquisitionPriceInKoreanUnits}입니다. 자릿수(억/만원)가 맞는지
              확인해 주세요.
            </p>
          )}
          {errorFor("acquisitionPrice") && (
            <p id={`${formId}-acquisitionPrice-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("acquisitionPrice")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${formId}-exclusiveArea`} className={LABEL_CLASS}>
            전용면적 <RequiredMark />
            <span className="ml-1 text-xs font-normal text-muted">(㎡)</span>
          </label>
          <input
            id={`${formId}-exclusiveArea`}
            inputMode="decimal"
            value={form.exclusiveArea}
            onChange={handleExclusiveAreaChange}
            placeholder="예: 59"
            aria-required="true"
            aria-invalid={errorFor("exclusiveArea") ? true : undefined}
            aria-describedby={`${formId}-exclusiveArea-help${errorFor("exclusiveArea") ? ` ${formId}-exclusiveArea-error` : ""}`}
            className={FIELD_CLASS}
          />
          <p id={`${formId}-exclusiveArea-help`} className={HELP_CLASS}>
            분양(공급)면적이 아니라 등기부등본·분양계약서에 적힌 전용면적을 입력하세요. 국민
            주택규모(85㎡) 초과 여부에 따라 농어촌특별세 부과 여부가 갈립니다.
          </p>
          {errorFor("exclusiveArea") && (
            <p id={`${formId}-exclusiveArea-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("exclusiveArea")}
            </p>
          )}
        </div>

        {/* 조정대상지역 여부 — 2택 카드형 라디오, helpText에 자가 확인 책임 문구 포함 */}
        <fieldset className="border-t border-border pt-6">
          <legend className={LABEL_CLASS}>
            이 지역은 정부가 지정한 규제지역인가요? <RequiredMark />
          </legend>
          <p className={HELP_CLASS}>
            <LinkedNoticeText text={ADJUSTMENT_AREA_HELP_TEXT} />
          </p>
          <div className="mt-3 grid max-w-xs grid-cols-2 gap-2">
            {([
              [false, "아니요"],
              [true, "예"],
            ] as const).map(([value, label]) => (
              <label
                key={String(value)}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                  form.isAdjustmentTargetArea === value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-isAdjustmentTargetArea`}
                  className="sr-only"
                  checked={form.isAdjustmentTargetArea === value}
                  aria-invalid={errorFor("isAdjustmentTargetArea") ? true : undefined}
                  onChange={() => updateAdjustmentTargetArea(value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errorFor("isAdjustmentTargetArea") && (
            <p role="alert" className={ERROR_CLASS}>
              {errorFor("isAdjustmentTargetArea")}
            </p>
          )}
        </fieldset>

        {/* 취득 후 보유 주택 수 — 4개 카드형 라디오(select 아님, ARCHITECTURE.md "9.3") */}
        <fieldset className="border-t border-border pt-6">
          <legend className={LABEL_CLASS}>
            이 집을 포함해서 총 몇 채를 갖게 되나요? <RequiredMark />
          </legend>
          <p className={HELP_CLASS}>{HOUSE_COUNT_HELP_TEXT}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOUSE_COUNT_OPTIONS.map((value) => {
              const isSelected = form.houseCountAfterAcquisition === value;
              return (
                <label
                  key={value}
                  className={`block cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition ${
                    isSelected
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-houseCountAfterAcquisition`}
                    className="sr-only"
                    checked={isSelected}
                    aria-invalid={errorFor("houseCountAfterAcquisition") ? true : undefined}
                    onChange={() => updateHouseCount(value)}
                  />
                  <span
                    className={`block font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}
                  >
                    {HOUSE_COUNT_LABELS[value]}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted">
                    {HOUSE_COUNT_CARD_HINTS[value]}
                  </span>
                </label>
              );
            })}
          </div>
          {errorFor("houseCountAfterAcquisition") && (
            <p role="alert" className={ERROR_CLASS}>
              {errorFor("houseCountAfterAcquisition")}
            </p>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            취득세 계산하기
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
        title="주택 취득세 계산기"
        text={shareText}
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && breakdownInput && (
          <>
            {/* 핵심 결과 카드 — 총 납부액 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                예상 총 납부액(취득세 + 지방교육세 + 농어촌특별세)
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.totalTax)}
              </p>
              <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                적용 세율 {formatPercent(result.appliedRate)}
                {result.isHeavyRateApplied ? "(다주택자 중과세율)" : "(표준세율)"}
              </p>
              <p className="mt-1 text-sm opacity-90 dark:text-muted dark:opacity-100">
                이 값은 추정치이며, 감면 미반영·조정대상지역 자가 확인 기준입니다.
              </p>
            </section>

            {/* 세목별 내역 카드 */}
            <SectionCard title="세목별 내역" icon={<SectionIcon name="chart" />}>
              <dl className="divide-y divide-border text-sm">
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="font-medium">취득세</dt>
                  <dd className="font-semibold tabular-nums">{formatWon(result.acquisitionTax)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="font-medium">지방교육세</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatWon(result.localEducationTax)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 font-medium">
                    농어촌특별세
                    {result.isRuralSpecialTaxExempt && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                        0원 · 85㎡ 이하 비과세
                      </span>
                    )}
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatWon(result.ruralSpecialTax)}</dd>
                </div>
              </dl>
            </SectionCard>

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 근거" icon={<SectionIcon name="formula" />}>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">가격 구간</dt>
                  <dd className="text-sm font-medium">{PRICE_TIER_LABELS[result.priceTier]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">표준세율(중과 여부와 무관)</dt>
                  <dd className="text-sm font-medium">{formatPercent(result.standardRate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">다주택자 중과 적용 여부</dt>
                  <dd className="text-sm font-medium">
                    {result.isHeavyRateApplied ? "적용됨" : "적용 안 됨(표준세율)"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">최종 적용 세율</dt>
                  <dd className="text-sm font-medium">{formatPercent(result.appliedRate)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-muted">{appliedRateBasis}</p>

              <ol className="mt-5 space-y-4 border-t border-border pt-5">
                {breakdownRows.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-0.5 text-xs text-muted">근거: {row.legalBasis}</p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.expression}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* ── 정책 고지 그룹 3: 이 결과가 반영하지 않는 것 ─────────────────── */}
            <SectionCard title="이 결과가 반영하지 않는 것" icon={<SectionIcon name="warning" />}>
              <ul className="space-y-3 text-sm leading-6 text-muted">
                {NOT_REFLECTED_NOTICES.map((notice) => (
                  <li key={notice}>
                    <LinkedNoticeText text={notice} />
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* ── 정책 고지 그룹 4: 꼭 확인하세요(법적 고지) ───────────────────── */}
            <SectionCard title="꼭 확인하세요" icon={<SectionIcon name="info" />}>
              <ul className="space-y-2 text-sm leading-6 text-muted">
                {LEGAL_DISCLAIMER_NOTICES.map((notice) => (
                  <li key={notice}>
                    <LinkedNoticeText text={notice} />
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted">
                  아직 위택스 등과 직접 대조해 확정하지 못한 사항
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-muted">
                  {OPEN_QUESTION_NOTICES.map((notice) => (
                    <li key={notice}>
                      <LinkedNoticeText text={notice} />
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="매매가·전용면적·조정대상지역 여부·보유 주택 수만 입력하면 자동으로 계산합니다."
          steps={HOUSING_TAX_USAGE_STEPS}
        />
        <IntroSection
          title="주택 취득세, 왜 사람마다 세율이 다른가요?"
          paragraphs={HOUSING_TAX_INTRO_PARAGRAPHS}
        />
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={housingAcquisitionTaxFaqItems} />
      </div>
    </div>
  );
}
