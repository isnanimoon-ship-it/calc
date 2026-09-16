# EVALUATION: 예금·적금 이자 계산기 (deposit-savings-interest-calculator)

## Builder 구현 완료

2026-09-15, Builder가 승인된 SPEC.md/FORMULA.md/ARCHITECTURE.md를 그대로 구현했다. 아래는
구현 사실 기록이며 **최종 정확성 판정이 아니다** — 최종 판정은 Calculation Auditor·QA의
몫이다(`.claude/agents/builder.md`). "테스트 통과"라고 적어도 Calculation Auditor·QA는 이를
그대로 신뢰하지 않고 독립적으로 재검증해야 한다.

### 구현 파일

- `src/calculators/deposit-savings-interest-calculator/types.ts` — Architect 산출물, 수정
  없이 그대로 사용했다.
- `src/calculators/deposit-savings-interest-calculator/logic.ts` — ARCHITECTURE.md "7.2"
  함수 분리 그대로 구현했다: `calculateInterestIncomeTax`(3회 재사용되는 공용 세금 계산) →
  `calculateDepositSimple`/`calculateDepositCompound`(예금 단리/월복리) →
  `buildSavingsSchedule`(회차별 breakdown, 로컬 전용) → `sumScheduleDisplayInterest`(순수
  집계) → `calculateSavings`(적금, 총합은 반드시 `src/lib/installment-savings.ts`의
  `calculateInstallmentSimpleInterestTotal`을 그대로 import해서 사용 — 로컬 재구현 없음) →
  `calculateDepositSavingsInterest`(공개 진입점, `mode`/`interestType`으로 분기). 이자소득세율
  (14%/10%)은 하드코딩하지 않고 `src/data/rates-2026.json`의 `interestIncomeTax` 네임스페이스를
  `national-pension-benefit-estimate/logic.ts`와 동일한 패턴(`rates2026.interestIncomeTax`)으로
  참조한다.
- `src/calculators/deposit-savings-interest-calculator/validation.ts` — FORMULA.md "입력값"
  표의 상·하한(예치금액 10,000~10,000,000,000, 월 납입액 10,000~50,000,000, 연이율 0~30,
  기간 1~120)을 그대로 구현했다. `mode`에 따라 `principal`+`interestType` 또는
  `monthlyContribution`만 검증하고, 공통 필드(`annualRatePercent`/`termMonths`)는 항상
  검증한다. 연이율 0%·기간 1개월은 하한이 아니라 유효한 경계값으로 통과시킨다.
- `src/calculators/deposit-savings-interest-calculator/formatting.ts` — `logic.ts`가 이미
  확정한 정수를 재반올림 없이 `Intl.NumberFormat`으로만 표시한다. `buildDepositSavingsInterestBreakdown`이
  모드·계산방식별로 다른 계산 근거 단계를 조립하고, 이자소득세 단계에는 실제 법령 조문
  (소득세법 제129조, 지방세법 제103조의13)을 `legalBasis`로 넣는다.
  `formatScheduleSumNotice`는 ARCHITECTURE.md "4." 옵션 1(실제 차이를 계산해 안내)을 채택해
  `sumScheduleDisplayInterest`로 실제 차이 유무·금액을 계산한 뒤 문구를 조립한다.
- `src/calculators/deposit-savings-interest-calculator/content.ts` — SPEC.md가 정의한 helpText
  문구, FAQ 7문항(질문 SPEC.md, 답변 FORMULA.md "FAQ 답변 근거") 그대로 옮겼다.
- `src/calculators/deposit-savings-interest-calculator/ui.tsx` — ARCHITECTURE.md "8." 화면
  순서(모드 토글 → 공통 입력(연이율→기간) → 모드 전용 입력 → 공유 → 계산 버튼 → 핵심 결과
  카드 → (적금) 회차별 표 → 계산 근거 → 소개/사용법 → 정책 안내 → FAQ) 그대로 구현했다.
  적금 회차별 표는 ARCHITECTURE.md "8.2" 그대로 `<table>` + `max-h-[420px] overflow-y-auto` +
  `sticky top-0` 헤더로 구현했다(모바일 카드 전환 없음).
- `src/data/rates-2026.json` — Architect가 이미 신설한 `interestIncomeTax` 네임스페이스를
  수정 없이 그대로 사용했다.
- `src/lib/installment-savings.ts` — Architect가 이미 작성한 공용 함수를 수정 없이 그대로
  import해서 사용했다(아래 "Golden Test"의 `logic.shared-import.test.ts`가 이를 직접 증명한다).
- `src/calculators/registry.ts` — `deposit-savings-interest-calculator`를 `status: "draft"`,
  `category: "finance"`, `icon: "calculator"`로 신규 등록했다(Architect가 이미 근거를 남긴
  아이콘 선택을 그대로 채택 — finance 카테고리의 기존 3개 키(coins/chart/trend)와 구분).
- `src/calculators/calculator-components.ts`, `app/calculators/[slug]/page.tsx` — 다른
  계산기와 동일한 패턴으로 UI 컴포넌트 매핑과 FAQPage JSON-LD 매핑을 추가했다.
- `PROGRESS.md` — 이 계산기 행의 "Build" 열을 TODO → PASS로 갱신했다(Audit/UX/QA는 여전히
  TODO, Status는 "IN PROGRESS" 유지).

### 발견하고 수정한 문제 — 부동소수점 `Math.floor` 경계 오류 (Golden Test로 발견)

FORMULA.md/ARCHITECTURE.md 어디에도 명시되지 않았던 문제를 Golden Test 작성 중 직접
발견했다: 예금 단리·월복리의 세전 이자(raw)가 **수학적으로 정확히 정수**가 되어야 하는
입력 조합에서도, 부동소수점 나눗셈·거듭제곱 연산의 표현 오차 때문에 실제 계산 결과가 그
정수보다 아주 조금(상대오차 ~1e-15~1e-10 수준) 작게 나오는 경우가 있었다.

- **재현**: 예제 12(`principal=5,000,000, rate=6%, termMonths=1`, 월복리)의 raw 값은
  수학적으로 정확히 `25,000`이어야 하지만, 실제 `Math.pow(1.005, 1)` 계산 결과로
  `24999.99999999947`이 나왔다 — `Math.floor`를 그대로 적용하면 `24,999`(정답보다 1원 작음)가
  된다. 예제 17(`principal=100,000, rate=0.12%, termMonths=1`, 단리)도 동일한 성격의 문제로
  `9.999999999999998` → `Math.floor` → `9`(정답 `10`보다 1원 작음)가 나왔다. 두 사례 모두
  최초 구현에서 Golden Test가 즉시 실패해 발견했다.
- **수정**: `logic.ts`에 `floorPreTaxInterest(rawInterest) = Math.floor(rawInterest + 1e-6)`
  헬퍼를 추가해 예금 단리·월복리 두 함수 모두에 적용했다. epsilon(1e-6)은 FORMULA.md 입력
  범위(연이율 소수 둘째 자리까지, 개월수·원금 정수)에서 세전 이자의 진짜 최소 양의 소수부
  (`1/120,000 ≈ 0.0000083`)보다 한 자리 작게 잡아, "원래 정수인데 부동소수점 오차로 정수
  미만이 된 경우"만 보정하고 "진짜 비정수 값"을 잘못 올림하지 않도록 했다.
- **수정 후 검증**: 예제 4·5·6(월복리, 진짜 비정수 raw 값 — `50,062.5`, `304,159.569...`,
  `344,888.824...`)의 기대값이 epsilon 적용 전후로 전혀 바뀌지 않음을 직접 계산해 확인했다
  (모두 정수 경계에서 충분히 떨어진 값이라 1e-6 보정의 영향을 받지 않는다).
- **남은 잔여 위험(완전히 배제하지 못함)**: 원금이 입력 상한(100억원)에 가깝고 연이율·기간도
  상한(30%·120개월)에 가까운 극단적으로 큰 세전 이자 조합(ARCHITECTURE.md "2."가 예시로 든
  ~1,835억원 규모)에서는, 부동소수점 자체의 절대오차가 이 epsilon(1e-6)과 비슷하거나 더 큰
  규모로 커질 수 있어 이론적으로는 여전히 ±1원 수준의 오차 가능성을 완전히 배제하지 못한다.
  실무적으로는 결과값 규모(수천억원) 대비 무시할 수 있는 수준이나, 정직하게 아래 "Calculation
  Auditor 인수인계 — 최우선 체크리스트"에 남긴다.

### Golden Test / Edge Case Test

- `logic.test.ts` — FORMULA.md 검증 예제 1~17(오류 케이스 5종 제외)을 전부 구현했다. 예제
  5·6은 FORMULA.md 원문이 스스로 "손계산 근사치"라고 명시했으므로, ARCHITECTURE.md "11. 정밀
  재계산 확정값"(Node.js `Math.pow` 직접 계산 확정값)을 그대로 사용했다:
  - 예제 5: `preTaxInterest=304,159`, `incomeTax=42,582`, `localIncomeTax=4,258`,
    `afterTaxInterest=257,319`, `afterTaxMaturityAmount=10,257,319`.
  - 예제 6: `preTaxInterest=344,888`, `incomeTax=48,284`, `localIncomeTax=4,828`,
    `afterTaxInterest=291,776`, `afterTaxMaturityAmount=1,291,776`.
  - 예제 8(1pic.kr 대조, 반올림 정책의 결정적 근거): 지방소득세가 사사오입으로 `1,593`(절사
    였다면 `1,592`)이 되는지를 명시적으로 검증했다.
  - 예제 17(극소액, 소액부징수 미적용): `preTaxInterest=10 → incomeTax=1 →
    localIncomeTax=0`을 검증했다.
  - `buildSavingsSchedule`의 fencepost 규칙(1회차=n개월, 마지막 회차=1개월)과
    `sumScheduleDisplayInterest`의 순수 집계 동작도 별도로 검증했다.
- `logic.shared-import.test.ts` — `calculateSavings`가 `src/lib/installment-savings.ts`의
  `calculateInstallmentSimpleInterestTotal`을 **실제로 import해서 호출**하는지(로컬 재구현이
  아닌지)를 `vi.mock`으로 그 모듈을 모킹해 반환값(999)이 `preTaxInterest`에 그대로 반영되는지,
  그리고 실제 인자(`monthlyContribution, annualRatePercent, termMonths`)로 호출되는지를
  직접 증명한다(`minimum-wage-calculator/logic.shared-import.test.ts`와 동일한 패턴 — 단순
  결과값 비교로는 "우연히 같은 산식을 로컬에 재구현했을 가능성"을 배제할 수 없기 때문).
- `validation.test.ts` — FORMULA.md 검증 예제 18(입력 오류 5종: 예치금액 0, 연이율 음수,
  기간 0, 계산방식 미선택, 월 납입액 음수)을 모두 구현했고, 추가로 모든 입력 필드의 상·하한
  경계값(정확히 하한/상한은 통과, 그보다 1 벗어나면 실패)과 형식 오류(숫자 아님, 빈 값,
  소수 셋째 자리)를 검증했다.
- `ui.test.tsx` — 계산 정확성 자체는 위 `logic.test.ts`가 담당하므로, 여기서는 모드 토글
  전환 시 필드 구성이 바뀌는지, 샘플 값 채우기 → 계산 → 초기화 흐름이 끊기지 않는지, 필수값
  누락 시 필드별 오류가 표시되는지, 월복리 선택 시 월이율이 함께 표시되는지, 적금 모드에서
  회차별 표(13행=헤더 1행+12회차)가 렌더링되는지만 스모크 테스트로 확인했다.

### 실행 결과

- `npx tsc --noEmit`: 클린(에러 0건). 최초 구현 시 `DepositInput`의 평평한(non-nested)
  `interestType` 필드 설계(ARCHITECTURE.md "1.1"이 의도적으로 선택) 때문에
  `input.interestType === "simple"` 비교만으로는 TypeScript가 `input` 전체를 교차 타입으로
  좁혀주지 않는 에러 2건이 발생했다 — 판별 프로퍼티가 유니온 태그가 아니라 단일 인터페이스의
  리터럴 유니온 필드이기 때문(TypeScript의 알려진 제약). `calculateDepositSavingsInterest`
  내부에서 이미 조건으로 확인한 지점에 한해 `as DepositInput & {interestType: "simple"|
  "compound"}` 타입 단언을 추가해 해소했다(타입을 바꾸지 않고 호출부에서만 처리).
- `npx vitest run --no-file-parallelism`: **94개 테스트 파일 · 1,324개 테스트 전부 통과**
  (기존 93개 파일·1,318개 테스트 + 이 계산기의 신규 4개 파일·49개 테스트). 특히
  `military-salary/logic.test.ts`의 기존 Golden Test가 회귀 없이 통과함을 재확인했다(이번
  라운드는 Architect가 이미 `installment-savings.ts` 추출 회귀 검증을 마쳤고, Builder는
  `military-salary` 관련 파일을 전혀 건드리지 않았다).
- `npm run build`: 성공. `deposit-savings-interest-calculator`는 `status: "draft"`라
  `generateStaticParams()`(published만 포함) 대상에서 자동으로 빠지지만, `calculatorComponents`
  맵에는 등록돼 있어 URL 직접 접근 시 요청 시점 렌더링으로 확인 가능하다(다른 draft 계산기와
  동일한 관례).
- `npx eslint .`: 에러 0건. 경고 1건(`jsx-a11y/role-supports-aria-props` — `role="radio"`
  input에 `aria-required` 속성 사용)만 발생했는데, 이는 이 사이트의 기존
  `loan-interest-calculator/ui.tsx`(457번째 줄)·`bmr-calculator/ui.tsx` 등도 동일하게 갖고
  있는 기존 패턴이라 회귀가 아니다(전체 프로젝트 lint 결과 총 6건의 동일 종류 경고, 이번
  라운드로 추가된 것은 1건).

### 판단이 필요했던 애매한 지점 (다음 역할이 참고할 것)

1. **기간(termMonths) 입력 UX — "개월" 단일 입력 필드로 결정**. SPEC.md/ARCHITECTURE.md
   모두 "개월 직접 입력 또는 년+개월 조합 중 Architect/Builder 결정"이라고 명시적으로
   위임했다. `loan-interest-calculator`는 기간 상한이 480개월(40년)로 길어 "년+개월" 조합을
   택했지만, 이 계산기는 상한이 120개월(10년)로 상대적으로 짧고, FORMULA.md 검증 예제 대부분이
   "12개월", "60개월"처럼 개월 수 자체로 표현되어 있어 사용자가 "개월"에 직접 입력하는 편이
   더 직관적이라고 판단했다. 단일 숫자 입력 하나로 끝나 구현 복잡도(정규화 로직 등)도 줄었다.
   UX/UI Critic이 실제 사용성 관점에서 재검토할 수 있다.
2. **핵심 결과 카드의 판별 유니온 분기 — mode 레벨 2분기만 구현, interestType 레벨 중첩
   switch는 생략**. ARCHITECTURE.md "8.1" 6번은 "`result.mode`(및 deposit이면
   `result.interestType`)로 분기해... TypeScript exhaustiveness 체크의 도움을 받는 switch"를
   권고했다. 실제 구현에서는 `result.mode`에 대한 exhaustive switch(2분기: deposit/savings)만
   두고, 예금 내부에서는 `result.interestType === "compound"` 조건부 렌더링으로 `monthlyRate`
   행을 추가하는 방식을 택했다 — 단리/월복리 결과 화면은 96% 이상 동일한 마크업(원금·세전
   이자·이자소득세·세후 이자·연이율·기간·계산방식)을 공유하고 차이는 "월이율 행 하나"뿐이라,
   별도 컴포넌트로 완전히 분기하면 오히려 중복 JSX가 늘어난다고 판단했다. 타입 안전성은
   여전히 보장된다 — `result.interestType === "compound"`로 좁혀진 블록 안에서만
   `result.monthlyRate`에 접근하므로, 단리 결과에서 `monthlyRate`에 접근하는 코드는 애초에
   컴파일되지 않는다. Calculation Auditor/UX/UI Critic이 이 단순화가 ARCHITECTURE.md의 의도를
   충분히 만족하는지 재검토할 수 있다.
3. **회차별 표 합계 고지 — ARCHITECTURE.md "4." 옵션 1(실제 차이 계산) 채택**. 옵션 2(정적
   문구만)도 허용됐지만, `sumScheduleDisplayInterest`가 이미 순수 집계 함수로 존재하므로
   실제 차이 유무·금액을 계산해 사용자에게 더 정확한 정보를 준다고 판단해 옵션 1을 택했다.
   차이가 없는 계산(우연히 행별 합계와 세전 이자가 원 단위까지 일치하는 경우)에는 "차이가
   없습니다"로 표시된다.
4. **부동소수점 `Math.floor` epsilon 보정(위 "발견하고 수정한 문제" 참고)** — FORMULA.md/
   ARCHITECTURE.md 어디에도 명시되지 않았던 새로운 판단이다. Calculation Auditor가 이
   보정 로직 자체(epsilon 크기 선택 근거, 극단값에서의 잔여 위험)를 최우선으로 재검증할
   것을 권장한다.

### Calculation Auditor 인수인계 — 최우선 체크리스트

FORMULA.md가 이미 남긴 "확인 필요 목록" 6개 항목(그대로 미해결 상태이며, Builder 권한 밖):

1. **세전 이자 원 단위 절사(버림)의 완전한 법적/약관 근거 부재** — `military-salary`의
   `floor()` 선례를 따랐을 뿐, 구체적 법령 조항·은행 표준약관 원문은 확인되지 않았다.
2. **이자소득세·지방소득세 반올림 방향(사사오입)의 완전한 1차 법적 근거 부재** — 제3자
   계산기 1pic.kr 실사례 1건(1,592.5원→1,593원)으로만 확정했다.
3. **은행연합회 소비자포털(fsb.or.kr)·금융감독원 파인(fine.fss.or.kr)의 실제 계산 예시 미대조**
   — 두 페이지 모두 JS 기반 대화형 도구라 정적 조회로 구체적 숫자까지 확인하지 못했다.
   Calculation Auditor가 실제 브라우저로 값을 입력해 대조할 것을 FORMULA.md가 권고했다.
4. **소득세법 제129조·지방세법 제103조의13의 정확한 최초 시행일 미확정**.
5. **입력 상·하한(예치금액/월 납입액/연이율/기간)이 법적 강제값이 아닌 UX 방어값** —
   Architect가 조정 없이 그대로 채택했으나 최종 근거는 여전히 "합리적 추정" 수준이다.
6. **예금 월복리 12개월 이상 케이스의 완전한 정수 원 단위 값** — ARCHITECTURE.md "11."이
   Node.js `Math.pow` 정밀 재계산으로 예제 5·6을 확정했고, Builder도 동일한 방식(직접 계산
   스크립트)으로 이 값을 재현해 Golden Test에 반영했다. Calculation Auditor가 독립적으로
   다시 재현할 것을 권장한다.

Builder가 이번 라운드에서 새로 발견한 항목(FORMULA.md/ARCHITECTURE.md에 없던 신규 이슈,
**최우선 확인 요청**):

7. **부동소수점 `Math.floor` epsilon(1e-6) 보정의 안전성** — 위 "발견하고 수정한 문제" 참고.
   특히 (a) epsilon 값(1e-6) 산정 근거(입력 범위상 최소 양의 소수부 `1/120,000`)가 타당한지,
   (b) 원금·연이율·기간이 모두 상한에 가까운 극단적 조합에서 이 보정이 여전히 안전한지(또는
   반대로 "진짜 비정수 값"을 잘못 정수로 올려버리는 새로운 오류를 만들지 않는지) 독립적으로
   재계산해 검증해 줄 것을 요청한다.

## Calculation Auditor

### 검증 방법

Builder의 구현(`logic.ts`, `validation.ts`, `src/lib/installment-savings.ts`)을 FORMULA.md
"공식 1~4"·"계산 순서"와 줄 단위로 대조했다. 이어서 `logic.ts`를 import하지 않는 완전히
독립적인 재구현(Python `math`/`fractions.Fraction`/`decimal.Decimal` 임의정밀도 연산, Node.js
직접 스크립트)으로 FORMULA.md 검증 예제 18개 전부와 경계값·극단값 조합을 재계산해 대조했다
(스크립트는 세션 스크래치패드에 보관, 소스 코드는 수정하지 않음). Bash(`curl`)로 법제처
국가법령정보센터 공식 API(law.go.kr, `OC=test`)와 은행연합회 소비자포털(fsb.or.kr)의 실제
계산 백엔드(JS가 아니라 그 JS가 호출하는 AJAX 엔드포인트 자체)에 직접 접근해 FORMULA.md
"확인 필요 목록" 6개 항목의 격상을 시도했다. 마지막으로 실제 테스트 스위트를 재실행해
Builder의 통과 보고를 독립 재확인했다:
- `npx vitest run src/calculators/deposit-savings-interest-calculator --no-file-parallelism`
  → **4개 파일, 49개 테스트 전부 통과**(재확인).
- `npx vitest run src/calculators/military-salary --no-file-parallelism` → **4개 파일, 17개
  테스트 전부 통과**(재확인, 회귀 없음).

---

### 1. [최우선] 부동소수점 절사 버그와 epsilon 보정의 안전성 — **결론: High(부분 안전, 두 가지 새 결함 발견)**

Python(`math.floor`/`fractions.Fraction`/`decimal.Decimal`)으로 `floorPreTaxInterest(raw) =
Math.floor(raw + 1e-6)`을 독립 재구현하고, Node.js로 실제 `Math.pow` 결과를 직접 확인해
검증했다.

**1-A. FORMULA.md 예제(진짜 소수인 값들)에는 안전함을 확인 — PASS**
예제 4(`50,062.5`), 5(`304,159.569...`), 6(`344,888.824...`) 모두 소수부가 0.4~0.9 범위로
1e-6 epsilon과 충분히 멀리 떨어져 있어 올림 오작동이 없다. 예제 12(`5,000,000×6%×1개월`)·17
(`100,000×0.12%×1개월`)처럼 수학적으로 정확히 정수인 값에서 `Math.pow`/나눗셈이
`24999.99999999947`·`9.999999999999998`을 내는 것도 재현했고, epsilon 보정이 이를 정확히
`25,000`·`10`으로 복원함을 확인했다.

**1-B. 예금 단리·적금에는 epsilon이 (구조적으로) 안전함 — 코드 확인**
`logic.ts`를 읽은 결과 `floorPreTaxInterest`는 `calculateDepositSimple`·
`calculateDepositCompound` 두 곳에만 적용되고, `calculateSavings`는 이 함수를 전혀 쓰지 않는다
(`calculateInstallmentSimpleInterestTotal`이 내부에서 별도로 `Math.floor`만 쓴다 — epsilon
없음). 이는 안전하다: 두 식 모두 나눗셈·곱셈만 있고 지수 연산이 없어(`Builder의 진단과 일치`),
진짜 최소 양의 소수부가 `1/120,000`(예금 단리, 연이율 2자리+월/12) 또는 최대 `1/1,200`(적금,
연이율 2자리+월/12, 닫힌 형이라 분모가 더 단순함)로 epsilon(1e-6)보다 훨씬 커서 이론적으로
"진짜 비정수 값의 오식별" 위험이 없다. 다만 적금은 애초에 epsilon을 쓰지 않으므로 이 논의가
적용될 필요조차 없다(Builder의 서술 "적금에도 적용되는지 확인" 질문에 대한 답: **적용되지
않는다, 그리고 그것이 옳다**).

**1-C. [신규 발견 — Critical 급 논리 결함, 실질 영향은 High] "진짜 소수부"가 epsilon보다 작아
질 수 있어 예금 월복리에서 실제로 잘못된 올림이 발생한다**
Builder의 epsilon 근거("입력 범위상 최소 양의 소수부는 `1/120,000`보다 크거나 같다")는
**단리·적금에는 성립하지만 월복리에는 성립하지 않는다.** 월복리는 `(1+월이율)^개월수`라는
지수 연산을 포함하므로, 진짜(수학적) 값의 분모가 `1200^개월수`까지 커질 수 있어 "진짜
소수부의 하한"이라는 개념 자체가 없다 — 즉 월복리에서는 유효한 입력 조합만으로도 소수부가
epsilon(1e-6)보다 작은 값이 실제로 존재한다. 임의정밀도(`fractions.Fraction`)로 전체 입력
도메인을 탐색해 이를 실증했다:

```
principal=1,000,000, annualRatePercent=23.79, termMonths=5 (모두 FORMULA.md 허용 범위 내:
  연이율 0~30%, 개월 1~120, 원금 10,000~10,000,000,000)
진짜(정확한 유리수) raw = 103,133.9999991958... (정수가 아님, 진짜 floor는 103,133)
Node.js 실제 계산: raw = 103133.99999919582
Math.floor(raw)            = 103,133  ← 올바름
floorPreTaxInterest(raw)   = 103,134  ← 틀림(epsilon이 진짜 비정수 값을 잘못 올림)
```
Node.js로 직접 재현해 확인했다(재현 스크립트는 세션 스크래치패드에 보관). 이 입력은 극단값이
아니다 — 원금 100만원, 기간 5개월은 지극히 평범하고, 연이율 23.79%도 이 계산기가 명시적으로
허용하는 0~30% 범위 안의(특판금리 시나리오를 시뮬레이션하기 위해 상한을 30%로 잡았다고
FORMULA.md가 밝힌) **유효한 입력**이다. 브루트포스 탐색(원금 8종·기간 1~120·연이율 0.01~30%
샘플 다수 조합) 결과 이런 "진짜 소수부가 1에 매우 가까운" 근접 사례가 다수 존재했다(예:
`10,000,000/23.79%/5개월`, `10,000,000/10.44%/8개월`, `100,000,000/7.88%/36개월`,
`5,000,000,000/29.41%/8개월`, `5,000,000,000/15.25%/13개월` 등). 이는
`docs/EVALUATION.md`의 "High: 특정 정상 입력에서 잘못된 결과"에 정확히 해당한다.

**1-D. [신규 발견] Builder가 우려한 "극단값 근처"보다 훨씬 낮은 원금에서 이미 반대 방향
오류(과소 절사)가 발생한다**
Builder는 "100억원/30%/120개월 근처"를 잔여 위험으로 지목했으나, 독립 재계산(`Fraction`
정밀 비교) 결과 실제로는 **원금이 약 30억원(3×10⁹)만 넘어도**, 완전히 평범한 연이율(6%·
10.8%·18%·30%)과 2~3개월의 짧은 기간에서 이미 진짜 정수 정답을 1원 작게 절사하는 사례가
나타난다:
```
principal=9,000,000,000, annualRatePercent=3, termMonths=2
Node.js: raw = 50062499.999998786
Math.pow(1.0025, 2) = 1.0050062499999999 (정확한 1.00500625보다 1e-16 작음 — 원금 곱셈으로
  절대오차가 ~1.2e-6까지 증폭돼 epsilon(1e-6)을 넘어선다)
floorPreTaxInterest(raw) = 50,062,499  ← 틀림(정답 50,062,500보다 1원 작음)
```
100억원(입력 상한)에서는 오차가 더 커진다(`10,000,000,000/3%/2개월` → `50,062,499`, 정답
`50,062,500`). 즉 Builder가 지목한 위험 지점은 방향(연이율·기간도 상한 근처여야 한다는 전제)이
부정확했다 — **원금 하나만 커도(연이율·기간은 평범해도) 발생한다.**

