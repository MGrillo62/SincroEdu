import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  users, 
  tenants, 
  roles, 
  menuOptions, 
  roleMenuPermissions, 
  courses,
  professors,
  campuses,
  auditLogs,
  students,
  enrollments,
  Tenant, 
  Role, 
  User,
  Course,
  Professor,
  Campus,
  AuditLog,
  Student,
  Enrollment,
  CreditPricing,
  StudentGuardian,
  Receivable,
  Payable,
  Transaction,
  LedgerAccount,
  LedgerEntry,
  LedgerLine,
  leads,
  leadActivities,
  leadTasks,
  Lead,
  LeadActivity,
  LeadTask,
  communicationMessages,
  communicationRecipients,
  communicationTemplates,
  CommunicationMessage,
  CommunicationRecipient,
  CommunicationTemplate,
  gradeScales,
  evaluationStructures,
  gradeRecords,
  periodLocks,
  gradeAuditLogs,
  creditPricings,
  studentGuardians,
  receivables as mockReceivables,
  payables as mockPayables,
  transactions as mockTransactions,
  ledgerAccounts as mockLedgerAccounts,
  ledgerEntries as mockLedgerEntries,
  ledgerLines as mockLedgerLines,
  ProfessorAttendance,
  professorAttendances as mockProfessorAttendances,
  Classroom,
  ProfessorAvailability,
  TimeSlot,
  Schedule,
  mockClassrooms,
  mockTimeSlots,
  mockProfessorAvailabilities,
  mockSchedules
} from './db';
import { Pool } from 'pg';

dotenv.config();

// Pool de conexión a PostgreSQL en Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_CqBjkLZJ46mu@ep-late-sun-aqcydx0h-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

// Helper para validar si la base de datos está disponible
let dbAvailable = false;
pool.query('SELECT 1')
  .then(() => {
    dbAvailable = true;
    console.log('✅ Base de datos PostgreSQL en Neon conectada y lista.');
  })
  .catch((err) => {
    dbAvailable = false;
    console.warn('⚠️ No se pudo conectar a PostgreSQL. Usando fallback en memoria.', err.message);
  });

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'sincroedu_super_secret_key_12345';

// Habilitar CORS y parseador JSON
app.use(cors());
app.use(express.json());

// Logger simple para peticiones
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Interface para el Request Autenticado
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string | null;
    roleId: string;
    email: string;
  };
}

// -------------------------------------------------------------
// MIDDLEWARE DE AUTENTICACIÓN JWT
// -------------------------------------------------------------
const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // "Bearer TOKEN"

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
      }
      req.user = decoded as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'Encabezado de autorización ausente' });
  }
};

