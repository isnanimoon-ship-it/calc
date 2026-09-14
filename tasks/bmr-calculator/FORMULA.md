# FORMULA: 기초대사량(BMR) 계산기

## 목적

성별·나이·키·체중으로 기초대사량(BMR, kcal/일)을 추정하고, 활동량을 선택하면 활동을
반영한 하루 총 소비 칼로리(TDEE, kcal/일)를 추가로 계산한다. `tasks/bmr-calculator/SPEC.md`가
확정한 범위(TDEE Must Have 통합, 공식 자동 적용, Katch-McArdle 제외, 나이 직접 입력)를
그대로 따른다. 이 문서는 그 범위를 바꾸지 않고 계산 공식·상수·범위·반올림 규칙만 확정한다.

## 대표 공식 채택 근거

**대표 공식: Mifflin-St Jeor 공식 (Mifflin MD, St Jeor ST, et al. 1990)**

- 1차 출처: Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. "A new
  predictive equation for resting energy expenditure in healthy individuals." *Am J Clin
  Nutr.* 1990;51(2):241-247. doi:10.1093/ajcn/51.2.241
- 채택 근거(정확도 비교 연구, 1차 학술 출처): Frankenfield DC, Roth-Yousey L, Compher C.
  "Comparison of Predictive Equations for Resting Metabolic Rate in Healthy Nonobese and
  Obese Adults: A Systematic Review." *J Am Diet Assoc.* 2005;105(5):775-789.
  doi:10.1016/j.jada.2005.02.005 — 미국영양및식이요법학회(Academy of Nutrition and
  Dietetics, 옛 American Dietetic Association)가 수행한 체계적 문헌고찰로, 여러 예측
  공식 중 Mifflin-St Jeor가 간접열량측정(indirect calorimetry, 골드 스탠다드) 실측값과
  가장 근접했고 실측값의 ±10% 이내로 예측한 비율이 가장 높다고 결론지었다. 이 근거로
  해당 학회는 임상 실무에서 Mifflin-St Jeor를 우선 권고한다.
- 위 두 문헌은 서로 다른 2차 출처(mifflinstjeor.com 원저자 사이트, PubMed/PMC 초록)를
  통해 계수·표본 정보가 교차 확인되었다.

## Should Have 보조 공식 채택 근거

**보조 공식: Harris-Benedict 개정판 (Roza & Shizgal, 1984)**

- 1차 출처: Roza AM, Shizgal HM. "The Harris Benedict equation reevaluated: resting energy
  requirements and the body cell mass." *Am J Clin Nutr.* 1984;40(1):168-182. PMID: 6741850.
- 1919년 원판(Harris JA, Benedict FG)이 아니라 1984년 개정판을 채택한다. SPEC.md가
  "Harris-Benedict 개정판"을 예시로 명시했고(성별/체중/키/나이 표본이 더 크고 최신이며
  상관계수가 원판보다 높음), 온라인에 흔히 도는 "Harris-Benedict" 계산기는 종종 1919년
  원판 계수(남 66.5+13.75W+5.003H-6.75A / 여 655.1+9.563W+1.850H-4.676A, Omni Calculator
  등에서 확인)를 쓰므로 혼동하지 않도록 이 문서는 개정판 계수만 사용한다.

## 활동계수 5단계 채택 근거

