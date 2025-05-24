//main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql');
const crypto = require('crypto');

// Configuración de la conexión a la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'ritmichell_db'
};

// Función para conectar a la base de datos
function createConnection() {
    const connection = mysql.createConnection(dbConfig);
    connection.connect(err => {
        if (err) {
            console.error('Error connecting to database:', err.code);
            console.error('Fatal:', err.fatal);
        }
    });
    return connection;
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        icon: __dirname + '/images/Ritmichell.ico',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.removeMenu();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// operaciones con la base de datos
ipcMain.handle('login', async (event, { username, password }) => {
    const connection = createConnection();
    
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM users WHERE username = ?', 
                [username],
                (error, results) => {
                    if (error) reject(error);
                    else resolve([results]);
                }
            );
        });

        if (rows.length === 0) {
            return { success: false, message: 'Usuario no encontrado' };
        }
        
        const user = rows[0];
        const hashedPassword = hashPassword(password);
        
        if (user.password_hash === hashedPassword) {
            return { 
                success: true, 
                message: 'Inicio de sesión exitoso',
                isAdmin: user.is_admin === 1
            };
        }
        
        return { success: false, message: 'Contraseña incorrecta' };
    } catch (error) {
        console.error('Error en login:', error);
        return { success: false, message: 'Error en la base de datos' };
    } finally {
        connection.end();
    }
});

ipcMain.handle('get-inventory', async () => {
    const connection = createConnection();
    
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM inventory', (error, results) => {
                if (error) reject(error);
                else resolve([results]);
            });
        });
        
        const inventory = {};
        rows.forEach(product => {
            inventory[product.id] = {
                id: product.id,
                colegio: product.colegio,
                categoria: product.categoria,
                prenda: product.prenda,
                talla: product.talla,
                cantidad: product.cantidad
            };
        });
        
        return inventory;
    } catch (error) {
        console.error('Error getting inventory:', error);
        return {};
    } finally {
        connection.end();
    }
});


ipcMain.handle('add-product', async (event, product) => {
    const connection = createConnection();
    
    try {
        const productId = crypto
            .createHash('md5')
            .update(`${product.colegio}${product.categoria}${product.prenda}${product.talla}`)
            .digest('hex');

        let existingProducts = [];
        try {
            existingProducts = await new Promise((resolve, reject) => {
                connection.query(
                    'SELECT * FROM inventory WHERE id = ?',
                    [productId],
                    (error, results) => {
                        if (error) reject(error);
                        else resolve(results || []);
                    }
                );
            });
        } catch (err) {
            console.error('Error checking existing products:', err);
            existingProducts = []; // Asignar un array vacío en caso de error
        }

        // Verificar si el resultado es un array y tiene elementos
        if (Array.isArray(existingProducts) && existingProducts.length > 0) {
            return { success: false, message: 'El producto ya existe' };
        }

        await new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO inventory (id, colegio, categoria, prenda, talla, cantidad) VALUES (?, ?, ?, ?, ?, ?)',
                [productId, product.colegio, product.categoria, product.prenda, product.talla, product.cantidad],
                (error) => {
                    if (error) reject(error);
                    else resolve();
                }
            );
        });

        return { success: true, message: 'Producto agregado exitosamente' };
    } catch (error) {
        console.error('Error adding product:', error);
        return { success: false, message: 'Error en la base de datos' };
    } finally {
        connection.end();
    }
});