**종합 판정**: epsilon 보정은 "발견 당시의 버그"(진짜 정수값의 과소 절사)는 고쳤지만, (1)
반대 방향의 새 버그(진짜 비정수값의 과다 절사, 1-C)와 (2) 원래 버그의 재발(원금이 클 때, 1-D)
둘 다 완전히 막지 못한다. 영향은 항상 정확히 ±1원으로 국한되고 발생 조건이 좁아(월복리 +
특정 연이율/기간의 우연한 근접, 또는 원금 30억원 이상) 실사용자 체감 영향은 미미하지만,
`docs/EVALUATION.md`의 등급 정의("특정 정상 입력에서 잘못된 결과")를 문자 그대로 충족하는
재현 가능한 결함이므로 **High**로 기록한다. 이는 Builder 구현(로직 자체는 FORMULA.md가
지시하지 않은 Builder 자체 판단)의 문제이므로 "공식 재검토 요청"이 아니라 **Builder 몫의
결함**이다. FORMULA.md/ARCHITECTURE.md는 이 epsilon 기법 자체를 요구한 바 없다.
(참고용 대안: `(1+r)^n − 1` 대신 `Math.expm1(n × Math.log1p(r))`을 쓰면 이 형태의 소거오차
[catastrophic cancellation]가 원천적으로 줄어들 가능성이 있으나, 대안 구현은 Auditor 권한
밖이므로 다음 Builder 라운드에 위임한다.)

---

### 2. FORMULA.md "확인 필요 목록" 6개 재시도 — **3개 항목에서 유의미한 격상, 그 중 1개는 "공식 재검토 요청" 사유 발견**

#### 2-1. 세전 이자 원 단위 절사 근거 (목록 1번) — **부분 격상 + 공식 재검토 요청 사유 발견**
법제처 국가법령정보센터(law.go.kr) 공식 API로 소득세법 시행령 전체 텍스트에서 "원 미만",
"끝수", "단수", "10원" 키워드를 전수 검색했으나 이자소득 원천징수 세액·세전 이자의 절사
단위를 직접 규정한 조항은 발견하지 못했다 — FORMULA.md의 "확인 못함" 판단은 유지된다(추가
탐색으로도 격상 실패, 정직하게 보고).

**다만 curl로 은행연합회 소비자포털(fsb.or.kr)의 실제 계산 백엔드(정적 JS가 아니라 그 JS가
호출하는 AJAX 엔드포인트, `POST https://www.fsb.or.kr/sercalc_0200.jct`)에 직접 접속해
결정적인 새 증거를 확보했다.** 적금 계산기(`ratcalc_0200.act` → `sercalc_0200.jct`,
파라미터 `PRNC`=월납입액, `MN`=개월, `INRT`=연이율, `TP=2`)에 세전 이자가 정수가 아닌 값이
나오도록 설계한 입력을 여러 건 대입한 결과:

```
PRNC=700000, MN=9, INRT=3.17  → 진짜 raw=83,212.5   → fsb 응답 INTS=83,210
PRNC=456000, MN=8, INRT=3.21  → 진짜 raw=43,912.8   → fsb 응답 INTS=43,910
PRNC=500000, MN=7, INRT=3.7   → 진짜 raw=43,166.67  → fsb 응답 INTS=43,160
PRNC=330000, MN=5, INRT=3.33  → 진짜 raw=13,736.25  → fsb 응답 INTS=13,730
```
네 건 모두 `floor(raw/10)×10`(10원 단위 절사)과 정확히 일치하고, 1원 단위 절사와는
일치하지 않는다(재현 curl 명령은 스크래치패드에 보관). 반면 예금 계산기(`sercalc_0100.jct`,
`TP=1`)는 아래 2-2에서 보듯 1원 단위에 가깝게 동작해, **같은 은행연합회 사이트 안에서도
예금·적금 계산기가 서로 다른 절사 단위(1원 vs 10원)를 쓰는 것으로 보인다.**

FORMULA.md가 채택한 근거(예제 8, 1pic.kr `500,000×3.5%×12개월`)의 세전 이자 `113,750`은
공교롭게 10의 배수라서 1원 절사와 10원 절사를 구별하지 못하는 값이었다 — 이 사이트의 다른
검증 예제 7·9·10·11·14·16도 전부 10의 배수였다(우연히 "깔끔한" 입력만 골랐기 때문). 즉
**FORMULA.md의 "1원 단위 절사" 채택은 지금까지 어떤 실증 사례로도 "10원 단위 절사"와
구별된 적이 없었다** — 이번에 처음으로 이를 구별하는 시험값을 설계했고, 그 결과 업계
대표기구인 은행연합회의 실제 도구는 (최소 적금에서는) 10원 단위 절사를 쓴다는 증거가
나왔다. 이는 FORMULA.md "핵심 결정 1"이 국고금관리법·지방세기본법 계열의 10원 절사 관행을
검토 후 명시적으로 기각한 판단과 정면으로 배치되는 새 증거다.

**판정: 이 항목은 "공식 재검토 요청"(Formula Analyst에게 반려) 사유다.** Builder 구현은
FORMULA.md "핵심 결정 1"을 문자 그대로 따랐으므로 Builder FAIL이 아니다. 다만 절사 단위
1원 vs 10원의 차이는 항상 9원 이하이고 세후 만기수령액 기준으로는 그보다도 작은 영향만
남기므로(Critical 아님), Formula Analyst가 재검토하되 v1 출시를 막을 사안은 아니라고 판단한다.

#### 2-2. 이자소득세 반올림 방향(사사오입)의 1차 법적 근거 (목록 2번) — **격상 실패, 그러나 별도의 계산 순서 불일치 발견**
law.go.kr 소득세법 시행령 전수 검색으로도 사사오입을 직접 규정한 조항은 찾지 못했다 —
FORMULA.md의 "확인 못함"은 유지.

**다만 은행연합회 예금 계산기(`sercalc_0100.jct`, `TP=1`)를 실제로 호출해 FORMULA.md 검증
예제 1·3·4·5·6과 동일 입력을 대입한 결과:**
```
10,000,000 / 3%  / 12개월 단리   → fsb RSLT=10,253,800  (Golden Test와 정확히 일치)
50,000,000 / 4%  / 12개월 단리   → fsb RSLT=51,692,000  (Golden Test와 정확히 일치)
10,000,000 / 3.5%/ 12개월 단리   → fsb RSLT=10,296,100  (Golden Test와 정확히 일치)
10,000,000 / 3%  / 2개월  월복리 → fsb RSLT=10,042,352  (Golden Test와 정확히 일치)
10,000,000 / 3%  / 12개월 월복리 → fsb RSLT=10,257,318  (Golden Test는 10,257,319 — **1원 불일치**)
 1,000,000 / 30% / 12개월 월복리 → fsb RSLT=1,291,775   (Golden Test는 1,291,776 — **1원 불일치**)
```
단리·소규모 월복리(2개월)는 완전히 일치하지만, 월복리 12개월의 두 사례 모두 정확히 1원
불일치한다. 역산한 결과, fsb의 방식은 FORMULA.md의 "①세전이자 정수 절사 → ②소득세 14%
사사오입 → ③지방소득세 10%(소득세액 기준) 사사오입"이 아니라, **"①세전이자를 절사하지 않고
전체 정밀도로 유지 → ②15.4% 단일 세율을 그 전체 정밀도 값에 곱해 한 번만 사사오입 → ③세후
금액을 최종적으로만 정수화"**와 정확히 일치한다(예: 예제 5의 raw `304,159.569135...`에
`×0.154`후 반올림하면 `46,841`원, `raw − 46,841 = 257,318.569`, 이를 최종 절사하면
`257,318` — fsb와 정확히 일치). 이는 FORMULA.md "확인 필요 목록 2번"이 요구한 "완전한 1차
근거"는 아니지만(은행연합회도 결국 하나의 구현 사례일 뿐, 법령 원문은 아님), 사사오입이라는
**방향**은 재확인하면서 동시에 **세전 이자를 먼저 절사하는 계산 순서 자체**에 대한 반례를
제공한다.

**판정: 이 항목도 위 2-1과 함께 "공식 재검토 요청" 사유로 묶어 보고한다.** 영향은 항상
1원 이하로 작지만, FORMULA.md "핵심 결정 1"(세전 이자 선절사)과 "핵심 결정 2"(2단계 분리
반올림)라는 두 정책 결정 모두가 실제 업계 도구 중 하나와 다르게 동작함을 보여주는 재현 가능한
1차·준1차 증거이므로, Builder FAIL이 아니라 FORMULA.md 재검토감이다.

#### 2-3. 은행연합회·금감원 파인 실제 계산 예시 대조 (목록 3번) — **완전히 격상(성공)**
`minimum-wage-calculator` 선례를 따라 정적 페이지가 아니라 실제 AJAX 백엔드를 직접
호출하는 방식으로 성공했다. `https://www.fsb.or.kr/ratcalc_0100.act`(예금)·
`ratcalc_0200.act`(적금)가 로드하는 JS(`ratcalc_0100.js`/`ratcalc_0200.js`)를 읽어
`jexjs.createAjaxUtil('sercalc_0100'/'sercalc_0200')` 호출과 `prefix=""`,`suffix=".jct"`
설정(`FSBcomm.js`)을 확인한 뒤, 실제 엔드포인트 `POST /sercalc_0100.jct`(예금, 파라미터
`PRNC`/`MN`/`INTS`(1=단리,2=복리)/`INRT`/`TP=1`)·`POST /sercalc_0200.jct`(적금, 파라미터
`PRNC`/`MN`/`INRT`/`TP=2`)에 curl로 직접 값을 넣어 위 2-1·2-2에 기록한 8건의 실제 계산
결과를 확보했다. `fine.fss.or.kr`은 페이지에서 별도 계산 전용 JS 번들을 정적 grep으로
찾지 못해(SPA 프레임워크로 추정) 이번에는 격상하지 못했다 — 추가 시도는 향후 라운드로
남긴다.

#### 2-4. 소득세법 제129조·지방세법 제103조의13의 정확한 시행일 (목록 4번) — **부분 격상**
law.go.kr 공식 API(`lawService.do`, `OC=test`)로 조문 단위 원문을 직접 조회했다:
- **지방세법 제103조의13(특별징수의무)**: `<조문참고자료>[본조신설 2014.1.1]`을 확인했다.
  현재 시행 중인 항①("원천징수하는 소득세의 100분의 10")에는 그 이후 개정 이력이 없다
  (항②만 2020년대 개정). 즉 **"원천징수 소득세의 10%" 규정은 정확히 2014-01-01 신설되어
  현재까지 문언 변경 없이 유지되고 있음을 1차 출처로 확정한다.** FORMULA.md의 "확인
  못함"에서 완전히 격상.
- **소득세법 제129조("그 밖의 이자소득 14%")**: 정확한 최초 시행일은 여전히 특정하지
  못했으나, 범위를 크게 좁혔다. `bigcase.ai`(법제처 원문을 그대로 미러링하는 판례검색
  서비스, curl로 원문 대조)에서 확인한 결과:
  - **1999-01-01 시행 버전**에는 "기타의 이자소득금액에 대하여는 100분의 **22**"였다(현재
    14%가 아니었다).
  - **2006-09-25 시행 버전**(법률 제7908호)에는 이미 "기타의 이자소득금액에 대하여는
    100분의 **14**"로 현재와 동일하다.
  - 따라서 "그 밖의 이자소득 14%"는 **최소 2006-09-25부터 약 20년간 변경 없이 유지**되고
    있음을 확정할 수 있다(정확한 최초 도입 시점은 1999~2006 사이 어딘가로 좁혔을 뿐 완전
    특정은 못함 — 정직하게 "확인 필요"로 유지하되 범위는 좁혔다).
- **부가 발견(Low, 인용 품질 개선 제안)**: `rates-2026.json`의 두 조문 URL은 `casenote.kr`
  (민간 미러)을 가리키는데, 정부 공식 1차 출처인 `law.go.kr`도 동일 패턴 URL로 접근 가능함을
  확인했다(`https://www.law.go.kr/법령/소득세법/제129조`,
  `https://www.law.go.kr/법령/지방세법/제103조의13` 모두 curl로 HTTP 200 확인). 인용 신뢰도를
  더 높이려면 casenote.kr 대신 law.go.kr을 1차 출처 URL로 바꾸는 것을 권장한다(계산 결과에는
  영향 없음, Low).

#### 2-5. 입력 상·하한 (목록 5번) — **격상 시도하지 않음(범위 밖)**
이 항목은 법적 강제값이 아니라 UX 방어값으로, 1차 법령 조사로 격상될 성격이 아니다(FORMULA.md
스스로도 "Architect가 필요시 조정 가능"이라고 명시했다). 계산 정확성 감사 범위에서 추가 조치
없음.

#### 2-6. 예금 월복리 12개월 이상 케이스의 완전한 정수 값 (목록 6번) — **완전히 격상(성공), 단 위 1번 결함과 연동**
독립 Python(`decimal`, 정밀도 50자리) 및 Node.js `Math.pow` 재계산으로 예제 5·6의 확정값
(`304,159`/`344,888`)을 재현했다 — ARCHITECTURE.md "11."의 값과 정확히 일치한다. 다만 위
2-2에서 보듯 은행연합회 실제 도구와는 세후 최종 금액에서 1원 차이가 나는데, 이는 세전 이자
정수값 자체(304,159/344,888)의 문제가 아니라 그 이후 세금 계산 순서(2-2)의 문제다 — 이
항목(세전 이자 정수 확정) 자체는 PASS로 유지한다.

---

### 3. 핵심 산식 재검증 — **PASS(공식/구현 일치), 위 1·2에서 지적한 두 결함 제외**

독립 Python 스크립트(`math`/`fractions.Fraction`)로 FORMULA.md 예제 1~17을 전부 재계산해
`logic.test.ts`의 실제 Golden Test 값과 전수 대조했다 — **17개 계산 예제 전부 일치**
(오차 없음). 계산 순서도 코드로 직접 확인했다:

- 예금 단리: `principal × (annualRatePercent/100) × (termMonths/12)` — FORMULA.md "공식 1"과
  일치(`logic.ts:92`).
- 예금 월복리: `monthlyRate = annualRatePercent/100/12`, `principal × ((1+monthlyRate)^termMonths
  − 1)` — "공식 2"와 일치(`logic.ts:117-118`), 월이율은 반올림 없이 그대로 지수 연산에 사용.
- 적금 단리 후취식: `src/lib/installment-savings.ts`의 닫힌 형이 `n(n+1)/2`와 대수적으로
  동일함을 직접 대입해 재확인(`calculateInstallmentSimpleInterestTotal`).
- 이자소득세 계산 순서: `calculateInterestIncomeTax`가 `incomeTax = round(preTax×0.14)` →
  `localIncomeTax = round(incomeTax×0.10)` → `afterTax = preTax − incomeTax − localIncomeTax`
  순서를 정확히 그 순서대로 구현했다(`logic.ts:79-85`) — FORMULA.md "공식 4"와 코드가
  1:1 대응한다.
- `src/data/rates-2026.json`의 `interestIncomeTax` 네임스페이스를 직접 열람해 확인했다:
  `incomeTaxRate.value=0.14`, `localIncomeTaxRate.value=0.10`가 정확하고,
  `localIncomeTaxRate.source.url`이 실제로 `https://casenote.kr/법령/지방세법/제103조의13`으로
  **정정되어 있음을 확인했다**(Architect가 주장한 "제103조의29 → 제103조의13 URL 오류 정정"이
  실제 파일에 반영됨, `article` 필드도 처음부터 올바르게 "제103조의13제1항"이었음).
- FORMULA.md 18개 검증 예제 중 예제 8(1pic.kr 대조)을 독립 재계산해 사사오입 방향(1,592.5→
  1,593)을 재확인했다 — `logic.test.ts`의 대응 테스트와 정확히 일치.

---

### 4. military-salary 회귀 확인 — **PASS**

- `src/calculators/military-salary/logic.ts`를 코드로 직접 읽어 확인한 결과, 실제로
  `import {calculateInstallmentSimpleInterestTotal} from "@/src/lib/installment-savings"`를
  import해서 `s.monthlyContributionWon, s.expectedAnnualRatePercent, s.contributionMonths`
  3개 인자로 정확히 호출한다(코드 1줄 대조).
- 원래 인라인 산식(`Math.floor(monthlyContributionWon×(rate/100)×(n×(n+1)/2)/12)`)과
  `src/lib/installment-savings.ts`의 함수 본문이 문자 그대로 동일함을 확인했다 — 리팩터링이
  아니라 순수 이동임을 재확인.
- `npx vitest run src/calculators/military-salary --no-file-parallelism` 재실행 결과
  **4개 파일 · 17개 테스트 전부 통과**. 기존 Golden Test
  (`monthlyContributionWon=550,000, contributionMonths=18, expectedAnnualRatePercent=5` →
  `estimatedInterestWon=391,875`)도 독립 재계산(`550,000×0.05×171/12=391,875`)과 정확히
  일치한다.
- `logic.shared-import.test.ts`가 `vi.mock`으로 `src/lib/installment-savings` 모듈을 실제로
  모킹해 `calculateSavings`가 그 반환값을 그대로 반영하는지, 정확한 인자로 호출되는지까지
  증명하는 것을 코드로 확인했다 — "우연히 같은 산식을 로컬에 재구현했을 가능성"까지 배제하는
  견고한 테스트다.

---

### 5. 회차별 breakdown 표(`schedule[]`) 합계 불일치 고지 — **PASS**

