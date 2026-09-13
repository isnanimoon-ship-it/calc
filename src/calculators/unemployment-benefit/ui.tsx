"use client";

/**
 * 실업급여(구직급여) 계산기 — 입력/결과 UI.
 *
 * docs/DESIGN_SYSTEM.md 공통 화면 순서(소개 → 사용 방법 → 입력 → 결과 → 계산 근거 → 정책 안내
 * → FAQ)를 따르되, FAQ는 이번 작업 지시(FORMULA.md에 FAQ 콘텐츠가 없고 SPEC.md에도 FAQ
 * 요구사항이 없음 — Must/Should Have 어디에도 없다)에 따라 생략한다.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1은 `voluntaryLeaveAcknowledged` 체크박스를
 * 체크하기 전에는 계산 자체를 수행하지 않는 게이팅이 이 화면의 핵심 규칙이었다. SPEC.md v2
 * "설계상 핵심 결정"이 그 게이팅을 제거함에 따라, 이제는 유효성 검증만 통과하면 항상 계산
 * 결과를 보여준다 — "비자발적 이직으로 인정된다고 가정한 금액"이라는 전제는 결과 화면의 고지
 * 문구로만 알린다(아래 핵심 결과 카드·정책 안내 섹션 참고). 계산 공식 자체는 이 파일에 두지
 * 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다(docs/ARCHITECTURE.md "계산 로직 /
 * UI 분리").
 *
 * 소개 문구는 tasks/unemployment-benefit/SPEC.md "목적" 절을 거의 그대로 옮겼다 — FORMULA.md에는
 * (severance-pay와 달리) 별도 "소개 문구" 절이 없으므로 SPEC.md의 사용자 대상 설명을 그대로
 * 재사용했다(새로 지어내지 않음).
 */

import Link from "next/link";
import { useId, useState } from "react";
import { diffDaysUtc, parseIsoDateUtc } from "@/src/lib/date-calc";
import { calculateUnemploymentBenefit } from "./logic";
import {
  validateUnemploymentBenefitInput,
  getMaxAllowedDate,
  MIN_ALLOWED_DATE,
  type RawUnemploymentBenefitFormInput,
  type ValidationFieldError,
} from "./validation";
import {
  formatAge,
  formatBenefitDailyAmountDisplay,
  formatDays,
  formatInsuredPeriodDays,
  formatRatio,
  formatWon,
  formatWonDetailed,
} from "./formatting";
import type {
  UnemploymentBenefitCalcInput,
  UnemploymentBenefitEligibleResult,
  UnemploymentBenefitResult,
} from "./types";
import { IntroSection } from "@/components/calculator/IntroSection";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { SectionCard } from "@/components/calculator/SectionCard";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";

const EMPTY_FORM: RawUnemploymentBenefitFormInput = {
  leaveDate: "",
  ageAtLeave: "",
  insuredStartDate: "",
  isUltraShortTimeWorker: false,
  isDisabled: false,
  wage3m: "",
};

/**
 * DESIGN_SYSTEM.md "Reset / Sample" — FORMULA.md 검증 예제 3(상한·하한 사이, 라운드넘버
 * 케이스)을 그대로 가져왔다.
 *
 * `insuredStartDate="2020-08-02"`는 (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응으로
 * `insuredPeriodDays` 직접 입력을 날짜 두 개 입력으로 대체하면서) `leaveDate`(2026-08-01)와의
 * 달력일수 차이가 정확히 예제 3의 2,190일(6년, "5년 이상 10년 미만" 구간)이 되도록 역산해
 * 구성했다(Node로 `diffDaysUtc` 재현해 확인) — 예제 3의 기대값 자체는 전혀 바뀌지 않는다.
 */
const SAMPLE_FORM: RawUnemploymentBenefitFormInput = {
  leaveDate: "2026-08-01",
  ageAtLeave: "52",
  insuredStartDate: "2020-08-02",
  isUltraShortTimeWorker: false,
  isDisabled: false,
  wage3m: "10,304,000",
};

