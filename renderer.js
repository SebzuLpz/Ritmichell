//renderer.js


const { ipcRenderer } = require('electron');


const loginForm = document.querySelector('.login-form');
const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const addProductBtn = document.getElementById('add-product-btn');
const updateStockBtn = document.getElementById('update-stock-btn');
const logoutBtn = document.getElementById('logout-btn');
const colegiobtn = document.getElementById('add-colegio-btn');
const gestionContainer = document.getElementById('products-container');
const backToMenu = document.getElementById('back-to-menu');


let isLoggingIn = false;

let isAdmin = false;



function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const hidden1 = document.createElement('div');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // Habilitar los inputs
    usernameInput.disabled = false;
    passwordInput.disabled = false;
    loginBtn.disabled = false;
    
    // Ocultar el mensaje de error después de 3 segundos
    setTimeout(() => {
        errorDiv.classList.add('hidden');
        setTimeout(() => {
            errorDiv.removeChild(hidden1);
        }, 400); // tiempo de la animación
    },3000);


}

// Login functionality
loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    //if (isLoggingIn) return; // Prevenir múltiples intentos

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    loginForm.reset();
    usernameInput.value = '';
    passwordInput.value = '';
    
    

    if (!username || !password) {
        showError('Por favor complete todos los campos');
        return;
    }

    try {
        isLoggingIn = true;
        loginBtn.disabled = false; // Solo deshabilitamos el botón

        const response = await ipcRenderer.invoke('login', { username, password });
        
        if (response.success) {
            isAdmin = response.isAdmin;
            loginContainer.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            
            setTimeout(() => {
                loginContainer.classList.add('hidden'); // Ocultar después de la animación
                mainContainer.classList.remove('hidden'); // Mostrar el contenedor principal
                mainContainer.classList.add('slide-in2'); // Aplicar animación de entrada
            },); // Esperar a que termine la animación de deslizamiento
        
            
            addProductBtn.classList.add('hidden'); // Primero ocultar para todos
            if (isAdmin) {
                
                addProductBtn.classList.remove('hidden'); // Mostrar solo si es admin
            }

            addProductBtn.classList.toggle('hidden', !isAdmin);
            document.getElementById('reports-btn').classList.toggle('hidden', !isAdmin);
            document.getElementById('add-colegio-btn').classList.toggle('hidden', !isAdmin);
            
            
            await loadInventory();
            await updateColegiosList();
            
            // Limpiar los campos sin deshabilitarlos
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            showError(response.message);
        }
    } catch (error) {
        console.error('Error during login:', error);
        showError('Error al iniciar sesión. Por favor intente nuevamente.');
    } finally {
        isLoggingIn = true;
        loginBtn.disabled = false;
    }
});


// Permitir usar Enter para iniciar sesión
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        loginBtn.click();
    }
});

function resetLoginForm() {
    loginForm.reset();  // Resetear el formulario completo
    document.querySelectorAll('input, select, button').forEach(element => {
        element.disabled = false;  // Asegurar que todos los elementos estén habilitados
    });
    isLoggingIn = false;
}


// Resetear modales
function resetModal(modalId) {
    const modal = document.getElementById(modalId);
    const inputs = modal.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.disabled = false;
        if (input.type === 'radio') {
            input.checked = input.defaultChecked;
        } else {
            input.value = '';
        }
    });
}


// Logout functionality
logoutBtn.addEventListener('click', () => {
    setTimeout(() => {
        
        loginContainer.classList.add('slide-in2');
         // Ocultar después de la animación
        mainContainer.classList.remove('slide-in2'); // Mostrar el contenedor principal
        
    }, ); // Esperar a que termine la animación de deslizamiento
    loginContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    
    
    // Ocultar el botón de agregar producto
    addProductBtn.classList.add('hidden');

    // Resetear todos los formularios
    document.querySelectorAll('form').forEach(form => form.reset());

    // Ocultar todas las secciones
    document.querySelectorAll('.main-section').forEach(section => {
        section.classList.add('hidden');
    });
    loginContainer.classList.remove('hidden');
    
    // Resetear y habilitar todos los inputs y selects
    document.querySelectorAll('input, select').forEach(element => {
        element.disabled = false;
        if (element.type !== 'radio') {
            element.value = '';
        }
    });
    
    // Resetear modales
    resetModal('add-product-modal');
    resetModal('update-stock-modal');
    
    

    isAdmin = false;
    isLoggingIn = false;
});

