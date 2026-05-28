const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/src/db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

const targetStr = "const defaultPasswordHash = bcrypt.hashSync('sincro123', salt);";

const replacementStr = "  });\n" +
  "});\n\n" +
  "// 4. Auxiliar de Tenant 1 tiene acceso intermedio\n" +
  "const auxVisibleMenus = ['m-1', 'm-config', 'm-2', 'm-4', 'm-5', 'm-9', 'm-10'];\n" +
  "menuOptions.forEach(menu => {\n" +
  "  const isAllowed = auxVisibleMenus.includes(menu.id);\n" +
  "  roleMenuPermissions.push({\n" +
  "    id: 'p-t1ax-' + menu.id,\n" +
  "    roleId: 'r-tenant1-auxiliar',\n" +
  "    menuOptionId: menu.id,\n" +
  "    canView: isAllowed,\n" +
  "    canCreate: isAllowed && ['m-5', 'm-9', 'm-10'].includes(menu.id),\n" +
  "    canEdit: isAllowed && ['m-5', 'm-9', 'm-10'].includes(menu.id),\n" +
  "    canDelete: false\n" +
  "  });\n" +
  "});\n\n" +
  "// 5. Padre de Familia de Tenant 1 tiene acceso al Dashboard y al módulo de Pagos\n" +
  "const parentVisibleMenus = ['m-1', 'm-7'];\n" +
  "menuOptions.forEach(menu => {\n" +
  "  const isAllowed = parentVisibleMenus.includes(menu.id);\n" +
  "  roleMenuPermissions.push({\n" +
  "    id: 'p-t1pr-' + menu.id,\n" +
  "    roleId: 'r-tenant1-parent',\n" +
  "    menuOptionId: menu.id,\n" +
  "    canView: isAllowed,\n" +
  "    canCreate: false,\n" +
  "    canEdit: false,\n" +
  "    canDelete: false\n" +
  "  });\n" +
  "});\n\n" +
  "const salt = bcrypt.genSaltSync(10);\n" +
  "const defaultPasswordHash = bcrypt.hashSync('sincro123', salt);";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(dbPath, content, 'utf8');
  console.log('✅ Permisos, salt y loops insertados correctamente en db.ts.');
} else {
  console.error('❌ No se encontró la cadena de destino en db.ts.');
}
