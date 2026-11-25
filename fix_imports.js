#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, 'src');

// Get all JS/JSX files in src/ (flat)
const files = fs.readdirSync(srcRoot).filter(f => /\.(js|jsx|ts|tsx|css)$/.test(f));

let totalFixed = 0;
let totalIssues = 0;

for (const file of files) {
  const filePath = path.join(srcRoot, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace any quoted relative path that has more than one segment:
  // '../services/activityService' -> './activityService'
  // '../../context/AuthContext'   -> './AuthContext'
  // '../components/features/VoiceAssistantModal' -> './VoiceAssistantModal'
  // './subdir/something'          -> './something'
  // But NOT: 'react-dom/client' (no leading dot)
  // And NOT: './ActualFile' (already flat)

  content = content.replace(
    /(['"`])(\.\.?\/(?:[^'"`/]+\/)+)([^'"`/]+)(['"`])/g,
    (match, q1, _dirs, basename, q2) => {
      return `${q1}./${basename}${q2}`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Fixed: ${file}`);
    totalFixed++;
  }
}

console.log(`\nTotal files fixed: ${totalFixed}`);

// Verification
console.log('\n=== Verification ===');
let broken = 0;
for (const file of fs.readdirSync(srcRoot).filter(f => /\.(js|jsx)$/.test(f))) {
  const content = fs.readFileSync(path.join(srcRoot, file), 'utf8');
  const matches = content.match(/['"`](\.\.?\/(?:[^'"`/]+\/)+[^'"`/]+)['"`]/g);
  if (matches) {
    console.log(`  BROKEN in ${file}: ${matches.join(', ')}`);
    broken += matches.length;
  }
}
if (broken === 0) {
  console.log('All imports are clean! No multi-segment relative paths remaining.');
} else {
  console.log(`${broken} broken imports remain.`);
}