// Handler para actualizar stock (versión corregida)
ipcMain.handle('update-stock', async (event, { colegio, prenda, cantidad, tipo, talla, tipomov, isAdmin }) => {
    const connection = createConnection();
    
    try {
        // Buscar el producto en la base de datos usando el colegio, prenda y talla
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM inventory WHERE colegio = ? AND prenda = ? AND talla = ?',
                [colegio, prenda, talla],
                (error, results) => {
                    if (error) {
                        console.error('Error en la consulta:', error);
                        reject(error);
                    } else {
                        resolve([results || []]);
                    }
                }
            );
        });

        if (rows.length === 0) {
            return { success: false, message: 'Producto no encontrado' };
        }

        // Aquí continúa con la lógica para actualizar el stock
        const currentStock = rows[0].cantidad; 
        console.log('Stock actual:', currentStock); // Verificar el stock actual

        const cantidadNumerica = parseInt(cantidad); // Convertir cantidad a número
        console.log('Cantidad ingresada:', cantidad); // Verificar la cantidad ingresada
        console.log('Cantidad numérica:', cantidadNumerica); // Verificar la cantidad numérica
        console.log('Tipo de movimiento:', tipomov); // Verificar el tipo de movimiento

        // Verificar que cantidadNumerica sea un número válido
        if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
            return { success: false, message: 'Cantidad no válida' };
        }

        let newStock = currentStock; // Inicializar newStock con el stock actual

        // Lógica para actualizar el stock
        if (tipomov === 'ENTRADA') {
            newStock += cantidadNumerica; // Sumar la cantidad
            console.log('Nuevo stock después de entrada:', newStock); // Verificar nuevo stock
        } else if (tipomov === 'SALIDA') {
            if (currentStock < cantidadNumerica) {
                return { success: false, message: 'Stock insuficiente' };
            }
            newStock -= cantidadNumerica; // Restar la cantidad
            console.log('Nuevo stock después de salida:', newStock); // Verificar nuevo stock
        } else {
            return { success: false, message: 'Tipo de movimiento no válido' };
        }

        // Actualizar el stock en la base de datos
        await new Promise((resolve, reject) => {
            connection.query(
                'UPDATE inventory SET cantidad = ? WHERE colegio = ? AND prenda = ? AND talla = ?',
                [newStock, colegio, prenda, talla],
                (error) => {
                    if (error) {
                        console.error('Error al actualizar el stock:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });

        // Registrar el movimiento en la base de datos
        await new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO stock_movements (colegio, prenda, talla, cantidad, tipo, created_at, isAdmin) VALUES (?, ?, ?, ?, ?, NOW(), ?)',
                [colegio, prenda, talla, cantidadNumerica, tipomov, isAdmin ? 1 : 0],
                (error) => {
                    if (error) {
                        console.error('Error al registrar el movimiento:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });

        return { success: true, message: 'Stock actualizado correctamente' };
    } catch (error) {
        console.error('Error en el proceso de actualización:', error);
        return { success: false, message: 'Error en el proceso de actualización' };
    } finally {
        connection.end(); 
    }
});


ipcMain.handle('delete-product', async (event, { colegio, categoria, prenda, talla }) => {
    const connection = createConnection();
    
    try {
        await new Promise((resolve, reject) => {
            connection.query(
                'DELETE FROM inventory WHERE colegio = ? AND categoria = ? AND prenda = ? AND talla = ?',
                [colegio, categoria, prenda, talla],
                (error, results) => {
                    if (error) {
                        console.error('Error al eliminar el producto:', error);
                        reject(error);
                    } else {
                        resolve(results);
                    }
                }
            );
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        return { success: false };
    } finally {
        connection.end();
    }
});


ipcMain.handle('get-costs', async () => {
    const connection = createConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT producto,
                    talla,
                    costo_de_produccion, 
                    costos_variables, 
                    precio_de_venta, 
                    rentabilidad,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at 
            FROM costs 
            ORDER BY created_at DESC`,
            (error, results) => {
                connection.end();
                if (error) {
                    console.error('Error fetching costs:', error);
                    reject(error);
                } else {
                    resolve(results);
                }
            }
        );
    });
});


// Handler para agregar un nuevo costo incluyendo la talla
ipcMain.handle('add-cost', async (event, costData) => {
    const connection = createConnection();
    
    try {
        await new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO costs (producto, talla, costo_de_produccion, costos_variables, precio_de_venta, rentabilidad) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    costData.product,
                    costData.talla,
                    costData.costProduction,
                    costData.costVariable,
                    costData.sellingPrice,
                    costData.profitability
                ],
                (error) => {
                    if (error) {
                        console.error('Error al guardar el costo:', error);
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
        
        return { success: true, message: 'Costo registrado exitosamente' };
    } catch (error) {
        console.error('Error adding cost:', error);
        return { success: false, message: 'Error en la base de datos' };
    } finally {
        connection.end();
    }
});



// Añadir handlers IPC
ipcMain.handle('save-report-settings', async (event, day) => {
    const connection = createConnection();
    try {
        await new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
                ['report_day', day, day],
                (error) => {
                    if (error) reject(error);
                    else resolve();
                }
            );
        });
        return { success: true };
    } catch (error) {
        console.error('Error saving report settings:', error);
        return { success: false };
    } finally {
        connection.end();
    }
});

ipcMain.handle('get-report-settings', async () => {
    const connection = createConnection();
    try {
        const results = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT value FROM settings WHERE name = "report_day"',
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });
        return results.length > 0 ? parseInt(results[0].value) : 4;
    } catch (error) {
        console.error('Error getting report settings:', error);
        return 4;
    } finally {
        connection.end();
    }
});

ipcMain.handle('get-reports', async () => {
    const connection = createConnection();
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM reports ORDER BY report_date DESC', (error, results) => {
                if (error) reject(error);
                else resolve([results]);
            });
        });
        return rows; // Devuelve los reportes
    } catch (error) {
        console.error('Error getting reports:', error);
        return [];
    } finally {
        connection.end();
    }
});

// En main.js, mejorar la generación de reportes
ipcMain.handle('generate-report', async () => {
    const connection = createConnection();
    try {
        // 1. Obtener inventario
        const inventory = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM inventory', (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        // 2. Obtener movimientos de la semana
        const movements = await new Promise((resolve, reject) => {
            connection.query(
                `SELECT * FROM stock_movements 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
                (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                }
            );
        });

        // 3. Calcular estadísticas
        const entradas = movements.filter(m => m.tipo === 'ENTRADA').length;
        const salidas = movements.filter(m => m.tipo === 'SALIDA').length;

        // 4. Crear reporte
        const reportData = {
            fecha: new Date().toISOString(),
            inventario: inventory,
            movimientos: movements,
            resumen: { entradas, salidas }
        };

        // 5. Guardar en base de datos
        await new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO reports (report_date, total_items, items_added, items_removed, data) VALUES (?, ?, ?, ?, ?)',
                [
                    new Date(),
                    inventory.length,
                    entradas,
                    salidas,
                    JSON.stringify(reportData)
                ],
                (error) => {
                    if (error) reject(error);
                    else resolve();
                }
            );
        });

        return { success: true, data: reportData };
    } catch (error) {
        console.error('Error generando reporte:', error);
        return { success: false, error: error.message };
    } finally {
        connection.end(); // Cerrar conexión
    }
});

ipcMain.handle('add-colegio', async (event, colegio) => {
    const connection = createConnection();
    
    try {
        // Verificar si el colegio ya existe
        const existingColegios = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM colegios WHERE nombre = ?', [colegio], (error, results) => {
                if (error) reject(error);
                else resolve(results);
            });
        });

        // Si el colegio ya existe, retornar un mensaje de error
        if (existingColegios.length > 0) {
            return { success: false, message: 'El colegio ya existe' };
        }

        // Si no existe, agregar el nuevo colegio
        await new Promise((resolve, reject) => {
            connection.query('INSERT INTO colegios (nombre) VALUES (?)', [colegio], (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        
        return { success: true, message: 'Colegio agregado exitosamente' };
    } catch (error) {
        console.error('Error adding colegio:', error);
        return { success: false, message: 'Error en la base de datos' };
    } finally {
        connection.end();
    }
});


ipcMain.handle('get-colegios', async () => {
    const connection = createConnection();
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM colegios', (error, results) => {
                if (error) reject(error);
                else resolve([results]);
            });
        });
        return rows; // Devuelve todos los colegios
    } catch (error) {
        console.error('Error getting colegios:', error);
        return [];
    } finally {
        connection.end();
    }
});





