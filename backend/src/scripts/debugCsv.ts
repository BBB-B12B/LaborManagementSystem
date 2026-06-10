import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1LFkaZSMJDC548v5GyNxp_hJxaog6NOocwPbwMFEveDg/export?format=csv';

async function debugCsv() {
  console.log('Fetching CSV...');
  const response = await axios.get(SHEET_URL);
  const csvData = response.data;
  const lines = csvData.split('\n');

  console.log('--- Raw Headers (Line 0) ---');
  console.log(JSON.stringify(lines[0]));

  console.log('\n--- Parsed Headers ---');
  const headers = parseLine(lines[0]);
  headers.forEach((h, i) => console.log(`[${i}] "${h}"`));

  console.log('\n--- Searching for E.MJ.CON.020.020.003.0104 ---');
  const targetSerial = 'E.MJ.CON.020.020.003.0104';
  let found = false;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].includes(targetSerial)) {
      console.log(`Found at line ${i}:`);
      console.log(JSON.stringify(lines[i]));

      const values = parseLine(lines[i]);
      console.log('\n--- Mapped Values ---');
      headers.forEach((h, idx) => {
        // Simulate the cleaning logic used in importTools
        let cleanKey = h.trim();
        if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
          cleanKey = cleanKey.substring(1, cleanKey.length - 1);
        }
        console.log(`Key: "${cleanKey}" => Value: "${values[idx]}"`);
      });
      found = true;
      break;
    }
  }

  if (!found) console.log('Target serial not found in CSV.');
}

function parseLine(text: string) {
  // Same parser as importTools
  const res = [];
  let inQuote = false;
  let currentToken = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuote = !inQuote;
      currentToken += char;
    } else if (char === ',' && !inQuote) {
      res.push(currentToken);
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  res.push(currentToken);
  return res;
}

debugCsv();
