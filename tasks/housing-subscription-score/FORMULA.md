# FORMULA: 청약가점 계산기 (housing-subscription-score)

## 이 문서의 신뢰도에 관한 사전 고지 (조사 방법론 한계 고지)

이 계산기는 정책 의존도가 매우 높아 SPEC.md가 WebSearch/WebFetch를 통한 1차 출처 검증을 명시적으로 요구했다. 조사 결과를 투명하게 밝힌다.

- **직접 열람하지 못한 것**: 국가법령정보센터(law.go.kr)의 「주택공급에 관한 규칙」 별표 1 원문(표 이미지/PDF)은 이 세션에서 사용 가능한 WebFetch 도구로 열람하지 못했다. law.go.kr의 별표 페이지는 JS 렌더링/PDF 바이너리 형태라 텍스트 추출이 되지 않았고(여러 차례 시도, 모두 "표 내용 없음" 응답), 국토교통부 산하기관 PDF(geps.or.kr)도 이미지 기반 PDF라 추출 실패했다. 또한 WebFetch 요약 과정에서 **한 차례 명백한 환각(hallucination)을 확인**했다(nepla.ai 페이지 요약이 "무주택기간 1년 이상 최소 4점~30년 이상 최대 32점", "부양가족수 0명 0점~6명이상 27점", "가입기간 6개월이상 최소 2점~10년이상 최대 17점"이라는, 아래 교차검증 결과와 명백히 모순되는 값을 지어냈다 — 이 값은 채택하지 않았다).
- **대신 사용한 검증 방법**: 아래 배점표 3종은 서로 독립적인 두 출처가 **완전히 동일한 수치**를 제시하는 것을 확인해 채택했다.
  1. HUG 주택도시보증공사(공공기관, khug.or.kr) 「주택청약도우미」 안내 페이지
  2. 호반써밋(민간 시행사, hobansummit.co.kr) 「청약가점안내」 공식 고지 페이지
  두 페이지는 서로 다른 운영주체이면서도 무주택기간·부양가족수·가입기간 3개 표의 모든 구간·점수가 소수점 하나까지 일치했다(구간 경계 표현만 "이상~미만" vs "초과~이하"로 문구가 갈렸을 뿐, 숫자는 완전 일치). 정부24(gov.kr) 공식 서비스 안내 페이지도 총점 구성(32+35+17=84)을 독립적으로 확인해줬다. calctools.co.kr(민간 블로그성 계산기)은 가입기간 표의 "3~4년" 구간에 6점(다른 두 출처는 5점)이라는 **명백한 오류**를 보여 신뢰도가 낮다고 판단해 배제했다 — 이는 자동 요약/2차 정보가 얼마나 쉽게 틀릴 수 있는지 보여주는 근거로 남긴다.
- **결론**: 배점표 3종(32/35/17=84)의 숫자 자체는 신뢰도가 높다고 판단하지만(2개 이상 독립 출처 완전 일치 + 정부24 총점 교차확인), **법령 원문(별표 1)과의 최종 1:1 대조는 완료하지 못했다.** Calculation Auditor 또는 QA 단계에서 국가법령정보센터 접속 권한이 있는 담당자가 별표 1 원문 이미지를 직접 열람해 재확인할 것을 강력히 권고한다(아래 "확인 필요 항목 총정리" 1번).

## 목적

민영주택 일반공급 가점제(「주택공급에 관한 규칙」 별표 1)의 세 가점 항목 — 무주택기간, 부양가족수, 청약통장(주택청약종합저축 등) 가입기간 — 각각의 점수와 합산 총점을 계산한다. SPEC.md가 위임한 범위(세 항목 "점수" 산정)에 정확히 한정하며, 청약 자격요건 최종 판정·특별공급·추첨제·임대주택은 다루지 않는다(SPEC.md "범위 밖" 그대로 유지).

## 입력값

| 변수명 | 설명 | 단위 | 허용 범위 |
|---|---|---|---|
| `baseDate` (기준일) | 세 항목 모두의 산정 기준일. 실제 제도에서는 "입주자모집공고일"이지만, 이 계산기는 공고 전 참고용이므로 사용자가 직접 지정한다(기본값: 오늘) | date (YYYY-MM-DD) | 기본값 오늘. `birthDate` 이후 ~ 오늘+5년 이내(먼 미래의 가상 공고일 입력을 허용하되 무한정 허용하지 않음) |
| `birthDate` (생년월일) | 무주택기간 기산일(만 30세) 산정용 | date | 1900-01-01 ~ `baseDate` (미래 날짜 불가) |
| `isMarried` (혼인 여부) | 혼인신고 여부 | boolean | 기본값 false |
| `marriageDate` (혼인신고일) | `isMarried=true`일 때 필수 | date | `birthDate` 이후 ~ `baseDate` 이전(당일 포함) |
| `housingStatus` (주택 소유 이력) | `'never_owned'`(무주택 유지) / `'disposed'`(과거 소유 후 처분) / `'currently_owns'`(현재 소유 중) 중 하나 | enum | 필수 |
| `mostRecentDisposalDate` (최근 처분일) | `housingStatus='disposed'`일 때 필수. 세대구성원 중 누구든 마지막으로 주택을 처분해 전원 무주택이 된 날 | date | `birthDate` 이후 ~ `baseDate` 이전(당일 포함) |
| `smallLowValueHomeException` (소형·저가 주택 등 특례 해당 여부) | `housingStatus='currently_owns'`일 때만 노출되는 선택 입력. 「주택공급에 관한 규칙」 제53조의 무주택 간주 특례(아래 "알려진 정책 특례" 1번) 요건을 사용자가 스스로 확인했다고 체크하는 용도 | boolean | 기본값 false. **v1은 이 값을 받아서 안내만 하고 자동 판정에 반영하지 않는 것을 권고**(아래 "알려진 정책 특례" 참고) |
| `hasQualifyingSpouseInHousehold` | 부양가족으로 인정되는 배우자가 있는지(세대 분리되어 있어도 인정됨을 도움말에 명시) | boolean | `isMarried=true`일 때만 의미 있음. 기본값 `isMarried`와 동일 |
| `qualifyingAscendantCount` (인정되는 직계존속 수) | 신청자 또는 배우자의 직계존속 중, ① 3년 이상 계속 동일 주민등록표에 등재되어 있고 ② 본인 소유 주택이 없는(무주택) 사람의 수. 도움말에 이 두 요건을 명시 | 정수 | 0 이상, 상식적 상한(예: 4) |
| `qualifyingDescendantCount` (인정되는 미혼 직계비속 수) | 미혼 자녀 중, 만 30세 미만이거나(요건 없음) 만 30세 이상이면서 최근 1년 이상 계속 동일 주민등록표에 등재된 사람의 수. 도움말에 두 조건을 명시 | 정수 | 0 이상, 상식적 상한(예: 10) |
| `subscriptionAccountOpenDate` (청약통장 최초 가입일) | 통장 전환·예치금 변경·명의변경이 있었어도 최초 가입일(순위기산일) 기준. 도움말에 "전환·변경해도 최초 가입일 그대로 유지" 명시 | date | `birthDate` 이후 ~ `baseDate` 이전(당일 포함) |
| `hasSubscriptionAccount` | 청약통장 보유 여부(가입 이력이 전혀 없는 경우와 구분) | boolean | 기본값 true. false면 `subscriptionAccountOpenDate` 입력 불필요, 점수 0 |

**derived**: `dependentCount = (hasQualifyingSpouseInHousehold ? 1 : 0) + qualifyingAscendantCount + qualifyingDescendantCount`