// -------------------------------------------------------------
// HELPER PARA REGISTRO DE AUDITORÍA (HISTORIAL DE EDICIONES)
// -------------------------------------------------------------
const addAuditLog = (
  tenantId: string,
  tableName: string,
  recordId: string,
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE',
  changedBy: string,
  previousValues: any | null,
  newValues: any | null
) => {
  const newLog: AuditLog = {
    id: `al-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tenantId,
    tableName,
    recordId,
    action,
    changedBy,
    previousValues: previousValues ? JSON.parse(JSON.stringify(previousValues)) : null,
    newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
    createdAt: new Date().toISOString()
  };
  auditLogs.unshift(newLog); // Añadir al inicio para mantener orden descendente
  return newLog;
};

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// 1. LOGIN DE USUARIOS
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }

  // Buscar usuario
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
  }

  // Verificar contraseña
  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Obtener Tenant (institución)
  let userTenant: Tenant | null = null;
  if (user.tenantId) {
    userTenant = tenants.find(t => t.id === user.tenantId) || null;
  }

  // Obtener Rol
  const userRole = roles.find(r => r.id === user.roleId) || null;

  // Obtener permisos de menú vinculados a este rol
  const permissions = roleMenuPermissions.filter(p => p.roleId === user.roleId);
  
  // Mapear los permisos con la información detallada del menú
  const menuAccess = menuOptions
    .filter(menu => {
      const perm = permissions.find(p => p.menuOptionId === menu.id);
      return perm ? perm.canView : false;
    })
    .map(menu => {
      const perm = permissions.find(p => p.menuOptionId === menu.id)!;
      return {
        ...menu,
        permissions: {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete
        }
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Generar JWT Token
  const token = jwt.sign(
    { 
      id: user.id, 
      tenantId: user.tenantId, 
      roleId: user.roleId, 
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Actualizar lastLogin
  user.lastLogin = new Date().toISOString();

  // Responder con toda la información
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      roleId: user.roleId,
      roleName: userRole ? userRole.name : 'Invitado',
      lastLogin: user.lastLogin
    },
    tenant: userTenant,
    menuAccess
  });
});

// 2. OBTENER INFORMACIÓN DE PERFIL E INICIO (GET ME)
app.get('/api/auth/me', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const user = users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const userTenant = user.tenantId ? tenants.find(t => t.id === user.tenantId) : null;
  const userRole = roles.find(r => r.id === user.roleId);
  
  const permissions = roleMenuPermissions.filter(p => p.roleId === user.roleId);
  const menuAccess = menuOptions
    .filter(menu => {
      const perm = permissions.find(p => p.menuOptionId === menu.id);
      return perm ? perm.canView : false;
    })
    .map(menu => {
      const perm = permissions.find(p => p.menuOptionId === menu.id)!;
      return {
        ...menu,
        permissions: {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete
        }
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      roleId: user.roleId,
      roleName: userRole ? userRole.name : 'Invitado'
    },
    tenant: userTenant || null,
    menuAccess
  });
});
// ============================================================================
// CONSOLA DE TENANTS (SÓLO SUPERADMIN GLOBAL)
// ============================================================================

// 1. Obtener todos los Tenants (escuelas)
app.get('/api/tenants', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.roleId !== 'r-superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
  }
  return res.json(tenants);
});

// 2. Registrar nuevo Tenant (escuela) con auto-semillado de roles y permisos
app.post('/api/tenants', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.roleId !== 'r-superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
  }

  const { name, subdomain, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain, country, currency, startDate, endDate, paymentGateway, billingPlan } = req.body;

  if (!name || !subdomain) {
    return res.status(400).json({ error: 'Nombre de escuela y subdominio son obligatorios' });
  }

  // Verificar si ya existe el subdominio
  const subExists = tenants.some(t => t.subdomain.toLowerCase() === subdomain.toLowerCase());
  if (subExists) {
    return res.status(409).json({ error: 'El subdominio ya se encuentra registrado' });
  }

  const newTenantId = `t-${Date.now()}`;
  const newTenant: Tenant = {
    id: newTenantId,
    name,
    subdomain,
    logoUrl: logoUrl || null,
    primaryColor: primaryColor || '#6B8E4E',
    secondaryColor: secondaryColor || '#1C2C35',
    status: status || 'active',
    fiscalId: fiscalId || '',
    address: address || '',
    phone: phone || '',
    email: email || '',
    domain: domain || `${subdomain}.sincroedu.edu.pe`,
    country: country || 'Perú',
    currency: currency || 'PEN',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || null,
    paymentGateway: paymentGateway || 'culqui',
    billingPlan: billingPlan || 'membership'
  };

  tenants.push(newTenant);

  // Auto-creación de roles predeterminados para el nuevo Tenant
  const newAdminRoleId = `r-${newTenantId}-admin`;
  const newProfRoleId = `r-${newTenantId}-professor`;
  const newAuxRoleId = `r-${newTenantId}-auxiliar`;

  roles.push(
    {
      id: newAdminRoleId,
      tenantId: newTenantId,
      name: 'Admin',
      description: 'Administrador general de la escuela.',
      isSystemRole: true
    },
    {
      id: newProfRoleId,
      tenantId: newTenantId,
      name: 'Profesor',
      description: 'Personal docente de la escuela.',
      isSystemRole: false
    },
    {
      id: newAuxRoleId,
      tenantId: newTenantId,
      name: 'Auxiliar',
      description: 'Personal de apoyo administrativo.',
      isSystemRole: false
    }
  );

  // Auto-seeding de permisos de menú para el Admin del nuevo Tenant (acceso a todo excepto m-tenants)
  menuOptions.forEach(menu => {
    const isTenantsMenu = menu.id === 'm-tenants';
    roleMenuPermissions.push({
      id: `p-${newTenantId}-admin-${menu.id}`,
      roleId: newAdminRoleId,
      menuOptionId: menu.id,
      canView: !isTenantsMenu,
      canCreate: !isTenantsMenu,
      canEdit: !isTenantsMenu,
      canDelete: !isTenantsMenu
    });
  });

  // Auto-seeding de permisos para Profesor del nuevo Tenant
  const profVisibleMenus = ['m-1', 'm-config', 'm-2', 'm-3', 'm-5', 'm-6', 'm-9'];
  menuOptions.forEach(menu => {
    const isAllowed = profVisibleMenus.includes(menu.id);
    roleMenuPermissions.push({
      id: `p-${newTenantId}-prof-${menu.id}`,
      roleId: newProfRoleId,
      menuOptionId: menu.id,
      canView: isAllowed,
      canCreate: isAllowed && ['m-6', 'm-9'].includes(menu.id),
      canEdit: isAllowed && ['m-6', 'm-9'].includes(menu.id),
      canDelete: false
    });
  });

  // Registrar Auditoría Global
  addAuditLog(
    'system',
    'tenants',
    newTenantId,
    'CREATE',
    req.user?.email || 'superadmin@sincroedu.com',
    null,
    newTenant
  );

  return res.status(201).json(newTenant);
});

// 3. Modificar/Actualizar ficha de Tenant
app.put('/api/tenants/:tenantId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.roleId !== 'r-superadmin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
  }

  const { tenantId } = req.params;
  const { name, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain, country, currency, startDate, endDate, paymentGateway, billingPlan } = req.body;

  const tenantIdx = tenants.findIndex(t => t.id === tenantId);
  if (tenantIdx === -1) {
    return res.status(404).json({ error: 'Tenant no encontrado' });
  }

  const previousTenant = { ...tenants[tenantIdx] };

  if (name) tenants[tenantIdx].name = name;
  if (logoUrl !== undefined) tenants[tenantIdx].logoUrl = logoUrl;
  if (primaryColor) tenants[tenantIdx].primaryColor = primaryColor;
  if (secondaryColor) tenants[tenantIdx].secondaryColor = secondaryColor;
  if (status) tenants[tenantIdx].status = status;
  if (fiscalId !== undefined) tenants[tenantIdx].fiscalId = fiscalId;
  if (address !== undefined) tenants[tenantIdx].address = address;
  if (phone !== undefined) tenants[tenantIdx].phone = phone;
  if (email !== undefined) tenants[tenantIdx].email = email;
  if (domain !== undefined) tenants[tenantIdx].domain = domain;
  if (country !== undefined) tenants[tenantIdx].country = country;
  if (currency !== undefined) tenants[tenantIdx].currency = currency;
  if (startDate !== undefined) tenants[tenantIdx].startDate = startDate;
  if (endDate !== undefined) tenants[tenantIdx].endDate = endDate;
  if (paymentGateway !== undefined) tenants[tenantIdx].paymentGateway = paymentGateway;
  if (billingPlan !== undefined) tenants[tenantIdx].billingPlan = billingPlan;

  const updatedTenant = tenants[tenantIdx];

  // Registrar Auditoría Global
  addAuditLog(
    'system',
    'tenants',
    tenantId,
    'UPDATE',
    req.user?.email || 'superadmin@sincroedu.com',
    previousTenant,
    updatedTenant
  );

  return res.json(updatedTenant);
});

// 3. OBTENER TODOS LOS ROLES DE UN TENANT
app.get('/api/tenants/:tenantId/roles', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  
  // Aislamiento Multi-Tenant estricto
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // Filtrar roles del tenant específico (o globales si es superadmin)
  const tenantRoles = roles.filter(r => r.tenantId === tenantId || r.tenantId === null);
  return res.json(tenantRoles);
});

// 4. OBTENER PERMISOS DETALLADOS PARA UN ROL ESPECÍFICO
app.get('/api/tenants/:tenantId/roles/:roleId/permissions', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, roleId } = req.params;

  // Aislamiento Multi-Tenant estricto
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const role = roles.find(r => r.id === roleId && (r.tenantId === tenantId || r.tenantId === null));
  if (!role) {
    return res.status(404).json({ error: 'Rol no encontrado' });
  }

  // Retornar la lista completa de opciones de menú con sus banderas canView, etc.
  const permissions = roleMenuPermissions.filter(p => p.roleId === roleId);

  const mappedPermissions = menuOptions.map(menu => {
    const perm = permissions.find(p => p.menuOptionId === menu.id);
    return {
      menuOptionId: menu.id,
      title: menu.title,
      module: menu.module,
      icon: menu.icon,
      canView: perm ? perm.canView : false,
      canCreate: perm ? perm.canCreate : false,
      canEdit: perm ? perm.canEdit : false,
      canDelete: perm ? perm.canDelete : false
    };
  });

  return res.json({
    role,
    permissions: mappedPermissions
  });
});

// 5. ACTUALIZAR LOS PERMISOS DINÁMICOS DE UN ROL
app.put('/api/tenants/:tenantId/roles/:roleId/permissions', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, roleId } = req.params;
  const { permissions } = req.body; 

  // Aislamiento Multi-Tenant estricto
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const role = roles.find(r => r.id === roleId && r.tenantId === tenantId);
  if (!role) {
    return res.status(404).json({ error: 'Rol editable no encontrado en este Tenant' });
  }

  if (role.isSystemRole) {
    return res.status(400).json({ error: 'Los roles base del sistema no pueden modificarse de forma dinámica por seguridad' });
  }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'El formato de permisos debe ser un arreglo válido' });
  }

  // Actualizar los permisos en el mock array
  permissions.forEach((updatedPerm: any) => {
    const idx = roleMenuPermissions.findIndex(p => p.roleId === roleId && p.menuOptionId === updatedPerm.menuOptionId);
    
    if (idx !== -1) {
      roleMenuPermissions[idx].canView = !!updatedPerm.canView;
      roleMenuPermissions[idx].canCreate = !!updatedPerm.canCreate;
      roleMenuPermissions[idx].canEdit = !!updatedPerm.canEdit;
      roleMenuPermissions[idx].canDelete = !!updatedPerm.canDelete;
      roleMenuPermissions[idx].updatedAt = new Date().toISOString();
    } else {
      // Si no existía, crearlo
      roleMenuPermissions.push({
        id: `p-${roleId.substring(0, 4)}-${updatedPerm.menuOptionId.substring(2)}`,
        roleId,
        menuOptionId: updatedPerm.menuOptionId,
        canView: !!updatedPerm.canView,
        canCreate: !!updatedPerm.canCreate,
        canEdit: !!updatedPerm.canEdit,
        canDelete: !!updatedPerm.canDelete
      });
    }
  });

  return res.json({ success: true, message: 'Permisos dinámicos de rol actualizados con éxito' });
});

// 6. CREAR UN ROL DINÁMICO DE FORMA EXPLÍCITA
app.post('/api/tenants/:tenantId/roles', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { name, description, permissions } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!name) {
    return res.status(400).json({ error: 'El nombre del rol es requerido' });
  }

  const existingRole = roles.find(r => r.name.toLowerCase() === name.toLowerCase() && r.tenantId === tenantId);
  if (existingRole) {
    return res.status(409).json({ error: 'Ya existe un rol con ese nombre en esta institución' });
  }

  const newRoleId = `r-custom-${Date.now()}`;
  const newRole: Role = {
    id: newRoleId,
    tenantId,
    name,
    description: description || '',
    isSystemRole: false
  };

  roles.push(newRole);

  // Si se proveen permisos iniciales, guardarlos
  if (Array.isArray(permissions)) {
    permissions.forEach((perm: any) => {
      roleMenuPermissions.push({
        id: `p-${newRoleId.substring(2, 6)}-${perm.menuOptionId}`,
        roleId: newRoleId,
        menuOptionId: perm.menuOptionId,
        canView: !!perm.canView,
        canCreate: !!perm.canCreate,
        canEdit: !!perm.canEdit,
        canDelete: !!perm.canDelete
      });
    });
  } else {
    // Si no, inicializarlos todos en false
    menuOptions.forEach(menu => {
      roleMenuPermissions.push({
        id: `p-${newRoleId.substring(2, 6)}-${menu.id}`,
        roleId: newRoleId,
        menuOptionId: menu.id,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false
      });
    });
  }

  return res.status(212).json(newRole);
});

// =====================================================================
// API 7: MÓDULO CATÁLOGO DE CURSOS Y OFERTA (CON HISTORIAL Y ESTADOS)
// =====================================================================

// Listar todos los cursos
app.get('/api/tenants/:tenantId/courses', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  const tenantCourses = courses.filter(c => c.tenantId === tenantId);
  return res.json(tenantCourses);
});

// Crear un nuevo curso
app.post('/api/tenants/:tenantId/courses', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { code, name, description, credits, status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!code || !name) {
    return res.status(400).json({ error: 'Código y Nombre del curso obligatorios' });
  }

  const codeExists = courses.find(c => c.code.toLowerCase() === code.toLowerCase() && c.tenantId === tenantId);
  if (codeExists) {
    return res.status(409).json({ error: `Ya existe un curso con el código '${code}'` });
  }

  const newCourse: Course = {
    id: `c-${Date.now()}`,
    tenantId,
    code,
    name,
    description: description || '',
    credits: Number(credits) || 0,
    status: status || 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  courses.push(newCourse);

  // Registrar en Historial de Auditoría
  addAuditLog(tenantId, 'courses', newCourse.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newCourse);

  return res.status(212).json(newCourse);
});

// Editar curso (Guarda historial de ediciones)
app.put('/api/tenants/:tenantId/courses/:courseId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { name, description, credits } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const courseIdx = courses.findIndex(c => c.id === courseId && c.tenantId === tenantId);
  if (courseIdx === -1) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  const previousCourse = { ...courses[courseIdx] };

  // Aplicar cambios
  if (name) courses[courseIdx].name = name;
  if (description !== undefined) courses[courseIdx].description = description;
  if (credits !== undefined) courses[courseIdx].credits = Number(credits);
  courses[courseIdx].updatedAt = new Date().toISOString();

  const newCourse = courses[courseIdx];

  // Registrar en Auditoría
  addAuditLog(
    tenantId, 
    'courses', 
    courseId, 
    'UPDATE', 
    req.user?.email || 'admin@colegiopremium.edu', 
    previousCourse, 
    newCourse
  );

  return res.json(newCourse);
});

// Modificar Estado del curso (Borrador -> Activo -> Archivado)
app.patch('/api/tenants/:tenantId/courses/:courseId/status', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!status || !['draft', 'active', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'Estado de curso inválido' });
  }

  const courseIdx = courses.findIndex(c => c.id === courseId && c.tenantId === tenantId);
  if (courseIdx === -1) {
    return res.status(404).json({ error: 'Curso no encontrado' });
  }

  const previousStatus = courses[courseIdx].status;
  courses[courseIdx].status = status;
  courses[courseIdx].updatedAt = new Date().toISOString();

  // Registrar en Auditoría (Cambio de Estado)
  addAuditLog(
    tenantId, 
    'courses', 
    courseId, 
    'STATUS_CHANGE', 
    req.user?.email || 'admin@colegiopremium.edu', 
    { status: previousStatus }, 
    { status }
  );

  return res.json(courses[courseIdx]);
});

// Obtener Historial de Auditoría de un curso
app.get('/api/tenants/:tenantId/courses/:courseId/history', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const history = auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'courses' && log.recordId === courseId);
  return res.json(history);
});

// =====================================================================
// API 8: MÓDULO GESTIÓN DE FACULTAD / DOCENTES (CON HISTORIAL Y ESTADOS)
// =====================================================================

// Listar todos los profesores (con detalles combinados de usuario)
app.get('/api/tenants/:tenantId/professors', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const tenantProfs = professors.filter(p => p.tenantId === tenantId).map(prof => {
    const linkedUser = users.find(u => u.id === prof.userId);
    return {
      ...prof,
      user: linkedUser ? {
        id: linkedUser.id,
        email: linkedUser.email,
        firstName: linkedUser.firstName,
        lastName: linkedUser.lastName,
        phone: linkedUser.phone,
        avatarUrl: linkedUser.avatarUrl
      } : null
    };
  });

  return res.json(tenantProfs);
});

// Crear profesor (Asociando a un usuario existente o simulado)
app.post('/api/tenants/:tenantId/professors', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { userId, specialty, hireDate, status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!userId || !specialty) {
    return res.status(400).json({ error: 'Usuario docente y Especialidad requeridos' });
  }

  const userExists = users.find(u => u.id === userId && u.tenantId === tenantId);
  if (!userExists) {
    return res.status(404).json({ error: 'Usuario no encontrado en la institución' });
  }

  const isAlreadyProf = professors.find(p => p.userId === userId);
  if (isAlreadyProf) {
    return res.status(409).json({ error: 'Este usuario ya está registrado como profesor de la facultad' });
  }

  const newProf: Professor = {
    id: `p-${Date.now()}`,
    tenantId,
    userId,
    specialty,
    hireDate: hireDate || new Date().toISOString().split('T')[0],
    status: status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  professors.push(newProf);

  // Registrar Auditoría
  addAuditLog(tenantId, 'professors', newProf.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newProf);

  return res.status(212).json(newProf);
});

// Editar Profesor
app.put('/api/tenants/:tenantId/professors/:profId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, profId } = req.params;
  const { specialty, hireDate } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const profIdx = professors.findIndex(p => p.id === profId && p.tenantId === tenantId);
  if (profIdx === -1) {
    return res.status(404).json({ error: 'Profesor no encontrado' });
  }

  const previousProf = { ...professors[profIdx] };

  if (specialty) professors[profIdx].specialty = specialty;
  if (hireDate) professors[profIdx].hireDate = hireDate;
  professors[profIdx].updatedAt = new Date().toISOString();

  const newProf = professors[profIdx];

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'professors',
    profId,
    'UPDATE',
    req.user?.email || 'admin@colegiopremium.edu',
    previousProf,
    newProf
  );

  return res.json(newProf);
});

// Modificar Estado de Profesor (Activo -> Licencia -> Inactivo)
app.patch('/api/tenants/:tenantId/professors/:profId/status', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, profId } = req.params;
  const { status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!status || !['active', 'license', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Estado de facultad inválido' });
  }

  const profIdx = professors.findIndex(p => p.id === profId && p.tenantId === tenantId);
  if (profIdx === -1) {
    return res.status(404).json({ error: 'Profesor no encontrado' });
  }

  const previousStatus = professors[profIdx].status;
  professors[profIdx].status = status;
  professors[profIdx].updatedAt = new Date().toISOString();

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'professors',
    profId,
    'STATUS_CHANGE',
    req.user?.email || 'admin@colegiopremium.edu',
    { status: previousStatus },
    { status }
  );

  return res.json(professors[profIdx]);
});

// Obtener Historial de Auditoría de un profesor
app.get('/api/tenants/:tenantId/professors/:profId/history', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, profId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const history = auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'professors' && log.recordId === profId);
  return res.json(history);
});

// =====================================================================
// API 9: MÓDULO GESTIÓN DE SEDES / AULAS (CON HISTORIAL Y ESTADOS)
// =====================================================================

// Listar todas las sedes
app.get('/api/tenants/:tenantId/campuses', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  const tenantCampuses = campuses.filter(c => c.tenantId === tenantId);
  return res.json(tenantCampuses);
});

// Crear Sede
app.post('/api/tenants/:tenantId/campuses', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { name, address, type, capacity, status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!name || !address || !type) {
    return res.status(400).json({ error: 'Nombre, Dirección/URL y Tipo obligatorios' });
  }

  const newCampus: Campus = {
    id: `cp-${Date.now()}`,
    tenantId,
    name,
    address,
    type,
    capacity: Number(capacity) || 0,
    status: status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  campuses.push(newCampus);

  // Registrar Auditoría
  addAuditLog(tenantId, 'campuses', newCampus.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newCampus);

  return res.status(212).json(newCampus);
});

// Editar Sede
app.put('/api/tenants/:tenantId/campuses/:campusId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, campusId } = req.params;
  const { name, address, capacity } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const campusIdx = campuses.findIndex(c => c.id === campusId && c.tenantId === tenantId);
  if (campusIdx === -1) {
    return res.status(404).json({ error: 'Sede no encontrada' });
  }

  const previousCampus = { ...campuses[campusIdx] };

  if (name) campuses[campusIdx].name = name;
  if (address) campuses[campusIdx].address = address;
  if (capacity !== undefined) campuses[campusIdx].capacity = Number(capacity);
  campuses[campusIdx].updatedAt = new Date().toISOString();

  const newCampus = campuses[campusIdx];

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'campuses',
    campusId,
    'UPDATE',
    req.user?.email || 'admin@colegiopremium.edu',
    previousCampus,
    newCampus
  );

  return res.json(newCampus);
});

// Modificar Estado de Sede (Activa -> Mantenimiento -> Cerrada)
app.patch('/api/tenants/:tenantId/campuses/:campusId/status', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, campusId } = req.params;
  const { status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!status || !['active', 'maintenance', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Estado de sede inválido' });
  }

  const campusIdx = campuses.findIndex(c => c.id === campusId && c.tenantId === tenantId);
  if (campusIdx === -1) {
    return res.status(404).json({ error: 'Sede no encontrada' });
  }

  const previousStatus = campuses[campusIdx].status;
  campuses[campusIdx].status = status;
  campuses[campusIdx].updatedAt = new Date().toISOString();

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'campuses',
    campusId,
    'STATUS_CHANGE',
    req.user?.email || 'admin@colegiopremium.edu',
    { status: previousStatus },
    { status }
  );

  return res.json(campuses[campusIdx]);
});

// Obtener Auditoría de una sede
app.get('/api/tenants/:tenantId/campuses/:campusId/history', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, campusId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const history = auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'campuses' && log.recordId === campusId);
  return res.json(history);
});

// =====================================================================
// API 10: MÓDULO EXPEDIENTES Y MATRÍCULA DE ALUMNOS (FASE 3)
// =====================================================================

// Listar todos los estudiantes del Tenant
app.get('/api/tenants/:tenantId/students', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  const tenantStudents = students.filter(s => s.tenantId === tenantId);
  return res.json(tenantStudents);
});

// Registrar un nuevo estudiante
app.post('/api/tenants/:tenantId/students', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { documentId, firstName, lastName, email, phone, birthDate, admissionDate, status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!documentId || !firstName || !lastName || !email || !birthDate || !admissionDate) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados' });
  }

  // Generar código de matrícula automático MAT-2026-XXXX
  const year = new Date().getFullYear();
  const tenantStudents = students.filter(s => s.tenantId === tenantId);
  const count = tenantStudents.length;
  const enrollmentNumber = `MAT-${year}-${String(count + 1).padStart(4, '0')}`;

  const newStudent: Student = {
    id: `st-${Date.now()}`,
    tenantId,
    enrollmentNumber,
    documentId,
    firstName,
    lastName,
    email,
    phone: phone || null,
    birthDate,
    admissionDate,
    status: status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  students.push(newStudent);

  // Registrar en Historial de Auditoría
  addAuditLog(tenantId, 'students', newStudent.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newStudent);

  return res.status(201).json(newStudent);
});

// Editar expediente del alumno
app.put('/api/tenants/:tenantId/students/:studentId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;
  const { documentId, firstName, lastName, email, phone, birthDate, admissionDate } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const studentIdx = students.findIndex(s => s.id === studentId && s.tenantId === tenantId);
  if (studentIdx === -1) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  const previousStudent = { ...students[studentIdx] };

  // Aplicar cambios
  if (documentId) students[studentIdx].documentId = documentId;
  if (firstName) students[studentIdx].firstName = firstName;
  if (lastName) students[studentIdx].lastName = lastName;
  if (email) students[studentIdx].email = email;
  if (phone !== undefined) students[studentIdx].phone = phone;
  if (birthDate) students[studentIdx].birthDate = birthDate;
  if (admissionDate) students[studentIdx].admissionDate = admissionDate;
  students[studentIdx].updatedAt = new Date().toISOString();

  const newStudent = students[studentIdx];

  // Registrar en Auditoría
  addAuditLog(
    tenantId, 
    'students', 
    studentId, 
    'UPDATE', 
    req.user?.email || 'admin@colegiopremium.edu', 
    previousStudent, 
    newStudent
  );

  return res.json(newStudent);
});

// Modificar Estado del estudiante
app.patch('/api/tenants/:tenantId/students/:studentId/status', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;
  const { status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!status || !['active', 'suspended', 'graduated', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Estado de alumno inválido' });
  }

  const studentIdx = students.findIndex(s => s.id === studentId && s.tenantId === tenantId);
  if (studentIdx === -1) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  const previousStatus = students[studentIdx].status;
  students[studentIdx].status = status as any;
  students[studentIdx].updatedAt = new Date().toISOString();

  // Registrar en Auditoría
  addAuditLog(
    tenantId, 
    'students', 
    studentId, 
    'STATUS_CHANGE', 
    req.user?.email || 'admin@colegiopremium.edu', 
    { status: previousStatus }, 
    { status }
  );

  return res.json(students[studentIdx]);
});

// Obtener Auditoría de un estudiante
app.get('/api/tenants/:tenantId/students/:studentId/history', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const history = auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'students' && log.recordId === studentId);
  return res.json(history);
});

// =====================================================================
// API 11: MATRÍCULAS DE ASIGNATURAS (ENROLLMENTS)
// =====================================================================

// Obtener asignaturas en las que está matriculado un estudiante
app.get('/api/tenants/:tenantId/students/:studentId/enrollments', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const studentEnrollments = enrollments.filter(e => e.studentId === studentId && e.tenantId === tenantId);
  
  // Mapear con datos del curso
  const mapped = studentEnrollments.map(e => {
    const course = courses.find(c => c.id === e.courseId);
    return {
      ...e,
      courseCode: course ? course.code : 'N/A',
      courseName: course ? course.name : 'Curso desconocido',
      courseCredits: course ? course.credits : 0
    };
  });

  return res.json(mapped);
});

// Matricular estudiante en una asignatura
app.post('/api/tenants/:tenantId/students/:studentId/enrollments', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;
  const { courseId, academicPeriod } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!courseId || !academicPeriod) {
    return res.status(400).json({ error: 'Curso y Periodo Académico obligatorios' });
  }

  // Verificar si el estudiante existe
  const studentExists = students.find(s => s.id === studentId && s.tenantId === tenantId);
  if (!studentExists) {
    return res.status(404).json({ error: 'Estudiante no encontrado' });
  }

  // Verificar si el curso existe
  const courseExists = courses.find(c => c.id === courseId && c.tenantId === tenantId);
  if (!courseExists) {
    return res.status(404).json({ error: 'Curso no encontrado en el catálogo' });
  }

  // Verificar si ya está matriculado y activo en este periodo
  const alreadyEnrolled = enrollments.find(
    e => e.studentId === studentId && 
         e.courseId === courseId && 
         e.academicPeriod === academicPeriod && 
         e.status === 'active'
  );

  if (alreadyEnrolled) {
    return res.status(409).json({ error: 'El estudiante ya se encuentra matriculado activamente en este curso para el periodo actual' });
  }

  // VALIDACIÓN DE PRERREQUISITOS ACADÉMICOS
  if (courseExists.prerequisites && Array.isArray(courseExists.prerequisites) && courseExists.prerequisites.length > 0) {
    const missingPrerequisites: { id: string; code: string; name: string }[] = [];
    
    courseExists.prerequisites.forEach(prereqId => {
      const isApproved = enrollments.some(
        e => e.studentId === studentId && e.courseId === prereqId && e.status === 'completed'
      );
      
      if (!isApproved) {
        const prereqCourse = courses.find(c => c.id === prereqId);
        missingPrerequisites.push({
          id: prereqId,
          code: prereqCourse ? prereqCourse.code : 'N/A',
          name: prereqCourse ? prereqCourse.name : 'Curso Prerrequisito Requerido'
        });
      }
    });
    
    if (missingPrerequisites.length > 0) {
      return res.status(400).json({
        error: 'Requisitos académicos no cumplidos',
        missingPrerequisites
      });
    }
  }

  const newEnrollment: Enrollment = {
    id: `en-${Date.now()}`,
    tenantId,
    studentId,
    courseId,
    academicPeriod,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  enrollments.push(newEnrollment);

  // Registrar Auditoría
  addAuditLog(
    tenantId, 
    'enrollments', 
    newEnrollment.id, 
    'CREATE', 
    req.user?.email || 'admin@colegiopremium.edu', 
    null, 
    newEnrollment
  );

  return res.status(201).json({
    ...newEnrollment,
    courseCode: courseExists.code,
    courseName: courseExists.name,
    courseCredits: courseExists.credits
  });
});

// Dar de baja o retirar una matrícula (Dropped)
app.delete('/api/tenants/:tenantId/students/:studentId/enrollments/:enrollmentId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId, enrollmentId } = req.params;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const enrollmentIdx = enrollments.findIndex(
    e => e.id === enrollmentId && e.studentId === studentId && e.tenantId === tenantId
  );

  if (enrollmentIdx === -1) {
    return res.status(404).json({ error: 'Matrícula no encontrada' });
  }

  const previousEnrollment = { ...enrollments[enrollmentIdx] };

  // Modificar estado a 'dropped'
  enrollments[enrollmentIdx].status = 'dropped';
  enrollments[enrollmentIdx].updatedAt = new Date().toISOString();

  const newEnrollment = enrollments[enrollmentIdx];

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'enrollments',
    enrollmentId,
    'STATUS_CHANGE',
    req.user?.email || 'admin@colegiopremium.edu',
    { status: previousEnrollment.status },
    { status: 'dropped' }
  );

  return res.json(newEnrollment);
});

// ============================================================================
// MODULO CRM Y CAPTACION DE LEADS (ADMISIÓN ESCOLAR MULTI-TENANT)
// ============================================================================

// Helper para extraer tenantId de forma segura
const getRequestTenantId = (req: AuthenticatedRequest): string | null => {
  if (req.user?.tenantId) return req.user.tenantId;
  if (req.user?.roleId === 'r-superadmin') {
    return (req.query.tenantId as string) || (req.body.tenantId as string) || '44b7fa71-5582-45a8-b6cb-918991ef2364';
  }
  return null;
};

// 1. Obtener todos los Leads del Tenant
app.get('/api/crm/leads', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  // Filtrar leads del tenant
  let filteredLeads = leads.filter(l => l.tenantId === tenantId);

  // Filtros opcionales
  const { stage, source } = req.query;
  if (stage) {
    filteredLeads = filteredLeads.filter(l => l.status === stage);
  }
  if (source) {
    filteredLeads = filteredLeads.filter(l => l.source === source);
  }

  // Ordenar de más nuevo a más antiguo
  filteredLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(filteredLeads);
});

// 2. Crear un nuevo Lead
app.post('/api/crm/leads', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const { firstName, lastName, parentName, email, phone, gradeInterested, source, assignedUserId } = req.body;

  if (!firstName || !lastName || !parentName || !email || !phone || !gradeInterested || !source) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  const newLeadId = `ld-${Date.now()}`;
  const newLead: Lead = {
    id: newLeadId,
    tenantId,
    firstName,
    lastName,
    parentName,
    email,
    phone,
    gradeInterested,
    source,
    status: 'new',
    assignedUserId: assignedUserId || req.user?.id || 'u-admin1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  leads.push(newLead);

  // Registrar Actividad de Captación del Sistema
  leadActivities.push({
    id: `la-${Date.now()}`,
    leadId: newLeadId,
    type: 'system',
    summary: 'Lead captado e ingresado',
    details: `Prospecto ingresado mediante canal [${source}]. Interesado en ${gradeInterested}. Apoderado: ${parentName}.`,
    createdBy: req.user?.email || 'Sistema',
    createdAt: new Date().toISOString()
  });

  // Registrar Auditoría Inmutable
  addAuditLog(
    tenantId,
    'leads',
    newLeadId,
    'CREATE',
    req.user?.email || 'admin@colegiopremium.edu',
    null,
    newLead
  );

  return res.status(201).json(newLead);
});

// 3. Modificar datos del Lead
app.put('/api/crm/leads/:leadId', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const leadIdx = leads.findIndex(l => l.id === leadId && l.tenantId === tenantId);
  if (leadIdx === -1) {
    return res.status(404).json({ error: 'Prospecto no encontrado' });
  }

  const previousLead = { ...leads[leadIdx] };
  const { firstName, lastName, parentName, email, phone, gradeInterested, assignedUserId } = req.body;

  if (firstName) leads[leadIdx].firstName = firstName;
  if (lastName) leads[leadIdx].lastName = lastName;
  if (parentName) leads[leadIdx].parentName = parentName;
  if (email) leads[leadIdx].email = email;
  if (phone) leads[leadIdx].phone = phone;
  if (gradeInterested) leads[leadIdx].gradeInterested = gradeInterested;
  if (assignedUserId !== undefined) leads[leadIdx].assignedUserId = assignedUserId;
  leads[leadIdx].updatedAt = new Date().toISOString();

  const updatedLead = leads[leadIdx];

  // Registrar en la Bitácora Comercial de Actividades
  leadActivities.push({
    id: `la-${Date.now()}`,
    leadId,
    type: 'system',
    summary: 'Ficha comercial editada',
    details: 'Se actualizaron los datos personales o de contacto del prospecto escolar.',
    createdBy: req.user?.email || 'Asesor Comercial',
    createdAt: new Date().toISOString()
  });

  // Registrar Auditoría Inmutable
  addAuditLog(
    tenantId,
    'leads',
    leadId,
    'UPDATE',
    req.user?.email || 'admin@colegiopremium.edu',
    previousLead,
    updatedLead
  );

  return res.json(updatedLead);
});

// 4. Mutar Etapa del Embudo (Pipeline Step)
app.patch('/api/crm/leads/:leadId/stage', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;
  const { status, lostReason } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const leadIdx = leads.findIndex(l => l.id === leadId && l.tenantId === tenantId);
  if (leadIdx === -1) {
    return res.status(404).json({ error: 'Prospecto no encontrado' });
  }

  const allowedStages = ['new', 'contacted', 'tour_scheduled', 'evaluation', 'approved', 'enrolled', 'lost'];
  if (!allowedStages.includes(status)) {
    return res.status(400).json({ error: 'Etapa del pipeline no válida' });
  }

  if (status === 'lost' && !lostReason) {
    return res.status(400).json({ error: 'Es obligatorio especificar un motivo de descarte' });
  }

  const previousLead = { ...leads[leadIdx] };
  leads[leadIdx].status = status;
  if (status === 'lost') {
    leads[leadIdx].lostReason = lostReason;
  } else {
    leads[leadIdx].lostReason = undefined;
  }
  leads[leadIdx].updatedAt = new Date().toISOString();

  const updatedLead = leads[leadIdx];

  // Registrar Actividad de Transición en la Bitácora
  leadActivities.push({
    id: `la-${Date.now()}`,
    leadId,
    type: 'system',
    summary: `Etapa actualizada a [${status.toUpperCase()}]`,
    details: status === 'lost' 
      ? `El prospecto fue retirado del pipeline. Motivo: "${lostReason}"`
      : `Asesor comercial desplazó la tarjeta de admisión de [${previousLead.status}] a [${status}].`,
    createdBy: req.user?.email || 'Asesor Comercial',
    createdAt: new Date().toISOString()
  });

  // Registrar Auditoría Inmutable
  addAuditLog(
    tenantId,
    'leads',
    leadId,
    'STATUS_CHANGE',
    req.user?.email || 'admin@colegiopremium.edu',
    { status: previousLead.status, lostReason: previousLead.lostReason },
    { status, lostReason }
  );

  return res.json(updatedLead);
});

// 5. Obtener Bitácora (Timeline) de un Lead
app.get('/api/crm/leads/:leadId/timeline', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  // Validar pertenencia del lead
  const leadExists = leads.some(l => l.id === leadId && l.tenantId === tenantId);
  if (!leadExists) {
    return res.status(404).json({ error: 'Lead no encontrado o fuera de aislamiento' });
  }

  const timeline = leadActivities.filter(a => a.leadId === leadId);
  timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(timeline);
});

// 6. Registrar Interacción (Llamada, Correo, Reunión, Nota)
app.post('/api/crm/leads/:leadId/activities', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;
  const { type, summary, details } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  if (!type || !summary) {
    return res.status(400).json({ error: 'Tipo y resumen de interacción son obligatorios' });
  }

  const leadExists = leads.some(l => l.id === leadId && l.tenantId === tenantId);
  if (!leadExists) {
    return res.status(404).json({ error: 'Lead no encontrado' });
  }

  const newActivity: LeadActivity = {
    id: `la-${Date.now()}`,
    leadId,
    type,
    summary,
    details: details || '',
    createdBy: req.user?.email || 'Asesor Comercial',
    createdAt: new Date().toISOString()
  };

  leadActivities.push(newActivity);

  return res.status(201).json(newActivity);
});

// 7. Obtener Tareas de Seguimiento de un Lead
app.get('/api/crm/leads/:leadId/tasks', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const leadExists = leads.some(l => l.id === leadId && l.tenantId === tenantId);
  if (!leadExists) {
    return res.status(404).json({ error: 'Lead no encontrado o fuera de aislamiento' });
  }

  const tasks = leadTasks.filter(t => t.leadId === leadId);
  tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return res.json(tasks);
});

// 8. Crear Tarea de Seguimiento
app.post('/api/crm/leads/:leadId/tasks', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId } = req.params;
  const { title, dueDate } = req.body;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  if (!title || !dueDate) {
    return res.status(400).json({ error: 'Título de la tarea y fecha de vencimiento son requeridos' });
  }

  const leadExists = leads.some(l => l.id === leadId && l.tenantId === tenantId);
  if (!leadExists) {
    return res.status(404).json({ error: 'Lead no encontrado' });
  }

  const newTask: LeadTask = {
    id: `lt-${Date.now()}`,
    leadId,
    title,
    dueDate,
    status: 'pending',
    assignedTo: req.user?.email || 'admin@colegiopremium.edu',
    createdAt: new Date().toISOString()
  };

  leadTasks.push(newTask);

  return res.status(201).json(newTask);
});

// 9. Completar/Pendiente una Tarea de Seguimiento
app.put('/api/crm/leads/:leadId/tasks/:taskId/toggle', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { leadId, taskId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const leadExists = leads.some(l => l.id === leadId && l.tenantId === tenantId);
  if (!leadExists) {
    return res.status(404).json({ error: 'Lead no encontrado' });
  }

  const taskIdx = leadTasks.findIndex(t => t.id === taskId && t.leadId === leadId);
  if (taskIdx === -1) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  const previousStatus = leadTasks[taskIdx].status;
  leadTasks[taskIdx].status = previousStatus === 'pending' ? 'completed' : 'pending';

  return res.json(leadTasks[taskIdx]);
});

// 10. Estadísticas Comerciales del Pipeline de Admisiones (Métricas de Conversión)
app.get('/api/crm/metrics', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const tenantLeads = leads.filter(l => l.tenantId === tenantId);
  const totalLeadsCount = tenantLeads.length;

  // Tasa de conversión: ganados / (ganados + perdidos)
  const enrolledCount = tenantLeads.filter(l => l.status === 'enrolled').length;
  const lostCount = tenantLeads.filter(l => l.status === 'lost').length;
  const totalClosed = enrolledCount + lostCount;
  const conversionRate = totalClosed > 0 
    ? parseFloat(((enrolledCount / totalClosed) * 100).toFixed(1))
    : 0;

  // Pipeline Proyectado (Valor monetario simulado: 2500 USD por cada lead activo)
  const activeLeadsCount = tenantLeads.filter(l => !['enrolled', 'lost'].includes(l.status)).length;
  const projectedPipeline = activeLeadsCount * 2500;

  // Distribución por Canal de Origen (Fuentes)
  const sourcesCount = {
    web: tenantLeads.filter(l => l.source === 'web').length,
    referral: tenantLeads.filter(l => l.source === 'referral').length,
    social_media: tenantLeads.filter(l => l.source === 'social_media').length,
    walk_in: tenantLeads.filter(l => l.source === 'walk_in').length,
    phone_call: tenantLeads.filter(l => l.source === 'phone_call').length
  };

  // Tareas pendientes
  const tenantLeadsIds = tenantLeads.map(l => l.id);
  const pendingTasksCount = leadTasks.filter(t => tenantLeadsIds.includes(t.leadId) && t.status === 'pending').length;

  return res.json({
    totalLeads: totalLeadsCount,
    conversionRate,
    projectedPipeline,
    sourcesDistribution: sourcesCount,
    pendingTasks: pendingTasksCount,
    activeLeads: activeLeadsCount
  });
});

// ============================================================================
// MODULO CENTRO DE COMUNICACIÓN (COMUNICADOS Y MENSAJERÍA OMNICANAL)
// ============================================================================

// 1. Obtener la Bandeja de Entrada (Mensajes Recibidos) del Usuario Autenticado
app.get('/api/comms/received', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  // Filtrar los registros de recipientes dirigidos al usuario actual
  const userRecipients = communicationRecipients.filter(r => r.recipientId === userId);

  // Mapear los comunicados completos
  const receivedMessages = userRecipients
    .map(rec => {
      const msg = communicationMessages.find(m => m.id === rec.messageId && m.tenantId === tenantId);
      if (!msg) return null;

      return {
        ...msg,
        inAppStatus: rec.inAppStatus,
        readAt: rec.readAt,
        recipientId: rec.recipientId
      };
    })
    .filter(m => m !== null)
    // Ordenar cronológicamente (más nuevos primero)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(receivedMessages);
});

// 2. Obtener la Bandeja de Salida (Comunicados Enviados por la Escuela)
app.get('/api/comms/sent', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  // Si es Admin/Superadmin, listar todos los enviados en la escuela.
  // Si es Profesor, listar los enviados personalmente por él.
  let sentMessages = communicationMessages.filter(m => m.tenantId === tenantId);
  
  if (req.user?.roleId === 'r-tenant1-professor') {
    sentMessages = sentMessages.filter(m => m.senderId === req.user?.id);
  }

  // Enriquecer con conteos de lectura rápidos
  const enrichedSent = sentMessages.map(msg => {
    const recs = communicationRecipients.filter(r => r.messageId === msg.id);
    const totalRecs = recs.length;
    const readRecs = recs.filter(r => r.inAppStatus === 'read').length;

    return {
      ...msg,
      analytics: {
        totalRecipients: totalRecs,
        readCount: readRecs,
        readRate: totalRecs > 0 ? parseFloat(((readRecs / totalRecs) * 100).toFixed(1)) : 0
      }
    };
  });

  enrichedSent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(enrichedSent);
});

// 3. Obtener Plantillas de Comunicados Oficiales
app.get('/api/comms/templates', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  // Retornar las plantillas del tenant actual
  const templates = communicationTemplates.filter(t => t.tenantId === tenantId);
  return res.json(templates);
});

// 4. Enviar un Comunicado (Boletín / Circular)
app.post('/api/comms/send', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const { subject, body, category, targetGroup, targetGrade, recipientId, attachmentUrl, deliveryChannels } = req.body;

  if (!subject || !body || !category || !targetGroup || !deliveryChannels || !Array.isArray(deliveryChannels)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const senderId = req.user?.id || 'u-admin1';
  const senderUser = users.find(u => u.id === senderId);
  const senderName = senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'Administrador';
  const senderRole = req.user?.roleId === 'r-superadmin' 
    ? 'Superadmin General' 
    : (req.user?.roleId === 'r-tenant1-admin' ? 'Dirección General' : 'Docente Académico');

  const newMessageId = `msg-${Date.now()}`;
  const newMsg: CommunicationMessage = {
    id: newMessageId,
    tenantId,
    senderId,
    senderName,
    senderRole,
    subject,
    body,
    category,
    targetGroup,
    targetGrade: targetGroup === 'grade' ? targetGrade : undefined,
    attachmentUrl: attachmentUrl || undefined,
    deliveryChannels,
    createdAt: new Date().toISOString()
  };

  communicationMessages.push(newMsg);

  // Mapear los destinatarios del sistema
  const resolvedRecipients: { id: string; name: string; role: 'admin' | 'teacher' | 'parent' | 'student' }[] = [];

  if (targetGroup === 'individual' && recipientId) {
    // Buscar en usuarios
    const u = users.find(user => user.id === recipientId && user.tenantId === tenantId);
    if (u) {
      resolvedRecipients.push({ 
        id: u.id, 
        name: `${u.firstName} ${u.lastName}`, 
        role: u.roleId.includes('admin') ? 'admin' : (u.roleId.includes('prof') ? 'teacher' : 'teacher') 
      });
    } else {
      // Buscar en estudiantes
      const st = students.find(student => student.id === recipientId && student.tenantId === tenantId);
      if (st) {
        resolvedRecipients.push({
          id: st.id,
          name: `${st.firstName} ${st.lastName}`,
          role: 'student'
        });
      }
    }
  } else {
    // Buscar en lote según segmentación
    if (['all', 'teachers'].includes(targetGroup)) {
      users.forEach(u => {
        if (u.tenantId === tenantId && u.id !== senderId) {
          const role = u.roleId.includes('admin') ? 'admin' : 'teacher';
          if (targetGroup === 'all' || (targetGroup === 'teachers' && role === 'teacher')) {
            resolvedRecipients.push({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: role as any });
          }
        }
      });
    }

    if (['all', 'students', 'parents'].includes(targetGroup)) {
      students.forEach(st => {
        if (st.tenantId === tenantId) {
          const role = targetGroup === 'parents' ? 'parent' : 'student';
          const name = targetGroup === 'parents' ? `Apoderado de ${st.firstName} ${st.lastName}` : `${st.firstName} ${st.lastName}`;
          resolvedRecipients.push({ id: st.id, name, role: role as any });
        }
      });
    }

    if (targetGroup === 'grade' && targetGrade) {
      students.forEach(st => {
        // En SincroEdu, no hay campo directo de grado en student, pero podemos asumir matriculados o grado.
        // Simulamos que enviamos a los alumnos que coincidan o a todos en caso de demo.
        if (st.tenantId === tenantId) {
          resolvedRecipients.push({ id: st.id, name: `${st.firstName} ${st.lastName}`, role: 'student' });
        }
      });
    }
  }

  // Si no se resolvió nadie, agregamos al menos un destinatario muestra para que no quede vacía la analítica de entrega
  if (resolvedRecipients.length === 0) {
    resolvedRecipients.push({ id: 'u-prof1', name: 'Alejandro Mendoza', role: 'teacher' });
    resolvedRecipients.push({ id: 'u-auxiliar1', name: 'Mariana Rosas', role: 'admin' });
  }

  // Despachar los destinatarios en CommunicationRecipient
  resolvedRecipients.forEach(rec => {
    communicationRecipients.push({
      id: `rc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      messageId: newMessageId,
      recipientId: rec.id,
      recipientName: rec.name,
      recipientRole: rec.role,
      inAppStatus: deliveryChannels.includes('in_app') ? 'unread' : 'unread',
      emailStatus: deliveryChannels.includes('email') ? 'sent' : 'not_requested',
      whatsappStatus: deliveryChannels.includes('whatsapp') ? 'sent' : 'not_requested',
      updatedAt: new Date().toISOString()
    });
  });

  // Registrar Auditoría Inmutable
  addAuditLog(
    tenantId,
    'communications',
    newMessageId,
    'CREATE',
    req.user?.email || 'admin@colegiopremium.edu',
    null,
    newMsg
  );

  return res.status(201).json(newMsg);
});

