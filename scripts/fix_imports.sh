#!/bin/bash
# Fix deep relative imports to use @types/* alias

cd "$(dirname "$0")/../frontend/src"

echo "Fixing imports in frontend/src..."

# Find all .ts and .tsx files and replace deep relative imports
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e "s|from ['\"]\.\.\/\.\.\/types\/|from '@types/|g" \
  -e "s|from ['\"]\.\.\/\.\.\/\.\.\/types\/|from '@types/|g" \
  -e "s|import type .* from ['\"]\.\.\/\.\.\/types\/|import type { } from '@types/|g" \
  -e "s|import type .* from ['\"]\.\.\/\.\.\/\.\.\/types\/|import type { } from '@types/|g" \
  {} \;

echo "✅ Import fixes complete"
echo "   Files processed: $(find . -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l)"