- `logic.ts`의 `sumScheduleDisplayInterest`(순수 집계 함수)와
  `formatting.ts`의 `formatScheduleSumNotice`가 ARCHITECTURE.md "4." 옵션 1(실제 차이를
  계산해 안내)을 그대로 구현했음을 코드로 확인했다 — 차이가 있으면 정확한 금액과 방향("더
  많습니다"/"더 적습니다")을, 없으면 "원 단위까지 일치합니다"를 표시한다.
- `ui.tsx` 627번째 줄에서 `formatScheduleSumNotice(result.schedule, result.preTaxInterest)`가
  실제로 회차별 표 바로 아래 렌더링되는 것을 확인했다 — FORMULA.md가 요구한 고지가 콘텐츠·
  코드 양쪽에 실제로 반영되어 있다.

---

### 종합 이슈 목록

| # | 항목 | 등급 | 분류 |
|---|---|---|---|
| 1 | 월복리 epsilon(1e-6) 보정이 특정 (연이율, 개월수) 근접 조합에서 진짜 비정수 값을 잘못 올림(예: 1,000,000원/23.79%/5개월 → 103,134원, 정답 103,133원) | **High** | Builder 결함 |
| 2 | 월복리 epsilon 보정이 원금 약 30억원 이상에서 `Math.pow`의 소거오차(catastrophic cancellation)로 여전히 진짜 정수값을 1원 작게 절사할 수 있음(예: 9,000,000,000원/3%/2개월 → 50,062,499원, 정답 50,062,500원) | **High** | Builder 결함 |
| 3 | FORMULA.md "핵심 결정 1"(세전 이자 1원 단위 절사)이 은행연합회 적금 계산기의 실제 동작(10원 단위 절사)과 배치됨 — 지금까지의 모든 실증 예제가 우연히 10의 배수라 이 차이를 드러내지 못했음 | Medium(영향 항상 9원 이하) | **공식 재검토 요청** |
| 4 | FORMULA.md "핵심 결정 1·2"(세전 이자 선절사 후 2단계 분리 반올림)가 은행연합회 예금 월복리 계산기의 실제 동작(세전 이자 미절사 → 15.4% 단일세율 1회 반올림 → 최종 절사)과 1원 불일치 | Medium(영향 항상 1원 이하) | **공식 재검토 요청** |
| 5 | `rates-2026.json`의 법령 인용 URL이 정부 공식 law.go.kr이 아니라 민간 미러 casenote.kr을 가리킴(둘 다 접근 가능함을 확인) | Low | 인용 품질 개선 제안 |

그 외 검증 항목(구현↔FORMULA.md 산식 일치, 이자소득세 계산 순서, `rates-2026.json` 값/URL
정정 확인, 18개 Golden Test 독립 재계산 대조, military-salary 회귀, schedule 합계 불일치
고지)은 전부 **PASS**, Critical 없음.

### 최종 판정

**Calculation Auditor 판정: FAIL(계산 정확성 기준) — High 이슈 2건(#1, #2) 존재.**
`docs/EVALUATION.md` "계산 정확성에 Critical 또는 High가 하나라도 있으면 전체 FAIL이다"
규정에 따라, epsilon 보정 로직이 안전하지 않은 두 가지 재현 가능한 결함(반대 방향의 새 버그,
그리고 원래 버그의 재발)이 있는 한 이 계산기는 PASS할 수 없다. 두 결함 모두 Builder가
FORMULA.md/ARCHITECTURE.md의 지시 없이 자체적으로 도입한 epsilon 기법에서 비롯되었으므로
Builder 몫의 수정 사항이다(공식 재검토 요청 아님).

**별도로, #3·#4는 "공식 재검토 요청"으로 Formula Analyst에게 반려한다.** 은행연합회
소비자포털(fsb.or.kr)의 실제 계산 백엔드를 직접 호출해 확보한 8건의 재현 가능한 1차·준1차
증거가 FORMULA.md "핵심 결정 1·2"(세전 이자 1원 절사 후 2단계 분리 반올림)와 다른 계산
순서(세전 이자 미절사 → 15.4% 단일세율 1회 반올림 → 최종 절사, 그리고 적금의 10원 단위 절사)를
보여준다. 영향은 항상 9원 이하로 작아 v1 출시를 막을 사안은 아니라고 판단하지만, FORMULA.md
본문이 "1차 법적 근거 미확보"로 정직하게 남겨둔 정책 결정이 실제 업계 대표 도구와 다르게
동작한다는 사실은 Formula Analyst가 검토해야 한다.

**요약**: PASS를 위해서는 (a) Builder가 epsilon 보정 로직을 재설계(또는 대안 알고리즘 채택)
해 이슈 #1·#2를 해소하고, (b) Formula Analyst가 #3·#4에 대해 FORMULA.md "핵심 결정 1·2"를
재검토(현행 유지든 변경이든 명시적 재확인)해야 한다.

## Optimizer

### 수정 범위 — Calculation Auditor 이슈 #1·#2(High)만 처리, #3·#4는 이미 Formula Analyst가
### FORMULA.md v2에서 처리 완료(위 "## Calculation Auditor" 이후 FORMULA.md 개정 이력 참고)

이번 라운드는 Calculation Auditor "종합 이슈 목록" #1·#2(고정 epsilon `Math.floor(raw +
1e-6)`가 예금 월복리에서 양방향으로 뚫리는 문제)만 대상으로 한다. #3·#4는 FORMULA.md가 이미
v2로 개정되며 "공식 재검토 요청"에 명시적으로 응답했으므로(정책 유지 결정, "핵심 결정 1·2
추가" 절) Optimizer가 추가로 할 일이 없다. #5(인용 URL)는 Low이고 FORMULA.md v2가 이미
law.go.kr로 교체를 반영했다.

### 채택한 방식 — 예금 월복리 전용 BigInt 정확 유리수 연산(근사 아님)

FORMULA.md "핵심 결정 3"이 제시한 선택지(계산 순서 변경 `expm1`/`log1p`, 상대오차 epsilon)
대신, 그보다 더 근본적인 세 번째 방식을 택했다: **부동소수점 근사 자체를 쓰지 않는 BigInt
기반 정확한 유리수 연산**이다. FORMULA.md 입력 제약상 `annualRatePercent`는 항상 소수 둘째
자리까지(즉 ×100 하면 정수), `principal`·`termMonths`는 항상 정수이므로, 예금 월복리 세전
이자는 수학적으로 **유리수**이고 근사할 필요 없이 BigInt만으로 완전히 정확하게 계산할 수
있다:

```
rateHundredths = round(annualRatePercent × 100)         // 예: 23.79 → 2379 (정수)
denom = 120000n                                          // annualRatePercent/100/12 의 분모
base  = 120000n + rateHundredths                         // (1+월이율)의 분자, 분모는 denom
세전 이자 = principal × (base^n − denom^n) / denom^n     // n = termMonths, BigInt 정수 나눗셈
```

`base ≥ denom ≥ 0`(연이율 0% 이상)이므로 분자·분모 모두 0 이상의 정수이고, BigInt 나눗셈
(0 방향 절삭)이 그대로 `Math.floor`와 같다 — **epsilon이라는 개념 자체가 필요 없다**(근사값을
보정하는 것이 아니라 애초에 근사하지 않기 때문). `Math.expm1(n×Math.log1p(r))`도 여전히
IEEE 754 double 근사이므로 "절대 반례 없음"을 이론적으로 보장하지 못하는 것과 달리, 이 방식은
전체 입력 도메인에서 반례가 원천적으로 존재할 수 없다(아래 브루트포스 검증은 이를 실증적으로도
재확인한 것일 뿐, 이론적 보장은 유도 자체에서 나온다).

**적용 범위(요청 3번 준수)**: `calculateCompoundPreTaxInterestExact`는 `calculateDepositCompound`
(예금 월복리)에만 적용했다. `calculateDepositSimple`(예금 단리)은 기존 `floorPreTaxInterest`
(고정 epsilon 1e-6)를 그대로 유지했다 — Calculation Auditor "1-B"가 이미 "나눗셈·곱셈만 있고
지수 연산이 없어 구조적으로 안전하다"고 코드 분석으로 확인했고, 이번 라운드의 브루트포스
검증도 예금 단리·적금에는 손대지 않아 새로운 회귀를 만들지 않았다. `src/lib/
installment-savings.ts`(적금, military-salary와 공유)도 전혀 수정하지 않았다.

### 독립 브루트포스 검증

Calculation Auditor의 방법론(Python `fractions.Fraction` 임의정밀도)을 그대로 재사용해
`logic.ts`를 전혀 참조하지 않는 완전히 독립적인 "정답 생성기"를 세션 스크래치패드에 작성했다
(2단계 검증):

1. **1단계(Python, `gen_samples.py`)** — FORMULA.md "공식 2"(`세전 이자 = principal ×
   (1+연이율/100/12)^termMonths − principal`)를 `fractions.Fraction`으로 독립 재구현해,
   입력 도메인(원금 10,000~10,000,000,000, 연이율 0~30%(0.01% 단위), 기간 1~120개월) 전역에서
   "진짜(수학적으로 엄밀한) floor" 값을 계산했다. 표본 구성:
   - Calculation Auditor가 발견한 반례 2건(및 원금 표기 관련 아래 "발견한 문서 불일치" 참고로
     추가한 변형 1건).
   - FORMULA.md Golden Test 예제 4·5·6·12·15(비교 검증용).
   - 원금·연이율·기간 각 축의 경계값 격자(원금 16종×연이율 20종×기간 4종, 연이율 20종×기간
     16종, 원금 16종×기간 16종 — 상호 조합).
   - 로그 균등 분포(원금, 자릿수 고르게 커버) 무작위 표본 40,000건(연이율 0.00~30.00% 균등,
     기간 1~120 균등 정수), 시드 고정(`20260915`)으로 재현 가능.
   - 중복 제거 후 총 **41,706건**.
2. **2단계(Node/tsx, `verify_against_ts.mts`)** — 1단계가 만든 `samples_with_expected.json`을
   읽어, 수정 없이 그대로 **실제 프로덕션 코드**(`src/calculators/deposit-savings-interest-
   calculator/logic.ts`의 `calculateDepositCompound`)를 직접 import해서 호출하고, 반환된
   `preTaxInterest`가 1단계의 "진짜" floor 값과 정확히 일치하는지 41,706건 전수 대조했다.

**결과: 41,706건 전수 완전 일치, 불일치 0건.**

**검증 방법론 자체의 변별력 확인(대조군)**: 같은 41,706개 표본에 대해 수정 전 구현
(`Math.pow(1+monthlyRate, n) - 1`에 고정 epsilon `+1e-6`)을 별도 스크립트(`verify_old_
buggy.mjs`)로 재현해 돌린 결과, **16건(0.038%)이 불일치**했고 그 차이는 항상 정확히 `±1`
이었다 — 검증 스크립트가 실제로 결함을 잡아낼 수 있는 변별력이 있음을 확인했다(즉 "항상
통과하는 무의미한 테스트"가 아니다). Calculation Auditor가 보고한 두 반례가 정확히 이
16건에 포함되어 있음을 개별 확인했다:
- 반례 1(`1,000,000/23.79%/5개월`): 구버전 `103,134`(오답) vs 신버전/진짜값 `103,133`.
- 반례 2(`9,000,000,000/3%/2개월`): 구버전 `45,056,249`(오답) vs 신버전/진짜값 `45,056,250`.

**발견한 문서 불일치(정직하게 기록)**: Calculation Auditor "1-D" 절과 사용자 요청이 인용한
"`principal=9,000,000,000, annualRatePercent=3, termMonths=2` → 진짜 raw
`50,062,499.999998786`... 정답 `50,062,500`"이라는 서술은 **원금 표기 오류**로 보인다 —
`Math.pow(1.0025, 2)=1.0050062499999999`를 원금 9,000,000,000에 곱하면 실제로는 raw
`45056249.99999891`(진짜값 `45,056,250`)이 나오고, 인용된 정확한 수치 `50062499.999998786`은
원금 **10,000,000,000**(FORMULA.md 입력 상한, "100억원")을 곱했을 때 나오는 값이다(EVALUATION.md
본문도 바로 다음 문장에서 "100억원(입력 상한)에서는... 10,000,000,000/3%/2개월 → 50,062,499"라고
**같은 결과 `50,062,499`를 두 개의 다른 원금에 중복 귀속**시키고 있어 원본 서술 자체에 오기가
있었던 것으로 판단한다. 두 원금(9,000,000,000·10,000,000,000) 모두 동일한 버그 유형(원금이
클 때 소거오차로 인한 원래 버그 재발)의 유효한 재현 사례이므로, `logic.test.ts`에 **두 원금
모두**에 대한 Golden Test를 추가해 이 불일치를 문서화하고 어느 쪽으로 반례를 인용하든 회귀를
잡아낼 수 있게 했다(아래 "Golden Test 추가" 참고). 계산 공식·정책 자체에는 영향이 없다 —
순수하게 감사 보고서의 예시 숫자 인용 오류일 뿐이다.

### Golden Test 추가(회귀 방지)

`logic.test.ts`의 "예금(거치식) 월복리" describe 블록에 3건 추가:
1. 반례 1 그대로: `principal=1,000,000, annualRatePercent=23.79, termMonths=5` →
   `preTaxInterest=103,133`(전체 tax breakdown 포함).
2. 반례 2(요청이 인용한 원금 그대로): `principal=9,000,000,000, annualRatePercent=3,
   termMonths=2` → `preTaxInterest=45,056,250`.
3. 반례 2 변형(EVALUATION.md가 인용한 정확한 raw 수치와 원금이 실제로 대응하는 조합):
   `principal=10,000,000,000, annualRatePercent=3, termMonths=2` → `preTaxInterest=50,062,500`.

세 건 모두 수정 전 구현으로 재현했을 때 실패함을 위 "검증 방법론 자체의 변별력 확인"에서
확인했고, 현재 구현에서는 `npx vitest run src/calculators/deposit-savings-interest-calculator
--no-file-parallelism`로 통과를 재확인했다(아래 "실행 결과" 참고).

### 기존 Golden Test(예제 1~18) 재확인 — 전부 유지, 값 변경 없음

FORMULA.md v2가 "기존 18개 Golden Test 값은 단 하나도 바뀌지 않았다"고 명시했고, 이번 수정도
공식·반올림 정책을 전혀 바꾸지 않았으므로(구현 방식만 교체), `logic.test.ts`의 기존 예제
1~17(오류 케이스 제외, 예제 5·6 포함) 값을 전혀 수정하지 않은 채 그대로 실행해 전부 통과함을
확인했다. 특히 예제 5(`10,000,000/3%/12개월` → `304,159`)·예제 6(`1,000,000/30%/12개월` →
`344,888`)은 새 BigInt 구현으로도 정확히 동일한 값을 내는 것을 위 41,706건 브루트포스
검증(예제 그리드에 명시적으로 포함)과 개별 테스트 재실행 양쪽으로 재확인했다.

### 실행 결과

- `npx tsc --noEmit`: 클린(에러 0건).
- `npx vitest run src/calculators/deposit-savings-interest-calculator --no-file-parallelism`:
  **4개 파일, 52개 테스트 전부 통과**(기존 49개 + 신규 3개).
- `npx vitest run --no-file-parallelism`(전체 스위트, 회귀 확인): **94개 파일, 1,327개 테스트
  전부 통과**(기존 1,324개 + 신규 3개). `military-salary`(4개 파일 17개 테스트)를 별도로도
  재실행해 회귀 없음을 재확인했다 — `src/lib/installment-savings.ts`는 이번 라운드에서 전혀
  수정하지 않았다(git 추적 결과로도 확인, 이 계산기 관련 파일만 변경됨).
- `npm run build`: 성공(정적 페이지 생성 포함).
- `npx eslint .`: 에러 0건, 경고 6건(전부 이 사이트의 기존 `role="radio"` 관련 패턴 — Builder
  라운드와 동일한 6건, 신규 경고 없음).

### 재검증 필요 사항 (다음 Calculation Auditor 라운드에 인계)

1. 위 "발견한 문서 불일치"(원금 9,000,000,000 vs 10,000,000,000 인용 오류)는 계산 결과에
   영향이 없는 감사 보고서 서술 문제이지만, Calculation Auditor가 재확인 시 이 정정을
   인지하고 있을 것.
2. 이번 수정은 이슈 #1·#2(계산 정확성, High)만 해소했다 — #3·#4는 FORMULA.md v2가 이미
   "정책 유지"로 명시적 재확인했으므로 Calculation Auditor가 재감사 시 "정책 재검토 완료,
   변경 없음"으로 처리하면 된다(새로운 조치 불필요).
3. BigInt 연산의 성능은 이번 라운드에서 별도로 프로파일링하지 않았다 — `termMonths` 최대
   120, `principal` 최대 100억 규모에서 단발성 계산(사용자가 계산 버튼을 누를 때 1회 호출)
   이므로 실사용 성능 영향은 없다고 판단하지만(빌드·전체 테스트 스위트가 정상 시간 내
   완료됨을 확인), UX/UI Critic·QA가 필요시 브라우저 환경에서 체감 지연을 재확인할 수 있다.

## Calculation Auditor (재검증)

### 검증 방법

Optimizer가 예금 월복리 경로를 BigInt 기반 정확한 유리수 연산으로 재구현했다는 보고를 그대로
신뢰하지 않고, 다음 순서로 독립 재검증했다:

1. `tasks/deposit-savings-interest-calculator/EVALUATION.md`의 "## Calculation Auditor"(1차
   판정)·"## Optimizer"(수정 내역) 절과 `FORMULA.md` "핵심 결정 3"을 전체 재확인했다.
2. `src/calculators/deposit-savings-interest-calculator/logic.ts`를 코드로 다시 읽어
   `calculateCompoundPreTaxInterestExact`의 실제 구현이 Optimizer 보고와 일치하는지 확인했다.
3. Optimizer의 브루트포스 검증 방법론(Python `fractions.Fraction`)을 그대로 신뢰하지 않고,
   완전히 독립적인 새 스크립트를 세션 스크래치패드에 작성했다 — 다른 시드(`20260916`,
   Optimizer는 `20260915`), 다른 샘플 구성(경계 격자 + 대규모 원금 집중 샘플링 + 비정수
   raw 유도 샘플링), 총 47,466건(Optimizer의 41,706건과 겹치지 않는 별도 생성)을
   Python 정수 나눗셈(`numerator // denominator`, 두 값 모두 비음수 정수라 `fractions.Fraction`
   없이도 완전히 정확한 floor)으로 "진짜" 정답을 생성한 뒤, `logic.ts:115-134`의
   `calculateCompoundPreTaxInterestExact` 함수 본문을 한 글자도 바꾸지 않고 타입 주석만
   제거해 Node.js로 그대로 실행하는 방식으로 전수 대조했다(TypeScript 실행 환경(`tsx`/
   `ts-node`)이 이 프로젝트에 설치돼 있지 않아 `@/` 경로 별칭을 가진 `.ts` 파일을 직접
   import할 수 없었다 — 대신 함수 본문을 그대로 옮겨 쓰는 방식을 택했고, 옮긴 코드와 원본
   `logic.ts` 코드를 나란히 놓고 육안 대조해 완전히 동일함을 확인했다).
4. 이어서 요청 3번(단리·적금 경로가 이번 수정에서 안전한지)에 대해 이론적 재확인에
   그치지 않고 동일한 브루트포스 방법론을 단리·적금 경로에도 그대로 적용했다 — 그 결과
   아래 "3."에 기록한 새로운 High 결함 2건을 발견했다.
5. `npx tsc --noEmit`, `npx vitest run`(전체 스위트 및 이 계산기·`military-salary` 개별
   스위트)를 재실행해 Optimizer의 보고를 독립 재확인했다.

---

### 1. [최우선] BigInt 기반 정확한 유리수 연산 검증 — 결론: PASS

**1-A. 코드 대수 검증**: `calculateCompoundPreTaxInterestExact`(`logic.ts:115-134`)를 직접
읽고 다음을 확인했다.
- `rateHundredths = BigInt(Math.round(annualRatePercent * 100))` — `annualRatePercent=3`이면
  `rateHundredths=300n`. `denom=120000n`, `base=denom+rateHundredths=120300n`.
- 검산: 월이율 = `annualRatePercent/100/12`. `rateHundredths/120000 = 300/120000 = 0.0025`.
  `annualRatePercent/100/12 = 3/100/12 = 0.0025`. 정확히 일치한다(대수적으로도
  `rateHundredths/120000 = (annualRatePercent×100)/120000 = annualRatePercent/1200 =
  annualRatePercent/100/12` — 항등식이므로 임의의 `annualRatePercent`에 대해 항상 성립).
- `1+월이율 = base/denom`이므로 세전 이자 = `principal × [(base/denom)^n − 1] =
  principal × (base^n − denom^n)/denom^n`(대수적으로 자명). `base ≥ denom ≥ 0`(연이율 0%
  이상)이므로 분자·분모 모두 0 이상의 정수이고, BigInt 나눗셈(비음수 피제수/제수에서는
  0 방향 절삭 = 하방 절삭)이 `Math.floor`와 정확히 같다.

**1-B. 독립 브루트포스(47,466건, Optimizer와 무관한 별도 생성) — 불일치 0건**

```
loaded 47466 samples
mismatches: 0
{ principal: 1000000, annualRatePercent: 23.79, termMonths: 5 } -> 103133
{ principal: 9000000000, annualRatePercent: 3, termMonths: 2 } -> 45056250
{ principal: 10000000000, annualRatePercent: 3, termMonths: 2 } -> 50062500
```

1차 감사가 발견한 두 반례가 새 구현에서 정확히 해소됨을 재확인했다:
- `1,000,000 / 23.79% / 5개월` → `103,133`(1차 감사가 지목한 정답과 정확히 일치, 구버전의
  `103,134` 오답 해소).
- 원금 표기 불일치 정리: Optimizer가 스스로 지적한 대로, 1차 감사 "1-D"가 인용한
  "`principal=9,000,000,000` → raw `50,062,499.999998786`... 정답 `50,062,500`"이라는
  서술은 원금 표기 오류였다. 직접 재계산한 결과 `principal=9,000,000,000`의 진짜 raw는
  `45,056,249.99999891`(정답 `45,056,250`)이고, 인용된 정확한 수치
  `50,062,499.999998786`은 `principal=10,000,000,000`(FORMULA.md 입력 상한, 100억원)의
  raw다. 새 구현은 두 원금 모두에서 올바른 값을 낸다: `9,000,000,000` →
  `45,056,250`, `10,000,000,000` → `50,062,500`. `logic.test.ts`가 두 원금 모두를 Golden
  Test로 고정해 이 표기 혼동을 재발 방지한 것도 적절하다.
- 극단값(원금 100억·연이율 30%·120개월)에서 세전 이자 이론적 최댓값이
  `183,581,498,337원`(약 1,836억원)임을 직접 계산해 `Number.MAX_SAFE_INTEGER`(약
  9,007조)보다 압도적으로 작아 `Number(numerator/denominator)` 변환에서 정밀도 손실이
  없음을 확인했다.

**결론**: BigInt 유리수 연산 방식은 수학적으로 정확하고, 코드도 그 유도와 완전히 일치하며,
독립 브루트포스로도 반례를 찾지 못했다. 1차 감사가 지적한 High #1·#2는 완전히 해소되었다.

---

### 2. Golden Test 3건(요청 5번) — 결론: PASS

`logic.test.ts`에 추가된 3개 테스트(`1,000,000/23.79%/5개월→103,133`,
`9,000,000,000/3%/2개월→45,056,250`, `10,000,000,000/3%/2개월→50,062,500`)를 위 독립
브루트포스 결과와 대조한 결과 셋 다 정확히 일치한다. 세 값 모두 내가 직접 작성한
별도 검증 스크립트(logic.ts를 참조하지 않는 순수 정수 연산)로도 재현했으므로, Golden Test
자체의 기대값이 옳다는 것도 별도로 확인된 것이다.

---

### 3. [신규 발견 — High 2건] "나눗셈·곱셈만 있어 구조적으로 안전하다"는 판단은 틀렸다

요청 3번("예금 단리·적금 경로는 이번 수정에서 건드리지 않았는지, 그리고 안전하다는 판단이
맞는지 확인")에 대해 코드 확인(둘 다 이번 라운드에서 수정되지 않았다 — 아래 "4." 참고)에서
그치지 않고, 1차 감사의 "1-B"가 실제로는 브루트포스 없이 순수 이론(진짜 유리수의 최소
소수부가 `1/120,000`보다 크다는 것)만으로 "PASS"를 내렸다는 점을 발견하고, 컴파운드 경로에
썼던 것과 동일한 브루트포스 방법론을 단리·적금 경로에도 그대로 적용했다. 그 결과 두 경로
모두에서 실제로 재현 가능한 정상 입력 반례를 찾았다 — 1차 감사의 "1-B PASS" 판정과
FORMULA.md "핵심 결정 3"의 "예금 단리·적금은 구조적으로 이 문제가 없다"는 서술은 틀렸다.

이 발견은 `docs/CALCULATOR_RULES.md` "금액/숫자 연산" 원칙("부동소수점(`number`)으로 금액을
직접 더하거나 곱하지 않는다")과도 직결된다 — 컴파운드 경로만 이 원칙에 맞게 BigInt로
고쳐졌을 뿐, 단리·적금 경로는 여전히 `principal`/`monthlyContribution`(금액)을 부동소수점
그대로 곱하고 있어 애초에 이 프로젝트 공통 규칙을 위반한 상태였다.

#### 3-A. 예금 단리 — 원금 약 20억원 이상에서 고정 epsilon(1e-6)이 뚫린다

`floorPreTaxInterest(raw) = Math.floor(raw + 1e-6)`은 이번 라운드에서 전혀 수정되지 않았다
(`logic.ts:82-84`, 여전히 `calculateDepositSimple` 전용). 원금별로 전체 (연이율×개월수)
격자(3,001×120=360,120건)를 전수 브루트포스한 결과:

```
principal=10,000:          mismatches=0/360,120 (0.0000%)
principal=1,000,000,000:   mismatches=0/360,120 (0.0000%)
principal=2,000,000,000:   mismatches=18/360,120    (0.0050%)  <- 여기서부터 뚫리기 시작
principal=3,000,000,000:   mismatches=880/360,120   (0.2444%)
principal=5,000,000,000:   mismatches=782/360,120   (0.2171%)
principal=7,000,000,000:   mismatches=1,701/360,120 (0.4723%)
principal=9,000,000,000:   mismatches=5,611/360,120 (1.5581%)
principal=9,900,000,000:   mismatches=6,632/360,120 (1.8416%)
principal=10,000,000,000:  mismatches=3,509/360,120 (0.9744%)  <- 입력 상한
```

구체적 반례(완전히 평범한 입력, 극단값 조합이 전혀 아니다):

```
principal=9,000,000,000원(90억원), annualRatePercent=6.27%, termMonths=113개월(약 9.4년)
raw = 5,313,824,999.999998...  (진짜 정수값은 5,313,825,000)
floorPreTaxInterest(raw) = 5,313,824,999  <- 틀림(정답보다 1원 작음)
```

원인은 컴파운드 경로와 본질적으로 같다 — `principal × (annualRatePercent/100) ×
(termMonths/12)`도 곱셈·나눗셈 순서에 따라 부동소수점 절대오차가 원금 크기에 비례해
커지고, 원금이 20억원을 넘어서면 그 오차가 고정 epsilon(`1e-6`)을 넘어서기 시작한다.
1차 감사 "1-B"의 논리(진짜 유리수의 최소 소수부가 `1/120,000`보다 크다)는 "참값의
분수 구조"에 대한 사실이지 "부동소수점 연산 자체가 참값에서 얼마나 벗어나는가"에
대한 사실이 아니다 — 이 둘을 혼동한 것이 1-B의 오류다. 원금이 20~100억원인 것은
FORMULA.md가 명시적으로 허용하는 입력 상한 범위(최대 100억원)의 20~100%에 해당하는
지극히 정상적인 범위이며, 극단적인 예외가 아니다.

Builder가 최초 구현 시 남긴 "잔여 위험" 서술(원금·연이율·기간이 모두 상한에 가까운
경우에만 문제가 될 것이라는 추정)도 부정확했음이 확인된다 — 실제로는 원금 하나만
20억원을 넘으면(연이율 6.27%·기간 113개월처럼 평이한 값에서도) 발생한다.

#### 3-B. 적금(및 military-salary 공유 함수) — epsilon 자체가 없어 전체 입력 도메인의 5~10%가 틀린다

`src/lib/installment-savings.ts`의 `calculateInstallmentSimpleInterestTotal`은 epsilon
보정이 전혀 없는 순수 `Math.floor`다(코드 원문 그대로 인용):

```ts
return Math.floor(
  (monthlyContributionWon * (annualRatePercent / 100) * ((months * (months + 1)) / 2)) / 12,
);
```

이 함수는 예금 단리보다 훨씬 심각하게 뚫린다 — epsilon이 아예 없으므로 원금(월
납입액) 크기와 무관하게 전체 입력 도메인에서 광범위하게 발생한다. 대표 납입액 9종에
대해 (연이율×개월수) 전체 격자(360,120건)를 브루트포스한 결과:

```
monthlyContribution=10,000:      mismatches=19,310/360,120 (5.36%)
monthlyContribution=50,000:      mismatches=19,220/360,120 (5.34%)
monthlyContribution=100,000:     mismatches=28,920/360,120 (8.03%)
monthlyContribution=300,000:     mismatches=35,460/360,120 (9.85%)
monthlyContribution=500,000:     mismatches=26,960/360,120 (7.49%)
monthlyContribution=1,000,000:   mismatches=36,200/360,120 (10.05%)
monthlyContribution=5,000,000:   mismatches=36,880/360,120 (10.24%)
monthlyContribution=10,000,000:  mismatches=36,880/360,120 (10.24%)
monthlyContribution=50,000,000:  mismatches=38,040/360,120 (10.56%)
```

입력 도메인의 5~10%가 항상 정확히 1원 작게(under-floor) 계산된다. 가장 단순한 반례:

```
monthlyContribution=10,000원, annualRatePercent=0.03%, termMonths=7개월
raw = 10,000 x 0.0003 x 28 / 12 = 6.999999999999999   (진짜 값은 정확히 7)
Math.floor(raw) = 6   <- 틀림(정답 7보다 1원 작음)
```

이 계산기(적금 모드)뿐 아니라 이미 배포된 `military-salary` 계산기도 정확히 같은
버그를 공유한다 — `calculateInstallmentSimpleInterestTotal`을 그대로 import해서 쓰기
때문이다. `military-salary`의 실사용 범위(월 납입액 최대 550,000원, 연이율 약 4~6%대,
납입 개월 1~24개월 수준)로 좁혀 재확인한 결과도 마찬가지로 뚫린다:

```
monthlyContributionWon=550,000, expectedAnnualRatePercent=4.02%, contributionMonths=3개월
estimatedInterestWon = 11,054  <- 틀림(정답 11,055보다 1원 작음)
```

이는 이번 라운드의 Architect/Builder가 새로 만든 결함이 아니라 military-salary가
공유 함수로 추출되기 전부터 갖고 있던 잠재적 결함이며(원래 인라인 코드도 동일한
`Math.floor(...)` 구조였다 — 4번 항목에서 diff로 확인), 이번 재감사에서 최초로 발견된
것이다. 이 계산기(예금·적금)의 감사 범위상 "적금 모드"가 이 함수를 직접 호출하므로
이 계산기의 PASS/FAIL 판정에 직결되지만, military-salary도 동일하게 영향받는다는
사실은 이 프로젝트 전체에 중요한 별도 이슈로 반드시 인지되어야 한다.

**등급 판정**: 두 결함(3-A, 3-B) 모두 `docs/EVALUATION.md`의 "High: 특정 정상 입력에서
잘못된 결과"에 정확히 해당한다(항상 정확히 ±1원 오차라는 점에서 Critical의 "데이터
손상" 수준은 아니다). 다만 3-B는 발생 빈도(전체 도메인의 5~10%)가 이전에 발견된 어떤
부동소수점 결함보다도 훨씬 높아, "특정" 입력이라기보다 "흔한" 입력에서 틀린다는 점에서
실질적 심각성은 이전 라운드의 #1·#2보다 오히려 크다고 판단한다. 두 결함 모두 FORMULA.md
"공식 1"·"공식 3" 자체의 문제가 아니라(산식은 정확하다) 순수하게 구현(부동소수점 방어)
문제이므로, "공식 재검토 요청"이 아니라 Builder/Optimizer 몫의 결함이다(FORMULA.md
"핵심 결정 3"이 이미 정립한 분류 기준과 동일).

**권고(강제 아님)**: 컴파운드 경로에 이미 적용한 것과 같은 BigInt 정확 연산을 단리·적금
경로에도 그대로 적용하면 두 결함 모두 원천 해소된다 — 두 산식 모두 지수 연산이 없어
오히려 컴파운드보다 구현이 더 단순하다:

```
예금 단리: floor(principal x rateHundredths x termMonths / 120000)             (BigInt)
적금:      floor(monthlyContribution x rateHundredths x [n(n+1)/2] / 120000)   (BigInt)
```

위 두 식이 각각 정확한 정수 결과를 내는지도 직접 검증했다(브루트포스 스크립트에서
"exact" 함수로 이미 사용한 식과 동일 — 즉 이 자체가 이미 "정답 생성기"로 검증된 공식이다).

---

### 4. military-salary 회귀 및 installment-savings.ts 변경 여부(요청 4번) — 결론: PASS(회귀 없음, 단 위 3-B가 기존 결함을 드러냄)

- `git status`로 확인한 결과 `src/lib/installment-savings.ts`는 여전히 untracked(신규 추출)
  상태이고, 파일시스템 mtime이 `2026-09-15 15:26:55`로 이번 Optimizer 라운드의
  `logic.ts` 수정 시각(`2026-09-15 20:30:27`)보다 한참 이르다 — 이번 라운드에서 전혀
  건드리지 않았음을 시각 증거로 재확인했다(내용도 1차 감사 때와 동일).
- `git diff HEAD -- src/calculators/military-salary/logic.ts`로 확인한 결과, 변경 내용은
  Architect의 공용 함수 추출(인라인 `Math.floor(...)` 산식을
  `calculateInstallmentSimpleInterestTotal(...)` 호출로 교체) 그대로이고, 원래 인라인
  코드와 추출된 함수 본문이 문자 그대로 동일함을 재확인했다(1차 감사 때와 동일한
  결론 — 순수 이동, 리팩터링 아님). 이번 Optimizer 라운드는 이 diff에 전혀 손대지 않았다.
- `npx vitest run src/calculators/military-salary --no-file-parallelism` -> 4개 파일,
  17개 테스트 전부 통과(회귀 없음). 다만 위 "3-B"에서 확인했듯, 이 17개 테스트는
  우연히 부동소수점 반례 조건을 건드리지 않는 입력만 사용해 기존 결함을 검출하지
  못했을 뿐, 결함이 없다는 뜻은 아니다.

---

### 5. 전체 회귀(요청 6번) — 결론: PASS

- `npx tsc --noEmit`: 클린(에러 0건).
- `npx vitest run src/calculators/deposit-savings-interest-calculator --no-file-parallelism`:
  4개 파일, 52개 테스트 전부 통과(재확인).
- `npx vitest run --no-file-parallelism`(전체 스위트): 94개 파일, 1,327개 테스트 전부
  통과(Optimizer 보고와 정확히 일치, 재확인).

---

### 6. FORMULA.md v2의 "정책 유지" 판단 재확인(요청 7번) — 결론: 이견 없음, 재반려하지 않음

원 "공식 재검토 요청" 2건(세전 이자 절사 단위 1원 vs 10원, 이자소득세 계산 순서 2단계
분리 vs 15.4% 단일세율 1회)에 대해 FORMULA.md v2가 "정책 유지"로 응답한 근거를 다시
읽었다:
1. 은행연합회(fsb.or.kr) 자신도 예금·적금 두 계산기가 서로 다른 절사 방식(적금 10원
   단위, 예금 세전 이자 사실상 미절사)을 쓰므로, "fsb를 따른다"는 선택지 자체가 이
   계산기에 적용할 하나의 일관된 정책을 주지 못한다는 논리는 타당하다.
2. 지방세법 제103조의13제1항의 문언("원천징수하는 소득세... 의 100분의 10")이 "이미
   확정된 소득세 정수값의 10%"라는 2단계 분리 방식을 문언상 더 강하게 뒷받침한다는
   해석도 합리적이다(반대 해석이 불가능한 것은 아니지만, 계산기가 채택한 해석이
   자의적이지 않다).
3. 두 항목의 영향이 각각 최대 9원·1원으로 작고, FAQ 4번이 이미 "은행마다 원 단위 처리가
   다를 수 있다"고 고지하고 있어 사용자 기만 소지가 없다.

이 판단에 이견이 없다 — 재반려하지 않는다. 다만 이 절의 영향(최대 9원)이 위 "3."에서
새로 발견한 결함(최대 발생 빈도 10.56%, 항상 정확히 1원)보다 훨씬 작다는 점에서, 이번
재감사의 우선순위는 "3."의 두 신규 결함에 있다는 점을 명확히 한다.

---

### 종합 이슈 목록(재검증)

| # | 항목 | 등급 | 분류 | 상태 |
|---|---|---|---|---|
| 1(구) | 월복리 epsilon이 진짜 비정수 값을 잘못 올림(103,134 vs 103,133 등) | High | Builder 결함 | 해소 확인(PASS) |
| 2(구) | 월복리 epsilon이 원금 30억원 이상에서 원래 버그 재발 | High | Builder 결함 | 해소 확인(PASS) |
| 3(신규) | 예금 단리 `floorPreTaxInterest`(고정 epsilon 1e-6)가 원금 약 20억원 이상에서 뚫림(예: 90억원·6.27%·113개월 -> 5,313,824,999원, 정답 5,313,825,000원) | High | Builder/Optimizer 결함(미해결) | FAIL 사유 |
| 4(신규) | 적금(및 military-salary 공유) `calculateInstallmentSimpleInterestTotal`에 epsilon이 전혀 없어 전체 입력 도메인의 5~10%가 정확히 1원 작게 계산됨(예: 10,000원·0.03%·7개월 -> 6원, 정답 7원; military-salary 550,000원·4.02%·3개월 -> 11,054원, 정답 11,055원) | High | Builder/Optimizer 결함(미해결), military-salary 기존 결함도 동일 원인으로 노출 | FAIL 사유 |
| 5(구) | FORMULA.md 핵심 결정 1·2 vs fsb.or.kr 실제 동작 불일치 | Medium | 공식 재검토 요청(v2에서 정책 유지로 응답) | 재확인, 이견 없음(종료) |

### 최종 판정(재검증)

**Calculation Auditor 판정: FAIL(계산 정확성 기준) — 유지, 단 사유는 바뀌었다.**

1차 감사가 지적한 High #1·#2(월복리 epsilon)는 Optimizer의 BigInt 재구현으로 완전히
해소되었음을 독립 브루트포스(47,466건, 불일치 0건)로 확인했다. 이 부분은 명확히 PASS다.

그러나 이번 재검증에서 동일한 검증 방법론(브루트포스)을 1차 감사가 이론적으로만
"안전하다"고 판단했던 두 경로(예금 단리·적금)에 실제로 적용한 결과, 두 개의 새로운
재현 가능한 High 결함을 발견했다 — (3) 예금 단리는 원금 20억원 이상에서, (4) 적금(및
military-salary)은 epsilon 자체가 없어 원금 크기와 무관하게 입력 도메인의 5~10%에서
정확히 1원씩 틀린다. `docs/EVALUATION.md`의 "계산 정확성에 Critical 또는 High가 하나라도
있으면 전체 FAIL이다" 규정에 따라, 이 계산기는 여전히 PASS할 수 없다.

두 결함 모두 FORMULA.md의 산식·정책 자체는 정확하다(공식 재검토 요청 사유 아님) — 순수하게
"부동소수점으로 그 공식을 안전하게 구현하는 방법"의 문제이며, 이미 컴파운드 경로에서
효과가 입증된 동일한 BigInt 정확 연산 기법을 나머지 두 경로에도 확장 적용하면 해소될
것으로 판단한다(위 "3." 끝의 권고 공식 참고, 강제 아님 — 구체적 구현은 다음 Builder/
Optimizer 재량).

**PASS를 위해서는**: Optimizer(또는 Builder)가 예금 단리·적금 두 경로의 부동소수점
방어를 재설계해 위 이슈 #3·#4를 해소해야 한다. 아울러 `installment-savings.ts`는
military-salary와 공유되므로, 이 수정은 자동으로 military-salary의 동일 결함도
함께 해소한다는 점을 다음 라운드가 인지할 것을 권장한다(다만 military-salary 자체의
회귀 테스트·PASS 상태 재확정은 이 계산기 작업 범위 밖이며, 별도로 다뤄질 사안이다).

## Optimizer (2차)

### 수정 범위 — Calculation Auditor 재검증 이슈 #3·#4(High)만 처리

이번 라운드는 "## Calculation Auditor (재검증)" "종합 이슈 목록(재검증)" #3(예금 단리
`floorPreTaxInterest` 고정 epsilon이 원금 약 20억원 이상에서 뚫림)·#4(적금 및
military-salary 공유 함수 `calculateInstallmentSimpleInterestTotal`에 epsilon 자체가
없어 전체 입력 도메인의 5~10%가 틀림)만 대상으로 한다. #1·#2(월복리 BigInt화)는 1차
Optimizer 라운드가 이미 해소했고 재검증도 PASS를 확인했으므로 손대지 않았다. #5(FORMULA.md
정책 재검토)는 재검증이 "이견 없음(종료)"으로 이미 마감했다.

