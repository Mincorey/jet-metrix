const fs = require('fs');

let code = fs.readFileSync('api/[...path].ts', 'utf8');

const importRegex = /import handler_(\d+) from '(\.\.\/server\/routes\/[^']+)';/g;
const imports = {};
let match;
while ((match = importRegex.exec(code)) !== null) {
  imports[match[1]] = match[2];
}

// Remove static imports
code = code.replace(/import handler_\d+ from '\.\.\/server\/routes\/[^']+';\n/g, '');

// Replace `await handler_X(req, res)` with `(await import('Y')).default(req, res)`
code = code.replace(/await handler_(\d+)\(req, res\)/g, (fullMatch, id) => {
  return `(await import('${imports[id]}')).default(req, res)`;
});

fs.writeFileSync('api/[...path].ts', code);
console.log('Dynamic imports applied successfully.');