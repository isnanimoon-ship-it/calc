export const ageCalculatorFaqItems=[
  {question:"만 나이는 어떻게 계산하나요?",answer:["출생일에는 0세로 시작하고 생일이 지날 때마다 1세가 증가합니다. 기준연도에서 출생연도를 뺀 뒤, 그해 생일 전이면 1을 더 빼면 됩니다."]},
  {question:"세는나이와 연 나이는 무엇이 다른가요?",answer:["세는나이는 태어난 해를 1살로 시작해 새해마다 증가하는 과거 한국식 나이이고, 연 나이는 기준연도에서 출생연도를 뺀 값입니다. 별도 규정이 없을 때 법적·행정적 기본은 만 나이입니다."]},
  {question:"2월 29일생은 평년에 언제 나이가 바뀌나요?",answer:["민법의 역에 의한 계산 원칙에 따라 같은 날짜가 없는 평년에는 2월 말일인 2월 28일을 대응 생일로 계산합니다."]},
  {question:"띠는 왜 양력 1월 1일에 바뀌지 않나요?",answer:["생활문화에서 사용하는 띠는 음력 설날을 경계로 계산합니다. 따라서 설날 전 출생자는 양력연도가 같더라도 직전 음력년의 띠가 됩니다."]},
  {question:"황금 개띠의 황금은 금 오행인가요?",answer:["아닙니다. 황금은 토(土)에 대응하는 황색 계열을 친숙하게 표현한 별칭입니다. 금(金) 오행은 흰색 계열로 표시합니다."]},
] as const;
export const ageCalculatorFaqSeoItems=ageCalculatorFaqItems.map((item)=>({question:item.question,answer:item.answer.join(" ")}));