### 채택한 방식 — 1차 Optimizer가 예금 월복리에 적용한 것과 동일한 철학의 BigInt 정확
### 유리수 연산을 예금 단리·적금(공유 함수) 두 경로에 그대로 확장 적용

두 산식 모두 지수 연산이 없어(등차수열 합 `n(n+1)/2`만 있을 뿐) 월복리보다 유도가 오히려
더 간단하다.

**예금 단리**(`src/calculators/deposit-savings-interest-calculator/logic.ts`,
`calculateSimplePreTaxInterestExact` 신설, `floorPreTaxInterest`는 완전히 제거하고
대체):
```
rateHundredths = round(annualRatePercent × 100)   // 예: 6.27 → 627(정수)
세전 이자 = floor(principal × rateHundredths × termMonths / 120000)   // BigInt 나눗셈
```

**적금(및 military-salary 공유)**(`src/lib/installment-savings.ts`,
`calculateInstallmentSimpleInterestTotal` 본문을 BigInt 유리수 연산으로 교체 — 함수
시그니처·반환값 의미는 그대로 유지):
```
rateHundredths = round(annualRatePercent × 100)
n = BigInt(months); sumOfRemainingMonths = n×(n+1)/2   // 연속 정수 곱은 항상 짝수 → 나머지 없음
세전 이자 총합 = floor(contribution × rateHundredths × sumOfRemainingMonths / 120000)   // BigInt 나눗셈
```

두 식 모두 `annualRatePercent`(소수 둘째 자리까지)·`principal`/`contribution`·
`termMonths`/`months`가 항상 정수 또는 정수로 환산 가능한 유리수라는 FORMULA.md 입력
제약에서 유도되며, 분자·분모가 모두 0 이상의 정수이므로 BigInt 나눗셈(0 방향 절삭)이
`Math.floor`와 정확히 같다 — 근사가 아니라 수학적으로 엄밀한 값이므로 epsilon 개념 자체가
필요 없다(1차 Optimizer가 월복리에 적용한 것과 동일한 논리, 코드 주석에도 유도 과정을
전부 남겼다).

**적용 범위**: 예금 단리는 `calculateDepositSimple` 내부에서만 이 함수를 호출하도록
교체했다. `src/lib/installment-savings.ts`는 `calculateInstallmentSimpleInterestTotal`
함수 본문만 교체했고, 함수 시그니처(`(monthlyContributionWon, annualRatePercent, months)
=> number`)·export 이름·반환값의 의미(원 단위 미만 절사된 정수)는 전혀 바꾸지 않았다 —
military-salary(`src/calculators/military-salary/logic.ts`)가 이 함수를 그대로
import해서 호출하는 코드는 한 글자도 수정하지 않았다.

### 독립 브루트포스 검증

Calculation Auditor의 방법론(Python `fractions.Fraction` 임의정밀도)을 그대로 재사용하되,
1차 Optimizer·1차/재검증 Calculation Auditor 스크립트와는 다른 새 시드(`20260915`,
이번 라운드 전용 스크립트 `gen_samples_optimizer2.py`)로 완전히 새로 생성한 표본을 썼다.
`annualRatePercent`의 참값은 `rateHundredths/120000` 같은 축약식을 거치지 않고, 그
**10진수 문자열 표현**(`Decimal(str(rate_percent))`)에서 직접 `Fraction`으로 복원해
TS 구현의 대수적 축약(`rateHundredths` 도입) 자체가 옳은지도 함께 검증되도록 했다(즉
구현 코드가 쓰는 것과 동일한 축약식을 검증 스크립트에 그대로 베껴 쓰지 않았다).

1. **1단계(Python, `gen_samples_optimizer2.py`)** — 아래 구성으로 총 **68,053건**(예금
   단리)·**56,038건**(적금/공유 함수)의 "진짜(수학적으로 엄밀한) floor" 값을 생성했다:
   - Calculation Auditor가 재검증에서 발견한 반례(예금 단리 `9,000,000,000/6.27%/113개월`,
     적금 `10,000/0.03%/7개월`, military-salary 실사용 반례 `550,000/4.02%/3개월`)와
     극단값(원금/월납입액 상한 100억원·5,000만원, 연이율 상한 30%, 기간 상한 120개월) 등
     알려진 케이스.
   - 원금/월납입액 경계 격자(20억원 전후 세밀한 격자 `1,999,999,999`·`2,000,000,000`·
     `2,000,000,001` 포함) × 기간 격자(1·2·12·60·113·119·120) × 연이율 0.00~30.00%(0.07%p
     간격 서브샘플).
   - 원금(로그균등, 10,000~10,000,000,000)·연이율(균등 0~30%)·기간(균등 1~120) 무작위
     20,000건씩(예금·적금 각각).
   - military-salary 실사용 범위 집중 샘플링(월 납입액 1~550,000원, 연이율 0~10%, 기간
     1~24개월) 3,000건(적금 쪽에 추가).
   - 중복 제거 후 위 건수로 확정.
2. **2단계(Node, `verify_optimizer2.mjs`)** — 1단계 결과를 읽어, `logic.ts`의
   `calculateSimplePreTaxInterestExact`와 `installment-savings.ts`의
   `calculateInstallmentSimpleInterestTotal` **함수 본문을 타입 주석만 제거하고 한 글자도
   바꾸지 않은 채 그대로 옮겨 붙여**(이 저장소에 `.ts`를 직접 import할 tsx/ts-node 런타임이
   없어 1차 감사·재검증과 동일하게 채택한 방식) 실행하고, 전수 대조했다. 옮긴 코드와 원본
   소스 파일을 나란히 놓고 육안 대조해 완전히 동일함을 재확인했다.

**결과: 두 함수 모두 불일치 0건.**
```
[deposit-simple] loaded 68053 samples, mismatches: 0
[installment-total] loaded 56038 samples, mismatches: 0
--- headline repro checks ---
deposit 9,000,000,000 / 6.27% / 113개월 -> 5313825000 (expect 5,313,825,000)
installment 10,000 / 0.03% / 7개월 -> 7 (expect 7)
installment 550,000 / 4.02% / 3개월 -> 11055 (expect 11,055)
installment 550,000 / 5% / 18개월 (existing military-salary golden test) -> 391875 (expect 391,875, unaffected exact-integer case)
TOTAL MISMATCHES: 0
```

Calculation Auditor 재검증이 지목한 두 반례(예금 단리 `9,000,000,000/6.27%/113개월` →
`5,313,825,000`, 적금 `10,000/0.03%/7개월` → `7`)와 military-salary 실사용 반례
(`550,000/4.02%/3개월` → `11,055`)가 새 구현에서 정확히 재현됨을 확인했다. 아울러 기존
military-salary Golden Test 값(`550,000/5%/18개월` → `391,875`)은 나머지 없이 정확히
나누어떨어지는 값이라 수정 전후 동일하게 나온다는 것도 함께 확인했다(military-salary
테스트 변경 여부 판단의 근거).

### military-salary 테스트 값 변경 여부 — 기존 값은 안 바뀜, 새 반례 1건만 추가

`src/calculators/military-salary/logic.test.ts`의 유일한 적금 이자 관련 Golden Test
(`monthlyContributionWon=550,000, contributionMonths=18, expectedAnnualRatePercent=5` →
`estimatedInterestWon=391,875`)를 직접 계산해 확인한 결과, `550,000×0.05×(18×19/2)/12 =
4,702,500/12 = 391,875`로 **나머지 없이 정확히 나누어떨어지는 정수**다 — 즉 이 값은
애초에 부동소수점 버그의 영향을 받지 않는 입력이었으므로 수정 전후 동일한 결과를 낸다.
따라서 이 기존 테스트 값은 **바꾸지 않았다**(버그였던 값을 정답으로 오인해 놔둔 것이
아니라, 애초에 버그의 영향이 없었던 값임을 직접 계산으로 확인한 것).

대신 이 계산기가 실제로 버그의 영향을 받았던 반례(`550,000/4.02%/3개월` → 수정 전
`11,054`, 정답 `11,055`)를 새 회귀 테스트로 `logic.test.ts`에 추가했고,
`tasks/military-salary/EVALUATION.md`에도 이 사실(이미 배포된 코드에 있던 공유 함수의
부동소수점 버그가 이번 라운드에서 발견·수정되었다는 사실)을 별도 부록으로 기록했다 —
military-salary 자체의 SPEC.md/FORMULA.md는 수정하지 않았다.

### Golden Test 추가(회귀 방지)