값(1.2 / 1.375 / 1.55 / 1.725 / 1.9)은 Mifflin-St Jeor·Harris-Benedict 기반 BMR을
TDEE로 환산할 때 가장 널리 쓰이는 표준 5단계 값이다. 여러 독립 출처
(omnicalculator.com, athleanx.com, calculatemytdee.org 등 다수 피트니스/영양 계산기)에서
동일한 5개 숫자와 동일한 일수 구간(1~3일/3~5일/6~7일)이 일관되게 재현되어 "널리 인용되는
표준값"으로 채택했다. **다만 이 5개 숫자를 최초로 제시한 단일 1차 학술 논문은 특정하지
못했다** — 일부 2차 출처는 McArdle/Katch/Katch의 운동생리학 교재 계열에서 유래했다고
설명하나 정확한 판/쪽수를 확인하지 못했고, 다른 출처는 "IOM/WHO 가이드라인 기반"이라고
설명하지만 IOM 2002/2005 DRI 보고서의 PAL(신체활동수준) 구간값(활동적 기준 약 1.11~1.48)과
숫자가 달라 이 설명은 신빙성이 낮다. 이 프로젝트는 정확성 원칙(`docs/GOAL.md`)에 따라
이 사실을 숨기지 않고 아래 "확인 필요" 목록에 남긴다. 그럼에도 이 5개 값은 여러 독립
출처에서 숫자 차이 없이 완전히 일치해 재현성이 높으므로, 표준값으로 채택해 기능을
제공하는 것이 사용자 가치(하루 권장 칼로리 파악)에 부합한다고 판단했다.

## 유효 연령 범위 근거

**하한 19세, 상한 78세 (양끝 포함).**

- Mifflin-St Jeor 1990년 원 논문의 피험자는 건강한 성인 498명(남 251명, 여 247명),
  연령 19~78세(평균 45±14세)였다. 이 범위 밖은 원 공식이 회귀분석에 사용한 표본 범위를
  벗어난 외삽(extrapolation)이 되므로, `docs/GOAL.md` "확인 안 된 수치는 추정하지 않음"
  원칙에 따라 입력 자체를 19~78세로 제한한다(연구 표본 밖 나이에 억지로 값을 내어주지
  않음). `bmi-calculator` FORMULA.md가 소아청소년 성장도표 데이터 범위(24~227개월) 밖을
  외삽하지 않고 "판정 불가"로 처리한 것과 같은 원칙이다.
- 소아·청소년 전용 공식은 SPEC.md가 이미 v1 범위 밖으로 뺐으므로 하한을 성인 시작
  연령(19세, 원 논문 표본 최저 연령과 일치)으로 잡는 것이 자연스럽다.
- 78세 초과 시 정확도가 떨어질 수 있다는 정황도 있다(예: 고령자 대상 개별 연구에서
  Mifflin-St Jeor이 다른 공식보다는 낫지만 여전히 오차가 있다고 보고 — PMID: 24527991,
  초록만 확인, 원문 미확인). 다만 이 상한을 "78세"로 고정한 것은 무엇보다 원 논문 표본
  범위 자체가 그렇기 때문이며, 이 정황 연구는 보조 근거일 뿐이다.
- **의사결정 메모(다른 역할이 참고할 것)**: 78세로 상한을 막으면 실제로 계산기를 쓰고
  싶어할 고령 사용자를 배제하는 UX 트레이드오프가 있다. 그러나 나이 계수가 선형이라
  검증 범위를 크게 벗어나면(예: 100세) 수치적으로도 이상해질 위험이 있고, 검증되지 않은
  값을 "추정하지 않는다"는 이 프로젝트의 최우선 원칙(`docs/GOAL.md` 핵심목표 1)이 UX
  편의보다 우선한다. UX/PO가 이 트레이드오프에 이견이 있다면 반려 사유에 반박 근거(더
  넓은 연령대를 검증한 신뢰할 만한 1차 출처)를 제시해야 하며, 그런 근거 없이 범위만
  넓혀달라는 요청은 반영하지 않는다(`docs/EVALUATION.md` "역할 간 이견 조정").

## 키/체중 입력 범위 근거

**키 100.0~230.0cm, 체중 20.0~300.0kg.**

- Mifflin-St Jeor 원 논문(1990) Table 1의 피험자 신장·체중 실측 범위(최소~최대)는 원문
  전체를 확보하지 못해 **확인하지 못했다**(2차 출처는 "정상 체중~비만"이라고만 설명하고
  구체적 cm/kg 범위를 제시하지 않음). 따라서 이 범위는 공식이 직접 검증한 인체측정
  범위가 아니라, 비현실적 오탈력값(예: 0cm, 500kg)을 막기 위한 **실무적 guard-rail**임을
  명시한다.
