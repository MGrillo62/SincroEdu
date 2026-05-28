import bcrypt from 'bcryptjs';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  status: 'active' | 'suspended' | 'trial';
}

export interface MenuOption {
  id: string;
  parentId: string | null;
  title: string;
  icon: string; // Lucide icon name
  route: string;
  sortOrder: number;
  module: string;
  isActive: boolean;
}

export interface Role {
  id: string;
  tenantId: string | null; // null for Superadmin
  name: string;
  description: string;
  isSystemRole: boolean;
}

export interface RoleMenuPermission {
  id: string;
  roleId: string;
  menuOptionId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  updatedAt?: string;
}


export interface User {
  id: string;
  tenantId: string | null; // null for Superadmin
  roleId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLogin: string | null;
}

// -------------------------------------------------------------
// MOCK DATA INITIALIZATION
// -------------------------------------------------------------

export const tenants: Tenant[] = [
  {
    id: 't-11111111-1111-1111-1111-111111111111',
    name: 'SincroEdu Premium College',
    subdomain: 'sincroedu-college',
    logoUrl: '/brand/logo.png',
    primaryColor: '#6B8E4E',
    secondaryColor: '#1C2C35',
    status: 'active',
  },
  {
    id: 't-22222222-2222-2222-2222-222222222222',
    name: 'Instituto de Ciencias Innovación',
    subdomain: 'ciencias-innovacion',
    logoUrl: null,
    primaryColor: '#2B6CB0',
    secondaryColor: '#1A202C',
    status: 'active',
  }
];

export const menuOptions: MenuOption[] = [
  { id: 'm-1', parentId: null, title: 'Panel de KPIs y Rentabilidad', icon: 'LayoutDashboard', route: '/dashboard', sortOrder: 1, module: 'dashboard', isActive: true },
  { id: 'm-2', parentId: null, title: 'Catálogo de Cursos y Oferta', icon: 'BookOpen', route: '/dashboard/courses', sortOrder: 2, module: 'cursos', isActive: true },
  { id: 'm-3', parentId: null, title: 'Gestión de Facultad (Profesores)', icon: 'Users', route: '/dashboard/professors', sortOrder: 3, module: 'facultad', isActive: true },
  { id: 'm-4', parentId: null, title: 'Gestión de Sedes (Aulas/Espacios)', icon: 'MapPin', route: '/dashboard/campuses', sortOrder: 4, module: 'sedes', isActive: true },
  { id: 'm-5', parentId: null, title: 'Expedientes y Matrícula', icon: 'FileText', route: '/dashboard/students', sortOrder: 5, module: 'matriculas', isActive: true },
  { id: 'm-6', parentId: null, title: 'Calificaciones Académicas', icon: 'Award', route: '/dashboard/grades', sortOrder: 6, module: 'calificaciones', isActive: true },
  { id: 'm-7', parentId: null, title: 'Procesamiento de Pagos y Cobranzas', icon: 'CreditCard', route: '/dashboard/payments', sortOrder: 7, module: 'pagos', isActive: true },
  { id: 'm-8', parentId: null, title: 'Programación Predictiva (Inteligencia)', icon: 'CalendarDays', route: '/dashboard/predictive', sortOrder: 8, module: 'predicciones', isActive: true },
  { id: 'm-9', parentId: null, title: 'Centro de Comunicación', icon: 'MessageSquare', route: '/dashboard/comms', sortOrder: 9, module: 'comunicaciones', isActive: true },
  { id: 'm-10', parentId: null, title: 'CRM y Captación de Leads', icon: 'Target', route: '/dashboard/crm', sortOrder: 10, module: 'crm', isActive: true },
  { id: 'm-11', parentId: null, title: 'Herramientas Administrativas', icon: 'ShieldAlert', route: '/dashboard/admin', sortOrder: 11, module: 'administracion', isActive: true }
];

export const roles: Role[] = [
  // Superadmin Global
  {
    id: 'r-superadmin',
    tenantId: null,
    name: 'Superadmin',
    description: 'Administrador global del ecosistema SincroEdu.',
    isSystemRole: true
  },
  // Tenant 1: SincroEdu Premium College
  {
    id: 'r-tenant1-admin',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Admin',
    description: 'Administrador general del Tenant.',
    isSystemRole: true
  },
  {
    id: 'r-tenant1-professor',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Profesor',
    description: 'Personal docente con acceso a notas y cursos.',
    isSystemRole: false
  },
  {
    id: 'r-tenant1-auxiliar',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Auxiliar',
    description: 'Personal administrativo de apoyo.',
    isSystemRole: false
  }
];

// Generar matriz de permisos dinámicos
export const roleMenuPermissions: RoleMenuPermission[] = [];

