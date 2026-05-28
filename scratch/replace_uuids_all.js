const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  path.join(__dirname, '../backend/src/index.ts'),
  path.join(__dirname, '../frontend/src/app/dashboard/campuses/page.tsx'),
  path.join(__dirname, '../frontend/src/app/dashboard/courses/page.tsx'),
  path.join(__dirname, '../frontend/src/app/dashboard/professors/page.tsx'),
  path.join(__dirname, '../frontend/src/app/dashboard/students/page.tsx')
];

const t1Old = 't-11111111-1111-1111-1111-111111111111';
const t1New = '44b7fa71-5582-45a8-b6cb-918991ef2364';

filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Leyendo ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let count = 0;
    while (content.includes(t1Old)) {
      content = content.replace(t1Old, t1New);
      count++;
    }
    
    if (count > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Actualizado ${filePath}: ${count} reemplazos hechos.`);
    } else {
      console.log(`ℹ️ ${filePath} no contenía ocurrencias.`);
    }
  } else {
    console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
  }
});

console.log('Sincronización global completada.');