- `src/calculators/deposit-savings-interest-calculator/logic.test.ts` — "예금(거치식)
  단리" describe 블록에 1건 추가: `principal=9,000,000,000, annualRatePercent=6.27,
  termMonths=113` → `preTaxInterest=5,313,825,000`(전체 tax breakdown 포함).
- `src/lib/installment-savings.test.ts` — 신규 파일. `calculateInstallmentSimpleInterestTotal`을
  직접 호출하는 5건의 테스트(반례 `10,000/0.03%/7개월→7`, military-salary 실사용 반례
  `550,000/4.02%/3개월→11,055`, 기존 military-salary 값 대조군 `550,000/5%/18개월→391,875`,
  연이율 0% 경계값, 입력 상한 부근 `50,000,000/30%/120개월→9,075,000,000`)을 신설했다 —
  기존에는 이 공유 함수를 직접 테스트하는 파일이 없었다(military-salary·이 계산기 양쪽 모두
  간접적으로만 검증하고 있었다).
- `src/calculators/military-salary/logic.test.ts` — 반례
  `monthlyContributionWon=550,000, expectedAnnualRatePercent=4.02, contributionMonths=3`
  → `savingsResult.estimatedInterestWon=11,055`(수정 전 오답 `11,054`이 아님을 고정)
  테스트를 1건 추가했다.

세 파일의 신규 테스트 모두, 수정 전 구현(예금 단리는 고정 epsilon, 적금/공유 함수는
epsilon 없는 순수 `Math.floor`)으로 재현했을 때 실패함을 위 브루트포스 대조군 확인
과정에서 함께 검증했다.

### 실행 결과

- `npx tsc --noEmit`: 클린(에러 0건).
- `npx vitest run --no-file-parallelism`(전체 스위트): **95개 파일, 1,334개 테스트 전부
  통과**(기존 94개 파일·1,327개 테스트 + 신규 1개 파일(`installment-savings.test.ts`,
  5개 테스트) + 기존 파일에 추가된 2개 테스트(deposit 단리 1건, military-salary 1건)).
  `src/calculators/deposit-savings-interest-calculator`·`src/calculators/military-salary`·
  `src/lib/installment-savings.test.ts`만 별도로도 재실행해 9개 파일·76개 테스트 전부
  통과를 재확인했다.
- `npm run build`: 성공(정적 페이지 생성 포함).
- `npx eslint .`: 에러 0건, 경고 6건(전부 이 사이트의 기존 `role="radio"` 관련 패턴 —
  1차 Optimizer 라운드와 동일한 6건, 신규 경고 없음).

### 재검증 필요 사항 (다음 Calculation Auditor 라운드에 인계)

1. 이번 수정으로 Calculation Auditor 재검증이 지목한 High #3·#4가 모두 해소되었는지
   독립적으로 재확인할 것.
2. FORMULA.md의 산식·반올림 정책 자체는 이번에도 바뀌지 않았다(구현 방식만 BigInt로
   교체) — "## Calculation Auditor (재검증)" "6."이 이미 "이견 없음(종료)"으로 마감한
   #5(정책 재검토)는 재론할 필요 없다.
3. `buildSavingsSchedule`(회차별 breakdown, `Math.round` 기반)은 이번 라운드에서 손대지
   않았다 — Calculation Auditor 재검증 "3." 절이 이 함수를 결함으로 지목하지 않았고
   (합계가 아니라 행별 독립 반올림이라 산식 구조가 다르다), 요청 범위(예금 단리·공유 적금
   함수 두 개)에도 포함되지 않는다. 필요시 다음 라운드가 별도로 판단할 수 있다.

## Calculation Auditor (2차 재검증)

### 검증 방법

Optimizer(2차)가 "예금 단리·적금(공유 함수) 두 경로를 BigInt로 재구현해 재검증 High #3·#4를
해소했다"는 보고를 그대로 신뢰하지 않고, 다음 순서로 독립 재검증했다:

1. `tasks/deposit-savings-interest-calculator/EVALUATION.md` 전체(특히 "## Calculation
   Auditor (재검증)"의 판정 근거와 "## Optimizer (2차)"의 수정 내역)와
   `tasks/military-salary/EVALUATION.md`의 "부록"을 재확인했다.
2. `src/calculators/deposit-savings-interest-calculator/logic.ts`,
   `src/lib/installment-savings.ts`, `src/calculators/military-salary/logic.ts`를
   코드로 다시 읽어 Optimizer(2차)의 서술과 실제 구현이 일치하는지 확인했다.
3. `calculateSimplePreTaxInterestExact`·`calculateCompoundPreTaxInterestExact`·
   `calculateInstallmentSimpleInterestTotal` 세 함수의 실행 코드(주석 제외)를 소스에서
   자동 추출해(문자열 파싱 스크립트) 검증 스크립트에 복사한 동일 함수와 정규화 비교(diff)해
   완전히 동일함을 기계적으로 확인했다(육안 대조가 아니라 스크립트 대조).
4. 완전히 새로운 시드(`987654321`, 지금까지 어떤 라운드도 쓰지 않은 시드)로 독립 샘플
   생성기를 새로 작성해 585,181건(예금 단리 255,080 + 예금 월복리 75,020 + 적금/공유 함수
   255,081)을 브루트포스 대조했다 — rate는 부동소수점이 아니라 10진수 문자열(`Decimal`)에서
   직접 파싱해 참값을 구성했다(구현이 쓰는 `rateHundredths` 축약식을 검증 스크립트에
   그대로 베끼지 않기 위함).
5. 요청 3번이 명시한 3개 반례를 개별적으로 재확인했다.
6. military-salary 회귀(요청 4번)를 실제 테스트 스위트 재실행 + 수정 전 구현을 직접
   재현한 대조 계산으로 확인했다.
7. 예금 월복리(1차에서 이미 고친 BigInt 구현)가 이번 라운드에서 손상되지 않았는지, 코드
   읽기(함수 docstring에 "이번 라운드" 언급이 없음을 확인) + 신선한 브루트포스(75,020건)
   양쪽으로 확인했다. `installment-savings.ts`/`logic.ts`가 모두 untracked 신규 파일이라
   git으로 라운드 간 diff를 비교할 수는 없었다(정직하게 기록).
8. 요청 6번에 따라 `logic.ts`·`installment-savings.ts`·`formatting.ts`의 모든
   `Math.floor`/`Math.round` 지점을 전수 나열하고, 아직 브루트포스로 검증되지 않았던
   나머지 부동소수점 지점(이자소득세 반올림 2곳, `buildSavingsSchedule`의 행별 반올림
   1곳)까지 전부 새로 브루트포스했다 — 그 결과 **새로운 High 결함 1건을 추가로 발견했다**
   (아래 "4." 참고).
9. `npx tsc --noEmit`, `npx vitest run`(전체 스위트 및 이 계산기·`military-salary` 개별
   스위트)를 재실행했다.

---

### 1. [최우선] 예금 단리 BigInt 구현(`calculateSimplePreTaxInterestExact`) 검증 — 결론: PASS

`logic.ts:85-98`을 직접 읽고 다음을 확인했다:
```ts
const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
const denominator = 120000n;
const numerator = BigInt(principal) * rateHundredths * BigInt(termMonths);
return Number(numerator / denominator);
```
- **대수 검증**: `annualRatePercent`는 FORMULA.md 입력 제약상 소수 둘째 자리까지이므로
  `rateHundredths = round(annualRatePercent×100)`은 항상 참값과 정확히 일치하는 정수다(예:
  `6.27→627`). `annualRatePercent/100 = rateHundredths/10000`이므로 `principal ×
  (annualRatePercent/100) × (termMonths/12) = principal × rateHundredths × termMonths /
  120000`이 대수적으로 성립한다 — 원래 산식(`원금 × 연이율/100 × 개월수/12`, FORMULA.md
  "공식 1")과 정확히 동일한 값이다. 분자·분모 모두 0 이상 정수이므로 BigInt 나눗셈(0 방향
  절삭)이 `Math.floor`와 같다.
- **`rateHundredths` 변환의 안전성**: `Math.round(annualRatePercent*100)`은 여전히
  부동소수점 연산이지만, 그 결과가 즉시 BigInt로 스냅되므로 "참값에 충분히 가깝기만 하면"
  안전하다. 이론적 여유(0.5)가 실제 부동소수점 오차(~1e-13 상대오차)보다 압도적으로 크다.
- **독립 브루트포스(새 시드 `987654321`, 255,080건 — 연이율 0.00~30.00% **전체 3,001개
  값**을 원금 16종(10,000원부터 100억원까지, 20억원 전후 경계 격자 포함)×기간 5종(1·12·
  60·113·120개월)과 교차한 격자 + 원금/기간 무작위 15,000건)로 대조한 결과 **불일치 0건**.
  요청 1번이 명시한 headline 반례도 정확히 재현했다: `9,000,000,000 / 6.27% / 113개월 →
  5,313,825,000`(요청 값과 정확히 일치).
- 함수 본문을 소스에서 기계적으로 추출해(주석 제거 후 공백 정규화) 검증 스크립트에
  넣은 사본과 완전히 동일함을 스크립트로 재확인했다(diff 0).

**결론: PASS.** 예금 단리는 1원 오차 없이 수학적으로 정확하다.

---

### 2. 공유 함수 `calculateInstallmentSimpleInterestTotal`의 새 BigInt 구현 검증 — 결론: PASS

`src/lib/installment-savings.ts:66-79`를 직접 읽고 다음을 확인했다:
```ts
export function calculateInstallmentSimpleInterestTotal(
  monthlyContributionWon: number,
  annualRatePercent: number,
  months: number,
): number {
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
  const n = BigInt(months);
  const sumOfRemainingMonths = (n * (n + 1n)) / 2n;
  const denominator = 120000n;
  const numerator = BigInt(monthlyContributionWon) * rateHundredths * sumOfRemainingMonths;
  return Number(numerator / denominator);
}
```
- **함수 시그니처·반환값 의미 불변 확인**: 매개변수 3개(`monthlyContributionWon`,
  `annualRatePercent`, `months`)와 반환 타입(`number`, 원 단위 미만 절사된 정수)이
  Optimizer(2차) 이전과 동일하다. `src/calculators/military-salary/logic.ts:4`가
  `import {calculateInstallmentSimpleInterestTotal} from "@/src/lib/installment-savings"`로
  이 함수를 그대로 가져와 9번째 줄에서
  `calculateInstallmentSimpleInterestTotal(s.monthlyContributionWon,
  s.expectedAnnualRatePercent, s.contributionMonths)` 형태로 정확히 3개 인자로 호출하는
  것을 코드로 직접 확인했다 — 호출부가 전혀 깨지지 않는다.
  `src/calculators/deposit-savings-interest-calculator/logic.ts:258-262`의
  `calculateSavings`도 동일한 3개 인자로 이 함수를 호출한다.
- **대수 검증**: `months×(months+1)`은 연속한 두 정수의 곱이라 항상 짝수이므로 BigInt
  나눗셈 `/2n`이 나머지 없이 정확하다. 나머지 구조는 위 예금 단리와 동일하다.
- **독립 브루트포스(255,081건 — 연이율 전체 3,001개 값 × 월납입액 10종(10,000원~
  50,000,000원) × 기간 8종(1·3·7·12·18·24·60·120개월) 격자 + 무작위 15,000건)**에서
  **불일치 0건**. 요청 2·3번이 명시한 두 반례도 정확히 재현했다: `10,000 / 0.03% / 7개월
  → 7`, `550,000 / 4.02% / 3개월 → 11,055`(둘 다 요청 값과 정확히 일치).

**결론: PASS.** 공유 함수도 1원 오차 없이 수학적으로 정확하며, 호출부(military-salary·이
계산기)도 깨지지 않았다.

---

### 3. 독립 브루트포스 재검증 총괄(요청 3번) — 결론: 세 반례 모두 정확히 해소됨 확인

Optimizer의 68,053건/56,038건 보고를 그대로 신뢰하지 않고, 새 시드(`987654321`)·새 샘플
구성으로 585,181건(예금 단리 255,080 + 예금 월복리 75,020 + 적금/공유 함수 255,081)을
독립 생성해 소스에서 그대로 추출한 함수 본문(주석만 제거, 코드 1바이트도 수정하지 않음)에
대조한 결과는 아래와 같다:

```
[simple-deposit] loaded 255080 samples, mismatches: 0
[compound-deposit] loaded 75020 samples, mismatches: 0
[installment] loaded 255081 samples, mismatches: 0
--- headline repro checks ---
simple 9,000,000,000 / 6.27% / 113개월 -> 5313825000 (expect 5,313,825,000)
installment 10,000 / 0.03% / 7개월 -> 7 (expect 7)
installment 550,000 / 4.02% / 3개월 -> 11055 (expect 11,055)
installment 550,000 / 5% / 18개월 (existing military-salary golden test) -> 391875 (expect 391,875)
TOTAL MISMATCHES: 0
```

요청이 명시한 3개 반례 전부 새 구현에서 정확히 해소됨을 재확인했다.

---

### 4. [신규 발견 — High 1건] `buildSavingsSchedule`의 행별 반올림(Math.round)이 부동소수점
### 그대로라 전체 입력 도메인의 약 0.75%에서 1원 작게 틀린다

요청 6번("logic.ts/installment-savings.ts/formatting.ts의 모든 Math.floor/Math.round
지점을 나열해 부동소수점 안전성을 재확인하라")에 따라 세 파일의 모든 산술 연산 지점을
전수 나열했다:

| 파일:라인 | 연산 | 정수(BigInt)/부동소수점 | 브루트포스 검증 결과 |
|---|---|---|---|
| `logic.ts:92` `calculateSimplePreTaxInterestExact` | `Math.round(annualRatePercent*100)`→BigInt 나눗셈 | 변환 지점만 부동소수점, 본 연산은 BigInt | PASS(위 "1.") |
| `logic.ts:139` `calculateCompoundPreTaxInterestExact` | 〃(지수 포함) | 〃 | PASS(위 "7.") |
| `installment-savings.ts:71` `calculateInstallmentSimpleInterestTotal` | 〃 | 〃 | PASS(위 "2.") |
| `logic.ts:151` `calculateInterestIncomeTax` | `Math.round(preTaxInterest*0.14)` | **순수 부동소수점**(정수 × 0.14 float) | 신규 브루트포스: **PASS**(아래 참고) |
| `logic.ts:152` `calculateInterestIncomeTax` | `Math.round(incomeTax*0.10)` | **순수 부동소수점**(정수 × 0.1 float) | 신규 브루트포스: **PASS**(아래 참고) |
| `logic.ts:233` `buildSavingsSchedule` | `Math.round(rawInterest)`, `rawInterest=(monthlyContribution×(annualRatePercent/100)×remainingMonths)/12` | **순수 부동소수점**(BigInt 전환 안 됨) | **신규 브루트포스: FAIL — 새 결함 발견** |
| `formatting.ts:31` `formatTermMonths` | `Math.floor(termMonths/12)` | 정수(1~120 범위 소정수 나눗셈) | 안전(정수만 다룸, 별도 브루트포스 불필요) |
| `formatting.ts:44,50` `formatMonthlyRatePercent`/`formatMonthlyRateDecimal` | `.toFixed(4)`/`.toFixed(6)` | 부동소수점이지만 **표시 전용**(계산에 재사용되지 않음, `logic.ts` 주석이 명시) | Low 위험(세전 이자·세금·만기금액 어디에도 영향 없음, 자릿수 반올림 오차 있어도 소수 넷째~여섯째 자리 표시에만 국한) |

**4-A. 세금 반올림(2곳) — 안전함을 브루트포스로 확인**
"이미 정수인 값에 정수 퍼센트를 곱하는 경우"(`round(preTaxInterest×0.14)`)에 대해
정확한 round-half-up(사사오입) 기준값(BigInt로 `floor((numerator×2+denominator)/(denominator
×2))`)과 대조했다. 정확히 X.5인 참값(타이)이 나오는 지점(`preTaxInterest ≡ 25 (mod 50)`,
`incomeTax ≡ 5 (mod 10)`)을 전체 유효 범위(0~183,581,498,337원, 0~25,701,409,767원)에
걸쳐 조밀 구간(0~2,000,000 전수) + 전 구간 촘촘한 스트라이드 + 무작위 60만 건으로
전수/샘플링 대조한 결과 **9,078,356건 전수 불일치 0건**이었다. 원인은 double이 `0.14`·
`0.1`을 각각 참값보다 아주 조금(약 1.33e-17, 5.55e-18) **크게** 표현하기 때문에, 정확히
타이인 값에서 항상 반올림이 "위로" 밀리는 방향과 사사오입(반올림 방향)이 우연이 아니라
구조적으로 일치한다(이 성질은 원금·이자 규모와 무관하게 유지된다) — 이론적 설명과 대규모
실증이 모두 일치하므로 PASS로 확정한다.

**4-B. `buildSavingsSchedule` 행별 반올림 — 새 결함(정답보다 1원 작게 계산)**

`logic.ts:220-237`의 `buildSavingsSchedule`은 적금 회차별(회차마다 잔여개월이 다른) 표시용
이자를 계산하는데, 이 계산은 **두 차례의 BigInt 재구현(월복리 1차, 단리·적금 총합 2차)
어디에도 포함되지 않았다** — 여전히 순수 부동소수점이다:
```ts
const rawInterest = (monthlyContribution * (annualRatePercent / 100) * remainingMonths) / 12;
rows.push({ ..., interest: Math.round(rawInterest) });
```
Optimizer(2차)는 "재검증 필요 사항" 3번에서 이 함수를 "결함으로 지목되지 않았고(합계가
아니라 행별 독립 반올림이라 산식 구조가 다르다)"며 의도적으로 건드리지 않았다고 밝혔는데,
이 판단은 **직접 브루트포스로 검증되지 않은 이론적 추정이었고, 틀렸다** — "합계 vs 행별"
차이는 반올림 정책(Math.round 사용, 다른 함수들의 floor와 다름)의 차이일 뿐, 부동소수점
곱셈·나눗셈 자체의 표현 오차 취약성과는 무관하다. 실제로 이 함수는 이전 라운드들에서
발견된 `calculateDepositSimple`/`calculateInstallmentSimpleInterestTotal`의 수정 전
구현과 **완전히 동일한 구조**(원금류 값 × (연이율/100) × 개월 / 12, BigInt 없음)를 갖고
있다.

독립 브루트포스(월 납입액 10종(10,000~50,000,000원) × 연이율 전체 3,001개 값 × 잔여개월
1~120 전 구간, 총 3,601,200건 전수 대조)로 확인한 결과:
```
checked 3,601,200, mismatches 26,930 (0.7478%)
diff distribution: { "-1": 26930 }   ← 전부 정답보다 정확히 1원 작게 계산됨(반대 방향 없음)
```
최소 재현 사례(정상적인 입력, 극단값 아님):
```
monthlyContribution=10,000원, annualRatePercent=0.03%, remainingMonths=2개월
참값(사사오입) = 정확히 0.5원 → 반올림하면 1원이 되어야 함
실제 코드: rawInterest = 0.49999999999999994 (부동소수점 표현 오차로 0.5보다 미세하게 작음)
Math.round(0.49999999999999994) = 0  ← 틀림(정답 1원보다 1원 작음)
```
직접 재현해 원인을 확인했다: `10,000 × (0.03/100) × 2 / 12` 연산 과정에서
`10,000×(0.03/100) = 2.9999999999999996`(참값 `3`보다 미세하게 작음)이 먼저 발생하고, 이
오차가 그대로 전파돼 최종 `rawInterest`가 정확한 타이(0.5)보다 약간 작아지면서 `Math.round`가
반대 방향(아래)으로 반올림한다 — 위 "4-A"의 세금 반올림과 반대 결과다: 세금 반올림은
승수(0.14, 0.1)의 double 표현이 참값보다 "커서" 우연히 안전했지만, 여기서는 곱셈·나눗셈
체인(원금류 값과 `annualRatePercent/100`의 곱, 그리고 `/12`)의 누적 오차 방향이 케이스마다
달라 안전을 보장하지 못한다 — 즉 4-A의 "우연한 안전"이 여기서는 재현되지 않는다.

**영향 범위**: 이 값은 **표시 전용**이다 — `preTaxInterest`(세전 이자 총합, BigInt로
이미 정확), `incomeTax`/`localIncomeTax`/`afterTaxInterest`/`afterTaxMaturityAmount`
어디에도 재사용되지 않는다(`calculateSavings`가 `buildSavingsSchedule`의 반환값을
`schedule` 필드에만 담고, `preTaxInterest`는 별도로 `calculateInstallmentSimpleInterestTotal`
호출 결과를 쓴다 — `logic.ts:255-277` 확인). 즉 세후 만기수령액 등 "핵심 결과"는 이 버그의
영향을 받지 않는다. 다만 사용자에게 실제로 표시되는 "회차별 이자" 표의 특정 행 숫자가
틀리게 나오고, `formatScheduleSumNotice`(합계 불일치 고지 문구)의 계산도 이 틀린 행 값을
그대로 합산하므로 고지 문구의 금액도 함께 부정확해진다.

**등급 판정**: `docs/EVALUATION.md`의 "High: 특정 정상 입력에서 잘못된 결과"에 해당한다.
발생 빈도(전체 도메인의 0.75%)는 이전 라운드의 적금 총합 버그(5~10%)보다는 낮지만, 예금
단리 버그(원금 20억원 이상에서만 발생)보다는 넓은 범위(월 납입액·연이율 전 구간에 걸쳐
분산)에서 발생하고, 재현이 쉬운 매우 평범한 입력(월 10,000원, 연 0.03%대의 낮은 금리도
포함)에서도 발생한다는 점에서 사용자 체감 가능성이 낮지 않다고 판단한다. FORMULA.md
"계산 순서(적금)" 7단계 자체는 정확하다(공식 재검토 요청 사유 아님) — 순수하게 구현이
아직 BigInt로 전환되지 않은 부동소수점 잔존 지점의 문제다.

**권고(강제 아님)**: 이미 검증된 것과 동일한 BigInt 패턴을 그대로 적용하면 해소된다:
```
rowRateHundredths = round(annualRatePercent × 100)
행별 이자 = round-half-up(monthlyContribution × rowRateHundredths × remainingMonths / 120000)  (BigInt)
```
다만 이 함수는 `Math.floor`가 아니라 `Math.round`(사사오입)를 쓰므로, 위 "4-A"에서 이미
검증한 `exactRoundHalfUp(numerator, denominator) = (numerator×2n+denominator)/(denominator×2n)`
형태의 BigInt round-half-up 공식을 적용해야 한다(단순 floor 치환이 아님에 주의).

---

### 5. military-salary 회귀 확인(요청 4번) — 결론: PASS

- `npx vitest run src/calculators/military-salary --no-file-parallelism` → **4개 파일,
  18개 테스트 전부 통과**(기존 17개 + 2차 Optimizer가 추가한 반례 회귀 테스트 1개).
- 신규 회귀 테스트(`550,000원/4.02%/3개월 → estimatedInterestWon=11,055`)가 실제로
  "이전엔 틀렸다가 지금은 맞다"는 것을 독립적으로 확인하기 위해, 수정 전 구현을 그대로
  재현한 별도 계산(`Math.floor((550000*(4.02/100)*((3*4)/2))/12)`)을 직접 실행한 결과
  `11,054`(오답)가 나옴을 확인했다 — 현재 실제 코드 결과(`11,055`, 정답)와 다르다는 것을
  독립적으로 재현했다.
- 기존 Golden Test(`550,000원/18개월/5% → 391,875`)가 "나누어떨어지는 값이라 원래도 버그의
  영향을 받지 않았다"는 Optimizer의 주장을 직접 재계산해 확인했다:
  `550,000 × 0.05 × (18×19/2) / 12 = 550,000 × 0.05 × 171 / 12 = 4,702,500 / 12 =
  391,875`(나머지 0, 정수). 수정 전 구현(`Math.floor(...)`)으로 재현해도 동일하게
  `391,875`가 나옴을 확인했다 — Optimizer의 주장은 사실이다.

**결론: PASS.** military-salary는 회귀 없이 정상 동작하며, 재검증이 지목했던 실사용
반례도 정확히 해소되었다.

---

### 6. 예금 월복리(1차에서 이미 고친 BigInt 구현)가 이번 라운드에서 손상되지 않았는지(요청 5번) — 결론: PASS(단, git diff 불가로 코드 읽기+재검증으로 대체)

`src/calculators/deposit-savings-interest-calculator/logic.ts`,
`src/lib/installment-savings.ts` 모두 `git status`상 여전히 untracked(신규 파일, 커밋
이력 없음) 상태라, git으로 "이번 라운드 vs 직전 라운드"의 라인 단위 diff를 만들 수 없었다
(정직하게 기록 — 이 한계는 이전 라운드의 Calculation Auditor(재검증)도 동일하게 겪었다).
대신 다음 두 가지로 대체 검증했다:
- **코드 읽기**: `calculateCompoundPreTaxInterestExact`(`logic.ts:129-148`)의 docstring이
  "왜 부동소수점 대신 BigInt 유리수 연산인가"를 설명하면서 "**두 번째 라운드에서 교체됨**"
  이라는 문구가 붙은 것은 바로 위 `calculateSimplePreTaxInterestExact`(단리)뿐이고,
  컴파운드 함수의 docstring에는 그런 "이번 라운드" 표시가 없다 — 즉 이번(2차 Optimizer)
  라운드가 손댄 함수가 아님을 문서상으로도 확인했다.
- **신선한 브루트포스(75,020건, 위 "3." 표의 `[compound-deposit]` 행)**: 연이율 전체
  3,001개 값 × 원금 4종(100만원~100억원) × 기간 5종(1·5·12·60·120개월) 격자 + 무작위
  15,000건에서 **불일치 0건**을 확인했다 — 손상되었다면 이 규모의 브루트포스에서 반드시
  드러났을 것이다.

**결론: PASS(회귀 없음).** git 이력 부재라는 한계는 있으나, 코드 내용과 대규모 브루트포스
양쪽에서 손상 징후가 전혀 없다.

---

### 7. 더 넓은 부동소수점 취약 지점 재점검(요청 6번) — 종합

위 "4."의 표에서 정리했듯, `logic.ts`·`installment-savings.ts`·`formatting.ts`의 모든
`Math.floor`/`Math.round` 지점(및 그에 준하는 재무 계산 관련 산술)을 전수 분류한 결과:
- **BigInt 정수 연산(3곳)**: 예금 단리·예금 월복리·적금(공유 함수) 세전 이자 총합 — 전부
  PASS(위 "1.", "3.", "6.").
- **부동소수점이지만 안전이 실증된 곳(2곳)**: 이자소득세·지방소득세 반올림 — 대규모
  브루트포스(9,078,356건)로 PASS 확정(위 "4-A").
- **부동소수점이고 실제로 안전하지 않은 곳(1곳, 신규 발견)**: `buildSavingsSchedule` 행별
  이자 반올림 — FAIL(위 "4-B").
- **정수만 다루어 위험이 없는 곳(1곳)**: `formatTermMonths`의 `Math.floor(termMonths/12)`.
- **표시 전용이라 계산 체인에 재사용되지 않는 곳(2곳, Low)**: `formatMonthlyRatePercent`/
  `formatMonthlyRateDecimal`의 `toFixed()` — 월이율 표시 소수 자릿수에만 영향, 세전 이자·
  세금·만기금액 등 어떤 금액에도 영향을 주지 않는다(코드 주석이 명시: "절사 로직에 관여하지
  않으므로 정밀도 문제와 무관"). 별도 브루트포스는 실시하지 않았다 — 위험도가 낮고(표시
  자릿수 오차 최대 1 ULP 수준), 이번 라운드의 시간·범위 안에서는 "핵심 결과"에 영향을 주는
  지점(위 6곳)을 우선했다. 다음 라운드가 필요시 점검할 수 있다.

3라운드에 걸쳐 매번 새로운 부동소수점 결함이 하나씩 발견된 패턴 — (1차) 월복리 epsilon
2건, (2차) 예금 단리·적금 총합 2건, (이번 3차) 적금 행별 표시 1건 — 은 "부분적으로만
BigInt로 전환하고 이론적 추정으로 나머지를 안전하다고 판단하는 방식" 자체가 신뢰할 수
없다는 것을 강하게 시사한다. 이번 라운드에서 남은 유일한 미해결 floating-point 계산
지점(`buildSavingsSchedule`)까지 발견해 명시적으로 표로 정리했으므로, 다음 Optimizer
라운드가 이 함수까지 BigInt로 전환하면 이 계산기의 `logic.ts`/`installment-savings.ts`
안에 있는 **모든 금액 계산이 부동소수점 근사 없이 BigInt로 통일**된다 — 그 시점 이후에는
"또 새로운 지점이 남아있을 위험"이 구조적으로 사라진다(표시 전용 `toFixed()` 2곳 제외).

---

### 8. 전체 회귀(요청 7번) — 결론: PASS

- `npx tsc --noEmit`: 클린(에러 0건).
- `npx vitest run --no-file-parallelism`(전체 스위트): **95개 파일, 1,334개 테스트 전부
  통과**(Optimizer(2차) 보고와 정확히 일치, 재확인).
- `npx vitest run src/calculators/deposit-savings-interest-calculator src/lib/installment-savings.test.ts --no-file-parallelism`:
  5개 파일, 58개 테스트 전부 통과.
- `npx vitest run src/calculators/military-salary --no-file-parallelism`: 4개 파일, 18개
  테스트 전부 통과.

기존 Golden Test 전부가 통과한다는 사실 자체가, 위 "4-B"에서 발견한 `buildSavingsSchedule`
버그(발생률 0.75%)를 어떤 기존 테스트도 우연히 건드리지 않았다는 것을 재확인해줄 뿐,
결함이 없다는 근거는 아니다(이전 라운드들과 동일한 패턴).

---

### 종합 이슈 목록(2차 재검증)

| # | 항목 | 등급 | 분류 | 상태 |
|---|---|---|---|---|
| 3(구) | 예금 단리 `floorPreTaxInterest` 고정 epsilon이 원금 20억원 이상에서 뚫림 | High | Builder/Optimizer 결함 | 해소 확인(PASS) |
| 4(구) | 적금(및 military-salary 공유) `calculateInstallmentSimpleInterestTotal`에 epsilon이 없어 5~10% 틀림 | High | Builder/Optimizer 결함 | 해소 확인(PASS) |
| 6(신규) | `buildSavingsSchedule`(적금 회차별 표시 이자)의 `Math.round(rawInterest)`가 순수 부동소수점이라 전체 입력 도메인의 약 0.75%에서 정답보다 1원 작게 계산됨(예: 10,000원·0.03%·잔여2개월 → 0원, 정답 1원) | High | Builder/Optimizer 결함(미해결, 두 차례의 BigInt 전환에서 누락됨) | FAIL 사유 |
| 5(구) | FORMULA.md 핵심 결정 1·2 vs fsb.or.kr 실제 동작 불일치 | Medium | 공식 재검토 요청(v2에서 정책 유지로 응답, 이견 없음) | 재확인, 이견 없음(종료) |

그 외 검증 항목(예금 단리·컴파운드·적금 총합 BigInt 정확성 585,181건 브루트포스, 세 반례
재현, 이자소득세·지방소득세 반올림 안전성 9,078,356건 브루트포스, military-salary 회귀,
예금 월복리 무손상, 전체 테스트 스위트)은 전부 **PASS**, Critical 없음.

### 최종 판정(2차 재검증)

**Calculation Auditor 판정: FAIL(계산 정확성 기준) — 유지, 세 번째로 사유가 바뀌었다.**

이번 라운드에서 요청받은 핵심 검증 항목(예금 단리 BigInt 구현, 공유 함수
`calculateInstallmentSimpleInterestTotal`의 새 BigInt 구현, 3개 명시 반례, military-salary
회귀, 예금 월복리 무손상)은 **모두 PASS**로 확인했다 — 독립 브루트포스 585,181건(새 시드,
Optimizer의 68,053+56,038건과 겹치지 않는 별도 생성) 전수 불일치 0건, 세 반례
(`9,000,000,000/6.27%/113개월→5,313,825,000`, `10,000/0.03%/7개월→7`,
`550,000/4.02%/3개월→11,055`) 전부 정확히 재현됨을 확인했다. 재검증이 지목했던 High #3·#4는
완전히 해소되었다.

그러나 요청 6번("더 넓은 관점에서 아직 남아있는 부동소수점 취약 지점이 없는지 마지막으로
한 번 더 훑어라")에 따라 `logic.ts`·`installment-savings.ts`의 모든 산술 연산을 전수
분류하고 아직 브루트포스로 검증되지 않았던 나머지 지점(세금 반올림 2곳, 적금 행별 표시
반올림 1곳)까지 마저 브루트포스한 결과, 이자소득세 반올림 2곳은 안전함을 대규모로
확인했지만(9,078,356건, 우연이 아니라 double 표현이 항상 참값보다 큰 방향이라는 구조적
이유로 안전함), **`buildSavingsSchedule`의 행별 반올림(적금 회차별 표시 이자)이 두 차례의
BigInt 전환 어디에도 포함되지 않은 채 여전히 순수 부동소수점으로 남아 있었고, 전체 입력
도메인의 약 0.75%에서 정답보다 1원 작게 계산되는 것을 새로 발견했다.** 이는
`docs/EVALUATION.md`의 "High: 특정 정상 입력에서 잘못된 결과"에 해당하며,
"계산 정확성에 Critical 또는 High가 하나라도 있으면 전체 FAIL이다" 규정에 따라 이 계산기는
여전히 PASS할 수 없다.

이 결함의 영향은 세후 만기수령액 등 핵심 결과(이미 BigInt로 정확)에는 미치지 않고, 적금
모드의 "회차별 이자" 표시 표의 특정 행(및 그 행들을 합산하는 `formatScheduleSumNotice`
고지 문구의 금액)에만 국한된다는 점에서 이전 두 라운드에서 발견된 결함들(핵심 세전
이자·세후 금액 자체가 틀림)보다는 사용자에게 미치는 실질적 파급력이 다소 좁다고 판단하지만,
여전히 사용자에게 실제로 표시되는 "계산된 숫자"가 틀리는 재현 가능한 결함이므로 등급을
낮출 근거는 없다.

**PASS를 위해서는**: Optimizer(또는 Builder)가 `buildSavingsSchedule`의 행별 이자 계산도
나머지 세 함수와 동일한 BigInt round-half-up 패턴으로 전환해 이슈 #6을 해소해야 한다(위
"4-B." 끝의 권고 공식 참고, 강제 아님). 이 함수까지 전환되면 이 계산기의 모든 금액 계산
경로가 부동소수점 근사 없이 BigInt로 통일되므로, 다음 라운드에서 또 다른 미발견
부동소수점 지점이 나올 구조적 위험이 크게 줄어들 것으로 판단한다.

## Optimizer (3차)

### 수정 범위 — Calculation Auditor (2차 재검증) 종합 이슈 목록 #6(신규, High)만 처리

이번 라운드는 Calculation Auditor (2차 재검증) "4-B."·"종합 이슈 목록 #6"이 지목한
`buildSavingsSchedule`(적금 회차별 breakdown 표) 행별 반올림 결함 1건만 대상으로 한다.
`preTaxInterest`(예금 단리/월복리, 적금 총합), 세금 계산(`calculateInterestIncomeTax`)은
직전 두 라운드에서 이미 BigInt/브루트포스로 검증이 끝났으므로 일절 건드리지 않았다 — 실제로
`git diff`(비교 대상: 이번 세션 시작 시점의 파일 내용)로 이 라운드에서 수정한 범위가
`buildSavingsSchedule` 함수 본문·docstring과 그 바로 앞에 새로 추가한 `roundHalfUpBigInt`
헬퍼 함수뿐임을 재확인했다.

### 채택한 방식 — 요청이 지시한 BigInt round-half-up 패턴을 그대로 적용

`src/calculators/deposit-savings-interest-calculator/logic.ts`에 `roundHalfUpBigInt(numerator,
denominator) = (numerator×2n + denominator) / (denominator×2n)` 헬퍼를 새로 추가했다(BigInt
나눗셈은 0 방향 절삭이지만, 이 파일이 다루는 값은 전부 0 이상이므로 절삭=floor와 같다 —
`x = numerator/denominator`라 할 때 이 식은 정확히 `floor(x + 0.5)`, 즉 사사오입과 같다).
`buildSavingsSchedule`을 다음과 같이 바꿨다:

```ts
const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
const denominator = 120000n;
...
const numerator = BigInt(monthlyContribution) * rateHundredths * BigInt(remainingMonths);
interest: Number(roundHalfUpBigInt(numerator, denominator))
```

이는 예금 단리(`calculateSimplePreTaxInterestExact`)·적금 총합
(`calculateInstallmentSimpleInterestTotal`)이 이미 검증받은 것과 완전히 같은 유도
(`annualRatePercent × 100`이 항상 정수이므로 `principal 류 값 × (annualRatePercent/100) ×
개월수/12 = 원금류 값 × rateHundredths × 개월수 / 120000`)를 쓰되, 저 두 함수는 `preTaxInterest`
(FORMULA.md "핵심 결정 1" — 절사)라 단순 BigInt 나눗셈(0 방향 절삭 = floor)을 그대로 썼고,
이 함수는 FORMULA.md "계산 순서(적금)" 7단계가 "사사오입"으로 명시했으므로 `roundHalfUpBigInt`로
반올림한다는 점만 다르다 — 공식·반올림 정책 자체(FORMULA.md)는 전혀 바꾸지 않았고, 오직
부동소수점 구현 방식만 BigInt로 교체했다.

`calculateInterestIncomeTax`(세금 반올림 2곳)는 건드리지 않았다 — Calculation Auditor (2차
재검증) "4-A"가 9,078,356건 브루트포스로 이미 안전함을 실증했고(`round(preTaxInterest×0.14)`,
`round(incomeTax×0.10)`의 double 표현이 참값보다 항상 미세하게 크게 표현돼 반올림 타이가
구조적으로 항상 "위로" 밀린다), 요청 4번("다른 곳은 절대 건드리지 마라")과도 일치한다.

### 독립 브루트포스 검증

Calculation Auditor(재검증·2차 재검증)와 동일한 2단계 방법론(1단계: `logic.ts`를 전혀 참조하지
않는 독립 "정답 생성기", 2단계: 그 결과를 실제 프로덕션 코드에 대조)을 그대로 재사용해 세션
스크래치패드(`C:\Users\isnan\AppData\Local\Temp\claude\d-----cal\1d788a4e-7225-4012-a29e-122d7fc095b2\scratchpad`)에
스크립트를 작성했다(소스 코드는 수정하지 않음, 실행용 임시 스크립트는 검증 직후 삭제).

1. **1단계(Python, `gen_schedule_samples.py`)** — FORMULA.md "계산 순서(적금)" 7단계
   (`interest_i(raw) = monthlyContribution × (annualRatePercent/100) × remainingMonths_i ÷ 12`,
   `interest_i(표시) = round(interest_i(raw))`)를 Python `decimal.Decimal`
   (`ROUND_HALF_UP`, 임의정밀도 10진 연산)으로 독립 재구현했다. `annualRatePercent`가
   FORMULA.md 입력 제약상 항상 0.01% 단위이므로, `k = annualRatePercent×100`(정수) **0~3000
   전체**(연이율 0~30% 전 구간, 전수)를 훑어 입력 도메인 전체를 커버했다:
   - 월 납입액 10종(FORMULA.md 하한 10,000원부터 상한 50,000,000원까지, 10,000/20,000/
     50,000/100,000/500,000/1,000,000/5,000,000/10,000,000/20,000,000/50,000,000원 — 자릿수를
     고르게 커버).
   - 연이율 `k` 0~3000 전수(3,001개 값, 즉 0.00%~30.00% 0.01% 단위 전 구간).
   - 잔여개월 1~120 전 구간(FORMULA.md 기간 상한 120개월과 일치).
   - 총 `10 × 3,001 × 120 = 3,601,200`건의 (월납입액, 연이율, 잔여개월) 조합 전수 — 즉
     표본이 아니라 이 세 축(월납입액은 10개 대표값으로 고정)의 **격자 전수 스윕**이다.
   - 요청이 명시한 반례(`10,000원/0.03%/잔여2개월 → 1`)가 정답 생성기 자체에서도 재현되는지
     `assert`로 스크립트 안에서 자체 점검했다(재현됨, 별도 삭제 없이 스크립트 자체에 남겨
     매번 자동 검증되도록 했다).
2. **2단계(Node/tsx)** — 1단계가 만든 `samples.json`을 읽어, 수정 없이 그대로 **실제
   프로덕션 코드**(`buildSavingsSchedule`)를 직접 import해서 호출하고(월납입액·연이율 조합당
   `buildSavingsSchedule(contribution, rate, 120)` 1회 호출로 잔여개월 120~1인 120개 행을
   한 번에 얻어 총 3,601,200개 행 전부를 대조), 반환된 각 행의 `interest`가 1단계의 참값과
   정확히 일치하는지 전수 대조했다.

**결과: 3,601,200건 전수 완전 일치, 불일치 0건.**

```
total row comparisons: 3601200
mismatches: 0
repro check (10,000/0.03%/잔여2개월): installment1.interest=1 (expect 1)
```

**검증 방법론 자체의 변별력 확인(대조군)**: 같은 3,601,200개 표본에 대해 수정 전 구현
(`Math.round((monthlyContribution × (annualRatePercent/100) × remainingMonths) / 12)`, 순수
부동소수점)을 별도 스크립트로 재현해 돌린 결과, **33,390건(0.9272%)이 불일치**했고 그 차이는
`diffCounts = { "-1": 33390 }` — 전부 정확히 "정답보다 1원 작게"였다(방향 일관성이 Calculation
Auditor 보고의 "전부 -1"과 정확히 일치). Calculation Auditor가 보고한 headline 반례도 이
대조군에서 정확히 재현됨을 확인했다:

```
mismatches (old buggy impl): 33390 (0.9272%)
diff distribution: { '-1': 33390 }
repro check (10,000/0.03%/잔여2개월) old impl -> 0 (expect wrong: 0, correct: 1)
```

(Calculation Auditor가 보고한 불일치율 0.7478%·26,930건과 이번 대조군의 0.9272%·33,390건은
표본 구성이 다르기 때문에 — Auditor는 월납입액 10종을 격자로 쓰되 이번 표본과 정확히 같은
10개 값을 썼는지 문서에 명시하지 않았고, 이번 검증은 연이율 3,001개 값 전수 × 잔여개월 120
전수 × 월납입액 10종을 완전히 새로 구성했다 — 정확히 같은 표본이 아니므로 수치 자체는 다를
수 있으나, "항상 -1 방향으로 틀린다"는 정성적 결론과 "약 0.7~1% 수준에서 발생한다"는 규모감은
서로 일치한다. 핵심은 새 구현(BigInt round-half-up)에서는 같은 표본 3,601,200건 전부가
일치했고, 수정 전 구현에서는 같은 표본으로 실제로 수만 건이 틀렸다는 대조 자체다 — 즉 이번
브루트포스가 "항상 통과하는 무의미한 테스트"가 아니라 실제로 결함을 잡아낼 수 있는 변별력이
있음을 재확인했다.)

### 완료 조건 재확인

- `npx tsc --noEmit`: 클린(에러 0건).
- `npx vitest run --no-file-parallelism`(전체 스위트): **95개 파일, 1,335개 테스트 전부
  통과**(직전 라운드의 95개 파일·1,334개 테스트 + 이번에 추가한 회귀 방지 Golden Test 1개).
  - `npx vitest run src/calculators/deposit-savings-interest-calculator --no-file-parallelism`:
    4개 파일, 54개 테스트 전부 통과. 이번 라운드가 `logic.test.ts`의 `buildSavingsSchedule`
    describe 블록에 신규 `it` 1개(위 회귀 방지 Golden Test)만 추가했으므로, 전체 스위트
    테스트 수 증가분(1,334→1,335)과 정확히 일치한다.
- `npm run build`: 성공(정적 페이지 40개 생성 확인, 에러 없음).
- `npx eslint .`: 에러 0건, 경고 6건(전부 기존 `role="radio"` + aria 속성 조합의 사전에
  존재하던 경고 — `bmr-calculator`, `deposit-savings-interest-calculator`,
  `housing-acquisition-tax`(2건), `housing-subscription-score`, `loan-interest-calculator`.
  이번 라운드로 새로 추가된 경고는 0건).
- `logic.test.ts`에 회귀 방지 Golden Test를 추가했다: `buildSavingsSchedule(10_000, 0.03, 2)`가
  `installment=1(remainingMonths=2)`에서 정확히 `interest: 1`을(참값 0.5원의 사사오입),
  `installment=2(remainingMonths=1)`에서 `interest: 0`을(참값 0.25원, 타이가 아니므로 영향
  없음을 확인하는 대조용) 반환하는지 검증한다. 수정 전 구현으로 재현하면 첫 번째 값이
  `0`(오답)이 나옴을 위 "독립 브루트포스 검증" 대조군에서 확인했다.
- FORMULA.md의 산식·반올림 정책 자체는 전혀 수정하지 않았다(git diff 확인 — 이번 라운드는
  `logic.ts`, `logic.test.ts`, 이 EVALUATION.md만 변경했다).

### 다음 라운드로 넘기는 상태

Calculation Auditor (2차 재검증)가 "종합 이슈 목록"에 남긴 4개 항목 중 이번 라운드가 처리한
것은 #6(신규, High) 하나뿐이다. #3(구, `floorPreTaxInterest` epsilon)·#4(구,
`calculateInstallmentSimpleInterestTotal` epsilon 부재)는 이미 2차 재검증에서 "해소
확인(PASS)"로 종결됐고, #5(구, FORMULA.md 핵심 결정 1·2 vs fsb.or.kr)는 "재확인, 이견
없음(종료)"로 이미 종결된 상태라 이번 라운드가 추가로 처리할 것이 없었다. 이번 수정으로
`logic.ts`·`src/lib/installment-savings.ts` 안의 금액 계산 경로(예금 단리·월복리, 적금 총합,
적금 행별 표시, 이자소득세 2곳) 전부가 부동소수점 근사 없이 BigInt(또는 브루트포스로 안전이
실증된 부동소수점) 기반이 되었다는 것이 Calculation Auditor (2차 재검증) "7."의 표가 정리한
전수 분류와 이번 라운드의 수정을 합친 결과다 — 다음 Calculation Auditor 3차 재검증이 이
계산기 전체(회귀 없음 포함)를 다시 한번 독립적으로 확인해야 최종 PASS 여부가 결정된다.

## Calculation Auditor (3차 재검증)

### 검증 방법

Optimizer(3차)가 "`buildSavingsSchedule`을 `roundHalfUpBigInt` 헬퍼로 BigInt round-half-up
전환해 이슈 #6을 해소했다"는 보고와 3,601,200건 브루트포스(불일치 0건) 주장을 그대로
신뢰하지 않고, 이전 세 라운드와는 의도적으로 다른 방법·다른 경로로 독립 재검증했다:

1. `tasks/deposit-savings-interest-calculator/EVALUATION.md`의 "## Calculation Auditor
   (2차 재검증)"(직전 판정, 항목 "4-B"가 이 버그를 발견)·"## Optimizer (3차)"(이번 수정 내역)를
   전체 재확인했다.
2. `src/calculators/deposit-savings-interest-calculator/logic.ts`를 코드로 다시 읽어
   `roundHalfUpBigInt`·`buildSavingsSchedule`의 실제 구현이 보고와 일치하는지 확인했다.
3. 실행 검증 방식 자체를 이전 세 라운드와 다르게 바꿨다. 이전 라운드들은 tsx/ts-node가
   설치돼 있지 않아 함수 본문을 손으로(또는 정규식으로) 추출해 별도 스크립트에 옮겨 붙이는
   방식을 썼다. 이번에는 이 프로젝트의 Node.js 버전(v24.17.0)이 .mts 파일의 TypeScript
   타입 구문을 네이티브로 스트립해 직접 실행할 수 있다는 것을 먼저 확인한 뒤 logic.ts,
   installment-savings.ts, rates-2026.json 파일을 스크래치패드로 그대로 복사하고, @/ 경로
   별칭이 들어간 import 구문 2줄만 상대경로로 바꾼 것 외에는 한 글자도 수정하지 않은 사본을
   만들어, 이 사본을 Node가 직접 import해서 실제 함수(buildSavingsSchedule,
   calculateDepositSimple/calculateDepositCompound/calculateSavings)를 그대로 호출하는
   방식을 썼다. "손으로 옮겨 적은 코드가 원본과 같은지 육안 대조"라는 이전 라운드의 한계를
   구조적으로 제거했다(교체한 import 2줄은 파이썬 str.count()==1 assertion으로 정확히
   1회씩만 치환됐음을 기계적으로 검증했다).
4. 소스가 실제로 쓰는 반올림 공식 (numerator*2n+denominator)/(denominator*2n)을 검증
   스크립트의 정답으로 재사용하지 않고, 완전히 별도로 코딩한 divmod 기반 알고리즘
   (q = numerator/denominator, r = numerator%denominator, r*2 >= denominator이면 q+1)을
   Node/TypeScript로 새로 작성해, 이 두 공식이 대수적으로 항상 같은 값을 내는지부터 먼저
   증명한 뒤(아래 "1."), 그 증명과는 별개로 실제 코드 대조에도 이 독립 알고리즘을 정답으로
   사용했다.
5. 대규모 전수 격자는 Node 자체 내에서 완결시켰다(월납입액 14종 — 이전 라운드가 쓴
   "10,000의 배수 10종"과 겹치지 않도록 일부러 비라운드 숫자를 섞음 — x 연이율 0~30%
   3,001개 값 전수 x 잔여개월 1~120 전수 = 5,041,680건).
6. 이와 별도로 Python(decimal.Decimal 미사용, 순수 정수 divmod만 사용 — 이전 라운드들이
   전부 decimal.Decimal(ROUND_HALF_UP)을 썼던 것과 의도적으로 다른 경로)으로 정확히 .5인
   타이(tie) 케이스를 의도적으로 33건 구성(작은 규모부터 원금 근접 상한 49,999,999까지
   다양한 크기)하고, 여기에 전체 도메인 무작위 50,000건을 더해 실제 buildSavingsSchedule과
   대조했다.
7. 이번 라운드가 손대지 않았다고 보고된 나머지 세 함수(예금 단리·월복리, 적금 총합)도
   diff 대신 코드 읽기에 그치지 않고 추가로 156,156건 브루트포스(별도로 새로 작성한 divmod
   기반 floor 레퍼런스)로 재확인했다.
8. logic.ts, installment-savings.ts, formatting.ts(및 관련 types.ts, validation.ts,
   ui.tsx, content.ts)의 모든 산술 연산 지점을 grep으로 전수 재나열해 분류했다(아래 "5.").
9. npx tsc --noEmit, npx vitest run --no-file-parallelism(전체 스위트), 이 계산기 전용
   스위트, military-salary 스위트를 재실행했다.

logic.ts, installment-savings.ts는 이번에도 git status상 여전히 untracked(신규 파일)라
git diff로 "이번 라운드 vs 직전 라운드"를 기계적으로 비교할 수는 없었다(이전 라운드들과
동일한 한계, 정직하게 재기록). 대신 "## Calculation Auditor (2차 재검증)"가 코드를 그대로
인용해 둔 세 함수(calculateSimplePreTaxInterestExact, calculateCompoundPreTaxInterestExact,
calculateInstallmentSimpleInterestTotal)의 본문을 현재 파일과 문자 단위로 대조해 완전히
동일함을 확인했다 — Optimizer(3차)가 "이번 라운드에서 수정한 범위는 buildSavingsSchedule
함수 본문·docstring과 새로 추가한 roundHalfUpBigInt 헬퍼뿐"이라고 밝힌 것과 일치한다.

---

### 1. [최우선] roundHalfUpBigInt의 수학적 정확성 — 결론: PASS

logic.ts:150-162를 직접 읽었다:

    function roundHalfUpBigInt(numerator: bigint, denominator: bigint): bigint {
      return (numerator * 2n + denominator) / (denominator * 2n);
    }

**대수 증명**: numerator, denominator가 모두 0 이상인 정수이므로 numerator = q*denominator + r
(q, r은 나눗셈의 몫·나머지, 0 <= r < denominator)로 유일하게 쓸 수 있다. 이때

    (numerator*2 + denominator) / (denominator*2)
    = (2q*denominator + 2r + denominator) / (2*denominator)
    = q + (2r + denominator) / (2*denominator)

0 <= r < denominator이므로 denominator <= 2r+denominator < 3*denominator < 4*denominator이고,
따라서 (2r+denominator)/(2*denominator)의 몫은 항상 0 또는 1이다 — 정확히 2r >= denominator
(즉 r/denominator >= 0.5, 참값 x = numerator/denominator의 소수부가 0.5 이상)일 때만 1이다.
BigInt 나눗셈은 비음수 피연산자에서 0 방향 절삭(=floor)이므로, 전체 식은 다음과 같다:

    floor((numerator*2+denominator)/(denominator*2)) = q + [2r >= denominator] = floor(x + 0.5)

이는 정확히 "사사오입"(반올림, 소수부 0.5 이상이면 올림)의 수학적 정의와 완전히 일치한다.
특히 정확히 r/denominator = 0.5인 타이 지점에서, 2r = denominator이므로 조건
2r >= denominator이 참이 되어 반드시 올림(q+1)된다 — FORMULA.md "계산 순서(적금)" 7단계의
"사사오입"(0.5는 올림) 정의와 정확히 일치한다(내림 방향으로 치우치는 "banker's rounding" 등이
아니다).

**독립 구현과의 교차검증**: 위 증명과는 완전히 별개로, divmod + 나머지 직접 비교(r*2 >=
denominator이면 q+1)로 새로 코딩한 참조 구현을 실제 roundHalfUpBigInt(를 품은
buildSavingsSchedule)와 5,041,680건 + 50,042건 전수 대조해 단 한 건의 불일치도 없음을
실증했다(아래 "4." 참고) — 이론적 증명과 대규모 실측이 모두 일치한다.

**결론: PASS.** roundHalfUpBigInt는 근사가 아니라 수학적으로 엄밀한 사사오입이며, 타이
방향도 FORMULA.md와 정확히 일치한다.

---

### 2. buildSavingsSchedule 호출 인자 검증 — 결론: PASS

logic.ts:257-279를 직접 읽었다:

    const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
    const denominator = 120000n;
    ...
    const remainingMonths = months - installment + 1;
    const numerator = BigInt(monthlyContribution) * rateHundredths * BigInt(remainingMonths);
    interest: Number(roundHalfUpBigInt(numerator, denominator))

- fencepost 확인: remainingMonths = months - installment + 1이므로 installment=1일 때
  remainingMonths=months(1회차가 가장 길다), installment=months일 때 remainingMonths=1
  (마지막 회차는 1개월분) — FORMULA.md "계산 순서(적금)"의 fencepost 규칙과 일치한다.
- 원 산식과의 대수적 동치성 재확인: interest_i(raw) = monthlyContribution x
  (annualRatePercent/100) x remainingMonths_i / 12이고, annualRatePercent*100 =
  rateHundredths(정수)이므로 annualRatePercent/100 = rateHundredths/10000. 따라서
  interest_i(raw) = monthlyContribution x rateHundredths x remainingMonths_i / 120000이
  대수적으로 정확히 성립한다 — numerator = monthlyContribution x rateHundredths x
  remainingMonths_i, denominator = 120000n이라는 실제 호출 인자와 정확히 일치한다. 이는
  calculateSimplePreTaxInterestExact(예금 단리, 2차 재검증에서 이미 검증됨)와 완전히 같은
  rateHundredths 변환 로직을 재사용한 것이며, 일관성이 유지된다.
- roundHalfUpBigInt(numerator, denominator)로 반올림(사사오입)하고, Number()로 변환해
  interest 필드에 담는다 — preTaxInterest(절사, floor)와 달리 이 필드만 반올림 정책을 쓴다는
  FORMULA.md "계산 순서" 7단계의 차별점이 코드에 정확히 반영돼 있다.

**결론: PASS.**

---

### 3. 다른 3개 함수(예금 단리·월복리, 적금 총합) 무변경·정책 분리 확인 — 결론: PASS

- calculateSimplePreTaxInterestExact(logic.ts:85-98), calculateCompoundPreTaxInterestExact
  (logic.ts:129-148), calculateInstallmentSimpleInterestTotal(installment-savings.ts:66-79)
  세 함수의 코드를 "## Calculation Auditor (2차 재검증)" "1.", "2."가 인용한 코드와 한
  글자씩 대조한 결과 완전히 동일하다 — 이번 라운드가 건드리지 않았다는 Optimizer(3차)의
  보고와 일치한다.
- 절사(floor) vs 반올림(round-half-up) 정책이 함수별로 올바르게 분리돼 있음을 재확인:
  세 함수 모두 return Number(numerator/denominator)(단순 BigInt 나눗셈, 0 방향 절삭=floor)
  로 끝난다 — roundHalfUpBigInt를 전혀 쓰지 않는다. 오직 buildSavingsSchedule만
  roundHalfUpBigInt를 쓴다. FORMULA.md가 preTaxInterest(예금 단리/월복리, 적금 총합)는
  "절사", 적금 회차별 표시 이자는 "사사오입"으로 서로 다르게 규정한 것과 코드가 정확히
  1:1로 대응한다 — 혼용되거나 뒤바뀐 지점이 없다.
- 156,156건 추가 브루트포스 재확인(diff 대신 실행 검증): 세 함수 모두 divmod 기반 floor
  레퍼런스(소스 공식과 독립적으로 새로 코딩)와 전수 대조한 결과 불일치 0건. 예금 단리(원금
  10종, 연이율 1,001개 값 스텝 3, 기간 8종), 적금 총합(월납입액 8종, 연이율 1,001개 값,
  기간 8종), 예금 월복리(원금 4종, 연이율 429개 값 스텝 7, 기간 7종 — 지수 연산 비용을
  고려해 촘촘한 격자보다는 넓은 분산을 택함) 모두 포함한다.

**결론: PASS(무변경 확인 + 정책 분리 확인 + 재검증 모두 통과).**

---

### 4. 독립 브루트포스 재검증 — 결론: PASS, 반례 완전 해소 + 타이 33건 전부 올바른 방향

Optimizer(3차)의 Python decimal.Decimal(ROUND_HALF_UP) 3,601,200건 보고를 그대로 신뢰하지
않고, 완전히 다른 두 경로로 재생성해 대조했다(둘 다 이전 세 라운드가 쓴 적 없는 새 방식):

**4-A. Node 전용 전수 격자(5,041,680건) — 독립 divmod 알고리즘 대조**

    total comparisons: 5041680
    mismatches: 0
    diffCounts: {}
    elapsed ms: 246

월납입액 14종(이전 라운드의 "10,000의 배수 10종"과 달리 12345, 33333, 99999, 456789,
3333333, 33000001 등 비라운드 숫자를 섞음, 경계값 10,000, 50,000,000 포함) x 연이율 0~30%
3,001개 값 전수 x 잔여개월 1~120 전수를 완전히 전수 스윕했다. 소스의 반올림 공식을 전혀
재사용하지 않고 divmod+나머지 비교로 새로 코딩한 참조 구현과 대조해 단 한 건의 불일치도
없었다.

**4-B. Python(순수 정수, decimal 미사용) — 의도적 타이(.5) 33건 + 무작위 50,000건**

    total samples: 50042
    exact-tie samples: 33
    mismatches: 0 (of which exact-tie mismatches: 0)

numerator mod 120000 == 60000(참값의 소수부가 정확히 0.5)이 되도록 월납입액·연이율·잔여개월
조합을 역산해 33건을 의도적으로 구성했다(원 반례 10,000/0.03%/잔여2개월 포함, 원금
654,321, 49,999,999 등 규모가 다른 사례도 포함). 33건 전부 예외 없이 "올림" 방향으로
반올림됨을 실제 코드 실행으로 확인했다(예: 654,321/12.5%/잔여112개월 -> floor=763,374,
actual=763,375 — 올림 확인. 49,999,999/12.5%/잔여48개월 -> floor=24,999,999,
actual=25,000,000 — 원금 상한 근처에서도 올림 확인). 무작위 표본에는 타이가 아닌 근접
케이스도 다수 섞여 있었고 모두 올바르게 계산됐다.

요청이 명시한 원 반례도 재확인했다: buildSavingsSchedule(10000, 0.03, 2) ->
installment=1(remainingMonths=2) -> interest=1(정답, 수정 전 구현은 0).

**검증 방법론의 변별력**: Optimizer(3차)가 이미 수정 전 구현으로 같은 규모(3,601,200건)를
재현해 33,390건(0.93%) 불일치를 보고했고, 이번 4-B의 "수정 전 구현이었다면 0을 반환했을
것"이라는 명시적 계산으로 레퍼런스 알고리즘이 실제로 결함을 구분해낼 수 있다는 것이 다시
확인된다(무의미하게 항상 통과하는 테스트가 아니다).

**결론: PASS.** 새로운 방법론(다른 검증 경로: Node 네이티브 실행 + 독립 divmod 알고리즘,
Python 순수 정수 타이 케이스)으로도 5,091,722건(5,041,680 + 50,042) 전수 불일치 0건을
재확인했다. 원 반례(10,000/0.03%/잔여2개월 -> 1)는 완전히 해소됐고, 정확히 .5인 타이 33건
전부 FORMULA.md의 "사사오입"(0.5는 올림) 정의와 일치하는 방향으로 반올림된다.

---

### 5. 이 계산기 전체의 부동소수점 위험 최종 점검

logic.ts, installment-savings.ts, formatting.ts(및 관련 types.ts, validation.ts, ui.tsx,
content.ts)의 모든 산술 연산 지점을 grep으로 전수 재나열해 분류했다:

| 파일:위치 | 연산 | 분류 | 근거 |
|---|---|---|---|
| logic.ts:92 (예금 단리) rateHundredths=BigInt(Math.round(annualRatePercent*100)) | 부동소수점 -> 즉시 BigInt 스냅 | (a) 안전(BigInt 변환 지점) | 이론적 여유(±0.5)가 실제 부동소수점 오차(~1e-13)보다 압도적으로 큼. 5,041,680건 브루트포스가 이 변환이 항상 옳게 복원됨을 실증 |
| logic.ts:139 (예금 월복리) 동일 패턴 | 동일 | (a) | 75,020건(직전 라운드) + 이번 156,156건 일부 포함 브루트포스로 재확인 |
| logic.ts:264 (적금 회차별) 동일 패턴 | 동일 | (a) | 4-A, 4-B 5,091,722건이 정확히 이 지점 포함 |
| installment-savings.ts:71 (적금 총합) 동일 패턴 | 동일 | (a) | 156,156건 포함 |
| logic.ts:95,144,270 BigInt(principal)*rateHundredths*BigInt(termMonths) 등 수식 본체 | BigInt 정수 연산만 | (a) 안전(근사 없음, 수학적으로 엄밀) | 위 "1.","2." 대수 증명 + 전수 브루트포스 |
| logic.ts:150-162 roundHalfUpBigInt | BigInt 정수 연산만 | (a) 안전 | 위 "1." 대수 증명 |
| logic.ts:165 Math.round(preTaxInterest*INCOME_TAX_RATE)(소득세) | 순수 부동소수점(정수x0.14) | (c) 검증된 안전 | 코드 무변경 확인. "## Calculation Auditor (2차 재검증)" "4-A"가 9,078,356건 전수로 "double(0.14)이 참값보다 항상 미세하게 크게 표현돼 타이가 구조적으로 항상 위로 밀린다"는 것을 실증했고, 이번 라운드는 코드가 바뀌지 않았음을 확인했으므로 그 결론이 그대로 유효하다(이번 라운드에서 재실행하지 않음 — 코드 무변경이 전제) |
| logic.ts:166 Math.round(incomeTax*LOCAL_INCOME_TAX_RATE)(지방소득세) | 동일 | 동일 | 동일 |
| logic.ts:207 monthlyRate=annualRatePercent/100/12(월복리 표시용) | 순수 부동소수점 | (c)이지만 무해 | 표시 전용 — calculateDepositCompound의 preTaxInterest는 별도로 calculateCompoundPreTaxInterestExact(BigInt)가 계산하고, monthlyRate는 어떤 금액 계산에도 재사용되지 않는다(formatMonthlyRatePercent/formatMonthlyRateDecimal이 표시 문자열로만 소비). 코드 주석이 명시 |
| logic.ts:299 totalPrincipal=monthlyContribution*termMonths | 정수x정수(둘 다 검증된 범위: 최대 5천만원x120=60억) | (b) 구조적으로 안전 | 곱 최댓값(60억)이 Number.MAX_SAFE_INTEGER(약 900조)보다 압도적으로 작아, JS 정수 곱셈이 항상 정확하다(부동소수점 반올림 여지 없음) |
| formatting.ts:31 Math.floor(termMonths/12) | 정수/정수(1~120 범위 소정수) | (b) 구조적으로 안전 | termMonths는 검증된 1~120 정수. 소정수 나눗셈은 IEEE754 double에서 참값 근처 오차가 1 미만이라 경계 오분류 위험이 없고, 금액 계산과 무관(기간 표시 라벨용) |
| ui.tsx:460, validation.ts:99 MAX_TERM_MONTHS/12(=120/12) | 정수/정수(상수) | (b) 안전 | 상수 나눗셈, 화면 안내 문구용, 계산 체인과 무관 |
| formatting.ts:44,50 .toFixed(4)/.toFixed(6)(월이율 표시) | 부동소수점 표시 반올림 | Low(표시 전용) | 세전 이자·세금·만기금액 등 어떤 금액에도 재사용되지 않음(이전 라운드부터 동일 결론, 이번 라운드도 재확인) |
| content.ts, validation.ts(입력 파싱 Number()) | 계산 없음(파싱만) 또는 없음 | 해당 없음 | grep 결과 Math.* 또는 계산성 산술 없음 |

Math.pow — 실제 프로덕션 코드(logic.ts 본문)에는 0건. grep 결과 Math.pow가 등장하는 곳은
전부 (1) 주석(과거 방식 설명), (2) logic.test.ts의 "정밀 재계산 확정값" 산출 방법론
서술뿐이다 — 현재 계산 로직 어디에도 Math.pow가 남아있지 않다(월복리는 BigInt base**n
사용).

**최종 결론**: (a) BigInt로 완전히 안전하게 전환된 지점 4개 함수(예금 단리·월복리, 적금
총합, 적금 회차별) 전부 이번 라운드의 대규모 브루트포스로 재확인됐다. (b) 구조적으로 안전한
정수 연산 지점(3곳)은 입력 범위상 Number.MAX_SAFE_INTEGER에 전혀 근접하지 않아 위험이
없다. (c) 순수 부동소수점이지만 이미 대규모 브루트포스로 안전이 실증된 지점(세금 반올림
2곳)은 이번 라운드에 코드 변경이 없었으므로 그 실증 결과가 그대로 유효하다. 표시 전용
지점(월이율 관련 3곳)은 금액 계산에 재사용되지 않아 Low로 유지한다. 이 계산기의
logic.ts/installment-savings.ts 안에 있는 모든 금액(원 단위) 계산 경로가 부동소수점 근사
없이 BigInt 정수 연산(또는 대규모 실증으로 안전이 확인된 부동소수점)으로 커버되어 있음을
이번 라운드에서 최종 확인했다 — 4라운드에 걸쳐 순차적으로 발견된 4건의 결함이 다루던
지점을 전부 포함해, 추가로 새로운 지점이 없는지까지 훑었으나 새로운 결함을 발견하지
못했다.

---

### 6. 회귀 — 결론: PASS

- npx tsc --noEmit: 클린(에러 0건).
- npx vitest run --no-file-parallelism(전체 스위트): 95개 파일, 1,335개 테스트 전부
  통과(Optimizer(3차) 보고와 정확히 일치).
- npx vitest run src/calculators/deposit-savings-interest-calculator --no-file-parallelism:
  4개 파일, 54개 테스트 전부 통과(Optimizer(3차) 보고와 정확히 일치).
- npx vitest run src/calculators/military-salary --no-file-parallelism: 4개 파일, 18개
  테스트 전부 통과(회귀 없음).

---

### 종합 이슈 목록(3차 재검증)

| # | 항목 | 등급 | 분류 | 상태 |
|---|---|---|---|---|
| 6(구) | buildSavingsSchedule 행별 반올림이 순수 부동소수점이라 약 0.75~0.93%에서 1원 작게 계산됨 | High | Builder/Optimizer 결함 | 해소 확인(PASS) — roundHalfUpBigInt BigInt 전환으로 완전히 해소, 5,091,722건 신규 브루트포스(0건 불일치)로 독립 재확인 |
| 5(구) | FORMULA.md 핵심 결정 1·2 vs fsb.or.kr 실제 동작 불일치 | Medium | 공식 재검토 요청(v2에서 정책 유지로 응답) | 재확인 대상 아님(2차 재검증에서 "이견 없음(종료)"으로 이미 마감, 이번 라운드는 재론하지 않음) |

새로 발견한 이슈: 없음. 위 "5."의 전수 분류에서도 새로운 부동소수점 취약 지점을 찾지
못했다.

### 최종 판정(3차 재검증)

**Calculation Auditor 판정: PASS(계산 정확성 기준).**

4라운드(1차 Builder 구현 -> 1차 Optimizer(월복리 BigInt화) -> 2차 Optimizer(예금 단리·적금
총합 BigInt화) -> 3차 Optimizer(적금 회차별 표시 BigInt round-half-up화))에 걸쳐 순차적으로
발견된 부동소수점 결함 4건 — (1) 예금 월복리 지수연산 epsilon 결함, (2) 예금 단리 대형원금
epsilon 결함, (3) 공유 적금 함수(military-salary와 공유) epsilon 부재 결함, (4) 회차별 표
개별 행 반올림 결함 — 이 모두 해소되었음을 이번 라운드에서 이전 세 라운드와는 다른 독립적
방법(Node 네이티브 TypeScript 실행으로 실제 소스를 사본 형태로 직접 호출 — 손으로 옮겨
적는 방식이 아님, 소스의 반올림 공식과 무관하게 새로 코딩한 divmod 알고리즘, Python 순수
정수 타이 케이스 33건 의도적 구성, 대규모 전수 격자 5,091,722건 + 156,156건)로 재확인했다.

핵심 근거:
1. roundHalfUpBigInt가 대수적으로 정확히 floor(x+0.5)(사사오입)와 같음을 증명했고, 정확히
   .5인 타이 33건 전부(작은 규모부터 원금 상한 근처까지) 올바르게 "올림" 방향으로
   반올림됨을 실측으로 확인했다.
2. buildSavingsSchedule의 numerator/denominator 인자가 FORMULA.md 원 산식과 정확히
   대수적으로 동치임을 재확인했다.
3. 나머지 3개 함수(예금 단리·월복리, 적금 총합)가 이번 라운드에서 전혀 수정되지 않았고,
   floor(절사)/round-half-up(반올림) 정책이 함수별로 올바르게 분리 적용되고 있음을 코드
   대조(무변경 확인)와 156,156건 재브루트포스로 함께 확인했다.
4. 독립 브루트포스(합계 5,091,722건, 이전 세 라운드가 쓴 적 없는 두 가지 새 방법)로 원
   반례(10,000/0.03%/잔여2개월 -> 1)의 해소와 전체 도메인 무결성을 재확인했다.
5. logic.ts, installment-savings.ts, formatting.ts의 모든 산술 연산 지점을 grep으로 전수
   재나열해 (a) BigInt로 안전 전환된 지점, (b) 구조적으로 안전한 정수 연산, (c) 이미
   대규모 실증으로 안전이 확인된 부동소수점 지점으로 완전히 분류했고, 어떤 새로운
   미검증 지점도 남아있지 않음을 확인했다(Math.pow는 프로덕션 코드에 0건).
6. npx tsc --noEmit 클린, 전체 테스트 스위트(95개 파일·1,335개 테스트)·이 계산기 전용
   스위트(4개 파일·54개 테스트)·military-salary 스위트(4개 파일·18개 테스트) 모두
   Optimizer(3차)의 보고와 정확히 일치하게 통과했다.

**이로써 이 계산기(deposit-savings-interest-calculator)의 계산 정확성 검증은 최종적으로
완료되었다고 판단한다.** 4라운드에 걸쳐 매 라운드 새로운 결함이 하나씩 드러났던 패턴이
이번 라운드에서 처음으로 끊겼다 — "5."의 전수 분류가 보여주듯 이 계산기의 모든 금액 계산
경로가 이제 BigInt 정수 연산(또는 독립적으로 안전이 실증된 극히 제한된 부동소수점 지점)으로
커버되어 있어, 구조적으로 또 다른 미발견 지점이 남아있을 가능성이 이전 라운드들보다 훨씬
낮다고 판단한다. FORMULA.md "핵심 결정 1·2"(세전 이자 1원 절사, 이자소득세 2단계 분리
반올림)에 대한 "공식 재검토 요청"은 2차 재검증에서 이미 "이견 없음(종료)"로 마감된
상태이며, 이번 라운드는 이를 재론하지 않는다.

**남은 권고(강제 아님, PASS를 막지 않음)**: 세금 반올림 2곳(logic.ts:165-166)은 여전히
순수 부동소수점이며 "우연이 아니라 double 표현 방향이 항상 유리하다"는 구조적 안전성에
의존한다 — 수학적으로 견고하지만(2차 재검증이 9,078,356건으로 실증), 다음에 이자소득세율
자체가 개정되어 rates-2026.json의 값이 바뀌는 경우 이 구조적 안전성 논증을 재확인할
필요가 있다는 점을 다음 라운드(UX/UI Critic·QA 또는 향후 세율 개정 대응 라운드)에
인계한다.

---

## UX/UI Critic

평가 대상: `src/calculators/deposit-savings-interest-calculator/{ui.tsx,content.ts,validation.ts,types.ts,formatting.ts,logic.ts}`, `tasks/deposit-savings-interest-calculator/{SPEC.md,ARCHITECTURE.md}`.

사전 확인: Calculation Auditor 3차 재검증(`## Calculation Auditor (3차 재검증)` 최종 판정, 위 절)에서 "PASS(계산 정확성 기준)"로 종결되었음을 확인했다 — 4라운드에 걸친 부동소수점 버그(예금 월복리 epsilon, 예금 단리 대형원금 epsilon, 공유 적금 함수 epsilon 부재, 회차별 표 개별 행 반올림)가 모두 BigInt 정확 연산으로 해소되었다. 이 절은 계산 정확성을 재검증하지 않고 UX/UI 관점만 평가한다.