// Cargar inventario
async function loadInventory() {
    try {
        const inventory = await ipcRenderer.invoke('get-inventory');
        console.log('Inventario cargado:', inventory); // Verifica la respuesta
        updateProductsTable(Object.values(inventory));

        // Verificar stock crítico
        const lowStockProducts = Object.values(inventory).filter(product => product.cantidad <= 10);
        if (lowStockProducts.length > 0) {
            const productNames = lowStockProducts.map(product => `${product.prenda} del colegio ${product.colegio}`).join(', ');
            const alertDiv = document.getElementById('stock-alert');
            alertDiv.textContent = `Alerta: Los siguientes productos están en stock crítico: ${productNames}.`;
            alertDiv.classList.remove('hidden');

            // Ocultar la alerta después de 5 segundos
            setTimeout(() => {
                alertDiv.classList.add('hidden');
            }, 5000);
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('Error al cargar el inventario');
    }
}

async function loadCost() {
    const costHistoryBody = document.getElementById('cost-history-body');
    costHistoryBody.innerHTML = ''; // Limpiar tabla
    try {
        const costs = await ipcRenderer.invoke('get-costs');
        costs.forEach(cost => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cost.producto}</td>
                <td>${cost.talla}</td>
                <td>${cost.costo_de_produccion.toFixed(2)}</td>
                <td>${cost.costos_variables.toFixed(2)}</td>
                <td>${cost.precio_de_venta.toFixed(2)}</td>
                <td>${cost.rentabilidad.toFixed(2)}</td>
                <td>${cost.created_at}</td>
            `;
            costHistoryBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error cargando costos:', error);
    }
}
// Exportar para ser usada en otros módulos o llamada desde el script principal
module.exports = { loadCost };

function updateProductsTable(products) {
    const tbody = document.getElementById('products-body');
    tbody.innerHTML = '';

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.colegio}</td>
            <td>${product.categoria}</td>
            <td>${product.prenda}</td>
            <td>${product.talla}</td>
            <td>${product.cantidad}</td>
            <td>
                <button class="update-btn" data-colegio="${product.colegio}" 
                        data-categoria="${product.categoria}" 
                        data-prenda="${product.prenda}" 
                        data-talla="${product.talla}" 
                        data-cantidad="${product.cantidad}">
                    <img src="images/actualizar-producto.png" height="20px" width="20px" alt="Actualizar Producto">
                </button>
                ${isAdmin ? 
                `<button class="delete-btn" data-id="${product.id}" 
                    data-colegio="${product.colegio}"
                    data-tipo="${product.categoria}"
                    data-prenda="${product.prenda}"
                    data-talla="${product.talla}">
                    <img src="images/trash.png" height="19px" width="19px" alt="Eliminar Producto">
                </button>` : 
                ''
                }
            </td>
        `;
        tbody.appendChild(row);
    });

    // Añadir event listeners para los botones de actualizar
    document.querySelectorAll('.update-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const colegio = btn.getAttribute('data-colegio');
            const categoria = btn.getAttribute('data-categoria');
            const prenda = btn.getAttribute('data-prenda');
            const talla = btn.getAttribute('data-talla');
            const cantidad = btn.getAttribute('data-cantidad');

            // Llamar a la función para abrir el modal de actualización
            openUpdateModal({ colegio, categoria, prenda, talla, cantidad });
        });
    });

    // Añadir event listeners para los botones de eliminar
    if (isAdmin) {
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', showDeleteConfirmation);
        });
    }
}


// Función para abrir el modal de actualización
function openUpdateModal(product) {
    document.getElementById('update-colegio').value = product.colegio;
    document.getElementById('update-tipo').value = product.categoria;
    document.getElementById('update-prenda').value = product.prenda;
    document.getElementById('update-talla').value = product.talla;
    document.getElementById('update-cantidad').value = product.cantidad; // Cantidad actual

    // Mostrar el modal de actualización
    document.getElementById('update-stock-modal').classList.remove('hidden');
}



// Actualizar lista de colegios
async function updateColegiosList() {
    try {
        const inventory = await ipcRenderer.invoke('get-inventory');
        const colegios = new Set(Object.values(inventory).map(p => p.colegio));
        
        const colegioSelects = [document.getElementById('new-colegio'), document.getElementById('update-colegio'),document.getElementById('cost-colegio') ];
        
        colegioSelects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Seleccionar Colegio</option>';
                colegios.forEach(colegio => {
                    const option = document.createElement('option');
                    option.value = colegio;
                    option.textContent = colegio;
                    select.appendChild(option);
                });
            }
        });
    } catch (error) {
        console.error('Error updating colegios list:', error);
    }
}
// Botón para abrir el modal de agregar producto
addProductBtn.addEventListener('click', () => {
    document.getElementById('add-product-modal').classList.remove('hidden');
    updateColegiosSelect(); // Cargar colegios al abrir el modal
});

// Botón para abrir el modal de agregar colegio
colegiobtn.addEventListener('click', () => {
    document.getElementById('add-colegio-modal').classList.remove('hidden');
});
// Mostrar modal de actualizar stock
updateStockBtn.addEventListener('click', () => {
    document.getElementById('update-stock-modal').classList.remove('hidden');
    updatePrendasList('update-tipo', 'update-prenda');
    updateTallasSelect('update-talla'); // Actualizar lista de tallas
});


// Cerrar modales
document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        modal.classList.add('popup-out'); // Aplicar animación de salida
        modal.classList.add('hidden');
        setTimeout(() => {
        
            modal.classList.remove('popup-out') 
            
        }, 300);
        
    });
});



// Función para actualizar las tallas disponibles
function updateTallasSelect(selectId) {
    const tallas = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"];
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Seleccionar Talla</option>';
    tallas.forEach(talla => {
        const option = document.createElement('option');
        option.value = talla;
        option.textContent = talla;
        select.appendChild(option);
    });
}


// Guardar nuevo colegio
document.getElementById('save-colegio-btn').addEventListener('click', async () => {
    const colegioName = document.getElementById('new-colegio-name').value.trim();

    if (!colegioName) {
        showNotification('Por favor ingrese el nombre del colegio');
        return;
    }

    try {
        const response = await ipcRenderer.invoke('add-colegio', colegioName);
        if (response.success) {
            showNotification(response.message);
            document.getElementById('add-colegio-modal').classList.add('hidden');
            await loadColegios(); // Recargar la lista de colegios

            // Mostrar alerta personalizada
            showAddProductAlert(colegioName);
        } else {
            showNotification(response.message);
        }
    } catch (error) {
        console.error('Error adding colegio:', error);
        showNotification('Error al agregar colegio');
    }
});




