"use client";

/**
 * 기초대사량(BMR) 계산기 — 입력/결과 UI.
 *
 * tasks/bmr-calculator/ARCHITECTURE.md "7.", "9.", "10."이 정한 구조를 그대로 구현한다.
 * docs/DESIGN_SYSTEM.md 공통 화면 순서(입력 → 결과 → 계산 근거 → 소개·사용 방법 → 정책
 * 안내 → FAQ)를 따른다.
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
 *
 * 활동량 선택 컨트롤은 네이티브 select가 아니라 카드형 라디오(6옵션: 선택 안 함 + 5단계)다
 * (ARCHITECTURE.md "7.2").
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
  BMR_INTRO_HIGHLIGHTS,
  BMR_INTRO_PARAGRAPHS,
  BMR_POLICY_DISCLAIMER_SUMMARY,
  BMR_RESULT_APPROX_CAPTION,
  BMR_RESULT_DISCLAIMERS,
  BMR_USAGE_STEPS,
  bmrFaqItems,
} from "./content";
import {
  ACTIVITY_LEVEL_OPTIONS,
  activityLevelLabel,
  buildBmrAlternativeBreakdown,
  buildBmrBreakdown,
  buildTdeeBreakdown,
  formatAge,
  formatHeight,
  formatKcal,
  formatWeight,
} from "./formatting";
import { calculateAllTdeeLevels, calculateBmrCalculation, isValidActivityLevel } from "./logic";
import type { ActivityLevel, BmrCalculationResult, Sex } from "./types";
import { validateBmrInput, type FormError, type RawBmrFormInput } from "./validation";

const EMPTY_FORM: RawBmrFormInput = {
  sex: "",
  ageYears: "",
  heightCm: "",
  weightKg: "",
  activityLevel: null,
};

/**
 * FORMULA.md 검증 예제 3(Male 45/180cm/85kg, 활동량=보통 활동)을 그대로 샘플로 쓴다
 * (docs/DESIGN_SYSTEM.md "Reset / Sample" — 이 값을 넣으면 BMR raw 1755.0 → 표시 1755,
 * TDEE raw 2720.25 → 표시 2720이 나와야 한다는 것이 샘플 자체로 검증된다).
 */
const SAMPLE_FORM: RawBmrFormInput = {
  sex: "male",
  ageYears: "45",
  heightCm: "180",
  weightKg: "85",
  activityLevel: 3,
};

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
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