ipcMain.handle('get-prendas', async (event, { colegio, categoria }) => {
    console.log('Cargando prendas para:', colegio, categoria); // Log para depuración
    const connection = createConnection();
    
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT DISTINCT prenda FROM inventory WHERE colegio = ? AND categoria = ?',
                [colegio, categoria],
                (error, results) => {
                    if (error) {
                        console.error('Error en la consulta:', error);
                        reject(error);
                    } else {
                        console.log('Resultados de la consulta:', results); // Log para depuración
                        resolve([results || []]);
                    }
                }
            );
        });
        
        return rows.map(row => row.prenda);
    } catch (error) {
        console.error('Error getting prendas:', error);
        return [];
    } finally {
        connection.end();
    }
});



ipcMain.handle('get-categorias', async (event, { colegio }) => {
    console.log('Cargando categorías para:', colegio); // Log para depuración
    const connection = createConnection();
    
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT DISTINCT categoria FROM inventory WHERE colegio = ?',
                [colegio],
                (error, results) => {
                    if (error) {
                        console.error('Error en la consulta:', error);
                        reject(error);
                    } else {
                        console.log('Resultados de la consulta:', results); // Log para depuración
                        resolve([results || []]);
                    }
                }
            );
        });
        
        return rows.map(row => row.categoria);
    } catch (error) {
        console.error('Error getting categorias:', error);
        return [];
    } finally {
        connection.end();
    }
});






