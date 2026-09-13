"use client";

import { useState } from "react";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { businessDaysFaqItems } from "./content";
import { MAX_SUPPORTED_DATE, MIN_SUPPORTED_DATE } from "./date-utils";
import { formatKoreanDate, formatShortDate } from "./formatting";
import { HOLIDAY_DATA_REVIEWED_AT, HOLIDAY_DATA_YEARS } from "./holidays";
import { calculateBusinessDays } from "./logic";
import type { BusinessDaySettings, BusinessDaysResult } from "./types";
import { validateBusinessDaysForm, type BusinessDaysMode, type RawBusinessDaysForm } from "./validation";

const initialForm: RawBusinessDaysForm = { mode: "range", startDate: "", endDate: "", baseDate: "", businessDays: "1" };
const initialSettings: BusinessDaySettings = { excludeSaturday: true, excludeSunday: true, excludePublicHolidays: true, excludeSubstituteHolidays: true, excludeTemporaryHolidays: true, excludeElectionDays: true, excludeLaborDay: true, customHolidays: [] };
const settingOptions = [
  ["excludeSaturday", "토요일"], ["excludeSunday", "일요일"], ["excludePublicHolidays", "법정공휴일"],
  ["excludeSubstituteHolidays", "대체공휴일"], ["excludeTemporaryHolidays", "임시공휴일"],
  ["excludeElectionDays", "선거일"], ["excludeLaborDay", "근로자의 날"],
] as const;

