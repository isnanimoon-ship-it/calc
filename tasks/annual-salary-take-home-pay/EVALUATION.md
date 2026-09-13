# EVALUATION: 연봉 실수령액 계산기

## Builder 구현 완료

Builder가 SPEC.md · FORMULA.md · ARCHITECTURE.md에 따라 구현을 완료했다. 아래는 구현
사실과 테스트 실행 결과 기록이며, 최종 PASS/FAIL 판정이 아니다 — Calculation Auditor,
UX/UI Critic, QA가 각자 독립적으로 재검증해야 한다.

### 구현 파일
- `src/lib/social-insurance.ts`, `src/lib/social-insurance.test.ts` (신규 — 4대 보험 근로자
  부담분 공용 계산, `four-major-insurance/logic.ts`에서 이동)
- `src/calculators/four-major-insurance/logic.ts` (리팩터링 — 공개 시그니처/반환값 불변,
  내부에서 공용 함수 호출하도록 변경)
- `src/calculators/annual-salary-take-home-pay/policy.ts`
- `src/calculators/annual-salary-take-home-pay/withholding-table.ts`,
  `withholding-table.test.ts`
- `src/calculators/annual-salary-take-home-pay/logic.ts`, `logic.test.ts`
- `src/calculators/annual-salary-take-home-pay/validation.ts`, `validation.test.ts`
- `src/calculators/annual-salary-take-home-pay/formatting.ts`, `formatting.test.ts`
- `src/calculators/annual-salary-take-home-pay/content.ts`
- `src/calculators/annual-salary-take-home-pay/ui.tsx`, `ui.test.tsx`
- `src/calculators/registry.ts` (slug 등록, status: draft)
- `src/calculators/calculator-components.ts` (ui 연결)
- `app/calculators/[slug]/page.tsx` (FAQ SEO 항목 연결, 기존 관례 그대로)

### 테스트 실행 결과
- `npx vitest run --no-file-parallelism` (전체 스위트): **53개 파일, 536개 테스트 전부 통과**
- `npx vitest run src/calculators/four-major-insurance --no-file-parallelist`(회귀 확인):
  **3개 파일, 26개 테스트 전부 통과** — 리팩터링 전후로 기존 계산 결과가 1원도 달라지지
  않았음을 확인했다.
- `npx tsc --noEmit`: 오류 없음
- `npm run build`: 성공

### FORMULA.md Golden Test 12개 반영 현황
`logic.test.ts`에 FORMULA.md "검증 예제" 1~12를 그대로 옮겼다. 예제 12는 FORMULA.md가
"확인 필요"로 명시한 1억원 초과 산식의 원 단위 절사 미확정 사례이므로, 테스트에도 "확인
필요 — Calculation Auditor 실측 대조 후 값이 바뀔 수 있음" 주석을 남겼다.

### SPEC/FORMULA/ARCHITECTURE와 다르게 판단해야 했던 부분 (Calculation Auditor 확인 요청)

**ARCHITECTURE.md "3. policy.ts 스키마 초안"의 `highIncomeFormula.brackets` 단위 변환
오류를 정정했다.** ARCHITECTURE.md 초안은 FORMULA.md "3-4" 표의 "월급여액(천원)" 구간
경계값(10,000/14,000/28,000/30,000/45,000/87,000)을 원 단위로 옮기며 `minWon: 100_000_000`
등 **× 10,000**으로 환산했다(천원을 만원으로 착각한 것으로 보인다). 그러나 올바른 환산은
**× 1,000**이다(예: 10,000천원 = 10,000,000원). 근거:
- `src/data/withholding-tax-table-2026.json`의 `range.maxWon`이 10,000,000이다(오케스트레이터가
  이미 검증한 신뢰 데이터).
- FORMULA.md Golden Test 10(월급여 12,000,000원)의 "초과금액" 계산 자체가
  `12,000,000 - 10,000,000 = 2,000,000`으로 10,000,000원을 직접 사용한다.
- ARCHITECTURE.md 초안의 `minWon: 100_000_000`을 그대로 구현하면 Golden Test 10·12(월급여
  1,000만원대)가 어떤 구간에도 걸리지 않아 계산이 깨진다.

Builder는 `policy.ts`의 `brackets` 배열 구조(계수·가산액 등 공식 자체)는 그대로 두고
`minWon`/`maxWon` 값만 FORMULA.md 원문 기준으로 정정했다(10_000_000 / 14_000_000 /
28_000_000 / 30_000_000 / 45_000_000 / 87_000_000). `policy.ts`와 `logic.ts` 상단에 이
근거를 주석으로 남겼다. 정정하지 않았다면 Golden Test 10·12가 실패했을 것이므로, 이는
FORMULA.md의 계산 공식을 임의로 바꾼 것이 아니라 ARCHITECTURE.md 스키마 초안의 단위 변환
오기를 FORMULA.md 원문에 맞춰 바로잡은 것이다.

부수적으로, FORMULA.md·ARCHITECTURE.md 본문이 이 구간을 반복해서 "1억원 초과"라고
표기한 것도 같은 착오로 보인다(10,000천원 = 1,000만원이지 1억원이 아니다). 계산값 자체는
이미 정정했으니, 문서 표기("1억원" → "1,000만원" 또는 "10,000천원")를 Formula
Analyst/Calculation Auditor가 함께 정정할 것을 권고한다.

이 외에 FORMULA.md가 "확인 필요"로 남긴 항목(11명 초과 산식 음수 처리, 1억원 초과 산식
원 단위 절사 단위, 자녀 나이 판정 시점 등)은 FORMULA.md의 잠정안을 그대로 구현했으며
스스로 확정하지 않았다.

## Calculation Auditor

### 0. 검증 방법 요약
- `logic.ts`/`policy.ts`/`withholding-table.ts`/`src/lib/social-insurance.ts`/`types.ts`를
  전부 직접 읽고 FORMULA.md "계산 순서" 1~9단계와 1:1 대조했다.
- Golden Test 1·2·4·10·12를 손계산(정수 분수 그대로, 중간 반올림 없이)으로 독립 재현해
  코드 결과와 대조했다(요구된 "최소 3개"를 초과 달성).
- `four-major-insurance` 리팩터링 회귀 확인: `src/lib/social-insurance.ts`의 산식을
  `four-major-insurance/logic.ts`(리팩터링 후 코드)와 대조하고, 장기요양보험 유도식
  (`employeeHealth × longTermCareRate.numerator × totalRate.denominator / (...)`)이 대수적으로
  FORMULA.md의 `employeeHealth × 9,448 / 71,900`과 정확히 동일함을 직접 약분해 증명했다
  (`9448×10000/(1000000×719) = 9448/71900`). 전체 회귀 테스트(4대 보험 26개 포함 536개)도
  재실행해 통과를 확인했다.
- **FORMULA.md ↔ 1차 법령 원문 재검증**: FORMULA.md가 인용한 국가법령정보센터 URL
  (`flSeq=164357181`)과 오케스트레이터의 검색으로 새로 찾은 동일 문서의 다른 URL
  (`flSeq=163623339`, 둘 다 "소득세법 시행령 [별표 2] <개정 2026. 2. 27.>")을 WebFetch로
  각각 내려받아 `pdftotext -layout`으로 텍스트를 추출했다. 두 PDF는 바이트 단위로 완전히
  동일했다(같은 원문의 서로 다른 다운로드 경로임을 확인) — FORMULA.md가 실제 1차 법령
  원문을 근거로 삼았다는 주장이 조작이 아님을 확인했다.
- 추출한 원문 텍스트에서 세액표 셀 값을 정규식으로 자동 파싱해
  `src/data/withholding-tax-table-2026.json`의 646행 중 620행을 자동 전수 대조했다
  (완전 일치, 0건 불일치). 자동 파싱에 실패한 나머지 26행(2,550,000~2,800,000원 구간,
  PDF 레이아웃상 "-" 기호가 인접 셀과 붙어 렌더링되어 정규식이 걸러낸 것)은 원문 라인을
  육안으로 직접 대조해 모두 일치함을 확인했다 — 사실상 표 전체(646행) 검증.
- 자녀세액공제 금액(20,830/45,830/33,330), 11명 초과 산식, 1,000만원 초과 구간 6개 계수·
  가산액(25,000/1,397,000/6,610,600/7,394,600/13,394,600/31,034,600)과 가족수별 "10,000천원
  세액" 고정값(1,507,400 등 11개)을 원문에서 직접 재확인했다 — 모두 FORMULA.md·policy.ts와
  정확히 일치했다.
- WebSearch로 data.go.kr 2026년판 데이터셋 ID를 추가로 찾으려 시도했으나(FORMULA.md
  "확인 필요" 5번) 확정 ID를 찾지 못했다 — 그대로 "확인 필요"로 남긴다. 이 항목은 1차
  출처(법령 원문)를 이미 직접 대조했으므로 결론에 영향을 주지 않는 보조 확인 사항이다.

### 1. 구현 ↔ FORMULA.md 일치 여부

**전반적으로 일치한다.** `logic.ts`의 계산 순서(월 환산 → 4대 보험 → 세액표/1,000만원
초과 산식 분기 → 11명 초과 분기 → 자녀세액공제 → 지방소득세 → 합계)가 FORMULA.md
"계산 순서" 1~9단계와 정확히 대응한다. `src/lib/social-insurance.ts`는
`four-major-insurance`가 이미 검증한 산식을 그대로 재사용하며, 손계산 재현 결과 예제
1·2·10의 국민연금/건강보험/장기요양보험/고용보험 금액이 전부 1원도 틀리지 않고 일치했다.
Golden Test 12개는 조작 없이 FORMULA.md 값 그대로 옮겨졌다(예제 10·12 포함, 손계산으로도
재확인).

Builder가 ARCHITECTURE.md 초안의 단위 변환 오류(× 10,000 → × 1,000)를 스스로 발견해
정정한 판단은 **타당하다**. FORMULA.md 원문("10,000천원")과 실제 1차 법령 원문(아래 재확인)
모두 이 구간이 "10,000,000원"임을 명확히 뒷받침하며, ARCHITECTURE.md 초안대로 구현했다면
Golden Test 10·12가 전부 실패했을 것이다. FORMULA.md 계산 공식 자체를 바꾼 것이 아니라
ARCHITECTURE.md 스키마 초안의 명백한 오기를 FORMULA.md 원문에 맞게 바로잡은 것이므로
Builder FAIL 사유가 아니다.

**다만 아래 2건은 FORMULA.md·ARCHITECTURE.md와 무관하게 구현 자체에서 발견한 문제다
(신규 발견, Builder의 자체 보고에는 없었음).**

#### 이슈 A (Critical/High 경계 — High로 분류): 1,000만원 경계값에서 세액 과다 계산

`taxableMonthlyPay`가 **정확히** `WITHHOLDING_TABLE_RANGE.maxWon`(10,000,000원)과 같을 때
근로소득세가 실제보다 25,000원(가족 수 무관, 지방소득세까지 포함하면 27,500원) 더
많이 계산된다.

**재현**: `annualSalary = 120,000,000`, `monthlyNonTaxablePay = 0`,
`dependentFamilyCount = 1` → `taxableMonthlyPay = 10,000,000`. 실제로 코드를 실행해
확인한 결과:
```
taxableMonthlyPay = 10,000,000
incomeTaxSource   = "highIncomeFormula"
incomeTax         = 1,532,400   ← 실제 계산 결과
```
바로 아래 경계(9,999,999원)와 바로 위 경계(10,000,001원)도 함께 확인했다:
```
taxableMonthlyPay = 9,999,999  → incomeTaxSource="table",             incomeTax=1,503,990
taxableMonthlyPay = 10,000,000 → incomeTaxSource="highIncomeFormula",  incomeTax=1,532,400  ← 문제 지점
taxableMonthlyPay = 10,000,001 → incomeTaxSource="highIncomeFormula",  incomeTax=1,532,400
```

**원인**: `logic.ts`의 `isHighIncome = taxableMonthlyPay >= WITHHOLDING_TABLE_RANGE.maxWon`이
`>=`(이상)를 쓴다. 그런데 FORMULA.md "계산 순서" 5번은 "1억원(=1,000만원) **이하**면
3-1 표, **초과**면 3-4 산식"이라고 명시했다 — 즉 정확히 10,000,000원인 지점은 "표"
쪽에 속해야 한다. 실제 1차 법령 원문에도 이 지점은 표의 마지막 값으로 **별도로 명시된
고정값**이다(가족 1명 기준 1,507,400원 — 아래 원문 대조 참고). 반면 `highIncomeFormulaTax`는
이 지점을 "1,000만원 초과 1,400만원 이하" 구간 공식에 대입해 `초과금액=0`임에도
`+25,000`(구간별 가산액)을 그대로 더해버려 `1,507,400 + 0 + 25,000 = 1,532,400`을
반환한다. 즉 **정확히 그 경계점에서만 25,000원이 과다 계상**된다(가족 수와 무관 — 가산액
25,000원은 구간 공통 상수이고 가족별로 다른 것은 `base` 값뿐이므로, 가족 2~11명 모두 동일한
+25,000원 오차가 발생한다).

**이 오차가 우연이 아님을 원문으로 직접 검증**: 1차 법령 원문(PDF, 아래 "재검증 방법"
참고)을 `pdftotext`로 파싱한 결과 다음을 확인했다.
```
9,980  10,000  1,503,990 ...(가족1)   ← "9,980~10,000 미만" 구간 표 값
10,000          1,507,400 ...(가족1)   ← "정확히 10,000천원"일 때의 고정값(원문에 별도 명시)
10,000 초과 14,000 이하: (10,000천원 세액) + (초과금액×98%×35%) + (25,000)  ← 3-4 산식 원문
```
공식의 "+25,000"은 다음 구간(1,400만원)과의 경계에서 값이 매끄럽게 이어지도록 보정하는
상수다(직접 검산: `taxableMonthlyPay=14,000,000`에서 1,000만원 초과 산식과 1,400만원
초과 산식이 둘 다 정확히 2,904,400원으로 일치 — 이 상수는 "다음 구간과의 연속성"을 위해
캘리브레이션된 것이지 "1,000만원 지점 자체"를 위한 것이 아니다). 따라서 `초과금액=0`인
정확히 1,000만원 지점에 이 공식을 적용하면 원문이 명시한 고정값(1,507,400원)과
어긋난다. `policy.ts`는 이 고정값을 `baseAmountAtTableCeilingByFamilyCount`로 이미
갖고 있으므로, 데이터 추가 없이 `logic.ts`의 분기 조건만 고치면 해결 가능하다
(`taxableMonthlyPay === WITHHOLDING_TABLE_RANGE.maxWon`일 때 `baseAmountAtTableCeilingByFamilyCount`를
그대로 반환하고, `highIncomeFormulaTax`는 `taxableMonthlyPay > maxWon`일 때만 호출).

**등급: High.** "특정 정상 입력에서 잘못된 결과"(docs/EVALUATION.md Issue 등급 정의)에
정확히 해당한다 — 연봉이 정확히 1억 2천만 원(또는 `floor(연봉/12) - 비과세 = 10,000,000`을
만족하는 다른 조합)인 완전히 정상적인 입력에서 세전 월급여 대비 근로소득세가 25,000원,
지방소득세가 2,500원 과다 계산된다. 기존 Golden Test 12개는 이 정확한 경계값을 다루지
않아 발견되지 못했다 — CALCULATOR_RULES.md "Edge Case Test"가 요구하는 "경계 바로 아래/
경계값/경계 바로 위" 3점 검증이 이 지점에서 누락돼 있었다.

이 문제는 FORMULA.md의 공식 자체가 틀린 것이 아니라(FORMULA.md는 "이하/초과"를 정확히
구분해 서술했다), **Builder 구현이 그 경계 조건(`>=` vs `>`)을 놓친 것**이므로
"공식 재검토 요청"이 아니라 **Builder 구현 결함**으로 분류한다.

