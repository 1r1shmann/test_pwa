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

// --- ЛОГИКА СКАНЕРА (Интегрированная из вашего примера) ---

async function startScanning() {
    if (isScanning) return;

    // Инициализируем сканер только если он еще не создан
    if (!html5QrCode) {
        try {
            // Убедитесь, что Html5Qrcode доступен глобально из html5-qrcode.min.js
            if (typeof Html5Qrcode === 'undefined') {
                throw new Error('Библиотека html5-qrcode не загружена');
            }
            html5QrCode = new Html5Qrcode("reader");
        } catch (err) {
            showStatus('❌ Ошибка инициализации библиотеки сканера', 'error');
            console.error(err);
            return;
        }
    }

    try {
        cameraContainer.style.display = 'block';
        isScanning = true;
        showStatus('📷 Камера активна. Наведите на DataMatrix...', 'info');

        await html5QrCode.start(
            {
                facingMode: { exact: "environment" } // Используем заднюю камеру
            },
            {
                fps: 15,
                qrbox: (width, height) => {
                    // Квадратная область сканирования, как в вашем примере
                    let size = Math.min(width, height) * 0.8;
                    return { width: size, height: size };
                },
                aspectRatio: 1.0,
                disableFlip: false,
                // ВАЖНО: Поддержка именно DataMatrix для маркировки
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.QR_CODE, // На всякий случай оставим и QR
                    Html5QrcodeSupportedFormats.EAN_13,  // И обычные штрихкоды
                    Html5QrcodeSupportedFormats.CODE_128
                ]
            },
            onScanSuccess,
            onScanFailure
        );

    } catch (err) {
        console.error('Ошибка запуска камеры:', err);
        showStatus('❌ Не удалось запустить камеру. Проверьте разрешения.', 'error');
        cameraContainer.style.display = 'none';
        isScanning = false;
    }
}

async function stopScanning() {
    if (!html5QrCode || !isScanning) return;
    
    try {
        await html5QrCode.stop();
        // clear() может вызывать ошибки в некоторых версиях, поэтому используем осторожно
        // await html5QrCode.clear(); 
    } catch (err) {
        console.error('Ошибка остановки:', err);
    }
    
    cameraContainer.style.display = 'none';
    isScanning = false;
    showStatus('📷 Сканирование остановлено', 'info');
}

function onScanSuccess(decodedText, decodedResult) {
    const sgtin = decodedText.trim();
    if (sgtin.length > 0) {
        // Вибрация при успехе
        if (navigator.vibrate) navigator.vibrate(100);
        
        stopScanning();
        processSGTIN(sgtin);
    }
}

function onScanFailure(error) {
    // Игнорируем ошибки сканирования (когда код не найден в кадре)
}

// --- КОНЕЦ ЛОГИКИ СКАНЕРА ---

// Обработка SGTIN
function processSGTIN(sgtin) {
    showStatus(`🔍 Поиск SGTIN: ${sgtin}`, 'info');
    
    const inStore = database.store.find(item => item.SGTIN === sgtin);
    const inSales = database.sales.find(item => item.SGTIN === sgtin);
    
    if (inStore) {
        showConfirm(
            'Продажа лекарства',
            `Найдено в запасах:<br><strong>${inStore.name}</strong><br>SGTIN: ${sgtin}<br><br>Перевести в продажи?`,
            () => {
                database.store = database.store.filter(item => item.SGTIN !== sgtin);
                database.sales.push(inStore);
                updateCounts();
                saveFile(false);
                showStatus(`✅ Продано: ${inStore.name}`, 'success');
            }
        );
    } else if (inSales) {
        showConfirm(
            'Возврат лекарства',
            `Найдено в продажах:<br><strong>${inSales.name}</strong><br>SGTIN: ${sgtin}<br><br>Вернуть в запасы?`,
            () => {
                database.sales = database.sales.filter(item => item.SGTIN !== sgtin);
                database.store.push(inSales);
                updateCounts();
                saveFile(false);
                showStatus(`↩️ Возвращено: ${inSales.name}`, 'success');
            }
        );
    } else {
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
        storeBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Запасы пусты</td></tr>';
    } else {
        database.store.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="sgtin-code">${item.SGTIN}</td>
                <td>${item.name}</td>
                <td><button class="btn btn-warning" onclick="sellItem(${index})">💰 Продать</button></td>
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
        salesBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Продаж пока нет</td></tr>';
    } else {
        database.sales.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="sgtin-code">${item.SGTIN}</td>
                <td>${item.name}</td>
                <td><button class="btn btn-info" onclick="returnItem(${index})">↩️ Вернуть</button></td>
            `;
            salesBody.appendChild(row);
        });
    }
    salesView.style.display = 'block';
    storeView.style.display = 'none';
}

// Глобальные функции для кнопок в таблице
window.sellItem = function(index) {
    const item = database.store[index];
    showConfirm('Продажа', `<strong>${item.name}</strong><br>Подтверждаете продажу?`, () => {
        database.store.splice(index, 1);
        database.sales.push(item);
        updateCounts();
        saveFile(false);
        showStore();
        showStatus(`✅ Продано: ${item.name}`, 'success');
    });
};

window.returnItem = function(index) {
    const item = database.sales[index];
    showConfirm('Возврат', `<strong>${item.name}</strong><br>Подтверждаете возврат?`, () => {
        database.sales.splice(index, 1);
        database.store.push(item);
        updateCounts();
        saveFile(false);
        showSales();
        showStatus(`↩️ Возвращено: ${item.name}`, 'success');
    });
};

// Event listeners
btnOpen.addEventListener('click', openFile);
btnSave.addEventListener('click', () => saveFile(true));
btnScan.addEventListener('click', startScanning);
btnStopScan.addEventListener('click', stopScanning);
btnViewStore.addEventListener('click', showStore);
btnViewSales.addEventListener('click', showSales);
btnManualSubmit.addEventListener('click', handleManualInput);

document.getElementById('btnCloseStore').addEventListener('click', () => storeView.style.display = 'none');
document.getElementById('btnCloseSales').addEventListener('click', () => salesView.style.display = 'none');

btnConfirmYes.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeModal();
});

btnConfirmNo.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);

window.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeModal();
});

window.addEventListener('beforeunload', (e) => {
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
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW error:', err));
    });
}
