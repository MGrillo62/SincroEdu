const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/app/dashboard/campuses/page.tsx',
  'frontend/src/app/dashboard/courses/page.tsx',
  'frontend/src/app/dashboard/page.tsx',
  'frontend/src/app/dashboard/professors/page.tsx',
  'frontend/src/app/dashboard/students/page.tsx'
];

const basePath = 'C:/Proyectos DEV/SincroEdu';

files.forEach(fileRelPath => {
  const filePath = path.join(basePath, fileRelPath);
  console.log(`Processing file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add getApiUrl import if not present
  if (!content.includes('getApiUrl')) {
    // Find the first line after 'use client'; to insert the import
    if (content.startsWith("'use client';")) {
      content = content.replace(
        "'use client';",
        "'use client';\n\nimport { getApiUrl } from '@/lib/config';"
      );
    } else {
      content = `import { getApiUrl } from '@/lib/config';\n${content}`;
    }
  }
  
  // 2. Replace http://localhost:4000/api with ${getApiUrl()}
  // Handle `http://localhost:4000/api
  const regex = /http:\/\/localhost:4000\/api/g;
  content = content.replace(regex, '${getApiUrl()}');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated: ${filePath}`);
});

console.log('API URL Replacements completed!');