/**
 * 입사일·퇴사일 두 값이 모두 유효한 형식이고 순서가 올바를 때만 실시간으로
 * 가입기간(일)을 계산해 화면에 미리 보여준다(제출 전 참고용 미리보기).
 *
 * (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응) 이 함수는 `validation.ts`의 실제
 * 검증/계산 경로와 완전히 분리된, ui.tsx 전용의 얕은 미리보기다 — 오류 메시지 생성이나
 * `UnemploymentBenefitCalcInput` 생성에는 관여하지 않는다(그 책임은 여전히 validation.ts에만
 * 있다). `date-calc.ts`의 `diffDaysUtc`/`parseIsoDateUtc`를 그대로 재사용해 계산 로직 자체를
 * 중복 구현하지 않는다.
 */
function computeLiveInsuredPeriodDays(
  insuredStartDate: string | undefined,
  leaveDate: string | undefined,
): number | undefined {
  if (!insuredStartDate || !leaveDate) return undefined;
  if (insuredStartDate > leaveDate) return undefined;
  const start = parseIsoDateUtc(insuredStartDate);
  const end = parseIsoDateUtc(leaveDate);
  if (!start || !end) return undefined;
  return diffDaysUtc(start, end);
}

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";

interface FieldConfig {
  name: "leaveDate" | "ageAtLeave" | "insuredStartDate" | "wage3m";
  label: string;
  unit: string;
  required: boolean;
  helpText?: string;
  inputMode: "numeric" | "decimal";
}

// (2026-09-04 UI 문구 변경) 입력 항목 명칭을 일반 사용자에게 익숙한 표현으로 바꾸고
// 시간 순서(입사 → 퇴사 → 현재)대로 재배열했다: "고용보험 가입 시작일" → "입사일",
// "이직일" → "퇴사일", "이직일 현재 만 나이" → "현재 만 나이". 계산 로직·검증(logic.ts /
// validation.ts)과 필드 식별자(name)는 그대로이며 화면 표시 문구만 변경한다.
const FIELDS: FieldConfig[] = [
  {
    name: "insuredStartDate",
    label: "입사일",
    unit: "",
    required: true,
    helpText:
      "퇴사일 기준으로 끊기지 않고 이어진 고용보험 가입이 시작된 날짜를 입력하면 가입기간이 자동으로 계산됩니다(직장을 옮겼더라도 가입이 끊기지 않았다면 최초 가입일을, 가입이 끊긴 적이 있다면 가장 최근 재가입일을 입력해 주세요). 실제 근무일·유급휴일만 계산되는 '피보험단위기간'과는 다를 수 있습니다.",
    inputMode: "numeric",
  },
  {
    name: "leaveDate",
    label: "퇴사일",
    unit: "",
    required: true,
    helpText: "근로관계가 종료되는(된) 날짜를 입력해 주세요. 예정 퇴사일도 입력할 수 있습니다.",
    inputMode: "numeric",
  },
  {
    name: "ageAtLeave",
    label: "현재 만 나이",
    unit: "세",
    required: true,
    helpText: "만 나이 기준(2023년 만 나이 통일법 이후 통용되는 방식)입니다.",
    inputMode: "numeric",
  },
  {
    name: "wage3m",
    label: "퇴사 전 3개월 임금총액",
    unit: "원",
    required: true,
    helpText:
      "퇴사일 이전 3개월간 지급된 임금총액(세전, 근로기준법상 평균임금 산정 기준)을 입력해 주세요.",
    inputMode: "numeric",
  },
];

const INTRO_PARAGRAPHS = [
  '이 계산기는 퇴사(예정)한 근로자가, 고용보험법에 근거해 하루당 구직급여 지급액(구직급여일액)과 소정급여일수, 그리고 그 둘을 곱한 총 예상 수급액을 별도의 노무 지식 없이 스스로 대략 확인할 수 있게 돕는 도구입니다.',
  '"내가 받을 수 있는지 없는지"에 대한 최종 법적 판정이 아니라, "비자발적 이직으로 수급자격을 인정받는다고 가정했을 때 금액이 얼마인지"를 보여주는 참고용 추정 도구입니다.',
];

const INTRO_HIGHLIGHTS = [
  "입사일, 퇴사일, 현재 만 나이, 퇴사 전 3개월 임금총액만 입력하면 계산됩니다.",
  "구직급여일액(1일 지급액)·소정급여일수 산출 근거와 근거 법령까지 함께 보여줍니다.",
  "실제 수급자격 인정 여부는 관할 고용센터가 최종 심사로 결정합니다 — 이 계산기의 결과는 참고용 추정치입니다.",
];

