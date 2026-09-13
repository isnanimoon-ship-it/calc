"use client";

/**
 * 퇴직금 계산기 — 입력/결과 UI.
 *
 * docs/DESIGN_SYSTEM.md 공통 화면 순서(입력 → 결과 → 계산 근거 → 정책 안내)는 그대로 유지하되,
 * SPEC.md v2 요구사항에 따라 앞뒤로 소개(IntroSection)·사용 안내(UsageGuide)·FAQ(FaqAccordion)를
 * 추가한다(docs/ARCHITECTURE.md "SEO/사이트맵" 페이지 구조: 계산기 → 결과 → 사용 방법 → 공식 →
 * 예제 → FAQ와 대응):
 *
 *   소개(IntroSection) → 사용 안내(UsageGuide) → 입력 → 결과 → 계산 근거(SectionCard) →
 *   정책 안내 → FAQ(FaqAccordion)
 *
 * 계산 공식 자체는 이 파일에 두지 않는다(logic.ts). 이 파일은 폼 상태 관리와 표시만 담당한다
 * (docs/ARCHITECTURE.md "계산 로직 / UI 분리"). 소개 문구·FAQ 답변은 tasks/severance-pay/
 * FORMULA.md "소개 문구" / "FAQ 콘텐츠" 절을 그대로 옮긴 것이며 새로 지어내지 않았다.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { calculateSeverancePay } from "./logic";
import {
  validateSeverancePayInput,
  getMaxAllowedDate,
  MIN_ALLOWED_DATE,
  type RawSeverancePayFormInput,
  type ValidationFieldError,
} from "./validation";
import {
  formatAverageDailyWageDetailed,
  formatDays,
  formatHours,
  formatWon,
} from "./formatting";
import type { SeverancePayInput, SeverancePayResult } from "./types";
import { IntroSection } from "@/components/calculator/IntroSection";
import { UsageGuide } from "@/components/calculator/UsageGuide";
import { SectionCard } from "@/components/calculator/SectionCard";
import { FaqAccordion } from "@/components/calculator/FaqAccordion";
import { ShareActions } from "@/components/calculator/ShareActions";
import { asShareRecord, useCalculatorShare } from "@/components/calculator/useCalculatorShare";
import { buildStateShareUrl } from "@/src/lib/share";
import { kakaoShareAdapter } from "@/src/lib/kakao-share";

const EMPTY_FORM: RawSeverancePayFormInput = {
  hireDate: "",
  retireDate: "",
  weeklyScheduledHours: "",
  underFifteenHoursDeclared: false,
  wage3m: "",
  bonus12m: "",
  annualLeavePay12m: "",
  ordinaryDailyWage: "",
};

/**
 * DESIGN_SYSTEM.md "Reset / Sample" — 산식 정합성 확인용으로 FORMULA.md 예제 3에서 그대로 가져온
 * 값이다. 주당 소정근로시간은 의도적으로 비워 둔다 — v2의 핵심 변경(기본값을 "정규 근로자로
 * 가정"으로 두고 입력을 생략 가능하게 함, FORMULA.md "주당 소정근로시간 기본값 정책")을 샘플
 * 값에서도 그대로 보여주기 위함이다.
 */
const SAMPLE_FORM: RawSeverancePayFormInput = {
  hireDate: "2023-01-01",
  retireDate: "2024-01-01",
  weeklyScheduledHours: "",
  underFifteenHoursDeclared: false,
  wage3m: "9,200,000",
  bonus12m: "",
  annualLeavePay12m: "",
  ordinaryDailyWage: "",
};

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/10";
const LABEL_CLASS = "text-sm font-semibold tracking-tight";
const ERROR_CLASS = "mt-1.5 text-sm text-danger";

interface FieldConfig {
  name: keyof RawSeverancePayFormInput;
  label: string;
  unit: string;
  required: boolean;
  helpText?: string;
  inputMode: "numeric" | "decimal";
}

