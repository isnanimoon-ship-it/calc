/**
 * 기초대사량(BMR) 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 모두 Builder 단계에서 이 폴더에 추가된다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/bmr-calculator/FORMULA.md의 "입력값"/"출력값" 표를 그대로 반영한다.
 * 이 계산기의 핵심 설계 원칙은 FORMULA.md가 명시한 "대표 공식(BMR)"·"보조 공식(BMR_alt,
 * Should Have)"·"TDEE"가 서로 완전히 독립된 계산이라는 사실을 함수 경계뿐 아니라 타입
 * 경계로도 드러내는 것이다 — tasks/bmr-calculator/ARCHITECTURE.md "1.", "2." 참고.
 *
 * raw 폼 입력 타입(`RawBmrFormInput` 등 문자열 기반 입력)은 이 파일에 두지 않는다 —
 * `bmi-calculator`/`d-day-calculator`/`national-pension-benefit-estimate` 전 계산기가
 * 일관되게 "raw 폼 타입은 validation.ts 로컬"이라는 관례를 따르므로 이 계산기도 동일하게
 * Builder가 validation.ts에 정의한다.
 */

export type Sex = "male" | "female";

/**
 * FORMULA.md "활동계수 5단계" 표의 레벨 번호(1~5). 활동계수 실수값(1.2~1.9) 자체는 여기
 * 두지 않고 logic.ts 로컬 상수 테이블에서 관리한다 — 법령·고시 값이 아니라 여러 독립
 * 출처가 재현하는 학술 표준값이라 `rates-{year}.json`에 둘 근거가 없다(이 계산기는
 * SPEC.md가 명시한 대로 "정책형 계산기가 아니"라 `source`/`lastVerified`/`nextReviewDue`
 * 스키마 적용 대상도 아니다) — ARCHITECTURE.md "3." 참고.
 */
export type ActivityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * 계산에 필요한 신체 정보 4종. `calculateBmr`/`calculateBmrAlternative`가 공통으로 받는
 * 파라미터 모양이다 — 두 함수 모두 이 값만으로 완전히 독립적으로 계산 가능하다(FORMULA.md
 * "계산 순서" 5번: "대표 공식 계산과 서로 영향을 주지 않는 완전히 독립된 계산").
 */
export interface BodyMetrics {
  sex: Sex;
  /** 만 나이(세), 정수. 19~78(양끝 포함). */
  ageYears: number;
  /** cm, 소수 첫째 자리까지. 100.0~230.0(양끝 포함). */
  heightCm: number;
  /** kg, 소수 첫째 자리까지. 20.0~300.0(양끝 포함). */
  weightKg: number;
}

/**
 * 계산 폼 전체 입력(검증 통과 후, `calculateBmrCalculation`의 파라미터).
 * `activityLevel`은 선택 입력이라 `null`을 명시적으로 허용한다(FORMULA.md "입력값" 표:
 * `1|2|3|4|5|null`) — "선택 안 함"을 빈 문자열이나 `undefined`가 아니라 리터럴 `null`로
 * 다뤄 "값이 없음"을 타입 레벨에서 명확히 한다. UI의 활동량 선택 컨트롤도 "선택 안 함"을
 * 하나의 명시적 옵션으로 노출해 이 값과 그대로 대응시킨다(ARCHITECTURE.md "7.2").
 */
export interface BmrCalculationInput extends BodyMetrics {
  activityLevel: ActivityLevel | null;
}

/**
 * "완전정밀도 값"과 "표시용 반올림 값"을 하나의 값 객체로 짝지은 구조.
 * FORMULA.md 출력값 표의 `xxxExact`/`xxxDisplay` 쌍을 그대로 반영한다.
 *
 * `national-pension-benefit-estimate`는 완전정밀도 중간값(`basicPensionMonthlyRaw`)을
 * 결과 타입에서 의도적으로 숨겼지만, 이 계산기는 그렇게 하지 않는다 — SPEC.md Must Have
 * "계산식에 실제 입력값을 대입한 breakdown을 표시한다"가 반올림 전 값을 화면에 실제로
 * 보여줄 것을 요구하고, FORMULA.md 자신도 `bmrExact`를 정식 출력값으로 정의했기 때문이다
 * (예: "10×70+6.25×175−5×30+5 = 1648.75kcal → 반올림 1649kcal"라는 근거 문장을 만들려면
 * raw 값이 UI에 필요하다).
 */