const USAGE_STEPS = [
  {
    title: "입사일·퇴사일·나이 입력",
    description:
      "입사일, 퇴사일, 현재 만 나이를 입력합니다. 입사일과 퇴사일 두 날짜만 입력하면 가입기간(일)은 자동으로 계산됩니다.",
  },
  {
    title: "3개월 임금총액 입력",
    description: "퇴사 전 3개월간 받은 임금총액을 입력합니다.",
  },
  {
    title: "결과·계산 근거 확인",
    description:
      "계산하기 버튼을 누르면 예상 구직급여일액·소정급여일수·총 예상 지급액과 함께 산출 근거, 근거 법령을 단계별로 확인할 수 있습니다.",
  },
];

function SectionIcon({ name }: { name: "chart" | "document" | "formula" | "info" | "warning" }) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    // (2026-09-02 Optimizer 수정 — UX/UI Critic Low "미충족 vs 미체크 시각적 톤 구분" 대응)
    // 신규 아이콘. docs/DESIGN_SYSTEM.md "아이콘" 규칙(같은 stroke 스타일의 인라인 SVG, 외부
    // 아이콘 라이브러리 미사용)을 그대로 따른 경고 삼각형(느낌표)이다.
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

interface FormulaStep {
  label: string;
  legalBasis: string;
  description: string;
}

/**
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 "계산 근거 화면 표현 원칙" 대응) 각 단계 설명은
 * 서술형 안내문("~해야 하며 ~해서 계산을 진행합니다" 류)이 아니라 수식과 실제 숫자만 보여준다.
 * 1단계는 요건 판정에 실제 입력값(`insuredPeriodDays`)이 필요한데, 그 값은
 * `UnemploymentBenefitEligibleResult`가 아니라 `UnemploymentBenefitCalcInput`(적용된 입력값)에만
 * 있으므로 이 함수가 별도 인자로 받는다. 6단계는 표시용 반올림값과 계산용 완전정밀도값이
 * 다르다는 내부 구현 설명을 화면 문구에서 뺐다 — 그 사실 자체는 formatting.ts
 * `formatBenefitDailyAmountDisplay` 주석에 이미 기록돼 있다.
 */
function buildFormulaSteps(
  result: UnemploymentBenefitEligibleResult,
  insuredPeriodDays: number,
): FormulaStep[] {
  return [
    {
      label: "1. 피보험기간 180일 요건 판정",
      legalBasis: "고용보험법 제40조제1항제1호",
      description: `가입기간 ${formatDays(insuredPeriodDays)} ≥ 180일(요건) → 충족`,
    },
    {
      label: "2. 평균임금 산정기간 총일수 산출",
      legalBasis: "근로기준법 제2조제1항제6호(평균임금 산정기간)",
      description: `퇴사일 이전 3개월의 달력일수 = ${formatDays(result.baseDays)}`,
    },
    {
      label: "3. 1일 평균임금 산출",
      legalBasis: "근로기준법 제2조제1항제6호",
      description: `3개월 임금총액 ÷ 산정기간 총일수 = ${formatWonDetailed(result.averageDailyWage)}`,
    },
    {
      label: "4. 상한/하한 적용 전 구직급여일액 산출",
      legalBasis: "고용보험법 제46조제1항제1호",
      description: `1일 평균임금 × ${formatRatio(0.6)} = ${formatWonDetailed(result.baseBenefitDailyAmount)}`,
    },
    {
      label: "5. 해당 연도 상한액·하한액 조회",
      legalBasis: "고용보험법 제45조제5항·제46조제1항제2호, 시행령 제68조",
      description: `최저구직급여일액(하한) = ${formatWon(result.minBenefitDailyAmount)}, 구직급여일액 상한액 = ${formatWon(result.maxBenefitDailyAmount)}`,
    },
    {
      label: "6. 구직급여일액 확정",
      legalBasis: "고용보험법 제46조",
      description: `clamp(상한/하한 적용 전 금액, 하한, 상한) = ${formatWonDetailed(result.benefitDailyAmount)}`,
    },
    {
      label: "7. 연령 구간·가입기간 구간 판정",
      legalBasis: "고용보험법 제50조제1항, 별표1",
      description: `연령 구간: ${result.ageBandForTable} / 가입기간 구간: ${result.insuredPeriodBand}`,
    },
    {
      label: "8. 소정급여일수 조회",
      legalBasis: "고용보험법 제50조제1항, 별표1",
      description: `소정급여일수 = ${formatDays(result.prescribedBenefitDays)}`,
    },
    {
      label: "9. 총 예상 지급액 산출",
      legalBasis: "고용보험법 제46조·제50조제1항",
      description: `${formatWonDetailed(result.benefitDailyAmount)} × ${formatDays(result.prescribedBenefitDays)} = ${formatWon(result.totalExpectedBenefit)}`,
    },
  ];
}