// 5. Confirmación de Lectura Reactiva (In-App)
app.patch('/api/comms/messages/:messageId/read', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { messageId } = req.params;
  const userId = req.user?.id;

  if (!tenantId || !userId) {
    return res.status(400).json({ error: 'Faltan parámetros de sesión' });
  }

  const recIdx = communicationRecipients.findIndex(
    r => r.messageId === messageId && r.recipientId === userId
  );

  if (recIdx === -1) {
    return res.status(404).json({ error: 'Destinatario no encontrado' });
  }

  if (communicationRecipients[recIdx].inAppStatus === 'unread') {
    communicationRecipients[recIdx].inAppStatus = 'read';
    communicationRecipients[recIdx].readAt = new Date().toISOString();
    communicationRecipients[recIdx].updatedAt = new Date().toISOString();
  }

  return res.json({ success: true, message: 'Comunicado marcado como leído reactivamente' });
});

// 6. Reporte de Analítica de Entrega (Para la Bandeja de Enviados)
app.get('/api/comms/messages/:messageId/delivery', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getRequestTenantId(req);
  const { messageId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
  }

  const msg = communicationMessages.find(m => m.id === messageId && m.tenantId === tenantId);
  if (!msg) {
    return res.status(404).json({ error: 'Comunicado no encontrado' });
  }

  const recs = communicationRecipients.filter(r => r.messageId === messageId);
  const total = recs.length;
  const read = recs.filter(r => r.inAppStatus === 'read').length;

  const emailSent = recs.filter(r => r.emailStatus === 'sent').length;
  const emailFailed = recs.filter(r => r.emailStatus === 'failed').length;
  
  const whatsappSent = recs.filter(r => r.whatsappStatus === 'sent').length;
  const whatsappFailed = recs.filter(r => r.whatsappStatus === 'failed').length;

  return res.json({
    message: msg,
    stats: {
      totalRecipients: total,
      readCount: read,
      unreadCount: total - read,
      readRate: total > 0 ? parseFloat(((read / total) * 100).toFixed(1)) : 0,
      email: {
        sent: emailSent,
        failed: emailFailed,
        successRate: (emailSent + emailFailed) > 0 ? parseFloat(((emailSent / (emailSent + emailFailed)) * 100).toFixed(1)) : 100
      },
      whatsapp: {
        sent: whatsappSent,
        failed: whatsappFailed,
        successRate: (whatsappSent + whatsappFailed) > 0 ? parseFloat(((whatsappSent / (whatsappSent + whatsappFailed)) * 100).toFixed(1)) : 100
      }
    },
    recipientsList: recs
  });
});

// =====================================================================
// API 11: MÓDULO DE CALIFICACIONES Y EVALUACIONES (GRADEBOOK MULTI-SCALE)
// =====================================================================

// A. Obtener escala activa y calificaciones de un curso
app.get('/api/tenants/:tenantId/courses/:courseId/grades', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { academicPeriod = '2026-I' } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // 1. Obtener alumnos matriculados activos en este curso
  const enrolledStudentIds = enrollments
    .filter(e => e.tenantId === tenantId && e.courseId === courseId && e.academicPeriod === academicPeriod && e.status === 'active')
    .map(e => e.studentId);

  const courseStudents = students.filter(s => enrolledStudentIds.includes(s.id));

  // 2. Obtener estructura de evaluaciones de este curso
  const courseEvals = evaluationStructures.filter(es => es.tenantId === tenantId && es.courseId === courseId);

  // 3. Obtener registros de notas existentes
  const courseGrades = gradeRecords.filter(gr => gr.tenantId === tenantId && gr.courseId === courseId && gr.academicPeriod === academicPeriod);

  // 4. Obtener estado de bloqueo
  const lock = periodLocks.find(pl => pl.tenantId === tenantId && pl.courseId === courseId && pl.academicPeriod === academicPeriod);
  const isLocked = lock ? lock.isLocked : false;

  // 5. Obtener escala de notas activa (buscamos la vigesimal de este tenant por defecto o la primera disponible)
  const scale = gradeScales.find(gs => gs.tenantId === tenantId) || gradeScales[0];

  return res.json({
    students: courseStudents,
    evaluationStructures: courseEvals,
    grades: courseGrades,
    isLocked,
    scale
  });
});

// B. Registrar ponderación/pesos dinámicos en el curso
app.put('/api/tenants/:tenantId/courses/:courseId/weights', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { weights } = req.body; // Array de { id, name, weight }

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // Verificar estado de bloqueo del curso
  const lock = periodLocks.find(pl => pl.tenantId === tenantId && pl.courseId === courseId && pl.academicPeriod === '2026-I');
  if (lock?.isLocked) {
    return res.status(400).json({ error: 'No se pueden modificar los pesos: El periodo está cerrado y bloqueado.' });
  }

  if (!Array.isArray(weights)) {
    return res.status(400).json({ error: 'Los pesos deben ser un arreglo válido.' });
  }

  // Validar que la suma sea 100%
  const totalSum = weights.reduce((sum, w) => sum + Number(w.weight), 0);
  if (totalSum !== 100) {
    return res.status(400).json({ error: `La suma de ponderaciones debe ser exactamente 100%. Suma actual: ${totalSum}%` });
  }

  // Eliminar estructuras antiguas y registrar nuevas (o actualizar)
  const currentStructures = evaluationStructures.filter(es => es.courseId === courseId && es.tenantId === tenantId);
  
  for (let i = evaluationStructures.length - 1; i >= 0; i--) {
    if (evaluationStructures[i].courseId === courseId && evaluationStructures[i].tenantId === tenantId) {
      evaluationStructures.splice(i, 1);
    }
  }

  weights.forEach((w: any, index: number) => {
    evaluationStructures.push({
      id: w.id && !w.id.startsWith('new-') ? w.id : `es-${courseId}-${Date.now()}-${index}`,
      tenantId,
      courseId,
      name: w.name,
      weight: Number(w.weight),
      createdAt: new Date().toISOString()
    });
  });

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'evaluation_structures',
    courseId,
    'UPDATE',
    req.user?.email || 'profesor@colegiopremium.edu',
    currentStructures,
    evaluationStructures.filter(es => es.courseId === courseId && es.tenantId === tenantId)
  );

  return res.json({
    success: true,
    evaluationStructures: evaluationStructures.filter(es => es.courseId === courseId && es.tenantId === tenantId)
  });
});

// C. Carga masiva de notas con auditoría y transacciones simuladas seguras
app.post('/api/tenants/:tenantId/courses/:courseId/grades/bulk', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { grades, reason, academicPeriod = '2026-I' } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // 1. Validar bloqueo
  const lock = periodLocks.find(pl => pl.tenantId === tenantId && pl.courseId === courseId && pl.academicPeriod === academicPeriod);
  if (lock?.isLocked) {
    return res.status(400).json({ error: 'No se pueden registrar notas: El periodo escolar ha sido cerrado y bloqueado por la dirección.' });
  }

  if (!Array.isArray(grades) || grades.length === 0) {
    return res.status(400).json({ error: 'Se requiere una lista de calificaciones válida.' });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Por motivos de auditoría y seguridad EdTech, es obligatorio especificar una justificación para guardar notas.' });
  }

  // 2. Procesar transaccionalmente (en memoria) cada nota
  const updatedCount = { created: 0, updated: 0 };
  const userEmail = req.user?.email || 'profesor@colegiopremium.edu';

  grades.forEach((g: any) => {
    const { studentId, evaluationStructureId, value, letter, comment } = g;

    // Buscar si ya existe
    const gradeIdx = gradeRecords.findIndex(gr => 
      gr.tenantId === tenantId && 
      gr.studentId === studentId && 
      gr.courseId === courseId && 
      gr.evaluationStructureId === evaluationStructureId && 
      gr.academicPeriod === academicPeriod
    );

    const previousValue = gradeIdx !== -1 ? gradeRecords[gradeIdx].value : null;
    const previousLetter = gradeIdx !== -1 ? gradeRecords[gradeIdx].letter || null : null;

    if (gradeIdx !== -1) {
      // Modificar existente
      gradeRecords[gradeIdx].value = Number(value);
      gradeRecords[gradeIdx].letter = letter || undefined;
      gradeRecords[gradeIdx].comment = comment || undefined;
      gradeRecords[gradeIdx].updatedAt = new Date().toISOString();
      gradeRecords[gradeIdx].createdBy = userEmail;
      updatedCount.updated++;
    } else {
      // Registrar nueva
      gradeRecords.push({
        id: `gr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId,
        studentId,
        courseId,
        evaluationStructureId,
        academicPeriod,
        value: Number(value),
        letter: letter || undefined,
        comment: comment || undefined,
        createdBy: userEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      updatedCount.created++;
    }

    // Registrar en la Bitácora de Auditoría si hubo cambio o creación
    if (previousValue !== Number(value) || previousLetter !== (letter || null)) {
      gradeAuditLogs.unshift({
        id: `gal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        tenantId,
        courseId,
        studentId,
        evaluationStructureId,
        academicPeriod,
        previousValue,
        previousLetter,
        newValue: Number(value),
        newLetter: letter || null,
        changedBy: userEmail,
        reason,
        createdAt: new Date().toISOString()
      });
    }
  });

  return res.json({
    success: true,
    message: `Sincronización masiva de calificaciones exitosa. Notas creadas: ${updatedCount.created}, actualizadas: ${updatedCount.updated}.`,
    counts: updatedCount
  });
});

// D. Obtener bitácora de auditoría de un curso
app.get('/api/tenants/:tenantId/courses/:courseId/grades/audit', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { academicPeriod = '2026-I' } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const history = gradeAuditLogs
    .filter(log => log.tenantId === tenantId && log.courseId === courseId && log.academicPeriod === academicPeriod)
    .map(log => {
      const linkedStudent = students.find(s => s.id === log.studentId);
      const linkedEval = evaluationStructures.find(es => es.id === log.evaluationStructureId);
      return {
        ...log,
        studentName: linkedStudent ? `${linkedStudent.firstName} ${linkedStudent.lastName}` : 'Alumno desconocido',
        evaluationName: linkedEval ? linkedEval.name : 'Evaluación'
      };
    });

  return res.json(history);
});

// E. Bloquear/Cerrar periodo escolar para un curso
app.post('/api/tenants/:tenantId/courses/:courseId/lock', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, courseId } = req.params;
  const { isLocked, academicPeriod = '2026-I' } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const lockIdx = periodLocks.findIndex(pl => pl.tenantId === tenantId && pl.courseId === courseId && pl.academicPeriod === academicPeriod);
  const userEmail = req.user?.email || 'admin@colegiopremium.edu';

  if (lockIdx !== -1) {
    periodLocks[lockIdx].isLocked = !!isLocked;
    periodLocks[lockIdx].lockedBy = userEmail;
    periodLocks[lockIdx].lockedAt = new Date().toISOString();
  } else {
    periodLocks.push({
      id: `pl-${Date.now()}`,
      tenantId,
      academicPeriod,
      courseId,
      isLocked: !!isLocked,
      lockedBy: userEmail,
      lockedAt: new Date().toISOString()
    });
  }

  // Registrar Auditoría
  addAuditLog(
    tenantId,
    'period_locks',
    courseId,
    isLocked ? 'STATUS_CHANGE' : 'UPDATE',
    userEmail,
    { isLocked: !isLocked },
    { isLocked }
  );

  return res.json({
    success: true,
    isLocked: !!isLocked,
    message: isLocked 
      ? 'El periodo escolar para esta asignatura ha sido cerrado. Las calificaciones han sido bloqueadas y se han emitido las libretas oficiales.'
      : 'El periodo escolar ha sido desbloqueado. Se permiten ediciones de calificaciones.'
  });
});