export default function BmrCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawBmrFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormError[]>([]);
  const [result, setResult] = useState<BmrCalculationResult | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    // SPEC.md Must Have "공유 URL 복원 시 동일한 검증을 통과한 경우에만 자동 계산한다" —
    // activityLevel은 디코딩된 값이 1~5 중 하나가 아니면 즉시 null로 치환한다
    // (ARCHITECTURE.md "6.1" 1번, 정상 폼 제출 경로가 아니라 공유 URL 복원 경로에서만
    // 발생할 수 있는 방어).
    const candidate: RawBmrFormInput = {
      sex: saved.sex === "male" || saved.sex === "female" ? saved.sex : "",
      ageYears: String(saved.ageYears ?? ""),
      heightCm: String(saved.heightCm ?? ""),
      weightKg: String(saved.weightKg ?? ""),
      activityLevel: isValidActivityLevel(saved.activityLevel) ? saved.activityLevel : null,
    };
    const checked = validateBmrInput(candidate);
    if (!checked.success) return;
    setForm(candidate);
    setErrors([]);
    setResult(calculateBmrCalculation(checked.data));
  });

  function errorFor(field: FormError["field"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function updateText(field: "ageYears" | "heightCm" | "weightKg") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null);
    };
  }

  function updateSex(sex: Sex) {
    setForm((prev) => ({ ...prev, sex }));
    setResult(null);
  }

  function updateActivityLevel(activityLevel: ActivityLevel | null) {
    setForm((prev) => ({ ...prev, activityLevel }));
    setResult(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateBmrInput(form);
    if (!checked.success) {
      setErrors(checked.errors);
      setResult(null);
      return;
    }
    setErrors([]);
    setResult(calculateBmrCalculation(checked.data));
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

  const shareText = (() => {
    if (!result) {
      return "성별·나이·키·체중으로 기초대사량(BMR)과 하루 총 소비 칼로리(TDEE)를 계산해 보세요.";
    }
    if (result.tdee) {
      return `기초대사량은 ${formatKcal(result.bmr.display)}, 활동량을 반영한 하루 총 소비 칼로리(TDEE)는 ${formatKcal(result.tdee.display)}입니다.`;
    }
    return `기초대사량은 ${formatKcal(result.bmr.display)}입니다.`;
  })();

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/health" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">
          건강
        </Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">기초대사량(BMR) 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          성별·나이·키·체중으로 하루 최소 에너지 소비량(기초대사량, BMR)을 계산하고, 활동량을
          선택하면 활동을 반영한 하루 총 소비 칼로리(TDEE)까지 함께 계산합니다.
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
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">필수 4개</span>
        </div>

        <fieldset>
          <legend className={LABEL_CLASS}>
            성별
            <RequiredMark />
          </legend>
          <p className={HELP_CLASS}>
            성 정체성을 판정하지 않습니다 — 계산 공식의 성별 상수를 선택하는 데에만 사용됩니다.
          </p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-2">
            {([["male", "남성"], ["female", "여성"]] as [Sex, string][]).map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                  form.sex === value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                <input
                  type="radio"
                  name={`${formId}-sex`}
                  className="sr-only"
                  checked={form.sex === value}
                  aria-required="true"
                  onChange={() => updateSex(value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errorFor("sex") && (
            <p role="alert" className={ERROR_CLASS}>
              {errorFor("sex")}
            </p>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor={`${formId}-ageYears`} className={LABEL_CLASS}>
              나이
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(만 나이, 세)</span>
            </label>
            <input
              id={`${formId}-ageYears`}
              inputMode="numeric"
              value={form.ageYears}
              onChange={updateText("ageYears")}
              placeholder="예: 30"
              aria-required="true"
              aria-invalid={errorFor("ageYears") ? true : undefined}
              aria-describedby={`${formId}-ageYears-help${errorFor("ageYears") ? ` ${formId}-ageYears-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-ageYears-help`} className={HELP_CLASS}>
              만 나이를 정수로 입력하세요(19~78세만 계산 가능합니다).
            </p>
            {errorFor("ageYears") && (
              <p id={`${formId}-ageYears-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("ageYears")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-heightCm`} className={LABEL_CLASS}>
              키
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(cm)</span>
            </label>
            <input
              id={`${formId}-heightCm`}
              inputMode="decimal"
              value={form.heightCm}
              onChange={updateText("heightCm")}
              placeholder="예: 175"
              aria-required="true"
              aria-invalid={errorFor("heightCm") ? true : undefined}
              aria-describedby={`${formId}-heightCm-help${errorFor("heightCm") ? ` ${formId}-heightCm-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-heightCm-help`} className={HELP_CLASS}>
              소수 첫째 자리까지 입력할 수 있습니다(100.0~230.0cm).
            </p>
            {errorFor("heightCm") && (
              <p id={`${formId}-heightCm-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("heightCm")}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-weightKg`} className={LABEL_CLASS}>
              체중
              <RequiredMark />
              <span className="ml-1 text-xs font-normal text-muted">(kg)</span>
            </label>
            <input
              id={`${formId}-weightKg`}
              inputMode="decimal"
              value={form.weightKg}
              onChange={updateText("weightKg")}
              placeholder="예: 70"
              aria-required="true"
              aria-invalid={errorFor("weightKg") ? true : undefined}
              aria-describedby={`${formId}-weightKg-help${errorFor("weightKg") ? ` ${formId}-weightKg-error` : ""}`}
              className={INPUT_CLASS}
            />
            <p id={`${formId}-weightKg-help`} className={HELP_CLASS}>
              소수 첫째 자리까지 입력할 수 있습니다(20.0~300.0kg).
            </p>
            {errorFor("weightKg") && (
              <p id={`${formId}-weightKg-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("weightKg")}
              </p>
            )}
          </div>
        </div>

        {/* 활동량 — 카드형 라디오(6옵션: 선택 안 함 + 5단계), 네이티브 select 아님
            (ARCHITECTURE.md "7.2"). */}
        <fieldset className="border-t border-border pt-6">
          <legend className={LABEL_CLASS}>
            활동량 <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
          </legend>
          <p className={HELP_CLASS}>
            평소 운동·활동 습관과 가장 비슷한 설명을 하나 선택하면 TDEE(하루 총 소비 칼로리)가
            함께 계산됩니다. 선택하지 않아도 BMR 결과는 그대로 계산됩니다.
          </p>
          <div className="mt-3 space-y-2">
            {ACTIVITY_LEVEL_OPTIONS.map((option, index) => {
              const isSelected = form.activityLevel === option.value;
              const isNoneOption = index === 0;
              return (
                <label
                  key={option.title}
                  className={`block cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                    isSelected
                      ? "border-primary bg-primary-soft"
                      : isNoneOption
                        ? "border-dashed border-border bg-surface-subtle"
                        : "border-border bg-background"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-activityLevel`}
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => updateActivityLevel(option.value)}
                  />
                  <span
                    className={`block font-semibold ${
                      isSelected ? "text-primary" : isNoneOption ? "text-muted" : "text-foreground"
                    }`}
                  >
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{option.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            BMR 계산하기
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
        title="기초대사량(BMR) 계산기"
        text={shareText}
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && (
          <>
            {/* 핵심 결과 카드 — BMR은 활동량 선택 여부와 무관하게 항상 1차 카드다. */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                기초대사량(BMR) — 아무 활동을 하지 않아도 쓰는 하루 최소 에너지
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatKcal(result.bmr.display)}
              </p>
              <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                {result.input.sex === "male" ? "남성" : "여성"} · {formatAge(result.input.ageYears)} ·{" "}
                {formatHeight(result.input.heightCm)} · {formatWeight(result.input.weightKg)} 기준입니다.
              </p>
              <p className="mt-1 text-sm opacity-90 dark:text-muted dark:opacity-100">
                {BMR_RESULT_APPROX_CAPTION}
              </p>
            </section>

            {/* TDEE 보조 카드 — 활동량을 선택했을 때만, BMR보다 덜 강조된 스타일로 표시한다
                (ARCHITECTURE.md "7.3" — TDEE는 BMR의 대체가 아니라 확장). */}
            {result.tdee && (
              <section className="rounded-2xl border border-primary/30 bg-primary-soft p-6 sm:p-7">
                <h2 className="text-sm font-semibold text-primary">
                  TDEE — 활동을 반영한 하루 총 소비 칼로리
                </h2>
                <p className="mt-2 text-3xl font-bold tracking-[-0.03em] tabular-nums text-foreground sm:text-4xl">
                  {formatKcal(result.tdee.display)}
                </p>
                <p className="mt-3 text-sm text-muted">
                  선택한 활동량: {activityLevelLabel(result.tdee.activityLevel)}
                </p>
                <p className="mt-1 text-sm text-muted">{BMR_RESULT_APPROX_CAPTION}</p>
              </section>
            )}

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted">성별</dt>
                  <dd className="text-sm font-medium">{result.input.sex === "male" ? "남성" : "여성"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">나이</dt>
                  <dd className="text-sm font-medium">{formatAge(result.input.ageYears)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">키</dt>
                  <dd className="text-sm font-medium">{formatHeight(result.input.heightCm)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">체중</dt>
                  <dd className="text-sm font-medium">{formatWeight(result.input.weightKg)}</dd>
                </div>
              </dl>
              {result.tdee && (
                <p className="mt-4 text-sm text-muted">
                  적용된 활동량: <span className="font-medium text-foreground">{activityLevelLabel(result.tdee.activityLevel)}</span>
                </p>
              )}
            </SectionCard>

            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                <li className="text-sm">
                  <p className="font-medium">1. 기초대사량(BMR) — Mifflin-St Jeor 공식</p>
                  <p className="mt-0.5 text-xs text-muted">
                    출처: Mifflin MD et al. Am J Clin Nutr. 1990;51(2):241-247.
                  </p>
                  <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {buildBmrBreakdown(result.input, result.bmr)}
                  </p>
                </li>
                {result.tdee && (
                  <li className="text-sm">
                    <p className="font-medium">2. TDEE — 활동계수 적용</p>
                    <p className="mt-0.5 text-xs text-muted">
                      반올림 전 완전정밀도 BMR에 활동계수를 곱한 뒤 별도로 반올림합니다(중복
                      반올림에 따른 오차 누적 방지).
                    </p>
                    <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {buildTdeeBreakdown(result.bmr, result.tdee)}
                    </p>
                  </li>
                )}
                <li className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-muted">
                    <span>
                      {result.tdee ? "3." : "2."} 보조 공식 참고값 — Harris-Benedict 개정판
                    </span>
                    <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-muted">
                      참고용
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    출처: Roza AM, Shizgal HM. Am J Clin Nutr. 1984;40(1):168-182. 대표 공식과
                    독립적으로 계산한 참고값이며, 결과 판정에는 쓰이지 않습니다.
                  </p>
                  <p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {buildBmrAlternativeBreakdown(result.input, result.bmrAlternative)}
                  </p>
                </li>
              </ol>
            </SectionCard>

            {/* (Should Have) 활동계수 5단계 전체 비교표 — 선택한 활동량이 있을 때만. */}
            {result.tdee && (
              <SectionCard title="활동량 단계별 TDEE 비교" icon={<SectionIcon name="chart" />} description="현재 선택한 단계 외 다른 활동량을 선택하면 TDEE가 어떻게 달라지는지 참고할 수 있습니다.">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        <th className="py-2 font-medium">활동량</th>
                        <th className="py-2 font-medium">TDEE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculateAllTdeeLevels(result.bmr.raw).map((row) => {
                        const isCurrent = row.activityLevel === result.tdee?.activityLevel;
                        return (
                          <tr
                            key={row.activityLevel}
                            className={`border-b border-border/70 last:border-0 ${isCurrent ? "bg-primary-soft text-primary" : ""}`}
                          >
                            <td className="px-2 py-2.5 font-semibold">{activityLevelLabel(row.activityLevel)}</td>
                            <td className="px-2 py-2.5 font-semibold tabular-nums">
                              {formatKcal(row.display)}
                              {isCurrent && <span className="ml-2 text-xs font-normal">(현재 선택)</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            <SectionCard title="꼭 확인하세요" icon={<SectionIcon name="info" />}>
              <ul className="space-y-2 text-sm leading-6 text-muted">
                {BMR_RESULT_DISCLAIMERS.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide description="성별·나이·키·체중만 입력하면 자동으로 BMR을 계산합니다." steps={BMR_USAGE_STEPS} />
        <IntroSection
          title="기초대사량(BMR)과 TDEE란 무엇인가요?"
          paragraphs={BMR_INTRO_PARAGRAPHS}
          highlights={BMR_INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── 정책 안내(계산 전제) ───────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-surface px-3 py-1 font-medium text-foreground">
            대표 공식: Mifflin-St Jeor(1990)
          </span>
          <span className="rounded-full bg-surface px-3 py-1 font-medium text-foreground">
            데이터 마지막 검토일 2026-09-13
          </span>
        </p>
        <p>{BMR_POLICY_DISCLAIMER_SUMMARY}</p>
        <p>입력값은 브라우저에서만 계산하며, 서버로 전송하거나 저장하지 않습니다.</p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={bmrFaqItems} />
      </div>
    </div>
  );
}
