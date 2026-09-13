"use client";

/**
 * 디데이 계산기 — 입력/결과 UI.
 *
 * tasks/d-day-calculator/ARCHITECTURE.md "10. Builder 인수인계 요약" 7번을 그대로 구현한다.
 * 계산 공식은 이 파일에 두지 않는다(logic.ts) — 이 파일은 폼 상태 관리와 표시만 담당한다
 * (docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 *
 * 모드 A(디데이 계산)와 모드 B(날짜 계산)는 완전히 독립된 `useState` 3종 세트로 관리한다
 * (ARCHITECTURE.md "3.2") — `activeMode`를 바꾸는 탭 클릭은 어느 입력·결과 블록을 보여줄지만
 * 바꾸고, 보이지 않는 모드의 상태는 절대 초기화하지 않는다. 탭 UI는 `business-days/ui.tsx`가
 * 이미 쓴 "스타일 입힌 라디오" 패턴(`role="tablist"` 대신 `<input type="radio"
 * className="sr-only">` + 스타일 입힌 `<label>`)을 그대로 재사용한다(ARCHITECTURE.md "3.3").
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
  D_DAY_ASSUMPTION_NOTICES,
  D_DAY_INTRO_PARAGRAPHS,
  D_DAY_USAGE_STEPS,
  dDayCalculatorFaqItems,
} from "./content";
import {
  buildDateShiftBreakdown,
  buildDdayBreakdown,
  formatDateShiftSentence,
  formatDateShiftSummary,
  formatDdaySentence,
  formatDdaySummary,
  formatKoreanDate,
  formatKoreanDateWithWeekday,
  formatWeeksBreakdown,
  isToday,
} from "./formatting";
import { calculateDateShift, calculateDday } from "./logic";
import type {
  DateShiftCalculationInput,
  DateShiftCalculationResult,
  DdayCalculationInput,
  DdayCalculationResult,
  DdayCalculatorMode,
  DdayCalculatorShareState,
} from "./types";
import {
  MAX_SUPPORTED_DATE,
  MIN_SUPPORTED_DATE,
  parseDdayCalculatorShareState,
  validateDateShiftInput,
  validateDdayInput,
  type RawDateShiftInput,
  type RawDdayInput,
} from "./validation";

/** military-discharge-date/ui.tsx와 동일한 패턴 — Asia/Seoul 기준 오늘 날짜(ARCHITECTURE.md "1.6"). */
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

/**
 * 다가오는 크리스마스(12월 25일) — 이미 지났으면 내년으로. SPEC.md/FORMULA.md 예시
 * (2026-09-12 → 2026-12-25)와 같은 성격의, 언제 실행해도 항상 유효한(오늘보다 미래인)
 * 모드 A 샘플 목표일이다.
 */
function nextChristmasIso(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  const thisYearChristmas = `${year}-12-25`;
  return todayIso <= thisYearChristmas ? thisYearChristmas : `${year + 1}-12-25`;
}

