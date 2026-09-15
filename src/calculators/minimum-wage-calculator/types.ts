/**
 * 최저임금·시급↔월급 계산기 — 타입 정의 (Architect 산출물, 실제 타입은 여기서 확정한다).
 *
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, 소개/FAQ 카피는
 * content.ts, UI는 ui.tsx — 전부 Builder 단계에서 이 폴더에 추가된다(docs/ARCHITECTURE.md
 * "계산 로직 / UI 분리", tasks/minimum-wage-calculator/ARCHITECTURE.md 참고).
 *
 * 필드 정의는 tasks/minimum-wage-calculator/FORMULA.md "입력값" / "출력값" 표를 그대로
 * 옮긴 것이다. 구조적 판단(모드 discriminated union, raw/display 분리, 체이닝 금지 강제
 * 방식 등)의 근거는 tasks/minimum-wage-calculator/ARCHITECTURE.md를 참고한다 — 이 파일의
 * 주석은 "무엇을 왜 이렇게 선언했는지"만 짧게 남기고, 전체 맥락은 그 문서에 있다.
 *
 * **[v2 개정, 2026-09-14]** FORMULA.md가 Calculation Auditor "공식 재검토 요청"을 거쳐
 * v2로 개정되면서 `monthlyEquivalentHours`의 반올림 정책이 "정수 반올림"에서 "소수 둘째
 * 자리 반올림"으로 바뀌었다. 이 파일의 관련 필드 JSDoc과 `minimumWageJudgmentMismatch`
 * 필드(신규)가 그 결과를 반영한다 — 전체 재검토 근거와 Builder 인계 체크리스트는
 * `tasks/minimum-wage-calculator/ARCHITECTURE.md` "## v2 개정" 절 참고.
 */

/** 원(₩) 단위 금액. 이 계산기는 정수만 다룬다(ARCHITECTURE.md "입력 설계" — hourlyWage/monthlyWage 모두 정수 전용). */
export type Won = number;

/** 시간(hour) 단위. 소수를 허용한다(주휴시간·1주 최저임금 적용기준 시간 수 등은 정수로 떨어지지 않는다). */
export type Hours = number;

/** 계산 방향. `HOURLY` = 시급을 입력해 월급을 환산, `MONTHLY` = 월급을 입력해 시급을 역산. */
export type CalculationMode = "HOURLY" | "MONTHLY";

/**
 * 시급 모드 입력. `mode="MONTHLY"`의 `monthlyWage`와 필드 이름 자체가 다르므로, 이 타입의
 * 값을 실수로 `MonthlyModeInput`이 필요한 자리에 넘기면(또는 그 반대) TypeScript가
 * 구조적으로 거부한다 — ARCHITECTURE.md "3. 체이닝 금지 강제"의 첫 번째 방어선이다.
 */
export interface HourlyModeInput {
  mode: "HOURLY";
  /**
   * 세전 시간당 임금(원). **정수만 허용**(validation.ts, weekly-holiday-allowance와 동일
   * 결정 — ARCHITECTURE.md "입력 설계" 참고). `> 0`, 상식적 상한은 validation.ts가 정의.
   */
  hourlyWage: Won;
  /**
   * 1주 소정근로시간(시간, 휴게시간 제외). 선택 입력, 기본값 40 — 기본값 적용은
   * validation.ts 책임이며 이 타입에 도달한 시점에는 이미 확정된 숫자다(빈 값 개념 없음).
   * `>= MIN_WEEKLY_HOURS(1)`, `<= MAX_WEEKLY_HOURS(168)` — 하한이 FORMULA.md 원안(`> 0`)보다
   * 좁다. 이유는 ARCHITECTURE.md "4. weeklyHours 하한을 1로 좁힌 이유(0 나눗셈/0 환산 방지)".
   */
  weeklyHours: Hours;
}

