// ============================================================
// INSPECTION.JS — Dashboard + Form + Photo
// ============================================================

// ==================== CONFIGURATION ====================
const WEB_APP_URL = window.CYBERFIRE_WEB_APP_URL 
    || 'https://script.google.com/macros/s/AKfycbxlaLPaN1F2G7DiA4giNotp2G_LTYKoMMbVBRTGdwUp6RJtkm3RsFgih7rw12ZDM1Pm4g/exec';

// ==================== INSPECTION ITEMS ====================
const INSPECTION_ITEMS_BY_TYPE = {
    "CO2": [
        "ตำแหน่งติดตั้งเข้าถึงง่าย ไม่ถูกกีดขวาง",
        "ป้าย/ฉลากชัดเจน ไม่ชำรุด",
        "น้ำหนักถังได้มาตรฐาน (ชั่งเทียบน้ำหนักระบุ) สูญเสียไม่เกิน 10%",
        "สลักนิรภัยและซีลอยู่ในสภาพดี ไม่ชำรุด",
        "สายฉีด/แตรเป่าไม่แตก ไม่อุดตัน",
        "ตัวถังไม่บุบ ไม่รั่วซึม ไม่เป็นสนิม",
        "ฐาน/ขาตั้งมั่นคง ไม่เสียหาย",
        "พร้อมใช้งาน"
    ],
    "BF 2000": [
        "ตำแหน่งติดตั้งเข้าถึงง่าย ไม่ถูกกีดขวาง",
        "ป้าย/ฉลากชัดเจน ไม่ชำรุด",
        "เข็มวัดความดันในเขตสีเขียว (ความดันปกติ)",
        "สลักนิรภัยและซีลอยู่ในสภาพดี ไม่ชำรุด",
        "สายฉีด/หัวฉีดไม่อุดตัน ไม่ชำรุด",
        "ตัวถังไม่บุบ ไม่รั่วซึม ไม่เป็นสนิม",
        "ฐาน/ขาตั้งมั่นคง ไม่เสียหาย",
        "พร้อมใช้งาน"
    ],
    "HALOTRION": [
        "ตำแหน่งติดตั้งเข้าถึงง่าย ไม่ถูกกีดขวาง",
        "ป้าย/ฉลากชัดเจน ไม่ชำรุด",
        "เข็มวัดความดันในเขตสีเขียว (ความดันปกติ)",
        "สลักนิรภัยและซีลอยู่ในสภาพดี ไม่ชำรุด",
        "สายฉีด/หัวฉีดไม่อุดตัน ไม่ชำรุด",
        "ตัวถังไม่บุบ ไม่รั่วซึม ไม่เป็นสนิม",
        "ฐาน/ขาตั้งมั่นคง ไม่เสียหาย",
        "พร้อมใช้งาน"
    ],
    "FORM": [
        "ตำแหน่งติดตั้งเข้าถึงง่าย ไม่ถูกกีดขวาง",
        "ป้าย/ฉลากชัดเจน ไม่ชำรุด",
        "เข็มวัดความดันในเขตสีเขียว (ความดันปกติ)",
        "สลักนิรภัยและซีลอยู่ในสภาพดี ไม่ชำรุด",
        "สายฉีด/หัวฉีดไม่อุดตัน ไม่ชำรุด",
        "ตัวถังไม่บุบ ไม่รั่วซึม ไม่เป็นสนิม",
        "ฐาน/ขาตั้งมั่นคง ไม่เสียหาย",
        "พร้อมใช้งาน"
    ],
    "_default": [
        "ต้องอยู่ในตำแหน่งที่กำหนด เข้าถึงง่าย ไม่ถูกกีดขวาง",
        "ป้าย/ฉลากชัดเจน ไม่ชำรุด",
        "เข็มวัดความดันก๊าซในเขตสีเขียว (ความดันปกติ)",
        "สลักนิรภัยและซีลอยู่ในสภาพดี ไม่ชำรุด",
        "สายฉีด/หัวฉีดไม่อุดตัน ไม่ชำรุด",
        "ตัวถังไม่บุบ ไม่รั่วซึม ไม่เป็นสนิม",
        "ฐาน/ขาตั้งมั่นคง ไม่เสียหาย",
        "พร้อมใช้งาน"
    ]
};

