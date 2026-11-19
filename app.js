// Глобальные переменные
let fileHandle = null;
let medicines = [];
let editingIndex = null;

// DOM элементы
const btnOpen = document.getElementById('btnOpen');
const btnSave = document.getElementById('btnSave');
const btnAdd = document.getElementById('btnAdd');
const statusDiv = document.getElementById('status');
const tableContainer = document.getElementById('tableContainer');
const tableBody = document.getElementById('tableBody');
const modal = document.getElementById('editModal');
const modalTitle = document.getElementById('modalTitle');
const editForm = document.getElementById('editForm');
const closeBtn = document.querySelector('.close');

// Показать сообщение
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
    }, 5000);
}

// Проверка поддержки API
function checkSupport() {
    if (!('showOpenFilePicker' in window)) {
        showStatus('❌ Ваш браузер не поддерживает FileSystem Access API. Используйте Chrome или Edge.', 'error');
        btnOpen.disabled = true;
        return false;
    }
    return true;
}

// Открыть JSON файл
async function openFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }]
        });
        
        fileHandle = handle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        
        medicines = JSON.parse(content);
        
        if (!Array.isArray(medicines)) {
            throw new Error('Файл должен содержать массив объектов');
        }
        
        renderTable();
        enableButtons();
        showStatus(`✅ Файл загружен: ${medicines.length} записей`, 'success');
        
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Ошибка открытия файла:', err);
            showStatus('❌ Ошибка открытия файла: ' + err.message, 'error');
        }
    }
}

// Сохранить изменения в файл
async function saveFile() {
    if (!fileHandle) {
        showStatus('❌ Сначала откройте файл', 'error');
        return;
    }
    
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(medicines, null, 2));
        await writable.close();
        
        showStatus('✅ Файл успешно сохранен!', 'success');
        
    } catch (err) {
        console.error('Ошибка сохранения:', err);
        showStatus('❌ Ошибка сохранения: ' + err.message, 'error');
    }
}

// Отрисовать таблицу
function renderTable() {
    tableBody.innerHTML = '';
    
    if (medicines.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center; padding: 20px;">Нет данных. Добавьте первое лекарство!</td>';
        tableBody.appendChild(row);
        return;
    }
    
    medicines.forEach((medicine, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${medicine.barcode}</td>
            <td>${medicine.name}</td>
            <td>${medicine.quantity}</td>
            <td>
                <button class="btn btn-edit" onclick="editMedicine(${index})">✏️ Изменить</button>
                <button class="btn btn-danger" onclick="deleteMedicine(${index})">🗑️ Удалить</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    tableContainer.style.display = 'block';
}

// Включить кнопки после загрузки файла
function enableButtons() {
    btnSave.disabled = false;
    btnAdd.disabled = false;
}

// Добавить новое лекарство
function addMedicine() {
    editingIndex = null;
    modalTitle.textContent = 'Добавить лекарство';
    document.getElementById('barcode').value = '';
    document.getElementById('name').value = '';
    document.getElementById('quantity').value = '';
    modal.style.display = 'block';
}

// Редактировать лекарство
function editMedicine(index) {
    editingIndex = index;
    const medicine = medicines[index];
    
    modalTitle.textContent = 'Редактировать лекарство';
    document.getElementById('barcode').value = medicine.barcode;
    document.getElementById('name').value = medicine.name;
    document.getElementById('quantity').value = medicine.quantity;
    
    modal.style.display = 'block';
}

// Удалить лекарство
function deleteMedicine(index) {
    if (confirm('Вы уверены, что хотите удалить это лекарство?')) {
        medicines.splice(index, 1);
        renderTable();
        showStatus('🗑️ Лекарство удалено. Не забудьте сохранить изменения!', 'info');
    }
}

// Обработка формы
editForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const barcode = document.getElementById('barcode').value.trim();
    const name = document.getElementById('name').value.trim();
    const quantity = parseInt(document.getElementById('quantity').value);
    
    const medicine = {
        barcode: barcode,
        name: name,
        quantity: quantity
    };
    
    if (editingIndex !== null) {
        // Редактирование существующего
        medicines[editingIndex] = medicine;
        showStatus('✏️ Лекарство обновлено. Не забудьте сохранить!', 'info');
    } else {
        // Добавление нового
        medicines.push(medicine);
        showStatus('➕ Лекарство добавлено. Не забудьте сохранить!', 'info');
    }
    
    renderTable();
    closeModal();
});

// Закрыть модальное окно
function closeModal() {
    modal.style.display = 'none';
    editForm.reset();
    editingIndex = null;
}

// Закрытие по крестику
closeBtn.addEventListener('click', closeModal);

// Закрытие по клику вне модального окна
window.addEventListener('click', function(e) {
    if (e.target === modal) {
        closeModal();
    }
});

// Event listeners
btnOpen.addEventListener('click', openFile);
btnSave.addEventListener('click', saveFile);
btnAdd.addEventListener('click', addMedicine);

// Инициализация
checkSupport();
