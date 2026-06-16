const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('frontend/src');

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;

  // Fix Adapter
  content = content.replace(/AdapterDateFnsV2/g, "AdapterDateFns");

  // Fix locale imports
  content = content.replace(/import\s+th\s+from\s+'date-fns\/locale\/th';/g, "import { th } from 'date-fns/locale';");
  content = content.replace(/import\s+thLocale\s+from\s+'date-fns\/locale\/th';/g, "import { th as thLocale } from 'date-fns/locale';");
  
  if (content !== original) {
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
  }
});