function SectionIcon({ name }: { name: "chart" | "formula" | "calendar" }) {
  const paths = { chart: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />, formula: <path d="M5 5h6L7 12l4 7H5m10-9h5m-2.5-2.5v5" />, calendar: <path d="M4 6h16v14H4zM8 3v6m8-6v6M4 10h16" /> };
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function BusinessDaysUi() {
  const [form, setForm] = useState(initialForm);
  const [settings, setSettings] = useState(initialSettings);
  const [includeStart, setIncludeStart] = useState(true); const [includeEnd, setIncludeEnd] = useState(true);
  const [direction, setDirection] = useState<1|-1>(1); const [includeBase, setIncludeBase] = useState(false);
  const [customDate, setCustomDate] = useState(""); const [errors, setErrors] = useState<Record<string,string>>({});
  const [result, setResult] = useState<BusinessDaysResult|null>(null);
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const savedForm = asShareRecord(root?.f); const savedSettings = asShareRecord(root?.g);
    const formKeys = ["mode","startDate","endDate","baseDate","businessDays"];
    const settingKeys = settingOptions.map(([key]) => key);
    if (!root || !savedForm || !savedSettings || !formKeys.every((key) => typeof savedForm[key] === "string") || !settingKeys.every((key) => typeof savedSettings[key] === "boolean") || !Array.isArray(savedSettings.customHolidays) || !savedSettings.customHolidays.every((date) => typeof date === "string" && date >= MIN_SUPPORTED_DATE && date <= MAX_SUPPORTED_DATE) || typeof root.is !== "boolean" || typeof root.ie !== "boolean" || typeof root.ib !== "boolean" || (root.d !== 1 && root.d !== -1)) return;
    const restoredForm = savedForm as unknown as RawBusinessDaysForm; const restoredSettings = savedSettings as unknown as BusinessDaySettings;
    if (validateBusinessDaysForm(restoredForm).length) return;
    try {
      const restoredResult = restoredForm.mode === "range" ? calculateBusinessDays({ mode: "range", startDate: restoredForm.startDate, endDate: restoredForm.endDate, includeStart: root.is, includeEnd: root.ie, settings: restoredSettings }) : calculateBusinessDays({ mode: "offset", baseDate: restoredForm.baseDate, businessDays: Number(restoredForm.businessDays), direction: root.d, includeBase: root.ib, settings: restoredSettings });
      setForm(restoredForm); setSettings(restoredSettings); setIncludeStart(root.is); setIncludeEnd(root.ie); setDirection(root.d); setIncludeBase(root.ib); setErrors({}); setResult(restoredResult);
    } catch { return; }
  });

  function clearResult() { setResult(null); }
  function setMode(mode: BusinessDaysMode) { setForm((previous) => ({ ...previous, mode })); setErrors({}); clearResult(); }
  function submit(event: React.FormEvent) {
    event.preventDefault(); const found = validateBusinessDaysForm(form);
    if (found.length) { setErrors(Object.fromEntries(found.map((error) => [error.field,error.message]))); setResult(null); return; }
    setErrors({});
    try {
      setResult(form.mode === "range" ? calculateBusinessDays({ mode: "range", startDate: form.startDate, endDate: form.endDate, includeStart, includeEnd, settings }) : calculateBusinessDays({ mode: "offset", baseDate: form.baseDate, businessDays: Number(form.businessDays), direction, includeBase, settings }));
    } catch (error) { setErrors({ businessDays: error instanceof Error ? error.message : "계산할 수 없습니다." }); setResult(null); }
  }
  function addCustomDate() {
    if (!customDate || customDate < MIN_SUPPORTED_DATE || customDate > MAX_SUPPORTED_DATE || settings.customHolidays.includes(customDate)) return;
    setSettings((previous) => ({ ...previous, customHolidays: [...previous.customHolidays, customDate].sort() })); setCustomDate(""); clearResult();
  }

  return <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
    <header className="max-w-3xl"><p className="mb-3 text-sm font-semibold text-primary">날짜</p><h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">영업일 계산기</h1><p className="mt-3 text-base leading-7 text-muted">주말과 대한민국 공휴일·대체공휴일을 제외한 영업일 수와 도착 날짜를 계산합니다.</p><p className="mt-2 text-sm font-medium text-primary">공휴일 지원 범위 {HOLIDAY_DATA_YEARS}</p></header>
    <form onSubmit={submit} className="mt-10 space-y-7 rounded-2xl border border-border bg-surface p-5 sm:p-8" noValidate>
      <fieldset><legend className="text-sm font-semibold">계산 방식</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-lg">{([ ["range","기간 내 영업일"], ["offset","영업일 기준 날짜 찾기"] ] as const).map(([value,label]) => <label key={value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold focus-within:ring-2 focus-within:ring-primary ${form.mode === value ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted"}`}><input type="radio" name="mode" value={value} checked={form.mode === value} onChange={() => setMode(value)} className="sr-only" />{label}</label>)}</div><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{form.mode === "range" ? "시작일부터 종료일까지 실제로 일할 수 있는 날이 며칠인지 계산합니다." : "기준일에서 주말과 공휴일을 건너뛰고, 지정한 영업일 수만큼 이전 또는 이후의 날짜를 찾습니다. 예를 들어 2026년 8월 14일의 1영업일 후는 주말·광복절·대체공휴일을 지나 8월 18일입니다."}</p></fieldset>
      {form.mode === "range" ? <div className="space-y-4"><div className="grid gap-5 sm:grid-cols-2">{([ ["startDate","시작일"], ["endDate","종료일"] ] as const).map(([field,label]) => <label key={field} className="min-w-0 text-sm font-semibold">{label} <span className="text-danger">*</span><input type="date" min={MIN_SUPPORTED_DATE} max={MAX_SUPPORTED_DATE} value={form[field]} aria-invalid={!!errors[field]} onChange={(event) => { setForm((previous) => ({ ...previous, [field]: event.target.value })); clearResult(); }} className="mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3" />{errors[field] && <span role="alert" className="mt-1.5 block font-normal text-danger">{errors[field]}</span>}</label>)}</div><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={includeStart} onChange={(e) => { setIncludeStart(e.target.checked); clearResult(); }} className="h-4 w-4 accent-primary" />시작일 포함</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeEnd} onChange={(e) => { setIncludeEnd(e.target.checked); clearResult(); }} className="h-4 w-4 accent-primary" />종료일 포함</label></div></div> : <div className="space-y-4"><div className="grid gap-5 sm:grid-cols-2"><label className="min-w-0 text-sm font-semibold">기준일 <span className="text-danger">*</span><input type="date" min={MIN_SUPPORTED_DATE} max={MAX_SUPPORTED_DATE} value={form.baseDate} onChange={(e) => { setForm((p) => ({ ...p, baseDate: e.target.value })); clearResult(); }} className="mt-2 block min-w-0 w-full rounded-xl border border-border bg-background px-3.5 py-3" />{errors.baseDate && <span role="alert" className="mt-1.5 block font-normal text-danger">{errors.baseDate}</span>}</label><label className="text-sm font-semibold">영업일 수 <span className="text-danger">*</span><input inputMode="numeric" value={form.businessDays} onChange={(e) => { setForm((p) => ({ ...p, businessDays: e.target.value.replace(/\D/g,"") })); clearResult(); }} className="mt-2 block w-full rounded-xl border border-border bg-background px-3.5 py-3" />{errors.businessDays && <span role="alert" className="mt-1.5 block font-normal text-danger">{errors.businessDays}</span>}</label></div><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="direction" checked={direction === 1} onChange={() => { setDirection(1); clearResult(); }} />이후</label><label className="flex items-center gap-2"><input type="radio" name="direction" checked={direction === -1} onChange={() => { setDirection(-1); clearResult(); }} />이전</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeBase} onChange={(e) => { setIncludeBase(e.target.checked); clearResult(); }} className="h-4 w-4 accent-primary" />기준일이 영업일이면 1일차로 포함</label></div></div>}
      <fieldset className="border-t border-border pt-6"><legend className="text-sm font-semibold">제외할 날짜</legend><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{settingOptions.map(([key,label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={settings[key]} disabled={(key === "excludeSubstituteHolidays" || key === "excludeTemporaryHolidays" || key === "excludeElectionDays") && !settings.excludePublicHolidays} onChange={(e) => { setSettings((p) => ({ ...p, [key]: e.target.checked })); clearResult(); }} className="h-4 w-4 accent-primary disabled:opacity-50" />{label}</label>)}</div><p className="mt-3 text-xs leading-5 text-muted">근로자의 날은 조직별 실제 근무 여부가 다를 수 있어 별도로 변경할 수 있습니다.</p></fieldset>
      <div className="border-t border-border pt-6"><label className="text-sm font-semibold">사용자 지정 휴무일 <span className="font-normal text-muted">(선택)</span></label><div className="mt-2 flex max-w-md gap-2"><input aria-label="사용자 지정 휴무일" type="date" min={MIN_SUPPORTED_DATE} max={MAX_SUPPORTED_DATE} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-3" /><button type="button" onClick={addCustomDate} className="rounded-xl border border-border px-4 text-sm font-semibold">추가</button></div>{settings.customHolidays.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{settings.customHolidays.map((date) => <li key={date} className="flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs">{formatShortDate(date)}<button type="button" aria-label={`${date} 삭제`} onClick={() => { setSettings((p) => ({ ...p, customHolidays: p.customHolidays.filter((item) => item !== date) })); clearResult(); }}>×</button></li>)}</ul>}</div>
      <div className="flex flex-wrap gap-3"><button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">영업일 계산하기</button><button type="button" onClick={() => { setForm({ ...initialForm, startDate: "2026-08-14", endDate: "2026-08-18" }); setSettings(initialSettings); setIncludeStart(true); setIncludeEnd(true); setResult(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">샘플 값</button><button type="button" onClick={() => { setForm(initialForm); setSettings(initialSettings); setResult(null); setErrors({}); }} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted">초기화</button></div>
    </form>

    <ShareActions className="mt-5" title="영업일 계산기" text={result ? (result.mode === "range" ? `계산 결과는 영업일 ${result.businessDays.toLocaleString("ko-KR")}일입니다.` : `${result.businessDays}영업일 ${result.direction === 1 ? "후" : "전"} 날짜는 ${formatKoreanDate(result.arrivalDate)}입니다.`) : "주말과 공휴일을 제외한 영업일 수와 날짜를 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form, g: settings, is: includeStart, ie: includeEnd, d: direction, ib: includeBase }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} />
    <div aria-live="polite" className="mt-8 space-y-5">{result && <>
      <section className="rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8"><p className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">{result.mode === "range" ? "기간 내 영업일" : `${result.businessDays}영업일 ${result.direction === 1 ? "후" : "전"}`}</p><p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">{result.mode === "range" ? `${result.businessDays.toLocaleString("ko-KR")}일` : formatKoreanDate(result.arrivalDate)}</p><p className="mt-4 text-sm dark:text-foreground">전체 달력 {result.mode === "range" ? result.totalCandidateDays : result.calendarDaysTraversed}일 중 {result.excludedDays}일을 제외했습니다.</p></section>
      <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}><dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"><div><dt className="text-muted">제외 날짜</dt><dd className="mt-1 font-semibold">{result.excludedDays}일</dd></div><div><dt className="text-muted">토요일</dt><dd className="mt-1 font-semibold">{result.reasonCounts.saturday}일</dd></div><div><dt className="text-muted">일요일</dt><dd className="mt-1 font-semibold">{result.reasonCounts.sunday}일</dd></div><div><dt className="text-muted">공휴일</dt><dd className="mt-1 font-semibold">{result.reasonCounts.holiday}일</dd></div></dl><p className="mt-3 text-xs text-muted">사유가 겹치는 날짜는 한 번만 제외하므로 사유별 수의 합이 제외 날짜보다 클 수 있습니다.</p></SectionCard>
      <SectionCard title="제외된 날짜" icon={<SectionIcon name="calendar" />}>{result.excluded.length ? <ol className="divide-y divide-border">{result.excluded.map((day) => <li key={day.date} className="grid gap-1 py-3 text-sm sm:grid-cols-[9rem_1fr]"><span className="font-medium tabular-nums">{formatShortDate(day.date)} ({day.weekday})</span><span className="text-muted">{day.reasons.join(" · ")}</span></li>)}</ol> : <p className="text-sm text-muted">제외된 날짜가 없습니다.</p>}</SectionCard>
      <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}><p className="text-sm leading-6 text-muted">{result.mode === "range" ? `계산 대상 ${result.totalCandidateDays}일에서 활성화된 제외 규칙에 해당하는 고유 날짜 ${result.excludedDays}일을 빼서 영업일 ${result.businessDays}일을 계산했습니다.` : `기준일부터 ${result.direction === 1 ? "이후" : "이전"} 방향으로 이동하며 영업일만 ${result.businessDays}일 세어 ${formatShortDate(result.arrivalDate)}에 도착했습니다.`}</p><p className="mt-3 text-xs text-muted">대한민국 달력 날짜 기준이며 시간·업무 마감 시각은 반영하지 않습니다.</p></SectionCard>
    </>}</div>
    <section className="mt-12 rounded-2xl bg-surface-subtle p-6 text-sm leading-7 text-muted">공휴일 데이터는 {HOLIDAY_DATA_YEARS}년 월력요항을 기준으로 {HOLIDAY_DATA_REVIEWED_AT}에 검토했습니다. 아직 발표되지 않은 미래 임시공휴일과 회사·은행·법원별 별도 휴무 규칙은 반영되지 않습니다. 입력값은 저장하거나 서버로 전송하지 않습니다.</section>
    <div className="mt-5"><FaqAccordion items={businessDaysFaqItems.map((item) => ({ ...item, answer: [...item.answer] }))} /></div>
  </div>;
}
