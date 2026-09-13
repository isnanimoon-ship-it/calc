export const businessDaysFaqItems = [
  { question: "대체공휴일도 자동으로 제외되나요?", answer: ["네. 공휴일과 대체공휴일 제외가 켜져 있으면 2025~2027년 공식 월력 데이터에 포함된 대체공휴일을 제외합니다."] },
  { question: "근로자의 날은 모든 회사가 쉬나요?", answer: ["업종과 근로관계에 따라 실제 근무 여부가 다를 수 있어 별도 설정으로 제공합니다. 회사 취업규칙을 함께 확인하세요."] },
  { question: "미래 임시공휴일도 반영되나요?", answer: ["정부가 공식 발표하고 데이터가 갱신된 날짜만 반영합니다. 아직 발표되지 않은 임시공휴일은 예측하지 않습니다."] },
  { question: "은행이나 법원의 영업일과 같나요?", answer: ["항상 같지는 않습니다. 은행·거래소·법원·행정기관은 별도 업무 규칙이 있을 수 있으므로 이 결과는 일반 일정 계산 참고용입니다."] },
];
export const businessDaysFaqSeoItems = businessDaysFaqItems.map((item) => ({ question: item.question, answer: item.answer.join(" ") }));