function showAddProductAlert(colegioName) {
    const alertContainer = document.getElementById('notification-container');
    const alertDiv = document.createElement('div');
    alertDiv.className = 'notification alert'; // Asegúrate de tener estilos para esta clase
    alertDiv.innerHTML = `
        <p>¿Deseas añadir un producto para el colegio <strong>${colegioName}</strong>?</p>
        <br>
        <button id="yes-add-product-btn" class="btn-primary">Sí</button>
        <button id="no-add-product-btn" class="btn-secondary">No</button>
    `;
    alertContainer.appendChild(alertDiv);

    // Evento para el botón "Sí"
    document.getElementById('yes-add-product-btn').addEventListener('click', () => {
        alertContainer.removeChild(alertDiv); // Eliminar la alerta
        openAddProductModal(); // Abrir el modal de añadir producto
    });

    // Evento para el botón "No"
    document.getElementById('no-add-product-btn').addEventListener('click', () => {
        alertContainer.removeChild(alertDiv); // Eliminar la alerta
    });
}


function openAddProductModal() {
    document.getElementById('add-product-modal').classList.remove('hidden'); // Mostrar el modal
    updateColegiosSelect(); // Cargar colegios al abrir el modal (si es necesario)
}



// Agregar nuevo producto
document.getElementById('save-product-btn').addEventListener('click', async () => {
    const product = {
        colegio: document.getElementById('new-colegio').value,
        categoria: document.getElementById('new-tipo').value,
        prenda: document.getElementById('new-prenda').value,
        talla: document.getElementById('new-talla').value,
        cantidad: parseInt(document.getElementById('new-cantidad').value)
    };

    // Validación de campos
    if (!product.colegio || !product.categoria || !product.prenda || !product.talla || isNaN(product.cantidad)) {
        showNotification('Por favor complete todos los campos correctamente');
        return;
    }

    try {
        const response = await ipcRenderer.invoke('add-product', product);
        console.log('Respuesta al agregar producto:', response); // Log para verificar la respuesta
        if (response.success) {
            showNotification(response.message);
            document.getElementById('add-product-modal').classList.add('hidden');
            await loadInventory(); // Recargar inventario
            await updateColegiosList(); // Actualizar lista de colegios
        } else {
            showNotification(response.message);
        }
    } catch (error) {
        console.error('Error adding product:', error);
        showNotification('Error al agregar producto');
    }
});




// Actualizar stock
document.getElementById('save-update-btn').addEventListener('click', async () => {
    const colegio = document.getElementById('update-colegio').value;
    const tipoCategoria = document.getElementById('update-tipo').value; 
    const prenda = document.getElementById('update-prenda').value; 
    const talla = document.getElementById('update-talla').value;
    const isAdmin = true; // o false, dependiendo de si es admin o no

    // Obtener el tipo de movimiento seleccionado
    const tipoMovimiento = document.querySelector('input[name="tipo-mov"]:checked').value;

    // Verificar que todos los campos necesarios estén seleccionados
    if (!colegio || !tipoMovimiento || !prenda || !talla) {
        showNotification('Por favor, complete todos los campos antes de actualizar el stock.');
        return;
    }

    const updateData = {
        colegio,
        prenda,
        cantidad: document.getElementById('update-cantidad').value,
        tipo: tipoCategoria, 
        tipomov: tipoMovimiento, 
        talla,
        isAdmin
    };

    try {
        const response = await ipcRenderer.invoke('update-stock', updateData);
        if (response.success) {
            showNotification(response.message);
            document.getElementById('update-stock-modal').classList.add('hidden');
            loadInventory(); 
        } else {
            showNotification(response.message);
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showNotification('Error al actualizar stock');
    }
});


function showNotification(message, duration = 3000) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('hiding');
        setTimeout(() => {
            container.removeChild(notification);
        }, 300); // tiempo de la animación
    }, duration);
}





function showDeleteConfirmation(event) {
    const btn = event.currentTarget;
    const modal = document.getElementById('delete-confirm-modal');
    
    // Guardar el ID del producto en el botón de confirmar
    document.getElementById('confirm-delete-btn').dataset.productId = btn.dataset.id;
    
    // Mostrar detalles del producto
    document.getElementById('delete-colegio').textContent = btn.dataset.colegio;
    document.getElementById('delete-tipo').textContent = btn.dataset.tipo;
    document.getElementById('delete-prenda').textContent = btn.dataset.prenda;
    document.getElementById('delete-talla').textContent = btn.dataset.talla;
    
    modal.classList.remove('hidden');
}

