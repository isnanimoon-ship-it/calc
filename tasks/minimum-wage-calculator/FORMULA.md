# FORMULA: 최저임금·시급↔월급 계산기

## 개정 이력

### v2 (2026-09-14) — Calculation Auditor "공식 재검토 요청" 반영 (이번 개정)
**바뀐 것 한 줄 요약**: 월 환산 시간을 **정수(209시간)로 반올림한 뒤 곱하던 정책(v1)을 폐기**하고,
**소수 둘째 자리(약 208.57시간)까지 유지하는 정밀값 정책(v2)**으로 교체했다. 이에 따라 A1~E1의
Golden Test 기댓값이 전부 바뀌었고(예: A1의 `convertedMonthlyPay`가 2,156,880원 → 2,152,442원),
Calculation Auditor가 발견한 반례(월급 2,154,000원 사례에서 v1은 "최저임금 미만", 정부의 실제
판정 도구는 "정상")를 새 정책이 정확히 해소함을 확인했다. 이 개정의 전체 근거·재계산 과정은 아래
"정밀도 / 반올림 정책" 절에 있다. **Builder/Architect에게**: `monthlyEquivalentHours`의 타입이
정수(integer)에서 소수 둘째 자리까지 갖는 `number`로 바뀐다 — `formatting.ts`의 "추가 반올림
없음" 가정, `types.ts`의 필드 타입, `logic.test.ts`의 19개 기댓값 전부(A1~E1) 재구현이 필요하다.
자세한 재계산값은 아래 "검증 예제" 절 참고.

이 개정은 다음 요청에 대응한다: `tasks/minimum-wage-calculator/EVALUATION.md` "## Calculation
Auditor" 절, 특히 "우선순위 항목 2 — 월 환산 시간 반올림 정책의 법적 강제성 부재 → 공식 재검토
요청 (High)"(2026-09-14 검증). 이견 조정 권한 근거: docs/EVALUATION.md "역할 간 이견 조정"("공식의
정확성 최종 권위는 Formula Analyst에게 있다").