/** 월급 모드 입력. 필드는 `HourlyModeInput`과 대칭이다. */
export interface MonthlyModeInput {
  mode: "MONTHLY";
  /**
   * 세전 월 급여 총액(원, 산입범위 구분 없는 총액 — SPEC "산입범위 단순화"). **정수만
   * 허용**. `> 0`, 상식적 상한은 validation.ts가 정의(FORMULA.md 예시: 10억 원).
   */
  monthlyWage: Won;
  /** `HourlyModeInput.weeklyHours`와 동일한 규칙. */
  weeklyHours: Hours;
}

/**
 * logic.ts(`calculateMinimumWageComparison`)가 받는 입력. `business-days`의
 * `RangeInput | OffsetInput` 판별 유니온과 같은 패턴이다 — `mode`가 판별 태그다.
 */
export type MinimumWageCalculatorInput = HourlyModeInput | MonthlyModeInput;

/**
 * 두 모드가 공유하는 결과 필드. 판별 유니온의 구성 요소로만 쓰고 그 자체를 export하지
 * 않는다(`loan-interest-calculator`의 `LoanCalculationBase`와 동일한 목적 — 반복 나열
 * 제거). FORMULA.md "출력값" 표에서 모드와 무관하게 항상 존재하는 필드만 모았다.
 */