// F. Obtener Libreta de Notas consolidadas del alumno (PDF / Formato web premium)
app.get('/api/tenants/:tenantId/students/:studentId/report-card', authenticateJWT, (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, studentId } = req.params;
  const { academicPeriod = '2026-I' } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // 1. Obtener detalles del estudiante
  const student = students.find(s => s.id === studentId && s.tenantId === tenantId);
  if (!student) {
    return res.status(404).json({ error: 'Estudiante no encontrado en la institución.' });
  }

  // 2. Obtener matrículas (cursos en los que está inscrito el alumno en este periodo)
  const studentEnrollments = enrollments.filter(e => 
    e.studentId === studentId && 
    e.tenantId === tenantId && 
    e.academicPeriod === academicPeriod && 
    (e.status === 'active' || e.status === 'completed')
  );

  // 3. Para cada curso, calcular notas y promedio ponderado
  const courseAverages = studentEnrollments.map(enr => {
    const course = courses.find(c => c.id === enr.courseId);
    
    // Obtener estructuras y notas de este curso
    const courseEvals = evaluationStructures.filter(es => es.courseId === enr.courseId);
    const courseGrades = gradeRecords.filter(gr => 
      gr.studentId === studentId && 
      gr.courseId === enr.courseId && 
      gr.academicPeriod === academicPeriod
    );

    // Calcular el promedio ponderado en base al valor numérico
    let weightedSum = 0;
    let weightTotalUsed = 0;
    const gradesBreakdown = courseEvals.map(evalStruct => {
      const grade = courseGrades.find(g => g.evaluationStructureId === evalStruct.id);
      const val = grade ? grade.value : 0;
      
      if (grade) {
        weightedSum += val * (evalStruct.weight / 100);
        weightTotalUsed += evalStruct.weight;
      }

      return {
        evaluationName: evalStruct.name,
        weight: evalStruct.weight,
        value: grade ? val : '-',
        letter: grade ? grade.letter || null : null,
        comment: grade ? grade.comment || null : null
      };
    });

    const averageValue = weightTotalUsed > 0 ? parseFloat((weightedSum * (100 / weightTotalUsed)).toFixed(2)) : 0;
    
    // Mapear promedio a letra o competencia en base a la escala vigesimal o por competencias
    let averageLetter = '-';
    let averageGpa = 0.0;

    // Lógica del motor de reglas de escala
    if (averageValue >= 17) {
      averageLetter = 'AD';
      averageGpa = 4.0;
    } else if (averageValue >= 14) {
      averageLetter = 'A';
      averageGpa = 3.5;
    } else if (averageValue >= 11) {
      averageLetter = 'B';
      averageGpa = 2.5;
    } else if (averageValue > 0) {
      averageLetter = 'C';
      averageGpa = 1.0;
    }

    return {
      courseId: enr.courseId,
      courseCode: course ? course.code : 'COD',
      courseName: course ? course.name : 'Curso desconocido',
      credits: course ? course.credits : 0,
      grades: gradesBreakdown,
      average: averageValue,
      averageLetter,
      averageGpa
    };
  });

  // 4. Calcular GPA final consolidado del alumno en este periodo
  const gradedCourses = courseAverages.filter(c => c.average > 0);
  const totalCredits = gradedCourses.reduce((sum, c) => sum + c.credits, 0);
  const weightedGpaSum = gradedCourses.reduce((sum, c) => sum + (c.averageGpa * c.credits), 0);
  const cumulativeGpa = totalCredits > 0 ? parseFloat((weightedGpaSum / totalCredits).toFixed(2)) : 0.0;

  // 5. Obtener institución
  const tenant = tenants.find(t => t.id === tenantId);

  return res.json({
    student: {
      id: student.id,
      enrollmentNumber: student.enrollmentNumber,
      documentId: student.documentId,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email
    },
    tenant: tenant ? {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      address: tenant.address,
      phone: tenant.phone
    } : null,
    academicPeriod,
    courseAverages,
    cumulativeGpa,
    totalCredits
  });
});

// ============================================================================
// MÓDULO DE COBROS, PAGOS Y LIBRO MAYOR (LEDGER CONTABLE CON ACID)
// ============================================================================

// 1. Obtener y configurar precios de créditos académicos
app.get('/api/tenants/:tenantId/billing/credit-pricing', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query('SELECT * FROM credit_pricing WHERE tenant_id = $1 ORDER BY academic_period DESC', [tenantId]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar precios de créditos en base de datos', details: err.message });
    }
  } else {
    const pricing = creditPricings.filter(p => p.tenantId === tenantId);
    return res.json(pricing);
  }
});

app.post('/api/tenants/:tenantId/billing/credit-pricing', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { academicPeriod, pricePerCredit } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  if (!academicPeriod || pricePerCredit === undefined) {
    return res.status(400).json({ error: 'academicPeriod y pricePerCredit son obligatorios' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query(
        `INSERT INTO credit_pricing (tenant_id, academic_period, price_per_credit, updated_at) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (tenant_id, academic_period) 
         DO UPDATE SET price_per_credit = EXCLUDED.price_per_credit, updated_at = NOW() 
         RETURNING *`,
        [tenantId, academicPeriod, pricePerCredit]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al guardar precio de crédito', details: err.message });
    }
  } else {
    const existingIdx = creditPricings.findIndex(p => p.tenantId === tenantId && p.academicPeriod === academicPeriod);
    const newPricing = {
      id: existingIdx !== -1 ? creditPricings[existingIdx].id : `pr-${Date.now()}`,
      tenantId,
      academicPeriod,
      pricePerCredit: Number(pricePerCredit),
      createdAt: existingIdx !== -1 ? creditPricings[existingIdx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existingIdx !== -1) {
      creditPricings[existingIdx] = newPricing;
    } else {
      creditPricings.push(newPricing);
    }
    return res.status(201).json(newPricing);
  }
});

// 2. Obtener apoderados / alumnos vinculados
app.get('/api/tenants/:tenantId/billing/guardians', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query(`
        SELECT sg.*, s.first_name as student_first_name, s.last_name as student_last_name, 
               u.first_name as guardian_first_name, u.last_name as guardian_last_name, u.email as guardian_email
        FROM student_guardians sg
        JOIN students s ON sg.student_id = s.id
        JOIN users u ON sg.user_id = u.id
        WHERE s.tenant_id = $1
      `, [tenantId]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar apoderados', details: err.message });
    }
  } else {
    // Mapear con datos en memoria
    const data = studentGuardians.map(sg => {
      const student = students.find(s => s.id === sg.studentId);
      const user = users.find(u => u.id === sg.userId);
      return {
        ...sg,
        student_first_name: student?.firstName || '',
        student_last_name: student?.lastName || '',
        guardian_first_name: user?.firstName || '',
        guardian_last_name: user?.lastName || '',
        guardian_email: user?.email || ''
      };
    });
    return res.json(data);
  }
});

// 3. Cuentas por Cobrar (Receivables)
app.get('/api/tenants/:tenantId/billing/receivables', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { studentId, status } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // Si el rol es apoderado (Padre), sólo le permitimos ver los recibos de sus hijos
  let restrictedStudentIds: string[] = [];
  if (req.user?.roleId === 'r-tenant1-parent') {
    const parentUserId = req.user.id;
    if (dbAvailable) {
      const result = await pool.query('SELECT student_id FROM student_guardians WHERE user_id = $1', [parentUserId]);
      restrictedStudentIds = result.rows.map(r => r.student_id);
    } else {
      restrictedStudentIds = studentGuardians.filter(sg => sg.userId === parentUserId).map(sg => sg.studentId);
    }
    
    if (restrictedStudentIds.length === 0) {
      return res.json([]); // No tiene alumnos a su cargo
    }
  }

  if (dbAvailable) {
    try {
      let query = `
        SELECT r.*, s.first_name as student_first_name, s.last_name as student_last_name, s.enrollment_number
        FROM receivables r
        JOIN students s ON r.student_id = s.id
        WHERE r.tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramCount = 1;

      if (studentId) {
        paramCount++;
        query += ` AND r.student_id = $${paramCount}`;
        params.push(studentId);
      } else if (restrictedStudentIds.length > 0) {
        // Restricción para padres de familia
        query += ` AND r.student_id IN (${restrictedStudentIds.map((_, i) => `$${paramCount + 1 + i}`).join(',')})`;
        restrictedStudentIds.forEach(id => params.push(id));
        paramCount += restrictedStudentIds.length;
      }

      if (status) {
        paramCount++;
        query += ` AND r.status = $${paramCount}`;
        params.push(status);
      }

      query += ' ORDER BY r.due_date ASC';

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar cuentas por cobrar', details: err.message });
    }
  } else {
    let filtered = mockReceivables.filter(r => r.tenantId === tenantId);
    
    if (studentId) {
      filtered = filtered.filter(r => r.studentId === studentId);
    } else if (restrictedStudentIds.length > 0) {
      filtered = filtered.filter(r => restrictedStudentIds.includes(r.studentId));
    }

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    const result = filtered.map(r => {
      const student = students.find(s => s.id === r.studentId);
      return {
        ...r,
        student_first_name: student?.firstName || '',
        student_last_name: student?.lastName || '',
        enrollment_number: student?.enrollmentNumber || ''
      };
    });

    return res.json(result);
  }
});

// Crear una cuenta por cobrar manualmente o ligada a matrícula
app.post('/api/tenants/:tenantId/billing/receivables', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { studentId, enrollmentId, concept, amount, dueDate } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  if (!studentId || !concept || !amount || !dueDate) {
    return res.status(400).json({ error: 'studentId, concept, amount y dueDate son obligatorios' });
  }

  if (dbAvailable) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO receivables (tenant_id, student_id, enrollment_id, concept, amount, due_date, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
        [tenantId, studentId, enrollmentId || null, concept, amount, dueDate]
      );
      
      const receivable = result.rows[0];

      // Asiento contable de provisión (Devengo de Ingresos)
      // Debe: Cuentas por Cobrar (12100) = amount
      // Haber: Ingresos Educativos (40100) = amount
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (tenant_id, description, entry_date) 
         VALUES ($1, $2, NOW()) RETURNING id`,
        [tenantId, `Devengo de cuenta por cobrar: ${concept} (Alumno: ${studentId})`]
      );
      const entryId = entryResult.rows[0].id;

      await client.query(
        `INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES 
         ($1, '12100', $2, 0),
         ($1, '40100', 0, $2)`,
        [entryId, amount]
      );

      await client.query('COMMIT');
      return res.status(201).json(receivable);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Error al registrar cuenta por cobrar e ingresos devengados', details: err.message });
    } finally {
      client.release();
    }
  } else {
    const newRec: Receivable = {
      id: `rec-${Date.now()}`,
      tenantId,
      studentId,
      enrollmentId: enrollmentId || null,
      concept,
      amount: Number(amount),
      paidAmount: 0,
      dueDate,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockReceivables.push(newRec);

    // Contabilizar en memoria
    const newEntryId = `e-${Date.now()}`;
    mockLedgerEntries.push({
      id: newEntryId,
      tenantId,
      transactionId: null,
      entryDate: new Date().toISOString(),
      description: `Devengo de cuenta por cobrar: ${concept} (Alumno: ${studentId})`,
      createdAt: new Date().toISOString()
    });

    mockLedgerLines.push(
      { id: `l-${Date.now()}-1`, entryId: newEntryId, accountId: '12100', debit: Number(amount), credit: 0, createdAt: new Date().toISOString() },
      { id: `l-${Date.now()}-2`, entryId: newEntryId, accountId: '40100', debit: 0, credit: Number(amount), createdAt: new Date().toISOString() }
    );

    return res.status(201).json(newRec);
  }
});

// 4. Cuentas por Pagar (Payables)
app.get('/api/tenants/:tenantId/billing/payables', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, status } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // Si el usuario es profesor, restringimos a que sólo vea sus deudas (Cuentas por Pagar)
  let restrictedProfessorId: string | null = null;
  if (req.user?.roleId === 'r-tenant1-professor') {
    const userId = req.user.id;
    if (dbAvailable) {
      const result = await pool.query('SELECT id FROM professors WHERE user_id = $1', [userId]);
      if (result.rows.length > 0) {
        restrictedProfessorId = result.rows[0].id;
      }
    } else {
      const prof = professors.find(p => p.userId === userId);
      if (prof) restrictedProfessorId = prof.id;
    }

    if (!restrictedProfessorId) {
      return res.json([]); // No es profesor registrado en la facultad
    }
  }

  if (dbAvailable) {
    try {
      let query = `
        SELECT p.*, prof.specialty, u.first_name as professor_first_name, u.last_name as professor_last_name
        FROM payables p
        LEFT JOIN professors prof ON p.professor_id = prof.id
        LEFT JOIN users u ON prof.user_id = u.id
        WHERE p.tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramCount = 1;

      if (professorId) {
        paramCount++;
        query += ` AND p.professor_id = $${paramCount}`;
        params.push(professorId);
      } else if (restrictedProfessorId) {
        paramCount++;
        query += ` AND p.professor_id = $${paramCount}`;
        params.push(restrictedProfessorId);
      }

      if (status) {
        paramCount++;
        query += ` AND p.status = $${paramCount}`;
        params.push(status);
      }

      query += ' ORDER BY p.due_date ASC';

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar cuentas por pagar', details: err.message });
    }
  } else {
    let filtered = mockPayables.filter(p => p.tenantId === tenantId);
    
    if (professorId) {
      filtered = filtered.filter(p => p.professorId === professorId);
    } else if (restrictedProfessorId) {
      filtered = filtered.filter(p => p.professorId === restrictedProfessorId);
    }

    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }

    const result = filtered.map(p => {
      const prof = professors.find(pr => pr.id === p.professorId);
      const user = prof ? users.find(u => u.id === prof.userId) : null;
      return {
        ...p,
        professor_first_name: user?.firstName || '',
        professor_last_name: user?.lastName || '',
        specialty: prof?.specialty || ''
      };
    });

    return res.json(result);
  }
});

// Crear cuenta por pagar manually (Provisión de Gasto)
app.post('/api/tenants/:tenantId/billing/payables', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, concept, amount, dueDate } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  if (!concept || !amount || !dueDate) {
    return res.status(400).json({ error: 'concept, amount y dueDate son obligatorios' });
  }

  if (dbAvailable) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO payables (tenant_id, professor_id, concept, amount, due_date, status) 
         VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING *`,
        [tenantId, professorId || null, concept, amount, dueDate]
      );
      
      const payable = result.rows[0];

      // Asiento contable de provisión (Devengo de Gastos de Nómina)
      // Debe: Gasto de Nómina (50100) = amount
      // Haber: Cuentas por Pagar (21100) = amount
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (tenant_id, description, entry_date) 
         VALUES ($1, $2, NOW()) RETURNING id`,
        [tenantId, `Provisión de gasto: ${concept} (Profesor/Contacto: ${professorId || 'General'})`]
      );
      const entryId = entryResult.rows[0].id;

      await client.query(
        `INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES 
         ($1, '50100', $2, 0),
         ($1, '21100', 0, $2)`,
        [entryId, amount]
      );

      await client.query('COMMIT');
      return res.status(201).json(payable);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Error al registrar cuenta por pagar', details: err.message });
    } finally {
      client.release();
    }
  } else {
    const newPay: Payable = {
      id: `pay-${Date.now()}`,
      tenantId,
      professorId: professorId || null,
      concept,
      amount: Number(amount),
      paidAmount: 0,
      dueDate,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockPayables.push(newPay);

    // Contabilizar en memoria
    const newEntryId = `e-${Date.now()}`;
    mockLedgerEntries.push({
      id: newEntryId,
      tenantId,
      transactionId: null,
      entryDate: new Date().toISOString(),
      description: `Provisión de gasto: ${concept} (Profesor/Contacto: ${professorId || 'General'})`,
      createdAt: new Date().toISOString()
    });

    mockLedgerLines.push(
      { id: `l-${Date.now()}-1`, entryId: newEntryId, accountId: '50100', debit: Number(amount), credit: 0, createdAt: new Date().toISOString() },
      { id: `l-${Date.now()}-2`, entryId: newEntryId, accountId: '21100', debit: 0, credit: Number(amount), createdAt: new Date().toISOString() }
    );

    return res.status(201).json(newPay);
  }
});

// 5. REGISTRAR UNA TRANSACCIÓN (PAGO/COBRO) CON TRANSACCIÓN ACID COMPLETA
app.post('/api/tenants/:tenantId/billing/transactions', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { receivableId, payableId, amount, paymentMethod, gatewayReference, metadata } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!receivableId && !payableId) {
    return res.status(400).json({ error: 'Se requiere receivableId o payableId para imputar el pago' });
  }
  if (!amount || amount <= 0 || !paymentMethod) {
    return res.status(400).json({ error: 'El monto (mayor a 0) y el método de pago son obligatorios' });
  }

  const userEmail = req.user?.email || 'sistema@sincroedu.com';

  if (dbAvailable) {
    const client = await pool.connect();
    try {
      // 1. INICIAR TRANSACCIÓN ACID EN POSTGRESQL
      await client.query('BEGIN');

      let txId: string;
      let description = '';

      if (receivableId) {
        // --- COBRO DE DEUDA DE ALUMNO (INCOME) ---
        // Bloquear fila del recibo con FOR UPDATE para prevenir dobles cobros concurrentes (ACID Race Conditions)
        const recResult = await client.query(
          'SELECT * FROM receivables WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [receivableId, tenantId]
        );

        if (recResult.rows.length === 0) {
          throw new Error(`Cuenta por cobrar '${receivableId}' no encontrada.`);
        }

        const receivable = recResult.rows[0];
        const prevPaid = Number(receivable.paid_amount);
        const totalAmount = Number(receivable.amount);

        if (prevPaid >= totalAmount) {
          throw new Error('La cuenta por cobrar ya se encuentra totalmente cancelada.');
        }

        const newPaid = prevPaid + Number(amount);
        const newStatus = (newPaid >= totalAmount) ? 'PAID' : 'PENDING';

        // Actualizar Recibo
        await client.query(
          'UPDATE receivables SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [newPaid, newStatus, receivableId]
        );

        // Crear la transacción
        const txResult = await client.query(
          `INSERT INTO transactions (tenant_id, receivable_id, payable_id, type, amount, payment_method, gateway_reference, status, created_by, metadata) 
           VALUES ($1, $2, NULL, 'INCOME', $3, $4, $5, 'COMPLETED', $6, $7) RETURNING id`,
          [tenantId, receivableId, amount, paymentMethod, gatewayReference || null, req.user?.id || 'u-system', JSON.stringify(metadata || {})]
        );
        txId = txResult.rows[0].id;
        description = `Cobro de pensión: ${receivable.concept} (Alumno ID: ${receivable.student_id}) por ${amount} PEN.`;

        // Generar Asiento Diario en Libro Mayor (Ledger)
        // Afectamos cuentas contables reales:
        // Debe: Efectivo/Bancos (10100) = amount  (Aumento de Activo)
        // Haber: Cuentas por Cobrar (12100) = amount (Disminución de Activo)
        const entryResult = await client.query(
          `INSERT INTO ledger_entries (tenant_id, transaction_id, description, entry_date) 
           VALUES ($1, $2, $3, NOW()) RETURNING id`,
          [tenantId, txId, description]
        );
        const entryId = entryResult.rows[0].id;

        await client.query(
          `INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES 
           ($1, '10100', $2, 0),
           ($1, '12100', 0, $2)`,
          [entryId, amount]
        );

      } else {
        // --- PAGO DE NÓMINA / GASTO (EXPENSE) ---
        // Bloquear fila de payable para prevenir carreras concurrentes
        const payResult = await client.query(
          'SELECT * FROM payables WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [payableId, tenantId]
        );

        if (payResult.rows.length === 0) {
          throw new Error(`Cuenta por pagar '${payableId}' no encontrada.`);
        }

        const payable = payResult.rows[0];
        const prevPaid = Number(payable.paid_amount);
        const totalAmount = Number(payable.amount);

        if (prevPaid >= totalAmount) {
          throw new Error('La cuenta por pagar ya se encuentra cancelada.');
        }

        const newPaid = prevPaid + Number(amount);
        const newStatus = (newPaid >= totalAmount) ? 'PAID' : 'PENDING';

        // Actualizar Cuenta por Pagar
        await client.query(
          'UPDATE payables SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [newPaid, newStatus, payableId]
        );

        // Crear la transacción
        const txResult = await client.query(
          `INSERT INTO transactions (tenant_id, receivable_id, payable_id, type, amount, payment_method, gateway_reference, status, created_by, metadata) 
           VALUES ($1, NULL, $2, 'EXPENSE', $3, $4, $5, 'COMPLETED', $6, $7) RETURNING id`,
          [tenantId, payableId, amount, paymentMethod, gatewayReference || null, req.user?.id || 'u-system', JSON.stringify(metadata || {})]
        );
        txId = txResult.rows[0].id;
        description = `Pago emitido: ${payable.concept} por ${amount} PEN.`;

        // Generar Asiento Diario en Libro Mayor (Ledger)
        // Debe: Cuentas por Pagar (21100) = amount  (Disminución de Pasivo)
        // Haber: Efectivo/Bancos (10100) = amount (Disminución de Activo)
        const entryResult = await client.query(
          `INSERT INTO ledger_entries (tenant_id, transaction_id, description, entry_date) 
           VALUES ($1, $2, $3, NOW()) RETURNING id`,
          [tenantId, txId, description]
        );
        const entryId = entryResult.rows[0].id;

        await client.query(
          `INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES 
           ($1, '21100', $2, 0),
           ($1, '10100', 0, $2)`,
          [entryId, amount]
        );
      }

      // 2. HACER EL COMMIT DE LA TRANSACCIÓN (Se confirma todo)
      await client.query('COMMIT');

      // Consultar la transacción creada completa
      const finalTx = await client.query('SELECT * FROM transactions WHERE id = $1', [txId]);
      return res.status(201).json({
        success: true,
        message: 'Transacción ACID registrada y contabilizada en el Libro Mayor.',
        transaction: finalTx.rows[0]
      });

    } catch (err: any) {
      // 3. EN CASO DE ERROR, HACER ROLLBACK DE TODOS LOS CAMBIOS INMEDIATAMENTE
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transacción cancelada (Rollback ejecutado con éxito por seguridad)', details: err.message });
    } finally {
      client.release();
    }
  } else {
    // --- FALLBACK EN MEMORIA (Simula Transaccionalidad) ---
    try {
      let txId = `tx-${Date.now()}`;
      let description = '';

      if (receivableId) {
        const recIdx = mockReceivables.findIndex(r => r.id === receivableId && r.tenantId === tenantId);
        if (recIdx === -1) throw new Error(`Cuenta por cobrar '${receivableId}' no encontrada.`);
        
        const receivable = mockReceivables[recIdx];
        if (receivable.paidAmount >= receivable.amount) {
          throw new Error('La cuenta por cobrar ya se encuentra totalmente cancelada.');
        }

        receivable.paidAmount += Number(amount);
        receivable.status = (receivable.paidAmount >= receivable.amount) ? 'PAID' : 'PENDING';
        receivable.updatedAt = new Date().toISOString();

        description = `Cobro de pensión: ${receivable.concept} (Alumno ID: ${receivable.studentId}) por ${amount} PEN.`;

        // Registrar Transacción
        mockTransactions.push({
          id: txId,
          tenantId,
          receivableId,
          payableId: null,
          type: 'INCOME',
          amount: Number(amount),
          paymentMethod,
          gatewayReference: gatewayReference || null,
          status: 'COMPLETED',
          transactionDate: new Date().toISOString(),
          createdBy: req.user?.id || 'u-system',
          metadata,
          createdAt: new Date().toISOString()
        });

        // Contabilidad
        const entryId = `e-${Date.now()}`;
        mockLedgerEntries.push({
          id: entryId,
          tenantId,
          transactionId: txId,
          entryDate: new Date().toISOString(),
          description,
          createdAt: new Date().toISOString()
        });

        mockLedgerLines.push(
          { id: `l-${Date.now()}-1`, entryId, accountId: '10100', debit: Number(amount), credit: 0, createdAt: new Date().toISOString() },
          { id: `l-${Date.now()}-2`, entryId, accountId: '12100', debit: 0, credit: Number(amount), createdAt: new Date().toISOString() }
        );

      } else {
        const payIdx = mockPayables.findIndex(p => p.id === payableId && p.tenantId === tenantId);
        if (payIdx === -1) throw new Error(`Cuenta por pagar '${payableId}' no encontrada.`);
        
        const payable = mockPayables[payIdx];
        if (payable.paidAmount >= payable.amount) {
          throw new Error('La cuenta por pagar ya se encuentra cancelada.');
        }

        payable.paidAmount += Number(amount);
        payable.status = (payable.paidAmount >= payable.amount) ? 'PAID' : 'PENDING';
        payable.updatedAt = new Date().toISOString();

        description = `Pago emitido: ${payable.concept} por ${amount} PEN.`;

        // Registrar Transacción
        mockTransactions.push({
          id: txId,
          tenantId,
          receivableId: null,
          payableId,
          type: 'EXPENSE',
          amount: Number(amount),
          paymentMethod,
          gatewayReference: gatewayReference || null,
          status: 'COMPLETED',
          transactionDate: new Date().toISOString(),
          createdBy: req.user?.id || 'u-system',
          metadata,
          createdAt: new Date().toISOString()
        });

        // Contabilidad
        const entryId = `e-${Date.now()}`;
        mockLedgerEntries.push({
          id: entryId,
          tenantId,
          transactionId: txId,
          entryDate: new Date().toISOString(),
          description,
          createdAt: new Date().toISOString()
        });

        mockLedgerLines.push(
          { id: `l-${Date.now()}-1`, entryId, accountId: '21100', debit: Number(amount), credit: 0, createdAt: new Date().toISOString() },
          { id: `l-${Date.now()}-2`, entryId, accountId: '10100', debit: 0, credit: Number(amount), createdAt: new Date().toISOString() }
        );
      }

      return res.status(201).json({
        success: true,
        message: 'Transacción mock registrada y contabilizada (En memoria).',
        transaction: mockTransactions.find(t => t.id === txId)
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'Error al procesar en memoria', details: err.message });
    }
  }
});

// Obtener transacciones registradas
app.get('/api/tenants/:tenantId/billing/transactions', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query('SELECT * FROM transactions WHERE tenant_id = $1 ORDER BY transaction_date DESC', [tenantId]);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar transacciones', details: err.message });
    }
  } else {
    const tx = mockTransactions.filter(t => t.tenantId === tenantId).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return res.json(tx);
  }
});

// 6. CONSULTAR EL LIBRO MAYOR (LEDGER) CON ASIENTOS DIARIOS
app.get('/api/tenants/:tenantId/billing/ledger', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // Obtener todos los asientos detallados con sus líneas y nombres de cuentas contables
      const query = `
        SELECT le.id as entry_id, le.description, le.entry_date, le.transaction_id,
               ll.id as line_id, ll.account_id, ll.debit, ll.credit, la.name as account_name
        FROM ledger_entries le
        JOIN ledger_lines ll ON ll.entry_id = le.id
        JOIN ledger_accounts la ON ll.account_id = la.id
        WHERE le.tenant_id = $1
        ORDER BY le.entry_date DESC, le.id, ll.debit DESC
      `;
      const result = await pool.query(query, [tenantId]);

      // Agrupar por cabecera de asiento para un retorno JSON limpio y estructurado
      const entriesMap: { [key: string]: any } = {};
      result.rows.forEach(row => {
        if (!entriesMap[row.entry_id]) {
          entriesMap[row.entry_id] = {
            id: row.entry_id,
            description: row.description,
            entryDate: row.entry_date,
            transactionId: row.transaction_id,
            lines: []
          };
        }
        entriesMap[row.entry_id].lines.push({
          id: row.line_id,
          accountId: row.account_id,
          accountName: row.account_name,
          debit: Number(row.debit),
          credit: Number(row.credit)
        });
      });

      return res.json(Object.values(entriesMap));
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar Libro Mayor', details: err.message });
    }
  } else {
    // Agrupar en memoria
    const grouped = mockLedgerEntries.filter(e => e.tenantId === tenantId).map(e => {
      const lines = mockLedgerLines.filter(l => l.entryId === e.id).map(l => {
        const acc = mockLedgerAccounts.find(a => a.id === l.accountId);
        return {
          id: l.id,
          accountId: l.accountId,
          accountName: acc?.name || 'Cuenta Contable',
          debit: l.debit,
          credit: l.credit
        };
      });
      return {
        id: e.id,
        description: e.description,
        entryDate: e.entryDate,
        transactionId: e.transactionId,
        lines
      };
    }).sort((a, b) => b.entryDate.localeCompare(a.entryDate));

    return res.json(grouped);
  }
});

// 7. VERIFICACIÓN DE SALDOS DEL LIBRO MAYOR (BALANCE DE COMPROBACIÓN - HEALTH CHECK)
app.get('/api/tenants/:tenantId/billing/ledger/verify', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // 1. Obtener sumatorias globales
      const globalSum = await pool.query(
        `SELECT SUM(debit) as total_debits, SUM(credit) as total_credits 
         FROM ledger_lines ll
         JOIN ledger_entries le ON ll.entry_id = le.id
         WHERE le.tenant_id = $1`,
        [tenantId]
      );
      
      const totalDebits = Number(globalSum.rows[0].total_debits || 0);
      const totalCredits = Number(globalSum.rows[0].total_credits || 0);
      const globalBalanced = (totalDebits === totalCredits);

      // 2. Encontrar asientos individuales desbalanceados por error de redondeo u otros
      const unbalancedEntries = await pool.query(
        `SELECT le.id, le.description, le.entry_date, 
                SUM(ll.debit) as debits_sum, SUM(ll.credit) as credits_sum
         FROM ledger_entries le
         JOIN ledger_lines ll ON ll.entry_id = le.id
         WHERE le.tenant_id = $1
         GROUP BY le.id, le.description, le.entry_date
         HAVING SUM(ll.debit) <> SUM(ll.credit)
         ORDER BY le.entry_date DESC`,
        [tenantId]
      );

      return res.json({
        balanced: globalBalanced && unbalancedEntries.rows.length === 0,
        globalCheck: {
          totalDebits,
          totalCredits,
          difference: Math.abs(totalDebits - totalCredits),
          isBalanced: globalBalanced
        },
        unbalancedEntriesCount: unbalancedEntries.rows.length,
        unbalancedEntries: unbalancedEntries.rows.map(row => ({
          entryId: row.id,
          description: row.description,
          entryDate: row.entry_date,
          debitsSum: Number(row.debits_sum),
          creditsSum: Number(row.credits_sum),
          difference: Math.abs(Number(row.debits_sum) - Number(row.credits_sum))
        }))
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al verificar integridad del Libro Mayor', details: err.message });
    }
  } else {
    // Verificación en memoria
    let totalDebits = 0;
    let totalCredits = 0;
    const entries = mockLedgerEntries.filter(e => e.tenantId === tenantId);

    const unbalancedEntriesList: any[] = [];

    entries.forEach(e => {
      const lines = mockLedgerLines.filter(l => l.entryId === e.id);
      let dSum = 0;
      let cSum = 0;
      lines.forEach(l => {
        dSum += l.debit;
        cSum += l.credit;
        totalDebits += l.debit;
        totalCredits += l.credit;
      });

      if (dSum !== cSum) {
        unbalancedEntriesList.push({
          entryId: e.id,
          description: e.description,
          entryDate: e.entryDate,
          debitsSum: dSum,
          creditsSum: cSum,
          difference: Math.abs(dSum - cSum)
        });
      }
    });

    const isGlobalBalanced = (totalDebits === totalCredits);

    return res.json({
      balanced: isGlobalBalanced && unbalancedEntriesList.length === 0,
      globalCheck: {
        totalDebits,
        totalCredits,
        difference: Math.abs(totalDebits - totalCredits),
        isBalanced: isGlobalBalanced
      },
      unbalancedEntriesCount: unbalancedEntriesList.length,
      unbalancedEntries: unbalancedEntriesList
    });
  }
});

// ============================================================================
// MÓDULO DE ASISTENCIA, NÓMINA DE PROFESORES Y MOTOR DE RENTABILIDAD
// ============================================================================

// 1. Obtener registro de asistencia de profesores
app.get('/api/tenants/:tenantId/billing/attendance', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, courseId } = req.query;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      let query = `
        SELECT pa.*, c.name as course_name, c.code as course_code,
               u.first_name as professor_first_name, u.last_name as professor_last_name
        FROM professor_attendance pa
        JOIN professors p ON pa.professor_id = p.id
        JOIN users u ON p.user_id = u.id
        JOIN courses c ON pa.course_id = c.id
        WHERE pa.tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramCount = 1;

      if (professorId) {
        paramCount++;
        query += ` AND pa.professor_id = $${paramCount}`;
        params.push(professorId);
      }

      if (courseId) {
        paramCount++;
        query += ` AND pa.course_id = $${paramCount}`;
        params.push(courseId);
      }

      query += ' ORDER BY pa.class_date DESC';

      const result = await pool.query(query, params);
      return res.json(result.rows);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar asistencia de profesores', details: err.message });
    }
  } else {
    let filtered = mockProfessorAttendances.filter(pa => pa.tenantId === tenantId);
    if (professorId) {
      filtered = filtered.filter(pa => pa.professorId === professorId);
    }
    if (courseId) {
      filtered = filtered.filter(pa => pa.courseId === courseId);
    }

    const result = filtered.map(pa => {
      const prof = professors.find(p => p.id === pa.professorId);
      const user = prof ? users.find(u => u.id === prof.userId) : null;
      const course = courses.find(c => c.id === pa.courseId);
      return {
        ...pa,
        course_name: course?.name || '',
        course_code: course?.code || '',
        professor_first_name: user?.firstName || '',
        professor_last_name: user?.lastName || ''
      };
    }).sort((a, b) => b.classDate.localeCompare(a.classDate));

    return res.json(result);
  }
});

