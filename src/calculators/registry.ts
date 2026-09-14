/**
 * 계산기 레지스트리 — 사이트 전체의 단일 진실 공급원(SSOT).
 *
 * docs/ARCHITECTURE.md "SEO / 사이트맵" 규칙:
 * - 모든 계산기는 여기에 등록한다.
 * - app/sitemap.ts, app/robots.ts, 홈페이지 목록, 카테고리 목록은 모두 이 레지스트리를
 *   순회해 동적으로 생성한다. sitemap.xml이나 네비게이션 목록을 손으로 따로 관리하지 않는다.
 * - `status: "draft"`인 계산기는 아직 구현이 끝나지 않은 것으로 간주해
 *   sitemap/robots/홈페이지/카테고리 목록 어디에도 노출하지 않는다. 실제 구현(Builder)이
 *   끝나고 Calculation Auditor/QA를 통과한 뒤에만 "published"로 바꾼다.
 */

export type CalculatorCategory =
  | "labor" // 노동/근로 (퇴직금, 연장근로수당 등)
  | "finance" // 대출, 예적금, 복리 등 금융
  | "tax" // 세금, 4대보험 등 정책 의존 계산
  | "date" // 날짜, 나이, 근속기간 등
  | "health" // BMI 등 건강
  | "life"; // 할인율, 단위 변환 등 생활 계산

export type CalculatorStatus = "draft" | "published";

/**
 * 카테고리 → 한글 라벨. 홈페이지 섹션 헤더, 카테고리 목록 페이지 등 카테고리를 사람이
 * 읽는 텍스트로 보여줘야 하는 모든 곳에서 이 매핑을 공유한다 (하드코딩 금지, SSOT).
 */
export const categoryLabels: Record<CalculatorCategory, string> = {
  labor: "노동/근로",
  finance: "금융",
  tax: "세금/정책",
  date: "날짜",
  health: "건강",
  life: "생활",
};

/**
 * 홈페이지 섹션이 항상 이 순서로 나타나도록 고정한 카테고리 순서.
 * `Object.keys(categoryLabels)`에 의존하면 매핑 선언 순서가 바뀔 때 섹션 순서도
 * 암묵적으로 바뀌므로, 노출 순서를 별도 상수로 명시한다.
 */
export const categoryOrder: CalculatorCategory[] = [
  "labor",
  "finance",
  "tax",
  "date",
  "health",
  "life",
];

export interface CalculatorMeta {
  /** URL 경로에 쓰이는 고유 식별자. app/calculators/[slug] 및 tasks/{slug}/와 일치해야 한다. */
  slug: string;
  /** 사람이 읽는 제목. <title>, 홈/카테고리 목록, JSON-LD에 그대로 쓰인다. */
  title: string;
  /** 목록 카드 및 메타 description에 쓰이는 한두 문장 설명. */
  description: string;
  /**
   * 홈/카테고리 목록 카드에 표시할 아이콘의 이름 키(이모지 아님). 실제 렌더링은
   * `components/calculator/CalculatorCard.tsx`의 `CalculatorIcon`이 이 키를 인라인 SVG로
   * 매핑한다(docs/DESIGN_SYSTEM.md "아이콘" — 사이트 전체가 이모지가 아닌 SVG 아이콘 언어로
   * 통일되어 있다: theme-toggle.tsx의 해/달, severance-pay/ui.tsx의 SectionIcon도 동일 패턴).
   * 새 계산기에 기존 6개 키로 표현이 안 되는 아이콘이 필요하면 이 유니온 타입과
   * `CalculatorIcon`의 매핑에 새 키를 함께 추가한다.
   */
  icon: "coins" | "calculator" | "calendar" | "chart" | "heart" | "utility" | "trend";
  category: CalculatorCategory;
  /**
   * draft: 구현 중 또는 검증 전 — sitemap/robots/홈/카테고리 목록에서 제외된다.
   * published: Calculation Auditor + QA 통과 — 공개 노출된다.
   */
  status: CalculatorStatus;
  /** 계산 로직/공식이 마지막으로 바뀐 날짜 (YYYY-MM-DD). sitemap의 lastmod에 쓰인다. */
  lastModified: string;
}

