const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'dc-labor-data-template.csv'),
  path.join(__dirname, 'frontend/public/dc-labor-data-template.csv')
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f);
    // Check if the file already has a UTF-8 BOM
    if (content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
      console.log('✅ ' + f + ' already has BOM');
      return;
    }
    // Add UTF-8 BOM (Byte Order Mark) to the beginning
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    fs.writeFileSync(f, Buffer.concat([bom, content]));
    console.log('✅ Added BOM to ' + f);
  } else {
    console.log('❌ File not found: ' + f);
  }
});