#### 이슈 B (Low — 문서 표기 정정 요청, Builder FAIL 아님): "1억원" 라벨링 오류

오케스트레이터/Builder가 이미 지적한 대로, FORMULA.md·ARCHITECTURE.md·구현 파일의 주석·
테스트 설명이 "10,000천원 초과"를 반복해서 "1억원 초과"라고 표기한다. **직접 검산 결과
이 표기는 명백히 틀렸다**: `10,000천원 = 10,000 × 1,000원 = 10,000,000원`이며, 이는
"1억원"(100,000,000원)이 아니라 **"1천만원"**(10,000,000원)이다. 1차 법령 원문에서도
이 구간의 단위가 일관되게 "천원"으로 표기돼 있고(예: "14,000천원", "87,000천원"),
10,000천원 = 1,000만원이 맞다.

- **계산값 자체는 이미 올바르다**: `policy.ts`의 `brackets`가 `minWon: 10_000_000` 등
  올바른 원 단위 값을 쓰고 있고, `src/data/withholding-tax-table-2026.json`의
  `range.maxWon`도 10,000,000으로 정확하다. 위 이슈 A를 제외하면 이 부분의 산술 자체는
  정확하다.
- **사용자 화면(UI) 문구에는 영향이 없다**: `content.ts`/`ui.tsx`/`formatting.ts`를
  grep한 결과 "1억원"이라는 표현은 어디에도 등장하지 않는다(`buildHighIncomeFormulaWarning`
  등 사용자 경고 문구는 "간이세액표 조회 구간 상한을 초과해"라고만 표현하고 구체적인
  금액 라벨을 쓰지 않는다). 즉 이 오류는 **내부 문서(FORMULA.md, ARCHITECTURE.md)와
  개발자 대상 주석·테스트 설명에만 남아있고 실제 사용자에게 노출되지 않는다.**
- **등급을 Low로 매기는 이유**: 계산 결과·사용자 화면에 영향이 없고, 오탐 위험도 없다
  (이미 정확한 원 단위 상수를 쓰고 있으므로). 다만 유지보수 시 혼란을 줄 수 있어
  Formula Analyst가 FORMULA.md "3-4" 제목·"정책 데이터 파일 스키마 초안"·
  "출력값"/"예외" 절의 "1억원"을 "1,000만원"(또는 "10,000천원")으로 정정할 것을,
  Architect가 ARCHITECTURE.md "2."·"3." 절의 동일 표기를 정정할 것을 권고한다. 이는
  Builder FAIL이 아니라 **문서 표기 정정 요청**이다(공식 자체의 오류가 아니라 사람이
  읽는 라벨의 오기이므로 "공식 재검토 요청"과도 다르다).

### 2. FORMULA.md ↔ 실제 근거(1차 법령 원문) 일치 여부

**FORMULA.md 자체는 매우 높은 신뢰도로 실제 근거와 일치한다.** 아래는 이번 감사에서
직접 재수행한 1차 출처 재검증 내역이다(모두 이번 세션에서 새로 확인, Builder의 주장을
그대로 신뢰하지 않고 독립 재현).

- **원문 재열람**: FORMULA.md가 인용한 URL과, 오케스트레이터의 웹 검색으로 찾은 같은
  문서의 또 다른 다운로드 URL 두 곳을 각각 WebFetch로 내려받아 `pdftotext -layout`으로
  텍스트를 추출했다. 두 파일은 바이트 단위로 완전히 동일했다 — FORMULA.md가 실제로
  1차 법령 원문(소득세법 시행령 [별표 2] <개정 2026. 2. 27.>)에 접근했다는 주장은 조작이
  아니다.
- **세액표 셀 값 전수 대조**: 추출한 원문 텍스트에서 정규식으로 "구간 최소값 최대값
  가족1~11 세액" 패턴 620행을 자동 파싱해 `withholding-tax-table-2026.json`의 646행과
  대조한 결과 **0건 불일치**. 자동 파싱이 실패한 나머지 26행(2,550,000~2,800,000원 구간,
  PDF 레이아웃에서 "-" 기호 두 개가 붙어 렌더링된 탓에 정규식이 걸러낸 것)도 원문 텍스트를
  직접 읽어 대조한 결과 전부 일치했다. 특히 FORMULA.md Golden Test 1~9·11이 인용한
  구간(770천원대 0원 구간, 1,050/1,060천원 경계, 2,000/3,000/4,000/5,000천원, 9,980천원)을
  포함해 총 9곳 이상을 개별 재확인했다 — SPEC/CALCULATOR_RULES.md가 요구하는 "최소 5곳
  대조"를 크게 초과 달성했다.
- **자녀세액공제**: 원문에 "8세 이상 20세 이하 1명: 20,830 / 2명: 45,830 / 3명 이상:
  45,830 + 2명 초과 1명당 33,330"이 그대로 명시돼 있다 — FORMULA.md·policy.ts와 정확히
  일치.
- **11명 초과 산식**: 원문에 "11명 세액 - (10명 세액 - 11명 세액) × (가족수-11명)" 구조가
  명시돼 있다 — FORMULA.md 3-3과 일치. 다만 결과가 음수일 때의 처리 문구는 원문에서도
  확인하지 못했다 — FORMULA.md의 "확인 필요" 표기가 정확하다(추정으로 채우지 않은 것이
  옳았다).
- **1,000만원 초과 산식(원문 표기는 "10,000천원 초과")**: 6개 구간의 계수·가산액
  (25,000/1,397,000/6,610,600/7,394,600/13,394,600/31,034,600, 세율 98%×35%~45%)과
  구간 경계(10,000/14,000/28,000/30,000/45,000/87,000천원), 가족 수(1~11)별 "10,000천원
  세액" 고정값(1,507,400원 등)을 원문에서 그대로 재확인했다 — FORMULA.md 3-4 표와
  policy.ts의 `highIncomeFormula` 전부 정확히 일치한다. 원 단위 절사 규칙에 대한 명시적
  문구는 이번에도 원문에서 찾지 못했다 — FORMULA.md의 "확인 필요"는 그대로 유효하다.
- **지방소득세율(10%)**: 지방세법 제103조의13 자체는 이번 세션에서 재조사하지 않았다
  (조문 번호와 문언이 잘 알려진 고정 세율이라 FORMULA.md의 인용을 그대로 수용).
- **data.go.kr 2026년판 데이터셋 ID**: WebSearch로 추가 확인을 시도했으나 확정 ID를 찾지
  못했다 — FORMULA.md의 "확인 필요" 상태를 그대로 유지한다(1차 출처를 이미 직접 대조했으므로
  결론에 영향 없음).
- **8~20세 자녀 나이 판정 시점**: 별표 2 원문 자체에는 이 시점을 규정하는 문구가 없었다
  (원문은 세액표 산식만 규정) — FORMULA.md의 "확인 필요"가 타당하다. 이 계산기 범위
  밖의 다른 행정 해석(예규·질의회신)을 추가로 조사하지 않았다.

**결론: FORMULA.md 자체에 대한 "공식 재검토 요청" 사유는 없다.** FORMULA.md가 인용한
수치는 전부 1차 법령 원문과 정확히 일치했고, "확인 필요"로 남긴 항목들도 원문에서 실제로
확인이 불가능함을 재확인했을 뿐(추정치를 넣지 않은 FORMULA.md의 태도가 옳았음을
재확인) FORMULA.md의 오류를 발견하지 못했다. 위 이슈 A(경계값 처리)는 FORMULA.md가 아니라
구현(`logic.ts`의 `>=` 조건)의 문제이고, 이슈 B("1억원" 라벨)는 FORMULA.md/ARCHITECTURE.md의
표기 오류이지만 계산식 자체의 오류가 아니므로 "공식 재검토 요청"이 아니라 "문서 표기
정정 요청"으로 분류한다.

### 3. 발견된 이슈 (등급별)

| 등급 | 이슈 | 위치 | 상태 |
|---|---|---|---|
| **High** | `taxableMonthlyPay`가 정확히 10,000,000원(1,000만원)일 때 근로소득세가 25,000원(지방소득세 2,500원 포함 총 27,500원) 과다 계산됨 — `isHighIncome` 판정이 `>=`을 써서 "이하"(표 조회) 경계를 넘겨버림 | `src/calculators/annual-salary-take-home-pay/logic.ts` (`isHighIncome`, `highIncomeFormulaTax`) | **Builder 재작업 필요** — Optimizer가 `taxableMonthlyPay === WITHHOLDING_TABLE_RANGE.maxWon` 특수 케이스를 `baseAmountAtTableCeilingByFamilyCount`에서 직접 반환하도록 수정하고, 이 경계값(10,000,000원 정확히)을 Golden/Edge Test에 추가 권고 |
| **Low** | FORMULA.md·ARCHITECTURE.md 및 구현 파일 주석·테스트 설명에 남은 "1억원" 표기가 실제로는 "1,000만원"(10,000천원)의 오기 | `tasks/annual-salary-take-home-pay/FORMULA.md`(3-4, 정책 데이터 파일 스키마 초안, 출력값/예외 절), `ARCHITECTURE.md`(2, 3절), `policy.ts`/`logic.ts`/`withholding-table.ts`/`types.ts` 주석, `logic.test.ts`/`formatting.test.ts` 테스트 설명 | **문서 표기 정정 요청** — Formula Analyst/Architect가 문서를, Optimizer가 주석·테스트 설명을 정정 권고(계산값·사용자 화면에는 영향 없음, Builder FAIL 아님) |
| 없음 | 그 외 4대 보험 재사용, 세액표 620+26행 전수 대조, 자녀세액공제, 11명 초과 산식, Golden Test 12개는 전부 원문·손계산과 정확히 일치 | — | 문제 없음 |

### 4. 판정

**판정: FAIL** (Builder 재작업 필요, "공식 재검토 요청" 아님)

- 근거: docs/EVALUATION.md PASS 기준 "Critical 0, High 0"을 위반한다(이슈 A, High 1건).
  이슈 A는 FORMULA.md의 공식이 아니라 `logic.ts`의 경계 조건(`>=` vs `>`) 구현 결함이므로
  Formula Analyst에게 반려하지 않고 Builder/Optimizer에게 재작업을 요청한다.
- 이슈 B는 Low이며 FORMULA.md/ARCHITECTURE.md의 문서 표기 정정 요청 대상이지만, 그 자체로는
  FAIL 사유가 아니다(계산값·사용자 화면에 영향 없음).
- 이슈 A 수정 후에는 다음을 재확인 권고: (1) `taxableMonthlyPay` 정확히 10,000,000원 경계
  Golden/Edge Test 추가 및 통과, (2) 기존 Golden Test 12개 재실행, (3) `four-major-insurance`
  회귀 스위트 재실행. 그 외 항목(4대 보험 재사용, 세액표 데이터, 자녀세액공제, 11명 초과
  산식)은 이번 감사에서 원문·손계산 이중 검증을 마쳤으므로 재검증 불필요.

## Optimizer 수정 (라운드 1)

Calculation Auditor 이슈 A(High, `logic.ts` `isHighIncome`가 `>=`을 써서 정확히
10,000,000원 경계값에서 25,000원 과다 계산)를 수정했다. Formula Analyst가 보강한
`FORMULA.md`(계산 순서 5단계와 3-4가 이제 3가지 경우로 명확히 분리, 검증 예제 13 추가)를
그대로 구현했다. 최종 PASS/FAIL 판정은 하지 않는다 — Calculation Auditor가 재검증한다.

### 수정 파일

- `src/calculators/annual-salary-take-home-pay/logic.ts`
- `src/calculators/annual-salary-take-home-pay/logic.test.ts` (Golden Test 13 추가)

### 무엇을 바꿨는가

1. **`BracketMode` 타입과 `resolveBracketMode` 함수를 신설**해 FORMULA.md "계산 순서" 5단계·
   "3-4"가 명시한 세 가지 경우를 명시적으로 구분했다.
   ```ts
   type BracketMode = "table" | "ceilingFixed" | "formula";

   function resolveBracketMode(taxableMonthlyPay: number): BracketMode {
     if (taxableMonthlyPay > WITHHOLDING_TABLE_RANGE.maxWon) return "formula";
     if (taxableMonthlyPay === WITHHOLDING_TABLE_RANGE.maxWon) return "ceilingFixed";
     return "table";
   }
   ```
2. **`baseIncomeTaxForFamilyKey`가 `isHighIncome: boolean` 대신 `bracketMode: BracketMode`를
   받도록 변경**했다. `bracketMode === "ceilingFixed"`일 때는
   `POLICY.highIncomeFormula.baseAmountAtTableCeilingByFamilyCount[familyCountKey]`를
   **초과분 계산 없이 그대로** 반환하고(`highIncomeFormulaTax`를 호출하지 않음),
   `bracketMode === "formula"`일 때만 기존 `highIncomeFormulaTax`(브래킷 탐색·초과금액
   계산 로직 불변)를 호출한다. `bracketMode === "table"`이면 기존과 동일하게
   `lookupWithholdingTaxRow`를 조회한다.
3. **11명 초과 분기(`tax11`/`tax10` 계산)도 동일한 `bracketMode`를 공유**하도록 바꿔,
   `taxableMonthlyPay`가 정확히 10,000,000원이면서 가족 수가 11명을 초과하는 조합에서도
   같은 버그가 재발하지 않도록 했다.
4. `isBelowTaxableThreshold` 판정을 `!isHighIncome && ...`에서 `bracketMode === "table" &&
   ...`로 바꿨다 — 의미는 동일하다(`bracketMode === "table"`은 이전 `!isHighIncome`,
   즉 `taxableMonthlyPay < maxWon`과 정확히 같은 조건이므로 회귀 없음).
5. `policy.ts`·`highIncomeFormulaTax` 함수 내부(브래킷 탐색·계수·가산액)는 **변경하지
   않았다** — 지시대로 호출부(`logic.ts`)에서 `bracketMode === "formula"`(즉
   `taxableMonthlyPay > maxWon`)일 때만 호출하도록 보장했다. 이 함수가 여전히 `b.minWon`
   비교에 `>=`을 쓰지만, 호출 시점에 이미 `taxableMonthlyPay > 10,000,000`이 보장되므로
   첫 번째 브래킷(`minWon: 10_000_000`)에서 `excessWon = taxableMonthlyPay - 10_000_000`이
   항상 `> 0`이 되어 문제가 없다 — 이 가정이 깨지지 않는지 `resolveBracketMode`의 분기
   순서(`formula` 조건을 `ceilingFixed`보다 먼저 검사)로 확인했다.

### `incomeTaxSource` 판단 근거 — 정확히 경계값을 `"highIncomeFormula"`로 분류한 이유

`IncomeTaxSource` 타입은 `"table" | "highIncomeFormula"` 두 값뿐이며(타입 확장 없이 그대로
사용하라는 지시에 따름), `taxableMonthlyPay === 10,000,000원`(`bracketMode ===
"ceilingFixed"`)인 경우를 다음 근거로 **`"highIncomeFormula"`로 분류했다**(`"table"`이
아님):

1. **실제 표 조회 함수가 이 지점을 "표 범위"로 인정하지 않는다.** `withholding-table.ts`의
   `isWithinWithholdingTableRange`는 `taxableMonthlyPay < WITHHOLDING_TABLE_RANGE.maxWon`
   (상한 미포함)을 조건으로 삼는다 — 즉 `taxableMonthlyPay === maxWon`일 때
   `lookupWithholdingTaxRow`는 `null`을 반환한다(표 범위 밖). 이 값을 `"table"`로 표시하면
   "3-1 표에서 조회했다"는 사실과 다른 라벨을 붙이는 셈이다.
