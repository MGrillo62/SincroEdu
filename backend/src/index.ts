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
  Tenant, 
  Role, 
  User,
  Course,
  Professor,
  Campus,
  AuditLog
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

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 SINCROEDU BACKEND INICIADO EN EL PUERTO ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}`);
  console.log(`=============================================================`);
});
