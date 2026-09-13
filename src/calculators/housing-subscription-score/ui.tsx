"use client";

/**
 * 청약가점 계산기 — 입력/결과 UI.
 *
 * tasks/housing-subscription-score/ARCHITECTURE.md "6. UI 구조"를 그대로 구현한다.
 * 화면 순서: 소개 → 입력 → 결과(핵심 카드 → 항목별 카드 3개 + 경고 → 계산 근거 → 정책 안내)
 * → 사용 방법/소개 → FAQ (docs/DESIGN_SYSTEM.md 공통 순서).
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다
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
  HOUSING_SCORE_INTRO_PARAGRAPHS,
  HOUSING_SCORE_USAGE_STEPS,
  housingScorePolicyExceptionNotices,
  housingSubscriptionScoreFaqItems,
} from "./content";
import {
  buildHomelessIneligibleWarnings,
  buildHousingScoreBreakdown,
  buildSubscriptionNotRegisteredWarning,
  formatKoreanDate,
} from "./formatting";
import { calculateHousingSubscriptionScore } from "./logic";
import { HOUSING_SUBSCRIPTION_SCORE_POLICY } from "./policy";
import type {
  HousingStatus,
  HousingSubscriptionScoreInput,
  HousingSubscriptionScoreResult,
} from "./types";
import {
  MAX_ASCENDANT_COUNT,
  MAX_DESCENDANT_COUNT,
  MAX_FUTURE_YEARS_FOR_BASE_DATE,
  MIN_BIRTH_DATE,
  validateHousingSubscriptionScoreInput,
  type RawHousingSubscriptionScoreFormInput,
  type ValidationFieldError,
} from "./validation";

/** "오늘"(Asia/Seoul 기준) — age-calculator/bmi-calculator/military-salary의 기존 패턴. */
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** validation.ts의 `MAX_FUTURE_YEARS_FOR_BASE_DATE`와 동일한 규칙으로 date input의 `max`를 만든다. */
function maxBaseDateIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear() + MAX_FUTURE_YEARS_FOR_BASE_DATE,
      now.getUTCMonth(),
      now.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

const HOUSING_STATUS_LABELS: Record<HousingStatus, string> = {
  never_owned: "무주택 유지",
  disposed: "과거 소유 후 처분",
  currently_owns: "현재 소유 중",
};

const FIELD_CLASS =
  "mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";

function emptyForm(): RawHousingSubscriptionScoreFormInput {
  return {
    baseDate: todayIso(),
    birthDate: "",
    isMarried: false,
    marriageDate: "",
    housingStatus: "",
    mostRecentDisposalDate: "",
    smallLowValueHomeException: false,
    hasQualifyingSpouseInHousehold: false,
    qualifyingAscendantCount: "0",
    qualifyingDescendantCount: "0",
    hasSubscriptionAccount: true,
    subscriptionAccountOpenDate: "",
  };
}

/** FORMULA.md 검증 예제 12(종합 시나리오, totalScore=48)를 그대로 샘플로 쓴다. */
const SAMPLE_FORM: RawHousingSubscriptionScoreFormInput = {
  baseDate: "2026-09-06",
  birthDate: "1991-06-15",
  isMarried: true,
  marriageDate: "2019-05-01",
  housingStatus: "never_owned",
  mostRecentDisposalDate: "",
  smallLowValueHomeException: false,
  hasQualifyingSpouseInHousehold: true,
  qualifyingAscendantCount: "1",
  qualifyingDescendantCount: "1",
  hasSubscriptionAccount: true,
  subscriptionAccountOpenDate: "2016-01-10",
};

function SectionIcon({
  name,
}: {
  name: "chart" | "document" | "formula" | "info";
}) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
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

/** 경고 카드(docs/DESIGN_SYSTEM.md "경고/미충족 카드", weekly-holiday-allowance 선례). */
function WarningCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-warning-border bg-warning-surface p-5 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4.5 w-4.5">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
          </svg>
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 leading-6 text-zinc-700 dark:text-zinc-300">{body}</p>
    </section>
  );
}