/** 주당 소정근로시간은 v2부터 이 목록에 포함하지 않고 별도 블록(체크박스+선택 입력)으로 다룬다. */
const FIELDS: FieldConfig[] = [
  {
    name: "hireDate",
    label: "입사일",
    unit: "",
    required: true,
    inputMode: "numeric",
  },
  {
    name: "retireDate",
    label: "퇴사일",
    unit: "",
    required: true,
    helpText: "마지막 근무일의 다음날 기준으로 입력해 주세요.",
    inputMode: "numeric",
  },
  {
    name: "wage3m",
    label: "퇴사일 이전 3개월 임금총액",
    unit: "원",
    required: true,
    helpText:
      "퇴사일 이전 3개월간 급여명세서에 통화로 지급된 금액의 합계(기본급+제수당 등 세전 지급총액. 일시적으로 지급된 금품·현물 지급은 제외)를 입력해 주세요. 이 3개월 안에 지급된 상여금이 있다면 이 금액에 포함하고, 그 외 기간의 상여금은 아래 '12개월 상여금 총액'에 별도로 입력해 상여금이 이중 계산되지 않도록 해 주세요.",
    inputMode: "numeric",
  },
  {
    name: "bonus12m",
    label: "퇴사일 이전 12개월 상여금 총액",
    unit: "원",
    required: false,
    helpText:
      "선택 입력. 위 3개월 임금총액에 이미 포함한 상여금은 제외하고, 그 밖의 기간에 받은 상여금 총액만 입력해 주세요. 미입력 시 0원으로 처리됩니다.",
    inputMode: "numeric",
  },
  {
    name: "annualLeavePay12m",
    label: "퇴사일 이전 12개월 연차수당 총액",
    unit: "원",
    required: false,
    helpText: "선택 입력. 미입력 시 0원으로 처리됩니다.",
    inputMode: "numeric",
  },
  {
    name: "ordinaryDailyWage",
    label: "1일 통상임금",
    unit: "원",
    required: false,
    helpText:
      "선택 입력. 평균임금과 비교해 더 큰 값을 기준임금으로 사용합니다. 미입력 시 비교를 생략합니다.",
    inputMode: "numeric",
  },
];

/**
 * "소개" 섹션 문구 — tasks/severance-pay/FORMULA.md "소개 문구" 절 원문과 동일한 내용을
 * 문단(핵심 소개)과 highlights(핵심 포인트 불릿)로 재구성했다(Critic v2 Medium M1 대응).
 * 새로운 사실을 추가하지 않고, FORMULA.md 원문 한 문단에 이미 있던 문장들을 그대로 나눠
 * 옮겼을 뿐이다 — IntroSection이 지원하는 `highlights` prop을 실제로 활용해 시각적 계층을
 * 만든다.
 */
const INTRO_PARAGRAPHS = [
  '이 퇴직금 계산기는 근로자퇴직급여 보장법과 근로기준법에 근거해 법정 퇴직금(일시금) 예상액을 계산해 줍니다. 퇴직을 앞두었거나 이미 퇴직해 "내가 받을 금액이 맞는지" 직접 확인하고 싶은 일반 근로자를 위한 도구입니다.',
];

const INTRO_HIGHLIGHTS = [
  "입사일·퇴사일과 최근 3개월간 지급된 임금총액만 입력하면 계산됩니다.",
  '최종 금액뿐 아니라 평균임금 산출 과정과 각 단계의 근거 법령까지 함께 보여줘 "왜 그 금액인지"까지 이해할 수 있게 돕습니다.',
  "이 계산기가 계산하는 값은 세전 법정 퇴직금이며, 실제 지급액은 회사의 급여 항목 처리 방식이나 세금 공제 등에 따라 달라질 수 있습니다.",
];

/** "사용 방법" 섹션 단계 — SPEC.md v2 "사용 안내" 요구사항(주당 소정근로시간 기본값 처리 포함). */
const USAGE_STEPS = [
  {
    title: "입사일·퇴사일 입력",
    description:
      "입사일과 퇴사일을 입력하면 재직일수를 자동으로 계산합니다. 퇴사일은 마지막 근무일의 다음날을 기준으로 입력해 주세요.",
  },
  {
    title: "3개월 임금총액 입력",
    description:
      "퇴사일 이전 3개월간 받은 임금총액만 입력해도 계산할 수 있습니다. 상여금·연차수당·통상임금은 있는 경우에만 선택적으로 추가 입력하세요.",
  },
  {
    title: "주당 소정근로시간은 기본적으로 입력하지 않아도 됩니다",
    description:
      "대다수 정규 근로자는 자명하게 주 15시간 이상 근무하므로 별도 입력 없이 정규 근로자로 가정해 계산합니다. 주 15시간 미만으로 근무하신다면 체크박스로 직접 알려주세요.",
  },
  {
    title: "결과·계산 근거 확인",
    description:
      "계산하기 버튼을 누르면 예상 퇴직금과 함께 평균임금 산출 과정, 각 단계의 근거 법령을 단계별로 확인할 수 있습니다.",
  },
];