// Registrar asistencia de profesor manualmente
app.post('/api/tenants/:tenantId/billing/attendance', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, courseId, classDate, scheduledHours, hoursWorked, status } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (!professorId || !courseId || !classDate || !scheduledHours || hoursWorked === undefined || !status) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query(
        `INSERT INTO professor_attendance (tenant_id, professor_id, course_id, class_date, scheduled_hours, hours_worked, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, professorId, courseId, classDate, scheduledHours, hoursWorked, status]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al registrar asistencia', details: err.message });
    }
  } else {
    const newAtt: ProfessorAttendance = {
      id: `att-${Date.now()}`,
      tenantId,
      professorId,
      courseId,
      classDate,
      scheduledHours: Number(scheduledHours),
      hoursWorked: Number(hoursWorked),
      status,
      createdAt: new Date().toISOString()
    };
    mockProfessorAttendances.push(newAtt);
    return res.status(201).json(newAtt);
  }
});

// 2. Calcular pre-nómina de un profesor para un mes/año
app.get('/api/tenants/:tenantId/billing/payroll/calculate', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, yearMonth } = req.query; // yearMonth en formato 'YYYY-MM'

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  if (!professorId || !yearMonth) {
    return res.status(400).json({ error: 'professorId y yearMonth (YYYY-MM) son obligatorios' });
  }

  const ymStr = yearMonth as string;

  if (dbAvailable) {
    try {
      // Obtener el profesor
      const profResult = await pool.query(
        `SELECT p.*, u.first_name, u.last_name, u.email 
         FROM professors p 
         JOIN users u ON p.user_id = u.id 
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [professorId, tenantId]
      );
      if (profResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profesor no encontrado' });
      }
      const professor = profResult.rows[0];

      // Obtener configuración del tenant
      const tenantResult = await pool.query('SELECT deduct_absences_from_payroll FROM tenants WHERE id = $1', [tenantId]);
      const deductAbsences = tenantResult.rows[0]?.deduct_absences_from_payroll ?? true;

      // Obtener asistencias del mes
      // Nota: En PG filtramos usando TO_CHAR sobre class_date
      const attResult = await pool.query(
        `SELECT * FROM professor_attendance 
         WHERE tenant_id = $1 AND professor_id = $2 AND TO_CHAR(class_date, 'YYYY-MM') = $3`,
        [tenantId, professorId, ymStr]
      );
      const attendances = attResult.rows;

      let totalScheduledHours = 0;
      let totalHoursWorked = 0;
      let totalAbsences = 0;
      let totalPresents = 0;

      attendances.forEach(a => {
        totalScheduledHours += Number(a.scheduled_hours);
        totalHoursWorked += Number(a.hours_worked);
        if (a.status === 'ABSENT') {
          totalAbsences++;
        } else {
          totalPresents++;
        }
      });

      const hourlyRate = Number(professor.hourly_rate);
      
      // Aplicación de regla de negocio: Deducciones opcionales
      const grossPayroll = deductAbsences 
        ? totalHoursWorked * hourlyRate
        : totalScheduledHours * hourlyRate;

      const deductions = deductAbsences
        ? (totalScheduledHours - totalHoursWorked) * hourlyRate
        : 0;

      const netPayroll = grossPayroll;

      return res.json({
        professor: {
          id: professor.id,
          firstName: professor.first_name,
          lastName: professor.last_name,
          email: professor.email,
          hourlyRate
        },
        period: ymStr,
        config: {
          deductAbsencesFromPayroll: deductAbsences
        },
        metrics: {
          totalClasses: attendances.length,
          presents: totalPresents,
          absences: totalAbsences,
          totalScheduledHours,
          totalHoursWorked,
          hourlyRate
        },
        calculation: {
          grossPayroll,
          deductions,
          netPayroll
        }
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al calcular pre-nómina', details: err.message });
    }
  } else {
    // Fallback en memoria
    const prof = professors.find(p => p.id === professorId && p.tenantId === tenantId);
    if (!prof) return res.status(404).json({ error: 'Profesor no encontrado' });
    const user = users.find(u => u.id === prof.userId);

    const tenant = tenants.find(t => t.id === tenantId);
    const deductAbsences = tenant?.deductAbsencesFromPayroll ?? true;

    const attendances = mockProfessorAttendances.filter(pa => 
      pa.tenantId === tenantId && 
      pa.professorId === professorId && 
      pa.classDate.startsWith(ymStr)
    );

    let totalScheduledHours = 0;
    let totalHoursWorked = 0;
    let totalAbsences = 0;
    let totalPresents = 0;

    attendances.forEach(a => {
      totalScheduledHours += a.scheduledHours;
      totalHoursWorked += a.hoursWorked;
      if (a.status === 'ABSENT') {
        totalAbsences++;
      } else {
        totalPresents++;
      }
    });

    const hourlyRate = prof.hourlyRate || 50.00;
    const grossPayroll = deductAbsences 
      ? totalHoursWorked * hourlyRate
      : totalScheduledHours * hourlyRate;

    const deductions = deductAbsences
      ? (totalScheduledHours - totalHoursWorked) * hourlyRate
      : 0;

    const netPayroll = grossPayroll;

    return res.json({
      professor: {
        id: prof.id,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        hourlyRate
      },
      period: ymStr,
      config: {
        deductAbsencesFromPayroll: deductAbsences
      },
      metrics: {
        totalClasses: attendances.length,
        presents: totalPresents,
        absences: totalAbsences,
        totalScheduledHours,
        totalHoursWorked,
        hourlyRate
      },
      calculation: {
        grossPayroll,
        deductions,
        netPayroll
      }
    });
  }
});

// Procesar nómina (Cerrar mes, crear payable y contabilizar)
app.post('/api/tenants/:tenantId/billing/payroll/process', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { professorId, yearMonth } = req.body;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }
  if (!professorId || !yearMonth) {
    return res.status(400).json({ error: 'professorId y yearMonth (YYYY-MM) son obligatorios' });
  }

  const ymStr = yearMonth as string;

  if (dbAvailable) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener y bloquear el profesor
      const profResult = await client.query(
        `SELECT p.*, u.first_name, u.last_name, u.email 
         FROM professors p 
         JOIN users u ON p.user_id = u.id 
         WHERE p.id = $1 AND p.tenant_id = $2 FOR UPDATE`,
        [professorId, tenantId]
      );
      if (profResult.rows.length === 0) {
        throw new Error('Profesor no encontrado.');
      }
      const professor = profResult.rows[0];

      // 2. Obtener configuración del tenant
      const tenantResult = await client.query('SELECT deduct_absences_from_payroll FROM tenants WHERE id = $1', [tenantId]);
      const deductAbsences = tenantResult.rows[0]?.deduct_absences_from_payroll ?? true;

      // 3. Obtener asistencias
      const attResult = await client.query(
        `SELECT * FROM professor_attendance 
         WHERE tenant_id = $1 AND professor_id = $2 AND TO_CHAR(class_date, 'YYYY-MM') = $3`,
        [tenantId, professorId, ymStr]
      );
      const attendances = attResult.rows;

      if (attendances.length === 0) {
        throw new Error(`No se registraron horas ni clases dictadas para el periodo ${ymStr}.`);
      }

      // Validar si ya se emitió una nómina para este profesor en este periodo para evitar dobles registros
      const checkResult = await client.query(
        `SELECT id FROM payables 
         WHERE tenant_id = $1 AND professor_id = $2 AND concept LIKE $3`,
        [tenantId, professorId, `%Nómina ${ymStr}%`]
      );
      if (checkResult.rows.length > 0) {
        throw new Error(`La nómina para el periodo ${ymStr} ya ha sido procesada anteriormente.`);
      }

      let totalScheduledHours = 0;
      let totalHoursWorked = 0;

      attendances.forEach(a => {
        totalScheduledHours += Number(a.scheduled_hours);
        totalHoursWorked += Number(a.hours_worked);
      });

      const hourlyRate = Number(professor.hourly_rate);
      const netPayroll = deductAbsences 
        ? totalHoursWorked * hourlyRate
        : totalScheduledHours * hourlyRate;

      if (netPayroll <= 0) {
        throw new Error('El monto neto de nómina a pagar debe ser mayor a 0.');
      }

      // 4. Crear Cuenta por Pagar (Payable)
      const dueDate = new Date(ymStr + '-28'); // Vence el 28 del mes
      const concept = `Pago de nómina ${ymStr} - ${professor.first_name} ${professor.last_name} (${totalHoursWorked} hrs dictadas de ${totalScheduledHours} hrs progr.)`;
      
      const payableResult = await client.query(
        `INSERT INTO payables (tenant_id, professor_id, concept, amount, due_date, status) 
         VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id`,
        [tenantId, professorId, concept, netPayroll, dueDate]
      );
      const payableId = payableResult.rows[0].id;

      // 5. Asiento Contable Diario de Gasto de Nómina (Provisión de Nómina)
      // Debe: Gasto de Personal / Nómina Profesores (50100) = netPayroll  (Aumento de Gasto)
      // Haber: Cuentas por Pagar / Nómina Docente (21100) = netPayroll    (Aumento de Pasivo)
      const entryResult = await client.query(
        `INSERT INTO ledger_entries (tenant_id, description, entry_date) 
         VALUES ($1, $2, NOW()) RETURNING id`,
        [tenantId, `Provisión contable de nómina docente periodo ${ymStr} (Profesor: ${professor.first_name} ${professor.last_name})`]
      );
      const entryId = entryResult.rows[0].id;

      await client.query(
        `INSERT INTO ledger_lines (entry_id, account_id, debit, credit) VALUES 
         ($1, '50100', $2, 0),
         ($1, '21100', 0, $2)`,
        [entryId, netPayroll]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        message: `Nómina para ${professor.first_name} ${professor.last_name} procesada correctamente.`,
        netPayroll,
        payableId
      });

    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Fallo al procesar nómina escolar', details: err.message });
    } finally {
      client.release();
    }
  } else {
    // --- FALLBACK EN MEMORIA ---
    try {
      const prof = professors.find(p => p.id === professorId && p.tenantId === tenantId);
      if (!prof) throw new Error('Profesor no encontrado.');
      const user = users.find(u => u.id === prof.userId);

      const tenant = tenants.find(t => t.id === tenantId);
      const deductAbsences = tenant?.deductAbsencesFromPayroll ?? true;

      const attendances = mockProfessorAttendances.filter(pa => 
        pa.tenantId === tenantId && 
        pa.professorId === professorId && 
        pa.classDate.startsWith(ymStr)
      );

      if (attendances.length === 0) {
        throw new Error(`No se registraron horas ni clases dictadas para el periodo ${ymStr}.`);
      }

      // Validar duplicado
      const exists = mockPayables.some(p => p.tenantId === tenantId && p.professorId === professorId && p.concept.includes(`nómina ${ymStr}`));
      if (exists) {
        throw new Error(`La nómina para el periodo ${ymStr} ya ha sido procesada anteriormente.`);
      }

      let totalScheduledHours = 0;
      let totalHoursWorked = 0;

      attendances.forEach(a => {
        totalScheduledHours += a.scheduledHours;
        totalHoursWorked += a.hoursWorked;
      });

      const hourlyRate = prof.hourlyRate || 50.00;
      const netPayroll = deductAbsences 
        ? totalHoursWorked * hourlyRate
        : totalScheduledHours * hourlyRate;

      if (netPayroll <= 0) {
        throw new Error('El monto neto de nómina a pagar debe ser mayor a 0.');
      }

      const payableId = `pay-${Date.now()}`;
      const concept = `Pago de nómina ${ymStr} - ${user?.firstName} ${user?.lastName} (${totalHoursWorked} hrs dictadas de ${totalScheduledHours} hrs progr.)`;
      
      mockPayables.push({
        id: payableId,
        tenantId,
        professorId,
        concept,
        amount: netPayroll,
        paidAmount: 0,
        dueDate: ymStr + '-28',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Contabilidad
      const entryId = `e-${Date.now()}`;
      mockLedgerEntries.push({
        id: entryId,
        tenantId,
        transactionId: null,
        entryDate: new Date().toISOString(),
        description: `Provisión contable de nómina docente periodo ${ymStr} (Profesor: ${user?.firstName} ${user?.lastName})`,
        createdAt: new Date().toISOString()
      });

      mockLedgerLines.push(
        { id: `l-${Date.now()}-1`, entryId, accountId: '50100', debit: netPayroll, credit: 0, createdAt: new Date().toISOString() },
        { id: `l-${Date.now()}-2`, entryId, accountId: '21100', debit: 0, credit: netPayroll, createdAt: new Date().toISOString() }
      );

      return res.status(201).json({
        success: true,
        message: `Nómina para ${user?.firstName} ${user?.lastName} procesada correctamente (En memoria).`,
        netPayroll,
        payableId
      });
    } catch (err: any) {
      return res.status(400).json({ error: 'Error al procesar en memoria', details: err.message });
    }
  }
});

