const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testAPIUserStateChange() {
  try {
    console.log('🔐 HACIENDO LOGIN COMO ADMIN...\n');

    // Login como admin
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      correo: 'admin@admin.com',
      contrasena: 'admin123'
    });

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.data}`);
    }

    const token = loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido\n');

    // Verificar estado actual del usuario
    console.log('📊 VERIFICANDO ESTADO ACTUAL DEL USUARIO...\n');

    const userResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/usuarios',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const users = userResponse.data;
    const user = users.find(u => u.id === 13);
    if (user) {
      console.log(`👤 Usuario ID 13:`);
      console.log(`   Nombre: ${user.nombre}`);
      console.log(`   Estado: ${user.estado}`);
      console.log(`   Activo: ${user.activo}\n`);
    }

    // Cambiar estado a activo
    console.log('🔄 CAMBIANDO ESTADO A ACTIVO...\n');

    const updateResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/usuarios/13/estado',
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, { estado: 'activo' });

    console.log('✅ Respuesta del servidor:');
    console.log(updateResponse.data);
    console.log();

    // Verificar estado final
    console.log('📊 VERIFICANDO ESTADO FINAL...\n');

    const finalUserResponse = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/usuarios',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const finalUsers = finalUserResponse.data;
    const finalUser = finalUsers.find(u => u.id === 13);
    if (finalUser) {
      console.log(`🎯 ESTADO FINAL:`);
      console.log(`   Nombre: ${finalUser.nombre}`);
      console.log(`   Estado: ${finalUser.estado}`);
      console.log(`   Activo: ${finalUser.activo}`);
      console.log(`   ¿Cambio exitoso?: ${finalUser.estado === 'activo' && finalUser.activo === true ? 'SÍ ✅' : 'NO ❌'}`);
    }

  } catch (error) {
    console.error('❌ Error en la prueba API:', error.message);
  }
}

testAPIUserStateChange();