"use client";

/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 입력/결과 UI.
 *
 * tasks/real-estate-brokerage-fee-calculator/ARCHITECTURE.md "8. UI 레이아웃"이 정한 화면
 * 순서를 그대로 구현한다: 스코프 배너 → 거래 유형 토글 → 입력(모드별 분기 + 부동산 종류
 * 확인) → 핵심 결과 카드("중개보수 상한액" + 임대차는 환산보증금 보조 라인) → 경고 톤 고지
 * 카드(협의 문구, 핵심 결과와 대등한 우선순위) → 계산 근거 → "이 결과가 포함하지 않는 것" →
 * 표준 법적 고지 footer → 소개/사용법/FAQ.
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
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
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import { buildStateShareUrl } from "@/src/lib/share";
import {
  AGREED_AMOUNT_WARNING,
  INTRO_PARAGRAPHS,
  LEGAL_DISCLAIMER_NOTICES,
  MONTHLY_RENT_HELP_TEXT,
  NOT_INCLUDED_NOTICES,
  OPEN_QUESTION_NOTICES,
  PROPERTY_TYPE_HELP_TEXT,
  SCOPE_BANNER,
  USAGE_STEPS,
  faqItems,
} from "./content";
import {
  describeCapComparison,
  describeConvertedDepositCalculation,
  formatPercent,
  formatRateAppliedAmountForDisplay,
  formatTierRangeLabel,
  formatWon,
} from "./formatting";
import { calculateRealEstateBrokerageFee } from "./logic";
import type {
  RealEstateBrokerageFeeCalculatorInput,
  RealEstateBrokerageFeeCalculatorResult,
  TransactionType,
} from "./types";
import {
  validateRealEstateBrokerageFeeInput,
  type RawRealEstateBrokerageFeeFormInput,
  type ValidationFieldError,
} from "./validation";

const EMPTY_FORM: RawRealEstateBrokerageFeeFormInput = {
  transactionType: null,
  salePrice: "",
  deposit: "",
  monthlyRent: "",
};

/** FORMULA.md 검증 예제 9(9억원, 서울신문 실사례 대조) — 언론 실사례를 그대로 샘플로 쓴다. */
const SALE_SAMPLE_FORM: RawRealEstateBrokerageFeeFormInput = {
  transactionType: "sale",
  salePrice: "900,000,000",
  deposit: "",
  monthlyRent: "",
};

