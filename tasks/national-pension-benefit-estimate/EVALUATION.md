# EVALUATION: 국민연금 예상수령액 계산기

## Builder 구현 완료

2026-09-13, Builder가 승인된 SPEC.md/FORMULA.md/ARCHITECTURE.md를 그대로 구현했다. 아래는
구현 사실 기록이며 **최종 정확성 판정이 아니다** — 최종 판정은 Calculation Auditor·QA의
몫이다(.claude/agents/builder.md). "테스트 통과"라고 적어도 Calculation Auditor·QA는 이를
그대로 신뢰하지 않고 독립적으로 재검증해야 한다.

### 구현 파일

- `src/calculators/national-pension-benefit-estimate/logic.ts` — `findPensionableAgeRow`,
  `calculateContributionAdjustmentFactor`, `calculateEarlyOrDeferredAdjustmentRate`,
  `calculateNationalPensionBenefit`(오케스트레이터). FORMULA.md "계산 순서" 2~10단계를
  ARCHITECTURE.md "5.", "6."이 정한 구조(단일 파일, 3개 이름 있는 함수 + 인라인 clamp/÷12)
  그대로 구현했다. `basicPensionMonthlyRaw`(완전정밀도)는 결과 타입에 노출하지 않고 지역
  변수로만 유지하며, 조기/연기 조정(9단계)은 반드시 이 값을 기준으로 별도 반올림한다 —
  `basicPensionMonthly`(반올림 후 표시값)를 재사용하지 않는다는 핵심 불변식을 Golden Test
  #13~14가 직접 검증한다(반올림된 값을 썼다면 나왔을 오답 466,061원과 실제로 나와야 하는
  466,062원을 나란히 대조하는 assertion 포함).
- `src/calculators/national-pension-benefit-estimate/validation.ts` — `MIN_CONTRIBUTION_START_AGE`
  (18), `MAX_CONTRIBUTION_END_AGE`(70, 법령 검증치 아닌 실용적 안전판), `MAX_TOTAL_CONTRIBUTION_MONTHS`
  (624개월)를 ARCHITECTURE.md "7.1" 그대로 상수화했다. `earlyOrDeferredMonths` 범위(-60~60)는
  `rates2026.nationalPensionBenefit.earlyPension/deferredPension.maxMonths`에서 조회하며
  하드코딩하지 않는다. "현재 연도"는 `ui.tsx`가 `currentYear` 인자로 주입한다(순수 함수가
  `Date.now()`를 직접 읽지 않음).
- `src/calculators/national-pension-benefit-estimate/formatting.ts` — 금액/나이/연도/개월/
  가입기간("N년 M개월(총 OOO개월)") 포맷, 비례상수·보정계수·조기/연기 조정률 표시, 계산
  근거(`buildCalculationSteps`) 문자열 조립, 기준소득월액 clamp 고지 문구(`buildBValueClampNotice`),
  11개 조기/연기 select 옵션(`EARLY_OR_DEFERRED_OPTIONS`, 값·비율을 rates2026에서 동적으로
  읽어 라벨 생성 — 하드코딩 없음).
- `src/calculators/national-pension-benefit-estimate/content.ts` — 소개/사용법/정책 고지
  문구(FORMULA.md "1-c" 비례상수 근사 고지, "3." B값 근사 고지, SPEC.md "설명과 정책 고지"
  전 항목, annual-salary-take-home-pay/four-major-insurance 교차 안내) + FAQ 7개.
- `src/calculators/national-pension-benefit-estimate/ui.tsx` — 입력 폼(4개 필드, 조기/연기는
  네이티브 `<select>`) + 이중 결과 카드(조기/연기 미신청 시 단일 카드, 신청 시 조정 반영
  금액을 1차 강조 + 법정 나이 기준 금액을 보조 표기) + "지급대상 아님" 분기(수급개시연령은
  이 경우에도 계속 표시) + `ShareActions` + 계산 근거/적용된 입력값 SectionCard + 소개/사용법/
  정책안내/FAQ.
- `src/calculators/national-pension-benefit-estimate/{logic,validation,formatting}.test.ts` —
  아래 "Golden Test" 참고.
- `src/calculators/registry.ts` — `national-pension-benefit-estimate` 신규 등록,
  **`status: "draft"`**(아래 "PUBLISHED 게이트 인계" 참고).
- `src/calculators/calculator-components.ts`, `app/calculators/[slug]/page.tsx` — UI 컴포넌트
  연결 및 FAQPage JSON-LD용 `npbFaqSeoItems` 매핑 추가.
- `src/data/rates-2026.json`, `src/calculators/national-pension-benefit-estimate/types.ts`,
  `tasks/national-pension-benefit-estimate/ARCHITECTURE.md`는 Architect 라운드에서 이미
  작성 완료된 상태였고 이번 Builder 라운드에서 수정하지 않았다.

### Golden Test / Edge Case Test

- FORMULA.md 검증 예제 15개 중 14개(#1~#14)를 `logic.test.ts`에, 나머지 1개(#15, 조기/연기
  61개월 입력 오류)를 `validation.test.ts`에 ARCHITECTURE.md "12."가 지정한 대로 배치했다
  (예제 15는 `logic.ts`가 아니라 `validation.ts`의 책임이라는 설계 근거를 그대로 따름).
- `docs/CALCULATOR_RULES.md` "Golden Test — 공식 계산기 예시값과 대조한 케이스 최소 2개"
  요건은 **이번 라운드까지 예제 1(독립 재무 콘텐츠 벤치마크, A=B=250만원·40년·구 상수 1.2 →
  월 100만원과 정확히 일치) 1건만 충족한 상태다.** 이는 Builder가 새로 발견한 미비점이
  아니라 FORMULA.md/ARCHITECTURE.md가 이미 명시적으로 게이트를 건 항목이며, 아래 "PUBLISHED
  게이트 인계"에서 그대로 다음 단계로 넘긴다.
- `logic.test.ts`에 ARCHITECTURE.md "12."가 권장한 완료 기준 불변식 2개를 추가로 구현했다:
  (a) `totalContributionMonths`를 120~480까지 스윕해 `basicPensionMonthly`가 항상 단조
  증가하는지(240 경계 전후 포함), (b) 조기/연기 개월수가 0에서 멀어질수록(같은 부호 안에서)
  `|adjustedPensionMonthly - basicPensionMonthly|`가 단조 증가하는지.
- `validation.test.ts`는 Golden Test #15 외에 `docs/CALCULATOR_RULES.md` "Edge Case Test"가
  요구하는 항목(0, 음수, 소수, 빈 값, 숫자 아닌 문자열, 최소/최대 경계값, 경계 바로 아래/위)을
  네 입력 필드 전체에 대해 다뤘다.
- 전체 테스트: 이 계산기 3개 파일 53개 테스트 전부 통과(`logic.test.ts` 18개,
  `validation.test.ts` 23개, `formatting.test.ts` 12개). 전체 스위트 `npx vitest run`
  77개 파일 975개 테스트 전부 통과(회귀 없음, 아래 "회귀 확인" 참고).

### 회귀 확인

이번 라운드는 `src/data/rates-2026.json`을 Architect 라운드에서 이미 수정했고(순수 추가),
Builder 라운드에서는 이 파일을 추가로 건드리지 않았다. 그럼에도 이 파일을 참조하는 다른
계산기(`four-major-insurance`, `annual-salary-take-home-pay`, `unemployment-benefit`,
`weekly-holiday-allowance` 등)에 회귀가 없는지 전체 스위트로 재확인했다.

