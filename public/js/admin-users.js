// public/js/admin-users.js - VERSIÓN COMPLETA CON GESTIÓN DE ESTADOS
class AdminUsersManager {
    constructor() {
        this.users = [];
        this.currentUser = null;
        this.isAdmin = false;
        this.modalOpen = false;
        this.filteredUsers = [];
        this.currentFilter = 'todos';
        this.init();
    }

    async init() {
        console.log('👑 Inicializando AdminUsersManager con gestión de estados');
        
        await this.checkAdminPermissions();
        if (this.isAdmin) {
            this.setupEventListeners();
            this.showAdminMenu();
            this.injectStyles();
        } else {
            this.hideAdminMenu();
        }
    }

    /**
     * 🔐 Verificar permisos de administrador
     */
async checkAdminPermissions() {
    try {
        const result = await ApiService.request('/api/auth-status');
        
        if (result.success && result.user && result.user.role === 'admin') {
            this.isAdmin = true;
            this.currentUser = result.user;
            console.log('✅ Usuario administrador detectado:', this.currentUser.nombre);
            return true;
        } else {
            console.log('👤 Usuario normal - características de admin ocultas');
            return false;
        }
    } catch (error) {
        console.error('❌ Error verificando permisos:', error);
        return false;
    }
}

    /**
     * 🎨 Inyectar estilos CSS
     */
    injectStyles() {
        if (!document.querySelector('#admin-users-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'admin-users-styles';
            styleEl.textContent = `
                .admin-users-modal .modal-content {
                    max-width: 95% !important;
                    width: 1200px !important;
                    max-height: 90vh !important;
                }
                
                .admin-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin-bottom: 25px;
                }
                
                .admin-stat-card {
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    border-left: 4px solid #3b82f6;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .admin-stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 20px;
                }
                
                .admin-stat-info h3 {
                    margin: 0;
                    font-size: 14px;
                    color: #6b7280;
                    font-weight: 500;
                }
                
                .admin-stat-value {
                    font-size: 28px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-top: 5px;
                }
                
                .users-table-container {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                
                .table-header-actions {
                    padding: 20px;
                    background: #f9fafb;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .search-box {
                    position: relative;
                    width: 300px;
                }
                
                .search-box i {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #9ca3af;
                }
                
                .search-box input {
                    width: 100%;
                    padding: 10px 10px 10px 40px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 14px;
                }
                
                .search-box input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .table-responsive {
                    overflow-x: auto;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .users-table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 1000px;
                }
                
                .users-table thead {
                    background: #f3f4f6;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                .users-table th {
                    padding: 15px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                    white-space: nowrap;
                }
                
                .users-table td {
                    padding: 15px;
                    border-bottom: 1px solid #e5e7eb;
                    vertical-align: middle;
                }
                
                .users-table tbody tr:hover {
                    background-color: #f9fafb;
                }
                
                .user-inactive {
                    opacity: 0.7;
                    background-color: #f9fafb;
                }
                
                .user-inactive:hover {
                    opacity: 0.9;
                }
                
                .role-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-align: center;
                    min-width: 90px;
                }
                
                .role-admin {
                    background-color: #fef3c7;
                    color: #92400e;
                    border: 1px solid #f59e0b;
                }
                
                .role-user {
                    background-color: #d1fae5;
                    color: #065f46;
                    border: 1px solid #34d399;
                }
                
                .status-badge {
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-align: center;
                    min-width: 100px;
                }
                
                .status-active {
                    background-color: #d1fae5;
                    color: #065f46;
                    border: 1px solid #10b981;
                }
                
                .status-suspended {
                    background-color: #fef3c7;
                    color: #92400e;
                    border: 1px solid #f59e0b;
                }
                
                .status-blocked {
                    background-color: #fee2e2;
                    color: #991b1b;
                    border: 1px solid #ef4444;
                }
                
                .action-buttons {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .action-buttons button {
                    font-size: 12px;
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .action-buttons button:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .action-buttons button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .btn-sm {
                    font-size: 12px !important;
                    padding: 6px 12px !important;
                }
                
                .btn-warning {
                    background-color: #f59e0b;
                    color: white;
                    border: none;
                }
                
                .btn-warning:hover {
                    background-color: #d97706;
                }
                
                .btn-danger {
                    background-color: #ef4444;
                    color: white;
                    border: none;
                }
                
                .btn-danger:hover {
                    background-color: #dc2626;
                }
                
                .btn-success {
                    background-color: #10b981;
                    color: white;
                    border: none;
                }
                
                .btn-success:hover {
                    background-color: #059669;
                }
                
                .btn-outline {
                    background-color: transparent;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                }
                
                .filter-buttons {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                
                .filter-btn {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid #d1d5db;
                    background: white;
                    color: #4b5563;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                
                .filter-btn:hover {
                    background: #f9fafb;
                }
                
                .filter-btn.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }
                
                .current-user-badge {
                    display: inline-block;
                    margin-left: 8px;
                    padding: 2px 8px;
                    background: #3b82f6;
                    color: white;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                }
                
                .admin-badge {
                    display: inline-block;
                    margin-left: 8px;
                    padding: 2px 8px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: white;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }
            `;
            document.head.appendChild(styleEl);
            console.log('✅ Estilos CSS inyectados');
        }
    }

    /**
     * 📝 Mostrar/ocultar menú de administración
     */
    showAdminMenu() {
        const adminLink = document.getElementById('admin-users-link');
        if (adminLink) {
            adminLink.style.display = 'block';
            console.log('✅ Enlace de gestión de usuarios mostrado');
        }
        
        this.addAdminBadge();
    }

    hideAdminMenu() {
        const adminLink = document.getElementById('admin-users-link');
        if (adminLink) {
            adminLink.style.display = 'none';
            console.log('🚫 Enlace de gestión de usuarios oculto');
        }
    }

    /**
     * 🏷️ Agregar badge de administrador
     */
    addAdminBadge() {
        const userNameElement = document.getElementById('userName');
        if (userNameElement && !userNameElement.querySelector('.admin-badge')) {
            const badge = document.createElement('span');
            badge.className = 'admin-badge';
            badge.textContent = 'ADMIN';
            badge.title = 'Administrador del sistema';
            userNameElement.appendChild(badge);
            console.log('👑 Badge de administrador agregado');
        }
    }

    /**
     * 🔗 Configurar event listeners
     */
    setupEventListeners() {
        // Event listener para el enlace de gestión de usuarios
        const adminLink = document.getElementById('admin-users-link');
        if (adminLink) {
            adminLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showUsersManagement();
            });
            console.log('✅ Event listener para gestión de usuarios configurado');
        }

