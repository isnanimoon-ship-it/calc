# FORMULA: 만 나이 계산기

## 기준

- 기준일 / 마지막 검토: 2026-09-05
- 날짜 해석: 대한민국 달력의 시간대 없는 `YYYY-MM-DD`
- 지원 범위: 1900-01-01~2200-12-31
- 다음 재검토: 민법 제158조 또는 행정기본법 제7조의2 개정 시

## 공식 출처

1. 민법 제158조: 출생일을 산입해 만 나이로 계산하고 연수로 표시하며 1세 미만은 월수 표시 가능
   - https://www.law.go.kr/법령/민법/제158조
2. 행정기본법 제7조의2: 다른 법령에 특별한 규정이 없으면 행정상 나이를 만 나이로 계산
   - https://www.law.go.kr/LSW/lsInfoP.do?ancNo=17979&ancYd=20210323&ancYnChk=0&chrClsCd=010202&efGubun=Y&efYd=20210924&lsiSeq=230457&nwJoYnInfo=Y
3. 법제처 만 나이 통일 안내 및 공식 계산 예시
   - https://moleg.go.kr/menu.es?mid=a10111060000
4. 한국천문연구원 음양력 정보 API: 양력·음력 연도와 세차(연간지) 검증
   - https://www.data.go.kr/dataset/15012679/openapi.do
5. 한국천문연구원 월력요항: 연도별 음력 1월 1일과 입춘 날짜·시각 검증
   - https://astro.kasi.re.kr/life/post/calendardata

구현은 위 한국 음력 기준 변환표를 오프라인으로 포함한 `korean-lunar-calendar` 0.4.0을
사용한다. 설날 전후 대표 연도는 한국천문연구원 자료와 별도 Golden Test로 교차 검증한다.

## 입력

| 변수 | 설명 | 범위 |
|---|---|---|
| birthDate | 생년월일 | 1900-01-01~2200-12-31 |
| referenceDate | 나이를 확인할 기준일 | birthDate 이상, 2200-12-31 이하 |

## 만 나이

1. `yearDifference = reference.year - birth.year`
2. `birthdayThisYear = anniversary(birthDate, reference.year)`
3. `hasBirthdayPassed = referenceDate >= birthdayThisYear`
4. `fullAge = yearDifference - (hasBirthdayPassed ? 0 : 1)`

`anniversary`는 출생 월·일을 대상 연도에 옮긴다. 대상 연도에 같은 날짜가 없으면 해당 월의
말일로 보정한다. 따라서 2월 29일생은 평년에는 2월 28일을 해당 연도의 나이 경계로 사용한다.

## 정확한 경과기간

`birthDate`에서 `referenceDate`를 넘지 않는 가장 큰 완전한 연수를 먼저 구하고, 그 날짜부터
가장 큰 완전한 월수를 구한 뒤 남은 날짜 경계 수를 일수로 계산한다.

```text
anniversary = addYearsClamped(birthDate, fullYears)
fullMonths = 최대 m (addMonthsClamped(anniversary, m) <= referenceDate)
cursor = addMonthsClamped(anniversary, fullMonths)
remainingDays = daySerial(referenceDate) - daySerial(cursor)
```

결과는 `{ years, months, days }`이며 `years`는 만 나이와 같아야 한다. 월말 보정이 연속 계산에
누적되지 않도록 각 단계의 기준 날짜와 목표 연·월을 명시적으로 계산한다.

## 태어난 지 지난 일수

`daysSinceBirth = daySerial(referenceDate) - daySerial(birthDate)`

이는 두 날짜 사이에 지난 날짜 경계 수다. 출생일 당일은 0일이다. 법률상 ‘출생일 산입’은
나이의 기산 원칙이고, 화면의 ‘태어난 지 N일’은 경과한 완전한 일수를 뜻하므로 서로 모순되지
않는다.

## 생일과 D-day

- `birthdayThisYear = anniversary(birthDate, reference.year)`
- referenceDate가 birthdayThisYear와 같으면 `birthdayState = today`, `daysUntilBirthday = 0`
- referenceDate가 이전이면 다음 생일은 birthdayThisYear
- referenceDate가 이후면 다음 생일은 다음 연도의 anniversary
- `daysUntilBirthday = daySerial(nextBirthday) - daySerial(referenceDate)`

생일 당일은 `D-0`으로 표시한다. 다음 날부터 다음 연도 생일을 대상으로 계산한다.