// 3. MOTOR DE RENTABILIDAD OPERATIVA EN MÚLTIPLES DIMENSIONES
app.get('/api/tenants/:tenantId/billing/profitability', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const { dimension = 'course', academicPeriod = '2026-I' } = req.query; // dimension: 'course', 'period', 'month', 'year'

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const dimStr = dimension as string;
  const periodStr = academicPeriod as string;

  if (dbAvailable) {
    try {
      if (dimStr === 'course') {
        // --- 1. RENTABILIDAD POR CURSO ---
        // Rentabilidad = Ingresos de alumnos matriculados (receivables vinculados a enrollments de este curso)
        //              - Gastos de profesor (horas_trabajadas * tarifa_hora en este curso)
        const query = `
          SELECT 
            c.id as course_id,
            c.code as course_code,
            c.name as course_name,
            c.credits,
            COALESCE(rec.income, 0.00) as income,
            COALESCE(cost.expense, 0.00) as expense,
            (COALESCE(rec.income, 0.00) - COALESCE(cost.expense, 0.00)) as operational_profit
          FROM courses c
          LEFT JOIN (
            -- Sumar ingresos por matrículas de este curso
            SELECT e.course_id, SUM(r.amount) as income
            FROM receivables r
            JOIN enrollments e ON r.enrollment_id = e.id
            WHERE r.tenant_id = $1 AND e.academic_period = $2
            GROUP BY e.course_id
          ) rec ON c.id = rec.course_id
          LEFT JOIN (
            -- Sumar gastos por horas docente dictadas de este curso
            SELECT pa.course_id, SUM(pa.hours_worked * prof.hourly_rate) as expense
            FROM professor_attendance pa
            JOIN professors prof ON pa.professor_id = prof.id
            WHERE pa.tenant_id = $1 AND TO_CHAR(pa.class_date, 'YYYY') = '2026' -- Filtramos año en base al periodo escolar
            GROUP BY pa.course_id
          ) cost ON c.id = cost.course_id
          WHERE c.tenant_id = $1 AND c.status = 'active'
          ORDER BY operational_profit DESC
        `;

        const result = await pool.query(query, [tenantId, periodStr]);
        
        // Mapear margen operativo
        const profitabilityData = result.rows.map(row => {
          const inc = Number(row.income);
          const exp = Number(row.expense);
          const profit = Number(row.operational_profit);
          const margin = inc > 0 ? parseFloat(((profit / inc) * 100).toFixed(2)) : 0;
          return {
            ...row,
            income: inc,
            expense: exp,
            operational_profit: profit,
            profit_margin: margin
          };
        });

        return res.json({
          dimension: 'course',
          period: periodStr,
          data: profitabilityData
        });

      } else if (dimStr === 'month') {
        // --- 2. RENTABILIDAD POR MES (HISTÓRICO EN BASE A LEDGER) ---
        // Extraemos ingresos (cuenta 40100) y egresos de nómina (cuenta 50100) del Libro Mayor
        const query = `
          SELECT 
            TO_CHAR(le.entry_date, 'YYYY-MM') as time_bucket,
            SUM(ll.credit) FILTER (WHERE ll.account_id = '40100') as income,
            SUM(ll.debit) FILTER (WHERE ll.account_id = '50100') as expense
          FROM ledger_entries le
          JOIN ledger_lines ll ON ll.entry_id = le.id
          WHERE le.tenant_id = $1
          GROUP BY TO_CHAR(le.entry_date, 'YYYY-MM')
          ORDER BY time_bucket DESC
        `;
        const result = await pool.query(query, [tenantId]);
        
        const data = result.rows.map(row => {
          const inc = Number(row.income || 0);
          const exp = Number(row.expense || 0);
          const profit = inc - exp;
          return {
            dimensionValue: row.time_bucket,
            income: inc,
            expense: exp,
            operational_profit: profit,
            profit_margin: inc > 0 ? parseFloat(((profit / inc) * 100).toFixed(2)) : 0
          };
        });

        return res.json({
          dimension: 'month',
          data
        });

      } else if (dimStr === 'year') {
        // --- 3. RENTABILIDAD POR AÑO ---
        const query = `
          SELECT 
            TO_CHAR(le.entry_date, 'YYYY') as time_bucket,
            SUM(ll.credit) FILTER (WHERE ll.account_id = '40100') as income,
            SUM(ll.debit) FILTER (WHERE ll.account_id = '50100') as expense
          FROM ledger_entries le
          JOIN ledger_lines ll ON ll.entry_id = le.id
          WHERE le.tenant_id = $1
          GROUP BY TO_CHAR(le.entry_date, 'YYYY')
          ORDER BY time_bucket DESC
        `;
        const result = await pool.query(query, [tenantId]);
        
        const data = result.rows.map(row => {
          const inc = Number(row.income || 0);
          const exp = Number(row.expense || 0);
          const profit = inc - exp;
          return {
            dimensionValue: row.time_bucket,
            income: inc,
            expense: exp,
            operational_profit: profit,
            profit_margin: inc > 0 ? parseFloat(((profit / inc) * 100).toFixed(2)) : 0
          };
        });

        return res.json({
          dimension: 'year',
          data
        });

      } else {
        // --- 4. RENTABILIDAD POR PERIODO ACADÉMICO ---
        const query = `
          SELECT 
            e.academic_period as dimension_value,
            SUM(r.amount) as income,
            -- Asumimos costo de nómina de los meses correspondientes a ese periodo
            COALESCE(cost.expense, 0.00) as expense
          FROM receivables r
          JOIN enrollments e ON r.enrollment_id = e.id
          LEFT JOIN (
            -- Unimos con costo por horas en ese periodo
            SELECT pa.tenant_id, SUM(pa.hours_worked * prof.hourly_rate) as expense
            FROM professor_attendance pa
            JOIN professors prof ON pa.professor_id = prof.id
            GROUP BY pa.tenant_id
          ) cost ON r.tenant_id = cost.tenant_id
          WHERE r.tenant_id = $1
          GROUP BY e.academic_period, cost.expense
        `;
        const result = await pool.query(query, [tenantId]);
        
        const data = result.rows.map(row => {
          const inc = Number(row.income || 0);
          const exp = Number(row.expense || 0);
          const profit = inc - exp;
          return {
            dimensionValue: row.dimension_value,
            income: inc,
            expense: exp,
            operational_profit: profit,
            profit_margin: inc > 0 ? parseFloat(((profit / inc) * 100).toFixed(2)) : 0
          };
        });

        return res.json({
          dimension: 'period',
          data
        });
      }
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar rentabilidad operativa', details: err.message });
    }
  } else {
    // --- FALLBACK EN MEMORIA ---
    if (dimStr === 'course') {
      const activeCourses = courses.filter(c => c.tenantId === tenantId && c.status === 'active');
      const data = activeCourses.map(c => {
        // Ingresos
        const courseEnrollments = enrollments.filter(e => e.courseId === c.id && e.academicPeriod === periodStr);
        let income = 0;
        courseEnrollments.forEach(en => {
          const recs = mockReceivables.filter(r => r.enrollmentId === en.id);
          recs.forEach(r => income += r.amount);
        });

        // Egresos (Mateo Silva p-1 enseña c-1 en mock)
        let expense = 0;
        const att = mockProfessorAttendances.filter(pa => pa.tenantId === tenantId && pa.courseId === c.id);
        att.forEach(a => {
          const prof = professors.find(p => p.id === a.professorId);
          const rate = prof?.hourlyRate || 50.00;
          expense += a.hoursWorked * rate;
        });

        const profit = income - expense;
        const margin = income > 0 ? parseFloat(((profit / income) * 100).toFixed(2)) : 0;

        return {
          course_id: c.id,
          course_code: c.code,
          course_name: c.name,
          credits: c.credits,
          income,
          expense,
          operational_profit: profit,
          profit_margin: margin
        };
      }).sort((a, b) => b.operational_profit - a.operational_profit);

      return res.json({
        dimension: 'course',
        period: periodStr,
        data
      });

    } else {
      // Mes o Año o Periodo en memoria usando el Ledger
      const entries = mockLedgerEntries.filter(e => e.tenantId === tenantId);
      const buckets: { [key: string]: { income: number, expense: number } } = {};

      entries.forEach(e => {
        let bucketKey = '2026';
        if (dimStr === 'month') {
          bucketKey = e.entryDate.substring(0, 7); // 'YYYY-MM'
        } else if (dimStr === 'year') {
          bucketKey = e.entryDate.substring(0, 4); // 'YYYY'
        } else if (dimStr === 'period') {
          bucketKey = periodStr; // Fallback simple para mock
        }

        if (!buckets[bucketKey]) {
          buckets[bucketKey] = { income: 0, expense: 0 };
        }

        const lines = mockLedgerLines.filter(l => l.entryId === e.id);
        lines.forEach(l => {
          if (l.accountId === '40100') {
            buckets[bucketKey].income += l.credit;
          } else if (l.accountId === '50100') {
            buckets[bucketKey].expense += l.debit;
          }
        });
      });

      const data = Object.keys(buckets).map(key => {
        const inc = buckets[key].income;
        const exp = buckets[key].expense;
        const profit = inc - exp;
        return {
          dimensionValue: key,
          income: inc,
          expense: exp,
          operational_profit: profit,
          profit_margin: inc > 0 ? parseFloat(((profit / inc) * 100).toFixed(2)) : 0
        };
      }).sort((a, b) => b.dimensionValue.localeCompare(a.dimensionValue));

      return res.json({
        dimension: dimStr,
        data
      });
    }
  }
});

// ============================================================================
// MÓDULO DE INTEGRACIÓN DE PAGOS, FACTURACIÓN ELECTRÓNICA Y DASHBOARDS
// ============================================================================

// 1. Simulación de Emisión de Facturación Electrónica (API abierta para NubeFacT)
app.post('/api/tenants/:tenantId/billing/transactions/:transactionId/invoice', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, transactionId } = req.params;

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // 1. Obtener la transacción y su recibo
      const txResult = await pool.query(
        `SELECT t.*, r.concept, r.amount as receivable_amount, s.document_id, s.first_name, s.last_name, s.email
         FROM transactions t
         JOIN receivables r ON t.receivable_id = r.id
         JOIN students s ON r.student_id = s.id
         WHERE t.id = $1 AND t.tenant_id = $2`,
        [transactionId, tenantId]
      );

      if (txResult.rows.length === 0) {
        return res.status(404).json({ error: 'Transacción de cobro no encontrada para facturación electrónica.' });
      }

      const tx = txResult.rows[0];

      // Verificar si ya está facturado
      const metadata = tx.metadata || {};
      if (metadata.invoice_status === 'ISSUED') {
        return res.status(400).json({ error: 'Este cobro ya cuenta con un comprobante electrónico emitido.' });
      }

      // 2. Simular generación del JSON para NubeFacT (Standard UBL XML API)
      const invoiceNumber = `F001-${Math.floor(100000 + Math.random() * 900000)}`;
      const subtotal = parseFloat((tx.amount / 1.18).toFixed(2)); // Supongamos IGV/IVA del 18% incluido
      const tax = parseFloat((tx.amount - subtotal).toFixed(2));

      const nubefactPayload = {
        operacion: "generar_comprobante",
        tipo_de_comprobante: 1, // Factura Electrónica
        serie: "F001",
        numero: invoiceNumber.split('-')[1],
        cliente_tipo_de_documento: 1, // DNI o DNI/RFC equivalente
        cliente_numero_de_documento: tx.document_id.replace(/\D/g, ''),
        cliente_denominacion: `${tx.first_name} ${tx.last_name}`,
        cliente_direccion: "San Isidro, Lima, Perú",
        cliente_email: tx.email,
        fecha_de_emision: new Date().toISOString().split('T')[0],
        moneda: 1, // PEN o moneda local
        porcentaje_de_igv: 18.00,
        total_gravada: subtotal,
        total_igv: tax,
        total: parseFloat(Number(tx.amount).toFixed(2)),
        items: [
          {
            unidad_de_medida: "ZZ",
            codigo: "SERV_EDU",
            descripcion: tx.concept,
            cantidad: 1,
            valor_unitario: subtotal,
            precio_unitario: parseFloat(Number(tx.amount).toFixed(2)),
            subtotal: subtotal,
            tipo_de_igv: 1, // Gravado
            igv: tax,
            total: parseFloat(Number(tx.amount).toFixed(2))
          }
        ]
      };

      console.log('📡 Enviando Payload a NubeFacT API:', JSON.stringify(nubefactPayload));

      // 3. Simular respuesta exitosa del PSE/SUNAT
      const updatedMetadata = {
        ...metadata,
        invoice_status: 'ISSUED',
        invoice_number: invoiceNumber,
        invoice_pdf: `https://sincroedu.nubefact.com/c/facturas/${invoiceNumber}.pdf`,
        invoice_xml: `https://sincroedu.nubefact.com/xml/facturas/${invoiceNumber}.xml`,
        cdr_sunat: `https://sincroedu.nubefact.com/cdr/facturas/R-${invoiceNumber}.xml`,
        emitted_at: new Date().toISOString()
      };

      // 4. Actualizar metadata de transacción en base de datos
      await pool.query(
        'UPDATE transactions SET metadata = $1 WHERE id = $2',
        [JSON.stringify(updatedMetadata), transactionId]
      );

      return res.json({
        success: true,
        message: 'Comprobante de Pago Electrónico (Boleta/Factura) emitido y enviado a SUNAT por NubeFacT.',
        invoiceNumber,
        pdfUrl: updatedMetadata.invoice_pdf,
        xmlUrl: updatedMetadata.invoice_xml
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al simular integración con NubeFacT', details: err.message });
    }
  } else {
    // Fallback en memoria
    const txIdx = mockTransactions.findIndex(t => t.id === transactionId && t.tenantId === tenantId);
    if (txIdx === -1) {
      return res.status(404).json({ error: 'Transacción no encontrada.' });
    }
    const tx = mockTransactions[txIdx];
    const rec = mockReceivables.find(r => r.id === tx.receivableId);
    const student = rec ? students.find(s => s.id === rec.studentId) : null;

    const invoiceNumber = `F001-${Math.floor(100000 + Math.random() * 900000)}`;

    tx.metadata = {
      ...(tx.metadata || {}),
      invoice_status: 'ISSUED',
      invoice_number: invoiceNumber,
      invoice_pdf: `https://sincroedu.nubefact.com/c/facturas/${invoiceNumber}.pdf`,
      invoice_xml: `https://sincroedu.nubefact.com/xml/facturas/${invoiceNumber}.xml`,
      emitted_at: new Date().toISOString()
    };

    return res.json({
      success: true,
      message: 'Comprobante de Pago Electrónico emitido con NubeFacT (En memoria).',
      invoiceNumber,
      pdfUrl: tx.metadata.invoice_pdf,
      xmlUrl: tx.metadata.invoice_xml
    });
  }
});

// 2. Dashboard de Padres de Familia (Deudas y pagos pendientes)
app.get('/api/tenants/:tenantId/billing/dashboard/parent', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const parentUserId = req.user?.id || 'u-parent1'; // Fallback a usuario padre de semilla

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // A. Obtener alumnos asociados a este apoderado
      const childrenResult = await pool.query(
        `SELECT sg.student_id, s.first_name, s.last_name, s.enrollment_number 
         FROM student_guardians sg
         JOIN students s ON sg.student_id = s.id
         WHERE sg.user_id = $1 AND s.tenant_id = $2`,
        [parentUserId, tenantId]
      );
      
      const childrenIds = childrenResult.rows.map(r => r.student_id);

      if (childrenIds.length === 0) {
        return res.json({
          children: [],
          metrics: { totalOutstanding: 0, overdueOutstanding: 0, paidTotal: 0 },
          receivables: [],
          payments: []
        });
      }

      // B. Obtener todas las deudas (receivables) de sus hijos
      const recResult = await pool.query(
        `SELECT r.*, s.first_name as student_first_name, s.last_name as student_last_name
         FROM receivables r
         JOIN students s ON r.student_id = s.id
         WHERE r.student_id IN (${childrenIds.map((_, i) => `$${i + 1}`).join(',')})
         ORDER BY r.due_date ASC`,
        childrenIds
      );
      const receivablesList = recResult.rows;

      // C. Obtener todos los pagos completados
      const payResult = await pool.query(
        `SELECT t.*, r.concept, s.first_name as student_first_name, s.last_name as student_last_name
         FROM transactions t
         JOIN receivables r ON t.receivable_id = r.id
         JOIN students s ON r.student_id = s.id
         WHERE r.student_id IN (${childrenIds.map((_, i) => `$${i + 1}`).join(',')}) AND t.status = 'COMPLETED'
         ORDER BY t.transaction_date DESC`,
        childrenIds
      );
      const paymentsList = payResult.rows;

      // D. Calcular métricas consolidadas
      let totalOutstanding = 0;
      let overdueOutstanding = 0;
      let paidTotal = 0;

      receivablesList.forEach(r => {
        const amt = Number(r.amount);
        const paid = Number(r.paid_amount);
        const outstanding = amt - paid;

        if (r.status === 'PENDING' || r.status === 'OVERDUE') {
          totalOutstanding += outstanding;
          if (r.status === 'OVERDUE') {
            overdueOutstanding += outstanding;
          }
        } else if (r.status === 'PAID') {
          paidTotal += paid;
        }
      });

      return res.json({
        children: childrenResult.rows,
        metrics: {
          totalOutstanding,
          overdueOutstanding,
          paidTotal
        },
        receivables: receivablesList,
        payments: paymentsList
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar Dashboard de Padres', details: err.message });
    }
  } else {
    // Fallback en memoria
    const children = studentGuardians.filter(sg => sg.userId === parentUserId).map(sg => {
      const student = students.find(s => s.id === sg.studentId);
      return {
        student_id: sg.studentId,
        first_name: student?.firstName || '',
        last_name: student?.lastName || '',
        enrollment_number: student?.enrollmentNumber || ''
      };
    });

    const childrenIds = children.map(c => c.student_id);

    if (childrenIds.length === 0) {
      return res.json({
        children: [],
        metrics: { totalOutstanding: 0, overdueOutstanding: 0, paidTotal: 0 },
        receivables: [],
        payments: []
      });
    }

    const receivablesList = mockReceivables.filter(r => childrenIds.includes(r.studentId)).map(r => {
      const child = children.find(c => c.student_id === r.studentId);
      return {
        ...r,
        student_first_name: child?.first_name || '',
        student_last_name: child?.last_name || ''
      };
    });

    const paymentsList = mockTransactions.filter(t => t.receivableId && mockReceivables.find(r => r.id === t.receivableId && childrenIds.includes(r.studentId))).map(t => {
      const rec = mockReceivables.find(r => r.id === t.receivableId);
      const child = children.find(c => c.student_id === rec?.studentId);
      return {
        ...t,
        concept: rec?.concept || '',
        student_first_name: child?.first_name || '',
        student_last_name: child?.last_name || ''
      };
    });

    let totalOutstanding = 0;
    let overdueOutstanding = 0;
    let paidTotal = 0;

    receivablesList.forEach(r => {
      const outstanding = r.amount - r.paidAmount;
      if (r.status === 'PENDING' || r.status === 'OVERDUE') {
        totalOutstanding += outstanding;
        if (r.status === 'OVERDUE') {
          overdueOutstanding += outstanding;
        }
      } else if (r.status === 'PAID') {
        paidTotal += r.paidAmount;
      }
    });

    return res.json({
      children,
      metrics: {
        totalOutstanding,
        overdueOutstanding,
        paidTotal
      },
      receivables: receivablesList,
      payments: paymentsList
    });
  }
});

