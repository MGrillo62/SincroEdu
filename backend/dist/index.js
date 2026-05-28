"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("./db");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'sincroedu_super_secret_key_12345';
// Habilitar CORS y parseador JSON
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Logger simple para peticiones
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// -------------------------------------------------------------
// MIDDLEWARE DE AUTENTICACIÓN JWT
// -------------------------------------------------------------
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // "Bearer TOKEN"
        jsonwebtoken_1.default.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Token inválido o expirado' });
            }
            req.user = decoded;
            next();
        });
    }
    else {
        res.status(401).json({ error: 'Encabezado de autorización ausente' });
    }
};
// -------------------------------------------------------------
// HELPER PARA REGISTRO DE AUDITORÍA (HISTORIAL DE EDICIONES)
// -------------------------------------------------------------
const addAuditLog = (tenantId, tableName, recordId, action, changedBy, previousValues, newValues) => {
    const newLog = {
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
    db_1.auditLogs.unshift(newLog); // Añadir al inicio para mantener orden descendente
    return newLog;
};
// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------
// 1. LOGIN DE USUARIOS
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña requeridos' });
    }
    // Buscar usuario
    const user = db_1.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (!user.isActive) {
        return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }
    // Verificar contraseña
    const isMatch = bcryptjs_1.default.compareSync(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    // Obtener Tenant (institución)
    let userTenant = null;
    if (user.tenantId) {
        userTenant = db_1.tenants.find(t => t.id === user.tenantId) || null;
    }
    // Obtener Rol
    const userRole = db_1.roles.find(r => r.id === user.roleId) || null;
    // Obtener permisos de menú vinculados a este rol
    const permissions = db_1.roleMenuPermissions.filter(p => p.roleId === user.roleId);
    // Mapear los permisos con la información detallada del menú
    const menuAccess = db_1.menuOptions
        .filter(menu => {
        const perm = permissions.find(p => p.menuOptionId === menu.id);
        return perm ? perm.canView : false;
    })
        .map(menu => {
        const perm = permissions.find(p => p.menuOptionId === menu.id);
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
    const token = jsonwebtoken_1.default.sign({
        id: user.id,
        tenantId: user.tenantId,
        roleId: user.roleId,
        email: user.email
    }, JWT_SECRET, { expiresIn: '8h' });
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
app.get('/api/auth/me', authenticateJWT, (req, res) => {
    const userId = req.user?.id;
    const user = db_1.users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const userTenant = user.tenantId ? db_1.tenants.find(t => t.id === user.tenantId) : null;
    const userRole = db_1.roles.find(r => r.id === user.roleId);
    const permissions = db_1.roleMenuPermissions.filter(p => p.roleId === user.roleId);
    const menuAccess = db_1.menuOptions
        .filter(menu => {
        const perm = permissions.find(p => p.menuOptionId === menu.id);
        return perm ? perm.canView : false;
    })
        .map(menu => {
        const perm = permissions.find(p => p.menuOptionId === menu.id);
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
app.get('/api/tenants', authenticateJWT, (req, res) => {
    if (req.user?.roleId !== 'r-superadmin') {
        return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
    }
    return res.json(db_1.tenants);
});
// 2. Registrar nuevo Tenant (escuela) con auto-semillado de roles y permisos
app.post('/api/tenants', authenticateJWT, (req, res) => {
    if (req.user?.roleId !== 'r-superadmin') {
        return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
    }
    const { name, subdomain, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain } = req.body;
    if (!name || !subdomain) {
        return res.status(400).json({ error: 'Nombre de escuela y subdominio son obligatorios' });
    }
    // Verificar si ya existe el subdominio
    const subExists = db_1.tenants.some(t => t.subdomain.toLowerCase() === subdomain.toLowerCase());
    if (subExists) {
        return res.status(409).json({ error: 'El subdominio ya se encuentra registrado' });
    }
    const newTenantId = `t-${Date.now()}`;
    const newTenant = {
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
    db_1.tenants.push(newTenant);
    // Auto-creación de roles predeterminados para el nuevo Tenant
    const newAdminRoleId = `r-${newTenantId}-admin`;
    const newProfRoleId = `r-${newTenantId}-professor`;
    const newAuxRoleId = `r-${newTenantId}-auxiliar`;
    db_1.roles.push({
        id: newAdminRoleId,
        tenantId: newTenantId,
        name: 'Admin',
        description: 'Administrador general de la escuela.',
        isSystemRole: true
    }, {
        id: newProfRoleId,
        tenantId: newTenantId,
        name: 'Profesor',
        description: 'Personal docente de la escuela.',
        isSystemRole: false
    }, {
        id: newAuxRoleId,
        tenantId: newTenantId,
        name: 'Auxiliar',
        description: 'Personal de apoyo administrativo.',
        isSystemRole: false
    });
    // Auto-seeding de permisos de menú para el Admin del nuevo Tenant (acceso a todo excepto m-tenants)
    db_1.menuOptions.forEach(menu => {
        const isTenantsMenu = menu.id === 'm-tenants';
        db_1.roleMenuPermissions.push({
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
    db_1.menuOptions.forEach(menu => {
        const isAllowed = profVisibleMenus.includes(menu.id);
        db_1.roleMenuPermissions.push({
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
    addAuditLog('system', 'tenants', newTenantId, 'CREATE', req.user?.email || 'superadmin@sincroedu.com', null, newTenant);
    return res.status(201).json(newTenant);
});
// 3. Modificar/Actualizar ficha de Tenant
app.put('/api/tenants/:tenantId', authenticateJWT, (req, res) => {
    if (req.user?.roleId !== 'r-superadmin') {
        return res.status(403).json({ error: 'Acceso denegado: Se requieren privilegios de Superadmin' });
    }
    const { tenantId } = req.params;
    const { name, logoUrl, primaryColor, secondaryColor, status, fiscalId, address, phone, email, domain } = req.body;
    const tenantIdx = db_1.tenants.findIndex(t => t.id === tenantId);
    if (tenantIdx === -1) {
        return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    const previousTenant = { ...db_1.tenants[tenantIdx] };
    if (name)
        db_1.tenants[tenantIdx].name = name;
    if (logoUrl !== undefined)
        db_1.tenants[tenantIdx].logoUrl = logoUrl;
    if (primaryColor)
        db_1.tenants[tenantIdx].primaryColor = primaryColor;
    if (secondaryColor)
        db_1.tenants[tenantIdx].secondaryColor = secondaryColor;
    if (status)
        db_1.tenants[tenantIdx].status = status;
    if (fiscalId !== undefined)
        db_1.tenants[tenantIdx].fiscalId = fiscalId;
    if (address !== undefined)
        db_1.tenants[tenantIdx].address = address;
    if (phone !== undefined)
        db_1.tenants[tenantIdx].phone = phone;
    if (email !== undefined)
        db_1.tenants[tenantIdx].email = email;
    if (domain !== undefined)
        db_1.tenants[tenantIdx].domain = domain;
    const updatedTenant = db_1.tenants[tenantIdx];
    // Registrar Auditoría Global
    addAuditLog('system', 'tenants', tenantId, 'UPDATE', req.user?.email || 'superadmin@sincroedu.com', previousTenant, updatedTenant);
    return res.json(updatedTenant);
});
// 3. OBTENER TODOS LOS ROLES DE UN TENANT
app.get('/api/tenants/:tenantId/roles', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    // Aislamiento Multi-Tenant estricto
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    // Filtrar roles del tenant específico (o globales si es superadmin)
    const tenantRoles = db_1.roles.filter(r => r.tenantId === tenantId || r.tenantId === null);
    return res.json(tenantRoles);
});
// 4. OBTENER PERMISOS DETALLADOS PARA UN ROL ESPECÍFICO
app.get('/api/tenants/:tenantId/roles/:roleId/permissions', authenticateJWT, (req, res) => {
    const { tenantId, roleId } = req.params;
    // Aislamiento Multi-Tenant estricto
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const role = db_1.roles.find(r => r.id === roleId && (r.tenantId === tenantId || r.tenantId === null));
    if (!role) {
        return res.status(404).json({ error: 'Rol no encontrado' });
    }
    // Retornar la lista completa de opciones de menú con sus banderas canView, etc.
    const permissions = db_1.roleMenuPermissions.filter(p => p.roleId === roleId);
    const mappedPermissions = db_1.menuOptions.map(menu => {
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
app.put('/api/tenants/:tenantId/roles/:roleId/permissions', authenticateJWT, (req, res) => {
    const { tenantId, roleId } = req.params;
    const { permissions } = req.body;
    // Aislamiento Multi-Tenant estricto
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const role = db_1.roles.find(r => r.id === roleId && r.tenantId === tenantId);
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
    permissions.forEach((updatedPerm) => {
        const idx = db_1.roleMenuPermissions.findIndex(p => p.roleId === roleId && p.menuOptionId === updatedPerm.menuOptionId);
        if (idx !== -1) {
            db_1.roleMenuPermissions[idx].canView = !!updatedPerm.canView;
            db_1.roleMenuPermissions[idx].canCreate = !!updatedPerm.canCreate;
            db_1.roleMenuPermissions[idx].canEdit = !!updatedPerm.canEdit;
            db_1.roleMenuPermissions[idx].canDelete = !!updatedPerm.canDelete;
            db_1.roleMenuPermissions[idx].updatedAt = new Date().toISOString();
        }
        else {
            // Si no existía, crearlo
            db_1.roleMenuPermissions.push({
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
app.post('/api/tenants/:tenantId/roles', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    const { name, description, permissions } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!name) {
        return res.status(400).json({ error: 'El nombre del rol es requerido' });
    }
    const existingRole = db_1.roles.find(r => r.name.toLowerCase() === name.toLowerCase() && r.tenantId === tenantId);
    if (existingRole) {
        return res.status(409).json({ error: 'Ya existe un rol con ese nombre en esta institución' });
    }
    const newRoleId = `r-custom-${Date.now()}`;
    const newRole = {
        id: newRoleId,
        tenantId,
        name,
        description: description || '',
        isSystemRole: false
    };
    db_1.roles.push(newRole);
    // Si se proveen permisos iniciales, guardarlos
    if (Array.isArray(permissions)) {
        permissions.forEach((perm) => {
            db_1.roleMenuPermissions.push({
                id: `p-${newRoleId.substring(2, 6)}-${perm.menuOptionId}`,
                roleId: newRoleId,
                menuOptionId: perm.menuOptionId,
                canView: !!perm.canView,
                canCreate: !!perm.canCreate,
                canEdit: !!perm.canEdit,
                canDelete: !!perm.canDelete
            });
        });
    }
    else {
        // Si no, inicializarlos todos en false
        db_1.menuOptions.forEach(menu => {
            db_1.roleMenuPermissions.push({
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
app.get('/api/tenants/:tenantId/courses', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const tenantCourses = db_1.courses.filter(c => c.tenantId === tenantId);
    return res.json(tenantCourses);
});
// Crear un nuevo curso
app.post('/api/tenants/:tenantId/courses', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    const { code, name, description, credits, status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!code || !name) {
        return res.status(400).json({ error: 'Código y Nombre del curso obligatorios' });
    }
    const codeExists = db_1.courses.find(c => c.code.toLowerCase() === code.toLowerCase() && c.tenantId === tenantId);
    if (codeExists) {
        return res.status(409).json({ error: `Ya existe un curso con el código '${code}'` });
    }
    const newCourse = {
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
    db_1.courses.push(newCourse);
    // Registrar en Historial de Auditoría
    addAuditLog(tenantId, 'courses', newCourse.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newCourse);
    return res.status(212).json(newCourse);
});
// Editar curso (Guarda historial de ediciones)
app.put('/api/tenants/:tenantId/courses/:courseId', authenticateJWT, (req, res) => {
    const { tenantId, courseId } = req.params;
    const { name, description, credits } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const courseIdx = db_1.courses.findIndex(c => c.id === courseId && c.tenantId === tenantId);
    if (courseIdx === -1) {
        return res.status(404).json({ error: 'Curso no encontrado' });
    }
    const previousCourse = { ...db_1.courses[courseIdx] };
    // Aplicar cambios
    if (name)
        db_1.courses[courseIdx].name = name;
    if (description !== undefined)
        db_1.courses[courseIdx].description = description;
    if (credits !== undefined)
        db_1.courses[courseIdx].credits = Number(credits);
    db_1.courses[courseIdx].updatedAt = new Date().toISOString();
    const newCourse = db_1.courses[courseIdx];
    // Registrar en Auditoría
    addAuditLog(tenantId, 'courses', courseId, 'UPDATE', req.user?.email || 'admin@colegiopremium.edu', previousCourse, newCourse);
    return res.json(newCourse);
});
// Modificar Estado del curso (Borrador -> Activo -> Archivado)
app.patch('/api/tenants/:tenantId/courses/:courseId/status', authenticateJWT, (req, res) => {
    const { tenantId, courseId } = req.params;
    const { status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!status || !['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'Estado de curso inválido' });
    }
    const courseIdx = db_1.courses.findIndex(c => c.id === courseId && c.tenantId === tenantId);
    if (courseIdx === -1) {
        return res.status(404).json({ error: 'Curso no encontrado' });
    }
    const previousStatus = db_1.courses[courseIdx].status;
    db_1.courses[courseIdx].status = status;
    db_1.courses[courseIdx].updatedAt = new Date().toISOString();
    // Registrar en Auditoría (Cambio de Estado)
    addAuditLog(tenantId, 'courses', courseId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousStatus }, { status });
    return res.json(db_1.courses[courseIdx]);
});
// Obtener Historial de Auditoría de un curso
app.get('/api/tenants/:tenantId/courses/:courseId/history', authenticateJWT, (req, res) => {
    const { tenantId, courseId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const history = db_1.auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'courses' && log.recordId === courseId);
    return res.json(history);
});
// =====================================================================
// API 8: MÓDULO GESTIÓN DE FACULTAD / DOCENTES (CON HISTORIAL Y ESTADOS)
// =====================================================================
// Listar todos los profesores (con detalles combinados de usuario)
app.get('/api/tenants/:tenantId/professors', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const tenantProfs = db_1.professors.filter(p => p.tenantId === tenantId).map(prof => {
        const linkedUser = db_1.users.find(u => u.id === prof.userId);
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
app.post('/api/tenants/:tenantId/professors', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    const { userId, specialty, hireDate, status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!userId || !specialty) {
        return res.status(400).json({ error: 'Usuario docente y Especialidad requeridos' });
    }
    const userExists = db_1.users.find(u => u.id === userId && u.tenantId === tenantId);
    if (!userExists) {
        return res.status(404).json({ error: 'Usuario no encontrado en la institución' });
    }
    const isAlreadyProf = db_1.professors.find(p => p.userId === userId);
    if (isAlreadyProf) {
        return res.status(409).json({ error: 'Este usuario ya está registrado como profesor de la facultad' });
    }
    const newProf = {
        id: `p-${Date.now()}`,
        tenantId,
        userId,
        specialty,
        hireDate: hireDate || new Date().toISOString().split('T')[0],
        status: status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    db_1.professors.push(newProf);
    // Registrar Auditoría
    addAuditLog(tenantId, 'professors', newProf.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newProf);
    return res.status(212).json(newProf);
});
// Editar Profesor
app.put('/api/tenants/:tenantId/professors/:profId', authenticateJWT, (req, res) => {
    const { tenantId, profId } = req.params;
    const { specialty, hireDate } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const profIdx = db_1.professors.findIndex(p => p.id === profId && p.tenantId === tenantId);
    if (profIdx === -1) {
        return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    const previousProf = { ...db_1.professors[profIdx] };
    if (specialty)
        db_1.professors[profIdx].specialty = specialty;
    if (hireDate)
        db_1.professors[profIdx].hireDate = hireDate;
    db_1.professors[profIdx].updatedAt = new Date().toISOString();
    const newProf = db_1.professors[profIdx];
    // Registrar Auditoría
    addAuditLog(tenantId, 'professors', profId, 'UPDATE', req.user?.email || 'admin@colegiopremium.edu', previousProf, newProf);
    return res.json(newProf);
});
// Modificar Estado de Profesor (Activo -> Licencia -> Inactivo)
app.patch('/api/tenants/:tenantId/professors/:profId/status', authenticateJWT, (req, res) => {
    const { tenantId, profId } = req.params;
    const { status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!status || !['active', 'license', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Estado de facultad inválido' });
    }
    const profIdx = db_1.professors.findIndex(p => p.id === profId && p.tenantId === tenantId);
    if (profIdx === -1) {
        return res.status(404).json({ error: 'Profesor no encontrado' });
    }
    const previousStatus = db_1.professors[profIdx].status;
    db_1.professors[profIdx].status = status;
    db_1.professors[profIdx].updatedAt = new Date().toISOString();
    // Registrar Auditoría
    addAuditLog(tenantId, 'professors', profId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousStatus }, { status });
    return res.json(db_1.professors[profIdx]);
});
// Obtener Historial de Auditoría de un profesor
app.get('/api/tenants/:tenantId/professors/:profId/history', authenticateJWT, (req, res) => {
    const { tenantId, profId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const history = db_1.auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'professors' && log.recordId === profId);
    return res.json(history);
});
// =====================================================================
// API 9: MÓDULO GESTIÓN DE SEDES / AULAS (CON HISTORIAL Y ESTADOS)
// =====================================================================
// Listar todas las sedes
app.get('/api/tenants/:tenantId/campuses', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const tenantCampuses = db_1.campuses.filter(c => c.tenantId === tenantId);
    return res.json(tenantCampuses);
});
// Crear Sede
app.post('/api/tenants/:tenantId/campuses', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    const { name, address, type, capacity, status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!name || !address || !type) {
        return res.status(400).json({ error: 'Nombre, Dirección/URL y Tipo obligatorios' });
    }
    const newCampus = {
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
    db_1.campuses.push(newCampus);
    // Registrar Auditoría
    addAuditLog(tenantId, 'campuses', newCampus.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newCampus);
    return res.status(212).json(newCampus);
});
// Editar Sede
app.put('/api/tenants/:tenantId/campuses/:campusId', authenticateJWT, (req, res) => {
    const { tenantId, campusId } = req.params;
    const { name, address, capacity } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const campusIdx = db_1.campuses.findIndex(c => c.id === campusId && c.tenantId === tenantId);
    if (campusIdx === -1) {
        return res.status(404).json({ error: 'Sede no encontrada' });
    }
    const previousCampus = { ...db_1.campuses[campusIdx] };
    if (name)
        db_1.campuses[campusIdx].name = name;
    if (address)
        db_1.campuses[campusIdx].address = address;
    if (capacity !== undefined)
        db_1.campuses[campusIdx].capacity = Number(capacity);
    db_1.campuses[campusIdx].updatedAt = new Date().toISOString();
    const newCampus = db_1.campuses[campusIdx];
    // Registrar Auditoría
    addAuditLog(tenantId, 'campuses', campusId, 'UPDATE', req.user?.email || 'admin@colegiopremium.edu', previousCampus, newCampus);
    return res.json(newCampus);
});
// Modificar Estado de Sede (Activa -> Mantenimiento -> Cerrada)
app.patch('/api/tenants/:tenantId/campuses/:campusId/status', authenticateJWT, (req, res) => {
    const { tenantId, campusId } = req.params;
    const { status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!status || !['active', 'maintenance', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Estado de sede inválido' });
    }
    const campusIdx = db_1.campuses.findIndex(c => c.id === campusId && c.tenantId === tenantId);
    if (campusIdx === -1) {
        return res.status(404).json({ error: 'Sede no encontrada' });
    }
    const previousStatus = db_1.campuses[campusIdx].status;
    db_1.campuses[campusIdx].status = status;
    db_1.campuses[campusIdx].updatedAt = new Date().toISOString();
    // Registrar Auditoría
    addAuditLog(tenantId, 'campuses', campusId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousStatus }, { status });
    return res.json(db_1.campuses[campusIdx]);
});
// Obtener Auditoría de una sede
app.get('/api/tenants/:tenantId/campuses/:campusId/history', authenticateJWT, (req, res) => {
    const { tenantId, campusId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const history = db_1.auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'campuses' && log.recordId === campusId);
    return res.json(history);
});
// =====================================================================
// API 10: MÓDULO EXPEDIENTES Y MATRÍCULA DE ALUMNOS (FASE 3)
// =====================================================================
// Listar todos los estudiantes del Tenant
app.get('/api/tenants/:tenantId/students', authenticateJWT, (req, res) => {
    const { tenantId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const tenantStudents = db_1.students.filter(s => s.tenantId === tenantId);
    return res.json(tenantStudents);
});
// Registrar un nuevo estudiante
app.post('/api/tenants/:tenantId/students', authenticateJWT, (req, res) => {
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
    const tenantStudents = db_1.students.filter(s => s.tenantId === tenantId);
    const count = tenantStudents.length;
    const enrollmentNumber = `MAT-${year}-${String(count + 1).padStart(4, '0')}`;
    const newStudent = {
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
    db_1.students.push(newStudent);
    // Registrar en Historial de Auditoría
    addAuditLog(tenantId, 'students', newStudent.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newStudent);
    return res.status(201).json(newStudent);
});
// Editar expediente del alumno
app.put('/api/tenants/:tenantId/students/:studentId', authenticateJWT, (req, res) => {
    const { tenantId, studentId } = req.params;
    const { documentId, firstName, lastName, email, phone, birthDate, admissionDate } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const studentIdx = db_1.students.findIndex(s => s.id === studentId && s.tenantId === tenantId);
    if (studentIdx === -1) {
        return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const previousStudent = { ...db_1.students[studentIdx] };
    // Aplicar cambios
    if (documentId)
        db_1.students[studentIdx].documentId = documentId;
    if (firstName)
        db_1.students[studentIdx].firstName = firstName;
    if (lastName)
        db_1.students[studentIdx].lastName = lastName;
    if (email)
        db_1.students[studentIdx].email = email;
    if (phone !== undefined)
        db_1.students[studentIdx].phone = phone;
    if (birthDate)
        db_1.students[studentIdx].birthDate = birthDate;
    if (admissionDate)
        db_1.students[studentIdx].admissionDate = admissionDate;
    db_1.students[studentIdx].updatedAt = new Date().toISOString();
    const newStudent = db_1.students[studentIdx];
    // Registrar en Auditoría
    addAuditLog(tenantId, 'students', studentId, 'UPDATE', req.user?.email || 'admin@colegiopremium.edu', previousStudent, newStudent);
    return res.json(newStudent);
});
// Modificar Estado del estudiante
app.patch('/api/tenants/:tenantId/students/:studentId/status', authenticateJWT, (req, res) => {
    const { tenantId, studentId } = req.params;
    const { status } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!status || !['active', 'suspended', 'graduated', 'inactive'].includes(status)) {
        return res.status(400).json({ error: 'Estado de alumno inválido' });
    }
    const studentIdx = db_1.students.findIndex(s => s.id === studentId && s.tenantId === tenantId);
    if (studentIdx === -1) {
        return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const previousStatus = db_1.students[studentIdx].status;
    db_1.students[studentIdx].status = status;
    db_1.students[studentIdx].updatedAt = new Date().toISOString();
    // Registrar en Auditoría
    addAuditLog(tenantId, 'students', studentId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousStatus }, { status });
    return res.json(db_1.students[studentIdx]);
});
// Obtener Auditoría de un estudiante
app.get('/api/tenants/:tenantId/students/:studentId/history', authenticateJWT, (req, res) => {
    const { tenantId, studentId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const history = db_1.auditLogs.filter(log => log.tenantId === tenantId && log.tableName === 'students' && log.recordId === studentId);
    return res.json(history);
});
// =====================================================================
// API 11: MATRÍCULAS DE ASIGNATURAS (ENROLLMENTS)
// =====================================================================
// Obtener asignaturas en las que está matriculado un estudiante
app.get('/api/tenants/:tenantId/students/:studentId/enrollments', authenticateJWT, (req, res) => {
    const { tenantId, studentId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const studentEnrollments = db_1.enrollments.filter(e => e.studentId === studentId && e.tenantId === tenantId);
    // Mapear con datos del curso
    const mapped = studentEnrollments.map(e => {
        const course = db_1.courses.find(c => c.id === e.courseId);
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
app.post('/api/tenants/:tenantId/students/:studentId/enrollments', authenticateJWT, (req, res) => {
    const { tenantId, studentId } = req.params;
    const { courseId, academicPeriod } = req.body;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    if (!courseId || !academicPeriod) {
        return res.status(400).json({ error: 'Curso y Periodo Académico obligatorios' });
    }
    // Verificar si el estudiante existe
    const studentExists = db_1.students.find(s => s.id === studentId && s.tenantId === tenantId);
    if (!studentExists) {
        return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    // Verificar si el curso existe
    const courseExists = db_1.courses.find(c => c.id === courseId && c.tenantId === tenantId);
    if (!courseExists) {
        return res.status(404).json({ error: 'Curso no encontrado en el catálogo' });
    }
    // Verificar si ya está matriculado y activo en este periodo
    const alreadyEnrolled = db_1.enrollments.find(e => e.studentId === studentId &&
        e.courseId === courseId &&
        e.academicPeriod === academicPeriod &&
        e.status === 'active');
    if (alreadyEnrolled) {
        return res.status(409).json({ error: 'El estudiante ya se encuentra matriculado activamente en este curso para el periodo actual' });
    }
    // VALIDACIÓN DE PRERREQUISITOS ACADÉMICOS
    if (courseExists.prerequisites && Array.isArray(courseExists.prerequisites) && courseExists.prerequisites.length > 0) {
        const missingPrerequisites = [];
        courseExists.prerequisites.forEach(prereqId => {
            const isApproved = db_1.enrollments.some(e => e.studentId === studentId && e.courseId === prereqId && e.status === 'completed');
            if (!isApproved) {
                const prereqCourse = db_1.courses.find(c => c.id === prereqId);
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
    const newEnrollment = {
        id: `en-${Date.now()}`,
        tenantId,
        studentId,
        courseId,
        academicPeriod,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    db_1.enrollments.push(newEnrollment);
    // Registrar Auditoría
    addAuditLog(tenantId, 'enrollments', newEnrollment.id, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newEnrollment);
    return res.status(201).json({
        ...newEnrollment,
        courseCode: courseExists.code,
        courseName: courseExists.name,
        courseCredits: courseExists.credits
    });
});
// Dar de baja o retirar una matrícula (Dropped)
app.delete('/api/tenants/:tenantId/students/:studentId/enrollments/:enrollmentId', authenticateJWT, (req, res) => {
    const { tenantId, studentId, enrollmentId } = req.params;
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Acceso denegado: Aislamiento Tenant violado' });
    }
    const enrollmentIdx = db_1.enrollments.findIndex(e => e.id === enrollmentId && e.studentId === studentId && e.tenantId === tenantId);
    if (enrollmentIdx === -1) {
        return res.status(404).json({ error: 'Matrícula no encontrada' });
    }
    const previousEnrollment = { ...db_1.enrollments[enrollmentIdx] };
    // Modificar estado a 'dropped'
    db_1.enrollments[enrollmentIdx].status = 'dropped';
    db_1.enrollments[enrollmentIdx].updatedAt = new Date().toISOString();
    const newEnrollment = db_1.enrollments[enrollmentIdx];
    // Registrar Auditoría
    addAuditLog(tenantId, 'enrollments', enrollmentId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousEnrollment.status }, { status: 'dropped' });
    return res.json(newEnrollment);
});
// ============================================================================
// MODULO CRM Y CAPTACION DE LEADS (ADMISIÓN ESCOLAR MULTI-TENANT)
// ============================================================================
// Helper para extraer tenantId de forma segura
const getRequestTenantId = (req) => {
    if (req.user?.tenantId)
        return req.user.tenantId;
    if (req.user?.roleId === 'r-superadmin') {
        return req.query.tenantId || req.body.tenantId || 't-11111111-1111-1111-1111-111111111111';
    }
    return null;
};
// 1. Obtener todos los Leads del Tenant
app.get('/api/crm/leads', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    // Filtrar leads del tenant
    let filteredLeads = db_1.leads.filter(l => l.tenantId === tenantId);
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
app.post('/api/crm/leads', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const { firstName, lastName, parentName, email, phone, gradeInterested, source, assignedUserId } = req.body;
    if (!firstName || !lastName || !parentName || !email || !phone || !gradeInterested || !source) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    const newLeadId = `ld-${Date.now()}`;
    const newLead = {
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
    db_1.leads.push(newLead);
    // Registrar Actividad de Captación del Sistema
    db_1.leadActivities.push({
        id: `la-${Date.now()}`,
        leadId: newLeadId,
        type: 'system',
        summary: 'Lead captado e ingresado',
        details: `Prospecto ingresado mediante canal [${source}]. Interesado en ${gradeInterested}. Apoderado: ${parentName}.`,
        createdBy: req.user?.email || 'Sistema',
        createdAt: new Date().toISOString()
    });
    // Registrar Auditoría Inmutable
    addAuditLog(tenantId, 'leads', newLeadId, 'CREATE', req.user?.email || 'admin@colegiopremium.edu', null, newLead);
    return res.status(201).json(newLead);
});
// 3. Modificar datos del Lead
app.put('/api/crm/leads/:leadId', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const leadIdx = db_1.leads.findIndex(l => l.id === leadId && l.tenantId === tenantId);
    if (leadIdx === -1) {
        return res.status(404).json({ error: 'Prospecto no encontrado' });
    }
    const previousLead = { ...db_1.leads[leadIdx] };
    const { firstName, lastName, parentName, email, phone, gradeInterested, assignedUserId } = req.body;
    if (firstName)
        db_1.leads[leadIdx].firstName = firstName;
    if (lastName)
        db_1.leads[leadIdx].lastName = lastName;
    if (parentName)
        db_1.leads[leadIdx].parentName = parentName;
    if (email)
        db_1.leads[leadIdx].email = email;
    if (phone)
        db_1.leads[leadIdx].phone = phone;
    if (gradeInterested)
        db_1.leads[leadIdx].gradeInterested = gradeInterested;
    if (assignedUserId !== undefined)
        db_1.leads[leadIdx].assignedUserId = assignedUserId;
    db_1.leads[leadIdx].updatedAt = new Date().toISOString();
    const updatedLead = db_1.leads[leadIdx];
    // Registrar en la Bitácora Comercial de Actividades
    db_1.leadActivities.push({
        id: `la-${Date.now()}`,
        leadId,
        type: 'system',
        summary: 'Ficha comercial editada',
        details: 'Se actualizaron los datos personales o de contacto del prospecto escolar.',
        createdBy: req.user?.email || 'Asesor Comercial',
        createdAt: new Date().toISOString()
    });
    // Registrar Auditoría Inmutable
    addAuditLog(tenantId, 'leads', leadId, 'UPDATE', req.user?.email || 'admin@colegiopremium.edu', previousLead, updatedLead);
    return res.json(updatedLead);
});
// 4. Mutar Etapa del Embudo (Pipeline Step)
app.patch('/api/crm/leads/:leadId/stage', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    const { status, lostReason } = req.body;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const leadIdx = db_1.leads.findIndex(l => l.id === leadId && l.tenantId === tenantId);
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
    const previousLead = { ...db_1.leads[leadIdx] };
    db_1.leads[leadIdx].status = status;
    if (status === 'lost') {
        db_1.leads[leadIdx].lostReason = lostReason;
    }
    else {
        db_1.leads[leadIdx].lostReason = undefined;
    }
    db_1.leads[leadIdx].updatedAt = new Date().toISOString();
    const updatedLead = db_1.leads[leadIdx];
    // Registrar Actividad de Transición en la Bitácora
    db_1.leadActivities.push({
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
    addAuditLog(tenantId, 'leads', leadId, 'STATUS_CHANGE', req.user?.email || 'admin@colegiopremium.edu', { status: previousLead.status, lostReason: previousLead.lostReason }, { status, lostReason });
    return res.json(updatedLead);
});
// 5. Obtener Bitácora (Timeline) de un Lead
app.get('/api/crm/leads/:leadId/timeline', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    // Validar pertenencia del lead
    const leadExists = db_1.leads.some(l => l.id === leadId && l.tenantId === tenantId);
    if (!leadExists) {
        return res.status(404).json({ error: 'Lead no encontrado o fuera de aislamiento' });
    }
    const timeline = db_1.leadActivities.filter(a => a.leadId === leadId);
    timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json(timeline);
});
// 6. Registrar Interacción (Llamada, Correo, Reunión, Nota)
app.post('/api/crm/leads/:leadId/activities', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    const { type, summary, details } = req.body;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    if (!type || !summary) {
        return res.status(400).json({ error: 'Tipo y resumen de interacción son obligatorios' });
    }
    const leadExists = db_1.leads.some(l => l.id === leadId && l.tenantId === tenantId);
    if (!leadExists) {
        return res.status(404).json({ error: 'Lead no encontrado' });
    }
    const newActivity = {
        id: `la-${Date.now()}`,
        leadId,
        type,
        summary,
        details: details || '',
        createdBy: req.user?.email || 'Asesor Comercial',
        createdAt: new Date().toISOString()
    };
    db_1.leadActivities.push(newActivity);
    return res.status(201).json(newActivity);
});
// 7. Obtener Tareas de Seguimiento de un Lead
app.get('/api/crm/leads/:leadId/tasks', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const leadExists = db_1.leads.some(l => l.id === leadId && l.tenantId === tenantId);
    if (!leadExists) {
        return res.status(404).json({ error: 'Lead no encontrado o fuera de aislamiento' });
    }
    const tasks = db_1.leadTasks.filter(t => t.leadId === leadId);
    tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return res.json(tasks);
});
// 8. Crear Tarea de Seguimiento
app.post('/api/crm/leads/:leadId/tasks', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId } = req.params;
    const { title, dueDate } = req.body;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    if (!title || !dueDate) {
        return res.status(400).json({ error: 'Título de la tarea y fecha de vencimiento son requeridos' });
    }
    const leadExists = db_1.leads.some(l => l.id === leadId && l.tenantId === tenantId);
    if (!leadExists) {
        return res.status(404).json({ error: 'Lead no encontrado' });
    }
    const newTask = {
        id: `lt-${Date.now()}`,
        leadId,
        title,
        dueDate,
        status: 'pending',
        assignedTo: req.user?.email || 'admin@colegiopremium.edu',
        createdAt: new Date().toISOString()
    };
    db_1.leadTasks.push(newTask);
    return res.status(201).json(newTask);
});
// 9. Completar/Pendiente una Tarea de Seguimiento
app.put('/api/crm/leads/:leadId/tasks/:taskId/toggle', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    const { leadId, taskId } = req.params;
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const leadExists = db_1.leads.some(l => l.id === leadId && l.tenantId === tenantId);
    if (!leadExists) {
        return res.status(404).json({ error: 'Lead no encontrado' });
    }
    const taskIdx = db_1.leadTasks.findIndex(t => t.id === taskId && t.leadId === leadId);
    if (taskIdx === -1) {
        return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    const previousStatus = db_1.leadTasks[taskIdx].status;
    db_1.leadTasks[taskIdx].status = previousStatus === 'pending' ? 'completed' : 'pending';
    return res.json(db_1.leadTasks[taskIdx]);
});
// 10. Estadísticas Comerciales del Pipeline de Admisiones (Métricas de Conversión)
app.get('/api/crm/metrics', authenticateJWT, (req, res) => {
    const tenantId = getRequestTenantId(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'Identificador del Tenant no especificado' });
    }
    const tenantLeads = db_1.leads.filter(l => l.tenantId === tenantId);
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
    const pendingTasksCount = db_1.leadTasks.filter(t => tenantLeadsIds.includes(t.leadId) && t.status === 'pending').length;
    return res.json({
        totalLeads: totalLeadsCount,
        conversionRate,
        projectedPipeline,
        sourcesDistribution: sourcesCount,
        pendingTasks: pendingTasksCount,
        activeLeads: activeLeadsCount
    });
});
// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(`🚀 SINCROEDU BACKEND INICIADO EN EL PUERTO ${PORT}`);
    console.log(`📡 URL API: http://localhost:${PORT}`);
    console.log(`=============================================================`);
});