interface MinimumWageComparisonBase {
  /** 이 계산에 실제로 적용된 1주 소정근로시간(기본값 40 적용 후 확정값). */
  weeklyHours: Hours;
  /**
   * 1주 유급주휴시간 = `min(weeklyHours/40*8, 8)`. `src/lib/labor-standards.ts`의
   * `calculateWeeklyHolidayHours`(weekly-holiday-allowance와 공유)를 그대로 호출한 결과다.
   * 반올림하지 않는다 — breakdown에 소수 그대로 노출(예: 4.6시간).
   */
  weeklyHolidayHours: Hours;
  /** "1주의 최저임금 적용기준 시간 수" = `weeklyHours + weeklyHolidayHours`. 반올림하지 않는다. */
  weeklyPaidHours: Hours;
  /**
   * "1개월의 최저임금 적용기준 시간 수"(표시·계산 공용값).
   *
   * **[v2, FORMULA.md 개정]** `round2(weeklyPaidHours * 365/84)` — **소수 둘째 자리까지
   * 반올림**한다. v1은 `round(...)`(정수, 예: `209`)였으나, Calculation Auditor가
   * 고용노동부 실시간 최저임금 판정 도구(moel.go.kr `wageResultNew()`)가 정수 반올림을
   * 쓰지 않고 `toFixed(2)`만 적용한다는 것을 코드로 확인해 FORMULA.md v2가 정수 반올림
   * 정책을 폐기했다(`tasks/minimum-wage-calculator/FORMULA.md` "정밀도/반올림 정책 [v2]").
   * `weeklyHours=40`이면 이제 `208.57`이다(과거 `209`가 아니다) — **이 필드는 더 이상
   * 항상 정수가 아니다.**
   *
   * **이 계산기에서 가장 중요한 정밀도 규약(v1·v2 공통, 변경 없음)**: 이 값은
   * `docs/CALCULATOR_RULES.md`의 일반 원칙("중간 계산은 반올림하지 않는다")과 달리
   * **중간 계산 단계에서 이미 반올림된 값**이고, 이후 모든 계산(환산 시급/월급, 월 환산
   * 최저임금)은 반드시 **이 반올림된 값**을 그대로 재사용해야 한다. 바뀐 것은 반올림
   * "자릿수"(정수 → 소수 둘째 자리)뿐이고, "화면에 표시하는 값 = 실제 계산에 쓰는 값"이라는
   * 원칙 자체는 그대로다 — 오히려 v2는 이 원칙을 더 엄격하게 요구한다(FORMULA.md v2 "왜
   * 표시값과 계산값을 분리하지 않는가" 절 — 사용자가 breakdown의 이 숫자로 직접 검산할 때
   * 실제 계산에 쓰인 숫자와 반드시 일치해야 한다는 투명성 제약이 이번 개정의 핵심 취지다).
   *
   * **raw/display 분리 원칙 재확인(Architect v2 재검토 결론 — 원칙 자체는 v1과 동일하게
   * 유지)**: 완전 무한정밀값(`monthlyEquivalentHoursExact`, 예: `208.571428571...`)은
   * v1과 마찬가지로 **이 타입에 여전히 존재하지 않는다** — logic.ts 내부 지역 변수로만
   * 있고 화면에도 다른 계산에도 쓰이지 않는다(ARCHITECTURE.md "5. raw/display 분리" 및
   * "v2 개정" 절 참고). "v2부터 정밀값 자체가 표시값이자 계산값이 되었다"는 것은 무한정밀값을
   * 그대로 노출한다는 뜻이 아니라, **소수 둘째 자리로 잘라낸 근사 정밀값(이 필드) 하나가
   * 유일한 공용값이 되었다**는 뜻이다 — "raw(무한정밀, 비공개) vs display+calc(반올림된
   * 단일 공용값, 이 필드)"라는 2계층 구조 자체는 v1과 동일하게 유지된다. Golden Test가
   * 무한정밀값 자체를 검증해야 하면 이 필드를 만드는 내부 헬퍼 함수
   * (`calculateMonthlyEquivalentHoursExact`)를 직접 호출한다(오케스트레이터 결과가 아니라).
   */
  monthlyEquivalentHours: number;
  /**
   * 화면에 항상 함께 표시하는 시급 값. `mode="HOURLY"`면 사용자가 입력한 `hourlyWage`
   * 그대로(환산 아님), `mode="MONTHLY"`면 `convertedHourlyWage`와 동일한 값(환산값).
   * 어느 쪽인지는 이 필드만 보고는 알 수 없고 **반드시 `mode`로 판별**한다 — SPEC Must
   * Have "입력값/환산값을 화면에서 명확히 구분 표시"는 이 필드에 별도 플래그를 얹지 않고
   * `result.mode`만으로 UI가 라벨("입력값"/"환산값")을 결정하는 방식으로 만족한다
   * (ARCHITECTURE.md "2. 모드 판별 유니온" 참고).
   */
  displayHourlyWage: Won;
  /** `displayHourlyWage`와 대칭. `mode="MONTHLY"`면 입력값 그대로, `mode="HOURLY"`면 환산값. */
  displayMonthlyPay: Won;
  /** 해당 연도 고시 최저임금 시급. `rates-{year}.json`의 `minimumWage.hourly.value`. */
  minWageHourly: Won;
  /**
   * 해당 연도 월 환산 최저임금 = `round(minWageHourly * monthlyEquivalentHours)`.
   *
   * **[v2, FORMULA.md 개정] 이 `round()`는 이제 실질적인 연산이다.** v1은
   * `monthlyEquivalentHours`가 항상 정수라 "정수 × 정수"가 그대로 정수였으므로 `round()`가
   * 사실상 무연산(no-op)이었다(반올림을 빠뜨려도 결과가 우연히 같았다). v2는
   * `monthlyEquivalentHours`가 소수 둘째 자리 값이라 `minWageHourly * monthlyEquivalentHours`가
   * 대부분 소수로 떨어지므로, **원 단위 사사오입을 반드시 명시적으로 적용해야 한다**
   * (`weeklyHours=40`이면 `round(10,320 × 208.57) = round(2,152,442.4) = 2,152,442원`).
   * 이 반올림을 빠뜨리면 이 필드가 소수(`.4`, `.6` 등)를 갖는 원 단위 금액이 되어
   * 그대로 화면에 노출되는 표시 오류가 난다 — Builder가 v1에서 이 반올림 호출을 생략했다면
   * v2 재구현 시 반드시 추가해야 한다.
   *
   * **이 계산의 `weeklyHours`(사용자 입력)로 산출된 `monthlyEquivalentHours`를 곱해야
   * 한다 — 40시간 고정 209시간(v1)도, 208.57시간(v2의 40시간 기준값)도 상수로 하드코딩해
   * 대입하지 않는다.** `weeklyHours`가 40이 아니면 이 값도 40시간 기준(v2: 2,152,442원)과
   * 달라진다(예: 20시간 → 1,076,273원, FORMULA.md v2 예제 C1). `rates-{year}.json`에
   * 40시간 기준 참고값을 별도로 저장해 두고 그 상수를 대신 쓰는 실수를 막기 위해, 이
   * 프로젝트는 그런 참고 필드를 데이터 파일에 추가하지 않기로 했다(v1 결정 유지,
   * ARCHITECTURE.md "6. 정책 데이터 — monthlyReference 필드를 추가하지 않는다", "v2 개정"
   * 절에서 재확인).
   */
  minWageMonthlyEquivalent: Won;
  /** `displayHourlyWage >= minWageHourly`. 게이팅 아님 — false여도 모든 값을 그대로 계산·표시한다. */
  hourlyMeetsMinimumWage: boolean;
  /** `displayMonthlyPay >= minWageMonthlyEquivalent`. 게이팅 아님. */
  monthlyMeetsMinimumWage: boolean;
  /**
   * **[v2 신규, Architect 추가 — FORMULA.md "출력값" 표에는 없는 파생 플래그]**
   * `hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage`.
   *
   * FORMULA.md v2 "[신규] Calculation Auditor 항목 6(이중 배지 불일치)이 이번 정책
   * 변경으로 해소되는가 — 아니다, 거의 그대로 남는다" 절이 명시한 대로, 이 계산기는
   * MONTHLY 모드에서 두 최저임금 판정이 서로 다르게 나올 수 있는 구조적 반례를 v2에서도
   * 그대로 갖는다(반례 구간 폭이 `weeklyHours=40` 기준 104개 → 103개로 사실상 줄지
   * 않았다 — `M/2` 폭은 `M`의 절대 크기에 좌우되지 반올림 자릿수와 무관하다). FORMULA.md는
   * 이 문제의 UI/구조적 처리를 "FORMULA.md의 권한 범위를 벗어난다"며 Architect에게 명시적으로
   * 위임했다.
   *
   * Architect 결정: 이 불일치 가능성을 `ui.tsx`가 매번
   * `result.hourlyMeetsMinimumWage !== result.monthlyMeetsMinimumWage`로 직접 재계산하게
   * 두지 않고, `weekly-holiday-allowance.cappedAtStatutoryLimit`·이 타입의
   * `cappedAtStatutoryLimit`와 같은 선례를 따라 **logic.ts가 미리 계산해 결과에 실어
   * 보내는 파생 플래그**로 승격한다 — UI가 이 값을 조건부 렌더링 트리거로 바로 쓸 수 있게
   * 하기 위함이다(예: "시급 기준과 월급 기준 판정이 다릅니다 — 왜 다른가요?" 설명 문구를
   * 이 플래그가 `true`일 때만 노출). `calculateFromHourlyWage`/`calculateFromMonthlyWage`
   * 각각이 `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`를 확정한 직후 이 값을 함께
   * 계산해야 한다(Builder 구현 지침, 아래 ARCHITECTURE.md "v2 개정" 체크리스트 참고).
   *
   * 수학적으로 HOURLY 모드에서는 이 값이 항상 `false`여야 한다(Calculation Auditor
   * EVALUATION.md "우선순위 항목 6" 증명 — `hourlyWage`가 정수이고 두 판정이 같은
   * `monthlyEquivalentHours`를 공유하는 한 두 판정이 갈릴 수 없다). 그렇다고 HOURLY 모드
   * 분기에서 이 값을 상수 `false`로 하드코딩하지 않는다 — 향후 반올림 정책이 다시 바뀌어
   * 이 증명의 전제가 깨지더라도 이 필드가 계속 정직하게 실제 비교 결과를 반영하도록, 두
   * 모드 모두 실제 두 판정값을 비교해서 계산한다.
   */
  minimumWageJudgmentMismatch: boolean;
  /**
   * 적용 기준 연도. 날짜 입력이 없는 계산기라 `weekly-holiday-allowance`와 동일하게
   * logic.ts의 `APPLICABLE_RATE_YEAR` 상수를 그대로 실어 보낸다(ARCHITECTURE.md "7.").
   */
  appliedRateYear: number;
  /**
   * (Architect 추가 — FORMULA.md "출력값" 표에는 없지만 UI 고지에 필요한 파생 플래그.
   * `weekly-holiday-allowance.cappedAtStatutoryLimit`와 정확히 같은 목적·같은 이름의
   * 필드를 이 계산기에도 그대로 둔다.) `weeklyHours > 40`이라 `weeklyHolidayHours`가
   * 8시간 상한에 걸렸는지 여부. breakdown이 "주 40시간을 초과한 시간은 주휴시간 산정에
   * 포함되지 않습니다"를 조건부로 표시하는 데 쓴다(FORMULA.md "예외").
   */
  cappedAtStatutoryLimit: boolean;
}