document.getElementById('confirm-delete-btn').addEventListener('click', async function() {
    const colegio = document.getElementById('delete-colegio').textContent;
    const categoria = document.getElementById('delete-tipo').textContent;
    const prenda = document.getElementById('delete-prenda').textContent;
    const talla = document.getElementById('delete-talla').textContent;

    try {
        const response = await ipcRenderer.invoke('delete-product', { colegio, categoria, prenda, talla });
        if (response.success) {
            document.getElementById('delete-confirm-modal').classList.add('hidden');
            showNotification('Producto eliminado exitosamente');
            await loadInventory(); // Recargar el inventario después de la eliminación
            await updateColegiosList(); // Actualizar lista de colegios
        } else {
            showNotification('Error: No se pudo eliminar el producto');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('Error al eliminar el producto');
    }
});

// Add these as new DOM Elements
const costControlBtn = document.getElementById('cost-control-btn');
const costControlContainer = document.getElementById('cost-control-container');
const backToInventoryBtn = document.getElementById('back-to-inventory-btn');
const logoutFromCostBtn = document.getElementById('logout-from-cost-btn');
const saveCostBtn = document.getElementById('save-cost-btn');

// Event listener for the "Control de Costos" button
costControlBtn.addEventListener('click', () => {
    mainContainer.classList.add('hidden');
    costControlContainer.classList.remove('hidden');

    setTimeout(() => {

        mainContainer.classList.add('hidden');
// Aplicar animación de entrada
        costControlContainer.classList.remove('hidden'); // Mostrar el contenedor principal
        costControlContainer.classList.add('slide-in2');

    }, ); // Esperar a que termine la animación de deslizamiento

    updateColegiosListForCost();
    loadCost()
    
});

// Event listener for the "Volver a Inventario" button
backToInventoryBtn.addEventListener('click', () => {
    costControlContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    costControlContainer.classList.add('slide-out2');

    setTimeout (()=> {
        costControlContainer.classList.remove('slide-out2');
        costControlContainer.classList.add('hidden');

        mainContainer.classList.remove('hidden');
    },);

    //loadInventory(); // Reload inventory data when returning
    
});





// Event listener for the "Cerrar Sesión" button in cost control
logoutFromCostBtn.addEventListener('click', () => {
    setTimeout(() => {
        
        loginContainer.classList.add('slide-in2');
         // Ocultar después de la animación
        mainContainer.classList.remove('slide-in2'); // Mostrar el contenedor principal
        
    }, 100);
    costControlContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    
    
    // Reset all forms
    document.querySelectorAll('form').forEach(form => form.reset());
    
    // Reset and enable all inputs and selects
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.disabled = false;
        if (element.type !== 'radio') {
            element.value = '';
        }
    });
    
    isAdmin = false;
    isLoggingIn = false;
});

// Function to update colegios list for cost control
async function updateColegiosListForCost() {
    try {
        const inventory = await ipcRenderer.invoke('get-inventory');
        const colegios = new Set(Object.values(inventory).map(p => p.colegio));
        
        const costColegioSelect = document.getElementById('cost-colegio');
        const costFilterColegioSelect = document.getElementById('cost-filter-colegio');
        
        [costColegioSelect, costFilterColegioSelect].forEach(select => {
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">Seleccionar Colegio</option>';
                colegios.forEach(colegio => {
                    const option = document.createElement('option');
                    option.value = colegio;
                    option.textContent = colegio;
                    select.appendChild(option);
                });
                select.value = currentValue;
            }
        });
    } catch (error) {
        console.error('Error updating colegios list for cost:', error);
    }
}



// Function to update costs table
function updateCostsTable(costs) {
    const tbody = document.getElementById('costs-body');
    tbody.innerHTML = '';
    
    costs.forEach(cost => {
        const row = document.createElement('tr');
        
        // Format date from YYYY-MM to MM/YYYY
        const dateParts = cost.month.split('-');
        const formattedDate = dateParts[1] + '/' + dateParts[0];
        
        row.innerHTML = `
            <td>${cost.colegio}</td>
            <td>${cost.categoria}</td>
            <td>${formattedDate}</td>
            <td>$${cost.amount.toFixed(2)}</td>
            <td>${cost.description}</td>
        `;
        tbody.appendChild(row);
    });
}

// Variables para almacenar costos fijos
const totalFijos = 220000 + 700000 + 65000 + 120000;


// Mostrar u ocultar input de costo variable
document.getElementById('has-variable-cost').addEventListener('change', function() {
    const costVariableInput = document.getElementById('cost-variable');
    costVariableInput.classList.toggle('hidden', !this.checked);
});

let calculatedSellingPrice = 0;
let calculatedProfitability = 0;

document.getElementById('calculate-price-btn').addEventListener('click', () => {
    const costProduction = parseFloat(document.getElementById('cost-production').value) || 0;
    const costVariable = document.getElementById('has-variable-cost').checked ? parseFloat(document.getElementById('cost-variable').value) || 0 : 0;

    if (costProduction <= 0) {
        showNotification('Ingrese un costo de producción válido mayor que 0.');
        return;
    }

    // Precio de venta = costo de producción + 80%
    calculatedSellingPrice = costProduction + (costProduction * 0.8);

    // Rentabilidad = precio de venta - (costos fijos + costos variables + costo de producción)
    const totalCosts = costProduction + costVariable;   
    calculatedProfitability = calculatedSellingPrice - totalCosts;

    // Mostrar resultados
    document.getElementById('show-selling-price').textContent = calculatedSellingPrice.toFixed(2);
    document.getElementById('profitability').textContent = calculatedProfitability.toFixed(2);

    // Habilitar botón guardar
    document.getElementById('save-cost-btn').disabled = false;
});

