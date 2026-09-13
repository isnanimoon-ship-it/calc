"use client";

import Link from "next/link";
import { useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";
import { militaryDischargeFaqItems } from "./content";
import { formatDday, formatDuration, formatKoreanDate, formatPercent, formatShortDate } from "./formatting";
import { calculateMilitaryDischarge } from "./logic";
import { SERVICE_POLICY_REVIEWED_AT, getServicePolicy, serviceGroupLabels, servicePolicies } from "./policy";
import type { MilitaryDischargeInput, MilitaryDischargeResult, ServiceGroup } from "./types";
import { validateMilitaryDischargeInput, type RawMilitaryDischargeInput } from "./validation";

function todayInKorea() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function SectionIcon({ name }: { name: "chart" | "formula" | "document" | "timeline" }) {
  const paths = {
    chart: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
    formula: <path d="M5 5h6L7 12l4 7H5m10-9h5m-2.5-2.5v5" />,
    document: <path d="M6 3h9l3 3v15H6zM9 11h6m-6 4h6" />,
    timeline: <path d="M5 5v14m0-11h8l2-2m-10 7h11l2 2m-13 3h7" />,
  };
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function resultSummary(result: MilitaryDischargeResult) {
  if (result.status === "upcoming") return `복무 시작까지 ${formatDday(result.daysUntilStart)} 남았습니다.`;
  if (result.status === "completion-day") return "오늘이 복무 마지막 날입니다.";
  if (result.status === "completed") return `복무 완료 후 ${formatDday(-result.completedDaysAfterEnd)} 지났습니다.`;
  return `${formatDuration(result.remainingCalendar)} (${formatDday(result.remainingDays)}) 남았습니다.`;
}

export default function MilitaryDischargeDateUi() {
  const today = todayInKorea();
  const [group, setGroup] = useState<ServiceGroup>("active");
  const [form, setForm] = useState<RawMilitaryDischargeInput>({ serviceType: "army", startDate: "", referenceDate: today });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MilitaryDischargeResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<MilitaryDischargeInput | null>(null);
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const saved = asShareRecord(root?.f);
    if (!saved || !["serviceType","startDate","referenceDate"].every((key) => typeof saved[key] === "string")) return;
    const restored = saved as unknown as RawMilitaryDischargeInput;
    const checked = validateMilitaryDischargeInput(restored); if (!checked.success) return;
    const policy = getServicePolicy(checked.data.serviceType); if (!policy) return;
    setGroup(policy.group); setForm(restored); setErrors({}); setAppliedInput(checked.data); setResult(calculateMilitaryDischarge(checked.data));
  });
  const selectedPolicy = getServicePolicy(form.serviceType);

  function changeGroup(next: ServiceGroup) {
    const first = servicePolicies.find((policy) => policy.group === next)!;
    setGroup(next); setForm((previous) => ({ ...previous, serviceType: first.id })); setResult(null); setAppliedInput(null); setErrors({});
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const checked = validateMilitaryDischargeInput(form);
    if (!checked.success) { setErrors(Object.fromEntries(checked.errors.map((error) => [error.field, error.message]))); setResult(null); setAppliedInput(null); return; }
    setErrors({}); setAppliedInput(checked.data); setResult(calculateMilitaryDischarge(checked.data));
  }

  return <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
    <header className="max-w-3xl"><Link href="/categories/date" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">날짜</Link><h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">전역일 계산기</h1><p className="mt-3 text-base leading-7 text-muted">복무 유형과 시작일로 예상 전역일, 남은 기간과 복무 진행률을 계산합니다.</p></header>

    <form onSubmit={submit} className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 sm:p-8" noValidate>
      <fieldset><legend className="text-sm font-semibold">복무 종류</legend><div className="mt-3 flex flex-wrap gap-2">{(Object.entries(serviceGroupLabels) as [ServiceGroup,string][]).map(([key,label]) => <label key={key} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${group === key ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted hover:border-border-strong"}`}><input type="radio" name="service-group" value={key} checked={group === key} onChange={() => changeGroup(key)} className="sr-only" />{label}</label>)}</div></fieldset>
      <fieldset aria-describedby={errors.serviceType ? "service-type-error" : undefined}><legend className="text-sm font-semibold">세부 복무 유형</legend><div className="mt-3 flex flex-wrap gap-2">{servicePolicies.filter((policy) => policy.group === group).map((policy) => <label key={policy.id} className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${form.serviceType === policy.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted hover:border-border-strong"}`}><input type="radio" name="service-type" value={policy.id} checked={form.serviceType === policy.id} onChange={() => { setForm((previous) => ({ ...previous, serviceType: policy.id })); setResult(null); setAppliedInput(null); }} className="sr-only" />{policy.label}</label>)}</div>{errors.serviceType && <p id="service-type-error" role="alert" className="mt-2 text-sm text-danger">{errors.serviceType}</p>}</fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold">{selectedPolicy?.startLabel ?? "복무 시작일"} <span className="text-danger">*</span><input type="date" value={form.startDate} min="2021-01-01" max="2100-12-31" aria-invalid={!!errors.startDate} aria-describedby={errors.startDate ? "start-date-error" : "start-date-help"} onChange={(event) => { setForm((previous) => ({ ...previous, startDate: event.target.value })); setResult(null); setAppliedInput(null); }} className="mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><span id="start-date-help" className="mt-1.5 block font-normal text-muted">복무 통지서 또는 병적기록의 날짜를 입력하세요.</span>{errors.startDate && <span id="start-date-error" role="alert" className="mt-1.5 block font-normal text-danger">{errors.startDate}</span>}</label>
        <label className="min-w-0 text-sm font-semibold">계산 기준일 <span className="text-danger">*</span><input type="date" value={form.referenceDate} aria-invalid={!!errors.referenceDate} aria-describedby={errors.referenceDate ? "reference-date-error" : "reference-date-help"} onChange={(event) => { setForm((previous) => ({ ...previous, referenceDate: event.target.value })); setResult(null); setAppliedInput(null); }} className="mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><span id="reference-date-help" className="mt-1.5 block font-normal text-muted">오늘이 기본값이며 과거·미래 시점도 확인할 수 있습니다.</span>{errors.referenceDate && <span id="reference-date-error" role="alert" className="mt-1.5 block font-normal text-danger">{errors.referenceDate}</span>}</label>
      </div>
      {selectedPolicy && <p className="rounded-xl bg-surface-subtle px-4 py-3 text-sm text-muted"><strong className="text-foreground">{selectedPolicy.label}</strong> 표준 복무기간 <strong className="text-primary">{selectedPolicy.months}개월</strong>을 적용합니다.</p>}
      <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">전역일 계산하기</button><button type="button" onClick={() => { setGroup("active"); setForm({ serviceType: "army", startDate: today, referenceDate: today }); setResult(null); setAppliedInput(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">오늘 입영 샘플</button><button type="button" onClick={() => { setGroup("active"); setForm({ serviceType: "army", startDate: "", referenceDate: today }); setResult(null); setAppliedInput(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted">초기화</button></div>
    </form>

    <ShareActions className="mt-5" title="전역일 계산기" text={result ? `예상 ${result.policy.endTerm}은 ${formatKoreanDate(result.endDate)}입니다. ${resultSummary(result)}` : "복무 유형과 시작일로 예상 전역일과 남은 기간을 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} onKakaoShare={kakaoShareAdapter} />
    <div aria-live="polite" className="mt-8 space-y-5">{result && appliedInput && <>
      <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8"><p className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">예상 {result.policy.endTerm}</p><p className="mt-2 text-3xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">{formatKoreanDate(result.endDate)}</p><p className="mt-5 text-lg font-semibold dark:text-foreground">{resultSummary(result)}</p><p className="mt-2 text-xs opacity-75 dark:text-muted dark:opacity-100">표준 복무기간 기준 예상치이며 실제 인사명령이 우선합니다.</p></section>
      <SectionCard title="상세 내역" icon={<SectionIcon name="document" />}><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted">복무 유형</dt><dd className="mt-1 font-semibold">{result.policy.label}</dd></div><div><dt className="text-muted">{result.policy.startLabel}</dt><dd className="mt-1 font-semibold tabular-nums">{formatKoreanDate(result.startDate)}</dd></div><div><dt className="text-muted">표준 복무기간</dt><dd className="mt-1 font-semibold">{result.policy.months}개월 (날짜 경계 {result.serviceSpanDays.toLocaleString("ko-KR")}일)</dd></div><div><dt className="text-muted">정책 기준</dt><dd className="mt-1 font-semibold">현행 복무기간 · {SERVICE_POLICY_REVIEWED_AT} 검토</dd></div></dl></SectionCard>
      <SectionCard title="복무 진행률" icon={<SectionIcon name="chart" />}><div className="flex items-end justify-between gap-4"><p className="text-sm text-muted">기준일 {formatShortDate(result.referenceDate)}</p><strong className="text-2xl tabular-nums text-primary">{formatPercent(result.progressPercent)}</strong></div><div role="progressbar" aria-label="복무 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(result.progressPercent.toFixed(1))} className="mt-4 h-3 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${result.progressPercent}%` }} /></div><p className="mt-3 text-xs text-muted">완료 {result.elapsedDays.toLocaleString("ko-KR")}일 · 전체 날짜 경계 {result.serviceSpanDays.toLocaleString("ko-KR")}일</p></SectionCard>
      <SectionCard title="주요 일정" icon={<SectionIcon name="timeline" />}><ol className="divide-y divide-border">{[...result.milestones, ...result.rankMilestones].sort((a,b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)).map((item) => <li key={`${item.kind}-${item.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${item.state === "upcoming" ? "bg-border-strong" : "bg-primary"}`} /><span><strong className="font-medium">{item.label}</strong>{item.state === "today" && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">오늘</span>}</span><span className="text-right tabular-nums"><span className="block">{formatShortDate(item.date)}</span><span className="text-xs text-muted">{formatDday(item.daysFromReference)}</span></span></li>)}</ol>{result.rankMilestones.length > 0 && <p className="mt-4 text-xs leading-5 text-muted">진급 일정은 법령상 최저복무기간으로 계산한 진급 가능 기준일입니다. 실제 진급은 심사와 발령일, 진급 제한 등에 따라 달라집니다.</p>}</SectionCard>
      <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}><ol className="space-y-4 text-sm"><li><p className="font-semibold">1. 표준 복무기간 적용</p><p className="mt-1 text-muted">{result.policy.label}의 현행 표준 복무기간 {result.policy.months}개월을 적용합니다.</p></li><li><p className="font-semibold">2. 예상 {result.policy.endTerm} 계산</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{formatShortDate(result.startDate)} + {result.policy.months}개월 − 1일 = {formatShortDate(result.endDate)}</p><p className="mt-1 text-xs text-muted">병역법 시행령의 입영일 기산 원칙에 따라 시작일을 복무기간에 포함합니다.</p></li><li><p className="font-semibold">3. 남은 기간과 진행률 계산</p><p className="mt-1 text-muted">기준일부터 종료일까지의 달력 기간과 전체 복무기간 대비 지난 날짜 비율을 계산합니다.</p><p className="mt-1 tabular-nums text-zinc-700 dark:text-zinc-300">{resultSummary(result)} · 진행률 {formatPercent(result.progressPercent)}</p></li></ol><p className="mt-5 text-xs leading-5 text-muted">날짜 경계 수는 두 날짜 사이의 간격입니다. 시작일과 종료일을 모두 세는 포함 일수는 {result.inclusiveServiceDays.toLocaleString("ko-KR")}일입니다.</p></SectionCard>
    </>}</div>
    <section className="mt-12 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">복무 제외일, 군기교육, 복무이탈, 중단·연장, 편입 전환과 조기전역은 반영하지 않습니다. 실제 날짜는 병적증명서와 소속 기관의 인사명령을 확인하세요. 입력값은 저장하거나 서버로 전송하지 않습니다.</section>
    <div className="mt-5"><FaqAccordion items={militaryDischargeFaqItems.map((item) => ({ ...item, answer: [...item.answer] }))} /></div>
  </div>;
}
