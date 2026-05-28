async function testUser(email, roleName, endpoint) {
  const API_URL = 'http://localhost:4000/api';
  console.log(`\n--- Probando Rol: ${roleName} (${email}) ---`);
  
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'sincro123' })
  });
  
  if (!loginRes.ok) {
    console.error(`Error en login para ${roleName}:`, await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  const tenantId = loginData.tenant.id;
  console.log(`Login exitoso! Tenant ID: ${tenantId}`);
  
  const dashRes = await fetch(`${API_URL}/tenants/${tenantId}/billing/dashboard/${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log(`Status ${endpoint}:`, dashRes.status);
  const text = await dashRes.text();
  try {
    const data = JSON.parse(text);
    console.log(`JSON recibido para ${roleName} (primeros 400 caractéres):`, JSON.stringify(data, null, 2).substring(0, 400));
  } catch (e) {
    console.error(`Error de parsing en ${roleName}:`, text);
  }
}

async function runAll() {
  await testUser('admin@colegiopremium.edu', 'Administrador', 'admin');
  await testUser('padre@colegiopremium.edu', 'Padre de Familia', 'parent');
  await testUser('profesor@colegiopremium.edu', 'Profesor', 'professor');
}

runAll();