document.getElementById('save-cost-btn').addEventListener('click', async () => {
    const product = document.getElementById('product-selector').value;
    const size = document.getElementById('size-selector').value;
    const costProduction = parseFloat(document.getElementById('cost-production').value) || 0;
    const costVariable = document.getElementById('has-variable-cost').checked ? parseFloat(document.getElementById('cost-variable').value) || 0 : 0;

    if (!product) { 
        showNotification('Seleccione un producto.'); 
        return; 
    }
    if (!size) { 
        showNotification('Seleccione una talla.'); 
        return; 
    }
    if (costProduction <= 0) { 
        showNotification('Ingrese un costo de producción válido mayor que 0.'); 
        return; 
    }
    if (calculatedSellingPrice <= 0) { 
        showNotification('Primero calcule el precio de venta.'); 
        return; 
    }

    try {
        const response = await ipcRenderer.invoke('add-cost', {
            product,
            talla: size,
            costProduction,
            totalFijos,
            costVariable,
            sellingPrice: calculatedSellingPrice,
            profitability: calculatedProfitability
        });
        if (response.success) {
            showNotification('Costo guardado exitosamente.');
            loadCost();
            // Reset form
            document.getElementById('product-selector').value = '';
            document.getElementById('size-selector').value = '';
            document.getElementById('cost-production').value = '';
            document.getElementById('has-variable-cost').checked = false;
            document.getElementById('cost-variable').value = '';
            document.getElementById('cost-variable').classList.add('hidden');
            document.getElementById('show-selling-price').textContent = '0';
            document.getElementById('profitability').textContent = '0';
            document.getElementById('save-cost-btn').disabled = true;
        } else {
            showNotification('Error al guardar el costo: ' + response.message);
        }
    } catch (error) {
        console.error('Error saving cost:', error);
        showNotification('Error al guardar el costo.');
    }
});







// Cerrar modales con la tecla "Esc"
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        
        setTimeout(() => {
            modal.classList.add('popup-out'); // Aplicar animación de salida
            modal.classList.add('hidden'); // Ocultar el modal después de la animación
            modal.classList.remove('popup-out'); // Limpiar la clase de animación
        },); // Esperar a que termine la animación de salida
            resetModal(modal.id);
        });
    }
});

// Confirmar agregar producto con "Enter"
document.getElementById('new-cantidad').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-product-btn').click();
    }
});

// Confirmar actualizar stock con "Enter"
document.getElementById('update-cantidad').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-update-btn').click();
    }
});

// Botón para abrir el modal de agregar colegio
colegiobtn.addEventListener('click', () => {
    const modal = document.getElementById('add-colegio-modal')
    modal.classList.remove('hidden'); // Mostrar el modal
    modal.classList.add('popup-in'); // Aplicar animación de entrada
});
// Mostrar modal de agregar producto
addProductBtn.addEventListener('click', () => {
    const modal = document.getElementById('add-product-modal');
    modal.classList.remove('hidden'); // Mostrar el modal
    modal.classList.add('popup-in'); // Aplicar animación de entrada
});

// Mostrar modal de actualizar stock
updateStockBtn.addEventListener('click', () => {
    const modal = document.getElementById('update-stock-modal');
    modal.classList.remove('hidden'); // Mostrar el modal
    modal.classList.add('popup-in'); // Aplicar animación de entrada
});


// Cerrar modales al hacer clic en el botón de cerrar
document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        modal.classList.add('popup-out'); // Aplicar animación de salida
        setTimeout(() => {
            modal.classList.add('hidden'); // Ocultar el modal después de la animación
            modal.classList.remove('popup-out'); // Limpiar la clase de animación
        }, 300); // Esperar a que termine la animación de salida
        closeModal(modal); // Llamar a la función para cerrar el modal
    });
});

// Cerrar modales al presionar la tecla "Esc"
document.addEventListener('keydown', (event) => {
    if (event.key === 'escape') {
        const openModal = document.querySelector('.modal:not(.hidden)'); // Buscar el modal visible
        if (openModal) {
            modal.classList.add('popup-out'); // Aplicar animación de salida
            setTimeout(() => {
                modal.classList.add('hidden'); // Ocultar el modal después de la animación
                modal.classList.remove('popup-out'); // Limpiar la clase de animación
            }, 300); // Esperar a que termine la animación de salida
            closeModal(openModal); // Cerrar el modal visible
        }
    }
});

// Función para cerrar el modal con animación
function closeModal(modal) {
    modal.classList.add('popup-out'); // Aplicar animación de salida
    setTimeout(() => {
        modal.classList.add('hidden'); // Ocultar el modal después de la animación
        modal.classList.remove('popup-out'); // Limpiar la clase de animación
    }, 300); // Esperar a que termine la animación de salida
}





// Añadir elementos DOM
const reportsBtn = document.getElementById('reports-btn');
const reportsContainer = document.getElementById('reports-container');
const reportDaySelect = document.getElementById('report-day');

// Mostrar/ocultar botón de reportes según privilegios
if (isAdmin) {
    reportsBtn.classList.remove('hidden');
}

// Manejar clic en botón de reportes
reportsBtn.addEventListener('click', async () => {
    mainContainer.classList.add('hidden');
    reportsContainer.classList.remove('hidden');

    setTimeout(() => {

        mainContainer.classList.add('hidden');
// Aplicar animación de entrada
        reportsContainer.classList.remove('hidden'); // Mostrar el contenedor principal
        reportsContainer.classList.add('slide-in2');

    }, ); 
    await loadReportSettings();
    await loadReportHistory();
});

// Cargar configuración de reportes
async function loadReportSettings() {
    try {
        const savedDay = await ipcRenderer.invoke('get-report-settings');
        reportDaySelect.value = savedDay;
    } catch (error) {
        console.error('Error loading report settings:', error);
    }
}