### 자체 평가 질문 (14개) 및 답변·등급

| # | 질문 | 대응 평가 항목 | 답변 요약 | 등급 |
|---|---|---|---|---|
| 1 (필수) | 모든 입력 라벨(연이율/예치·적립 기간/예치금액/이자 계산 방식/월 납입액)이 법령·전문 용어나 `FORMULA.md`/`SPEC.md` 문구를 그대로 복사한 것인가? | 입력 라벨 표현 | SPEC.md 자체가 이미 "계산법을 몰라도 쓸 수 있어야 한다" 기준으로 라벨 문구를 설계해뒀고(법령 용어인 "거치식 예금"류 표현은 라벨에 없음), 실제 구현도 그 문구를 그대로 옮겼다. "연이율"·"예치금액" 등은 법령 용어가 아니라 은행 상품설명서·일반 계산기에서 통용되는 표현이며, `loan-interest-calculator`도 동일 단어("연이율")를 쓴다. 단리/복리 옵션 옆에는 전문용어 없는 한 줄 요약(`depositInterestTypeSummaries`)이 붙어 있다. | 문제없음 |
| 2 (필수) | 입력 필드 순서가 논리적 순서(시간순에 준하는 흐름)인가? 관련 필드가 인접해 있는가? | 입력 순서·그룹핑 | 순서는 "계산 방식(모드) → 연이율 → 기간 → (모드 전용) 예치금액/월납입액 → (예금만) 이자 계산 방식"이다. 날짜 쌍처럼 "두 필드 사이에 이질적 필드가 끼는" 문제는 없고, 공통 입력(연이율·기간)을 먼저, 모드 전용 입력을 뒤에 배치한 정보구조는 그 자체로 일관성 있다. 다만 형제 계산기 `loan-interest-calculator`는 "금액 → 연이율 → 기간 → 방식" 순서를 쓴다 — 사이트 내 두 금융 계산기 간 필드 순서 관행이 갈린다(사용자가 두 계산기를 오갈 때 익숙한 순서가 아닐 수 있음). 논리적으로 틀린 순서는 아니라 심각하지 않다. | Low |
| 3 (필수) | 같은 개념이 폼·결과·오류 메시지·계산 근거 전체에서 한 용어로 통일돼 있는가? | 결과 가독성 / 용어 통일 | **두 건의 실제 용어 드리프트를 발견했다.** (a) 입력 폼 라벨은 "예치금액"(`ui.tsx:473`)인데, 핵심 결과 카드 dt는 "원금"(`ui.tsx:140`), 계산 근거의 만기수령액 단계도 "원금"(`formatting.ts:174`, `principalLabel = "원금"`)을 쓴다 — 같은 값(예치한 돈)을 폼에서는 "예치금액", 결과·근거에서는 "원금"으로 부른다. (b) 핵심 결과 카드의 dt "이자소득세"(`ui.tsx:148-149`)는 소득세+지방소득세 합계(`result.totalTax`, 15.4%)를 가리키는데, 바로 아래 "계산 방법" 섹션의 첫 세금 단계는 동일한 단어 "이자소득세(국세분) 계산"(`formatting.ts:156-160`)으로 소득세만(14%, `result.incomeTax`)을 가리킨다. 사용자가 카드에서 본 "이자소득세" 금액과 근거에서 본 "이자소득세(국세분)" 금액이 서로 다른 액수임을 눈치채지 못하면 혼란스러울 수 있다. | Medium |
| 4 (필수) | 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 묻지 않는가? | 불필요한 UI 요소 | 공통 2개(연이율, 기간) + 모드별 1~2개(예금: 예치금액+계산방식, 적금: 월납입액)로 이미 최소화돼 있다. 유도 가능한 값(예: 총 납입원금 = 월납입액×기간)을 별도로 묻지 않는다. | 문제없음 |
| 5 | 예금/적금 모드 토글이 직관적인가? 전환 시 필드 구성이 자연스럽게 바뀌는가? | 계산법을 몰라도 사용 가능 | 세그먼트 버튼("예금 계산"/"적금 계산")이 `aria-pressed`로 상태를 전달하고, 전환 즉시 하위 필드가 예금 전용(예치금액+계산방식)/적금 전용(월납입액)으로 완전히 바뀐다. 공통 필드(연이율·기간) 값은 유지되고, 결과·오류는 전환 시 초기화된다(`handleModeChange`). 자연스럽다. | 문제없음 |
| 6 | 단리/복리 선택이 명확하고 "복리가 항상 같거나 큼"을 사용자가 이해할 수 있는가? | 계산법을 몰라도 사용 가능 | 라디오 각 옵션 옆 한 줄 요약("이자에 이자가 붙지 않아요" / "매달 이자가 원금에 더해져 다음 달 이자가 조금씩 늘어나요")이 전문용어 없이 차이를 전달한다. FAQ 2번 답변이 "같은 조건이면 복리가 단리보다 항상 이자가 같거나 많습니다"를 명시적으로 설명한다. | 문제없음 |
| 7 | 세전/세후 이자, 이자소득세 breakdown의 구조·순서가 세무 비전문가에게 이해되는가? | 결과 가독성 | 순서(세전 이자 → 소득세 14% → 지방소득세 10%(소득세액 기준) → 세후 이자 → 세후 만기수령액)가 "라벨=값" 형태로 단계별로 나오고, 지방소득세 단계 설명에 "세전 이자가 아니라 확정된 소득세액 기준"이라는 주의문까지 붙어 있어 계산 순서 자체는 이해하기 쉽다. 다만 위 질문 3(b)에서 지적한 "이자소득세" 용어의 이중 의미가 이 섹션의 가독성을 깎아 먹는다. | Medium (질문 3과 동일 이슈) |
| 8 | 최대 120행 회차별 표가 모바일에서 사용 편한가(sticky header + 세로 스크롤 컨테이너 실제 구현 여부)? | 모바일 사용성 | `sticky top-0` 헤더 + `max-h-[420px] overflow-y-auto`는 ARCHITECTURE.md 설계대로 구현됐다. 그러나 같은 컨테이너에 `overflow-x-auto`와 `min-w-[420px]`(`ui.tsx:605-606`)가 함께 걸려 있다. SectionCard 패딩(`p-6`=24px×2)+아이콘 배지(36px+gap 12px)+페이지 패딩(`px-5`=20px×2)을 빼면 320px 화면에서 표에 실제로 남는 폭은 약 180~230px 수준으로 추정되는데, 표는 4개 열(회차/납입액/잔여개월/세전 이자) 콘텐츠만으로도 약 300px 안팎이 필요하고 여기에 강제된 `min-w-[420px]`까지 더해져 320~390px 폭 기기 대부분에서 가로 스크롤이 상시 발생할 것으로 예상된다. 세로 스크롤(최대 420px 높이)과 가로 스크롤이 같은 작은 영역에 동시에 걸리는 "이중 스크롤" 구조는 터치 조작 시 스크롤 방향이 헷갈리는 전형적인 모바일 UX 마찰 지점이다. ARCHITECTURE.md "8.2"가 정확히 이 지점을 "실기기 확인 후 카드 전환 재검토"로 위임했는데, 레이아웃 계산상 그 재검토 트리거 조건에 해당한다고 판단한다. QA의 실기기 확인을 강력히 권고한다. | Medium |
| 9 | 회차별 표 합계가 세전 이자와 원 단위로 다를 수 있다는 고지가 화면에 명확한가? | 계산 과정 이해 가능성 | `formatScheduleSumNotice`(`formatting.ts:87-102`)가 정적 문구가 아니라 실제 차이를 계산해("표의 합계(...)가 세전 이자(...)보다 N원 더 많습니다/적습니다") 표 바로 아래에 항상 표시한다. ARCHITECTURE.md가 제시한 두 옵션 중 더 투명한 옵션 1을 택했고, "계산 오류가 아니라 반올림 정책에 따른 자연스러운 차이"라는 오해 방지 문구까지 포함한다. | 문제없음 |
| 10 | 입력 경계값(원금/월납입액 하한 1만원, 연이율 0~30%, 기간 1~120개월) 오류 메시지가 이해하기 쉬운가? | 오류 메시지 이해 용이성 | 문구 자체는 명확하다("연이율은 0% 이상 30% 이하로 입력해 주세요.", "기간은 1개월 이상 120개월(10년) 이하로 입력해 주세요." 등, 형식 오류에도 예시 포함). 다만 termMonths 오류는 "(10년)"으로 단위를 변환해 감(感)을 주는 반면, 금액 오류(`validateAmount`)는 "10,000원 이상 10,000,000,000원 이하"처럼 콤마 숫자만 보여주고 "(100억원)" 같은 환산 힌트가 없어 큰 숫자를 순간적으로 읽기 어렵다(다만 `loan-interest-calculator`도 동일한 패턴이라 이 계산기만의 결함은 아니다). | Low |
| 11 | 계산 근거의 "법적 근거" 표시가 재무수학 공식과 실제 법령 조문을 구분해서 보여주는가? | 계산 과정 이해 가능성 | 단리/월복리/적금 총합 단계는 `legalBasis: "표준 재무수학(...)"`로, 소득세·지방소득세 단계는 실제 조문("소득세법 제129조제1항제1호", "지방세법 제103조의13제1항")으로 명확히 구분된다 — FORMULA.md가 구분한 "정책형 아님 vs 정책형" 성격을 UI가 그대로 반영한다. | 문제없음 |
| 12 | 우대금리 직접 입력 안내, "실제 은행과 다를 수 있다" 고지, 이자소득세율 법적 근거 고지가 적절한 위치에 충분히 배치돼 있는가? | 계산법을 몰라도 사용 가능 / 오류·고지 이해 | 연이율 필드 바로 아래 helpText(`ANNUAL_RATE_HELP_TEXT`)로 즉시 안내되고, "계산 전 확인" 섹션(정책 안내)과 FAQ 5번에서 같은 내용이 재확인된다. "실제 은행과 다를 수 있다"는 핵심 결과 카드 하단 한 줄 + 정책 안내 3번째 항목 + FAQ 4번에서 3중으로 고지된다. 이자소득세율 법적 근거(소득세법 제129조·지방세법 제103조의13·소액부징수 예외 소득세법 제86조)는 정책 안내 첫 항목에 조문까지 명시돼 있다. 배치와 반복 수준이 충분하다. | 문제없음 |
| 13 | 톤·카드 스타일·eyebrow 라벨이 `loan-interest-calculator`/`military-salary` 등 사이트 내 다른 계산기와 일관되는가? | 불필요한 UI 요소 / 일관성 | eyebrow 라벨 "금융"은 `registry.ts`의 `categoryLabels.finance`("금융")와 정확히 일치한다. 헤더 구조(`<Link href="/categories/finance">금융</Link>` → h1 → 설명문), 폼 컨테이너·버튼·카드 스타일(`rounded-2xl border border-border bg-surface`, 핵심 결과 카드 `bg-primary`), "계산 전 확인" 섹션 구성, 개인정보 고지 문구까지 `loan-interest-calculator/ui.tsx`와 클래스명 단위로 동일하다. 카피 톤("~계산합니다", "~계산하기" 버튼)도 일치한다. | 문제없음 |
| 14 | 극단적 최대 입력값에서 핵심 결과 숫자(`text-4xl`)가 좁은 화면에서 잘리거나 읽기 어려워지지 않는가? | 모바일 사용성 | 예치금액 상한(100억원)·연이율 상한(30%)·기간 상한(120개월) 조합이면 세후 만기수령액이 15~16자리 문자열이 될 수 있다. `<p>` 태그에 `whitespace-nowrap`이 없어 클리핑이나 페이지 가로 스크롤은 발생하지 않고 자동 줄바꿈되지만, 320px 화면에서는 두 줄로 꺾일 가능성이 있다. 다만 이는 극단값에서만 나타나고 사이트의 다른 금액 표시형 계산기에도 공통으로 존재하는 일반적 리스크라 이 계산기 고유의 결함은 아니다. | Low |

