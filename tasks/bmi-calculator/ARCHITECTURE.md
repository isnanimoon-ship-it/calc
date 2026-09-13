# ARCHITECTURE: BMI 계산기

## 파일 구조

```text
src/calculators/bmi-calculator/
  types.ts              입력·연령 기준·결과 타입
  validation.ts         날짜·숫자·성별 검증
  age.ts                완성 월령 계산
  logic.ts              BMI·성인 분류·체중 경계 계산
  pediatric.ts          LMS Z-score·백분위 계산
  formatting.ts         BMI·백분위·체중 표시
  content.ts            사용법·FAQ·SEO 콘텐츠
  ui.tsx                입력·결과 UI
  *.test.ts(x)          단위·Golden·UI 테스트
src/data/growth-charts/
  korea-2017-bmi.json   성별·완성 월령별 L/M/S 및 공식 경계
  README.md             원본 URL·취득일·변환 절차·checksum
```

## 핵심 타입

```ts
type GrowthChartSex = "male" | "female";
type AgeStandard = "under-two" | "pediatric-2017" | "adult-korean";

interface BmiInput {
  birthDate: string;
  referenceDate: string;
  sex: GrowthChartSex;
  heightCm: number;
  weightKg: number;
  waistCm?: number;
}

interface BmiResult {
  bmi: number;
  completedMonths: number;
  ageStandard: AgeStandard;
  category: "not-assessed" | "underweight" | "normal" | "pre-obesity" |
    "obesity-1" | "obesity-2" | "obesity-3" | "overweight" | "obesity";
  zScore?: number;
  percentile?: number;
  thresholds: Record<string, number>;
  referenceWeightRange?: { minKg: number; maxExclusiveKg: number };
  abdominalObesity: boolean | null;
}
```

## 핵심 결정

- 단순 `나이 선택` 대신 생년월일과 기준일을 받아 월령 경계를 정확히 계산한다.
- 성인 BMI 등급은 남녀가 같으며 성별로 임의 보정하지 않는다.
- 소아·청소년만 성별·완성 월령별 LMS를 사용한다.
- 만 2세 미만에 성인 또는 소아 BMI 기준을 억지로 적용하지 않는다.
- 공식 성장도표 원자료는 빌드 시 외부 API로 조회하지 않고 검증된 JSON 스냅샷으로 번들한다.
- 원본 파일, 취득일, 변환 스크립트, SHA-256을 데이터 README에 기록해 수기 전사 오류를 막는다.
- 2027 성장도표는 현재 개정 단계이므로 공식 원자료 공개 전에는 추정하거나 혼합하지 않는다.
- 성장도표 데이터는 `version`, `supportedMonthRange`, `sex`, `L`, `M`, `S`, percentile 경계를
  포함하고 런타임에서 범위를 벗어나면 명시적으로 실패한다.
- 결과 공유는 공통 Base64URL 공유 기능을 사용하고 서버 저장은 하지 않는다.

## UI 구성

1. 제목·기준 버전 안내
2. 생년월일·기준일, 성별 입력
3. 키·체중과 성인 조건부 허리둘레 입력
4. 계산/샘플/초기화
5. 공통 공유 영역
6. BMI 핵심 결과와 연령 기준 판정
7. BMI 스케일 또는 소아 백분위 위치
8. 적용 경계와 참고 체중 범위
9. 실제 값이 대입된 계산 방법
10. 측정·해석 주의사항과 FAQ

결과 색상만으로 저체중·정상·비만을 표현하지 않고 항상 분류명과 범위를 병기한다. 건강 상태를
좋음/나쁨 아이콘으로 단정하지 않으며 사이트 시맨틱 색상 토큰만 사용한다.

## 데이터 검증

- 공식 파일의 모든 성별·월령 행 수와 지원 범위를 검사한다.
- L/M/S가 유한수이고 S > 0인지 검사한다.
- 5 < 50 < 85 < 95 백분위 BMI 경계가 단조 증가하는지 검사한다.
- LMS에서 역산한 경계와 공식 표 경계의 허용오차를 검사한다.
- JSON 변환 스크립트를 재실행해 동일 checksum이 나오는지 확인한다.
- 데이터가 누락되면 인접 월령 보간이나 성인 기준 fallback을 하지 않는다.

## 구현 순서

1. 공식 성장도표 원자료 확보와 데이터 라이선스·배포 가능 여부 확인
2. 변환 스크립트와 데이터 무결성 테스트
3. 완성 월령·BMI·LMS 순수 함수 및 Golden Test
4. 입력 검증과 포맷팅
5. UI·공유 URL 복원·구조화 데이터
6. 정확성 감사·모바일·접근성 QA 후 `published` 전환

