/**
 * 숫자 금액을 한글 표기로 변환 (예: 10000 → "일만 원정")
 * "일금" 접두사는 호출하는 쪽에서 붙여 사용 (예: "일금 일만 원정")
 */
const UNITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const TEN_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조'];

function convertGroup(num: number): string {
  if (num === 0) return '';
  const str = String(num);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const digit = parseInt(str[i], 10);
    const place = str.length - 1 - i;
    if (digit === 0) continue;
    if (digit === 1 && place > 0) {
      result += TEN_UNITS[place];
    } else {
      result += UNITS[digit] + TEN_UNITS[place];
    }
  }
  return result;
}

/**
 * 금액(숫자)을 한글 표기로 변환
 * @param amount 숫자 금액 (예: 10000)
 * @returns "일금 일만 원정" 형식 (0원이면 "일금 영 원정")
 */
export function numberToKorean(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '일금 영 원정';
  const n = Math.floor(amount);
  if (n === 0) return '일금 영 원정';

  const man = Math.floor(n / 10000);
  const remainder = n % 10000;
  let result = '일금 ';
  if (man > 0) {
    result += convertGroup(man) + '만';
    if (remainder > 0) result += convertGroup(remainder);
  } else {
    result += convertGroup(remainder);
  }
  result += ' 원정';
  return result;
}
