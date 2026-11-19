// Глобальные переменные
let fileHandle = null;
let database = {
    store: [],
    sales: []
};
let html5QrCode = null;
let isScanning = false;
let confirmCallback = null;

// DOM элементы
const btnOpen = document.getElementById('btnOpen');
const btnSave = document.getElementById('btnSave');
const btnScan = document.getElementById('btnScan');
const btnViewStore = document.getElementById('btnViewStore');
const btnViewSales = document.getElementById('btnViewSales');
const statusDiv = document.getElementById('status');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const btnStopScan = document.getElementById('btnStopScan');
const sgtinInput = document.getElementById('sgtinInput');
const btnManualSubmit = document.getElementById('btnManualSubmit');
const storeView = document.getElementById('storeView');
const salesView = document.getElementById('salesView');
const storeBody = document.getElementById('storeBody');
const salesBody = document.getElementById('salesBody');
const storeCount = document.getElementById('storeCount');
const salesCount = document.getElementById('salesCount');
const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const btnConfirmYes = document.getElementById('btnConfirmYes');
const btnConfirmNo = document.getElementById('btnConfirmNo');
const closeBtn = document.querySelector('.close');

// Показать сообщение
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'autosave') {
        setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.textContent = '';
                statusDiv.className = 'status';
            }
        }, 5000);
    }
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

// Открыть JSON файл базы данных
async function openFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'JSON Database Files',
                accept: { 'application/json': ['.json'] }
            }]
        });
        
        fileHandle = handle;
        const file = await fileHandle.getFile();
        const content = await file.text();
        
        database = JSON.parse(content);
        
        // Валидация структуры
        if (!database.store || !Array.isArray(database.store)) {
            database.store = [];
        }
        if (!database.sales || !Array.isArray(database.sales)) {
            database.sales = [];
        }
        
        updateCounts();
        enableButtons();
        showStatus(`✅ База загружена: ${database.store.length} в запасах, ${database.sales.length} в продажах`, 'success');
        
        // Автосохранение включено по умолчанию
        showStatus('💾 Автосохранение активно', 'autosave');
        
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Ошибка открытия файла:', err);
            showStatus('❌ Ошибка открытия файла: ' + err.message, 'error');
        }
    }
}

// Сохранить изменения
async function saveFile(showNotification = true) {
    if (!fileHandle) {
        showStatus('❌ Сначала откройте файл базы', 'error');
        return false;
    }
    
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(database, null, 2));
        await writable.close();
        
        if (showNotification) {
            showStatus('✅ База успешно сохранена!', 'success');
        }
        
        return true;
        
    } catch (err) {
        console.error('Ошибка сохранения:', err);
        showStatus('❌ Ошибка сохранения: ' + err.message, 'error');
        return false;
    }
}

// Обновить счетчики
function updateCounts() {
    storeCount.textContent = database.store.length;
    salesCount.textContent = database.sales.length;
}

// Включить кнопки
function enableButtons() {
    btnSave.disabled = false;
    btnScan.disabled = false;
    btnViewStore.disabled = false;
    btnViewSales.disabled = false;
}

// Инициализация сканера
async function initScanner() {
    try {
        html5QrCode = new Html5Qrcode("video");
    } catch (err) {
        console.error('Ошибка инициализации сканера:', err);
        showStatus('❌ Не удалось инициализировать сканер', 'error');
    }
}

// Начать сканирование
async function startScanning() {
    if (!html5QrCode) {
        await initScanner();
    }
    
    try {
        cameraContainer.style.display = 'block';
        isScanning = true;
        
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 150 }
            },
            onScanSuccess,
            onScanFailure
        );
        
        showStatus('📷 Камера активна. Наведите на штрихкод', 'info');
        
    } catch (err) {
        console.error('Ошибка запуска камеры:', err);
        showStatus('❌ Не удалось запустить камеру: ' + err.message, 'error');
        cameraContainer.style.display = 'none';
        isScanning = false;
    }
}

// Остановить сканирование
async function stopScanning() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.error('Ошибка остановки сканера:', err);
        }
    }
    
    cameraContainer.style.display = 'none';
    isScanning = false;
    showStatus('📷 Камера остановлена', 'info');
}

// Успешное сканирование
function onScanSuccess(decodedText, decodedResult) {
    // Проверяем, что это похоже на SGTIN (цифры и буквы)
    const sgtin = decodedText.trim();
    
    if (sgtin.length > 0) {
        // Останавливаем сканирование после успешного считывания
        stopScanning();
        
        // Обрабатываем SGTIN
        processSGTIN(sgtin);
    }
}

// Ошибка сканирования (игнорируем)
function onScanFailure(error) {
    // Просто игнорируем ошибки сканирования
}