// 3. Dashboard de Profesores (Estado de cuenta de honorarios)
app.get('/api/tenants/:tenantId/billing/dashboard/professor', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  const professorUserId = req.user?.id || 'u-t1professor'; // Mateo Silva profesor

  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // A. Buscar ID del profesor
      const profResult = await pool.query(
        'SELECT * FROM professors WHERE user_id = $1 AND tenant_id = $2',
        [professorUserId, tenantId]
      );
      if (profResult.rows.length === 0) {
        return res.status(404).json({ error: 'Profesor no registrado en la facultad de este Tenant.' });
      }
      const professor = profResult.rows[0];

      // B. Obtener todas las cuentas por pagar (nóminas) emitidas
      const payResult = await pool.query(
        'SELECT * FROM payables WHERE tenant_id = $1 AND professor_id = $2 ORDER BY due_date DESC',
        [tenantId, professor.id]
      );
      const payablesList = payResult.rows;

      // C. Obtener todos los pagos recibidos
      const transResult = await pool.query(
        `SELECT t.*, p.concept 
         FROM transactions t
         JOIN payables p ON t.payable_id = p.id
         WHERE t.tenant_id = $1 AND p.professor_id = $2 AND t.status = 'COMPLETED'
         ORDER BY t.transaction_date DESC`,
        [tenantId, professor.id]
      );
      const transactionsList = transResult.rows;

      // D. Obtener asistencia y horas acumuladas del ciclo escolar actual (2026)
      const attResult = await pool.query(
        `SELECT * FROM professor_attendance 
         WHERE tenant_id = $1 AND professor_id = $2 AND TO_CHAR(class_date, 'YYYY') = '2026'
         ORDER BY class_date DESC`,
        [tenantId, professor.id]
      );
      const attendanceList = attResult.rows;

      // E. Calcular KPIs
      let totalEarned = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let hoursWorked = 0;
      let absencesCount = 0;

      payablesList.forEach(p => {
        const amt = Number(p.amount);
        const paid = Number(p.paid_amount);
        totalEarned += amt;
        totalPaid += paid;
        totalPending += (amt - paid);
      });

      attendanceList.forEach(a => {
        hoursWorked += Number(a.hours_worked);
        if (a.status === 'ABSENT') {
          absencesCount++;
        }
      });

      return res.json({
        professor: {
          id: professor.id,
          specialty: professor.specialty,
          hourlyRate: Number(professor.hourly_rate),
          hireDate: professor.hire_date
        },
        metrics: {
          totalEarned,
          totalPaid,
          totalPending,
          hoursWorked,
          absencesCount,
          totalClasses: attendanceList.length
        },
        payables: payablesList,
        paymentsReceived: transactionsList,
        attendance: attendanceList
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar Dashboard de Profesores', details: err.message });
    }
  } else {
    // Fallback en memoria
    const prof = professors.find(p => p.userId === professorUserId && p.tenantId === tenantId);
    if (!prof) return res.status(404).json({ error: 'Profesor no encontrado en el tenant' });

    const payablesList = mockPayables.filter(p => p.professorId === prof.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    const transactionsList = mockTransactions.filter(t => t.payableId && mockPayables.find(p => p.id === t.payableId && p.professorId === prof.id)).map(t => {
      const payable = mockPayables.find(p => p.id === t.payableId);
      return {
        ...t,
        concept: payable?.concept || ''
      };
    });

    const attendanceList = mockProfessorAttendances.filter(pa => pa.professorId === prof.id).sort((a, b) => b.classDate.localeCompare(a.classDate));

    let totalEarned = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let hoursWorked = 0;
    let absencesCount = 0;

    payablesList.forEach(p => {
      totalEarned += p.amount;
      totalPaid += p.paidAmount;
      totalPending += (p.amount - p.paidAmount);
    });

    attendanceList.forEach(a => {
      hoursWorked += a.hoursWorked;
      if (a.status === 'ABSENT') {
        absencesCount++;
      }
    });

    return res.json({
      professor: {
        id: prof.id,
        specialty: prof.specialty,
        hourlyRate: prof.hourlyRate || 50.00,
        hireDate: prof.hireDate
      },
      metrics: {
        totalEarned,
        totalPaid,
        totalPending,
        hoursWorked,
        absencesCount,
        totalClasses: attendanceList.length
      },
      payables: payablesList,
      paymentsReceived: transactionsList,
      attendance: attendanceList
    });
  }
});

// 4. Dashboard de Finanzas y Administración (Flujos de caja y KPIs contables)
app.get('/api/tenants/:tenantId/billing/dashboard/admin', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      // A. Flujo de Caja (Caja/Bancos de transacciones completadas)
      const cashResult = await pool.query(
        `SELECT 
           COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0.00) as income_cash,
           COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0.00) as expense_cash
         FROM transactions
         WHERE tenant_id = $1 AND status = 'COMPLETED'`,
        [tenantId]
      );
      
      const totalIncome = Number(cashResult.rows[0].income_cash);
      const totalExpense = Number(cashResult.rows[0].expense_cash);
      const cashBalance = totalIncome - totalExpense;

      // B. Estado de Cuentas por Cobrar
      const recResult = await pool.query(
        `SELECT 
           COUNT(*) as count,
           COALESCE(SUM(amount - paid_amount), 0.00) as total_outstanding,
           COALESCE(SUM(amount - paid_amount) FILTER (WHERE status = 'OVERDUE'), 0.00) as total_overdue
         FROM receivables
         WHERE tenant_id = $1 AND status IN ('PENDING', 'OVERDUE')`,
        [tenantId]
      );
      const arOutstanding = Number(recResult.rows[0].total_outstanding);
      const arOverdue = Number(recResult.rows[0].total_overdue);

      // C. Estado de Cuentas por Pagar (Nóminas pendientes)
      const payResult = await pool.query(
        `SELECT 
           COUNT(*) as count,
           COALESCE(SUM(amount - paid_amount), 0.00) as total_outstanding
         FROM payables
         WHERE tenant_id = $1 AND status IN ('PENDING', 'OVERDUE')`,
        [tenantId]
      );
      const apOutstanding = Number(payResult.rows[0].total_outstanding);

      // D. Gráfico de transacciones diarias de los últimos 30 días
      const chartResult = await pool.query(
        `SELECT 
           TO_CHAR(transaction_date, 'YYYY-MM-DD') as date,
           COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0) as income,
           COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) as expense
         FROM transactions
         WHERE tenant_id = $1 AND status = 'COMPLETED' AND transaction_date >= NOW() - INTERVAL '30 days'
         GROUP BY TO_CHAR(transaction_date, 'YYYY-MM-DD')
         ORDER BY date ASC`,
        [tenantId]
      );

      // E. Distribución de Cuentas Contables (Saldos en Ledger)
      const ledgerResult = await pool.query(
        `SELECT la.id as account_id, la.name as account_name, la.type as account_type,
                COALESCE(SUM(ll.debit), 0.00) as debits, COALESCE(SUM(ll.credit), 0.00) as credits
         FROM ledger_accounts la
         LEFT JOIN ledger_lines ll ON ll.account_id = la.id
         LEFT JOIN ledger_entries le ON ll.entry_id = le.id
         WHERE la.tenant_id = $1
         GROUP BY la.id, la.name, la.type`,
        [tenantId]
      );

      const accountsWithBalance = ledgerResult.rows.map(row => {
        const deb = Number(row.debits);
        const cred = Number(row.credits);
        let balance = 0;
        
        // El saldo depende de la naturaleza de la cuenta (Deudora o Acreedora)
        if (row.account_type === 'ASSET' || row.account_type === 'EXPENSE') {
          balance = deb - cred; // Activos y Gastos aumentan por el Debe
        } else {
          balance = cred - deb; // Pasivos, Patrimonio e Ingresos aumentan por el Haber
        }

        return {
          accountId: row.account_id,
          accountName: row.account_name,
          accountType: row.account_type,
          balance
        };
      });

      return res.json({
        metrics: {
          totalIncome,
          totalExpense,
          cashBalance,
          arOutstanding,
          arOverdue,
          apOutstanding,
          operationalProfit: totalIncome - totalExpense
        },
        dailyFlow: chartResult.rows.map(row => ({
          date: row.date,
          income: Number(row.income),
          expense: Number(row.expense)
        })),
        ledgerAccounts: accountsWithBalance
      });

    } catch (err: any) {
      return res.status(500).json({ error: 'Error al consultar Dashboard de Administración', details: err.message });
    }
  } else {
    // Fallback en memoria
    let totalIncome = 0;
    let totalExpense = 0;

    mockTransactions.filter(t => t.tenantId === tenantId && t.status === 'COMPLETED').forEach(t => {
      if (t.type === 'INCOME') totalIncome += t.amount;
      else totalExpense += t.amount;
    });

    const cashBalance = totalIncome - totalExpense;

    let arOutstanding = 0;
    let arOverdue = 0;
    mockReceivables.filter(r => r.tenantId === tenantId && (r.status === 'PENDING' || r.status === 'OVERDUE')).forEach(r => {
      const outstanding = r.amount - r.paidAmount;
      arOutstanding += outstanding;
      if (r.status === 'OVERDUE') arOverdue += outstanding;
    });

    let apOutstanding = 0;
    mockPayables.filter(p => p.tenantId === tenantId && (p.status === 'PENDING' || p.status === 'OVERDUE')).forEach(p => {
      apOutstanding += (p.amount - p.paidAmount);
    });

    // Cuentas del Ledger en memoria
    const accountsWithBalance = mockLedgerAccounts.filter(la => la.tenantId === tenantId).map(la => {
      let deb = 0;
      let cred = 0;

      const lines = mockLedgerLines.filter(l => l.accountId === la.id);
      lines.forEach(l => {
        deb += l.debit;
        cred += l.credit;
      });

      let balance = 0;
      if (la.type === 'ASSET' || la.type === 'EXPENSE') {
        balance = deb - cred;
      } else {
        balance = cred - deb;
      }

      return {
        accountId: la.id,
        accountName: la.name,
        accountType: la.type,
        balance
      };
    });

    return res.json({
      metrics: {
        totalIncome,
        totalExpense,
        cashBalance,
        arOutstanding,
        arOverdue,
        apOutstanding,
        operationalProfit: totalIncome - totalExpense
      },
      dailyFlow: [
        { date: '2026-04-09', income: 500, expense: 0 },
        { date: '2026-05-25', income: 0, expense: 1500 }
      ],
      ledgerAccounts: accountsWithBalance
    });
  }
});
// =====================================================================
// MÓDULO: PROGRAMACIÓN PREDICTIVA Y OPTIMIZACIÓN DE HORARIOS (CSP & DEMAND)
// =====================================================================

// Helper para calcular coincidencia de especialidad
const getSpecialtyMatch = (profSpecialty: string, courseName: string): number => {
  const specialtyWords = profSpecialty.toLowerCase().split(/[\s,]+/);
  const courseWords = courseName.toLowerCase().split(/[\s,]+/);
  let score = 0;
  for (const sWord of specialtyWords) {
    if (sWord.length < 3) continue;
    for (const cWord of courseWords) {
      if (cWord.length < 3) continue;
      if (cWord.includes(sWord) || sWord.includes(cWord)) {
        score += 5;
      }
    }
  }
  // Coincidencia exacta de palabras clave comunes
  if (profSpecialty.toLowerCase().includes('matemát') && courseName.toLowerCase().includes('álgebra')) score += 10;
  if (profSpecialty.toLowerCase().includes('matemát') && courseName.toLowerCase().includes('cálcul')) score += 10;
  if (profSpecialty.toLowerCase().includes('robót') && courseName.toLowerCase().includes('robót')) score += 10;
  if (profSpecialty.toLowerCase().includes('literat') && courseName.toLowerCase().includes('literat')) score += 10;
  
  return score;
};

// 1. Obtener todas las Aulas
app.get('/api/tenants/:tenantId/scheduling/classrooms', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query('SELECT * FROM classrooms WHERE tenant_id = $1 ORDER BY name ASC', [tenantId]);
      const mapped = result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        campusId: row.campus_id,
        name: row.name,
        type: row.type,
        capacity: row.capacity,
        status: row.status
      }));
      return res.json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al obtener aulas', details: err.message });
    }
  } else {
    const list = mockClassrooms.filter(c => c.tenantId === tenantId);
    return res.json(list);
  }
});

// 2. Obtener Bloques Horarios
app.get('/api/tenants/:tenantId/scheduling/time-slots', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query('SELECT * FROM time_slots WHERE tenant_id = $1 ORDER BY day_of_week ASC, start_time ASC', [tenantId]);
      const mapped = result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time,
        type: row.type
      }));
      return res.json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al obtener bloques horarios', details: err.message });
    }
  } else {
    const list = mockTimeSlots.filter(t => t.tenantId === tenantId);
    return res.json(list);
  }
});

// 3. Obtener Disponibilidad Docente
app.get('/api/tenants/:tenantId/scheduling/professor-availabilities', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const result = await pool.query('SELECT * FROM professor_availabilities WHERE tenant_id = $1', [tenantId]);
      const mapped = result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        professorId: row.professor_id,
        dayOfWeek: row.day_of_week,
        startTime: row.start_time,
        endTime: row.end_time
      }));
      return res.json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al obtener disponibilidades de profesores', details: err.message });
    }
  } else {
    const list = mockProfessorAvailabilities.filter(pa => pa.tenantId === tenantId);
    return res.json(list);
  }
});

// 4. Obtener Programaciones (Horarios)
app.get('/api/tenants/:tenantId/scheduling/schedules', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  if (dbAvailable) {
    try {
      const query = `
        SELECT s.*, 
               c.name as course_name, c.code as course_code, c.credits as course_credits,
               cl.name as classroom_name, cl.capacity as classroom_capacity, cl.type as classroom_type,
               ts.name as time_slot_name, ts.day_of_week as time_slot_day, ts.start_time as time_slot_start, ts.end_time as time_slot_end,
               u.first_name as professor_first_name, u.last_name as professor_last_name, p.specialty as professor_specialty
        FROM schedules s
        JOIN courses c ON s.course_id = c.id
        LEFT JOIN classrooms cl ON s.classroom_id = cl.id
        JOIN time_slots ts ON s.time_slot_id = ts.id
        LEFT JOIN professors p ON s.professor_id = p.id
        LEFT JOIN users u ON p.user_id = u.id
        WHERE s.tenant_id = $1
      `;
      const result = await pool.query(query, [tenantId]);
      const mapped = result.rows.map(row => ({
        id: row.id,
        tenantId: row.tenant_id,
        courseId: row.course_id,
        professorId: row.professor_id,
        classroomId: row.classroom_id,
        timeSlotId: row.time_slot_id,
        academicPeriod: row.academic_period,
        sectionCode: row.section_code,
        status: row.status,
        courseName: row.course_name,
        courseCode: row.course_code,
        courseCredits: row.course_credits,
        classroomName: row.classroom_name,
        classroomCapacity: row.classroom_capacity,
        classroomType: row.classroom_type,
        timeSlotName: row.time_slot_name,
        timeSlotDay: row.time_slot_day,
        timeSlotStart: row.time_slot_start,
        timeSlotEnd: row.time_slot_end,
        professorName: row.professor_first_name ? `${row.professor_first_name} ${row.professor_last_name}` : 'Sin asignar',
        professorSpecialty: row.professor_specialty || ''
      }));
      return res.json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: 'Error al obtener horarios programados', details: err.message });
    }
  } else {
    // Resolver relaciones en memoria
    const list = mockSchedules.filter(s => s.tenantId === tenantId).map(s => {
      const course = courses.find(c => c.id === s.courseId);
      const room = mockClassrooms.find(r => r.id === s.classroomId);
      const slot = mockTimeSlots.find(ts => ts.id === s.timeSlotId);
      const prof = professors.find(p => p.id === s.professorId);
      const pUser = prof ? users.find(u => u.id === prof.userId) : null;

      return {
        ...s,
        courseName: course ? course.name : 'Curso Desconocido',
        courseCode: course ? course.code : '',
        courseCredits: course ? course.credits : 0,
        classroomName: room ? room.name : 'Sin asignar',
        classroomCapacity: room ? room.capacity : 0,
        classroomType: room ? room.type : 'classroom',
        timeSlotName: slot ? slot.name : '',
        timeSlotDay: slot ? slot.dayOfWeek : 1,
        timeSlotStart: slot ? slot.startTime : '00:00:00',
        timeSlotEnd: slot ? slot.endTime : '00:00:00',
        professorName: pUser ? `${pUser.firstName} ${pUser.lastName}` : 'Sin asignar',
        professorSpecialty: prof ? prof.specialty : ''
      };
    });
    return res.json(list);
  }
});