## 출력값

| 변수명 | 설명 | 단위 |
|---|---|---|
| `homelessEligible` | 무주택기간 산정이 시작되는 상태인지(만 30세 도달 또는 혼인, 그리고 현재 무주택 요건 충족) | boolean |
| `homelessPeriodYears` | 산정된 무주택기간(만 연수, 절사) — 참고 표시용 | 년 (정수) |
| `homelessPeriodScore` | 무주택기간 점수 | 점 (0~32) |
| `dependentCount` | 인정 부양가족 수(배우자+직계존속+직계비속 합) | 명 (정수) |
| `dependentScore` | 부양가족수 점수 | 점 (5~35, 또는 미해당 없음 — 최소 5점) |
| `subscriptionPeriodYears` / `subscriptionPeriodMonths` | 청약통장 가입기간(연/개월, 절사) — 참고 표시용 | 년/개월 (정수) |
| `subscriptionPeriodScore` | 청약통장 가입기간 점수 | 점 (0~17) |
| `totalScore` | 세 항목 합산 총점 | 점 (0~84) |
| `breakdownText[]` | 각 항목이 어떤 입력·구간에서 그 점수가 나왔는지 설명하는 문자열 배열 | string[] |
| `warnings[]` | "무주택 요건 미충족", "만 30세 미만 미혼이라 무주택기간 0점" 등 예외 사유 안내 | string[] |

## 공식

```
1. 무주택기간 기산일 산정
   ageStartDate = birthDate + 30년(만 30세가 되는 날, 생일)

   [윤년 2월 29일 clamp 규칙 — 2026-09-06 추가, Calculation Auditor 지적(EVALUATION.md
   "3. 윤년 2월 29일 '만 30세가 되는 날' 처리") 반영]
   생일이 2월 29일이고, 30세가 되는 해(birthDate.year + 30)가 평년(2월 29일이 없는 해)이면,
   ageStartDate는 "3월 1일로 넘어가지 않고" 그 해의 2월 28일로 한다(월말 clamp).
   근거: 민법 제160조제3항("월 또는 연으로 정한 경우에 최종의 월에 해당일이 없는 때에는
   그 월의 말일로 기간이 만료한다") — 나이 계산에 이 조항이 준용된다는 것은 행정기본법
   제7조의2·민법 제158조를 통해 일반적으로 인정되는 해석이다. 이 프로젝트 안에서는
   age-calculator(`src/calculators/age-calculator/date-utils.ts`의 `anniversaryInYear`,
   `Math.min(day, daysInMonth(year, month))`)가 이미 이 clamp 규칙을 구현하고 있고,
   그 규칙은 `tasks/age-calculator/FORMULA.md`("anniversary는 출생 월·일을 대상 연도에
   옮긴다. 대상 연도에 같은 날짜가 없으면 해당 월의 말일로 보정한다. 따라서 2월 29일생은
   평년에는 2월 28일을 해당 연도의 나이 경계로 사용한다") 및
   `tasks/age-calculator/ARCHITECTURE.md`("2월 29일생의 윤년·평년 경계")가 법제처 공식
   예시로 검증한 것이다 — 이 계산기도 동일한 clamp 방식을 따른다(Builder 안내: 파일을
   공유·import하지 말고 이 계산기 자체 헬퍼(`ageThirtyDate()` 등)에서 동일한 로직으로
   독립 구현할 것, ARCHITECTURE.md "2." 결정 그대로 유지).
   참고(수학적 사실, 추정 아님): 이 공식은 항상 "생일 + 30년"만 계산하는데, 2월 29일
   출생연도는 반드시 4의 배수여야 하고 30은 4의 배수가 아니므로 "출생연도 + 30"은
   결코 4의 배수(=윤년)가 될 수 없다. 즉 2월 29일생의 "30세가 되는 해"는 예외 없이
   항상 평년이며, 이 clamp은 "가끔" 적용되는 예외가 아니라 2월 29일생 전원에게 매번
   적용되는 규칙이다(검증 예제 13·14 참고 — 예제 14의 설명에 이 사실의 함의를 부연했다).

   homelessStartCandidate =
     isMarried && marriageDate < ageStartDate ? marriageDate : ageStartDate
   (만 30세 이전에 혼인했다면 혼인신고일부터, 아니면 30세 생일부터 — 아래 "무주택기간 기산일 규칙" 참고)

2. 무주택 요건 판정
   currentlyHomeless =
     housingStatus === 'never_owned' ? true :
     housingStatus === 'disposed'    ? true (단, homelessStartCandidate를 mostRecentDisposalDate로 다시 밀어냄, 아래 3번) :
     housingStatus === 'currently_owns' ? false (특례 미반영, 아래 "알려진 정책 특례" 참고)

3. 무주택기간 실제 기산일
   homelessStartDate = max(homelessStartCandidate, mostRecentDisposalDate ?? -Infinity)
   (30세/혼인신고일 이후에 주택을 소유했다가 처분한 이력이 있다면, 기산일은 "그 처분일"로 다시 시작된다 — 처분일이 30세/혼인신고일보다 이전이면 영향 없음)

4. 무주택기간 연수
   homelessEligible = (baseDate >= homelessStartCandidate) && currentlyHomeless
   homelessPeriodYears = homelessEligible
     ? calendarFullYearsBetweenUtc(homelessStartDate, baseDate)  (만 나이 방식, 절사)
     : 0

5. 무주택기간 점수
   homelessPeriodScore =
     !homelessEligible ? 0 :
     min(32, 2 * (homelessPeriodYears + 1))
   (0년차="1년 미만"=2점, 1년차=4점, ... 14년차=30점, 15년차 이상은 min()이 32로 캡)

6. 부양가족수
   dependentCount = (hasQualifyingSpouseInHousehold ? 1 : 0) + qualifyingAscendantCount + qualifyingDescendantCount
   dependentScore = 5 + 5 * min(dependentCount, 6)
   (0명=5점, 1명=10, ..., 6명 이상=35로 캡)

7. 청약통장 가입기간(개월수)
   subscriptionMonths = hasSubscriptionAccount
     ? calendarFullMonthsBetweenUtc(subscriptionAccountOpenDate, baseDate)
     : -1 (미가입 표식)

8. 청약통장 가입기간 점수
   subscriptionPeriodScore =
     subscriptionMonths < 0  ? 0 :                          (통장 미가입)
     subscriptionMonths < 6  ? 1 :
     subscriptionMonths < 12 ? 2 :
     min(17, floor(subscriptionMonths / 12) + 2)
   (6개월 미만=1점, 6개월~1년 미만=2점, 만 1년(=12개월)부터는 floor(개월/12)+2를 15년(180개월, 결과 17)까지 적용, 그 이상은 min()이 17로 캡)

9. 총점
   totalScore = homelessPeriodScore + dependentScore + subscriptionPeriodScore   (상한 32+35+17=84, 항상 이 범위 안에 있음이 산식 자체로 보장됨 — Golden Test로 불변식 고정 권장)
```

