import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = 'postgresql://neondb_owner:npg_CqBjkLZJ46mu@ep-late-sun-aqcydx0h-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function initDatabase() {
  console.log('=====================================================================');
  console.log('🚀 SINCROEDU - INICIANDO DESPLIEGUE COMPLETO ACADÉMICO-FINANCIERO EN NEON');
  console.log('=====================================================================');

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('✅ Conexión establecida con el clúster de Neon.');

    // 1. LIMPIAR TABLAS EXISTENTES POR SEGURIDAD (Orden inverso de dependencias)
    console.log('\n🧹 Limpiando tablas previas si existen...');
    await client.query(`
      DROP TABLE IF EXISTS professor_attendance CASCADE;
      DROP TABLE IF EXISTS schedules CASCADE;
      DROP TABLE IF EXISTS time_slots CASCADE;
      DROP TABLE IF EXISTS professor_availabilities CASCADE;
      DROP TABLE IF EXISTS classrooms CASCADE;
      DROP TABLE IF EXISTS ledger_lines CASCADE;
      DROP TABLE IF EXISTS ledger_entries CASCADE;
      DROP TABLE IF EXISTS ledger_accounts CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS payables CASCADE;
      DROP TABLE IF EXISTS receivables CASCADE;
      DROP TABLE IF EXISTS student_guardians CASCADE;
      DROP TABLE IF EXISTS credit_pricing CASCADE;
      DROP TABLE IF EXISTS enrollments CASCADE;
      DROP TABLE IF EXISTS students CASCADE;
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
    console.log('\n🏛️ Creando esquema de tablas académico-financieras en PostgreSQL...');

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
        country VARCHAR(100),
        currency VARCHAR(10),
        start_date DATE,
        end_date DATE,
        payment_gateway VARCHAR(50),
        billing_plan VARCHAR(50),
        deduct_absences_from_payroll BOOLEAN DEFAULT TRUE,
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
        hourly_rate DECIMAL(12, 2) DEFAULT 40.00 NOT NULL CHECK (hourly_rate >= 0), -- Pago por hora trabajada
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

      -- 10. ALUMNOS (STUDENTS)
      CREATE TABLE students (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        enrollment_number VARCHAR(50) UNIQUE NOT NULL,
        document_id VARCHAR(50) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        birth_date VARCHAR(50), -- Guardado en formato dd/mm/aaaa como string para consistencia con mock
        admission_date VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'graduated', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_students_tenant ON students(tenant_id);

      -- 11. MATRÍCULAS (ENROLLMENTS)
      CREATE TABLE enrollments (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        academic_period VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, course_id, academic_period)
      );

      CREATE INDEX idx_enrollments_tenant ON enrollments(tenant_id);

      -- 11B. ASISTENCIA Y HORAS DE PROFESORES (professor_attendance)
      CREATE TABLE professor_attendance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        professor_id VARCHAR(50) NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
        course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        class_date DATE NOT NULL,
        scheduled_hours DECIMAL(5, 2) NOT NULL CHECK (scheduled_hours > 0),
        hours_worked DECIMAL(5, 2) NOT NULL CHECK (hours_worked >= 0),
        status VARCHAR(50) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_professor_attendance_tenant ON professor_attendance(tenant_id);
      CREATE INDEX idx_professor_attendance_prof ON professor_attendance(professor_id);

      -- 12. VALOR DE CRÉDITOS ACADÉMICOS (credit_pricing)
      CREATE TABLE credit_pricing (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        academic_period VARCHAR(50) NOT NULL,
        price_per_credit DECIMAL(12, 2) NOT NULL CHECK (price_per_credit >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, academic_period)
      );

      -- 13. RELACIÓN ALUMNOS - PADRES / APODERADOS (student_guardians)
      CREATE TABLE student_guardians (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relationship VARCHAR(100) NOT NULL,
        is_billing_contact BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, user_id)
      );

      -- 14. CUENTAS POR COBRAR (receivables)
      CREATE TABLE receivables (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        enrollment_id VARCHAR(50) REFERENCES enrollments(id) ON DELETE SET NULL,
        concept TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
        paid_amount DECIMAL(12, 2) DEFAULT 0.00 CHECK (paid_amount >= 0),
        due_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_receivables_tenant ON receivables(tenant_id);
      CREATE INDEX idx_receivables_student ON receivables(student_id);

      -- 15. CUENTAS POR PAGAR (payables)
      CREATE TABLE payables (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        professor_id VARCHAR(50) REFERENCES professors(id) ON DELETE SET NULL,
        concept TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
        paid_amount DECIMAL(12, 2) DEFAULT 0.00 CHECK (paid_amount >= 0),
        due_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'OVERDUE')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_payables_tenant ON payables(tenant_id);

      -- 16. TRANSACCIONES DE COBROS Y PAGOS (transactions)
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        receivable_id UUID REFERENCES receivables(id) ON DELETE SET NULL,
        payable_id UUID REFERENCES payables(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
        amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(50) NOT NULL,
        gateway_reference VARCHAR(255),
        status VARCHAR(50) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
        transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(50) REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);

      -- 17. LIBRO MAYOR - CUENTAS CONTABLES (ledger_accounts)
      CREATE TABLE ledger_accounts (
        id VARCHAR(50) PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 18. LIBRO MAYOR - CABECERA DE ASIENTO (ledger_entries)
      CREATE TABLE ledger_entries (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 19. LIBRO MAYOR - DETALLE DE ASIENTO (ledger_lines)
      CREATE TABLE ledger_lines (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entry_id UUID NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
        account_id VARCHAR(50) NOT NULL REFERENCES ledger_accounts(id),
        debit DECIMAL(12, 2) DEFAULT 0.00 CHECK (debit >= 0),
        credit DECIMAL(12, 2) DEFAULT 0.00 CHECK (credit >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_line_value CHECK (
          (debit > 0 AND credit = 0) OR 
          (credit > 0 AND debit = 0)
        )
      );

      -- 20. AULAS Y ESPACIOS DE ESTUDIO (classrooms)
      CREATE TABLE classrooms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        campus_id VARCHAR(50) REFERENCES campuses(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('classroom', 'laboratory', 'auditorium', 'virtual_room')),
        capacity INT NOT NULL CHECK (capacity > 0),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_classrooms_tenant ON classrooms(tenant_id);

      -- 21. DISPONIBILIDAD DOCENTE (professor_availabilities)
      CREATE TABLE professor_availabilities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        professor_id VARCHAR(50) NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
        day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1: Lunes, 7: Domingo
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_prof_avail_tenant ON professor_availabilities(tenant_id);
      CREATE INDEX idx_prof_avail_prof ON professor_availabilities(professor_id);

      -- 22. BLOQUES HORARIOS ESTÁNDAR (time_slots)
      CREATE TABLE time_slots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        type VARCHAR(50) DEFAULT 'standard' CHECK (type IN ('standard', 'lab', 'recess', 'special')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_time_slots_tenant ON time_slots(tenant_id);

      -- 23. ASIGNACIÓN HORARIA (schedules)
      CREATE TABLE schedules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        professor_id VARCHAR(50) REFERENCES professors(id) ON DELETE SET NULL,
        classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
        time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
        academic_period VARCHAR(50) NOT NULL,
        section_code VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tenant_id, course_id, academic_period, section_code, time_slot_id)
      );

      CREATE INDEX idx_schedules_tenant ON schedules(tenant_id);
    `);
    console.log('✅ Esquema de base de datos académico-financiero y de optimización creado exitosamente.');

    // 3. POBLACIÓN DE SEMILLAS (SEED DATA)
    console.log('\n🌱 Poblando base de datos con registros de prueba...');

    // A. Insertar Tenants
    const tenant1Id = '44b7fa71-5582-45a8-b6cb-918991ef2364'; // Fijo para consistencia
    const tenant2Id = 'bb820465-b778-43d9-a723-f390035cb3c8';
    
    await client.query(`
      INSERT INTO tenants (id, name, subdomain, logo_url, primary_color, secondary_color, status, country, currency, start_date, end_date, payment_gateway, billing_plan) VALUES
      ('${tenant1Id}', 'SincroEdu Premium College', 'sincroedu-college', '/brand/logo.png', '#6B8E4E', '#1C2C35', 'active', 'Perú', 'PEN', '2026-01-15', NULL, 'culqui', 'membership'),
      ('${tenant2Id}', 'Instituto de Ciencias Innovación', 'ciencias-innovacion', NULL, '#2B6CB0', '#1A202C', 'active', 'México', 'MXN', '2026-02-01', NULL, 'conekta', 'membership');
    `);
    console.log(' - Tenants insertados.');

    // B. Insertar Opciones de Menú
    await client.query(`
      INSERT INTO menu_options (id, parent_id, title, icon, route, sort_order, module, is_active) VALUES
      ('m-1', NULL, 'KPIs', 'LayoutDashboard', '/dashboard', 1, 'dashboard', TRUE),
      ('m-2', NULL, 'Catálogo de cursos', 'BookOpen', '/dashboard/courses', 2, 'cursos', TRUE),
      ('m-3', NULL, 'Profesores', 'Users', '/dashboard/professors', 3, 'facultad', TRUE),
      ('m-5', NULL, 'Alumnos', 'FileText', '/dashboard/students', 5, 'matriculas', TRUE),
      ('m-6', NULL, 'Calificaciones', 'Award', '/dashboard/grades', 6, 'calificaciones', TRUE),
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
      ('r-tenant1-parent', '${tenant1Id}', 'Padre', 'Apoderado responsable del pago de deudas escolares.', FALSE),
      ('r-tenant1-auxiliar', '${tenant1Id}', 'Auxiliar', 'Personal administrativo de apoyo.', FALSE);
    `);
    console.log(' - Roles base y dinámicos insertados.');

    // D. Insertar Permisos de Menú
    const menuIds = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-7', 'm-8', 'm-9', 'm-10', 'm-11'];
    
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

    // Profesor Tenant 1 permisos
    const profMenus = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-9'];
    for (const mId of menuIds) {
      const isAllowed = profMenus.includes(mId);
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-tenant1-professor', '${mId}', ${isAllowed}, ${isAllowed && ['m-6', 'm-9'].includes(mId)}, ${isAllowed && ['m-6', 'm-9'].includes(mId)}, FALSE);
      `);
    }

    // Padre de Familia Tenant 1 permisos (sólo ve KPIs/Deudas y Pagos)
    const parentMenus = ['m-1', 'm-7'];
    for (const mId of menuIds) {
      const isAllowed = parentMenus.includes(mId);
      await client.query(`
        INSERT INTO role_menu_permissions (role_id, menu_option_id, can_view, can_create, can_edit, can_delete)
        VALUES ('r-tenant1-parent', '${mId}', ${isAllowed}, FALSE, FALSE, FALSE);
      `);
    }

    // Auxiliar Tenant 1 permisos
    const auxMenus = ['m-1', 'm-2', 'm-5', 'm-9', 'm-10'];
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
      ('u-parent1', '${tenant1Id}', 'r-tenant1-parent', 'padre@colegiopremium.edu', '${passwordHash}', 'Carlos', 'Mendoza', '+51 987 222 333', NULL, TRUE),
      ('u-t1auxiliar', '${tenant1Id}', 'r-tenant1-auxiliar', 'auxiliar@colegiopremium.edu', '${passwordHash}', 'Laura', 'Vegas', '+51 911 222 333', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', TRUE);
    `);
    console.log(' - Usuarios base Multi-Tenant insertados.');

    // F. Insertar Cursos
    await client.query(`
      INSERT INTO courses (id, tenant_id, code, name, description, credits, status) VALUES
      ('c-1', '${tenant1Id}', 'MAT-101', 'Álgebra y Trigonometría Avanzada', 'Curso fundamental de análisis algebraico, funciones complejas y modelos trigonométricos para ciencias aplicadas.', 5, 'active'),
      ('c-2', '${tenant1Id}', 'LIT-204', 'Literatura Hispanoamericana del Siglo XX', 'Estudio crítico de las obras cumbre del boom latinoamericano, análisis lírico y evolución literaria continental.', 4, 'active'),
      ('c-3', '${tenant1Id}', 'TEC-302', 'Programación y Robótica Escolar Integrada', 'Taller práctico introductorio a microcontroladores, lógica computacional básica utilizando Python y diseño electromecánico.', 3, 'active');
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

    // H. Insertar Facultad (Profesores) - Tarifa por hora = 50 PEN
    await client.query(`
      INSERT INTO professors (id, tenant_id, user_id, specialty, hire_date, hourly_rate, status) VALUES
      ('p-1', '${tenant1Id}', 'u-t1professor', 'Matemáticas y Ciencias Aplicadas', '2024-03-01', 50.00, 'active');
    `);
    console.log(' - Facultad de profesores insertada.');

    // I. Insertar Alumnos (Students)
    await client.query(`
      INSERT INTO students (id, tenant_id, enrollment_number, document_id, first_name, last_name, email, phone, birth_date, admission_date, status) VALUES
      ('st-1', '${tenant1Id}', 'MAT-2026-0001', 'DNI 72615438', 'Alejandro', 'Mendoza Torres', 'alejandro.mendoza@student.edu', '+51 987 111 222', '12/05/2008', '01/03/2026', 'active'),
      ('st-2', '${tenant1Id}', 'MAT-2026-0002', 'DNI 73928174', 'Valeria', 'Campos Espinoza', 'valeria.campos@student.edu', '+51 987 333 444', '25/09/2009', '01/03/2026', 'active'),
      ('st-3', '${tenant1Id}', 'MAT-2026-0003', 'DNI 74819203', 'Bruno', 'García Paredes', 'bruno.garcia@student.edu', '+51 987 555 666', '08/11/2007', '15/03/2026', 'inactive');
    `);
    console.log(' - Alumnos semilla insertados.');

    // J. Relacionar Alumno Alejandro con Padre Carlos
    await client.query(`
      INSERT INTO student_guardians (student_id, user_id, relationship, is_billing_contact) VALUES
      ('st-1', 'u-parent1', 'Padre', TRUE);
    `);
    console.log(' - Relaciones de apoderados insertadas.');

    // K. Insertar Matrículas (Enrollments)
    await client.query(`
      INSERT INTO enrollments (id, tenant_id, student_id, course_id, academic_period, status) VALUES
      ('en-1', '${tenant1Id}', 'st-1', 'c-1', '2026-I', 'active'),
      ('en-2', '${tenant1Id}', 'st-1', 'c-2', '2026-I', 'active'),
      ('en-3', '${tenant1Id}', 'st-2', 'c-1', '2026-I', 'active'),
      ('en-4', '${tenant1Id}', 'st-3', 'c-2', '2026-I', 'dropped');
    `);
    console.log(' - Matrículas semilla insertadas.');

    // L. Insertar Precios de Créditos (100 PEN por crédito en period '2026-I')
    await client.query(`
      INSERT INTO credit_pricing (tenant_id, academic_period, price_per_credit) VALUES
      ('${tenant1Id}', '2026-I', 100.00);
    `);
    console.log(' - Precios de créditos sembrados.');

    // M. Cuentas Contables del Libro Mayor
    await client.query(`
      INSERT INTO ledger_accounts (id, tenant_id, name, type) VALUES
      ('10100', '${tenant1Id}', 'Efectivo y Equivalentes de Efectivo (Caja/Bancos)', 'ASSET'),
      ('12100', '${tenant1Id}', 'Cuentas por Cobrar Comerciales (Pensiones/Créditos)', 'ASSET'),
      ('21100', '${tenant1Id}', 'Cuentas por Pagar Comerciales (Nómina Docente)', 'LIABILITY'),
      ('40100', '${tenant1Id}', 'Ingresos por Servicios Educativos (Mensualidades)', 'REVENUE'),
      ('50100', '${tenant1Id}', 'Gastos de Personal - Nómina de Profesores', 'EXPENSE');
    `);
    console.log(' - Cuentas contables creadas.');

    // N. Cuentas por Cobrar (Receivables)
    // Alejandro (st-1) -> MAT-101 (5 créd) = 500 PEN. LIT-204 (4 créd) = 400 PEN. Total = 900 PEN.
    // Valeria (st-2) -> MAT-101 (5 créd) = 500 PEN. (Atrasado)
    const rec1Id = '77a7fa71-5582-45a8-b6cb-918991ef2361';
    const rec2Id = '77a7fa71-5582-45a8-b6cb-918991ef2362';
    const rec3Id = '77a7fa71-5582-45a8-b6cb-918991ef2363';
    
    await client.query(`
      INSERT INTO receivables (id, tenant_id, student_id, enrollment_id, concept, amount, paid_amount, due_date, status) VALUES
      ('${rec1Id}', '${tenant1Id}', 'st-1', 'en-1', 'Matrícula Álgebra y Trigonometría Avanzada (5 créditos)', 500.00, 500.00, '2026-04-10', 'PAID'),
      ('${rec2Id}', '${tenant1Id}', 'st-1', 'en-2', 'Matrícula Literatura Hispanoamericana (4 créditos)', 400.00, 0.00, '2026-05-10', 'PENDING'),
      ('${rec3Id}', '${tenant1Id}', 'st-2', 'en-3', 'Matrícula Álgebra y Trigonometría Avanzada (5 créditos)', 500.00, 0.00, '2026-05-01', 'OVERDUE');
    `);
    console.log(' - Cuentas por cobrar sembradas.');

    // O. Transacciones y Asientos Contables para Deudas Originales (Devengo del Ingreso)
    // Deuda 1 Devengo (Asiento diario)
    const entryDev1Id = 'e1a7fa71-5582-45a8-b6cb-918991ef2361';
    await client.query(`
      INSERT INTO ledger_entries (id, tenant_id, description, entry_date) VALUES
      ('${entryDev1Id}', '${tenant1Id}', 'Provisión de pensión - Alejandro Mendoza - MAT-101', '2026-04-01T08:00:00Z');
      
      INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES
      ('${entryDev1Id}', '12100', 500.00, 0.00),
      ('${entryDev1Id}', '40100', 0.00, 500.00);
    `);

    // Deuda 2 Devengo (Asiento diario)
    const entryDev2Id = 'e1a7fa71-5582-45a8-b6cb-918991ef2362';
    await client.query(`
      INSERT INTO ledger_entries (id, tenant_id, description, entry_date) VALUES
      ('${entryDev2Id}', '${tenant1Id}', 'Provisión de pensión - Alejandro Mendoza - LIT-204', '2026-05-01T08:00:00Z');
      
      INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES
      ('${entryDev2Id}', '12100', 400.00, 0.00),
      ('${entryDev2Id}', '40100', 0.00, 400.00);
    `);

    // Deuda 3 Devengo (Asiento diario)
    const entryDev3Id = 'e1a7fa71-5582-45a8-b6cb-918991ef2363';
    await client.query(`
      INSERT INTO ledger_entries (id, tenant_id, description, entry_date) VALUES
      ('${entryDev3Id}', '${tenant1Id}', 'Provisión de pensión - Valeria Campos - MAT-101', '2026-05-01T08:05:00Z');
      
      INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES
      ('${entryDev3Id}', '12100', 500.00, 0.00),
      ('${entryDev3Id}', '40100', 0.00, 500.00);
    `);

    // P. Transacción de Recibo de Pago (Alejandro pagó rec1)
    const tx1Id = 'cc17fa71-5582-45a8-b6cb-918991ef2361';
    await client.query(`
      INSERT INTO transactions (id, tenant_id, receivable_id, payable_id, type, amount, payment_method, gateway_reference, status, transaction_date) VALUES
      ('${tx1Id}', '${tenant1Id}', '${rec1Id}', NULL, 'INCOME', 500.00, 'STRIPE', 'ch_StripeRef12345', 'COMPLETED', '2026-04-09T14:30:00Z');
    `);

    // Asiento Contable del Recibo del Pago (Caja vs Ctas por Cobrar)
    const entryPay1Id = 'e2a7fa71-5582-45a8-b6cb-918991ef2361';
    await client.query(`
      INSERT INTO ledger_entries (id, tenant_id, transaction_id, description, entry_date) VALUES
      ('${entryPay1Id}', '${tenant1Id}', '${tx1Id}', 'Cobro de pensión en línea - Recibo ${rec1Id.substring(0, 8)}', '2026-04-09T14:30:00Z');
      
      INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES
      ('${entryPay1Id}', '10100', 500.00, 0.00),
      ('${entryPay1Id}', '12100', 0.00, 500.00);
    `);
    console.log(' - Historial de cobros y libro mayor contable inicializado.');

    // P2. Asistencia de Profesores (Mateo Silva - p-1 - en Mayo 2026)
    // 9 clases de 3 horas asistidas, 1 clase de 3 horas con falta (ABSENT)
    await client.query(`
      INSERT INTO professor_attendance (tenant_id, professor_id, course_id, class_date, scheduled_hours, hours_worked, status) VALUES
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-02', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-05', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-09', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-12', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-16', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-19', 3.0, 0.0, 'ABSENT'), -- Faltó
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-23', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-26', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-30', 3.0, 3.0, 'PRESENT'),
      ('${tenant1Id}', 'p-1', 'c-1', '2026-05-31', 3.0, 3.0, 'PRESENT');
    `);
    console.log(' - Asistencia de profesores inicializada.');

    // Q. Cuentas por Pagar (Payables - Nómina del Profesor Mateo Silva - Mayo 2026)
    // 30 horas dictadas * 50 PEN/hora = 1500 PEN
    const pay1Id = '99a7fa71-5582-45a8-b6cb-918991ef2361';
    await client.query(`
      INSERT INTO payables (id, tenant_id, professor_id, concept, amount, paid_amount, due_date, status) VALUES
      ('${pay1Id}', '${tenant1Id}', 'p-1', 'Pago de nómina Mayo 2026 - Mateo Silva (30 horas dictadas)', 1500.00, 0.00, '2026-05-30', 'PENDING');
    `);

    // Asiento contable de provisión de nómina (Gasto de Nómina vs Ctas por Pagar)
    const entryProvPay1Id = 'e3a7fa71-5582-45a8-b6cb-918991ef2361';
    await client.query(`
      INSERT INTO ledger_entries (id, tenant_id, description, entry_date) VALUES
      ('${entryProvPay1Id}', '${tenant1Id}', 'Provisión nómina docente - Mateo Silva - Mayo 2026', '2026-05-25T08:00:00Z');
      
      INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES
      ('${entryProvPay1Id}', '50100', 1500.00, 0.00),
      ('${entryProvPay1Id}', '21100', 0.00, 1500.00);
    `);
    console.log(' - Nómina de profesores y Libro Mayor contable inicializados.');

    // R. Insertar Aulas y Laboratorios (classrooms)
    const classroom1Id = '11111111-2222-3333-4444-555555555551';
    const classroom2Id = '11111111-2222-3333-4444-555555555552';
    const classroom3Id = '11111111-2222-3333-4444-555555555553';
    const classroom4Id = '11111111-2222-3333-4444-555555555554';
    await client.query(`
      INSERT INTO classrooms (id, tenant_id, campus_id, name, type, capacity, status) VALUES
      ('${classroom1Id}', '${tenant1Id}', 'cp-1', 'Aula 101 - Pabellón A', 'classroom', 30, 'active'),
      ('${classroom2Id}', '${tenant1Id}', 'cp-1', 'Aula 102 - Pabellón A', 'classroom', 35, 'active'),
      ('${classroom3Id}', '${tenant1Id}', 'cp-2', 'Laboratorio Alfa Robótica', 'laboratory', 20, 'active'),
      ('${classroom4Id}', '${tenant1Id}', 'cp-3', 'Aula Virtual Zoom General A', 'virtual_room', 100, 'active');
    `);
    console.log(' - Aulas y laboratorios de estudio insertados.');

    // S. Insertar Bloques Horarios Estándar (time_slots)
    const slot1Id = '22222222-3333-4444-5555-666666666661'; // Lunes Mañana 1
    const slot2Id = '22222222-3333-4444-5555-666666666662'; // Lunes Mañana 2
    const slot3Id = '22222222-3333-4444-5555-666666666663'; // Miércoles Mañana 1
    const slot4Id = '22222222-3333-4444-5555-666666666664'; // Viernes Mañana 1
    await client.query(`
      INSERT INTO time_slots (id, tenant_id, name, day_of_week, start_time, end_time, type) VALUES
      ('${slot1Id}', '${tenant1Id}', 'Lunes Mañana 1', 1, '08:00:00', '10:00:00', 'standard'),
      ('${slot2Id}', '${tenant1Id}', 'Lunes Mañana 2', 1, '10:30:00', '12:30:00', 'standard'),
      ('${slot3Id}', '${tenant1Id}', 'Miércoles Mañana 1', 3, '08:00:00', '10:00:00', 'standard'),
      ('${slot4Id}', '${tenant1Id}', 'Viernes Mañana 1', 5, '08:00:00', '10:00:00', 'standard');
    `);
    console.log(' - Bloques horarios estándar insertados.');

    // T. Insertar Disponibilidades Horarias Docentes (professor_availabilities)
    await client.query(`
      INSERT INTO professor_availabilities (tenant_id, professor_id, day_of_week, start_time, end_time) VALUES
      ('${tenant1Id}', 'p-1', 1, '08:00:00', '13:00:00'),
      ('${tenant1Id}', 'p-1', 3, '08:00:00', '13:00:00'),
      ('${tenant1Id}', 'p-1', 5, '08:00:00', '13:00:00');
    `);
    console.log(' - Disponibilidades de profesores insertadas.');

    // U. Insertar Programación Borrador / Oficial Inicial (schedules)
    await client.query(`
      INSERT INTO schedules (tenant_id, course_id, professor_id, classroom_id, time_slot_id, academic_period, section_code, status) VALUES
      ('${tenant1Id}', 'c-1', 'p-1', '${classroom1Id}', '${slot1Id}', '2026-I', 'A', 'published'),
      ('${tenant1Id}', 'c-2', NULL, '${classroom2Id}', '${slot2Id}', '2026-I', 'A', 'draft');
    `);
    console.log(' - Asignación horaria inicial (Schedules) insertada.');

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