**재조사 방법과 한계(정직하게 밝힘)**: Calculation Auditor는 Bash(`curl`)로 moel.go.kr의 실제
배포 JS를 직접 받아 `wageResultNew()` 함수 코드를 EVALUATION.md에 그대로 인용했다. 이 문서
작성자(Formula Analyst)는 **Bash/curl 도구에 대한 접근 권한이 없어** 같은 방식으로 직접
재확인하지 못했다. 대신 다음 두 가지로 신뢰도를 보강했다: (1) WebFetch로 `moel.go.kr/miniWageMain.do`
재요청을 시도했으나, WebFetch는 렌더링된 HTML을 마크다운으로 변환할 뿐 `<script>` 태그 내부의
실행 코드를 보존하지 않아 실패했다(이 한계 자체를 기록해 둔다). (2) Auditor가 EVALUATION.md에
남긴 반례 수치("주 40시간·월급 2,154,000원 → moel.go.kr 판정 도구 기준 `resultValue ≈
10,327.47원`")를 Auditor가 인용한 산식(`(weekTime+paidTime)×365/84`, `toFixed(2)`)만 보고
**독립적으로 재계산**했고, 정확히 10,327.47원과 일치함을 확인했다(아래 "검증 예제" 예제 B4).
이는 Auditor가 인용한 코드가 내부적으로 정합적이며 실제로 그 계산 결과를 만들어낸다는 간접
증거다. 또한 Auditor는 moel.go.kr의 레거시 함수 `wageResult()`(현재 어떤 버튼에도 연결되지
않은 구버전)도 `Math.round(yearWorkingHours*100)/100`로 **역시 정수가 아닌 2자리 반올림**만
한다고 교차 확인했다고 보고했다 — 신버전·구버전 모두 정수 반올림을 쓴 적이 없다는 것이 두 개의
독립된 코드 경로에서 일관되므로, 우연이 아니라 정부의 일관된 계산 관행이라고 판단한다.

### v1 (2026-09-14, 최초 작성, 이번 개정으로 대체됨)
최초 버전은 "월 환산 시간을 정수(209시간 등)로 반올림한 뒤 그 정수로 시급↔월급을 환산하고
최저임금 비교도 이 정수 기준으로 판정한다"는 정책을 채택했다. 근거는 법제처 생활법령정보
(easylaw.go.kr)의 계산 예시가 "약 209시간"으로 먼저 반올림한 뒤 곱하는 방식을 보여준다는
것이었다. 이 근거 자체는 틀리지 않았지만(그 예시는 실제로 그렇게 계산한다), Calculation
Auditor가 "그 예시는 정부의 실시간 판정 도구가 아니라 홍보용 요약 수치"임을 밝혀냈고, 정작
같은 정부가 운영하는 **실시간 최저임금 위반 판정 도구는 정수 반올림을 쓰지 않는다**는 반증을
제시했다. v1은 이번 개정으로 폐기한다(아래 절들이 v1 서술을 대체함).

---

## 목적
시급 **또는** 월급 중 하나만 입력하면(모드 토글로 방향 결정), 최저임금법 시행령 제5조가 정한 "최저임금 적용기준 시간 수" 산식을 이용해 다른 한쪽 금액을 환산해 보여주고, 환산된 시급·월급 양쪽 모두를 해당 연도 고시 최저임금(시간급)·월 환산 최저임금과 비교해 "이상/미만" 참고 판정을 제공한다. SPEC.md가 정한 대로 게이팅 없이 항상 계산하며, 최저임금법 위반 여부의 법적 판정 도구가 아니라 참고용 도구다.

## 이 문서의 조사 방법과 한계 — 먼저 밝혀둔다
- **1차 출처 접근 제약**: 법제처 국가법령정보센터(law.go.kr)의 최저임금법 시행령 조문 페이지는 이전 FORMULA.md들(annual-leave-allowance 등)과 동일하게 WebFetch 렌더링이 되지 않았고, CaseNote(casenote.kr)의 최저임금법 시행령 제5조 페이지는 404(미등록)였다. 대신 다음 세 가지로 조문 내용과 실제 적용 예시를 교차확인했다(확인일 2026-09-14, 모두 WebFetch로 직접 열람):
  1. **법제처 찾기쉬운 생활법령정보**(easylaw.go.kr, 법제처가 직접 운영하는 준1차 출처) — 최저임금법 시행령 제5조의 월급 환산 공식을 실제 숫자 예시("[(주당 소정근로시간 40시간 + 유급주휴 8시간) × 365 ÷ 7] ÷ 12월 = 약 209시간", "209시간 × 10,320원 = 2,156,880원")로 직접 제시.
  2. **고용노동부 보도자료**(moel.go.kr, news_seq=18144) — "시간급 10,320원", "월 환산액 2,156,880원(주 40시간, 월 209시간 기준)" 문구를 직접 확인.
  3. **최저임금위원회 결정 현황 페이지**(minimumwage.go.kr/minWage/policy/decisionMain.do) — "시간급 10,320원", "월급(209시간 기준, 고시기준) 2,156,880원"을 표로 직접 확인.
  - **[v2 업데이트, 2026-09-14]** 위 세 출처는 여전히 "시급 10,320원"이라는 **입력값(고시 시간급)**의 근거로는 유효하다. 다만 "약 209시간·2,156,880원"이라는 **계산 결과 수치**는 이 계산기가 실제로 채택하는 계산 방식(아래 "정밀도/반올림 정책 v2")과 다르다는 것이 이번 개정의 핵심이다 — 세 출처 모두 정부의 **홍보용 요약 예시**이지, 정부가 실시간으로 최저임금 위반 여부를 판정할 때 쓰는 도구의 소스코드가 아니다. 아래 "정밀도/반올림 정책" 절 참고.
  - 조문 원문은 최초 작성 시 요약·인용 범위에서만 확인했으나, **Calculation Auditor가 이후 law.go.kr Open API(`DRF/lawService.do?OC=test`, `MST=206564`)로 시행령 제5조 전문을 직접 확보**해 이 문서의 인용과 자구 하나까지 정확히 일치함을 확인했다(2026-09-14, EVALUATION.md "우선순위 항목 1"). 이 문서는 그 결과를 반영해 아래 "기준/출처"의 조문 제목을 정정했다 — 더 이상 "확인 필요"가 아니다.
- **역사적 맥락(174시간 vs 209시간 논쟁) 확인**: 2019년 시행령 개정 전에는 "월 환산 시간에 주휴시간을 포함해야 하는가"를 두고 대법원 판례(174시간, 소정근로시간만)와 고용노동부 행정해석(209시간, 주휴시간 포함) 입장이 갈렸으나, **2019.1.1. 시행 개정 시행령이 고용노동부 입장(주휴시간 포함)을 명문화**해 논쟁이 종결됐다(junggi.co.kr 기사, WebFetch로 직접 확인, 확인일 2026-09-14). 즉 현행법상 "월 환산 시간에 주휴시간을 포함한다"는 것은 관행이 아니라 **2019년 이후 시행령 문언 자체**다. (이 근거는 v1·v2 공통이다 — 바뀐 것은 "주휴시간을 포함하느냐"가 아니라 "포함해 나온 시간을 정수로 반올림하느냐"이다.)
- **일반화 근거**: 209시간은 "주 40시간" 표준 사례에 대한 결과값일 뿐, 시행령 제5조 제3호 산식 자체는 사용자의 실제 소정근로시간에 따라 일반화된다("주 30시간 근무라면 분모가 209시간이 아니라 그에 맞게 줄어든다" — domolaw.co.kr 법률가이드, WebFetch로 직접 확인, 확인일 2026-09-14). **[v2 강화]** Calculation Auditor가 확보한 moel.go.kr `wageResultNew()` 실제 코드(`workingHour = (weekTime + paidTime) * 365/84`)도 `weekTime`(1주 소정근로시간)을 40시간으로 하드코딩하지 않은 **완전히 일반화된 공식**이다 — 정부의 실시간 도구 자체가 임의의 주 근무시간에 동일한 공식·동일한 반올림 정책(정수화 없음)을 적용한다는 것을 코드로 확인한 것이므로, "비표준 근무시간에도 이 일반화가 유효한가"라는 v1의 미해결 의문(아래 "확인 필요" 5번 참고)이 이번에 훨씬 강하게 뒷받침된다.
- **weekly-holiday-allowance FORMULA.md 재사용**: "주 근무시간 → 주휴시간" 산식(`weeklyHolidayHours = min(weeklyHours/40*8, 8)`)은 `tasks/weekly-holiday-allowance/FORMULA.md`가 근로기준법 제55조제1항·시행령 제30조제1항·시행령 별표2·대법원 2025.8.14. 선고 2022다291153 판결로 이미 확정한 산식을 그대로 재사용한다(새로 조사하지 않음). "월 환산 계수"(365/84 ≈ 4.345238)도 `rates-2026.json`의 `laborStandards.monthlyWeekFactor`를 그대로 재사용한다.

---

## 입력값
| 변수명 | 설명 | 단위 | 허용 범위 |
|---|---|---|---|
| `mode` | 계산 방향. `"HOURLY"`(시급 입력 → 월급 환산) 또는 `"MONTHLY"`(월급 입력 → 시급 환산) | enum | 필수 |
| `hourlyWage` (시급) | `mode="HOURLY"`일 때만 입력받는 세전 시간당 임금 | 원 | `mode="HOURLY"`일 때 필수. `> 0`. 소수점 입력 허용 여부는 Architect 결정(공식은 실수도 처리 가능 — 아래 "정밀도/반올림 정책" 예제 E1 참고). 비현실적 상한(예: 1,000,000원/시간)은 계산 로직과 무관한 입력 검증으로 Architect/Builder가 별도 설정 |
| `monthlyWage` (월급) | `mode="MONTHLY"`일 때만 입력받는 세전 월 급여 총액(SPEC "산입범위 단순화"에 따라 항목 구분 없이 총액) | 원 | `mode="MONTHLY"`일 때 필수. `> 0`. 비현실적 상한(예: 10억 원)은 Architect/Builder 재량 |
| `weeklyHours` (주 근무시간) | 1주 소정근로시간(휴게시간 제외). 월 환산 시간 계산에 쓰인다 | 시간 | 선택, 기본값 40(법정 기준근로시간). `> 0`, `<= 168`(weekly-holiday-allowance와 동일한 판단 기준 재사용) |

- 입력은 사실상 `mode` + 금액 1개 + `weeklyHours`(기본값 있음) = 필수 입력 1개다(SPEC Must Have).
- 이 계산기는 최저임금 산입범위(상여금·복리후생비 항목 구분), 수습 감액, 15시간·개근 등 지급요건을 입력받지 않는다 — 아래 "공식의 전제조건"·"예외" 참고.

---

## 출력값
| 변수명 | 설명 | 단위 |
|---|---|---|
| `weeklyHolidayHours` (1주 주휴시간) | `min(weeklyHours / 40 × 8, 8)` — weekly-holiday-allowance FORMULA.md 재사용 | 시간 |
| `weeklyPaidHours` (1주 최저임금 적용기준 시간 수) | `weeklyHours + weeklyHolidayHours` — 최저임금법 시행령 제5조제2호 | 시간 |
| `monthlyEquivalentHoursExact` (월 환산 시간, 완전 정밀값) | `weeklyPaidHours × 365 / 7 / 12` (= `weeklyPaidHours × 365/84`) — 시행령 제5조제3호. **내부 전용 중간값**, 어떤 출력 객체·화면에도 그대로 노출되지 않는다(raw/display 분리, Calculation Auditor가 v1에서 이미 코드로 확인한 원칙을 v2도 그대로 유지) | 시간 |
| `monthlyEquivalentHours` (월 환산 시간, 계산·표시 공용값) | **[v2 변경]** `round2(monthlyEquivalentHoursExact)` — **소수 둘째 자리까지 반올림**(더 이상 정수로 반올림하지 않는다). `weeklyHours=40`이면 `208.57`(과거 v1의 `209`가 아니다). 이 값 **하나**가 화면 표시와 아래 모든 계산식(환산·최저임금 비교) 양쪽에 동일하게 쓰인다 — 표시용과 계산용을 분리하지 않는다(그 이유는 아래 "정밀도/반올림 정책" 참고) | 시간(소수 둘째 자리) |
| `convertedMonthlyPay` (환산 월급, `mode="HOURLY"`일 때) | `round(hourlyWage × monthlyEquivalentHours)` — **핵심 결과(환산값)**, 원 단위로 사사오입 | 원 |
| `convertedHourlyWage` (환산 시급, `mode="MONTHLY"`일 때) | `round(monthlyWage / monthlyEquivalentHours)` — **핵심 결과(환산값)**, 원 단위로 사사오입 | 원 |
| `displayHourlyWage` | `mode="HOURLY"`면 입력값 `hourlyWage` 그대로, `mode="MONTHLY"`면 `convertedHourlyWage` | 원 |
| `displayMonthlyPay` | `mode="MONTHLY"`면 입력값 `monthlyWage` 그대로, `mode="HOURLY"`면 `convertedMonthlyPay` | 원 |
| `minWageHourly` (해당 연도 최저임금 시급) | `rates-{year}.json`의 `minimumWage.hourly.value` | 원 |
| `minWageMonthlyEquivalent` (해당 연도 월 환산 최저임금, 사용자의 `weeklyHours` 기준) | **[v2 변경]** `round(minWageHourly × monthlyEquivalentHours)` — `monthlyEquivalentHours`가 이제 소수를 가지므로 **곱셈 후 원 단위 반올림이 반드시 필요하다**(v1은 정수×정수라 "반올림 불필요"였으나 v2는 아니다). `weeklyHours=40`(기본값)이면 `10,320 × 208.57 = 2,152,442.4` → `2,152,442원`(과거 v1의 `2,156,880원`이 아니다 — 아래 "정밀도/반올림 정책" 참고) | 원 |
| `hourlyMeetsMinimumWage` | `displayHourlyWage >= minWageHourly` | boolean |
| `monthlyMeetsMinimumWage` | `displayMonthlyPay >= minWageMonthlyEquivalent` | boolean |

`hourlyMeetsMinimumWage`·`monthlyMeetsMinimumWage`는 게이팅이 아니다(SPEC Must Have) — `false`여도 모든 값을 그대로 계산·표시하고, 결과 화면에서 눈에 띄는 경고/미충족 카드로만 안내한다.

---

## 공식

### 1. 주휴시간 포함 여부와 산식 — weekly-holiday-allowance 재사용
```
weeklyHolidayHours = min( weeklyHours / 40 * 8 , 8 )     (시간, 반올림 없음)
```
- 근거: 근로기준법 제55조제1항·시행령 제30조제1항·시행령 별표2 제4호, 대법원 2025.8.14. 선고 2022다291153 판결 — `tasks/weekly-holiday-allowance/FORMULA.md` "공식 > 1주 주휴시간을 왜 weeklyHours÷40×8(상한 8시간)로 산정하는가" 절을 그대로 재사용한다(재조사하지 않음). 40시간 상한의 근거(제2조제1항제8호·제50조)도 동일하게 재사용. **이 절은 v1·v2 공통, 변경 없음.**

### 2. 월 환산 시간(최저임금법 시행령 제5조) — 이 계산기의 핵심 조사 대상
```
weeklyPaidHours            = weeklyHours + weeklyHolidayHours
                              (= "1주의 최저임금 적용기준 시간 수", 시행령 제5조제2호)

monthlyEquivalentHoursExact = weeklyPaidHours * 365 / 7 / 12
                              (= weeklyPaidHours * 365/84 ≈ weeklyPaidHours * 4.345238,
                                 = "1개월의 최저임금 적용기준 시간 수", 시행령 제5조제3호)

monthlyEquivalentHours      = round2( monthlyEquivalentHoursExact )   [v2 변경]
                              (소수 둘째 자리까지 반올림, 사사오입 — 더 이상 정수로 만들지 않는다)
```
- **주휴시간 포함이 관행이 아니라 현행 법령 문언이라는 근거**: 최저임금법 시행령 제5조제2호는 "1주의 최저임금 적용기준 시간 수"를 "1주 동안의 소정근로시간 수와 「근로기준법」 제55조제1항에 따라 유급으로 처리되는 시간 수를 합산한 시간 수"로 정의한다. 즉 **주휴시간(제55조제1항)을 합산하도록 시행령이 명시**한다 — 이 계산기가 임의로 채택한 관행이 아니다. Calculation Auditor가 law.go.kr Open API로 확보한 시행령 제5조 전문(원문 그대로)이 이 서술과 자구까지 정확히 일치함을 확인했다(2026-09-14).
- **주 40시간이 아닌 경우로 일반화 가능한 근거**: 시행령 제5조제2호·제3호는 "40시간"을 특정하지 않고 "1주 동안의 소정근로시간 수"라는 사용자별 실제값을 변수로 삼는다. 209시간은 "주 40시간 소정근로 + 8시간 주휴"라는 **표준(전형적) 사례**에 대한 산출 결과일 뿐이며, 산식 자체는 임의의 `weeklyHours`에 대해 그대로 적용된다. **[v2 추가 근거]** moel.go.kr 실시간 판정 도구의 실제 코드(`(weekTime+paidTime)*365/84`)도 40시간을 하드코딩하지 않은 일반식이라는 것을 Calculation Auditor가 코드로 확인했다 — 이는 "정부가 비표준 근무시간에도 이 산식과 반올림 정책을 그대로 쓰는가"라는 질문에 대한 가장 강력한 증거다(홍보용 예시가 아니라 실제 동작하는 코드이기 때문).
- **`monthlyWeekFactor`의 의미 재확인**: `rates-2026.json`의 `laborStandards.monthlyWeekFactor.value = {daysPerYear:365, monthsPerYear:12, daysPerWeek:7}`는 정확히 이 시행령 제5조제3호의 "1년 동안의 평균의 주의 수를 곱한 시간을 12로 나눈 시간 수" 계수(`365/7/12 = 365/84`)를 데이터로 표현한 것이다. **[v2]** 이 계수 자체는 v1과 동일하다 — 바뀐 것은 그 결과를 "정수로 반올림하는가, 소수 둘째 자리로 반올림하는가"뿐이다.
- **[v2 신규] 시행령 제5조의2(월 환산액의 산정)**: Calculation Auditor가 law.go.kr에서 신규로 확인한 조문. "법 제6조제4항제2호 및 같은 항 제3호나목에 따른 월 환산액은 해당 연도 시간급 최저임금액에 제5조제1항제3호에 따른 1개월의 최저임금 적용기준 시간 수를 곱하여 산정한다"(2018.12.31 신설). 이는 (산입범위 판정 맥락이지만) "월 환산액 = 시간급 × 1개월의 최저임금 적용기준 시간 수"라는 산식을 명문화하며, `minWageMonthlyEquivalent = minWageHourly × monthlyEquivalentHours` 구조 자체가 법령과 부합함을 뒷받침한다. **중요**: 이 조문도 반올림 방법을 별도로 규정하지 않는다.

### 3. 시급 ↔ 월급 환산
```
[mode = HOURLY]
  convertedMonthlyPay = round( hourlyWage * monthlyEquivalentHours )

[mode = MONTHLY]
  convertedHourlyWage = round( monthlyWage / monthlyEquivalentHours )
```
- **각 방향은 항상 원본 입력값에서 직접 1회만 계산한다.** 즉 `mode=HOURLY`에서 나온 `convertedMonthlyPay`를 다시 `mode=MONTHLY`의 계산식에 자동으로 재입력해 시급을 재산출하지 않는다(체이닝 금지). 이 원칙은 v1·v2 공통이며 변경 없음 — 아래 "정밀도/반올림 정책 > 왕복 계산(교차검증)의 정확성" 참고.
- **[v2]** `monthlyEquivalentHours`가 이제 소수를 가지므로 `hourlyWage * monthlyEquivalentHours`, `monthlyWage / monthlyEquivalentHours` 모두 대부분의 입력에서 소수 결과가 나온다 — 최종 `round()`(원 단위 사사오입) 한 번만 적용하고, 그 전에 추가로 반올림하지 않는다(중간 반올림 금지 원칙을 오히려 v1보다 더 충실히 지킨다).

### 4. 최저임금 비교
```
minWageHourly           = rates-{year}.json  minimumWage.hourly.value
minWageMonthlyEquivalent = round( minWageHourly * monthlyEquivalentHours )   [v2: 반올림 필요]

hourlyMeetsMinimumWage  = displayHourlyWage  >= minWageHourly
monthlyMeetsMinimumWage = displayMonthlyPay  >= minWageMonthlyEquivalent
```
- **[v2]** `weeklyHours = 40`(기본값)일 때 `minWageMonthlyEquivalent = round(10,320 × 208.57) = round(2,152,442.4) = 2,152,442원`이다. 이는 대중에게 널리 알려진 "2,156,880원"과 **4,438원 차이**가 나지만, 이 차이는 계산 오류가 아니라 **의도적으로 채택한 정밀도 정책의 결과**이며, 고용노동부가 실제로 운영하는 최저임금 판정 도구(moel.go.kr)의 계산 결과와 훨씬 가깝다(아래 "정밀도/반올림 정책" 참고). `weeklyHours`가 다르면 이 값도 비례해 달라진다.

### 5. 월 환산 최저임금이 "별도 고시값"인지 "계산 산출값"인지 — SPEC 핵심 질문에 대한 결론
**계산 산출값이다. 시간급과 별도로 독립 promulgate(고시)되는 법정 최저임금은 없다.** (v1·v2 공통, 변경 없음)
- 최저임금법 제5조제1항은 "최저임금액은 시간·일·주 또는 월을 단위로 하여 정하되, 일·주·월을 단위로 하는 경우에는 시간급으로도 표시하여야 한다"고 정한다 — 즉 법은 시간급 표시를 **의무**로 규정할 뿐, 월 단위 표시를 요구하지 않는다.
- 실제로 최저임금위원회의 매년 심의·의결 결과는 **시간급 하나만 심의·의결**되어 왔고, "월 환산액 2,156,880원(월 209시간 기준)"은 그 시간급에 "주 40시간 표준 근로자" 가정과 **정수 반올림**을 적용해 보도자료·홈페이지에 "함께 표시"하는 참고값이다. **[v2]** 이 계산기는 같은 시간급에 **정수 반올림 대신 소수 둘째 자리 정밀값**을 적용하므로, 결과 화면의 "올해 최저임금 월 환산액"이 그 홍보용 참고값과 정확히 일치하지 않는다 — 이는 이 계산기가 "별도 고시값을 잘못 인용해서"가 아니라 "계산 산출값을 정부의 실제 판정 로직과 더 가깝게 재현하기로 선택해서" 생기는 차이임을 결과 화면·FAQ에서 분명히 안내해야 한다(아래 FAQ 참고).
- 따라서 이 계산기는 `minWageMonthlyEquivalent`를 **매번 `minWageHourly × monthlyEquivalentHours`로 직접 계산**하며, `rates-2026.json`에 이를 독립적인 법정값처럼 저장하지 않는다.

---

## 계산 순서
1. **입력 검증** — `mode`가 `HOURLY`/`MONTHLY` 중 하나인지, 해당 모드의 금액이 `> 0`인지, `weeklyHours`가 `0 < weeklyHours <= 168`인지 확인. 하나라도 위반하면 계산하지 않고 오류 안내(아래 "예외").
2. **주휴시간 산정** — `weeklyHolidayHours = min(weeklyHours / 40 * 8, 8)`. 반올림하지 않는다.
3. **1주 최저임금 적용기준 시간 수** — `weeklyPaidHours = weeklyHours + weeklyHolidayHours`.
4. **월 환산 시간(완전 정밀값) 산정** — `monthlyEquivalentHoursExact = weeklyPaidHours * 365 / 7 / 12`. 나눗셈은 곱셈 이후 한 번에 계산(중간 반올림 금지). 이 값은 내부 전용이며 어디에도 그대로 노출하지 않는다.
5. **[v2 변경] 월 환산 시간(계산·표시 공용값) 반올림** — `monthlyEquivalentHours = round2(monthlyEquivalentHoursExact)`(사사오입, **소수 둘째 자리**). `weeklyHours = 40`이면 `208.57`(더 이상 `209`가 아니다). 이 값을 다음 단계부터 화면 표시와 계산 양쪽에 동일하게 쓴다.
6. **환산값 산출** — `mode`에 따라 `convertedMonthlyPay = round(hourlyWage * monthlyEquivalentHours)` 또는 `convertedHourlyWage = round(monthlyWage / monthlyEquivalentHours)` 중 해당하는 하나만 계산.
7. **최저임금 조회** — 기준 연도의 `rates-{year}.json`에서 `minWageHourly` 조회, `minWageMonthlyEquivalent = round(minWageHourly * monthlyEquivalentHours)` 계산([v2] 반올림 단계가 새로 필요하다).
8. **비교 판정** — `hourlyMeetsMinimumWage`, `monthlyMeetsMinimumWage` 각각 산정. 게이팅하지 않는다.
9. **결과 화면 breakdown 구성** — 입력값 → (2)~(5) 월 환산 시간 산출 과정 → (6) 환산식 → (7)(8) 비교식 순서로 "라벨 = 값" 형태 노출(SPEC Must Have). **[v2]** breakdown에 노출하는 "월 환산 시간" 라벨의 값(예: `208.57시간`)이 바로 다음 줄의 곱셈·나눗셈에 실제로 쓰인 값과 **정확히 같아야 한다** — v1처럼 "라벨은 약 209시간, 실제 곱셈은 다른 값"처럼 표시와 계산이 어긋나면 사용자가 손으로 검산할 때 맞지 않는다(이 계산기가 반드시 지켜야 할 투명성 제약, 아래 "정밀도/반올림 정책 > 왜 표시값과 계산값을 분리하지 않는가" 참고).

---

## 단위
- **금액**: 입력·출력 모두 "원". 내부 계산도 원 단위 실수. "전"(1/100원) 정밀도가 요구되는 지점 없음(weekly-holiday-allowance·annual-leave-allowance와 동일한 판단).
- **시간**: `weeklyHours`, `weeklyHolidayHours`, `weeklyPaidHours`, `monthlyEquivalentHoursExact`는 소수 허용(반올림 없음). **[v2]** `monthlyEquivalentHours`(계산·표시 공용값)는 **소수 둘째 자리**로 반올림한다 — v1(정수)과 달리 더 이상 정수가 아니다.
- **월 환산 계수**: `365/7/12 = 365/84 ≈ 4.345238`(무차원). `rates-2026.json`의 `laborStandards.monthlyWeekFactor` 재사용. v1·v2 공통, 변경 없음.

---

## 정밀도 / 반올림 정책 [v2 — 전면 재작성]

### 검토한 선택지와 최종 결정
Calculation Auditor가 제시한 반증(주 40시간·월급 2,154,000원 사례에서 v1 정책은 "최저임금
미만", moel.go.kr의 실시간 판정 도구는 "정상"으로 서로 반대 판정을 내림)을 근거로, 아래 세
선택지를 검토했다.

- **옵션 A(요청서 원안)**: 표시는 "약 209시간", 비교 판정에만 정밀값을 쓴다. → **기각**. 이렇게
  하면 "환산값(사용자가 보는 월급)"은 209 기준으로 계산하면서 "최저임금 임계값(비교 대상)"은
  208.57 기준으로 계산하게 되어, **같은 근무조건(주 40시간)에 서로 다른 두 개의 "월 환산
  시간"을 동시에 쓰는 내부 모순**이 생긴다. 예를 들어 시급 모드에서 `convertedMonthlyPay =
  hourlyWage × 209`인데 `minWageMonthlyEquivalent = minWageHourly × 208.57`이라면, 사용자의
  월급과 비교 대상 임계값이 애초에 "같은 자로 잰 것"이 아니게 된다. 또한 계산 근거(breakdown)에
  "월 환산 시간 = 약 209시간"이라고 표시해 놓고 실제 곱셈에는 208.57을 쓰면, 사용자가 표시된
  숫자로 손수 검산했을 때 결과가 맞지 않는다(위 "계산 순서" 9번의 투명성 제약 위반).
- **옵션 C(현행 유지 + 고지 문구만 추가)**: 정수 반올림을 유지하되 "moel.go.kr과 다르다"고
  고지만 한다. → **기각**. 이 계산기의 핵심 목적(SPEC "목적": "최저임금 이상인지를... 스스로
  확인할 수 있게 한다")이 바로 그 판정이다. 판정 자체가 정부의 실제 판정 도구와 다르게 나올 수
  있다는 것을 알면서도 그대로 둔다면, 고지 문구는 "이 계산기의 핵심 기능이 부정확할 수 있다"는
  자백일 뿐 문제를 고치는 것이 아니다. docs/CALCULATOR_RULES.md "정확성 원칙"("확실하지 않은
  수치는 추정하지 않는다")과 "Golden Test"("공식 계산기 예시값과 대조") 규칙의 취지에도
  맞지 않는다 — 이미 더 정확한 기준(moel.go.kr의 실제 판정 로직)을 알고 있는데 채택하지 않을
  이유가 없다.
- **옵션 B(채택, 세부 방식은 아래에서 구체화)**: 환산과 비교 판정 모두 정밀값을 쓴다.

### 채택한 정책: 옵션 B — 단, "정밀값"의 정밀도를 moel.go.kr과 동일하게 "소수 둘째 자리"로 고정한다
docs/CALCULATOR_RULES.md의 일반 원칙("중간 계산은 반올림하지 않고 최종 표시 단계에서만
반올림")으로 회귀하되, "최종 표시 단계"가 정확히 어디인지를 명확히 정한다.

1. **왜 완전한 무한 정밀값(반올림 전혀 없음)이 아니라 "소수 둘째 자리"인가**: 화면에 노출하는
   "월 환산 시간" 값과 실제 곱셈·나눗셈에 쓰는 값이 **반드시 같아야** 사용자가 breakdown을 보고
   손으로 검산할 수 있다(위 "계산 순서" 9번). `365/84 = 4.345238095238...`처럼 순환하는 무한
   소수를 그대로 노출하면 표시가 지저분해지고, 결국 화면에는 어떤 식으로든 잘라낸 값을
   보여줘야 하므로 "표시용 절사"가 필요해진다 — 그렇다면 그 절사 자릿수를 **정부의 실시간 판정
   도구가 실제로 쓰는 자릿수(소수 둘째 자리, `toFixed(2)`)와 똑같이 맞추는 것**이 임의로 다른
   자릿수(예: 셋째 자리, 넷째 자리)를 고르는 것보다 근거가 분명하다. 이렇게 하면 "화면에 보이는
   숫자 = 실제 계산에 쓰인 숫자 = 정부 판정 도구가 쓰는 숫자"가 셋 다 일치한다.
2. **핵심 목적과의 정합성(Calculation Auditor 반증의 직접 해소)**: 위 3번 "왕복 계산" 절과
   "검증 예제" B4에서 재계산으로 확인했듯, 소수 둘째 자리 정책은 Auditor가 제시한 반례(월급
   2,154,000원)에서 moel.go.kr과 **동일한 판정("정상")**을 낸다. 이는 우연이 아니라, 두
   계산이 같은 산식(`(weekTime+paidTime)×365/84`)과 같은 정밀도(2자리)를 쓰기 때문이다.
3. **왕복 계산(교차검증)이 오히려 더 견고해진다**: `monthlyEquivalentHours`가 정수든 소수
   둘째 자리든, 정수 `hourlyWage`를 곱한 뒤 다시 나누는 왕복 계산은 항상 원래 값을 정확히
   복원한다 — 곱셈 단계에서 생기는 반올림 오차는 최대 0.5원이고, 이를 다시 `monthlyEquivalentHours`
   (최소 약 5.21, 통상 208.57 이상)로 나누면 오차가 0.5/5.21 ≈ 0.096 미만으로 줄어들어 다음
   반올림에서 항상 원래 정수로 복원된다(수학적으로 `monthlyEquivalentHours > 1`인 한 항상
   성립 — 이 계산기의 유효 범위(`weeklyHours` 1~168시간)에서 `monthlyEquivalentHours`의
   최솟값은 약 5.21이므로 항상 성립한다). 즉 **v1이 "정수라서 왕복이 정확하다"고 주장했던
   근거는 v2에서도 그대로 유지된다** — 정수라는 성질이 왕복 정확성의 필요조건이 아니었다.
4. **법령이 반올림 방식을 강제하지 않는다(v1·v2 공통으로 유지되는 사실)**: 시행령 제5조 원문
   전체(Calculation Auditor가 law.go.kr Open API로 확보)를 검색한 결과 "반올림"·"사사오입"·
   "올림"·"버림"·"절사"라는 단어가 단 한 번도 등장하지 않는다. 법령이 강제하지 않으므로,
   "정부의 실제 판정 도구가 실제로 어떻게 계산하는가"가 가장 설득력 있는 정책 근거가 된다 —
   그리고 그 도구는 정수 반올림을 쓰지 않는다.

### 왜 표시값과 계산값을 분리하지 않는가 (v1과의 근본적 차이)
v1은 "화면에는 익숙한 209시간을 보여주되 실제로는 그 값으로 계산한다"는 방식이었다(표시=계산,
다만 그 공통값이 정수였다). 이번 반례 검토 과정에서 나온 "옵션 A"는 "화면에는 209, 계산 중
비교 판정에는 208.57"처럼 표시와 계산을 **서로 다른 근거로 분리**하자는 것이었는데, 위에서
설명했듯 이는 내부 모순과 투명성 문제를 만든다. v2는 v1의 "표시=계산" 원칙은 유지하면서, 그
공통값 자체의 반올림 자릿수만 바꾼 것이다 — **"209"라는 상징적 숫자를 화면의 주 계산값으로도,
비교 임계값으로도 쓰지 않는다.** 다만 사용자 친숙도를 위해 "약 209시간으로도 잘 알려져 있다"는
**보충 설명 문구**는 결과 화면·FAQ에 남긴다(계산에는 관여하지 않는 순수 안내 텍스트로,
`minimumWage.monthlyReference` 참고용 데이터로만 존재 — 아래 "정책 데이터 요구사항" 참고).

### 왕복 계산(교차검증)의 정확성 — SPEC "완료 기준" 대응 (v2 갱신)
- **원칙**: 환산은 항상 사용자가 입력한 원본 값에서 직접 1회만 계산한다. 환산된 값(예: 월급
  모드의 `convertedHourlyWage`)을 다시 반대 방향 계산식에 자동으로 재입력해 원래 값을
  복원하려는 로직을 만들지 않는다. (v1·v2 공통, 변경 없음)
- **정수 `hourlyWage` → 월급 → 시급 방향은 항상 정확히 일치한다(v2에서도 유지)**: 위 "채택한
  정책" 3번에서 증명했듯, `monthlyEquivalentHours`가 소수라도 이 방향의 왕복은 항상 정확하다.
  검증 예제 A1↔B1이 이 관계를 이룬다(단, 그 절대값은 v1의 2,156,880원에서 v2의 2,152,442원으로
  바뀌었다 — 아래 "검증 예제" 참고).
- **임의 값(월급 → 시급 → 월급)에서는 여전히 불일치할 수 있다**: `monthlyWage`가
  `monthlyEquivalentHours`로 나누어떨어지지 않으면(대부분의 실제 월급이 이에 해당),
  `convertedHourlyWage = round(monthlyWage / monthlyEquivalentHours)`이고, 이 시급을 다시
  `× monthlyEquivalentHours`로 월급 환산하면 반올림 손실 때문에 원래 `monthlyWage`와 몇 원
  차이가 날 수 있다(검증 예제 B2 참고, v2에서는 이 차이가 v1보다 약간 커진다 — 80원 vs v1의
  58원, `monthlyEquivalentHours`가 더 이상 "딱 떨어지는" 정수가 아니기 때문). 이 계산기는 이
  값을 다시 체이닝하지 않으므로 사용자에게 이 불일치가 노출되지 않는다.

### 최종 표시 반올림
- `convertedMonthlyPay`, `convertedHourlyWage`, `minWageMonthlyEquivalent` 모두 원 단위로
  사사오입(round half up) 1회 적용. **[v2]** `minWageMonthlyEquivalent`도 이제 이 반올림이
  실제로 필요하다(v1은 정수×정수라 반올림이 무연산이었다).
- `weeklyHolidayHours`, `weeklyPaidHours`, `monthlyEquivalentHoursExact`는 화면에 그대로
  노출하지 않거나 소수로 노출(반올림 없음). `monthlyEquivalentHours`(계산·표시 공용값)만
  **소수 둘째 자리**로 노출한다(v1: 정수).

### [신규] Calculation Auditor 항목 6(이중 배지 불일치)이 이번 정책 변경으로 해소되는가 — 아니다, 거의 그대로 남는다
Calculation Auditor는 항목 6(MONTHLY 모드에서 `hourlyMeetsMinimumWage`/
`monthlyMeetsMinimumWage`가 갈리는 반례, 폭 104개 정수 월급 값)의 재검토를 요청하며 "정밀값
정책으로 바뀌면 이 폭이 크게 줄어든다(반올림 단위가 1원 수준이 되어 폭이 사실상 0.5원으로
축소)"고 추측했다. **이 문서 작성자가 직접 재유도한 결과, 이 추측은 틀렸다** — 폭은 거의
줄어들지 않는다. 근거를 남긴다.

`M = monthlyEquivalentHours`라 하면, "hourlyMeets=true인데 monthlyMeets=false"인 구간은
정확히 `monthlyWage ∈ [M×(minWageHourly−0.5), M×minWageHourly)` 부근이며, 그 폭은 **`M`이
정수든 소수든 관계없이 항상 `0.5×M`에 수렴한다**(아래 유도 참고). `M`이 v1의 209에서 v2의
208.57로 바뀌어도 `0.5×M`은 104.5 → 104.285로 **1도 안 되게** 줄어든다. 실제로 정수
`monthlyWage`를 대입해 양쪽을 직접 계산해 보면:
- v1(M=209): 반례 구간 `monthlyWage ∈ [2,156,776, 2,156,879]`, 정수 값 **104개**
  (Calculation Auditor가 EVALUATION.md에 남긴 수치와 정확히 일치).
- v2(M=208.57): 반례 구간 `monthlyWage ∈ [2,152,339, 2,152,441]`, 정수 값 **103개**
  (이 문서에서 직접 재계산).

**즉 반례 구간의 폭은 104개 → 103개로, 사실상 변화가 없다.** 이유: 이 이중 배지 불일치는
"월 환산 시간을 정수로 반올림했기 때문"이 아니라, "월급을 시급으로 환산할 때 원 단위로
반올림한다"는 화폐 반올림 자체에서 나오는 구조적 현상이기 때문이다(`M`의 크기가 클수록
`0.5×M`도 커지므로, `M`을 아무리 정밀하게 만들어도 `M` 자체의 크기(약 208~209)가 그대로면
반례 구간의 절대 폭도 그대로 남는다). **결론**: Calculation Auditor 항목 6은 이번 v2 개정으로
**해소되지 않는다** — 여전히 Medium 등급의 별도 UX/Architect 이슈로 남으며, HOURLY 모드는
(수학적으로, `monthlyEquivalentHours`가 어떤 양수 값이든) 항상 두 배지가 일치하고 MONTHLY
모드에서만 발생한다는 사실도 v1과 동일하게 유지된다. 이 구조적 문제를 근본적으로 줄이려면
`monthlyEquivalentHours`의 반올림 정밀도를 바꾸는 것이 아니라, 배지 판정 로직 자체(예:
`hourlyMeetsMinimumWage`와 `monthlyMeetsMinimumWage` 중 하나만 화면에 노출하거나, 두 값이
다를 때 별도 안내를 추가하는 등)를 UX/Architect가 재설계해야 한다 — 이는 FORMULA.md의 권한
범위를 벗어난다.

**유도(참고)**: `convertedHourlyWage = round(monthlyWage / M)`. 이 값이 `minWageHourly`
이상이 되려면 `monthlyWage / M >= minWageHourly - 0.5`, 즉 `monthlyWage >=
M×(minWageHourly-0.5)`. 한편 `monthlyMeetsMinimumWage`는 `monthlyWage >=
round(minWageHourly×M) ≈ M×minWageHourly`를 요구한다. 두 경계의 차이는
`M×minWageHourly - M×(minWageHourly-0.5) = 0.5M`이며, 이는 `M`이 정수인지 소수인지와
무관하게 항상 성립하는 대수적 관계다.

---

## 공식의 전제조건 / 이 계산기가 다루지 않는 것
- **통상근로자 주 40시간·주 5일 가정**: `weeklyHolidayHours` 산식의 전제조건은 weekly-holiday-allowance FORMULA.md와 동일하다(재사용) — 통상근로자가 주 40시간·주 5일 근무한다는 가정 하의 비례식이다.
- **15시간 미만 초단시간근로자에도 동일한 비례식을 적용한다(게이팅 없음)**: 근로기준법 제18조제3항에 따라 4주 평균 1주 소정근로시간이 15시간 미만이면 제55조(주휴)가 적용되지 않아 실제로는 주휴수당·주휴시간이 발생하지 않을 수 있다. 이 계산기는 SPEC.md가 "지급요건 판정은 범위 밖"이라고 명시했으므로 `weeklyHours`가 15 미만이어도 동일한 `min(weeklyHours/40*8, 8)` 비례식을 그대로 적용해 `monthlyEquivalentHours`를 계산한다 — weekly-holiday-allowance의 "게이팅하지 않고 항상 계산" 설계를 그대로 따른 것이다. **다만 이로 인해 15시간 미만 근로자의 `minWageMonthlyEquivalent`·`convertedMonthlyPay`가 실제 법적 기준보다 다소 높게 계산될 수 있다**(주휴시간이 실제로는 0이어야 하는데 비례값을 반영하므로). SPEC 범위상 이 계산기는 이를 별도로 경고하지 않지만, Product Owner/Builder가 필요시 결과 화면에 짧은 안내를 추가하는 것을 권장한다(신규 출력 필드를 강제하지는 않음).
- **최저임금 산입범위 세부 판정 안 함**: 입력한 총액을 그대로 비교한다(SPEC Must Have "산입범위 — v1은 단순화한다"). 최저임금법 제6조제4항의 정기상여금·복리후생비 산입 기준(월 환산액의 25%/7% 초과분만 산입하던 규정)은 **2024년부터 단계적 확대가 완료되어 매월 지급되는 정기상여금·현금성 복리후생비는 전액 산입**된다(최초 조사 시 다수 2차 출처 교차확인, 이후 Calculation Auditor가 법률 제15666호 부칙 제2조 원문으로 "2024년부터는 100분의 0"임을 1차 출처로 완전히 재확인했다 — 아래 "기준/출처" 참고) — 즉 이 계산기의 단순화(총액 비교)는 2024년 이후에는 실제 법리와 거의 대부분 일치한다. 다만 **1개월을 초과하는 주기로 지급되는 상여금(분기·반기·연 단위 등)은 최저임금법 제6조제4항제1호에 따라 여전히 전액 산입 제외**되므로, 그런 상여금이 포함된 "총액"을 그대로 입력하면 실제보다 유리하게(낮게 위반 판정될 위험 없이, 오히려 과대평가되어) 계산될 수 있다 — 이는 SPEC이 이미 인지하고 감수한 단순화이며 결과 화면 고지 문구로 안내한다(SPEC Must Have).
- **수습 감액 자동 반영 안 함**(최저임금법 제5조제2항·시행령 제3조) — SPEC Should Have 안내 문구로만 처리.
- **연봉 단위 미지원**: 시급↔월급 양방향만 다룬다(SPEC "범위 밖").

(이 절은 v1과 동일, 반올림 정책 변경과 무관하다.)

---

## 예외
- **`mode` 미선택 또는 잘못된 값**: 계산하지 않고 오류.
- **`hourlyWage`(또는 `monthlyWage`)가 빈 값/0/음수/숫자 아님**: 계산하지 않고 명확한 오류 안내.
- **`weeklyHours`가 빈 값/0/음수/168 초과**: 계산하지 않고 오류 안내(weekly-holiday-allowance와 동일 기준 재사용).
- **`weeklyHours`가 40 초과**(예: 48, 168): 오류 아님. `weeklyHolidayHours = 8`로 상한 처리 후 정상 계산(weekly-holiday-allowance와 동일). breakdown에 "주 40시간을 초과한 시간은 주휴시간 산정에 포함되지 않습니다"를 명시할 것을 권장.
- **`weeklyHours`가 15 미만**: 오류 아님, 게이팅하지 않음. 위 "공식의 전제조건"에서 설명한 근사(비례식 그대로 적용)를 쓴다.
- **비현실적으로 큰 입력값**(시급·월급): 계산 로직 자체에는 상한이 없으나, 입력 검증에서 상식적 상한(예: 시급 1,000,000원, 월급 10억 원 수준)을 넘으면 오류로 안내할 것을 권장(정확한 상한값은 Architect/Builder 재량 — 계산 정확성과 무관).
- **`hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`가 `false`인 경우**: 계산을 막지 않는다. 눈에 띄는 경고/미충족 카드로 안내(SPEC Must Have, 게이팅 아님).
- **환산값의 재입력(체이닝) 금지**: `convertedMonthlyPay`나 `convertedHourlyWage`를 UI/로직에서 다시 반대 방향 계산의 입력으로 자동 전달하지 않는다(위 "정밀도/반올림 정책 > 왕복 계산" 참고) — 이는 입력 오류가 아니라 구현 시 반드시 지켜야 할 설계 제약이다.

(이 절은 v1과 동일, 반올림 정책 변경과 무관하다.)

---

## 검증 예제 (Golden Test 후보, 총 20개) [v2 — 전부 재계산]

> **[v2] 기댓값 전면 재계산 고지(확인일 2026-09-14)**: 아래 A1~E1의 기댓값은 v1(정수 반올림,
> 209시간 등)에서 v2(소수 둘째 자리 정밀값)로 정책이 바뀌면서 **전부 달라졌다**. 계산 방법은
> 위 "공식"·"계산 순서"(v2)를 그대로 따른다. 각 예제는 `round2(365/84 × weeklyPaidHours)`로
> 구한 `monthlyEquivalentHours`를 먼저 계산한 뒤, 그 값으로 환산·비교식을 계산한다(수기
> 재계산 후 이 문서에 직접 기록 — 프로젝트 코드는 아직 이 정책을 반영하지 않았으므로 Builder가
> 재구현 시 이 표를 그대로 golden 값으로 쓴다).
>
> **공식 대조 재확인**: A1의 입력(시급 10,320원, 주 40시간)은 여전히 2026년 고시 최저임금
> (고용노동부 고시 제2025-47호)에 정확히 근거한다. 다만 A1의 **계산 결과**는 더 이상 법제처
> 생활법령정보·고용노동부 보도자료의 "2,156,880원" 예시와 일치하지 않는다 — 이는 의도된
> 차이이며(위 "정밀도/반올림 정책" 참고), 대신 고용노동부가 실제로 운영하는 최저임금 모의계산기
> (`moel.go.kr/miniWageMain.do`, `wageResultNew()` 함수)의 계산 방식과 정합성을 갖는다(예제
> B4가 이를 직접 검증한다).

### 시급 모드 — 3가지 경계

#### 예제 A1 — 정확히 최저임금, 주 40시간(기본값)
- Input: `mode=HOURLY`, `hourlyWage=10,320`, `weeklyHours=40`
- 중간값: `weeklyHolidayHours=8`, `weeklyPaidHours=48`, `monthlyEquivalentHoursExact=48×365/84=208.571428...`, `monthlyEquivalentHours=208.57`[v2, 과거 209]
- Expected: `convertedMonthlyPay = round(10,320 × 208.57) = round(2,152,442.4) = 2,152,442원`[v2, 과거 2,156,880원], `minWageMonthlyEquivalent = 2,152,442원`, `hourlyMeetsMinimumWage=true`(경계), `monthlyMeetsMinimumWage=true`(경계, `2,152,442>=2,152,442`)
- 출처: 시급 10,320원은 위 "공식 대조 고지" 3개 정부(산하) 출처 그대로. 계산 방식(반올림 자릿수)은 moel.go.kr 실시간 판정 도구 기준(v2).

#### 예제 A2 — 최저임금보다 높음, 주 40시간
- Input: `hourlyWage=12,000`, `weeklyHours=40`
- Expected: `convertedMonthlyPay = round(12,000 × 208.57) = 2,502,840원`(딱 떨어짐)[v2, 과거 2,508,000원], `hourlyMeetsMinimumWage=true`, `monthlyMeetsMinimumWage=true`(2,502,840>=2,152,442)

#### 예제 A3 — 최저임금보다 낮음, 주 40시간
- Input: `hourlyWage=9,500`, `weeklyHours=40`
- Expected: `convertedMonthlyPay = round(9,500 × 208.57) = 1,981,415원`(딱 떨어짐)[v2, 과거 1,985,500원], `hourlyMeetsMinimumWage=false`(9,500<10,320), `monthlyMeetsMinimumWage=false`(1,981,415<2,152,442)

### 월급 모드 — 대칭되는 3가지 경계

#### 예제 B1 — 정확히 월 환산 최저임금, 주 40시간 [A1과 교차검증 쌍]
- Input: `mode=MONTHLY`, `monthlyWage=2,152,442`[v2, 과거 2,156,880], `weeklyHours=40`
- 중간값: `monthlyEquivalentHours=208.57`
- Expected: `convertedHourlyWage = round(2,152,442 / 208.57) = round(10,319.998...) = 10,320원`(반올림으로 정확히 복원됨), `hourlyMeetsMinimumWage=true`(경계), `monthlyMeetsMinimumWage=true`(경계)
- **교차검증**: A1의 결과(월급 2,152,442원)를 B1의 입력으로 넣으면 정확히 원래 시급 10,320원이 복원된다 — `monthlyEquivalentHours`가 소수(208.57)라도 이 방향의 왕복은 여전히 정확히 일치한다(SPEC 완료 기준, 위 "정밀도/반올림 정책 > 채택한 정책" 3번의 일반 증명 참고).

#### 예제 B2 — 최저임금보다 높음, 주 40시간
- Input: `monthlyWage=2,500,000`, `weeklyHours=40`
- Expected: `convertedHourlyWage = round(2,500,000 / 208.57) = round(11,986.38...) = 11,986원`[v2, 과거 11,962원], `hourlyMeetsMinimumWage=true`, `monthlyMeetsMinimumWage=true`
- 라벨: `11,986 × 208.57 = 2,499,920.02원` → `2,499,920원` ≠ `2,500,000원`(80원 차이)[v2, 과거 58원 차이] — 반올림 손실로 왕복이 정확히 일치하지 않는 사례(위 "왕복 계산의 정확성" 참고, 이 계산기는 이 값을 재입력하지 않으므로 사용자에게 노출되지 않는다).

#### 예제 B3 — 최저임금보다 낮음, 주 40시간
- Input: `monthlyWage=2,000,000`, `weeklyHours=40`
- Expected: `convertedHourlyWage = round(2,000,000 / 208.57) = round(9,589.11...) = 9,589원`[v2, 과거 9,569원], `hourlyMeetsMinimumWage=false`(9,589<10,320), `monthlyMeetsMinimumWage=false`(2,000,000<2,152,442)

#### 예제 B4 — [신규, v2] moel.go.kr 반례의 정합성 검증(Calculation Auditor가 제시한 counter-example)
- Input: `mode=MONTHLY`, `monthlyWage=2,154,000`, `weeklyHours=40`
- 중간값: `monthlyEquivalentHours=208.57`
- Expected: `convertedHourlyWage = round(2,154,000 / 208.57) = round(10,327.47...) = 10,327원`, `hourlyMeetsMinimumWage=true`(10,327>=10,320), `monthlyMeetsMinimumWage=true`(2,154,000>=2,152,442) → **"최저임금 이상"(정상)**
- **왜 이 예제가 중요한가**: 이 입력은 Calculation Auditor가 v1 정책의 반증으로 제시한 사례다.
  - v1(정수 209시간): `minWageMonthlyEquivalent = 10,320×209 = 2,156,880원`. `2,154,000 < 2,156,880` → **"최저임금 미만"(위반)** — moel.go.kr의 실제 판정 도구가 내리는 결론과 **반대**였다.
  - v2(소수 208.57시간): 위 계산대로 **"정상"** — moel.go.kr `wageResultNew()`가 같은 입력에 대해 계산한 `resultValue ≈ 10,327.47원`(Calculation Auditor 인용치)과 사실상 동일하며 판정도 일치한다.
  - 이 예제는 v2 정책 채택으로 반증이 실제로 해소됨을 증명하는 핵심 Golden Test다 — Builder/Calculation Auditor 재검증 시 반드시 포함할 것.

### 주 근무시간을 기본값이 아닌 값으로 입력 — 비례 검증

#### 예제 C1 — 주 20시간, 시급 모드, 정확히 최저임금
- Input: `hourlyWage=10,320`, `weeklyHours=20`
- 중간값: `weeklyHolidayHours=min(20/40×8,8)=4`, `weeklyPaidHours=24`, `monthlyEquivalentHoursExact=24×365/84=104.285714...`, `monthlyEquivalentHours=104.29`[v2, 과거 104]
- Expected: `convertedMonthlyPay = round(10,320 × 104.29) = 1,076,273원`[v2, 과거 1,073,280원], `minWageMonthlyEquivalent(20h) = 1,076,273원`, `hourlyMeetsMinimumWage=true`(경계), `monthlyMeetsMinimumWage=true`(경계)
- 라벨: 40시간 기준(208.57시간, 2,152,442원)과 달리 월 환산 시간·월 환산 최저임금이 근무시간에 비례해 축소됨을 검증. **[v2 참고]** `weeklyHours=20`처럼 `weeklyPaidHours`가 작을수록 v1(정수 반올림)의 상대 오차가 더 컸다는 것도 함께 확인됐다(D1 참고, 이 값이 정수 하나로 반올림될 때 손실되는 비중이 분모가 작을수록 커짐) — 소수 둘째 자리 정책이 비표준 근무시간에서 더 안정적이라는 추가 근거다.

#### 예제 C2 — 주 30시간, 월급 모드
- Input: `monthlyWage=1,700,000`, `weeklyHours=30`
- 중간값: `weeklyHolidayHours=6`, `weeklyPaidHours=36`, `monthlyEquivalentHoursExact=36×365/84=156.428571...`, `monthlyEquivalentHours=156.43`[v2, 과거 156]
- Expected: `convertedHourlyWage = round(1,700,000/156.43) = round(10,867.48...) = 10,867원`[v2, 과거 10,897원], `minWageMonthlyEquivalent(30h) = round(10,320×156.43) = 1,614,358원`[v2, 과거 1,609,920원], `hourlyMeetsMinimumWage=true`(10,867≥10,320), `monthlyMeetsMinimumWage=true`(1,700,000≥1,614,358)

### 주 근무시간 경계값

#### 예제 D1 — 주 근무시간 최솟값 근접(0 초과, 1시간)
- Input: `hourlyWage=10,320`, `weeklyHours=1`
- 중간값: `weeklyHolidayHours=min(1/40×8,8)=0.2`, `weeklyPaidHours=1.2`, `monthlyEquivalentHoursExact=1.2×365/84=5.214285...`, `monthlyEquivalentHours=5.21`[v2, 과거 5]
- Expected: `convertedMonthlyPay = round(10,320 × 5.21) = 53,767원`[v2, 과거 51,600원 — **약 4.2% 차이**], `minWageMonthlyEquivalent(1h) = 53,767원`, 양쪽 모두 경계상 "이상"
- 라벨: **[v2 핵심 발견]** `weeklyHours`가 작을수록(분모가 작을수록) 정수 반올림(v1)이 초래하는 상대 오차가 커진다는 것을 이 예제가 정량적으로 보여준다 — 40시간 기준(A1)에서는 v1·v2 차이가 약 0.2%(4,438/2,152,442)에 불과했지만, 1시간 기준(D1)에서는 약 **4.2%**(2,167/53,767)까지 벌어진다. 이는 v1의 "확인 필요 5번"(비표준 `weeklyHours`에도 정수 반올림 관행이 유효한지 정부 예시가 없었다는 우려)이 실제로 근거 있는 우려였음을 사후적으로 확인해 준다 — v2 정책은 이 문제를 구조적으로 제거한다(반올림 자릿수가 `weeklyHours` 크기와 무관하게 항상 소수 둘째 자리로 고정되므로 상대 오차가 `weeklyHours`에 따라 커지지 않는다).

#### 예제 D2 — 주 근무시간 상한(168시간)
- Input: `hourlyWage=10,320`, `weeklyHours=168`
- 중간값: `weeklyHolidayHours=min(168/40×8,8)=min(33.6,8)=8`(상한 적용), `weeklyPaidHours=176`, `monthlyEquivalentHoursExact=176×365/84=764.761904...`, `monthlyEquivalentHours=764.76`[v2, 과거 765]
- Expected: `convertedMonthlyPay = round(10,320 × 764.76) = 7,892,323원`[v2, 과거 7,894,800원]
- 라벨: 주휴시간 8시간 상한과 주 168시간(물리적 최대치) 상한이 동시에 걸리는 극단값 검증. `weeklyHours=169` 이상은 입력 오류(예제 F7)로 별도 처리.

### 소수점 입력

#### 예제 E1 — 시급 소수점 입력
- Input: `hourlyWage=10,320.5`, `weeklyHours=40`
- Expected: `convertedMonthlyPay = round(10,320.5 × 208.57) = round(2,152,546.685) = 2,152,547원`[v2, 과거 2,156,985원]
- 라벨: 시급 소수점 입력을 허용할 경우 최종 반올림 동작 검증(소수점 허용 여부 자체는 Architect 결정 사항).

### 입력 오류 케이스 (v1과 동일, 반올림 정책과 무관 — 변경 없음)

#### 예제 F1 — 시급 빈 값
- Input: `mode=HOURLY`, `hourlyWage=(빈 값)`, `weeklyHours=40`
- Expected: 계산하지 않음. "시급을 입력해 주세요" 오류.

#### 예제 F2 — 시급 0
- Input: `hourlyWage=0`
- Expected: 계산하지 않음. "0보다 큰 값을 입력해 주세요" 오류.

#### 예제 F3 — 시급 음수
- Input: `hourlyWage=-1,000`
- Expected: 계산하지 않음. 오류 안내.

#### 예제 F4 — 시급 비현실적으로 큰 값
- Input: `hourlyWage=100,000,000`(시간당 1억 원)
- Expected: 계산하지 않음. 상식적 상한 초과 오류(정확한 상한값은 Architect 재량, 이 값이 거부되어야 함을 검증하는 예시).

#### 예제 F5 — 주 근무시간 0
- Input: `hourlyWage=10,320`, `weeklyHours=0`
- Expected: 계산하지 않음. "주 근무시간은 0시간보다 커야 합니다" 오류.

#### 예제 F6 — 주 근무시간 음수
- Input: `weeklyHours=-10`
- Expected: 계산하지 않음. 오류 안내.

#### 예제 F7 — 주 근무시간 168 초과
- Input: `hourlyWage=10,320`, `weeklyHours=200`
- Expected: 계산하지 않음. "주 근무시간은 168시간을 초과할 수 없습니다" 오류.

#### 예제 F8 — 월급 모드, 월급 음수
- Input: `mode=MONTHLY`, `monthlyWage=-500,000`, `weeklyHours=40`
- Expected: 계산하지 않음. 오류 안내(월급 모드의 0/음수/빈 값도 시급 모드(F1~F3)와 동일하게 처리).

> Golden Test 후보 총 **20개**(A1~A3, B1~B4, C1~C2, D1~D2, E1, F1~F8)[v2, 과거 19개 — B4
> 신규 추가]. A1·B1이 정확히 최저임금 경계에서 서로 교차검증 쌍을 이루고, B4가 Calculation
> Auditor 반례의 해소를 직접 증명하며, C1·C2가 주 근무시간 비례 반영을, D1·D2가 물리적 경계를
> (D1은 추가로 v1·v2 오차 크기 차이도), F1~F8이 입력 방어를 검증한다.

---

## 정책 데이터 요구사항 — `rates-{year}.json` 반영 제안

### 기존 필드 재사용(신규 생성 없음)
- `minimumWage.hourly.value`(10,320원, 시간급) — `minWageHourly`로 그대로 사용.
- `laborStandards.statutoryWeeklyHours.value`(40), `laborStandards.statutoryDailyHours.value`(8) — `weeklyHolidayHours` 산식에 재사용.
- `laborStandards.monthlyWeekFactor.value`(`{daysPerYear:365, monthsPerYear:12, daysPerWeek:7}`) — `monthlyEquivalentHoursExact` 계산의 `365/84` 계수로 재사용.

### 신규 제안 필드 — `minimumWage.monthlyReference`(참고용, 계산에는 사용하지 않음) [v2: 문구·경고 강화]
```jsonc
"minimumWage": {
  "hourly": { /* 기존 그대로 */ },
  "monthlyReference": {
    "value": 2156880,
    "unit": "원/월",
    "note": "법정 기준근로시간(주 40시간) 근로자를 기준으로 한 참고용 월 환산액이며, 고용노동부·법제처가 홍보용으로 공표하는 반올림(정수 209시간) 예시다. [v2 경고, 2026-09-14] 이 계산기가 실제로 계산·비교에 쓰는 값(minWageMonthlyEquivalent)은 이 값과 다르다 — 계산기는 소수 둘째 자리 정밀 시간(208.57시간)을 써서 약 2,152,442원을 산출한다(고용노동부 실시간 최저임금 모의계산기 moel.go.kr의 판정 로직과 정합성을 맞추기 위함, tasks/minimum-wage-calculator/FORMULA.md '정밀도/반올림 정책 v2' 참고). 이 필드는 오직 '세간에 많이 알려진 참고 수치'를 화면에 설명용으로 병기할 때만 쓰고, 어떤 비교·판정 로직에도 절대 사용하지 않는다.",
    "referenceWeeklyHours": 40,
    "referenceMonthlyEquivalentHours": 209,
    "actualComputedNote": "동일 조건(주 40시간, 2026년 시급 10,320원)에서 이 계산기가 실제로 계산하는 minWageMonthlyEquivalent는 2,152,442원이다(소수 둘째 자리 정밀 정책, v2).",
    "source": {
      "law": "최저임금법 시행령 제5조제3호(계산방법)·제5조의2(월 환산액의 산정), 고용노동부 고시 제2025-47호(시간급 근거)",
      "article": "월 환산액은 고시가 아니라 고용노동부·최저임금위원회가 참고로 공표하는 반올림 예시(홍보용)",
      "effectiveDate": "2026-01-01",
      "url": "https://www.moel.go.kr"
    },
    "lastVerified": "2026-09-14",
    "nextReviewDue": "2027-01-01"
  }
}
```
- 이 필드는 **선택 사항**이며, v1에서 제안한 것과 동일한 자리에 그대로 둔다. 다만 v2에서는
  `note`/`actualComputedNote`로 "이 필드의 숫자는 계산에 쓰이는 실제 값과 다르다"는 경고를
  명시적으로 강화했다 — v1 시점에는 이 필드값(2,156,880)이 우연히 계산기의 실제 계산 결과와도
  같았지만(정수 반올림 정책이었으므로), v2부터는 두 값이 항상 달라지기 때문에 혼동 위험이
  커졌다.
- 실제 스키마 반영·명명 확정은 Architect 권한이다.

---

## 기준 / 출처

```
기준 연도: 2026
기준일: 2026-09-14 (v1 최초 작성) / 2026-09-14 (v2 개정, Calculation Auditor 공식 재검토 요청 반영)
공식 출처:
  - 최저임금법 제5조(최저임금액) — CaseNote(casenote.kr/법령/최저임금법/제5조)를 통해 원문 확인. 제1항: 최저임금액은 시간·일·주·월 단위로 정하되, 일·주·월 단위인 경우 시간급으로도 표시. 제2항: 수습근로자(1년 이상 계약, 수습 3개월 이내, 단순노무직 제외) 최대 10% 감액 가능. 확인일 2026-09-14.
  - 최저임금법 제6조(최저임금의 효력) — CaseNote(casenote.kr/법령/최저임금법/제6조)로 확인. 제1항: 최저임금액 이상 지급 의무. 제4항: 산입범위(상여금·복리후생비의 월 환산액 25%/7% 초과분만 산입하던 규정 — 2024년 전면 산입으로 사실상 종료). 확인일 2026-09-14.
  - **[v2 갱신] 최저임금법 시행령 제5조(최저임금의 적용을 위한 임금의 환산)** — 최초 작성 시 조문 제목을 "임금의 시간급 환산"으로 오기했으나, Calculation Auditor가 law.go.kr Open API(`DRF/lawService.do?OC=test&target=law&MST=206564`)로 확보한 정부 원문 제목은 **"최저임금의 적용을 위한 임금의 환산"**이다(v2에서 정정). 제1호(일급)·제2호(주급="1주 소정근로시간+제55조제1항 유급처리시간 합산")·제3호(월급="제2호 시간 수 × 1년 평균 주의 수 ÷ 12") 문언은 이 문서의 인용과 자구까지 정확히 일치함을 원문 대조로 확인(2026-09-14). 법령 전문에 "반올림"·"사사오입"·"올림"·"버림"·"절사" 단어가 전혀 등장하지 않음도 전문 검색으로 확인.
  - **[v2 신규] 최저임금법 시행령 제5조의2(월 환산액의 산정)** — law.go.kr Open API로 확인(2018.12.31 신설). "법 제6조제4항제2호 및 같은 항 제3호나목에 따른 월 환산액은 해당 연도 시간급 최저임금액에 제5조제1항제3호에 따른 1개월의 최저임금 적용기준 시간 수를 곱하여 산정한다" — `minWageMonthlyEquivalent = minWageHourly × monthlyEquivalentHours` 구조를 뒷받침. 반올림 방법은 역시 규정하지 않음.
  - 근로기준법 제55조제1항·시행령 제30조제1항·시행령 별표2 제4호, 대법원 2025.8.14. 선고 2022다291153 판결 — `tasks/weekly-holiday-allowance/FORMULA.md` "기준/출처"에서 이미 1차 확인 완료(2026-09-04). 이 계산기는 재조사 없이 재사용.
  - 174시간 vs 209시간 논쟁과 2019년 시행령 개정에 의한 종결 — 중기이코노미 기사(junggi.co.kr/article/articleView.html?no=22029), WebFetch로 직접 확인. 확인일 2026-09-14.
  - 월급 환산 시 "주 30시간이면 분모가 그에 맞게 줄어든다"는 일반화 근거 — 법무법인 도모 법률가이드(domolaw.co.kr/legal-guide/a7efe114-f331-442a-8f41-4b9016a2d56d), WebFetch로 직접 확인. 확인일 2026-09-14.
  - 2026년 적용 최저임금 시간급 10,320원, "월 환산액 2,156,880원(월 209시간 기준)"이라는 **홍보용 참고 수치** — 고용노동부 보도자료(moel.go.kr/news/enews/report/enewsView.do?news_seq=18144), 법제처 찾기쉬운 생활법령정보(easylaw.go.kr, 최저임금 계산 예시), 최저임금위원회 결정 현황(minimumwage.go.kr/minWage/policy/decisionMain.do) 세 곳 모두 WebFetch로 직접 열람해 동일 수치 확인. 확인일 2026-09-14. **시급 10,320원은 그대로 채택**하지만, **"209시간·2,156,880원"은 v2부터 이 계산기의 실제 계산·비교 값으로 쓰지 않는다**(아래 moel.go.kr 항목 참고). `rates-2026.json`의 `minimumWage.hourly.value=10320`은 weekly-holiday-allowance Architect 라운드(2026-09-04)에서 이미 검증됨.
  - **[v2 핵심 신규 출처] 고용노동부 최저임금 모의계산기(`https://www.moel.go.kr/miniWageMain.do`)의 실제 배포 JavaScript, `wageResultNew()` 함수** — Calculation Auditor가 `curl`로 페이지 원본을 내려받아 확보(2026-09-14, EVALUATION.md "우선순위 항목 2"에 전문 인용). 실제 최저임금 위반 여부 판정 버튼(`id="vioResult"`)에 연결된 살아있는 함수이며, 핵심 로직은 `workingHour = ((weekTime+paidTime)*365/84).toFixed(2)`(정수가 아니라 소수 둘째 자리)로 월 환산 시간을 구한 뒤 그 값으로 환산·비교를 수행한다. 같은 파일의 레거시 함수 `wageResult()`(현재 어떤 버튼에도 연결되지 않음)도 `Math.round(yearWorkingHours*100)/100`으로 2자리 반올림만 해, 신·구버전 모두 정수 반올림을 쓴 적이 없다. **이 문서 작성자(Formula Analyst)는 Bash/curl 접근 권한이 없어 직접 재확인하지 못했으나**, Auditor가 인용한 반례 수치(월급 2,154,000원 → `resultValue≈10,327.47원`)를 이 문서에서 독립적으로 재계산해 정확히 일치함을 확인했다(위 "검증 예제" B4). 확인일 2026-09-14.
  - 월 환산액이 "함께 표시"하는 참고값이며 별도 고시가 아니라는 근거 — 최저임금위원회가 "2027년 적용 최저임금액 결정 단위"를 "시간급으로 정하되, 월 환산액(월 209시간 근로 기준)을 함께 표시"하기로 했다는 보도(WebSearch 확인, 확인일 2026-09-14).
  - **[v2 갱신] 최저임금 산입범위 2024년 전면 산입** — 최초 작성 시 다수 2차 출처(HR 블로그)로 교차확인했으나, Calculation Auditor가 law.go.kr Open API로 **최저임금법 부칙(법률 제15666호, 2018.6.12 공포, 2019.1.1 시행) 제2조(최저임금의 효력에 관한 적용 특례) 원문**을 확보해 "2024년부터는 100분의 0"(정기상여금·복리후생비 모두)임을 1차 출처로 완전히 재확인했다(2026-09-14). 더 이상 "확인 필요"가 아니다.
  - 2027년 최저임금 시간급 10,700원(2026-08-05 확정·고시, 2027-01-01 시행) — `tasks/annual-leave-allowance/FORMULA.md`에서 이미 확인됨(2026-09-04). 이 계산기도 동일 값을 그대로 참고하며 재확인하지 않는다.
마지막 검토: 2026-09-14 (v2 개정)
다음 재검토 예정일: 2027-01-01 (최저임금 연 1회 고시 갱신 주기 — 매년 8월 발표, 다음해 1월 시행. rates-2027.json에 minimumWage.hourly.value=10700 및 monthlyReference 값 갱신 필요. 2027년 40시간 기준 실제 계산값은 동일 산식으로 10,700 × 208.57 = round(2,231,699원)이 될 것으로 예상되나, 실제 정부 발표 문구 및 moel.go.kr 판정 도구 로직이 그대로인지 재확인 필요)

※ 정기 재검토(연 1회) 외 조기 재검토 트리거:
  1. 최저임금법 시행령 제5조(또는 제5조의2)가 개정되어 월 환산 시간 산식(주휴시간 합산 여부·계수)이 바뀌는 경우.
  2. 최저임금법 제6조 산입범위 규정이 다시 개정되는 경우(2024년 전면 산입 완료 이후 추가 변경 여부 모니터링).
  3. 최저임금위원회가 "월 환산액 함께 표시" 기준시간(현재 209시간)을 바꾸는 경우.
  4. **[v2 신규]** 고용노동부 최저임금 모의계산기(moel.go.kr)가 `wageResultNew()`의 반올림 자릿수(현재 소수 둘째 자리)를 바꾸는 경우 — 이 계산기의 핵심 정책 근거이므로 연 1회 정기 재검토 시 반드시 moel.go.kr 코드를 재확인할 것.
```

---

## 여전히 남아있는 "확인 필요" 항목 [v2 갱신]

1. ~~최저임금법 시행령 제5조 원문 전체 미열람~~ **[v2: 해결]** — Calculation Auditor가
   law.go.kr Open API로 전문을 확보해 이 문서의 인용과 완전히 일치함을 확인했다(조문 제목만
   정정, 위 "기준/출처" 참고). 제5조의2(월 환산액의 산정)도 신규 확인.
2. **[v2: 정책 결정 완료, 잔여 불확실성만 남음]** 월 환산 시간 반올림 정책을 정수(209)에서
   소수 둘째 자리(208.57)로 교체했다(이번 개정의 본론). 다만 이 문서 작성자는 moel.go.kr의
   실제 JS를 Bash/curl로 직접 재확인할 권한이 없어, Calculation Auditor의 인용을 독립
   재계산(검증 예제 B4)으로만 교차검증했다 — 완전한 1차 확인(직접 curl)은 다음 라운드의
   Calculation Auditor·QA가 재확인해 주기를 권고한다.
3. **15시간 미만 근로자에게 주휴시간 비례식을 그대로 적용하는 근사의 정확성** — 변경 없음(v1과
   동일). 실제로는 주휴수당 자체가 발생하지 않을 수 있어 `monthlyEquivalentHours`가 과대
   산정될 수 있다. SPEC이 지급요건 판정을 범위 밖으로 명시했으므로 이 문서의 범위를 벗어난다.
4. **소정근로일 5일 초과 근로자(주 6일 등)의 주휴시간 근사** — 변경 없음(v1과 동일).
   weekly-holiday-allowance FORMULA.md가 이미 "확인 필요"로 남긴 한계를 그대로 상속한다.
5. ~~비표준 `weeklyHours`(40시간이 아닌 값)에 대한 정부의 실제 반올림 관행 미확인~~
   **[v2: 대부분 해소]** — moel.go.kr `wageResultNew()`의 실제 코드가 `weekTime`을
   하드코딩하지 않은 일반식이라는 것을 Calculation Auditor가 코드로 확인해, "정부가 비표준
   근무시간에도 같은 산식·반올림 정책을 쓰는가"라는 질문에 훨씬 강한 근거가 생겼다. 다만 이
   근거도 "정부의 실시간 도구가 그렇게 짜여 있다"는 정황 증거이지, 정부가 이를 공식 문서로
   확인해 준 것은 아니므로 잔여 불확실성은 낮지만 0은 아니다.
6. ~~최저임금법 제6조제4항 산입범위 "2024년 전면 산입"의 정부 1차 출처 미열람~~ **[v2: 해결]**
   — Calculation Auditor가 law.go.kr Open API로 법률 제15666호 부칙 제2조 원문을 확보해
   완전히 재확인했다(위 "기준/출처" 참고).
7. **[v2 신규] Calculation Auditor 항목 6(MONTHLY 모드 이중 배지 불일치)은 이번 정책 변경으로
   해소되지 않는다** — 위 "정밀도/반올림 정책 > [신규] Calculation Auditor 항목 6..." 절에서
   수학적으로 재확인했다(반례 구간 폭이 104개 → 103개로 사실상 변화 없음). 이는 FORMULA.md
   범위를 벗어나는 UX/Architect 설계 이슈로 남는다 — 배지 판정 로직 자체의 재설계가 필요하다.
8. **[v2 신규] `monthlyEquivalentHours`의 반올림 자릿수(2자리)가 향후에도 moel.go.kr과
   계속 일치할지는 매 재검토 시점마다 재확인이 필요하다** — 위 "기준/출처"의 조기 재검토
   트리거 4번 참고.

---

## FAQ 콘텐츠 (SPEC.md 질문 1~7 대응) [v2: Q1·Q2 갱신]

### 1. 올해 최저임금은 얼마인가요? [v2 갱신]
2026년 적용 최저임금은 시간급 **10,320원**입니다(고용노동부 고시 제2025-47호, 2025-08-05 고시, 2026-01-01~12-31 적용). 법정 기준근로시간인 주 40시간을 기준으로 월 환산하면 흔히 **"약 209시간, 2,156,880원"**으로 알려져 있는데, 이는 고용노동부·법제처가 보도자료 등에서 반올림해 안내하는 참고 수치입니다. 이 계산기는 최저임금 준수 여부를 좀 더 정확하게 판정하기 위해, 고용노동부가 실제로 운영하는 최저임금 모의계산기와 같은 방식으로 월 환산 시간을 소수 둘째 자리(약 208.57시간)까지 유지해서 계산합니다. 그 결과 이 계산기가 보여주는 월 환산 최저임금은 약 **2,152,442원**으로, 널리 알려진 2,156,880원과 4,438원 정도 차이가 납니다 — 계산이 틀린 것이 아니라, 반올림 시점을 정부의 실제 판정 도구에 맞춘 결과입니다. 다만 이 월 환산액 자체는 시간급과 별도로 독립적으로 고시되는 금액이 아니라, 시간급에 "주 40시간 근무" 표준 가정을 적용해 계산한 참고값입니다 — 주 근무시간이 다르면(예: 주 20시간) 월 환산 금액도 그에 비례해 달라집니다. 이 계산기는 사용자가 입력한 실제 주 근무시간을 기준으로 월 환산 최저임금을 다시 계산해 보여줍니다.
- 근거: 최저임금법 제5조제1항(시간급 표시 의무), 고용노동부 고시 제2025-47호, 최저임금위원회 결정 현황, 고용노동부 최저임금 모의계산기(moel.go.kr) 판정 로직.

### 2. 시급과 월급은 어떻게 서로 환산되나요? [v2 갱신]
최저임금법 시행령 제5조는 "1개월의 최저임금 적용기준 시간 수"를 "(1주 소정근로시간 + 유급주휴시간) × 1년간 평균 주의 수 ÷ 12"로 정합니다. 유급주휴시간은 1주 소정근로시간이 40시간이면 8시간, 그보다 적으면 비례해 줄어듭니다(예: 주 20시간이면 4시간). 이렇게 구한 "월 환산 시간"에 시급을 곱하면 월급이 되고, 반대로 월급을 이 시간으로 나누면 시급이 됩니다. 주 40시간 근무자의 월 환산 시간은 흔히 "약 209시간"으로 알려져 있지만, 이 계산기는 소수 둘째 자리(약 208.57시간)까지 그대로 사용해 계산합니다 — 정부가 실제로 최저임금 위반 여부를 판정할 때 쓰는 방식과 맞추기 위해서입니다.
- 근거: 최저임금법 시행령 제5조제2호·제3호·제5조의2, 근로기준법 제55조제1항, 고용노동부 최저임금 모의계산기(moel.go.kr) 판정 로직.

### 3. 왜 월급을 시급으로 계산할 때 주휴시간을 포함하나요?
과거에는 "월 환산 시간에 유급주휴시간을 포함해야 하는가"를 두고 대법원 판례(포함하지 않음, 약 174시간)와 고용노동부 행정해석(포함함, 약 209시간)의 입장이 달랐습니다. 그러나 **2019년 1월 1일부터 시행된 개정 최저임금법 시행령이 고용노동부의 입장을 명문화**해, 현재는 법령상 "1주의 최저임금 적용기준 시간 수"에 근로기준법 제55조제1항에 따른 유급주휴시간을 반드시 합산하도록 정하고 있습니다. 따라서 이는 관행이 아니라 현행 시행령 문언 자체입니다.
- 근거: 최저임금법 시행령 제5조제2호(2019.1.1. 시행 개정), 근로기준법 제55조제1항.

### 4. 최저임금보다 낮게 받고 있으면 어떻게 해야 하나요?
이 계산기는 참고용 비교 도구이며, 실제 최저임금법 위반 여부는 임금 항목 구성(상여금·복리후생비 등)과 실제 근로 조건을 종합적으로 따져야 확정됩니다. 최저임금 위반이 의심된다면 사업장 관할 지방고용노동관서에 진정을 제기하거나, 고용노동부 상담센터(국번 없이 1350)를 통해 상담받는 것이 정확합니다. 이 계산기가 직접 법적 조치를 안내하거나 위반 여부를 확정하지는 않습니다.
- 근거: SPEC.md "범위 밖"(법적 판정 도구 아님).

### 5. 상여금이나 식대도 최저임금 계산에 포함되나요?
이 계산기는 계산을 단순화하기 위해 **입력한 금액 총액을 그대로** 최저임금과 비교하며, 항목별(기본급·상여금·복리후생비 등) 산입 여부는 따지지 않습니다. 참고로 실제 법령(최저임금법 제6조제4항, 부칙 제2조)상으로는, 매월 1회 이상 정기적으로 지급되는 상여금과 식비·교통비 등 복리후생성 임금은 **2024년부터 전액**이 최저임금 산입 대상에 포함되도록 바뀌었습니다(과거에는 일정 비율 초과분만 산입). 다만 분기·반기·연 단위 등 1개월을 초과하는 주기로 지급되는 상여금은 여전히 산입 대상에서 제외됩니다. 급여명세서상 항목 구성에 따라 실제 최저임금 준수 여부가 이 계산기 결과와 달라질 수 있습니다.
- 근거: 최저임금법 제6조제4항 및 부칙(법률 제15666호) 제2조, 2024년 산입범위 단계적 확대 완료.

### 6. 수습 기간에는 최저임금보다 적게 받아도 되나요?
일정 요건을 모두 충족하면 가능합니다. 최저임금법 제5조제2항·시행령 제3조에 따라 ① 1년 이상의 근로계약을 체결하고 ② 수습 시작 후 3개월 이내이며 ③ 단순노무업무(한국표준직업분류상 대분류 9)에 종사하지 않는 근로자에 한해, 최저임금의 최대 10%까지 감액한 금액을 지급할 수 있습니다. 이 계산기는 이 감액을 자동으로 반영하지 않으며, 항상 감액 없는 최저임금 기준으로 비교합니다 — 수습 감액 대상인지는 근로계약 기간·직종을 직접 확인해야 합니다.
- 근거: 최저임금법 제5조제2항, 시행령 제3조.

### 7. 알바생인데 이 계산기로 주휴수당까지 계산할 수 있나요?
아니요. 이 계산기는 시급↔월급 환산과 최저임금 비교만 다루며, 주휴수당 자체의 상세 금액(1주치 주휴수당, 주휴수당 포함 실질 시급 등)은 계산하지 않습니다. 이 계산기는 월 환산 시간을 구하는 내부 계수로만 주휴시간을 사용합니다. 주휴수당 자체가 얼마인지 알고 싶다면 별도의 주휴수당 계산기를 이용해 주세요.
- 근거: SPEC.md "범위 밖"(주휴수당 상세 분해는 weekly-holiday-allowance 영역).

---

## 소개 문구 (SPEC.md "소개 콘텐츠" 대응) [v2: 정밀도 문구 보강]

> 최저임금·시급↔월급 계산기는 시급 또는 월급 중 아는 값 하나만 입력하면 나머지 금액을 바로 환산해 보여줍니다. 계산에는 최저임금법 시행령이 정한 "월 환산 시간" 산식(1주 소정근로시간에 유급주휴시간을 더한 뒤 한 달 평균 주 수를 곱하는 방식)을 그대로 적용하며, 주 근무시간을 다르게 입력하면 월 환산 시간과 월 환산 최저임금도 그에 맞게 달라집니다. 이 계산기는 월 환산 시간을 "약 209시간"으로 반올림하지 않고 소수 둘째 자리(약 208.57시간)까지 그대로 사용합니다 — 고용노동부가 실제로 최저임금 위반 여부를 판정할 때 쓰는 방식과 일치시켜, 판정 결과의 정확도를 높이기 위해서입니다. 환산된 시급·월급은 올해 고시된 최저임금과 자동으로 비교되어 "최저임금 이상/미만"을 바로 확인할 수 있습니다. 다만 이 계산기는 입력한 금액 총액을 기준으로 단순 비교하는 참고용 도구이며, 임금 항목별 산입 여부나 실제 최저임금법 위반 여부를 법적으로 판정하지는 않습니다.

근거: SPEC.md "목적" 문단 + 위 "공식"·"기준/출처"·"정밀도/반올림 정책 v2" 조사 결과.