**`calendarFullYearsBetweenUtc(start, end)` / `calendarFullMonthsBetweenUtc(start, end)` 관련 Builder 안내**: 이 두 함수는 "만 나이" 계산과 동일한 방식(달력상 연/월/일을 직접 비교해 아직 도래하지 않은 기념일은 차감)으로, 기존 `src/lib/date-calc.ts`에는 없는 **새로운 헬퍼**다(기존 파일의 `calendarMonthsBeforeUtc`는 "기준일에서 N개월을 뺀 날짜"를 구하는 역방향 함수라 용도가 다르다). 무주택기간과 청약통장 가입기간 두 항목이 모두 필요로 하므로, severance-pay/unemployment-benefit이 `calendarMonthsBeforeUtc`를 공용화한 선례(docs/ARCHITECTURE.md "날짜 계산 유틸 공용화")를 따라 `src/lib/date-calc.ts`에 추가해 재사용할 것을 Architect에게 권고한다. 의사코드:
```
calendarFullYearsBetweenUtc(start, end):
  years = end.year - start.year
  if (end.month, end.day) < (start.month, start.day): years -= 1
  return max(0, years)

calendarFullMonthsBetweenUtc(start, end):
  months = (end.year - start.year) * 12 + (end.month - start.month)
  if end.day < start.day: months -= 1
  return max(0, months)
```
날짜 파싱·비교는 `parseIsoDateUtc`(UTC 자정 고정)를 그대로 재사용해 timezone 이동 문제를 막는다(docs/CALCULATOR_RULES.md "날짜 계산기" 참고).

## 계산 순서

1. 입력 검증(모든 필수 입력, 날짜 논리 검증 — 아래 "예외" 참고). 실패 시 계산하지 않고 필드별 오류 표시.
2. `homelessStartDate`, `homelessEligible` 산출(공식 1~4단계).
3. `homelessPeriodScore` 산출(공식 5단계). `homelessEligible=false`면 `warnings[]`에 사유 추가("만 30세 미만 미혼" 또는 "현재 주택을 소유 중이라 무주택 요건 미충족").
4. `dependentCount`, `dependentScore` 산출(공식 6단계).
5. `subscriptionMonths`, `subscriptionPeriodScore` 산출(공식 7~8단계). `hasSubscriptionAccount=false`면 `warnings[]`에 "청약통장 미가입" 추가.
6. `totalScore` 합산(공식 9단계).
7. `breakdownText[]` 구성 — 각 항목에 대해 "무주택기간 8년 3개월 → 8년 이상 9년 미만 구간 → 18점"처럼 실제 입력값을 대입한 설명 문자열 생성(SPEC.md Must Have "계산 근거" 요구사항).
8. 결과 반환. 입력이 바뀌면 이전 결과를 숨긴다(SPEC.md Must Have).

## 배점표 (검증 결과)

### 1. 무주택기간 (상한 32점)

| 무주택기간 | 점수 |
|---|---|
| 1년 미만 | 2 |
| 1년 이상 ~ 2년 미만 | 4 |
| 2년 이상 ~ 3년 미만 | 6 |
| 3년 이상 ~ 4년 미만 | 8 |
| 4년 이상 ~ 5년 미만 | 10 |
| 5년 이상 ~ 6년 미만 | 12 |
| 6년 이상 ~ 7년 미만 | 14 |
| 7년 이상 ~ 8년 미만 | 16 |
| 8년 이상 ~ 9년 미만 | 18 |
| 9년 이상 ~ 10년 미만 | 20 |
| 10년 이상 ~ 11년 미만 | 22 |
| 11년 이상 ~ 12년 미만 | 24 |
| 12년 이상 ~ 13년 미만 | 26 |
| 13년 이상 ~ 14년 미만 | 28 |
| 14년 이상 ~ 15년 미만 | 30 |
| 15년 이상 | 32 |
| (산정 미시작 — 미혼&30세 미만, 또는 무주택 요건 미충족) | 0 |

### 2. 부양가족수 (상한 35점)

| 인정 부양가족 수 | 점수 |
|---|---|
| 0명 | 5 |
| 1명 | 10 |
| 2명 | 15 |
| 3명 | 20 |
| 4명 | 25 |
| 5명 | 30 |
| 6명 이상 | 35 |

### 3. 청약통장 가입기간 (상한 17점)

| 가입기간 | 점수 |
|---|---|
| 6개월 미만 | 1 |
| 6개월 이상 ~ 1년 미만 | 2 |
| 1년 이상 ~ 2년 미만 | 3 |
| 2년 이상 ~ 3년 미만 | 4 |
| 3년 이상 ~ 4년 미만 | 5 |
| 4년 이상 ~ 5년 미만 | 6 |
| 5년 이상 ~ 6년 미만 | 7 |
| 6년 이상 ~ 7년 미만 | 8 |
| 7년 이상 ~ 8년 미만 | 9 |
| 8년 이상 ~ 9년 미만 | 10 |
| 9년 이상 ~ 10년 미만 | 11 |
| 10년 이상 ~ 11년 미만 | 12 |
| 11년 이상 ~ 12년 미만 | 13 |
| 12년 이상 ~ 13년 미만 | 14 |
| 13년 이상 ~ 14년 미만 | 15 |
| 14년 이상 ~ 15년 미만 | 16 |
| 15년 이상 | 17 |
| (청약통장 미가입) | 0 |

**총점 상한 = 32 + 35 + 17 = 84점.** SPEC.md가 "배경지식상 약 84점, 정확한 값은 FORMULA.md에서 확정"이라 위임한 항목의 답: **84점이 맞다**(정부24 공식 서비스 안내 페이지가 이 총점 구성을 독립적으로 확인해줌).

## 무주택기간 기산일 규칙 (검증됨)

- 원칙: 신청자(주택공급신청자)의 연령이 **만 30세가 되는 날**부터 계속 무주택인 기간으로 산정한다.
- **2월 29일생의 윤년 clamp**: 위 공식 1단계에 명시한 대로, 생일이 2월 29일이고 30세가 되는 해가 평년(2월 29일이 없는 해)이면 그 해의 **2월 28일**을 "30세가 되는 날"로 본다(민법 제160조제3항 근거, 3월 1일로 밀지 않음). 이 계산기의 "+30년" 산식 특성상 2월 29일생은 예외 없이 항상 이 clamp이 적용된다(수학적 사실, 위 공식 1단계 참고). 자세한 근거·경계 검증은 공식 1단계 및 검증 예제 13·14 참고.
- 예외: **만 30세가 되기 전에 혼인한 경우 혼인신고일**부터 기산한다(30세 이전 혼인 시 혼인신고일이 30세 생일보다 항상 이르므로, "더 이른 날"이 곧 "혼인신고일"이 된다 — 공식 1단계의 `min` 비교와 일치).
- 만 30세 미만이면서 미혼인 경우: 무주택기간 산정 자체가 시작되지 않아 **0점**(단순히 "짧은 무주택기간"이 아니라 산정 미개시 상태 — Golden Test로 반드시 구분해서 검증할 것).
- 세대구성원(신청자+배우자 기준, 그 외 가족은 무주택 요건 판정에 포함되지 않음 — 이 부분은 청약 "자격요건" 영역과 맞닿아 있어 SPEC.md 범위 밖과 경계가 미묘하다. v1은 "무주택기간 산정"에 한정해 신청자 본인 기준의 단순 입력만 받는다)이 만 30세/혼인신고일 이후 주택을 소유했다가 처분한 이력이 있으면, 기산일은 **재처분일**로 다시 시작된다.
- **SPEC.md 입력 문구 교정**: SPEC.md는 무주택기간 산정용 원시 정보 예시로 "세대주가 된 시점"을 들었으나, 조사 결과 무주택기간 기산일은 세대주 여부·세대주가 된 시점과 무관하다(세대주 여부는 별도의 청약 자격요건 판정 영역이며 가점 산정 공식에 등장하지 않는다). Formula Analyst 권한으로 이 입력 항목을 제외하고 "생년월일 + 혼인 여부/혼인신고일 + 주택 소유 이력/처분일"만으로 확정한다.

## 부양가족 인정 범위 (검증됨)