// ==================== STATE ====================
let itemStatus = [];
let currentInspectionItems = INSPECTION_ITEMS_BY_TYPE["_default"];
let currentTankType = "";
let currentTankData = null;
let isSubmitting = false;
let _inspectionInitialized = false;
let _dashboardData = null;
let _pendingTanks = [];
let dashPieChart = null;
let dashBarChart = null;
let _inspectionPhotoBase64 = '';

// ==================== UTILITY ====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[m];
    });
}

function formatTankId(tankId) {
    if (!tankId) return '';
    let id = String(tankId).trim();
    let numbers = id.match(/\d+/g);
    if (!numbers) return id;
    let numStr = numbers[numbers.length - 1];
    let num = parseInt(numStr, 10);
    if (isNaN(num)) return id;
    return num.toString().padStart(4, '0');
}

function getInspectionItemsForType(tankType) {
    if (!tankType) return INSPECTION_ITEMS_BY_TYPE["_default"];
    
    const normalized = String(tankType).trim();
    if (INSPECTION_ITEMS_BY_TYPE[normalized]) {
        return INSPECTION_ITEMS_BY_TYPE[normalized];
    }
    
    const upper = normalized.toUpperCase();
    const aliasMap = {
        'BF2000': 'BF 2000',
        'BF-2000': 'BF 2000',
        'HALITRON': 'HALOTRION',
        'HALOTRON': 'HALOTRION',
        'FOAM': 'FORM',
        'CO₂': 'CO2'
    };
    
    const aliased = aliasMap[upper];
    if (aliased && INSPECTION_ITEMS_BY_TYPE[aliased]) {
        return INSPECTION_ITEMS_BY_TYPE[aliased];
    }
    
    return INSPECTION_ITEMS_BY_TYPE["_default"];
}

const THAI_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
                    'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ==================== API (POST) ====================
async function callApi(action, data = {}) {
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...data })
        });
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const result = await response.json();
        console.log(`📥 ${action}:`, result);
        return result;
    } catch (error) {
        console.error(`❌ API Error (${action})`, error);
        return { success: false, error: error.message };
    }
}

// ==================== VIEW SWITCHING ====================
function showDashboard() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById('dashboardView').classList.add('active-view');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadDashboard();
}

function showForm(tankId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById('formView').classList.add('active-view');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    resetForm();
    
    if (tankId) {
        const input = document.getElementById('tankIdInput');
        if (input) {
            input.value = formatTankId(tankId);
            onTankIdChange();
        }
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        const startTime = Date.now();
        const result = await callApi('getInspectionDashboard');
        console.log(`⚡ Dashboard โหลดเสร็จใน ${Date.now() - startTime}ms`);
        
        let summary, byFactory, year, month;
        
        if (result?.success && result.summary) {
            summary = result.summary;
            byFactory = result.byFactory || [];
            year = result.year;
            month = result.month;
            _dashboardData = result;
        } else {
            summary = { total: 0, inspected: 0, pending: 0, abnormal: 0 };
            byFactory = [];
            year = new Date().getFullYear() + 543;
            month = THAI_MONTH[new Date().getMonth()];
        }
        
        document.getElementById('dashTotal').textContent = summary.total || 0;
        document.getElementById('dashInspected').textContent = summary.inspected || 0;
        document.getElementById('dashPending').textContent = summary.pending || 0;
        document.getElementById('dashAbnormal').textContent = summary.abnormal || 0;
        document.getElementById('pendingBadge').textContent = summary.pending || 0;
        document.getElementById('abnormalBadge').textContent = summary.abnormal || 0;
        document.getElementById('dashMonth').textContent = `${month} ${year}`;
        
        renderDashCharts(summary, byFactory);
        
    } catch (e) {
        console.error('loadDashboard error:', e);
    }
}