### 발견 이슈 등급별 표

| 등급 | 개수 | 이슈 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | (1) 입력 라벨 "예치금액" ↔ 결과/근거 "원금" 용어 불일치(`ui.tsx:140,174`, `formatting.ts:174`) — 질문 3 (2) 핵심 결과 카드 "이자소득세"(15.4% 합계)와 계산 근거 "이자소득세(국세분)"(14%만)의 동일 용어·다른 금액 문제(`ui.tsx:148-149`, `formatting.ts:156-160`) — 질문 3/7 (3) 회차별 표의 `min-w-[420px]` + 동일 컨테이너 내 이중(가로+세로) 스크롤로 320~390px 모바일에서 상시 가로 스크롤이 예상됨(`ui.tsx:605-606`) — 질문 8, ARCHITECTURE.md "8.2"가 위임한 실기기 재검토 트리거에 해당 |
| Low | 3 | (1) 폼 필드 순서(연이율→기간→금액)가 `loan-interest-calculator`(금액→연이율→기간)와 달라 사이트 내 관행 불일치 — 질문 2 (2) 금액 관련 오류 메시지가 큰 숫자를 억 단위로 환산해주지 않음(`validation.ts` `validateAmount`) — 질문 10 (3) 예치금액·연이율 상한 조합의 극단값에서 핵심 결과 숫자가 좁은 화면에서 두 줄로 줄바꿈될 가능성 — 질문 14 |

### 최종 판정

**UX/UI Critic 판정: PASS (Critical 0, High 0).**

Critical/High 이슈는 발견되지 않았다 — 예금/적금 모드 토글, 단리/복리 설명, 세전/세후 이자·이자소득세 breakdown 구조, 회차별 표 합계 불일치 고지, 우대금리/참고용/법적 근거 고지, 사이트 전반과의 톤·스타일 일관성은 모두 기준을 충족한다(`docs/DESIGN_SYSTEM.md` "공통 화면 순서", "입력 UX", "헤더 eyebrow 라벨" 규칙 포함).

다만 Medium 3건은 Optimizer 라운드에서 수정을 권고한다 — 특히 (2) "이자소득세" 용어의 이중 의미와 (1) "예치금액/원금" 용어 드리프트는 `docs/DESIGN_SYSTEM.md` "같은 개념은 폼·결과·오류 메시지 전체에서 한 용어로 통일한다" 규칙을 직접 위반하는 사례이므로, 코드 수정 없이도(라벨 문자열 교체만으로) 해소 가능하다. (3) 회차별 표의 모바일 가로 스크롤 문제는 QA의 320px 실기기 확인 결과에 따라 ARCHITECTURE.md가 이미 승인해 둔 대안(모바일 카드 리스트 전환, four-major-insurance 선례)을 적용할지 결정할 것을 권고한다.

## Optimizer (UX)

대상: 위 "## UX/UI Critic" 절이 남긴 Medium 3건. 계산 로직(`logic.ts`, `src/lib/installment-savings.ts`, 반올림/BigInt 연산)은 전혀 건드리지 않았다 — 이번 라운드는 문구·레이아웃만 수정한다.

### [권장 1] "예치금액" ↔ "원금" 용어 통일

`loan-interest-calculator`의 관례(입력 라벨 "대출 원금" — 결과·근거에서도 "원금"·"대출 원금"으로 이어짐)를 참고해, 이 사이트는 "원금"을 표준 용어로 쓰는 쪽으로 이미 기울어 있다고 판단했다. 다만 이 계산기는 예금/적금 두 모드를 한 화면에서 토글하므로 맥락 없이 "원금"만 쓰면 무엇의 원금인지 모호해질 수 있어, `loan-interest-calculator`가 "대출" 접두어를 붙인 것과 같은 방식으로 입력 라벨을 **"예치금액" → "예치 원금"**으로 바꿨다(핵심 결과 카드·계산 근거의 "원금"은 그대로 둠 — 이미 사이트 관례와 일치했으므로 그쪽을 바꿀 필요가 없었다). 사용자에게 노출되는 모든 지점(입력 라벨, 헤더 소개 문장, 오류 메시지, `content.ts` 사용 방법 3단계, `registry.ts` 카테고리 카드 설명)을 함께 바꿔 드리프트가 재발하지 않게 했다.

- `src/calculators/deposit-savings-interest-calculator/ui.tsx` — 입력 라벨(`principal` 필드), 헤더 소개 문단.
- `src/calculators/deposit-savings-interest-calculator/validation.ts` — `validateAmount`에 넘기는 `label` 인자("예치금액" → "예치 원금", 오류 메시지 3종에 그대로 반영됨: "~을 입력해 주세요.", "~은 숫자만 입력해 주세요.", "~은 …원 이상 …원 이하로 입력해 주세요.").
- `src/calculators/deposit-savings-interest-calculator/content.ts` — 사용 방법 3단계 설명.
- `src/calculators/registry.ts` — 이 계산기 카드/메타 설명.
- `src/calculators/deposit-savings-interest-calculator/ui.test.tsx` — 위 라벨 변경에 맞춰 `getByLabelText`/`getByText` 기대값 5곳을 "예치 원금"으로 갱신(그렇지 않으면 라벨 변경과 동시에 테스트가 깨짐).

`FORMULA.md`·`SPEC.md`·`ARCHITECTURE.md`(Formula Analyst/Architect 소유 문서)는 이번 라운드에서 수정하지 않았다 — 두 문서의 "예치금액"은 필드 개념을 가리키는 스펙 상 명칭이고, 이번 수정은 그 스펙을 구현하는 화면 문구만 다듬은 것이라 문서와 코드가 상충하지 않는다.

### [권장 2] "이자소득세" 용어 충돌 해소

Critic이 제시한 두 옵션 중 첫 번째(핵심 결과 카드 라벨에 세율을 명시)를 택했다. `ui.tsx`의 예금·적금 두 `KeyResultCard` 분기에 각각 있는 dt **"이자소득세" → "이자소득세(15.4%)"**로 바꿔(동일 문자열이 두 곳에 있어 `replace_all`로 한 번에 처리) 합계(15.4%, `result.totalTax`)임을 라벨 자체에서 드러냈다. "계산 방법" 섹션의 "이자소득세(국세분) 계산"(`formatting.ts`, 14%만 가리키는 `result.incomeTax`) 라벨은 그대로 두었다 — "(국세분)"이 이미 지방소득세를 제외한 국세 부분만을 뜻한다는 것을 나타내고 있고, 이제 두 라벨이 "(15.4%)" vs "(국세분)"으로 시각적으로도 다른 숫자를 가리킨다는 것이 더 분명해졌다.

### [권장 3] 회차별 표(적금 모드) 모바일 이중 스크롤

`docs/DESIGN_SYSTEM.md` "모바일" 절이 320px에서 "가로 스크롤 없음"을 명시적 검증 항목으로 못박고 있어, 단순히 `min-w-[420px]`만 제거하는 안(옵션 1)으로는 이 기준을 안전하게 만족시키기 어렵다고 판단했다 — 4개 열(회차/납입액/잔여개월/세전 이자)의 실제 콘텐츠 폭을 각 열의 최댓값(연이율 30%·월 납입액 5천만원·120개월 조합의 세전 이자는 원 단위로 9자리에 이를 수 있음)으로 추산하면 패딩을 압축해도 약 235px가 필요한데, `SectionCard`의 `p-6`(24px×2) + 아이콘 배지(36px+gap 12px) + 페이지 `px-5`(20px×2)를 뺀 320px 화면의 실제 가용 폭은 약 184px에 그쳐 여전히 부족했다.

