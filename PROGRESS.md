# PROGRESS

| Calculator | SPEC | Formula | Build | Audit | UX | QA | Score | Status | 다음 재검토 예정일 |
|---|---|---|---|---|---|---|---|---|---|
| severance-pay (퇴직금) | PASS | PASS | PASS (v2) | PASS | PASS | PASS | 95 | DONE | 2027-09-02 |
| unemployment-benefit (실업급여) | PASS | PASS | PASS | PASS | PASS | PASS | 95 | DONE | 2027-01-01* |
| weekly-holiday-allowance (주휴수당) | PASS | PASS | PASS | PASS | PASS | PASS | 98 | DONE | 2027-01-01** |
| four-major-insurance (4대 보험) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 2027-01-01 |
| military-discharge-date (전역일) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 2027-01-01·법령 개정 시 |
| business-days (영업일) | PASS | PASS | PASS | PASS | PASS | PASS | 96 | DONE | 2027-01-01·공휴일 발표 시 |
| parental-leave-benefit (육아휴직급여) | PASS | PASS | PASS | PASS | PASS | PASS | 96 | DONE | 2027-01-01·법령 개정 시 |
| age-calculator (만 나이) | PASS | PASS | PASS | TODO | TODO | TODO | - | PUBLISHED | 민법·행정기본법 개정 시 |
| bmi-calculator (BMI) | PASS | PASS | PASS | TODO | TODO | PASS | - | PUBLISHED | 2027 성장도표 공식 공개·비만 기준 개정 시 |
| military-salary (군인 월급) | PASS | PASS | PASS | TODO | TODO | PASS | - | PUBLISHED | 2027-01-01·봉급/군적금 정책 개정 시 |
| housing-subscription-score (청약가점) | PASS | PASS | PASS | PASS | PASS | PASS | 96 | DONE | 2027-01-01·「주택공급에 관한 규칙」 개정 시 |
| annual-salary-take-home-pay (연봉 실수령액) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 2027-01-01·간이세액표/4대보험 요율 개정 시 |
| loan-interest-calculator (대출 이자) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 해당 없음(정책형 아님, 공식 오류 발견 시에만) |
| bill-split-calculator (더치페이) | PASS | PASS | PASS | PASS | PASS | PASS | 96 | DONE | 해당 없음(정책형 아님, 공정성 알고리즘 오류 발견 시에만) |
| average-cost-calculator (평단가/물타기) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 해당 없음(정책형 아님, 공식 오류 발견 시에만) |
| d-day-calculator (디데이) | PASS | PASS | PASS | PASS | PASS | PASS | 98 | DONE | 해당 없음(정책형 아님, 날짜 계산 로직 오류 발견 시에만) |
| national-pension-benefit-estimate (국민연금 예상수령액) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 2026-12-01(A값)·2027-01-01(비례상수 등, 43% 고정 유지 여부 포함) |
| bmr-calculator (기초대사량/BMR) | PASS | PASS | PASS | PASS | PASS | PASS | 97 | DONE | 해당 없음(정책형 아님, 대표 공식 1차 출처 개정·오류 발견 시에만) |
| housing-acquisition-tax (주택 취득세) | PASS | PASS | PASS | PASS | PASS | PASS | 96 | DONE | 2027-01-01(정기)·조정대상지역 지정/해제 고시 시·다주택자 중과세율 완화 개정안 통과 시·생애최초 감면 일몰(2028-12-31) 임박 시·위택스 대조로 10원 미만 절사 확정 시(조기 재검토, tasks/housing-acquisition-tax/FORMULA.md "조기 재검토 트리거" 참고)*** |
| annual-leave-allowance (연차수당) | PASS | PASS | PASS | PASS | PASS | PASS | 98 | DONE | 2027-01-01(최저임금 참고 경고 갱신)·근로기준법 제60조/제61조 개정 시 |
| minimum-wage-calculator (최저임금·시급↔월급) | PASS | PASS (v2) | PASS (v2) | PASS (v2) | PASS | PASS | 96 | DONE | 2027-01-01(최저임금 연 1회 고시 갱신) |
| deposit-savings-interest-calculator (예금·적금 이자) | PASS | PASS (v2) | PASS (3차) | PASS (3차 재검증) | PASS (재검증) | PASS | 98 | DONE | 2027-01-01(이자소득세율 정기 점검, 재무수학 공식 자체는 정책형 아님) |
| real-estate-brokerage-fee-calculator (부동산 중개수수료) | PASS | PASS (v2) | PASS (v2) | PASS (재검증) | PASS (재검증) | PASS | 98 | DONE | 조기 재검토 트리거 기반(정기 아님) — 시행규칙/조례 개정 시, 17개 시·도 전수조사 완료 시(tasks/real-estate-brokerage-fee-calculator/FORMULA.md "조기 재검토 트리거" 참고) |

\* 정기 재검토 외에 조기 트리거 있음: 2027년 시행 예정인 고용보험제도 개편안(산정기준 변경 등)의 법 개정·공포 시점을 확인되는 즉시 재검토(tasks/unemployment-benefit/FORMULA.md "기준/출처" 하단 참고).

\*\* 정기 재검토(최저임금 연 1회 고시 주기, rates-2027.json에 최저임금 10,700원 반영 필요) 외 조기 트리거 있음: (1) 고용노동부가 대법원 2022다291153 판결을 반영해 주휴수당 산정 행정해석/실무를 변경하는 경우, (2) 주휴수당 제도 자체의 입법 변경, (3) 법정근로시간(주 40시간)·초단시간 기준(15시간) 개정(tasks/weekly-holiday-allowance/FORMULA.md "기준/출처" 하단 참고).

\*\*\* Architect 라운드(2026-09-14)에서 SPEC.md 예시(3구간)를 FORMULA.md 권고에 따라 4구간(1/2/3/4채 이상)으로 확정하고, FORMULA.md 프로즈와 검증 예제 사이의 6~9억 구간 세율 반올림 대상 불일치를 재계산으로 정정했다 — 상세는 tasks/housing-acquisition-tax/ARCHITECTURE.md "1.", "2." 참고. 10원 미만 절사 잠정 채택 여부는 Calculation Auditor의 위택스 대조가 최우선 검증 항목이다(같은 문서 "14.").

## Status 값
TODO / IN PROGRESS / FIXING / DONE / NEEDS HUMAN REVIEW

## 사용법
Product Owner가 새 계산기 시작 시 행을 추가한다. "다음 재검토 예정일"은 정책형 계산기만 채운다 (docs/CALCULATOR_RULES.md 참고).
