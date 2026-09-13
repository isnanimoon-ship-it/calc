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

\* 정기 재검토 외에 조기 트리거 있음: 2027년 시행 예정인 고용보험제도 개편안(산정기준 변경 등)의 법 개정·공포 시점을 확인되는 즉시 재검토(tasks/unemployment-benefit/FORMULA.md "기준/출처" 하단 참고).

\*\* 정기 재검토(최저임금 연 1회 고시 주기, rates-2027.json에 최저임금 10,700원 반영 필요) 외 조기 트리거 있음: (1) 고용노동부가 대법원 2022다291153 판결을 반영해 주휴수당 산정 행정해석/실무를 변경하는 경우, (2) 주휴수당 제도 자체의 입법 변경, (3) 법정근로시간(주 40시간)·초단시간 기준(15시간) 개정(tasks/weekly-holiday-allowance/FORMULA.md "기준/출처" 하단 참고).

## Status 값
TODO / IN PROGRESS / FIXING / DONE / NEEDS HUMAN REVIEW

## 사용법
Product Owner가 새 계산기 시작 시 행을 추가한다. "다음 재검토 예정일"은 정책형 계산기만 채운다 (docs/CALCULATOR_RULES.md 참고).
