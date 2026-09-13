"use client";

/**
 * 연봉 실수령액 계산기 — 입력/결과 UI.
 *
 * tasks/annual-salary-take-home-pay/ARCHITECTURE.md "7. UI 구조"를 그대로 구현한다.
 * 화면 순서: 소개 → 입력 → 결과(핵심 카드 → 공제 내역 카드 → 계산 근거 → 정책 안내) →
 * 사용 방법/소개 → FAQ (docs/DESIGN_SYSTEM.md 공통 순서).
 *
 * 계산 공식은 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다.
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
  ANNUAL_SALARY_INTRO_PARAGRAPHS,
  ANNUAL_SALARY_USAGE_STEPS,
  annualSalaryTakeHomePayFaqItems,
} from "./content";
import {
  buildAnnualSalaryCalculationSteps,
  buildBelowTaxableThresholdWarning,
  buildChildTaxCreditFloorWarning,
  buildHealthLimitWarning,
  buildHighIncomeFormulaWarning,
  buildNegativeNetPayWarning,
  buildOverElevenFamilyWarning,
  buildPensionLimitWarning,
  formatWon,
} from "./formatting";
import { calculateAnnualSalaryTakeHomePay } from "./logic";
import type { AnnualSalaryTakeHomePayInput, AnnualSalaryTakeHomePayResult } from "./types";
import {
  validateAnnualSalaryTakeHomePayInput,
  type AnnualSalaryTakeHomePayField,
  type RawAnnualSalaryTakeHomePayInput,
  type ValidationFieldError,
} from "./validation";

const FIELD_CLASS =
  "mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";
const HELP_CLASS = "mt-1 text-xs text-muted";

function emptyForm(): RawAnnualSalaryTakeHomePayInput {
  return {
    annualSalary: "",
    monthlyNonTaxablePay: "0",
    dependentFamilyCount: "1",
    childrenAge8to20Count: "0",
  };
}

/** FORMULA.md 검증 예제 8(가족 3명, 자녀 1명)을 그대로 샘플로 쓴다. */
const SAMPLE_FORM: RawAnnualSalaryTakeHomePayInput = {
  annualSalary: "36,000,000",
  monthlyNonTaxablePay: "200,000",
  dependentFamilyCount: "3",
  childrenAge8to20Count: "1",
};

function SectionIcon({ name }: { name: "formula" | "document" | "info" }) {
  const paths = {
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

/**
 * 경고 카드(docs/DESIGN_SYSTEM.md "경고/미충족 카드", housing-subscription-score/
 * weekly-holiday-allowance 선례). QA 신규 발견(Medium, 비현실적으로 낮은 연봉 입력 시
 * netMonthlyPay 음수)에 대한 안내에 사용한다 — 계산 자체는 정확하므로 결과를 가리지
 * 않고 결과 위에 별도 카드로 덧붙인다.
 */
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

/** 인라인 경고 문구(항목 바로 아래, 카드로 뭉치지 않음 — ARCHITECTURE.md "7." 결과 화면 3번). */
function InlineNotice({ text }: { text: string }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-3.5 w-3.5 shrink-0">
        <path d="M12 8v4M12 16h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
      </svg>
      <span>{text}</span>
    </p>
  );
}

function DeductionRow({
  label,
  value,
  notices,
  strong,
}: {
  label: string;
  value: number;
  notices?: (string | null)[];
  strong?: boolean;
}) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className={strong ? "text-sm font-semibold" : "text-sm text-muted"}>{label}</span>
        <span className={`tabular-nums ${strong ? "text-base font-bold" : "text-sm font-medium"}`}>
          {formatWon(value)}
        </span>
      </div>
      {notices?.filter((n): n is string => !!n).map((n) => <InlineNotice key={n} text={n} />)}
    </div>
  );
}