- `npx vitest run`: 77개 파일, 975개 테스트 전부 통과(이번 라운드 이전 74개 파일/922개
  테스트 대비 +3 파일/+53 테스트, 신규 계산기 추가분과 정확히 일치 — 기존 테스트는 그대로).
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`(`next build`): 성공. 정적 생성 대상은 published 16종 그대로이며,
  `national-pension-benefit-estimate`는 `status: "draft"`라 `generateStaticParams()`
  목록에는 포함되지 않았다(URL 직접 접근 시 요청 시점 렌더링으로는 여전히 확인 가능 —
  `app/calculators/[slug]/page.tsx`의 기존 draft 처리 관례와 동일).

### PUBLISHED 게이트 인계 (Calculation Auditor에게 — 반드시 먼저 읽을 것)

**Builder 구현 완료는 published 전환 가능과 동의어가 아니다.** 이 계산기는
`tasks/national-pension-benefit-estimate/ARCHITECTURE.md` "1. PUBLISHED 전환 게이트"가
명시한 대로, 이 사이트에서 **Calculation Auditor의 실제 라이브 계산기 대조가 명시적으로
게이트로 걸린 최초의 계산기**다:

1. FORMULA.md 자신이 "공식(수식) 자체의 단위/스케일 오류 위험이 매우 큰 계산기"라고
   경고했다 — `÷12` 단계를 빠뜨리면 월 연금액이 **12배** 부풀려진다(정답 월 100만원 vs
   오류 시 월 1,200만원 수준). Builder는 FORMULA.md "1-d"가 제시한 `÷12` 공식을 코드
   그대로(`(proportionalConstant * (aValue + bValueApprox) * factor) / 12`) 구현했고
   Golden Test #1(독립 재무 콘텐츠 벤치마크)로 이 구조를 검증했지만, **이는 정부 1차
   출처(nps.or.kr 등) 라이브 계산기 대조가 아니다.**
2. `docs/CALCULATOR_RULES.md`가 요구하는 "공식 계산기 예시값과 대조한 케이스 최소 2개"
   요건은 이번 라운드까지 **1건만 충족**된 상태다(위 "Golden Test" 절 참고). 나머지 1건은
   Calculation Auditor가 nps.or.kr(비로그인 "예상연금 간단계산") 또는 work24.go.kr류
   라이브 계산기를 직접 호출해(unemployment-benefit FORMULA.md의 work24.go.kr curl 대조
   선례 참고) FORMULA.md 검증 예제 2~9 중 최소 1개 이상과 실제로 대조해야 확보된다.
3. 원 단위 반올림 방향(잠정 round half up)과 20년 미만 비례 감액(`가입월수/240`)의 정확한
   조문 위치도 FORMULA.md "확인 필요" 목록 2~3번에 여전히 남아 있다 — Builder가 이번
   라운드에서 임의로 확정하지 않았다.

이에 따라 `src/calculators/registry.ts`의 `national-pension-benefit-estimate` 항목은
**`status: "draft"`로 등록했다.** Calculation Auditor가 위 게이트를 명시적으로 통과시키기
(라이브 대조 성공 또는 최소한 명확한 실패 기록과 재시도 계획)) 전까지, 이후 단계(UX/UI
Critic·QA)가 다른 항목을 모두 PASS로 판정하더라도 **이 계산기의 `status`를 `published`로
바꾸지 않는다** — 이는 이 계산기 하나에만 추가되는, 다른 계산기들의 통상적인 3단계 통과
기준보다 한 단계 더 엄격한 조건이다(ARCHITECTURE.md "1.", "14." 그대로 인계).

### 애매했던 지점(Builder 판단, Auditor 재검토 권고)

- `EARLY_OR_DEFERRED_OPTIONS`(11개 select 옵션)의 라벨에 감액/가산율을 1개 소수점까지
  표시(`-6.0%` ~ `-30.0%`, `+7.2%` ~ `+36.0%`)했다 — ARCHITECTURE.md "17."이 지적한 대로
  320px 화면에서 라벨이 길어 잘리지 않는지는 UX/UI Critic이 실기기로 확인해야 한다.
- "이중 카드"에서 어느 카드를 1차로 강조할지는 ARCHITECTURE.md "8.2" 기본값(조기/연기
  신청 시 `adjustedPensionMonthly` 우선)을 그대로 따랐다 — 최종 시각적 확정은 UX/UI Critic
  몫으로 남겨뒀다(문서가 이미 그렇게 위임함).
- `buildBValueClampNotice`의 방향 판정(상한 초과 vs 하한 미달)은 `bValueApprox`와 원본
  입력값의 대소 비교로 구현했다(FORMULA.md가 별도 방향 플래그를 정의하지 않았기 때문) —
  로직상 항상 정확하지만(clamp는 상한 또는 하한 중 한쪽으로만 발생) Auditor가 원한다면
  Golden Test #8/#9로 이미 간접 검증된 것을 확인할 수 있다.

## Calculation Auditor

**검증일: 2026-09-13.** 아래 순서로 (1) 구현↔FORMULA.md 일치, (2) FORMULA.md↔실제 근거
일치(독립 수동 계산 + 라이브 계산기 대조), (3) 정책 데이터 파일 대조, (4) 전체 회귀
스위트 순으로 검증했다. **결론을 먼저 요약하면: PUBLISHED 게이트의 핵심 위험(÷12 스케일
오류)은 라이브 nps.or.kr 서버 호출로 완전히 해소됐다. 다만 그 과정에서 FORMULA.md가
잠정 채택한 반올림 정책(원 단위 반올림)이 실제 nps.or.kr 라이브 계산기와 다르다는 새로운
근거를 발견했다 — 이는 Builder 결함이 아니라 FORMULA.md에 대한 "공식 재검토 요청"이다.**
이 때문에 ARCHITECTURE.md "1."이 건 두 조건 중 조건 1(÷12 대조)은 충족, 조건 2(반올림·
20년 미만 비례식에 실질적 오류 없음 확인)는 **미충족**으로 판정한다 — 아래 상세 참고.

### 1. 구현 ↔ FORMULA.md 일치 검증

`logic.ts`, `validation.ts`, `formatting.ts`, `types.ts`를 FORMULA.md "공식"/"계산
순서"/"정밀도·반올림 정책"과 줄 단위로 대조했다. 지시받은 4개 핵심 항목을 포함해 전부
일치를 확인했다.

- **(a) 조기/연기 조정이 반올림 전 완전정밀도 기본연금액을 기반으로 계산되는가 — 확인됨.**
  `logic.ts` 172~174행: `adjustedPensionMonthly = Math.round(basicPensionMonthlyRaw *
  (1 + earlyOrDeferredAdjustmentRate))` — `basicPensionMonthly`(반올림된 표시값)가 아니라
  `basicPensionMonthlyRaw`(158행 이전에 계산된 완전정밀도 지역 변수)를 곱한다. Golden Test
  #13이 이를 직접 검증한다: `basicPensionMonthly=665,802`(반올림 후)를 그대로 곱했다면
  `round(665,802×0.7)=466,061`이 나와야 하지만, 테스트는 실제 `adjustedPensionMonthly=
  466,062`(= `round(665,802.4325×0.7)`)를 assert하고 `Math.round(665_802 * 0.7)).toBe
  (466_061)`을 "오답 대조용"으로 나란히 남겨뒀다 — 독립 Python 재계산(아래 "2.")도 466,062를
  재현해 일치를 확인했다.
- **(b) 중간 반올림이 없는가 — 확인됨.** `bValueApprox`(clamp만, 반올림 아님), `factor`
  (`calculateContributionAdjustmentFactor` 반환값), `basicPensionMonthlyRaw`가 모두
  `logic.ts` 전체에서 `Math.round`를 거치지 않고 그대로 다음 계산에 재사용된다.
  `Math.round` 호출은 158행(`basicPensionMonthly`)과 172행(`adjustedPensionMonthly`)
  단 두 곳뿐이며, 두 결과 모두 이후 다른 계산에 재사용되지 않는다(둘 다 반환 객체 필드로만
  쓰임).
- **(c) B값 clamp가 정확히 구현됐는가 — 확인됨.** `logic.ts` 131~134행:
  `Math.min(Math.max(input.averageMonthlyIncome, STANDARD_MONTHLY_INCOME_MIN),
  STANDARD_MONTHLY_INCOME_MAX)` — FORMULA.md "1-b"의 `clamp(averageMonthlyIncome, 하한,
  상한)`과 수학적으로 동일(하한 미만이면 하한으로, 상한 초과면 상한으로). `STANDARD_
  MONTHLY_INCOME_MIN/MAX`는 45~48행에서 `rates2026.socialInsurance.nationalPension.
  standardMonthlyIncomeMin/Max.value`를 참조 — FORMULA.md/ARCHITECTURE.md 지시대로 신규
  필드를 만들지 않고 기존 값을 재사용했다(중복 없음, grep으로 `nationalPensionBenefit`
  네임스페이스에 `standardMonthlyIncomeMin/Max` 중복 필드가 없음을 확인).
- **(d) 수급개시연령 판정이 최소가입기간 충족 여부와 무관하게 항상 수행되는가 — 확인됨.**
  `logic.ts`의 `calculateNationalPensionBenefit`은 `findPensionableAgeRow` 호출(108~115행)이
  최소 가입기간 판정(117~128행)보다 **먼저** 실행되고, `totalContributionMonths <
  minEligibleMonths`로 조기 반환(`ineligible`)하는 분기에도 `pensionableAge`/
  `pensionableYear`가 포함된다(120~127행). `types.ts`의
  `NationalPensionBenefitIneligibleResult`도 이 두 필드를 타입 레벨에서 필수로 강제해
  누락이 구조적으로 불가능하다. Golden Test #6(119개월, eligible=false)이
  `result.pensionableAge`/`pensionableYear`를 명시적으로 assert해 이 불변식을 검증한다.
- 그 외 대조: `earlyOrDeferredMonths` 범위(-60~60)는 `rates2026.nationalPensionBenefit.
  earlyPension/deferredPension.maxMonths`에서 조회(하드코딩 없음, `validation.ts` 46,
  176~177행), `aValue`/`proportionalConstant`도 `rates` 객체에서 조회(`logic.ts` 138~139행,
  하드코딩 없음), 가입기간 보정계수 공식(`calculateContributionAdjustmentFactor`)이
  FORMULA.md "계산 순서" 6단계·"4." 산식과 정확히 일치(`months <= baseMonths ? months/
  baseMonths : 1 + excessRate*(months-baseMonths)/12`).

**결론: Builder는 FORMULA.md를 임의로 변경하지 않았다. 구현↔FORMULA.md 일치는 완전
PASS.**

### 2. 독립 재계산 — 15개 검증 예제 전부 재현 (Python, 프로젝트 코드 미import)

프로젝트 코드를 import하지 않는 독립 Python 스크립트로 FORMULA.md의 공식을 그대로
재작성해 15개 예제 전부를 재계산했다. 모든 값이 `logic.test.ts`/`validation.test.ts`의
실제 assert 값과 소수점까지 정확히 일치했다.

| 예제 | 독립 재계산 결과 | logic.test.ts 값 | 일치 |
|---|---|---|---|
| #1 (구 상수 1.2, 40년) | bracket=12,000,000 → 1,000,000원 | 1,000,000원 | ✅ |
| #2 (240개월, 300만) | raw=665,802.4325 → 665,802원 | 665,802원 | ✅ |
| #3 (239개월) | raw=663,028.2557 → 663,028원 | 663,028원 | ✅ |
| #4 (241개월) | raw=668,576.6093 → 668,577원 | 668,577원 | ✅ |
| #5 (120개월) | raw=332,901.2163 → 332,901원 | 332,901원 | ✅ |
| #6 (119개월) | eligible=false, pensionableAge=64 | 동일 | ✅ |
| #7 (480개월) | raw=1,331,604.865 → 1,331,605원 | 1,331,605원 | ✅ |
| #8 (상한 clamp 800만→659만) | raw=1,051,727.4325 → 1,051,727원 | 1,051,727원 | ✅ |
| #9 (하한 clamp 30만→41만) | raw=387,377.4325 → 387,377원 | 387,377원 | ✅ |
| #10~#12 (스케줄 경계) | 60/61, 61/62, 64/65 | 동일 | ✅ |
| #13 (조기 -60개월) | round(665,802.4325×0.7)=466,062 | 466,062원 | ✅ |
| #14 (연기 +60개월) | round(665,802.4325×1.36)=905,491 | 905,491원 | ✅ |
| #15 (±61개월) | 입력 오류(범위 초과) | 동일(validation.test.ts) | ✅ |

15개 전부 독립 재현 성공. Builder가 FORMULA.md 산식을 잘못 옮기거나 `logic.test.ts`
값을 조작한 흔적이 없다.

### 3. 정책 데이터 파일(`rates-2026.json`) 대조

`src/data/rates-2026.json`의 `nationalPensionBenefit` 네임스페이스(216~287행)를
FORMULA.md "정책 데이터 분리 요구사항"이 제시한 JSON과 필드 단위로 대조했다 — `aValue`
(3,193,511), `proportionalConstant`(1.29), `minEligibleMonths`(120),
`baseMonthsForFullRate`(240), `excessYearBonusRate`(0.05), `pensionableAgeSchedule.rows`
6행(경계 연도·나이), `earlyPension`(60개월/0.005), `deferredPension`(60개월/0.006) 모두
FORMULA.md가 확정한 수치와 **정확히 일치**한다. `source`/`lastVerified`/`nextReviewDue`
메타데이터도 FORMULA.md·ARCHITECTURE.md가 정한 값(A값 2026-12-01, 그 외 2027-01-01) 그대로
반영됐다. `logic.ts`/`validation.ts`에서 `rates2026`을 실제로 import해 참조하는 것을
확인했고(하드코딩된 매직넘버 없음 — `grep -n "3193511\|1\.29\|3_193_511"`로
`logic.ts`/`validation.ts` 본문에 리터럴이 없음을 재확인), `standardMonthlyIncomeMin/Max`도
기존 `socialInsurance.nationalPension` 값을 그대로 참조해 중복 필드가 생성되지 않았다.

### 4. 전체 회귀 스위트 재실행

- `npx vitest run`: **77개 파일, 975개 테스트 전부 통과**(회귀 없음, Builder가 보고한
  수치와 동일하게 재현됨).
- `npx tsc --noEmit`: 오류 없음.

### 5. PUBLISHED 게이트 — 라이브 계산기 대조 시도 (핵심 결과)

#### 5.1 시도한 대상과 방법

`m.nps.or.kr`/`www.nps.or.kr`의 "예상연금 간단계산" 도구를 조사했다. 최초 진입 페이지
(`getOHAH0011M0.do`)는 TouchEn 보안키보드(raonnx) 스크립트를 로드하지만, **실제 계산
팝업(`getOHAH0011P0.do`)의 입력 필드(`ntpsIsfe`, 월 납입보험료)는 보안키보드 대상이
아닌 일반 `<input type="text">`이고, 로그인·세션 쿠키·CSRF 토큰이 전혀 필요 없는 순수
AJAX 엔드포인트**임을 확인했다:

```
POST https://www.nps.or.kr/comm/quick/empty/getOHAH0011P0.do
Content-Type: multipart/form-data (FormData)
필드: crtrYr=2026, minNtpsIsfe=38950, maxNtpsIsfe=626050, ntpsIsfe={월 납입보험료}
```

이 엔드포인트는 세션 유지 없이 매 요청이 독립적으로 완결되며, `curl -X POST
--data-urlencode`만으로 재현 가능했다(unemployment-benefit의 work24.go.kr curl 대조
선례와 동일한 성격, 오히려 더 단순 — 쿠키 저장조차 불필요).

**입력 모델 차이에 대한 처리**: 이 도구는 "총 가입월수 + 평균소득"이 아니라 **"월 납입
보험료"** 하나만 입력받고, "2026년 1월 최초 가입"을 가정해 10/15/20/25/30/35/40년
가입 시 노령연금액을 한 번에 표로 보여준다. 반환된 HTML의 "유의사항" 탭이 이 도구가 쓰는
산식을 그대로 명시했다:

> "1. 연금액 산정 : (1.29(A+B)×P21/P) × (1+0.05n/12) × 지급률 ... 3. 2026년 1월 최초
> 가입으로 가정하여 2026년 적용 A값(3,193,511원)으로 산정 ... 6. 2026년 7월부터 2027년
> 6월까지의 기준소득월액 하한액은 410,000원, 상한액은 6,590,000원입니다."

"2026년 1월 최초 가입"이라는 전제는 전체 가입월수가 100% `P21`(2026년 이후) 구간에
속한다는 뜻이므로, 이 시나리오에서는 **FORMULA.md "1-c"의 V1 근사(최신 비례상수를 전
가입기간에 균일 적용)가 근사가 아니라 정확히 법정 산식과 일치하는 특수 케이스**다 — 즉
이 대조는 "V1 근사의 오차"가 섞이지 않은, 이 계산기의 핵심 산식 구조(÷12 포함)만을
순수하게 검증하는 이상적인 테스트 케이스였다.

`ntpsIsfe`(월 보험료)를 소득(B값)으로 역산하기 위해 `minNtpsIsfe=38,950`/
`maxNtpsIsfe=626,050`와 우리 쪽 기준소득월액 하한/상한(410,000/6,590,000)의 비율을
확인한 결과 정확히 **0.095(9.5%, 2025년 개혁법의 2026년 보험료율 단계적 인상 스케줄의
첫 해 값과 일치)**로 나뉘어, `B = ntpsIsfe / 0.095`로 역산했다. 이 자체가 "기준소득월액
상·하한 410,000/6,590,000"이 nps.or.kr 라이브 서버 안에도 그대로 반영돼 있다는 **1차
확인**이기도 하다(`rates-2026.json`의 `standardMonthlyIncomeMin/Max`와 정확히 일치).

#### 5.2 실제 대조 결과 — 3개 소득 수준 × 7개 가입기간 = 21개 데이터포인트

| B(소득기준) | 가입기간(개월) | 우리 공식 raw | 우리 표시값(반올림) | **nps.or.kr 라이브 결과** | raw를 10원 미만 절사한 값 |
|---|---|---|---|---|---|
| 3,000,000 | 120 | 332,901.2163 | 332,901 | **332,900** | 332,900 |
| 3,000,000 | 180 | 499,351.8244 | 499,352 | **499,350** | 499,350 |
| 3,000,000 | 240 | 665,802.4325 | 665,802 | **665,800** | 665,800 |
| 3,000,000 | 300 | 832,253.0406 | 832,253 | **832,250** | 832,250 |
| 3,000,000 | 360 | 998,703.6488 | 998,704 | **998,700** | 998,700 |
| 3,000,000 | 420 | 1,165,154.2569 | 1,165,154 | **1,165,150** | 1,165,150 |
| 3,000,000 | 480 | 1,331,604.8650 | 1,331,605 | **1,331,600** | 1,331,600 |
| 6,590,000(상한) | 120~480 | (7개 값) | (7개 값) | **7개 값 전부** | **7개 값 전부** |
| 1,000,000 | 120~480 | (7개 값) | (7개 값) | **7개 값 전부** | **7개 값 전부** |

(상한 clamp·1,000,000 케이스의 7개 값 상세는 스크래치패드
`/tmp/verify_nps_livecheck2.py` 실행 로그 참고 — 지면상 대표 케이스만 표로 옮김.)

**21개 데이터포인트 전부에서 "우리 공식의 raw 값을 10원 미만 절사(내림)한 값"이 nps.or.kr
라이브 서버가 반환한 값과 정확히 일치했다(21/21, 오차 0).** 반면 FORMULA.md가 잠정
채택한 "원 단위 반올림(round half up)"으로 얻은 표시값은 21개 중 **0개**가 라이브 값과
일치했고, 매번 1~5원 더 큰 값을 냈다(예: 240개월 케이스에서 665,802원 vs 라이브
665,800원, 2원 차이).

#### 5.3 결론 — 게이트 조건 1(÷12 대조)은 완전히 해소, 조건 2(반올림 등 실질 오류 없음)는 새 이슈 발견으로 미해소

**조건 1 (÷12 단계·전체 산식 구조를 라이브 계산기로 대조) — 완전히 해소됨.** 21개
독립 데이터포인트가 예외 없이 `proportionalConstant × (aValue + bValueApprox) ×
contributionAdjustmentFactor / 12`라는 이 계산기의 정확한 산식 구조(÷12 포함)를
그대로 재현했다 — FORMULA.md가 가장 우려한 "12배 스케일 오류" 위험은 라이브 서버
호출로 명백히 배제됐다. `aValue=3,193,511`, `proportionalConstant=1.29`,
`baseMonthsForFullRate=240`(및 그 이하/초과 시 각각 비례/가산 공식), 기준소득월액
clamp 상하한(410,000/6,590,000)도 전부 라이브 서버 내부 값과 일치함을 확인했다.
`docs/CALCULATOR_RULES.md`의 "공식 계산기 예시값과 대조한 케이스 최소 2개" 요건은
이제 21개 라이브 데이터포인트로 대폭 초과 충족한다(예제 1의 1건 + 이번 21건).

**조건 2 (반올림 정책 등에 실질적 오류가 없는지) — 새로운 실질 오류를 발견해 미해소.**
FORMULA.md "정밀도/반올림 정책"이 잠정 채택한 "원 단위 반올림(round half up)"은 라이브
nps.or.kr 계산기의 실제 동작과 다르다. 실제로는 **10원 미만을 절사(내림)**하는 것으로
보인다(21/21 완전 일치, 대안 가설인 "원 단위 반올림"은 0/21 일치). 이는 FORMULA.md
자신이 "확인 필요" 3번에서 언급한 **국고금관리법 제47조(끝수 계산 — "국가에 납입할
금액 또는 국가가 지급할 금액에 10원 미만의 끝수가 있을 때에는 그 끝수는 계산하지
아니한다")가 실제로 이 계산에 적용되고 있음을 뒷받침하는 직접적인 실증 증거**로 보인다
(다만 이 "간단계산" 도구 자체가 nps.or.kr의 "약식" 도구라는 점을 감안하면, 실제
급여 지급 시스템의 최종 단수 처리와 100% 동일하다고 단정하기보다는 "매우 강한 정황
증거"로 취급하는 것이 안전하다 — 아래 "판정" 참고).

> **[2026-09-13 재검증 라운드 정정 안내]** 위 문단이 인용한 국고금관리법 제47조 문구
> ("국가에 납입할 금액 또는 국가가 지급할 금액에 10원 미만의 끝수가 있을 때에는 그
> 끝수는 계산하지 아니한다")는 **정확한 조문 원문이 아니라 취지를 요약한 의역**이었다.
> Formula Analyst가 casenote.kr·ko.wikisource.org 원문 대조로 이 사실을 발견하고
> FORMULA.md "정밀도/반올림 정책" 절을 정확한 원문("국고금의 수입 또는 지출에서 10원
> 미만의 끝수가 있을 때에는 그 끝수는 계산하지 아니하고, 전액이 10원 미만일 때에도 그
> 전액을 계산하지 아니한다")으로 교체했다 — 상세는 아래 "### 재검증 (Optimizer 수정 후)"
> "4." 참고. 이 Auditor는 Edit 권한이 없어 위 원 문단 자체는 그대로 두고 이 안내만
> 추가한다. 취지(10원 미만 끝수 불계산)는 두 인용 모두 동일해 실질 결론에는 영향이 없다.

**중요**: 이 발견은 **Builder 결함이 아니다.** Builder는 FORMULA.md가 명시한 "잠정
round half up" 정책을 코드 그대로(`Math.round`) 정확히 구현했다. 이는 FORMULA.md
자체의 "확인 필요" 3번 항목에 대한 **"공식 재검토 요청"**이다 — Formula Analyst가
FORMULA.md의 "정밀도/반올림 정책"과 "확인 필요" 3번을 "10원 미만 절사(국고금관리법
제47조, nps.or.kr 라이브 계산기 21/21 실증 일치)"로 갱신할 것을 권고한다. 갱신 시
필요한 변경(참고용, Optimizer 담당):
- `logic.ts` 158행, 172행의 `Math.round(...)`를 `Math.floor(x / 10) * 10`로 교체
  (2곳뿐).
- Golden Test 예상값 갱신: #2 665,802→665,800, #3 663,028→663,020, #4 668,577→668,570,
  #5 332,901→332,900, #7 1,331,605→1,331,600, #8 1,051,727→1,051,720, #9 387,377→
  387,370, #13 466,062→466,060, #14 905,491→905,490(전부 위 실증 데이터로 재검산 완료,
  스크래치패드 `/tmp/corrected_values.py` 참고).
- 이 변경의 실질 영향은 **표시 금액이 최대 9원 작아지는 것뿐**이며(상대오차
  0.001%~0.003% 수준), 자릿수·부호·경계값 판정 등 사용자 의사결정에 영향을 주는 어떤
  값도 바뀌지 않는다 — 심각도는 **Low**로 유지한다(FORMULA.md 자신의 사전 판단
  "최대 1원 수준으로 결과 신뢰도에 미치는 영향이 극히 작다"가 실제로는 최대 9원으로
  약간 컸을 뿐 여전히 무시할 수 있는 수준이라는 결론은 유효).

### 6. 그 외 "확인 필요" 항목 재조사 결과

- **항목 2(20년 미만 비례 감액의 정확한 조문 위치)** — 완전히 해소되지는 않았지만 확신도가
  상승했다. 이번 라이브 대조에서 확보한 nps.or.kr 자체 "유의사항" 탭이 "노령연금의 지급률 :
  가입기간 10년 50%(1개월마다 5/12% 증가)"라고 1차 출처(nps.or.kr) 문구로 명시한다.
  이를 대수적으로 검산하면 `50% + (m-120)×5/12%`(m=가입월수, 120~240 구간)는
  `m/240×100%`와 완전히 동일한 함수다(예: m=180 → 양쪽 모두 75%). 즉 FORMULA.md가 채택한
  `factor = months/240`(240 이하 구간) 공식이 **nps.or.kr 자신의 1차 설명 자료와도
  수학적으로 정확히 일치**함을 추가로 확인했다. 다만 이것이 게재된 지면은 "간단계산" 팝업의
  유의사항 텍스트이지 국가법령정보센터의 조문 원문은 아니므로, 정확한 "제O조 제O항 제O호"
  조문 번호 자체는 여전히 미확정이다 — **"공식 재검토 요청"까지는 아니고 FORMULA.md
  "확인 필요"의 확신도만 보강(부분확인 → 1차 출처로 재확인된 부분확인)**하는 수준으로
  기록한다.
- **항목 5(43% 고정 조항의 정확한 시행일)** — WebSearch로 "개정된 국민연금법은 하위법령
  마련 등을 거쳐 2026년 1월 1일부터 시행됩니다"라는 명확한 서술을 확인했다. 이는
  `rates-2026.json`의 `proportionalConstant.source.effectiveDate: "2026-01-01"`과 정확히
  일치한다 — FORMULA.md가 우려한 "law.go.kr 메타데이터의 2026-06-17과의 불일치" 의문은
  이 계산기가 실제로 채택한 값(2026-01-01, 소득대체율 조항)과는 무관한 동일 개정법률
  묶음 내 다른 조항(예: 보험료율 단계적 인상 스케줄 관련 조항)의 시행일일 가능성이 높다는
  FORMULA.md 자신의 추측과 일치한다. **오늘(2026-09-13) 기준 1.29/43%가 유효하다는 결론
  자체에는 영향이 없으므로 추가 조치 불필요.**
- **항목 3(원 단위 반올림 방향)** — 위 "5.3"에서 다뤘다(신규 실질 발견, 공식 재검토 요청).
- **항목 4(재평가율 테이블 갱신 주기)** — SPEC.md가 이미 이 테이블 자체를 구현하지 않기로
  결정했으므로 실무 영향 없음, 추가 조사하지 않았다(FORMULA.md 자신의 판단과 동일).
- **항목 6(군복무크레딧 등 범위 유지)** — Product Owner 소관 결정 사항, Calculation
  Auditor 권한 밖. 미해결 상태 그대로 인계한다.

### 7. 발견된 이슈 요약

| # | 등급 | 내용 | 처리 |
|---|---|---|---|
| 1 | **Low** | 최종 표시 단계 반올림이 FORMULA.md 잠정 정책(원 단위 반올림)을 따르고 있으나, nps.or.kr 라이브 계산기 실측 21/21 데이터포인트는 "10원 미만 절사"를 나타낸다. 최대 영향 9원(상대오차 <0.003%). | **공식 재검토 요청** → Formula Analyst가 FORMULA.md "정밀도/반올림 정책"·"확인 필요" 3번을 갱신 → Builder/Optimizer가 `logic.ts` 2개 지점(`Math.round`→`Math.floor(x/10)*10`) 및 Golden Test 예상값 9개 갱신 → 재검증. |
| 2 | Low(정보) | 20년 미만 비례 감액 공식의 정확한 법조문 항·호 번호가 여전히 미확정(다만 1차 출처(nps.or.kr) 자료로 산식 자체의 정확성은 추가 보강됨). | 조치 불필요(추적만 유지). |

Critical/High 등급 이슈는 발견되지 않았다.

### 8. 최종 판정

**계산 정확성 자체는 PASS.** 구현↔FORMULA.md 일치, 15개 Golden Test 독립 재현, 정책
데이터 파일 대조, 전체 회귀 스위트 전부 문제없이 통과했고, 이번 라운드의 핵심 목표였던
"÷12 스케일 오류 위험"은 라이브 nps.or.kr 서버 호출(21개 데이터포인트, 오차 0)로 완전히
해소했다 — Critical/High 이슈 0건.

**그러나 `tasks/national-pension-benefit-estimate/ARCHITECTURE.md` "1. PUBLISHED 전환
게이트"가 명시한 두 조건 중 조건 2("원 단위 반올림 방향... 실질적 오류가 없는지 재확인")는
이번 검증에서 실질적 오류(Low 등급)를 실제로 발견했으므로 충족되지 않는다.** 이 문서
자신이 정한 게이트 기준을 문자 그대로 적용하면, 조건 1과 조건 2가 **모두** 충족돼야
게이트가 해소되는데 조건 2가 아직 미충족이다.

**최종 판정: PASS, 단 `src/calculators/registry.ts`의 `national-pension-benefit-
estimate` 항목은 `status: "draft"`를 유지해야 한다.**

- **`published`로 전환하지 않는 이유**: 위에서 발견한 반올림 정책 불일치가 Formula
  Analyst 검토·수정(공식 재검토 요청 처리)과 그에 따른 Builder/Optimizer 재구현(코드
  2줄 교체 + Golden Test 값 9개 갱신) 없이 그대로 published되면, 이 계산기는 "이미 알려진
  더 정확한 방법(10원 미만 절사)이 있다는 것을 Calculation Auditor가 확인했음에도
  반영하지 않은 채" 공개되는 셈이다. 영향 자체는 Low(최대 9원)이지만, 이 계산기는
  SPEC.md·ARCHITECTURE.md가 스스로 "이 사이트에서 가장 엄격한 published 게이트"를 걸겠다고
  명시한 유일한 계산기이므로, 그 게이트가 정한 조건을 문자 그대로 지키는 것이 이 계산기
  설계 의도에 부합한다고 판단했다.
  - 이는 "값이 조금 다르다"의 문제가 아니라, **"확인해보니 공식 문서(FORMULA.md)가 스스로
    잠정으로 남겨뒀던 지점에 대해 실제로 더 정확한 근거가 새로 나왔다"**는, 이 프로젝트의
    역할 체계(docs/EVALUATION.md "역할 간 이견 조정")가 정확히 예견한 시나리오다 —
    Formula Analyst의 최종 검토를 거치는 것이 올바른 절차라고 판단한다.
- **이 수정은 빠르고 위험이 낮다** — 코드 변경 지점이 정확히 2줄(`logic.ts` 158, 172행)로
  이미 특정됐고, 수정 후 예상되는 Golden Test 새 값도 이 보고서가 전부 미리 계산해 뒀다
  (위 "5.3" 표 참고). Formula Analyst 확정 → Builder/Optimizer 반영 → 이 Auditor가
  재검증하는 한 사이클이면 게이트를 완전히 닫고 `published`로 전환할 수 있을 것으로
  예상한다(추가 라이브 대조가 더 필요하지는 않다 — 이번에 이미 21개 데이터포인트를
  확보했다).

**registry.ts는 현재 상태(`"draft"`) 그대로 두었다(이 Auditor는 Edit 권한이 없어 코드를
수정하지 않았으며, 수정할 필요도 없었다 — 이미 draft였다).**

### 재검증 (Optimizer 수정 후)

**재검증일: 2026-09-13(같은 날, 별도 세션).** Optimizer가 "## Optimizer" 절에서 보고한
수정(`logic.ts` 2곳 `Math.round`→`truncateTo10` 교체 + Golden Test 9개 갱신)을 5개
항목으로 재검증했다: (1) 코드 변경 범위, (2) 21개 라이브 데이터포인트 재대조(이번엔 실제
구현 함수를 직접 호출), (3) Golden Test 9개 3차 독립 재계산, (4) 국고금관리법 제47조
인용 정정 반영 확인, (5) 전체 회귀 스위트. **결론: 두 published 게이트 조건이 모두
해소됐다고 판단하며, 아래 "6. Published 게이트 최종 판단"에서 published 전환 가능이라고
명시한다.**

#### 1. 코드 변경 범위 확인 — Optimizer 보고와 정확히 일치, 그 외 로직 변경 없음

`logic.ts` 전체(209행)를 처음부터 다시 읽고 FORMULA.md "공식"/"계산 순서"와 줄 단위로
재대조했다:

- `truncateTo10(x) = Math.floor(x/10)*10` 헬퍼가 신설됐고, `basicPensionMonthly`(170행)와
  `adjustedPensionMonthly`(188~190행) 두 곳에서만 사용된다. 계산기 폴더 전체를
  `grep -rn "Math.round\|Math.floor"`로 재검색한 결과 `Math.round`는 **0건**,
  `Math.floor`는 (a) `truncateTo10` 내부 1건, (b) `logic.test.ts`의 "오답 대조용"
  assertion(`Math.floor((665_800 * 1.36) / 10) * 10`) 1건, (c) `formatting.ts`의
  개월→연 변환(`Math.floor(months / 12)`, 반올림 정책과 무관한 별개 로직) 1건뿐이었다 —
  (c)를 제외하면 정확히 Optimizer가 보고한 범위와 일치한다.
- 비교 대상 로직 — 비례상수·A값 조회, `bValueApprox` clamp(`Math.min(Math.max(...))`),
  `findPensionableAgeRow`, `calculateContributionAdjustmentFactor`(`months<=baseMonths?
  months/baseMonths:1+excessRate*(months-baseMonths)/12`),
  `calculateEarlyOrDeferredAdjustmentRate`(월 0.5%/0.6%), 수급개시연령 판정이 최소가입기간
  판정보다 먼저 실행되는 순서, `basicPensionMonthlyRaw`(완전정밀도)를 조기/연기 조정에
  재사용하는 핵심 불변식 — 은 전부 위 "1. 구현 ↔ FORMULA.md 일치 검증"(이전 라운드) 시점과
  문자 그대로 동일함을 확인했다. **단 한 글자도 바뀌지 않았다.**
- `types.ts`(두 필드 doc comment만 갱신, 타입 시그니처·필드 구성 불변)와 `formatting.ts`
  (`buildCalculationSteps`의 설명 문자열 1곳만 수정, 계산 값 자체에 영향 없음)도 재확인했다.
  `registry.ts`의 `status`는 여전히 `"draft"`.

**결론: Optimizer는 지시받은 범위(반올림→절사 교체 2곳)만 정확히 수정했다. 비례상수·
A값·clamp·수급개시연령 스케줄·최소가입기간·조기/연기 조정 계산식 등 다른 어떤 계산
로직도 함께 바뀌지 않았다.**

#### 2. 21개 라이브 데이터포인트 재대조 — 이번엔 "가설"이 아니라 "실제 구현" 자체를 직접 호출

이전 라운드(위 "5.2")의 대조는 "우리 공식의 raw 값을 10원 미만 절사한 값"이라는
**가설상의 계산 결과**를 라이브 값과 비교한 것이었다(당시 코드는 여전히 `Math.round`를
쓰고 있었기 때문에, 코드 자체의 실제 반환값과는 대조하지 않았었다). 이번 재검증에서는
요구된 대로 그 가설이 아니라 **`logic.ts`가 실제로 export하는
`calculateNationalPensionBenefit()` 함수를 직접 호출**해 그 반환값
(`result.basicPensionMonthly`)을 라이브 값과 대조했다.

방법: 이전 세션의 스크래치패드 스크립트(`/tmp/verify_nps_livecheck2.py`,
`/tmp/corrected_values.py`)는 세션 종료로 더 이상 남아 있지 않다(스크래치패드는 세션별로
격리된다). 따라서 `https://www.nps.or.kr/comm/quick/empty/getOHAH0011P0.do`를 이번
세션에서 curl로 **다시 독립적으로 호출**해 21개 데이터포인트(소득 3종×가입기간 7종)를
새로 재확보했다(이전 표를 그대로 베끼지 않음). 그 다음, 프로젝트의 실제 테스트 러너
(`vitest`)를 이용해 `logic.ts`의 `calculateNationalPensionBenefit`을 **직접 import해
호출**하는 임시 검증 스크립트(`__audit_live_recheck.test.ts`)를 작성·실행한 뒤 즉시
삭제했다(프로젝트에 흔적을 남기지 않음 — 확인 후 `rm`으로 제거, 회귀 스위트 파일 수
977→77개로 복귀 확인).

