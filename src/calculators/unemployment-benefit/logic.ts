/**
 * 실업급여(구직급여) 계산기 — 순수 계산 로직.
 *
 * tasks/unemployment-benefit/FORMULA.md의 "공식" / "계산 순서" / "정밀도·반올림 정책" 절을
 * 그대로 구현한다. 공식이나 반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1은 SPEC.md "설계상 핵심 결정"의 체크박스
 * (`voluntaryLeaveAcknowledged`)를 통과한 뒤에만 호출부(ui.tsx)가 이 함수를 호출했다. v2가 그
 * 체크박스 게이팅을 제거하면서 이제는 유효성 검증만 통과하면 항상 이 함수를 호출한다 — 이
 * 함수 자체는 그 필드를 원래부터 받지 않았으므로(types.ts `UnemploymentBenefitCalcInput`
 * 참고) 이 변경으로 함수 시그니처·계산 로직은 전혀 바뀌지 않는다.
 */

import { calculateCalendarPeriodDaysBefore, parseIsoDateUtc } from "@/src/lib/date-calc";
import rates2026 from "@/src/data/rates-2026.json";
import type {
  UnemploymentBenefitAgeBand,
  UnemploymentBenefitCalcInput,
  UnemploymentBenefitInsuredPeriodBand,
  UnemploymentBenefitResult,
} from "./types";

/** 평균임금 산정기간(개월). severance-pay와 동일(근로기준법 제2조제1항제6호). */
const BASE_DAYS_MONTHS = 3;

/** 연령 구간 판정 기준(고용보험법 제50조제1항, 별표1) — 만 나이 50세. */
const AGE_BAND_THRESHOLD = 50;

/**
 * 가입기간(피보험기간) 구간 판정 시 "1년"을 며칠로 볼지에 대한 v1 결정.
 *
 * FORMULA.md "정밀도/반올림 정책 > 가입기간 → 구간 판정 시 '1년' 경계"는 이 값을 "확인
 * 필요"로 남겼다(365일 고정 vs 달력 anniversary). 이 함수(`determineInsuredPeriodBand`)는
 * severance-pay의 hireDate/retireDate 같은 두 날짜 쌍이 아니라 **이미 계산된 누적 일수
 * 하나**만 받는다(types.ts `UnemploymentBenefitCalcInput.insuredPeriodDays`) — 애초에
 * "달력 anniversary"를 계산할 기준 날짜 쌍이 이 함수 내부에 존재하지 않는다. (2026-09-02
 * Optimizer 수정: UI 레벨에서는 사용자가 이제 "입사일"+"퇴사일" 두 날짜를 입력하고
 * validation.ts가 `date-calc.ts`의 `diffDaysUtc`로 이 값을 미리 계산해 넘기지만, 그 두 날짜
 * 자체는 이 함수/이 계산 경로에 전달되지 않는다 — 계산 함수 시그니처와 아래 365일 고정
 * 환산 결정은 이 UI 변경과 무관하게 그대로 유지된다). 따라서 이 계산기가 택할 수 있는
 * 유일하게 일관된 방법은 "365일 = 1년" 고정 환산이다 — 이는 severance-pay가 재직일수
 * (diffDays)를 365일 기준으로 지급요건 판정에 쓰는 방식과도 같은 단순화 원칙(달력일수를
 * 그대로 정수 임계값과 비교)이라 일관성이 있다. "확인 필요" 상태 자체는 해소되지 않았으므로
 * 이 주석과 함께 상수로 분리해 둔다.
 */
const DAYS_PER_YEAR_FOR_BAND = 365;

/** 소정급여일수 표(FORMULA.md) 5개 구간의 표시 라벨. rates-{year}.json의 rows 배열 순서와 1:1 대응한다. */
const INSURED_PERIOD_BAND_LABELS: UnemploymentBenefitInsuredPeriodBand[] = [
  "1년 미만",
  "1년 이상 3년 미만",
  "3년 이상 5년 미만",
  "5년 이상 10년 미만",
  "10년 이상",
];

/** rates-{year}.json의 `unemploymentBenefit` 네임스페이스 타입(2026년 스키마 기준). */
type UnemploymentBenefitRates = (typeof rates2026)["unemploymentBenefit"];
type BenefitDaysTableRow = UnemploymentBenefitRates["benefitDaysTable"]["rows"][number];