export default function AnnualSalaryTakeHomePayUi() {
  const formId = useId();
  const [form, setForm] = useState<RawAnnualSalaryTakeHomePayInput>(emptyForm);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<AnnualSalaryTakeHomePayResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<AnnualSalaryTakeHomePayInput | null>(null);

  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state);
    const saved = asShareRecord(root?.f);
    if (!saved) return;
    const restored = saved as unknown as RawAnnualSalaryTakeHomePayInput;
    const validation = validateAnnualSalaryTakeHomePayInput(restored);
    if (!validation.success) return;
    setForm(restored);
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateAnnualSalaryTakeHomePay(validation.data));
  });

  function errorFor(field: AnnualSalaryTakeHomePayField): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function amountChange(field: "annualSalary" | "monthlyNonTaxablePay") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, [field]: digits ? Number(digits).toLocaleString("ko-KR") : "" }));
      setResult(null);
      setAppliedInput(null);
    };
  }

  function countChange(field: "dependentFamilyCount" | "childrenAge8to20Count") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      if (/^[0-9]*$/.test(event.target.value)) {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
        setResult(null);
        setAppliedInput(null);
      }
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateAnnualSalaryTakeHomePayInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateAnnualSalaryTakeHomePay(validation.data));
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

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold text-primary">세금/정책</p>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">연봉 실수령액 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          세전 연봉을 입력하면 4대 보험과 근로소득세·지방소득세를 공제한 세후 월 실수령액(예상)을
          계산합니다.
        </p>
      </header>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 shadow-[0_16px_50px_-35px_rgba(16,24,40,.35)] sm:p-8"
      >
        <div>
          <label htmlFor={`${formId}-annualSalary`} className={LABEL_CLASS}>
            세전 연봉{" "}
            <span aria-hidden="true" className="text-red-600 dark:text-red-400">
              *
            </span>
          </label>
          <input
            id={`${formId}-annualSalary`}
            value={form.annualSalary}
            onChange={amountChange("annualSalary")}
            inputMode="numeric"
            placeholder="예: 36,000,000"
            aria-required="true"
            aria-invalid={errorFor("annualSalary") ? true : undefined}
            aria-describedby={`${formId}-annualSalary-help${errorFor("annualSalary") ? ` ${formId}-annualSalary-error` : ""}`}
            className={FIELD_CLASS}
          />
          <p id={`${formId}-annualSalary-help`} className={HELP_CLASS}>
            상여·수당을 모두 포함한 세전 연봉을 입력하세요. 이 계산기는 &apos;연봉 ÷ 12&apos;로
            월급을 환산합니다(방식 A).
          </p>
          {errorFor("annualSalary") && (
            <p id={`${formId}-annualSalary-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("annualSalary")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${formId}-monthlyNonTaxablePay`} className={LABEL_CLASS}>
            월 비과세 금액 <span className="font-normal text-muted">(선택)</span>
          </label>
          <input
            id={`${formId}-monthlyNonTaxablePay`}
            value={form.monthlyNonTaxablePay}
            onChange={amountChange("monthlyNonTaxablePay")}
            inputMode="numeric"
            placeholder="예: 200,000"
            aria-invalid={errorFor("monthlyNonTaxablePay") ? true : undefined}
            aria-describedby={`${formId}-monthlyNonTaxablePay-help${errorFor("monthlyNonTaxablePay") ? ` ${formId}-monthlyNonTaxablePay-error` : ""}`}
            className={FIELD_CLASS}
          />
          <p id={`${formId}-monthlyNonTaxablePay-help`} className={HELP_CLASS}>
            식대 등 4대 보험·세금에서 제외되는 금액(월 기준)입니다. 없으면 비워 두세요.
          </p>
          {errorFor("monthlyNonTaxablePay") && (
            <p id={`${formId}-monthlyNonTaxablePay-error`} role="alert" className={ERROR_CLASS}>
              {errorFor("monthlyNonTaxablePay")}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-dependentFamilyCount`} className={LABEL_CLASS}>
              부양가족 수(본인 포함){" "}
              <span aria-hidden="true" className="text-red-600 dark:text-red-400">
                *
              </span>
            </label>
            <input
              id={`${formId}-dependentFamilyCount`}
              value={form.dependentFamilyCount}
              onChange={countChange("dependentFamilyCount")}
              inputMode="numeric"
              aria-required="true"
              aria-invalid={errorFor("dependentFamilyCount") ? true : undefined}
              aria-describedby={`${formId}-dependentFamilyCount-help${errorFor("dependentFamilyCount") ? ` ${formId}-dependentFamilyCount-error` : ""}`}
              className={FIELD_CLASS}
            />
            <p id={`${formId}-dependentFamilyCount-help`} className={HELP_CLASS}>
              배우자도 1명으로 계산합니다. 정확한 연말정산 신고 내용과 다르면 결과가 달라질 수
              있습니다.
            </p>
            {errorFor("dependentFamilyCount") && (
              <p id={`${formId}-dependentFamilyCount-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("dependentFamilyCount")}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${formId}-childrenAge8to20Count`} className={LABEL_CLASS}>
              8세~20세 자녀 수 <span className="font-normal text-muted">(선택)</span>
            </label>
            <input
              id={`${formId}-childrenAge8to20Count`}
              value={form.childrenAge8to20Count}
              onChange={countChange("childrenAge8to20Count")}
              inputMode="numeric"
              aria-invalid={errorFor("childrenAge8to20Count") ? true : undefined}
              aria-describedby={`${formId}-childrenAge8to20Count-help${errorFor("childrenAge8to20Count") ? ` ${formId}-childrenAge8to20Count-error` : ""}`}
              className={FIELD_CLASS}
            />
            <p id={`${formId}-childrenAge8to20Count-help`} className={HELP_CLASS}>
              부양가족 수(본인 포함) − 1명을 넘을 수 없습니다(본인은 자녀가 될 수 없습니다).
            </p>
            {errorFor("childrenAge8to20Count") && (
              <p id={`${formId}-childrenAge8to20Count-error`} role="alert" className={ERROR_CLASS}>
                {errorFor("childrenAge8to20Count")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            실수령액 계산하기
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
        title="연봉 실수령액 계산기"
        text={
          result
            ? `세후 월 실수령액은 ${formatWon(result.netMonthlyPay)}입니다.`
            : "세전 연봉으로 4대 보험·세금을 뺀 세후 월 실수령액을 계산해 보세요."
        }
        url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined}
        mode={result ? "result" : "calculator"}
      />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && (
          <>
            {buildNegativeNetPayWarning(result) && (
              <WarningCard
                title="세후 실수령액이 0원 미만으로 계산됨"
                body={buildNegativeNetPayWarning(result) as string}
              />
            )}

            {/* 핵심 결과 카드 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                세후 월 실수령액(예상)
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.netMonthlyPay)}
              </p>
              <p className="mt-3 text-sm opacity-80 dark:text-foreground dark:opacity-100">
                세전 월급여 {formatWon(result.monthlyGrossPay)} 중 공제 합계{" "}
                {formatWon(result.totalDeductions)}
              </p>
              <p className="mt-3 text-sm font-semibold opacity-100 dark:text-foreground dark:opacity-100">
                국세청 근로소득 간이세액표 기준 예상 원천징수액이며, 연말정산 환급·추가납부는
                반영하지 않은 매월 원천징수 기준 실수령액입니다.
              </p>
            </section>

            {/* 공제 내역 카드 */}
            <SectionCard title="공제 내역" icon={<SectionIcon name="document" />}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">4대 보험</p>
                <DeductionRow
                  label="국민연금"
                  value={result.employeePension}
                  notices={[buildPensionLimitWarning(result)]}
                />
                <DeductionRow
                  label="건강보험"
                  value={result.employeeHealth}
                  notices={[buildHealthLimitWarning(result)]}
                />
                <DeductionRow label="장기요양보험" value={result.employeeLongTermCare} />
                <DeductionRow label="고용보험" value={result.employeeEmployment} />
                <DeductionRow label="4대 보험 합계" value={result.employeeInsuranceTotal} strong />
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">세금</p>
                <DeductionRow
                  label="근로소득세"
                  value={result.incomeTax}
                  notices={[
                    buildBelowTaxableThresholdWarning(result),
                    buildHighIncomeFormulaWarning(result),
                    buildOverElevenFamilyWarning(result),
                    buildChildTaxCreditFloorWarning(result),
                  ]}
                />
                <DeductionRow label="지방소득세" value={result.localIncomeTax} />
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <DeductionRow label="공제 합계" value={result.totalDeductions} strong />
              </div>
            </SectionCard>

            {/* 계산 근거 */}
            <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
              <ol className="space-y-4">
                {buildAnnualSalaryCalculationSteps(appliedInput, result).map((row) => (
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

            {/* 정책 안내 */}
            <SectionCard title="정책 안내" icon={<SectionIcon name="info" />}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-surface-subtle px-3 py-1 font-medium">
                  4대 보험 기준일 {result.appliedSocialInsurancePeriod.replace("/", " ~ ")}
                </span>
                <span className="rounded-full bg-surface-subtle px-3 py-1 font-medium">
                  간이세액표 시행일 {result.appliedWithholdingTableEffectiveFrom}
                </span>
              </div>
              <div className="mt-4 space-y-2 text-sm leading-6 text-muted">
                <p>
                  근로소득세는 국세청 근로소득 간이세액표 기준 <strong className="text-foreground">
                    예상 원천징수액
                  </strong>입니다. 실제 금액은 회사 급여 시스템, 4대보험 신고 보수월액, 비과세
                  항목 구성, 연말정산 반영 여부에 따라 달라질 수 있습니다.
                </p>
                <p>
                  이 계산기는 연말정산 환급·추가납부를 시뮬레이션하지 않으며, 매월 원천징수 기준
                  실수령액만 다룹니다.
                </p>
                <p>이 계산 결과는 국세청·공단의 공식 고지액이 아닌 모의계산 참고 자료입니다.</p>
                <p>입력값은 브라우저에서만 계산하며 서버로 전송하거나 저장하지 않습니다.</p>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="세전 연봉과 몇 가지 정보만 입력하면 자동으로 계산합니다."
          steps={ANNUAL_SALARY_USAGE_STEPS}
        />
        <IntroSection
          title="연봉 실수령액 계산기란 무엇인가요?"
          paragraphs={ANNUAL_SALARY_INTRO_PARAGRAPHS}
        />
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={annualSalaryTakeHomePayFaqItems} />
      </div>
    </div>
  );
}
