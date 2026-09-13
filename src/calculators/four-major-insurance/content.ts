export const fourMajorInsuranceFaqItems = [
  { question: "비과세 금액은 무엇인가요?", answer: ["월 급여 중 사회보험 산정 보수에서 제외되는 식대 등 금액을 뜻합니다. 세법상 비과세와 사회보험 제외 보수는 완전히 같지 않을 수 있어 실제 신고액과 차이가 날 수 있습니다."] },
  { question: "왜 실제 급여명세서와 금액이 다른가요?", answer: ["공단에 신고된 기준소득월액·보수월액, 전년도 정산, 입퇴사 시점, 휴직, 보험료 지원에 따라 실제 고지액이 달라질 수 있습니다."] },
  { question: "산재보험료는 왜 계산하지 않나요?", answer: ["산재보험은 사업주가 전액 부담하고 업종별 요율이 다릅니다. 평균요율을 개별 사업장에 적용하면 부정확하므로 v1 합계에서는 제외합니다."] },
  { question: "공제 후 금액이 실제 실수령액인가요?", answer: ["아닙니다. 소득세와 지방소득세를 제외하지 않은 4대 보험 공제 후 금액입니다."] },
] as const;

export const fourMajorInsuranceFaqSeoItems = fourMajorInsuranceFaqItems.map((item) => ({
  question: item.question,
  answer: item.answer.join(" "),
}));