- **배우자**: 주민등록이 분리되어 있어도(세대 분리) 인정된다(그 세대원까지 포함한다는 서술도 있으나, v1은 배우자 본인 1명만 카운트하고 배우자의 나머지 세대원 인정 여부는 "확인 필요"로 남긴다 — 아래 "확인 필요 항목" 참고).
- **직계존속**(배우자의 직계존속 포함): 다음 두 요건을 모두 충족해야 인정된다.
  1. 신청자(또는 배우자)와 **3년 이상 계속** 동일 주민등록표에 등재되어 있을 것.
  2. 그 직계존속 본인이 **무주택자**일 것(2018년 12월 개정 이후, 유주택 직계존속은 3년 이상 동거해도 부양가족으로 불인정).
  - 참고: 직계존속을 부양가족으로 인정받으려면 신청자가 세대주여야 한다는 실무 안내도 확인했으나, 이는 "자격요건"에 가까워 v1 입력 모델에서는 별도 판정 없이 도움말 경고 문구로만 안내한다(세대주가 아니면 직계존속 수를 0으로 입력하도록 안내).
- **직계비속**(미혼 자녀): 미혼이어야 하며,
  - **만 30세 미만**: 별도의 동거기간 요건 없이 인정.
  - **만 30세 이상**: 입주자모집공고일(=`baseDate`) 기준 **최근 1년 이상 계속** 신청자 또는 배우자와 동일 주민등록표에 등재되어 있어야 인정.
- v1 입력은 이 요건들을 사용자가 스스로 확인했다는 전제로 `qualifyingAscendantCount`/`qualifyingDescendantCount`(이미 요건을 충족한 인원 수만)를 받는다 — 요건 자체를 자동 판정하지 않는다(SPEC.md가 "인정 범위의 세부 기준은 FORMULA.md에서 확정한다"고 위임한 범위 안에서, 실제 판정에 필요한 개별 정보(동거 개월수 등)까지 입력받는 것은 v1 범위를 벗어난다고 판단 — Should Have 후보로 남길 수 있음).

## 청약통장 가입기간 산정 기준 (검증됨)

- 입주자모집공고일(=`baseDate`) 기준 가입기간으로 산정한다.
- 청약통장 **전환, 예치금액 변경, 명의변경**을 했더라도 **최초 가입일(순위기산일)** 기준으로 가입기간을 그대로 인정한다(중간에 통장 종류를 바꿔도 가입기간이 리셋되지 않음 — v1 입력은 이 최초 가입일 하나만 받으므로 이 규칙은 자동으로 지켜진다).

## 단위

- 날짜: `date`(YYYY-MM-DD), UTC 자정 고정 파싱/비교(`src/lib/date-calc.ts`의 `parseIsoDateUtc` 재사용 권고, docs/CALCULATOR_RULES.md "날짜 계산기" 참고). 로컬 timezone에 따라 날짜가 하루 밀리는 문제를 막는다.
- 기간: 내부적으로는 "연/월" 정수(만 나이 방식 절사)로 계산하고, 원 단위/일 단위 소수 개념은 없다(가점은 항상 정수).
- 점수: 정수(점). 세 항목 모두 소수가 발생하지 않는다.

## 정밀도 / 반올림 정책

- **내부 계산**: 무주택기간·가입기간의 "경과 연수/개월수"는 반올림하지 않고 **절사(버림, 만 나이 방식)** 한다 — 예: 8년 11개월 29일은 "9년"으로 올리지 않고 "8년"으로 취급해 18점(8~9년 구간)을 적용한다. 이는 법령상 "만 나이"·"만 연수" 개념과 관행적으로 일치하는 방식이며, 반대로 "반올림"하면 실제보다 유리한 점수를 보여줄 위험이 있어 채택하지 않는다.
- **표시 결과**: 점수는 항상 정수이므로 별도 반올림이 필요 없다. 참고 표시용 기간("8년 3개월")도 절사값을 그대로 보여준다(올림/반올림 금지).
- **근거**: 법령이 배점 구간을 "OO년 이상 ~ OO년 미만"으로 이산적으로 정의하므로, 구간 판정 자체가 절사 성격을 가진다. 별도의 "법적으로 강제되는 절사/반올림 고시"는 확인하지 못했다(구간표 자체가 반올림 정책을 대체한다).

## 예외

- **빈 값/필수값 누락**: 계산하지 않고 해당 필드 오류 표시.
- **미래 날짜**: `birthDate`, `marriageDate`, `mostRecentDisposalDate`, `subscriptionAccountOpenDate`가 `baseDate`보다 미래이면 오류(논리적으로 불가능).
- **날짜 순서 오류**: `marriageDate < birthDate`, `subscriptionAccountOpenDate < birthDate` 등도 오류.
- **미혼 & 만 30세 미만**: `homelessPeriodScore = 0`, `warnings`에 "만 30세 미만 미혼은 무주택기간 점수가 0점입니다(만 30세 생일 또는 혼인신고일부터 산정 시작)" 추가. 음수 점수 없음.
- **`housingStatus='currently_owns'`(무주택 요건 미충족)**: `homelessPeriodScore = 0`, `warnings`에 "현재 주택을 소유하고 있어 무주택기간 점수를 산정할 수 없습니다. 민영주택 일반공급 가점제 자격 자체도 충족하지 못할 수 있습니다" 추가(SPEC.md "청약 자격요건 판정은 하지 않는다"는 원칙과 배치되지 않도록, 단정적 "부적격" 문구 대신 "산정 불가+가능성 안내" 수준으로 표현). `smallLowValueHomeException=true`를 체크해도 v1은 자동으로 점수를 복구하지 않고 별도 안내만 추가한다(아래 "알려진 정책 특례" 1번).
- **청약통장 미가입(`hasSubscriptionAccount=false`)**: `subscriptionPeriodScore = 0`, `warnings`에 "청약통장 미가입 상태에서는 가입기간 점수가 0점입니다" 추가.
- **부양가족수 0명**: 0점이 아니라 **5점**(기본 배점) — 흔한 구현 오류 지점이므로 Golden Test로 반드시 고정.
- **부양가족수 6명 초과 입력(예: 9명)**: 35점으로 캡, 초과분은 점수에 영향 없음(`warnings` 불필요, 정상 동작).
- **음수 입력**(`qualifyingAscendantCount`, `qualifyingDescendantCount` 등): 입력 검증 단계에서 차단(0 이상 정수만 허용).
- **각 항목 점수가 항목별 상한 초과/음수가 되지 않도록 검증**: 공식 자체가 `min()`/`max()`로 상한·하한을 강제하므로 별도 후처리 불필요하나, Golden Test로 "상한을 넘겨 입력해도 캡된다"를 명시적으로 검증한다(불변식 테스트, SPEC.md 완료 기준).
- **총점 불변식**: `totalScore`가 항상 84를 넘지 않는지, 그리고 `homelessPeriodScore + dependentScore + subscriptionPeriodScore`의 각 상한 합과 정확히 일치하는지 property-based 성격의 테스트로 고정할 것을 권고(SPEC.md 완료 기준 "총점이 세 항목 상한의 합을 넘지 않는 불변식이 테스트로 고정된다").

## 알려진 정책 특례 (v1 범위/한계 — 자동 계산에는 반영하지 않음, 고지 필요)

조사 과정에서 아래 세 가지 실제 제도 특례를 확인했다. SPEC.md의 단순화된 입력 모델(생년월일, 혼인여부, 주택 소유 이력, 청약통장 가입일만 입력)로는 정확히 자동 판정할 수 없는 항목들이라 v1은 **자동 계산에 반영하지 않고, 결과 화면에 고지 문구로만 안내할 것을 권고**한다. 향후 버전에서 입력 필드를 늘려 지원할 수 있다.