## 참고 나이

- 세는나이: `koreanCountingAge = reference.year - birth.year + 1`
- 연 나이: `yearAge = reference.year - birth.year`

두 값은 생일 통과 여부를 사용하지 않는다. 세는나이는 과거 관행, 연 나이는 일부 개별 법령의
정의에서만 사용하는 참고값이며 법적 기본 나이로 표현하지 않는다.

## 요일

날짜를 UTC 자정의 day serial로 바꿔 요일 인덱스를 계산한다. 화면에는 `월요일`~`일요일`을
표시하며 로컬 `Date` 파싱으로 인한 시간대 이동을 허용하지 않는다.

## 띠와 색상 간지

### 기본 경계

`zodiacBoundary = lunarNewYearDate(solarYear)`

- `birthDate < zodiacBoundary`이면 `lunarYear = solarYear - 1`
- 그 외에는 `lunarYear = solarYear`
- 연도 스냅샷이 제공하는 세차(연간지)를 SSOT로 사용하고 양력연도만으로 음력 경계를
  추정하지 않는다.

v1은 음력 설날 기준만 제공한다. 입춘 기준은 해당 연도의 한국 표준시 절입 시각과 출생 시각을
함께 받을 수 있는 후속 버전에서 추가하며 날짜만으로 임의 판정하지 않는다.

### 십이지 동물

| 지지 | 띠 |
|---|---|
| 子 | 쥐 |
| 丑 | 소 |
| 寅 | 호랑이 |
| 卯 | 토끼 |
| 辰 | 용 |
| 巳 | 뱀 |
| 午 | 말 |
| 未 | 양 |
| 申 | 원숭이 |
| 酉 | 닭 |
| 戌 | 개 |
| 亥 | 돼지 |

### 천간·오행·색상

| 천간 | 오행 | 기본 색상어 | 친숙한 표시 |
|---|---|---|---|
| 甲·乙 | 목(木) | 푸른색 | 푸른 |
| 丙·丁 | 화(火) | 붉은색 | 붉은 |
| 戊·己 | 토(土) | 황색 | 황금 |
| 庚·辛 | 금(金) | 흰색 | 흰 |
| 壬·癸 | 수(水) | 검정 | 검은 |

`displayZodiac = colorAdjective(heavenlyStem) + " " + animal(earthlyBranch) + "띠"`

예시:

- 무술(戊戌) → 토·황색 + 개 → `황금 개띠`
- 계사(癸巳) → 수·검정 + 뱀 → `검은 뱀띠`
- 을사(乙巳) → 목·푸른색 + 뱀 → `푸른 뱀띠`

색상 표현은 전통 오방색 대응을 사용한 문화적 별칭이며 운세나 성격을 판단하지 않는다.

## Golden Test

1. 법제처 예시: 1992-06-28 / 2023-06-28 → 만 31세
2. 법제처 예시: 1978-07-09 / 2023-06-28 → 만 44세
3. 2014-09-16 / 2026-09-05 → 만 11세, 정확히 11년 11개월 20일, 다음 생일 D-11
4. 생일 전날 → 전년도 만 나이 유지
5. 생일 당일 → 만 나이 1 증가, D-0
6. 생일 다음 날 → 다음 연도 생일까지 계산
7. 2024-02-29 / 2025-02-27 → 만 0세
8. 2024-02-29 / 2025-02-28 → 만 1세
9. 출생일과 기준일 동일 → 만 0세, 0개월 0일, 0일 경과
10. 2000-01-01 / 2026-01-01 → 만 26세, 세는나이 27세, 연 나이 26세
11. 2018년 설날 당일 이후 → 무술년, 황금 개띠
12. 2013년 설날 당일 이후 → 계사년, 검은 뱀띠
13. 2025년 설날 전날/당일 → 갑진년 용띠/을사년 푸른 뱀띠 경계

## 알려진 제한

- 개별 법률이 특별히 정한 연령 기준은 자동 판정하지 않는다.
- 1900년 이전 날짜와 2200년 이후 날짜는 제품 지원 범위 밖이다.
- 음력 생일 변환은 제공하지 않는다. 입춘 기준을 사용하지 않을 때 출생 시각은 반영하지 않는다.
- 띠·간지는 한국 음력 변환 데이터가 지원하는 양력 1900-01-01~2050-12-31만 제공한다.