결과 — **실제 코드 반환값 기준 21/21 완전 일치**:

| B(소득기준) | 가입기간(개월) | 코드 실제 반환값(`result.basicPensionMonthly`) | nps.or.kr 라이브(이번 세션 재확보) | 일치 |
|---|---|---|---|---|
| 3,000,000 | 120/180/240/300/360/420/480 | 332,900/499,350/665,800/832,250/998,700/1,165,150/1,331,600 | 동일 | ✅ 7/7 |
| 6,590,000(상한 clamp) | 120/180/240/300/360/420/480 | 525,860/788,790/1,051,720/1,314,650/1,577,590/1,840,520/2,103,450 | 동일 | ✅ 7/7 |
| 1,000,000 | 120/180/240/300/360/420/480 | 225,400/338,100/450,800/563,500/676,200/788,900/901,600 | 동일 | ✅ 7/7 |

(참고: `vitest run --reporter=verbose` 로그에 21개 케이스 각각
`code=... live=... match=true`를 콘솔 출력해 육안으로도 확인했다. 6,590,000 케이스의
라이브 응답 HTML에는 이 7개 값 외에 "장애연금"·"유족연금" 예상액도 함께 포함돼 있었는데,
라벨(`장애 1급/2급/3급/4급`, `유족연금 10년미만/10년~20년미만/20년`)을 HTML 문맥에서
직접 확인해 이 7개 노령연금 값과 명확히 구분했다 — **조기/연기노령연금 표는 이 페이지에
없어 여전히 직접 라이브 검증이 불가능하다**, 아래 "6." 잔여 불확실성 참고.)

**21/21 전부, 오차 0으로 실제 배포될 코드 자체가 라이브 서버와 일치함을 확인했다.**
이전 라운드가 "이 값이 맞을 것이다"라는 가설 검증이었다면, 이번은 실제 구현의 실제
출력값을 검증한 것이라는 점에서 검증 강도가 한 단계 높아졌다.

#### 3. Golden Test 9개 — 3차 독립 재계산(Node, 프로젝트 코드 미import)

