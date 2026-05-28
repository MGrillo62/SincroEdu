import bcrypt from 'bcryptjs';

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  status: 'active' | 'suspended' | 'trial';
  fiscalId?: string;
  address?: string;
  phone?: string;
  email?: string;
  domain?: string;
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

export interface Lead {
  id: string;
  tenantId: string;
  firstName: string;       // Nombre del alumno prospecto
  lastName: string;        // Apellido del alumno prospecto
  parentName: string;      // Nombre del padre/madre/apoderado
  email: string;           // Correo electrónico del contacto
  phone: string;           // Teléfono de contacto
  gradeInterested: string; // Grado escolar de interés (ej: Primaria 3°, Secundaria 1°)
  source: 'web' | 'referral' | 'social_media' | 'walk_in' | 'phone_call'; // Origen del contacto
  status: 'new' | 'contacted' | 'tour_scheduled' | 'evaluation' | 'approved' | 'enrolled' | 'lost'; // Pipeline de Admisiones
  lostReason?: string;     // Motivo de descarte (si aplica)
  assignedUserId?: string; // Asesor escolar asignado
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'evaluation' | 'system';
  summary: string;         // Título rápido de la interacción
  details?: string;        // Comentarios o notas redactadas
  createdBy: string;       // Quién la registró
  createdAt: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  title: string;           // Recordatorio (ej: "Enviar brochure de precios")
  dueDate: string;         // Fecha límite (AAAA-MM-DD)
  status: 'pending' | 'completed';
  assignedTo: string;      // Asesor asignado
  createdAt: string;
}

export interface CommunicationMessage {
  id: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  senderRole: string;      // Rol (ej: "Director", "Profesor", "Administración")
  subject: string;         // Asunto o Título
  body: string;            // Contenido / Cuerpo del boletín o mensaje
  category: 'general' | 'academic' | 'billing' | 'emergency' | 'event'; // Segmentación temática
  targetGroup: 'all' | 'teachers' | 'parents' | 'students' | 'grade' | 'individual'; // Destinatarios
  targetGrade?: string;    // Grado específico (ej: "Secundaria 3°") si targetGroup === 'grade'
  attachmentUrl?: string;  // Nombre de circular adjunta (ej: "Circular_Admision_2026.pdf")
  deliveryChannels: ('in_app' | 'email' | 'whatsapp')[]; // Canales elegidos
  createdAt: string;
}

export interface CommunicationRecipient {
  id: string;
  messageId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: 'admin' | 'teacher' | 'parent' | 'student';
  inAppStatus: 'unread' | 'read';
  emailStatus: 'pending' | 'sent' | 'failed' | 'not_requested';
  whatsappStatus: 'pending' | 'sent' | 'failed' | 'not_requested';
  readAt?: string;         // Fecha exacta de confirmación de lectura en in-app
  updatedAt: string;
}

export interface CommunicationTemplate {
  id: string;
  tenantId: string;
  title: string;           // Nombre de plantilla
  subject: string;         // Asunto preestablecido
  body: string;            // Contenido preestablecido
  category: 'general' | 'academic' | 'billing' | 'emergency' | 'event';
  createdAt: string;
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
    fiscalId: '20601234567',
    address: 'Av. Aurelio Miró Quesada 450, San Isidro, Lima',
    phone: '+51 1 615-5800',
    email: 'contacto@colegiopremium.edu',
    domain: 'colegiopremium.edu'
  },
  {
    id: 't-22222222-2222-2222-2222-222222222222',
    name: 'Instituto de Ciencias Innovación',
    subdomain: 'ciencias-innovacion',
    logoUrl: null,
    primaryColor: '#2B6CB0',
    secondaryColor: '#1A202C',
    status: 'active',
    fiscalId: '20609876543',
    address: 'Calle Monterrey 340, Santiago de Surco, Lima',
    phone: '+51 1 712-4000',
    email: 'admision@ciencias.edu.pe',
    domain: 'ciencias.edu.pe'
  }
];