1. **소형·저가주택 등 무주택 간주 특례**(「주택공급에 관한 규칙」 제53조): 전용면적 60㎡ 이하 + 공시가격 수도권 1억 6천만원 이하/그 외 지역 1억원 이하인 주택(또는 분양권) 1채만 소유한 세대는 무주택으로 간주한다(2023-11-10 시행, 지역 제한 폐지·가격기준 상향). 2024-12-18 시행 개정으로 비아파트(단독·다가구, 연립·다세대, 도시형생활주택 등)는 기준이 완화되어 전용 85㎡ 이하 + 공시가격 수도권 5억원 이하/그 외 지역 3억원 이하까지 무주택으로 간주한다. → v1은 `housingStatus='currently_owns'`이면 그 세부 조건(면적·공시가격·주택 종류)을 묻지 않고 일괄 0점 처리 + 고지 문구("소형·저가 주택 특례에 해당하면 무주택으로 인정될 수 있으니 청약홈에서 직접 확인하세요")로 대체한다. **정확한 조문 번호(제53조 제O호)와 현재 시행 중인 정확한 문구는 확인 필요.**
2. **배우자 청약통장 가입기간 합산 특례**(2024-03-25 시행): 청약통장 가입기간 점수 산정 시 배우자의 가입기간 중 50%에 해당하는 기간을 추가로 인정하되, 그 가산분은 최대 3점까지만 인정하고 합산 후에도 총점은 17점을 넘지 않는다. 여러 언론 보도가 일관되게 "50%, 최대 3점, 총 17점 상한"이라고 확인했으나, **"50%"를 정확히 어느 시점에 적용하는지(배우자의 원본 가입기간을 절반으로 환산한 뒤 배점표에서 재조회하는 방식인지, 배우자의 산출 점수 자체를 절반으로 나누는 방식인지)는 법령 원문을 대조하지 못해 확인되지 않았다.** 두 방식 모두 언론이 제시한 예시 수치와 모순되지 않아(가산 상한 3점이 어느 경우든 결과를 지배) 어느 쪽이 맞는지 이번 조사로는 가려내지 못했다. → v1은 배우자 통장 합산 입력 자체를 받지 않고(SPEC.md 입력 모델에도 없음), "배우자의 청약통장 가입기간도 합산할 수 있습니다(2024-03-25 이후, 최대 +3점) — 청약홈에서 확인하세요" 고지만 추가할 것을 권고한다. **정확한 산정 방식·근거 조항은 확인 필요.**
3. **미성년자 시절 가입기간 인정 상한**: 미성년자로 가입한 기간 중 2023-12-31 이전 기간은 최대 2년까지만, 2024-01-01 이후 기간과 합산해 총 5년까지만 가입기간으로 인정하는 경과조치가 있는 것으로 확인했다. 신청자가 미성년(만 19세 미만) 시절에 통장을 개설한 경우에만 영향을 준다. → v1은 `subscriptionAccountOpenDate`만으로 개월수를 계산하며 이 상한을 적용하지 않는다. 실제로는 미성년 개설자의 점수가 v1 계산보다 낮게 산정될 수 있음을 고지 문구에 포함할 것을 권고한다. **정확한 조항·경과조치 세부 요건은 확인 필요.**

이 세 특례는 모두 "v1이 실제보다 사용자에게 유리하게(가입기간 특례 미반영은 불리하게, 소형저가 특례 미반영도 불리하게, 배우자합산 미반영도 불리하게) 계산하는 방향"이므로, 사용자에게 손해를 끼치는 과대평가 위험은 낮다 — 다만 SPEC.md Must Have "설명과 정책 고지"가 요구하는 "실제 청약홈 공식 점수와 다를 수 있다"는 고지에 이 구체적 사유들을 포함해야 한다.

## 확인 필요 항목 총정리

1. **별표 1 원문 최종 대조**: 이 문서의 배점표 3종은 2개 이상 독립 2차 출처의 완전 일치로 검증했으나, law.go.kr 원문 이미지와의 1:1 대조는 도구 제약으로 완료하지 못했다. Auditor/QA 단계에서 재확인 권고.
2. **부양가족 인정요건의 정확한 조항 번호**(직계존속 3년 동거·무주택 요건, 미혼자녀 30세 이상 1년 요건의 근거 조문)는 실무 안내 자료로 확인했으나 정확한 조번호까지는 확인하지 못했다.
3. **배우자 청약통장 합산 특례의 정확한 계산 방식**(위 특례 2번) — 산정 방식 자체가 확인되지 않아 v1 미구현 권고.
4. **소형·저가/비아파트 무주택 간주 특례의 세부 조건**(공시가격 산정 시점, 정확한 조항 번호) — 위 특례 1번, v1 미구현 권고.
5. **미성년자 가입기간 인정 상한의 정확한 조항·경과조치 세부** — 위 특례 3번, v1 미구현 권고.
6. **2026-06-15 시행 국토교통부령 제1592호가 별표 1 배점표 자체를 개정했는지 여부** — **미개정으로 판단(2026-09-06 Calculation Auditor 재확인)**. 근거: 이 개정의 개정이유 목록을 직접 확인한 결과 "신생아 가구 특별공급 유형 신설", "지역균형발전 특별공급 추가", "해양수산부 이전기관 종사자 주택공급 조건 완화", "기관추천 특별공급위원회 설치 근거 마련" 4가지뿐이었고, 전부 특별공급(제19조 계열) 관련 개정이었다 — 별표 1(가점제) 언급은 어디에도 없었다. **다만 개정문 전체를 문장 단위로 대조하지는 못했으므로 100% 확정은 아니다.** 다음 재검토 시에도 이 결론이 유지되는지 우선 확인할 것.
7. **이혼·재혼 등 복잡한 혼인이력이 무주택기간 기산일에 미치는 영향** — v1 입력 모델(단일 `isMarried`/`marriageDate`)로는 표현할 수 없어 범위 밖으로 남긴다.
8. **배우자가 부양가족으로 인정될 때 "배우자의 나머지 세대원"까지 함께 인정되는지 여부** — 일부 실무 안내에 이런 문구가 있었으나 재현 검증하지 못해 v1은 배우자 본인 1명만 카운트한다.
9. **청약통장 가입기간 각 구간의 정확한 경계 포함 여부(이상 vs 초과)** — 배점표의 "6개월 이상~1년 미만" 등 구간 표기가 별표 1 원문에서도 동일한 경계(이상~미만)인지는 여전히 확인 필요. 2026-09-06 Calculation Auditor가 HUG(khug.or.kr) 페이지를 독립적으로 재확인하는 과정에서, **같은 URL을 다른 프롬프트로 재요청했을 때 서로 다른 결과가 나오는 불안정성**을 발견했고, 그중 한 결과는 "초과~이하"라는 다른 경계 표현을 보였다. 다만 이 결과는 신뢰도가 낮다고 판단해 채택하지 않았다 — 무주택기간 표에서 이미 확인된 "이상~미만" 패턴과의 일관성, 그리고 아래 검증 예제 9-B(정확히 6개월=2점)가 이미 Golden Test로 고정되어 있다는 점을 근거로 현재 구현이 맞을 개연성이 높다고 판단한다. **현재 배점표·Golden Test 값은 변경하지 않는다 — 별표 1 원문 확보 시 최우선 대조 대상으로만 남긴다.**

## 검증 예제 (Golden Test 후보, 14개)