Formula Analyst(1차)·Optimizer(2차)에 이어 3차 독립 재계산을 수행했다. `logic.ts`를
import하지 않는 별도 Node 스크립트로 FORMULA.md의 공식을 그대로 재작성해 9개 값을 전부
재계산했다:

| 예제 | 3차 독립 재계산(raw → truncate) | logic.test.ts 현재 값 | 일치 |
|---|---|---|---|
| #2 (240개월) | 665,802.4325 → 665,800 | 665,800 | ✅ |
| #3 (239개월) | 663,028.2557 → 663,020 | 663,020 | ✅ |
| #4 (241개월) | 668,576.6093 → 668,570 | 668,570 | ✅ |
| #5 (120개월) | 332,901.2163 → 332,900 | 332,900 | ✅ |
| #7 (480개월) | 1,331,604.865 → 1,331,600 | 1,331,600 | ✅ |
| #8 (상한 clamp) | 1,051,727.4325 → 1,051,720 | 1,051,720 | ✅ |
| #9 (하한 clamp) | 387,377.4325 → 387,370 | 387,370 | ✅ |
| #13 (조기 -60개월) | 466,061.70275 → 466,060 | 466,060 | ✅ |
| #14 (연기 +60개월) | 905,491.3082 → 905,490 | 905,490 | ✅ |

9개 전부 3차 독립 재계산과 정확히 일치했다 — Formula Analyst·Optimizer·Calculation
Auditor(이번 라운드) 3자가 서로 다른 시점에 독립적으로 계산한 값이 전부 소수점까지
일치한다.

#### 4. 국고금관리법 제47조 인용 정정 확인

Formula Analyst가 FORMULA.md "정밀도/반올림 정책" 절에서, 이 문서(EVALUATION.md) 위
"5.3"(이전 라운드)이 인용한 문구("국가에 납입할 금액 또는 국가가 지급할 금액에 10원
미만의 끝수가 있을 때에는 그 끝수는 계산하지 아니한다")가 조문 원문이 아니라 취지를
요약한 의역이었음을 명시적으로 지적하고, casenote.kr·ko.wikisource.org 전문 대조로
확인한 정확한 원문("국고금의 수입 또는 지출에서 10원 미만의 끝수가 있을 때에는 그
끝수는 계산하지 아니하고, 전액이 10원 미만일 때에도 그 전액을 계산하지 아니한다")으로
교체한 것을 FORMULA.md에서 직접 확인했다.

아울러 요구된 caveat — "이 조문이 국민연금공단에 실제로 적용되는지는 (제3항) 시행령
지정 여부에 달려있어 완전히 확정된 것은 아니다" — 도 FORMULA.md "적용 범위의 잔여
불확실성" 절에 정확히 반영돼 있음을 확인했다: "국고금처럼... 국민연금공단에 적용되려면
... 제3항에 따라 시행령이 국민연금공단을 명시적으로 지정해야 하는데, 이 시행령 지정
여부까지는 이번 조사에서 직접 확인하지 못했다." "확인 필요" 목록 3번에도 동일한 취지의
잔여 불확실성 (a)/(b)/(c)가 그대로 남아 있다.

**단, 이 EVALUATION.md 자신의 위 "5.3" 절(이 Auditor가 이전 라운드에 작성)은 여전히
부정확한 의역 인용문을 그대로 담고 있다** — 이 Auditor는 Edit 권한이 없어 그 문단
자체를 고칠 수 없으므로, 위 "5.3" 문단 바로 뒤에 정정 안내 인용 블록을 추가하고 여기서도
다시 명시한다: **위 "5.3"의 국고금관리법 제47조 인용문은 정확한 조문 원문이 아니다.
정확한 원문은 FORMULA.md "정밀도/반올림 정책" 절(2026-09-13 정정)의 인용을 따른다.**
취지(10원 미만 끝수 불계산)는 두 인용 모두 동일하므로 이 부정확성이 실질적 결론(10원
미만 절사 채택)에 영향을 주지는 않는다 — 문서 정확성 문제로만 기록한다(등급: Low,
정보성, 조치: 이 문서를 향후 대규모 개정할 기회가 있을 때 위 "5.3" 문단의 인용문 자체를
교체 권고).

#### 5. 전체 회귀 스위트 재실행

- `npx vitest run`: **77개 파일, 975개 테스트 전부 통과**(Optimizer 보고와 동일한 수치,
  회귀 없음. 임시 검증 스크립트는 실행 직후 삭제해 이 수치에 포함되지 않음).
- `npx tsc --noEmit`: 오류 없음.

#### 6. Published 게이트 최종 판단

ARCHITECTURE.md "1. PUBLISHED 전환 게이트"의 두 조건을 다시 평가한다.

- **조건 1(÷12 등 산식 구조 라이브 대조)** — 이미 이전 라운드에서 해소됐고, 이번 재검증
  (위 "2.")이 **실제 구현 코드를 직접 호출**해 21/21 일치를 재확인함으로써 오히려 더
  강하게 재확인됐다. **해소 유지.**
- **조건 2(실질 오류 없음)** — 이전 라운드가 발견한 반올림 정책 오류(원 단위 반올림 →
  10원 미만 절사)가 이번 라운드에서 코드·문서 양쪽에 정확히, 그리고 지시된 범위
  이상으로 확대되지 않고 반영됐음을 확인했다(위 "1." 코드 변경 범위 확인, "3." Golden
  Test 3중 독립 재계산 일치). **새로운 실질 오류는 발견되지 않았다. 해소됨.**

**두 조건 모두 해소됐다고 판단한다 — published 전환 가능.**

남은 잔여 불확실성 두 가지의 심각도를 평가하면:

1. **국고금관리법 제47조의 국민연금공단 준용(시행령 지정) 여부 미확인** — 이 계산기가
   "10원 미만 절사"를 채택하는 결정적 근거는 조문 자체가 아니라 21/21 라이브 실증
   일치이며 FORMULA.md가 이미 이 점을 명시하고 있다. 즉 이 법적 근거의 미확정은
   **계산 결과의 정확성 자체에는 영향을 주지 않는, 문서상 각주 수준의 불확실성**이다.
2. **조기/연기 조정값(`adjustedPensionMonthly`)의 절사 방식이 직접 라이브 검증되지
   않은 추정** — 이번 재검증에서도 nps.or.kr 응답 HTML에 조기/연기노령연금 표가 없음을
   재확인했다(위 "2." 참고, "장애연금"·"유족연금" 표만 존재). 다만 최악의 경우(절사
   대신 반올림이 맞다고 가정해도) 발생하는 오차는 기본연금액과 동일하게 **최대 9원**에
   불과하다.

**두 잔여 불확실성 모두 published 전환을 막을 정도의 심각도(Critical/High)가 아니라고
판단한다** — (a) 최대 영향이 9원 이하로 자릿수·부호·경계값 판정 등 사용자 의사결정에
영향을 주지 않고, (b) 실증 데이터(21/21)라는 더 강력한 근거로 결론이 이미 뒷받침되며,
(c) FORMULA.md가 이미 "매우 강한 정황 증거" 수준으로 격을 낮춰 정직하게 기술하고 있어
과신하지 않는다. **등급: Low(정보성), 추적만 유지 — published 전환을 막지 않는다.**

**최종 결론: `src/calculators/registry.ts`의 `national-pension-benefit-estimate` 항목을
`status: "published"`로 전환 가능하다고 판단한다.** ARCHITECTURE.md "1."이 건 두 조건
(÷12 등 산식 구조 라이브 대조, 반올림 등 실질 오류 없음)이 모두 해소됐으므로, 이 계산기에만
걸려 있던 추가 published 게이트는 이번 재검증으로 완전히 닫혔다. 다만 이 Auditor는 Edit
권한이 없어 `registry.ts`를 직접 수정하지 않았다 — 이 파일에 Edit 권한이 있는 역할
(Optimizer 또는 조정자)이 이 판단에 따라 `status`를 `"draft"`에서 `"published"`로,
`lastModified`를 갱신할 것을 권고한다. UX/UI Critic·QA 등 남은 단계가 있다면 그 단계들은
(이 계산기에만 추가됐던 라이브 대조 게이트가 아니라) 통상적인 3단계 통과 기준을 그대로
적용받는다.

## Optimizer

**수정일: 2026-09-13.** Calculation Auditor가 "공식 재검토 요청"으로 반려한 반올림 정책
오류(원 단위 반올림 → 10원 미만 절사)를 Formula Analyst가 FORMULA.md "정밀도/반올림 정책"·
"계산 순서" 8·9단계·"확인 필요" 3번에서 이미 정정한 것을 확인하고, 그 정정을 코드에 그대로
반영했다. 보고서(FORMULA.md, Calculation Auditor 절)에 없는 새 기능은 추가하지 않았다.

### 변경 파일과 내용

1. **`src/calculators/national-pension-benefit-estimate/logic.ts`**
   - 38행 `const rates = ...` 바로 뒤에 `truncateTo10(amountWon: number): Won { return
     Math.floor(amountWon / 10) * 10; }` 헬퍼 함수를 신설했다(FORMULA.md "1-d"/"7."의
     `truncateTo10(x) = Math.floor(x / 10) * 10` 표기를 그대로 함수명·구현으로 옮김).
   - Calculation Auditor가 지목한 두 지점(당시 158행·172행, 이번 라운드 파일 기준으로는
     `basicPensionMonthly`와 `adjustedPensionMonthly` 산출 지점)의 `Math.round(...)`를
     각각 `truncateTo10(...)`로 교체했다 — 호출 위치·횟수·입력값(완전정밀도
     `basicPensionMonthlyRaw`)·데이터 흐름(절사된 값을 이후 계산에 재사용하지 않음)은
     FORMULA.md가 이미 검증한 대로 전혀 바꾸지 않았다. `Math.round`/`Math.floor` 호출을
     grep으로 재확인해 `truncateTo10` 내부의 `Math.floor` 1곳만 남았음을 확인했다.
   - 관련 주석(계산 순서 7·8·9번, 파일 상단 주석은 그대로 둠 — 섹션 제목 "정밀도·반올림
     정책"은 FORMULA.md 실제 절 제목과 동일해 변경 불필요)을 "원 단위 반올림/사사오입"에서
     "10원 미만 절사(내림)"로 갱신했고, `adjustedPensionMonthly` 산출부 주석에 FORMULA.md
     "7."의 표현("이 절사 규칙이 조기/연기 조정값에도 그대로 적용되는지는 ... 라이브 대조가
     직접 검증하지 않았다 ... 합리적 추정이며 실증된 사실은 아니다")을 그대로 반영했다(요구
     4번).
   - `Math.round` 잔존 여부는 grep으로 재확인(0건, `truncateTo10` 내부의 `Math.floor` 1건만
     존재).
2. **`src/calculators/national-pension-benefit-estimate/types.ts`** — `basicPensionMonthly`,
   `adjustedPensionMonthly` 필드 doc comment의 "원 단위 반올림"을 "10원 미만 절사(내림)"으로
   갱신하고, `adjustedPensionMonthly`에는 위와 동일한 "합리적 추정, 실증 아님" 문구를 추가했다
   (코드 동작은 바꾸지 않고 주석만 정확성 있게 갱신).
3. **`src/calculators/national-pension-benefit-estimate/formatting.ts`** — `buildCalculationSteps`의
   "5. 조기/연기연금 조정" 행 표현식 문구 "기본연금액(반올림 전)"을 "기본연금액(절사 전
   완전정밀도)"로 수정했다(사용자에게 노출되는 계산 근거 문구를 정책과 일치시킴). `content.ts`/
   `ui.tsx`를 grep했으나 "반올림"/"절사"/"끝수"/"10원" 관련 사용자 노출 문구는 존재하지
   않았다(원래 없었음 — 수정 대상 없음, false positive만 존재: CSS `rounded-*` 클래스명).
4. **`src/calculators/national-pension-benefit-estimate/logic.test.ts`** — Golden Test #2/#3/
   #4/#5/#7/#8/#9/#13/#14의 `basicPensionMonthly`/`adjustedPensionMonthly` 기댓값 9개를
   FORMULA.md가 재계산해둔 새 값(665,800 / 663,020 / 668,570 / 332,900 / 1,331,600 /
   1,051,720 / 387,370 / 466,060 / 905,490)으로 갱신했다. FORMULA.md 값을 그대로 베끼지
   않고, 각 값을 `Math.floor(raw/10)*10`으로 독립 재검산해(예: 665,802.4325 →
   floor(66580.24325)*10=665,800) FORMULA.md 값과 전부 일치함을 직접 확인한 뒤 반영했다.
   예제 13(-60개월)에서는 우연히 "절사된 표시값(665,800)을 잘못 재사용해도 665,800×0.7=
   466,060으로 정답과 같은 값이 나오는" 특수 케이스임을 발견해(665,800이 10의 배수라 절사
   손실이 없기 때문), 이 사실을 주석으로 남기고 "raw 값을 반드시 써야 한다"는 핵심 불변식은
   대신 예제 14(+60개월, 665,800×1.36=905,488→절사 시 905,480 vs 정답 905,490으로 실제
   값 차이가 나는 케이스)에서 대조 assertion(`expect(Math.floor((665_800 * 1.36) / 10) *
   10).toBe(905_480)`)으로 옮겨 검증했다 — 이 assertion은 새 기능이 아니라 기존에 있던
   "오답 대조용" assertion(원래 `Math.round` 기반)을 새 절사 정책에 맞게 값만 갱신한 것이다.
5. **`src/calculators/national-pension-benefit-estimate/formatting.test.ts`** — 검토했으나
   수정하지 않았다. `formatWon(665_802.4325)).toBe("665,802원")` 테스트는 이 계산기의
   반올림/절사 정책이 아니라 공용 포맷터 `formatWon`(다른 계산기들과 공유하는 범용 표시
   유틸리티, `Math.round`로 화면 표시용 소수 처리) 자체의 동작을 검증하는 것이라 Golden Test
   9개 목록에 포함되지 않았고, `formatWon`의 구현도 이번 변경 대상이 아니므로(제약: "이
   반올림 정책 변경 외에 다른 로직... 전혀 건드리지 마라") 그대로 두었다.
6. **`src/calculators/registry.ts`** — 변경하지 않았다. `national-pension-benefit-estimate`
   항목의 `status`는 지시대로 `"draft"`를 그대로 유지했다(Calculation Auditor 재검증 후
   최종 판단).

### 독립 재검산 결과(Golden Test 9개)

| 예제 | raw(완전정밀도) | `floor(raw/10)*10` 재검산 | FORMULA.md 값 | 일치 |
|---|---|---|---|---|
| #2 (240개월, 300만) | 665,802.4325 | 665,800 | 665,800 | ✅ |
| #3 (239개월) | 663,028.2557 | 663,020 | 663,020 | ✅ |
| #4 (241개월) | 668,576.6093 | 668,570 | 668,570 | ✅ |
| #5 (120개월) | 332,901.2163 | 332,900 | 332,900 | ✅ |
| #7 (480개월) | 1,331,604.865 | 1,331,600 | 1,331,600 | ✅ |
| #8 (상한 clamp) | 1,051,727.4325 | 1,051,720 | 1,051,720 | ✅ |
| #9 (하한 clamp) | 387,377.4325 | 387,370 | 387,370 | ✅ |
| #13 (조기 -60개월) | 466,061.70275(=665,802.4325×0.7) | 466,060 | 466,060 | ✅ |
| #14 (연기 +60개월) | 905,491.3082(=665,802.4325×1.36) | 905,490 | 905,490 | ✅ |

9개 전부 FORMULA.md 값과 독립 재계산 결과가 정확히 일치했다.

### 실행한 테스트와 결과

- `npx vitest run src/calculators/national-pension-benefit-estimate` — 3개 파일(`logic.test.ts`
  18개, `validation.test.ts` 23개, `formatting.test.ts` 12개) 53개 테스트 전부 통과.
- `npx vitest run`(전체 스위트) — **77개 파일, 975개 테스트 전부 통과**(Builder/Calculation
  Auditor 라운드와 동일한 수치, 회귀 없음).
- `npx tsc --noEmit` — 오류 없음.
- `npm run build`(`next build`) — 성공(published 16종 정적 생성 그대로,
  `national-pension-benefit-estimate`는 `status: "draft"`라 `generateStaticParams()`
  목록에서 계속 제외됨 — Builder 라운드와 동일).

### 건드리지 않은 것 (제약 준수 확인)

- 비례상수(1.29), A값(3,193,511), clamp 상·하한(410,000/6,590,000), 가입기간 보정계수 공식,
  수급개시연령 스케줄, 최소가입기간(120개월) 판정, 조기/연기 조정률(월 0.5%/0.6%) — 전혀
  수정하지 않았다(Calculation Auditor가 라이브 데이터 21개로 이미 검증 완료한 영역).
- `registry.ts`의 `status`는 `"draft"` 그대로.
- FORMULA.md/rates-2026.json 등 문서·정책 데이터 파일은 수정 대상이 아니므로 건드리지
  않았다(이미 Formula Analyst가 정정 완료).

### 다음 단계로 인계

Calculation Auditor가 이 수정을 재검증해야 한다(docs/EVALUATION.md 개선 Loop 1회차).
Calculation Auditor EVALUATION.md "5.3"이 예고한 대로, 이 수정(코드 2개 지점 교체 + Golden
Test 9개 갱신)이 정확히 그 예고와 일치하는지, 그리고 21개 라이브 데이터포인트와 다시
대조했을 때도 일치하는지 확인하는 것이 이번 재검증의 핵심이 될 것으로 예상한다. 이 문서
"Calculation Auditor" 절이 이미 "조건 1(÷12 대조)은 충족, 조건 2(반올림 등)는 이번 수정으로
해소 가능"이라고 예상했으므로, 재검증 통과 시 `registry.ts`의 `status`를 `"published"`로
전환할지는 Calculation Auditor의 최종 판단에 맡긴다(Optimizer는 그 권한이 없다).

**[2026-09-13 인계 완료 확인]** 위 "## Calculation Auditor" 절의 "### 재검증 (Optimizer
수정 후)"에서 이 수정을 재검증했고, 두 published 게이트 조건이 모두 해소됐다고 판단해
**"published 전환 가능"**으로 결론 내렸다(registry.ts의 실제 `status` 값 변경은 Edit
권한이 있는 역할이 이어서 수행해야 한다).

## UX/UI Critic

**검증 방법**: 계산 정확성(Builder/Calculation Auditor 절, 이미 PASS·published 전환 가능
판정)은 전제로 삼고 재검증하지 않았다. `tasks/national-pension-benefit-estimate/`의
SPEC.md·FORMULA.md·ARCHITECTURE.md 전문과 이 문서의 Builder/Calculation Auditor/Optimizer
절을 먼저 읽고, `docs/DESIGN_SYSTEM.md` 전체(색상 토큰, 입력 UX, 입력 라벨·순서, 공통 화면
순서, 접근성, 모바일)와 실제 구현(`ui.tsx`/`types.ts`/`validation.ts`/`formatting.ts`/
`content.ts`)을 한 줄씩 대조했다. Edit 권한이 없어 실제 dev 서버 렌더링·실기기 테스트는
불가능하므로, 코드 정독(className·조건부 렌더링·문자열 길이 추정)으로 화면 동작을 추론했다
— 픽셀 단위 시각 검증·실제 브라우저 렌더링 확인은 QA 영역으로 남긴다. 이 계산기가
`docs/PRODUCT.md`가 지목하는 이 프로젝트 최고 수준의 법령 의존 계산기이자 사용자의 실제
노후 재무 계획에 영향을 줄 수 있다는 점을 감안해, 오케스트레이터가 지정한 9개 중점 확인
지점을 자체 질문에 전부 포함시켰다.

### 자체 평가 질문 (17개, 평가 항목 7개 모두 커버, 필수 질문 4개 포함) 및 답변

#### [필수 질문] Q1. (평가 항목: 입력 라벨의 표현) `severance-pay/ui.tsx`의 `FIELDS`(일상어 라벨: "입사일"·"퇴사일" 등)와 직접 대조했을 때, 이 계산기의 입력 라벨이 법령·전문 용어나 FORMULA.md/SPEC.md 변수 식별자를 그대로 복사했는가?
- **근거**: 실제 라벨은 "출생연도"(`ui.tsx` 223-227행), "국민연금 총 가입기간"(251-255행),
  "평균 월소득(근사치)"(279-283행), "수급 시기"(308-310행) 넷뿐이다. FORMULA.md/SPEC.md가
  쓰는 변수 식별자·법령 용어("birthYear", "totalContributionMonths", "averageMonthlyIncome",
  "A값", "B값", "기준소득월액", "재평가율", "제51조")는 라벨에 전혀 노출되지 않는다.
  "A값"/"B값"은 `ui.tsx`의 "계산 상세" SectionCard(452-465행, "적용된 A값(전체가입자
  평균소득월액 평균)", "적용된 B값 근사치(평균 월소득)")에만 등장하는데, 이는 라벨이
  아니라 SPEC.md Must Have가 명시적으로 요구한 "계산 근거"(breakdown) 섹션이라
  `docs/DESIGN_SYSTEM.md` "정확한 법령 용어가 필요하면 라벨이 아니라 helpText/계산 근거에
  넣는다" 원칙과 정확히 일치하는 위치다. `severance-pay`가 `FIELDS` 배열이라는 선언적
  구조를 쓰는 것과 달리 이 계산기는 필드를 `ui.tsx`에 직접 JSX로 나열하는데, 이는
  `four-major-insurance`/`unemployment-benefit` 등 다른 계산기도 함께 쓰는 구현 스타일
  차이일 뿐 라벨 표현 원칙 위반은 아니다.
- **등급**: 문제없음.

#### [필수 질문] Q2. (평가 항목: 입력 순서·그룹핑) 입력 필드 순서가 SPEC.md "핵심 사용자 흐름"(출생연도→가입기간→소득)과 일치하는 시간/논리 순서인가? 성격이 다른 필드가 끼어 있지 않은가?
- **근거**: `ui.tsx` 221-329행 순서는 출생연도(222-248) → 총 가입기간(250-276) → 평균
  월소득(278-305) → 수급 시기(조기/연기, 307-328)로, SPEC.md "핵심 사용자 흐름" 1~3번
  순서와 정확히 일치한다. 이 계산기는 severance-pay의 "입사일→퇴사일" 같은 두 날짜로
  하나의 기간을 이루는 구조가 아니라(입력 자체가 "출생연도" 하나, "총 가입기간(개월)"
  하나로 이미 합산돼 있음, FORMULA.md "설계 결정: 출생연도만 받는다"), 두 날짜 사이에
  다른 필드가 끼어드는 문제 자체가 구조적으로 발생할 수 없다. 조기/연기(선택 필드)를
  마지막에 배치해 "필수 3개 먼저, 선택 1개 나중"이라는 자연스러운 우선순위도 지킨다.
- **등급**: 문제없음.

#### [필수 질문] Q3. (평가 항목: 결과 가독성·오류 메시지) 같은 개념이 폼·결과·오류 메시지 전체에서 한 용어로 통일돼 있는가?
- **근거**: "국민연금 총 가입기간"(폼 라벨) ↔ "총 가입기간을 입력해 주세요."(오류,
  `validation.ts` 122행) ↔ "국민연금 총 가입기간"(적용된 입력값 dt, `ui.tsx` 496행) ↔
  "가입기간"(지급대상 아님 안내 본문, FAQ)까지 핵심 명사가 전부 일관된다. "평균 월소득"도
  라벨("평균 월소득(근사치)") · 오류("평균 월소득을 입력해 주세요.") · 적용된 입력값
  ("평균 월소득(입력값)") · 계산 상세("적용된 B값 근사치(평균 월소득)")에서 core 단어가
  동일하게 유지되고, 괄호 안 수식어("근사치"/"입력값"/"clamp 후")만 문맥에 따라 정확하게
  달라진다 — 이는 용어 드리프트가 아니라 "원본 입력값 vs 계산에 실제 적용된 값"이라는
  서로 다른 상태를 정확히 구분해 알려주는 의도된 차별화다. "수급개시연령"·"지급대상 아님"도
  폼 도움말·결과 카드·오류 없음 안내 전체에서 동일 표현을 쓴다.
- **등급**: 문제없음.

#### [필수 질문] Q4. (평가 항목: 불필요한 UI 요소 / 입력 최소화) 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 묻지 않는가?
- **근거**: 필수 3개(출생연도·총 가입기간·평균 월소득) + 선택 1개(수급 시기)뿐이다.
  SPEC.md "V1 입력 방식에 대한 판단"이 이미 "연도별 실제 소득을 일일이 입력받지 않고
  평균 월소득 근사치 하나로 대체한다"는 근거를 상세히 남겼고(계산법을 몰라도 쓸 수
  있어야 한다는 원칙과의 충돌을 피하기 위해), FORMULA.md도 "가입시작연도를 추가로 받아
  연도별 비례상수를 정밀 적용하는 개선안"을 Could Have로 명시적으로 유보했다 — 즉 입력을
  더 줄일 여지(예: "생년월일"에서 "출생연도"만 받기로 결정한 것)와 더 늘릴 뻔한 유혹
  (연도별 소득 이력) 양쪽 모두를 의도적으로 검토한 뒤 현재의 4개로 확정한 것이 문서로
  남아 있다. 4개 중 어느 것도 다른 입력에서 유도할 수 없다(가입기간은 출생연도로부터
  계산 불가 — 사람마다 다르고 "이미 납부+예정"을 합산한 값이라 독립 입력이 필수).
