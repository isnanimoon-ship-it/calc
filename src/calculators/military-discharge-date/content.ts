export const militaryDischargeFaqItems = [
  { question: "계산된 전역일이 실제 전역일과 다른 이유는 무엇인가요?", answer: ["이 계산기는 표준 의무복무기간만 적용합니다. 복무 제외일, 연장·중단, 편입 전환, 조기전역과 실제 인사명령이 있으면 달라질 수 있습니다."] },
  { question: "휴가를 사용하면 전역일이 빨라지나요?", answer: ["일반적인 휴가는 복무기간에 포함되므로 휴가일수만큼 전역일이 앞당겨지지 않습니다."] },
  { question: "진급일은 정확한 날짜인가요?", answer: ["아닙니다. 법령상 계급별 진급 최저복무기간으로 계산한 진급 가능 기준일입니다. 실제 진급은 심사, 매월 1일 발령, 진급 제한 등에 따라 달라질 수 있습니다."] },
  { question: "전역일 당일은 D-Day인가요?", answer: ["네. 이 계산기는 전역일 당일을 D-Day(D-0), 다음 날부터 D+1로 표시합니다."] },
];
export const militaryDischargeFaqSeoItems = militaryDischargeFaqItems.map((item) => ({ question: item.question, answer: item.answer.join(" ") }));
