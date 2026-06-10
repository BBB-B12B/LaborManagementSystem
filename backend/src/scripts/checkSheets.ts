import axios from 'axios';

const SHEET_ID = '1LFkaZSMJDC548v5GyNxp_hJxaog6NOocwPbwMFEveDg';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

async function checkSheets() {
  try {
    console.log(`Fetching ${URL}...`);
    const response = await axios.get(URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    const html = response.data;

    // Regex to find GIDs
    // Google Sheets usually embeds data like: [...,"SheetName",...,gid,...]
    // This is tricky but let's look for "Tools Master" and see what numbers are near it.
    // Or look for `gid"` or `docs-sheet-tab-caption`?

    // Pattern: [null,null,"SheetName",null,null,null,null,null,null,null,null,gid]
    // Or similar.

    console.log('Searching for sheet info (HTML Context)...');

    // Find "Tools Master"
    const indexMaster = html.indexOf('Tools Master');
    if (indexMaster !== -1) {
      console.log(`Found 'Tools Master' at index ${indexMaster}`);
      // Look before it for the ID
      console.log(html.substring(indexMaster - 400, indexMaster + 100));
    }

    // Find "Summary"
    const indexSummary = html.indexOf('Summary');
    if (indexSummary !== -1) {
      console.log(`Found 'Summary' at index ${indexSummary}`);
      console.log(html.substring(indexSummary - 400, indexSummary + 100));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

checkSheets();
