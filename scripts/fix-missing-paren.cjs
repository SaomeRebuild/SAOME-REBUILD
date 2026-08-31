// Add missing closing paren after each canonical regex literal
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const files = [
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.momentum.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.touch-drag.test.tsx',
  'apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.chain.test.tsx',
];

// Pattern: `(getByText(/拖曳調整顯示區域/i).toBeInTheDocument()` — missing the closing `)` for getByText.
const brokenPattern = /getByText\(\/拖曳調整顯示區域\/i\)\.toBeInTheDocument\(\)/g;
const fixed = 'getByText(/拖曳調整顯示區域/i)).toBeInTheDocument()';

let totalFixed = 0;
for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  let content = fs.readFileSync(abs, 'utf8');
  let original = content;
  content = content.replace(brokenPattern, fixed);
  if (content !== original) {
    fs.writeFileSync(abs, content, 'utf8');
    console.log('FIXED', rel);
    totalFixed++;
  } else {
    console.log('OK', rel);
  }
}
console.log(`\nTotal files fixed: ${totalFixed}`);