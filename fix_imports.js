const fs = require('fs');
const files = [
  'frontend/src/pages/daily-reports/daily_report_ui_aftersale_reference.tsx',
  'frontend/src/pages/daily-reports/index.tsx',
  'frontend/src/pages/daily-reports/list.tsx',
  'frontend/src/pages/daily-reports/new.tsx',
  'frontend/src/pages/workspace/components/TaskDailyReportModal.tsx'
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // Replace `{ th as thLocale }` with default import `thLocale`
    content = content.replace(/import\s+\{\s*th\s+as\s+thLocale\s*\}\s+from\s+'date-fns\/locale\/th';/g, "import thLocale from 'date-fns/locale/th';");
    // Replace `{ th }` with default import `th`
    content = content.replace(/import\s+\{\s*th\s*\}\s+from\s+'date-fns\/locale\/th';/g, "import th from 'date-fns/locale/th';");
    
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  } else {
    console.log('File not found', f);
  }
});