/** FORMULA.md 검증 예제 17(전세 6억원, 서울신문 실사례 대조). */
const LEASE_SAMPLE_FORM: RawRealEstateBrokerageFeeFormInput = {
  transactionType: "lease",
  salePrice: "",
  deposit: "600,000,000",
  monthlyRent: "",
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

function SectionIcon({ name }: { name: "formula" | "info" | "warning" }) {
  const paths = {
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

/**
 * "이 결과가 포함하지 않는 것" 고지 중 "주택 취득세 계산기(housing-acquisition-tax)" 언급을
 * 실제 클릭 가능한 내부 링크로 바꿔서 렌더링한다(SPEC.md Should Have — "housing-acquisition-
 * tax와의 교차 안내 문구", `housing-acquisition-tax/ui.tsx`의 `LinkedNoticeText` 외부 링크
 * 치환 패턴을 내부 링크에 적용). content.ts의 문구 자체는 그대로 두고 렌더링 시점에만
 * 치환한다 — 계산 로직과 무관한 순수 표시 처리다.
 */
function CrossLinkNoticeText({ text }: { text: string }) {
  const marker = "주택 취득세 계산기(housing-acquisition-tax)";
  const index = text.indexOf(marker);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <Link
        href="/calculators/housing-acquisition-tax"
        className="font-semibold text-primary underline underline-offset-2 hover:text-primary-hover"
      >
        주택 취득세 계산기
      </Link>
      {text.slice(index + marker.length)}
    </>
  );
}

/** 결과 문자열을 만들 때 쓰는, 계산 근거의 "거래금액" 확정값 문구(ARCHITECTURE.md "8.1"). */
function describeBaseAmount(result: RealEstateBrokerageFeeCalculatorResult): string {
  return result.transactionType === "sale"
    ? `매매가격 그대로 ${formatWon(result.baseAmount)}`
    : `환산보증금 그대로 ${formatWon(result.baseAmount)}`;
}

export default function RealEstateBrokerageFeeCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawRealEstateBrokerageFeeFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<RealEstateBrokerageFeeCalculatorResult | null>(null);
  const [appliedInput, setAppliedInput] =
    useState<RealEstateBrokerageFeeCalculatorInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    if (!root) return;
    if (root.transactionType !== "sale" && root.transactionType !== "lease") return;

    const restoredForm: RawRealEstateBrokerageFeeFormInput =
      root.transactionType === "sale"
        ? {
            transactionType: "sale",
            salePrice:
              typeof root.salePrice === "number" ? root.salePrice.toLocaleString("ko-KR") : "",
            deposit: "",
            monthlyRent: "",
          }
        : {
            transactionType: "lease",
            salePrice: "",
            deposit:
              typeof root.deposit === "number" ? root.deposit.toLocaleString("ko-KR") : "",
            monthlyRent:
              typeof root.monthlyRent === "number"
                ? root.monthlyRent.toLocaleString("ko-KR")
                : "",
          };
    const validated = validateRealEstateBrokerageFeeInput(restoredForm);
    if (!validated.success) return;
    setForm(restoredForm);
    setErrors([]);
    setAppliedInput(validated.data);
    setResult(calculateRealEstateBrokerageFee(validated.data));
  });

  function errorFor(field: ValidationFieldError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function clearResult() {
    setResult(null);
    setAppliedInput(null);
  }

  /** 거래 유형 전환 시 금액 입력 필드를 모두 초기화한다(ARCHITECTURE.md "2.1"). */
  function handleTransactionTypeChange(transactionType: TransactionType) {
    setForm({
      transactionType,
      salePrice: "",
      deposit: "",
      monthlyRent: "",
    });
    setErrors([]);
    clearResult();
  }

  function handleSalePriceChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      salePrice: digits ? Number(digits).toLocaleString("ko-KR") : "",
    }));
    clearResult();
  }

  function handleDepositChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      deposit: digits ? Number(digits).toLocaleString("ko-KR") : "",
    }));
    clearResult();
  }

  function handleMonthlyRentChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      monthlyRent: digits ? Number(digits).toLocaleString("ko-KR") : "",
    }));
    clearResult();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateRealEstateBrokerageFeeInput(form);
    if (!validated.success) {
      setErrors(validated.errors);
      clearResult();
      return;
    }
    setErrors([]);
    setAppliedInput(validated.data);
    setResult(calculateRealEstateBrokerageFee(validated.data));
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors([]);
    clearResult();
  }

  function handleFillSample() {
    setForm(form.transactionType === "lease" ? LEASE_SAMPLE_FORM : SALE_SAMPLE_FORM);
    setErrors([]);
    clearResult();
  }

  const capComparisonLine =
    result && result.appliedTier.cap !== null
      ? describeCapComparison(result.appliedTier, result.isCapApplied)
      : null;

  const convertedDepositLines =
    result && result.transactionType === "lease" && appliedInput?.transactionType === "lease"
      ? describeConvertedDepositCalculation(appliedInput, result)
      : [];

  const shareText = result
    ? `중개보수 상한액은 ${formatWon(result.maxBrokerageFee)}입니다(실제 지급액은 협의로 정해집니다).`
    : "매매·임대차 거래금액으로 중개보수(복비) 상한액을 계산해 보세요.";

  const shareData =
    appliedInput &&
    (appliedInput.transactionType === "sale"
      ? { transactionType: appliedInput.transactionType, salePrice: appliedInput.salePrice }
      : {
          transactionType: appliedInput.transactionType,
          deposit: appliedInput.deposit,
          monthlyRent: appliedInput.monthlyRent,
        });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/tax" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
          세금/정책
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">부동산 중개수수료 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          매매가격 또는 보증금·월차임을 입력하면 공인중개사법 시행규칙과 지자체 조례에 따른
          중개보수(복비) 상한액을 계산합니다.
        </p>
      </header>

      {/* ── 스코프 배너 — 결과와 무관하게 항상 노출(ARCHITECTURE.md "8.1") ─────────── */}
      <section className="mt-6 rounded-2xl bg-surface-subtle p-5 text-sm leading-6 text-muted">
        {SCOPE_BANNER}
      </section>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        {/* 거래 유형 토글(세그먼트 버튼, 필수) */}
        <div>
          <span className={LABEL_CLASS}>
            거래 유형 <RequiredMark />
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["sale", "lease"] as TransactionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTransactionTypeChange(type)}
                aria-pressed={form.transactionType === type}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  form.transactionType === type
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground hover:border-border-strong"
                }`}
              >
                {type === "sale" ? "매매" : "임대차(전세·월세)"}
              </button>
            ))}
          </div>
          {errorFor("transactionType") && (
            <p role="alert" className={ERROR_CLASS}>
              {errorFor("transactionType")}
            </p>
          )}
        </div>

        {/* 모드별 입력 */}
        {form.transactionType === "sale" && (
          <div>
            <label htmlFor={`${formId}-salePrice`} className={LABEL_CLASS}>
              매매가격 <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(원)</span>
            </label>
            <input
              id={`${formId}-salePrice`}
              inputMode="numeric"
              value={form.salePrice}
              onChange={handleSalePriceChange}
              placeholder="예: 900,000,000"
              aria-required="true"
              aria-invalid={errorFor("salePrice") ? true : undefined}
              aria-describedby={errorFor("salePrice") ? `${formId}-salePrice-error` : undefined}
              className={FIELD_CLASS}
            />
            {errorFor("salePrice") && (
              <p id={`${formId}-salePrice-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("salePrice")}
              </p>
            )}
          </div>
        )}

        {form.transactionType === "lease" && (
          <>
            <div>
              <label htmlFor={`${formId}-deposit`} className={LABEL_CLASS}>
                보증금 <RequiredMark />
                <span className="ml-1 text-xs font-normal text-muted">(원)</span>
              </label>
              <input
                id={`${formId}-deposit`}
                inputMode="numeric"
                value={form.deposit}
                onChange={handleDepositChange}
                placeholder="예: 600,000,000"
                aria-required="true"
                aria-invalid={errorFor("deposit") ? true : undefined}
                aria-describedby={errorFor("deposit") ? `${formId}-deposit-error` : undefined}
                className={FIELD_CLASS}
              />
              {errorFor("deposit") && (
                <p id={`${formId}-deposit-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("deposit")}
                </p>
              )}
            </div>

            <div>
              {/* [Optimizer] UX/UI Critic 권장 1(Medium) 대응 — 라벨을 helpText·placeholder·
                  FAQ와 같은 "월세"로 통일하되, 같은 폼 안의 "임대차(전세·월세)" 토글이 이미
                  쓰는 "일상어(법령 용어)" 표기 관례를 그대로 따라 괄호로 "월차임"을 병기한다
                  (docs/DESIGN_SYSTEM.md "라벨은 일상어, 법령 용어는 helpText로"). */}
              <label htmlFor={`${formId}-monthlyRent`} className={LABEL_CLASS}>
                월세(월차임)
                <span className="ml-1 text-xs font-normal text-muted">(원, 선택)</span>
              </label>
              <input
                id={`${formId}-monthlyRent`}
                inputMode="numeric"
                value={form.monthlyRent}
                onChange={handleMonthlyRentChange}
                placeholder="예: 500,000 (전세라면 비워두세요)"
                aria-invalid={errorFor("monthlyRent") ? true : undefined}
                aria-describedby={`${formId}-monthlyRent-help${errorFor("monthlyRent") ? ` ${formId}-monthlyRent-error` : ""}`}
                className={FIELD_CLASS}
              />
              <p id={`${formId}-monthlyRent-help`} className={HELP_CLASS}>
                {MONTHLY_RENT_HELP_TEXT}
              </p>
              {errorFor("monthlyRent") && (
                <p id={`${formId}-monthlyRent-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("monthlyRent")}
                </p>
              )}
            </div>
          </>
        )}

        {/* 부동산 종류 확인(필수, 정보 제공용) — v1은 "주택"만 지원(SPEC Must Have). 계산
            로직에는 영향을 주지 않는 UI 전용 요소다(ARCHITECTURE.md "10."). */}
        {form.transactionType && (
          <fieldset className="border-t border-border pt-6">
            <legend className={LABEL_CLASS}>부동산 종류</legend>
            <p className={HELP_CLASS}>{PROPERTY_TYPE_HELP_TEXT}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="cursor-pointer rounded-xl border border-primary bg-primary-soft px-4 py-3 text-center text-sm font-semibold text-primary">
                <input type="radio" name={`${formId}-propertyType`} className="sr-only" checked readOnly />
                주택
              </label>
              <label
                aria-disabled="true"
                className="cursor-not-allowed rounded-xl border border-border bg-surface-subtle px-4 py-3 text-center text-sm font-semibold text-muted opacity-60"
              >
                <input type="radio" name={`${formId}-propertyType`} className="sr-only" disabled />
                오피스텔 등(준비 중)
              </label>
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            중개보수 상한액 계산하기
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
        title="부동산 중개수수료 계산기"
        text={shareText}
        url={baseUrl ? (shareData ? buildStateShareUrl(baseUrl, shareData) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && (
          <>
            {/* 1) 핵심 결과 카드 — "중개보수 상한액"(SPEC Must Have, "중개수수료" 단독 표기 금지) */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                중개보수 상한액
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.maxBrokerageFee)}
              </p>
              <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                적용 상한요율 {formatPercent(result.appliedRate)}
              </p>
              {result.transactionType === "lease" && (
                <p className="mt-1 text-sm opacity-90 dark:text-muted dark:opacity-100">
                  환산보증금 {formatWon(result.convertedDeposit)}
                </p>
              )}
            </section>

            {/* 2) 정보 안내 카드 — 핵심 결과 카드 바로 아래, 다른 정책 고지와 절대 합치지
                않는다(ARCHITECTURE.md "8.1" 최우선 검증 항목). [Optimizer] UX/UI Critic
                권장 2(Medium) 대응 — 이 사이트에서 `bg-warning-surface`/`border-warning-
                border`는 지금까지 전부 "지급대상 아님" 류 부정적 판정에만 쓰였다. 이 카드는
                부정적 판정이 아니라 "확정 금액이 아니라는" 중요 안내이므로, 같은 사이트에
                이미 있는 참고/안내 톤 토큰(`bg-primary-soft`/`border-primary`, 이 폼의 선택된
                토글·라디오와 동일 톤)으로 바꾸고, 사이트의 다른 경고 카드가 갖춘 아이콘+제목
                구조를 그대로 적용해 "정보성 안내"임을 시각적으로 구분한다. 문구
                (`AGREED_AMOUNT_WARNING`)는 그대로 유지해 핵심 메시지를 흐리지 않는다. */}
            <section className="rounded-2xl border border-primary/30 bg-primary-soft p-6 dark:border-primary/25">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-primary"
                >
                  <SectionIcon name="info" />
                </span>
                <h2 className="text-base font-semibold tracking-tight text-primary">
                  확정 금액이 아닙니다
                </h2>
              </div>
              <p className="mt-3 text-sm font-medium leading-6">{AGREED_AMOUNT_WARNING}</p>
            </section>

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 근거" icon={<SectionIcon name="formula" />}>
              {result.transactionType === "lease" && convertedDepositLines.length > 0 && (
                <div className="border-b border-border pb-4">
                  <p className="text-xs font-semibold text-muted">환산보증금 계산</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {convertedDepositLines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-3 border-b border-border py-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">거래금액</dt>
                  <dd className="text-sm font-medium">{describeBaseAmount(result)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">적용 구간</dt>
                  <dd className="text-sm font-medium">
                    {formatTierRangeLabel(result.appliedTier)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">적용 상한요율</dt>
                  <dd className="text-sm font-medium">{formatPercent(result.appliedRate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">요율 적용 금액(참고)</dt>
                  <dd className="text-sm font-medium">
                    {formatWon(result.baseAmount)} × {formatPercent(result.appliedRate)} ={" "}
                    {formatRateAppliedAmountForDisplay(result.baseAmount, result.appliedRate)}
                  </dd>
                </div>
              </dl>

              {capComparisonLine && (
                <p className="border-b border-border py-4 text-sm text-muted">
                  {capComparisonLine}
                </p>
              )}

              <p className="pt-4 text-sm">
                <span className="font-semibold">최종 중개보수 상한액: </span>
                <span className="font-semibold tabular-nums">
                  {formatWon(result.maxBrokerageFee)}
                </span>
              </p>
            </SectionCard>

            {/* ── "이 결과가 포함하지 않는 것" ─────────────────────────── */}
            <SectionCard title="이 결과가 포함하지 않는 것" icon={<SectionIcon name="warning" />}>
              <ul className="space-y-3 text-sm leading-6 text-muted">
                {NOT_INCLUDED_NOTICES.map((notice) => (
                  <li key={notice}>
                    <CrossLinkNoticeText text={notice} />
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* ── 표준 법적 고지 footer ────────────────────────────────── */}
            <SectionCard title="꼭 확인하세요" icon={<SectionIcon name="info" />}>
              <ul className="space-y-2 text-sm leading-6 text-muted">
                {LEGAL_DISCLAIMER_NOTICES.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted">
                  아직 1차 출처로 완전히 확정하지 못한 사항
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-muted">
                  {OPEN_QUESTION_NOTICES.map((notice) => (
                    <li key={notice}>{notice}</li>
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
          description="거래 유형과 거래금액만 입력하면 자동으로 중개보수 상한액을 계산합니다."
          steps={USAGE_STEPS}
        />
        <IntroSection
          title="부동산 중개수수료(복비), 상한액은 어떻게 정해지나요?"
          paragraphs={INTRO_PARAGRAPHS}
        />
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={faqItems} />
      </div>
    </div>
  );
}