> 라벨링: 아래 예제는 "배점표 (검증 결과)" 절의 표를 공식대로 그대로 대입해 Formula Analyst가 직접 산출한 값이다. 위 "이 문서의 신뢰도에 관한 사전 고지"에서 밝힌 대로, 이 표 자체는 2개 이상 독립 2차 출처(HUG 주택도시보증공사 khug.or.kr, 호반써밋 hobansummit.co.kr)의 완전 일치로 검증했으나 law.go.kr 원문 1:1 대조는 완료하지 못했다 — 각 예제의 "출처"란에 이 한계를 반복 표기하지 않고 이 안내로 갈음한다.

### 예제 1 — 무주택기간: 만 30세 생일 당일(경과 0일), 미혼 아님 가정 없이 순수 경계
- Input: `baseDate=2026-09-06`, `birthDate=1996-09-06`(오늘 정확히 만 30세), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `homelessStartDate = 2026-09-06`(30세 생일 당일), `homelessEligible=true`, `homelessPeriodYears = calendarFullYearsBetweenUtc(2026-09-06, 2026-09-06) = 0` → "1년 미만" 구간
- **Expected: `homelessPeriodScore = 2`** (0점이 아님 — 산정이 "시작된" 첫날이므로 최저 구간 2점)
- 출처: 배점표 최하단 행("1년 미만=2점") 직접 대입.

### 예제 2 — 무주택기간: 만 30세 생일 하루 전(미혼)
- Input: `baseDate=2026-09-06`, `birthDate=1996-09-07`(생일이 내일, 아직 29세), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `ageStartDate=2026-09-07 > baseDate` → 아직 산정 미개시
- **Expected: `homelessPeriodScore = 0`**, `warnings`에 "만 30세 미만 미혼" 사유 포함
- 출처: 무주택기간 기산일 규칙("만 30세 미만 미혼은 0점") 직접 적용.

### 예제 3 — 무주택기간: 만 1년 정확 경계(30세 생일로부터 정확히 1년)
- Input: `baseDate=2026-09-06`, `birthDate=1995-09-06`(오늘 만 31세), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `homelessStartDate = 2025-09-06`(30세 생일), `homelessPeriodYears = calendarFullYearsBetweenUtc(2025-09-06, 2026-09-06) = 1`(정확히 1년 경과) → "1년 이상 2년 미만" 구간
- **Expected: `homelessPeriodScore = 4`**
- 출처: 배점표 2행("1년 이상~2년 미만=4점") 직접 대입. 예제 1(2점)과 짝을 이루는 "만 1년" 경계 테스트.

### 예제 4 — 무주택기간: 만 1년 하루 전(경계 바로 아래, 비윤년 가정)
- Input: `baseDate=2026-09-05`, `birthDate=1995-09-06`(생일이 하루 뒤라 아직 30세 도달 후 364일), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `homelessStartDate=2025-09-06`, `homelessPeriodYears = calendarFullYearsBetweenUtc(2025-09-06, 2026-09-05) = 0`(월/일 비교상 아직 1년 미도달) → "1년 미만" 구간
- **Expected: `homelessPeriodScore = 2`**
- 출처: 배점표 1행. 예제 3과 하루 차이로 점수가 갈리는 경계 테스트(구현 오류 시 가장 흔히 틀리는 지점).

### 예제 5 — 무주택기간: 15년 이상 상한 캡 이전 구간(6년대) 검증
- Input: `baseDate=2026-09-06`, `birthDate=1990-01-01`(만 36세), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `homelessStartDate=2020-01-01`(30세 생일), `homelessPeriodYears = calendarFullYearsBetweenUtc(2020-01-01, 2026-09-06) = 6` → "6년 이상 7년 미만" 구간
- **Expected: `homelessPeriodScore = 14`**
- 출처: 배점표 7행("6~7년=14점") 직접 대입. (상한 캡 자체는 예제 6에서 별도 검증)

### 예제 6 — 무주택기간: 20년 경과해도 32점 캡(상한 불변식)
- Input: `baseDate=2026-09-06`, `birthDate=1976-09-06`(만 50세, 30세부터 정확히 20년 경과), `isMarried=false`, `housingStatus='never_owned'`
- 계산: `homelessPeriodYears = 20` → `min(32, 2*(20+1)) = min(32, 42) = 32`
- **Expected: `homelessPeriodScore = 32`**(46이 아니라 32로 캡되는지 확인 — 상한 불변식 테스트)
- 출처: 배점표 최상단 행("15년 이상=32점, 상한") 직접 대입.

### 예제 7 — 부양가족수: 0명(기본 배점)
- Input: `hasQualifyingSpouseInHousehold=false`, `qualifyingAscendantCount=0`, `qualifyingDescendantCount=0`
- **Expected: `dependentCount=0`, `dependentScore=5`**(0점이 아님)
- 출처: 배점표 1행("0명=5점") 직접 대입. 흔한 구현 오류(0명→0점으로 착각) 방지용 필수 케이스.

### 예제 8 — 부양가족수: 6명 이상 상한 캡(7명 입력해도 동일)
- Input(A): `hasQualifyingSpouseInHousehold=true`(1) + `qualifyingAscendantCount=2` + `qualifyingDescendantCount=3` = 6명
- Input(B): 위와 동일하되 `qualifyingDescendantCount=4` = 7명
- **Expected: 두 경우 모두 `dependentScore=35`**(6명과 7명이 동일 점수임을 확인 — 상한 불변식)
- 출처: 배점표 마지막 행("6명 이상=35점") 직접 대입.

### 예제 9 — 청약통장 가입기간: 6개월 미만/정확 6개월 경계
- Input(A): `baseDate=2026-09-06`, `subscriptionAccountOpenDate=2026-03-07`(6개월 미만), `hasSubscriptionAccount=true`
- Input(B): `baseDate=2026-09-06`, `subscriptionAccountOpenDate=2026-03-06`(정확히 6개월), `hasSubscriptionAccount=true`
- 계산: (A) `subscriptionMonths = calendarFullMonthsBetweenUtc(2026-03-07, 2026-09-06) = 5`(9-3=6, 종료일(day 6) < 시작일(day 7) → -1 → 5) → "6개월 미만" 구간, (B) `subscriptionMonths = calendarFullMonthsBetweenUtc(2026-03-06, 2026-09-06) = 6`(day 6=6, 차감 없음) → "6개월 이상 1년 미만" 구간
- **Expected: (A) `subscriptionPeriodScore=1`, (B) `subscriptionPeriodScore=2`**
- 출처: 배점표 1·2행 직접 대입. 실제 가입기간 배점표 중 유일하게 "연" 단위가 아닌 "6개월" 세부 구간이 있는 경계라 별도 검증 필요. (B)는 위 "확인 필요 항목" 9번의 "이상 vs 초과" 경계와도 직결되는 케이스다 — 현재 값(2점, "이상" 포함)을 그대로 고정한다.

### 예제 10 — 청약통장 가입기간: 만 1년 정확 경계(연 단위 전환점)
- Input: `baseDate=2026-09-06`, `subscriptionAccountOpenDate=2025-09-06`(정확히 12개월)
- 계산: `subscriptionMonths = calendarFullMonthsBetweenUtc(2025-09-06, 2026-09-06) = 12`(day 6=6, 차감 없음) → `floor(12/12)+2 = 1+2 = 3`
- **Expected: `subscriptionPeriodScore=3`**
- 출처: 배점표 3행("1년 이상 2년 미만=3점") 직접 대입.