/**
 * 연도별 데이터 파일 레지스트리. 현재는 rates-2026.json만 존재한다(Architect 산출물).
 * 새 연도 데이터가 추가되면 이 맵에 항목을 추가하기만 하면 된다.
 */
const RATES_BY_YEAR: Record<number, typeof rates2026> = {
  2026: rates2026,
};

/**
 * `leaveDate`의 연도에 해당하는 연도별 데이터를 조회한다.
 *
 * v1 결정(다른 연도 처리 — 작업 지시에 따른 명시적 선택, "확인 필요" 항목은 아님):
 * 데이터가 없는 연도는 **가장 가까운 연도로 조용히 폴백하지 않고 에러를 던진다.**
 * 근거: 최저임금·구직급여 상한/하한액은 매년 실제로 바뀌는 고시값이라(FORMULA.md "기준/출처"),
 * 예컨대 2025년 퇴사자에게 2026년 수치를 그대로 적용하면 실제보다 유리하거나 불리한 금액을
 * 사실처럼 보여줄 위험이 있다 — docs/CALCULATOR_RULES.md "정확성 원칙"(확실하지 않은 수치는
 * 추정하지 않는다) 및 "데이터 파일 스키마"(확정되지 않은 값은 이전 연도로 폴백하지 않고
 * "확인 필요"로 표시)와 같은 방향이다. 호출부(validation.ts/ui.tsx)가 이 에러를 잡아
 * "선택하신 퇴사일 연도의 데이터가 아직 준비되지 않았습니다" 같은 사용자 안내로 변환해야
 * 한다 — logic.ts 자체는 사용자 문구를 만들지 않는다(관심사 분리).
 */
export function getUnemploymentBenefitRatesForYear(
  year: number,
): UnemploymentBenefitRates {
  const ratesFile = RATES_BY_YEAR[year];
  if (!ratesFile) {
    const availableYears = Object.keys(RATES_BY_YEAR).join(", ");
    throw new Error(
      `getUnemploymentBenefitRatesForYear: ${year}년 데이터가 없습니다(현재 사용 가능한 연도: ${availableYears}). ` +
        `퇴사일 연도의 고시 수치가 준비되지 않았습니다.`,
    );
  }
  return ratesFile.unemploymentBenefit;
}

/**
 * 평균임금 산정기간 총일수(leaveDate 이전 3개월의 달력일수, 89~92일)를 계산한다.
 * FORMULA.md "공식" 1단계 — severance-pay FORMULA.md의 baseDays 로직(월말 clamp 포함)을
 * `src/lib/date-calc.ts` 공용 유틸을 통해 그대로 재사용한다(FORMULA.md가 명시적으로 요구).
 */
export function calculateBaseDays(leaveDate: string): number {
  return calculateCalendarPeriodDaysBefore(leaveDate, BASE_DAYS_MONTHS);
}

/** `leaveDate`("YYYY-MM-DD")에서 연도를 추출한다. 형식이 유효하지 않으면 에러를 던진다. */
function extractLeaveYear(leaveDate: string): number {
  const parsed = parseIsoDateUtc(leaveDate);
  if (!parsed) {
    throw new Error(
      `calculateUnemploymentBenefit: 유효하지 않은 퇴사일 문자열 (leaveDate=${leaveDate})`,
    );
  }
  return parsed.getUTCFullYear();
}

/**
 * 소정급여일수 표 조회에 쓰이는 연령 구간을 판정한다. FORMULA.md "공식" 7단계 —
 * `isDisabled`가 true이거나 만 나이가 50세 이상이면 "50세 이상 및 장애인" 구간이다.
 */
export function determineAgeBand(
  ageAtLeave: number,
  isDisabled: boolean,
): UnemploymentBenefitAgeBand {
  return isDisabled || ageAtLeave >= AGE_BAND_THRESHOLD
    ? "50세 이상 및 장애인"
    : "50세 미만";
}

/**
 * 소정급여일수 표 조회에 쓰이는 가입기간(피보험기간) 구간을 판정한다. FORMULA.md "공식"
 * 8~9단계 — `insuredPeriodDays`를 `DAYS_PER_YEAR_FOR_BAND`(365일=1년) 기준으로 환산해
 * rates-{year}.json의 5개 구간 중 하나에 배정하고, 해당 행(연령별 소정급여일수 포함)을
 * 함께 반환한다.
 */
