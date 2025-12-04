const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Importar la configuración de la base de datos
const databaseConfig = require('../config/database');

// Usar middleware centralizado de autenticación (session o JWT)
const { requireAuth } = require('../middleware/auth');

// 🔥 NUEVO: Importar PDFKit para generar PDFs
const PDFDocument = require('pdfkit');

// Obtener lista de técnicos
router.get('/tecnicos/listar', async (req, res) => {
    try {
        console.log('👥 Solicitando lista de técnicos');
        
        const result = await databaseConfig.queryAsync(
            'SELECT * FROM tecnicos_horarios WHERE activo = true ORDER BY nombre'
        );
        
        console.log(`✅ ${result.length} técnicos encontrados`);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('❌ Error obteniendo técnicos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al obtener técnicos' 
        });
    }
});

// Obtener horario por mes y año
router.get('/:mes/:anio', async (req, res) => {
    try {
        const { mes, anio } = req.params;

        console.log(`📅 Solicitando horario para: ${mes}/${anio}`);

        const mesNum = parseInt(mes);
        const anioNum = parseInt(anio);

        if (isNaN(mesNum) || isNaN(anioNum)) {
            return res.status(400).json({
                success: false,
                message: 'Mes y año deben ser números válidos'
            });
        }

        const result = await databaseConfig.queryAsync(
            'SELECT * FROM horarios_calendario WHERE mes = $1 AND anio = $2',
            [mesNum, anioNum]
        );

        if (result.length > 0) {
            console.log(`✅ Horario encontrado para ${mes}/${anio}`);
            const horario = result[0];
            
            if (horario.datos_calendario) {
                try {
                    horario.datos_calendario = typeof horario.datos_calendario === 'string'
                        ? JSON.parse(horario.datos_calendario)
                        : horario.datos_calendario;
                } catch (e) {
                    console.warn('⚠️ Error parseando datos_calendario desde BD, generando estructura vacía');
                    horario.datos_calendario = generarEstructuraVacia(mesNum, anioNum);
                }
            } else {
                horario.datos_calendario = generarEstructuraVacia(mesNum, anioNum);
            }

            if (!horario.datos_calendario.orden_tecnicos_por_semana) {
                horario.datos_calendario.orden_tecnicos_por_semana = {};
            }

            console.log('🔄 Orden por semana cargado:', horario.datos_calendario.orden_tecnicos_por_semana);
            
            res.json({ 
                success: true, 
                data: horario,
                exists: true
            });
        } else {
            console.log(`📋 Creando estructura vacía para ${mes}/${anio}`);
            const calendarioVacio = generarEstructuraVacia(mesNum, anioNum);
            res.json({ 
                success: true, 
                data: calendarioVacio,
                exists: false
            });
        }
    } catch (error) {
        console.error('❌ Error obteniendo horario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al obtener horario' 
        });
    }
});