const PDFDocument = require('pdfkit'); 
const fs = require('fs');


ipcMain.handle('generate-report-pdf', async (event, reportData) => {
    const doc = new PDFDocument();
    const reportPath = path.join(__dirname, 'reports', `report-${Date.now()}.pdf`);

    // Crear un flujo de escritura para el PDF
    const writeStream = fs.createWriteStream(reportPath);
    doc.pipe(writeStream);

    // Título del reporte
    doc.fontSize(20).text('Reporte de Movimientos', { align: 'center' });
    doc.moveDown();

    // Agregar detalles del reporte
    doc.fontSize(14).text(`Fecha del Reporte: ${new Date(reportData.report_date).toLocaleDateString()}`);
    doc.text(`Inventario Total: ${reportData.total_items}`);
    doc.text(`Productos Añadidos: ${reportData.items_added}`);
    doc.text(`Productos Retirados: ${reportData.items_removed}`);
    doc.moveDown();

    // Agregar detalles de los movimientos de stock
    if (reportData.movements && reportData.movements.length > 0) {
        reportData.movements.forEach(movement => {
            doc.fontSize(12).text(`Colegio: ${movement.colegio}, Producto: ${movement.prenda}, Talla: ${movement.talla}, Movimiento: ${movement.tipo}, Cantidad: ${movement.cantidad}, Realizado por: ${movement.isAdmin ? 'Admin' : 'Usuario'}`);
            doc.moveDown();
        });
    } else {
        doc.fontSize(12).text('No hay movimientos de stock para este reporte.');
    }

    // Finalizar el documento
    doc.end();

    // Esperar a que el flujo de escritura se complete
    return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
            resolve({ success: true, path: reportPath });
        });
        writeStream.on('error', (error) => {
            console.error('Error al escribir el PDF:', error);
            reject({ success: false, message: 'Error al generar el PDF' });
        });
    });
});



ipcMain.handle('get-report-by-id', async (event, reportId) => {
    const connection = createConnection();
    
    try {
        const [reportRows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM reports WHERE id = ?',
                [reportId],
                (error, results) => {
                    if (error) reject(error);
                    else resolve([results]);
                }
            );
        });

        if (reportRows.length === 0) {
            throw new Error('Reporte no encontrado');
        }

        const report = reportRows[0];

        // Obtener todos los movimientos de stock relacionados con el reporte
        const [movementRows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM stock_movements WHERE id = ?', // Asegúrate de que tengas una relación
                [reportId],
                (error, results) => {
                    if (error) reject(error);
                    else resolve([results]);
                }
            );
        });

        return { report, movements: movementRows }; 
    } catch (error) {
        console.error('Error en get-report-by-id:', error);
        throw new Error('Error al obtener el reporte');
    } finally {
        connection.end();
    }
});