2. **값의 출처가 `policy.ts`의 `highIncomeFormula` 네임스페이스다.** 고정값
   (`baseAmountAtTableCeilingByFamilyCount`)은 `highIncomeFormula` 객체 안에 있으며,
   FORMULA.md도 이를 "3-1 표"가 아니라 "3-4"(3-4 절 제목 자체가 "월급여 10,000천원 부근
   구간"이며 정책 데이터 스키마 초안에서도 이 값이 `highIncomeFormula.
   baseAmountAtTableCeilingByFamilyCount`로 `highIncomeFormula` 블록 안에 위치)에서
   제시한다.
3. **FORMULA.md 원문이 이 지점을 "제3의 경우"로 명시하면서도, 표 조회가 아니라는 점을
   분명히 한다.** "예외" 절: "3-1 표 조회도, 3-4 산식 적용도 아닌 제3의 경우로 처리됐다는
   사실"을 표시하라고 명시한다 — 즉 이 케이스는 "표"에 속하지 않는다는 점이 핵심이다.
   `IncomeTaxSource`에 별도의 세 번째 값이 없는 이상, "표가 아니다"라는 사실을 보존하는
   `"highIncomeFormula"` 쪽이 `"table"`보다 사실 관계에 더 가깝다.

**트레이드오프로 남는 점**: `formatting.ts`의 `buildHighIncomeFormulaWarning`은
`incomeTaxSource === "highIncomeFormula"`일 때 "간이세액표 조회 구간 상한을 **초과**해
별도 계산식으로 계산했다"는 문구를 띄우는데, 정확히 경계값은 "초과"가 아니라 "일치"이고
"별도 계산식"이 아니라 "고정값 그대로"이므로 이 문구가 100% 정확하지는 않다. 이번
라운드는 Calculation Auditor 이슈 A(계산값 자체의 오류)만 수정 범위로 지시받았고
UX 문구 수정은 지시받지 않았다 — 문구 정확성은 UX/UI Critic 재검증에서 지적되면 다음
라운드에서 다룬다(예: 정확히 경계값 전용 문구를 `formatting.ts`에 추가하는 방안 검토 가능).

### 테스트 결과

- `npx vitest run --no-file-parallelism`(전체 스위트): **53개 파일, 537개 테스트 전부
  통과**. (참고: 최초 1회 실행 시 53개 파일 전부가 `TypeError: Cannot read properties of
  undefined (reading 'config')`로 동시 실패했는데, `annual-salary-take-home-pay`와 전혀
  무관한 `components/theme-toggle.test.tsx` 등도 동일하게 실패한 것으로 보아 이 코드
  변경과 무관한 일회성 환경 문제였다 — 즉시 재실행하자 53개 파일 537개 테스트 전부
  통과했고, 개별 파일 재실행에서도 재현되지 않았다.)
- `npx vitest run --no-file-parallelism src/calculators/annual-salary-take-home-pay`:
  **5개 파일, 68개 테스트 전부 통과**(Golden Test 13 포함).
- `npx vitest run --no-file-parallelism src/calculators/four-major-insurance
  src/lib/social-insurance.test.ts`(회귀 확인): **4개 파일, 28개 테스트 전부 통과**.
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`: 성공(`Compiled successfully`, 16개 페이지 생성 완료).

### 반영하지 않은 것 (지시 범위 밖)

Calculation Auditor 이슈 B(Low, FORMULA.md·ARCHITECTURE.md·주석의 "1억원" 표기 오류)는
이번 라운드의 지시 범위(이슈 A만)에 포함되지 않아 손대지 않았다 — Low이며 계산값·사용자
화면에 영향이 없어 PASS 기준(Critical 0, High 0)에 영향을 주지 않는다.

## Calculation Auditor 재검증 (라운드 1)

### 0. 검증 방법 요약

이전 라운드(위 "Calculation Auditor" 섹션)의 이슈 A(High)가 실제로 해소됐는지, Formula
Analyst의 FORMULA.md 보강이 근거와 일치하는지를 **Builder/Optimizer의 자체 보고를 그대로
신뢰하지 않고** 독립적으로 재현했다. 구체적으로:

1. 갱신된 FORMULA.md "계산 순서" 5단계·"3-4"절 전문을 다시 읽고 세 가지 경우(미만/정확히
   일치/초과) 구분과 검증 예제 13을 확인했다.
2. `logic.ts`의 `resolveBracketMode`/`baseIncomeTaxForFamilyKey`/`highIncomeFormulaTax`와
   `policy.ts`의 `baseAmountAtTableCeilingByFamilyCount`를 전문 재독해 분기 로직을 직접
   추적했다.
3. **독립 재현 테스트를 별도로 작성해 실행**했다 — `logic.test.ts`에 이미 있는 Golden
   Test 13을 그대로 신뢰하지 않고, `src/calculators/annual-salary-take-home-pay/`
   디렉터리에 임시 파일
   `__auditor_verification__.test.ts`(경계값 3점: 9,999,999 / 10,000,000 / 10,000,001)와
   `__auditor_verification2__.test.ts`(가족 12명 + 정확히 10,000,000원 조합)를 새로 작성해
   `npx vitest run`으로 실행한 뒤, 검증이 끝나는 즉시 `rm`으로 삭제했다(기존 소스 파일은
   전혀 수정하지 않았다 — Bash는 "테스트 실행·독립 수동 계산 검증" 용도로만 사용했고,
   Write 툴은 이 EVALUATION.md 갱신에만 사용했다). 삭제 후 `ls`로 원래 13개 파일만
   남았음을 확인했다.
4. 기존 전체 회귀 스위트(`--no-file-parallelism`)와 `four-major-insurance`/
   `social-insurance` 포커스 스위트, `annual-salary-take-home-pay` 전용 스위트(Golden
   Test 1~13 포함), `tsc --noEmit`을 모두 재실행했다.
5. FORMULA.md·ARCHITECTURE.md·소스 코드 전체에서 "1억원" 표기가 남아있는지 `grep`으로
   재확인했다.

### 1. FORMULA.md "계산 순서" 5단계 · "3-4"절 재검토

Formula Analyst의 보강판을 확인한 결과, 세 가지 경우 구분이 **명확하고 법령 원문의
"10,000천원인 경우의 해당 세액" 고정값 구조와 정확히 일치한다.**

- "계산 순서" 5단계가 `taxableMonthlyPay < 10,000,000원`(3-1 표 조회) /
  `taxableMonthlyPay === 10,000,000원`(3-4의 가족 수별 고정값을 초과분 계산 없이 그대로
  사용) / `taxableMonthlyPay > 10,000,000원`(3-4 산식 적용)의 세 갈래로 명시적으로 분리돼
  있다(FORMULA.md L298-306).
- "3-4"절도 동일하게 "제3의 경우"를 명문화하고(L202-229), 특히 "3-4 산식(고정값 + 초과금액
  × 계수 + 가산액)은 적용하지 않는다 — 적용하면 가산액만큼(예: 25,000원) 과다 계산된다"는
  경고 문구(L216-221, L303-304)를 넣어 재발 방지 의도를 분명히 했다. 이는 이전 라운드에서
  내가 지적한 이슈 A의 근본 원인(경계 조건 `>=`/`>` 혼동)을 정확히 짚은 서술이다.
- 근거(원문 대조)와의 일치: 이전 라운드에서 내가 직접 `pdftotext`로 재확인했던 원문
  구조 — "9,980~10,000 미만 구간의 표 값(1,503,990)"과 "정확히 10,000천원 지점의 별도
  고정값(1,507,400)"과 "10,000 초과 14,000 이하 산식(+25,000)"이 서로 다른 세 항목으로
  병존한다는 사실 — 을 FORMULA.md가 정확히 반영했다. 가족 1명 고정값 1,507,400원은
  이전 라운드에서 내가 이미 원문 대조로 확인한 값과 동일하다(재조사 불필요, 이번
  라운드는 문서 서술과 코드 구현의 일치 여부에 집중했다).
- 검증 예제 13(연봉 1억 2천만원, 가족 1명 → 근로소득세 정확히 1,507,400원)이 이 세
  갈래 분기를 정확히 겨냥한 Edge Case Test로 잘 구성돼 있다 — 아래 "재현 검증" 결과와
  1원도 다르지 않게 일치한다.

**결론: FORMULA.md 재검토 결과 문제 없음.** 세 가지 경우 구분이 명확하고 1차 법령 원문의
고정값 구조와 정확히 일치한다.

### 2. `logic.ts` 구현 재검토 (`resolveBracketMode` / `baseIncomeTaxForFamilyKey`)

코드를 전문 재독해한 결과, 버그가 실제로 해소됐음을 확인했다.

```ts
function resolveBracketMode(taxableMonthlyPay: number): BracketMode {
  if (taxableMonthlyPay > WITHHOLDING_TABLE_RANGE.maxWon) return "formula";
  if (taxableMonthlyPay === WITHHOLDING_TABLE_RANGE.maxWon) return "ceilingFixed";
  return "table";
}
```

이 함수는 FORMULA.md 5단계의 세 갈래(`<`, `===`, `>`)를 정확히 1:1로 대응시킨다. 분기
순서도 `formula`(`>`)를 먼저 검사하고 그다음 `ceilingFixed`(`===`)를 검사하므로, 부동소수점
비교가 아닌 정수 비교(모든 입력이 정수 원 단위)라 `===` 비교의 신뢰성 문제도 없다.

`baseIncomeTaxForFamilyKey`는 `bracketMode === "ceilingFixed"`일 때
`highIncomeFormulaTax`를 전혀 호출하지 않고 `baseAmountAtTableCeilingByFamilyCount`를
그대로 반환한다 — 이전 버그의 원인이었던 "가산액(+25,000원) 오적용" 경로 자체가
코드 흐름에서 제거됐다(단순히 조건을 고친 것이 아니라 호출 자체를 분리해 회귀 위험을
낮췄다는 점도 확인했다).

11명 초과 분기(`tax11`/`tax10` 계산)도 동일한 `bracketMode`를 인자로 공유하므로, "가족
12명 이상 + 정확히 10,000,000원"이라는 복합 경계 조합에서도 별도 수정 없이 동일하게
`ceilingFixed` 경로를 타는지 아래 "재현 검증"에서 직접 확인했다.

### 3. 독립 재현 검증 (실제 함수 실행)

아래 표는 이번 라운드에서 **새로 작성한 임시 테스트 파일로 직접 실행**해 얻은 결과다
(기존 `logic.test.ts`의 Golden Test 13을 그대로 베낀 것이 아니라, 별도로 계산한 입력값
— `annualSalary`를 역산해 `taxableMonthlyPay`가 정확히 9,999,999 / 10,000,000 /
10,000,001이 되도록 구성 — 으로 독립 실행했다).

| 입력 (`annualSalary`, 가족 수) | `taxableMonthlyPay` | 분기 (`bracketMode`) | `incomeTaxSource` | `incomeTax` | 기대값과 일치 |
|---|---|---|---|---|---|
| 119,999,988 / 가족 1명 | 9,999,999원 (경계 바로 아래) | `table` | `"table"` | **1,503,990원** | 일치(표 조회 정상 작동, FORMULA.md `[9,980,000, 10,000,000)` 행 값) |
| 120,000,000 / 가족 1명 | 10,000,000원 (경계값 정확히) | `ceilingFixed` | `"highIncomeFormula"` | **1,507,400원** | 일치(FORMULA.md 검증 예제 13, 원문 고정값과 정확히 같음 — **1,532,400원이 아님**, 버그 해소 확인) |
| 120,000,012 / 가족 1명 | 10,000,001원 (경계 바로 위) | `formula` | `"highIncomeFormula"` | **1,532,400원** | 일치(3-4 산식 정상 적용, `초과금액=1원`이라 거의 `base+addWon`과 같음) |
| 120,000,000 / 가족 12명 | 10,000,000원 (경계값 + 11명 초과 복합) | `ceilingFixed`(tax11/tax10 모두) | `"highIncomeFormula"` | `incomeTaxBeforeChildCredit` **930,840원** (= `960,840 - (990,840-960,840)×1`) | 일치(수기 계산과 정확히 일치 — 복합 경계에서도 회귀 없음) |

네 갈래 모두 실제 `calculateAnnualSalaryTakeHomePay` 함수를 호출해 확인했으며, 세 갈래
분기(`table`/`ceilingFixed`/`formula`) 전부가 실제로 서로 다른 코드 경로를 타는 것을
`incomeTaxSource`/`bracketMode` 값 자체로 재확인했다(단순히 최종 숫자만 맞춰본 것이
아니라 분기 자체가 의도대로 작동함을 확인).

추가로 위 표 2번째 행(경계값 정확히)은 지방소득세·순수령액까지 전부 손계산으로
재확인했다: `localIncomeTax = floor(1,507,400 × 1/10) = 150,740원`,
`totalDeductions = 809,760(4대보험) + 1,507,400 + 150,740 = 2,467,900원`,
`netMonthlyPay = 10,000,000 - 2,467,900 = 7,532,100원` — 코드 실행 결과와 정확히
일치했다(FORMULA.md 검증 예제 13과도 일치).

**이슈 A는 완전히 해소됐다고 판단한다.**

### 4. Optimizer의 `incomeTaxSource` 분류 판단 검토

Optimizer가 정확히 경계값(`bracketMode === "ceilingFixed"`)을 `IncomeTaxSource`
`"table"`이 아니라 `"highIncomeFormula"`로 분류한 판단은 **타당하다고 판단한다.**

- `withholding-table.ts`의 `isWithinWithholdingTableRange`가 `taxableMonthlyPay <
  maxWon`(상한 미포함)을 조건으로 쓰는 것을 직접 확인했다 — 정확히 `maxWon`인 지점은
  실제로 표 조회 함수(`lookupWithholdingTaxRow`)가 `null`을 반환하는 "표 범위 밖"이므로,
  이 값을 `"table"`로 라벨링하면 "표에서 조회했다"는 사실과 다른 정보를 사용자/개발자에게
  전달하는 셈이 된다. `"highIncomeFormula"`(값의 실제 출처인 `policy.ts`의
  `highIncomeFormula` 네임스페이스)로 분류하는 편이 더 정확하다.
- `IncomeTaxSource` 타입을 세 번째 값(예: `"ceilingFixed"`)으로 확장하지 않은 것은 타입
  변경 범위를 최소화하려는 보수적 선택으로 보이며, 이번 라운드 지시 범위(이슈 A의 계산값
  수정)에 부합한다. 다만 Optimizer 스스로도 인정했듯 `formatting.ts`의
  `buildHighIncomeFormulaWarning` 문구("구간 상한을 **초과**해 별도 계산식으로 계산")가
  정확히 경계값(초과가 아니라 일치, 별도 계산식이 아니라 고정값)에는 100% 정확하지
  않다는 트레이드오프가 남는다 — 이는 **계산값 자체의 오류가 아니라 UX 문구 정확성**
  문제이므로 Calculation Auditor 판정(계산 정확성)에는 영향을 주지 않지만, UX/UI Critic이
  재검증할 때 참고하도록 여기 기록해 둔다(다음 라운드에서 정확히 경계값 전용 안내 문구를
  추가하는 방안 검토 권고).

### 5. 회귀 테스트 재확인

| 스위트 | 결과 |
|---|---|
| 전체 스위트 `npx vitest run --no-file-parallelism` | **53개 파일, 537개 테스트 전부 통과** |
| `annual-salary-take-home-pay` 전용(`--reporter=verbose`) | **5개 파일, 68개 테스트 전부 통과**(Golden Test 1~13 포함, 예제 12의 "확인 필요" 잠정값 1,533,429원도 변동 없음 — `taxableMonthlyPay=10,003,000`은 순수 `formula` 분기라 이번 수정의 영향을 받지 않는 지점임을 확인) |
| `four-major-insurance` + `social-insurance` 회귀(`--reporter=verbose`) | **4개 파일, 28개 테스트 전부 통과** — 4대 보험 계산 결과 1원도 변동 없음 |
| `npx tsc --noEmit` | 오류 없음 |