/**
 * logic.ts의 최종 반환 타입. `mode`를 판별 태그로 쓰는 2-way discriminated union이다.
 *
 * **왜 판별 유니온인가(단일 인터페이스 + optional 필드가 아닌 이유)**: `convertedMonthlyPay`
 * (HOURLY 전용)와 `convertedHourlyWage`(MONTHLY 전용)는 "둘 다 있을 수도, 둘 다 없을 수도
 * 있는 독립적인 optional 값"이 아니라 "정확히 둘 중 하나만 존재해야 하는 상호배타 값"이다
 * (`housing-acquisition-tax`의 4구간, `loan-interest-calculator`의 상환방식 3종과 같은
 * 논리 — `docs/CALCULATOR_RULES.md` "서로 다른 계산 방식을 같은 공식으로 처리하지
 * 않는다"를 타입으로 강제). optional 필드 방식이었다면 `result.convertedHourlyWage`에
 * `mode` 확인 없이 접근해도 컴파일이 통과해, `undefined`를 그대로 렌더링하는 버그가
 * 컴파일 타임에 잡히지 않는다.
 *
 * 공통 필드는 `MinimumWageComparisonBase` 교차 타입으로 합성했다(반복 나열 제거,
 * `LoanCalculationBase`와 동일한 목적).
 */