export const calculatorRegistry: CalculatorMeta[] = [
  {
    slug: "severance-pay",
    title: "퇴직금 계산기",
    description:
      "입사일·퇴사일과 최근 3개월 임금으로 법정 퇴직금 예상액과 산출 근거를 계산합니다.",
    icon: "coins",
    category: "labor",
    status: "published",
    lastModified: "2026-09-02",
  },
  {
    slug: "unemployment-benefit",
    title: "실업급여(구직급여) 계산기",
    description:
      "이직일 기준 연령·고용보험 가입기간과 최근 3개월 임금으로 예상 구직급여일액과 총 예상 지급액을 계산합니다.",
    // "coins"는 severance-pay가 이미 쓰고 있어 시각적으로 구분되도록 "calculator"를
    // 골랐다(tasks/unemployment-benefit 작업 지시가 예시로 든 키) — CalculatorCard.tsx의
    // CalculatorIcon에 이 키에 대응하는 SVG를 추가했다(docs/DESIGN_SYSTEM.md "아이콘" 참고).
    icon: "calculator",
    category: "labor",
    // Calculation Auditor(재검증 PASS, work24.go.kr 실제 대조 포함) + UX/UI Critic(재검증
    // PASS) + QA(PASS) 전부 통과, 최종 95점(tasks/unemployment-benefit/EVALUATION.md).
    status: "published",
    lastModified: "2026-09-02",
  },
  {
    slug: "weekly-holiday-allowance",
    title: "주휴수당 계산기",
    description:
      "시급과 1주 근무시간만 입력하면 1주치 주휴수당, 월 환산 주휴수당(참고), 주휴수당을 포함한 총 급여를 계산 과정과 함께 알려줍니다.",
    // "coins"(severance-pay), "calculator"(unemployment-benefit)와 시각적으로 구분되도록
    // "calendar"를 골랐다 — "유급 주휴일"이라는 개념(주 1회 쉬는 날)과도 잘 맞는다.
    // CalculatorCard.tsx의 CalculatorIcon에 "calendar" SVG 분기를 함께 추가했다
    // (docs/DESIGN_SYSTEM.md "아이콘": 새 키는 대응 SVG를 추가한다).
    icon: "calendar",
    category: "labor",
    // Calculation Auditor(PASS) + UX/UI Critic(PASS) + QA(PASS) + Optimizer 폴리시 라운드 통과,
    // 최종 98점(tasks/weekly-holiday-allowance/EVALUATION.md, 2026-09-04). published 전환.
    status: "published",
    lastModified: "2026-09-04",
  },
  {
    slug: "four-major-insurance",
    title: "4대 보험 계산기",
    description: "월 급여와 비과세 금액으로 국민연금·건강보험·장기요양보험·고용보험의 근로자 및 사업주 부담액을 계산합니다.",
    icon: "heart",
    category: "tax",
    status: "published",
    lastModified: "2026-09-04",
  },
  {
    slug: "military-discharge-date",
    title: "전역일 계산기",
    description: "복무 유형과 시작일로 예상 전역일·소집해제일, 남은 기간, 진행률과 주요 일정을 계산합니다.",
    icon: "calendar",
    category: "date",
    status: "published",
    lastModified: "2026-09-04",
  },
  {
    slug: "business-days",
    title: "영업일 계산기",
    description: "주말과 대한민국 공휴일·대체공휴일을 제외한 기간 내 영업일 수 또는 N영업일 전·후 날짜를 계산합니다.",
    icon: "calendar",
    category: "date",
    status: "published",
    lastModified: "2026-09-04",
  },
  {
    slug: "parental-leave-benefit",
    title: "육아휴직급여 계산기",
    description: "통상임금과 육아휴직 기간으로 일반·부모 함께·한부모 특례의 월별 예상 육아휴직급여를 계산합니다.",
    icon: "heart",
    category: "labor",
    status: "published",
    lastModified: "2026-09-04",
  },
  {
    slug: "age-calculator",
    title: "만 나이 계산기",
    description: "생년월일과 기준일로 만 나이, 정확한 경과기간, 다음 생일과 음력 설날 기준 띠·간지를 계산합니다.",
    icon: "calendar",
    category: "date",
    status: "published",
    lastModified: "2026-09-05",
  },
  {
    slug: "bmi-calculator",
    title: "BMI 계산기",
    description: "키와 체중으로 BMI를 계산하고 성인은 한국인 기준, 어린이·청소년은 성별·월령별 성장도표 백분위수로 안내합니다.",
    icon: "heart",
    category: "health",
    status: "published",
    lastModified: "2026-09-05",
  },
  {
    slug: "military-salary",
    title: "군인 월급 계산기",
    description: "복무형태와 입영일로 계급별 예상 병 봉급을 계산하고 장병내일준비적금의 원금·이자·정부 매칭지원금을 구분해 확인합니다.",
    icon: "coins",
    category: "finance",
    status: "published",
    lastModified: "2026-09-06",
  },
  {
    slug: "housing-subscription-score",
    title: "청약가점 계산기",
    description:
      "무주택기간·부양가족수·청약통장 가입기간으로 민영주택 일반공급 가점제 예상 점수와 항목별 계산 근거를 계산합니다.",
    // tasks/housing-subscription-score/ARCHITECTURE.md "7." — 기존 6개 키 중 아직 아무
    // 계산기도 쓰지 않은 "chart"를 골랐다("가점 점수"라는 결과 성격과 잘 맞는다).
    // CalculatorCard.tsx의 CalculatorIcon에 "chart" SVG 분기를 함께 추가했다.
    icon: "chart",
    category: "tax",
    // Calculation Auditor(재검증 PASS, 윤년 버그 수정 포함) + UX/UI Critic(재검증 PASS) +
    // QA(재검증 PASS) 전부 통과, 최종 96점(tasks/housing-subscription-score/EVALUATION.md,
    // 2026-09-06). published 전환.
    status: "published",
    lastModified: "2026-09-06",
  },
  {
    slug: "annual-salary-take-home-pay",
    title: "연봉 실수령액 계산기",
    description:
      "세전 연봉을 입력하면 4대 보험 근로자 부담분과 근로소득세·지방소득세를 공제한 세후 월 실수령액(예상)을 계산 근거와 함께 계산합니다.",
    // tasks/annual-salary-take-home-pay/ARCHITECTURE.md "8." — severance-pay/military-salary가
    // 이미 "금액/급여" 계열에 coins를 쓰고 있어 "월급·실수령액" 결과 성격과 가장 잘 맞는다.
    // four-major-insurance(heart)·housing-subscription-score(chart)와 시각적으로 구분된다.
    icon: "coins",
    category: "tax",
    // Calculation Auditor(재검증 PASS, 경계값 버그 수정 포함) + UX/UI Critic(재검증 PASS) +
    // QA(재검증 PASS) 전부 통과, 최종 97점(tasks/annual-salary-take-home-pay/EVALUATION.md,
    // 2026-09-06). published 전환.
    status: "published",
    lastModified: "2026-09-06",
  },
  {
    slug: "loan-interest-calculator",
    title: "대출 이자 계산기",
    description:
      "대출 원금·연이율·대출 기간과 상환방식(원리금균등/원금균등/만기일시)으로 매월(회차별) 상환액과 총 이자·총 상환금액을 계산합니다.",
    // tasks/loan-interest-calculator/ARCHITECTURE.md "8. 계산기 등록 전략" — "회차별 상환
    // 스케줄"이라는 결과 성격(추이를 보여주는 표형 데이터)과 잘 맞는 "chart"를 골랐다.
    // housing-subscription-score(tax)와 카테고리가 달라 같은 화면에 함께 노출되지 않으므로
    // 아이콘 중복이 문제되지 않는다(기존 관례 — coins도 여러 카테고리에서 중복 사용 중).
    icon: "chart",
    category: "finance",
    // Calculation Auditor(PASS, 예제 4 문서 오류 정정 포함) + UX/UI Critic(재검증 PASS) +
    // QA(재검증 PASS) 전부 통과, 최종 97점(tasks/loan-interest-calculator/EVALUATION.md,
    // 2026-09-06). published 전환.
    status: "published",
    lastModified: "2026-09-06",
  },
  {
    slug: "bill-split-calculator",
    title: "더치페이 계산기",
    description:
      "균등 분배·한명 몰아주기·사다리타기 세 가지 방식으로 모임 비용을 나누고, 결과를 이미지로 저장·공유합니다.",
    // tasks/bill-split-calculator/ARCHITECTURE.md "10. 계산기 등록 전략" — life 카테고리
    // 설명("할인율, 단위 변환 등 생활 계산")과 가장 맞닿는 범용 도구 성격이라 "utility"를
    // 골랐다. life 카테고리를 실질적으로 채우는 첫 계산기라 아이콘 중복 우려가 없다.
    icon: "utility",
    category: "life",
    // Calculation Auditor(공정성 통계 시뮬레이션 2라운드) + UX/UI Critic(재검증 PASS) +
    // QA(재검증 PASS) + 사용자 실브라우저 확인(사다리타기 렌더링·이미지 저장) 전부 통과,
    // 최종 96점(tasks/bill-split-calculator/EVALUATION.md, 2026-09-07). published 전환.
    status: "published",
    lastModified: "2026-09-07",
  },
  {
    slug: "average-cost-calculator",
    title: "평단가(물타기) 계산기",
    description:
      "보유 수량·평단가와 추가 매수 수량·단가로 매수 후 새 평단가, 총 보유수량, 총 투자원금과 평단가 변동(하락/상승)을 계산합니다.",
    // tasks/average-cost-calculator/ARCHITECTURE.md "8. 계산기 등록 전략" — finance 카테고리에
    // 이미 coins(military-salary)·chart(loan-interest-calculator)가 있어 "평단가 변동(하락/
    // 상승) 효과"라는 결과 성격에 맞는 새 아이콘 키 "trend"(등락 화살표/추세선)를 신설했다.
    icon: "trend",
    category: "finance",
    // 최종 97점(tasks/average-cost-calculator/EVALUATION.md, 2026-09-12). published 전환.
    status: "published",
    lastModified: "2026-09-12",
  },
  {
    slug: "d-day-calculator",
    title: "디데이 계산기",
    description:
      "시작일부터 목표일까지 남은(또는 지난) 날짜를 D-Day로 계산하거나, 기준일에 며칠을 더하거나 빼서 정확한 날짜와 요일을 계산합니다.",
    // tasks/d-day-calculator/SPEC.md "슬러그/카테고리" — date 카테고리(age-calculator·
    // military-discharge-date·business-days)가 이미 공유하는 "calendar"를 그대로 재사용한다.
    icon: "calendar",
    category: "date",
    // 최종 98점(tasks/d-day-calculator/EVALUATION.md, 2026-09-13). published 전환.
    status: "published",
    lastModified: "2026-09-13",
  },
  {
    slug: "national-pension-benefit-estimate",
    title: "국민연금 예상수령액 계산기",
    description:
      "출생연도·국민연금 총 가입기간·평균 월소득으로 예상 노령연금 월 수령액(세전)과 수급개시연령, 조기/연기연금 반영 금액을 계산합니다.",
    // tasks/national-pension-benefit-estimate/SPEC.md "슬러그/카테고리" — 핵심 결과가
    // 금액(월 연금 수령액)이라는 점에서 severance-pay/military-salary/annual-salary-take-
    // home-pay와 동일한 아이콘 키를 재사용한다(디자인 일관성, SPEC.md가 이미 확정한 근거).
    icon: "coins",
    category: "tax",
    // PUBLISHED 전환 게이트 해소: Calculation Auditor가 nps.or.kr 공개 API(getOHAH0011P0.do)로
    // 21개 라이브 데이터포인트를 직접 대조해 ÷12 등 산식 구조를 실증 검증했고, 이 과정에서
    // 발견한 반올림 정책 오류(원단위 반올림 → 10원 미만 절사)도 Formula Analyst 정정 →
    // Optimizer 수정 → 재검증까지 완료했다. UX/UI Critic·QA도 개선 Loop 2회차까지 전부 PASS.
    // 최종 97점(tasks/national-pension-benefit-estimate/EVALUATION.md, 2026-09-13). published 전환.
    status: "published",
    lastModified: "2026-09-13",
  },
  {
    slug: "bmr-calculator",
    title: "기초대사량(BMR) 계산기",
    description:
      "성별·나이·키·체중으로 하루 최소 에너지 소비량(기초대사량, BMR)을 계산하고, 활동량을 선택하면 활동을 반영한 하루 총 소비 칼로리(TDEE)까지 함께 계산합니다.",
    // tasks/bmr-calculator/SPEC.md "슬러그/카테고리" — health 카테고리에서 bmi-calculator가
    // 이미 heart를 쓰고 있어 시각적으로 구분되도록 chart를 골랐다(활동계수별 TDEE 비교라는
    // 결과 성격과도 맞는다, ARCHITECTURE.md "11." 동의).
    icon: "chart",
    category: "health",
    // 최종 97점(tasks/bmr-calculator/EVALUATION.md, 2026-09-13). published 전환.
    status: "published",
    lastModified: "2026-09-13",
  },
  {
    slug: "housing-acquisition-tax",
    title: "주택 취득세 계산기",
    description:
      "매매가·전용면적·조정대상지역 해당 여부·취득 후 보유 주택 수로 주택 매매(유상취득) " +
      "취득세·지방교육세·농어촌특별세와 총 납부액을 계산합니다.",
    // tasks/housing-acquisition-tax/SPEC.md "슬러그/카테고리" — tax 카테고리에 이미
    // heart(four-major-insurance)·chart(housing-subscription-score)·coins(annual-salary-
    // take-home-pay, national-pension-benefit-estimate, 2회 중복)가 쓰이고 있어, 현재 tax
    // 카테고리에서 쓰인 적 없는 "calculator"를 골라 시각적으로 구분한다(Architect "12." 동의).
    icon: "calculator",
    category: "tax",
    // 최종 96점(tasks/housing-acquisition-tax/EVALUATION.md, 2026-09-14). published 전환.
    status: "published",
    lastModified: "2026-09-14",
  },
];