기존 Golden Test 1~12와 4대 보험 계산에 회귀가 발생하지 않았음을 확인했다. 이번
수정(`resolveBracketMode` 신설, 호출부 분기 변경)이 `policy.ts`의 데이터·산식이나
`src/lib/social-insurance.ts`를 전혀 건드리지 않았다는 점과, 실제 재실행 결과가 정확히
일치한다.

### 6. FORMULA.md "1억원" → "1천만원" 정정 전수 확인

`grep -n "1억원"`으로 재확인한 결과, **`tasks/annual-salary-take-home-pay/FORMULA.md`
에는 "1억원" 표기가 단 한 건도 남아있지 않다** — Formula Analyst의 정정이 FORMULA.md
전체에서 빠짐없이 이뤄졌음을 확인했다.

다만 다음 두 곳은 여전히 "1억원" 표기가 남아 있다(이전 라운드 이슈 B 그대로, 이번
라운드 지시 범위인 "이슈 A만 수정"에 포함되지 않았으므로 예상된 상태다):

- `tasks/annual-salary-take-home-pay/ARCHITECTURE.md` — 10곳 이상(L237-238, 256, 279,
  296, 339, 382, 436, 443, 458, 465, 540, 620 등)에 "1억원 초과 산식" 표기가 남아있다.
- 소스 코드 주석·테스트 설명 — `policy.ts`(L3, 45, 60-61), `withholding-table.ts`(L26,
  39-40, 53), `logic.test.ts`(L104, 128, 132 — 예제 10·12 제목/주석), `formatting.test.ts`
  (L66), `types.ts`(L33, 59, 84)에 "1억원"이 남아있다.

이 항목들은 계산값·사용자 화면에 영향을 주지 않는 개발자 대상 문서/주석이며(이전 라운드
이슈 B에서 이미 "Low, Builder FAIL 아님, 문서 표기 정정 요청"으로 분류), 이번 라운드
지시가 "FORMULA.md 정정 여부"를 확인하라는 것이었으므로 FORMULA.md 자체는 완전히
정정됐다고 결론짓는다. 다만 ARCHITECTURE.md와 코드 주석의 잔여 "1억원" 표기는 여전히
미해결 상태이므로, 이번 재검증에서도 이슈 B를 Low로 유지하고 Architect/Optimizer에게
재차 정정을 권고한다(계산값에 영향이 없으므로 PASS 판정을 막는 사유는 아니다).

### 7. 발견된 이슈 (등급별, 재검증 기준)

| 등급 | 이슈 | 위치 | 상태 |
|---|---|---|---|
| 없음 | 이슈 A(High, 정확히 10,000,000원 경계값 25,000원 과다 계산) | `logic.ts` | **해소 확인** — 독립 재현 4건(경계 아래/정확/위/복합) 전부 기대값과 일치 |
| **Low(유지)** | "1억원" 라벨링 오류 — FORMULA.md는 완전히 정정됐으나 ARCHITECTURE.md·소스 코드 주석·테스트 설명에는 여전히 남아있음 | `ARCHITECTURE.md`, `policy.ts`/`withholding-table.ts`/`types.ts` 주석, `logic.test.ts`/`formatting.test.ts` 설명 문자열 | **문서/주석 정정 권고 유지**(Builder FAIL 아님, 계산값·사용자 화면 영향 없음) |
| 신규 없음 | `formatting.ts`의 `buildHighIncomeFormulaWarning` 문구가 정확히 경계값에 대해 "초과"/"별도 계산식"이라는 표현을 그대로 써 100% 정확하지는 않음 | `formatting.ts` | **UX 문구 개선 권고**(계산값 오류 아님, UX/UI Critic 참고용으로 기록) |

### 8. 판정

**판정: PASS**

- 근거: docs/EVALUATION.md PASS 기준 "Critical 0, High 0"을 충족한다. 라운드 0의 유일한
  High 이슈(이슈 A)가 코드·독립 재현 양쪽에서 완전히 해소됐음을 확인했다.
  - 경계 바로 아래(9,999,999원) → `table` 분기, 1,503,990원(정상)
  - 경계값 정확히(10,000,000원) → `ceilingFixed` 분기, **1,507,400원**(이전 버그였던
    1,532,400원이 아님을 재현으로 확인)
  - 경계 바로 위(10,000,001원) → `formula` 분기, 1,532,400원(정상)
  - 경계값 + 11명 초과 복합(10,000,000원, 가족 12명) → 동일한 `ceilingFixed` 분기 공유,
    930,840원(수기 계산과 일치)
- 남은 Low 이슈(1억원 라벨링 잔존, UX 문구 트레이드오프)는 계산 정확성에 영향을 주지
  않으므로 PASS 판정을 막지 않는다. 다만 다음 라운드(또는 Architect/Optimizer 유휴
  시간)에 정정할 것을 권고한다.
- 회귀: 전체 스위트 537개, 4대 보험/사회보험 28개, 계산기 전용 68개(Golden Test 1~13
  포함) 전부 통과, `tsc --noEmit` 오류 없음 — 이번 수정이 기존 계산에 어떤 회귀도
  일으키지 않았다는 점과, 실제 재실행 결과가 정확히
  일치한다.
- 남은 절차 권고: (1) UX/UI Critic이 `buildHighIncomeFormulaWarning`의 "초과"/"별도
  계산식" 문구를 정확히 경계값 케이스에 대해서도 재검토, (2) Architect/Optimizer가
  ARCHITECTURE.md·코드 주석의 "1억원" 잔여 표기를 다음 유휴 라운드에 정정, (3) QA 단계
  진행 가능.

## UX/UI Critic

Edit 권한 없이 소스 코드를 직접 읽고 대조하는 방식으로 평가했다. 대조한 실제 구현
파일: `src/calculators/annual-salary-take-home-pay/{ui.tsx, content.ts, formatting.ts,
types.ts, validation.ts}`. 비교 기준 문서: `docs/DESIGN_SYSTEM.md`(특히 "입력 라벨·순서"),
`tasks/annual-salary-take-home-pay/SPEC.md`, `FORMULA.md`, `ARCHITECTURE.md` "7. UI 구조".

### 자체 평가 질문 (최소 10개)

각 질문 앞에 `[평가 항목]`을 표시했다. "필수 질문" 4개는 Q1~Q4다.

**Q1. [필수 | 입력 라벨 표현]** 모든 입력 라벨을 `ui.tsx`에서 직접 대조했을 때, 라벨이
`FORMULA.md`/`SPEC.md`의 법령·변수명(`dependentFamilyCount`, "공제대상가족의 수",
`childrenAge8to20Count` 등)을 그대로 복사하지 않고 일반 사용자 표현을 쓰는가?