        // Cerrar modal al hacer clic fuera
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('adminUsersModal');
            if (modal && e.target === modal) {
                this.closeModal();
            }
        });

        // Cerrar modal con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOpen) {
                this.closeModal();
            }
        });

        // Limpiar modales existentes
        document.addEventListener('DOMContentLoaded', () => {
            this.cleanupExistingModals();
        });
    }

    /**
     * 🧹 Limpiar modales existentes
     */
    cleanupExistingModals() {
        const existingModals = document.querySelectorAll('#adminUsersModal');
        if (existingModals.length > 0) {
            existingModals.forEach(modal => modal.remove());
            console.log('🧹 Modales existentes limpiados');
        }
    }

    /**
     * 👥 Mostrar gestión de usuarios
     */
    async showUsersManagement() {
        if (!this.isAdmin) {
            this.showNotification('No tienes permisos de administrador', 'error');
            return;
        }

        if (this.modalOpen) {
            console.log('⚠️ Modal ya abierto, ignorando solicitud');
            return;
        }

        console.log('📋 Abriendo gestión de usuarios...');
        await this.loadUsers();
        this.showUsersModal();
    }

    /**
     * 📋 Cargar lista de usuarios
     */
  
async loadUsers() {
    try {
        console.log('🔄 Cargando lista de usuarios...');
        
        const result = await ApiService.request('/api/admin/usuarios/lista');
        
        if (result.success) {
            this.users = result.data;
            this.filteredUsers = [...this.users];
            console.log(`✅ ${this.users.length} usuarios cargados`);
            return true;
        } else {
            throw new Error(result.message || 'Error al cargar usuarios');
        }
    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        this.showNotification('Error al cargar usuarios: ' + error.message, 'error');
        return false;
    }
}

    /**
     * 🎨 Mostrar modal de gestión de usuarios
     */
    showUsersModal() {
        // Verificar que hay usuarios cargados
        if (this.users.length === 0) {
            this.showNotification('No se pudieron cargar los usuarios', 'error');
            return;
        }

        // Limpiar modal existente antes de crear uno nuevo
        this.cleanupExistingModals();

        const usuariosActivos = this.users.filter(u => u.estado === 'activo').length;
        const usuariosSuspendidos = this.users.filter(u => u.estado === 'suspendido').length;
        const usuariosBloqueados = this.users.filter(u => u.estado === 'bloqueado').length;
        const usuariosEliminados = this.users.filter(u => u.estado === 'eliminado').length;
        const administradores = this.users.filter(u => u.role === 'admin').length;
        const usuariosNormales = this.users.filter(u => u.role === 'user').length;

        const modalContent = `
            <div class="modal admin-users-modal" id="adminUsersModal" style="display: block;">
                <div class="modal-content">
                    <span class="close-modal" onclick="window.adminUsersManager.closeModal()">&times;</span>
                    
                    <div class="modal-header">
                        <h2><i class="fas fa-users-cog"></i> Gestión de Usuarios</h2>
                        <p class="modal-subtitle">Administra los usuarios del sistema - Total: ${this.users.length} usuarios</p>
                    </div>

                    <div class="admin-stats-grid">
                        <div class="admin-stat-card">
                            <div class="admin-stat-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="admin-stat-info">
                                <h3>Usuarios Activos</h3>
                                <div class="admin-stat-value">${usuariosActivos}</div>
                            </div>
                        </div>
                        <div class="admin-stat-card">
                            <div class="admin-stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                                <i class="fas fa-pause"></i>
                            </div>
                            <div class="admin-stat-info">
                                <h3>Suspendidos</h3>
                                <div class="admin-stat-value">${usuariosSuspendidos}</div>
                            </div>
                        </div>
                        <div class="admin-stat-card">
                            <div class="admin-stat-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                                <i class="fas fa-ban"></i>
                            </div>
                            <div class="admin-stat-info">
                                <h3>Bloqueados</h3>
                                <div class="admin-stat-value">${usuariosBloqueados}</div>
                            </div>
                        </div>
                        <div class="admin-stat-card">
                            <div class="admin-stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                                <i class="fas fa-crown"></i>
                            </div>
                            <div class="admin-stat-info">
                                <h3>Administradores</h3>
                                <div class="admin-stat-value">${administradores}</div>
                            </div>
                        </div>
                    </div>

                    <div class="filter-buttons">
                        <button class="filter-btn ${this.currentFilter === 'todos' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('todos')">
                            <i class="fas fa-list"></i> Todos (${this.users.filter(u => u.estado !== 'eliminado').length})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'activos' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('activos')">
                            <i class="fas fa-check-circle"></i> Activos (${usuariosActivos})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'suspendidos' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('suspendidos')">
                            <i class="fas fa-pause-circle"></i> Suspendidos (${usuariosSuspendidos})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'bloqueados' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('bloqueados')">
                            <i class="fas fa-ban"></i> Bloqueados (${usuariosBloqueados})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'eliminados' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('eliminados')">
                            <i class="fas fa-trash"></i> Eliminados (${usuariosEliminados})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'admins' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('admins')">
                            <i class="fas fa-crown"></i> Admins (${administradores})
                        </button>
                        <button class="filter-btn ${this.currentFilter === 'users' ? 'active' : ''}" onclick="window.adminUsersManager.filterUsers('users')">
                            <i class="fas fa-user"></i> Usuarios (${usuariosNormales})
                        </button>
                    </div>

                    <div class="users-table-container">
                        <div class="table-header-actions">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="usersSearchInput" placeholder="Buscar por nombre, correo o cédula..." autocomplete="off">
                            </div>
                            <button class="btn btn-primary" onclick="window.adminUsersManager.refreshUsers()">
                                <i class="fas fa-sync-alt"></i> Actualizar
                            </button>
                        </div>

                        <div class="table-responsive">
                            <table class="users-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Correo Electrónico</th>
                                        <th>Cédula</th>
                                        <th>Rol</th>
                                        <th>Estado</th>
                                        <th>Fecha Registro</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody id="usersTableBody">
                                    ${this.renderUsersTable()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="window.adminUsersManager.closeModal()">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Crear el modal
        const modal = document.createElement('div');
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);

        this.modalOpen = true;
        this.attachTableEventListeners();
        this.setupSearch();
        
        console.log('✅ Modal de gestión de usuarios mostrado');
    }

    /**
     * 🎨 Renderizar tabla de usuarios
     */
    renderUsersTable() {
        const usersToShow = this.filteredUsers.length > 0 ? this.filteredUsers : this.users;
        
        console.log('🎨 Renderizando tabla con usuarios:', usersToShow.map(u => ({id: u.id, nombre: u.nombre, estado: u.estado})));
        
        if (usersToShow.length === 0) {
            return `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <i class="fas fa-users" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                        <p>No hay usuarios que coincidan con el filtro seleccionado</p>
                    </td>
                </tr>
            `;
        }

        return usersToShow.map(user => {
            console.log(`🎨 Renderizando usuario ${user.id}: ${user.nombre} - Estado: ${user.estado}`);
            return `
            <tr data-user-id="${user.id}" class="${user.estado !== 'activo' ? 'user-inactive' : ''}">
                <td>
                    <div class="user-info-cell">
                        <strong>${this.escapeHtml(user.nombre || 'No especificado')}</strong>
                        ${user.id === this.currentUser?.id ? '<span class="current-user-badge">(Tú)</span>' : ''}
                    </div>
                </td>
                <td>${this.escapeHtml(user.correo || 'No especificado')}</td>
                <td>${this.escapeHtml(user.cedula || 'No especificado')}</td>
                <td>
                    <span class="role-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
                        ${user.role === 'admin' ? '👑 Administrador' : '👤 Usuario'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${this.getStatusClass(user.estado)}">
                        ${this.getStatusText(user.estado)}
                    </span>
                </td>
                <td>${this.formatDate(user.fecha_registro)}</td>
                <td>
                    <div class="action-buttons">
                        ${this.renderStatusButtons(user)}
                        ${this.renderRoleButton(user)}
                        ${this.renderDeleteButton(user)}
                    </div>
                </td>
            </tr>
        `;}).join('');
    }

    /**
     * 🎯 Renderizar botones de estado
     */
    renderStatusButtons(user) {
        if (!user || !user.id) return '';
        
        if (user.id === this.currentUser?.id) {
            return '<button class="btn btn-sm btn-outline" disabled title="No puedes modificar tu propio estado">Estado</button>';
        }

        const buttons = [];
        
        if (user.estado === 'activo') {
            // Si está activo, mostrar opciones para suspender o bloquear
            buttons.push(`
                <button class="btn btn-sm btn-warning suspend-user-btn" data-user-id="${user.id}" title="Suspender temporalmente">
                    <i class="fas fa-pause"></i> Suspender
                </button>
            `);
            buttons.push(`
                <button class="btn btn-sm btn-danger block-user-btn" data-user-id="${user.id}" title="Bloquear permanentemente">
                    <i class="fas fa-ban"></i> Bloquear
                </button>
            `);
        } else if (user.estado === 'suspendido' || user.estado === 'bloqueado') {
            // Si está suspendido o bloqueado, mostrar opción para activar
            buttons.push(`
                <button class="btn btn-sm btn-success activate-user-btn" data-user-id="${user.id}" title="Activar usuario">
                    <i class="fas fa-play"></i> Activar
                </button>
            `);
        }

        return buttons.join('');
    }

    /**
     * 🎯 Renderizar botón de cambio de rol
     */
    renderRoleButton(user) {
        if (!user || !user.id) return '';

        if (user.id === this.currentUser?.id) {
            return '<button class="btn btn-sm btn-outline" disabled title="No puedes cambiar tu propio rol">Auto</button>';
        }

        if (user.role === 'admin') {
            return `<button class="btn btn-sm btn-warning change-role-btn" data-user-id="${user.id}" data-new-role="user">
                <i class="fas fa-user"></i> Hacer Usuario
            </button>`;
        } else {
            return `<button class="btn btn-sm btn-success change-role-btn" data-user-id="${user.id}" data-new-role="admin">
                <i class="fas fa-crown"></i> Hacer Admin
            </button>`;
        }
    }

    /**
     * 🗑️ Renderizar botón de eliminación
     */
    renderDeleteButton(user) {
        if (!user || !user.id) return '';

        if (user.estado === 'eliminado') {
            return '<span class="text-muted"><i class="fas fa-trash"></i> Eliminado</span>';
        }

        if (user.id === this.currentUser?.id) {
            return '<button class="btn btn-sm btn-outline" disabled title="No puedes eliminarte a ti mismo"><i class="fas fa-trash"></i> Eliminar</button>';
        }

        const adminCount = this.users.filter(u => u.role === 'admin' && u.estado === 'activo').length;
        if (user.role === 'admin' && adminCount <= 1 && user.estado === 'activo') {
            return '<button class="btn btn-sm btn-outline" disabled title="No puedes eliminar el último administrador activo"><i class="fas fa-trash"></i> Eliminar</button>';
        }

        return `<button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}">
            <i class="fas fa-trash"></i> Eliminar
        </button>`;
    }

    /**
     * 🏷️ Obtener clase CSS para estado
     */
getStatusClass(estado) {
    switch(estado) {
        case 'activo': return 'status-active';
        case 'inactivo': return 'status-blocked';  // 🔥 Usar clase de bloqueado para inactivos
        case 'suspendido': return 'status-suspended';
        case 'bloqueado': return 'status-blocked';
        default: return 'status-unknown';
    }
}

    /**
     * 📝 Obtener texto para estado
     */
  getStatusText(estado) {
    switch(estado) {
        case 'activo': return '✅ Activo';
        case 'inactivo': return '❌ Eliminado';  // 🔥 Mostrar como "Eliminado" aunque internamente sea "inactivo"
        case 'suspendido': return '⏸️ Suspendido';
        case 'bloqueado': return '🚫 Bloqueado';
        default: return estado || '❓ Desconocido';
    }
}

    /**
     * 🔗 Adjuntar event listeners a la tabla
     */
    attachTableEventListeners() {
        // Botones de cambio de rol
        document.querySelectorAll('.change-role-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('.change-role-btn').getAttribute('data-user-id');
                const newRole = e.target.closest('.change-role-btn').getAttribute('data-new-role');
                this.changeUserRole(userId, newRole);
            });
        });

        // Botones de eliminación
        document.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('.delete-user-btn').getAttribute('data-user-id');
                this.confirmDeleteUser(userId);
            });
        });

        // Botones de estado
        this.attachStatusEventListeners();
        
        console.log('✅ Event listeners de tabla adjuntados');
    }

    /**
     * ⏸️ Adjuntar event listeners para botones de estado
     */
    attachStatusEventListeners() {
        // Botones de suspender
        document.querySelectorAll('.suspend-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('.suspend-user-btn').getAttribute('data-user-id');
                this.showSuspendModal(userId);
            });
        });

        // Botones de bloquear
        document.querySelectorAll('.block-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('.block-user-btn').getAttribute('data-user-id');
                this.confirmBlockUser(userId);
            });
        });

        // Botones de activar
        document.querySelectorAll('.activate-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.closest('.activate-user-btn').getAttribute('data-user-id');
                this.activateUser(userId);
            });
        });
    }

    /**
     * 🔄 Cambiar rol de usuario
     */
  async changeUserRole(userId, newRole) {
    const user = this.users.find(u => u.id === parseInt(userId));
    if (!user) {
        this.showNotification('Usuario no encontrado', 'error');
        return;
    }

    const confirmacion = confirm(
        `¿Cambiar rol de ${user.nombre}?\n\n` +
        `Rol actual: ${user.role === 'admin' ? 'Administrador 👑' : 'Usuario 👤'}\n` +
        `Nuevo rol: ${newRole === 'admin' ? 'Administrador 👑' : 'Usuario 👤'}\n\n` +
        `¿Confirmar cambio?`
    );

    if (!confirmacion) return;

    try {
        const result = await ApiService.request(`/api/admin/usuarios/${userId}/rol`, {
            method: 'PUT',
            body: JSON.stringify({ role: newRole })
        });

        if (result.success) {
            this.showNotification(result.message, 'success');
            await this.refreshUsersTable();
        } else {
            throw new Error(result.message || 'Error al cambiar rol');
        }
    } catch (error) {
        console.error('❌ Error cambiando rol:', error);
        this.showNotification('Error al cambiar rol: ' + error.message, 'error');
    }
}

    /**
     * 🗑️ Confirmar eliminación de usuario
     */
    confirmDeleteUser(userId) {
        const user = this.users.find(u => u.id === parseInt(userId));
        if (!user) {
            this.showNotification('Usuario no encontrado', 'error');
            return;
        }

        let confirmacion = confirm(
            `¿Eliminar usuario "${user.nombre}"?\n\n` +
            `📧 Correo: ${user.correo}\n` +
            `👑 Rol: ${user.role === 'admin' ? 'Administrador' : 'Usuario'}\n` +
            `📊 Estado: ${user.estado}\n\n` +
            `⚠️ IMPORTANTE:\n` +
            `• El usuario será marcado como ELIMINADO\n` +
            `• Su correo será modificado para evitar conflictos\n` +
            `• Sus registros históricos se mantendrán\n` +
            `• Esta acción NO se puede deshacer\n\n` +
            `¿Continuar con la eliminación?`
        );

        if (confirmacion) {
            this.deleteUser(userId, false);
        }
    }

    /**
     * 🗑️ Eliminar usuario (marcado como eliminado)
     */
async deleteUser(userId, force = false) {
    console.log(`🗑️ Intentando eliminar usuario ID: ${userId}, force: ${force}`);
    
    try {
        const url = force ? `/api/admin/usuarios/${userId}?cascade=true` : `/api/admin/usuarios/${userId}`;
        const result = await ApiService.request(url, {
            method: 'DELETE'
        });
        
        if (result.success) {
            console.log('✅ Usuario eliminado:', result);
            this.showNotification('Usuario eliminado correctamente', 'success');
            
            // Actualizar tabla sin recrear modal
            await this.refreshUsersTable();
        } else {
            // Si hay dependencias y no se forzó, preguntar si quiere forzar
            if (result.message && result.message.includes('referencias en otras tablas') && !force) {
                const forceConfirm = confirm(
                    `El usuario tiene referencias en otras tablas que impiden su eliminación automática.\n\n` +
                    `Detalles:\n${result.dependencies ? Object.entries(result.dependencies).filter(([k,v]) => v > 0).map(([k,v]) => `• ${k}: ${v}`).join('\n') : 'Ver logs del servidor'}\n\n` +
                    `¿Desea FORZAR la eliminación? (Esto puede causar inconsistencias en los datos)`
                );
                if (forceConfirm) {
                    return this.deleteUser(userId, true);
                } else {
                    return; // Cancelar
                }
            }
            throw new Error(result.message || 'Error al eliminar usuario');
        }
    } catch (error) {
        console.error('❌ Error eliminando usuario:', error);
        this.showNotification(error.message || 'Error al eliminar usuario', 'error');
    }
}

    /**
     * ⏸️ Mostrar modal para suspender usuario
     */
    async showSuspendModal(userId) {
        const user = this.users.find(u => u.id === parseInt(userId));
        if (!user) {
            this.showNotification('Usuario no encontrado', 'error');
            return;
        }

        // Crear modal de suspensión
        const modalHtml = `
            <div class="modal" id="suspendModal" style="display: block; z-index: 10001;">
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close-modal" onclick="document.getElementById('suspendModal').remove()">&times;</span>
                    
                    <div class="modal-header">
                        <h2><i class="fas fa-pause"></i> Suspender Usuario</h2>
                        <p class="modal-subtitle">${user.nombre} (${user.correo})</p>
                    </div>

                    <div class="modal-body">
                        <form id="suspendForm">
                            <div class="form-group">
                                <label for="motivo">Motivo de suspensión:</label>
                                <textarea id="motivo" class="form-control" rows="3" 
                                          placeholder="Ej: Comportamiento inapropiado, violación de términos..." 
                                          required></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label for="duracion_dias">Duración (días):</label>
                                <select id="duracion_dias" class="form-control">
                                    <option value="1">1 día</option>
                                    <option value="3">3 días</option>
                                    <option value="7">7 días</option>
                                    <option value="15">15 días</option>
                                    <option value="30">30 días</option>
                                    <option value="0" selected>Indefinido</option>
                                </select>
                                <small class="form-text text-muted">Seleccione 0 para suspensión indefinida</small>
                            </div>
                            
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>Atención:</strong> El usuario no podrá acceder al sistema durante el período de suspensión.
                            </div>
                        </form>
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="document.getElementById('suspendModal').remove()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button class="btn btn-warning" onclick="window.adminUsersManager.confirmSuspend('${userId}')">
                            <i class="fas fa-pause"></i> Confirmar Suspensión
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modal = document.createElement('div');
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
    }

    /**
     * ⏸️ Confirmar suspensión de usuario
     */
   async confirmSuspend(userId) {
    const user = this.users.find(u => u.id === parseInt(userId));
    if (!user) return;

    const motivo = document.getElementById('motivo')?.value;
    const duracion_dias = document.getElementById('duracion_dias')?.value;

    if (!motivo || !motivo.trim()) {
        this.showNotification('Por favor ingrese un motivo', 'error');
        return;
    }

    try {
        const result = await ApiService.request(`/api/admin/usuarios/${userId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ 
                estado: 'suspendido',
                motivo: motivo.trim(), 
                duracion_dias: parseInt(duracion_dias) 
            })
        });

        if (result.success) {
            this.showNotification(`✅ ${result.message}`, 'success');
            
            // Cerrar modal de suspensión
            const suspendModal = document.getElementById('suspendModal');
            if (suspendModal) suspendModal.remove();
            
            // Actualizar tabla
            await this.refreshUsersTable();
        } else {
            throw new Error(result.message || 'Error al suspender usuario');
        }
    } catch (error) {
        console.error('❌ Error suspendiendo usuario:', error);
        this.showNotification('Error al suspender: ' + error.message, 'error');
    }
}
    /**
     * 🚫 Confirmar bloqueo de usuario
     */
    confirmBlockUser(userId) {
        const user = this.users.find(u => u.id === parseInt(userId));
        if (!user) return;

        const confirmacion = confirm(
            `¿BLOQUEAR a ${user.nombre}?\n\n` +
            `📧 Correo: ${user.correo}\n` +
            `👑 Rol: ${user.role === 'admin' ? 'Administrador' : 'Usuario'}\n` +
            `📊 Estado actual: ${user.estado}\n\n` +
            `⚠️ BLOQUEO:\n` +
            `• El usuario NO podrá acceder al sistema\n` +
            `• Solo un administrador puede revertirlo\n` +
            `• Se mantienen sus datos históricos\n\n` +
            `¿Confirmar bloqueo?`
        );

        if (confirmacion) {
            this.blockUser(userId);
        }
    }

    /**
     * 🚫 Bloquear usuario
     */
 
async blockUser(userId) {
    try {
        const result = await ApiService.request(`/api/admin/usuarios/${userId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'bloqueado' })
        });

        if (result.success) {
            this.showNotification(`🚫 ${result.message}`, 'success');
            await this.refreshUsersTable();
        } else {
            throw new Error(result.message || 'Error al bloquear usuario');
        }
    } catch (error) {
        console.error('❌ Error bloqueando usuario:', error);
        this.showNotification('Error al bloquear: ' + error.message, 'error');
    }
}

    /**
     * ✅ Activar usuario
     */
  async activateUser(userId) {
    const user = this.users.find(u => u.id === parseInt(userId));
    if (!user) return;

    const confirmacion = confirm(
        `¿Activar a ${user.nombre}?\n` +
        `Estado actual: ${this.getStatusText(user.estado)}\n` +
        `El usuario podrá acceder al sistema nuevamente.`
    );

    if (!confirmacion) return;

    try {
        const result = await ApiService.request(`/api/admin/usuarios/${userId}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado: 'activo' })
        });

        if (result.success) {
            console.log('✅ Respuesta del backend para activar:', result);
            console.log('👤 Usuario antes de la operación:', this.users.find(u => u.id === parseInt(userId)));
            this.showNotification(`✅ ${result.message}`, 'success');
            await this.refreshUsersTable();
            console.log('👤 Usuario después de la operación:', this.users.find(u => u.id === parseInt(userId)));
        } else {
            throw new Error(result.message || 'Error al activar usuario');
        }
    } catch (error) {
        console.error('❌ Error activando usuario:', error);
        this.showNotification('Error al activar: ' + error.message, 'error');
    }
}

    /**
     * � Actualizar tabla de usuarios (sin recrear modal)
     */
    async refreshUsersTable() {
        try {
            console.log('🔄 Actualizando tabla de usuarios...');

            // Recargar usuarios
            const success = await this.loadUsers();
            if (!success) return;

            console.log(`📊 Usuarios cargados: ${this.users.length}`);
            console.log(`🎯 Filtro actual: ${this.currentFilter}`);

            // Aplicar filtro actual (esto ya actualiza tabla, estadísticas y event listeners)
            this.filterUsers(this.currentFilter);

            console.log(`📋 Usuarios filtrados: ${this.filteredUsers.length}`);
            console.log('✅ Tabla de usuarios actualizada');

        } catch (error) {
            console.error('❌ Error actualizando tabla:', error);
            this.showNotification('Error al actualizar tabla: ' + error.message, 'error');
        }
    }

    /**
     * 📊 Actualizar estadísticas del modal
     */
    updateModalStats() {
        if (!this.modalOpen) return;
        
        const usuariosActivos = this.users.filter(u => u.estado === 'activo').length;
        const usuariosSuspendidos = this.users.filter(u => u.estado === 'suspendido').length;
        const usuariosBloqueados = this.users.filter(u => u.estado === 'bloqueado').length;
        const usuariosEliminados = this.users.filter(u => u.estado === 'eliminado').length;
        const administradores = this.users.filter(u => u.role === 'admin').length;
        const usuariosNormales = this.users.filter(u => u.role === 'user').length;

        // Actualizar contadores en los botones de filtro
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            const icon = btn.querySelector('i');
            if (icon) {
                if (icon.classList.contains('fa-list')) {
                    // "Todos" excluyendo eliminados
                    const totalActivos = this.users.filter(u => u.estado !== 'eliminado').length;
                    btn.innerHTML = `<i class="fas fa-list"></i> Todos (${totalActivos})`;
                } else if (icon.classList.contains('fa-check-circle')) {
                    btn.innerHTML = `<i class="fas fa-check-circle"></i> Activos (${usuariosActivos})`;
                } else if (icon.classList.contains('fa-pause-circle')) {
                    btn.innerHTML = `<i class="fas fa-pause-circle"></i> Suspendidos (${usuariosSuspendidos})`;
                } else if (icon.classList.contains('fa-ban')) {
                    btn.innerHTML = `<i class="fas fa-ban"></i> Bloqueados (${usuariosBloqueados})`;
                } else if (icon.classList.contains('fa-trash')) {
                    btn.innerHTML = `<i class="fas fa-trash"></i> Eliminados (${usuariosEliminados})`;
                } else if (icon.classList.contains('fa-crown')) {
                    btn.innerHTML = `<i class="fas fa-crown"></i> Admins (${administradores})`;
                } else if (icon.classList.contains('fa-user')) {
                    btn.innerHTML = `<i class="fas fa-user"></i> Usuarios (${usuariosNormales})`;
                }
            }
        });

        // Actualizar estadísticas principales
        const statCards = document.querySelectorAll('.admin-stat-value');
        if (statCards.length >= 4) {
            statCards[0].textContent = usuariosActivos;
            statCards[1].textContent = usuariosSuspendidos;
            statCards[2].textContent = usuariosBloqueados;
            statCards[3].textContent = administradores;
        }

        console.log('✅ Estadísticas del modal actualizadas');
    }
    setupSearch() {
        const searchInput = document.getElementById('usersSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
            console.log('✅ Búsqueda configurada');
        }
    }

    /**
     * 🔍 Buscar usuarios
     */
    searchUsers(query) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (!query.trim()) {
            tbody.innerHTML = this.renderUsersTable();
            this.attachTableEventListeners();
            return;
        }

        const filteredUsers = this.filteredUsers.filter(user => {
            const searchTerm = query.toLowerCase();
            return (
                (user.nombre && user.nombre.toLowerCase().includes(searchTerm)) ||
                (user.correo && user.correo.toLowerCase().includes(searchTerm)) ||
                (user.cedula && user.cedula.includes(query))
            );
        });

        if (filteredUsers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <i class="fas fa-search" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                        <p>No se encontraron usuarios que coincidan con la búsqueda</p>
                    </td>
                </tr>
            `;
        } else {
            const originalUsers = this.filteredUsers;
            this.filteredUsers = filteredUsers;
            tbody.innerHTML = this.renderUsersTable();
            this.filteredUsers = originalUsers;
            this.attachTableEventListeners();
        }
    }

    /**
     * 🎯 Filtrar usuarios
     */
    filterUsers(filterType) {
        this.currentFilter = filterType;

        switch(filterType) {
            case 'todos':
                this.filteredUsers = this.users.filter(u => u.estado !== 'eliminado');
                break;
            case 'activos':
                this.filteredUsers = this.users.filter(u => u.estado === 'activo');
                break;
            case 'suspendidos':
                this.filteredUsers = this.users.filter(u => u.estado === 'suspendido');
                break;
            case 'bloqueados':
                this.filteredUsers = this.users.filter(u => u.estado === 'bloqueado');
                break;
            case 'eliminados':
                this.filteredUsers = this.users.filter(u => u.estado === 'eliminado');
                break;
            case 'admins':
                this.filteredUsers = this.users.filter(u => u.role === 'admin');
                break;
            case 'users':
                this.filteredUsers = this.users.filter(u => u.role === 'user');
                break;
            default:
                this.filteredUsers = this.users.filter(u => u.estado !== 'eliminado');
        }
        
        // Actualizar tabla
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            console.log('📋 Actualizando DOM de tabla...');
            const oldHtml = tbody.innerHTML;
            tbody.innerHTML = this.renderUsersTable();
            this.attachTableEventListeners();
            console.log('📋 DOM actualizado. HTML cambió:', oldHtml !== tbody.innerHTML);
        }
        
        // Actualizar botones de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.textContent.includes(filterType)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Actualizar estadísticas del modal
        this.updateModalStats();
    }

    /**
     * 🔄 Actualizar usuarios
     */
    async refreshUsers() {
        this.showNotification('Actualizando lista de usuarios...', 'info');
        await this.refreshUsersTable();
        this.showNotification('Lista de usuarios actualizada', 'success');
    }

    /**
     * ❌ Cerrar modal
     */
    closeModal() {
        const modal = document.getElementById('adminUsersModal');
        if (modal) {
            modal.remove();
            this.modalOpen = false;
            console.log('✅ Modal de gestión de usuarios cerrado');
        }
    }

    /**
     * 💫 Mostrar notificación
     */
    showNotification(message, type = 'info') {
        // Si existe un sistema de notificaciones global, usarlo
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback simple
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        
        if (type === 'success') {
            notification.style.background = '#10b981';
        } else if (type === 'error') {
            notification.style.background = '#ef4444';
        } else if (type === 'warning') {
            notification.style.background = '#f59e0b';
        } else {
            notification.style.background = '#3b82f6';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
        
        // Agregar estilos de animación
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * 🛡️ Escapar HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 📅 Formatear fecha
     */
    formatDate(dateString) {
        if (!dateString) return 'No disponible';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Fecha inválida';
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ AdminUsersManager cargado');
    
    setTimeout(() => {
        window.adminUsersManager = new AdminUsersManager();
        console.log('👑 AdminUsersManager inicializado correctamente');
    }, 1000);
});

// Hacer disponible globalmente
window.AdminUsersManager = AdminUsersManager;