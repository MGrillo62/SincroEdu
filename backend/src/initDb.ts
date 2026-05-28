import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = 'postgresql://neondb_owner:npg_CqBjkLZJ46mu@ep-late-sun-aqcydx0h-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function initDatabase() {
  console.log('=====================================================================');
  console.log('🚀 SINCROEDU - INICIANDO DESPLIEGUE DE BASE DE DATOS EN NEON');
  console.log('=====================================================================');

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('✅ Conexión establecida con éxito con el clúster de Neon.');

    // 1. LIMPIAR TABLAS EXISTENTES POR SEGURIDAD (Orden inverso de dependencias)
    console.log('\n🧹 Limpiando tablas previas si existen...');
    await client.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS campuses CASCADE;
      DROP TABLE IF EXISTS professors CASCADE;
      DROP TABLE IF EXISTS courses CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS role_menu_permissions CASCADE;
      DROP TABLE IF EXISTS roles CASCADE;
      DROP TABLE IF EXISTS menu_options CASCADE;
      DROP TABLE IF EXISTS tenants CASCADE;
    `);
    console.log('✅ Tablas previas eliminadas con éxito.');

    // 2. CREACIÓN DE TABLAS MULTI-TENANT E HISTORIAL
    console.log('\n🏛️ Creando esquema de tablas multi-tenant en PostgreSQL...');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- 1. TENANTS (INSTITUCIONES)
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        subdomain VARCHAR(100) UNIQUE NOT NULL,
        logo_url TEXT,
        primary_color VARCHAR(10) DEFAULT '#6B8E4E',
        secondary_color VARCHAR(10) DEFAULT '#1C2C35',
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. MENÚS Y OPCIONES DE NAVEGACIÓN
      CREATE TABLE menu_options (
        id VARCHAR(50) PRIMARY KEY,
        parent_id VARCHAR(50) REFERENCES menu_options(id) ON DELETE SET NULL,
        title VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        route VARCHAR(255),
        sort_order INT DEFAULT 0,
        module VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 3. ROLES (MULTI-TENANT)
      CREATE TABLE roles (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, name)
      );

      -- 4. MATRIZ DE PERMISOS DE MENÚ
      CREATE TABLE role_menu_permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
        menu_option_id VARCHAR(50) REFERENCES menu_options(id) ON DELETE CASCADE,
        can_view BOOLEAN DEFAULT TRUE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (role_id, menu_option_id)
      );

      -- 5. USUARIOS (MULTI-TENANT)
      CREATE TABLE users (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        role_id VARCHAR(50) REFERENCES roles(id) ON DELETE SET NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_users_tenant ON users(tenant_id);

      -- 6. CATÁLOGO DE CURSOS Y OFERTA (CON HISTORIAL Y ESTADO)
      CREATE TABLE courses (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        credits INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, code)
      );

      CREATE INDEX idx_courses_tenant ON courses(tenant_id);

      -- 7. INFRAESTRUCTURA DE SEDES Y AULAS
      CREATE TABLE campuses (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('physical', 'virtual')),
        capacity INT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'closed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_campuses_tenant ON campuses(tenant_id);

      -- 8. GESTIÓN DE FACULTAD / DOCENTES
      CREATE TABLE professors (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id VARCHAR(50) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        specialty VARCHAR(255) NOT NULL,
        hire_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'license', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_professors_tenant ON professors(tenant_id);

      -- 9. TRAZABILIDAD Y BITÁCORA DE AUDITORÍA GENERAL
      CREATE TABLE audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        table_name VARCHAR(100) NOT NULL,
        record_id VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        changed_by VARCHAR(255) NOT NULL,
        previous_values JSONB,
        new_values JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
    `);
    console.log('✅ Esquema de base de datos multi-tenant creado exitosamente.');

    // 3. POBLACIÓN DE SEMILLAS (SEED DATA)
    console.log('\n🌱 Poblando base de datos con registros de prueba...');

    // A. Insertar Tenants
    const tenant1Id = '44b7fa71-5582-45a8-b6cb-918991ef2364'; // Fijo para consistencia
    const tenant2Id = 'bb820465-b778-43d9-a723-f390035cb3c8';
    
    await client.query(`
      INSERT INTO tenants (id, name, subdomain, logo_url, primary_color, secondary_color, status) VALUES
      ('${tenant1Id}', 'SincroEdu Premium College', 'sincroedu-college', '/brand/logo.png', '#6B8E4E', '#1C2C35', 'active'),
      ('${tenant2Id}', 'Instituto de Ciencias Innovación', 'ciencias-innovacion', NULL, '#2B6CB0', '#1A202C', 'active');
    `);
    console.log(' - Tenants insertados.');

    // B. Insertar Opciones de Menú
    await client.query(`
      INSERT INTO menu_options (id, parent_id, title, icon, route, sort_order, module, is_active) VALUES
      ('m-1', NULL, 'KPIs', 'LayoutDashboard', '/dashboard', 1, 'dashboard', TRUE),
      ('m-2', NULL, 'Catálogo de Cursos y Oferta', 'BookOpen', '/dashboard/courses', 2, 'cursos', TRUE),
      ('m-3', NULL, 'Gestión de Facultad (Profesores)', 'Users', '/dashboard/professors', 3, 'facultad', TRUE),
      ('m-4', NULL, 'Sedes', 'MapPin', '/dashboard/campuses', 4, 'sedes', TRUE),
      ('m-5', NULL, 'Alumnos', 'FileText', '/dashboard/students', 5, 'matriculas', TRUE),
      ('m-6', NULL, 'Calificaciones Académicas', 'Award', '/dashboard/grades', 6, 'calificaciones', TRUE),
      ('m-7', NULL, 'Pagos y cobros', 'CreditCard', '/dashboard/payments', 7, 'pagos', TRUE),
      ('m-8', NULL, 'Programación predictiva', 'CalendarDays', '/dashboard/predictive', 8, 'predicciones', TRUE),
      ('m-9', NULL, 'Centro de Comunicación', 'MessageSquare', '/dashboard/comms', 9, 'comunicaciones', TRUE),
      ('m-10', NULL, 'CRM y Leads', 'Target', '/dashboard/crm', 10, 'crm', TRUE),
      ('m-11', NULL, 'Herramientas Administrativas', 'ShieldAlert', '/dashboard/admin', 11, 'administracion', TRUE);
    `);
    console.log(' - Módulos del menú insertados.');

    // C. Insertar Roles
    await client.query(`
      INSERT INTO roles (id, tenant_id, name, description, is_system_role) VALUES
      ('r-superadmin', NULL, 'Superadmin', 'Administrador global del ecosistema SincroEdu.', TRUE),
      ('r-tenant1-admin', '${tenant1Id}', 'Admin', 'Administrador general del Tenant.', TRUE),
      ('r-tenant1-professor', '${tenant1Id}', 'Profesor', 'Personal docente con acceso a notas y cursos.', FALSE),
      ('r-tenant1-auxiliar', '${tenant1Id}', 'Auxiliar', 'Personal administrativo de apoyo.', FALSE);
    `);
    console.log(' - Roles base y dinámicos insertados.');

    // D. Insertar Permisos de Menú
    const menuIds = ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6', 'm-7', 'm-8', 'm-9', 'm-10', 'm-11'];
    
    // Superadmin permisos
    for (const mId of menuIds) {
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-superadmin', '${mId}', TRUE, TRUE, TRUE, TRUE);
      `);
    }

    // Admin Tenant 1 permisos
    for (const mId of menuIds) {
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-tenant1-admin', '${mId}', TRUE, TRUE, TRUE, TRUE);
      `);
    }

    // Profesor Tenant 1 permisos (restringido)
    const profMenus = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-9'];
    for (const mId of menuIds) {
      const isAllowed = profMenus.includes(mId);
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-tenant1-professor', '${mId}', ${isAllowed}, ${isAllowed && ['m-6', 'm-9'].includes(mId)}, ${isAllowed && ['m-6', 'm-9'].includes(mId)}, FALSE);
      `);
    }

    // Auxiliar Tenant 1 permisos
    const auxMenus = ['m-1', 'm-2', 'm-4', 'm-5', 'm-9', 'm-10'];
    for (const mId of menuIds) {
      const isAllowed = auxMenus.includes(mId);
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-tenant1-auxiliar', '${mId}', ${isAllowed}, ${isAllowed && ['m-5', 'm-9', 'm-10'].includes(mId)}, ${isAllowed && ['m-5', 'm-9', 'm-10'].includes(mId)}, FALSE);
      `);
    }
    console.log(' - Matriz de permisos dinámicos poblada.');

    // E. Insertar Usuarios
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('sincro123', salt);

    await client.query(`
      INSERT INTO users (id, tenant_id, role_id, email, password_hash, first_name, last_name, phone, avatar_url, is_active) VALUES
      ('u-superadmin', NULL, 'r-superadmin', 'superadmin@sincroedu.com', '${passwordHash}', 'Santiago', 'Delgado', '+51 987 654 321', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', TRUE),
      ('u-t1admin', '${tenant1Id}', 'r-tenant1-admin', 'admin@colegiopremium.edu', '${passwordHash}', 'Patricia', 'Ruiz', '+51 999 888 777', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', TRUE),
      ('u-t1professor', '${tenant1Id}', 'r-tenant1-professor', 'profesor@colegiopremium.edu', '${passwordHash}', 'Mateo', 'Silva', '+51 955 444 333', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', TRUE),
      ('u-t1auxiliar', '${tenant1Id}', 'r-tenant1-auxiliar', 'auxiliar@colegiopremium.edu', '${passwordHash}', 'Laura', 'Vegas', '+51 911 222 333', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', TRUE);
    `);
    console.log(' - Usuarios base Multi-Tenant insertados.');

    // F. Insertar Cursos
    await client.query(`
      INSERT INTO courses (id, tenant_id, code, name, description, credits, status) VALUES
      ('c-1', '${tenant1Id}', 'MAT-101', 'Álgebra y Trigonometría Avanzada', 'Curso fundamental de análisis algebraico, funciones complejas y modelos trigonométricos para ciencias aplicadas.', 5, 'active'),
      ('c-2', '${tenant1Id}', 'LIT-204', 'Literatura Hispanoamericana del Siglo XX', 'Estudio crítico de las obras cumbre del boom latinoamericano, análisis lírico y evolución literaria continental.', 4, 'active'),
      ('c-3', '${tenant1Id}', 'TEC-302', 'Programación y Robótica Escolar Integrada', 'Taller práctico introductorio a microcontroladores, lógica computacional básica utilizando Python y diseño electromecánico.', 3, 'draft');
    `);
    console.log(' - Cursos semilla insertados.');

    // G. Insertar Sedes (Campuses)
    await client.query(`
      INSERT INTO campuses (id, tenant_id, name, address, type, capacity, status) VALUES
      ('cp-1', '${tenant1Id}', 'Sede Central San Isidro', 'Av. Aurelio Miró Quesada 450, San Isidro', 'physical', 650, 'active'),
      ('cp-2', '${tenant1Id}', 'Laboratorio de Innovación y Robótica Sur', 'Calle Monterrey 340, Surco', 'physical', 120, 'maintenance'),
      ('cp-3', '${tenant1Id}', 'Campus Virtual Integrado SincroEdu', 'https://campus.sincroedu.edu.pe', 'virtual', 5000, 'active');
    `);
    console.log(' - Sedes de estudio insertadas.');

    // H. Insertar Facultad (Profesores)
    await client.query(`
      INSERT INTO professors (id, tenant_id, user_id, specialty, hire_date, status) VALUES
      ('p-1', '${tenant1Id}', 'u-t1professor', 'Matemáticas y Ciencias Aplicadas', '2024-03-01', 'active');
    `);
    console.log(' - Facultad de profesores insertada.');

    // I. Insertar Logs de Auditoría semilla
    await client.query(`
      INSERT INTO audit_logs (id, tenant_id, table_name, record_id, action, changed_by, previous_values, new_values) VALUES
      ('al-1', '${tenant1Id}', 'courses', 'c-1', 'CREATE', 'admin@colegiopremium.edu', NULL, '{"code": "MAT-101", "name": "Álgebra y Trigonometría Avanzada", "credits": 5, "status": "active"}'),
      ('al-2', '${tenant1Id}', 'courses', 'c-2', 'CREATE', 'admin@colegiopremium.edu', NULL, '{"code": "LIT-204", "name": "Literatura Hispanoamericana", "credits": 4, "status": "draft"}'),
      ('al-3', '${tenant1Id}', 'courses', 'c-2', 'STATUS_CHANGE', 'admin@colegiopremium.edu', '{"status": "draft"}', '{"status": "active"}'),
      ('al-4', '${tenant1Id}', 'professors', 'p-1', 'CREATE', 'admin@colegiopremium.edu', NULL, '{"userId": "u-t1professor", "specialty": "Matemáticas y Ciencias", "status": "active", "hireDate": "2024-03-01"}'),
      ('al-5', '${tenant1Id}', 'professors', 'p-1', 'UPDATE', 'superadmin@sincroedu.com', '{"specialty": "Matemáticas y Ciencias"}', '{"specialty": "Matemáticas y Ciencias Aplicadas"}'),
      ('al-6', '${tenant1Id}', 'campuses', 'cp-2', 'CREATE', 'admin@colegiopremium.edu', NULL, '{"name": "Pabellón Sur Robótica", "type": "physical", "capacity": 120, "status": "active"}'),
      ('al-7', '${tenant1Id}', 'campuses', 'cp-2', 'STATUS_CHANGE', 'admin@colegiopremium.edu', '{"status": "active"}', '{"status": "maintenance"}');
    `);
    console.log(' - Historiales de auditoría inicializados.');

    console.log('\n=====================================================================');
    console.log('🎉 BASE DE DATOS DE SINCROEDU TOTALMENTE CONFIGURADA Y SEMBRADA EN NEON');
    console.log('=====================================================================');

  } catch (err: any) {
    console.error('❌ ERROR DURANTE LA INICIALIZACIÓN DE LA BASE DE DATOS:', err.message);
  } finally {
    await client.end();
  }
}

// Ejecutar migración
initDatabase();