/** 공개 대상(published)만 반환한다. 홈/카테고리 목록, sitemap, robots가 공통으로 사용한다. */
export function getPublishedCalculators(): CalculatorMeta[] {
  return calculatorRegistry.filter((c) => c.status === "published");
}

/** slug로 계산기 메타데이터를 찾는다. draft/published 여부와 무관하게 반환한다 — 호출부가 status를 직접 판정한다. */
export function getCalculatorBySlug(slug: string): CalculatorMeta | undefined {
  return calculatorRegistry.find((c) => c.slug === slug);
}

export function getPublishedCalculatorsByCategory(
  category: CalculatorCategory,
): CalculatorMeta[] {
  return getPublishedCalculators().filter((c) => c.category === category);
}

export interface CalculatorCategoryGroup {
  category: CalculatorCategory;
  label: string;
  calculators: CalculatorMeta[];
}

/**
 * 홈페이지가 쓰는 카테고리별 그룹 목록. `categoryOrder` 순서로 순회하되, 공개된
 * 계산기가 하나도 없는 카테고리는 결과에서 아예 제외한다 — "빈 카테고리 섹션은
 * 렌더링하지 않는다"는 규칙을 호출부(page.tsx)마다 반복 구현하지 않도록 여기(SSOT)에서
 * 한 번만 처리한다. 계산기가 늘어나 카테고리가 채워지면 호출부 수정 없이 자동으로
 * 섹션이 나타난다.
 */
export function getPublishedCalculatorsGroupedByCategory(): CalculatorCategoryGroup[] {
  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      calculators: getPublishedCalculatorsByCategory(category),
    }))
    .filter((group) => group.calculators.length > 0);
}

/**
 * `lastModified` 기준 최신순 상위 `limit`개 공개 계산기. 홈페이지 "최근 추가된 계산기"
 * 섹션이 쓴다. `lastModified`는 항상 `YYYY-MM-DD` 문자열이므로 문자열 내림차순 정렬이 곧
 * 최신순이다(날짜 파싱 불필요). 계산기가 늘어나도 호출부 수정 없이 최신 N개가 자동으로
 * 갱신된다.
 */
export function getRecentlyAddedCalculators(limit: number): CalculatorMeta[] {
  return [...getPublishedCalculators()]
    .sort((a, b) => (a.lastModified < b.lastModified ? 1 : a.lastModified > b.lastModified ? -1 : 0))
    .slice(0, limit);
}