ipcMain.handle('search-products', async (event, query) => {
    const connection = createConnection();
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM inventory WHERE colegio LIKE ? OR prenda LIKE ?',
                [`%${query}%`, `%${query}%`],
                (error, results) => {
                    if (error) reject(error);
                    else resolve([results]);
                }
            );
        });
        return rows; // Devuelve los productos que coinciden con la búsqueda
    } catch (error) {
        console.error('Error searching products:', error);
        return [];
    } finally {
        connection.end();
    }
});


ipcMain.handle('get-product-details', async (event, { colegio, prenda, talla }) => {
    const connection = createConnection();
    try {
        const [rows] = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM inventory WHERE colegio = ? AND prenda = ? AND talla = ?',
                [colegio, prenda, talla],
                (error, results) => {
                    if (error) reject(error);
                    else resolve([results]);
                }
            );
        });
        return rows.length > 0 ? rows[0] : null; // Devuelve el primer producto encontrado
    } catch (error) {
        console.error('Error getting product details:', error);
        return null;
    } finally {
        connection.end();
    }
});





const XLSX = require('xlsx');




ipcMain.handle('generate-cost-reports', async (event, reportData) => {
       const connection = createConnection(); // Conexión a la base de datos
        try {
        const costos = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM costs', (error, results) => {
                if (error) {
                    console.error('Error fetching costs:', error);
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });
        
        // Crear un nuevo libro de trabajo
        const workbook1 = XLSX.utils.book_new();

        // Crear una hoja para el inventario
        const Costoshoja = XLSX.utils.json_to_sheet(costos);
        XLSX.utils.book_append_sheet(workbook1, Costoshoja, 'Costos');

        // Guardar el archivo Excel
        const reportPath1 = path.join(__dirname, 'reports', `costo-${Date.now()}.xlsx`);
        XLSX.writeFile(workbook1, reportPath1);

        return { success: true, path: reportPath1 };
    } catch (error) {
        console.error('Error generando reporte:', error);
        return { success: false, error: error.message };
    } finally {
        connection.end();
    }
});





ipcMain.handle('generate-report-excel', async () => {
    const connection = createConnection();
    try {
        // Obtener inventario
        const inventory = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM inventory', (error, results) => {
                if (error) {
                    console.error('Error fetching inventory:', error);
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        // Obtener movimientos de stock
        const movements = await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM stock_movements', (error, results) => {
                if (error) {
                    console.error('Error fetching movements:', error);
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        // Crear un nuevo libro de trabajo
        const workbook = XLSX.utils.book_new();

        // Crear una hoja para el inventario
        const inventorySheet = XLSX.utils.json_to_sheet(inventory);
        XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Inventario');

        // Crear una hoja para los movimientos
        const movementsSheet = XLSX.utils.json_to_sheet(movements);
        XLSX.utils.book_append_sheet(workbook, movementsSheet, 'Movimientos');

        // Guardar el archivo Excel
        const reportPath = path.join(__dirname, 'reports', `report-${Date.now()}.xlsx`);
        XLSX.writeFile(workbook, reportPath);

        return { success: true, path: reportPath };
    } catch (error) {
        console.error('Error generando reporte:', error);
        return { success: false, error: error.message };
    } finally {
        connection.end();
    }
});


ipcMain.handle('delete-report', async (event, reportId) => {
    const connection = createConnection();
    
    try {
        await new Promise((resolve, reject) => {
            connection.query(
                'DELETE FROM reports WHERE id = ?',
                [reportId],
                (error, results) => {
                    if (error) {
                        console.error('Error al eliminar el reporte:', error);
                        reject(error);
                    } else {
                        resolve(results);
                    }
                }
            );
        });
        
        return { success: true, message: 'Reporte eliminado exitosamente' };
    } catch (error) {
        console.error('Error deleting report:', error);
        return { success: false, message: 'Error al eliminar el reporte' };
    } finally {
        connection.end();
    }
});


