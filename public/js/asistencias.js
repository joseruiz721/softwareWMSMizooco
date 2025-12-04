/**
 * Sistema de Gestión de Asistencias - MULTI-USUARIO
 * Versión 3.1: Con manejo de errores de duplicados
 * Todos los usuarios pueden registrar para otros
 * Solo administradores pueden ver reportes completos
 */

// Guardar referencia al fetch original para evitar conflictos
const originalFetch = window.fetch;

class AsistenciasManager {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.currentPhoto = null;
        this.currentType = null;
        this.cameraAvailable = false;
        this.isAdmin = false;
        this.currentUser = null;
        this.users = [];
        this.selectedUserId = null;
        this.isMultiUserMode = false;
        this.lastRegistration = null;
        
        console.log('🚀 Inicializando AsistenciasManager (Multi-Usuario)');
        this.init();
    }

    async init() {
        try {
            console.log('📱 Inicializando sistema de asistencias...');
            
            // Inicializar elementos DOM
            this.video = document.getElementById('video-asistencia');
            this.canvas = document.getElementById('canvas-asistencia');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
            }
            
            // Cargar estado del usuario y lista de usuarios
            await this.loadUserStatus();
            await this.loadUsers();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Verificar cámara
            await this.checkCameraAvailability();
            
            // Actualizar UI según permisos
            this.updateUIByPermissions();
            
            console.log('✅ Sistema de asistencias inicializado correctamente');
            
        } catch (error) {
            console.error('❌ Error inicializando sistema de asistencias:', error);
        }
    }

    async loadUserStatus() {
        try {
            console.log('👤 Cargando estado del usuario...');
            
            const response = await fetch('/api/auth-status', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.isAdmin = data.isAdmin || false;
                this.currentUser = data.user || null;
                
                console.log(`✅ Usuario cargado: ${this.currentUser?.nombre || 'No autenticado'}`);
                console.log(`👑 Es administrador: ${this.isAdmin}`);
                
            } else {
                console.warn('⚠️ No se pudo cargar el estado del usuario');
            }
            
        } catch (error) {
            console.error('❌ Error cargando estado del usuario:', error);
            this.isAdmin = false;
            this.currentUser = null;
        }
    }

    async loadUsers() {
        try {
            console.log('📋 Cargando lista de usuarios para selector...');
            
            const response = await fetch('/api/usuarios/activos', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.users = result.data;
                    this.populateUserSelectors();
                    console.log(`✅ ${this.users.length} usuarios cargados para selector`);
                } else {
                    console.warn('⚠️ No se pudieron cargar usuarios:', result.message);
                    this.users = [];
                }
            } else {
                console.warn('⚠️ Error en la respuesta de usuarios');
                this.users = [];
            }
            
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
            this.users = [];
            
            // Fallback: al menos mostrar el usuario actual
            if (this.currentUser) {
                this.users = [this.currentUser];
                this.populateUserSelectors();
            }
        }
    }

    populateUserSelectors() {
        const selector = document.getElementById('usuario-asistencia');
        const reportSelector = document.getElementById('report-user');
        
        // 🔥 SELECTOR PRINCIPAL: Visible para TODOS los usuarios
        if (selector) {
            selector.innerHTML = '';
            
            // Opción por defecto
            const defaultOption = document.createElement('option');
            defaultOption.value = this.currentUser?.id || '';
            defaultOption.textContent = this.currentUser ? 
                `👤 ${this.currentUser.nombre} (Yo mismo)` : 
                'Selecciona usuario';
            selector.appendChild(defaultOption);
            
            // Opciones para otros usuarios
            this.users.forEach(user => {
                // No mostrar el usuario actual en la lista de otros
                if (!this.currentUser || user.id !== this.currentUser.id) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    
                    // Icono según rol
                    let icon = '👤';
                    if (user.role === 'admin') icon = '👑';
                    if (user.role === 'tecnico') icon = '🔧';
                    
                    // Texto de la opción
                    let displayText = `${icon} ${user.nombre}`;
                    if (user.cedula) {
                        displayText += ` (${user.cedula})`;
                    }
                    
                    option.textContent = displayText;
                    selector.appendChild(option);
                }
            });
            
            // 🔥 MOSTRAR SELECTOR SIEMPRE (para todos los usuarios)
            const container = document.getElementById('usuario-selector-container');
            if (container) {
                container.style.display = 'block';
                
                // Actualizar texto del label según modo
                const label = container.querySelector('label');
                if (label) {
                    label.textContent = 'Registrar asistencia para:';
                    label.style.fontWeight = 'bold';
                    label.style.color = '#2c3e50';
                    label.style.marginBottom = '8px';
                    label.style.display = 'block';
                }
                
                // Actualizar texto de ayuda
                const helpText = container.querySelector('.text-muted') || 
                                document.createElement('small');
                if (!helpText.classList.contains('text-muted')) {
                    helpText.className = 'text-muted';
                    helpText.style.display = 'block';
                    helpText.style.fontSize = '12px';
                    helpText.style.marginTop = '5px';
                    helpText.style.color = '#6c757d';
                    container.appendChild(helpText);
                }
                
                // Mensaje diferente según si es admin o no
                if (this.isAdmin) {
                    helpText.textContent = 'Puedes registrar asistencia para cualquier usuario del sistema';
                } else {
                    helpText.textContent = 'Puedes ayudar a registrar asistencia para tus compañeros';
                }
            }
            
            console.log('✅ Selector de usuario configurado (visible para todos)');
        }
        
        // SELECTOR DE REPORTE: Solo para administradores
        if (reportSelector) {
            reportSelector.innerHTML = '';
            
            const allOption = document.createElement('option');
            allOption.value = '';
            allOption.textContent = 'Todos los usuarios';
            reportSelector.appendChild(allOption);
            
            // Solo llenar si es admin
            if (this.isAdmin && this.users.length > 0) {
                this.users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.nombre} ${user.cedula ? `(${user.cedula})` : ''}`;
                    reportSelector.appendChild(option);
                });
            }
        }
    }

    setupEventListeners() {
        console.log('🔗 Configurando event listeners...');
        
        // Botones del widget flotante
        const btnCheckin = document.getElementById('btn-checkin');
        const btnCheckout = document.getElementById('btn-checkout');
        const btnReport = document.getElementById('btn-asistencia-report');
        
        if (btnCheckin) {
            btnCheckin.addEventListener('click', () => this.openModal('entrada'));
            console.log('✅ Botón checkin configurado');
        }
        
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => this.openModal('salida'));
            console.log('✅ Botón checkout configurado');
        }
        
        if (btnReport) {
            btnReport.addEventListener('click', () => this.openReportModal());
            console.log('✅ Botón reporte configurado');
        }
        
        // Botones del modal principal
        const tomarFotoBtn = document.getElementById('tomar-foto-btn');
        const enviarCheckinBtn = document.getElementById('enviar-checkin-btn');
        const enviarCheckoutBtn = document.getElementById('enviar-checkout-btn');
        const closeAsistenciaBtn = document.getElementById('close-asistencia');
        const usuarioSelector = document.getElementById('usuario-asistencia');
        
        if (tomarFotoBtn) {
            tomarFotoBtn.addEventListener('click', () => this.capturePhoto());
        }
        
        if (enviarCheckinBtn) {
            enviarCheckinBtn.addEventListener('click', () => this.submitAsistencia('entrada'));
        }
        
        if (enviarCheckoutBtn) {
            enviarCheckoutBtn.addEventListener('click', () => this.submitAsistencia('salida'));
        }
        
        if (closeAsistenciaBtn) {
            closeAsistenciaBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (usuarioSelector) {
            usuarioSelector.addEventListener('change', (e) => {
                this.selectedUserId = e.target.value || this.currentUser?.id;
                this.isMultiUserMode = this.selectedUserId !== this.currentUser?.id;
                
                // Actualizar mensaje según selección
                this.updateSelectionMessage();
                
                console.log(`🔀 Modo ${this.isMultiUserMode ? 'MULTI-USUARIO' : 'PERSONAL'}:`, 
                    this.selectedUserId === this.currentUser?.id ? 'Para mí mismo' : 'Para otro usuario');
            });
        }
        
        // Botones del modal de reporte
        const closeReportBtn = document.getElementById('close-asistencia-report');
        const buscarReportBtn = document.getElementById('buscar-report');
        const exportReportBtn = document.getElementById('export-report');
        
        if (closeReportBtn) {
            closeReportBtn.addEventListener('click', () => this.closeReportModal());
        }
        
        if (buscarReportBtn) {
            buscarReportBtn.addEventListener('click', () => this.loadReporte());
        }
        
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => this.exportReporte());
        }
        
        // Cerrar modales al hacer clic fuera
        this.setupModalCloseHandlers();
        
        console.log('✅ Todos los event listeners configurados');
    }

    updateSelectionMessage() {
        const msgElement = document.getElementById('asistencia-msg');
        if (!msgElement) return;
        
        if (this.selectedUserId === this.currentUser?.id || !this.selectedUserId) {
            // Modo personal
            msgElement.innerHTML = `
                <div style="
                    background: #e8f4fd;
                    padding: 10px;
                    border-radius: 5px;
                    border-left: 4px solid #3498db;
                    font-size: 14px;
                ">
                    <strong>👤 Registrando para ti mismo</strong><br>
                    La foto es opcional. Se registrará bajo tu nombre.
                </div>
            `;
        } else {
            // Modo multi-usuario
            const selectedUser = this.users.find(u => u.id == this.selectedUserId);
            if (selectedUser) {
                msgElement.innerHTML = `
                    <div style="
                        background: #fff8e1;
                        padding: 10px;
                        border-radius: 5px;
                        border-left: 4px solid #f39c12;
                        font-size: 14px;
                    ">
                        <strong>🔓 MODO COLABORATIVO</strong><br>
                        Registrarás para: <strong>${selectedUser.nombre}</strong><br>
                        <small>La asistencia se registrará bajo el nombre de ${selectedUser.nombre}, 
                        pero se guardará que tú la realizaste.</small>
                    </div>
                `;
            }
        }
    }

    setupModalCloseHandlers() {
        // Modal principal de asistencia
        const modalAsistencia = document.getElementById('modal-asistencia');
        if (modalAsistencia) {
            modalAsistencia.addEventListener('click', (e) => {
                if (e.target === modalAsistencia) {
                    this.closeModal();
                }
            });
        }

        // Modal de reporte
        const modalReporte = document.getElementById('modal-asistencia-report');
        if (modalReporte) {
            modalReporte.addEventListener('click', (e) => {
                if (e.target === modalReporte) {
                    this.closeReportModal();
                }
            });
        }
    }

    updateUIByPermissions() {
        console.log('🎨 Actualizando UI según permisos...');
        
        // Botón de reporte: solo para admins
        const btnReport = document.getElementById('btn-asistencia-report');
        if (btnReport) {
            if (this.isAdmin) {
                btnReport.style.display = 'inline-block';
                btnReport.title = 'Ver reporte de asistencias (Admin)';
            } else {
                btnReport.style.display = 'none';
            }
        }
        
        // Aplicar estilos para el selector de usuario
        this.applySelectorStyles();
        
        console.log('✅ UI actualizada según permisos');
    }

    applySelectorStyles() {
        const container = document.getElementById('usuario-selector-container');
        if (!container) return;
        
        // Asegurar que el contenedor tenga estilos adecuados
        container.style.cssText = `
            display: block !important;
            margin: 15px 0;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        `;
        
        // Estilos para el select
        const selector = document.getElementById('usuario-asistencia');
        if (selector) {
            selector.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 2px solid #3498db;
                border-radius: 4px;
                font-size: 14px;
                background: white;
                color: #333;
                margin-top: 5px;
            `;
        }
    }

    async checkCameraAvailability() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('⚠️ API de cámara no soportada en este navegador');
                this.cameraAvailable = false;
                return false;
            }
            
            // Intentar acceder a la cámara
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                } 
            });
            
            // Detener inmediatamente para solo verificar disponibilidad
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ Cámara disponible para asistencias');
            this.cameraAvailable = true;
            return true;
            
        } catch (error) {
            console.warn('⚠️ Cámara no disponible:', error.name);
            this.cameraAvailable = false;
            return false;
        }
    }

    async openModal(type) {
        console.log(`📱 Abriendo modal para: ${type}`);
        
        this.currentType = type;
        this.currentPhoto = null;
        this.selectedUserId = this.currentUser?.id || null;
        this.isMultiUserMode = false;
        
        const modal = document.getElementById('modal-asistencia');
        if (!modal) {
            console.error('❌ No se encontró el modal de asistencia');
            this.showNotification('Error: No se puede abrir el formulario de asistencia', 'error');
            return;
        }
        
        // Mostrar modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Actualizar título y botones según tipo
        this.updateModalUI(type);
        
        // Configurar selector por defecto
        const selector = document.getElementById('usuario-asistencia');
        if (selector && this.currentUser) {
            selector.value = this.currentUser.id;
        }
        
        // Actualizar mensaje
        this.updateSelectionMessage();
        
        // Mostrar advertencia de duplicado si aplica
        await this.checkForDuplicateWarning();
        
        // Intentar iniciar cámara
        await this.startCamera();
        
        console.log(`✅ Modal abierto para ${type}`);
    }

    async checkForDuplicateWarning() {
        try {
            // Solo verificar para el usuario actual
            if (this.selectedUserId === this.currentUser?.id) {
                const response = await fetch('/api/asistencias/ultimo-registro', {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        const ultimoRegistro = result.data;
                        const ahora = new Date();
                        const fechaUltimo = new Date(ultimoRegistro.fecha);
                        const diferenciaMinutos = (ahora - fechaUltimo) / (1000 * 60);
                        
                        // Si el último registro es del mismo tipo y fue hace menos de 30 minutos
                        if (ultimoRegistro.tipo === this.currentType && diferenciaMinutos < 30) {
                            const msgElement = document.getElementById('asistencia-msg');
                            if (msgElement) {
                                msgElement.innerHTML = `
                                    <div style="
                                        background: #fff3cd;
                                        padding: 10px;
                                        border-radius: 5px;
                                        border-left: 4px solid #ffc107;
                                        font-size: 14px;
                                        margin-bottom: 10px;
                                    ">
                                        <strong>⚠️ ADVERTENCIA: Registro duplicado</strong><br>
                                        Ya tienes una ${this.currentType} registrada hace 
                                        ${Math.round(diferenciaMinutos)} minutos.<br>
                                        <small>Si necesitas registrar otra ${this.currentType}, 
                                        espera al menos 30 minutos o verifica que sea necesario.</small>
                                    </div>
                                `;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ No se pudo verificar duplicados:', error);
        }
    }

    updateModalUI(type) {
        const titulo = document.querySelector('#modal-asistencia .modal-header h3');
        const btnCheckin = document.getElementById('enviar-checkin-btn');
        const btnCheckout = document.getElementById('enviar-checkout-btn');
        const tomarFotoBtn = document.getElementById('tomar-foto-btn');
        
        if (titulo) {
            titulo.textContent = `Registrar ${type === 'entrada' ? 'Entrada' : 'Salida'}`;
        }
        
        // Mostrar botón según tipo de registro
        if (btnCheckin) {
            btnCheckin.style.display = type === 'entrada' ? 'inline-block' : 'none';
            btnCheckin.textContent = `Enviar ${type === 'entrada' ? 'Entrada' : ''}`;
        }
        
        if (btnCheckout) {
            btnCheckout.style.display = type === 'salida' ? 'inline-block' : 'none';
            btnCheckout.textContent = `Enviar ${type === 'salida' ? 'Salida' : ''}`;
        }
        
        // Mostrar/ocultar botón de foto según disponibilidad
        if (tomarFotoBtn) {
            tomarFotoBtn.style.display = this.cameraAvailable ? 'inline-block' : 'none';
            if (!this.cameraAvailable) {
                tomarFotoBtn.disabled = true;
                tomarFotoBtn.title = 'Cámara no disponible';
            }
        }
    }

    async startCamera() {
        const tomarFotoBtn = document.getElementById('tomar-foto-btn');
        
        // Si la cámara no está disponible, ocultar botón
        if (tomarFotoBtn && !this.cameraAvailable) {
            tomarFotoBtn.style.display = 'none';
            return;
        }
        
        try {
            // Detener stream anterior si existe
            if (this.stream) {
                this.stopCamera();
            }
            
            // Iniciar nueva cámara
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            if (this.video) {
                this.video.srcObject = this.stream;
                await this.video.play();
                console.log('📹 Cámara iniciada correctamente');
            }
            
        } catch (error) {
            console.error('❌ Error al acceder a la cámara:', error);
            this.cameraAvailable = false;
            
            if (tomarFotoBtn) {
                tomarFotoBtn.style.display = 'none';
            }
            
            // Mostrar mensaje amigable
            this.showMessage('Cámara no disponible. Puedes registrar asistencia sin foto.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
    }

    capturePhoto() {
        if (!this.video || !this.video.videoWidth || !this.video.videoHeight || !this.canvas) {
            console.error('❌ Video o canvas no disponible para capturar foto');
            this.showMessage('Error: Video no disponible para capturar foto');
            return;
        }
        
        try {
            // Ajustar canvas al tamaño del video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Capturar foto del video
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Mostrar canvas con la foto capturada
            this.canvas.style.display = 'block';
            this.currentPhoto = this.canvas.toDataURL('image/jpeg', 0.8);
            
            // Mensaje de éxito
            this.showMessage('✅ Foto capturada correctamente');
            
            console.log('📸 Foto capturada exitosamente');
            
        } catch (error) {
            console.error('❌ Error capturando foto:', error);
            this.showMessage('Error al capturar foto. Intenta de nuevo.');
        }
    }

    async submitAsistencia(tipo) {
        try {
            // Validar que se haya seleccionado un usuario
            if (!this.selectedUserId) {
                this.showNotification('Por favor selecciona un usuario', 'warning');
                return;
            }
            
            // 🔥 NUEVO: Confirmar si es un posible duplicado
            const confirmed = await this.confirmIfDuplicate(tipo);
            if (!confirmed) {
                console.log('❌ Registro cancelado por el usuario (posible duplicado)');
                return;
            }
            
            // Mostrar mensaje de carga según modo
            let loadingMessage = '⏳ Registrando asistencia...';
            if (this.isMultiUserMode) {
                const selectedUser = this.users.find(u => u.id == this.selectedUserId);
                if (selectedUser) {
                    loadingMessage = `⏳ Registrando asistencia para ${selectedUser.nombre}...`;
                }
            }
            
            this.showMessage(loadingMessage);
            
            // Preparar datos del formulario
            const formData = new FormData();
            formData.append('tipo', tipo);
            
            // 🔥 ENVIAR SIEMPRE el usuario_id (funciona para todos los roles)
            formData.append('usuario_id', this.selectedUserId);
            
            console.log(`📤 Enviando registro: tipo=${tipo}, usuario_id=${this.selectedUserId}, multi=${this.isMultiUserMode}`);
            
            // Agregar foto si fue capturada
            if (this.currentPhoto) {
                const blob = this.dataURLtoBlob(this.currentPhoto);
                if (blob) {
                    formData.append('foto', blob, `asistencia_${tipo}_${Date.now()}.jpg`);
                }
            }
            
            // Usar endpoint único (configurado en backend para todos los roles)
            const endpoint = '/api/asistencias/registrar';
            
            const response = await originalFetch(endpoint, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            if (!response.ok) {
                let errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.message || `Error ${response.status}`);
                } catch {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Mensaje personalizado según modo
                let successMessage = result.message;
                if (this.isMultiUserMode) {
                    const selectedUser = this.users.find(u => u.id == this.selectedUserId);
                    if (selectedUser) {
                        successMessage = `✅ Asistencia de ${tipo} registrada exitosamente para ${selectedUser.nombre}`;
                    }
                }
                
                // Mostrar notificación
                this.showNotification(successMessage, 'success');
                
                // Guardar último registro
                this.lastRegistration = {
                    tipo: tipo,
                    fecha: new Date(),
                    usuarioId: this.selectedUserId
                };
                
                // Cerrar modal
                this.closeModal();
                
                // Mostrar resumen si hay datos
                if (result.data) {
                    this.mostrarResumenRegistro(result.data);
                }
                
                console.log('✅ Asistencia registrada exitosamente');
                
            } else {
                throw new Error(result.message || 'Error desconocido');
            }
            
        } catch (error) {
            console.error('❌ Error registrando asistencia:', error);
            
            // 🔥 MEJORADO: Manejar errores específicos
            let errorMessage = error.message;
            let notificationType = 'error';
            
            if (error.message.includes('Ya tienes un registro') || 
                error.message.includes('duplicado') ||
                error.message.includes('Duplicate') ||
                error.message.includes('400')) {
                
                errorMessage = `⚠️ REGISTRO DUPLICADO<br><br>
                               Ya tienes una ${this.currentType} registrada recientemente.<br>
                               <small>Debes esperar al menos 30 minutos entre registros del mismo tipo.</small>`;
                notificationType = 'warning';
                
            } else if (error.message.includes('No tienes permiso') || 
                      error.message.includes('403') ||
                      error.message.includes('Forbidden')) {
                
                errorMessage = '🔒 PERMISO DENEGADO<br><br>No tienes permisos para realizar esta acción.';
                
            } else if (error.message.includes('404') || 
                      error.message.includes('Not Found')) {
                
                errorMessage = '🔍 USUARIO NO ENCONTRADO<br><br>El usuario seleccionado no existe.';
                
            } else {
                errorMessage = `❌ ERROR<br><br>${error.message}`;
            }
            
            this.showNotification(errorMessage, notificationType, 5000);
            this.showMessage(errorMessage.replace(/<br>/g, '\n'));
        }
    }

    async confirmIfDuplicate(tipo) {
        try {
            // Solo verificar para el usuario actual (modo personal)
            if (this.selectedUserId === this.currentUser?.id) {
                const response = await fetch('/api/asistencias/ultimo-registro', {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        const ultimoRegistro = result.data;
                        const ahora = new Date();
                        const fechaUltimo = new Date(ultimoRegistro.fecha);
                        const diferenciaMinutos = (ahora - fechaUltimo) / (1000 * 60);
                        
                        // Si el último registro es del mismo tipo y fue hace menos de 30 minutos
                        if (ultimoRegistro.tipo === tipo && diferenciaMinutos < 30) {
                            return await this.showDuplicateConfirmation(diferenciaMinutos, tipo);
                        }
                    }
                }
            }
            return true; // Permitir registro si no hay duplicado
        } catch (error) {
            console.warn('⚠️ No se pudo verificar duplicados:', error);
            return true; // Permitir registro en caso de error
        }
    }

    async showDuplicateConfirmation(diferenciaMinutos, tipo) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 25px;
                border-radius: 10px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            `;
            
            const minutos = Math.round(diferenciaMinutos);
            
            content.innerHTML = `
                <h3 style="color: #e74c3c; margin-top: 0; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px;"></i>
                    ADVERTENCIA: Registro Duplicado
                </h3>
                
                <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0;">
                        <strong>⚠️ Ya tienes una ${tipo} registrada hace ${minutos} minutos.</strong>
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #7f8c8d;">
                        El sistema detecta que estás intentando registrar otra ${tipo} 
                        en un período muy corto de tiempo.
                    </p>
                </div>
                
                <div style="margin: 20px 0;">
                    <p><strong>¿Estás seguro de que necesitas registrar otra ${tipo}?</strong></p>
                    <p style="font-size: 13px; color: #666;">
                        Razones válidas para registrar duplicado:
                        <ul style="font-size: 13px; color: #666; margin: 10px 0 10px 20px;">
                            <li>Olvidaste registrar la salida y necesitas corregir</li>
                            <li>Hubo un error en el registro anterior</li>
                            <li>Cambio de turno no registrado</li>
                        </ul>
                    </p>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button id="cancel-duplicate" style="
                        padding: 10px 20px;
                        background: #95a5a6;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button id="confirm-duplicate" style="
                        padding: 10px 20px;
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        <i class="fas fa-check"></i> Sí, Registrar de Todos Modos
                    </button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // Event listeners para los botones
            document.getElementById('cancel-duplicate').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });
            
            document.getElementById('confirm-duplicate').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });
            
            // Cerrar al hacer clic fuera del modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }

    dataURLtoBlob(dataURL) {
        try {
            const byteString = atob(dataURL.split(',')[1]);
            const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            
            return new Blob([ab], { type: mimeString });
        } catch (error) {
            console.error('Error convirtiendo DataURL a Blob:', error);
            return null;
        }
    }

    closeModal() {
        // Detener cámara
        this.stopCamera();
        
        // Ocultar modal
        const modal = document.getElementById('modal-asistencia');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Restaurar scroll del body
        document.body.style.overflow = '';
        
        // Resetear variables
        this.currentPhoto = null;
        this.currentType = null;
        this.selectedUserId = this.currentUser?.id || null;
        this.isMultiUserMode = false;
        
        // Resetear selector al usuario actual
        const selector = document.getElementById('usuario-asistencia');
        if (selector && this.currentUser) {
            selector.value = this.currentUser.id;
        }
        
        // Limpiar canvas
        if (this.canvas) {
            this.canvas.style.display = 'none';
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
        
        console.log('📱 Modal cerrado');
    }

    // =================== REPORTES (SOLO ADMIN) ===================

    async openReportModal() {
        console.log('📊 Abriendo modal de reportes...');
        
        // Verificar si es admin
        if (!this.isAdmin) {
            this.showNotification('Solo los administradores pueden acceder a los reportes de asistencias', 'warning');
            return;
        }
        
        const modal = document.getElementById('modal-asistencia-report');
        if (!modal) {
            console.error('❌ No se encontró el modal de reporte');
            this.showNotification('Error: No se puede abrir el reporte', 'error');
            return;
        }
        
        // Mostrar modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Establecer fechas por defecto (últimos 7 días)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        
        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');
        
        if (startInput) startInput.value = start.toISOString().split('T')[0];
        if (endInput) endInput.value = end.toISOString().split('T')[0];
        
        // Cargar reporte inicial
        await this.loadReporte();
        
        console.log('✅ Modal de reportes abierto');
    }

    closeReportModal() {
        const modal = document.getElementById('modal-asistencia-report');
        if (modal) {
            modal.style.display = 'none';
        }
        document.body.style.overflow = '';
        
        console.log('📊 Modal de reportes cerrado');
    }

    async loadReporte() {
        try {
            // Verificar nuevamente si es admin (seguridad adicional)
            if (!this.isAdmin) {
                this.showNotification('No tienes permisos para ver reportes', 'warning');
                return;
            }
            
            const start = document.getElementById('report-start')?.value;
            const end = document.getElementById('report-end')?.value;
            const usuarioId = document.getElementById('report-user')?.value;
            
            if (!start || !end) {
                this.showNotification('Selecciona un rango de fechas', 'warning');
                return;
            }
            
            // Construir URL
            let url = `/api/asistencias/reporte?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
            
            if (usuarioId && usuarioId.trim() !== '') {
                url += `&usuario_id=${encodeURIComponent(usuarioId)}`;
            }
            
            console.log(`📊 Solicitando reporte: ${url}`);
            
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.mostrarReporte(result.data || []);
                const count = result.data?.length || 0;
                this.showNotification(`✅ Reporte cargado: ${count} registros`, 'success');
            } else {
                throw new Error(result.message || 'Error desconocido');
            }
            
        } catch (error) {
            console.error('❌ Error cargando reporte:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    mostrarReporte(data) {
        const tbody = document.querySelector('#tabla-asistencias tbody');
        if (!tbody) {
            console.error('❌ No se encontró el tbody de la tabla de reportes');
            return;
        }
        
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: #6c757d;">
                        No hay registros de asistencia para el período seleccionado
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar por fecha descendente
        data.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        data.forEach(registro => {
            const row = document.createElement('tr');
            
            // Formatear fecha
            let fechaStr = 'N/A';
            try {
                const fecha = new Date(registro.fecha);
                if (!isNaN(fecha.getTime())) {
                    fechaStr = fecha.toLocaleString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                }
            } catch (e) {
                console.warn('Error formateando fecha:', e);
            }
            
            // Badge para tipo
            const tipoBadge = registro.tipo === 'entrada' 
                ? '<span style="background-color: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">Entrada</span>'
                : '<span style="background-color: #dc3545; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px;">Salida</span>';
            
            // Enlace para foto
            let fotoCell = '<span style="color: #6c757d; font-size: 12px;">Sin foto</span>';
            if (registro.foto_path) {
                const fotoUrl = registro.foto_path.startsWith('http') || registro.foto_path.startsWith('/') 
                    ? registro.foto_path 
                    : `/uploads/asistencias/${registro.foto_path}`;
                
                fotoCell = `
                    <a href="${fotoUrl}" target="_blank" 
                       style="background-color: #17a2b8; color: white; padding: 2px 8px; border-radius: 3px; 
                              text-decoration: none; font-size: 12px; display: inline-block;">
                        <i class="fas fa-eye"></i> Ver Foto
                    </a>
                `;
            }
            
            // Información del usuario
            let usuarioInfo = registro.nombre || 'N/A';
            if (registro.cedula) {
                usuarioInfo += `<br><small style="color: #6c757d;">Cédula: ${registro.cedula}</small>`;
            }
            
            row.innerHTML = `
                <td style="padding: 8px; font-size: 13px;">
                    ${fechaStr}
                </td>
                <td style="padding: 8px;">
                    <strong>${usuarioInfo}</strong>
                    ${registro.registrante_nombre && registro.registrante_nombre !== registro.nombre 
                        ? `<br><small style="color: #6c757d;">Registrado por: ${registro.registrante_nombre}</small>` 
                        : ''}
                </td>
                <td style="padding: 8px;">${tipoBadge}</td>
                <td style="padding: 8px;">${fotoCell}</td>
                <td style="padding: 8px;">
                    <small style="color: #6c757d;">${registro.ip_origen || 'N/A'}</small>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        console.log(`📋 Reporte mostrado: ${data.length} registros`);
    }

    async exportReporte() {
        try {
            // Verificar si es admin
            if (!this.isAdmin) {
                this.showNotification('Solo los administradores pueden exportar reportes', 'warning');
                return;
            }
            
            const start = document.getElementById('report-start')?.value;
            const end = document.getElementById('report-end')?.value;
            const usuarioId = document.getElementById('report-user')?.value;
            
            if (!start || !end) {
                this.showNotification('Selecciona un rango de fechas', 'warning');
                return;
            }
            
            // Construir URL para exportar CSV
            let url = `/api/asistencias/exportar-csv?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
            if (usuarioId && usuarioId.trim() !== '') {
                url += `&usuario_id=${encodeURIComponent(usuarioId)}`;
            }
            
            console.log(`📤 Exportando reporte: ${url}`);
            
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            // Obtener blob
            const blob = await response.blob();
            
            // Obtener nombre del archivo
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `reporte_asistencias_${new Date().toISOString().split('T')[0]}.csv`;
            
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }
            
            // Crear enlace de descarga
            const urlObject = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlObject;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Liberar objeto URL
            setTimeout(() => URL.revokeObjectURL(urlObject), 100);
            
            this.showNotification('📊 Reporte exportado correctamente', 'success');
            
        } catch (error) {
            console.error('❌ Error exportando reporte:', error);
            this.showNotification(`Error exportando: ${error.message}`, 'error');
        }
    }

    mostrarResumenRegistro(registro) {
        try {
            let fechaStr = 'N/A';
            if (registro.fecha) {
                const fecha = new Date(registro.fecha);
                if (!isNaN(fecha.getTime())) {
                    fechaStr = fecha.toLocaleString('es-ES');
                }
            }
            
            let mensaje = `
                <div style="text-align: left; padding: 10px;">
                    <div style="font-weight: bold; color: #28a745; margin-bottom: 8px;">
                        ✅ Asistencia registrada exitosamente
                    </div>
                    <div style="font-size: 13px;">
                        <strong>Tipo:</strong> ${registro.tipo || 'N/A'}<br>
                        <strong>Fecha:</strong> ${fechaStr}<br>
                        <strong>IP:</strong> ${registro.ip_origen || 'N/A'}<br>
                        ${registro.foto_path ? '📸 Con foto adjunta' : '📷 Sin foto'}
                    </div>
                </div>
            `;
            
            this.showNotification(mensaje, 'success', 5000);
            
        } catch (error) {
            console.error('Error mostrando resumen:', error);
            this.showNotification('Asistencia registrada exitosamente', 'success');
        }
    }

    showMessage(mensaje) {
        const msgElement = document.getElementById('asistencia-msg');
        if (msgElement) {
            msgElement.innerHTML = mensaje;
            msgElement.style.display = 'block';
        }
    }

    showNotification(mensaje, tipo = 'info', duracion = 3000) {
        // Usar sistema de notificaciones existente si está disponible
        if (window.Utils && typeof window.Utils.showNotification === 'function') {
            window.Utils.showNotification(mensaje, tipo, duracion);
            return;
        }
        
        // Sistema de notificaciones alternativo
        const notification = document.createElement('div');
        notification.className = `notification-${tipo}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            background-color: ${tipo === 'success' ? '#28a745' : 
                            tipo === 'error' ? '#dc3545' : 
                            tipo === 'warning' ? '#ffc107' : '#17a2b8'};
        `;
        
        // Icono según tipo
        const icon = tipo === 'success' ? 'fa-check-circle' :
                    tipo === 'error' ? 'fa-exclamation-circle' :
                    tipo === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <i class="fas ${icon}" style="font-size: 16px; margin-top: 2px;"></i>
                <div>${mensaje}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Agregar estilos de animación si no existen
        if (!document.getElementById('notification-styles')) {
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
        
        // Remover notificación después del tiempo especificado
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duracion);
    }
}

// =================== INICIALIZACIÓN ===================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.asistenciasManager = new AsistenciasManager();
        console.log('✅ Sistema de asistencias multi-usuario inicializado');
    });
} else {
    window.asistenciasManager = new AsistenciasManager();
    console.log('✅ Sistema de asistencias multi-usuario inicializado (DOM ya listo)');
}

// Exportar para uso global
window.AsistenciasManager = AsistenciasManager;

// Función global para abrir reporte (solo admin)
window.abrirReporteAsistencias = function() {
    if (window.asistenciasManager) {
        window.asistenciasManager.openReportModal();
    }
};

// Función para forzar actualización de usuarios
window.actualizarUsuariosAsistencias = async function() {
    if (window.asistenciasManager) {
        await window.asistenciasManager.loadUsers();
        console.log('🔄 Usuarios actualizados para selector de asistencias');
    }
};