export const menuOptions: MenuOption[] = [
  { id: 'm-1', parentId: null, title: 'KPIs', icon: 'LayoutDashboard', route: '/dashboard', sortOrder: 1, module: 'dashboard', isActive: true },
  { id: 'm-10', parentId: null, title: 'CRM y Leads', icon: 'Target', route: '/dashboard/crm', sortOrder: 2, module: 'crm', isActive: true },
  { id: 'm-4', parentId: null, title: 'Sedes', icon: 'MapPin', route: '/dashboard/campuses', sortOrder: 3, module: 'sedes', isActive: true },
  { id: 'm-5', parentId: null, title: 'Alumnos', icon: 'FileText', route: '/dashboard/students', sortOrder: 4, module: 'matriculas', isActive: true },
  { id: 'm-6', parentId: null, title: 'Calificaciones Académicas', icon: 'Award', route: '/dashboard/grades', sortOrder: 5, module: 'calificaciones', isActive: true },
  { id: 'm-7', parentId: null, title: 'Pagos y cobros', icon: 'CreditCard', route: '/dashboard/payments', sortOrder: 6, module: 'pagos', isActive: true },
  { id: 'm-8', parentId: null, title: 'Programación predictiva', icon: 'CalendarDays', route: '/dashboard/predictive', sortOrder: 7, module: 'predicciones', isActive: true },
  { id: 'm-9', parentId: null, title: 'Centro de Comunicación', icon: 'MessageSquare', route: '/dashboard/comms', sortOrder: 8, module: 'comunicaciones', isActive: true },
  { id: 'm-11', parentId: null, title: 'Herramientas Administrativas', icon: 'ShieldAlert', route: '/dashboard/admin', sortOrder: 9, module: 'administracion', isActive: true },
  { id: 'm-config', parentId: null, title: 'Configuración', icon: 'Settings', route: '/dashboard/config', sortOrder: 10, module: 'config', isActive: true },
  { id: 'm-config-roles', parentId: 'm-config', title: 'Matriz de Roles Dinámicos', icon: 'Shield', route: '/dashboard/config/roles', sortOrder: 1, module: 'config', isActive: true },
  { id: 'm-2', parentId: 'm-config', title: 'Catálogo de Cursos y Oferta', icon: 'BookOpen', route: '/dashboard/courses', sortOrder: 2, module: 'cursos', isActive: true },
  { id: 'm-3', parentId: 'm-config', title: 'Gestión de Facultad (Profesores)', icon: 'Users', route: '/dashboard/professors', sortOrder: 3, module: 'facultad', isActive: true },
  { id: 'm-tenants', parentId: null, title: 'Configuración de Tenants', icon: 'Globe', route: '/dashboard/tenants', sortOrder: 11, module: 'tenants', isActive: true }
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

// 2. Admin de Tenant 1 tiene acceso a TODO con permisos completos dentro de su Tenant, excepto Configuración de Tenants
menuOptions.forEach(menu => {
  const isTenantsMenu = menu.id === 'm-tenants';
  roleMenuPermissions.push({
    id: `p-t1a-${menu.id}`,
    roleId: 'r-tenant1-admin',
    menuOptionId: menu.id,
    canView: !isTenantsMenu,
    canCreate: !isTenantsMenu,
    canEdit: !isTenantsMenu,
    canDelete: !isTenantsMenu,
  });
});

// 3. Profesor de Tenant 1 tiene acceso restringido a algunos módulos
// Módulos visibles: KPIs/Dashboard (Vista), Carpeta de Configuración (Vista), Cursos (Vista), Facultad (Vista), Expedientes (Vista), Calificaciones (Completo), Comunicación (Completo)
const profVisibleMenus = ['m-1', 'm-config', 'm-2', 'm-3', 'm-5', 'm-6', 'm-9'];
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
const auxVisibleMenus = ['m-1', 'm-config', 'm-2', 'm-4', 'm-5', 'm-9', 'm-10'];
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

// -------------------------------------------------------------
// CRM SEEDS & MOCK DATA Arrays
// -------------------------------------------------------------
export const leads: Lead[] = [
  {
    id: 'ld-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Mateo',
    lastName: 'Silva',
    parentName: 'Sofía Silva',
    email: 'sofia.silva@mail.com',
    phone: '+51 987 654 321',
    gradeInterested: 'Primaria 1°',
    source: 'web',
    status: 'new',
    assignedUserId: 'u-admin1',
    createdAt: '2026-05-20T10:00:00Z',
    updatedAt: '2026-05-20T10:00:00Z'
  },
  {
    id: 'ld-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Valentina',
    lastName: 'Rojas',
    parentName: 'Carlos Rojas',
    email: 'carlos.rojas@outlook.com',
    phone: '+51 912 345 678',
    gradeInterested: 'Secundaria 3°',
    source: 'social_media',
    status: 'contacted',
    assignedUserId: 'u-admin1',
    createdAt: '2026-05-18T14:30:00Z',
    updatedAt: '2026-05-19T11:00:00Z'
  },
  {
    id: 'ld-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Thiago',
    lastName: 'Pinedo',
    parentName: 'Milagros Pinedo',
    email: 'milagros@gmail.com',
    phone: '+51 945 678 123',
    gradeInterested: 'Primaria 5°',
    source: 'referral',
    status: 'tour_scheduled',
    assignedUserId: 'u-auxiliar1',
    createdAt: '2026-05-15T09:00:00Z',
    updatedAt: '2026-05-17T16:20:00Z'
  },
  {
    id: 'ld-4',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Luciana',
    lastName: 'Herrera',
    parentName: 'Daniel Herrera',
    email: 'dherrera@empresa.pe',
    phone: '+51 963 852 741',
    gradeInterested: 'Secundaria 1°',
    source: 'walk_in',
    status: 'evaluation',
    assignedUserId: 'u-admin1',
    createdAt: '2026-05-12T11:45:00Z',
    updatedAt: '2026-05-20T14:00:00Z'
  },
  {
    id: 'ld-5',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Benjamín',
    lastName: 'Castro',
    parentName: 'Patricia Castro',
    email: 'pcastro@hotmail.com',
    phone: '+51 999 888 777',
    gradeInterested: 'Primaria 2°',
    source: 'phone_call',
    status: 'approved',
    assignedUserId: 'u-auxiliar1',
    createdAt: '2026-05-10T10:15:00Z',
    updatedAt: '2026-05-24T12:00:00Z'
  },
  {
    id: 'ld-6',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Matías',
    lastName: 'Bustamante',
    parentName: 'Jorge Bustamante',
    email: 'jorge.busta@gmail.com',
    phone: '+51 911 222 333',
    gradeInterested: 'Secundaria 5°',
    source: 'web',
    status: 'enrolled',
    assignedUserId: 'u-admin1',
    createdAt: '2026-05-08T09:00:00Z',
    updatedAt: '2026-05-25T15:30:00Z'
  },
  {
    id: 'ld-7',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    firstName: 'Camila',
    lastName: 'Ortiz',
    parentName: 'Elena Ortiz',
    email: 'elena.ortiz@yahoo.com',
    phone: '+51 922 444 666',
    gradeInterested: 'Primaria 4°',
    source: 'social_media',
    status: 'lost',
    lostReason: 'Precio de matrícula y mensualidad elevados',
    assignedUserId: 'u-auxiliar1',
    createdAt: '2026-05-05T14:00:00Z',
    updatedAt: '2026-05-12T10:00:00Z'
  }
];

export const leadActivities: LeadActivity[] = [
  {
    id: 'la-1',
    leadId: 'ld-1',
    type: 'system',
    summary: 'Lead captado automáticamente',
    details: 'Prospecto registrado a través del formulario web de admisiones para Primaria 1°.',
    createdBy: 'Sistema',
    createdAt: '2026-05-20T10:00:00Z'
  },
  {
    id: 'la-2',
    leadId: 'ld-2',
    type: 'system',
    summary: 'Lead captado vía Redes Sociales',
    details: 'Prospecto registrado a través de campaña publicitaria en Facebook Ads.',
    createdBy: 'Sistema',
    createdAt: '2026-05-18T14:30:00Z'
  },
  {
    id: 'la-3',
    leadId: 'ld-2',
    type: 'call',
    summary: 'Llamada telefónica inicial',
    details: 'Se contactó a Carlos Rojas. Indica que busca un colegio con fuerte enfoque deportivo y bilingüe. Se agendó enviarle brochure.',
    createdBy: 'admin@colegiopremium.edu',
    createdAt: '2026-05-19T11:00:00Z'
  },
  {
    id: 'la-4',
    leadId: 'ld-3',
    type: 'system',
    summary: 'Lead registrado por recomendación',
    details: 'Registrado por recomendación del exalumno de la promoción 2024.',
    createdBy: 'auxiliar@colegiopremium.edu',
    createdAt: '2026-05-15T09:00:00Z'
  },
  {
    id: 'la-5',
    leadId: 'ld-3',
    type: 'call',
    summary: 'Llamada para agendar visita',
    details: 'Conversación fluida con la madre (Milagros). Agendó visita guiada por las sedes e instalaciones para el jueves a las 4:00 PM.',
    createdBy: 'auxiliar@colegiopremium.edu',
    createdAt: '2026-05-17T16:20:00Z'
  },
  {
    id: 'la-6',
    leadId: 'ld-5',
    type: 'meeting',
    summary: 'Visita guiada al campus completada',
    details: 'El apoderado y el estudiante recorrieron los laboratorios de cómputo, ciencias y robótica. Se mostraron altamente satisfechos con la infraestructura.',
    createdBy: 'auxiliar@colegiopremium.edu',
    createdAt: '2026-05-12T15:00:00Z'
  },
  {
    id: 'la-7',
    leadId: 'ld-5',
    type: 'evaluation',
    summary: 'Evaluación académica psicopedagógica',
    details: 'Estudiante rindió la evaluación cognitiva. Aprobó con rendimiento sobresaliente. Comité aprueba vacante.',
    createdBy: 'Dpto. Psicopedagógico',
    createdAt: '2026-05-24T12:00:00Z'
  }
];

export const leadTasks: LeadTask[] = [
  {
    id: 'lt-1',
    leadId: 'ld-1',
    title: 'Llamar a apoderado para calificar interés',
    dueDate: '2026-06-01',
    status: 'pending',
    assignedTo: 'admin@colegiopremium.edu',
    createdAt: '2026-05-20T10:05:00Z'
  },
  {
    id: 'lt-2',
    leadId: 'ld-2',
    title: 'Enviar brochure de precios y vacantes 2026',
    dueDate: '2026-05-30',
    status: 'completed',
    assignedTo: 'admin@colegiopremium.edu',
    createdAt: '2026-05-19T11:05:00Z'
  },
  {
    id: 'lt-3',
    leadId: 'ld-3',
    title: 'Confirmar asistencia a visita guiada presencial',
    dueDate: '2026-05-29',
    status: 'pending',
    assignedTo: 'auxiliar@colegiopremium.edu',
    createdAt: '2026-05-17T16:25:00Z'
  },
  {
    id: 'lt-4',
    leadId: 'ld-5',
    title: 'Enviar carta de aprobación y ficha de pago de matrícula',
    dueDate: '2026-05-28',
    status: 'pending',
    assignedTo: 'auxiliar@colegiopremium.edu',
    createdAt: '2026-05-24T12:10:00Z'
  }
];

// -------------------------------------------------------------
// COMMS SEEDS & MOCK DATA Arrays
// -------------------------------------------------------------

export const communicationTemplates: CommunicationTemplate[] = [
  {
    id: 'tmpl-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    title: 'Recordatorio de Pago de Mensualidad',
    subject: 'Recordatorio de Pago: Mensualidad Escolar [Mes]',
    body: 'Estimados padres de familia y apoderados, les recordamos que la mensualidad correspondiente al mes de [Mes] vence el día [Fecha Vencimiento]. Agradecemos su puntualidad en los canales de pago autorizados (Bancos afiliados, transferencia o pasarela de pagos digital del colegio).\n\nAtentamente,\nOficina de Tesorería y Cobranzas',
    category: 'billing',
    createdAt: '2026-05-01T08:00:00Z'
  },
  {
    id: 'tmpl-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    title: 'Clases Suspendidas por Emergencia Climatológica',
    subject: 'ALERTA URGENTE: Suspensión Preventiva de Clases Presenciales',
    body: 'Estimada comunidad educativa, ante las alertas climatológicas e indicaciones de Defensa Civil, informamos la suspensión preventiva de clases presenciales para el día [Fecha]. Las actividades escolares continuarán de forma virtual a través de nuestras aulas virtuales y plataformas Zoom registradas.\n\nPor favor mantenerse a resguardo y atentos a nuevos comunicados oficiales.\n\nAtentamente,\nDirección General de SincroEdu',
    category: 'emergency',
    createdAt: '2026-05-02T09:00:00Z'
  },
  {
    id: 'tmpl-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    title: 'Convocatoria a Reunión de Padres y Apoderados',
    subject: 'Convocatoria: Reunión General de Padres de Familia - [Grado/Nivel]',
    body: 'Estimados padres y apoderados, se les convoca formalmente a la Reunión General de Padres de Familia del nivel de [Nivel], que se llevará a cabo el día [Fecha] a las [Hora] en el Auditorio Principal de la Sede Central. Agenda a tratar:\n1. Reporte de avance y rendimiento del periodo.\n2. Planeación de proyectos del trimestre.\n3. Coordinaciones de actividades extracurriculares.\n\nSu asistencia es de carácter obligatorio.\n\nAtentamente,\nCoordinación Académica',
    category: 'event',
    createdAt: '2026-05-03T10:00:00Z'
  },
  {
    id: 'tmpl-4',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    title: 'Boletín Académico Mensual',
    subject: 'Boletín SincroEdu: Resumen Informativo y Logros del Mes',
    body: 'Queridas familias, les compartimos nuestro Boletín Académico del mes, donde celebramos los logros y el esfuerzo de nuestros alumnos en los diversos talleres de robótica, proyectos artísticos y competiciones deportivas. Asimismo, les adjuntamos el calendario de exámenes finales y feriados escolares.\n\n¡Gracias por ser parte del crecimiento formativo de sus hijos!\n\nAtentamente,\nDirección Académica',
    category: 'academic',
    createdAt: '2026-05-04T11:00:00Z'
  }
];

export const communicationMessages: CommunicationMessage[] = [
  {
    id: 'msg-1',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    senderId: 'u-admin1',
    senderName: 'Santiago Delgado',
    senderRole: 'Dirección General',
    subject: 'Inicio del Ciclo Académico 2026-I y Normas de Convivencia',
    body: 'Estimados padres y alumnos, les damos una cordial bienvenida al nuevo ciclo escolar. Les adjuntamos la circular detallada que contiene el reglamento interno, horarios de ingreso, normas de convivencia y políticas de aforo en nuestras aulas presenciales y virtuales. Esperamos iniciar con el máximo entusiasmo académico.',
    category: 'general',
    targetGroup: 'all',
    attachmentUrl: 'Circular_Inicio_Ciclo_2026.pdf',
    deliveryChannels: ['in_app', 'email'],
    createdAt: '2026-05-25T08:00:00Z'
  },
  {
    id: 'msg-2',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    senderId: 'u-prof1',
    senderName: 'Alejandro Mendoza',
    senderRole: 'Profesor de Ciencias',
    subject: 'Guía de Prácticas de Laboratorio de Robótica y Electrónica',
    body: 'Estimados alumnos y padres del aula de Secundaria 1°, les comparto la guía de laboratorio que estaremos ejecutando este jueves en la sede principal. Es requisito indispensable revisar previamente los diagramas de circuitos y traer los materiales indicados (placa Arduino y cables de conexión).',
    category: 'academic',
    targetGroup: 'grade',
    targetGrade: 'Secundaria 1°',
    attachmentUrl: 'Guia_Laboratorio_Robotica_S1.pdf',
    deliveryChannels: ['in_app'],
    createdAt: '2026-05-26T10:00:00Z'
  },
  {
    id: 'msg-3',
    tenantId: 't-11111111-1111-1111-1111-111111111111',
    senderId: 'u-auxiliar1',
    senderName: 'Mariana Rosas',
    senderRole: 'Oficina de Admisión',
    subject: 'URGENTE: Proceso de Matrícula Extemporánea 2026',
    body: 'Se comunica a los padres de familia que el plazo improrrogable para regularizar los expedientes académicos y tramitar las matrículas pendientes de pago vence este fin de semana. Apoderados con vacantes pendientes deben acercarse presencialmente a Sede Central para evitar la reasignación del cupo.',
    category: 'billing',
    targetGroup: 'parents',
    deliveryChannels: ['in_app', 'email', 'whatsapp'],
    createdAt: '2026-05-27T09:00:00Z'
  }
];

export const communicationRecipients: CommunicationRecipient[] = [
  // Mensaje 1 (A todos, enviamos muestra de destinatarios)
  {
    id: 'rc-1',
    messageId: 'msg-1',
    recipientId: 'u-prof1',
    recipientName: 'Alejandro Mendoza',
    recipientRole: 'teacher',
    inAppStatus: 'read',
    emailStatus: 'sent',
    whatsappStatus: 'not_requested',
    readAt: '2026-05-25T08:30:00Z',
    updatedAt: '2026-05-25T08:30:00Z'
  },
  {
    id: 'rc-2',
    messageId: 'msg-1',
    recipientId: 'u-auxiliar1',
    recipientName: 'Mariana Rosas',
    recipientRole: 'admin',
    inAppStatus: 'unread',
    emailStatus: 'sent',
    whatsappStatus: 'not_requested',
    updatedAt: '2026-05-25T08:00:00Z'
  },
  {
    id: 'rc-3',
    messageId: 'msg-1',
    recipientId: 'u-prof2', // Supongamos otro usuario
    recipientName: 'Valeria Campos',
    recipientRole: 'student',
    inAppStatus: 'unread',
    emailStatus: 'sent',
    whatsappStatus: 'not_requested',
    updatedAt: '2026-05-25T08:00:00Z'
  },

  // Mensaje 2 (Dirigido a un grado - Secundaria 1°)
  {
    id: 'rc-4',
    messageId: 'msg-2',
    recipientId: 'u-prof2', // Valeria
    recipientName: 'Valeria Campos',
    recipientRole: 'student',
    inAppStatus: 'unread',
    emailStatus: 'not_requested',
    whatsappStatus: 'not_requested',
    updatedAt: '2026-05-26T10:00:00Z'
  },

  // Mensaje 3 (Dirigido a padres de familia)
  {
    id: 'rc-5',
    messageId: 'msg-3',
    recipientId: 'u-admin1', // Dirección recibe copia
    recipientName: 'Santiago Delgado',
    recipientRole: 'admin',
    inAppStatus: 'read',
    emailStatus: 'sent',
    whatsappStatus: 'sent',
    readAt: '2026-05-27T09:15:00Z',
    updatedAt: '2026-05-27T09:15:00Z'
  },
  {
    id: 'rc-6',
    messageId: 'msg-3',
    recipientId: 'u-prof1', // Profesor
    recipientName: 'Alejandro Mendoza',
    recipientRole: 'teacher',
    inAppStatus: 'unread',
    emailStatus: 'sent',
    whatsappStatus: 'sent',
    updatedAt: '2026-05-27T09:00:00Z'
  }
];