function renderDashCharts(summary, byFactory) {
    const canvas1 = document.getElementById('dashPieChart');
    if (canvas1) {
        if (dashPieChart) dashPieChart.destroy();
        
        const ctx1 = canvas1.getContext('2d');
        dashPieChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['ตรวจแล้ว', 'ยังไม่ตรวจ', 'ผิดปกติ'],
                datasets: [{
                    data: [summary.inspected || 0, summary.pending || 0, summary.abnormal || 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#dc2626'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#1e40af',
                            font: { size: 12, weight: '600' },
                            padding: 10,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    const canvas2 = document.getElementById('dashBarChart');
    if (canvas2) {
        if (dashBarChart) dashBarChart.destroy();
        
        const labels = (byFactory && byFactory.length > 0)
            ? byFactory.map(f => f.name)
            : ['ยังไม่มีข้อมูล'];
        
        const inspectedData = (byFactory && byFactory.length > 0)
            ? byFactory.map(f => f.inspected)
            : [0];
        
        const pendingData = (byFactory && byFactory.length > 0)
            ? byFactory.map(f => f.pending)
            : [0];
        
        const ctx2 = canvas2.getContext('2d');
        dashBarChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ตรวจแล้ว',
                        data: inspectedData,
                        backgroundColor: '#10b981',
                        borderRadius: 8
                    },
                    {
                        label: 'ยังไม่ตรวจ',
                        data: pendingData,
                        backgroundColor: '#f59e0b',
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: { stacked: true, ticks: { color: '#1e40af', font: { size: 11, weight: '600' } } },
                    y: { stacked: true, beginAtZero: true, ticks: { color: '#1e40af', font: { size: 11 } } }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#1e40af', font: { size: 12, weight: '600' } }
                    }
                }
            }
        });
    }
}

