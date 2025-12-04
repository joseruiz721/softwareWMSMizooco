class HorariosCalendario {
    static mesActual = new Date().getMonth() + 1;
    static anioActual = new Date().getFullYear();
    static tecnicos = [];
    static datosCalendario = null;
    static tecnicoArrastrado = null;
    static ordenTecnicosPorSemana = {};
    static esAdministrador = false;

    static async init() {
        this.bindEvents();
        await this.verificarPermisos();
        this.cargarTecnicos();
        this.cargarCalendario(this.mesActual, this.anioActual);
        console.log('✅ HorariosCalendario inicializado');
    }

    static async verificarPermisos() {
        try {
            const response = await fetch('/api/check-admin', { credentials: 'include' });
            const result = await response.json();
            
            this.esAdministrador = result.isAdmin;
            console.log(`🔐 Permisos verificados: ${this.esAdministrador ? 'Administrador' : 'Usuario normal'}`);
            
            return this.esAdministrador;
        } catch (error) {
            console.error('❌ Error verificando permisos:', error);
            this.esAdministrador = false;
            return false;
        }
    }

    static bindEvents() {
        // Navegación
        const horariosLink = document.getElementById('horarios-trabajo-link');
        if (horariosLink) {
            horariosLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.mostrarSeccion();
            });
        }

        // Controles del calendario
        document.getElementById('mes-calendario')?.addEventListener('change', (e) => {
            this.mesActual = parseInt(e.target.value);
            this.cargarCalendario(this.mesActual, this.anioActual);
        });

        document.getElementById('anio-calendario')?.addEventListener('change', (e) => {
            this.anioActual = parseInt(e.target.value);
            this.cargarCalendario(this.mesActual, this.anioActual);
        });

        // Botones
        document.getElementById('guardar-horarios')?.addEventListener('click', () => {
            this.guardarHorarios();
        });

        document.getElementById('nuevo-tecnico-btn')?.addEventListener('click', () => {
            this.mostrarModalTecnico();
        });

        // 🔥 NUEVO: Botón exportar PDF
        document.getElementById('exportar-pdf-btn')?.addEventListener('click', () => {
            this.exportarPDF();
        });

        // Modal técnico
        document.getElementById('guardar-tecnico')?.addEventListener('click', () => {
            this.guardarTecnico();
        });

        document.querySelectorAll('.btn-back-dashboard').forEach(btn => {
            btn.addEventListener('click', () => {
                this.ocultarSeccion();
            });
        });

        // Cerrar modal con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.ocultarModalTecnico();
            }
        });
    }

    static mostrarSeccion() {
        try {
            document.querySelectorAll('.stats-section').forEach(section => {
                section.style.display = 'none';
            });
            const seccion = document.getElementById('horarios-calendario-section');
            if (seccion) {
                seccion.style.display = 'block';
                this.inicializarSelects();
                console.log('📅 Mostrando sección de horarios');
            }
        } catch (error) {
            console.error('❌ Error mostrando sección:', error);
        }
    }

    static ocultarSeccion() {
        document.querySelectorAll('.stats-section').forEach(section => {
            section.style.display = 'none';
        });
        document.getElementById('dashboard-section').style.display = 'block';
        console.log('📊 Volviendo al dashboard');
    }

    static inicializarSelects() {
        // Inicializar select de meses
        const mesSelect = document.getElementById('mes-calendario');
        if (mesSelect) {
            const meses = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            mesSelect.innerHTML = meses.map((mes, index) => 
                `<option value="${index + 1}">${mes}</option>`
            ).join('');
            mesSelect.value = this.mesActual;
        }

        // Inicializar select de años
        const anioSelect = document.getElementById('anio-calendario');
        if (anioSelect) {
            const anioActual = new Date().getFullYear();
            anioSelect.innerHTML = '';
            for (let i = anioActual - 1; i <= anioActual + 1; i++) {
                anioSelect.innerHTML += `<option value="${i}">${i}</option>`;
            }
            anioSelect.value = this.anioActual;
        }
    }

    static async cargarTecnicos() {
        try {
            console.log('👥 Cargando lista de técnicos...');
            const response = await fetch('/api/horarios-calendario/tecnicos/listar', { credentials: 'include' });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.tecnicos = result.data;
                console.log(`✅ ${this.tecnicos.length} técnicos cargados`);
            } else {
                throw new Error(result.message || 'Error desconocido al cargar técnicos');
            }
        } catch (error) {
            console.error('❌ Error cargando técnicos:', error);
            this.mostrarError('Error al cargar la lista de técnicos: ' + error.message);
        }
    }

    static async cargarCalendario(mes, anio) {
        try {
            console.log(`📅 Cargando calendario para ${mes}/${anio}...`);
            const response = await fetch(`/api/horarios-calendario/${mes}/${anio}`, { credentials: 'include' });
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const data = result.data || {};
                
                if (data.datos_calendario && typeof data.datos_calendario === 'object') {
                    this.datosCalendario = data.datos_calendario;
                } else if (data.semanas) {
                    this.datosCalendario = data;
                } else {
                    this.datosCalendario = {
                        mes: this.mesActual,
                        anio: this.anioActual,
                        semanas: [],
                        orden_tecnicos_por_semana: {}
                    };
                }
                
                if (this.datosCalendario.orden_tecnicos_por_semana) {
                    this.ordenTecnicosPorSemana = this.datosCalendario.orden_tecnicos_por_semana;
                    console.log('🔄 Orden de técnicos por semana cargado:', this.ordenTecnicosPorSemana);
                } else {
                    this.ordenTecnicosPorSemana = {};
                    console.log('🔄 Inicializando orden vacío por semana');
                }
                
                if (!this.datosCalendario || !Array.isArray(this.datosCalendario.semanas)) {
                    console.warn('⚠️ No hay semanas en datosCalendario — mostrando mensaje de solo lectura o vacío');
                    this.mostrarInfoSoloLectura();
                    this.renderizarCalendario();
                } else {
                    this.renderizarCalendario();
                }
                console.log(`✅ Calendario cargado: ${result.exists ? 'Existente' : 'Nuevo'}`);
            } else {
                throw new Error(result.message || 'Error desconocido al cargar calendario');
            }
        } catch (error) {
            console.error('❌ Error cargando calendario:', error);
            this.mostrarError('Error al cargar el calendario: ' + error.message);
        }
    }

    static renderizarCalendario() {
        const container = document.getElementById('calendario-horarios');
        if (!container) {
            console.error('❌ Contenedor de calendario no encontrado');
            return;
        }

        if (!this.datosCalendario) {
            container.innerHTML = `
                <div class="error-calendario">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No hay datos disponibles para el calendario</p>
                </div>
            `;
            return;
        }

        const { semanas } = this.datosCalendario;
        const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const nombreMes = nombresMeses[this.mesActual - 1];

        const indicadorPermisos = this.esAdministrador 
            ? '<div class="permiso-indicador admin"><i class="fas fa-user-shield"></i> Modo Administrador</div>'
            : '<div class="permiso-indicador user"><i class="fas fa-eye"></i> Solo Lectura</div>';

        let html = `
            <div class="calendario-header-mes">
                <h3 style="font-size: 24px;">${nombreMes} ${this.anioActual}</h3>
                <div class="instrucciones">
                    <small style="font-size: 16px;">💡 ${this.esAdministrador ? 'Arrastra técnicos para cambiar orden | Haz clic en turnos para editarlos' : 'Vista de solo lectura - Contacta al administrador para modificaciones'}</small>
                    ${indicadorPermisos}
                </div>
            </div>
        `;

        semanas.forEach((semana, semanaIndex) => {
            html += `
                <div class="semana-container" data-semana-index="${semanaIndex}">
                    <div class="semana-header" style="font-size: 20px;">Semana ${semanaIndex + 1}</div>
                    <div class="calendario-grid">
                        <div class="calendario-header">
                            <div class="header-corner">
                                <div class="fechas-header" style="font-size: 16px;">Técnico / Día</div>
                            </div>
            `;

            semana.forEach((dia, indexDia) => {
                if (dia.dia !== null) {
                    const nombreCorto = this.obtenerNombreDiaCorto(dia.nombreDia);
                    html += `
                        <div class="dia-header">
                            <div class="dia-numero" style="font-size: 18px;">${dia.dia}</div>
                            <div class="dia-nombre" style="font-size: 16px;">${nombreCorto}</div>
                        </div>
                    `;
                } else {
                    html += `<div class="dia-header vacio"></div>`;
                }
            });

            html += `</div>`;

            const tecnicosParaSemana = this.obtenerTecnicosParaSemana(semanaIndex);

            tecnicosParaSemana.forEach((tecnico, filaIndex) => {
                const puedeArrastrar = this.esAdministrador ? 'draggable="true"' : '';
                html += `
                    <div class="calendario-fila" 
                         data-tecnico-id="${tecnico.id || `temp-${filaIndex}`}"
                         data-tecnico-index="${filaIndex}"
                         data-semana-index="${semanaIndex}"
                         ${puedeArrastrar}>
                `;
                
                const color = tecnico.color || '#6c757d';
                const iconoArrastre = this.esAdministrador 
                    ? '<i class="fas fa-grip-vertical grip-icon" title="Arrastrar para cambiar orden" style="font-size: 18px;"></i>'
                    : '<i class="fas fa-user user-icon" title="Solo lectura" style="font-size: 18px;"></i>';
                
                html += `
                    <div class="fila-header" style="border-left: 4px solid ${color}">
                        <div class="tecnico-contenedor">
                            ${iconoArrastre}
                            <div class="tecnico-nombre" style="font-size: 18px;">${tecnico.nombre || `Técnico ${filaIndex + 1}`}</div>
                        </div>
                    </div>
                `;
                
                semana.forEach((dia, indexDia) => {
                    if (dia.dia === null) {
                        html += `<div class="calendario-celda vacio"></div>`;
                    } else {
                        const datosFila = dia.filas && dia.filas[filaIndex] ? 
                            dia.filas[filaIndex] : 
                            { tecnico: tecnico.nombre || `Técnico ${filaIndex + 1}`, turno: '' };
                        
                        const claseTurno = this.obtenerClaseTurno(datosFila.turno);
                        const textoMostrado = this.obtenerTextoMostrado(datosFila.turno);
                        const puedeEditar = this.esAdministrador ? 'celda-turno' : 'celda-solo-lectura';
                        const titulo = this.esAdministrador 
                            ? `${tecnico.nombre || `Técnico ${filaIndex + 1}`} - ${datosFila.turno || 'Sin turno'}`
                            : `${tecnico.nombre || `Técnico ${filaIndex + 1}`} - ${datosFila.turno || 'Sin turno'} (Solo lectura)`;
                        
                        html += `
                            <div class="calendario-celda ${claseTurno} ${puedeEditar}" 
                                 data-dia="${dia.dia}" 
                                 data-fila="${filaIndex}" 
                                 data-semana="${semanaIndex}"
                                 data-dia-semana="${indexDia}"
                                 data-tecnico="${tecnico.nombre || `Técnico ${filaIndex + 1}`}"
                                 title="${titulo}">
                                <div class="turno-display" style="font-size: 16px;">${textoMostrado}</div>
                        `;
                        
                        if (this.esAdministrador) {
                            html += `
                                <select class="turno-select" data-tecnico="${tecnico.nombre || `Técnico ${filaIndex + 1}`}" style="display: none; font-size: 16px;">
                                    <option value="">-</option>
                                    <option value="5am-12pm" ${datosFila.turno === '5am-12pm' ? 'selected' : ''}>5am-12pm</option>
                                    <option value="3pm-10pm" ${datosFila.turno === '3pm-10pm' ? 'selected' : ''}>3pm-10pm</option>
                                    <option value="10pm-5am" ${datosFila.turno === '10pm-5am' ? 'selected' : ''}>10pm-5am</option>
                                    <option value="Apoyo" ${datosFila.turno === 'Apoyo' ? 'selected' : ''}>Apoyo</option>
                                    <option value="Descanso" ${datosFila.turno === 'Descanso' ? 'selected' : ''}>Descanso</option>
                                    <option value="Vacaciones" ${datosFila.turno === 'Vacaciones' ? 'selected' : ''}>Vacaciones</option>
                                </select>
                            `;
                        }
                        
                        html += `</div>`;
                    }
                });
                
                html += `</div>`;
            });

            html += `</div></div>`;
        });

        html += `
            <div class="leyenda-turnos" style="font-size: 16px;">
                <div class="leyenda-item">
                    <div class="leyenda-color turno-manana"></div>
                    <span>5am-12pm</span>
                </div>
                <div class="leyenda-item">
                    <div class="leyenda-color turno-tarde"></div>
                    <span>3pm-10pm</span>
                </div>
                <div class="leyenda-item">
                    <div class="leyenda-color turno-noche"></div>
                    <span>10pm-5am</span>
                </div>
                <div class="leyenda-item">
                    <div class="leyenda-color turno-apoyo"></div>
                    <span>Apoyo</span>
                </div>
                <div class="leyenda-item">
                    <div class="leyenda-color turno-descanso"></div>
                    <span>Descanso</span>
                </div>
                <div class="leyenda-item">
                    <div class="leyenda-color turno-vacaciones"></div>
                    <span>Vacaciones</span>
                </div>
            </div>
        `;
        
        container.innerHTML = html;

        this.configurarInterfazPorPermisos();
        this.agregarEventListeners();
        this.configurarArrastre();
        console.log(`✅ Calendario renderizado exitosamente: ${semanas.length} semanas`);
    }

    static obtenerTecnicosParaSemana(semanaIndex) {
        const ordenParaEstaSemana = this.ordenTecnicosPorSemana[semanaIndex] || this.tecnicos.map(t => t.id);
        
        const tecnicosOrdenados = [];
        ordenParaEstaSemana.forEach(id => {
            const tecnico = this.tecnicos.find(t => t.id === id);
            if (tecnico) {
                tecnicosOrdenados.push(tecnico);
            }
        });
        
        while (tecnicosOrdenados.length < 4) {
            tecnicosOrdenados.push({
                id: `temp-${tecnicosOrdenados.length}`,
                nombre: `Técnico ${tecnicosOrdenados.length + 1}`,
                color: '#6c757d',
                activo: true
            });
        }
        
        return tecnicosOrdenados.slice(0, 4);
    }

    static configurarInterfazPorPermisos() {
        const btnGuardar = document.getElementById('guardar-horarios');
        const btnNuevoTecnico = document.getElementById('nuevo-tecnico-btn');
        const btnExportarPDF = document.getElementById('exportar-pdf-btn');

        if (!this.esAdministrador) {
            if (btnGuardar) btnGuardar.style.display = 'none';
            if (btnNuevoTecnico) btnNuevoTecnico.style.display = 'none';
            if (btnExportarPDF) btnExportarPDF.style.display = 'none';
            this.deshabilitarFuncionalidadesEdicion();
        } else {
            if (btnGuardar) btnGuardar.style.display = 'flex';
            if (btnNuevoTecnico) btnNuevoTecnico.style.display = 'flex';
            if (btnExportarPDF) btnExportarPDF.style.display = 'flex';
        }
    }

    static deshabilitarFuncionalidadesEdicion() {
        document.querySelectorAll('.calendario-fila').forEach(fila => {
            fila.draggable = false;
            fila.style.cursor = 'default';
        });

        document.querySelectorAll('.grip-icon').forEach(icono => {
            icono.style.display = 'none';
        });

        document.querySelectorAll('.user-icon').forEach(icono => {
            icono.style.display = 'inline-block';
        });

        document.querySelectorAll('.celda-solo-lectura').forEach(celda => {
            celda.style.cursor = 'default';
            celda.style.opacity = '0.9';
        });

        console.log('🔐 Funcionalidades de edición deshabilitadas para usuario normal');
    }

    static obtenerNombreDiaCorto(nombreCompleto) {
        const nombresCortos = {
            'Domingo': 'Dom',
            'Lunes': 'Lun', 
            'Martes': 'Mar',
            'Miércoles': 'Mié',
            'Jueves': 'Jue',
            'Viernes': 'Vie',
            'Sábado': 'Sáb'
        };
        return nombresCortos[nombreCompleto] || nombreCompleto.substring(0, 3);
    }

    static obtenerClaseTurno(turno) {
        const clases = {
            '5am-12pm': 'turno-manana',
            '3pm-10pm': 'turno-tarde',
            '10pm-5am': 'turno-noche',
            'Apoyo': 'turno-apoyo', 
            'Descanso': 'turno-descanso',
            'Vacaciones': 'turno-vacaciones'
        };
        return clases[turno] || '';
    }

    static obtenerTextoMostrado(turno) {
        const textos = {
            '5am-12pm': '5-12',
            '3pm-10pm': '3-10', 
            '10pm-5am': '10-5',
            'Apoyo': 'Apoyo',
            'Descanso': 'Descanso',
            'Vacaciones': 'Vacaciones'
        };
        return textos[turno] || '-';
    }

    static agregarEventListeners() {
        if (this.esAdministrador) {
            document.querySelectorAll('.celda-turno').forEach(celda => {
                celda.addEventListener('click', (e) => {
                    if (e.target.tagName === 'SELECT') return;
                    
                    const display = celda.querySelector('.turno-display');
                    const select = celda.querySelector('.turno-select');
                    
                    if (display && select) {
                        display.style.display = 'none';
                        select.style.display = 'block';
                        select.focus();
                    }
                });
            });

            document.querySelectorAll('.turno-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const turno = e.target.value;
                    const celda = e.target.closest('.calendario-celda');
                    const display = celda.querySelector('.turno-display');
                    
                    if (display) {
                        display.textContent = this.obtenerTextoMostrado(turno);
                        display.style.display = 'block';
                        e.target.style.display = 'none';
                        
                        celda.className = 'calendario-celda celda-turno';
                        if (turno) {
                            const claseTurno = this.obtenerClaseTurno(turno);
                            celda.classList.add(claseTurno);
                        }
                        
                        this.marcarModificado();
                    }
                });

                select.addEventListener('blur', (e) => {
                    setTimeout(() => {
                        const celda = e.target.closest('.calendario-celda');
                        const display = celda?.querySelector('.turno-display');
                        if (display) {
                            display.style.display = 'block';
                            e.target.style.display = 'none';
                        }
                    }, 200);
                });
            });
        } else {
            document.querySelectorAll('.celda-solo-lectura').forEach(celda => {
                celda.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.mostrarInfoSoloLectura();
                });
            });
        }
    }

    static configurarArrastre() {
        if (!this.esAdministrador) {
            return;
        }

        const filas = document.querySelectorAll('.calendario-fila');
        
        filas.forEach(fila => {
            fila.addEventListener('dragstart', (e) => {
                this.tecnicoArrastrado = fila;
                e.target.classList.add('arrastrando');
                e.dataTransfer.setData('text/plain', fila.dataset.tecnicoIndex);
                e.dataTransfer.effectAllowed = 'move';
            });

            fila.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (fila !== this.tecnicoArrastrado) {
                    fila.classList.add('sobre-arrastre');
                }
            });

            fila.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fila.classList.remove('sobre-arrastre');
            });

            fila.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            fila.addEventListener('drop', (e) => {
                e.preventDefault();
                fila.classList.remove('sobre-arrastre');
                
                if (this.tecnicoArrastrado && fila !== this.tecnicoArrastrado) {
                    const semanaIndex = parseInt(fila.dataset.semanaIndex);
                    this.intercambiarTecnicos(this.tecnicoArrastrado, fila, semanaIndex);
                }
            });

            fila.addEventListener('dragend', (e) => {
                filas.forEach(f => f.classList.remove('arrastrando', 'sobre-arrastre'));
                this.tecnicoArrastrado = null;
            });
        });

        document.querySelectorAll('.grip-icon').forEach(icono => {
            icono.addEventListener('mousedown', (e) => {
                const fila = e.target.closest('.calendario-fila');
                if (fila) {
                    fila.draggable = true;
                }
            });
        });
    }

    static intercambiarTecnicos(filaOrigen, filaDestino, semanaIndex) {
        const indexOrigen = parseInt(filaOrigen.dataset.tecnicoIndex);
        const indexDestino = parseInt(filaDestino.dataset.tecnicoIndex);
        
        console.log(`🔄 Intercambiando técnicos en semana ${semanaIndex}: posición ${indexOrigen} ↔ ${indexDestino}`);
        
        if (!this.ordenTecnicosPorSemana[semanaIndex]) {
            this.ordenTecnicosPorSemana[semanaIndex] = this.tecnicos.map(t => t.id);
        }
        
        const ordenSemana = this.ordenTecnicosPorSemana[semanaIndex];
        if (ordenSemana.length >= Math.max(indexOrigen, indexDestino) + 1) {
            const temp = ordenSemana[indexOrigen];
            ordenSemana[indexOrigen] = ordenSemana[indexDestino];
            ordenSemana[indexDestino] = temp;
            
            console.log(`🔄 Nuevo orden para semana ${semanaIndex}:`, ordenSemana);
            
            this.renderizarSemana(semanaIndex);
            this.marcarModificado();
        }
    }

    static renderizarSemana(semanaIndex) {
        const semanaContainer = document.querySelector(`.semana-container[data-semana-index="${semanaIndex}"]`);
        if (!semanaContainer) return;

        const { semanas } = this.datosCalendario;
        const semana = semanas[semanaIndex];
        
        if (!semana) return;

        let html = `
            <div class="semana-header" style="font-size: 20px;">Semana ${semanaIndex + 1}</div>
            <div class="calendario-grid">
                <div class="calendario-header">
                    <div class="header-corner">
                        <div class="fechas-header" style="font-size: 16px;">Técnico / Día</div>
                    </div>
        `;

        semana.forEach((dia, indexDia) => {
            if (dia.dia !== null) {
                const nombreCorto = this.obtenerNombreDiaCorto(dia.nombreDia);
                html += `
                    <div class="dia-header">
                        <div class="dia-numero" style="font-size: 18px;">${dia.dia}</div>
                        <div class="dia-nombre" style="font-size: 16px;">${nombreCorto}</div>
                    </div>
                `;
            } else {
                html += `<div class="dia-header vacio"></div>`;
            }
        });

        html += `</div>`;

        const tecnicosParaSemana = this.obtenerTecnicosParaSemana(semanaIndex);

        tecnicosParaSemana.forEach((tecnico, filaIndex) => {
            const puedeArrastrar = this.esAdministrador ? 'draggable="true"' : '';
            html += `
                <div class="calendario-fila" 
                     data-tecnico-id="${tecnico.id || `temp-${filaIndex}`}"
                     data-tecnico-index="${filaIndex}"
                     data-semana-index="${semanaIndex}"
                     ${puedeArrastrar}>
            `;
            
            const color = tecnico.color || '#6c757d';
            const iconoArrastre = this.esAdministrador 
                ? '<i class="fas fa-grip-vertical grip-icon" title="Arrastrar para cambiar orden" style="font-size: 18px;"></i>'
                : '<i class="fas fa-user user-icon" title="Solo lectura" style="font-size: 18px;"></i>';
            
            html += `
                <div class="fila-header" style="border-left: 4px solid ${color}">
                    <div class="tecnico-contenedor">
                        ${iconoArrastre}
                        <div class="tecnico-nombre" style="font-size: 18px;">${tecnico.nombre || `Técnico ${filaIndex + 1}`}</div>
                    </div>
                </div>
            `;
            
            semana.forEach((dia, indexDia) => {
                if (dia.dia === null) {
                    html += `<div class="calendario-celda vacio"></div>`;
                } else {
                    const datosFila = dia.filas && dia.filas[filaIndex] ? 
                        dia.filas[filaIndex] : 
                        { tecnico: tecnico.nombre || `Técnico ${filaIndex + 1}`, turno: '' };
                    
                    const claseTurno = this.obtenerClaseTurno(datosFila.turno);
                    const textoMostrado = this.obtenerTextoMostrado(datosFila.turno);
                    const puedeEditar = this.esAdministrador ? 'celda-turno' : 'celda-solo-lectura';
                    const titulo = this.esAdministrador 
                        ? `${tecnico.nombre || `Técnico ${filaIndex + 1}`} - ${datosFila.turno || 'Sin turno'}`
                        : `${tecnico.nombre || `Técnico ${filaIndex + 1}`} - ${datosFila.turno || 'Sin turno'} (Solo lectura)`;
                    
                    html += `
                        <div class="calendario-celda ${claseTurno} ${puedeEditar}" 
                             data-dia="${dia.dia}" 
                             data-fila="${filaIndex}" 
                             data-semana="${semanaIndex}"
                             data-dia-semana="${indexDia}"
                             data-tecnico="${tecnico.nombre || `Técnico ${filaIndex + 1}`}"
                             title="${titulo}">
                            <div class="turno-display" style="font-size: 16px;">${textoMostrado}</div>
                    `;
                    
                    if (this.esAdministrador) {
                        html += `
                            <select class="turno-select" data-tecnico="${tecnico.nombre || `Técnico ${filaIndex + 1}`}" style="display: none; font-size: 16px;">
                                <option value="">-</option>
                                <option value="5am-12pm" ${datosFila.turno === '5am-12pm' ? 'selected' : ''}>5am-12pm</option>
                                <option value="3pm-10pm" ${datosFila.turno === '3pm-10pm' ? 'selected' : ''}>3pm-10pm</option>
                                <option value="10pm-5am" ${datosFila.turno === '10pm-5am' ? 'selected' : ''}>10pm-5am</option>
                                <option value="Apoyo" ${datosFila.turno === 'Apoyo' ? 'selected' : ''}>Apoyo</option>
                                <option value="Descanso" ${datosFila.turno === 'Descanso' ? 'selected' : ''}>Descanso</option>
                                <option value="Vacaciones" ${datosFila.turno === 'Vacaciones' ? 'selected' : ''}>Vacaciones</option>
                            </select>
                        `;
                    }
                    
                    html += `</div>`;
                }
            });
            
            html += `</div>`;
        });

        html += `</div>`;
        
        semanaContainer.innerHTML = html;
        
        this.agregarEventListenersSemana(semanaContainer);
        this.configurarArrastreSemana(semanaContainer);
        
        console.log(`✅ Semana ${semanaIndex + 1} renderizada con nuevo orden`);
    }

    static agregarEventListenersSemana(semanaContainer) {
        if (!this.esAdministrador) return;

        semanaContainer.querySelectorAll('.celda-turno').forEach(celda => {
            celda.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT') return;
                
                const display = celda.querySelector('.turno-display');
                const select = celda.querySelector('.turno-select');
                
                if (display && select) {
                    display.style.display = 'none';
                    select.style.display = 'block';
                    select.focus();
                }
            });
        });

        semanaContainer.querySelectorAll('.turno-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const turno = e.target.value;
                const celda = e.target.closest('.calendario-celda');
                const display = celda.querySelector('.turno-display');
                
                if (display) {
                    display.textContent = this.obtenerTextoMostrado(turno);
                    display.style.display = 'block';
                    e.target.style.display = 'none';
                    
                    celda.className = 'calendario-celda celda-turno';
                    if (turno) {
                        const claseTurno = this.obtenerClaseTurno(turno);
                        celda.classList.add(claseTurno);
                    }
                    
                    this.marcarModificado();
                }
            });

            select.addEventListener('blur', (e) => {
                setTimeout(() => {
                    const celda = e.target.closest('.calendario-celda');
                    const display = celda?.querySelector('.turno-display');
                    if (display) {
                        display.style.display = 'block';
                        e.target.style.display = 'none';
                    }
                }, 200);
            });
        });
    }

    static configurarArrastreSemana(semanaContainer) {
        if (!this.esAdministrador) return;

        const filas = semanaContainer.querySelectorAll('.calendario-fila');
        
        filas.forEach(fila => {
            fila.addEventListener('dragstart', (e) => {
                this.tecnicoArrastrado = fila;
                e.target.classList.add('arrastrando');
                e.dataTransfer.setData('text/plain', fila.dataset.tecnicoIndex);
                e.dataTransfer.effectAllowed = 'move';
            });

            fila.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (fila !== this.tecnicoArrastrado) {
                    fila.classList.add('sobre-arrastre');
                }
            });

            fila.addEventListener('dragleave', (e) => {
                e.preventDefault();
                fila.classList.remove('sobre-arrastre');
            });

            fila.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            fila.addEventListener('drop', (e) => {
                e.preventDefault();
                fila.classList.remove('sobre-arrastre');
                
                if (this.tecnicoArrastrado && fila !== this.tecnicoArrastrado) {
                    const semanaIndex = parseInt(fila.dataset.semanaIndex);
                    this.intercambiarTecnicos(this.tecnicoArrastrado, fila, semanaIndex);
                }
            });

            fila.addEventListener('dragend', (e) => {
                filas.forEach(f => f.classList.remove('arrastrando', 'sobre-arrastre'));
                this.tecnicoArrastrado = null;
            });
        });
    }

    static marcarModificado() {
        if (!this.esAdministrador) {
            return;
        }

        const btnGuardar = document.getElementById('guardar-horarios');
        if (btnGuardar) {
            btnGuardar.classList.add('modificado');
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios *';
        }
    }

    static async guardarHorarios() {
        if (!this.esAdministrador) {
            this.mostrarError('No tienes permisos para guardar horarios. Solo los administradores pueden realizar esta acción.');
            return;
        }

        try {
            const semanasData = [];
            
            document.querySelectorAll('.semana-container').forEach((semanaContainer, semanaIndex) => {
                const semana = [];
                const filas = semanaContainer.querySelectorAll('.calendario-fila');
                
                for (let diaIndex = 0; diaIndex < 7; diaIndex++) {
                    const diaData = {
                        dia: null,
                        nombreDia: '',
                        fechaCompleta: '',
                        filas: []
                    };
                    
                    filas.forEach((fila, tecnicoIndex) => {
                        const celdas = fila.querySelectorAll('.calendario-celda:not(.vacio)');
                        const celda = celdas[diaIndex];
                        
                        if (celda) {
                            const diaNum = parseInt(celda.dataset.dia);
                            const turnoSelect = celda.querySelector('.turno-select');
                            const turno = turnoSelect?.value || '';
                            const nombreTecnico = celda.dataset.tecnico;
                            
                            if (diaNum && !diaData.dia) {
                                const fecha = new Date(this.anioActual, this.mesActual - 1, diaNum);
                                diaData.dia = diaNum;
                                diaData.nombreDia = this.obtenerNombreDia(fecha.getDay());
                                diaData.fechaCompleta = fecha.toISOString().split('T')[0];
                            }
                            
                            diaData.filas[tecnicoIndex] = {
                                tecnico: nombreTecnico,
                                turno: turno
                            };
                        }
                    });
                    
                    if (diaData.dia || diaData.filas.some(fila => fila && fila.turno)) {
                        semana.push(diaData);
                    }
                }
                
                semanasData.push(semana);
            });

            const datosGuardar = {
                mes: this.mesActual,
                anio: this.anioActual,
                datos_calendario: {
                    mes: this.mesActual,
                    anio: this.anioActual,
                    semanas: semanasData,
                    orden_tecnicos_por_semana: this.ordenTecnicosPorSemana,
                    fecha_actualizacion: new Date().toISOString()
                }
            };

            const response = await fetch('/api/horarios-calendario/guardar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(datosGuardar)
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarExito('Horarios guardados exitosamente');
                const btnGuardar = document.getElementById('guardar-horarios');
                if (btnGuardar) {
                    btnGuardar.classList.remove('modificado');
                    btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Horarios';
                }
            } else {
                this.mostrarError('Error al guardar: ' + result.message);
            }
        } catch (error) {
            console.error('❌ Error guardando horarios:', error);
            this.mostrarError('Error de conexión al guardar');
        }
    }

    // 🔥 ACTUALIZADO: Exportar a PDF - SOLO HASTA SEMANA 5
    static async exportarPDF() {
        try {
            console.log('📊 Generando PDF SOLO HASTA SEMANA 5...');
            
            // Mostrar indicador de carga
            this.mostrarCargandoPDF();
            
            const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const nombreMes = nombresMeses[this.mesActual - 1];
            
            // 🔥 CAMBIO: Limitar a solo 5 semanas
            const semanasLimitadas = this.datosCalendario.semanas.slice(0, 5);
            console.log(`📋 Enviando solo ${semanasLimitadas.length} semanas al PDF`);
            
            // Preparar datos para el PDF
            const datosPDF = {
                mes: this.mesActual,
                anio: this.anioActual,
                nombreMes: nombreMes,
                semanas: semanasLimitadas, // 🔥 CAMBIO: Solo 5 semanas
                tecnicos: this.tecnicos,
                ordenTecnicosPorSemana: this.ordenTecnicosPorSemana,
                fechaGeneracion: new Date().toLocaleDateString('es-ES')
            };

            // Llamar al backend para generar el PDF
            const response = await fetch('/api/horarios-calendario/exportar-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(datosPDF)
            });

            if (!response.ok) {
                throw new Error('Error en la generación del PDF');
            }

            // Descargar el PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Horarios_${nombreMes}_${this.anioActual}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.ocultarCargandoPDF();
            this.mostrarExito('PDF generado y descargado exitosamente');

        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            this.ocultarCargandoPDF();
            this.mostrarError('Error al generar el PDF: ' + error.message);
        }
    }

    // 🔥 FUNCIÓN: Mostrar indicador de carga para PDF
    static mostrarCargandoPDF() {
        let loadingDiv = document.getElementById('pdf-loading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'pdf-loading';
            loadingDiv.innerHTML = `
                <div class="pdf-loading-overlay">
                    <div class="pdf-loading-content">
                        <i class="fas fa-file-pdf fa-spin" style="font-size: 48px;"></i>
                        <p style="font-size: 20px;">Generando PDF...</p>
                        <small style="font-size: 16px;">Por favor espere</small>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingDiv);
        }
        loadingDiv.style.display = 'flex';
    }

    // 🔥 FUNCIÓN: Ocultar indicador de carga
    static ocultarCargandoPDF() {
        const loadingDiv = document.getElementById('pdf-loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }

    static obtenerNombreDia(numeroDia) {
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return dias[numeroDia];
    }

    static mostrarModalTecnico() {
        if (!this.esAdministrador) {
            this.mostrarError('No tienes permisos para crear técnicos. Solo los administradores pueden realizar esta acción.');
            return;
        }

        document.getElementById('modal-tecnico').style.display = 'block';
    }

    static ocultarModalTecnico() {
        document.getElementById('modal-tecnico').style.display = 'none';
        document.getElementById('form-tecnico').reset();
    }

    static async guardarTecnico() {
        if (!this.esAdministrador) {
            this.mostrarError('No tienes permisos para crear técnicos. Solo los administradores pueden realizar esta acción.');
            return;
        }

        const nombre = document.getElementById('nombre-tecnico').value.trim();
        const color = document.getElementById('color-tecnico').value;

        if (!nombre) {
            this.mostrarError('El nombre del técnico es requerido');
            return;
        }

        try {
            const response = await fetch('/api/horarios-calendario/tecnicos/crear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ nombre, color })
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarExito('Técnico agregado exitosamente');
                this.ocultarModalTecnico();
                await this.cargarTecnicos();
                this.cargarCalendario(this.mesActual, this.anioActual);
            } else {
                this.mostrarError('Error al agregar técnico: ' + result.message);
            }
        } catch (error) {
            console.error('❌ Error guardando técnico:', error);
            this.mostrarError('Error de conexión al guardar técnico');
        }
    }

    static mostrarInfoSoloLectura() {
        this.mostrarExito('Modo de solo lectura. Contacta al administrador para realizar modificaciones en los horarios.');
    }

    static mostrarExito(mensaje) {
        alert('✅ ' + mensaje);
    }

    static mostrarError(mensaje) {
        alert('❌ ' + mensaje);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        HorariosCalendario.init();
    });
} else {
    HorariosCalendario.init();
}