- `bmi-calculator`는 영유아를 포함하므로 40.0~250.0cm/2.0~500.0kg을 쓰지만, 이 계산기는
  성인(19~78세)만 대상이라 영유아 체형까지 열어둘 필요가 없어 그대로 재사용하지 않았다.
  100.0cm 하한은 저신장 성인(예: 왜소증)을 부당하게 차단하지 않으면서 소아 신장대와
  뚜렷이 구분되는 값으로 정했고, 230.0cm 상한과 300.0kg 상한은 극단적으로 큰 값이지만
  기록상 존재하는 성인 체형을 배제하지 않을 정도로 넉넉하게 잡았다. 20.0kg 하한은 성인
  기준으로 극단적인 저체중(중증 거식증 등)까지 포함하되 소아 체중과 겹치지 않도록 했다.
- 이 범위는 "확인 필요" 항목(원 논문 실측 범위)이 나중에 확보되면 재검토한다.

## 입력값

| 변수명 | 설명 | 단위 | 허용 범위 |
|---|---|---|---|
| `sex` | 공식의 성별 상수 선택용 분류 | `male \| female` | 필수 |
| `ageYears` | 만 나이 | 세, 정수 | 19~78 (양끝 포함), 정수만 허용 |
| `heightCm` | 키 | cm | 100.0~230.0, 소수 첫째 자리까지 |
| `weightKg` | 체중 | kg | 20.0~300.0, 소수 첫째 자리까지 |
| `activityLevel` | 활동량 5단계 | `1\|2\|3\|4\|5 \| null`(미선택) | 선택 입력 |

### 활동계수 5단계

| level | 일상어 설명(UI 노출) | 활동계수 |
|---|---|---:|
| 1 | 거의 운동을 안 함 (주로 앉아서 생활) | 1.2 |
| 2 | 가벼운 활동 (주 1~3일 정도 가벼운 운동) | 1.375 |
| 3 | 보통 활동 (주 3~5일 정도 적당한 강도의 운동) | 1.55 |
| 4 | 활발한 활동 (주 6~7일 강도 높은 운동) | 1.725 |
| 5 | 매우 활발함 (매일 강도 높은 운동/육체노동) | 1.9 |