// 1. Superadmin tiene acceso a TODO con permisos completos
menuOptions.forEach(menu => {
  roleMenuPermissions.push({
    id: `p-sa-${menu.id}`,
    roleId: 'r-superadmin',
    menuOptionId: menu.id,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  });
});

// 2. Admin de Tenant 1 tiene acceso a TODO con permisos completos dentro de su Tenant
menuOptions.forEach(menu => {
  roleMenuPermissions.push({
    id: `p-t1a-${menu.id}`,
    roleId: 'r-tenant1-admin',
    menuOptionId: menu.id,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  });
});

// 3. Profesor de Tenant 1 tiene acceso restringido a algunos módulos
// Módulos visibles: KPIs/Dashboard (Vista), Cursos (Vista), Facultad (Vista), Expedientes (Vista), Calificaciones (Completo), Comunicación (Completo)
const profVisibleMenus = ['m-1', 'm-2', 'm-3', 'm-5', 'm-6', 'm-9'];
menuOptions.forEach(menu => {
  const isAllowed = profVisibleMenus.includes(menu.id);
  roleMenuPermissions.push({
    id: `p-t1p-${menu.id}`,
    roleId: 'r-tenant1-professor',
    menuOptionId: menu.id,
    canView: isAllowed,
    canCreate: isAllowed && ['m-6', 'm-9'].includes(menu.id), // Sólo crear notas y comunicaciones
    canEdit: isAllowed && ['m-6', 'm-9'].includes(menu.id),
    canDelete: false
  });
});

// 4. Auxiliar de Tenant 1 tiene acceso intermedio
const auxVisibleMenus = ['m-1', 'm-2', 'm-4', 'm-5', 'm-9', 'm-10'];
menuOptions.forEach(menu => {
  const isAllowed = auxVisibleMenus.includes(menu.id);
  roleMenuPermissions.push({
    id: `p-t1ax-${menu.id}`,
    roleId: 'r-tenant1-auxiliar',
    menuOptionId: menu.id,
    canView: isAllowed,
    canCreate: isAllowed && ['m-5', 'm-9', 'm-10'].includes(menu.id), // Crear matrículas, mensajes, leads
    canEdit: isAllowed && ['m-5', 'm-9', 'm-10'].includes(menu.id),
    canDelete: false
  });
});

// Hash de contraseñas de prueba (sincro123)
const salt = bcrypt.genSaltSync(10);
const defaultPasswordHash = bcrypt.hashSync('sincro123', salt);

export const users: User[] = [
  {
    id: 'u-superadmin',
    tenantId: null,
    roleId: 'r-superadmin',
    email: 'superadmin@sincroedu.com',
    passwordHash: defaultPasswordHash,
    firstName: 'Santiago',
    lastName: 'Delgado',
    phone: '+51 987 654 321',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isActive: true,
    lastLogin: null
  },
  {
    id: 'u-t1admin',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    roleId: 'r-tenant1-admin',
    email: 'admin@colegiopremium.edu',
    passwordHash: defaultPasswordHash,
    firstName: 'Patricia',
    lastName: 'Ruiz',
    phone: '+51 999 888 777',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    isActive: true,
    lastLogin: null
  },
  {
    id: 'u-t1professor',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    roleId: 'r-tenant1-professor',
    email: 'profesor@colegiopremium.edu',
    passwordHash: defaultPasswordHash,
    firstName: 'Mateo',
    lastName: 'Silva',
    phone: '+51 955 444 333',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    isActive: true,
    lastLogin: null
  },
  {
    id: 'u-t1auxiliar',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    roleId: 'r-tenant1-auxiliar',
    email: 'auxiliar@colegiopremium.edu',
    passwordHash: defaultPasswordHash,
    firstName: 'Laura',
    lastName: 'Vegas',
    phone: '+51 911 222 333',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    isActive: true,
    lastLogin: null
  }
];

// =====================================================================
// INTERFACES Y MODELOS CORE (FASE 2)
// =====================================================================

export interface Course {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  status: 'draft' | 'active' | 'archived';
  prerequisites?: string[]; // Array de courseIds requeridos
  createdAt: string;
  updatedAt: string;
}

