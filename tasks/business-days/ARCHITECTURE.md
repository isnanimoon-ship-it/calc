# ARCHITECTURE: 영업일 계산기

- `src/data/holidays/{year}.json`: 연도별 정적 공휴일 스냅샷
- `src/calculators/business-days/types.ts`: 입력·결과·공휴일 타입
- `date-utils.ts`: 시간대 없는 날짜 순회
- `holidays.ts`: 스냅샷 병합과 제외 사유 판정
- `logic.ts`: 기간 계산과 N영업일 탐색 순수 함수
- `validation.ts`: 모드별 입력·지원 범위 검증
- `ui.tsx`: 모드, 설정, 상세 결과 UI

브라우저 런타임에서 외부 API를 호출하지 않는다. 공휴일 데이터와 계산 로직은 분리하고,
동일 날짜의 복수 공휴일 사유는 배열로 보존한다. 날짜는 UTC day serial을 저장용이 아닌 순수
달력 연산에만 사용한다.
