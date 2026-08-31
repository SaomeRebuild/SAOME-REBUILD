// Bulk-fix PowerShell encoding damage in test files
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const files = [
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.momentum.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.touch-drag.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.chain.test.tsx',
];

// PowerShell -replace mangled the regex literal `/拖曳調整顯示區域/i`.
// Signature: any regex literal of the form `(?…??i)` is replaced with the
// canonical "/拖曳調整顯示區域/i" form. We use a regex to find/replace the
// garbage pattern.
const corruptedPattern = /\(\/\?[^)]*\?\?i\)\)/g;
const canonicalRegex = '(/拖曳調整顯示區域/i)';

let totalFixed = 0;
for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) { console.log('MISSING', rel); continue; }
  let content = fs.readFileSync(abs, 'utf8');
  let original = content;
  content = content.replace(corruptedPattern, canonicalRegex);
  if (content !== original) {
    fs.writeFileSync(abs, content, 'utf8');
    console.log('FIXED', rel);
    totalFixed++;
  } else {
    console.log('OK', rel);
  }
}
console.log(`\nTotal files fixed: ${totalFixed}`);