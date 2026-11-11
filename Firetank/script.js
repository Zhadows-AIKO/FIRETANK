// ==================== CONFIGURATION ====================
const WEB_APP_URL = window.CYBERFIRE_WEB_APP_URL 
    || 'https://script.google.com/macros/s/AKfycbxlaLPaN1F2G7DiA4giNotp2G_LTYKoMMbVBRTGdwUp6RJtkm3RsFgih7rw12ZDM1Pm4g/exec';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

// ==================== GLOBAL STATE ====================
let extinguishers = [];
let searchTerm = "", typeTerm = "", statusTerm = "";
let typeChartInstance = null;
let statusChartInstance = null;
let currentViewTankId = null;
let _isSavingAdd = false;
let _isSavingEdit = false;
let _addImageBase64 = '';

// ==================== MAPPINGS ====================
const agentMapping = { "CO2": "B C", "BF 2000": "A B C", "HALOTRION": "A B C", "FORM": "A B" };
const standardMapping = {
    "CO2_10 lbs": "25 lbs", "CO2_15 lbs": "34 lbs", "CO2_20 lbs": "34 lbs",
    "BF 2000_10 lbs": "ปกติ", "BF 2000_15 lbs": "ปกติ", "BF 2000_20 lbs": "ปกติ",
    "HALOTRION_10 lbs": "ปกติ", "HALOTRION_15 lbs": "ปกติ", "HALOTRION_20 lbs": "ปกติ",
    "FORM_10 lbs": "ปกติ", "FORM_15 lbs": "ปกติ", "FORM_9 ลิตร": "ปกติ", "FORM_20 lbs": "ปกติ"
};

const STATUS_COLORS = {
    'ใช้งาน': '#10b981',
    'Stock': '#3b82f6',
    'ปรับปรุง': '#f59e0b',
    'ทิ้งทำลาย': '#6b7280'
};

// ==================== UTILITY ====================
function formatTankIdToFourDigits(tankId) {
    if (!tankId) return '';
    let id = String(tankId).trim();
    let numbers = id.match(/\d+/g);
    if (!numbers) return id;
    let numStr = numbers[numbers.length - 1];
    let num = parseInt(numStr, 10);
    if (isNaN(num)) return id;
    return num.toString().padStart(4, '0');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[m];
    });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const str = String(dateStr).trim();
    if (!str || str === '-') return '-';
    
    if (str.includes('T')) {
        try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch (e) {}
    }
    
    if (str.includes('/')) {
        return str.split(' ')[0];
    }
    
    return str;
}

// ⭐ ตัวช่วยดึง fileId จาก Google Drive URL ทุกรูปแบบ
function extractDriveFileId(url) {
    if (!url) return '';
    const str = String(url).trim();
    
    // รูปแบบต่างๆ ที่เป็นไปได้
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/,
        /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
        /docs\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/
    ];
    
    for (const p of patterns) {
        const m = str.match(p);
        if (m && m[1]) return m[1];
    }
    
    // ถ้าเป็น fileId ล้วนๆ
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(str)) return str;
    
    return '';
}