export function determineInsuredPeriodBand(
  insuredPeriodDays: number,
  rows: readonly BenefitDaysTableRow[],
): { band: UnemploymentBenefitInsuredPeriodBand; row: BenefitDaysTableRow } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const minDays = row.insuredYearsMin * DAYS_PER_YEAR_FOR_BAND;
    const maxDays =
      row.insuredYearsMax === null
        ? Infinity
        : row.insuredYearsMax * DAYS_PER_YEAR_FOR_BAND;
    if (insuredPeriodDays >= minDays && insuredPeriodDays < maxDays) {
      return { band: INSURED_PERIOD_BAND_LABELS[i], row };
    }
  }
  // 방어적 안전장치: rows가 0일부터 무한대까지 모든 구간을 이론상 빠짐없이 덮으므로
  // (마지막 행의 insuredYearsMax=null → Infinity) 이 지점에 도달하면 데이터 파일 자체의
  // 구간 정의가 깨진 것이다.
  throw new Error(
    `determineInsuredPeriodBand: 매칭되는 가입기간 구간을 찾지 못했습니다 (insuredPeriodDays=${insuredPeriodDays})`,
  );
}

/**
 * 총 예상 지급액(`totalExpectedBenefit`) 최종 원 단위 확정.
 *
 * FORMULA.md "정밀도/반올림 정책"(2026-09-02 갱신)이 정한 새 정책의 핵심: `benefitDailyAmount`
 * (clamp까지만 적용한 완전정밀도 값)는 원 단위로 절사하지 않고 그대로 `prescribedBenefitDays`와
 * 곱한다(work24.go.kr 실증, 예제 7 — `67,200.6 × 240 = 16,128,144원`이 실제 응답과 일치했고,
 * `67,200 × 240 = 16,128,000원`으로 먼저 절사했다면 144원 낮게 표시됐을 것이다). 원 단위 절사는
 * 이 곱셈 **결과 자체**에 대해 최종적으로 단 한 번만 적용한다 — 곱셈 이전 어느 중간 단계에서도
 * 반올림해서는 안 된다("정밀도/반올림 정책" 6단계·11단계 주의사항).
 *
 * 절사(버림) 자체의 방향은 FORMULA.md가 여전히 "확인 필요"로 남긴 신규 항목이다(Auditor가
 * 확보한 두 실증 사례가 우연히 둘 다 정수로 떨어져 이 지점을 검증하지 못했다). v1은
 * "사용자에게 불리하지 않은 방향(정부 발표·지급액보다 화면에 더 크게 보여주지 않는 방향)"이라는
 * 잠정 원칙에 따라 절사를 채택한다. 이 함수를 곱셈 자체와 분리해 이름 붙여 둔 이유는, 이
 * "확인 필요" 항목이 나중에 해소되어 정책이 바뀌면(올림/반올림 등) 이 함수 본문 한 곳만
 * 고치면 되도록 하기 위함이다(작업 지시 요구사항) — `roundBenefitDailyAmount`처럼 곱셈
 * *이전에* 절사를 끼워 넣는 구조는 이제 공식과 상충하므로 다시 만들지 않는다.
 */
/**
 * 부동소수점 표현 오차 보정용 아주 작은 여유값(원 단위 스케일에서 안전한 크기) —
 * severance-pay/formatting.ts의 EPSILON 방어 패턴과 동일한 이유다. `benefitDailyAmount`가
 * 완전정밀도로 유지되므로(예: `67,200.6`), `× prescribedBenefitDays`의 부동소수점 곱셈이
 * 수학적으로는 정수인 값을 `16,128,143.999999998`처럼 살짝 밑도는 값으로 계산해 버리는
 * 경우가 실제로 발생한다(예제 7로 재현됨) — 보정 없이 `Math.floor`만 적용하면 정답보다
 * 1원 낮게 절사되는 버그가 생긴다.
 */
const TOTAL_BENEFIT_EPSILON = 1e-6;

export function finalizeTotalBenefit(
  benefitDailyAmount: number,
  prescribedBenefitDays: number,
): number {
  return Math.floor(
    benefitDailyAmount * prescribedBenefitDays + TOTAL_BENEFIT_EPSILON,
  );
}

/**
 * 실업급여(구직급여) 계산 메인 함수. FORMULA.md "공식" 1~10단계 및 "계산 순서" 1~11단계를
 * 그대로 구현한다(순서 1번 "비자발적 이직 전제 확인"은 UI 게이팅이라 이 함수 밖에서
 * 처리된다 — types.ts `UnemploymentBenefitCalcInput` 참고).
 *
 * 입력은 validation.ts(validateUnemploymentBenefitInput)를 통과했다는 전제다 — 이 함수
 * 자체는 방어적 검증(음수, 형식 등)을 반복하지 않는다(관심사 분리: 검증은 validation.ts,
 * 계산은 logic.ts).
 */