export interface RoundedKcalValue {
  /**
   * 반올림 전 완전정밀도 kcal/일(FORMULA.md `bmrExact`/`bmrAltExact`에 대응).
   * 계산 근거 breakdown 표시에 쓰고, **두 번째 반올림에는 절대 재사용하지 않는다**
   * (ARCHITECTURE.md "2." 핵심 불변식 — `tdeeExact`는 반드시 이 값에서 파생돼야 한다).
   */
  raw: number;
  /** 화면 표시용 정수 kcal/일(소수 첫째 자리 반올림, 0.5는 올림). */
  display: number;
}

/** TDEE 결과. `RoundedKcalValue`에 적용된 활동계수 정보를 더한다. */
export interface TdeeValue extends RoundedKcalValue {
  activityLevel: ActivityLevel;
  /** 적용된 활동계수(1.2 / 1.375 / 1.55 / 1.725 / 1.9 중 하나). */
  activityFactor: number;
}

/**
 * `calculateBmrCalculation`(logic.ts 오케스트레이터)의 반환 타입.
 *
 * - `bmr`: 대표 공식(Mifflin-St Jeor) 결과. 항상 존재한다(Must Have, 활동량 선택 여부와
 *   무관하게 항상 계산·표시된다).
 * - `bmrAlternative`: 보조 공식(Harris-Benedict 개정판) 결과. **optional이 아니다** —
 *   SPEC.md Should Have가 "대표 공식이 아닌 다른 공식의 결과값을 ... 항상 참고 표시"라고
 *   명시했으므로, TDEE와 달리 사용자의 선택 입력에 의존하지 않고 매 계산마다 항상 함께
 *   노출된다(ARCHITECTURE.md "1." 참고 — 대표 공식과 완전히 독립적으로 계산되는 별도 값).
 * - `tdee`: `activityLevel`을 선택했을 때만 존재한다. `undefined`는 "TDEE 섹션 자체를
 *   만들지 않는다"는 FORMULA.md "계산 순서" 6번("활동량을 선택하지 않았으면 TDEE 관련
 *   값을 아예 생성하지 않는다")을 타입으로 강제한다 — 빈 값이 아니라 필드 자체의 부재로
 *   표현한다. `national-pension-benefit-estimate`의 `adjustedPensionMonthly?` 패턴과
 *   동일한 근거를 적용했다: 판별 유니온으로 결과 모양 전체를 두 갈래로 나눌 만큼 두 경우의
 *   구조가 다르지 않고("TDEE가 있는지"만 다르고 `bmr`/`bmrAlternative`는 항상 동일한
 *   모양), optional 필드가 더 단순하고 정확하다(ARCHITECTURE.md "4." 참고).
 */
export interface BmrCalculationResult {
  /** 검증 통과된 입력 에코 — 결과 상세/breakdown이 입력값을 그대로 보여줄 때 재사용. */
  input: BmrCalculationInput;
  bmr: RoundedKcalValue;
  bmrAlternative: RoundedKcalValue;
  tdee?: TdeeValue;
}

/**
 * (Should Have) "활동계수 5단계 전체 비교표"용 행 — 사용자가 실제로 선택하지 않은 단계까지
 * 포함한 5개 행. 별도 산식이 아니라 `calculateTdee`를 레벨 1~5에 대해 각각 호출한 결과일
 * 뿐이다(ARCHITECTURE.md "1.3" — 표 생성 헬퍼가 새 산식을 도입하지 않고 기존 함수를
 * 재사용해야 드리프트가 없다).
 */
export type TdeeLevelComparisonRow = TdeeValue;

/**
 * `ShareActions` 공유 URL에 담기는 상태. SPEC.md Must Have "결과 공유 상태에는 성별, 나이,
 * 키, 체중, (선택한 경우) 활동량만 저장한다"를 그대로 반영한다. `BmrCalculationInput`과
 * 완전히 같은 모양이라 별도 타입을 만들지 않고 그대로 재사용한다 — 전부 원시 타입(`string
 * 리터럴`/`number`/`null`)이라 `average-cost-calculator`가 겪은 `BigInt` 직렬화 문제나
 * `bill-split-calculator`의 RNG 재현 문제가 애초에 발생하지 않는다(`national-pension-
 * benefit-estimate`와 동일한 근거 — 입력을 그대로 `encodeShareState`에 넘기면 결정적으로
 * 같은 결과가 재현된다).
 */
export type BmrCalculatorShareState = BmrCalculationInput;