/** FAQ 5개 — tasks/severance-pay/FORMULA.md "FAQ 콘텐츠" 절의 답변을 그대로 옮긴다(새로 작성하지 않음). */
const FAQ_ITEMS = [
  {
    question: "1년 미만 근로 후 퇴직하면 퇴직금을 받을 수 없나요?",
    answer: [
      '근로자퇴직급여 보장법 제4조 제1항은 사용자에게 퇴직급여제도 설정 의무를 부과하면서, "계속근로기간이 1년 미만인 근로자"에게는 그 의무가 없다고 단서로 정하고 있습니다. 따라서 계속근로기간이 1년 미만이면 법정 퇴직금을 받을 법적 권리가 발생하지 않습니다. 이 계산기도 재직일수가 365일 미만이면 금액을 계산하지 않고 "지급대상 아님"으로 안내합니다. 다만 회사의 취업규칙·단체협약 등이 법정 기준보다 유리한 별도 제도를 두고 있다면 그에 따라 지급받을 수도 있으나, 이는 이 계산기가 다루는 법정 최저 기준의 범위 밖입니다.',
      "근거: 근로자퇴직급여 보장법 제4조 제1항.",
    ],
  },
  {
    question: "퇴직금 지연 지급 시 이자는 어떻게 되나요?",
    answer: [
      "근로자퇴직급여 보장법 제9조는 사용자가 퇴직금 지급사유가 발생한 날(통상 퇴직일)부터 14일 이내에 퇴직금을 지급하도록 정하며, 특별한 사정이 있으면 당사자 간 합의로 지급기일을 연장할 수 있습니다. 이 기한 내에 지급하지 않으면 근로기준법 제37조 제1항 및 그 위임에 따른 시행령 규정에 의해, 기한 다음 날부터 실제 지급일까지의 지연 일수에 대해 연 20%의 지연이자가 발생합니다(근로기준법 제37조 제1항은 \"연 100분의 40 이내에서 대통령령으로 정하는 이율\"이라고 위임하고, 시행령이 실제 이율을 연 20%로 정하고 있습니다). 다만 사용자가 천재·사변, 그 밖에 대통령령으로 정하는 사유로 지급을 지연하는 경우 그 사유가 존속하는 기간에는 지연이자가 적용되지 않습니다(근로기준법 제37조 제2항). 이 계산기는 지연이자 자체를 계산하지 않으며, 위 내용은 정보 제공 목적의 안내입니다.",
      "근거: 근로자퇴직급여 보장법 제9조(지급기한), 근로기준법 제37조 제1항·제2항(지연이자 및 적용제외).",
    ],
  },
  {
    question: "상여금이나 성과급도 퇴직금 산정 기준에 포함되나요?",
    answer: [
      '상여금은 평균임금 산정에 포함되되, 1년 전체를 대상으로 한 번에 지급되는 성격을 고려해 "12개월간 지급받은 상여금 총액의 3/12"만 3개월분 평균임금 산정에 가산합니다(이 계산기의 상여금 총액 × 3/12 가산 로직과 동일). 다만 "성과급"이라는 명칭 자체가 자동으로 포함을 의미하지는 않습니다 — 근로기준법상 평균임금·통상임금에 산입되는지는 명칭이 아니라 실질에 따라 판단하며, 근로의 대가로 정기적·계속적으로 지급되는 임금성 급여라면 포함되지만, 경영성과에 따라 재량적으로 지급되는 이윤배분 성격의 성과급(예: 회사 전체 경영실적에 연동한 격려금 성격의 PS·PI 등)은 임금으로 인정되지 않아 제외될 수 있습니다. 이 계산기의 상여금 입력란은 임금성이 인정되는 상여금을 전제로 하며, 성과급의 임금성 여부는 사용자가 스스로 판단해 포함 여부를 결정해야 합니다.',
      "근거: 상여금 3/12 가산 — 고용노동부 행정해석 임금 68207-120(2003.02.24). 성과급의 임금성 판단 기준(근로의 대가성) — 근로기준법 제2조 제1항 제5호.",
    ],
  },
  {
    question: "평균임금에 포함되는 항목은 무엇인가요?",
    answer: [
      '근로기준법 제2조 제1항 제6호는 평균임금을 "산정하여야 할 사유가 발생한 날 이전 3개월간 그 근로자에게 지급된 임금총액을 그 기간의 총일수로 나눈 금액"으로 정의합니다. 원칙적으로 이 3개월 동안 근로의 대가로 지급된 임금은 명칭과 관계없이 모두 포함됩니다(기본급, 각종 수당, 상여금·연차수당 중 가산 대상분 등). 다만 근로기준법 시행령 제2조는 이 3개월 산정기간 중 특정 사유(수습기간, 사용자 귀책 휴업기간, 출산전후휴가기간, 업무상 재해 요양기간, 육아휴직기간, 쟁의행위기간 등)가 있으면 그 기간과 그 기간 중 지급된 임금을 평균임금 산정에서 제외하도록 정하고 있습니다.',
      "이 계산기(v1)는 \"퇴사일 이전 3개월간 지급된 임금총액\"을 사용자가 한 번에 직접 입력하는 간편 모드만 제공하며, 시행령 제2조가 정하는 제외기간·제외임금을 자동으로 걸러주는 기능은 없습니다. 따라서 어떤 항목을 3개월 임금총액에 포함할지, 제외 대상 기간이 있는지는 전적으로 사용자가 스스로 판단해 입력값에 반영해야 합니다.",
      "근거: 근로기준법 제2조 제1항 제6호(평균임금 정의), 근로기준법 시행령 제2조(평균임금 산정에서 제외되는 기간과 임금).",
    ],
  },
  {
    question: "퇴직금 세금은 얼마인가요?",
    answer: [
      "이 계산기는 세전 법정 퇴직금만 계산하며, 퇴직소득세는 이 계산기의 범위 밖입니다. 구체적인 세율·공제액은 계산·안내하지 않습니다. 퇴직소득세는 향후 별도 계산기 영역에서 다룰 예정입니다.",
    ],
  },
];