// ⭐ แปลง URL → thumbnail URL ที่ใช้งานได้
function convertToDirectImageUrl(url) {
    if (!url) return '';
    const str = String(url).trim();
    if (!str) return '';
    
    // ถ้าไม่ใช่ Google Drive → คืนค่าเดิม
    const fileId = extractDriveFileId(str);
    if (!fileId) return str;
    
    // ⭐ ใช้ thumbnail API (ขนาด 1000px) — ทำงานได้แน่นอน
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// ==================== FULLSCREEN IMAGE ====================
function openImageFullscreen() {
    const vtPhoto = document.getElementById('vtPhoto');
    const img = vtPhoto?.querySelector('img');
    if (!img || !img.src) return;
    
    const fullscreen = document.getElementById('imageFullscreen');
    const fullscreenImg = document.getElementById('fullscreenImg');
    if (!fullscreen || !fullscreenImg) return;
    
    fullscreenImg.src = img.src;
    fullscreen.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeImageFullscreen(event) {
    if (event) event.stopPropagation();
    const fullscreen = document.getElementById('imageFullscreen');
    if (fullscreen) {
        fullscreen.classList.remove('active');
        document.body.style.overflow = '';
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeImageFullscreen();
});

// ==================== API ====================
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

async function fetchInspectionHistory(tankId) {
    try {
        return await callApi('getInspectionHistory', { tankId });
    } catch (e) {
        return { success: false, data: [] };
    }
}

async function fetchTestingHistory(tankId) {
    try {
        return await callApi('getTestingHistory', { tankId });
    } catch (e) {
        return { success: false, data: [] };
    }
}

// ==================== DASHBOARD (FAST) ====================
async function loadData() {
    try {
        console.log('🔄 โหลด Dashboard Summary...');
        const startTime = Date.now();
        
        const result = await callApi('getDashboardSummary');
        
        console.log(`⚡ โหลดเสร็จใน ${Date.now() - startTime}ms`);
        
        if (!result?.success) {
            console.error('โหลดไม่สำเร็จ:', result?.error);
            return;
        }
        
        const { stats, typeChart, statusChart, table } = result;
        
        // ⭐ Render Stats
        const safeSet = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        };
        
        safeSet('totalCount', stats.total);
        safeSet('f1Total', stats.f1Total);
        safeSet('f2Total', stats.f2Total);
        safeSet('expiredCount', stats.expired);
        safeSet('warningCount', stats.warning);
        
        // ⭐ เก็บ table
        extinguishers = table || [];
        
        // ⭐ Render Charts
        renderCharts(typeChart, statusChart);
        
        // ⭐ Render Table
        renderTable();
        
    } catch(e) {
        console.error(e);
        extinguishers = [];
        renderTable();
    }
}

function renderCharts(typeChart, statusChart) {
    if (typeChartInstance) { try { typeChartInstance.destroy(); } catch(e){} }
    if (statusChartInstance) { try { statusChartInstance.destroy(); } catch(e){} }
    
    const canvas1 = document.getElementById('typeChart');
    const canvas2 = document.getElementById('statusChart');
    
    if (canvas1 && typeChart && typeChart.labels.length > 0) {
        typeChartInstance = new Chart(canvas1.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: typeChart.labels,
                datasets: [{
                    data: typeChart.values,
                    backgroundColor: ['#FF6B6B', '#FFB347', '#4ECDC4', '#A78BFA', '#F7DC6F'],
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
                            font: { size: 13, weight: '600' },
                            padding: 12,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    if (canvas2 && statusChart) {
        statusChartInstance = new Chart(canvas2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: statusChart.labels,
                datasets: [{
                    label: 'จำนวนถัง',
                    data: statusChart.values,
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                    borderRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#1e40af', font: { size: 12, weight: '600' } },
                        grid: { color: '#e2e8f0' }
                    },
                    x: {
                        ticks: { color: '#1e40af', font: { size: 12, weight: '600' } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#1e40af', font: { size: 13, weight: '600' } } }
                }
            }
        });
    }
}

function renderTable() {
    const filtered = extinguishers.filter(e => {
        let ok = true;
        if (searchTerm && !(e.ID||'').includes(searchTerm) && !(e.โรงงาน||'').includes(searchTerm) && !(e.โซน||'').includes(searchTerm)) ok = false;
        if (typeTerm && e.ประเภท !== typeTerm) ok = false;
        if (statusTerm && !(e.สถานะ||'').includes(statusTerm)) ok = false;
        return ok;
    });
    
    const tbody = document.getElementById('tableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">✨ ไม่พบข้อมูล</td></tr>';
        document.getElementById('recordCount').innerText = '0 รายการ';
        return;
    }
    
    tbody.innerHTML = filtered.map(e => {
        // ⭐ ใช้ _expire ที่ backend ส่งมา
        const expireInfo = e._expire || { hasYear: false };
        let expireBadge = '';
        if (expireInfo.hasYear) {
            if (expireInfo.expired) {
                expireBadge = `<span class="expire-badge expired" title="หมดอายุ ${expireInfo.expireYear}"><i class="fas fa-exclamation-triangle"></i> หมดอายุ</span>`;
            } else if (expireInfo.warning) {
                expireBadge = `<span class="expire-badge warning" title="เหลือ ${expireInfo.yearsLeft} ปี"><i class="fas fa-clock"></i> ${expireInfo.yearsLeft} ปี</span>`;
            }
        }
        
        const statusColor = STATUS_COLORS[e.สถานะ] || '#64748b';
        
        return `
        <tr>
            <td><strong>${escapeHtml(e.ID || '')}</strong> ${expireBadge}</td>
            <td>${escapeHtml(e.โรงงาน || '')}</td>
            <td>${escapeHtml(e.โซน || '')}</td>
            <td>${escapeHtml(e['จุดติดตั้งถังดับเพลิง'] || '')}</td>
            <td>${escapeHtml(e.ประเภท || '')}</td>
            <td>${escapeHtml(e['ขนาด(ปอนด์)'] || '')}</td>
            <td><span class="badge-status" style="background:${statusColor}">${escapeHtml(e.สถานะ || 'ใช้งาน')}</span></td>
            <td>
                <button class="action-icon viewBtn" data-id="${escapeHtml(e.ID)}" title="ดูรายละเอียด"><i class="fas fa-eye"></i></button>
                <button class="action-icon updateBtn" data-id="${escapeHtml(e.ID)}" title="อัพเดท"><i class="fas fa-sync-alt"></i></button>
            </td>
        </tr>
        `;
    }).join('');
    
    document.getElementById('recordCount').innerText = filtered.length + ' รายการ';
    
    document.querySelectorAll('.viewBtn').forEach(btn =>
        btn.addEventListener('click', () => viewTank(btn.dataset.id))
    );
    document.querySelectorAll('.updateBtn').forEach(btn =>
        btn.addEventListener('click', () => openEditModal(btn.dataset.id))
    );
}

// ==================== VIEW TANK ====================
async function viewTank(id) {
    const formatted = formatTankIdToFourDigits(id);
    const ext = extinguishers.find(e => formatTankIdToFourDigits(e.ID) === formatted);
    if (!ext) { alert('❌ ไม่พบข้อมูลถัง'); return; }
    
    currentViewTankId = ext.ID;
    showViewTankPane();
    resetViewTankFields();
    
    document.getElementById('vtId').textContent = ext.ID || '-';
    document.getElementById('vtType').textContent = ext.ประเภท || '-';
    document.getElementById('vtSize').textContent = ext['ขนาด(ปอนด์)'] || '-';
    document.getElementById('vtAgent').textContent = ext['ชนิดที่ดับได้'] || '-';
    document.getElementById('vtTankNumber').textContent = ext['หมายเลขวันที่ถัง'] || '-';
    document.getElementById('vtStatus').textContent = ext.สถานะ || 'ใช้งาน';
    document.getElementById('vtLocation').textContent = ext['จุดติดตั้งถังดับเพลิง'] || '-';
    document.getElementById('vtFactory').textContent = ext.โรงงาน || '-';
    
    // ⭐ ใช้ _expire จาก backend
    const expireInfo = ext._expire || { hasYear: false };
    const expireEl = document.getElementById('vtExpireDate');
    if (expireInfo.hasYear) {
        let text = `${expireInfo.expireYear} (พ.ศ. ${expireInfo.expireYear + 543})`;
        if (expireInfo.expired) {
            expireEl.textContent = text + ` — หมดอายุแล้ว`;
            expireEl.style.cssText = 'background:#fecaca;color:#991b1b;font-weight:bold;';
        } else if (expireInfo.warning) {
            expireEl.textContent = text + ` — เหลือ ${expireInfo.yearsLeft} ปี`;
            expireEl.style.cssText = 'background:#fed7aa;color:#9a3412;font-weight:bold;';
        } else {
            expireEl.textContent = text + ` — เหลือ ${expireInfo.yearsLeft} ปี`;
            expireEl.style.cssText = 'background:#a7f3d0;color:#065f46;font-weight:bold;';
        }
    } else {
        expireEl.textContent = '-';
        expireEl.style.cssText = '';
    }
    
        const photoEl = document.getElementById('vtPhoto');
    const rawUrl = ext.รูปภาพ || '';
    const fileId = extractDriveFileId(rawUrl);
    
    if (fileId) {
        // ⭐ ลอง URL หลายแบบ (fallback chain)
        const urlCandidates = [
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
            `https://lh3.googleusercontent.com/d/${fileId}=w1000`,
            `https://drive.google.com/uc?export=download&id=${fileId}`
        ];
        
        photoEl.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#64748b;font-size:2rem;">
                <i class="fas fa-spinner fa-pulse"></i>
            </div>
        `;
        
        let attemptIdx = 0;
        const tryLoad = () => {
            if (attemptIdx >= urlCandidates.length) {
                // ❌ ล้มเหลวทุก URL
                photoEl.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#dc2626;padding:8px;text-align:center;font-size:0.7rem;">
                        <i class="fas fa-exclamation-triangle" style="font-size:1.8rem;margin-bottom:4px;"></i>
                        <span>ไม่สามารถโหลดรูปได้</span>
                        <small style="margin-top:4px;color:#94a3b8;font-size:0.6rem;">ตรวจสอบการแชร์ไฟล์ใน Drive</small>
                    </div>
                `;
                return;
            }
            
            const testUrl = urlCandidates[attemptIdx];
            const img = new Image();
            img.onload = () => {
                photoEl.innerHTML = `<img src="${escapeHtml(testUrl)}" alt="Tank" onclick="openImageFullscreen()">`;
            };
            img.onerror = () => {
                console.warn(`❌ URL ${attemptIdx + 1} ล้มเหลว:`, testUrl);
                attemptIdx++;
                tryLoad();
            };
            img.src = testUrl;
        };
        tryLoad();
        
    } else if (rawUrl) {
        // มี URL แต่ไม่ใช่ Google Drive → ใช้ URL ตรงๆ
        const img = new Image();
        img.onload = () => {
            photoEl.innerHTML = `<img src="${escapeHtml(rawUrl)}" alt="Tank" onclick="openImageFullscreen()">`;
        };
        img.onerror = () => {
            photoEl.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;color:#dc2626;padding:8px;text-align:center;font-size:0.7rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size:1.8rem;margin-bottom:4px;"></i>
                    <span>ไม่สามารถโหลดรูปได้</span>
                </div>
            `;
        };
        img.src = rawUrl;
    } else {
        // ไม่มีรูปเลย
        photoEl.innerHTML = '<i class="fas fa-user-tie"></i>';
    }
    
    buildVtChecklistSkeleton(ext.ประเภท || '');
    
    await Promise.all([
        loadVtInspectionHistory(ext.ID),
        loadVtTestingHistory(ext.ID),
        loadVtLatestInspection(ext.ID, ext.ประเภท || '')
    ]);
}

function buildVtChecklistSkeleton(tankType) {
    const container = document.getElementById('vtChecklist');
    if (!container) return;
    const items = getInspectionItemsForType(tankType);
    container.innerHTML = items.map((item, idx) => `
        <div class="vt-check-row">
            <span>${idx+1}. ${escapeHtml(item)}</span>
            <span class="vt-check-value" id="vtQ${idx+1}">-</span>
        </div>
    `).join('');
}

function getInspectionItemsForType(tankType) {
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
    
    if (!tankType) return INSPECTION_ITEMS_BY_TYPE["_default"];
    return INSPECTION_ITEMS_BY_TYPE[tankType] || INSPECTION_ITEMS_BY_TYPE["_default"];
}

function showViewTankPane() {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active-pane'));
    document.getElementById('viewTankPane').classList.add('active-pane');
}

function closeViewTank() {
    currentViewTankId = null;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active-pane'));
    document.getElementById('registerPane')?.classList.add('active-pane');
}

function resetViewTankFields() {
    ['vtId','vtType','vtSize','vtAgent','vtTankNumber','vtExpireDate',
     'vtStatus','vtLocation','vtFactory'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '-'; el.style.cssText = ''; }
    });
    const inspEl = document.getElementById('vtInspector');
    if (inspEl) inspEl.textContent = '-';
}

async function loadVtInspectionHistory(tankId) {
    const tbody = document.getElementById('vtMonthlyHistory');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">⏳ กำลังโหลด...</td></tr>';
    
    try {
        const result = await fetchInspectionHistory(tankId);
        if (!result?.success || !Array.isArray(result.data) || result.data.length === 0) {
            tbody.innerHTML = `
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>`;
            return;
        }
        const latest = result.data.slice(0, 4);
        let html = latest.map(rec => `
            <tr>
                <td>${escapeHtml(formatDateShort(rec.date))}</td>
                <td class="${rec.result === 'ปกติ' ? 'pass' : rec.result === 'ผิดปกติ' ? 'fail' : ''}">${escapeHtml(rec.result || '-')}</td>
                <td>${escapeHtml(rec.note || '-')}</td>
            </tr>
        `).join('');
        for (let i = latest.length; i < 4; i++) {
            html += '<tr><td>&nbsp;</td><td></td><td></td></tr>';
        }
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#dc2626;">❌ โหลดไม่สำเร็จ</td></tr>';
    }
}

async function loadVtTestingHistory(tankId) {
    const tbody = document.getElementById('vtTestHistory');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">⏳ กำลังโหลด...</td></tr>';
    
    try {
        const result = await fetchTestingHistory(tankId);
        if (!result?.success || !Array.isArray(result.data) || result.data.length === 0) {
            tbody.innerHTML = `
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>
                <tr><td>&nbsp;</td><td></td><td></td></tr>`;
            return;
        }
        const latest = result.data.slice(0, 4);
        let html = latest.map(rec => `
            <tr>
                <td>${escapeHtml(formatDateShort(rec.testDate))}</td>
                <td class="${rec.result === 'ผ่าน' ? 'pass' : rec.result === 'ไม่ผ่าน' ? 'fail' : ''}">${escapeHtml(rec.result || '-')}</td>
                <td>${escapeHtml(rec.testNumber || '-')}</td>
            </tr>
        `).join('');
        for (let i = latest.length; i < 4; i++) {
            html += '<tr><td>&nbsp;</td><td></td><td></td></tr>';
        }
        tbody.innerHTML = html;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#dc2626;">❌ โหลดไม่สำเร็จ</td></tr>';
    }
}

async function loadVtLatestInspection(tankId, tankType) {
    try {
        const result = await fetchInspectionHistory(tankId);
        if (!result?.success || !Array.isArray(result.data) || result.data.length === 0) return;
        const latest = result.data[0];
        const items = getInspectionItemsForType(tankType);
        
        for (let i = 1; i <= items.length; i++) {
            const el = document.getElementById(`vtQ${i}`);
            if (!el) continue;
            const val = latest[`q${i}`] || '-';
            el.textContent = val;
            el.className = 'vt-check-value ' + (val === '✓' ? 'pass' : val === '✗' ? 'fail' : '');
        }
        const inspEl = document.getElementById('vtInspector');
        if (inspEl) inspEl.textContent = latest.inspector || '-';
    } catch (e) {
        console.error('Latest Inspection Error:', e);
    }
}

// ==================== TOGGLE TABLE ====================
const toggleTableBtn = document.getElementById('toggleTableBtn');
const tableWrapper = document.querySelector('.table-wrapper');
let isTableVisible = false;

function toggleTable() {
    if (isTableVisible) {
        tableWrapper.classList.remove('show-table');
        toggleTableBtn.innerHTML = '<i class="fas fa-table"></i> แสดงตาราง';
        isTableVisible = false;
    } else {
        tableWrapper.classList.add('show-table');
        toggleTableBtn.innerHTML = '<i class="fas fa-eye-slash"></i> ซ่อนตาราง';
        isTableVisible = true;
    }
}

if (toggleTableBtn) toggleTableBtn.addEventListener('click', toggleTable);

// ==================== IMAGE UPLOAD (ADD) ====================
function handleAddImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > MAX_IMAGE_SIZE) {
        alert(`❌ ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(2)} MB)\nกรุณาเลือกไฟล์ไม่เกิน 10 MB`);
        event.target.value = '';
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('❌ กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        _addImageBase64 = e.target.result;
        showAddImagePreview(_addImageBase64);
    };
    reader.onerror = () => alert('❌ ไม่สามารถอ่านไฟล์ได้');
    reader.readAsDataURL(file);
}

function showAddImagePreview(base64) {
    const box = document.getElementById('addImagePreview');
    if (!box) return;
    
    box.classList.add('has-image');
    box.innerHTML = `
        <button type="button" class="remove-img-btn" onclick="removeAddImage(event)" title="ลบรูป">
            <i class="fas fa-times"></i>
        </button>
        <img src="${base64}" alt="Preview">
    `;
}

function removeAddImage(event) {
    if (event) event.stopPropagation();
    _addImageBase64 = '';
    
    const box = document.getElementById('addImagePreview');
    if (box) {
        box.classList.remove('has-image');
        box.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <span>คลิกเพื่อแนบรูป</span>
            <small>JPG, PNG, WEBP · ไม่เกิน 10 MB</small>
        `;
    }
    
    const fileInput = document.getElementById('addImageFile');
    if (fileInput) fileInput.value = '';
}

// ==================== MODAL: ADD ====================
const addModal = document.getElementById('addModal');

function updateAddAgentAndStandard() {
    const type = document.getElementById('addType').value;
    const size = document.getElementById('addSize').value;
    document.getElementById('addAgent').value = (type && agentMapping[type]) ? agentMapping[type] : '';
    const key = `${type}_${size}`;
    let std = standardMapping[key];
    if (!std && type === "CO2") std = "มาตรฐาน มอก.";
    if (!std && (type === "BF 2000" || type === "HALOTRION" || type === "FORM")) std = "ปกติ";
    document.getElementById('addStandard').value = std || '';
}

function updateAddExpireDate() {
    const tankNumber = document.getElementById('addTankNumber')?.value || '';
    const el = document.getElementById('addExpireDate');
    if (!el) return;
    
    // ⭐ ใช้ helper local (ในฟอร์ม Add ใช้ได้)
    const year = extractYearLocal(tankNumber);
    if (year) {
        const expireYear = year + 15;
        const yearsLeft = expireYear - new Date().getFullYear();
        el.value = `${expireYear} (พ.ศ. ${expireYear + 543})`;
        el.style.color = yearsLeft < 0 ? '#dc2626' : yearsLeft <= 2 ? '#f59e0b' : '#10b981';
        el.style.fontWeight = 'bold';
    } else {
        el.value = '';
        el.style.color = '';
        el.style.fontWeight = '';
    }
}

// ⭐ Helper สำหรับฟอร์ม Add เท่านั้น
function extractYearLocal(tankNumber) {
    if (!tankNumber) return null;
    const str = String(tankNumber).trim();
    if (!str) return null;
    
    const fullYearMatch = str.match(/\b(19|20)\d{2}\b/);
    if (fullYearMatch) return parseInt(fullYearMatch[0], 10);
    
    const beYearMatch = str.match(/\b(24|25)\d{2}\b/);
    if (beYearMatch) return parseInt(beYearMatch[0], 10) - 543;
    
    const shortMatch = str.match(/\b(\d{2})\b/);
    if (shortMatch) {
        const y = parseInt(shortMatch[1], 10);
        if (y >= 0 && y <= 99) return 2000 + y;
    }
    return null;
}

function clearAddForm() {
    document.getElementById('addId').value = '';
    document.getElementById('addSeq').value = '';
    document.getElementById('addFactory').value = 'โรงงานที่ 1';
    document.getElementById('addZone').value = '';
    document.getElementById('addLocation').value = '';
    
    removeAddImage();
    
    document.getElementById('addType').value = '';
    document.getElementById('addAgent').value = '';
    document.getElementById('addSize').value = '10 lbs';
    document.getElementById('addStandard').value = '';
    document.getElementById('addTankNumber').value = '';
    const expireEl = document.getElementById('addExpireDate');
    if (expireEl) { expireEl.value = ''; expireEl.style.color = ''; expireEl.style.fontWeight = ''; }
    document.getElementById('addStatus').value = 'ใช้งาน';
}

async function openAddModal() {
    clearAddForm();

    let maxId = 0;
    let maxSeq = 0;

    if (Array.isArray(extinguishers)) {
        extinguishers.forEach(item => {
            const idNum = parseInt(item.ID, 10);
            const seqNum = parseInt(item.ลำดับ, 10);

            if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
            if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
        });
    }

    const nextId = String(maxId + 1).padStart(4, '0');
    const nextSeq = String(maxSeq + 1);

    document.getElementById('addId').value = nextId;
    document.getElementById('addSeq').value = nextSeq;

    document.getElementById('addFactory').value = 'โรงงานที่ 1';
    document.getElementById('addSize').value = '10 lbs';
    document.getElementById('addStatus').value = 'ใช้งาน';

    updateAddAgentAndStandard();
    updateAddExpireDate();
    addModal.classList.add('active');
}

// ==================== MODAL: EDIT ====================
const editModal = document.getElementById('editModal');

async function openEditModal(id) {
    const ext = extinguishers.find(e => e.ID === id);
    if (!ext) return;
    
    document.getElementById('editId').value = ext.ID;
    document.getElementById('editSeq').value = ext.ลำดับ || '';
    document.getElementById('editImage').value = ext.รูปภาพ || '';
    document.getElementById('editType').value = ext.ประเภท || '';
    document.getElementById('editAgent').value = ext['ชนิดที่ดับได้'] || '';
    document.getElementById('editSize').value = ext['ขนาด(ปอนด์)'] || '';
    document.getElementById('editStandard').value = ext.เกณฑ์มาตรฐาน || '';
    document.getElementById('editTankNumber').value = ext.หมายเลขวันที่ถัง || '';
    
    // ⭐ ใช้ _expire จาก backend
    const expireInfo = ext._expire || { hasYear: false };
    const expireEl = document.getElementById('editExpireDate');
    if (expireInfo.hasYear) {
        expireEl.value = `${expireInfo.expireYear} (พ.ศ. ${expireInfo.expireYear + 543})`;
        expireEl.style.color = expireInfo.expired ? '#dc2626' : expireInfo.warning ? '#f59e0b' : '#10b981';
        expireEl.style.fontWeight = 'bold';
    } else {
        expireEl.value = '';
        expireEl.style.color = '';
    }
    
    document.getElementById('editFactory').value = ext.โรงงาน || 'โรงงานที่ 1';
    document.getElementById('editZone').value = ext.โซน || '';
    document.getElementById('editLocation').value = ext['จุดติดตั้งถังดับเพลิง'] || '';
    document.getElementById('editLastTestDate').value = ext['วันที่ทดสอบล่าสุด'] || '';
    document.getElementById('editTestNumber').value = ext.หมายเลขทดสอบ || '';
    document.getElementById('editStatus').value = ext.สถานะ || 'ใช้งาน';
    
    editModal.classList.add('active');
    
    try {
        const result = await callApi('getTankFullInfo', { tankId: ext.ID });
        if (result?.success && result.tank) {
            const t = result.tank;
            
            document.getElementById('editSeq').value = t.ลำดับ || '';
            document.getElementById('editImage').value = t.รูปภาพ || '';
            document.getElementById('editType').value = t.ประเภท || '';
            document.getElementById('editAgent').value = t['ชนิดที่ดับได้'] || '';
            document.getElementById('editSize').value = t['ขนาด(ปอนด์)'] || '';
            document.getElementById('editStandard').value = t.เกณฑ์มาตรฐาน || '';
            document.getElementById('editTankNumber').value = t.หมายเลขวันที่ถัง || '';
            
            document.getElementById('editFactory').value = t.โรงงาน || 'โรงงานที่ 1';
            document.getElementById('editZone').value = t.โซน || '';
            document.getElementById('editLocation').value = t['จุดติดตั้งถังดับเพลิง'] || '';
            document.getElementById('editLastTestDate').value = t['วันที่ทดสอบล่าสุด'] || '';
            document.getElementById('editTestNumber').value = t['หมายเลขทดสอบ'] || '';
            document.getElementById('editStatus').value = t.สถานะ || 'ใช้งาน';
            
            console.log('✅ โหลดข้อมูลเต็มสำเร็จ:', t.ID);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

// ==================== SUBMIT: ADD ====================
document.getElementById('addForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (_isSavingAdd) {
        alert('⏳ กำลังบันทึกข้อมูลก่อนหน้า กรุณารอสักครู่');
        return;
    }
    
    let id = document.getElementById('addId').value.trim();
    const formattedId = formatTankIdToFourDigits(id);
    
    if (!formattedId || !/^\d{4}$/.test(formattedId)) {
        alert('❌ รหัสถังต้องเป็นตัวเลข 4 หลัก');
        return;
    }
    
    const duplicate = extinguishers.find(ext => formatTankIdToFourDigits(ext.ID) === formattedId);
    if (duplicate) {
        alert(`❌ รหัสถัง ${formattedId} มีอยู่แล้ว\n(โรงงาน: ${duplicate.โรงงาน || '-'})`);
        return;
    }
    
    const record = {
        ID: formattedId,
        ลำดับ: document.getElementById('addSeq').value,
        โรงงาน: document.getElementById('addFactory').value,
        โซน: document.getElementById('addZone').value,
        จุดติดตั้งถังดับเพลิง: document.getElementById('addLocation').value,
        รูปภาพ: '',
        ประเภท: document.getElementById('addType').value,
        'ชนิดที่ดับได้': document.getElementById('addAgent').value,
        'ขนาด(ปอนด์)': document.getElementById('addSize').value,
        เกณฑ์มาตรฐาน: document.getElementById('addStandard').value,
        หมายเลขวันที่ถัง: document.getElementById('addTankNumber').value,
        วันที่ทดสอบล่าสุด: '',
        หมายเลขทดสอบ: '',
        สถานะ: document.getElementById('addStatus').value || 'ใช้งาน',
        imageBase64: _addImageBase64 || '',
        imageFileName: `tank_${formattedId}_${Date.now()}.jpg`
    };
    
    _isSavingAdd = true;
    const submitBtn = document.getElementById('addSubmitBtn');
    const origHtml = submitBtn?.innerHTML || '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> กำลังบันทึก...';
    }
    
    try {
        const result = await callApi('add', record);
        
        if (result?.success) {
            addModal.classList.remove('active');
            clearAddForm();
            
            alert(`✅ ลงทะเบียนสำเร็จ!\nรหัส: ${result.newId}`);
            
            // ⭐ โหลดใหม่ (backend clearCache แล้ว)
            await loadData();
        } else {
            alert('❌ ' + (result?.error || 'บันทึกไม่สำเร็จ'));
        }
    } finally {
        _isSavingAdd = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
        }
    }
});

// ==================== SUBMIT: EDIT ====================
document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (_isSavingEdit) {
        alert('⏳ กำลังบันทึกข้อมูลก่อนหน้า กรุณารอสักครู่');
        return;
    }
    
    const id = document.getElementById('editId').value.trim();
    const formattedId = formatTankIdToFourDigits(id);
    
    if (!formattedId || !/^\d{4}$/.test(formattedId)) {
        alert('❌ รหัสถังไม่ถูกต้อง');
        return;
    }
    
    const record = {
        ID: formattedId,
        ลำดับ: document.getElementById('editSeq').value,
        โรงงาน: document.getElementById('editFactory').value,
        โซน: document.getElementById('editZone').value,
        จุดติดตั้งถังดับเพลิง: document.getElementById('editLocation').value,
        รูปภาพ: document.getElementById('editImage').value,
        ประเภท: document.getElementById('editType').value,
        'ชนิดที่ดับได้': document.getElementById('editAgent').value,
        'ขนาด(ปอนด์)': document.getElementById('editSize').value,
        เกณฑ์มาตรฐาน: document.getElementById('editStandard').value,
        หมายเลขวันที่ถัง: document.getElementById('editTankNumber').value,
        วันที่ทดสอบล่าสุด: document.getElementById('editLastTestDate').value,
        หมายเลขทดสอบ: document.getElementById('editTestNumber').value,
        สถานะ: document.getElementById('editStatus').value
    };
    
    _isSavingEdit = true;
    const submitBtn = document.getElementById('editSubmitBtn');
    const origHtml = submitBtn?.innerHTML || '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> กำลังบันทึก...';
    }
    
    try {
        const result = await callApi('update', record);
        
        if (result?.success) {
            editModal.classList.remove('active');
            await loadData();
            
            if (result.testingChanged && result.testing?.success) {
                alert(
                    `✅ อัพเดทสำเร็จ! (รหัส: ${formattedId})\n\n` +
                    `📋 บันทึกประวัติการทดสอบด้วย:\n` +
                    `   📅 วันที่ทดสอบ: ${result.testing.testDate}\n` +
                    `   🔢 หมายเลข: ${result.testing.testNumber || '-'}\n` +
                    `   📅 ครั้งถัดไป: ${result.testing.nextTestDate}`
                );
            } else {
                alert(`✅ อัพเดทสำเร็จ! (รหัส: ${formattedId})`);
            }
        } else {
            alert('❌ ' + (result?.error || 'บันทึกไม่สำเร็จ'));
        }
    } finally {
        _isSavingEdit = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
        }
    }
});