export interface Professor {
  id: string;
  tenantId: string;
  userId: string; // Vínculo al usuario
  specialty: string;
  hireDate: string; // Formato yyyy-mm-dd
  status: 'active' | 'license' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Campus {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  type: 'physical' | 'virtual';
  capacity: number;
  status: 'active' | 'maintenance' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  tableName: string; // 'courses', 'professors', 'campuses'
  recordId: string; // ID del registro alterado
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE';
  changedBy: string; // Email o Nombre del usuario que ejecutó la acción
  previousValues: any | null; // Valores anteriores en formato JSON
  newValues: any | null; // Nuevos valores en formato JSON
  createdAt: string; // Formato ISO completo
}

// =====================================================================
// SEMILLAS DE DATOS CORE (FASE 2)
// =====================================================================

export const courses: Course[] = [
  {
    id: 'c-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    code: 'MAT-101',
    name: 'Álgebra y Trigonometría Avanzada',
    description: 'Curso fundamental de análisis algebraico, funciones complejas y modelos trigonométricos para ciencias aplicadas.',
    credits: 5,
    status: 'active',
    prerequisites: [],
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-02-15T08:00:00Z'
  },
  {
    id: 'c-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    code: 'LIT-204',
    name: 'Literatura Hispanoamericana del Siglo XX',
    description: 'Estudio crítico de las obras cumbre del boom latinoamericano, análisis lírico y evolución literaria continental.',
    credits: 4,
    status: 'active',
    prerequisites: [],
    createdAt: '2026-03-10T09:30:00Z',
    updatedAt: '2026-05-10T14:20:00Z'
  },
  {
    id: 'c-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    code: 'TEC-302',
    name: 'Programación y Robótica Escolar Integrada',
    description: 'Taller práctico introductorio a microcontroladores, lógica computacional básica utilizando Python y diseño electromecánico.',
    credits: 3,
    status: 'active', // Cambiar a activo para poder usarlo como prerrequisito
    prerequisites: [],
    createdAt: '2026-05-20T11:00:00Z',
    updatedAt: '2026-05-20T11:00:00Z'
  },
  {
    id: 'c-4',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    code: 'MAT-201',
    name: 'Cálculo Avanzado y Análisis Real',
    description: 'Estudio de límites, derivadas complejas, integrales múltiples y análisis de series matemáticas para ingeniería.',
    credits: 5,
    status: 'active',
    prerequisites: ['c-1'], // Requiere Álgebra (c-1)
    createdAt: '2026-05-27T08:00:00Z',
    updatedAt: '2026-05-27T08:00:00Z'
  },
  {
    id: 'c-5',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    code: 'TEC-401',
    name: 'Robótica Aplicada y Sistemas Autónomos',
    description: 'Diseño avanzado de robots móviles, cinemática directa/inversa, sensores inteligentes y sistemas de control autónomo.',
    credits: 4,
    status: 'active',
    prerequisites: ['c-1', 'c-3'], // Requiere Álgebra (c-1) y Programación Robótica (c-3)
    createdAt: '2026-05-27T09:00:00Z',
    updatedAt: '2026-05-27T09:00:00Z'
  }
];

export const professors: Professor[] = [
  {
    id: 'p-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    userId: 'u-t1professor', // Mateo Silva
    specialty: 'Matemáticas y Ciencias Aplicadas',
    hireDate: '2024-03-01',
    status: 'active',
    createdAt: '2024-03-01T08:00:00Z',
    updatedAt: '2026-04-12T10:00:00Z'
  }
];

export const campuses: Campus[] = [
  {
    id: 'cp-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Sede Central San Isidro',
    address: 'Av. Aurelio Miró Quesada 450, San Isidro',
    type: 'physical',
    capacity: 650,
    status: 'active',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-01-10T08:00:00Z'
  },
  {
    id: 'cp-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Laboratorio de Innovación y Robótica Sur',
    address: 'Calle Monterrey 340, Surco',
    type: 'physical',
    capacity: 120,
    status: 'maintenance',
    createdAt: '2025-08-15T09:00:00Z',
    updatedAt: '2026-05-18T16:45:00Z'
  },
  {
    id: 'cp-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    name: 'Campus Virtual Integrado SincroEdu',
    address: 'https://campus.sincroedu.edu.pe',
    type: 'virtual',
    capacity: 5000,
    status: 'active',
    createdAt: '2025-03-20T08:00:00Z',
    updatedAt: '2025-03-20T08:00:00Z'
  }
];

export const auditLogs: AuditLog[] = [
  // Cursos Logs
  {
    id: 'al-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'courses',
    recordId: 'c-1',
    action: 'CREATE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: null,
    newValues: { code: 'MAT-101', name: 'Álgebra y Trigonometría Avanzada', credits: 5, status: 'active' },
    createdAt: '2026-02-15T08:00:00Z'
  },
  {
    id: 'al-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'courses',
    recordId: 'c-2',
    action: 'CREATE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: null,
    newValues: { code: 'LIT-204', name: 'Literatura Hispanoamericana', credits: 4, status: 'draft' },
    createdAt: '2026-03-10T09:30:00Z'
  },
  {
    id: 'al-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'courses',
    recordId: 'c-2',
    action: 'STATUS_CHANGE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: { status: 'draft' },
    newValues: { status: 'active' },
    createdAt: '2026-05-10T14:20:00Z'
  },
  // Facultad Logs
  {
    id: 'al-4',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'professors',
    recordId: 'p-1',
    action: 'CREATE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: null,
    newValues: { userId: 'u-t1professor', specialty: 'Matemáticas y Ciencias', status: 'active', hireDate: '2024-03-01' },
    createdAt: '2024-03-01T08:00:00Z'
  },
  {
    id: 'al-5',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'professors',
    recordId: 'p-1',
    action: 'UPDATE',
    changedBy: 'superadmin@sincroedu.com',
    previousValues: { specialty: 'Matemáticas y Ciencias' },
    newValues: { specialty: 'Matemáticas y Ciencias Aplicadas' },
    createdAt: '2026-04-12T10:00:00Z'
  },
  // Sedes Logs
  {
    id: 'al-6',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'campuses',
    recordId: 'cp-2',
    action: 'CREATE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: null,
    newValues: { name: 'Pabellón Sur Robótica', type: 'physical', capacity: 120, status: 'active' },
    createdAt: '2025-08-15T09:00:00Z'
  },
  {
    id: 'al-7',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    tableName: 'campuses',
    recordId: 'cp-2',
    action: 'STATUS_CHANGE',
    changedBy: 'admin@colegiopremium.edu',
    previousValues: { status: 'active' },
    newValues: { status: 'maintenance' },
    createdAt: '2026-05-18T16:45:00Z'
  }
];

// =====================================================================
// MODELOS Y SEMILLAS DE ALUMNOS Y MATRÍCULAS (FASE 3)
// =====================================================================

export interface Student {
  id: string;
  tenantId: string;
  enrollmentNumber: string;
  documentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string; // dd/mm/aaaa
  admissionDate: string; // dd/mm/aaaa
  status: 'active' | 'suspended' | 'graduated' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  tenantId: string;
  studentId: string;
  courseId: string;
  academicPeriod: string;
  status: 'active' | 'dropped' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export const students: Student[] = [
  {
    id: 'st-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    enrollmentNumber: 'MAT-2026-0001',
    documentId: 'DNI 72615438',
    firstName: 'Alejandro',
    lastName: 'Mendoza Torres',
    email: 'alejandro.mendoza@student.edu',
    phone: '+51 987 111 222',
    birthDate: '12/05/2008',
    admissionDate: '01/03/2026',
    status: 'active',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z'
  },
  {
    id: 'st-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    enrollmentNumber: 'MAT-2026-0002',
    documentId: 'DNI 73928174',
    firstName: 'Valeria',
    lastName: 'Campos Espinoza',
    email: 'valeria.campos@student.edu',
    phone: '+51 987 333 444',
    birthDate: '25/09/2009',
    admissionDate: '01/03/2026',
    status: 'active',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-03-01T08:00:00Z'
  },
  {
    id: 'st-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    enrollmentNumber: 'MAT-2026-0003',
    documentId: 'DNI 74819203',
    firstName: 'Bruno',
    lastName: 'García Paredes',
    email: 'bruno.garcia@student.edu',
    phone: '+51 987 555 666',
    birthDate: '08/11/2007',
    admissionDate: '15/03/2026',
    status: 'suspended',
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-03-15T09:00:00Z'
  }
];

export const enrollments: Enrollment[] = [
  // Matrículas Aprobadas (Completed) en periodos anteriores (2025-II) para Alejandro Mendoza (st-1)
  {
    id: 'en-completed-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-1',
    courseId: 'c-1', // Álgebra y Trigonometría Avanzada
    academicPeriod: '2025-II',
    status: 'completed',
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-12-20T12:00:00Z'
  },
  {
    id: 'en-completed-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-1',
    courseId: 'c-3', // Programación y Robótica
    academicPeriod: '2025-II',
    status: 'completed',
    createdAt: '2025-08-01T08:30:00Z',
    updatedAt: '2025-12-20T12:00:00Z'
  },
  // Matrículas Activas y de Prueba del periodo 2026-I
  {
    id: 'en-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-1',
    courseId: 'c-1', // Álgebra (también inscrito activo en el catálogo)
    academicPeriod: '2026-I',
    status: 'active',
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z'
  },
  {
    id: 'en-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-1',
    courseId: 'c-2', // Literatura
    academicPeriod: '2026-I',
    status: 'active',
    createdAt: '2026-03-01T09:05:00Z',
    updatedAt: '2026-03-01T09:05:00Z'
  },
  {
    id: 'en-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-2',
    courseId: 'c-1', // Álgebra
    academicPeriod: '2026-I',
    status: 'active',
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-03-02T10:00:00Z'
  },
  {
    id: 'en-4',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    studentId: 'st-3',
    courseId: 'c-2', // Literatura
    academicPeriod: '2026-I',
    status: 'dropped',
    createdAt: '2026-03-16T11:00:00Z',
    updatedAt: '2026-04-01T15:30:00Z'
  }
];