/** 계산 방법 설명 단계 — 각 단계에 근거 법령/행정해석 라벨을 붙인다(DESIGN_SYSTEM.md). */
interface FormulaStep {
  label: string;
  legalBasis: string;
  description: string;
}

function SectionIcon({ name }: { name: "chart" | "document" | "formula" }) {
  const paths = {
    chart: <path d="M5 19V9M12 19V5M19 19v-7M3 19h18" />,
    document: <path d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 12h5M10 16h5" />,
    formula: <path d="M5 5h5M5 19h5M14 7h5M16.5 4.5v5M14 15l5 5M19 15l-5 5" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      {paths[name]}
    </svg>
  );
}

function buildFormulaSteps(
  result: Extract<SeverancePayResult, { eligible: true }>,
): FormulaStep[] {
  return [
    {
      label: "1. 지급요건 판정",
      legalBasis: "근로자퇴직급여 보장법 제4조 제1항",
      description: `계속근로기간 ${formatDays(result.totalServiceDays)}(1년 이상) 및 주당 소정근로시간 요건을 충족해 계산을 진행합니다.`,
    },
    {
      label: "2. 재직일수 산출",
      legalBasis: "퇴사일 − 입사일",
      description: `재직일수 = ${formatDays(result.totalServiceDays)}`,
    },
    {
      label: "3. 산정기간 총일수 산출",
      legalBasis: "근로기준법 제2조 제1항 제6호(평균임금 산정기간)",
      description: `퇴사일 이전 3개월의 달력일수 = ${formatDays(result.baseDays)}`,
    },
    {
      label: "4. 상여금·연차수당 가산액 계산",
      legalBasis:
        "고용노동부 행정해석 임금 68207-120(2003.02.24, 상여금) / 임금근로시간정책팀-3295(2007.11.5, 연차수당)",
      description: `상여금 가산액 = 상여금총액 × 3/12 = ${formatWon(result.bonusAddition)} · 연차수당 가산액 = 연차수당총액 × 3/12 = ${formatWon(result.leavePayAddition)}`,
    },
    {
      label: "5. 1일 평균임금 계산",
      legalBasis: "근로기준법 제2조 제1항 제6호",
      description: `(3개월 임금총액 + 상여금 가산액 + 연차수당 가산액) ÷ 산정기간 총일수 = ${formatAverageDailyWageDetailed(result.averageDailyWage)}`,
    },
    {
      label: "6. 기준임금 확정",
      legalBasis: "근로기준법 제2조 제2항(평균임금 < 통상임금이면 통상임금 적용)",
      description: `max(1일 평균임금, 1일 통상임금) = ${formatAverageDailyWageDetailed(result.baseDailyWage)}`,
    },
    {
      label: "7. 퇴직금 계산",
      legalBasis: "근로자퇴직급여 보장법 제8조(계속근로기간 1년에 대해 30일분 평균임금)",
      description: `기준임금 × 30일 × (재직일수 ÷ 365) = ${formatWon(result.severancePay)}(반올림 전 값 기준)`,
    },
    {
      label: "8. 최종 반올림",
      legalBasis:
        "정부 공식 계산기(고용노동부 moel.go.kr) 소스코드로 확인된 실무 방식(원 단위 사사오입) — 명문 법령 규정은 없음",
      description: `최종 퇴직금 = ${formatWon(result.severancePay)}`,
    },
  ];
}