// ==================== EVENT LISTENERS ====================
document.getElementById('openAddModalBtn')?.addEventListener('click', openAddModal);
document.getElementById('closeAddModalBtn')?.addEventListener('click', () => {
    addModal.classList.remove('active');
    clearAddForm();
});
addModal?.addEventListener('click', (e) => {
    if (e.target === addModal) {
        addModal.classList.remove('active');
        clearAddForm();
    }
});
document.getElementById('addType')?.addEventListener('change', updateAddAgentAndStandard);
document.getElementById('addSize')?.addEventListener('change', updateAddAgentAndStandard);
document.getElementById('addTankNumber')?.addEventListener('input', updateAddExpireDate);
document.getElementById('addTankNumber')?.addEventListener('blur', updateAddExpireDate);
document.getElementById('addImageFile')?.addEventListener('change', handleAddImageSelect);

document.getElementById('closeEditModalBtn')?.addEventListener('click', () => {
    editModal.classList.remove('active');
});
editModal?.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.remove('active');
});

document.getElementById('refreshDashboardBtn')?.addEventListener('click', () => loadData());
document.getElementById('searchInput')?.addEventListener('input', e => { searchTerm = e.target.value; renderTable(); });
document.getElementById('typeFilter')?.addEventListener('change', e => { typeTerm = e.target.value; renderTable(); });
document.getElementById('statusFilter')?.addEventListener('change', e => { statusTerm = e.target.value; renderTable(); });
document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('statusFilter').value = '';
    searchTerm = ''; typeTerm = ''; statusTerm = '';
    renderTable();
});

document.getElementById('vtEditBtn')?.addEventListener('click', () => {
    if (currentViewTankId) {
        closeViewTank();
        setTimeout(() => openEditModal(currentViewTankId), 100);
    }
});

// ==================== INIT ====================
loadData();