- **등급**: 문제없음.

#### Q5. (평가 항목: 일반 사용자가 계산법을 몰라도 사용 가능 / 계산 과정 이해 — 중점 확인 1) "근사치/추정치"라는 성격이 결과 화면에서 눈에 띄게 전달되는가, 아니면 작은 글씨로 하단에 묻혀 있는가? 사용자가 이 숫자를 "확정된 내 연금액"으로 오인할 위험이 있는가?
- **근거**: 핵심 결과 카드 라벨 자체가 "예상 노령연금 월 수령액(세전, 현재가치)"(`ui.tsx`
  407행)로 "예상"이라는 단어를 달고 있어 확정 금액이 아니라는 최소한의 신호는 숫자
  바로 위에 있다. 그러나 "이 결과는 근사 추정치이며 국민연금공단 공식 고지액이 아니다"라는
  **명시적** 문장은 결과 카드·계산 근거 섹션 어디에도 없고, `IntroSection` 3번째
  문단(`content.ts` `NPB_INTRO_PARAGRAPHS[2]`)과 `정책 안내` 섹션(`NPB_POLICY_NOTICES`
  8번째 항목, `ui.tsx` 530-542행)에만 존재한다. `docs/DESIGN_SYSTEM.md` "공통 화면 순서"에
  따라 이 두 섹션은 결과·계산 근거(3개 SectionCard) **다음**, 즉 페이지 상당히 아래쪽에
  위치한다 — 사용자가 핵심 결과 카드만 보고 이탈(또는 그 숫자만 캡처해 공유)하면 명시적
  고지를 아예 보지 못할 수 있다. 다만 이 배치는 이 계산기만의 결함이 아니라
  `unemployment-benefit`(`INTRO_PARAGRAPHS`에 "참고용 추정 도구"·"참고용 추정치" 문구를
  동일하게 Intro 섹션에만 배치)과 `annual-salary-take-home-pay`(정책 안내 SectionCard에
  "공식 고지액이 아닌 모의계산 참고 자료" 문구)가 이미 채택한 사이트 전반의 관례와
  일치하고, `ShareActions` 공유 문구(`shareText`, `ui.tsx` 185-192행)도 "예상"이라는 단어만
  남기고 명시적 추정 고지 문구는 포함하지 않는 점 역시 두 계산기와 동일한 패턴이다. 즉
  "작은 글씨로 완전히 숨겨져 있다"는 아니지만(글자 크기·색상 자체는 다른 정책 안내
  문단과 동일한 `text-sm text-muted` 수준일 뿐 더 작지 않다), **결과 숫자에 인접한 위치에는
  없다.**
- **등급**: **Medium** — SPEC.md가 "결과를 공식 확정 금액으로 표현하지 않는다"를 여러
  차례 강조하라고 명시적으로 요구한 이 계산기 특유의 요건에 비추어, 사이트 공통 관례를
  그대로 따르는 것만으로는 다소 약하다고 판단한다. 핵심 결과 카드 바로 아래(계산 근거
  SectionCard보다 앞)에 "참고용 추정치 — 실제 수령액과 다를 수 있습니다" 한 줄을 추가하면
  해소 가능한 수준의 개선 여지이며, 이미 존재하는 문구 내용 자체(3곳 이상: Intro 문단,
  비례상수 근사 고지, B값 근사 고지, 정책 안내 목록 8개 항목, FAQ 2개 문항)는 매우
  풍부하고 정확해 "고지 내용 자체가 부실하다"는 지적은 아니다 — 순전히 "결과와의 물리적
  근접성" 문제로 한정한다.

