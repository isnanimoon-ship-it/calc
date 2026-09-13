/**
 * 날짜 계산 공용 유틸 — "N개월 전" 날짜 계산(달력 월 단위 이동 + 월말 clamp)과
 * 그 사이 달력일수 계산.
 *
 * 원래 `src/calculators/severance-pay/logic.ts`에 계산기 전용 코드로 있던 로직을 그대로
 * 추출한 것이다(로직 자체는 한 글자도 바꾸지 않았다 — 동작 동일성 보장이 이 추출의 전제).
 * `src/calculators/unemployment-benefit`가 FORMULA.md에서 이 로직(baseDays 산출)을
 * 그대로 재사용하라고 명시적으로 요구했고, 두 계산기 모두 근로기준법 제2조제1항제6호
 * "평균임금 산정기간"(퇴사/이직일 이전 3개월의 달력일수) 정의를 공유하므로 여기(`src/lib/`)로
 * 옮겨 두 계산기가 같은 구현을 임포트해 쓴다 (docs/ARCHITECTURE.md "날짜 계산 유틸 공용화"
 * 결정 사례 참고). `src/lib/`은 계산기 전용이 아닌 순수 유틸(예: `site-config.ts`)을 두는
 * 기존 관례를 따른다.
 *
 * 이 파일은 UTC 자정 고정 날짜 계산만 다룬다(timezone 이동 문제 방지,
 * docs/CALCULATOR_RULES.md "날짜 계산기" 참고). "월 단위 사업기간/근속연수" 판정처럼
 * 계산기마다 의미가 달라지는 로직은 여기 두지 않고 각 계산기의 logic.ts에 남긴다 — 이
 * 파일은 순수하게 "달력 날짜 산술"만 책임진다.
 */

/** 하루의 밀리초. UTC 자정 기준 날짜 전용 계산에만 사용한다(DST 영향 없음). */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * "YYYY-MM-DD" 문자열을 UTC 자정 기준 Date로 파싱한다.
 * 로컬 timezone의 영향을 받지 않도록 항상 UTC 컴포넌트로 직접 생성한다
 * (docs/CALCULATOR_RULES.md "날짜 계산기" 참고).
 *
 * 유효하지 않은 형식/날짜(예: 2024-02-30)이면 null을 반환한다 — 호출부(validation.ts)가
 * 이미 형식을 검증했다는 전제이지만, 이 함수 자체도 방어적으로 null을 반환할 수 있게 한다.
 */
