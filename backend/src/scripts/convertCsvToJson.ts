import * as path from 'path';
import * as fs from 'fs';

// Helper to parse CSV (same robust logic as before)
function parseCSV(content: string): any[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const row: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim());

    const obj: any = {};
    headers.forEach((h, index) => {
      let val = row[index];
      if (val && val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[h] = val;
    });

    // Only push if valid row (has at least some data)
    if (Object.keys(obj).length > 0) {
      data.push(obj);
    }
  }
  return data;
}

async function convertAndSave() {
  try {
    const rootDir = path.resolve(__dirname, '../../../');
    const outputDir = path.resolve(__dirname, '../../../frontend/src/data');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const result: any = {
      projects: [],
      summaryLog: [],
      fullLogs: [], // Added Full Logs
      planning: [],
      generatedAt: new Date().toISOString(),
    };

    // 1. Data Project
    const projectFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Project.csv');
    if (fs.existsSync(projectFile)) {
      console.log('Parsing Data Project...');
      result.projects = parseCSV(fs.readFileSync(projectFile, 'utf-8'));
    }

    // 2. Summary Data log
    const summaryFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Summary Data log.csv');
    if (fs.existsSync(summaryFile)) {
      console.log('Parsing Summary Data log...');
      result.summaryLog = parseCSV(fs.readFileSync(summaryFile, 'utf-8'));
    }

    // 2.1 Full Data log (New Requirement)
    const fullLogFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data log.csv');
    if (fs.existsSync(fullLogFile)) {
      console.log('Parsing Full Data log...');
      result.fullLogs = parseCSV(fs.readFileSync(fullLogFile, 'utf-8'));
    }

    // 3. Data Planning
    const planningFile = path.join(rootDir, 'ระบบบันทึกจำนวนเเรงงาน - Data Planning.csv');
    if (fs.existsSync(planningFile)) {
      console.log('Parsing Data Planning...');
      result.planning = parseCSV(fs.readFileSync(planningFile, 'utf-8'));
    }

    const outputPath = path.join(outputDir, 'wage_import_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Successfully saved JSON data to: ${outputPath}`);
    console.log(`Stats:`);
    console.log(`- Projects: ${result.projects.length}`);
    console.log(`- Summary Logs: ${result.summaryLog.length}`);
    console.log(`- Planning: ${result.planning.length}`);
  } catch (error) {
    console.error('Conversion Failed:', error);
    process.exit(1);
  }
}

convertAndSave();