export type MinimumWageCalculatorResult =
  | (MinimumWageComparisonBase & {
      mode: "HOURLY";
      /**
       * 환산 월급(핵심 결과 카드 값) = `round(hourlyWage * monthlyEquivalentHours)`.
       * `displayMonthlyPay`와 항상 같은 값이지만, "이 값이 확실히 환산값"이라는 것을
       * 필드 이름 자체로 드러내기 위해 FORMULA.md가 정의한 이름을 그대로 유지한다
       * (SPEC "핵심 결과 카드"가 이 값 하나만 강조해서 보여줄 것을 요구 — ARCHITECTURE.md
       * "2." 참고).
       */
      convertedMonthlyPay: Won;
    })
  | (MinimumWageComparisonBase & {
      mode: "MONTHLY";
      /** 환산 시급(핵심 결과 카드 값) = `round(monthlyWage / monthlyEquivalentHours)`. */
      convertedHourlyWage: Won;
    });

/** `mode="HOURLY"` 분기만 뽑아낸 타입. `calculateFromHourlyWage`의 반환 타입에 쓴다. */
export type HourlyModeResult = Extract<MinimumWageCalculatorResult, { mode: "HOURLY" }>;

/** `mode="MONTHLY"` 분기만 뽑아낸 타입. `calculateFromMonthlyWage`의 반환 타입에 쓴다. */
export type MonthlyModeResult = Extract<MinimumWageCalculatorResult, { mode: "MONTHLY" }>;
