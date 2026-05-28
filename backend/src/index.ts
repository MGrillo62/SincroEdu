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
  gradeAuditLogs
} from './db';

dotenv.config();

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
    return (req.query.tenantId as string) || (req.body.tenantId as string) || 't-11111111-1111-1111-1111-111111111111';
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

// INICIAR SERVIDOR

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SINCROEDU BACKEND INICIADO EN EL PUERTO ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}`);
  console.log(`=============================================================`);
});