### 예제 11 — 청약통장 가입기간: 15년 이상 상한 캡
- Input: `baseDate=2026-09-06`, `subscriptionAccountOpenDate=2006-01-01`
- 계산: `subscriptionMonths = calendarFullMonthsBetweenUtc(2006-01-01, 2026-09-06) = (2026-2006)*12 + (9-1) = 248`(day 6 >= day 1이므로 차감 없음, 정확히 248개월) → `floor(248/12)+2 = 20+2 = 22` → `min(17, 22) = 17`
- **Expected: `subscriptionPeriodScore=17`**
- 출처: 배점표 마지막 행("15년 이상=17점, 상한") 직접 대입. 22라는 중간값이 캡되어 17이 되는지가 검증 포인트(캡 로직 누락 시 22 또는 다른 오답이 나올 수 있음).

### 예제 12 — 종합 시나리오(세 항목 합산 + 자연스러운 실사용 케이스)
- Input: `baseDate=2026-09-06`, `birthDate=1991-06-15`(만 35세), `isMarried=true`, `marriageDate=2019-05-01`(30세 이전 혼인 → 혼인신고일부터 기산, 30세 생일은 2021-06-15로 혼인신고일보다 늦음), `housingStatus='never_owned'`, `hasQualifyingSpouseInHousehold=true`, `qualifyingAscendantCount=1`, `qualifyingDescendantCount=1`, `subscriptionAccountOpenDate=2016-01-10`
- 계산:
  - 무주택기간: `homelessStartDate=2019-05-01`(혼인신고일), `homelessPeriodYears = calendarFullYearsBetweenUtc(2019-05-01, 2026-09-06) = 7`(2026-2019=7, (9,6)>(5,1)이라 차감 없음) → "7년 이상 8년 미만" 구간 → **16점**
  - 부양가족수: `dependentCount = 1(배우자)+1(직계존속)+1(직계비속) = 3명` → **20점**
  - 청약통장: `subscriptionMonths = calendarFullMonthsBetweenUtc(2016-01-10, 2026-09-06)`. `(2026-2016)*12+(9-1) = 128`, 종료일 day(6) < 시작일 day(10) → `-1` → **127개월** → `floor(127/12)+2 = 10+2 = 12` → **12점**
  - 총점: `16 + 20 + 12 = 48점`
- **Expected: `totalScore = 48`**(내역: 무주택기간 16 + 부양가족 20 + 가입기간 12)
- 출처: 세 배점표를 각각 직접 대입해 합산한 자체 재현 케이스(공식 계산기 실행 대조는 아님 — 위 "이 문서의 신뢰도에 관한 사전 고지" 참고). Builder 구현 후 이 예제와 정확히 일치해야 하며, 불일치 시 날짜 계산 헬퍼(`calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`)부터 재검토할 것.

### 예제 13 — 무주택기간: 2월 29일생, 30세가 되는 해가 평년(윤년 clamp 규칙, 신규)
- Input(A, clamp 경계 하루 전): `baseDate=2026-02-27`, `birthDate=1996-02-29`(1996년은 윤년), `isMarried=false`, `housingStatus='never_owned'`
- Input(B, clamp된 정확한 날): `baseDate=2026-02-28`, 나머지 동일
- 계산: `birthDate.year+30 = 2026`(평년, 2월 29일 없음) → 공식 1단계 clamp 규칙에 따라 `ageStartDate = 2026-02-28`(3월 1일로 넘어가지 않음). `homelessStartCandidate = 2026-02-28`(미혼이므로 그대로).
  - (A) `homelessEligible = (2026-02-27 >= 2026-02-28)` → **false** → `homelessPeriodScore = 0`, `warnings`에 "만 30세 미만 미혼" 포함
  - (B) `homelessEligible = (2026-02-28 >= 2026-02-28)` → **true** → `homelessPeriodYears = calendarFullYearsBetweenUtc(2026-02-28, 2026-02-28) = 0` → "1년 미만" 구간 → **`homelessPeriodScore = 2`**
- **Expected: (A) 0점, (B) 2점.** clamp 규칙이 없으면(`Date.UTC(2026,1,29)`가 JS 표준 정규화로 3월 1일이 되는 버그 상태라면) (B)에서도 `homelessEligible=false`가 되어 0점이 나온다 — Calculation Auditor가 실제 코드 실행으로 확인한 재현 버그(EVALUATION.md "3." 표)와 정확히 같은 경계다.
- 출처: 공식 1단계 clamp 규칙(신규, 민법 제160조제3항) 직접 적용. 이 예제 자체가 이번 보완의 핵심 회귀 테스트 대상이다.

### 예제 14 — 무주택기간: 2월 29일생(다른 출생연도), clamp 규칙의 일반성 확인
- Input(A): `baseDate=2030-02-27`, `birthDate=2000-02-29`(2000년은 400으로 나누어떨어지는 윤년), `isMarried=false`, `housingStatus='never_owned'`
- Input(B): `baseDate=2030-02-28`, 나머지 동일
- 계산: `birthDate.year+30 = 2030`(평년) → `ageStartDate = 2030-02-28`(clamp). (A) `homelessEligible=false` → 0점. (B) `homelessEligible=true`, `homelessPeriodYears=0` → **`homelessPeriodScore=2`**
- **Expected: (A) 0점, (B) 2점.**
- 참고(수학적 사실, 추정 아님): 이 계산기는 항상 "생일+30년"만 계산하고, 30은 4의 배수가 아닌 반면 2월 29일 출생연도는 반드시 4의 배수여야 한다 — 따라서 "출생연도+30"은 결코 4의 배수가 될 수 없고, 2월 29일생의 "30세가 되는 해"는 예외 없이 항상 평년이다. 즉 이 계산기 안에서 "2월 29일생이 윤년에 30세가 되는" 대조 사례는 존재할 수 없다(불확실해서 "확인 필요"로 남기는 것이 아니라 수학적으로 확정된 사실). 예제 13·14는 서로 다른 두 출생연도(1996년 통상 윤년, 2000년 400배수 윤년)로 clamp 규칙이 일관되게 적용됨을 보여주는 것으로 "평년/윤년 경계 케이스" 요구를 충족한다.
- 출처: 공식 1단계 clamp 규칙(신규) 직접 적용, 서로 다른 출생연도로 일반성 재확인.

> 위 14개 중 예제 1·6·7·8·9·11·13·14는 "0점 아님/상한 캡/윤년 2월 29일 clamp 경계" 등 구현 오류가 가장 잦은 경계값을 명시적으로 겨냥한다. docs/CALCULATOR_RULES.md의 "복잡한 계산기는 10개 이상" 기준을 14개로 충족한다(2026-09-06 Calculation Auditor 지적 반영, 예제 13·14 신규 추가).

## 기준 / 출처 (정책형 계산기 필수)