레벨 1·5 설명 문구는 SPEC.md가 예시로 제시한 문구를 그대로 사용했고, 2~4단계는 여러
독립 출처가 공통으로 쓰는 "주당 운동 일수" 구간 설명을 채택했다(출처 근거는 위 "활동계수
5단계 채택 근거" 참고).

## 출력값

| 변수명 | 설명 | 단위 |
|---|---|---|
| `bmrExact` | 대표 공식(Mifflin-St Jeor)으로 계산한 반올림 전 BMR | kcal/일 |
| `bmrDisplay` | 화면 표시용 정수 반올림 BMR | kcal/일 |
| `tdeeExact` | `activityLevel` 선택 시, 반올림 전 BMR × 활동계수 | kcal/일 |
| `tdeeDisplay` | 화면 표시용 정수 반올림 TDEE(선택 시에만 존재) | kcal/일 |
| `bmrAltExact` | (Should Have) 보조 공식(Harris-Benedict 개정판) 반올림 전 BMR | kcal/일 |
| `bmrAltDisplay` | (Should Have) 화면 표시용 정수 반올림 보조 BMR | kcal/일 |

## 공식

### 대표 공식 — Mifflin-St Jeor (1990)

```text
남성: BMR = 10 × weightKg + 6.25 × heightCm − 5 × ageYears + 5
여성: BMR = 10 × weightKg + 6.25 × heightCm − 5 × ageYears − 161
```

원 논문의 회귀분석 원계수는 2차 출처(mifflinstjeor.com)에 따르면 체중 9.99, 나이 4.92로
더 정밀했으나(원문 미확보로 **정확한 소수값은 확인 필요**), 모든 임상 참고자료·계산기가
반올림된 10/5를 표준으로 사용하므로 이 계산기도 10/5/6.25를 채택한다.

### TDEE — 활동계수 적용 (활동량을 선택한 경우에만)

```text
TDEE = bmrExact(반올림 전 완전정밀도) × 활동계수(1.2 / 1.375 / 1.55 / 1.725 / 1.9)
```

### 보조 공식(Should Have) — Harris-Benedict 개정판 (Roza & Shizgal, 1984)

```text
남성: BMR_alt = 88.362 + 13.397 × weightKg + 4.799 × heightCm − 5.677 × ageYears
여성: BMR_alt = 447.593 + 9.247 × weightKg + 3.098 × heightCm − 4.330 × ageYears
```

## 계산 순서

1. 입력(성별, 나이, 키, 체중, 활동량[선택])을 검증한다. 하나라도 유효 범위를 벗어나면
   계산하지 않는다.
2. 대표 공식(Mifflin-St Jeor)으로 `bmrExact`를 완전정밀도로 계산한다.
3. `bmrExact`를 반올림해 `bmrDisplay`를 만든다(최종 표시 단계에서만 반올림).
4. `activityLevel`이 선택된 경우에만, **반올림 전** `bmrExact`에 해당 활동계수를 곱해
   `tdeeExact`를 계산하고, 이를 별도로 반올림해 `tdeeDisplay`를 만든다. `bmrDisplay`를
   재사용해 곱하지 않는다(중복 반올림으로 인한 오차 누적 방지, `docs/CALCULATOR_RULES.md`
   "반올림 정책").
5. (Should Have) 보조 공식(Harris-Benedict 개정판)으로 `bmrAltExact`를 별도로 완전정밀도
   계산하고, 최종 표시 단계에서만 반올림해 `bmrAltDisplay`를 만든다. 대표 공식 계산과
   서로 영향을 주지 않는 완전히 독립된 계산이다.
6. `activityLevel`을 선택하지 않았으면 TDEE 관련 값(`tdeeExact`, `tdeeDisplay`)을 아예
   생성하지 않는다(UI는 TDEE 섹션 자체를 숨긴다 — SPEC.md Must Have).

## 단위

- 키: 입력 cm, 내부 계산도 cm(별도 환산 없음, 공식이 cm을 직접 사용).
- 체중: 입력 kg, 내부 계산도 kg.
- 나이: 입력 만 나이(세) 정수, 내부 계산도 정수 세.
- BMR/TDEE: kcal/일. "1일 소비 칼로리"이며 1회 식사·순간 소비량이 아님을 결과 안내에
  명시한다.
- 활동계수: 단위 없는 배수(무차원).

## 정밀도 / 반올림 정책

- 내부 계산(`bmrExact`, `tdeeExact`, `bmrAltExact`): JavaScript `number` 완전정밀도 유지,
  중간 단계에서 임의로 반올림하지 않는다(`docs/CALCULATOR_RULES.md` "반올림 정책").
- 표시값(`bmrDisplay`, `tdeeDisplay`, `bmrAltDisplay`): 소수점 이하 첫째 자리에서
  반올림(0.5는 올림, 즉 표준 "반올림" — 값이 항상 양수이므로 음수 특이 케이스 없음)해
  정수 kcal로만 표시한다.
- `tdeeExact`는 반드시 `bmrDisplay`가 아니라 `bmrExact`(반올림 전 값)에 활동계수를
  곱해서 구한다 — 이미 반올림된 값을 다시 곱하면 오차가 누적되어 다른 계산기와 결과가
  ±1kcal 수준으로 어긋날 수 있다(아래 Golden Test #20 참고, 실제로 이 정책 차이 때문에
  외부 계산기 예시와 1kcal 차이가 나는 사례를 문서화했다).
- `bmrAltExact`(보조 공식)는 대표 공식과 독립적으로 계산하며, 대표 공식의 반올림된 값을
  참조하지 않는다.
- 곱셈(`bmrExact × 활동계수`)의 부동소수점 오차가 반올림 결과를 바꾸지 않는지 Builder가
  구현 시 단위 테스트로 확인한다(`docs/CALCULATOR_RULES.md` "Floating Point").

## 예외

- 성별을 선택하지 않았으면 계산하지 않는다.
- 나이가 정수가 아니거나(소수, 문자, 공백), 19세 미만이거나 78세를 초과하면 계산하지
  않고 유효 범위를 안내한다(경계값 19·78 자체는 유효).
- 키가 100.0cm 미만이거나 230.0cm를 초과하면 계산하지 않는다(경계값 100.0·230.0 자체는
  유효).
- 체중이 20.0kg 미만이거나 300.0kg를 초과하면 계산하지 않는다(경계값 20.0·300.0 자체는
  유효).
- 키/체중이 0, 음수, NaN, 빈 값이면 계산하지 않는다(위 범위 검증에 포함되지만 별도
  케이스로도 명시).
- `activityLevel`을 선택하지 않으면 BMR만 계산하고 TDEE 섹션은 아예 표시하지 않는다(숨김이
  아니라 데이터 자체를 만들지 않음).
- `activityLevel`에 1~5 밖의 값이 들어오면(방어적 코딩 대상, UI는 select라 정상적으로는
  발생하지 않음) TDEE를 계산하지 않고 BMR만 표시한다.
- 입력이 바뀌면 기존 결과(BMR·TDEE·보조 공식 결과 전부)를 숨긴다(SPEC.md Must Have).

## 검증 예제 (Golden Test 후보, 25개 그룹 — 하위 케이스 포함 시 20개 초과)

반올림 규칙: 정수 반올림(0.5는 올림). `raw`는 반올림 전 완전정밀도 값.

### 1. Male 30/175cm/70kg, 활동량 미선택
- BMR raw 1648.75 → 표시 **1649**. TDEE 섹션 없음.

### 2. Female 30/165cm/60kg, 활동량 미선택
- BMR raw 1320.25 → 표시 **1320**. TDEE 섹션 없음.

### 3. Male 45/180cm/85kg, 활동량=보통(1.55)
- BMR raw 1755.0 → 표시 **1755**. TDEE raw 2720.25 → 표시 **2720**.

### 4. Female 45/160cm/55kg, 활동량=거의 안 함(1.2)
- BMR raw 1164.0 → 표시 **1164**. TDEE raw 1396.8 → 표시 **1397**.

### 5. Male 25/170cm/65kg, 활동량=가벼운 활동(1.375)
- BMR raw 1592.5 → 표시 **1593**. TDEE raw 2189.6875 → 표시 **2190**.

### 6. Female 25/158cm/50kg, 활동량=활발한 활동(1.725)
- BMR raw 1201.5 → 표시 **1202**. TDEE raw 2072.5875 → 표시 **2073**.

### 7. Male 50/178cm/90kg, 활동량=매우 활발함(1.9)
- BMR raw 1767.5 → 표시 **1768**. TDEE raw 3358.25 → 표시 **3358**.

### 8. Female 60/150cm/48kg, 활동량 미선택 (TDEE 섹션 없음 케이스)
- BMR raw 956.5 → 표시 **957**. TDEE 섹션이 절대 나타나지 않아야 한다.

### 9. Male 19/175cm/70kg (나이 하한 경계, 유효)
- BMR raw 1703.75 → 표시 **1704**.

### 10. 나이 18세 입력 (하한 미만, Male/Female 각각)
- 검증 실패, 계산하지 않음.

### 11. Female 78/160cm/60kg (나이 상한 경계, 유효)
- BMR raw 1049.0 → 표시 **1049**.

### 12. 나이 79세 입력 (상한 초과)
- 검증 실패, 계산하지 않음.

### 13. Male 19/100.0cm/30kg (키 하한 경계, 유효)
- BMR raw 835.0 → 표시 **835**.

### 14. Female 78/230.0cm/300.0kg (키·체중 상한 경계, 유효)
- BMR raw 3886.5 → 표시 **3887**.

### 15. 경계 바로 밖 입력 4종 (각각 검증 실패)
- 키 99.9cm, 키 230.1cm, 체중 19.9kg, 체중 300.1kg.

### 16. 성별 상수 차이 확인 (나이·키·체중 동일, 성별만 다름)
- Male 40/170cm/65kg: BMR raw 1517.5 → 표시 **1518**.
- Female 40/170cm/65kg: BMR raw 1351.5 → 표시 **1352**.
- 차이는 정확히 166kcal(남 상수 +5 − 여 상수 −161 = 166)여야 한다.

### 17. 활동계수 5단계 전부 (기준 인물: Male 35/175cm/75kg, BMR raw 1673.75 → 표시 1674)
- 레벨1(1.2): TDEE raw 2008.5 → 표시 **2009**
- 레벨2(1.375): TDEE raw 2301.40625 → 표시 **2301**
- 레벨3(1.55): TDEE raw 2594.3125 → 표시 **2594**
- 레벨4(1.725): TDEE raw 2887.21875 → 표시 **2887**
- 레벨5(1.9): TDEE raw 3180.125 → 표시 **3180**

### 18. Should Have 보조 공식 — Male 45/180cm/85kg (3번과 동일 인물)
- Harris-Benedict 개정판 raw 1835.462 → 표시 **1835** (대표 공식 결과 1755와 별개로
  둘 다 화면에 표시).

### 19. Should Have 보조 공식 — Female 45/160cm/55kg (4번과 동일 인물)
- Harris-Benedict 개정판 raw 1257.008 → 표시 **1257**.

### 20. 외부 계산기 대조 1 — Female 35/165.1cm/54.55kg
- Mifflin-St Jeor raw 1241.375 → 표시 **1241**.
- 출처: Inch Calculator "Mifflin St. Jeor Calculator" 예시
  (https://www.inchcalculator.com/mifflin-st-jeor-calculator/, 120lb/65in/36→35세 여성,
  확인일 2026-09-13) — 원문이 그대로 제시한 계산 "BMR = (10 × 54.55) + (6.25 × 165.1) –
  (5 × 35) – 161" → "BMR = 1,241 kcal"와 정확히 일치.
- 이 예시는 TDEE(매우 활발함, ×1.9)를 "1,241 × 1.9 = 2,358"로 제시하지만(반올림된 BMR을
  곱한 값), 이 계산기의 정책(반올림 전 raw BMR에 곱함)으로는
  1241.375 × 1.9 = 2358.6125 → 표시 **2359**로 1kcal 차이가 난다. 이는 계산 오류가
  아니라 반올림 시점 정책 차이이며, 이 계산기는 `docs/CALCULATOR_RULES.md`의 "중간 반올림
  금지" 원칙을 따르는 2359가 맞는 값이다(Calculation Auditor 검토 시 이 근거를 참고할 것).
- **재확인 이력**: Calculation Auditor가 2026-09-13 WebFetch로 원문을 직접 열람해 재현을
  확인했고, Formula Analyst도 같은 날 별도의 독립 WebFetch 호출로 원문 텍스트("120 lbs ÷
  2.2 = 54.55 kg", "65 inches × 2.54 = 165.1 cm", "BMR = (10 × 54.55) + (6.25 × 165.1) –
  (5 × 35) – 161", "BMR = 1,241 kcal", "TDEE = 1,241 × 1.9 = 2,358 kcal")을 다시 확인해
  위 서술과 토씨 하나까지 일치함을 재검증했다.

### 21. 외부 계산기 대조 2 — Male 60/162.56cm/68.04kg
- Mifflin-St Jeor raw 1401.4 → 표시 **1401**.
- 출처: **Omni Calculator "BMR Calculator (Basal Metabolic Rate, Mifflin St Jeor Equation)"**
  (https://www.omnicalculator.com/health/bmr, "BMR for man calculation – an example" 섹션,
  확인일 2026-09-13) — 원문이 그대로 제시한 계산 "10 × 68.04 + 6.25 × 162.56 – 5 × 60 + 5 =
  680.4 + 1016 – 300 + 5 = 1401.4 (kcal / day)"와 정확히 일치. 페이지 서두는 "Nowadays,
  the Mifflin-St Jeor equation is believed to give the most accurate result and is,
  therefore, what we used in this calculator."라고 명시해 이 페이지가 Mifflin-St Jeor
  공식을 쓴다는 것도 원문으로 확인했다.
- **주의(omnicalculator.com 내 페이지 구분)**: 이 URL(`/health/bmr`)은 이 문서 "Should Have
  보조 공식 채택 근거"에서 1919년 원판 계수 확인용으로 인용한 `/health/
  bmr-harris-benedict-equation`(Harris-Benedict 계산기)과 **다른 별개의 페이지**다. 전자는
  Mifflin-St Jeor, 후자는 Harris-Benedict 1919년 원판을 쓰므로 혼동하지 않는다.
- **출처 정정 이력(2026-09-13, Calculation Auditor 반려 → Formula Analyst 재조사)**: 이전
  초안은 이 예시를 "Inch Calculator 동일 페이지 예시"로 인용했으나, 이는 사실이 아니었다.
  Calculation Auditor가 `inchcalculator.com/mifflin-st-jeor-calculator/`를 서로 다른 4가지
  질문으로 WebFetch 재검증한 결과 그 페이지에는 여성 35세 예시 단 하나만 존재하고 이
  남성 예시(60세/162.56cm/68.04kg/1,401.4kcal)는 그 페이지에도, 같은 사이트의
  Harris-Benedict 계산기 페이지에도 존재하지 않음을 확인해 "공식 재검토 요청"(High)으로
  반려했다. Formula Analyst가 재조사한 결과, 이 예시는 Inch Calculator가 아니라 위 Omni
  Calculator 페이지에 실제로 게시되어 있음을 서로 다른 프롬프트의 WebFetch 호출 2회로
  독립 확인했다(계산 수식 전문, 페이지 제목, 섹션 제목("BMR for man calculation – an
  example")까지 원문 그대로 대조). 계산값(1,401.4kcal) 자체는 애초에 Mifflin-St Jeor
  공식을 정확히 대입한 결과였으므로 변경하지 않고, **인용 출처만 Inch Calculator에서
  Omni Calculator로 정정**한다. 이로써 `docs/CALCULATOR_RULES.md` "공식 계산기 예시값과
  대조한 케이스 최소 2개" 요건은 서로 다른 두 개의 독립 외부 계산기 사이트(Inch
  Calculator #20, Omni Calculator #21)로 실질적으로 충족된다.

### 22. 소수 입력 처리 — Male 33/174.5cm/68.3kg
- BMR raw 1613.625 → 표시 **1614**.

### 23. 예외 — 체중 0, 음수(-5), 빈 값
- 각각 검증 실패, 계산하지 않음.

### 24. 예외 — 나이에 소수(30.5) 또는 숫자가 아닌 문자열("삼십") 입력
- 검증 실패, 계산하지 않음(나이는 정수만 허용).

### 25. 예외 — `activityLevel`이 1~5 범위를 벗어난 값(방어적 코딩)
- TDEE를 계산하지 않고 BMR만 표시.

## 확인 필요 (추정하지 않고 남기는 항목)

- Mifflin et al. 1990 원 논문의 정밀 회귀계수(반올림 전 체중 계수 9.99, 나이 계수 4.92로
  알려짐)의 정확한 소수값 — 원문 전체를 확보하지 못해 2차 출처 인용에 의존했다. 이
  계산기는 임상 실무 표준인 반올림값(10, 6.25, 5)을 채택했으므로 기능에는 영향 없음.
- Mifflin et al. 1990 원 논문 Table 1의 피험자 실측 키/체중 범위(최소~최대) — 원문
  미확보로 확인하지 못했다. 대신 실무적 guard-rail 범위(100.0~230.0cm,
  20.0~300.0kg)를 별도로 정의해 사용했다(위 "키/체중 입력 범위 근거" 참고).
- 활동계수 5단계(1.2/1.375/1.55/1.725/1.9)를 최초로 제시한 단일 1차 학술 논문/기관 —
  특정하지 못했다. 여러 독립 2차 출처가 완전히 동일한 값을 재현하므로 표준값으로 채택은
  했으나, 단일 권위 있는 1차 출처를 요구하는 검토가 있다면 이 항목을 재조사해야 한다.
- Mifflin-St Jeor 공식의 79세 이상 정확도 저하 폭에 대한 정량적 수치(PMID 24527991 등) —
  초록 수준 정보만 확인했고 원문(정확한 표본 연령대, 오차율)은 확인하지 못했다. 이
  계산기는 상한을 78세로 막아 이 불확실성을 회피했으므로 v1 정확성에는 영향 없음.

## 기준 / 출처

```text
대표 공식: Mifflin-St Jeor (1990)
공식 출처: Mifflin MD et al. Am J Clin Nutr. 1990;51(2):241-247. doi:10.1093/ajcn/51.2.241
채택 근거: Frankenfield DC et al. J Am Diet Assoc. 2005;105(5):775-789.
  doi:10.1016/j.jada.2005.02.005 (Mifflin-St Jeor 정확도 최우수 결론)

보조 공식(Should Have): Harris-Benedict 개정판 (Roza & Shizgal, 1984)
공식 출처: Roza AM, Shizgal HM. Am J Clin Nutr. 1984;40(1):168-182. PMID: 6741850.

활동계수 5단계: 1.2 / 1.375 / 1.55 / 1.725 / 1.9
출처: 단일 1차 학술 출처 미확정(위 "확인 필요" 참고). 여러 독립 2차 출처(피트니스/영양
  계산기 다수)에서 일관되게 재현되는 값을 표준값으로 채택.

외부 계산기 교차검증 1(Golden Test #20): Inch Calculator "Mifflin St. Jeor Calculator
  (TDEE & BMR)" (https://www.inchcalculator.com/mifflin-st-jeor-calculator/,
  확인일 2026-09-13, Formula Analyst 독립 재확인 2026-09-13)
외부 계산기 교차검증 2(Golden Test #21): Omni Calculator "BMR Calculator (Basal Metabolic
  Rate, Mifflin St Jeor Equation)" (https://www.omnicalculator.com/health/bmr,
  확인일 2026-09-13) — 2026-09-13 Calculation Auditor 반려로 출처를 Inch Calculator에서
  이 URL로 정정함(위 Golden Test #21 "출처 정정 이력" 참고).
  주의: 같은 사이트의 https://www.omnicalculator.com/health/bmr-harris-benedict-equation
  (Harris-Benedict 1919년 원판)과는 다른 페이지다.

유효 연령 범위 근거: Mifflin et al. 1990 원 논문 피험자 연령대(19~78세)
마지막 검토: 2026-09-13
다음 재검토: 정기 재검토 예정일 없음(비정책형 계산기). 대표 공식(Mifflin-St Jeor)의 1차
  출처가 개정되거나 공식 오류·활동계수 출처에 대한 결정적 반증이 확인되는 경우에만 재검토.
```

- https://mifflinstjeor.com/mifflin-st-jeor-equation/
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9967803/
- https://pubmed.ncbi.nlm.nih.gov/6741850/
- https://www.omnicalculator.com/health/bmr-harris-benedict-equation
- https://www.omnicalculator.com/health/bmr
- https://www.inchcalculator.com/mifflin-st-jeor-calculator/
- https://pubmed.ncbi.nlm.nih.gov/24527991/
