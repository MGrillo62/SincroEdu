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
  Enrollment
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

  const { name, subdomain, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain } = req.body;

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
    domain: domain || `${subdomain}.sincroedu.edu.pe`
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
  const { name, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain } = req.body;

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

// INICIAR SERVIDOR

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SINCROEDU BACKEND INICIADO EN EL PUERTO ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}`);
  console.log(`=============================================================`);
});