#### Q6. (평가 항목: 계산 과정을 이해할 수 있는지 — 중점 확인 2) B값 근사("가입기간 내내 소득이 같았다고 가정")가 계산법을 몰라도 이해되게 설명됐는가? 법령 용어 "재평가율"이 사용자 화면에 노출되는가?
- **근거**: `content.ts`의 `NPB_B_VALUE_APPROX_NOTICE`(63-66행)는 "이 결과는 입력하신
  평균소득이 가입기간 내내 동일한 수준(현재가치 기준)이었다고 가정합니다. 실제로는 가입
  연도별 소득과 물가 재평가율이 각각 적용되어 결과가 달라질 수 있습니다."라고 FORMULA.md
  "3."이 권고한 문구를 그대로 옮겼다 — "재평가율"이라는 단어가 한 번 등장하지만 계산에
  직접 대입하라는 요구 없이 "이런 게 있다"는 존재 언급 수준이라 이해에 지장이 없고,
  핵심 문장("가입기간 내내 동일한 수준이었다고 가정합니다")은 완전한 일상어다.
  `averageMonthlyIncome` 필드의 helpText(`ui.tsx` 295-299행, "실제 가입기간 전체의 평균
  수준 소득을 대략 입력하세요(현재 또는 최근 소득 기준을 권장합니다)")도 "재평가율"·
  "기준소득월액" 같은 용어 없이 입력 시점에 미리 같은 취지를 전달한다. FAQ 1번(88-96행)도
  같은 취지를 반복해 "가입 이력이 길수록 실제 수령액과의 차이가 커질 수 있다"까지 풀어
  설명한다.
- **등급**: 문제없음.

#### Q7. (평가 항목: 계산 과정을 이해할 수 있는지 — 중점 확인 3) 비례상수 근사(2026년 이전 가입 이력이 긴 사용자는 실제보다 과소평가될 수 있다는 FORMULA.md의 경고)가 화면에 반영되어 있는가?
- **근거**: `content.ts`의 `NPB_PROPORTIONAL_CONSTANT_NOTICE`(55-60행)가 FORMULA.md "1-c"
  필수 고지 문구(권고안)를 그대로 옮겨 "가입 이력이 긴 분일수록 실제 수령액이 이 결과보다
  클 가능성이 있습니다"까지 정확한 방향(과소평가 경고)으로 명시한다. 이 문구는
  `NPB_POLICY_NOTICES`(69-84행)의 두 번째 항목으로 정책 안내 섹션에 노출된다. FAQ
  1번·2번도 같은 취지를 반복한다. FORMULA.md가 우려한 "법령 용어(비례상수, P21 등)
  노출" 문제도 없다 — 문구가 "소득대체율 기준값(1.29)"이라는 표현만 쓸 뿐 원 공식의
  구간 기호(P1~P21)는 화면에 전혀 등장하지 않는다.
- **등급**: 문제없음. (다만 Q5와 동일한 "결과 카드에서 멀다"는 배치 이슈가 이 고지에도
  동일하게 적용되므로, 중복 감점하지 않고 Q5의 Medium 판정에 포함해 다룬다.)

#### Q8. (평가 항목: 오류 메시지의 이해 용이성 / 결과 가독성 — 중점 확인 4) "지급대상 아님" 화면이 오류처럼 보이지 않으면서도 수급개시연령/수급개시연도는 계속 표시되는가?
- **근거**: `ui.tsx` 365-390행은 `text-danger`/`role="alert"` 같은 "오류" 톤이 아니라
  `docs/DESIGN_SYSTEM.md` "경고/미충족 카드" 패턴(`border-warning-border bg-warning-surface`,
  severance-pay와 동일 클래스)을 쓴다. 본문은 "노령연금 수급을 위한 법정 최소
  가입기간(120개월)에 못 미쳐 예상 연금액을 계산하지 않았습니다"로 담담하게 상태를
  설명할 뿐 "잘못 입력했습니다" 같은 질책성 문구가 없다. 바로 다음 문단(378-384행)이
  "다만 출생연도 기준 수급개시연령은 **{나이}({연도}부터)**로 계산됩니다"를 굵게 강조해
  보여준다 — `types.ts`의 `NationalPensionBenefitIneligibleResult`가 `pensionableAge`/
  `pensionableYear`를 타입 레벨에서 필수 필드로 강제하므로(48-67행) 이 값이 누락되는
  경로 자체가 구조적으로 불가능하다. FORMULA.md "계산 순서" 2번("수급개시연령 판정은
  최소 가입기간과 무관한 독립 판정")이 정확히 화면까지 이어진다.
- **등급**: 문제없음.

#### Q9. (평가 항목: 결과 가독성 — 중점 확인 5) 조기/연기 11개 옵션 select와 이중 결과 카드가 "법정 나이 기준 금액"과 "조기/연기 반영 금액" 중 어느 것이 실제 선택한 시나리오의 결과인지 혼동 없이 보여주는가?
- **근거**: `earlyOrDeferredMonths !== 0`일 때 `ui.tsx` 417-439행은 (a) 1차 카드를 조기는
  "조기노령연금 반영 예상 월 수령액(세전)", 연기는 "연기연금 반영 예상 월 수령액(세전)"
  으로 라벨링하고 조정률·조기/연기 개월수까지 함께 표시하며, (b) 그 아래 일반 텍스트로
  "참고: 법정 수급개시연령({나이}) 기준 금액은 **{금액}**입니다"를 보조 정보로만
  배치한다 — 시각적 위계(카드 vs 일반 문단, 큰 글씨 vs 작은 글씨)가 "지금 이 입력에 대한
  답"과 "참고용 비교값"을 명확히 구분한다. `earlyOrDeferredMonths === 0`이면 카드가
  하나만 렌더링되어(404-416행) 불필요한 비교 대상 자체가 나타나지 않는다. "적용된
  입력값" SectionCard(489-514행)도 select에서 고른 옵션의 라벨 문자열을 그대로 다시
  보여줘(506-510행) 사용자가 자신이 무엇을 선택했는지 다시 확인할 수 있다.
- **등급**: 문제없음(정보 구조 자체는 명확함 — select 자체의 표시 폭 문제는 아래 Q13에서
  별도로 다룬다).

#### Q10. (평가 항목: 오류 메시지 이해 용이성 / 결과 가독성 — 중점 확인 6) 기준소득월액 clamp 발생 시 이 사실이 결과에 명확히 표시되는가?
- **근거**: `formatting.ts`의 `buildBValueClampNotice`(161-170행)가 `bValueClamped`일 때만
  "입력하신 소득이 국민연금 기준소득월액 상한을 초과해 {조정값}으로 조정되어
  계산되었습니다"(또는 하한 미달 버전)를 반환하고, `ui.tsx` 442-447행이 이를
  `docs/DESIGN_SYSTEM.md` "경고/미충족 카드"와 동일한 `WarningCard`(경고 아이콘 포함)로
  결과 카드 바로 아래·계산 상세 카드보다 위에 배치한다 — Q5/Q7의 일반 정책 고지와 달리
  이 고지는 **결과에 물리적으로 인접**해 있어 놓치기 어렵다. Golden Test #8/#9가 이
  로직 자체(clamp 발생·방향 판정)를 이미 검증했다는 사실도 Builder 절에서 확인된다.
- **등급**: 문제없음.

#### Q11. (평가 항목: 계산 과정을 이해할 수 있는지 — 중점 확인 7) 군복무크레딧·출산크레딧·부양가족연금액 미반영 고지, 세전·노령연금 한정 고지가 결과 화면에 실제로 노출되는가?
- **근거**: `NPB_POLICY_NOTICES`(`content.ts` 69-84행) 9개 항목 중 "이 계산기가 계산하는
  것은 노령연금... 유족연금·장애연금·반환일시금 등 다른 급여 종류는 다루지 않습니다"(1번),
  "군복무크레딧·출산크레딧·부양가족연금액... 이 계산기의 입력 모델에 포함되지 않아 결과에
  반영되지 않았습니다"(4번), "이 계산기는 세전 금액만 다루며, 연금소득세 등 세금은
  계산하지 않습니다"(5번)가 전부 존재해 SPEC.md/FORMULA.md가 요구한 고지 항목을 빠짐없이
  포함한다. FAQ 5번(126-132행)도 군복무·출산크레딧·부양가족연금액을 별도 문항으로 다시
  설명한다.
- **등급**: 문제없음(다만 Q5와 동일하게 페이지 하단에 위치한다는 배치 특성은 공유한다).

#### Q12. (평가 항목: 계산 과정을 이해할 수 있는지 / 일반 사용자가 사용 가능한지 — 중점 확인 8) "정확한 예상 연금액은 국민연금공단 '내 연금 알아보기'에서 확인하라"는 안내가 실제로 있는가?
- **근거**: `NPB_PROPORTIONAL_CONSTANT_NOTICE`(60행) 마지막 문장과 `NPB_POLICY_NOTICES`
  8번째 항목(80-81행, "정확한 예상 연금액은 국민연금공단 '내 연금 알아보기'에서
  확인하세요")에 명시돼 있고, FAQ 1번 마지막 문장에도 동일 안내가 반복된다. SPEC.md가
  요구한 정확한 문구("국민연금공단 '내 연금 알아보기'에서 확인하라")와 표현까지 일치한다.
- **등급**: 문제없음.

#### Q13. (평가 항목: 모바일 사용성 — 레이아웃 관점 — 중점 확인 9) 조기/연기 11개 옵션 `<select>`의 선택된 라벨이 320~375px 뷰포트에서 잘리지 않는가?
- **근거**: `EARLY_OR_DEFERRED_OPTIONS`(`formatting.ts` 81-99행)의 가장 긴 라벨(예: "5년
  앞당겨 받기(조기노령연금, -30.0%)", "5년 늦춰 받기(연기연금, +36.0%)")은 한글 12자 +
  영문/숫자/기호 약 13자, 총 약 25자다. `<select>`는 `ui.tsx`의 공용 `INPUT_CLASS`
  (`px-3.5 py-3 text-sm`, 71-72행)를 그대로 쓰고 `appearance-none` 등 네이티브 화살표
  제거 처리가 없어 브라우저 기본 드롭다운 화살표(보통 20~30px)가 오른쪽에 추가로
  자리를 차지한다. 320px 뷰포트에서 페이지(`px-5`, 20px×2) → 폼 카드(`p-5`, sm 미만이라
  `sm:p-8` 미적용, 20px×2)를 제외하면 select 자체의 가용 폭은 약 240px, 여기서 좌우
  패딩(28px)과 화살표 영역(~24px)을 빼면 텍스트 표시 가능 폭은 대략 190px 안팎으로
  추정된다. text-sm(14px) 한글 글자 폭을 약 14~15px로 잡으면 12자만으로도 약 170px,
  나머지 영문/숫자/기호(약 13자, 문자당 6~8px)까지 더하면 약 260px 안팎이 필요해
  **가용 폭(~190px)을 상당히 초과할 가능성이 높다** — 즉 select 트리거에 표시되는
  현재 선택값 라벨이 잘리거나(브라우저별로 말줄임 또는 그냥 잘림) 화살표와 겹칠 위험이
  있다. ARCHITECTURE.md "8.1"·"17."과 Builder "애매했던 지점"도 이미 이 위험을
  명시적으로 지목하며 UX/UI Critic의 실기기 확인을 요청했다 — 이 계산기에 11개 옵션의
  `<select>`를 쓰는 사례가 사이트 최초라 재사용 가능한 선례도 없다(기존 계산기들은
  라디오/세그먼트 2~3개 옵션이 대부분). 값 자체는 정상 제출되므로 계산 결과에는 영향이
  없다.
- **등급**: **Medium** — 코드 정독·문자 폭 추정만으로는 실제 렌더링 결과를 확정할 수
  없으나, 계산된 여유 폭이 매우 빠듯해(추정 필요 폭이 가용 폭을 30% 이상 초과) 실제
  잘림 가능성이 낮지 않다고 판단한다. 기능 차단은 아니지만(제출은 정상 동작) 사용자가
  자신이 정확히 무엇을 선택했는지 select 트리거에서 바로 확인하기 어려울 수 있어 QA가
  320px·375px 실기기(또는 Chrome DevTools 반응형 모드)로 반드시 실측 확인할 것을
  권장한다. 해소 방법으로는 라벨 단축(예: "5년 앞당김(-30.0%)")이나 `text-xs` 축소를
  제안한다.

#### Q14. (평가 항목: 모바일 사용성 — 레이아웃 관점) 핵심 결과 카드의 큰 금액 표시(`text-4xl sm:text-5xl`)가 320px 뷰포트에서 최댓값 시나리오(예: 소득 상한 clamp + 40년 초과 가입 + 연기연금 최대)에도 넘치지 않는가?
- **근거**: `ui.tsx` 409행/426행은 `text-4xl font-bold tracking-[-0.04em] tabular-nums ...
  sm:text-5xl`로 금액을 표시한다. ARCHITECTURE.md "4."가 계산한 최악 조합
  (`adjustedPensionMonthly ≈ 3,720,908`)처럼 8자리 금액에 "원"까지 붙으면
  "3,720,908원"(11자)이 된다. 320px 뷰포트에서 페이지(`px-5`)·카드(`p-6`, sm 미만)
  패딩을 제외한 카드 내부 가용 폭은 대략 230px 안팎으로 추정되는데, `text-4xl`(36px)
  기준 11자 숫자·콤마·"원"을 tabular-nums로 표시하면 폭이 이 가용 공간에 매우
  근접하거나 초과할 가능성이 있다. 다만 이 패턴(`bg-primary` 강조 카드에 `text-4xl~5xl`
  큰 금액) 자체는 severance-pay·unemployment-benefit 등 이 사이트의 거의 모든 계산기가
  공유하는 표준 컴포넌트 스타일이며, 그 계산기들도 유사하거나 더 큰 자릿수의 금액(예:
  퇴직금 수천만 원)을 이미 문제없이 표시해 온 것으로 보인다(이번 감사 범위에서 그
  계산기들의 최댓값 렌더링을 재검증하지는 않았다).
- **등급**: Low — 기존에 이미 널리 쓰이는 컴포넌트 패턴이라 이 계산기만의 새로운 위험은
  아니지만, 이 계산기가 도달할 수 있는 금액 자릿수(최대 8자리)가 사이트 평균보다 큰 편에
  속할 수 있으므로 QA가 320px에서 소득 상한 clamp + 최장 가입기간 + 연기연금 최대
  조합으로 한 번 실측해 볼 것을 권장하는 수준의 참고 기록으로 남긴다.

#### Q15. (평가 항목: 계산 과정을 이해할 수 있는지) "계산 방법" SectionCard의 각 단계가 SPEC.md Must Have("각 단계의 실제 대입값")대로 실제 숫자가 대입된 수식으로 표시되는가?
- **근거**: `buildCalculationSteps`(`formatting.ts` 112-153행) 1~3단계는 실제 대입값을
  보여준다 — 1단계 "입력값 {금액} → 상·하한 조정 후 {금액}", 2단계 "A값 {금액}, 비례상수
  {값}", 3단계 "총 가입기간 {개월} → 보정계수 {비율}"까지는 전부 구체적 숫자다. 그러나
  **4단계("기본연금액 산출")는 "비례상수 × (A값 + B값근사) × 보정계수 ÷ 12 =
  {결과금액}"처럼 변수명만 기호로 나열하고 실제 숫자(예: "1.29 × (3,193,511원 +
  3,000,000원) × 100.0% ÷ 12")를 대입하지 않은 채 결과값만 보여준다.** 조기/연기가
  적용된 경우의 5단계("기본연금액(절사 전 완전정밀도) × (1 {조정률}) = {결과금액}")도
  동일하게 "기본연금액(절사 전 완전정밀도)"라는 기호적 표현만 쓴다. 사용자가 수식을 직접
  검산하려면 바로 위 "계산 상세" SectionCard(450-473행)에 있는 A값·B값·비례상수·보정계수
  네 값을 스스로 다시 옮겨 적어야 한다 — 정보 자체는 같은 화면(한 카드 위)에 전부
  있지만, "각 단계의 실제 대입값"을 요구한 SPEC.md 문언을 4~5단계 자체에서는 문자
  그대로 충족하지 못한다.
- **등급**: **Medium** — 필요한 모든 숫자가 바로 위 카드에 이미 노출돼 있어 실질적으로
  "이해 불가능"한 수준은 아니지만(사용자가 위아래로 대조하면 재구성 가능), SPEC.md가
  명시한 요건("각 단계의 실제 대입값")을 정확히 지키지 못한 구체적 지점이며, 특히 이
  계산기처럼 "왜 이 숫자가 나왔는지"에 대한 신뢰가 중요한 정책형 계산기에서는 최종
  합산 단계일수록 오히려 더 명시적으로 숫자를 보여줘야 한다고 판단한다. 예:
  `"1.29 × (3,193,511원 + 3,000,000원) × 100.0% ÷ 12 = 665,800원"`처럼 실제 값을
  수식에 직접 대입하는 문자열로 바꾸면 해소된다(계산 로직 변경 없이 `formatting.ts`
  문자열 조립만 수정하면 되는 낮은 위험의 개선).

#### Q16. (평가 항목: 입력 라벨의 명확성) 결과 화면의 "현재가치"·"기준소득월액" 같은 용어가 helpText/본문 밖(레이블·경고 카드 제목)에 설명 없이 그대로 노출되는가?
- **근거**: 핵심 결과 카드 라벨 "예상 노령연금 월 수령액(세전, 현재가치)"(`ui.tsx` 407행)와
  clamp 경고 카드 제목 "입력하신 소득이 기준소득월액 범위 밖이라 조정되었습니다"(443행)에
  "현재가치"·"기준소득월액"이라는 경제·법령 용어가 그 자리에서 별도 설명 없이 쓰인다.
  "현재가치"의 의미(미래 물가·임금 상승률 미반영)는 정책 안내 섹션 6번째 항목
  (`NPB_POLICY_NOTICES`, "이 계산 결과는... 현재가치 추정치이며, 실제 수급 시점까지의
  물가·임금 상승률에 따른 미래 명목가치 변동은 반영하지 않습니다")에서 뒤늦게
  풀어 설명되고, "기준소득월액"은 입력 필드 helpText(295-299행)에서 "국민연금
  기준소득월액 상·하한을 벗어나면 자동으로 조정되어 계산됩니다"라고 존재만 언급될 뿐
  경고 카드 본문에서도 추가 설명 없이 그대로 재사용된다. 두 용어 모두 완전히 낯선
  단어는 아니고(문맥상 "오늘 기준 금액", "소득의 상·하한선" 정도로 유추 가능) 계산 결과
  이해 자체를 막지는 않는다.
- **등급**: Low — 치명적이지 않으나, "현재가치 기준"을 "오늘 물가 기준"처럼, 경고 카드
  제목의 "기준소득월액"을 "국민연금이 인정하는 소득 범위"처럼 더 풀어 쓰면 일반 사용자
  이해도가 개선될 여지가 있다는 참고 기록.

#### Q17. (평가 항목: 접근성 — DESIGN_SYSTEM 대조) `aria-live`, `label` 연결, `role="alert"` 등 접근성 요건이 지켜지는가?
- **근거**: 결과 영역 전체가 `<div aria-live="polite">`(364행)로 감싸여 있고, 4개 입력
  전부 `htmlFor`/`id`가 매칭되며(예: `${formId}-birthYear` 223/229행), 오류 문단마다
  `role="alert"`(244, 272, 301행)와 `aria-describedby`(오류 유무에 따라 `-error`/`-help`
  id 전환, 236, 264, 292행)·`aria-invalid`(235, 263, 291행)가 함께 지정된다. 조기/연기
  `<select>`도 `id`/`htmlFor`가 매칭되고 `aria-describedby`로 helpText와 연결된다
  (308-316행). 아이콘은 전부 인라인 SVG(`SectionIcon`, 77-92행)로
  `docs/DESIGN_SYSTEM.md` "아이콘" 절과 일치한다.
- **등급**: 문제없음.

### 발견된 이슈 (등급별)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | 1) Q5: "이 결과는 근사 추정치"라는 SPEC.md 핵심 고지가 핵심 결과 카드에 인접하지 않고 페이지 하단(Intro 3문단째·정책 안내 섹션)에만 존재해, 결과만 보고 이탈하는 사용자에게 도달하지 못할 위험이 있다(내용 자체는 풍부하고 정확함 — 순전히 배치 문제). 2) Q13: 조기/연기 11개 옵션 `<select>`의 긴 라벨(예: "5년 앞당겨 받기(조기노령연금, -30.0%)")이 320~375px에서 추정 필요 폭(~260px)이 추정 가용 폭(~190px)을 크게 초과해 잘릴 위험이 높다(계산 결과 자체에는 영향 없음, QA 실기기 확인 필요). 3) Q15: "계산 방법" 4~5단계가 SPEC.md "각 단계의 실제 대입값" 요건과 달리 변수명만 기호로 표시하고 실제 숫자를 수식에 대입하지 않는다(바로 위 카드에 필요한 숫자가 모두 있어 실질적 이해 불가는 아님). |
| Low | 2 | 1) Q14: 핵심 결과 카드의 최댓값 시나리오(약 8자리 금액)가 320px에서 넘칠 가능성 — 사이트 공통 컴포넌트 패턴이라 이 계산기만의 신규 위험은 아님. 2) Q16: 결과 화면의 "현재가치"·"기준소득월액" 용어가 그 자리에서 설명 없이 쓰이고, 관련 설명은 페이지 하단에 있음. |

### 최종 판정: **PASS**

Critical·High 이슈는 발견되지 않았다. 계산 정확성(Calculation Auditor 영역)은 이미 PASS
및 published 전환 가능 판정을 전제로 재검증하지 않았다. 오케스트레이터가 지정한 9개
중점 확인 지점(근사치 고지 노출, B값 근사 설명, 비례상수 근사 경고, 지급대상 아님 화면의
수급개시연령 유지, 조기/연기 이중 카드의 명확성, 기준소득월액 clamp 고지, 미반영 항목·
세전 고지, 국민연금공단 안내, DESIGN_SYSTEM 대조) 중 7개는 문제없이 구현을 확인했고,
2개(근사치 고지의 결과 인접성, select 옵션 라벨 폭)에서 Medium 등급 개선 여지를 발견했다.

**근사치 고지 자체에 대한 판단(오케스트레이터 요청 사항)**: 이 계산기는 SPEC.md가 요구한
"근사 추정치" 고지를 최소 5곳(Intro 문단, 비례상수 근사 고지, B값 근사 고지, 정책 안내
목록 9개 항목 중 다수, FAQ 2개 문항)에 걸쳐 정확하고 풍부한 일상어 문장으로 담고 있어
**내용 자체는 이 사이트에서 가장 충실한 축에 속한다**고 판단한다. 다만 이 고지들이 전부
`docs/DESIGN_SYSTEM.md`의 표준 "공통 화면 순서"(결과·계산 근거 다음, 소개·정책 안내 섹션)
에만 위치해 핵심 결과 숫자와 물리적으로 떨어져 있다는 점은, 이 계산기가 SPEC.md 단계에서
유독 "여러 차례, 명확히" 강조하라고 요구받았고 실제 노후 재무 계획에 영향을 줄 수 있다는
점을 감안하면 사이트 공통 관례보다 한 단계 더 신경 써야 할 지점이라고 판단해 Medium으로
기록했다. **다만 이는 기존에 이미 이 사이트가 채택해 PASS 판정을 받은 패턴(unemployment-
benefit 등)과 동일한 수준이라 이 계산기만의 새로운 결함이 아니며, 사용자가 고지를 아예
접할 수 없는 구조는 아니므로(스크롤하면 반드시 나온다) Critical/High로 올리지는 않는다.**
Medium 3건은 모두 문구·마크업 수준의 수정(결과 카드 아래 짧은 캡션 추가, select 라벨
단축 또는 폰트 크기 조정, "계산 방법" 문자열에 실제 숫자 대입)으로 해소 가능해 PASS 기준
(Critical 0, High 0)에는 영향을 주지 않는다고 판단한다. Optimizer가 다음 라운드에서 이
세 지점을 보완하고, QA가 Q13(select 라벨 폭)·Q14(최댓값 카드 폭)를 320px·375px 실기기로
실측 검증할 것을 권장한다.

### 재검증 (Optimizer 2차 수정 후)

**재검증일: 2026-09-13(같은 날, 별도 세션).** Optimizer가 "## Optimizer (2차)" 절에서
보고한 5건(근사치 고지 추가, select 라벨 축약, 계산 방법 실제값 대입, 출생연도 대비
가입기간 검증 추가, 용어 설명 보강)을 실제 소스(`ui.tsx`/`formatting.ts`/`content.ts`/
`validation.ts`)와 대조해 재검증했다.

1. **Q5(근사치 고지 위치) → 해소.** `NPB_RESULT_APPROX_CAPTION`이 `ui.tsx` 417-419행·
   437-439행에서 단일/이중 카드 양쪽 모두 금액·보조문 바로 아래(계산 상세 카드보다 앞)에
   렌더링됨을 확인했다. 기존 상세 고지(Intro·정책 안내)와 문구가 달라 중복이 아니며
   자연스럽게 이어진다. **등급: 문제없음(Medium 해소).**
2. **Q13(select 라벨 잘림) → 해소.** `EARLY_OR_DEFERRED_OPTIONS`가 "5년 앞당김(-30.0%)"/
   "5년 연기(+36.0%)"(최장 14자)로 축약됐다. "조기노령연금"/"연기연금" 용어는 select
   helpText에 남아 있어 의미 손실이 없고, 병렬 구조("N년 앞당김/연기(비율)")라 헷갈리지
   않는다. QA 실측 가용 폭(~19자)에 여유 있게 들어간다. **등급: 문제없음(Medium 해소).**
3. **Q15(계산 방법 실제값 미대입) → 해소.** `buildCalculationSteps`의 4·5단계가
   `recomputeBasicPensionMonthlyRaw`로 logic.ts와 동일한 연산을 재현해 "1.29 ×
   (3,193,511원 + 3,000,000원) × 100.0% ÷ 12 = 665,802원(절사 전) → 665,800원"처럼 실제
   숫자를 대입한다 — SPEC.md "각 단계의 실제 대입값" 요건을 충족한다. 다만 5단계 표기
   "(1 -30.0%)"는 "1 - 30.0%"의 축약 표기라 부호 앞뒤 공백이 없어 살짝 읽기 불편하지만
   수학적으로는 정확하고 신규 도입 이슈가 아니다(기존 기호 표기 시절부터 있던 패턴). **등급:
   문제없음(Medium 해소), 표기 스타일은 Low 참고 사항으로만 기록.**
4. **[검증 로직, UX 관점만] 출생연도 대비 가입기간 검증 → 오류 메시지 이해 용이성 문제없음.**
   `validation.ts`의 새 오류 메시지("입력하신 출생연도(2008년) 기준으로는 가입기간이 최대
   528개월(약 44년) 정도까지만 현실적으로 가능합니다. 출생연도와 가입기간을 다시 확인해
   주세요.")는 전문 용어 없이 두 입력값과 구체적 상한을 함께 제시해 이해하기 쉽다. 계산
   로직(경계값 설계) 자체는 Calculation Auditor 영역이라 판단하지 않았다. **등급: 문제없음.**
5. **Q16(용어 설명 부족) → 개선됨(Low 유지).** 결과 카드 라벨에 "현재가치·오늘 물가 기준",
   clamp 경고 제목에 "(국민연금 보험료 산정 기준 소득)"이 짧게 추가돼 라벨이 과도하게
   길어지지 않으면서 이해도가 개선됐다. 다만 기준소득월액은 이 화면에서 보험료가 아니라
   급여(B값) 산정에 쓰이므로 "보험료 산정 기준"이라는 설명이 문맥과 완전히 정확히 맞지는
   않는다 — 일반적으로 통용되는 정의를 그대로 쓴 것이라 치명적이지 않다. **등급: Low
   유지(사소한 문맥 불일치, 개선이나 완전 해소는 아님).**

**전체 재검증 판정: PASS.** Medium 3건 모두 실제로 해소됨을 확인했고, Low 1건은 개선됐으나
완전 해소는 아니라 Low로 유지한다. 새로 도입된 검증 오류 메시지도 이해하기 쉽다. Critical/
High 없음 — 최종 PASS 유지.

## Optimizer (2차)

**수정일: 2026-09-13.** 1차 Optimizer 절(위)은 Calculation Auditor의 "공식 재검토 요청"
(원 단위 반올림 → 10원 미만 절사)을 반영한 작업이었다 — 이번 2차는 그와 무관하게, QA.md
(`tasks/national-pension-benefit-estimate/QA.md`)와 이 문서의 "## UX/UI Critic" 절이
지적한 남은 Medium 4건 + Low 1건을 처리한다. `logic.ts`의 계산 공식·반올림
(`truncateTo10`)·A값/비례상수/clamp/수급개시연령/조기·연기 조정 로직은 **전혀 건드리지
않았다**(4번 항목만 `validation.ts`에 새 검증 규칙을 추가한 예외). 보고서(QA.md, 이 문서
"## UX/UI Critic")에 없는 새 기능은 추가하지 않았다.

### 1. Medium — 근사치 고지가 결과 카드에서 멀리 떨어져 있음

- `src/calculators/national-pension-benefit-estimate/content.ts`: 새 상수
  `NPB_RESULT_APPROX_CAPTION = "이 금액은 근사 추정치이며, 실제 수령액과 다를 수
  있습니다."`를 추가했다. 기존 상세 고지 문구(`NPB_INTRO_PARAGRAPHS[2]`,
  `NPB_POLICY_NOTICES` 등)는 새로 만들지 않고 그대로 뒀다 — 이 한 줄은 그 내용을 짧게
  요약한 것이다.
- `src/calculators/national-pension-benefit-estimate/ui.tsx`: 핵심 결과 카드 두 군데
  (조기/연기 미신청 시 단일 카드, 신청 시 1차 강조 카드) 모두에 금액·부가 설명 문단
  바로 아래 `<p className="mt-1 text-xs opacity-70 ...">{NPB_RESULT_APPROX_CAPTION}</p>`를
  추가했다. 페이지 하단의 기존 상세 고지(Intro 문단, 정책 안내 섹션)는 전혀 수정하지
  않았다 — 중복 대신 위치만 보강했다.

### 2. Medium — 조기/연기 select 옵션 라벨이 320px에서 잘림

- `src/calculators/national-pension-benefit-estimate/formatting.ts`
  `EARLY_OR_DEFERRED_OPTIONS`: 라벨을 `"{N}년 앞당겨 받기(조기노령연금, {비율})"` /
  `"{N}년 늦춰 받기(연기연금, {비율})"`(최장 약 20~25자)에서 `"{N}년 앞당김({비율})"` /
  `"{N}년 연기({비율})"`(최장 14자, 예: `"5년 앞당김(-30.0%)"`, `"5년 연기(+36.0%)"`)로
  축약했다. "조기노령연금"/"연기연금"이라는 용어 자체는 select 바로 아래 helpText
  (ui.tsx, "법정 수급개시연령보다... 앞당겨 받으면(조기노령연금)... 늦춰 받으면
  (연기연금)...")에 이미 있어 옵션 라벨에서 빠져도 의미가 없어지지 않는다.
- CSS(select 폭·`text-overflow` 등)는 변경하지 않았다 — QA.md가 실측한 표시 가능 폭(약
  238px, 문자 기준 약 19자)에 축약된 최장 라벨(14자)이 여유 있게 들어가 CSS 조정 없이도
  해결된다고 판단했다(아래 "실행한 테스트" 참고, 실제 브라우저 재측정은 다음 QA 라운드
  권고).
- `formatting.test.ts`에 라벨 길이(≤15자) 회귀 테스트와 "받기" 같은 이전 긴 표현이
  남아있지 않은지 확인하는 테스트를 추가했다.

### 3. Medium — "계산 방법" 섹션이 실제 숫자를 대입하지 않음

- `src/calculators/national-pension-benefit-estimate/formatting.ts`
  `buildCalculationSteps`: 4단계("비례상수 × (A값 + B값근사) × 보정계수 ÷ 12 =
  {결과}")와 5단계("기본연금액(절사 전 완전정밀도) × (1 {조정률}) = {결과}")가 변수
  기호만 나열하던 것을, 실제 숫자를 대입한 문자열로 교체했다(예: `"1.29 ×
  (3,193,511원 + 3,000,000원) × 100.0% ÷ 12 = 665,802원(절사 전) → 665,800원"`).
  `average-cost-calculator`의 `buildAverageCostBreakdown`(실제 대입값을 문자열로
  조립하는 패턴)을 참고했다.
- 절사 전 완전정밀도 값(`basicPensionMonthlyRaw`)은 `logic.ts`의 결과 타입에 노출되지
  않으므로(지역 변수로만 유지, `types.ts` 설계), 새 비공개 헬퍼
  `recomputeBasicPensionMonthlyRaw`를 `formatting.ts`에 추가해 이미 결과에 공개된 필드
  (`aValue`/`bValueApprox`/`proportionalConstant`/`contributionAdjustmentFactor`)만으로
  **`logic.ts` 158행과 연산 순서·피연산자가 정확히 동일한 수식**을 표시 전용으로
  재계산했다 — `logic.ts`의 실제 계산·반올림 정책 자체는 전혀 바꾸지 않았다(제약 준수).
  5단계도 같은 raw 값에 조정률을 곱해 재계산한다(`logic.ts`가 조기/연기 조정에
  `basicPensionMonthlyRaw`를 재사용하는 것과 동일한 방식).
- `formatting.test.ts`에 Golden Test 예제 2(240개월, 300만원)·예제 13(-60개월) 조건으로
  4·5단계 문자열이 정확히 기대값과 일치하는지 확인하는 테스트를 추가했다(회귀 방지 —
  "A값 + B값근사"처럼 기호만 남은 문자열로 되돌아가지 않는지도 함께 확인).

### 4. Medium — 출생연도 대비 논리적으로 불가능한 가입기간 검증 누락

- `src/calculators/national-pension-benefit-estimate/validation.ts`: 새 상수
  `TYPICAL_FULL_CAREER_MONTHS = 480`(`logic.test.ts` 예제 7 주석이 이미 "전형적
  풀타임 커리어 상한"이라고 부르는 값을 그대로 재사용, 새 매직넘버 아님)과 새 함수
  `maxContributionMonthsForBirthYear(birthYear, currentYear)`를 추가했다. 공식은
  `max(TYPICAL_FULL_CAREER_MONTHS, max(0, (currentYear - birthYear - 18) * 12) + 12)`
  — "만 18세 이후 지금까지 경과 가능한 최대 개월수"(+ birthYear가 연도 단위라 생기는
  월 단위 불확실성 보정용 12개월 여유)와, "출생연도와 무관하게 항상 허용하는 전형적
  풀타임 커리어(40년)" 중 더 큰 쪽을 상한으로 쓴다.
  - **설계 근거**: SPEC.md "국민연금 총 가입기간(가입 예정 포함)"은 이 필드가 이미 낸
    기간뿐 아니라 앞으로 낼 예정 기간까지 합산한다고 명시한다. "만 18세 이후 경과한
    개월수"만으로 상한을 걸면(버퍼 없이) 아직 젊은 사용자가 "앞으로 40년을 채우면
    얼마를 받을지" 미리 가늠해 보는, 이 계산기의 핵심 시나리오까지 막아버린다. 그래서
    "전형적 풀타임 커리어(480개월)까지는 출생연도와 무관하게 항상 허용"이라는 하한을
    공식에 포함시켰다 — QA.md가 재현한 신고 사례(출생연도 2008년 + 가입기간 600개월)는
    480개월보다도 훨씬 크므로 이 설계에서도 그대로 오류로 잡힌다.
  - 기존 `MAX_TOTAL_CONTRIBUTION_MONTHS`(624개월, 출생연도와 무관한 상수 상한)는 코드
    한 줄도 건드리지 않았다 — `validation.ts`의 `totalContributionMonths` 검증 체인에
    `else if` 한 단계를 추가로 붙여 별도 규칙으로 판정한다. `birthYear` 자체가 이미
    오류인 경우(범위 밖 등)에는 이 새 규칙을 적용하지 않아(`birthYearIsValid` 플래그)
    같은 필드에 중복·모순되는 오류가 뜨지 않게 했다.
  - `logic.ts`는 전혀 수정하지 않았다 — 이 규칙을 통과한 입력에 대한 계산 결과는
    이전과 완전히 동일하다(입력을 막는 것뿐).
- `validation.test.ts`에 5개 테스트를 추가했다: (a) QA.md 재현 케이스(출생연도 2008년
  + 600개월) 오류 확인, (b) 갓 성인이 된 출생연도라도 "전형적 풀타임 커리어"(480개월)
  까지는 통과함(미래 가입 예정 포함 설계가 깨지지 않았는지 회귀 확인), (c) 480개월
  경계 바로 위(481개월)는 오류, (d) 1960년생처럼 더 나이가 많으면 480개월을 넘는
  가입기간도 그 사람의 상한까지는 통과·그 이상은 오류(경계값 포함), (e) `birthYear`
  자체가 오류일 때 이 새 규칙이 `totalContributionMonths`에 중복 오류를 만들지 않음.
  또한 기존 "논리적 상한(624개월) 경계값은 통과한다" 테스트는 기본 `birthYear`
  ("1965")로는 새 출생연도 기준 상한(528개월)에 걸려 버리므로, 이 테스트를
  `MIN_BIRTH_YEAR`(1940)로 `birthYear`를 명시해 두 규칙을 독립적으로 검증하도록
  수정했다(624개월 상수 규칙 자체의 계산·경계는 바뀌지 않았음을 확인하기 위한 테스트
  격리일 뿐, 실제 애플리케이션 동작 변경 아님).

### 5. Low — "현재가치"/"기준소득월액" 용어가 설명 없이 노출됨

- `src/calculators/national-pension-benefit-estimate/ui.tsx`: 핵심 결과 카드 라벨
  "예상 노령연금 월 수령액(세전, 현재가치)"를 "예상 노령연금 월 수령액(세전,
  현재가치·오늘 물가 기준)"으로, clamp 경고 카드 제목 "입력하신 소득이 기준소득월액
  범위 밖이라 조정되었습니다"를 "입력하신 소득이 기준소득월액(국민연금 보험료 산정
  기준 소득) 범위 밖이라 조정되었습니다"로 바꿔 짧은 괄호 설명을 덧붙였다. 새 문단을
  추가하지 않고 기존 문구에 괄호만 보탰다.

### 건드리지 않은 것 (제약 준수 확인)

- `logic.ts`는 이번 라운드에서 **한 글자도 수정하지 않았다**(grep으로 재확인 — git
  diff 대상 파일 목록에 `logic.ts`가 없음).
- 비례상수(1.29), A값(3,193,511), 기준소득월액 상·하한 clamp, 가입기간 보정계수 공식,
  수급개시연령 스케줄, 최소가입기간(120개월) 판정, 조기/연기 조정률(월 0.5%/0.6%),
  10원 미만 절사(`truncateTo10`) — 전부 그대로다.
- `registry.ts`의 `status`는 `"draft"` 그대로 유지했다(재검증 이후 최종 판단은 다음
  Calculation Auditor 라운드 몫).

### 실행한 테스트와 결과

- `npx vitest run src/calculators/national-pension-benefit-estimate` — 3개 파일
  (`logic.test.ts` 18개, `validation.test.ts` 28개[23개+신규 5개],
  `formatting.test.ts` 16개[12개+신규 4개]) **62개 테스트 전부 통과**(이번 라운드
  이전 53개 대비 +9개, 전부 이번에 추가한 신규 검증).
- `npx vitest run`(전체 스위트) — **77개 파일, 984개 테스트 전부 통과**(이번 라운드
  이전 975개 대비 정확히 +9개, 회귀 없음).
- `npx tsc --noEmit` — 오류 없음.
- `npm run build`(`next build`) — 성공. published 16종 정적 생성 그대로,
  `national-pension-benefit-estimate`는 `status: "draft"`라 `generateStaticParams()`
  목록에서 계속 제외됨(이전 라운드와 동일).

### 다음 단계로 인계

Calculation Auditor → UX/UI Critic → QA 순서로 재검증해야 한다(docs/EVALUATION.md 개선
Loop 2회차). 이번 라운드가 건드린 파일은 `content.ts`/`formatting.ts`/`ui.tsx`(문구·
마크업)와 `validation.ts`(새 검증 규칙 1건)뿐이며 `logic.ts`는 무관하므로, Calculation
Auditor는 4번 항목(새 검증 규칙 `maxContributionMonthsForBirthYear`의 설계 트레이드오프
— "전형적 풀타임 커리어 480개월까지는 출생연도와 무관하게 항상 허용"이라는 절충이
SPEC.md "출생연도 기준으로 논리적으로 불가능한 가입기간을 검증한다" 요건을 충분히
충족하는지)을 중점적으로 재검토해 주기를 권장한다. 나머지(1·2·3·5번)는 순수 표시용
변경이라 계산 정확성에는 영향이 없다.

### 재검증 (Optimizer 2차 수정 후)

**검증일: 2026-09-13.** `validation.ts`의 신규 `maxContributionMonthsForBirthYear`를 중점 검토했다.

1. **QA 재현 케이스 차단**: birthYear=2008, currentYear=2026 → 상한=`max(480, max(0,(2026-2008-18)*12)+12)=max(480,12)=480`. 600개월은 480 초과로 차단됨을 독립 계산으로 확인했다(수정 목적 달성).
2. **480 하한 판단: 적절함**. 이론상 최댓값 624(18~70세)는 극단적 안전판일 뿐이며, 480(전형적 40년 커리어, `logic.test.ts` 예제 7 기존 명명값 재사용)은 "가입 예정 포함" 필드 설계상 18세가 미래 40년 전체 커리어를 가정해 입력하는 정당한 시나리오까지 막지 않으려는 합리적 절충이다. SPEC.md "계산법을 몰라도 사용 가능"·장기 계획 차단 금지 취지에 부합하며, QA가 지적한 진짜 문제(600개월)는 여전히 차단된다.
3. **경계 케이스 직접 계산**: (2008,480)통과 / (2008,481)차단 / (1950,588)→상한708, 통과 / (1940,625)→기존 624 상수 규칙이 먼저 걸려 차단(연령기반 상한 828 도달 전에 이미 차단). 두 규칙은 `min(624, max(480, 연령기반+12))`로 무모순 결합되며 실사용 시 서로 상충하지 않는다.
4. **순수 검증 전용 확인**: `logic.ts`는 이번 라운드에서 미수정(grep 재확인, birthYear 참조 없음) — 계산 결과는 불변이며 이 규칙은 입력 차단에만 관여한다.

**`recomputeBasicPensionMonthlyRaw` 대조**: `formatting.ts`의 재계산식이 `logic.ts` 163~164행과 연산자·순서까지 동일함을 코드 대조로 확인했고, Golden Test 값(665,802.4325→665,800 등)과도 일치했다 — 계산 근거 화면과 실제 계산 결과 간 괴리 없음.

**회귀**: `npx vitest run` 77개 파일/984개 테스트 전부 통과, `npx tsc --noEmit` 오류 없음.

**결론: 신규 검증 로직은 적절하다(PASS). 새로운 Critical/High/Medium 이슈 없음. Published 게이트 판정(전환 가능)은 그대로 유지된다.**

## 점수 (오케스트레이터, 2026-09-13)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor가 nps.or.kr의 실제 공개 AJAX 엔드포인트(`getOHAH0011P0.do`)를 직접 발견해 21개 라이브 데이터포인트(소득 3종×가입기간 7종)로 산식 구조(÷12 포함)를 실측 대조 — 이 프로젝트에서 가장 강력한 수준의 실증 검증. 이 과정에서 FORMULA.md 자체의 반올림 정책 오류(원단위 반올림 → 실제는 10원 미만 절사)를 발견해 "공식 재검토 요청"으로 반려했고, Formula Analyst 정정 → Optimizer 코드 수정 → Auditor가 실제 `calculateNationalPensionBenefit()` 함수를 직접 호출해 21/21 재대조까지 완료했다(3중 독립 재계산: Formula Analyst·Optimizer·Auditor 각각 별도 산출, 전부 일치). 잔여 "확인 필요"(20년 미만 비례감액의 정확한 조문 항·호, 국고금관리법 제47조의 국민연금공단 적용 여부(시행령 지정 확인 안 됨), 조기/연기 조정값의 절사 방식은 직접 라이브 검증 안 됨)로 −1 — 전부 영향 ≤9원 수준으로 정직하게 공개됨. |
| 예외/경계값 처리 | 15 | **15** | 최소가입기간(119/120개월) 경계, 20년 보정 경계(239/240/241개월), 수급개시연령 스케줄 전 구간 경계(1952/53, 56/57, 68/69년생), 기준소득월액 상·하한 clamp, 조기/연기 최대한도(60개월)·초과 시 오류, 그리고 2차 라운드에서 추가된 출생연도 기반 논리적 가입기간 상한까지 경계값 검증이 매우 두텁다. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic PASS + 재검증 PASS(2라운드 모두). "근사치/추정치" 고지가 이 사이트에서 가장 충실한 축(Critic 표현)이며, 1차 재검증에서 Medium 3건(고지 위치, select 라벨 잘림, 계산 근거 미대입) 전부 해소 확인. 잔여 Low(기준소득월액 설명이 이 화면의 실제 용도와 정확히 들어맞지는 않음)로 −1. |
| 모바일/반응형 | 10 | **9** | QA가 실제 headless Chrome/Edge(CDP)로 320px에서 select 라벨 잘림을 픽셀 단위로 실측 확인 후, Optimizer 수정본을 다시 동일 방법으로 재실측해 여유 있게 들어감을 확인 — 실제 렌더링 기반 검증. Safari/Firefox 미검증(이 환경의 구조적 한계, 공통 감점)으로 −1. |
| 접근성 | 5 | **5** | 신규 검증 오류를 포함해 `aria-invalid`/`aria-describedby` 정상 연결을 실제 CDP 테스트로 확인, label 연결·`role="alert"`·select 시맨틱·`aria-live` 표준 패턴 준수. |
| 성능/안정성 | 5 | **5** | 실제 headless 브라우저 다회 시나리오에서 콘솔 에러 0건, `npx tsc --noEmit` 오류 0, `npm run build` 성공. |
| 설명/계산 근거 | 5 | **5** | "계산 방법" 섹션이 실제 대입값을 보여주도록 수정 완료(예: "1.29 × (3,193,511원 + 3,000,000원) × 100.0% ÷ 12 = 665,802원(절사 전) → 665,800원"), B값 근사·비례상수 근사의 오차 방향까지 결과 화면에 고지. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록, `app/calculators/[slug]/page.tsx` 배선, FAQ 구조화 데이터 등 공통 구조 준수. |
| 코드 품질/유지보수성 | 5 | **5** | 정책 수치를 `rates-2026.json`에 완전히 분리(하드코딩 없음), 반올림 전/후 값의 재사용을 타입·함수 경계로 구조적으로 차단(중간 반올림 금지 원칙이 실제로 깨지지 않게 설계), 검증 로직과 계산 로직의 책임 분리가 명확. |
| **총점** | 100 | **97** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 97 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최초 판정 + 2회 재검증에서 0 ✅ |
| Golden Test 100% | 15/15 + nps.or.kr 라이브 데이터 21개 실측 대조 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ (실제 headless 브라우저 실측 포함) |
| Mobile Critical 0 | ✅ (실제 Chrome/Edge 320px 픽셀 단위 실측) |
| **PUBLISHED 추가 게이트**(FORMULA.md/ARCHITECTURE.md, 이 계산기 전용) | ✅ 해소 — ÷12 등 산식 구조 라이브 대조 완료(21/21) + 반올림 정책 오류 발견·수정·재검증 완료 |

**판정: PASS — registry.ts `status`를 `published`로 전환한다.**
개선 Loop 횟수: 2/5 (1차: Calculation Auditor의 "공식 재검토 요청"(반올림 정책) 처리, 2차: UX/UI Critic·QA의 Medium 4건+Low 1건 처리 — 둘 다 재검증 전부 PASS)

### 남은 후속 과제 (발행 비차단, 전부 Low 이하 또는 정책 재검토 트리거)
- 20년 미만 비례 감액(가입월수/240)의 정확한 조문 항·호 번호는 여전히 미확정(사실 자체와 산식 형태는 nps.or.kr 1차 자료로 확인됨).
- 국고금관리법 제47조가 국민연금공단에 실제로 적용되는지(시행령 지정 여부)는 확정하지 못했다 — 다만 21/21 실증 일치가 이미 충분한 근거를 제공한다.
- 조기/연기연금 조정값(`adjustedPensionMonthly`)의 10원 절사 방식은 "합리적 추정"이며 직접 라이브 검증되지 않았다(nps.or.kr 간단계산 도구가 조기/연기 케이스를 제공하지 않음).
- 군복무크레딧·출산크레딧·부양가족연금액은 명시적으로 범위 밖(SPEC.md에 반영 완료).
- **정책 재검토**: A값은 2026-12-01(연 1회 12월 갱신), 비례상수(43% 고정)는 2027-01-01에 유지 여부 확인(PROGRESS.md 각주 참고). 재평가율 테이블은 이 계산기가 구현하지 않으므로 재검토 대상 아님.