// ==================== PENDING MODAL ====================
async function openPendingModal() {
    const modal = document.getElementById('pendingModal');
    const list = document.getElementById('pendingList');
    
    modal.classList.add('active');
    list.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-pulse"></i> กำลังโหลด...</div>';
    
    try {
        const result = await callApi('getPendingTanks');
        
        if (!result?.success) {
            list.innerHTML = '<div style="text-align:center;color:#dc2626;padding:20px;">❌ โหลดไม่สำเร็จ</div>';
            return;
        }
        
        _pendingTanks = result.tanks || [];
        document.getElementById('pendingCount').textContent = _pendingTanks.length;
        
        if (_pendingTanks.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px;color:#10b981;">
                    <i class="fas fa-check-circle" style="font-size:3rem;margin-bottom:10px;"></i>
                    <div style="font-size:1.1rem;font-weight:700;">ตรวจครบทุกถังแล้ว! 🎉</div>
                </div>
            `;
            return;
        }
        
        list.innerHTML = _pendingTanks.map(tank => `
            <div class="tank-item">
                <div class="tank-item-info">
                    <div class="tank-item-id">
                        <strong>${escapeHtml(tank.id)}</strong>
                        <span class="tank-item-type">${escapeHtml(tank.type)}</span>
                        <span class="tank-item-size">${escapeHtml(tank.size)}</span>
                    </div>
                    <div class="tank-item-loc">
                        <i class="fas fa-map-marker-alt"></i>
                        ${escapeHtml(tank.factory)} · ${escapeHtml(tank.zone)} · ${escapeHtml(tank.location)}
                    </div>
                </div>
                <button class="tank-item-btn" onclick="closePendingModal(); showForm('${tank.id}');">
                    <i class="fas fa-camera"></i> ไปตรวจถังนี้
                </button>
            </div>
        `).join('');
        
    } catch (e) {
        list.innerHTML = '<div style="text-align:center;color:#dc2626;padding:20px;">❌ ' + e.message + '</div>';
    }
}

function closePendingModal() {
    document.getElementById('pendingModal').classList.remove('active');
}

// ==================== ABNORMAL MODAL ====================
function openAbnormalModal() {
    const modal = document.getElementById('abnormalModal');
    const list = document.getElementById('abnormalList');
    
    modal.classList.add('active');
    
    const abnormal = _dashboardData?.abnormalList || [];
    
    if (abnormal.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:40px;color:#10b981;">
                <i class="fas fa-check-circle" style="font-size:3rem;margin-bottom:10px;"></i>
                <div style="font-size:1.1rem;font-weight:700;">ไม่มีรายการผิดปกติ 🎉</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = abnormal.map(item => `
        <div class="tank-item abnormal">
            <div class="tank-item-info">
                <div class="tank-item-id">
                    <strong>${escapeHtml(item.id)}</strong>
                </div>
                <div class="tank-item-loc">
                    <i class="fas fa-exclamation-circle"></i>
                    ${escapeHtml(item.note || '-')}
                </div>
                <div class="tank-item-date">${escapeHtml(item.date || '-')}</div>
            </div>
        </div>
    `).join('');
}

function closeAbnormalModal() {
    document.getElementById('abnormalModal').classList.remove('active');
}

// ==================== PHOTO CAPTURE ====================
function clearInspectionPhoto(event) {
    if (event) event.stopPropagation();
    _inspectionPhotoBase64 = '';
    
    const box = document.getElementById('inspectionPhotoPreview');
    if (box) {
        box.classList.remove('has-image');
        box.innerHTML = `
            <i class="fas fa-camera"></i>
            <span>คลิกเพื่อถ่ายรูป</span>
            <small>JPG, PNG · ไม่เกิน 10 MB</small>
        `;
    }
    
    const fileInput = document.getElementById('inspectionPhotoFile');
    if (fileInput) fileInput.value = '';
    
    const clearBtn = document.getElementById('clearPhotoBtn');
    if (clearBtn) clearBtn.style.display = 'none';
}

function handleInspectionPhotoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
        alert(`❌ ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(2)} MB)\nกรุณาเลือกไฟล์ไม่เกิน 10 MB`);
        event.target.value = '';
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('❌ กรุณาเลือกไฟล์รูปภาพ (JPG, PNG)');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        _inspectionPhotoBase64 = ev.target.result;
        
        const box = document.getElementById('inspectionPhotoPreview');
        box.classList.add('has-image');
        box.innerHTML = `<img src="${_inspectionPhotoBase64}" alt="Preview">`;
        
        const clearBtn = document.getElementById('clearPhotoBtn');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    };
    reader.onerror = () => alert('❌ ไม่สามารถอ่านไฟล์ได้');
    reader.readAsDataURL(file);
}

// ==================== BUILD RADIO ====================
function buildRadioInspectionList(tankType) {
    const container = document.getElementById('inspectionRadioList');
    if (!container) return;
    
    currentTankType = tankType || '';
    currentInspectionItems = getInspectionItemsForType(tankType);
    itemStatus = new Array(currentInspectionItems.length).fill('normal');
    
    container.innerHTML = '';
    
    const isDefault = !tankType || currentInspectionItems === INSPECTION_ITEMS_BY_TYPE["_default"];
    
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = `
        background: ${isDefault ? '#FFF1D6' : '#E9F4E9'};
        padding: 10px 20px;
        border-radius: 32px;
        margin-bottom: 14px;
        font-size: 0.85rem;
        color: ${isDefault ? '#8B6A2E' : '#1F673A'};
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        border-left: 4px solid ${isDefault ? '#E5862E' : '#2A6B3C'};
    `;
    headerDiv.innerHTML = `
        <span>📋 รายการตรวจสอบสำหรับ: <strong>${escapeHtml(tankType || 'ทั่วไป (Default)')}</strong></span>
        <span style="font-size:0.75rem;">(${currentInspectionItems.length} ข้อ)</span>
    `;
    container.appendChild(headerDiv);
    
    currentInspectionItems.forEach((item, idx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'inspection-item';
        
        const textSpan = document.createElement('div');
        textSpan.className = 'item-text';
        textSpan.innerText = `${idx + 1}. ${item}`;
        
        const radioGroup = document.createElement('div');
        radioGroup.className = 'radio-group';
        
        const normalLabel = document.createElement('label');
        const normalRadio = document.createElement('input');
        normalRadio.type = 'radio';
        normalRadio.name = `inspect_${idx}`;
        normalRadio.value = 'normal';
        normalRadio.checked = true;
        normalRadio.addEventListener('change', () => {
            if (normalRadio.checked) {
                itemStatus[idx] = 'normal';
                updateBadge(rowDiv, idx);
            }
        });
        normalLabel.appendChild(normalRadio);
        normalLabel.appendChild(document.createTextNode(' ปกติ'));
        
        const abnormalLabel = document.createElement('label');
        const abnormalRadio = document.createElement('input');
        abnormalRadio.type = 'radio';
        abnormalRadio.name = `inspect_${idx}`;
        abnormalRadio.value = 'abnormal';
        abnormalRadio.addEventListener('change', () => {
            if (abnormalRadio.checked) {
                itemStatus[idx] = 'abnormal';
                updateBadge(rowDiv, idx);
            }
        });
        abnormalLabel.appendChild(abnormalRadio);
        abnormalLabel.appendChild(document.createTextNode(' ผิดปกติ'));
        
        radioGroup.appendChild(normalLabel);
        radioGroup.appendChild(abnormalLabel);
        
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge';
        statusBadge.style.backgroundColor = '#DFF0E2';
        statusBadge.style.color = '#1F673A';
        statusBadge.innerText = '✓ ปกติ';
        
        rowDiv.appendChild(textSpan);
        rowDiv.appendChild(radioGroup);
        rowDiv.appendChild(statusBadge);
        
        rowDiv._badge = statusBadge;
        container.appendChild(rowDiv);
    });
    
    const fixSection = document.getElementById('fixNoteSection');
    if (fixSection) {
        fixSection.style.display = 'none';
        const fixInput = document.getElementById('fixNoteInput');
        if (fixInput) fixInput.value = '';
    }
    
    updateSummaryIndicator();
}

function updateBadge(rowDiv, idx) {
    const badge = rowDiv._badge;
    if (!badge) return;
    if (itemStatus[idx] === 'normal') {
        badge.style.backgroundColor = '#DFF0E2';
        badge.style.color = '#1F673A';
        badge.innerText = '✓ ปกติ';
    } else {
        badge.style.backgroundColor = '#FBE4DF';
        badge.style.color = '#B33A28';
        badge.innerText = '⚠️ ผิดปกติ';
    }
    updateSummaryIndicator();
}

function updateSummaryIndicator() {
    const normalCount = itemStatus.filter(s => s === 'normal').length;
    const abnormalCount = itemStatus.length - normalCount;
    const summaryDiv = document.getElementById('summaryIndicator');
    if (!summaryDiv) return;
    
    if (abnormalCount === 0) {
        summaryDiv.innerHTML = '✅ สถานะโดยรวม: ปกติ (ผ่านทุกข้อ)';
        summaryDiv.style.backgroundColor = '#E9F4E9';
        summaryDiv.style.color = '#1F673A';
    } else {
        summaryDiv.innerHTML = `⚠️ สถานะโดยรวม: มีรายการผิดปกติ ${abnormalCount} รายการ`;
        summaryDiv.style.backgroundColor = '#FFEFEB';
        summaryDiv.style.color = '#B33A28';
    }
    
    const fixSection = document.getElementById('fixNoteSection');
    if (fixSection) {
        if (abnormalCount > 0) {
            fixSection.style.display = 'block';
        } else {
            fixSection.style.display = 'none';
            const fixInput = document.getElementById('fixNoteInput');
            if (fixInput) fixInput.value = '';
        }
    }
}

// ==================== LOAD TANK DATA (FAST - POST) ====================
async function onTankIdChange() {
    const tankIdRaw = document.getElementById('tankIdInput').value.trim();
    
    if (!tankIdRaw) {
        resetTankFields();
        buildRadioInspectionList('');
        updateIdStatus('⚠️ กรุณากรอกหมายเลขถัง', 'error');
        return null;
    }
    
    const tankId = formatTankId(tankIdRaw);
    document.getElementById('tankIdInput').value = tankId;
    
    updateIdStatus(`⏳ กำลังโหลด ID: ${tankId} ...`, 'loading');
    
    try {
        const startTime = Date.now();
        
        // ⭐ ใช้ getTankInfo (POST) แทน fetchAllTanks (JSONP)
        const result = await callApi('getTankInfo', { tankId });
        
        console.log(`⚡ โหลดถังเสร็จใน ${Date.now() - startTime}ms`);
        
        if (!result?.success || !result.tank) {
            currentTankData = null;
            resetTankFields();
            buildRadioInspectionList('');
            updateIdStatus(`❌ ไม่พบหมายเลขถัง "${tankId}"`, 'error');
            return null;
        }
        
        // ⭐ แปลง format
        const t = result.tank;
        const record = {
            ID: t.id,
            ลำดับ: t.seq,
            โรงงาน: t.factory,
            โซน: t.zone,
            'จุดติดตั้งถังดับเพลิง': t.location,
            รูปภาพ: t.image,
            ประเภท: t.type,
            'ชนิดที่ดับได้': t.agent,
            'ขนาด(ปอนด์)': t.size,
            เกณฑ์มาตรฐาน: t.standard,
            'หมายเลขวันที่ถัง': t.tankNumber,
            สถานะ: t.status,
            'วันที่ทดสอบล่าสุด': t.lastTestDate,
            'หมายเลขทดสอบ': t.testNumber
        };
        
        currentTankData = record;
        updateFieldsFromTankData(record);
        buildRadioInspectionList(record['ประเภท'] || '');
        
        updateIdStatus(
            `✅ โหลดสำเร็จ: ${tankId} — ${record['ประเภท'] || 'ไม่ระบุ'}`,
            'success'
        );
        return record;
        
    } catch (err) {
        console.error(err);
        updateIdStatus('❌ ข้อผิดพลาดในการเชื่อมต่อ', 'error');
        return null;
    }
}

function updateFieldsFromTankData(record) {
    if (!record) {
        resetTankFields();
        return;
    }
    document.getElementById('sizeField').value = record['ขนาด(ปอนด์)'] || '-';
    document.getElementById('installDateField').value = record['หมายเลขวันที่ถัง'] || '-';
    document.getElementById('responsibleField').value = record['ผู้ตรวจสอบ'] || '-';
}

function resetTankFields() {
    document.getElementById('sizeField').value = '';
    document.getElementById('installDateField').value = '';
    document.getElementById('responsibleField').value = '';
}

function updateIdStatus(msg, type = 'info') {
    const el = document.getElementById('idStatusMsg');
    if (!el) return;
    el.innerHTML = msg;
    el.className = 'id-status-msg ' + (
        type === 'success' ? 'success' :
        type === 'error' ? 'error' :
        type === 'loading' ? 'loading' : ''
    );
}

function updateStatusMessage(msg, color = '#866633') {
    const statusDiv = document.getElementById('statusMsg');
    if (statusDiv) {
        statusDiv.innerHTML = msg;
        statusDiv.style.color = color;
    }
}

// ==================== GPS ====================
function getCurrentLocation() {
    const gpsBtn = document.getElementById('getGpsBtn');
    const originalText = gpsBtn.innerHTML;
    gpsBtn.innerHTML = '📡 กำลังระบุตำแหน่ง...';
    gpsBtn.disabled = true;
    
    if (!navigator.geolocation) {
        alert('เบราว์เซอร์นี้ไม่รองรับ GPS');
        gpsBtn.innerHTML = originalText;
        gpsBtn.disabled = false;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const locationStr = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)} (GPS)`;
            document.getElementById('locationField').value = locationStr;
            updateStatusMessage('📌 อัปเดตพิกัดตำแหน่งปัจจุบันแล้ว', '#2A6B3C');
            gpsBtn.innerHTML = originalText;
            gpsBtn.disabled = false;
        },
        (error) => {
            let errMsg = 'ไม่สามารถระบุตำแหน่งได้';
            if (error.code === 1) errMsg = 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง';
            alert(`GPS Error: ${errMsg}`);
            gpsBtn.innerHTML = originalText;
            gpsBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

// ==================== SUBMIT ====================
async function submitInspection() {
    if (isSubmitting) {
        alert('⏳ กำลังบันทึก กรุณารอสักครู่');
        return;
    }
    
    const tankIdRaw = document.getElementById('tankIdInput').value.trim();
    if (!tankIdRaw) {
        alert('❌ กรุณากรอกหมายเลขถัง (ID) ก่อนบันทึก');
        document.getElementById('tankIdInput').focus();
        return;
    }
    
    const tankId = formatTankId(tankIdRaw);
    document.getElementById('tankIdInput').value = tankId;
    
    if (!currentTankData || !currentTankType) {
        const confirmLoad = confirm('⚠️ ยังไม่ได้โหลดข้อมูลถัง\nต้องการโหลดข้อมูลตอนนี้หรือไม่?');
        if (!confirmLoad) return;
        
        const record = await onTankIdChange();
        if (!record || !currentTankData) {
            alert('❌ ไม่สามารถโหลดข้อมูลได้');
            return;
        }
    }
    
    const inspector = document.getElementById('inspectorName').value.trim();
    if (!inspector) {
        alert('❌ กรุณากรอกชื่อผู้ตรวจสอบ');
        document.getElementById('inspectorName').focus();
        return;
    }
    
    const gpsValue = document.getElementById('locationField').value.trim();
    if (!gpsValue) {
        const wantGps = confirm('⚠️ ยังไม่ได้ระบุพิกัด GPS\nต้องการระบุตอนนี้หรือไม่?');
        if (wantGps) {
            getCurrentLocation();
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    // ⭐ ใช้ currentTankData ที่โหลดแล้ว (ไม่ต้อง fetchAllTanks)
    const tank = currentTankData;
    
    if (!tank) {
        alert(`❌ ไม่พบรหัสถัง ${tankId} ในระบบทะเบียน`);
        updateIdStatus(`❌ ไม่พบรหัสถัง ${tankId}`, 'error');
        return;
    }
    
    const finalLocation = document.getElementById('locationField').value || 'ไม่ระบุ GPS';
    const checkArr = itemStatus.map(s => s === 'normal' ? '✓' : '✗');
    const anyAbnormal = itemStatus.some(st => st === 'abnormal');
    const resultStatus = anyAbnormal ? 'ผิดปกติ' : 'ปกติ';
    const abnormalCount = itemStatus.filter(s => s === 'abnormal').length;
    
    const fixNote = document.getElementById('fixNoteInput')?.value.trim() || '';
    
    if (resultStatus === 'ผิดปกติ' && !fixNote) {
        const wantFix = confirm('⚠️ พบรายการผิดปกติ แต่ยังไม่ได้ระบุการแก้ไข\nกด OK → ระบุการแก้ไข');
        if (wantFix) {
            document.getElementById('fixNoteInput')?.focus();
            return;
        }
    }
    
    const noteText = resultStatus === 'ผิดปกติ'
        ? (fixNote || 'พบรายการผิดปกติ (ไม่ได้ระบุการแก้ไข)')
        : '';
    
    const payload = {
        tankId: tankId,
        inspector: inspector,
        location: finalLocation,
        tankType: currentTankType || tank['ประเภท'] || '',
        result: resultStatus,
        note: noteText,
        imageBase64: _inspectionPhotoBase64 || '',
        imageFileName: `inspection_${tankId}_${Date.now()}.jpg`
    };
    
    for (let i = 0; i < 8; i++) {
        payload[`q${i+1}`] = checkArr[i] || '✓';
    }
    
    const summary = abnormalCount === 0
        ? `✅ ตรวจสอบทั้งหมด ${itemStatus.length} ข้อ — ปกติ`
        : `⚠️ ตรวจพบ ${abnormalCount} รายการผิดปกติ`;
    
    const photoStatus = _inspectionPhotoBase64 ? '📷 มีรูป ✓' : '📷 ไม่มีรูป';
    
    const confirmMsg =
        `📋 ยืนยันการบันทึก:\n━━━━━━━━━━━━━━━━━\n` +
        `🔢 รหัส: ${tankId}\n🏷️ ประเภท: ${currentTankType || 'ไม่ระบุ'}\n` +
        `👤 ผู้ตรวจ: ${inspector}\n📍 GPS: ${finalLocation}\n` +
        `📊 ${summary}\n${photoStatus}\n` +
        `━━━━━━━━━━━━━━━━━\nยืนยันการบันทึก?`;
    
    if (!confirm(confirmMsg)) return;
    
    isSubmitting = true;
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> กำลังบันทึก...';
    btn.disabled = true;
    
    updateIdStatus('⏳ กำลังบันทึก...', 'loading');
    updateStatusMessage('⏳ กำลังส่งข้อมูล...', '#B27D40');
    
    try {
        const action = _inspectionPhotoBase64 ? 'saveInspectionWithImage' : 'saveInspection';
        const result = await callApi(action, payload);
        
        if (result?.success) {
            updateIdStatus(`✅ บันทึกสำเร็จ! (${result.inspectionId || ''})`, 'success');
            updateStatusMessage(`✅ บันทึกสำเร็จ! ID: ${result.inspectionId || ''}`, '#2A6B3C');
            alert(`✅ บันทึกสำเร็จ!\nรหัส: ${tankId}\nผล: ${result.result || resultStatus}`);
            resetForm();
            setTimeout(() => showDashboard(), 500);
        } else {
            const errMsg = result?.error || 'ไม่สามารถบันทึก';
            updateIdStatus(`❌ ${errMsg}`, 'error');
            updateStatusMessage(`❌ ${errMsg}`, '#C0392B');
            alert(`❌ บันทึกไม่สำเร็จ: ${errMsg}`);
        }
    } catch (err) {
        updateIdStatus('❌ Network Error', 'error');
        updateStatusMessage(`❌ Network Error: ${err.message}`, '#C0392B');
        alert('การเชื่อมต่อล้มเหลว');
    } finally {
        isSubmitting = false;
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function resetForm() {
    document.getElementById('tankIdInput').value = '';
    document.getElementById('locationField').value = '';
    document.getElementById('sizeField').value = '';
    document.getElementById('installDateField').value = '';
    document.getElementById('responsibleField').value = '';
    document.getElementById('inspectorName').value = '';
    
    clearInspectionPhoto();
    
    const fixInput = document.getElementById('fixNoteInput');
    if (fixInput) fixInput.value = '';
    const fixSection = document.getElementById('fixNoteSection');
    if (fixSection) fixSection.style.display = 'none';
    
    currentTankData = null;
    currentTankType = '';
    
    buildRadioInspectionList('');
    updateIdStatus('🟢 พร้อมทำงานสำหรับถังถัดไป', 'success');
    updateStatusMessage('✅ พร้อมบันทึกครั้งต่อไป', '#2A6B3C');
}

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
    if (_inspectionInitialized) return;
    _inspectionInitialized = true;
    
    console.log('🚀 inspection.js initialized');
    
    showDashboard();
    
    const tankInput = document.getElementById('tankIdInput');
    if (tankInput) {
        tankInput.addEventListener('blur', onTankIdChange);
        tankInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onTankIdChange();
            }
        });
    }
    
    const gpsBtn = document.getElementById('getGpsBtn');
    if (gpsBtn) gpsBtn.addEventListener('click', getCurrentLocation);
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitInspection);
    
    const photoFileInput = document.getElementById('inspectionPhotoFile');
    if (photoFileInput) {
        photoFileInput.addEventListener('change', handleInspectionPhotoSelect);
    }
    
    updateIdStatus('🟢 พร้อมทำงาน', 'success');
    updateStatusMessage('📱 กรอกหมายเลขถัง → โหลดข้อมูล → กด GPS → บันทึก', '#5E4B2E');
});