// Guardar/Actualizar horario
router.post('/guardar', requireAuth, async (req, res) => {
    try {
        const { mes, anio, datos_calendario } = req.body;
        const userId = req.session?.user?.id || req.session?.userId || null;

        console.log(`💾 Guardando horario para: ${mes}/${anio}`, { 
            userId, 
            semanas: datos_calendario?.semanas?.length,
            orden_por_semana: datos_calendario?.orden_tecnicos_por_semana ? Object.keys(datos_calendario.orden_tecnicos_por_semana).length : 0
        });

        if (!mes || !anio || !datos_calendario) {
            return res.json({ 
                success: false, 
                message: 'Datos incompletos para guardar horario' 
            });
        }

        const existing = await databaseConfig.queryAsync(
            'SELECT id FROM horarios_calendario WHERE mes = $1 AND anio = $2',
            [mes, anio]
        );

        let result;
        if (existing.length > 0) {
            console.log(`🔄 Actualizando horario existente para ${mes}/${anio}`);
            result = await databaseConfig.queryAsync(
                `UPDATE horarios_calendario 
                 SET datos_calendario = $1, fecha_actualizacion = CURRENT_TIMESTAMP 
                 WHERE mes = $2 AND anio = $3 
                 RETURNING *`,
                [JSON.stringify(datos_calendario), mes, anio]
            );
        } else {
            console.log(`➕ Creando nuevo horario para ${mes}/${anio}`);
            result = await databaseConfig.queryAsync(
                `INSERT INTO horarios_calendario 
                 (mes, anio, datos_calendario, id_usuario_creo) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [mes, anio, JSON.stringify(datos_calendario), userId]
            );
        }

        const saved = result[0];
        if (saved.datos_calendario && typeof saved.datos_calendario === 'string') {
            try { 
                saved.datos_calendario = JSON.parse(saved.datos_calendario); 
            } catch (e) { 
                console.warn('⚠️ Error parseando datos_calendario después de guardar');
            }
        }

        console.log(`✅ Horario guardado exitosamente para ${mes}/${anio}`);
        res.json({ 
            success: true, 
            message: 'Horario guardado exitosamente',
            data: saved
        });
    } catch (error) {
        console.error('❌ Error guardando horario:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al guardar horario' 
        });
    }
});

// 🔥 ACTUALIZADO: Exportar a PDF - SOLO HASTA SEMANA 5, HOJA COMPLETA
router.post('/exportar-pdf', async (req, res) => {
    try {
        const { mes, anio, nombreMes, semanas, tecnicos, ordenTecnicosPorSemana, fechaGeneracion } = req.body;

        console.log(`📊 Generando PDF SOLO HASTA SEMANA 5 para: ${mes}/${anio}`);

        // 🔥 CAMBIO: Limitar a solo 5 semanas
        const semanasLimitadas = semanas.slice(0, 5);
        console.log(`📋 Mostrando solo ${semanasLimitadas.length} semanas de ${semanas.length} disponibles`);

        // 🔥 CAMBIO: Crear documento PDF en orientación horizontal con márgenes mínimos
        const doc = new PDFDocument({ 
            margin: 10, // Márgenes más pequeños
            size: 'A4',
            layout: 'landscape'
        });
        
        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Horarios_${nombreMes}_${anio}.pdf"`);
        
        // Pipe el PDF a la respuesta
        doc.pipe(res);

        // 🔥 FUNCIÓN PRINCIPAL: Solo hasta semana 5, ocupando toda la hoja
        const generarPDFCompleto = () => {
            // Título principal más compacto
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text(`HORARIOS DE TRABAJO - ${nombreMes.toUpperCase()} ${anio}`, 10, 10, { align: 'center' });
            
            // Fecha de generación más pequeña
            doc.fontSize(8)
               .font('Helvetica')
               .fillColor('#7f8c8d')
               .text(`Generado: ${fechaGeneracion}`, 10, 25, { align: 'center' });

            // Posición inicial más alta
            let currentY = 35;

            // 🔥 CAMBIO: Procesar solo hasta 5 semanas
            semanasLimitadas.forEach((semana, semanaIndex) => {
                // 🔥 TÍTULO DE LA SEMANA más compacto
                doc.fontSize(10)
                   .font('Helvetica-Bold')
                   .fillColor('#34495e')
                   .text(`SEMANA ${semanaIndex + 1}`, 10, currentY);
                currentY += 12;

                // 🔥 CONFIGURACIÓN DE LA TABLA (OCUPANDO TODO EL ANCHO DISPONIBLE)
                const anchoTotal = doc.page.width - 20; // Menos márgenes
                const startY = currentY;
                const rowHeight = 14; // Más compacto
                const colWidth = (anchoTotal - 90) / 7; // Columna técnica más estrecha
                const firstColWidth = 85;

                // 🔥 ENCABEZADOS COMPACTOS
                const diasAbreviados = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                
                // Fondo de encabezados
                doc.rect(10, startY, anchoTotal, rowHeight)
                   .fill('#2c3e50');

                // Columna de técnico
                doc.font('Helvetica-Bold')
                   .fontSize(7)
                   .fillColor('#ffffff')
                   .text('TÉCNICO', 15, startY + 4);

                // Encabezados de días con números y nombres compactos
                semana.forEach((dia, diaIndex) => {
                    const x = 10 + firstColWidth + (diaIndex * colWidth);
                    
                    if (dia.dia !== null) {
                        // Nombre del día abreviado
                        doc.fontSize(6)
                           .fillColor('#ffffff')
                           .text(diasAbreviados[diaIndex], x + 1, startY + 2, { width: colWidth - 2, align: 'center' });
                        
                        // Número del día
                        doc.fontSize(8)
                           .font('Helvetica-Bold')
                           .fillColor('#ffffff')
                           .text(dia.dia.toString(), x + 1, startY + 8, { width: colWidth - 2, align: 'center' });
                    }
                });

                // 🔥 OBTENER TÉCNICOS EN ORDEN PARA ESTA SEMANA
                const ordenParaSemana = ordenTecnicosPorSemana[semanaIndex] || tecnicos.map(t => t.id);
                const tecnicosOrdenados = ordenParaSemana.map(id => 
                    tecnicos.find(t => t.id === id)
                ).filter(t => t).slice(0, 4);

                // 🔥 FILAS DE TÉCNICOS COMPACTAS
                tecnicosOrdenados.forEach((tecnico, techIndex) => {
                    const y = startY + rowHeight + (techIndex * rowHeight);
                    
                    // Fondo alternado para mejor legibilidad
                    const colorFondo = techIndex % 2 === 0 ? '#f8f9fa' : '#ffffff';
                    doc.rect(10, y, firstColWidth, rowHeight)
                       .fill(colorFondo)
                       .stroke('#dee2e6');

                    // Nombre del técnico compacto
                    doc.font('Helvetica-Bold')
                       .fontSize(7)
                       .fillColor('#2c3e50')
                       .text(tecnico.nombre, 15, y + 4, { width: firstColWidth - 10 });
                    
                    // 🔥 TURNOS REALES PARA CADA DÍA
                    semana.forEach((dia, diaIndex) => {
                        if (dia.dia !== null) {
                            const x = 10 + firstColWidth + (diaIndex * colWidth);
                            const turnoData = dia.filas && dia.filas[techIndex] ? dia.filas[techIndex] : { turno: '' };
                            
                            // Color según el turno REAL
                            let colorFondo = '#ffffff';
                            let colorTexto = '#2c3e50';
                            let textoMostrado = '-';
                            
                            switch(turnoData.turno) {
                                case '5am-12pm':
                                    colorFondo = '#e3f2fd';
                                    colorTexto = '#1976d2';
                                    textoMostrado = '5-12';
                                    break;
                                case '3pm-10pm':
                                    colorFondo = '#fff3e0';
                                    colorTexto = '#f57c00';
                                    textoMostrado = '3-10';
                                    break;
                                case '10pm-5am':
                                    colorFondo = '#fce4ec';
                                    colorTexto = '#c2185b';
                                    textoMostrado = '10-5';
                                    break;
                                case 'Apoyo':
                                    colorFondo = '#e8f5e8';
                                    colorTexto = '#388e3c';
                                    textoMostrado = 'Apoyo';
                                    break;
                                case 'Descanso':
                                    colorFondo = '#f5f5f5';
                                    colorTexto = '#757575';
                                    textoMostrado = 'Descanso';
                                    break;
                                case 'Vacaciones':
                                    colorFondo = '#fff8e1';
                                    colorTexto = '#ff8f00';
                                    textoMostrado = 'Vacaciones';
                                    break;
                                default:
                                    textoMostrado = '-';
                            }
                            
                            // Celda del turno
                            doc.rect(x, y, colWidth, rowHeight)
                               .fill(colorFondo)
                               .stroke('#dee2e6');
                            
                            // Texto del turno compacto
                            doc.font('Helvetica')
                               .fontSize(6)
                               .fillColor(colorTexto)
                               .text(textoMostrado, x + 1, y + 4, { 
                                   width: colWidth - 2, 
                                   align: 'center' 
                               });
                        }
                    });
                });

                // 🔥 ACTUALIZAR POSICIÓN PARA LA SIGUIENTE SEMANA más compacta
                currentY = startY + rowHeight + (tecnicosOrdenados.length * rowHeight) + 15;

                // 🔥 LÍNEA SEPARADORA ENTRE SEMANAS más sutil
                if (semanaIndex < semanasLimitadas.length - 1) {
                    doc.moveTo(10, currentY - 6)
                       .lineTo(doc.page.width - 10, currentY - 6)
                       .strokeColor('#e0e0e0')
                       .lineWidth(0.3)
                       .stroke();
                }
            });

            // 🔥 LEYENDA COMPACTA AL FINAL
            const leyendaY = currentY + 3;
            doc.fontSize(7)
               .font('Helvetica-Bold')
               .fillColor('#2c3e50')
               .text('LEYENDA:', 10, leyendaY);
            
            const leyendas = [
                { texto: '5-12 = 5am-12pm', color: '#1976d2' },
                { texto: '3-10 = 3pm-10pm', color: '#f57c00' },
                { texto: '10-5 = 10pm-5am', color: '#c2185b' },
                { texto: 'Apoyo', color: '#388e3c' },
                { texto: 'Descanso', color: '#757575' },
                { texto: 'Vacaciones', color: '#ff8f00' }
            ];
            
            let leyendaX = 10;
            let currentLeyendaY = leyendaY + 8;
            
            // Organizar leyenda en 3 columnas compactas
            leyendas.forEach((leyenda, index) => {
                // Ícono de color pequeño
                doc.rect(leyendaX, currentLeyendaY, 4, 4)
                   .fill(leyenda.color);
                
                // Texto de la leyenda compacto
                doc.font('Helvetica')
                   .fontSize(6)
                   .fillColor('#2c3e50')
                   .text(leyenda.texto, leyendaX + 6, currentLeyendaY);
                
                // Organizar en 3 columnas
                if (index === 1 || index === 3) {
                    leyendaX += 80;
                    currentLeyendaY = leyendaY + 8;
                } else {
                    currentLeyendaY += 7;
                }
                
                // Si es el último de la primera columna, resetear para segunda columna
                if (index === 2) {
                    leyendaX = 10 + 80;
                    currentLeyendaY = leyendaY + 8;
                }
            });
        };

        // 🔥 EJECUTAR GENERACIÓN DEL PDF
        generarPDFCompleto();

        // Finalizar el PDF
        doc.end();

        console.log(`✅ PDF SOLO HASTA SEMANA 5 generado exitosamente para ${mes}/${anio}`);

    } catch (error) {
        console.error('❌ Error generando PDF:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al generar PDF' 
        });
    }
});