// Cargar historial de reportes
async function loadReportHistory() {
    try {
        const reports = await ipcRenderer.invoke('get-reports');
        const tbody = document.getElementById('report-history-body');
        tbody.innerHTML = '';
        
        reports.forEach(report => {
            const fecha = new Date(report.report_date).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${fecha}</td>
                <td>${report.total_items}</td>
                <td>${report.items_added}</td>
                <td>${report.items_removed}</td>
                <td>
                    <button class="btn-view-report" data-id="${report.id}"><img src="images/reports.png" height="40px" width="40px"></button>
                    <button class="btn-delete-report" data-id="${report.id}"><img src="images/delete.png" height="40px" width="40px"></button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Añadir event listeners para ver detalles
        document.querySelectorAll('.btn-view-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.dataset.id; // Asegúrate de usar btn
                const report = await ipcRenderer.invoke('get-report-by-id', reportId);
                showReportDetails(report);
            });
        });

        // Añadir event listeners para eliminar reportes
        document.querySelectorAll('.btn-delete-report').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.dataset.id; // Obtener el ID del reporte
                const response = await ipcRenderer.invoke('delete-report', reportId);
                if (response.success) {
                    showNotification(response.message);
                    await loadReportHistory(); // Recargar el historial de reportes
                } else {
                    showNotification(response.message);
                }
            });
        });
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

// Guardar configuración de día de reportes
reportDaySelect.addEventListener('change', async () => {
    try {
        await ipcRenderer.invoke('save-report-settings', reportDaySelect.value);
        showNotification('Configuración guardada correctamente');
    } catch (error) {
        console.error('Error saving report settings:', error);
        showNotification('Error al guardar configuración');
    }
});


function showSection(targetSection) {
    document.querySelectorAll('.main-section').forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(targetSection).classList.remove('hidden');
}


// Al abrir un modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('hidden');
    // Enfocar primer elemento interactivo
    const focusable = modal.querySelector('input, select, button');
    if (focusable) focusable.focus();
    
    // Limitar tabulación dentro del modal
    modal.addEventListener('keydown', trapTabKey);
}

// Función para atrapar el tabulador
function trapTabKey(e) {
    if (e.key === 'Tab') {
        const focusableElements = this.querySelectorAll('input, button, select, textarea');
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
        }
    }
}

