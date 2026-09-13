/**
 * 디데이 계산기(d-day-calculator) 타입.
 *
 * Architect 라운드(tasks/d-day-calculator/ARCHITECTURE.md)에서 확정. 계산 공식 자체는
 * FORMULA.md를 따른다 — 이 파일은 타입만 정의하고 계산 로직(logic.ts)은 Builder가 채운다.
 *
 * 모드 A(디데이 계산)와 모드 B(날짜 계산)는 서로 다른 입력·결과 모양을 가지며, 화면에서도
 * 서로 독립적인 상태로 보존된다(SPEC.md Must Have "모드 전환 후에도 각 모드의 입력값과
 * 계산 결과를 서로 보존") — 그래서 `business-days`의 `mode` 판별 유니온(`RangeInput`/
 * `OffsetInput`)과 달리, 이 계산기는 두 모드를 하나의 판별 유니온으로 묶지 않고 완전히
 * 독립된 타입 두 벌로 둔다(ui.tsx가 두 모드의 state를 동시에 들고 있어야 하므로, 유니온으로
 * 묶으면 오히려 "현재 보이지 않는 모드의 값"을 표현하기 어려워진다 — ARCHITECTURE.md "3."
 * 참고). 유니온은 오직 URL 공유 상태(`DdayCalculatorShareState`)에서만 쓴다 — 공유 시점에는
 * "그 순간 활성 모드 하나"만 직렬화하면 되기 때문이다.
 */

/** JS `Date.getUTCDay()` 규약과 동일한 요일 인덱스(0=일요일 ~ 6=토요일). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 화면에서 활성화된 모드. 탭/세그먼트 토글의 선택 값이자 공유 상태의 판별 태그로도 쓰인다. */
export type DdayCalculatorMode = "dday" | "dateShift";

// ── 모드 A: 디데이 계산 ──────────────────────────────────────────────────

export interface DdayCalculationInput {
  /** 디데이 기산 시작일. "YYYY-MM-DD". */
  startDate: string;
  /** 목표일. "YYYY-MM-DD". startDate와 선후관계 제약 없음(SPEC.md). */
  targetDate: string;
}

/**
 * FORMULA.md "주 단위 환산(Should Have)" 결과. `n === 0`(당일)이면 의미가 없으므로
 * `DdayCalculationResult.weeksBreakdown`은 이 타입 대신 `null`을 쓴다.
 */
export interface WeeksBreakdown {
  weeks: number;
  remainderDays: number;
}

export interface DdayCalculationResult {
  startDate: string;
  targetDate: string;
  /** `daySerial(targetDate) - daySerial(startDate)`. 부호 있음(미래=양수, 과거=음수). */
  diffDays: number;
  /**
   * `"D-Day"` | `"D-{n}"` | `"D+{n}"` — FORMULA.md가 정의한 정확한 형식의 문자열이다.
   * 로케일·콤마 서식이 없는 리터럴이라 Golden Test가 이 필드를 직접 문자열로 대조할 수
   * 있다(예: `toBe("D-104")`). 사람이 읽는 한국어 문장("...까지 104일 남았습니다")은
   * formatting.ts가 이 필드가 아니라 `diffDays`로부터 별도로 조립한다.
   */
  ddayLabel: string;
  /** `diffDays === 0`이면 `null`(FORMULA.md "n===0 → 표시하지 않음" 규칙 그대로). */
  weeksBreakdown: WeeksBreakdown | null;
  /** Should Have — 시작일 요일. */
  startWeekday: Weekday;
  /** Should Have — 목표일 요일. */
  targetWeekday: Weekday;
}

// ── 모드 B: 날짜 계산(더하기/빼기) ───────────────────────────────────────

export type DateShiftDirection = "add" | "subtract";

export interface DateShiftCalculationInput {
  /** 날짜 계산 기준일. "YYYY-MM-DD". */
  baseDate: string;
  /** 더하거나 뺄 일수. 0 이상 정수(방향은 별도 `direction`으로 분리, FORMULA.md 입력값). */
  days: number;
  direction: DateShiftDirection;
}

export interface DateShiftCalculationResult {
  baseDate: string;
  days: number;
  direction: DateShiftDirection;
  /** `baseDate ± days`. "YYYY-MM-DD". */
  resultDate: string;
  resultWeekday: Weekday;
}

// ── 공유 상태(ShareActions URL 복원) ─────────────────────────────────────

/**
 * `src/lib/share.ts`의 `encodeShareState`/`decodeShareState`가 다루는 이 계산기의 공유
 * 상태. 그 순간 활성 모드 하나의 입력값만 담는다(계산 결과는 입력에서 항상 재계산 가능하므로
 * 중복 저장하지 않는다 — docs/SHARING.md "URL 규칙"). 복원 시 공유되지 않은 다른 모드는
 * 기본값(오늘 날짜 등)으로 초기화된다.
 */
export type DdayCalculatorShareState =
  | ({ mode: "dday" } & DdayCalculationInput)
  | ({ mode: "dateShift" } & DateShiftCalculationInput);
