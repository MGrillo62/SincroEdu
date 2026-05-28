const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/src/db.ts');
const content = fs.readFileSync(dbPath, 'utf8');

const lines = content.split('\n');
console.log('--- LÍNEAS 280 A 360 ---');
for (let i = 280; i <= 360; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i}: ${lines[i]}`);
  }
}