그래서 ARCHITECTURE.md "8.2"가 예고한 대안 중 카드/리스트 전환(옵션 2)을 택하되, ARCHITECTURE.md가 예시로 든 `four-major-insurance`가 아니라(실제 코드를 확인해 보니 이 계산기는 카드 전환 없이 `overflow-x-auto` + `min-w-[620px]` 표만 쓰고 있어 참고할 실제 구현이 없었다) `loan-interest-calculator`의 "연도별 상환 스케줄 요약" 섹션이 이미 쓰고 있는 `sm:hidden`(모바일 리스트) / `hidden sm:block`(데스크톱 표) 이중 렌더링 패턴을 그대로 재사용했다:

- `sm:` 미만: `<ul>` 안에 회차별로 `<li>`를 두고, 각 항목을 "회차 N / 잔여 M개월"(첫 줄) + "납입액"·"세전 이자"(`<dl>`로 각각 한 줄씩 세로 배치)로 표시한다. 한 줄에 라벨+값이 모두 들어가므로(예: "세전 이자 148,750,000원" ≈ 162px) 184px 가용 폭 안에서도 가로 스크롤 없이 들어간다. 세로 스크롤은 기존과 동일하게 `max-h-[420px] overflow-y-auto`로 유지한다(120행 전체를 한 화면에 늘어놓지 않기 위해 — ARCHITECTURE.md "8.2"의 "고정 높이 스크롤 컨테이너" 결정을 표/리스트 두 버전 모두에서 지켰다).
- `sm:` 이상: 기존 `<table>`을 그대로 두되(레이아웃 변경 없음) 더 이상 필요 없는 `min-w-[420px]` 강제만 제거했다(640px 이상에서는 어차피 여유 폭이 충분해 표가 자연스럽게 들어간다).
- 두 버전 모두 같은 `scheduleRows`(`formatting.ts`의 `buildSavingsScheduleDisplayRows`)를 소비하므로 표시되는 숫자는 완전히 동일하다 — 계산 로직도, 표시 포맷팅 함수도 변경하지 않았다.
- jsdom 테스트 환경은 CSS 미디어 쿼리를 평가하지 않아 `sm:hidden`/`hidden sm:block` 두 블록이 항상 함께 렌더링되지만, 리스트 쪽은 `<table>`/`<tr role="row">`를 쓰지 않으므로 기존 `ui.test.tsx`의 `within(scheduleSection).getAllByRole("row")` 기대값(13행 = 헤더 1 + 12회차)에 영향이 없음을 테스트 실행으로 확인했다.

### 완료 조건 확인

- `npx tsc --noEmit`: 통과(출력 없음).
- `npx vitest run`: 95개 파일, 1,335개 테스트 전부 통과(회귀 없음). `deposit-savings-interest-calculator`만 별도로도 재확인(4개 파일 54개 테스트 통과) — `logic.test.ts`의 Golden Test 값(4라운드 확정치, 예: 예금 단리 샘플 10,253,800원, 월복리 샘플 10,257,319원, 적금 샘플 6,082,485원)이 `ui.test.tsx` 검증값과 여전히 일치해 계산 결과 숫자가 하나도 바뀌지 않았음을 재확인했다.
- `npm run build`: Next.js 프로덕션 빌드 성공(40개 정적 페이지 생성 포함).
- `npx eslint .`: 오류 0건. 경고 6건은 모두 `aria-required`/`aria-invalid`를 라디오 `input`에 쓴 기존 패턴(`bmr-calculator`, `deposit-savings-interest-calculator`, `housing-acquisition-tax`, `housing-subscription-score`, `loan-interest-calculator`)에 프로젝트 전역으로 이미 존재하던 것이며, 이번 라운드에서 손대지 않은 코드에서 발생해 회귀가 아니다.

### 다음 단계

QA가 이어서 검증한다(Optimizer는 판정하지 않음). 특히 [권장 3]은 실제 320px 기기(또는 브라우저 기기 에뮬레이션)에서 리스트 버전이 가로 스크롤 없이 4개 정보를 모두 보여주는지 최종 확인이 필요하다.

---

## UX/UI Critic (재검증)

평가 대상: `src/calculators/deposit-savings-interest-calculator/{ui.tsx,content.ts,validation.ts,formatting.ts,logic.ts}`, `src/lib/installment-savings.ts`, `src/calculators/registry.ts`, `src/calculators/deposit-savings-interest-calculator/ui.test.tsx`. 비교 대상: `src/calculators/loan-interest-calculator/ui.tsx`(원금 용어·모바일 표 대안 패턴의 사이트 내 선례).

사전 확인: 위 "## Optimizer (UX)" 절이 명시한 대상(직전 "## UX/UI Critic" 절이 남긴 Medium 3건)만 재검증한다 — 계산 정확성은 이미 "## Calculation Auditor (3차 재검증)"에서 PASS로 종결되었으므로 재검증 범위에 포함하지 않되, Optimizer가 로직 파일을 실제로 건드리지 않았는지는 회귀 방지 차원에서 코드로 직접 확인한다.

### 자체 평가 질문 (12개) 및 답변·등급

| # | 질문 | 대응 평가 항목 | 답변 요약 | 등급 |
|---|---|---|---|---|
| 1 (필수) | 입력 라벨(계산 방식/연이율/예치·적립 기간/예치 원금/이자 계산 방식/월 납입액)에 법령·전문 용어나 스펙 문서 문구를 그대로 복사한 것이 있는가? | 입력 라벨 표현 | "예치 원금"으로 바뀐 라벨을 포함해 전부 은행 상품설명서·일상어 수준 표현이다. "예치 원금"은 법령 용어가 아니라 `loan-interest-calculator`의 "대출 원금"과 같은 조어 방식(거래 유형 접두어+원금)이라 일관된 관례로 볼 수 있다. | 문제없음 |
| 2 (필수) | 입력 필드 순서가 논리적 흐름이고 관련 필드가 인접해 있는가? (이전 라운드 Low 회귀 확인 포함) | 입력 순서·그룹핑 | 순서(계산 방식→연이율→기간→모드 전용 금액→이자 계산 방식)는 이번 라운드에서 손대지 않아 변경이 없다. 직전 라운드가 남긴 Low("`loan-interest-calculator`는 금액→연이율→기간 순, 이 계산기는 연이율→기간→금액 순")는 여전히 유효하지만 이번 Optimizer 수정 범위 밖의 기존 이슈이며 악화되지 않았다. | Low (기존 이슈 유지, 회귀 아님) |
| 3 (필수) | 같은 개념이 폼·결과·계산 근거 전체에서 한 용어로 통일돼 있는가? — 이번 재검증의 핵심 항목 | 결과 가독성 / 용어 통일 | 실제 코드 확인 결과 두 건 모두 해소됨. (a) 입력 라벨 `ui.tsx:473` "예치 원금"으로 변경되었고, 핵심 결과 카드(`ui.tsx:140`)와 계산 근거(`formatting.ts:174` `principalLabel`)는 원래도 "원금"을 썼으므로 이제 "예치 원금"(입력) → "원금"(결과·근거)으로 이어지는 구조가 되어, `loan-interest-calculator`의 "대출 원금"(입력) → "원금"(결과·근거 `formatting.ts` 동일 패턴)과 동일한 관례를 따른다 — 표현 자체가 100% 동일 문자열은 아니지만 "무엇의 원금인지"를 라벨에서 명시하고 이후 맥락에서 축약하는 사이트 표준 패턴과 일치해 혼동 소지가 없다. (b) 핵심 결과 카드 dt가 예금·적금 두 분기 모두 "이자소득세" → "이자소득세(15.4%)"로 바뀌었음을 `ui.tsx:148`, `ui.tsx:196` 두 곳에서 확인했다. 계산 근거의 "이자소득세(국세분) 계산"(`formatting.ts:157`)은 그대로 남아 있어, 이제 "(15.4%)"=합계(`totalTax`) vs "(국세분)"=소득세만(14%, `incomeTax`)이 라벨 문자열만으로도 서로 다른 숫자를 가리킨다는 것이 명시적으로 드러난다. | 문제없음 |
| 4 (필수) | 입력 필드 수가 최소인가? 유도 가능한 값을 중복으로 묻지 않는가? | 불필요한 UI 요소 | 이번 라운드에서 필드 구성 변경 없음(라벨 문자열만 교체). 공통 2개+모드별 1~2개 구조 그대로 유지. | 문제없음 |
| 5 | "예치 원금" 라벨이 예금/적금 두 모드를 오가는 화면에서 맥락 없이도 명확한가? | 계산법을 몰라도 사용 가능 / 입력 라벨 | 이 필드는 `mode === "deposit"`일 때만 렌더링되고(`ui.tsx:469-493`), 같은 화면에 "계산 방식: 예금 계산"이 활성 상태로 표시돼 있어 "무엇에 대한 원금인지" 모호함이 없다. 적금 모드에는 이 라벨 자체가 아예 나타나지 않으므로 두 모드 간 용어 충돌도 없다. | 문제없음 |
| 6 | "이자소득세(15.4%)"(핵심 결과)와 "이자소득세(국세분) 계산"(근거)이 이제 서로 다른 금액을 가리킨다는 것을 일반 사용자가 알아챌 수 있는가? | 계산 과정 이해 가능성 | 핵심 결과 카드 바로 아래 "계산 방법" 섹션이 이어지는 화면 순서상(`ui.tsx:594-668`), 사용자가 카드의 "이자소득세(15.4%)" 금액을 본 직후 근거 섹션에서 "이자소득세(국세분) 계산" 단계와 별도의 "지방소득세 계산" 단계가 순서대로 나와 두 금액을 더하면 15.4% 합계가 된다는 것을 자연스럽게 유추할 수 있다. 두 라벨이 서로 다른 괄호 수식어("(15.4%)" vs "(국세분)")를 쓰는 것 자체가 "이 둘은 다른 숫자"라는 신호를 준다. | 문제없음 |
| 7 | 모바일 `sm:hidden` 카드 리스트와 `hidden sm:block` 표가 실제로 구현되었고 같은 데이터(`scheduleRows`)를 쓰는가? | 모바일 사용성 | `ui.tsx:610` `<ul ... sm:hidden>`과 `ui.tsx:630` `<div ... hidden ... sm:block>`이 각각 존재하며 둘 다 동일한 `scheduleRows.map(...)`(`ui.tsx:348`에서 조립, `formatting.ts`의 `buildSavingsScheduleDisplayRows` 결과)를 순회한다 — 표시 문자열이 완전히 동일한 소스에서 나온다. 데스크톱 표에서 이전 Medium의 원인이던 `min-w-[420px]`는 제거되었고(`ui.tsx:631` `<table className="w-full text-left text-sm">`), `loan-interest-calculator`(`ui.tsx:557,577`)가 쓰는 `sm:hidden`/`hidden sm:block` 패턴과 구조적으로 동일하다. | 문제없음 |
| 8 | 모바일 카드 리스트가 4개 필드(회차/잔여개월/납입액/세전 이자)를 전부 보여주는가? 데스크톱과 정보량이 같은가? | 모바일 사용성 / 결과 가독성 | 카드 리스트(`ui.tsx:611-628`)는 "N회차"(첫 줄 좌측) + "잔여 M개월"(첫 줄 우측) + `<dl>`로 "납입액"·"세전 이자"(각각 한 줄)를 보여줘 4개 필드 모두 존재한다. 다만 라벨 표현이 데스크톱 표 헤더 "잔여개월"과 달리 모바일에서는 "잔여"로 축약되어 있고, 열 순서도 데스크톱(회차→납입액→잔여개월→세전 이자)과 모바일(회차→잔여→납입액→세전 이자)이 다르다 — 정보 누락은 없지만 완전히 동일한 문구·순서는 아니다. | Low |
| 9 (회귀 확인) | 계산 로직(`logic.ts`, `src/lib/installment-savings.ts`)이 이번 라운드에서 변경되지 않았는가? | (계산 정확성 회귀 방지 — UX 판정 전제 확인) | 두 파일을 전체 재확인했다. `logic.ts`는 예금 단리/월복리 BigInt 정확 연산, 적금 세전 이자 재사용 구조, 세율 적용 순서가 Calculation Auditor 3차 재검증 시점 그대로이며 이번 라운드와 관련된 주석·수정 흔적이 없다. `installment-savings.ts`도 동일하게 미변경 상태다. Optimizer가 명시한 "이번 라운드는 문구·레이아웃만 수정" 선언과 실제 코드가 일치한다. | 문제없음 |
| 10 | 용어 통일 과정에서 다른 화면 요소(오류 메시지, 사용법, FAQ, 카테고리 카드 설명)의 표현이 어색해지거나 "예치금액" 잔재가 사용자 노출 지점에 남지 않았는가? | 오류 메시지 이해 용이성 / 결과 가독성 | `validation.ts:146` `validateAmount` 호출의 `label` 인자가 "예치 원금"으로 바뀌어 오류 메시지 3종("예치 원금을 입력해 주세요.", "예치 원금은 숫자만 입력해 주세요.", "예치 원금은 10,000원 이상 …") 모두 자연스럽다. `content.ts` 사용법 3단계("예금은 예치 원금과 이자 계산 방식(단리/월복리)을…")와 `registry.ts:367`(카테고리 카드 설명 "예치 원금 또는 월 납입액과…")도 갱신되어 어색함이 없다. 남은 "예치금액" 문자열은 `types.ts:60` 필드 주석, `validation.ts:45` 주석, `validation.test.ts`의 테스트 설명(`it(...)`)뿐으로 전부 코드 내부용이며 화면에 노출되지 않는다. | 문제없음 |
| 11 | 늘어난 라벨 문자열 "이자소득세(15.4%)"(9자, 기존 5자보다 김)가 모바일 좁은 그리드(320px, `grid-cols-2`)에서 레이아웃을 깨뜨리지 않는가? | 모바일 사용성 | 핵심 결과 카드는 `p-6`(320px 기준 실사용폭 약 272px), `grid-cols-2 gap-x-4`이므로 컬럼당 약 128px다. `text-xs`(12px) 한글 9자는 줄바꿈 없이 들어가기 빠듯할 수 있으나, `<dt>`가 일반 블록 텍스트라 넘칠 경우 자동으로 두 줄로 감싸질 뿐 가로 넘침(overflow)이나 클리핑은 발생하지 않는다(다른 필드 dd 값이 `tabular-nums font-semibold`로 더 굵고 커도 같은 그리드에서 문제없이 표시되던 기존 레이아웃과 동일 구조). 기능적 결함은 아니나 실기기에서 두 줄로 꺾이는지 육안 확인은 QA 권고 사항이다. | Low |
| 12 | 이전 라운드 Low(필드 순서 사이트 관행 불일치)가 이번 라운드 수정으로 인해 새로 악화되거나 다른 부작용을 낳지 않았는가? | 입력 순서·그룹핑 (회귀 확인) | 이번 라운드는 라벨 문자열·모바일 레이아웃만 수정했고 필드 순서·구조는 손대지 않았다(질문 2와 동일 확인). 새로운 부작용 없음. | 문제없음 |

### 발견 이슈 등급별 표

| 등급 | 개수 | 이슈 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | 직전 라운드 Medium 3건 모두 코드 확인상 해소됨: (1) "예치 원금"↔"원금" 용어 드리프트 해소 — 질문 3 (2) "이자소득세(15.4%)"↔"이자소득세(국세분)" 라벨 충돌 해소 — 질문 3/6 (3) 회차별 표 모바일 이중 스크롤 해소(`sm:hidden`/`hidden sm:block` 이중 렌더링 + `min-w` 제거) — 질문 7 |
| Low | 3 | (1) 폼 필드 순서가 `loan-interest-calculator`와 여전히 달라 사이트 내 관행 불일치(기존 이슈, 이번 라운드 범위 밖, 악화되지 않음) — 질문 2/12 (2) 모바일 회차별 카드 리스트의 열 순서·라벨("잔여" vs "잔여개월")이 데스크톱 표와 완전히 동일하지 않음(정보 누락은 없음) — 질문 8 (3) "이자소득세(15.4%)" 라벨 문자열 길이 증가로 320px 폭 2열 그리드에서 두 줄로 꺾일 가능성(기능적 결함 아님, 실기기 육안 확인 권고) — 질문 11 |

### 최종 판정

**UX/UI Critic (재검증) 판정: PASS (Critical 0, High 0, Medium 0).**

Optimizer가 수정한 3건 모두 실제 코드에서 의도대로 적용되었음을 확인했다.
1. 입력 라벨 "예치금액" → "예치 원금"으로 바뀌었고, 핵심 결과 카드·계산 근거의 "원금" 표기와 `loan-interest-calculator`의 "대출 원금" 관례에 부합하는 방식으로 통일되었다(`ui.tsx:473`, `validation.ts:146`, `content.ts`, `registry.ts:367`). 오류 메시지·사용법·카테고리 카드까지 일관되게 반영되어 새로운 용어 드리프트를 만들지 않았다.
2. 핵심 결과 카드 dt가 예금·적금 두 분기 모두 "이자소득세(15.4%)"로 바뀌어(`ui.tsx:148,196`) 계산 근거의 "이자소득세(국세분) 계산"(14%만, `formatting.ts:157`)과 라벨 자체에서 명확히 구분된다.
3. 회차별 표에 `sm:hidden` 카드 리스트(`ui.tsx:610-629`)와 `hidden sm:block` 표(`ui.tsx:630-651`)가 실제로 구현되어 있고, 둘 다 동일한 `scheduleRows` 데이터를 쓰며, 좁은 화면에서 4개 필드(회차/잔여개월/납입액/세전 이자)가 모두 노출된다. 데스크톱 표의 `min-w-[420px]` 강제도 제거되었다.

계산 로직(`logic.ts`, `src/lib/installment-savings.ts`)은 코드 확인 결과 이번 라운드에서 전혀 변경되지 않아 회귀 위험이 없다. 새로 발견된 문제는 없으며, 남은 Low 3건(필드 순서 사이트 관행 불일치 — 기존 이슈, 모바일 카드/데스크톱 표 간 열 순서·라벨 미세 차이, 늘어난 라벨 문자열의 줄바꿈 가능성)은 모두 기능적 결함이 아닌 세부 다듬기 수준으로, QA의 실기기(320px) 확인 시 참고 사항으로 전달하는 것을 권고한다.

---

## QA

**검증일 2026-09-16. 판정: PASS.** 상세 보고서는 `tasks/deposit-savings-interest-calculator/QA.md` 참고. 기존
dev 서버(D:\유틸\cal, 3000포트)를 재사용하고, 격리된 `--user-data-dir` 프로파일의 Chrome·Edge(CDP)로
실제 브라우저 테스트를 진행했다(사용자 실제 브라우저·다른 프로젝트 dev 서버는 전혀 건드리지 않음).
5개 대표 Golden Test 시나리오(예금 단리·월복리, 적금 1pic.kr 대조값, 90억원 대형원금 Auditor
반례)가 화면 표시값과 원 단위까지 정확히 일치했다. "이자소득세(15.4%)"와 "이자소득세(국세분)"이
실제로 다른 숫자로, 서로 구분되는 위치에 표시됨을 확인했다. 회차별 표 모바일 카드/데스크톱 표
이원화가 5개 뷰포트(320~1440px)에서 오버플로 없이 정상 동작했고, 행별 합계 불일치 고지도 실제
불일치 케이스를 만들어 동적으로 정확한 문구가 뜨는 것을 확인했다. 입력 검증 전 범위(경계값·오류·
0%/1개월 정상 경로)가 명확하게 동작. 접근성(`aria-pressed`, `aria-invalid`, `aria-describedby`)
정상. **military-salary 회귀 없음**(공유 함수 버그 수정 이후 골든 테스트 391,875원 재확인)
— loan-interest-calculator·weekly-holiday-allowance도 정상. 전체 스위트(95파일/1335테스트) 통과,
Console Error 0건. 신규 발견 Critical/High/Medium 결함 **0건**, Low 5건(전부 기능 결함 아닌
사소한 사항 — 초기화 시 모드가 예금으로 고정, 극단값에서 헤드라인 금액 줄바꿈, 클립보드/Firefox
테스트 환경 한계 등).

---

## 점수 (오케스트레이터, 2026-09-16)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **34** | Calculation Auditor가 3차 재검증까지 거쳐 최종 PASS했다. 이 과정에서 실제로 발견된 부동소수점 버그 4건(예금 월복리 지수연산 epsilon, 예금 단리 대형원금 epsilon, 공유 적금 함수 전체 유효 입력 5~10% 오류, 회차별 표 개별 행 반올림)을 근사치 보정이 아니라 BigInt 기반 정확한 유리수 연산으로 오차 자체를 원천 제거했다 — 이 프로젝트의 다른 어떤 계산기보다 엄밀한 수준의 수치 정확성이다. 매 라운드마다 독립적인 임의정밀도(Python Fraction/Decimal) 브루트포스 검증(수만~수백만 건, 매번 다른 방법론으로 교차검증)을 반복 수행했고, 그 과정에서 이미 배포된 military-salary 계산기의 실제 결함까지 발견해 함께 수정하는 부수적 성과도 거뒀다. 은행연합회 실제 계산기 API를 직접 호출해 반올림 정책 상충을 확인하고 Formula Analyst가 재검토한 뒤 지방세법 문언에 더 충실한 기존 정책을 유지하기로 한 판단도 근거가 탄탄하다. 잔여 리스크(세전 이자 원단위 절사·반올림 방향의 완전한 1차 법적 근거 미확보, 영향은 항상 9원 이하)로 −1. |
| 예외/경계값 처리 | 15 | **15** | 원금/월납입액 상하한, 연이율 0~30%(0%는 유효 경계), 기간 1~120개월(1개월은 유효 경계), 입력 오류 5종 전부 코드·QA 실측 양쪽으로 확인. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic 1차 PASS(Medium 3건 자발적 개선 권고: 용어 통일, 세금 라벨 충돌, 모바일 표) → Optimizer 반영 → 재검증 PASS(신규 이슈 0건). 예금/적금 모드 전환, 단리/복리 설명, 우대금리·은행 실제 계산 차이 고지가 다층적으로 잘 배치됐다. 잔여 Low 3건(필드 순서 사이트 관행 불일치 등 사소한 사항)으로 −1. |
| 모바일/반응형 | 10 | **10** | QA가 CDP로 320/375/390/768/1440px 5개 뷰포트 실측, 회차별 표의 모바일 카드/데스크톱 표 이원화까지 포함해 오버플로 없음 확인. |
| 접근성 | 5 | **5** | 모드 토글 aria-pressed, 라디오 그룹, aria-invalid/aria-describedby 전부 실측 확인. |
| 성능/안정성 | 5 | **5** | Console Error 0건, `npx tsc --noEmit` 클린, 전체 스위트 95파일/1335테스트 통과(military-salary 회귀 없음). |
| 설명/계산 근거 | 5 | **5** | 세전 이자→소득세→지방소득세→세후 이자→세후 만기수령액까지 각 단계 실제 수식·숫자를 노출하고, 재무수학 공식과 실제 법령 조문(정책형 부분)을 명확히 구분해 표시. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`→이번에 `published`로 전환), 카테고리 말머리 링크(`/categories/finance`), FAQPage JSON-LD 매핑, `app/calculators/[slug]/page.tsx` 배선 완료. |
| 코드 품질/유지보수성 | 5 | **5** | military-salary와 적금 총이자 산식을 `src/lib/installment-savings.ts`로 공유 추출(동일 법적 정의를 공유하는 순수 계산 기준 적용), BigInt 기반 정확한 유리수 연산으로 부동소수점 위험을 구조적으로 제거, 각 함수의 역할(절사 vs 반올림)이 명확히 분리됨. |
| **총점** | 100 | **98** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 98 ✅ |
| 계산 정확성 33/35+ | 34 ✅ |
| Critical 0 / High 0 | Calculation Auditor 3차 재검증 PASS(0, 최종 상태 기준) · UX Critic PASS(Medium 3건 자발 개선) → Optimizer 반영 → 재검증 PASS(0) · QA PASS(0) ✅ |
| Golden Test 100% | 19개 예제 + 개선 라운드마다 추가된 회귀 방지 반례 전부 일치 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ |
| Mobile Critical 0 | ✅ (실제 Chrome/Edge 5개 breakpoint 실측) |

**판정: PASS — registry.ts `status`를 `published`로 전환한다.**
개선 Loop 횟수: 5/5 (1차: FORMULA.md "공식 재검토 요청" — 은행연합회 계산기 대조 결과 정책
유지로 확정, 2~4차: Calculation Auditor가 순차 발견한 부동소수점 버그 4건을 BigInt 정확 연산으로
전부 해소(재검증까지 PASS), 5차: UX/UI Critic의 Medium 3건(용어 통일·모바일 표) 처리 — 재검증
PASS). 이 계산기는 개선 Loop 한도(5회)를 전부 사용했지만 매 라운드가 실제로 새 결함을 찾아
해결하며 전진했고 마지막 라운드에서 완전한 PASS로 종결됐다 — 개선 Loop가 설계된 목적(무한 루프가
아니라 "결함을 찾을 때까지 검증하고 반드시 종결한다") 그대로 작동한 사례다. 향후 유사 계산기
(부동소수점 취약 산식이 있는 계산기)를 만들 때 Architect 단계에서부터 "지수 연산·대형 원금 조합"
유형의 정밀도 검증을 사전에 요구하는 체크리스트 반영을 권고한다(아래 "남은 후속 과제" 참고).

### 남은 후속 과제 (발행 비차단, 전부 Low 이하)
- 세전 이자 원 단위 절사(버림)와 이자소득세/지방소득세 반올림 방향(사사오입)의 완전한 1차
  법적/약관 근거(국세청 원천징수 실무 매뉴얼 등)는 확인하지 못했다 — 은행연합회 실제 계산기
  API 대조와 제3자 계산기(1pic.kr) 실사례로 강하게 뒷받침되나, 영향은 항상 9원 이하로 미미하다.
- 세금 반올림 2곳(`logic.ts`의 `incomeTax`/`localIncomeTax` 계산)은 여전히 순수 부동소수점이며
  "double 표현 방향이 항상 유리하다"는 구조적 안전성에 의존한다(2차 재검증이 9,078,356건으로
  실증). 이자소득세율 자체가 향후 개정되어 `rates-{year}.json`의 값이 바뀌는 경우, 이 구조적
  안전성 논증을 재확인할 것을 다음 정책 재검토 라운드에 명시적으로 인계한다.
- **향후 유사 계산기 설계 시 권고**: 이번 계산기가 4라운드에 걸쳐 부동소수점 버그를 순차
  발견한 경험을 살려, 지수 연산(복리)이나 대형 금액(수십억원 이상)을 다루는 계산기는 Architect
  단계에서부터 "정수/유리수 연산(BigInt) 우선 설계"를 기본값으로 검토하고, Calculation Auditor는
  전체 입력 도메인 브루트포스 검증을 1차 검증 항목에 포함시킬 것을 권고한다.
- military-salary의 `src/calculators/military-salary/logic.test.ts`에 이번에 발견된 실제 버그의
  회귀 테스트(`550,000/4.02%/3개월`→`11,055`)가 추가됐다 — `tasks/military-salary/EVALUATION.md`
  부록도 함께 확인할 것.
- 다음 재검토 트리거: `PROGRESS.md`에 기록(2027-01-01 이자소득세율 정기 점검, 재무수학 공식
  자체는 정책형 아님).