// Añadir este código en la sección de event listeners
document.getElementById('generate-report-btn').addEventListener('click', async () => {
    try {
        const response = await ipcRenderer.invoke('generate-report');
        if (response.success) {
            showNotification('Reporte generado exitosamente');
            
            await loadReportHistory();
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('Error al generar reporte');
    }
});

// Cambiar el ID del listener
document.getElementById('back-to-inventory-from-reports').addEventListener('click', () => {
    reportsContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');


    setTimeout (()=> {
        reportsContainer.classList.remove('slide-out2');
        reportsContainer.classList.add('hidden');

        mainContainer.classList.remove('hidden');
    },);

});



// Añadir este event listener
document.getElementById('logout-from-reports').addEventListener('click', () => {
    reportsContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');


    setTimeout (()=> {
        reportsContainer.classList.remove('slide-in2');
        reportsContainer.classList.add('hidden');

        mainContainer.classList.remove('hidden');
    },);

    // Resetear todos los formularios y estados
    document.querySelectorAll('form').forEach(form => form.reset());
});




// Función para cargar los colegios en el select
async function updateColegiosSelect() {
    try {
        const colegios = await ipcRenderer.invoke('get-colegios'); // Asegúrate de tener este handler en main.js
        const colegioSelect = document.getElementById('new-colegio');
        colegioSelect.innerHTML = '<option value="">Seleccionar Colegio</option>'; // Limpiar opciones
        colegios.forEach(colegio => {
            const option = document.createElement('option');
            option.value = colegio.nombre; // Asegúrate de que el nombre sea el correcto
            option.textContent = colegio.nombre;
            colegioSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading colegios:', error);
    }
}

// Llama a esta función cuando se abra el modal de agregar producto
addProductBtn.addEventListener('click', () => {
    document.getElementById('add-product-modal').classList.remove('hidden');
    updateColegiosSelect(); // Cargar colegios al abrir el modal
    
});



// Actualizar lista de categorías al seleccionar colegio
document.getElementById('update-colegio').addEventListener('change', async () => {
    const colegio = document.getElementById('update-colegio').value;
    if (colegio) {
        // Llenar categorías
        await updateCategorias(colegio);
        document.getElementById('category-container').classList.remove('hidden');
    } else {
        // Limpiar y ocultar categorías y prendas si no hay colegio seleccionado
        document.getElementById('category-container').classList.add('hidden');
        document.getElementById('prenda-container').classList.add('hidden');
    }
});



async function updateCategorias(colegio) {
    try {
        const categorias = await ipcRenderer.invoke('get-categorias', { colegio });
        const tipoSelect = document.getElementById('update-tipo');
        tipoSelect.innerHTML = '<option value="">Seleccionar Categoría</option>'; // Limpiar opciones

        categorias.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            tipoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}



const GestioBtn = document.getElementById('gestion-productos-btn');



GestioBtn.addEventListener('click', async () => {
    console.log('Botón de gestión de productos clickeado');

    mainContainer.classList.add('hidden');
    gestionContainer.classList.remove('hidden');

    setTimeout(() => {

        mainContainer.classList.add('hidden');
        gestionContainer.classList.remove('hidden'); 
        gestionContainer.classList.add('slide-in2');

    }, ); 
    await loadInventory();
});


const LogOutFromInv = document.getElementById('logout-btn-inv');

LogOutFromInv.addEventListener('click', async () => {
    setTimeout(() => {
        
        loginContainer.classList.add('slide-in2');
         // Ocultar después de la animación
        gestionContainer.classList.remove('slide-in2'); // Mostrar el contenedor principal
        
    }, 100);
    gestionContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    
});


backToMenu.addEventListener('click', async () =>{
    gestionContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
});


document.getElementById('download-report-btn').addEventListener('click', async () => {
    try {
        const reportData = await ipcRenderer.invoke('get-reports'); // Asegúrate de que esta función obtenga los datos necesarios
        const response = await ipcRenderer.invoke('generate-report-excel', reportData);
        
        if (response.success) {
            showNotification('Reporte generado exitosamente. Puedes encontrarlo en la carpeta de reportes.');
            // Abre el archivo PDF generado
            const { shell } = require('electron');
            shell.openPath(response.path); // Abre el archivo PDF generado
        } else {
            showNotification('Error al generar el reporte.');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('Error al generar el reporte.');
    }
});



document.getElementById('download-excel-btn').addEventListener('click', async () => {
       console.log('Botón de descarga de costos clickeado'); // Log para verificar el click
        try {
           const response = await ipcRenderer.invoke('generate-cost-reports'); // Generar reporte
            
            if (response.success) {
                showNotification('Reporte generado exitosamente. Puedes encontsrarlo en la carpeta de reportes.');
                const { shell } = require('electron');
               shell.openPath(response.path); // Abrir el archivo generado
            } else {
               showNotification('Error al generar el reporte: '); // Mostrar error
            }
        } catch (error) {
            console.error('Error generando el reporte.');
            showNotification('Error al generar el reporte.');
        }
});


// Función para mostrar el modal de detalles del reporte
function showReportDetails(reportData) {
    const modal = document.getElementById('report-details-modal');
    const detailsContainer = document.getElementById('details-content');

    // Limpiar detalles previos
    detailsContainer.innerHTML = '';

    // Agregar detalles de los movimientos de stock
    if (reportData.movements.length === 0) {
        const noMovementsMessage = document.createElement('p');
        noMovementsMessage.textContent = 'El reporte se descargará como archivo Excel y se abrirá automaticamente';
        detailsContainer.appendChild(noMovementsMessage);
    } else {
            const detail = document.createElement('p');
            detail.textContent = `El reporte se descargará como archivo Excel y se abrirá automaticamente`;
            detailsContainer.appendChild(detail);
    }

    // Mostrar el modal
    modal.classList.remove('hidden');
}


// Evento para cerrar el modal
document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        modal.classList.add('hidden'); // Ocultar el modal
    });
});


const searchInput = document.getElementById('search-input');
const suggestionsContainer = document.getElementById('suggestions-container');

// Evento para manejar la entrada en el campo de búsqueda
searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
        // Llamar a la función para buscar productos
        const results = await searchProducts(query);
        displaySuggestions(results);
    } else {
        suggestionsContainer.innerHTML = ''; // Limpiar sugerencias si no hay entrada
        suggestionsContainer.classList.add('hidden');
    }
});

// Función para buscar productos en la base de datos
async function searchProducts(query) {
    try {
        const response = await ipcRenderer.invoke('search-products', query);
        return response; // Asegúrate de que esta función devuelva un array de productos
    } catch (error) {
        console.error('Error searching products:', error);
        return []; // Devuelve un array vacío en caso de error
    }
}

// Evento para manejar la entrada en el campo de búsqueda
searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    if (query.length > 0) {
        // Llamar a la función para buscar productos
        const results = await searchProducts(query);
        displaySuggestions(results);
    } else {
        suggestionsContainer.innerHTML = ''; // Limpiar sugerencias si no hay entrada
        suggestionsContainer.classList.add('hidden');
    }
});



function displaySuggestions(products) {
    const suggestionsContainer = document.getElementById('suggestions-container');
    suggestionsContainer.innerHTML = ''; // Limpiar sugerencias previas

    if (products.length > 0) {
        products.forEach(product => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = `${product.colegio} - ${product.prenda}`;
            suggestionItem.addEventListener('click', () => {
                // Lógica para mostrar el modal con detalles del producto
                showProductDetails(product);
                suggestionsContainer.classList.add('hidden'); // Ocultar sugerencias al seleccionar
            });
            suggestionsContainer.appendChild(suggestionItem);
        });
        suggestionsContainer.classList.remove('hidden'); // Mostrar la lista de sugerencias
    } else {
        suggestionsContainer.classList.add('hidden'); // Ocultar si no hay resultados
    }
}


const searchBar = document.getElementById('suggestions-container');


// Evento para ocultar sugerencias al perder el foco
searchBar.addEventListener('blur', () => {
    setTimeout(() => {
        suggestionsContainer.classList.add('hidden'); // Ocultar sugerencias
    }); // Usar un timeout para permitir que el clic en la sugerencia se registre
});

searchBar.addEventListener('focus', () => {
    if (suggestionsContainer.innerHTML !== '') {
        suggestionsContainer.classList.add('hidden'); // Mostrar sugerencias si hay
    }
});