export function calculateUnemploymentBenefit(
  input: UnemploymentBenefitCalcInput,
): UnemploymentBenefitResult {
  const year = extractLeaveYear(input.leaveDate);
  const rates = getUnemploymentBenefitRatesForYear(year);

  // 계산 순서 2번 — 피보험기간 180일 요건 판정(고용보험법 제40조제1항제1호). 미충족이면
  // 이하 전부(3~11단계)를 수행하지 않는다(FORMULA.md "공식" 단락, "예외 > 피보험단위기간
  // 요건 미충족").
  const requiredDays = rates.insuredUnitPeriodRequiredDays.value;
  if (input.insuredPeriodDays < requiredDays) {
    return { eligible: false, eligibleByInsuredPeriod: false };
  }

  // 계산 순서 3번 — 평균임금 산정기간 총일수(근로기준법 제2조제1항제6호).
  const baseDays = calculateBaseDays(input.leaveDate);

  // 계산 순서 4번 — 1일 평균임금. FORMULA.md "정밀도/반올림 정책": "반올림 없이 유지".
  const averageDailyWage = input.wage3m / baseDays;

  // 계산 순서 5번 — 상한/하한 적용 전 구직급여일액(고용보험법 제46조제1항제1호).
  const baseBenefitDailyAmount = averageDailyWage * rates.benefitRate.value;

  // 계산 순서 6번 — 해당 연도 상한액·하한액 조회. rates-{year}.json에 이미 계산된 값을
  // 그대로 읽는다(FORMULA.md 6단계 주석: "또는 미리 계산된 값을 그대로 읽음").
  const minBenefitDailyAmount = rates.minBenefitDailyAmount.value;
  const maxBenefitDailyAmount = rates.maxBenefitDailyAmount.value;

  // 계산 순서 7번 — 구직급여일액 확정: clamp까지만 적용하고 원 단위로 절사하지 않는다
  // (FORMULA.md "정밀도/반올림 정책" 2026-09-02 갱신 — work24.go.kr 실증으로 "clamp 후
  // 절사" 구 정책이 반증·폐기됐다, 예제 7). 이 완전정밀도 값을 11단계(finalizeTotalBenefit)
  // 계산에 그대로 사용한다 — 여기서 절사하면 그 절사값이 아래 곱셈에 재사용되어 구 정책으로
  // 되돌아가 버리므로, 이 지점에는 어떤 반올림 함수도 끼워 넣지 않는다.
  const benefitDailyAmount = Math.min(
    Math.max(baseBenefitDailyAmount, minBenefitDailyAmount),
    maxBenefitDailyAmount,
  );

  // 계산 순서 8번 — 연령 구간 판정.
  const ageBandForTable = determineAgeBand(
    input.ageAtLeave,
    input.isDisabled ?? false,
  );

  // 계산 순서 9~10번 — 가입기간 구간 판정 및 소정급여일수 조회.
  const { band: insuredPeriodBand, row } = determineInsuredPeriodBand(
    input.insuredPeriodDays,
    rates.benefitDaysTable.rows,
  );
  const prescribedBenefitDays =
    ageBandForTable === "50세 이상 및 장애인"
      ? row.over50OrDisabledDays
      : row.under50Days;

  // 계산 순서 11번 — 총 예상 지급액. benefitDailyAmount(완전정밀도, 7단계)와
  // prescribedBenefitDays(정수 일)를 곱한 뒤, finalizeTotalBenefit() 안에서 최종적으로
  // 단 한 번만 원 단위 절사를 적용한다(FORMULA.md "정밀도/반올림 정책" 참고).
  const totalExpectedBenefit = finalizeTotalBenefit(
    benefitDailyAmount,
    prescribedBenefitDays,
  );

  return {
    eligible: true,
    eligibleByInsuredPeriod: true,
    baseDays,
    averageDailyWage,
    baseBenefitDailyAmount,
    minBenefitDailyAmount,
    maxBenefitDailyAmount,
    benefitDailyAmount,
    ageBandForTable,
    insuredPeriodBand,
    prescribedBenefitDays,
    totalExpectedBenefit,
    waitingPeriodDays: rates.waitingPeriodDays.value,
  };
}