function SectionIcon({ name }: { name: "formula" | "document" | "info" }) {
  const paths = {
    formula: <path d="M5 5h6L7 12l4 7H5m10-9h5m-2.5-2.5v5" />,
    document: <path d="M6 3h9l3 3v15H6zM9 11h6m-6 4h6" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

/**
 * "오늘" 배지 — `military-discharge-date`가 이미 쓰는 패턴(작은 `<span>`)을 그대로 재사용한다
 * (SPEC.md "시작일이 오늘이면 `오늘` 배지를 표시하고, 오늘이 아니면 실제 날짜를 그대로 노출").
 */
function TodayBadge() {
  return (
    <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
      오늘
    </span>
  );
}

/**
 * 모드 B "방향"(더하기/빼기) 라디오 토글의 선택 상태를 색상 외 수단으로도 표시하는 체크마크
 * 아이콘(SPEC.md Must Have "접근성·반응형" — 방향 토글은 색상만으로 선택 상태를 구분하지
 * 않는다). 새 디자인 언어를 만들지 않고 이 파일의 `SectionIcon`과 동일한 인라인 SVG 관례
 * (`docs/DESIGN_SYSTEM.md` "아이콘" — viewBox 24, `stroke="currentColor"`)를 그대로 따른다.
 * 선택된 라디오 옆에만 렌더링되고, 실제 선택 상태는 이미 네이티브 `<input type="radio"
 * checked>`가 스크린리더에 전달하므로 `aria-hidden`으로 숨긴다.
 */
function SelectedCheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

const FIELD_CLASS =
  "min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";
const TODAY_BUTTON_CLASS =
  "shrink-0 rounded-xl border border-border px-3 text-xs font-semibold text-muted transition hover:border-border-strong hover:bg-surface-subtle";

export default function DdayCalculatorUi() {
  const formId = useId();
  const [today] = useState(todayInKorea);

  const [activeMode, setActiveMode] = useState<DdayCalculatorMode>("dday");

  // ── 모드 A: 디데이 계산 ────────────────────────────────────────────
  const [ddayForm, setDdayForm] = useState<RawDdayInput>({ startDate: today, targetDate: "" });
  const [ddayErrors, setDdayErrors] = useState<Record<string, string>>({});
  const [ddayResult, setDdayResult] = useState<DdayCalculationResult | null>(null);
  const [ddayAppliedInput, setDdayAppliedInput] = useState<DdayCalculationInput | null>(null);

  // ── 모드 B: 날짜 계산(더하기/빼기) ──────────────────────────────────
  const [shiftForm, setShiftForm] = useState<RawDateShiftInput>({
    baseDate: today,
    days: "",
    direction: "add",
  });
  const [shiftErrors, setShiftErrors] = useState<Record<string, string>>({});
  const [shiftResult, setShiftResult] = useState<DateShiftCalculationResult | null>(null);
  const [shiftAppliedInput, setShiftAppliedInput] = useState<DateShiftCalculationInput | null>(
    null,
  );

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    if (!root) return;
    const parsed = parseDdayCalculatorShareState(root);
    if (!parsed) return;

    if (parsed.mode === "dday") {
      try {
        const result = calculateDday({
          startDate: parsed.startDate,
          targetDate: parsed.targetDate,
        });
        setActiveMode("dday");
        setDdayForm({ startDate: parsed.startDate, targetDate: parsed.targetDate });
        setDdayErrors({});
        setDdayAppliedInput({ startDate: parsed.startDate, targetDate: parsed.targetDate });
        setDdayResult(result);
      } catch {
        // 손상된 공유 링크 — 복원하지 않는다.
      }
      return;
    }

    try {
      const result = calculateDateShift({
        baseDate: parsed.baseDate,
        days: parsed.days,
        direction: parsed.direction,
      });
      setActiveMode("dateShift");
      setShiftForm({
        baseDate: parsed.baseDate,
        days: String(parsed.days),
        direction: parsed.direction,
      });
      setShiftErrors({});
      setShiftAppliedInput({
        baseDate: parsed.baseDate,
        days: parsed.days,
        direction: parsed.direction,
      });
      setShiftResult(result);
    } catch {
      // 손상된 공유 링크 — 복원하지 않는다.
    }
  });

  // ── 모드 A 핸들러 ────────────────────────────────────────────────
  function handleDdayFieldChange(field: keyof RawDdayInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setDdayForm((previous) => ({ ...previous, [field]: event.target.value }));
      setDdayResult(null);
      setDdayAppliedInput(null);
    };
  }

  function handleDdayStartToToday() {
    setDdayForm((previous) => ({ ...previous, startDate: today }));
    setDdayResult(null);
    setDdayAppliedInput(null);
  }

  function handleDdaySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateDdayInput(ddayForm);
    if (!validation.success) {
      setDdayErrors(Object.fromEntries(validation.errors.map((error) => [error.field, error.message])));
      setDdayResult(null);
      setDdayAppliedInput(null);
      return;
    }
    setDdayErrors({});
    try {
      const result = calculateDday(validation.data);
      setDdayAppliedInput(validation.data);
      setDdayResult(result);
    } catch (error) {
      setDdayErrors({
        targetDate: error instanceof Error ? error.message : "계산할 수 없습니다.",
      });
      setDdayResult(null);
      setDdayAppliedInput(null);
    }
  }

  function handleDdayReset() {
    setDdayForm({ startDate: today, targetDate: "" });
    setDdayErrors({});
    setDdayResult(null);
    setDdayAppliedInput(null);
  }

  function handleDdaySample() {
    setDdayForm({ startDate: today, targetDate: nextChristmasIso(today) });
    setDdayErrors({});
    setDdayResult(null);
    setDdayAppliedInput(null);
  }

  // ── 모드 B 핸들러 ────────────────────────────────────────────────
  function handleShiftBaseDateChange(event: React.ChangeEvent<HTMLInputElement>) {
    setShiftForm((previous) => ({ ...previous, baseDate: event.target.value }));
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  function handleShiftBaseToToday() {
    setShiftForm((previous) => ({ ...previous, baseDate: today }));
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  function handleShiftDaysChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = event.target.value.replace(/\D/g, "");
    setShiftForm((previous) => ({ ...previous, days: digitsOnly }));
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  function handleShiftDirectionChange(direction: DateShiftCalculationInput["direction"]) {
    setShiftForm((previous) => ({ ...previous, direction }));
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  function handleShiftSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateDateShiftInput(shiftForm);
    if (!validation.success) {
      setShiftErrors(
        Object.fromEntries(validation.errors.map((error) => [error.field, error.message])),
      );
      setShiftResult(null);
      setShiftAppliedInput(null);
      return;
    }
    setShiftErrors({});
    try {
      const result = calculateDateShift(validation.data);
      setShiftAppliedInput(validation.data);
      setShiftResult(result);
    } catch (error) {
      setShiftErrors({
        days: error instanceof Error ? error.message : "계산할 수 없습니다.",
      });
      setShiftResult(null);
      setShiftAppliedInput(null);
    }
  }

  function handleShiftReset() {
    setShiftForm({ baseDate: today, days: "", direction: "add" });
    setShiftErrors({});
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  function handleShiftSample() {
    // SPEC.md "모드 B 샘플은 '기준일부터 +100일'을 그대로 반영해 '오늘부터 100일 뒤'를
    // 기본 예시로 채운다."
    setShiftForm({ baseDate: today, days: "100", direction: "add" });
    setShiftErrors({});
    setShiftResult(null);
    setShiftAppliedInput(null);
  }

  // ── 공유(ShareActions) ───────────────────────────────────────────
  const shareState: DdayCalculatorShareState | null =
    activeMode === "dday"
      ? ddayAppliedInput
        ? { mode: "dday", ...ddayAppliedInput }
        : null
      : shiftAppliedInput
        ? { mode: "dateShift", ...shiftAppliedInput }
        : null;

  const hasActiveResult = activeMode === "dday" ? ddayResult !== null : shiftResult !== null;

  const shareText =
    activeMode === "dday"
      ? ddayResult
        ? formatDdaySummary(ddayResult)
        : "시작일부터 목표일까지 D-Day를 계산해 보세요."
      : shiftResult
        ? formatDateShiftSummary(shiftResult)
        : "기준일에 며칠을 더하거나 빼서 날짜를 계산해 보세요.";

  // 모드 B Should Have — "오늘 기준" D-Day 배지(모드 A/B가 역함수 관계라는 점을 자연스럽게
  // 연결한다, SPEC.md Should Have). resultDate가 지원 범위 안이면 항상 계산 가능하다.
  let shiftResultTodayDday: DdayCalculationResult | null = null;
  if (shiftResult) {
    try {
      shiftResultTodayDday = calculateDday({ startDate: today, targetDate: shiftResult.resultDate });
    } catch {
      shiftResultTodayDday = null;
    }
  }

  const ddayBreakdown = ddayResult ? buildDdayBreakdown(ddayResult) : [];
  const shiftBreakdown = shiftResult ? buildDateShiftBreakdown(shiftResult) : [];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/date" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">날짜</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">디데이 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          시작일부터 목표일까지 남은(또는 지난) 날짜를 D-Day로 계산하거나, 기준일에 며칠을
          더하거나 빼서 정확한 날짜와 요일을 계산합니다.
        </p>
      </header>

      {/* ── 모드 선택(SPEC.md "핵심 사용자 흐름" — 탭/세그먼트 토글) ───────────── */}
      <fieldset className="mt-8">
        <legend className="text-sm font-semibold">계산 모드</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              ["dday", "디데이 계산"],
              ["dateShift", "날짜 계산"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                activeMode === value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-background text-muted hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="d-day-mode"
                value={value}
                checked={activeMode === value}
                onChange={() => setActiveMode(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {activeMode === "dday"
            ? "시작일부터 목표일까지 며칠 남았는지(또는 지났는지) D-Day로 계산합니다."
            : "기준일에 원하는 일수를 더하거나 빼서 정확한 날짜와 요일을 계산합니다."}
        </p>
      </fieldset>

      {/* ── 모드 A: 입력 ──────────────────────────────────────────── */}
      {activeMode === "dday" && (
        <form
          onSubmit={handleDdaySubmit}
          noValidate
          className="mt-6 space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-startDate`} className={LABEL_CLASS}>
                시작일 <span className="text-danger">*</span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={`${formId}-startDate`}
                  type="date"
                  min={MIN_SUPPORTED_DATE}
                  max={MAX_SUPPORTED_DATE}
                  value={ddayForm.startDate}
                  aria-required="true"
                  aria-invalid={ddayErrors.startDate ? true : undefined}
                  aria-describedby={
                    ddayErrors.startDate
                      ? `${formId}-startDate-error`
                      : `${formId}-startDate-help`
                  }
                  onChange={handleDdayFieldChange("startDate")}
                  className={FIELD_CLASS}
                />
                <button type="button" onClick={handleDdayStartToToday} className={TODAY_BUTTON_CLASS}>
                  오늘로
                </button>
              </div>
              <p id={`${formId}-startDate-help`} className={HELP_CLASS}>
                기본값은 오늘이며 과거·미래 날짜로 바꿀 수 있습니다.
              </p>
              {ddayErrors.startDate && (
                <p id={`${formId}-startDate-error`} role="alert" className={ERROR_CLASS}>
                  {ddayErrors.startDate}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={`${formId}-targetDate`} className={LABEL_CLASS}>
                목표일 <span className="text-danger">*</span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={`${formId}-targetDate`}
                  type="date"
                  min={MIN_SUPPORTED_DATE}
                  max={MAX_SUPPORTED_DATE}
                  value={ddayForm.targetDate}
                  aria-required="true"
                  aria-invalid={ddayErrors.targetDate ? true : undefined}
                  aria-describedby={
                    ddayErrors.targetDate
                      ? `${formId}-targetDate-error`
                      : `${formId}-targetDate-help`
                  }
                  onChange={handleDdayFieldChange("targetDate")}
                  className={FIELD_CLASS}
                />
              </div>
              <p id={`${formId}-targetDate-help`} className={HELP_CLASS}>
                기다리거나 기록하려는 날짜입니다. 시작일보다 과거여도 계산할 수 있습니다.
              </p>
              {ddayErrors.targetDate && (
                <p id={`${formId}-targetDate-error`} role="alert" className={ERROR_CLASS}>
                  {ddayErrors.targetDate}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
            >
              디데이 계산하기
            </button>
            <button
              type="button"
              onClick={handleDdayReset}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-border-strong hover:bg-surface-subtle"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleDdaySample}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:border-border-strong hover:bg-surface-subtle hover:text-foreground"
            >
              샘플 값 채우기
            </button>
          </div>
        </form>
      )}

      {/* ── 모드 B: 입력 ──────────────────────────────────────────── */}
      {activeMode === "dateShift" && (
        <form
          onSubmit={handleShiftSubmit}
          noValidate
          className="mt-6 space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
        >
          <div>
            <label htmlFor={`${formId}-baseDate`} className={LABEL_CLASS}>
              기준일 <span className="text-danger">*</span>
            </label>
            <div className="mt-2 flex max-w-md gap-2">
              <input
                id={`${formId}-baseDate`}
                type="date"
                min={MIN_SUPPORTED_DATE}
                max={MAX_SUPPORTED_DATE}
                value={shiftForm.baseDate}
                aria-required="true"
                aria-invalid={shiftErrors.baseDate ? true : undefined}
                aria-describedby={
                  shiftErrors.baseDate ? `${formId}-baseDate-error` : `${formId}-baseDate-help`
                }
                onChange={handleShiftBaseDateChange}
                className={FIELD_CLASS}
              />
              <button type="button" onClick={handleShiftBaseToToday} className={TODAY_BUTTON_CLASS}>
                오늘로
              </button>
            </div>
            <p id={`${formId}-baseDate-help`} className={HELP_CLASS}>
              기본값은 오늘이며 과거·미래 날짜로 바꿀 수 있습니다.
            </p>
            {shiftErrors.baseDate && (
              <p id={`${formId}-baseDate-error`} role="alert" className={ERROR_CLASS}>
                {shiftErrors.baseDate}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:max-w-md sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-days`} className={LABEL_CLASS}>
                일수 <span className="text-danger">*</span>
              </label>
              <input
                id={`${formId}-days`}
                inputMode="numeric"
                value={shiftForm.days}
                aria-required="true"
                aria-invalid={shiftErrors.days ? true : undefined}
                aria-describedby={shiftErrors.days ? `${formId}-days-error` : `${formId}-days-help`}
                onChange={handleShiftDaysChange}
                placeholder="예: 100"
                className={`mt-2 block w-full ${FIELD_CLASS}`}
              />
              <p id={`${formId}-days-help`} className={HELP_CLASS}>
                0 이상 100,000 이하의 정수만 입력할 수 있습니다.
              </p>
              {shiftErrors.days && (
                <p id={`${formId}-days-error`} role="alert" className={ERROR_CLASS}>
                  {shiftErrors.days}
                </p>
              )}
            </div>

            <fieldset>
              <legend className={LABEL_CLASS}>방향</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["add", "더하기"],
                    ["subtract", "빼기"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                      shiftForm.direction === value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-background text-muted hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shift-direction"
                      value={value}
                      checked={shiftForm.direction === value}
                      onChange={() => handleShiftDirectionChange(value)}
                      className="sr-only"
                    />
                    {shiftForm.direction === value && <SelectedCheckIcon />}
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
            >
              날짜 계산하기
            </button>
            <button
              type="button"
              onClick={handleShiftReset}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-border-strong hover:bg-surface-subtle"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleShiftSample}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:border-border-strong hover:bg-surface-subtle hover:text-foreground"
            >
              샘플 값 채우기
            </button>
          </div>
        </form>
      )}

      <ShareActions
        className="mt-5"
        title="디데이 계산기"
        text={shareText}
        url={baseUrl ? (shareState ? buildStateShareUrl(baseUrl, shareState) : baseUrl) : undefined}
        mode={hasActiveResult ? "result" : "calculator"}
        onKakaoShare={kakaoShareAdapter}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {activeMode === "dday" && ddayResult && ddayAppliedInput && (
          <>
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                디데이
              </h2>
              <p className="mt-2 break-words text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {ddayResult.ddayLabel}
              </p>
              <p className="mt-4 break-words text-base dark:text-foreground">
                {formatDdaySentence(ddayResult)}
              </p>
              {formatWeeksBreakdown(ddayResult.weeksBreakdown, ddayResult.diffDays) && (
                <p className="mt-2 break-words text-sm opacity-90 dark:text-foreground dark:opacity-100">
                  {formatWeeksBreakdown(ddayResult.weeksBreakdown, ddayResult.diffDays)}
                </p>
              )}
            </section>

            <SectionCard title="날짜 요약" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">시작일</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center break-words text-base font-semibold">
                    {formatKoreanDateWithWeekday(ddayAppliedInput.startDate, ddayResult.startWeekday)}
                    {isToday(ddayAppliedInput.startDate, today) && <TodayBadge />}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">목표일</dt>
                  <dd className="mt-0.5 break-words text-base font-semibold">
                    {formatKoreanDateWithWeekday(ddayAppliedInput.targetDate, ddayResult.targetWeekday)}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {ddayBreakdown.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 break-words tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </>
        )}

        {activeMode === "dateShift" && shiftResult && shiftAppliedInput && (
          <>
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                계산된 날짜
              </h2>
              <p className="mt-2 break-words text-3xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatKoreanDateWithWeekday(shiftResult.resultDate, shiftResult.resultWeekday)}
              </p>
              <p className="mt-4 break-words text-base dark:text-foreground">
                {formatDateShiftSentence(shiftResult)}
              </p>
              {shiftResultTodayDday && (
                <p className="mt-2 break-words text-sm opacity-90 dark:text-foreground dark:opacity-100">
                  오늘 기준 {shiftResultTodayDday.ddayLabel} · {formatDdaySentence(shiftResultTodayDday)}
                </p>
              )}
            </section>

            <SectionCard title="입력 요약" icon={<SectionIcon name="document" />}>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">기준일</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center break-words text-base font-semibold">
                    {formatKoreanDate(shiftAppliedInput.baseDate)}
                    {isToday(shiftAppliedInput.baseDate, today) && <TodayBadge />}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">일수 · 방향</dt>
                  <dd className="mt-0.5 break-words text-base font-semibold">
                    {shiftAppliedInput.days.toLocaleString("ko-KR")}일{" "}
                    {shiftAppliedInput.direction === "add" ? "더하기" : "빼기"}
                  </dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {shiftBreakdown.map((row) => (
                  <li key={row.label} className="text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="mt-1 break-words tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 소개 · 사용 방법 ───────────────────────────────────────────
       * docs/DESIGN_SYSTEM.md "공통 화면 순서"(입력 → 결과 → 계산 근거 → 소개·사용 방법 →
       * 정책 안내 → FAQ, 최근 정정된 최신 버전)를 그대로 따른다 — average-cost-calculator/
       * severance-pay/bill-split-calculator/loan-interest-calculator가 이미 이 위치를
       * 채택했다.
       */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <UsageGuide description="모드를 선택하고 날짜(와 일수)만 입력하면 자동으로 계산합니다." steps={D_DAY_USAGE_STEPS} />
        <IntroSection title="디데이·날짜 계산이란?" paragraphs={D_DAY_INTRO_PARAGRAPHS} />
      </div>

      {/* ── 계산 전제 고지 + FAQ ─────────────────────────────────────── */}
      <SectionCard title="계산 전 확인" icon={<SectionIcon name="info" />} className="mt-8">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {D_DAY_ASSUMPTION_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </SectionCard>
      <section className="mt-5 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">
        입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.
      </section>
      <div className="mt-5">
        <FaqAccordion items={dDayCalculatorFaqItems} />
      </div>
    </div>
  );
}
