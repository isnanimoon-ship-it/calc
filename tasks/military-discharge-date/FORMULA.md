# FORMULA: 전역일 계산기

## 기준

- 기준일: 2026-09-04
- 지원 정책 구간: 2021-01-01 이후 복무 시작(모든 제공 유형의 현행 기간이 안정적으로 적용된 구간)
- 날짜 해석: 대한민국 달력 날짜, 시간대 없는 `YYYY-MM-DD`
- 다음 재검토: 2027-01-01 또는 관련 법령·복무기간 변경 시 즉시

## 공식 출처

- 병무청 병역이행안내: 육군·해병대 18개월, 해군 20개월, 공군 21개월
- 병무청 상근예비역제도 안내: 18개월
- 병무청 사회복무요원 소집제도: 21개월
- 병무청 전문연구·산업기능요원 안내: 전문연구 36개월, 산업기능 현역 34개월·보충역 23개월
- 병무청 주요 병무통계: 예술·체육 34개월, 승선·공중보건·검사전담·공익법무·방역수의·대체복무 36개월
- 병역법 시행령 제27조: 현역병 복무기간은 입영일부터 기산
- 군인사법 시행규칙 제32조: 일병 2개월, 상병 6개월, 병장 6개월의 계급별 진급 최저복무기간
- 병 인사관리 훈령 제22조: 진급심사 및 원칙적 매월 1일 발령

## 유형별 표준 기간

| ID | 표시명 | 그룹 | 개월 | 종료 용어 | 계급 일정 |
|---|---|---|---:|---|---|
| army | 육군 | active | 18 | 전역일 | 지원 |
| navy | 해군 | active | 20 | 전역일 | 지원 |
| air-force | 공군 | active | 21 | 전역일 | 지원 |
| marine | 해병대 | active | 18 | 전역일 | 지원 |
| full-time-reserve | 상근예비역 | reserve | 18 | 소집해제일 | 지원 |
| social-service | 사회복무요원 | alternative | 21 | 소집해제일 | 미지원 |
| arts-sports | 예술·체육요원 | alternative | 34 | 복무만료일 | 미지원 |
| public-health-doctor | 공중보건의사 | alternative | 36 | 복무만료일 | 미지원 |
| draft-exam-doctor | 병역판정검사전담의사 | alternative | 36 | 복무만료일 | 미지원 |
| public-service-lawyer | 공익법무관 | alternative | 36 | 복무만료일 | 미지원 |
| public-veterinarian | 공중방역수의사 | alternative | 36 | 복무만료일 | 미지원 |
| ship-reserve | 승선근무예비역 | alternative | 36 | 복무만료일 | 미지원 |
| research-personnel | 전문연구요원 | alternative | 36 | 복무만료일 | 미지원 |
| industrial-active | 산업기능요원(현역 대상) | alternative | 34 | 복무만료일 | 미지원 |
| industrial-supplement | 산업기능요원(보충역 대상) | alternative | 23 | 복무만료일 | 미지원 |
| alternative-service | 대체복무요원 | alternative | 36 | 복무만료일 | 미지원 |

## 입력값

| 변수 | 설명 | 허용 범위 |
|---|---|---|
| serviceType | 위 정책 ID | 목록 중 하나 |
| startDate | 입영·소집·편입일 | 2021-01-01~2100-12-31 |
| referenceDate | 계산 기준일 | 2020-01-01~2200-12-31 |

## 날짜 공식

1. `anniversary = addCalendarMonthsClamped(startDate, serviceMonths)`
2. `endDate = anniversary - 1 calendar day`
3. `serviceSpanDays = daySerial(endDate) - daySerial(startDate)`
4. `remainingDays = daySerial(endDate) - daySerial(referenceDate)`
5. `elapsedDays = clamp(daySerial(referenceDate) - daySerial(startDate), 0, serviceSpanDays)`
6. `progress = serviceSpanDays === 0 ? 100 : elapsedDays / serviceSpanDays * 100`

종료일은 시작일을 복무기간에 산입하기 위해 개월 기념일의 전날로 잡는다. `D-0`은 종료일
당일이다. 화면의 총 일수는 시작일에서 종료일까지 지난 날짜 경계 수로, 시작일과 종료일을 모두
세는 포함 일수보다 1 작다.

월 덧셈은 목표 연·월의 말일과 원래 일자 중 작은 값을 사용한다. UTC 밀리초를 사용자 시간으로
해석하지 않고 `Date.UTC`로 만든 일련번호만 날짜 차이에 사용한다.

## 달력 기간 분해

남은 기간은 기준일이 종료일 이전일 때 기준일에서 종료일까지 완전한 연, 완전한 월, 남은 일을
순서대로 더해 가장 큰 단위부터 분해한다. 입영 전에는 별도 상태와 시작일까지 D-day를 표시한다.
종료 후에는 남은 기간 대신 복무 완료 후 경과 일수를 표시한다.

## 이정표

- 공통: 시작 0%, 25%, 50%, 75%, 종료 100%
- 중간 이정표 일련번호: `startSerial + round(serviceSpanDays × ratio)`
- 계급 최저복무 기준: 일병 `start + 2개월`, 상병 `start + 8개월`, 병장 `start + 14개월`
- 계급 날짜는 법정 최저복무기간에서 산출한 `진급 가능 기준일`이며 실제 발령일이 아니다.

## 상태

- `upcoming`: 기준일 < 시작일, 진행률 0
- `serving`: 시작일 ≤ 기준일 < 종료일
- `completion-day`: 기준일 = 종료일, 진행률 100
- `completed`: 기준일 > 종료일, 진행률 100

## Golden Test 후보

1. 육군 2026-09-04 시작 → 2028-03-03 종료, span 546일
2. 해군 2026-09-04 시작 → 2028-05-03 종료
3. 공군 2026-09-04 시작 → 2028-06-03 종료
4. 사회복무 2026-09-04 시작 → 2028-06-03 종료
5. 산업기능 보충역 2026-09-04 시작 → 2028-08-03 종료
6. 육군 2024-02-29 시작 → 2025-08-28 종료
7. 육군 2026-01-31 시작 → 2027-07-30 종료
8. 시작일 기준 진행률 0%, 종료일 기준 100%
9. 종료 다음 날 completed/D+1
10. 시작 전 upcoming 및 입영 D-day
11. 육군 진급 기준일 +2/+8/+14개월
12. 사회복무에는 계급 일정 없음

## 알려진 제한

개인별 복무 제외일·연장·중단·편입·조기전역과 실제 진급심사를 반영하지 않는다. 과거 복무기간
단축 이력은 지원하지 않으며 2021-01-01 이전 시작일은 검증 오류로 처리한다.