```
기준 연도: 2026
기준일: 2026-09-06 (이 FORMULA.md 작성 시점 기준 현행 「주택공급에 관한 규칙」 적용)
공식 출처:
  - 「주택공급에 관한 규칙」(국토교통부령) 별표 1 — 가점제 산정기준표(무주택기간·부양가족수·청약통장 가입기간 배점표)
    - 원문 이미지/PDF 직접 대조는 여전히 미완료(위 "신뢰도 사전 고지" 참고). 2차 교차검증: HUG 주택도시보증공사(khug.or.kr, 공공기관) 「주택청약도우미」(Formula Analyst 1차 확인 + 2026-09-06 Calculation Auditor가 동일 페이지를 독립적으로 재접속해 무주택기간·부양가족수 표 전 구간 재확인, 완전 일치), 호반써밋(hobansummit.co.kr) 「청약가점안내」, 정부24(gov.kr) 「주택 청약 가점제도」 서비스 안내(총점 구성 확인)
    - 현행 규칙 버전: 국토교통부령 제1592호, 2026-06-15 시행(WebSearch 교차확인). 별표 1 자체 개정 여부: **미개정으로 판단**(2026-09-06 Calculation Auditor 재확인 — 근거: 이 개정의 개정이유 목록에 "신생아 가구 특별공급 유형 신설·지역균형발전 특별공급 추가·해양수산부 이전기관 종사자 주택공급 조건 완화·기관추천 특별공급위원회 설치 근거 마련" 4가지뿐이고 전부 특별공급[제19조 계열] 관련이며 별표 1 언급 없음. 개정문 전체를 문장 단위로 대조하지는 못해 100% 확정은 아님. 위 "확인 필요 항목" 6번 참고)
    - 청약통장 가입기간 각 구간의 경계 표현("이상~미만" vs "초과~이하")은 여전히 확인 필요(위 "확인 필요 항목" 9번 참고 — 2026-09-06 Auditor가 HUG 페이지 재확인 중 같은 URL이 프롬프트에 따라 다른 결과를 반환하는 불안정성을 발견했고, 그중 한 결과는 "초과~이하" 표현을 보였으나 신뢰도가 낮아 채택하지 않음)
  - 무주택기간 기산일(만 30세/혼인신고일): 「주택공급에 관한 규칙」 제27조로 추정 인용(정확한 조번호는 여전히 확인 필요). **2026-09-06 Calculation Auditor가 law.go.kr 원문(2015-02-27 시행, 국토교통부령 제186호 판본 — daedeok.go.kr 대덕구청 공고문 PDF 경로로 확보, WebFetch 바이너리 요약은 실패했으나 Read 도구로 PDF 텍스트를 직접 추출해 성공) 제11조제2항을 확인**: "무주택기간은 ... 주택공급신청자의 무주택기간은 30세가 되는 날(주택공급신청자가 30세가 되기 전에 혼인한 경우에는 ... 혼인신고일로 등재된 날)부터 계속하여 무주택인 기간으로 하되, ... 그 주택을 처분한 후 무주택자가 된 날(두 차례 이상 주택을 소유한 사실이 있는 경우에는 최근에 무주택자가 된 날을 말한다)부터 무주택기간을 산정한다"는 문구가 이 FORMULA.md의 공식 1~3단계(30세/혼인신고일 기산, 처분일 재기산, 최근 처분일 기준)와 **표현 수준까지 정확히 일치**함을 확인해 이 규칙의 신뢰도가 상향됐다. 다만 확보한 판본은 2015년 시행본으로 조번호가 "제11조"이고, 이 FORMULA.md·casenote.kr 등은 현행판을 "제27조"로 추정 인용해왔다 — 여러 차례 개정으로 조번호 자체가 밀렸을 가능성이 있어 **조번호는 여전히 확인 필요**로 유지한다(조문 "내용"의 신뢰도만 상향되었을 뿐, 조번호 확정은 별도 사안). WebSearch 다수 교차확인.
  - 무주택기간 기산일의 윤년 2월 29일 clamp 규칙(신규, 위 "공식" 1단계): 민법 제160조제3항("월 또는 연으로 정한 경우에 최종의 월에 해당일이 없는 때에는 그 월의 말일로 기간이 만료한다") — 나이 계산에 이 조항이 준용된다는 것은 행정기본법 제7조의2·민법 제158조를 통해 일반적으로 인정되는 해석. 이 프로젝트 내 age-calculator(`tasks/age-calculator/FORMULA.md` "anniversary" 절, `src/calculators/age-calculator/date-utils.ts`의 `anniversaryInYear`)가 법제처 공식 예시로 이미 검증한 동일 clamp 규칙을 참고해, 2026-09-06 Calculation Auditor의 지적(EVALUATION.md "3.")을 받아 Formula Analyst가 이 계산기에도 명시적으로 채택.
  - 부양가족 인정요건(직계존속 3년+무주택, 미혼자녀 30세 이상 1년): 실무 안내(부동산114, 지블(Zibble) 등) 교차확인 — 정확한 조번호 확인 필요
  - 소형·저가주택 무주택 간주 특례: 「주택공급에 관한 규칙」 제53조(2023-11-10 시행 개정) — 서울시 공지(news.seoul.go.kr), 리나로 블로그 등 교차확인
  - 비아파트 무주택 인정 확대: 2024-12-18 시행 개정 — 세계일보/뉴시스/글로벌이코노믹 등 다수 언론 교차확인
  - 배우자 청약통장 합산 특례: 2024-03-25 시행 개정 — 세계일보/한국경제/mtn 등 다수 언론 교차확인(단, 정확한 산정 방식은 확인 필요)
마지막 검토: 2026-09-06
다음 재검토 예정일: 2027-01-01 (매년 최저임금·사회보험 데이터 재검토 주기와 통일. 단, 「주택공급에 관한 규칙」은 연 1회 이상 수시 개정되는 경향이 있으므로(2024-03, 2024-12, 2025-03, 2025-04, 2026-06 등 최근 2년간 5회 이상 개정 확인), 그 사이라도 국토교통부 보도자료·법제처 개정이력에 "가점제"·"별표 1" 관련 개정이 확인되면 즉시 재검토할 것을 권고)
```

## 정책 데이터 파일 스키마 제안 (초안 — 실제 JSON 생성은 Architect/Builder 책임)

docs/CALCULATOR_RULES.md의 `/src/data/rates-{year}.json` 규칙과 필드명(`value`, `unit`, `source`, `lastVerified`, `nextReviewDue`)을 그대로 따른다. four-major-insurance의 `socialInsurance` 네임스페이스 패턴을 참고해 `housingSubscriptionScore` 네임스페이스로 분리할 것을 권고한다(배점표를 계산 코드에 하드코딩하지 않는다 — SPEC.md Must Have "기준일자 표시" 요구사항).

```jsonc
{
  "housingSubscriptionScore": {
    "homelessPeriodTable": {
      "note": "무주택기간 배점표. 코드에서는 min(32, 2*(years+1)) 공식으로 산출하되, 이 표는 근거 문서화 및 회귀 테스트용으로 병기.",
      "source": { "law": "주택공급에 관한 규칙", "article": "별표 1 (정확한 호 확인 필요)", "effectiveDate": "확인 필요", "url": "https://www.law.go.kr" },
      "lastVerified": "2026-09-06",
      "nextReviewDue": "2027-01-01",
      "maxScore": 32
    },
    "dependentCountTable": {
      "note": "부양가족수 배점표. 코드에서는 5 + 5*min(count,6) 공식으로 산출.",
      "source": { "law": "주택공급에 관한 규칙", "article": "별표 1 (정확한 호 확인 필요)", "effectiveDate": "확인 필요", "url": "https://www.law.go.kr" },
      "lastVerified": "2026-09-06",
      "nextReviewDue": "2027-01-01",
      "maxScore": 35
    },
    "subscriptionPeriodTable": {
      "note": "청약통장 가입기간 배점표.",
      "source": { "law": "주택공급에 관한 규칙", "article": "별표 1 (정확한 호 확인 필요)", "effectiveDate": "확인 필요", "url": "https://www.law.go.kr" },
      "lastVerified": "2026-09-06",
      "nextReviewDue": "2027-01-01",
      "maxScore": 17
    },
    "totalScoreMax": { "value": 84, "unit": "점", "lastVerified": "2026-09-06", "nextReviewDue": "2027-01-01" }
  }
}
```