// Función para mostrar los detalles del producto en el modal
function showProductDetails(product) {
    document.getElementById('modal-product-name').textContent = product.prenda;
    document.getElementById('modal-colegio').textContent = product.colegio;
    document.getElementById('modal-categoria').textContent = product.categoria;
    document.getElementById('modal-talla').textContent = product.talla;
    document.getElementById('modal-cantidad').textContent = product.cantidad;

    // Mostrar el modal
    document.getElementById('product-details-modal').classList.remove('hidden');
}

// Cerrar el modal al hacer clic en el botón de cerrar
document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        modal.classList.add('hidden'); // Ocultar el modal
    });
});


document.getElementById('save-stock-btn').addEventListener('click', async () => {
    const colegio = document.getElementById('modal-colegio').textContent; // Obtener el colegio del modal
    const categoria = document.getElementById('modal-categoria').textContent; // Obtener la categoría del modal
    const prenda = document.getElementById('modal-product-name').textContent; // Obtener la prenda del modal
    const talla = document.getElementById('modal-talla').textContent; // Obtener la talla del modal
    const cantidadActual = parseInt(document.getElementById('modal-cantidad').textContent); // Obtener la cantidad actual
    const nuevaCantidad = parseInt(document.getElementById('update-cantidad').value); // Obtener la nueva cantidad ingresada
    const tipoMovimiento = document.querySelector('input[name="tipo-mov"]:checked').value; // Obtener el tipo de movimiento

    // Verificar que todos los campos necesarios estén seleccionados
    if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
        showNotification('Por favor, ingrese una cantidad válida.');
        return;
    }

    const updateData = {
        colegio,
        prenda,
        cantidad: nuevaCantidad,
        tipo: categoria, // Asumiendo que la categoría es necesaria
        tipomov: tipoMovimiento,
        talla,
        isAdmin: true // O false, dependiendo de si es admin o no
    };

    try {
        const response = await ipcRenderer.invoke('update-stock', updateData);
        if (response.success) {
            showNotification('Stock actualizado correctamente.');
            document.getElementById('product-details-modal').classList.add('hidden'); // Cerrar el modal
            await loadInventory(); // Recargar el inventario
        } else {
            showNotification(response.message);
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showNotification('Error al actualizar el stock.');
    }
});




// Mostrar los detalles del producto en el modal
function showProductDetails(product) {
    document.getElementById('modal-product-name').textContent = product.prenda;
    document.getElementById('modal-colegio').textContent = product.colegio;
    document.getElementById('modal-categoria').textContent = product.categoria;
    document.getElementById('modal-talla').textContent = product.talla;
    document.getElementById('modal-cantidad').textContent = product.cantidad;

    // Mostrar el modal
    document.getElementById('product-details-modal').classList.remove('hidden');

    // Agregar eventos a los botones
    document.getElementById('open-update-modal').onclick = () => {
        openUpdateModal(product); // Llama a la función para abrir el modal de actualización
    };

    document.getElementById('open-delete-modal').onclick = () => {
        openDeleteModal(product); // Llama a la función para abrir el modal de eliminación
    };
}

// Función para abrir el modal de actualización
function openUpdateModal(product) {
    // Aquí puedes llenar los campos del modal de actualización con los detalles del producto
    document.getElementById('update-colegio').value = product.colegio;
    document.getElementById('update-tipo').value = product.categoria;
    document.getElementById('update-prenda').value = product.prenda;
    document.getElementById('update-talla').value = product.talla;
    document.getElementById('update-cantidad').value = product.cantidad; // Cantidad actual

    // Mostrar el modal de actualización
    document.getElementById('update-stock-modal').classList.remove('hidden');
}

// Función para abrir el modal de eliminación
function openDeleteModal(product) {
    // Mostrar detalles del producto en el modal de eliminación
    document.getElementById('delete-colegio').textContent = product.colegio;
    document.getElementById('delete-tipo').textContent = product.categoria;
    document.getElementById('delete-prenda').textContent = product.prenda;
    document.getElementById('delete-talla').textContent = product.talla;

    // Mostrar el modal de confirmación de eliminación
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
}


const openColegiosBtn = document.getElementById('open-colegios-btn');
const colegiosContainer = document.getElementById('colegios-container');
const backToMainBtncol = document.getElementById('back-to-menu-colegios');

// Evento para abrir la interfaz de colegios
openColegiosBtn.addEventListener('click', async () => {
    console.log('Botón de colegios clickeado');
    colegiosContainer.classList.remove('hidden'); // Mostrar el contenedor de colegios
    mainContainer.classList.add('hidden'); // Ocultar el contenedor principal
    await loadColegios(); // Cargar colegios al abrir la interfaz
});

// Evento para volver al menú principal
backToMainBtncol.addEventListener('click', () => {
    colegiosContainer.classList.add('hidden'); // Ocultar el contenedor de colegios
    mainContainer.classList.remove('hidden'); // Mostrar el contenedor principal
});

// Función para cargar colegios
async function loadColegios() {
    try {
        const colegios = await ipcRenderer.invoke('get-colegios'); // Asegúrate de tener este handler en main.js
        const colegiosList = document.getElementById('colegios-list');
        colegiosList.innerHTML = ''; // Limpiar la lista antes de llenarla

        colegios.forEach(colegio => {
            const colegioItem = document.createElement('div');
            colegioItem.className = 'colegio-item';
            colegioItem.textContent = colegio.nombre; // Asegúrate de que el nombre sea el correcto
            colegiosList.appendChild(colegioItem);
        });
    } catch (error) {
        console.error('Error loading colegios:', error);
    }
}