// Обработка SGTIN
function processSGTIN(sgtin) {
    showStatus(`🔍 Поиск SGTIN: ${sgtin}`, 'info');
    
    // Ищем в запасах
    const inStore = database.store.find(item => item.SGTIN === sgtin);
    
    // Ищем в продажах
    const inSales = database.sales.find(item => item.SGTIN === sgtin);
    
    if (inStore) {
        // Есть в запасах - предложить продать
        showConfirm(
            'Продажа лекарства',
            `Найдено в запасах:<br><strong>${inStore.name}</strong><br>SGTIN: ${sgtin}<br><br>Перевести в продажи?`,
            () => {
                // Переместить из запасов в продажи
                database.store = database.store.filter(item => item.SGTIN !== sgtin);
                database.sales.push(inStore);
                updateCounts();
                saveFile(false);
                showStatus(`✅ Продано: ${inStore.name}`, 'success');
            }
        );
    } else if (inSales) {
        // Есть в продажах - предложить вернуть
        showConfirm(
            'Возврат лекарства',
            `Найдено в продажах:<br><strong>${inSales.name}</strong><br>SGTIN: ${sgtin}<br><br>Вернуть в запасы?`,
            () => {
                // Переместить из продаж в запасы
                database.sales = database.sales.filter(item => item.SGTIN !== sgtin);
                database.store.push(inSales);
                updateCounts();
                saveFile(false);
                showStatus(`↩️ Возвращено: ${inSales.name}`, 'success');
            }
        );
    } else {
        // Не найдено нигде
        showStatus(`❌ SGTIN ${sgtin} не найден ни в запасах, ни в продажах`, 'warning');
    }
}

// Показать диалог подтверждения
function showConfirm(title, message, onConfirm) {
    confirmTitle.textContent = title;
    confirmMessage.innerHTML = message;
    confirmCallback = onConfirm;
    confirmModal.style.display = 'block';
}

// Закрыть модальное окно
function closeModal() {
    confirmModal.style.display = 'none';
    confirmCallback = null;
}

// Обработка ручного ввода
function handleManualInput() {
    const sgtin = sgtinInput.value.trim();
    
    if (!sgtin) {
        showStatus('⚠️ Введите SGTIN', 'warning');
        return;
    }
    
    processSGTIN(sgtin);
    sgtinInput.value = '';
}

// Показать запасы
function showStore() {
    storeBody.innerHTML = '';
    
    if (database.store.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center; padding: 20px;">Запасы пусты</td>';
        storeBody.appendChild(row);
    } else {
        database.store.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="sgtin-code">${item.SGTIN}</td>
                <td>${item.name}</td>
                <td>
                    <button class="btn btn-warning" onclick="sellItem(${index})">💰 Продать</button>
                </td>
            `;
            storeBody.appendChild(row);
        });
    }
    
    storeView.style.display = 'block';
    salesView.style.display = 'none';
}

// Показать продажи
function showSales() {
    salesBody.innerHTML = '';
    
    if (database.sales.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center; padding: 20px;">Продаж пока нет</td>';
        salesBody.appendChild(row);
    } else {
        database.sales.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="sgtin-code">${item.SGTIN}</td>
                <td>${item.name}</td>
                <td>
                    <button class="btn btn-info" onclick="returnItem(${index})">↩️ Вернуть</button>
                </td>
            `;
            salesBody.appendChild(row);
        });
    }
    
    salesView.style.display = 'block';
    storeView.style.display = 'none';
}

// Продать товар из таблицы
window.sellItem = function(index) {
    const item = database.store[index];
    showConfirm(
        'Продажа лекарства',
        `<strong>${item.name}</strong><br>SGTIN: ${item.SGTIN}<br><br>Подтверждаете продажу?`,
        () => {
            database.store.splice(index, 1);
            database.sales.push(item);
            updateCounts();
            saveFile(false);
            showStore();
            showStatus(`✅ Продано: ${item.name}`, 'success');
        }
    );
};

// Вернуть товар из таблицы
window.returnItem = function(index) {
    const item = database.sales[index];
    showConfirm(
        'Возврат лекарства',
        `<strong>${item.name}</strong><br>SGTIN: ${item.SGTIN}<br><br>Подтверждаете возврат?`,
        () => {
            database.sales.splice(index, 1);
            database.store.push(item);
            updateCounts();
            saveFile(false);
            showSales();
            showStatus(`↩️ Возвращено: ${item.name}`, 'success');
        }
    );
};

// Event listeners
btnOpen.addEventListener('click', openFile);
btnSave.addEventListener('click', () => saveFile(true));
btnScan.addEventListener('click', startScanning);
btnStopScan.addEventListener('click', stopScanning);
btnViewStore.addEventListener('click', showStore);
btnViewSales.addEventListener('click', showSales);
btnManualSubmit.addEventListener('click', handleManualInput);

document.getElementById('btnCloseStore').addEventListener('click', () => {
    storeView.style.display = 'none';
});

document.getElementById('btnCloseSales').addEventListener('click', () => {
    salesView.style.display = 'none';
});

btnConfirmYes.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    closeModal();
});

btnConfirmNo.addEventListener('click', closeModal);

closeBtn.addEventListener('click', closeModal);

window.addEventListener('click', function(e) {
    if (e.target === confirmModal) {
        closeModal();
    }
});

// Предупреждение при закрытии
window.addEventListener('beforeunload', function(e) {
    if (fileHandle) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Инициализация
checkSupport();

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Вычисляем правильный путь относительно текущей страницы
        const swPath = new URL('service-worker.js', import.meta.url || window.location.href).pathname;
        
        navigator.serviceWorker.register(swPath)
            .then((registration) => {
                console.log('Service Worker зарегистрирован:', registration.scope);
            })
            .catch((error) => {
                // Тихо игнорируем, если файла нет или ошибка сети
                console.log('SW не загружен:', error.message);
            });
    });
}
