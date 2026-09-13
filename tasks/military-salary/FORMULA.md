# FORMULA: 군인 월급 계산기

## 정책 기준

- 기준 연도: 2026년
- 확인일: 2026-09-06
- 금액 단위: 원 단위 정수
- 다음 정기 검토: 2027-01-01

## 공식 출처

1. 인사혁신처 2026년 군인의 봉급표
   - https://www.mpm.go.kr/mpm/info/resultPay/bizSalary/2026/
2. 국가법령정보센터 공무원보수규정 별표 13
   - https://www.law.go.kr/lsBylInfoPLinkR.do?bylBrNo=00&bylCls=BE&bylNo=0013&lsNm=공무원보수규정
3. 국가법령정보센터 군인사법 시행규칙 제32조
   - https://www.law.go.kr/LSW/LsiJoLinkP.do?docType=JO&joNo=001500000&languageType=KO&lsNm=군인사법시행규칙&paras=1
4. 국방부 장병내일준비적금 안내
   - https://www.mnd.go.kr/mnd/288/subview.do

## 2026년 병 봉급

| 계급 | 월 봉급 |
|---|---:|
| 이등병 | 750,000원 |
| 일등병 | 900,000원 |
| 상등병 | 1,200,000원 |
| 병장 | 1,500,000원 |

`rankSubtotal = rankMonths × monthlyPay`

`grossSalaryTotal = Σ rankSubtotal`

병 봉급은 복무형태가 아니라 계급으로 결정된다. 복무형태는 총 복무개월과 그 결과 생기는 병장
예상 복무개월에 영향을 준다.

## 표준 계급개월

군인사법 시행규칙 제32조의 진급 최저복무기간을 계획값으로 사용한다.

- 이병: 2개월 후 일병 진급 예상
- 일병: 6개월 후 상병 진급 예상
- 상병: 6개월 후 병장 진급 예상
- 병장: `전체 표준 복무개월 - 14개월`

| 복무형태 | 총개월 | 이병 | 일병 | 상병 | 병장 |
|---|---:|---:|---:|---:|---:|
| 육군·해병대·상근예비역 | 18 | 2 | 6 | 6 | 4 |
| 해군 | 20 | 2 | 6 | 6 | 6 |
| 공군 | 21 | 2 | 6 | 6 | 7 |

이는 진급 최저복무기간을 이용한 예상표다. 진급심사, 진급 제한·단축·연장과 실제 발령에 따라
달라질 수 있으므로 사용자가 실제 진급일을 직접 입력할 수 있게 한다.

## 장병내일준비적금

2025년 1월 이후 개인별 월 납입한도는 최대 55만원이며 5만원 단위로 설정한다. 동일 은행이 아닌
2개 계좌까지 가입할 수 있고 계좌별 최대 30만원이므로, 계산기는 은행별 분배가 아니라 개인 합산
납입액만 입력받는다.

2024년 이후 적격 만기해지의 정부 매칭지원금은 납입원금의 100%다.

`principal = monthlyContribution × contributionMonths`

`matchingSupport = principal`

은행이자는 상품·은행·우대조건·납입일에 따라 달라진다. v1은 사용자가 입력한 연 금리를 이용해
각 월 납입금의 잔존기간을 월 단위 단리로 추정한다.

`interest_i = contribution × annualRate × remainingMonths_i ÷ 12`

`estimatedInterest = floor(Σ interest_i)`

`estimatedMaturity = principal + estimatedInterest + matchingSupport`

실제 은행 계산은 납입일, 일수, 은행 약관에 따라 달라질 수 있다. 화면에서는 원금과 정부지원은
정책 계산, 은행이자는 추정치로 구분한다.

`availableDuringService = grossSalaryTotal - principal`

매칭지원금은 월 봉급에 더하지 않는다. 전역 또는 소집해제에 따른 적격 만기해지 후 지급되는
자산형성 지원이므로 결과에서도 `월 실수령`이 아닌 `예상 만기자산`에만 포함한다.

## 입력 검증

| 입력 | 규칙 |
|---|---|
| serviceType | army, navy, air-force, marine, full-time-reserve 중 하나 |
| enlistmentDate | 유효한 날짜, 정책 지원 범위 내 |
| referenceDate | 기준일까지 모드에서 필수, 입영 전도 허용 |
| contribution | 가입 시 50,000~550,000원, 50,000원 배수 |
| contributionMonths | 6 이상, 선택 유형 표준 복무개월 이하 |
| annualRate | 0~20% |
| actualPromotionDates | 순서가 증가하고 입영일~예상 전역일 범위 |

## Formula Gate

- 병 봉급, 적금 한도와 100% 매칭 규칙: `PASS`
- 표준 계급개월 예상 합계: `PASS`, 실제 진급 차이 안내 필수
- 월중 일할 봉급: 공식 세부 계산·원 미만 처리 미확정으로 v1 제외
- 은행이자: 공식 확정액이 아닌 사용자 금리 기반 추정치로만 제공