// Función auxiliar para obtener nombre del día
function obtenerNombreDia(numeroDia) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[numeroDia];
}

// Crear nuevo técnico
router.post('/tecnicos/crear', requireAuth, async (req, res) => {
    try {
        const { nombre, color } = req.body;

        console.log('➕ Creando nuevo técnico:', { nombre, color });

        if (!nombre) {
            return res.json({ 
                success: false, 
                message: 'El nombre del técnico es requerido' 
            });
        }

        const result = await databaseConfig.queryAsync(
            'INSERT INTO tecnicos_horarios (nombre, color) VALUES ($1, $2) RETURNING *',
            [nombre.trim(), color || '#007bff']
        );

        console.log(`✅ Técnico creado exitosamente: ${nombre}`);
        res.json({ 
            success: true, 
            message: 'Técnico creado exitosamente',
            data: result[0]
        });
    } catch (error) {
        console.error('❌ Error creando técnico:', error);
        
        if (error.code === '23505') {
            console.log(`⚠️ Técnico duplicado: ${req.body.nombre}`);
            return res.json({ 
                success: false, 
                message: 'Ya existe un técnico con ese nombre' 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor al crear técnico' 
        });
    }
});

// Función para generar estructura vacía del calendario
function generarEstructuraVacia(mes, anio) {
    console.log(`📅 Generando estructura vacía para ${mes}/${anio}`);
    
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const primerDia = new Date(anio, mes - 1, 1).getDay();
    
    const semanas = [];
    let semanaActual = [];
    let diaActual = 1;

    for (let i = 0; i < primerDia; i++) {
        semanaActual.push({ 
            dia: null, 
            nombreDia: '', 
            fechaCompleta: '',
            filas: Array(4).fill().map(() => ({ tecnico: '', turno: '' }))
        });
    }

    for (let i = primerDia; i < 7 && diaActual <= diasEnMes; i++) {
        const fecha = new Date(anio, mes - 1, diaActual);
        const nombreDia = obtenerNombreDia(fecha.getDay());
        
        semanaActual.push({ 
            dia: diaActual,
            nombreDia: nombreDia,
            fechaCompleta: fecha.toISOString().split('T')[0],
            filas: Array(4).fill().map(() => ({ tecnico: '', turno: '' }))
        });
        diaActual++;
    }
    
    semanas.push(semanaActual);

    while (diaActual <= diasEnMes) {
        semanaActual = [];
        
        for (let i = 0; i < 7 && diaActual <= diasEnMes; i++) {
            const fecha = new Date(anio, mes - 1, diaActual);
            const nombreDia = obtenerNombreDia(fecha.getDay());
            
            semanaActual.push({ 
                dia: diaActual,
                nombreDia: nombreDia,
                fechaCompleta: fecha.toISOString().split('T')[0],
                filas: Array(4).fill().map(() => ({ tecnico: '', turno: '' }))
            });
            diaActual++;
        }
        
        while (semanaActual.length < 7) {
            semanaActual.push({ 
                dia: null, 
                nombreDia: '',
                fechaCompleta: '',
                filas: Array(4).fill().map(() => ({ tecnico: '', turno: '' }))
            });
        }
        semanas.push(semanaActual);
    }

    console.log(`✅ Estructura generada: ${semanas.length} semanas, ${diasEnMes} días`);
    
    return {
        mes,
        anio,
        semanas,
        orden_tecnicos_por_semana: {},
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
    };
}

module.exports = router;