export default function UnemploymentBenefitCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawUnemploymentBenefitFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<UnemploymentBenefitResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<UnemploymentBenefitCalcInput | null>(null);
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const saved = asShareRecord(root?.f);
    const stringKeys = ["leaveDate","ageAtLeave","insuredStartDate","wage3m"];
    if (!saved || !stringKeys.every((key) => typeof saved[key] === "string") || typeof saved.isUltraShortTimeWorker !== "boolean" || typeof saved.isDisabled !== "boolean") return;
    const restored = saved as unknown as RawUnemploymentBenefitFormInput; const validation = validateUnemploymentBenefitInput(restored); if (!validation.success) return;
    setForm(restored); setErrors([]); setAppliedInput(validation.data); setResult(calculateUnemploymentBenefit(validation.data));
  });

  // (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응) 입사일·퇴사일을 입력하는 동안
  // 가입기간(일)이 자동으로 얼마나 계산되는지 실시간으로 미리 보여준다 — 제출 전 참고용
  // 미리보기일 뿐, 실제 검증/계산은 여전히 validation.ts/logic.ts가 담당한다.
  const liveInsuredPeriodDays = computeLiveInsuredPeriodDays(
    form.insuredStartDate,
    form.leaveDate,
  );

  function errorFor(field: FieldConfig["name"]): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleChange(field: FieldConfig["name"]) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null); setAppliedInput(null);
    };
  }

  /** 금액(원) 입력 필드 실시간 천 단위 콤마 표시(severance-pay `handleAmountChange`와 동일 패턴). */
  function handleAmountChange(field: FieldConfig["name"]) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = event.target.value.replace(/[^0-9]/g, "");
      const formatted = digitsOnly ? Number(digitsOnly).toLocaleString("ko-KR") : "";
      setForm((prev) => ({ ...prev, [field]: formatted }));
      setResult(null); setAppliedInput(null);
    };
  }

  function handleCheckboxChange(field: "isUltraShortTimeWorker" | "isDisabled") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.checked }));
      setResult(null); setAppliedInput(null);
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateUnemploymentBenefitInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }

    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateUnemploymentBenefit(validation.data));
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

  function renderField(field: FieldConfig) {
    const inputId = `${formId}-${field.name}`;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;
    const previewId = `${inputId}-preview`;
    const message = errorFor(field.name);
    const isDate = field.name === "leaveDate" || field.name === "insuredStartDate";
    const isAmount = field.unit === "원";
    const value = form[field.name] ?? "";
    const isInsuredStartDate = field.name === "insuredStartDate";

    return (
      <div key={field.name}>
        <label htmlFor={inputId} className={LABEL_CLASS}>
          {field.label}
          {field.required ? (
            <span aria-hidden="true" className="text-red-600 dark:text-red-400">
              {" "}
              *
            </span>
          ) : (
            <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
          )}
          {field.unit && (
            <span className="ml-1 text-xs font-normal text-muted">
              ({field.unit})
            </span>
          )}
        </label>
        <input
          id={inputId}
          type={isDate ? "date" : "text"}
          inputMode={isDate ? undefined : field.inputMode}
          // docs/DESIGN_SYSTEM.md "날짜 입력" 규칙 — severance-pay와 동일하게 min/max를
          // 반드시 지정한다(Chromium 계열 브라우저의 연도 자릿수 버그 방어).
          min={isDate ? MIN_ALLOWED_DATE : undefined}
          max={isDate ? getMaxAllowedDate() : undefined}
          value={value as string}
          onChange={isAmount ? handleAmountChange(field.name) : handleChange(field.name)}
          aria-required={field.required}
          aria-invalid={message ? true : undefined}
          aria-describedby={
            [
              message ? errorId : null,
              field.helpText ? helpId : null,
              isInsuredStartDate ? previewId : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={INPUT_CLASS}
          placeholder={field.name === "wage3m" ? "예: 9,000,000" : undefined}
        />
        {field.helpText && (
          <p id={helpId} className="mt-1 text-xs text-muted">
            {field.helpText}
          </p>
        )}
        {isInsuredStartDate && (
          <p id={previewId} className="mt-1.5 text-xs font-medium text-primary" aria-live="polite">
            {liveInsuredPeriodDays !== undefined
              ? `자동 계산된 가입기간: ${formatInsuredPeriodDays(liveInsuredPeriodDays)}`
              : "입사일과 퇴사일을 모두 입력하면 가입기간이 자동으로 계산되어 여기 표시됩니다."}
          </p>
        )}
        {message && (
          <p id={errorId} role="alert" className={ERROR_CLASS}>
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-3xl">
        <Link href="/categories/labor" className="mb-3 inline-block text-sm font-semibold text-primary hover:underline">노동/근로</Link>
        <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
          실업급여(구직급여) 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          입사일·퇴사일·나이·최근 임금을 입력하면 예상 구직급여일액과 총 예상 지급액, 산출
          근거를 바로 확인할 수 있습니다.
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

        <div className="space-y-5">{FIELDS.map((field) => renderField(field))}</div>

        {/* 초단시간근로자 / 장애인 여부 — 선택 입력 */}
        <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isUltraShortTimeWorker === true}
              onChange={handleCheckboxChange("isUltraShortTimeWorker")}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 dark:border-white/30"
            />
            <span>
              초단시간근로자입니다
              <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
              <span className="block text-xs text-muted">
                4주 평균 주 소정근로시간이 15시간 미만인 경우
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDisabled === true}
              onChange={handleCheckboxChange("isDisabled")}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 dark:border-white/30"
            />
            <span>
              장애인입니다
              <span className="ml-1 text-xs font-normal text-muted">(선택)</span>
              <span className="block text-xs text-muted">
                「장애인고용촉진 및 직업재활법」에 따라 등록된 경우
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            구직급여 계산하기
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

      <ShareActions className="mt-5" title="실업급여 계산기" text={result ? (result.eligible ? `총 예상 구직급여는 ${formatWon(result.totalExpectedBenefit)}입니다.` : "입력한 가입기간은 구직급여 180일 요건에 미달합니다.") : "입사일·퇴사일과 임금으로 예상 구직급여를 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} onKakaoShare={kakaoShareAdapter} />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && !result.eligible && (
          <section className="rounded-2xl border border-warning-border bg-warning-surface p-6 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-border/40 text-amber-800 dark:text-amber-300">
                <SectionIcon name="warning" />
              </span>
              <h2 className="text-lg font-semibold">수급자격 요건 미충족</h2>
            </div>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              구직급여는 고용보험 가입기간(피보험단위기간)이 180일 이상이어야 받을 수 있습니다.
              입력하신 가입기간으로는 이 요건을 충족하지 못해 금액을 계산하지 않았습니다.
            </p>
            <p className="mt-3 text-xs text-muted">
              근거: 고용보험법 제40조제1항제1호
            </p>
          </section>
        )}

        {result && result.eligible && appliedInput && (
          <>
            {/* 핵심 결과 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">총 예상 지급액</h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.totalExpectedBenefit)}
              </p>
              <p className="mt-3 text-sm opacity-75 dark:text-foreground dark:opacity-100">
                구직급여일액 {formatBenefitDailyAmountDisplay(result.benefitDailyAmount)} × 소정급여일수{" "}
                {formatDays(result.prescribedBenefitDays)}
              </p>
              <p className="mt-3 text-xs opacity-75 dark:text-muted dark:opacity-100">
                이 금액은 비자발적 이직(또는 정당한 사유 있는 자진퇴사)으로 수급자격이
                인정된다고 가정했을 때의 예상 금액입니다. 실제 수급자격 여부와 금액은
                고용센터의 최종 심사로 결정됩니다.
              </p>
            </section>

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <div className="space-y-4">
              <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">구직급여일액</dt>
                    <dd className="text-sm font-medium">{formatBenefitDailyAmountDisplay(result.benefitDailyAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">소정급여일수</dt>
                    <dd className="text-sm font-medium">{formatDays(result.prescribedBenefitDays)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">1일 평균임금</dt>
                    <dd className="text-sm font-medium">{formatWonDetailed(result.averageDailyWage)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">평균임금 산정기간 총일수</dt>
                    <dd className="text-sm font-medium">{formatDays(result.baseDays)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">연령 구간</dt>
                    <dd className="text-sm font-medium">{result.ageBandForTable}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">가입기간 구간</dt>
                    <dd className="text-sm font-medium">{result.insuredPeriodBand}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">최저구직급여일액(하한)</dt>
                    <dd className="text-sm font-medium">{formatWon(result.minBenefitDailyAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">구직급여일액 상한액</dt>
                    <dd className="text-sm font-medium">{formatWon(result.maxBenefitDailyAmount)}</dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">퇴사일</dt>
                    <dd>{appliedInput.leaveDate}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">현재 만 나이</dt>
                    <dd>{formatAge(appliedInput.ageAtLeave)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">고용보험 가입기간</dt>
                    <dd>{formatInsuredPeriodDays(appliedInput.insuredPeriodDays)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">3개월 임금총액</dt>
                    <dd>{formatWon(appliedInput.wage3m)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">초단시간근로자 여부</dt>
                    <dd>{appliedInput.isUltraShortTimeWorker ? "해당" : "해당 없음"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted">장애인 여부</dt>
                    <dd>{appliedInput.isDisabled ? "해당" : "해당 없음"}</dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
                <ol className="space-y-4">
                  {buildFormulaSteps(result, appliedInput.insuredPeriodDays).map((step) => (
                    <li key={step.label} className="text-sm">
                      <p className="font-medium">{step.label}</p>
                      <p className="mt-0.5 text-xs text-muted">근거: {step.legalBasis}</p>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{step.description}</p>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              {appliedInput.isUltraShortTimeWorker && (
                <SectionCard title="초단시간근로자 안내" icon={<SectionIcon name="info" />}>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    귀하는 초단시간근로자(4주 평균 주 소정근로시간 15시간 미만)에 해당합니다.
                    180일 가입 요건을 판정하는 기준기간이 일반 근로자의 18개월이 아니라
                    24개월로 연장됩니다.
                  </p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    이 계산기가 보여드리는 금액·소정급여일수는 이 사실로 달라지지 않으며,
                    실제 자격 판정 시에는 고용센터가 24개월 기준기간을 적용해 다시 확인합니다.
                  </p>
                </SectionCard>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="필수 입력은 입사일·퇴사일·나이·3개월 임금총액입니다."
          steps={USAGE_STEPS}
        />
        <IntroSection
          title="실업급여(구직급여) 계산기란 무엇인가요?"
          paragraphs={INTRO_PARAGRAPHS}
          highlights={INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── 정책 안내 ────────────────────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        <p>
          이 계산기는 고용보험법 제40조·제45조·제46조·제49조·제50조(별표1)를 기준으로 한
          구직급여(1일 지급액과 총 예상 지급액) 예상액을 계산합니다. 이 계산기는
          비자발적 이직으로 수급자격이 인정된다고 가정한 예상 금액이며, 실제 수급자격
          여부·금액은 고용센터의 최종 심사로 결정됩니다.
        </p>
        <p>
          다음과 같은 사유로 이직한 경우 일반적으로 비자발적 이직에 해당합니다: 권고사직 등
          회사 사정, 계약기간 만료, 폐업, 정당한 사유 있는 자진퇴사 등.
        </p>
        <p>
          가입기간은 실제 근무일·유급휴일만 계산되는 &apos;피보험단위기간&apos;과 다를 수
          있으며, 무급 결근·휴직 기간이 많았다면 실제 요건 충족 여부가 이 계산과 달라질 수
          있습니다. 정확한 판정은 고용센터에서 확인하세요.
        </p>
        <p>
          수급자격 인정일로부터 실제 지급 개시까지 일반적으로 7일의 대기기간이 있습니다.
          구체적인 지급 일정은 고용센터 안내를 따릅니다.
        </p>
        <p>
          구직급여는 비과세이므로 별도의 세금 계산은 하지 않습니다.
        </p>
        <p>
          기준 연도 2026년 수치(최저임금, 구직급여 상한액·하한액 등)를 사용하며, 이 수치는
          매년 갱신될 수 있습니다.
        </p>
      </section>
    </div>
  );
}
