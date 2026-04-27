const str = '20/ก.ย./2025,นายMIN AUNG NAING,08:00 - 17:00,"เก็บงาน  DF บ้านก่อนโอนแปลง A11, B2",6507 : Artale Asoke Rama9,,,,,,,2.00,"เก็บงาน  DF บ้านก่อนโอนแปลง A11, B2",6507 : Artale Asoke Rama9,100525,403615,,8,,,,,,,,,';
const result = [];
let current = '';
let inQuotes = false;
for (let i = 0; i < str.length; i++) {
  const char = str[i];
  if (char === '"') {
    inQuotes = !inQuotes;
  } else if (char === ',' && !inQuotes) {
    result.push(current.trim());
    current = '';
  } else {
    current += char;
  }
}
result.push(current.trim());
console.log('Index 15 =', result[15]);
console.dir(result);
