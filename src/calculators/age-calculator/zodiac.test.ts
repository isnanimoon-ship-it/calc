import {describe,expect,it} from "vitest";
import {calculateZodiac} from "./zodiac";
describe("음력 설날 기준 띠",()=>{
  it("2018 설 전은 붉은 닭띠",()=>expect(calculateZodiac("2018-02-15")).toMatchObject({lunarYear:2017,displayName:"붉은 닭띠",ganzhiKorean:"정유년"}));
  it("2018 설부터 황금 개띠",()=>expect(calculateZodiac("2018-02-16")).toMatchObject({lunarYear:2018,displayName:"황금 개띠",ganzhiKorean:"무술년",element:"토"}));
  it("2013 계사년은 검은 뱀띠",()=>expect(calculateZodiac("2013-02-10")).toMatchObject({displayName:"검은 뱀띠",ganzhiChinese:"癸巳年"}));
  it("2025 설 전후 경계",()=>{expect(calculateZodiac("2025-01-28")?.displayName).toBe("푸른 용띠");expect(calculateZodiac("2025-01-29")?.displayName).toBe("푸른 뱀띠");});
  it("지원 범위 밖은 추정하지 않음",()=>expect(calculateZodiac("2051-01-01")).toBeNull());
});
