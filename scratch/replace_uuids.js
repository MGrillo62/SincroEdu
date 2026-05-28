const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/src/db.ts');

console.log('Leyendo backend/src/db.ts...');
let content = fs.readFileSync(dbPath, 'utf8');

const t1Old = 't-11111111-1111-1111-1111-111111111111';
const t1New = '44b7fa71-5582-45a8-b6cb-918991ef2364';

const t2Old = 't-22222222-2222-2222-2222-222222222222';
const t2New = 'bb820465-b778-43d9-a723-f390035cb3c8';

console.log('Reemplazando UUIDs del Tenant 1...');
let count1 = 0;
while (content.includes(t1Old)) {
  content = content.replace(t1Old, t1New);
  count1++;
}

console.log(`Reemplazados ${count1} ocurrencias del Tenant 1.`);

console.log('Reemplazando UUIDs del Tenant 2...');
let count2 = 0;
while (content.includes(t2Old)) {
  content = content.replace(t2Old, t2New);
  count2++;
}

console.log(`Reemplazados ${count2} ocurrencias del Tenant 2.`);

fs.writeFileSync(dbPath, content, 'utf8');
console.log('backend/src/db.ts actualizado con éxito.');