- **답변**: 라벨 4개를 모두 확인했다 — "세전 연봉"(`annualSalary`), "월 비과세
  금액"(`monthlyNonTaxablePay`), "부양가족 수(본인 포함)"(`dependentFamilyCount`),
  "8세~20세 자녀 수"(`childrenAge8to20Count`, ui.tsx L206-307). 변수명이 라벨에 그대로
  노출된 곳은 없다. "공제대상가족의 수"(FORMULA.md·소득세법 시행령 [별표 2]의 법령 원문
  용어)를 라벨로 쓰지 않고 "부양가족 수"로 순화한 것은 SPEC.md 자신이 명시한 예시
  ("법령 용어 대신 '부양가족 수' 등 일반 표현을 라벨로 쓰고")와 정확히 일치한다. 정확한
  법령 용어("공제대상가족의 수", 배우자도 1명 등)는 라벨이 아니라 helpText·FAQ로
  내려보냈다(DESIGN_SYSTEM.md "정확한 법령 용어가 필요하면 라벨이 아니라 helpText에
  넣는다" 원칙과 일치).
- **등급**: 문제없음.

**Q2. [필수 | 입력 순서·그룹핑]** 입력 필드 순서가 논리적 흐름을 따르는가? 하나의 개념
쌍(부양가족 수·자녀 수처럼 서로 검증 조건이 얽힌 필드) 사이에 성격이 다른 필드가 끼어
있지 않은가? (이 계산기는 날짜 쌍이 없으므로 "시간 순서" 기준 대신 "입력값 간 의존
관계" 기준으로 판단한다.)

- **답변**: 순서는 세전 연봉 → 월 비과세 금액 → 부양가족 수(본인 포함) → 8세~20세
  자녀 수(ui.tsx L205-308)다. SPEC "핵심 사용자 흐름"(연봉 → 비과세 금액 → 부양가족
  수 → 자녀 수) 순서와 정확히 일치한다. `childrenAge8to20Count`는 `dependentFamilyCount
  - 1`을 넘을 수 없다는 상호 검증 관계가 있는데, 두 필드가 `grid sm:grid-cols-2`로
  바로 인접해 있어(ui.tsx L258-308) DESIGN_SYSTEM "관련된 필드는 인접시킨다" 기준을
  충족한다. 두 필드 사이에 무관한 필드가 끼어 있지 않다.
- **등급**: 문제없음.

**Q3. [필수 | 용어 통일성]** 같은 개념(부양가족 수)이 폼 라벨·계산 근거(계산 방법)
breakdown·사용법 안내·FAQ 전체에서 한 용어로 통일돼 있는가?

- **답변**: 통일돼 있지 않다. 폼 라벨은 "부양가족 수(본인 포함)"(ui.tsx L261,
  content.ts FAQ 답변에서도 "부양가족 수"로 지칭)를 쓰지만, 다음 두 곳은 같은 개념을
  다른 용어("공제대상가족")로 부른다.
  - `formatting.ts` L67, L70-71 — "계산 방법" 화면(사용자가 직접 보는 breakdown)의
    6번째 단계 `expression`에 `공제대상가족 ${input.dependentFamilyCount}명 조회값 =
    ...`이라고 표시된다. 사용자는 폼에서 "부양가족 수"라는 이름으로 값을 입력했는데,
    결과 화면 계산 근거에서는 같은 값이 "공제대상가족"이라는 다른 이름으로 다시
    등장한다.
  - `content.ts` L36-37 — `UsageGuide` 3번째 단계 제목은 "부양가족 수·자녀 수 입력"인데
    바로 아래 설명문은 "본인을 포함한 **공제대상가족 수**와, 그중 8세 이상 20세 이하
    자녀 수를 입력합니다"로 같은 문장 안에서 제목과 다른 용어를 쓴다.
  - `formatting.ts` L67의 `legalBasis`(근거) 텍스트에 "공제대상가족의 수"가 등장하는
    것은 법령 인용이므로 문제가 아니지만(별도로 "근거:"로 라벨링돼 구분됨), L70-71의
    `expression`은 legalBasis가 아니라 화면에 바로 노출되는 "계산 실행문"이라 사용자가
    읽는 일반 텍스트다.
  - DESIGN_SYSTEM.md "입력 라벨·순서 > 라벨 표현": "같은 개념은 폼·결과·오류 메시지
    전체에서 한 용어로 통일한다"를 위반한다.
- **등급**: Medium. 계산은 정확하고 숫자가 일치하므로 오해가 계산 오류로 이어지지는
  않지만, "계산법을 몰라도 사용할 수 있어야 한다"는 SPEC 목적에 정면으로 부딪히는
  용어 두 개가 사용법 안내(초심자가 가장 먼저 읽는 섹션) 한 문장 안에 동시에 등장하는
  것은 명확한 UX 결함이다.

**Q4. [필수 | 입력 필드 최소화]** 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한
값을 중복으로 묻지 않는가?

- **답변**: 입력은 4개(세전 연봉, 월 비과세 금액, 부양가족 수, 자녀 수)뿐이다.
  `monthlyGrossPay`(월급여)는 연봉에서 자동 유도되고 별도로 묻지 않는다. 4개 필드
  모두 FORMULA.md 계산에 독립적으로 필요한 값이며 서로 유도 관계가 없다(자녀 수는
  부양가족 수의 부분집합이라는 제약은 있지만 자녀 수 자체는 가족 수에서 계산으로
  유도할 수 없는 별도 입력이다). 4대 보험 개별 가입 여부 같은 추가 입력도 SPEC이
  의도적으로 Should Have로 미룬 것이라 v1에서 필드를 늘리지 않았다.
- **등급**: 문제없음.

**Q5. [일반 사용자가 계산법을 몰라도 사용할 수 있는지]** "부양가족 수(본인 포함)"
helpText가 계산법을 모르는 사용자도 정확히 무엇을 셀지 판단하기에 충분한가?

- **답변**: helpText(ui.tsx L276-279)는 "배우자도 1명으로 계산합니다. 정확한 연말정산
  신고 내용과 다르면 결과가 달라질 수 있습니다."라고만 안내한다. 배우자 외에 부모·
  자녀 등 다른 부양가족을 셀 때 필요한 소득 요건(예: 연간 소득금액 100만원 이하 등)
  판정 기준은 설명하지 않는다. 다만 FORMULA.md 자체가 "본인·배우자·기타 부양가족을
  UI에서 개별로 나눠 받지 않는" v1 단순화를 명시하고 "결과 화면에 고지"하도록
  요구했으며, helpText가 바로 그 고지("연말정산 신고 내용과 다르면 결과가 달라질 수
  있음")를 담고 있다. 즉 완벽한 판정 기준 설명은 아니지만 SPEC이 요구한 최소 고지
  수준은 충족한다.
- **등급**: Low. 구체적 예시(예: "본인 1명 + 배우자 1명 + 소득이 없어 실제로 부양하는
  부모·자녀 수를 더한 값") 한 문장을 추가하면 개선 여지가 있으나 SPEC 범위를 벗어나는
  요구는 아니다.

**Q6. [결과 가독성]** 세후 월 실수령액이라는 핵심 숫자가 다른 정보와 명확히 구분되어
가장 먼저 눈에 들어오는가? 6개 공제 항목이 계층 구조(4대 보험 vs 세금, 개별 vs 합계)로
잘 정리돼 있는가?

- **답변**: 핵심 결과 카드(ui.tsx L351-366)는 `bg-primary` 배경에 `text-4xl~5xl
  font-bold`로 `netMonthlyPay` 하나만 표시하고, 바로 아래 요약 한 줄("세전 월급여 X
  중 공제 합계 Y")을 둔다 — DESIGN_SYSTEM "핵심 결과 카드" 기준(계산기당 하나, 가장
  중요한 숫자 하나만)과 일치한다. 공제 내역 카드는 "4대 보험"(국민연금/건강보험/
  장기요양보험/고용보험 + 합계)과 "세금"(근로소득세/지방소득세) 두 그룹으로 소제목이
  나뉘어 있고 각 그룹 끝에 강조(strong) 처리된 소계·합계 행이 있다(ui.tsx L369-403).
  계층이 명확하다.
- **등급**: 문제없음.

**Q7. [모바일 사용성(레이아웃)]** 320~390px 폭 기준으로 입력 그리드·버튼 줄바꿈·공제
내역 행이 가로 스크롤이나 잘림 없이 배치되는가?

- **답변**: 부양가족 수/자녀 수 입력은 `grid gap-5 sm:grid-cols-2`(ui.tsx L258)라
  640px 미만에서는 자동으로 1열로 쌓인다. 버튼 3개는 `flex flex-wrap gap-3`(L310)이라
  좁은 화면에서 줄바꿈된다. 공제 내역 행(`DeductionRow`)은 `flex items-baseline
  justify-between gap-3`(formatting 아님, ui.tsx L106)이며 라벨은 짧은 한글, 값은
  "1,507,400원"류의 숫자+단위라 320px 폭에서도 겹침 위험이 낮아 보인다. 정책 안내의
  기준일 배지도 `flex flex-wrap`(L422)이라 좁은 화면에서 줄바꿈된다. 정적 코드 검토
  기준으로는 구조적 문제가 보이지 않는다 — 다만 이는 레이아웃 코드 리뷰이며 실제
  기기·브라우저 렌더링 확인은 QA의 몫이다.
- **등급**: 문제없음(레이아웃 관점 한정, 실제 브라우저 검증은 QA 영역).

**Q8. [오류 메시지의 이해 용이성]** `validation.ts`의 오류 메시지가 무엇이 잘못됐고
어떻게 고쳐야 하는지 비전문가도 알 수 있는 문장인가?

- **답변**: 예: "세전 연봉은 0보다 큰 정수(원 단위)로 입력해 주세요.", "월 비과세
  금액은 세전 월 급여(연봉 ÷ 12)보다 클 수 없습니다.", "8세~20세 자녀 수는 부양가족
  수(본인 포함) - 1명을 초과할 수 없습니다(본인은 자녀가 될 수 없습니다)."(validation.ts
  L56-58, L117-119, L139) 모두 조건과 이유를 함께 설명하며, 폼 라벨과 동일한 용어
  ("세전 연봉", "부양가족 수(본인 포함)")를 그대로 재사용해 Q3에서 지적한 용어 불일치가
  오류 메시지에는 나타나지 않는다. 특히 마지막 메시지는 괄호로 "본인은 자녀가 될 수
  없습니다"라는 직관적 근거까지 덧붙여 비전문가 이해에 유리하다.
- **등급**: 문제없음.

**Q9. [계산 과정(근거 breakdown)을 이해할 수 있는지]** "계산 방법" 섹션의 9단계
설명이 전문용어를 최소화하면서도 실제 대입값을 보여주는가? 전문용어가 화면에 먼저
정의 없이 등장하는 곳은 없는가?

- **답변**: `formatting.ts`의 `buildAnnualSalaryCalculationSteps`(L32-95)는 단계별로
  "근거"(법령 인용, 전문용어 허용)와 "expression"(실제 대입값)을 분리해 보여준다 —
  좋은 구조다. 다만 두 가지 순서 문제를 발견했다.
  1. 화면 DOM 순서상 "공제 내역" 카드(경고 문구 포함)가 "계산 방법" 카드보다 먼저
     나온다(ui.tsx L369 vs L406). `isBelowTaxableThreshold` 경고 문구(formatting.ts
     L121-127)는 "산정 기준 보수가 간이세액표 최저구간 이하라..."고 표현하는데,
     "산정 기준 보수"라는 용어의 정의(= 월급여 − 비과세)는 뒤에 나오는 "계산 방법"
     2번째 단계에서야 등장한다(formatting.ts L43-45). 즉 정의보다 사용이 화면에서
     먼저 나온다.
  2. "3. 국민연금" 단계의 근거 텍스트에 "기준소득월액"(formatting.ts L50)이라는
     전문용어가 등장하는데, 이 용어에 대한 일반어 설명("보험료를 계산하는 기준이 되는
     소득")은 어디에도 없다. `buildPensionLimitWarning`(L101-109)도 같은 용어를 그대로
     재사용한다.
- **등급**: Low. "근거" 줄은 원래 법령 인용 목적으로 설계됐고(legalBasis 필드 자체가
  전문용어를 허용하는 자리), 실제 계산 대입값(expression)은 이해 가능한 수준으로
  단순화돼 있어 치명적이지 않다. 다만 용어 정의 순서·전문용어 무설명은 사소한 개선
  여지로 남긴다.

**Q10. [불필요한 UI 요소 존재 여부]** 폼·결과 화면에 계산에 기여하지 않거나 중복된
UI 요소가 있는가?

- **답변**: `ui.tsx` 전체를 검토한 결과 중복·불필요 요소를 찾지 못했다. 초기화/샘플
  채우기 버튼은 DESIGN_SYSTEM 표준 패턴 그대로이고, `ShareActions`는 SPEC Should Have
  항목으로 정당화된다. "세전 월급여" 숫자가 핵심 결과 카드 요약 줄과 계산 방법 1·9번
  단계에 반복 등장하지만, 이는 "요약(핵심 카드)"과 "상세(계산 방법)"라는 서로 다른
  깊이의 섹션에 의도적으로 반복 노출된 것이라 불필요한 중복이 아니라 계층적 설명
  패턴으로 판단한다.
- **등급**: 문제없음.

**Q11. [결과 가독성 / 일반 사용자 이해 가능성]** SPEC이 요구한 "연말정산 미반영,
실제 회사 급여와 다를 수 있음" 고지가 핵심 결과(큰 숫자)를 보고 지나치기 쉬운
위치·비중으로 배치돼 있지 않은가?

- **답변**: 고지 문구("국세청 근로소득 간이세액표 기준 예상 원천징수액이며, 연말정산
  환급·추가납부는 반영하지 않은 매월 원천징수 기준 실수령액입니다.")는 핵심 결과 카드
  안에서 `netMonthlyPay` 큰 숫자 바로 아래 3번째 줄에 위치한다(ui.tsx L362-365) —
  스크롤 없이 항상 눈에 들어오는 위치라는 점은 좋다. 다만 스타일이
  `text-xs opacity-75`(라이트 모드 기준, 다크 모드는 `opacity-100`이지만 여전히
  `text-xs`)로, 헤드라인(`text-4xl~5xl font-bold`)과 극단적인 크기·명도 대비 차이가
  난다. 위치는 좋으나 시각적 비중이 낮아 "큰 숫자만 보고 지나치는" 사용자가 이 문장을
  건너뛸 위험이 남아 있다. 동일 카드의 "정책 안내" 섹션에도 같은 취지의 문구가 다시
  나오므로 완전히 사라지지는 않지만, 첫 노출 지점의 강조가 약하다.
- **등급**: Medium. 계산 자체에는 영향이 없으나, SPEC이 "명확히 안내"를 요구한
  고지 사항이 시각적으로 최소 강조 수준(가장 작은 텍스트 크기, 반투명)으로만
  처리된 것은 이 계산기의 핵심 리스크(사용자가 이 숫자를 실제 급여로 오인)에 비해
  강조가 부족하다.

**Q12. [계산 과정을 이해할 수 있는지 — 경계값 케이스]** `formatting.ts`의
`buildHighIncomeFormulaWarning` 문구가 `incomeTaxSource === "highIncomeFormula"`이지만
실제로는 정확히 10,000,000원 경계값이라 초과분 계산 없이 고정값을 그대로 쓰는 경우를
정확히 설명하는가? (Calculation Auditor가 잔여 이슈로 남긴 항목)

- **답변**: 코드를 직접 확인했다.
  ```ts
  export function buildHighIncomeFormulaWarning(
    result: AnnualSalaryTakeHomePayResult,
  ): string | null {
    return result.incomeTaxSource === "highIncomeFormula"
      ? "산정 기준 보수가 간이세액표 조회 구간 상한을 초과해 별도 계산식으로 근로소득세를 계산했습니다. 이 구간은 국세청 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을 수 있습니다."
      : null;
  }
  ```
  이 함수는 `incomeTaxSource`(2값 유니온: `"table" | "highIncomeFormula"`)만 보고
  분기하며, 실제 내부 상태인 `bracketMode`(`"table" | "ceilingFixed" | "formula"`)는
  결과 타입(`types.ts`)에 노출돼 있지 않아 UI가 두 경우를 구분할 수 없다. 재현:
  `annualSalary = 120,000,000`, 비과세 0원, 가족 1명 → `taxableMonthlyPay =
  10,000,000`(정확히 경계) → `incomeTaxSource = "highIncomeFormula"` → 화면에 위
  문구가 그대로 표시된다. 그런데 이 케이스는:
  1. "상한을 **초과**"하지 않았다 — 정확히 상한과 **일치**한다.
  2. "**별도 계산식**으로 계산"하지 않았다 — FORMULA.md 3-4가 명시한 "고정값을
     초과분 계산 없이 그대로" 사용한 것이며, 초과금액 항·가산액 항 계산 자체가
     실행되지 않는다(logic.ts `bracketMode === "ceilingFixed"`는
     `highIncomeFormulaTax`를 호출조차 하지 않는다).
  3. "국세청 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을 수 있다"는 경고도
     이 케이스에는 근거가 약하다 — 이 지점은 반올림·절사가 전혀 개입하지 않는
     법령 원문의 고정 정수값(1,507,400원 등)을 그대로 쓰므로, 오히려 표 조회
     케이스와 마찬가지로 홈택스와 정확히 일치할 가능성이 높다. 실제로는 반올림
     이슈가 있는 쪽은 `bracketMode === "formula"`(10,000,000원 초과, 3-4 산식의
     원 단위 절사 미확정 — FORMULA.md "확인 필요")뿐이다.
  즉 연봉이 정확히 1억 2천만 원처럼 실제로 있음직한 라운드 넘버 입력에서, 화면에
  뜨는 유일한 설명 문구가 그 케이스의 실제 계산 방식과 반대로 서술된다. 사용자가
  이 문구를 보고 "내 결과가 홈택스와 다를 수 있다"고 오인하거나, 국세청 자료와
  직접 대조하려는 사용자가 "초과분 계산식"을 찾다가 실제로는 존재하지 않아 혼란을
  겪을 수 있다.
- **등급**: Medium. 계산값 자체는 정확하고(Calculation Auditor 재검증 완료), 이
  결함은 순수하게 설명 문구의 부정확성이다. 다만 이 경계값은 특수한 예외가 아니라
  "연봉을 12로 나눈 값이 정확히 1,000만원"이 되는 상당히 흔한 라운드 넘버 입력
  (연봉 1.2억 원 등)에서 발생하므로 실사용 빈도가 낮지 않다. `IncomeTaxSource`에
  세 번째 값(`"ceilingFixed"` 등)을 추가하거나, `formatting.ts`에서
  `taxableMonthlyPay === 10,000,000` 여부를 별도로 받아 전용 문구("정확히 상한
  금액과 일치해 고정 세액을 그대로 적용했습니다")로 분기할 것을 권고한다.

**Q13. [결과 가독성]** 4대 보험 4개 항목(국민연금/건강보험/장기요양보험/고용보험) +
근로소득세 + 지방소득세, 총 6개 공제 항목이 한눈에 이해되는가? 각 항목이 무엇을 위한
것인지 사용자가 알 수 있는가?

- **답변**: 6개 항목 각각의 라벨("국민연금", "건강보험", "장기요양보험", "고용보험",
  "근로소득세", "지방소득세")은 급여명세서에 실제로 등장하는 표준 명칭 그대로이며,
  "4대 보험"/"세금"이라는 상위 소제목으로 성격이 구분돼 있다(ui.tsx L371, L387).
  다만 각 항목이 "무엇을 위한 공제인지"(예: 국민연금=노후 연금, 건강보험=의료비 지원,
  장기요양보험=노인장기요양 지원, 고용보험=실업급여 재원)에 대한 1줄 설명이나 툴팁은
  어디에도 없다 — 항목명과 금액만 나열된다. 대다수 한국 성인 근로자는 급여명세서를
  통해 이 6개 명칭에 익숙하므로(SPEC 주요 사용자가 "구직자·재직 근로자") 치명적인
  이해 장벽은 아니라고 판단하지만, "장기요양보험"은 나머지 5개보다 상대적으로 생소할
  수 있다.
- **등급**: Low. 각 항목에 짧은 설명(예: 장기요양보험 옆에 "고령·노인성 질환 대비
  보험")을 추가하면 개선되나, SPEC Must Have가 요구한 필수 항목("개별 금액 + 합계
  표시")은 이미 충족한다.

### 발견된 이슈 (등급별)

| 등급 | 이슈 | 위치 | 관련 질문 |
|---|---|---|---|
| Critical | 없음 | — | — |
| High | 없음 | — | — |
| **Medium** | 같은 개념("부양가족 수" ↔ "공제대상가족")에 서로 다른 용어가 폼 라벨·계산 근거 breakdown·사용법 안내에 혼재해 사용된다 (특히 `content.ts` UsageGuide 3단계는 제목과 설명문이 한 문장 안에서 용어가 다르다) | `src/calculators/annual-salary-take-home-pay/formatting.ts` L67, L70-71; `content.ts` L36-37 | Q3 |
| **Medium** | "연말정산 미반영·회사 급여와 다를 수 있음" 고지가 핵심 결과 카드 내 위치는 적절하나 `text-xs opacity-75`로 헤드라인 대비 시각적 비중이 매우 낮아, SPEC이 요구한 "명확한 안내" 수준에 못 미칠 위험이 있다 | `ui.tsx` L362-365 | Q11 |
| **Medium** | `buildHighIncomeFormulaWarning` 문구가 `taxableMonthlyPay`가 정확히 10,000,000원(1,000만원)인 실제로 흔한 라운드 넘버 케이스에서 "초과"/"별도 계산식"이라고 서술해 실제 계산 방식(고정값을 초과분 계산 없이 그대로 사용)과 반대로 설명한다(Calculation Auditor가 잔여 이슈로 남긴 항목의 실사용자 영향 확인) | `src/calculators/annual-salary-take-home-pay/formatting.ts` (`buildHighIncomeFormulaWarning`) | Q12 |
| Low | "부양가족 수" helpText가 배우자 외 부양가족 판정 기준(소득 요건 등)을 구체적으로 설명하지 않음(SPEC이 이미 인지하고 v1 단순화로 고지 처리한 항목) | `ui.tsx` L276-279 | Q5 |
| Low | "산정 기준 보수", "기준소득월액" 등 전문용어가 화면 앞쪽(공제 내역 카드의 경고 문구)에서 뒤쪽(계산 방법 카드의 정의)보다 먼저 등장 | `formatting.ts` L50, L101-109, L121-127 | Q9 |
| Low | 4대 보험 6개 공제 항목에 각 항목의 용도를 설명하는 1줄 설명/툴팁이 없음(특히 "장기요양보험") | `ui.tsx` 공제 내역 카드 | Q13 |

### 판정: PASS

- Critical 0, High 0 — 이번 평가에서 발견된 모든 이슈는 Medium 3건, Low 3건이며,
  계산 정확성(Calculation Auditor가 이미 별도로 PASS 판정)에는 영향을 주지 않는
  순수 UX/설명 이슈다.
- Medium 3건은 모두 "계산법을 몰라도 사용할 수 있어야 한다"는 SPEC 목적과 직접
  관련되므로(용어 불일치, 핵심 고지 강조 부족, 경계값 설명 부정확) 다음 Optimizer
  라운드에서 반영을 권고하지만, docs/EVALUATION.md PASS 기준("Critical 0, High 0")을
  막는 사유는 아니다.
- 권고 우선순위: (1) `formatting.ts`/`content.ts`의 "공제대상가족" → "부양가족 수"
  용어 통일, (2) `buildHighIncomeFormulaWarning`을 `bracketMode`(또는 동등 판정)
  기준으로 "정확히 경계값" 전용 문구와 "초과 산식" 전용 문구로 분리, (3) 핵심 결과
  카드의 연말정산 미반영 고지 텍스트 강조(크기·색상) 상향 검토.

## Optimizer 수정 (라운드 2)

UX/UI Critic(PASS, Medium 3건)과 QA(PASS, Medium 1건 신규 발견) 보고서를 함께 반영했다.
새 기능은 추가하지 않았고, `logic.ts`의 계산 공식·`policy.ts`의 값·`withholding-table.ts`·
`src/lib/social-insurance.ts`는 건드리지 않았다. 최종 PASS/FAIL 판정은 하지 않는다 —
UX/UI Critic과 QA가 각각 재검증한다.

### 1. QA Medium(신규 발견) — 비현실적으로 낮은 연봉에서 `netMonthlyPay` 음수 표시

**무엇을 바꿨는가**: 계산(`logic.ts`)과 검증 범위(`validation.ts`)는 전혀 바꾸지 않고,
표시 레이어에만 조건부 경고를 추가했다.

- `formatting.ts`에 `buildNegativeNetPayWarning(result)`를 신설했다.
  `result.netMonthlyPay < 0`일 때만 "입력한 급여 수준에서는 4대 보험 최저 보험료가 실제
  급여보다 커서 세후 실수령액이 0원 미만으로 계산됩니다. 실제로는 이런 급여 수준에 4대
  보험이 그대로 적용되지 않을 가능성이 높으므로, 이 결과는 참고용으로만 확인해 주세요."를
  반환하고, 그 외에는 `null`이다. `buildAllPolicyWarnings`에도 추가했다.
- `ui.tsx`에 `WarningCard({ title, body })` 컴포넌트를 신설했다 — 새 색상이 아니라
  `docs/DESIGN_SYSTEM.md` "경고/미충족 카드" 토큰(`border-warning-border bg-warning-surface`)
  그대로이며, `housing-subscription-score`/`weekly-holiday-allowance`가 이미 쓰는 마크업을
  그대로 재사용했다(새 패턴 아님). `buildNegativeNetPayWarning(result)`가 문자열을 반환할
  때만 결과 영역 맨 위(핵심 결과 카드보다 먼저)에 렌더링해, 계산 결과 자체는 가리지 않으면서
  숫자를 보기 전에 맥락을 먼저 안내하도록 했다.
- 회귀 테스트: `formatting.test.ts`에 `buildNegativeNetPayWarning` describe 블록(음수 시
  경고 반환, 정상 범위 시 `null`)을 추가했고, `ui.test.tsx`에 "비현실적으로 낮은 연봉 입력
  시 세후 실수령액 음수 경고 카드를 표시한다"(annualSalary=100,000원 — QA.md가 재현한 값
  그대로)와 "정상 범위 계산에서는 실수령액 음수 경고 카드가 나오지 않는다"(샘플 값) 두
  테스트를 추가했다.
- QA가 제안한 대안 (b)(`annualSalary`에 현실적 최저 하한 검증 추가)는 채택하지 않았다 —
  QA 권고 (a)(표시 경고 + 계산 유지)가 지시문이 명시한 방향("표시/설명의 문제")과 일치하고,
  임의로 새 검증 규칙(현실적 최저 연봉 문턱값)을 창작하는 것은 "보고서에 없는 개선을 임의로
  추가하지 않는다" 원칙에 어긋난다고 판단했다.

### 2. UX/UI Critic Medium 1 — 용어 불일치("부양가족 수" ↔ "공제대상가족")

**"부양가족 수(본인 포함)"로 통일했다.** 이유:

- 폼 라벨(`ui.tsx`)·에러 메시지(`validation.ts`)·helpText가 이미 전부 "부양가족 수(본인
  포함)"를 쓰고 있어, 사용자가 화면에서 가장 먼저·가장 많이 보는 표현이다. "공제대상가족"은
  `formatting.ts`/`content.ts` 단 몇 곳에서만 등장하는 소수 표현이었다 — 다수결로도, "이미
  확립된 사용자 대면 표현 우선"이라는 관점으로도 "부양가족 수(본인 포함)" 쪽이 자연스럽다.
- `docs/DESIGN_SYSTEM.md` "라벨 표현"이 "법령 용어가 아니라 일반 사용자가 실제로 쓰는
  표현"을 요구한다. "공제대상가족"은 소득세법 시행령 [별표 2] 원문 용어이고, "부양가족
  수"는 이미 이 저장소의 다른 계산기(`housing-subscription-score`의 "무주택기간·부양가족
  수·청약통장 가입기간" 등)에서도 쓰는 일반 표현이다.
- 변경 위치: `formatting.ts`의 `buildAnnualSalaryCalculationSteps` 6번째 단계 `expression`
  (지적된 L70-71 정확히), `buildOverElevenFamilyWarning`의 경고 문구(지적되지는 않았지만
  같은 파일 안에서 사용자에게 노출되는 동일 개념의 잔여 "공제대상가족" 표현이라 함께
  통일했다 — 그대로 두면 "용어 통일"이라는 목적 자체가 훼손되기 때문), `content.ts`의
  `UsageGuide` 3번째 단계 설명문(지적된 L36-37).
- **바꾸지 않은 곳**: `formatting.ts`의 `legalBasis`(법령 인용, "근거:"로 별도 라벨링됨),
  `types.ts`/`policy.ts`/`logic.ts`의 JSDoc 주석(개발자 대상, 법령 정확성을 위해 법령
  용어를 그대로 쓰는 것이 맞음) — Critic이 스스로 "법령 인용이므로 문제가 아니다"라고
  구분한 부분 그대로 유지했다.

### 3. UX/UI Critic Medium 2 — "연말정산 미반영" 고지의 낮은 시각적 비중

`ui.tsx` 핵심 결과 카드의 세 번째 문장(연말정산 미반영 고지)을 `text-xs opacity-75`에서
`text-sm font-semibold opacity-100`으로 올렸다(다크 모드도 `dark:text-foreground
dark:opacity-100`로 통일). 새 색상 토큰은 추가하지 않았고, 기존 `text-primary-foreground`
(라이트)/`text-foreground`(다크) 색상 자체는 그대로 두되 크기·굵기·불투명도만 올려 헤드라인
바로 아래 요약 줄(`text-sm opacity-80`)과 비슷하거나 약간 더 강한 시각적 비중을 갖도록
했다. 별도 줄로 분리하는 대안(Critic이 함께 제시)은 이미 별도 `<p>`로 분리돼 있었으므로
추가 작업이 필요 없었다.

주의(트레이드오프로 기록): 이 문구의 `text-xs opacity-75` 패턴은 `severance-pay`/
`unemployment-benefit`/`weekly-holiday-allowance`/`housing-subscription-score`가 핵심
결과 카드 캐비엇 줄에 공통으로 쓰는 저장소 전역 관행이다. 이번 변경은 그 관행에서 이
계산기만 벗어나는 것이라 다른 계산기와의 일관성은 약간 낮아진다. 다만 이 계산기의 SPEC은
"연말정산 미반영"을 "결과와 함께 명확히 안내"하도록 특별히 요구하고, Critic이 이 계산기의
핵심 리스크(사용자가 세후 월 실수령액을 실제 급여로 오인)로 지목한 항목이라 이번 라운드
지시(Critic 보고서)를 그대로 따랐다. 이 저장소 전역 패턴 자체를 바꿀지는 이번 라운드
범위 밖이므로 손대지 않았다.

### 4. UX/UI Critic Medium 3 — `buildHighIncomeFormulaWarning`이 정확히 경계값에서 부정확

**`types.ts`에 `IncomeTaxBracketMode`("table" | "ceilingFixed" | "formula") 타입과
`AnnualSalaryTakeHomePayResult.bracketMode` 필드를 신설**해, `logic.ts`가 이미 내부적으로
계산에 쓰던 `bracketMode`(3단계 분기: 표 조회 / 정확히 상한 고정값 / 상한 초과 산식) 값을
결과에 그대로 노출했다. **계산 로직 자체는 전혀 바꾸지 않았다** — `logic.ts`는 기존 로컬
`type BracketMode`를 `types.ts`의 새 타입에 대한 별칭으로 바꾸고, 이미 계산돼 있던
`bracketMode` 지역 변수를 반환 객체에 한 줄 추가했을 뿐이다(분기 조건·계산식·호출 순서는
1원도 바뀌지 않았다).

`formatting.ts`의 `buildHighIncomeFormulaWarning`을 `result.incomeTaxSource`(2값) 대신
`result.bracketMode`(3값)로 분기하도록 고쳤다:

- `bracketMode === "ceilingFixed"`(정확히 1,000만원 경계) → "산정 기준 보수가 간이세액표
  조회 구간의 상한 금액(1,000만원)과 정확히 일치합니다(상한을 넘어선 것이 아닙니다). 이
  지점에 대해 별도로 정해진 고정 세액을 추가 계산 없이 그대로 적용했습니다." ("초과"라는
  단어를 의도적으로 배제했다 — 회귀 테스트가 `not.toContain("초과")`로 이를 고정한다.)
- `bracketMode === "formula"`(실제로 1,000만원 초과) → 기존 문구("...상한을 초과해 별도
  계산식으로... 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을 수 있습니다.")를 그대로
  유지했다(Golden Test 10·12가 이미 이 케이스를 검증하며, 문구 자체는 부정확하지 않았다).

회귀 테스트: `formatting.test.ts`에 "정확히 세액표 상한(1,000만원) 경계값이면 '초과' 문구
대신 고정 세액 문구가 나온다"(annualSalary=120,000,000원, Golden Test 13과 동일 입력)를
추가해 `bracketMode==="ceilingFixed"`·문구에 "초과" 미포함·"고정 세액" 포함을 확인했고,
기존 "1억원 초과 산식 적용 시 경고가 나온다" 테스트에도 `bracketMode==="formula"` 단언을
보강했다. `logic.test.ts` Golden Test 10·13에도 각각 `bracketMode` 단언
(`"formula"`/`"ceilingFixed"`)을 추가해 두 경우가 실제로 다른 코드 경로임을 고정했다.

### 5. 반영하지 않은 것(지시 범위 밖)

- Critic Low 3건(부양가족 helpText 구체 예시 부족, 전문용어 정의 순서, 4대 보험 항목별
  1줄 설명 부재)과 QA Low 2건(320px 핵심 숫자 폭, 금액 입력 소수점 무음 처리)은 지시문이
  "시간이 부족하면 넘어가도 된다"고 명시한 대로 이번 라운드에서 다루지 않았다.
- Calculation Auditor가 라운드 1에서 남긴 Low 이슈("1억원" 라벨 잔존, `ARCHITECTURE.md`·
  코드 주석)는 이번 라운드 지시(UX/UI Critic·QA 보고서 반영)에 포함되지 않아 손대지 않았다.

### 테스트 결과

- `npx vitest run src/calculators/annual-salary-take-home-pay --no-file-parallelism`:
  **5개 파일, 73개 테스트 전부 통과**(기존 68개 + 이번에 추가한 5개: `formatting.test.ts`
  3개 신규 + `ui.test.tsx` 2개 신규. `logic.test.ts`는 기존 테스트에 단언만 보강해 테스트
  개수는 그대로 13개 Golden + 3개 경계값).
- `npx vitest run --no-file-parallelism`(전체 스위트): **53개 파일, 542개 테스트 전부
  통과**.
- `npx vitest run --no-file-parallelism src/calculators/four-major-insurance
  src/lib/social-insurance.test.ts`(회귀 확인): **4개 파일, 28개 테스트 전부 통과** —
  이번 라운드는 `logic.ts`의 `bracketMode` 필드 노출 외에는 계산 관련 파일을 전혀
  건드리지 않았고, `four-major-insurance`/`social-insurance`는 애초에 손대지 않았다.
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`: 성공(Compiled successfully, TypeScript 통과, 16개 페이지 생성).

### 수정 파일

- `src/calculators/annual-salary-take-home-pay/types.ts` (`IncomeTaxBracketMode` 타입,
  `bracketMode` 필드 추가)
- `src/calculators/annual-salary-take-home-pay/logic.ts` (로컬 `BracketMode`를 `types.ts`
  타입 별칭으로 변경, 반환 객체에 `bracketMode` 추가 — 계산식 변경 없음)
- `src/calculators/annual-salary-take-home-pay/formatting.ts` (`buildHighIncomeFormulaWarning`
  bracketMode 3분기화, `buildOverElevenFamilyWarning`/`buildAnnualSalaryCalculationSteps`
  용어 통일, `buildNegativeNetPayWarning` 신설, `buildAllPolicyWarnings`에 추가)
- `src/calculators/annual-salary-take-home-pay/content.ts` (UsageGuide 3단계 설명 용어 통일)
- `src/calculators/annual-salary-take-home-pay/ui.tsx` (`WarningCard` 컴포넌트 신설 및
  조건부 렌더링, 연말정산 고지 강조, import 추가)
- `src/calculators/annual-salary-take-home-pay/formatting.test.ts` (신규 테스트 3개 + 기존
  테스트 보강)
- `src/calculators/annual-salary-take-home-pay/logic.test.ts` (Golden Test 10·13에
  `bracketMode` 단언 추가)
- `src/calculators/annual-salary-take-home-pay/ui.test.tsx` (신규 테스트 2개)

## UX/UI Critic 재검증 (라운드 1)

Edit 권한 없이 `src/calculators/annual-salary-take-home-pay/{ui.tsx, formatting.ts,
content.ts, types.ts, logic.ts}`와 `formatting.test.ts`/`logic.test.ts`를 다시 읽고,
Optimizer가 "Optimizer 수정 (라운드 2)"에서 보고한 세 가지 수정이 실제로 반영됐는지
코드를 직접 대조해 확인했다. 처음부터 10개 질문을 새로 만들지 않고, 이전 라운드에서
Medium으로 지적한 3개 항목과 관련된 질문만 재확인했다(지시문 3번 요구대로 정확히
1,000만원 경계값과 그보다 큰 경우를 직접 비교했다).

### 재검증 질문 1. [용어 통일성 | Q3 재확인] "부양가족 수(본인 포함)" 용어가 사용자 노출
텍스트 전체에서 실제로 통일됐는가?

- **답변**: `grep -n "공제대상가족" src/calculators/annual-salary-take-home-pay`로 전수
  확인한 결과, 남아있는 6곳은 다음과 같다.
  - `logic.ts` L147 — 코드 주석(개발자 대상)
  - `formatting.ts` L67 — `legalBasis`(법령 인용, "근거:"로 별도 라벨링돼 화면에 노출되지만
    법령 용어 사용이 원래 허용된 자리)
  - `types.ts` L23, L27, L54 — JSDoc 주석(개발자 대상)
  - `policy.ts` L37 — JSDoc 주석(개발자 대상)
  사용자가 실제로 읽는 화면 텍스트(폼 라벨, helpText, 에러 메시지, `buildAnnualSalaryCalculationSteps`의
  `expression`, `buildOverElevenFamilyWarning`, `content.ts`의 `UsageGuide`/FAQ)에는
  "공제대상가족"이 전혀 남아있지 않음을 직접 확인했다. 구체적으로:
  - `formatting.ts` L70-71(이전에 지적한 정확한 위치)이 이제
    `` `부양가족 수(본인 포함) ${input.dependentFamilyCount}명 조회값 = ...` ``/
    `` `부양가족 수(본인 포함) ${input.dependentFamilyCount}명(11명 초과 산식 적용) → ...` ``
    로 바뀌었다.
  - `buildOverElevenFamilyWarning`(L152-154)도 "부양가족 수(본인 포함)가 11명을 초과해..."로
    바뀌었다(지적되지 않았던 곳까지 Optimizer가 스스로 확장 수정한 점을 확인).
  - `content.ts` L36-37(이전에 지적한 정확한 위치)의 `UsageGuide` 3번째 단계 설명문이
    "부양가족 수(본인 포함)와, 그중 8세 이상 20세 이하 자녀 수를 입력합니다."로 바뀌어
    제목("부양가족 수·자녀 수 입력")과 더 이상 충돌하지 않는다.
  - 남은 `legalBasis`(L67)는 Critic이 라운드 1에서 스스로 "법령 인용이므로 문제가 아니다"라고
    구분한 자리와 정확히 일치하며, 화면에서도 "근거:"라는 별도 라벨 뒤에 표시돼(ui.tsx L441)
    실행문(expression)과 시각적으로 분리된다.
- **등급**: 문제없음(라운드 1 Medium 이슈 해소 확인).

### 재검증 질문 2. [불필요한 UI 요소 없음 / 결과 가독성 | Q11 재확인] "연말정산 미반영"
고지의 시각적 비중이 실제로 상향됐는가, 부작용은 없는가?

- **답변**: `ui.tsx` L392를 확인한 결과 `text-sm font-semibold opacity-100
  dark:text-foreground dark:opacity-100`로 바뀌어 있다(이전 `text-xs opacity-75`). 헤드라인
  (`text-4xl~5xl font-bold`)과의 크기 차이는 여전하지만(의도된 계층 구조이므로 문제 아님),
  바로 위 요약 줄(`text-sm opacity-80`, L388)과 동등하거나 약간 더 강한 굵기·불투명도를
  가져 "가장 작고 흐린 텍스트"였던 상태에서 벗어났다. 새로운 부작용을 찾지 못했다 —
  색상 토큰 자체(`text-primary-foreground`/`text-foreground`)는 바뀌지 않았고 크기·굵기·
  불투명도만 올랐으므로 명도 대비가 오히려 개선됐고(대비가 나빠지는 방향이 아님), 줄바꿈
  구조도 그대로다. Optimizer가 스스로 기록한 트레이드오프(다른 계산기와의 전역 패턴
  불일치)는 사실이지만 이는 SPEC이 이 계산기에 한해 특별히 요구한 강조이므로 결함이
  아니라 의도된 예외로 판단한다.
- **등급**: 문제없음(라운드 1 Medium 이슈 해소 확인).

### 재검증 질문 3. [계산 과정 breakdown 이해 가능성 | Q12 재확인 — 지시문 필수 대조]
`bracketMode` 구분이 실제로 정확히 1,000만원 경계값과 그보다 큰 경우를 서로 다른, 각각
정확한 문구로 설명하는가?

- **답변**: `types.ts`에 `IncomeTaxBracketMode`("table"|"ceilingFixed"|"formula")와
  `AnnualSalaryTakeHomePayResult.bracketMode` 필드가 신설됐고, `logic.ts`의
  `resolveBracketMode`가 계산해 두었던 값을 반환 객체에 그대로 포함시킨다(계산식 자체는
  불변, 확인 완료). `formatting.ts`의 `buildHighIncomeFormulaWarning`을 직접 재확인했다.
  ```ts
  if (result.bracketMode === "ceilingFixed") {
    return "산정 기준 보수가 간이세액표 조회 구간의 상한 금액(1,000만원)과 정확히 일치합니다"
      + "(상한을 넘어선 것이 아닙니다). 이 지점에 대해 별도로 정해진 고정 세액을 추가 계산"
      + " 없이 그대로 적용했습니다.";
  }
  if (result.bracketMode === "formula") {
    return "산정 기준 보수가 간이세액표 조회 구간 상한을 초과해 별도 계산식으로 근로소득세를"
      + " 계산했습니다. 이 구간은 국세청 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을"
      + " 수 있습니다.";
  }
  ```
  두 경우를 직접 비교했다.
  - **정확히 1,000만원(연봉 1.2억원)**: `annualSalary=120,000,000`(taxableMonthlyPay=
    10,000,000) → `bracketMode="ceilingFixed"` → "정확히 일치합니다(상한을 넘어선 것이
    아닙니다)... 고정 세액을 추가 계산 없이 그대로 적용" — "초과"라는 단어가 없고, 실제
    코드 흐름(`baseIncomeTaxForFamilyKey`가 `highIncomeFormulaTax`를 호출하지 않고
    `baseAmountAtTableCeilingByFamilyCount`를 그대로 반환)과 정확히 일치하는 서술이다.
  - **1,000만원 초과(연봉 1.44억원 등)**: `annualSalary=144,000,000`(taxableMonthlyPay=
    12,000,000) → `bracketMode="formula"` → "상한을 초과해 별도 계산식으로... 계산했습니다"
    — 실제로 `highIncomeFormulaTax`가 브래킷 탐색·초과금액×계수·가산액을 계산하는 코드
    흐름과 정확히 일치하는 서술이다.
  - `formatting.test.ts` L68-85에 이 두 케이스를 정확히 겨냥한 테스트가 있다: L68-74는
    `annualSalary=144_000_000`에서 `bracketMode`가 `"formula"`이고 문구에 "초과"가
    포함됨을, L76-85는 `annualSalary=120_000_000`(Golden Test 13과 동일 입력)에서
    `bracketMode`가 `"ceilingFixed"`이고 `incomeTax`가 정확히 1,507,400원이며 문구에
    "초과"가 **없고** "고정 세액"이 포함됨을 단언한다. 두 테스트 모두 실행 결과와 일치함을
    확인했다(라운드 2 테스트 결과 보고에서 5개 신규 테스트에 포함).
  이 세 부분(코드 구현, 실제 재현, 회귀 테스트)이 서로 일치하므로, `buildHighIncomeFormulaWarning`
  자체는 정확히 경계값과 실제 초과 케이스를 정확하게 구분해 설명한다.
- **등급**: 문제없음(`buildHighIncomeFormulaWarning`에 한정, 라운드 1 Medium 이슈 해소 확인).

### 재검증 질문 4. [신규 문제 확인 — 지시문 3번] `bracketMode` 구분이 `buildHighIncomeFormulaWarning`
**외의** 다른 사용자 노출 텍스트에도 일관되게 반영됐는가? (Optimizer가 손대지 않은 인접
텍스트와의 정합성 확인)

- **답변**: `buildHighIncomeFormulaWarning`은 정확히 고쳐졌지만, **같은 결과 화면의 다른
  섹션에 새로운 불일치가 남아있음을 발견했다.** `formatting.ts`의
  `buildAnnualSalaryCalculationSteps`(사용자가 보는 "계산 방법" 카드, 근로소득세 단계의
  `legalBasis`)는 여전히 **2값** `result.incomeTaxSource`만으로 분기한다(라운드 2에서
  전혀 수정되지 않았다, 직접 재확인):
  ```ts
  legalBasis:
    result.incomeTaxSource === "highIncomeFormula"
      ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 초과 구간 산식"
      : "소득세법 시행령 [별표 2] — 근로소득 간이세액표(월급여액 × 공제대상가족의 수)",
  ```
  `incomeTaxSource`는 라운드 1에서 확정된 대로 `bracketMode !== "table"`이면 무조건
  `"highIncomeFormula"`이므로, **정확히 1,000만원 경계값(`bracketMode==="ceilingFixed"`)
  케이스에서도 이 legalBasis는 "세액표 상한 **초과** 구간 산식"이라고 표시된다.** 재현:
  `annualSalary=120,000,000`(정확히 경계) → "공제 내역" 카드의 근로소득세 행 바로 아래에는
  이번에 고친 정확한 문구("정확히 일치합니다... 초과한 것이 아닙니다")가 뜨는데, 화면을
  아래로 스크롤하면(ui.tsx L399 "공제 내역" 카드 다음에 L436 "계산 방법" 카드가 곧바로
  이어진다) 같은 계산의 "계산 방법" 카드 6번째 단계에는 "세액표 상한 초과 구간 산식"이라는
  **정반대 서술**이 legalBasis로 표시된다. 즉 같은 결과 화면 안에서 같은 계산(정확히
  10,000,000원 경계값 근로소득세)에 대해 "상한을 넘어선 것이 아니다"와 "상한 초과 구간
  산식"이라는 서로 모순된 두 문장이 동시에 노출된다.
  - 라운드 0(첫 UX/UI Critic 평가)에서는 이 legalBasis도 `buildHighIncomeFormulaWarning`도
    똑같이 "초과"로 서술해 **적어도 서로 일관되게** 틀려 있었다. 이번 라운드에서
    `buildHighIncomeFormulaWarning`만 고쳐지고 `buildAnnualSalaryCalculationSteps`의
    `legalBasis`는 그대로 남아, 오히려 두 텍스트가 서로 모순되는 **새로운 불일치**가
    생겼다 — 이는 이번 수정으로 인해 발생한 부작용(라운드 0에는 없던 종류의 문제)이다.
  - `formatting.test.ts`/`ui.test.tsx`를 확인한 결과 "계산 방법" 카드의 `legalBasis`
    텍스트 내용을 정확히 경계값 케이스에 대해 단언하는 테스트는 없다(`buildAnnualSalaryCalculationSteps`
    관련 테스트는 `expression` 값만 확인하고 `legalBasis` 문자열 내용은 검증하지 않음) —
    이 모순이 회귀 테스트로 걸러지지 않는다.
- **등급**: Medium. 계산값 자체에는 영향이 없고(Calculation Auditor가 이미 검증한
  `incomeTax` 숫자는 정확), 두 텍스트 모두 사용자에게 노출되는 설명일 뿐이라는 점에서
  Critical/High는 아니다. 다만 (1) 이번 라운드의 목적 자체가 "정확히 경계값과 실제 초과를
  구분해 정확히 설명"하는 것이었는데 결과 화면의 두 곳 중 한 곳만 고쳐져 목적이 절반만
  달성됐고, (2) 같은 화면 안에서 서로 모순되는 두 문장이 동시에 보이는 것은 "용어/설명
  통일성"과 "계산 과정을 이해할 수 있는지" 두 평가 항목을 동시에 위반하며, (3) 이 경계값은
  Q12에서 이미 지적했듯 실사용 빈도가 낮지 않은 라운드 넘버(연봉 1.2억원 등) 입력이라
  실제로 마주칠 가능성이 있다. 새로 발견된 이슈이므로 Medium으로 분류한다.
  - **권고**: `buildAnnualSalaryCalculationSteps`의 근로소득세 단계 `legalBasis`(및 필요하면
    `expression`)도 `result.incomeTaxSource` 대신 `result.bracketMode`로 3분기하도록
    통일한다 — 예: `bracketMode==="ceilingFixed"`일 때 "소득세법 시행령 [별표 2] — 세액표
    상한 금액에 대한 별도 고정 세액"처럼 "초과"라는 표현을 배제한 문구를 추가한다.

### 발견된 이슈 (재검증, 등급별)

| 등급 | 이슈 | 위치 | 상태 |
|---|---|---|---|
| 없음 | 라운드 1 Medium 1("부양가족 수" ↔ "공제대상가족" 용어 불일치) | `formatting.ts`, `content.ts` | **해소 확인** — 사용자 노출 텍스트 전수 재확인, 잔존 "공제대상가족"은 legalBasis·개발자 주석뿐 |
| 없음 | 라운드 1 Medium 2("연말정산 미반영" 고지 저강조) | `ui.tsx` L392 | **해소 확인** — `text-sm font-semibold opacity-100`로 상향, 부작용 없음 |
| 없음 | 라운드 1 Medium 3(`buildHighIncomeFormulaWarning`의 경계값 오설명) | `formatting.ts` (`buildHighIncomeFormulaWarning`) | **해소 확인** — `bracketMode` 3분기로 정확히 경계값/실제 초과 두 경우 모두 정확한 문구, 회귀 테스트 통과 |
| **Medium(신규)** | `buildAnnualSalaryCalculationSteps`(계산 방법 카드)의 근로소득세 단계 `legalBasis`가 여전히 2값 `incomeTaxSource`만 사용해, 정확히 1,000만원 경계값 케이스에서 "세액표 상한 초과 구간 산식"이라고 표시 — 바로 위 "공제 내역" 카드의 (이번에 고쳐진) "상한을 넘어선 것이 아닙니다" 문구와 같은 화면에서 서로 모순됨 | `src/calculators/annual-salary-take-home-pay/formatting.ts` (`buildAnnualSalaryCalculationSteps`, 근로소득세 단계 `legalBasis`) | **신규 발견 — 다음 라운드 반영 권고** |
| Low(유지, 지시 범위 밖) | Calculation Auditor 라운드 1 Low("1억원" 라벨 잔존, `ARCHITECTURE.md`·코드 주석) | `ARCHITECTURE.md`, 각종 주석 | 이번 재검증 지시 범위(Optimizer 라운드 2의 3가지 수정) 밖이라 재확인하지 않음, 기존 분류 유지 |

### 판정: PASS

- 근거: docs/EVALUATION.md PASS 기준 "Critical 0, High 0"을 충족한다. 지시받은 3가지
  수정(용어 통일, 고지 강조, `bracketMode` 구분) 모두 실제로 반영됐고, 특히 지시문이
  요구한 "정확히 1,000만원 경계값과 실제 초과 케이스를 각각 정확히 설명하는지"는
  `buildHighIncomeFormulaWarning`에 한해 코드·재현·회귀 테스트 3중으로 확인했다.
- 이번 재검증에서 새로 발견한 Medium 1건(`buildAnnualSalaryCalculationSteps`의 legalBasis가
  `bracketMode`를 반영하지 않아 "계산 방법" 카드와 "공제 내역" 카드 간 설명이 정확히
  경계값 케이스에서 서로 모순됨)은 계산값에 영향이 없는 순수 설명 텍스트 이슈이므로
  PASS 기준(Critical 0, High 0)을 막지 않는다. 다만 이번 라운드의 목적(경계값 설명
  정확성)을 절반만 달성한 것이므로 다음 Optimizer 라운드에서 반영을 권고한다.
- 라운드 1에서 지적한 Medium 3건은 전부 해소를 확인했다(신규 Medium 1건 제외).

## Optimizer 수정 (라운드 3)

UX/UI Critic 재검증(라운드 1)이 신규 발견한 Medium 1건("계산 방법" 카드의 근로소득세
`legalBasis`가 여전히 2값 `incomeTaxSource`만으로 분기해, 정확히 1,000만원 경계값에서
"공제 내역" 카드의 `buildHighIncomeFormulaWarning`(라운드 2에서 이미 정확히 고쳐짐)과
서로 모순되는 문장을 동시에 보여주는 문제)만 수정했다. 새 기능은 추가하지 않았고,
`logic.ts`의 계산식·`policy.ts`의 값은 전혀 건드리지 않았다.

### 무엇을 바꿨는가

`src/calculators/annual-salary-take-home-pay/formatting.ts`의
`buildAnnualSalaryCalculationSteps` 6번째 단계(근로소득세) `legalBasis`를
`result.incomeTaxSource`(2값: `"table"` | `"highIncomeFormula"`) 기준 2분기에서
`result.bracketMode`(3값: `"table"` | `"ceilingFixed"` | `"formula"`, 라운드 2에서 이미
`types.ts`/`logic.ts`에 신설돼 있던 필드) 기준 3분기로 바꿨다.

```ts
legalBasis:
  result.bracketMode === "formula"
    ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 초과 구간 산식"
    : result.bracketMode === "ceilingFixed"
      ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 금액(1,000만원)과 정확히 일치" +
        "(상한을 넘어선 것은 아님), 고정 세액을 추가 계산 없이 그대로 적용"
      : "소득세법 시행령 [별표 2] — 근로소득 간이세액표(월급여액 × 공제대상가족의 수)",
```

- `bracketMode === "formula"`(실제 상한 초과): 기존 "세액표 상한 초과 구간 산식" 문구를
  그대로 유지했다.
- `bracketMode === "ceilingFixed"`(정확히 1,000만원 경계): 새 문구를 추가했다.
  `buildHighIncomeFormulaWarning`이 이미 쓰는 "정확히 일치합니다(상한을 넘어선 것이
  아닙니다)... 고정 세액을 추가 계산 없이 그대로 적용했습니다"와 같은 취지·같은 핵심
  표현("정확히 일치", "고정 세액", "추가 계산 없이 그대로 적용")을 재사용해, 두 카드가
  같은 화면에서 서로 다른 단어를 쓰다가 우연히 다시 모순되는 일을 줄였다. `buildHighIncomeFormulaWarning`과
  마찬가지로 "초과"라는 단어를 의도적으로 배제하고 "상한을 넘어선 것은 아님"이라는
  표현을 썼다(첫 시도에서 "상한 초과 아님"이라고 썼다가 "초과"라는 글자 자체가 포함돼
  테스트가 실패한 것을 발견하고, `buildHighIncomeFormulaWarning`이 쓰는 "넘어선"이라는
  단어로 교체했다 — 아래 테스트 결과 참고).
- `bracketMode === "table"`(표 조회): 기존 문구를 그대로 유지했다.
- `logic.ts`의 계산 로직은 지시대로 전혀 손대지 않았다 — `bracketMode` 필드 자체는
  이미 라운드 2에서 `AnnualSalaryTakeHomePayResult`에 존재했으므로 타입 변경도 없었다.

### 테스트

`formatting.test.ts`의 `buildAnnualSalaryCalculationSteps` describe 블록에 테스트 3개를
추가했다.

1. **정확히 경계값(연봉 1억 2천만원, 가족 1명)**: `result.bracketMode`가 `"ceilingFixed"`임을
   확인하고, 근로소득세 단계(`steps[5]`)의 `legalBasis`가 "초과"를 포함하지 않고
   "정확히 일치"와 "고정 세액"을 포함함을 단언한다.
2. **초과 케이스(연봉 1억 4,400만원)**: `result.bracketMode`가 `"formula"`임을 확인하고,
   `legalBasis`가 "상한 초과 구간 산식"을 포함하고 "정확히 일치"를 포함하지 않음을
   단언한다.
3. **두 케이스의 `legalBasis` 문자열이 서로 달라야 한다**는 직접 비교 테스트를 추가해,
   "계산 방법" 카드 안에서 두 경계 상태가 실제로 구분되는 문구를 내는지(즉 이전처럼
   두 케이스가 같은 문구로 뭉뚱그려지지 않는지) 회귀 방지했다.

### 테스트 결과

- `npx vitest run --no-file-parallelism src/calculators/annual-salary-take-home-pay`:
  **5개 파일, 76개 테스트 전부 통과**(기존 73개 + 신규 3개). 첫 실행 시 신규 테스트
  1개가 실패해(위에 기록한 "초과 아님" 문자열에 "초과" 글자가 포함된 문제) 문구를
  "넘어선 것은 아님"으로 교체한 뒤 재실행해 전부 통과를 확인했다.
- `npx vitest run --no-file-parallelism`(전체 스위트): **53개 파일, 545개 테스트 전부
  통과**.
- `npx tsc --noEmit`: 오류 없음.
- `npm run build`: 성공(`Compiled successfully`, TypeScript 통과, 16개 페이지 생성).

### 수정 파일

- `src/calculators/annual-salary-take-home-pay/formatting.ts`
  (`buildAnnualSalaryCalculationSteps`의 근로소득세 단계 `legalBasis`를 `incomeTaxSource`
  2분기에서 `bracketMode` 3분기로 변경)
- `src/calculators/annual-salary-take-home-pay/formatting.test.ts` (신규 테스트 3개 추가)

### 반영하지 않은 것(지시 범위 밖)

- Calculation Auditor 라운드 1이 남긴 Low 이슈("1억원" 라벨 잔존, `ARCHITECTURE.md`·코드
  주석)는 이번 라운드 지시(UX/UI Critic 재검증 라운드 1의 신규 Medium 1건)에 포함되지
  않아 손대지 않았다.
- 이번 지시가 `legalBasis`만 지목했으므로 같은 단계의 `expression` 문구는 건드리지
  않았다(이미 `bracketMode`와 무관하게 정확한 값을 보여주고 있어 수정 대상이 아니었다).

최종 PASS/FAIL 판정은 하지 않는다 — Calculation Auditor → UX/UI Critic → QA 순서로
재검증한다.

## UX/UI Critic 재검증 (라운드 2)

Edit 권한 없이 `src/calculators/annual-salary-take-home-pay/formatting.ts`만 다시 읽고,
"Optimizer 수정 (라운드 3)"이 보고한 단일 수정(`buildAnnualSalaryCalculationSteps` 6번째
단계 `legalBasis`의 `incomeTaxSource` 2분기 → `bracketMode` 3분기 전환)이 실제로 반영돼
라운드 1에서 신규 발견한 Medium 이슈(같은 결과 화면의 "계산 방법" 카드와 "공제 내역"
카드가 정확히 1,000만원 경계값에서 서로 모순된 문구를 보였던 문제)를 해소했는지만
재확인했다. 지시대로 처음부터 10개 질문을 새로 만들지 않고 이 항목 하나만 재검증한다.

### 재검증 질문. [계산 과정 breakdown 이해 가능성 / 용어·설명 통일성 | 라운드 1 신규 Medium
재확인] "계산 방법" 카드(`buildAnnualSalaryCalculationSteps`)와 "공제 내역" 카드
(`buildHighIncomeFormulaWarning`)가 정확히 1,000만원 경계값과 실제 초과(1,000만원 초과)
두 경우 모두에서 서로 모순 없이 일관된 문구를 보여주는가?

- **답변**: `formatting.ts`를 다시 읽고 두 함수를 나란히 대조했다.
  ```ts
  // buildAnnualSalaryCalculationSteps 6번째 단계(근로소득세) legalBasis
  legalBasis:
    result.bracketMode === "formula"
      ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 초과 구간 산식"
      : result.bracketMode === "ceilingFixed"
        ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 금액(1,000만원)과 정확히 " +
          "일치(상한을 넘어선 것은 아님), 고정 세액을 추가 계산 없이 그대로 적용"
        : "소득세법 시행령 [별표 2] — 근로소득 간이세액표(월급여액 × 공제대상가족의 수)",
  ```
  ```ts
  // buildHighIncomeFormulaWarning
  if (result.bracketMode === "ceilingFixed") {
    return "산정 기준 보수가 간이세액표 조회 구간의 상한 금액(1,000만원)과 정확히 일치합니다" +
      "(상한을 넘어선 것이 아닙니다). 이 지점에 대해 별도로 정해진 고정 세액을 추가 계산" +
      " 없이 그대로 적용했습니다.";
  }
  if (result.bracketMode === "formula") {
    return "산정 기준 보수가 간이세액표 조회 구간 상한을 초과해 별도 계산식으로 근로소득세를" +
      " 계산했습니다. 이 구간은 국세청 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을" +
      " 수 있습니다.";
  }
  ```
  두 함수 모두 이제 **같은 `result.bracketMode` 필드**로 분기하므로 두 카드가 같은 계산
  결과에 대해 서로 다른 신호(2값 vs 3값)를 참조할 위험 자체가 제거됐다. 실제 문구를 두
  케이스에 대해 직접 대조했다.
  - **정확히 경계값(연봉 1억 2천만원, `taxableMonthlyPay=10,000,000`, `bracketMode=
    "ceilingFixed"`)**: "계산 방법" 카드 legalBasis는 "상한 금액(1,000만원)과 정확히
    일치(상한을 넘어선 것은 아님), 고정 세액을 추가 계산 없이 그대로 적용"이라 하고,
    "공제 내역" 카드 경고는 "상한 금액(1,000만원)과 정확히 일치합니다(상한을 넘어선
    것이 아닙니다)... 고정 세액을 추가 계산 없이 그대로 적용했습니다"라고 한다. 두
    문장 모두 (1) "초과"라는 단어가 없고, (2) "정확히 일치"·"상한을 넘어선 것이 아님"
    이라는 같은 취지를 명시적으로 반복하며, (3) "고정 세액을 추가 계산 없이 그대로
    적용"이라는 핵심 표현을 문자 그대로 공유한다. 라운드 1에서 지적했던 "한쪽은 '일치',
    다른 쪽은 '초과'"라는 정반대 서술이 더 이상 존재하지 않는다.
  - **실제 초과(연봉 1억 4,400만원, `taxableMonthlyPay=12,000,000`, `bracketMode=
    "formula"`)**: "계산 방법" 카드는 "세액표 상한 초과 구간 산식", "공제 내역" 카드는
    "상한을 초과해 별도 계산식으로 근로소득세를 계산했습니다"라고 한다. 두 문장 모두
    "초과"·"산식/계산식"을 공통으로 쓰며 서로 모순되지 않는다(라운드 1 이전부터 이미
    일치했던 케이스이고, 이번 수정으로도 깨지지 않았음을 재확인).
  - `bracketMode === "table"`(표 조회, 예: 월급여 500만원대) 케이스는 "계산 방법" 카드만
    문구를 내고(`buildHighIncomeFormulaWarning`은 `null` 반환, 애초에 화면에 표시되지
    않음) 비교 대상 문장 자체가 하나뿐이라 모순 가능성이 없다.
  - `formatting.test.ts`(라운드 3에서 추가된 3개 테스트, L44-73 부근)를 다시 확인해
    두 케이스(`annualSalary=120_000_000`/`144_000_000`)에서 `legalBasis`가 "초과" 포함
    여부·"정확히 일치"/"고정 세액" 포함 여부를 정확히 단언하고 있음을 재확인했다 — 이번
    재검증에서 직접 읽은 코드와 회귀 테스트 단언이 서로 일치한다.
  세 갈래(`table`/`ceilingFixed`/`formula`) 모두에서 "계산 방법" 카드와 "공제 내역" 카드
  사이에 새로운 모순을 찾지 못했다.
- **등급**: 문제없음(라운드 1 신규 Medium 이슈 해소 확인).

### 발견된 이슈 (재검증, 등급별)

| 등급 | 이슈 | 위치 | 상태 |
|---|---|---|---|
| 없음 | 라운드 1 신규 Medium(`buildAnnualSalaryCalculationSteps`의 legalBasis가 `incomeTaxSource` 2분기만 사용해 정확히 1,000만원 경계값에서 "공제 내역" 카드와 모순되는 문구를 보임) | `src/calculators/annual-salary-take-home-pay/formatting.ts` (`buildAnnualSalaryCalculationSteps`, `buildHighIncomeFormulaWarning`) | **해소 확인** — 두 함수 모두 동일한 `bracketMode` 3값으로 분기하도록 통일됨. 정확히 경계값(연봉 1.2억원)·실제 초과(연봉 1.44억원) 두 케이스 모두 코드를 직접 대조해 "계산 방법" 카드와 "공제 내역" 카드의 문구가 핵심 표현("정확히 일치"/"상한을 넘어선 것은 아님"/"고정 세액을 추가 계산 없이 그대로 적용" vs "초과"/"별도 계산식")을 공유하며 서로 모순되지 않음을 확인 |

### 판정: PASS

- 근거: docs/EVALUATION.md PASS 기준 "Critical 0, High 0"을 충족한다. 라운드 1에서
  새로 발견했던 유일한 Medium 이슈(같은 화면 내 "계산 방법"·"공제 내역" 카드의 모순된
  경계값 설명)가 Optimizer 라운드 3 수정으로 완전히 해소됐음을 코드 직접 대조로 확인했다.
- 이번 재검증은 지시받은 단일 항목(경계값 문구 일관성)에 한정했으며, 그 결과 신규로
  발견한 이슈는 없다. 이전까지 누적된 Low 이슈(부양가족 helpText 구체 예시 부족,
  전문용어 정의 순서, 4대 보험 항목별 1줄 설명 부재, "1억원" 라벨 잔존 — Calculation
  Auditor 소관)는 이번 재검증 범위 밖이므로 재확인하지 않았고 기존 분류를 그대로 유지한다.
- **이 계산기의 UX/UI Critic 단계 최종 판정: PASS.** 지금까지의 모든 라운드(최초 평가
  → 라운드 1 재검증 → 라운드 2 재검증)를 통틀어 Critical/High 이슈는 한 번도 발견되지
  않았고, 발견된 Medium 이슈(용어 불일치, 고지 강조 부족, 경계값 설명 부정확 2건)는
  전부 후속 Optimizer 라운드에서 해소가 확인됐다. 남은 것은 Low 등급 개선 권고뿐이며
  PASS 판정을 막지 않는다.

## 점수 (오케스트레이터, 2026-09-06)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor 재검증 PASS. law.go.kr 원문 PDF를 직접 다운로드해 프로그램적으로 파싱한 646행 세액표(수기 전사 아님, 구조 무결성·단조성 전수 검사 통과), Golden Test 13/13, `four-major-insurance` 리팩터링 회귀 0건. 정확히 월급여 1,000만원 경계값에서 25,000원 과다 계산되던 재현 가능한 버그를 실제로 발견·수정·4갈래 재검증까지 완료. "확인 필요" 잔여 5건(11명 초과 음수 처리 근거, 1,000만원 초과 산식 절사 단위, 자녀 나이 판정 시점, data.go.kr 2026년판 ID, 홈택스 실측 대조)은 정직하게 미확정 표시된 채 남아 있어 −1. |
| 예외/경계값 처리 | 15 | **15** | 4대 보험 상하한, 세액표 최저구간 0원, 자녀세액공제 0원 floor, 11명 초과 산식, 정확히 1,000만원 경계(수정 완료), 음수 실수령액 경고 추가 — 전부 Golden Test로 고정. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic 최종 PASS(Critical/High 0, 라운드 거듭할수록 Medium 전부 해소: 용어 통일, 고지 강조, 경계값 설명 일관성). 남은 Low(전문용어 정의 순서, 4대 보험 항목별 1줄 설명 부재 등)로 −1. |
| 모바일/반응형 | 10 | **9** | 표준 그리드 패턴 준수, 코드 분석상 가로 스크롤 요소 없음. 실기기 브라우저 렌더링 미검증(Playwright 부재, 기존 계산기들과 동일한 사유)으로 −1. |
| 접근성 | 5 | **5** | label 연결, aria-live, role="alert", 키보드 포커스, 공용 컴포넌트 접근성 패턴 그대로 재사용. |
| 성능/안정성 | 5 | **5** | Console Error 0, TypeScript Error 0, `npm run build` 성공, 순수 정수·정수분수 연산. |
| 설명/계산 근거 | 5 | **5** | 계산 방법 단계별 breakdown, 정책 특례·경고 카드, 두 기준일(4대보험/간이세액표) 분리 고지. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`), FAQ JSON-LD 등록, canonical, 공통 페이지 구조 준수. |
| 코드 품질/유지보수성 | 5 | **5** | `src/lib/social-insurance.ts` 추출로 `four-major-insurance`와 로직 공유(중복 없음, 회귀 검증 완료), `policy.ts` 매직 넘버 없음, 대용량 세액표 별도 파일 분리, 오류 발견 시 근거를 코드/문서에 투명하게 기록. |
| **총점** | 100 | **97** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 97 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Auditor·Critic·QA 전부 최종 재검증에서 0 ✅ |
| Golden Test 100% | 13/13 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | ✅ |

**판정: PASS**
개선 Loop 횟수: 3/5 (Auditor 대상 경계값 버그 1회, Critic+QA 잔여 이슈 배치 1회, Critic 후속 모순 1회 — 최대 5회 이내)

### 남은 후속 과제 (발행 비차단)

- FORMULA.md "확인 필요" 잔여 5건: 11명 초과 시 결과가 음수인 경우 0원 처리의 명문 근거, 1,000만원
  초과 산식의 정확한 원 단위 절사 규칙, 8~20세 자녀 나이 판정 시점의 세부 실무 규정, data.go.kr
  공공데이터포털 2026년판 기계판독 데이터셋 ID, 국세청 홈택스 자동계산기와의 실측 대조.
- `ARCHITECTURE.md`의 "1억원" 오기는 상단에 정정 각주를 추가해 이력을 보존하되 실제 수치는
  `policy.ts` 기준임을 명시했다(오케스트레이터, 2026-09-06). 코드·FORMULA.md는 이미 "1천만원"으로
  전부 정정 완료.
- 남은 Low 등급 UX 개선(전문용어 정의 순서, 4대 보험 항목별 1줄 설명, 부양가족 helpText 구체 예시).
- 다음 정기 재검토: 2027-01-01 또는 간이세액표/4대보험 요율 개정 시(PROGRESS.md 반영됨).
개선 Loop 횟수: N/5