export function parseIsoDateUtc(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC는 범위를 벗어난 월/일을 다음 달로 넘겨버린다(예: 2월 30일 → 3월 1~2일).
  // 왕복 검증으로 그런 "정상화"가 일어났는지 확인해 걸러낸다.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** 두 UTC 자정 Date 사이의 일수 차이(끝 - 시작). */
export function diffDaysUtc(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * `date`에 `days`일을 더한(음수면 뺀) UTC 자정 기준 Date를 반환한다("날짜 + N일 이동").
 *
 * `d-day-calculator`(디데이 계산기) FORMULA.md 모드 B("날짜 이동")가
 * `resultSerial = daySerial(baseDate) + signedDays; resultDate = fromSerial(resultSerial)`로
 * 정의한 것과 수학적으로 완전히 동일하다 — `parseIsoDateUtc`로 만든 Date는 항상 UTC
 * 자정(시:분:초:밀리초 0)이므로 `date.getTime()`은 이미 `daySerial(date) * MS_PER_DAY`와
 * 정확히 같다. 따라서 `date.getTime() + days * MS_PER_DAY`는 "일련번호에 N을 더한 뒤 다시
 * 날짜로 변환"하는 것과 같은 값을 만들며, 별도로 일련번호 변수를 거칠 필요가 없다(정수
 * 밀리초 산술만 사용해 부동소수점 오차가 없다).
 *
 * `military-discharge-date/logic.ts`의 `addCalendarDays`(문자열 in/out API)와 알고리즘은
 * 동일하지만 시그니처가 다르다(이 함수는 Date를 받고 Date를 반환) — 이미 배포된 계산기의
 * 기존 문자열 기반 구현은 리팩터링하지 않고 그대로 둔 채(docs/ARCHITECTURE.md "결정 사례:
 * 순수 날짜 산술 함수의 공용화 범위 재확인"), 이 파일의 기존 관례(Date 입출력)를 따르는
 * 새 함수로 추가한다. 새로 이 파일에 함수를 추가하는 것은 기존 계산기를 건드리지 않는
 * 순수 additive 변경이라 회귀 위험이 없다.
 */
export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * UTC 자정 기준 Date의 요일 인덱스를 반환한다(0=일요일 ~ 6=토요일, JS `Date.getUTCDay()`
 * 표준 그대로). `d-day-calculator` FORMULA.md "요일 계산"이 1차 계산 방식으로 채택한
 * `new Date(daySerial*MS_PER_DAY).getUTCDay()`를 그대로 노출하는 얇은 래퍼이며, 같은
 * FORMULA.md가 이 값을 Zeller's Congruence로 독립 교차검증했다("요일 계산 검증" 표 참고).
 * 이 함수 자체는 정수 인덱스만 반환한다 — 한국어 라벨("일월화수목금토")로 바꾸는 것은 각
 * 계산기의 formatting.ts 책임이다(이 파일은 도메인/표시 로직을 두지 않는다).
 */
export function weekdayUtc(date: Date): number {
  return date.getUTCDay();
}

/**
 * UTC 자정 기준 Date를 "YYYY-MM-DD" 문자열로 되돌린다 — `parseIsoDateUtc`의 역함수다.
 * 지금까지 이 파일은 문자열 → Date 방향(`parseIsoDateUtc`)만 제공했는데, `d-day-calculator`
 * 모드 B가 `addDaysUtc`로 이동한 결과 날짜를 다시 "YYYY-MM-DD" 문자열(`resultDate`)로
 * 표시해야 해서 반대 방향 변환이 처음 필요해졌다.
 */
export function formatIsoDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 주어진 연/월(0-based, 0=1월)의 마지막 날짜(일)를 반환한다(윤년 2월 포함).
 * "다음 달 0일 = 이번 달 마지막 날"이라는 표준 트릭을 쓴다. `monthIndex0 + 1`이 12(다음 해 1월)가
 * 되는 경우도 Date.UTC가 연도를 자동으로 넘겨 정확히 처리한다 — 이는 우연한 오버플로에 기대는
 * 것이 아니라 "월의 마지막 날짜를 구하기 위한 의도된 계산"이다.
 */
export function lastDayOfMonthUtc(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * 기준일로부터 "N개월 전" 날짜를 계산한다(달력 월 단위 이동, 명시적 clamp 적용).
 * severance-pay FORMULA.md 3단계 "baseDays = calendarDays(retireDate - 3개월, retireDate)"의
 * "retireDate - 3개월"과, "정밀도/반올림 정책 > 산정기간 총일수 월말 처리" 절의 clamp
 * 규칙을 그대로 구현한다(unemployment-benefit FORMULA.md도 동일 규칙을 그대로 재사용).
 *
 * 규칙: 이동 대상 월에 원래 일(day)이 존재하지 않으면(예: 5/31 → 2월에는 31일이 없음,
 * 7/31 → 4월에는 31일이 없음, 12/31 → 9월에는 31일이 없음) **그 달의 마지막 날로 보정
 * (clamp)한다.** 이 규칙은 특정 달만 예외 처리하지 않고 모든 월말 경계에 동일하게
 * 적용한다 — moel.go.kr의 부분 패치(5월 29~31일만 하드코딩 처리하고 7월·12월은 방치)를
 * 의도적으로 따르지 않는다(severance-pay FORMULA.md 2026-09-02 재검토 근거).
 *
 * JS Date의 월 오버플로 자동 정규화(예: `new Date(Date.UTC(2024,1,31))`이 3월로 밀리는 동작)에는
 * 절대 의존하지 않는다 — 연/월/일을 직접 계산해 명시적으로 clamp한다.
 */
export function calendarMonthsBeforeUtc(date: Date, months: number): Date {
  const rawMonthIndex0 = date.getUTCMonth() - months;
  const year = date.getUTCFullYear() + Math.floor(rawMonthIndex0 / 12);
  const monthIndex0 = ((rawMonthIndex0 % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), lastDayOfMonthUtc(year, monthIndex0));
  return new Date(Date.UTC(year, monthIndex0, day));
}

/**
 * "기준일 이전 N개월"의 달력일수(며칠인지)를 계산한다 — 근로기준법 제2조제1항제6호
 * "평균임금 산정기간"(퇴사/이직일 이전 3개월)처럼, "종료일 - N개월 전 날짜"의 달력일수 차이가
 * 필요한 계산기가 공통으로 쓰는 함수다. severance-pay는 `calculateBaseDays`라는 이름으로,
 * unemployment-benefit도 동일 규칙(FORMULA.md가 명시)으로 이 함수를 그대로 재사용한다.
 *
 * `endDateIso`가 유효하지 않은 날짜 문자열이면 에러를 던진다(각 계산기의 validation.ts가
 * 이미 형식을 검증했다는 전제이지만, 방어적으로 명확한 에러 메시지를 남긴다).
 */
export function calculateCalendarPeriodDaysBefore(
  endDateIso: string,
  months: number,
): number {
  const end = parseIsoDateUtc(endDateIso);
  if (!end) {
    throw new Error(
      `calculateCalendarPeriodDaysBefore: 유효하지 않은 날짜 문자열 (endDateIso=${endDateIso})`,
    );
  }
  const start = calendarMonthsBeforeUtc(end, months);
  return diffDaysUtc(start, end);
}

/**
 * `start`부터 `end`까지 "만 나이 방식"(달력상 연/월/일을 직접 비교해, 아직 도래하지 않은
 * 기념일은 차감)으로 경과한 **완전한 연수**를 계산한다.
 *
 * housing-subscription-score(청약가점 계산기)가 무주택기간·청약통장 가입기간 두 항목에
 * 공통으로 필요로 해 추가한 함수다(tasks/housing-subscription-score/FORMULA.md "공식" 절의
 * 의사코드를 그대로 옮김, Architect가 로직을 새로 설계하지 않았다). `calendarMonthsBeforeUtc`
 * (기준일에서 N개월을 뺀 날짜를 구하는 역방향 함수)와는 용도가 다르다 — 이 함수는 두 날짜
 * "사이의" 경과 연수를 정방향으로 계산한다.
 *
 * 이 함수 자체는 "몇 년째부터 몇 점"·"몇 세부터 산정 시작" 같은 계산기별 의미를 전혀
 * 담지 않는 순수 달력 산술이다(도메인 판정은 각 계산기의 logic.ts가 담당 — 이 파일 상단
 * 주석의 기존 원칙과 동일). `age-calculator/date-utils.ts`의 `anniversaryInYear` 기반 만
 * 나이 계산과 개념은 같지만(달력 기준 나이/경과연수), 2월 29일 출생 등 윤년 기념일을 다루는
 * 세부 방식이 서로 다르다(그쪽은 기념일 자체를 윤년 여부에 따라 2/28로 clamp한 뒤 문자열
 * 비교, 이 함수는 (월,일) 튜플을 직접 비교) — 이미 배포된 age-calculator의 동작을 바꾸는
 * 리팩터링은 이번 작업 범위가 아니라서 통합하지 않았다(docs/ARCHITECTURE.md
 * "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인" 참고).
 *
 * 음수가 되지 않도록(start가 end보다 미래인 경우) 0으로 clamp한다.
 */
export function calendarFullYearsBetweenUtc(start: Date, end: Date): number {
  const startMonthDay = start.getUTCMonth() * 100 + start.getUTCDate();
  const endMonthDay = end.getUTCMonth() * 100 + end.getUTCDate();
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (endMonthDay < startMonthDay) years -= 1;
  return Math.max(0, years);
}

/**
 * `start`부터 `end`까지 "만 나이 방식"으로 경과한 **완전한 개월수**를 계산한다
 * (`calendarFullYearsBetweenUtc`의 개월 단위 버전, 같은 근거로 추가됨).
 *
 * 일(day) 비교만으로 월 하나를 차감할지 판단한다(월 튜플까지 볼 필요 없이 "종료일의 일이
 * 시작일의 일보다 이르면 아직 그 달의 기념일에 도달하지 않은 것"으로 충분 — 연/월 차이는
 * `end.year*12+end.month`와 `start.year*12+start.month`의 차이로 이미 정확히 구해진다).
 *
 * 음수가 되지 않도록 0으로 clamp한다.
 */
export function calendarFullMonthsBetweenUtc(start: Date, end: Date): number {
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  return Math.max(0, months);
}