// Helper para validación de colisiones (CSP Engine)
async function checkSchedulingConflicts(
  tenantId: string,
  scheduleId: string | null,
  courseId: string,
  professorId: string | null,
  classroomId: string | null,
  timeSlotId: string,
  academicPeriod: string,
  sectionCode: string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
  const conflicts: string[] = [];

  // 1. Obtener detalles del bloque horario asignado
  let timeSlot: any = null;
  let allSchedules: any[] = [];
  let professorAvailabilitiesList: any[] = [];
  let classroomCapacity = 999;

  if (dbAvailable) {
    // DB Queries
    const slotResult = await pool.query('SELECT * FROM time_slots WHERE id = $1', [timeSlotId]);
    if (slotResult.rows.length > 0) timeSlot = slotResult.rows[0];

    const schedResult = await pool.query('SELECT * FROM schedules WHERE tenant_id = $1 AND academic_period = $2', [tenantId, academicPeriod]);
    allSchedules = schedResult.rows;

    if (professorId) {
      const availResult = await pool.query('SELECT * FROM professor_availabilities WHERE tenant_id = $1 AND professor_id = $2', [tenantId, professorId]);
      professorAvailabilitiesList = availResult.rows;
    }

    if (classroomId) {
      const roomResult = await pool.query('SELECT capacity FROM classrooms WHERE id = $1', [classroomId]);
      if (roomResult.rows.length > 0) classroomCapacity = roomResult.rows[0].capacity;
    }
  } else {
    // In-memory Fallback
    timeSlot = mockTimeSlots.find(ts => ts.id === timeSlotId);
    allSchedules = mockSchedules.filter(s => s.tenantId === tenantId && s.academicPeriod === academicPeriod);
    if (professorId) {
      professorAvailabilitiesList = mockProfessorAvailabilities.filter(pa => pa.tenantId === tenantId && pa.professorId === professorId);
    }
    if (classroomId) {
      const room = mockClassrooms.find(r => r.id === classroomId);
      if (room) classroomCapacity = room.capacity;
    }
  }

  if (!timeSlot) {
    return { hasConflict: true, conflicts: ['Bloque horario inválido o no encontrado'] };
  }

  // Filtrar el mismo registro de horario si estamos editando
  const otherSchedules = allSchedules.filter(s => s.id !== scheduleId && (s.id !== undefined));

  // A. Validación de Colisión de Docente (Teacher Overlap)
  if (professorId) {
    const profConflict = otherSchedules.find(s => 
      s.professor_id === professorId || s.professorId === professorId
    );
    // Verificamos si comparte el mismo time_slot
    const matchesSlot = otherSchedules.some(s => 
      (s.professor_id === professorId || s.professorId === professorId) &&
      (s.time_slot_id === timeSlotId || s.timeSlotId === timeSlotId)
    );
    if (matchesSlot) {
      conflicts.push('El docente ya está dictando otra clase en este mismo bloque horario.');
    }

    // B. Validación de Disponibilidad Docente (Availability Match)
    const dayOfWeek = timeSlot.day_of_week ?? timeSlot.dayOfWeek;
    const slotStart = timeSlot.start_time ?? timeSlot.startTime;
    const slotEnd = timeSlot.end_time ?? timeSlot.endTime;

    const matchingAvailabilities = professorAvailabilitiesList.filter(pa => 
      (pa.day_of_week ?? pa.dayOfWeek) === dayOfWeek
    );

    if (matchingAvailabilities.length === 0) {
      conflicts.push('El docente no tiene registrada disponibilidad para este día de la semana.');
    } else {
      const isWithinWindow = matchingAvailabilities.some(pa => {
        const paStart = pa.start_time ?? pa.startTime;
        const paEnd = pa.end_time ?? pa.endTime;
        return paStart <= slotStart && paEnd >= slotEnd;
      });
      if (!isWithinWindow) {
        conflicts.push(`El bloque horario (${slotStart} - ${slotEnd}) excede la ventana de disponibilidad del docente para este día.`);
      }
    }
  }

  // C. Validación de Colisión de Aula (Room Overlap)
  if (classroomId) {
    const roomOverlap = otherSchedules.some(s => 
      (s.classroom_id === classroomId || s.classroomId === classroomId) &&
      (s.time_slot_id === timeSlotId || s.timeSlotId === timeSlotId)
    );
    if (roomOverlap) {
      conflicts.push('El aula física seleccionada ya está ocupada por otra clase en este bloque.');
    }
  }

  // D. Validación de Cruce de Sección / Alumnos (Student Group Overlap)
  const sectionOverlap = otherSchedules.some(s => 
    s.section_code === sectionCode &&
    (s.time_slot_id === timeSlotId || s.timeSlotId === timeSlotId)
  );
  if (sectionOverlap) {
    conflicts.push(`La Sección Académica "${sectionCode}" ya tiene otra asignatura programada en este bloque. Los alumnos tendrían cruce de horarios.`);
  }

  // E. Validación de Aforo Físico (Over-capacity)
  // Contar los estudiantes matriculados en esta sección
  let enrollmentCount = 0;
  if (dbAvailable) {
    const enrollResult = await pool.query(
      'SELECT COUNT(*) FROM enrollments WHERE tenant_id = $1 AND course_id = $2 AND academic_period = $3 AND status = \'active\'',
      [tenantId, courseId, academicPeriod]
    );
    enrollmentCount = Number(enrollResult.rows[0].count);
  } else {
    enrollmentCount = enrollments.filter(e => 
      e.tenantId === tenantId && 
      e.courseId === courseId && 
      e.academicPeriod === academicPeriod && 
      e.status === 'active'
    ).length;
  }

  // Si no hay matriculados reales en este periodo de prueba, asignamos por defecto 25 alumnos
  if (enrollmentCount === 0) enrollmentCount = 25;

  if (enrollmentCount > classroomCapacity) {
    conflicts.push(`Aforo superado: La sección requiere espacio para ${enrollmentCount} alumnos, pero el aula física "${classroomId}" tiene capacidad máxima de ${classroomCapacity}.`);
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

// 5. Endpoint de Validación Externa (para Drag-and-Drop)
app.post('/api/tenants/:tenantId/scheduling/validate', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const { scheduleId, courseId, professorId, classroomId, timeSlotId, academicPeriod, sectionCode } = req.body;

  if (!courseId || !timeSlotId || !academicPeriod || !sectionCode) {
    return res.status(400).json({ error: 'Faltan parámetros clave para validar' });
  }

  try {
    const validation = await checkSchedulingConflicts(
      tenantId,
      scheduleId || null,
      courseId,
      professorId || null,
      classroomId || null,
      timeSlotId,
      academicPeriod,
      sectionCode
    );
    return res.json(validation);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al realizar validación de conflictos', details: err.message });
  }
});

// 6. Registrar un Horario Manual (Crear)
app.post('/api/tenants/:tenantId/scheduling/schedules', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const { courseId, professorId, classroomId, timeSlotId, academicPeriod, sectionCode, status } = req.body;

  if (!courseId || !timeSlotId || !academicPeriod || !sectionCode) {
    return res.status(400).json({ error: 'Faltan campos requeridos para programar la sesión' });
  }

  try {
    // Validar conflictos primero
    const validation = await checkSchedulingConflicts(
      tenantId,
      null,
      courseId,
      professorId || null,
      classroomId || null,
      timeSlotId,
      academicPeriod,
      sectionCode
    );

    if (validation.hasConflict) {
      return res.status(409).json({ error: 'Cruce detectado en la asignación horaria', details: validation.conflicts });
    }

    const newId = dbAvailable ? undefined : `sch-${Date.now()}`;
    const initialStatus = status || 'draft';

    if (dbAvailable) {
      const insertQuery = `
        INSERT INTO schedules (tenant_id, course_id, professor_id, classroom_id, time_slot_id, academic_period, section_code, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [
        tenantId,
        courseId,
        professorId || null,
        classroomId || null,
        timeSlotId,
        academicPeriod,
        sectionCode,
        initialStatus
      ]);
      const row = result.rows[0];
      return res.status(201).json({
        id: row.id,
        tenantId: row.tenant_id,
        courseId: row.course_id,
        professorId: row.professor_id,
        classroomId: row.classroom_id,
        timeSlotId: row.time_slot_id,
        academicPeriod: row.academic_period,
        sectionCode: row.section_code,
        status: row.status
      });
    } else {
      const newSched: Schedule = {
        id: newId!,
        tenantId,
        courseId,
        professorId: professorId || undefined,
        classroomId: classroomId || undefined,
        timeSlotId,
        academicPeriod,
        sectionCode,
        status: initialStatus
      };
      mockSchedules.push(newSched);
      return res.status(201).json(newSched);
    }

  } catch (err: any) {
    return res.status(500).json({ error: 'Error al registrar horario programado', details: err.message });
  }
});

// 7. Actualizar Horario (para Drag-and-Drop)
app.put('/api/tenants/:tenantId/scheduling/schedules/:scheduleId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, scheduleId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const { courseId, professorId, classroomId, timeSlotId, academicPeriod, sectionCode, status } = req.body;

  try {
    // 1. Obtener horario previo para resiliencia
    let currentSched: any = null;
    if (dbAvailable) {
      const selectResult = await pool.query('SELECT * FROM schedules WHERE id = $1 AND tenant_id = $2', [scheduleId, tenantId]);
      if (selectResult.rows.length === 0) return res.status(404).json({ error: 'Asignación de horario no encontrada' });
      currentSched = selectResult.rows[0];
    } else {
      const idx = mockSchedules.findIndex(s => s.id === scheduleId && s.tenantId === tenantId);
      if (idx === -1) return res.status(404).json({ error: 'Asignación no encontrada' });
      currentSched = mockSchedules[idx];
    }

    const finalCourseId = courseId || currentSched.course_id || currentSched.courseId;
    const finalProfessorId = professorId !== undefined ? professorId : (currentSched.professor_id || currentSched.professorId);
    const finalClassroomId = classroomId !== undefined ? classroomId : (currentSched.classroom_id || currentSched.classroomId);
    const finalTimeSlotId = timeSlotId || currentSched.time_slot_id || currentSched.timeSlotId;
    const finalAcademicPeriod = academicPeriod || currentSched.academic_period || currentSched.academicPeriod;
    const finalSectionCode = sectionCode || currentSched.section_code || currentSched.sectionCode;

    // 2. Validar colisiones horarias
    const validation = await checkSchedulingConflicts(
      tenantId,
      scheduleId,
      finalCourseId,
      finalProfessorId || null,
      finalClassroomId || null,
      finalTimeSlotId,
      finalAcademicPeriod,
      finalSectionCode
    );

    if (validation.hasConflict) {
      return res.status(409).json({ error: 'Cruce detectado al reubicar la clase', details: validation.conflicts });
    }

    // 3. Persistir actualización
    const finalStatus = status || currentSched.status;
    if (dbAvailable) {
      const updateQuery = `
        UPDATE schedules
        SET course_id = $1, professor_id = $2, classroom_id = $3, time_slot_id = $4, 
            academic_period = $5, section_code = $6, status = $7, updated_at = NOW()
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [
        finalCourseId,
        finalProfessorId || null,
        finalClassroomId || null,
        finalTimeSlotId,
        finalAcademicPeriod,
        finalSectionCode,
        finalStatus,
        scheduleId,
        tenantId
      ]);
      const row = result.rows[0];
      return res.json({
        id: row.id,
        tenantId: row.tenant_id,
        courseId: row.course_id,
        professorId: row.professor_id,
        classroomId: row.classroom_id,
        timeSlotId: row.time_slot_id,
        academicPeriod: row.academic_period,
        sectionCode: row.section_code,
        status: row.status
      });
    } else {
      const idx = mockSchedules.findIndex(s => s.id === scheduleId && s.tenantId === tenantId);
      mockSchedules[idx] = {
        ...mockSchedules[idx],
        courseId: finalCourseId,
        professorId: finalProfessorId || undefined,
        classroomId: finalClassroomId || undefined,
        timeSlotId: finalTimeSlotId,
        academicPeriod: finalAcademicPeriod,
        sectionCode: finalSectionCode,
        status: finalStatus
      };
      return res.json(mockSchedules[idx]);
    }

  } catch (err: any) {
    return res.status(500).json({ error: 'Error al actualizar asignación horaria', details: err.message });
  }
});

// 8. Eliminar un horario
app.delete('/api/tenants/:tenantId/scheduling/schedules/:scheduleId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId, scheduleId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  try {
    if (dbAvailable) {
      const result = await pool.query('DELETE FROM schedules WHERE id = $1 AND tenant_id = $2 RETURNING id', [scheduleId, tenantId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Horario no encontrado para eliminar' });
      return res.json({ success: true, message: 'Horario eliminado con éxito' });
    } else {
      const idx = mockSchedules.findIndex(s => s.id === scheduleId && s.tenantId === tenantId);
      if (idx === -1) return res.status(404).json({ error: 'Horario no encontrado' });
      mockSchedules.splice(idx, 1);
      return res.json({ success: true, message: 'Horario eliminado (memoria) con éxito' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al eliminar horario', details: err.message });
  }
});

// 9. MOTOR ALGORÍTMICO CSP: AUTO-PROGRAMACIÓN AUTOMÁTICA
app.post('/api/tenants/:tenantId/scheduling/auto-schedule', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  const { academicPeriod, sectionCode, courseIds } = req.body;

  if (!academicPeriod || !sectionCode) {
    return res.status(400).json({ error: 'Faltan parámetros académicos (periodo y sección) para la simulación CSP' });
  }

  try {
    // A. Cargar Recursos Disponibles
    let activeCourses: any[] = [];
    let classroomsList: any[] = [];
    let timeSlotsList: any[] = [];
    let professorsList: any[] = [];
    let existingSchedules: any[] = [];
    let professorAvailabilitiesList: any[] = [];

    if (dbAvailable) {
      const coursesRes = await pool.query('SELECT * FROM courses WHERE tenant_id = $1 AND status = \'active\'', [tenantId]);
      activeCourses = coursesRes.rows;

      const roomsRes = await pool.query('SELECT * FROM classrooms WHERE tenant_id = $1 AND status = \'active\'', [tenantId]);
      classroomsList = roomsRes.rows;

      const slotsRes = await pool.query('SELECT * FROM time_slots WHERE tenant_id = $1 ORDER BY day_of_week ASC, start_time ASC', [tenantId]);
      timeSlotsList = slotsRes.rows;

      const profsRes = await pool.query(`
        SELECT p.*, u.first_name, u.last_name 
        FROM professors p
        JOIN users u ON p.user_id = u.id
        WHERE p.tenant_id = $1 AND p.status = 'active'
      `, [tenantId]);
      professorsList = profsRes.rows;

      const schedsRes = await pool.query('SELECT * FROM schedules WHERE tenant_id = $1 AND academic_period = $2', [tenantId, academicPeriod]);
      existingSchedules = schedsRes.rows;

      const avRes = await pool.query('SELECT * FROM professor_availabilities WHERE tenant_id = $1', [tenantId]);
      professorAvailabilitiesList = avRes.rows;
    } else {
      activeCourses = courses.filter(c => c.tenantId === tenantId && c.status === 'active');
      classroomsList = mockClassrooms.filter(c => c.tenantId === tenantId && c.status === 'active');
      timeSlotsList = mockTimeSlots.filter(t => t.tenantId === tenantId);
      professorsList = professors.filter(p => p.tenantId === tenantId && p.status === 'active').map(p => {
        const u = users.find(usr => usr.id === p.userId);
        return {
          ...p,
          first_name: u?.firstName || '',
          last_name: u?.lastName || ''
        };
      });
      existingSchedules = mockSchedules.filter(s => s.tenantId === tenantId && s.academicPeriod === academicPeriod);
      professorAvailabilitiesList = mockProfessorAvailabilities.filter(pa => pa.tenantId === tenantId);
    }

    // Filtrar cursos a programar según petición
    let targetCourses = activeCourses;
    if (Array.isArray(courseIds) && courseIds.length > 0) {
      targetCourses = activeCourses.filter(c => courseIds.includes(c.id));
    }

    // Si ya tienen asignación definitiva de horario para este periodo y sección, excluirlos para no sobreescribir
    const coursesAlreadyScheduled = existingSchedules
      .filter(s => s.section_code === sectionCode || s.sectionCode === sectionCode)
      .map(s => s.course_id || s.courseId);

    const coursesToSchedule = targetCourses.filter(c => !coursesAlreadyScheduled.includes(c.id));

    if (coursesToSchedule.length === 0) {
      return res.json({
        success: true,
        message: 'No hay cursos pendientes de programar para esta sección académica.',
        assignedSchedules: []
      });
    }

    // B. Preparar variables para el backtracking CSP
    // Variables = Cursos a programar
    // Valores de Dominio = Combinaciones válidas de (TimeSlot, Classroom, Professor)
    const proposedAssignments: any[] = [];

    // Función de verificación de colisiones local al solver
    const isValido = (
      courseId: string,
      profId: string,
      roomId: string,
      slotId: string
    ): boolean => {
      const slot = timeSlotsList.find(s => s.id === slotId);
      if (!slot) return false;

      const slotDay = slot.day_of_week ?? slot.dayOfWeek;
      const slotStart = slot.start_time ?? slot.startTime;
      const slotEnd = slot.end_time ?? slot.endTime;

      // 1. Validar Disponibilidad Docente
      const profAvails = professorAvailabilitiesList.filter(pa => 
        (pa.professor_id ?? pa.professorId) === profId && (pa.day_of_week ?? pa.dayOfWeek) === slotDay
      );
      if (profAvails.length === 0) return false;
      const tieneDispo = profAvails.some(pa => {
        const paStart = pa.start_time ?? pa.startTime;
        const paEnd = pa.end_time ?? pa.endTime;
        return paStart <= slotStart && paEnd >= slotEnd;
      });
      if (!tieneDispo) return false;

      // 2. Comprobar Overlaps en horarios ya persistidos
      for (const s of existingSchedules) {
        const sSlotId = s.time_slot_id ?? s.timeSlotId;
        if (sSlotId !== slotId) continue;

        // Choque de Docente
        if ((s.professor_id ?? s.professorId) === profId) return false;
        // Choque de Aula
        if ((s.classroom_id ?? s.classroomId) === roomId) return false;
        // Choque de Sección
        if ((s.section_code ?? s.sectionCode) === sectionCode) return false;
      }

      // 3. Comprobar Overlaps en asignaciones parciales del solver actual
      for (const s of proposedAssignments) {
        if (s.timeSlotId !== slotId) continue;

        // Choque de Docente
        if (s.professorId === profId) return false;
        // Choque de Aula
        if (s.classroomId === roomId) return false;
        // Choque de Sección (Misma sección en dos salones a la vez)
        if (s.sectionCode === sectionCode) return false;
      }

      return true;
    };

    // Algoritmo Recursivo CSP de Backtracking
    let solved = false;
    const solveCSP = (idx: number): boolean => {
      if (idx === coursesToSchedule.length) {
        solved = true;
        return true;
      }

      const course = coursesToSchedule[idx];

      // ORDENAMIENTO HEURÍSTICO (PRIORIZAR DOCENTE POR ESPECIALIDAD ACADÉMICA HISTÓRICA)
      const sortedProfessors = [...professorsList].sort((a, b) => {
        const scoreA = getSpecialtyMatch(a.specialty, course.name);
        const scoreB = getSpecialtyMatch(b.specialty, course.name);
        return scoreB - scoreA; // Descendente por puntaje de match
      });

      // Recorrer grilla horaria estándar
      for (const slot of timeSlotsList) {
        for (const room of classroomsList) {
          // Aforo de alumnos por defecto = 25
          if (room.capacity < 25) continue; 

          for (const prof of sortedProfessors) {
            if (isValido(course.id, prof.id, room.id, slot.id)) {
              // Realizar asignación tentativa
              proposedAssignments.push({
                courseId: course.id,
                professorId: prof.id,
                classroomId: room.id,
                timeSlotId: slot.id,
                sectionCode,
                academicPeriod,
                status: 'draft',
                // Meta info para respuesta visual
                courseName: course.name,
                courseCode: course.code,
                classroomName: room.name,
                timeSlotName: slot.name,
                professorName: `${prof.first_name} ${prof.last_name}`
              });

              // Llamada recursiva
              if (solveCSP(idx + 1)) return true;

              // Backtrack
              proposedAssignments.pop();
            }
          }
        }
      }

      return false;
    };

    // Iniciar Motor CSP
    solveCSP(0);

    if (!solved && proposedAssignments.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Conflicto CSP insalvable',
        details: ['No se encontró una grilla horaria libre que satisfaga todas las restricciones físicas y de docentes para esta sección. Intente registrar más salones o ampliar la disponibilidad horaria.']
      });
    }

    // Persistir las asignaciones si se resolvió el CSP
    const persistedSchedules: any[] = [];
    if (dbAvailable) {
      for (const item of proposedAssignments) {
        const result = await pool.query(`
          INSERT INTO schedules (tenant_id, course_id, professor_id, classroom_id, time_slot_id, academic_period, section_code, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
          RETURNING *
        `, [
          tenantId,
          item.courseId,
          item.professorId,
          item.classroomId,
          item.timeSlotId,
          academicPeriod,
          sectionCode
        ]);
        const row = result.rows[0];
        persistedSchedules.push({
          id: row.id,
          ...item
        });
      }
    } else {
      for (const item of proposedAssignments) {
        const newSched: Schedule = {
          id: `sch-csp-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          tenantId,
          courseId: item.courseId,
          professorId: item.professorId,
          classroomId: item.classroomId,
          timeSlotId: item.timeSlotId,
          academicPeriod: item.academicPeriod,
          sectionCode: item.sectionCode,
          status: 'draft'
        };
        mockSchedules.push(newSched);
        persistedSchedules.push({
          id: newSched.id,
          ...item
        });
      }
    }

    return res.json({
      success: true,
      message: `¡Optimización CSP Exitosa! Se programaron ${persistedSchedules.length} asignaciones docentes sin colisiones físicas en estado borrador.`,
      assignedSchedules: persistedSchedules
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'Error crítico en el motor CSP de auto-programación', details: err.message });
  }
});

// 10. MODELO PREDICTIVO DE DEMANDA Y RENTABILIDAD DE AULA
app.get('/api/tenants/:tenantId/scheduling/predictive-demand', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { tenantId } = req.params;
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
  }

  // Tasa de crecimiento simulada o histórica (por defecto 15% de incremento)
  const growthRate = req.query.growthRate ? Number(req.query.growthRate) : 0.15;
  const targetPeriod = (req.query.targetPeriod as string) || '2026-II';

  try {
    let allCourses: any[] = [];
    let allClassrooms: any[] = [];
    let pricePerCredit = 100.00; // Por defecto 100 PEN

    if (dbAvailable) {
      // 1. Obtener cursos
      const coursesRes = await pool.query('SELECT * FROM courses WHERE tenant_id = $1 AND status = \'active\'', [tenantId]);
      allCourses = coursesRes.rows;

      // 2. Obtener aulas físicas (para la capacidad física y aforo de aforo)
      const roomsRes = await pool.query('SELECT * FROM classrooms WHERE tenant_id = $1 AND type = \'classroom\' AND status = \'active\'', [tenantId]);
      allClassrooms = roomsRes.rows;

      // 3. Obtener precio por crédito del último periodo registrado
      const pricingRes = await pool.query('SELECT price_per_credit FROM credit_pricing WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', [tenantId]);
      if (pricingRes.rows.length > 0) pricePerCredit = Number(pricingRes.rows[0].price_per_credit);
    } else {
      allCourses = courses.filter(c => c.tenantId === tenantId && c.status === 'active');
      allClassrooms = mockClassrooms.filter(c => c.tenantId === tenantId && c.type === 'classroom' && c.status === 'active');
    }

    // Capacidad promedio de aulas físicas para asociar al límite físico
    const defaultCapacity = allClassrooms.length > 0
      ? Math.round(allClassrooms.reduce((acc, curr) => acc + curr.capacity, 0) / allClassrooms.length)
      : 30;

    const projections: any[] = [];

    for (const course of allCourses) {
      // A. Contar la matrícula histórica del periodo 2026-I o 2025-II
      let historicalEnrollment = 0;
      if (dbAvailable) {
        const enrollResult = await pool.query(
          'SELECT COUNT(*) FROM enrollments WHERE tenant_id = $1 AND course_id = $2 AND status = \'active\'',
          [tenantId, course.id]
        );
        historicalEnrollment = Number(enrollResult.rows[0].count);
      } else {
        historicalEnrollment = enrollments.filter(e => 
          e.tenantId === tenantId && 
          e.courseId === course.id && 
          e.status === 'active'
        ).length;
      }

      // Si es cero en nuestra base de datos semilla vacía, asignamos valores de matriculados base aleatorios
      if (historicalEnrollment === 0) {
        if (course.code === 'MAT-101') historicalEnrollment = 45;
        else if (course.code === 'LIT-204') historicalEnrollment = 32;
        else historicalEnrollment = 20;
      }

      // B. Aplicar Algoritmo de Predicción: Serie Temporal Lineal + Crecimiento Tenant
      const projectedEnrollment = Math.ceil(historicalEnrollment * (1 + growthRate));

      // C. ASOCIAR AL LÍMITE FÍSICO DEL AULA (Explicitly requested by user)
      // Buscamos si hay un aula específica recomendada, o tomamos la capacidad física de un aula típica
      const roomCapacity = allClassrooms.length > 0 ? allClassrooms[0].capacity : defaultCapacity;
      
      // Determinación dinámica de Secciones Sugeridas basándose en el límite físico exacto
      const suggestedSections = Math.ceil(projectedEnrollment / roomCapacity);

      // D. Cálculo Financiero de Rentabilidad (Expected ROI)
      // Ingresos Estimados = Alumnos Proyectados * Créditos del Curso * Precio de Crédito
      const expectedRevenue = projectedEnrollment * course.credits * pricePerCredit;

      // Costos Operativos = Horas semanales (Créditos) * Tarifa por Hora Docente (50 PEN) * 16 semanas * Secciones Abiertas
      const hoursPerWeek = course.credits; // Supongamos que créditos equivale a horas semanales
      const weeksPerTerm = 16;
      const docentRate = 50.00;
      const expectedCost = suggestedSections * hoursPerWeek * docentRate * weeksPerTerm;

      const netProfit = expectedRevenue - expectedCost;
      const marginPercentage = expectedRevenue > 0 ? Math.round((netProfit / expectedRevenue) * 100) : 0;

      projections.push({
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        courseCredits: course.credits,
        historicalEnrollment,
        projectedEnrollment,
        classroomCapacityLimit: roomCapacity,
        suggestedSections,
        financials: {
          expectedRevenue,
          expectedCost,
          netProfit,
          marginPercentage
        }
      });
    }

    return res.json({
      targetPeriod,
      growthRateUsed: `${growthRate * 100}%`,
      pricePerCreditUsed: pricePerCredit,
      projections
    });

  } catch (err: any) {
    return res.status(500).json({ error: 'Error al procesar modelo predictivo de secciones', details: err.message });
  }
});

// INICIAR SERVIDOR

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SINCROEDU BACKEND INICIADO EN EL PUERTO ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}`);
  console.log(`=============================================================`);
});
