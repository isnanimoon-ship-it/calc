"use client";

import Link from "next/link";
import { useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import { calculateFourMajorInsurance, employmentTierLabels } from "./logic";
import { formatWon } from "./formatting";
import { fourMajorInsuranceFaqItems } from "./content";
import { validateFourMajorInsuranceInput, type RawFourMajorInsuranceInput } from "./validation";
import type { FourMajorInsuranceInput, FourMajorInsuranceResult } from "./types";

const initial: RawFourMajorInsuranceInput = {
  monthlyGrossPay: "", monthlyNonTaxablePay: "0", nationalPensionEnabled: true,
  healthInsuranceEnabled: true, employmentInsuranceEnabled: true,
  employmentBusinessRateTier: "under150",
};

const insuranceRows = [
  ["nationalPension", "국민연금"], ["healthInsurance", "건강보험"],
  ["longTermCareInsurance", "장기요양보험"], ["employmentInsurance", "고용보험"],
] as const;

const employmentExtraRateLabels = {
  under150: "0.25%",
  priorityOver150: "0.45%",
  between150And999: "0.65%",
  over1000OrGovernment: "0.85%",
} as const;

function SectionIcon({ name }: { name: "chart" | "formula" | "document" }) {
  const paths = {
    chart: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
    formula: <path d="M5 5h6L7 12l4 7H5m10-9h5m-2.5-2.5v5" />,
    document: <path d="M6 3h9l3 3v15H6zM9 11h6m-6 4h6" />,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function contributionFormula(
  key: (typeof insuranceRows)[number][0],
  result: FourMajorInsuranceResult,
) {
  if (result[key].exclusionReason) return "선택 제외";
  if (key === "nationalPension") return `기준소득월액 ${formatWon(result.pensionStandardMonthlyIncome)} × 4.75%`;
  if (key === "healthInsurance") return `보수월액 ${formatWon(result.estimatedMonthlyRemuneration)} × 7.19% ÷ 2`;
  if (key === "longTermCareInsurance") return `건강보험료 × 13.14%`;
  return `보수월액 ${formatWon(result.estimatedMonthlyRemuneration)} × 근로자 0.9% / 사업주 0.9% + ${employmentExtraRateLabels[result.employmentBusinessRateTier]}`;
}

export default function FourMajorInsuranceUi() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FourMajorInsuranceResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<FourMajorInsuranceInput | null>(null);
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const saved = asShareRecord(root?.f);
    if (!saved || !["monthlyGrossPay","monthlyNonTaxablePay","employmentBusinessRateTier"].every((key) => typeof saved[key] === "string") || !["nationalPensionEnabled","healthInsuranceEnabled","employmentInsuranceEnabled"].every((key) => typeof saved[key] === "boolean")) return;
    const restored = saved as unknown as RawFourMajorInsuranceInput;
    const checked = validateFourMajorInsuranceInput(restored); if (!checked.success) return;
    setForm(restored); setErrors({}); setAppliedInput(checked.data); setResult(calculateFourMajorInsurance(checked.data));
  });

  function amountChange(field: "monthlyGrossPay" | "monthlyNonTaxablePay") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, [field]: digits ? Number(digits).toLocaleString("ko-KR") : "" }));
      setResult(null); setAppliedInput(null);
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const checked = validateFourMajorInsuranceInput(form);
    if (!checked.success) {
      setErrors(Object.fromEntries(checked.errors.map((error) => [error.field, error.message])));
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors({});
    setAppliedInput(checked.data);
    setResult(calculateFourMajorInsurance(checked.data));
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/tax" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">세금/정책</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">4대 보험 계산기</h1>
        <p className="mt-3 text-base leading-7 text-muted">월 급여로 근로자와 사업주의 사회보험 부담액을 계산합니다.</p>
        <p className="mt-2 text-sm font-medium text-primary">2026년 7월 이후 기준</p>
      </header>

      <form onSubmit={submit} className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 sm:p-8" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">세전 월 급여 <span className="text-danger">*</span>
            <input aria-invalid={!!errors.monthlyGrossPay} aria-describedby={errors.monthlyGrossPay ? "gross-pay-error" : undefined} value={form.monthlyGrossPay} onChange={amountChange("monthlyGrossPay")} inputMode="numeric" placeholder="예: 3,000,000" className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            {errors.monthlyGrossPay && <span id="gross-pay-error" role="alert" className="mt-1.5 block font-normal text-danger">{errors.monthlyGrossPay}</span>}
          </label>
          <label className="text-sm font-semibold">비과세 금액 <span className="font-normal text-muted">(선택)</span>
            <input aria-invalid={!!errors.monthlyNonTaxablePay} aria-describedby={errors.monthlyNonTaxablePay ? "non-taxable-error" : "non-taxable-help"} value={form.monthlyNonTaxablePay} onChange={amountChange("monthlyNonTaxablePay")} inputMode="numeric" className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            <span id="non-taxable-help" className="mt-1.5 block font-normal text-muted">월 급여에 포함된 비과세 금액입니다.</span>
            {errors.monthlyNonTaxablePay && <span id="non-taxable-error" role="alert" className="mt-1.5 block font-normal text-danger">{errors.monthlyNonTaxablePay}</span>}
          </label>
        </div>

        <fieldset className="border-t border-border pt-6">
          <legend className="text-sm font-semibold">계산할 보험</legend>
          <div className="mt-3 flex flex-wrap gap-4">
            {([ ["nationalPensionEnabled", "국민연금"], ["healthInsuranceEnabled", "건강·장기요양보험"], ["employmentInsuranceEnabled", "고용보험"] ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form[key] === true} onChange={(e) => { setForm((prev) => ({ ...prev, [key]: e.target.checked })); setResult(null); setAppliedInput(null); }} className="h-4 w-4 accent-primary" />{label}</label>
            ))}
          </div>
          {errors.nationalPensionEnabled && <p role="alert" className="mt-2 text-sm text-danger">{errors.nationalPensionEnabled}</p>}
        </fieldset>

        <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,28rem)] sm:items-center sm:gap-x-5">
          <label htmlFor="employment-business-tier" className="text-sm font-semibold">사업장 규모</label>
          <select id="employment-business-tier" disabled={!form.employmentInsuranceEnabled} value={form.employmentBusinessRateTier} onChange={(e) => { setForm((prev) => ({ ...prev, employmentBusinessRateTier: e.target.value })); setResult(null); setAppliedInput(null); }} className="min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 disabled:cursor-not-allowed disabled:opacity-50">
            {Object.entries(employmentTierLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="text-sm font-normal text-muted sm:col-start-2">사업주 고용보험 부담액에만 영향을 줍니다.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">보험료 계산하기</button>
          <button type="button" onClick={() => { setForm({ ...initial, monthlyGrossPay: "3,000,000", monthlyNonTaxablePay: "200,000" }); setResult(null); setAppliedInput(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">샘플 값</button>
          <button type="button" onClick={() => { setForm(initial); setResult(null); setAppliedInput(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted">초기화</button>
        </div>
      </form>

      <ShareActions className="mt-5" title="4대 보험 계산기" text={result ? `월 근로자 부담 보험료는 ${formatWon(result.employeeInsuranceTotal)}입니다.` : "월 급여로 근로자와 사업주의 4대 보험 부담액을 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} onKakaoShare={kakaoShareAdapter} />

      <div aria-live="polite" className="mt-8 space-y-5">
        {result && appliedInput && <>
          <section className="rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
            <p className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">월 4대 보험 공제액</p>
            <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary">{formatWon(result.employeeInsuranceTotal)}</p>
            <p className="mt-4 text-sm opacity-80 dark:text-muted dark:opacity-100">4대 보험 공제 후 금액 <strong className="ml-2 text-base text-primary-foreground dark:text-foreground">{formatWon(result.afterEmployeeInsurance)}</strong></p>
            <p className="mt-2 text-xs opacity-70 dark:text-muted dark:opacity-100">소득세·지방소득세를 반영한 실제 실수령액은 아닙니다.</p>
          </section>
          <SectionCard title="보험별 상세 내역" icon={<SectionIcon name="chart" />}>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] table-fixed text-xs sm:text-sm"><thead><tr className="border-b border-border text-left text-muted"><th className="w-[35%] pb-3">보험</th><th className="w-[21%] pb-3 text-right">근로자 부담</th><th className="w-[22%] pb-3 text-right">사업주 부담</th><th className="w-[22%] pb-3 text-right">합계</th></tr></thead><tbody>
              {insuranceRows.map(([key, label]) => {
                const item = result[key];
                const isExcluded = !!item.exclusionReason;
                return <tr key={key} className="border-b border-border last:border-0"><th className="py-4 pr-3 text-left"><span className="block font-semibold">{label}</span><span className="mt-1 block text-[11px] font-normal leading-4 text-muted">{contributionFormula(key, result)}</span></th><td className="py-4 text-right font-medium tabular-nums">{isExcluded ? "제외" : formatWon(item.employee)}</td><td className="py-4 text-right font-medium tabular-nums">{isExcluded ? "제외" : formatWon(item.employer)}</td><td className="py-4 text-right font-semibold tabular-nums">{isExcluded ? "제외" : formatWon(item.employee + item.employer)}</td></tr>;
              })}
              <tr><th className="pt-4 text-left">합계</th><td className="pt-4 text-right font-bold tabular-nums">{formatWon(result.employeeInsuranceTotal)}</td><td className="pt-4 text-right font-bold tabular-nums">{formatWon(result.employerInsuranceTotalExcludingWorkersComp)}</td><td className="pt-4 text-right font-bold tabular-nums">{formatWon(result.combinedInsuranceTotalExcludingWorkersComp)}</td></tr>
            </tbody></table></div>
            <p className="mt-4 text-sm text-muted">산재보험은 사업주 전액 부담이며 업종별 요율이 달라 위 사업주 합계에서 제외했습니다.</p>
          </SectionCard>
          <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
            <ol className="space-y-5 text-sm">
              <li><p className="font-semibold">1. 보험료 산정 보수 계산</p><p className="mt-1 text-muted">세전 월 급여에서 비과세 금액을 제외합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{formatWon(appliedInput.monthlyGrossPay)} − {formatWon(appliedInput.monthlyNonTaxablePay)} = {formatWon(result.estimatedMonthlyRemuneration)}</p></li>
              {appliedInput.nationalPensionEnabled && <li><p className="font-semibold">2. 국민연금 계산</p><p className="mt-1 text-muted">천 원 단위 기준소득월액에 근로자와 사업주가 각각 4.75%를 부담합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{formatWon(result.pensionStandardMonthlyIncome)} × 4.75% = 근로자 {formatWon(result.nationalPension.employee)} · 사업주 {formatWon(result.nationalPension.employer)}</p>{(result.pensionMinimumApplied || result.pensionMaximumApplied) && <p className="mt-1 text-xs text-primary">국민연금 기준소득월액 {result.pensionMinimumApplied ? "하한" : "상한"}이 적용되었습니다.</p>}</li>}
              {appliedInput.healthInsuranceEnabled && <li><p className="font-semibold">3. 건강보험·장기요양보험 계산</p><p className="mt-1 text-muted">건강보험은 보수월액의 7.19%를 절반씩, 장기요양보험은 각 건강보험료의 13.14%를 부담합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">건강보험 근로자 {formatWon(result.healthInsurance.employee)} · 사업주 {formatWon(result.healthInsurance.employer)}</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">장기요양 근로자 {formatWon(result.longTermCareInsurance.employee)} · 사업주 {formatWon(result.longTermCareInsurance.employer)}</p>{(result.healthMinimumApplied || result.healthMaximumApplied) && <p className="mt-1 text-xs text-primary">건강보험료 {result.healthMinimumApplied ? "하한" : "상한"}이 적용되었습니다.</p>}</li>}
              {appliedInput.employmentInsuranceEnabled && <li><p className="font-semibold">4. 고용보험 계산</p><p className="mt-1 text-muted">근로자는 0.9%, 사업주는 0.9%에 사업장 규모별 고용안정·직업능력개발 부담률을 더합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">근로자 {formatWon(result.employmentInsurance.employee)} · 사업주 {formatWon(result.employmentInsurance.employer)} (추가 {employmentExtraRateLabels[result.employmentBusinessRateTier]})</p></li>}
              <li><p className="font-semibold">5. 월 공제액 합산</p><p className="mt-1 text-muted">선택한 보험의 근로자 부담액을 합산하고 세전 월 급여에서 차감합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{formatWon(appliedInput.monthlyGrossPay)} − {formatWon(result.employeeInsuranceTotal)} = {formatWon(result.afterEmployeeInsurance)}</p></li>
            </ol>
            <p className="mt-5 text-xs leading-5 text-muted">보험료는 각 단계에서 원 단위 사사오입 없이 10원 미만을 버린 값이며, 실제 공단 고지액과 차이가 날 수 있습니다.</p>
          </SectionCard>
          <SectionCard title="적용된 입력값과 기준" icon={<SectionIcon name="document" />}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted">보험료 산정 보수</dt><dd className="font-semibold">{formatWon(result.estimatedMonthlyRemuneration)}</dd></div><div><dt className="text-muted">국민연금 기준소득월액</dt><dd className="font-semibold">{formatWon(result.pensionStandardMonthlyIncome)}</dd></div><div><dt className="text-muted">적용 기간</dt><dd className="font-semibold">2026.07.01 ~ 2027.06.30</dd></div><div><dt className="text-muted">사업장 규모</dt><dd className="font-semibold">{employmentTierLabels[result.employmentBusinessRateTier]}</dd></div></dl>
          </SectionCard>
        </>}
      </div>

      <section className="mt-12 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">실제 보험료는 공단 신고 보수, 자격 취득일, 정산, 휴직, 보험료 지원 등에 따라 달라질 수 있습니다. 입력값은 서버로 전송하거나 저장하지 않습니다.</section>
      <div className="mt-5"><FaqAccordion items={fourMajorInsuranceFaqItems.map((item) => ({ ...item, answer: [...item.answer] }))} /></div>
    </div>
  );
}