/** 항목별 카드(무주택기간/부양가족수/가입기간) 공통 뼈대. */
function ItemScoreCard({
  title,
  score,
  maxScore,
  capped,
  detail,
}: {
  title: string;
  score: number;
  maxScore: number;
  capped: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted">{title}</h3>
        {capped && (
          <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
            상한 도달
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">
        {score}
        <span className="ml-1 text-sm font-normal text-muted">/ {maxScore}점</span>
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}

export default function HousingSubscriptionScoreUi() {
  const formId = useId();
  const [form, setForm] = useState<RawHousingSubscriptionScoreFormInput>(emptyForm);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<HousingSubscriptionScoreResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<HousingSubscriptionScoreInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    const restored = saved as unknown as RawHousingSubscriptionScoreFormInput;
    const validation = validateHousingSubscriptionScoreInput(restored);
    if (!validation.success) return;
    setForm(restored);
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateHousingSubscriptionScore(validation.data));
  });

  function errorFor(field: keyof RawHousingSubscriptionScoreFormInput): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function update<K extends keyof RawHousingSubscriptionScoreFormInput>(
    key: K,
    value: RawHousingSubscriptionScoreFormInput[K],
  ) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // FORMULA.md "입력값" 표: hasQualifyingSpouseInHousehold 기본값은 isMarried와
      // 동일해야 한다. isMarried가 바뀌는 전환 시점에만 함께 맞추고(QA M-2 대응), 그
      // 사이 사용자가 이 항목을 수동으로 바꾼 값은(isMarried가 그대로인 한) 건드리지
      // 않는다 — 매 렌더마다 강제로 덮어쓰지 않는다.
      if (key === "isMarried") {
        next.hasQualifyingSpouseInHousehold = value as unknown as boolean;
      }
      return next;
    });
    setResult(null);
    setAppliedInput(null);
  }

  /** 오류 id(있을 때만) + 도움말 id를 합쳐 `aria-describedby`를 구성한다(severance-pay/ui.tsx 선례). */
  function combineDescribedBy(
    ...ids: (string | null | undefined | false)[]
  ): string | undefined {
    return ids.filter(Boolean).join(" ") || undefined;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateHousingSubscriptionScoreInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateHousingSubscriptionScore(validation.data));
  }

  function handleReset() {
    setForm(emptyForm());
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

  const breakdown =
    result && appliedInput ? buildHousingScoreBreakdown(appliedInput, result) : [];
  const homelessWarnings = result ? buildHomelessIneligibleWarnings(result) : [];
  const subscriptionWarning = appliedInput
    ? buildSubscriptionNotRegisteredWarning(appliedInput)
    : null;

  const dateFieldMin = form.birthDate || MIN_BIRTH_DATE;
  const dateFieldMax = form.baseDate || maxBaseDateIso();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/tax" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">세금/정책</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">청약가점 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          무주택기간·부양가족수·청약통장 가입기간을 입력하면 민영주택 일반공급 가점제 예상
          점수와 항목별 계산 근거를 확인할 수 있습니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 space-y-8 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        {/* 기준일 */}
        <div>
          <label htmlFor={`${formId}-baseDate`} className={LABEL_CLASS}>
            기준일{" "}
            <span aria-hidden="true" className="text-red-600 dark:text-red-400">
              *
            </span>
          </label>
          <input
            id={`${formId}-baseDate`}
            type="date"
            min={form.birthDate || MIN_BIRTH_DATE}
            max={maxBaseDateIso()}
            value={form.baseDate}
            aria-required="true"
            aria-invalid={errorFor("baseDate") ? true : undefined}
            aria-describedby={combineDescribedBy(
              errorFor("baseDate") && `${formId}-baseDate-error`,
              `${formId}-baseDate-help`,
            )}
            onChange={(e) => update("baseDate", e.target.value)}
            className={FIELD_CLASS}
          />
          <p id={`${formId}-baseDate-help`} className={HELP_CLASS}>
            무주택기간·부양가족수·가입기간 세 항목 모두 이 날짜를 기준으로 계산합니다(실제
            제도의 &apos;입주자모집공고일&apos;에 해당). 기본값은 오늘입니다.
          </p>
          {errorFor("baseDate") && (
            <p id={`${formId}-baseDate-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("baseDate")}
            </p>
          )}
        </div>

        {/* ── 무주택기간 그룹 ──────────────────────────────────────────── */}
        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className="text-sm font-semibold">무주택기간 정보</legend>

          <div>
            <label htmlFor={`${formId}-birthDate`} className={LABEL_CLASS}>
              생년월일{" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                *
              </span>
            </label>
            <input
              id={`${formId}-birthDate`}
              type="date"
              min={MIN_BIRTH_DATE}
              max={form.baseDate || maxBaseDateIso()}
              value={form.birthDate}
              aria-required="true"
              aria-invalid={errorFor("birthDate") ? true : undefined}
              aria-describedby={combineDescribedBy(
                errorFor("birthDate") && `${formId}-birthDate-error`,
                `${formId}-birthDate-help`,
              )}
              onChange={(e) => update("birthDate", e.target.value)}
              className={FIELD_CLASS}
            />
            <p id={`${formId}-birthDate-help`} className={HELP_CLASS}>
              무주택기간은 원칙적으로 만 30세가 되는 날부터 계산이 시작됩니다.
            </p>
            {errorFor("birthDate") && (
              <p id={`${formId}-birthDate-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("birthDate")}
              </p>
            )}
          </div>

          <div>
            <span className={LABEL_CLASS}>혼인 여부</span>
            <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
              {([
                [false, "미혼"],
                [true, "혼인"],
              ] as const).map(([value, label]) => (
                <label
                  key={String(value)}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                    form.isMarried === value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-isMarried`}
                    className="sr-only"
                    checked={form.isMarried === value}
                    onChange={() => update("isMarried", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className={HELP_CLASS}>
              만 30세가 되기 전에 혼인했다면 혼인신고일부터 무주택기간을 계산합니다.
            </p>
          </div>

          {form.isMarried && (
            <div>
              <label htmlFor={`${formId}-marriageDate`} className={LABEL_CLASS}>
                혼인신고일{" "}
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  *
                </span>
              </label>
              <input
                id={`${formId}-marriageDate`}
                type="date"
                min={dateFieldMin}
                max={dateFieldMax}
                value={form.marriageDate ?? ""}
                aria-required="true"
                aria-invalid={errorFor("marriageDate") ? true : undefined}
                aria-describedby={combineDescribedBy(
                  errorFor("marriageDate") && `${formId}-marriageDate-error`,
                )}
                onChange={(e) => update("marriageDate", e.target.value)}
                className={FIELD_CLASS}
              />
              {errorFor("marriageDate") && (
                <p id={`${formId}-marriageDate-error`} role="alert" className={ERROR_CLASS}>
                  {errorFor("marriageDate")}
                </p>
              )}
            </div>
          )}

          <div>
            <span className={LABEL_CLASS}>
              주택 소유 이력{" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                *
              </span>
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.entries(HOUSING_STATUS_LABELS) as [HousingStatus, string][]).map(
                ([value, label]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                      form.housingStatus === value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${formId}-housingStatus`}
                      className="sr-only"
                      checked={form.housingStatus === value}
                      aria-invalid={errorFor("housingStatus") ? true : undefined}
                      aria-describedby={combineDescribedBy(
                        errorFor("housingStatus") && `${formId}-housingStatus-error`,
                        `${formId}-housingStatus-help`,
                      )}
                      onChange={() => update("housingStatus", value)}
                    />
                    {label}
                  </label>
                ),
              )}
            </div>
            <p id={`${formId}-housingStatus-help`} className={HELP_CLASS}>
              세대구성원 중 누구도 주택을 소유하고 있지 않으면 &apos;무주택 유지&apos;를
              선택하세요.
            </p>
            {errorFor("housingStatus") && (
              <p id={`${formId}-housingStatus-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("housingStatus")}
              </p>
            )}
          </div>

          {form.housingStatus === "disposed" && (
            <div>
              <label htmlFor={`${formId}-mostRecentDisposalDate`} className={LABEL_CLASS}>
                최근 처분일{" "}
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  *
                </span>
              </label>
              <input
                id={`${formId}-mostRecentDisposalDate`}
                type="date"
                min={dateFieldMin}
                max={dateFieldMax}
                value={form.mostRecentDisposalDate ?? ""}
                aria-required="true"
                aria-invalid={errorFor("mostRecentDisposalDate") ? true : undefined}
                aria-describedby={combineDescribedBy(
                  errorFor("mostRecentDisposalDate") && `${formId}-mostRecentDisposalDate-error`,
                  `${formId}-mostRecentDisposalDate-help`,
                )}
                onChange={(e) => update("mostRecentDisposalDate", e.target.value)}
                className={FIELD_CLASS}
              />
              <p id={`${formId}-mostRecentDisposalDate-help`} className={HELP_CLASS}>
                세대구성원 중 누구든 마지막으로 주택을 처분해 전원 무주택이 된 날입니다. 이
                날짜부터 무주택기간이 다시 계산됩니다.
              </p>
              {errorFor("mostRecentDisposalDate") && (
                <p
                  id={`${formId}-mostRecentDisposalDate-error`}
                  role="alert"
                  className={ERROR_CLASS}
                >
                  {errorFor("mostRecentDisposalDate")}
                </p>
              )}
            </div>
          )}

          {form.housingStatus === "currently_owns" && (
            <div className="rounded-xl border border-border bg-background p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.smallLowValueHomeException}
                  onChange={(e) => update("smallLowValueHomeException", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  소형·저가 주택 등 무주택 간주 특례 요건을 확인했습니다(전용 60㎡ 이하 +
                  공시가격 수도권 1억 6천만원/그 외 1억원 이하 등).
                </span>
              </label>
              <p className="mt-2 text-xs leading-5 text-muted">
                이 계산기는 이 체크와 무관하게 &apos;현재 소유 중&apos;이면 무주택기간을 0점으로
                계산합니다. 특례 해당 여부는 아래 &apos;정책 안내&apos;와 청약홈에서 직접
                확인하세요.
              </p>
            </div>
          )}
        </fieldset>

        {/* ── 부양가족 그룹 ────────────────────────────────────────────── */}
        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className="text-sm font-semibold">부양가족 정보</legend>

          <div>
            <span className={LABEL_CLASS}>배우자 부양가족 인정</span>
            <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
              {([
                [false, "아니요"],
                [true, "예"],
              ] as const).map(([value, label]) => (
                <label
                  key={String(value)}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                    !form.isMarried
                      ? "cursor-not-allowed border-border bg-background text-muted opacity-50"
                      : form.hasQualifyingSpouseInHousehold === value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-hasQualifyingSpouseInHousehold`}
                    className="sr-only"
                    disabled={!form.isMarried}
                    checked={form.hasQualifyingSpouseInHousehold === value}
                    onChange={() => update("hasQualifyingSpouseInHousehold", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className={HELP_CLASS}>
              {form.isMarried
                ? "배우자는 주민등록이 분리(세대 분리)되어 있어도 부양가족으로 인정됩니다. 혼인 " +
                  "상태라면 이 항목은 거의 항상 '예'이며, 아래 '계산 방법'에서 배우자를 부양가족 " +
                  "인원에 포함했는지 명확히 보여드리기 위해 혼인 여부와 별도로 확인합니다."
                : "혼인 상태가 아니면 배우자 부양가족을 인정할 수 없습니다."}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-qualifyingAscendantCount`} className={LABEL_CLASS}>
                인정되는 직계존속 수
              </label>
              <input
                id={`${formId}-qualifyingAscendantCount`}
                inputMode="numeric"
                value={form.qualifyingAscendantCount}
                aria-invalid={errorFor("qualifyingAscendantCount") ? true : undefined}
                aria-describedby={combineDescribedBy(
                  errorFor("qualifyingAscendantCount") &&
                    `${formId}-qualifyingAscendantCount-error`,
                  `${formId}-qualifyingAscendantCount-help`,
                )}
                onChange={(e) => {
                  // QA L-3: 숫자 이외의 문자(예: ".")가 섞여 있으면 그 입력 전체를 무시한다.
                  // 정규식으로 비숫자만 지우면 "1.5" → "15"처럼 사용자 모르게 값이 이어붙는다.
                  if (/^[0-9]*$/.test(e.target.value)) {
                    update("qualifyingAscendantCount", e.target.value);
                  }
                }}
                className={FIELD_CLASS}
              />
              <p id={`${formId}-qualifyingAscendantCount-help`} className={HELP_CLASS}>
                직계존속(부모님·조부모님 등, 배우자의 부모님·조부모님 포함)은 신청자보다
                윗세대인 가족을 말합니다. 그 중 신청자 또는 배우자와 3년 이상 계속 동일
                주민등록표에 등재되어 있고, 본인 소유 주택이 없는 사람 수를 입력하세요(상한{" "}
                {MAX_ASCENDANT_COUNT}명).
              </p>
              {errorFor("qualifyingAscendantCount") && (
                <p
                  id={`${formId}-qualifyingAscendantCount-error`}
                  role="alert"
                  className={ERROR_CLASS}
                >
                  {errorFor("qualifyingAscendantCount")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${formId}-qualifyingDescendantCount`} className={LABEL_CLASS}>
                인정되는 미혼 직계비속 수
              </label>
              <input
                id={`${formId}-qualifyingDescendantCount`}
                inputMode="numeric"
                value={form.qualifyingDescendantCount}
                aria-invalid={errorFor("qualifyingDescendantCount") ? true : undefined}
                aria-describedby={combineDescribedBy(
                  errorFor("qualifyingDescendantCount") &&
                    `${formId}-qualifyingDescendantCount-error`,
                  `${formId}-qualifyingDescendantCount-help`,
                )}
                onChange={(e) => {
                  // QA L-3: "1.5" 같은 소수 입력을 조용히 "15"로 이어붙이지 않도록, 숫자
                  // 이외의 문자가 섞이면 그 입력 전체를 무시한다.
                  if (/^[0-9]*$/.test(e.target.value)) {
                    update("qualifyingDescendantCount", e.target.value);
                  }
                }}
                className={FIELD_CLASS}
              />
              <p id={`${formId}-qualifyingDescendantCount-help`} className={HELP_CLASS}>
                직계비속(자녀·손자녀 등)은 신청자보다 아랫세대인 가족을 말합니다. 그 중 미혼
                자녀로서 만 30세 미만이거나, 만 30세 이상이면서 최근 1년 이상 계속 동일
                주민등록표에 등재된 사람 수를 입력하세요(상한 {MAX_DESCENDANT_COUNT}명).
              </p>
              {errorFor("qualifyingDescendantCount") && (
                <p
                  id={`${formId}-qualifyingDescendantCount-error`}
                  role="alert"
                  className={ERROR_CLASS}
                >
                  {errorFor("qualifyingDescendantCount")}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* ── 청약통장 그룹 ────────────────────────────────────────────── */}
        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className="text-sm font-semibold">청약통장 정보</legend>

          <div>
            <span className={LABEL_CLASS}>청약통장 보유 여부</span>
            <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
              {([
                [true, "보유"],
                [false, "미보유"],
              ] as const).map(([value, label]) => (
                <label
                  key={String(value)}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary ${
                    form.hasSubscriptionAccount === value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-hasSubscriptionAccount`}
                    className="sr-only"
                    checked={form.hasSubscriptionAccount === value}
                    onChange={() => update("hasSubscriptionAccount", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {form.hasSubscriptionAccount && (
            <div>
              <label htmlFor={`${formId}-subscriptionAccountOpenDate`} className={LABEL_CLASS}>
                청약통장 최초 가입일{" "}
                <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                  *
                </span>
              </label>
              <input
                id={`${formId}-subscriptionAccountOpenDate`}
                type="date"
                min={dateFieldMin}
                max={dateFieldMax}
                value={form.subscriptionAccountOpenDate ?? ""}
                aria-required="true"
                aria-invalid={errorFor("subscriptionAccountOpenDate") ? true : undefined}
                aria-describedby={combineDescribedBy(
                  errorFor("subscriptionAccountOpenDate") &&
                    `${formId}-subscriptionAccountOpenDate-error`,
                  `${formId}-subscriptionAccountOpenDate-help`,
                )}
                onChange={(e) => update("subscriptionAccountOpenDate", e.target.value)}
                className={FIELD_CLASS}
              />
              <p id={`${formId}-subscriptionAccountOpenDate-help`} className={HELP_CLASS}>
                통장을 전환하거나 예치금·명의를 변경했어도 최초 가입일(순위기산일) 그대로
                입력하세요.
              </p>
              {errorFor("subscriptionAccountOpenDate") && (
                <p
                  id={`${formId}-subscriptionAccountOpenDate-error`}
                  role="alert"
                  className={ERROR_CLASS}
                >
                  {errorFor("subscriptionAccountOpenDate")}
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            가점 계산하기
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
        title="청약가점 계산기"
        text={
          result
            ? `예상 청약가점은 ${result.totalScore}점입니다.`
            : "무주택기간·부양가족수·청약통장 가입기간으로 예상 청약가점을 계산해 보세요."
        }
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && (
          <>
            {/* 핵심 결과 카드 — 합산 총점 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                예상 청약가점 합계
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {result.totalScore}
                <span className="ml-2 text-xl font-semibold opacity-70">/ 84점</span>
              </p>
              <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                무주택기간 {result.homelessPeriodScore}점 + 부양가족수 {result.dependentScore}점 +
                가입기간 {result.subscriptionPeriodScore}점
              </p>
              <p className="mt-3 text-xs opacity-75 dark:text-muted dark:opacity-100">
                이 점수는 민영주택 일반공급 가점제 참고용 예상 점수이며, 청약 자격요건 최종
                판정이나 실제 당첨 여부를 의미하지 않습니다.
              </p>
            </section>

            {/* 항목별 카드 3개 + 경고(해당 항목 바로 아래) */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3">
                <ItemScoreCard
                  title="무주택기간"
                  score={result.homelessPeriodScore}
                  maxScore={HOUSING_SUBSCRIPTION_SCORE_POLICY.homelessPeriod.maxScore}
                  capped={result.homelessPeriodCapped}
                  detail={
                    result.homelessEligible
                      ? `${result.homelessPeriodYears}년 경과${
                          result.homelessStartDate
                            ? ` (기산일 ${formatKoreanDate(result.homelessStartDate)})`
                            : ""
                        }`
                      : "산정 미시작 또는 무주택 요건 미충족"
                  }
                />
                {homelessWarnings.map((warning) => (
                  <WarningCard key={warning} title="무주택기간 확인 필요" body={warning} />
                ))}
              </div>

              <div className="space-y-3">
                <ItemScoreCard
                  title="부양가족수"
                  score={result.dependentScore}
                  maxScore={HOUSING_SUBSCRIPTION_SCORE_POLICY.dependentCount.maxScore}
                  capped={result.dependentCountCapped}
                  detail={`인정 부양가족 ${result.dependentCount}명`}
                />
              </div>

              <div className="space-y-3">
                <ItemScoreCard
                  title="청약통장 가입기간"
                  score={result.subscriptionPeriodScore}
                  maxScore={HOUSING_SUBSCRIPTION_SCORE_POLICY.subscriptionPeriod.maxScore}
                  capped={result.subscriptionPeriodCapped}
                  detail={
                    appliedInput.hasSubscriptionAccount
                      ? `${result.subscriptionPeriodYears}년 ${result.subscriptionPeriodMonths % 12}개월(총 ${result.subscriptionPeriodMonths}개월)`
                      : "청약통장 미가입"
                  }
                />
                {subscriptionWarning && (
                  <WarningCard title="청약통장 가입기간 확인 필요" body={subscriptionWarning} />
                )}
              </div>
            </div>

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
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
            </SectionCard>

            <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">기준일</dt>
                  <dd>{formatKoreanDate(appliedInput.baseDate)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">생년월일</dt>
                  <dd>{formatKoreanDate(appliedInput.birthDate)}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">혼인 여부</dt>
                  <dd>
                    {appliedInput.isMarried
                      ? `혼인 (${appliedInput.marriageDate ? formatKoreanDate(appliedInput.marriageDate) : "-"})`
                      : "미혼"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">주택 소유 이력</dt>
                  <dd>{HOUSING_STATUS_LABELS[appliedInput.housingStatus]}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">인정 부양가족</dt>
                  <dd>{result.dependentCount}명</dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt className="text-muted">청약통장</dt>
                  <dd>
                    {appliedInput.hasSubscriptionAccount
                      ? `보유 (최초 가입일 ${appliedInput.subscriptionAccountOpenDate ? formatKoreanDate(appliedInput.subscriptionAccountOpenDate) : "-"})`
                      : "미보유"}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            {/* ── 정책 안내 ──────────────────────────────────────────── */}
            <SectionCard title="정책 안내" icon={<SectionIcon name="info" />}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-surface-subtle px-3 py-1 font-medium">
                  {HOUSING_SUBSCRIPTION_SCORE_POLICY.law}
                </span>
                <span className="rounded-full bg-surface-subtle px-3 py-1">
                  {HOUSING_SUBSCRIPTION_SCORE_POLICY.regulationVersion}
                </span>
                <span className="rounded-full bg-surface-subtle px-3 py-1">
                  기준 확인일 {HOUSING_SUBSCRIPTION_SCORE_POLICY.lastVerified}
                </span>
                <span className="rounded-full bg-surface-subtle px-3 py-1">
                  다음 재검토 {HOUSING_SUBSCRIPTION_SCORE_POLICY.nextReviewDue}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
                <p>
                  이 점수는 <strong className="text-foreground">민영주택 일반공급 가점제</strong>
                  에서만 적용되며, 특별공급(신혼부부·다자녀가구·노부모부양·생애최초 등)·추첨제·
                  공공/민영 임대주택에는 적용되지 않습니다.
                </p>
                <p>
                  이 계산기는 세 가지 가점 항목의 점수만 계산하며, 세대주 여부·지역 우선공급
                  거주기간·재당첨 제한·부적격 사유 등 청약 자격요건 자체를 판정하지 않습니다.
                  실제 당첨 여부는 해당 주택형·지역의 공급 물량, 경쟁률, 가점 커트라인에 따라
                  달라지며 이 계산기가 이를 예측하지 않습니다.
                </p>
                <p>입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.</p>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="space-y-4 rounded-2xl border border-warning-border bg-warning-surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-4.5 w-4.5"
                      >
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01" />
                      </svg>
                    </span>
                    <p className="text-sm font-semibold">
                      이 계산기가 반영하지 못하는 정책 특례 3가지 (항상 안내 — 실제 점수와 다를 수
                      있습니다)
                    </p>
                  </div>
                  {housingScorePolicyExceptionNotices.map((notice) => (
                    <div key={notice.title} className="text-sm leading-6">
                      <p className="font-semibold">{notice.title}</p>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{notice.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="무주택기간·부양가족수·청약통장 가입기간 정보를 입력하면 자동으로 계산합니다."
          steps={HOUSING_SCORE_USAGE_STEPS}
        />
        <IntroSection title="청약가점제란 무엇인가요?" paragraphs={HOUSING_SCORE_INTRO_PARAGRAPHS} />
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={housingSubscriptionScoreFaqItems} />
      </div>
    </div>
  );
}
