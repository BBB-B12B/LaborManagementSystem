const fs = require('fs');
const path = require('path');

const files = [
  'backend_logs.txt',
  'backend_logs_2.txt',
  'backend_logs_3.txt',
  'temp_logs.txt'
];

files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Checking ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('DBD-0002-03-0002')) {
        console.log(`  [${index + 1}]: ${line}`);
      }
    });
  } else {
    console.log(`${filePath} does not exist.`);
  }
});