export default function SeverancePayCalculatorUi() {
  const formId = useId();
  const [form, setForm] = useState<RawSeverancePayFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationFieldError[]>([]);
  const [result, setResult] = useState<SeverancePayResult | null>(null);
  const [appliedInput, setAppliedInput] = useState<SeverancePayInput | null>(
    null,
  );
  const baseUrl = useCalculatorShare((state) => {
    const root = asShareRecord(state); const saved = asShareRecord(root?.f);
    const stringKeys = ["hireDate","retireDate","weeklyScheduledHours","wage3m","bonus12m","annualLeavePay12m","ordinaryDailyWage"];
    if (!saved || !stringKeys.every((key) => typeof saved[key] === "string") || typeof saved.underFifteenHoursDeclared !== "boolean") return;
    const restored = saved as unknown as RawSeverancePayFormInput; const validation = validateSeverancePayInput(restored); if (!validation.success) return;
    setForm(restored); setErrors([]); setAppliedInput(validation.data); setResult(calculateSeverancePay(validation.data));
  });

  function errorFor(field: keyof RawSeverancePayFormInput): string | undefined {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleChange(field: keyof RawSeverancePayFormInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setResult(null); setAppliedInput(null);
    };
  }

  /**
   * 금액(원) 입력 필드 전용 change 핸들러 — 입력 중 실시간으로 천 단위 콤마를 표시한다
   * (Critic Medium M2, docs/DESIGN_SYSTEM.md "입력 UX" 요구사항). 숫자가 아닌 문자(콤마 포함)는
   * 그대로 걸러내고 남은 숫자만으로 다시 포맷팅한다 — validation.ts가 콤마를 제거하고 파싱하므로
   * 계산/검증 결과에는 영향이 없다(표시 전용 변경).
   */
  function handleAmountChange(field: keyof RawSeverancePayFormInput) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const digitsOnly = event.target.value.replace(/[^0-9]/g, "");
      const formatted = digitsOnly
        ? Number(digitsOnly).toLocaleString("ko-KR")
        : "";
      setForm((prev) => ({ ...prev, [field]: formatted }));
      setResult(null); setAppliedInput(null);
    };
  }

  /**
   * "주 15시간 미만 근로자입니다" 자진신고 체크박스 핸들러(v2 신규,
   * FORMULA.md "주당 소정근로시간 기본값 정책"). 체크하면 숫자 입력 여부와 무관하게 즉시
   * 미충족으로 판정되므로(logic.ts 우선순위 1번), 체크 시 숫자 입력값을 지우지는 않되(사용자가
   * 다시 체크 해제할 수 있으므로 값 보존) 화면에서는 숫자 입력을 비활성화해 혼란을 줄인다.
   */
  function handleUnderFifteenChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({
      ...prev,
      underFifteenHoursDeclared: event.target.checked,
    }));
    setResult(null); setAppliedInput(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSeverancePayInput(form);
    if (!validation.success) {
      setErrors(validation.errors);
      setResult(null);
      setAppliedInput(null);
      return;
    }
    setErrors([]);
    setAppliedInput(validation.data);
    setResult(calculateSeverancePay(validation.data));
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

  const underFifteenDeclared = form.underFifteenHoursDeclared === true;

  // weeklyScheduledHours는 공용 renderField() 경로를 쓰지 않는 별도 블록이라(체크박스와 묶여
  // 있어 조건부 렌더링이 필요함) 오류/도움말 id와 aria-describedby 배선을 여기서 직접 만든다
  // (QA v2 재검증 Low 대응 — 보조 안내문이 입력과 연결되어 있지 않던 문제).
  const weeklyHoursInputId = `${formId}-weeklyScheduledHours`;
  const weeklyHoursErrorId = `${weeklyHoursInputId}-error`;
  const weeklyHoursHelpId = `${weeklyHoursInputId}-help`;
  const weeklyHoursError = errorFor("weeklyScheduledHours");
  const showWeeklyHoursHelp = !form.weeklyScheduledHours;

  function renderField(field: FieldConfig) {
    const inputId = `${formId}-${field.name}`;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;
    const message = errorFor(field.name);
    const isDate = field.name === "hireDate" || field.name === "retireDate";
    const isAmount = field.unit === "원";
    const rawValue = form[field.name];
    const value = typeof rawValue === "boolean" ? "" : rawValue ?? "";

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
            <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (선택)
            </span>
          )}
          {field.unit && (
            <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
              ({field.unit})
            </span>
          )}
        </label>
        <input
          id={inputId}
          type={isDate ? "date" : "text"}
          inputMode={isDate ? undefined : field.inputMode}
          /*
           * (2026-09-02 Optimizer 수정 — 실사용자 버그 리포트 대응) Chromium 계열 브라우저는
           * <input type="date">에 min/max가 없으면 연도 서브필드에 키보드로 계속 숫자를 입력해도
           * 4자리를 넘는 입력을 억제하지 않는다(스크린샷 확인: "123411-09-01"처럼 연도가
           * 비정상적으로 길어진 값이 만들어짐). min/max는 이 네이티브 동작을 억제하는 브라우저
           * UI 힌트일 뿐이라 validation.ts에서 실제 값 범위도 다시 검증한다(min/max는 폼 강제
           * 제출을 막지 않고, 우회 경로가 있을 수 있으므로). 범위 값과 그 근거는
           * validation.ts의 MIN_ALLOWED_DATE/getMaxAllowedDate() 주석 참고.
           */
          min={isDate ? MIN_ALLOWED_DATE : undefined}
          max={isDate ? getMaxAllowedDate() : undefined}
          value={value}
          onChange={
            isAmount ? handleAmountChange(field.name) : handleChange(field.name)
          }
          aria-required={field.required}
          aria-invalid={message ? true : undefined}
          aria-describedby={
            [message ? errorId : null, field.helpText ? helpId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={INPUT_CLASS}
          placeholder={
            field.name === "wage3m"
              ? "예: 9,200,000"
              : field.unit === "원"
                ? "미입력 시 0원"
                : undefined
          }
        />
        {field.helpText && (
          <p id={helpId} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {field.helpText}
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
          퇴직금 계산기
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          입사일과 최근 임금을 입력하면 법정 퇴직금 예상액과 산출 근거를 바로 확인할 수 있습니다.
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
            <p className="mt-1 text-sm text-muted">별표가 있는 항목만 입력해도 계산할 수 있습니다.</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">필수 3개</span>
        </div>
        <div className="space-y-5">
          {FIELDS.slice(0, 2).map((field) => renderField(field))}
        </div>

        {/* 주당 소정근로시간 — v2: 필수 입력 대신 체크박스 + 선택 숫자 입력으로 전환 */}
        <div className="space-y-3 border-t border-border pt-5">
          <div>
            <p className={LABEL_CLASS}>
              주당 소정근로시간
              <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                (선택)
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              4주 평균 1주간 소정근로시간이 15시간 미만이면 법정 퇴직금 지급대상이
              아닙니다. 대다수 정규 근로자는 자명하게 15시간 이상 근무하므로,
              입력하지 않으면 정규 근로자로 가정합니다.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={underFifteenDeclared}
              onChange={handleUnderFifteenChange}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/30 dark:border-white/30"
            />
            <span>저는 4주 평균 주 15시간 미만으로 근무합니다.</span>
          </label>

          {/* (Critic v2 Low L2 대응) 체크박스 토글에 따라 바뀌는 조건부 안내를 aria-live로
              감싸 스크린리더 사용자에게 변경을 안내한다. */}
          <div aria-live="polite">
            {underFifteenDeclared ? (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                체크하신 내용에 따라 주 15시간 미만 근로자로 판단해, 계산을 진행하지
                않고 지급대상 여부만 안내합니다.
              </p>
            ) : (
              <div>
                <label htmlFor={weeklyHoursInputId} className="text-sm font-medium">
                  실제 주당 소정근로시간을 알고 있다면 입력하세요
                  <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    (시간)
                  </span>
                </label>
                <input
                  id={weeklyHoursInputId}
                  type="text"
                  inputMode="decimal"
                  value={form.weeklyScheduledHours ?? ""}
                  onChange={handleChange("weeklyScheduledHours")}
                  aria-invalid={weeklyHoursError ? true : undefined}
                  aria-describedby={
                    [
                      weeklyHoursError ? weeklyHoursErrorId : null,
                      showWeeklyHoursHelp ? weeklyHoursHelpId : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  className={INPUT_CLASS}
                  placeholder="미입력 시 정규 근로자로 가정(예: 40)"
                />
                {weeklyHoursError && (
                  <p id={weeklyHoursErrorId} role="alert" className={ERROR_CLASS}>
                    {weeklyHoursError}
                  </p>
                )}
                {showWeeklyHoursHelp && (
                  <p
                    id={weeklyHoursHelpId}
                    className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    정규 근로자로 가정합니다(4주 평균 주 15시간 이상 근무 가정).
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-5">
          {FIELDS.slice(2).map((field) => renderField(field))}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
          >
            퇴직금 계산하기
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

      <ShareActions className="mt-5" title="퇴직금 계산기" text={result ? (result.eligible ? `예상 퇴직금은 ${formatWon(result.severancePay)}입니다.` : "입력한 조건은 법정 퇴직금 지급요건에 해당하지 않습니다.") : "입사일과 퇴사 전 임금으로 예상 퇴직금을 계산해 보세요."} url={baseUrl ? (result ? buildStateShareUrl(baseUrl, { f: form }) : baseUrl) : undefined} mode={result ? "result" : "calculator"} onKakaoShare={kakaoShareAdapter} />

      {/* ── 결과 ─────────────────────────────────────────────────────── */}
      <div aria-live="polite" className="mt-8 space-y-5">
        {result && !result.eligible && (
          <section className="rounded-2xl border border-warning-border bg-warning-surface p-6 text-sm">
            <h2 className="text-lg font-semibold">지급대상 아님</h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              법정 퇴직금은 계속근로기간 1년 이상, 4주 평균 주당 소정근로시간 15시간
              이상인 경우에만 발생합니다. 입력하신 조건은 아래 요건을 충족하지 않아
              계산을 진행하지 않습니다.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
              {result.insufficientServicePeriod && (
                <li>계속근로기간 1년 이상 — 미충족</li>
              )}
              {result.insufficientWeeklyHours && (
                <li>
                  4주 평균 주당 소정근로시간 15시간 이상 — 미충족
                  {result.weeklyHoursIneligibleReason === "declared" && (
                    <>(자진신고하신 내용에 따라 판정)</>
                  )}
                  {result.weeklyHoursIneligibleReason === "belowThreshold" && (
                    <>(입력하신 주당 소정근로시간 기준)</>
                  )}
                </li>
              )}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              근거: 근로자퇴직급여 보장법 제4조 제1항
            </p>
          </section>
        )}

        {result && result.eligible && appliedInput && (
          <>
            {/* 핵심 결과 */}
            <section className="overflow-hidden rounded-2xl border border-transparent bg-primary p-6 text-primary-foreground shadow-[0_20px_60px_-30px_rgba(49,87,213,.8)] dark:border-primary/25 dark:bg-gradient-to-br dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground dark:shadow-[0_20px_60px_-32px_rgba(82,112,220,.45)] sm:p-8">
              <h2 className="text-sm font-semibold opacity-80 dark:text-muted dark:opacity-100">
                예상 퇴직금
              </h2>
              <p className="mt-2 text-4xl font-bold tracking-[-0.04em] tabular-nums dark:text-primary sm:text-5xl">
                {formatWon(result.severancePay)}
              </p>
              <p className="mt-3 text-sm opacity-75 dark:text-muted dark:opacity-100">
                입력하신 조건으로 아래와 같이 계산을 진행합니다.
              </p>
            </section>

            {/* ── 계산 근거 ──────────────────────────────────────────── */}
            <div className="space-y-4">
              <SectionCard title="계산 상세" icon={<SectionIcon name="chart" />}>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      재직일수
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatDays(result.totalServiceDays)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      평균임금 산정기간 총일수
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatDays(result.baseDays)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      1일 평균임금
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatAverageDailyWageDetailed(result.averageDailyWage)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      기준임금(최종 적용)
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatAverageDailyWageDetailed(result.baseDailyWage)}
                      {appliedInput.ordinaryDailyWage != null &&
                      result.baseDailyWage > result.averageDailyWage
                        ? " (통상임금 적용)"
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      상여금 가산액
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatWon(result.bonusAddition)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                      연차수당 가산액
                    </dt>
                    <dd className="text-sm font-medium">
                      {formatWon(result.leavePayAddition)}
                    </dd>
                  </div>
                </dl>
                {appliedInput.ordinaryDailyWage == null && (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    통상임금 비교 미적용(1일 통상임금 미입력 — 평균임금만 사용했습니다).
                  </p>
                )}
              </SectionCard>

              <SectionCard title="적용된 입력값" icon={<SectionIcon name="document" />}>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">입사일</dt>
                    <dd>{appliedInput.hireDate}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">퇴사일</dt>
                    <dd>{appliedInput.retireDate}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      주당 소정근로시간
                    </dt>
                    <dd>
                      {appliedInput.weeklyScheduledHours != null
                        ? formatHours(appliedInput.weeklyScheduledHours)
                        : "미입력(정규 근로자로 가정)"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      3개월 임금총액
                    </dt>
                    <dd>{formatWon(appliedInput.wage3m)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      12개월 상여금 총액
                    </dt>
                    <dd>
                      {appliedInput.bonus12m != null
                        ? formatWon(appliedInput.bonus12m)
                        : "미입력(0원)"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      12개월 연차수당 총액
                    </dt>
                    <dd>
                      {appliedInput.annualLeavePay12m != null
                        ? formatWon(appliedInput.annualLeavePay12m)
                        : "미입력(0원)"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-zinc-500 dark:text-zinc-400">
                      1일 통상임금
                    </dt>
                    <dd>
                      {appliedInput.ordinaryDailyWage != null
                        ? formatWon(appliedInput.ordinaryDailyWage)
                        : "미입력(비교 생략)"}
                    </dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard title="계산 방법" icon={<SectionIcon name="formula" />}>
                <ol className="space-y-4">
                  {buildFormulaSteps(result).map((step) => (
                    <li key={step.label} className="text-sm">
                      <p className="font-medium">{step.label}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        근거: {step.legalBasis}
                      </p>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                        {step.description}
                      </p>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            </div>
          </>
        )}
      </div>

      {/* ── 사용 안내 · 소개 ────────────────────────────────────────── */}
      <div className="mt-16 grid gap-5 lg:grid-cols-2">
        <UsageGuide
          description="필수 입력은 입사일·퇴사일·3개월 임금총액뿐입니다."
          steps={USAGE_STEPS}
        />
        <IntroSection
          title="퇴직금 계산기란 무엇인가요?"
          paragraphs={INTRO_PARAGRAPHS}
          highlights={INTRO_HIGHLIGHTS}
        />
      </div>

      {/* ── 정책 안내 ────────────────────────────────────────────────── */}
      <section className="mt-5 space-y-3 rounded-2xl bg-surface-subtle p-6 text-sm leading-6 text-muted">
        <p>
          이 계산기는 근로자퇴직급여 보장법 제4조·제8조·제9조, 근로기준법 제2조를
          기준으로 한 법정 퇴직금(일시금) 예상액을 계산합니다. 세금(퇴직소득세),
          4대보험 정산, 퇴직연금(DC/DB형) 비교, 중간정산은 다루지 않습니다.
        </p>
        <p>
          평균임금 산정 제외기간(수습, 휴업, 출산전후휴가, 업무상 재해 휴업, 육아휴직
          등)이 있는 경우 실제 금액과 차이가 클 수 있습니다. 실제 지급액은 회사의
          급여 산정 방식, 제외기간 반영 여부 등에 따라 이 계산 결과와 다를 수
          있습니다.
        </p>
        <p>
          주당 소정근로시간을 입력하지 않으면 정규 근로자(4주 평균 주 15시간 이상)로
          가정해 계산합니다. 실제로 주 15시간 미만으로 근무하는 초단시간 근로자는
          법정 퇴직금 지급대상에서 제외될 수 있으니, 해당하시면 위 체크박스로 반드시
          알려주세요.
        </p>
        <p>
          퇴직금은 지급사유가 발생한 날부터 14일 이내에 지급하는 것이 원칙입니다
          (근로자퇴직급여 보장법 제9조).
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
