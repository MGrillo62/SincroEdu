async function test() {
  const API_URL = 'http://localhost:4000/api';
  
  console.log('1. Intentando iniciar sesión...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@colegiopremium.edu', password: 'sincro123' })
  });
  
  if (!loginRes.ok) {
    console.error('Error en login:', await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  const tenantId = loginData.tenant.id;
  console.log('Login exitoso! Token obtenido. Tenant ID del usuario:', tenantId);
  
  console.log('\n2. Solicitando dashboard/admin...');
  const dashRes = await fetch(`${API_URL}/tenants/${tenantId}/billing/dashboard/admin`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Status dashboard/admin:', dashRes.status);
  const dashText = await dashRes.text();
  console.log('Respuesta:', dashText);
}

test();
