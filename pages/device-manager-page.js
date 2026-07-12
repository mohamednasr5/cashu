/**
 * صفحة إدارة الأجهزة — Device Manager Page
 * تعرض جدول الأجهزة المتصلة مع التحديث المباشر
 * ============================================================
 */
'use strict';

const DeviceManagerPage = (() => {

    let _refreshTimer = null;

    /**
     * عرض صفحة إدارة الأجهزة
     */
    function render() {
        const pageContent = document.getElementById('page-content');
        if (!pageContent) return;

        pageContent.innerHTML = getHTML();

        _bindEvents();
        _startAutoRefresh();

        // تحميل البيانات الأولية
        _refreshDevices();
    }

    /**
     * HTML الصفحة
     */
    function getHTML() {
        return `
        <div class="dm-page">
            <!-- شريط الأدوات -->
            <div class="dm-toolbar">
                <div class="dm-toolbar-right">
                    <div class="dm-search-wrap">
                        <i class="fas fa-search"></i>
                        <input type="text" id="dm-search" placeholder="بحث بالاسم أو Device ID..." oninput="DeviceManagerPage.filterDevices(this.value)">
                    </div>
                    <select id="dm-filter-status" onchange="DeviceManagerPage.filterByStatus(this.value)" class="dm-select">
                        <option value="all">كل الحالات</option>
                        <option value="device">متصل</option>
                        <option value="offline">غير متصل</option>
                        <option value="unauthorized">غير مصرح</option>
                      </select>
                </div>
                <div class="dm-toolbar-left">
                    <span class="dm-connection-badge" id="dm-conn-badge">
                        <i class="fas fa-circle"></i>
                        <span>جاري الاتصال...</span>
                    </span>
                    <button class="btn btn-success dm-btn" onclick="DeviceManagerPage.refreshDevices()" title="تحديث الآن">
                        <i class="fas fa-sync-alt"></i>
                        <span>تحديث</span>
                    </button>
                    <button class="btn btn-primary dm-btn" onclick="DeviceManagerPage.addSimDevice()" title="إضافة جهاز تجريبي">
                        <i class="fas fa-plus"></i>
                        <span>جهاز تجريبي</span>
                    </button>
                </div>
            </div>

            <!-- جدول الأجهزة -->
            <div class="dm-table-wrap">
                <table class="dm-table" id="dm-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>اسم الجهاز</th>
                            <th>Device ID</th>
                            <th>الحالة</th>
                            <th>البطارية</th>
                            <th>قوة الشبكة</th>
                            <th>نوع الاتصال</th>
                            <th>إصدار أندرويد</th>
                            <th>USB Debugging</th>
                            <th>آخر اتصال</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="dm-table-body">
                        <tr>
                            <td colspan="11" class="dm-empty">
                                <i class="fas fa-mobile-alt"></i>
                                <p>جاري تحميل الأجهزة...</p>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- التوقيع -->
            <div class="dm-footer">
                <span>برمجة وتطوير <span class="dm-heart">&#10084;&#65039;</span> محمد حماد</span>
                <a href="https://www.facebook.com/en.mohamed.nasr" target="_blank" rel="noopener">
                    <i class="fab fa-facebook"></i>
                </a>
            </div>
        </div>`;
    }

    /**
     * ربط الأحداث
     */
    function _bindEvents() {
        // الاستماع لتحديثات الأجهزة في الوقت الفعلي
        DeviceService.on('devicesLoaded', _onDevicesUpdate);
        DeviceService.on('liveUpdate', _onDevicesUpdate);
        DeviceService.on('deviceUpdated', _onSingleDeviceUpdate);
        DeviceService.on('deviceOffline', _onDeviceOffline);

        // تحديث حالة الاتصال
        AdbService.on('connectionChange', _onConnectionChange);

        // تحديث شارة الاتصال الحالية
        _updateConnectionBadge();
    }

    function _onDevicesUpdate() {
        _refreshDevices();
    }

    function _onSingleDeviceUpdate({ deviceId, device }) {
        if (!device) return;
        const row = document.querySelector(`tr[data-device-id="${deviceId}"]`);
        if (row) {
            row.outerHTML = _buildDeviceRow(device, _getRowNumber(row));
        } else {
            _refreshDevices();
        }
    }

    function _onDeviceOffline({ deviceId }) {
        const row = document.querySelector(`tr[data-device-id="${deviceId}"]`);
        if (row) {
            const statusCell = row.querySelector('.dm-status');
            if (statusCell) {
                statusCell.className = 'dm-status status-offline';
                statusCell.innerHTML = '<i class="fas fa-times-circle"></i> غير متصل';
            }
        }
    }

    function _onConnectionChange({ connected, mode }) {
        _updateConnectionBadge();
    }

    function _updateConnectionBadge() {
        const badge = document.getElementById('dm-conn-badge');
        if (!badge) return;

        if (AdbService.isConnected()) {
            badge.className = 'dm-connection-badge connected';
            badge.innerHTML = '<i class="fas fa-circle"></i><span>متصل مباشر</span>';
        } else if (AdbService.isSimulationMode()) {
            badge.className = 'dm-connection-badge simulation';
            badge.innerHTML = '<i class="fas fa-circle"></i><span>وضع المحاكاة</span>';
        } else {
            badge.className = 'dm-connection-badge disconnected';
            badge.innerHTML = '<i class="fas fa-circle"></i><span>غير متصل بالخادم</span>';
        }
    }

    /**
     * تحديث جدول الأجهزة
     */
    function _refreshDevices() {
        const tbody = document.getElementById('dm-table-body');
        if (!tbody) return;

        const searchTerm = (document.getElementById('dm-search')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('dm-filter-status')?.value || 'all';

        let devices = DeviceService.getAllDevices();

        // تطبيق الفلاتر
        if (searchTerm) {
            devices = devices.filter(d =>
                (d.deviceName || '').toLowerCase().includes(searchTerm) ||
                (d.deviceId || '').toLowerCase().includes(searchTerm)
            );
        }
        if (statusFilter !== 'all') {
            devices = devices.filter(d => (d.status || 'offline') === statusFilter);
        }

        // ترتيب: المتصل أولاً
        devices.sort((a, b) => {
            const aOnline = (a.status === 'device' || a.status === 'online') ? 1 : 0;
            const bOnline = (b.status === 'device' || b.status === 'online') ? 1 : 0;
            return bOnline - aOnline || (b.lastSeen || 0) - (a.lastSeen || 0);
        });

        if (!devices.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="dm-empty">
                        <i class="fas fa-mobile-alt"></i>
                        <p>لا توجد أجهزة${searchTerm || statusFilter !== 'all' ? ' تطابق البحث' : ' متصلة حالياً'}</p>
                        ${!searchTerm && statusFilter === 'all' ? '<p class="dm-empty-hint">قم بتوصيل هاتف Android عبر USB مع تفعيل USB Debugging أو أضف جهاز تجريبي</p>' : ''}
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = devices.map((d, i) => _buildDeviceRow(d, i + 1)).join('');
    }

    /**
     * بناء صف واحد في الجدول
     */
    function _buildDeviceRow(device, index) {
        const isOnline = device.status === 'device' || device.status === 'online';
        const isUnauthorized = device.status === 'unauthorized';
        const battery = device.battery || 0;
        const batteryClass = battery > 60 ? 'high' : battery > 20 ? 'medium' : 'low';
        const signal = device.signal || 0;
        const signalBars = Array.from({ length: 5 }, (_, i) =>
            `<i class="fas fa-signal-bar${i <= signal ? '' : '-slashed'}" style="opacity:${i <= signal ? 1 : 0.2}; font-size:11px;"></i>`
        ).join('');

        const statusClass = isOnline ? 'status-online' : isUnauthorized ? 'status-unauthorized' : 'status-offline';
        const statusText = isOnline ? '<i class="fas fa-check-circle"></i> متصل' :
            isUnauthorized ? '<i class="fas fa-exclamation-triangle"></i> غير مصرح' :
            '<i class="fas fa-times-circle"></i> غير متصل';

        return `
        <tr data-device-id="${device.deviceId || ''}" class="${isOnline ? 'dm-row-online' : ''}">
            <td>${index}</td>
            <td>
                <div class="dm-device-name">
                    <i class="fas fa-mobile-alt" style="color:var(--red); margin-left:6px;"></i>
                    <span>${device.deviceName || 'غير معروف'}</span>
                </div>
            </td>
            <td><code class="dm-device-id">${device.deviceId || '-'}</code></td>
            <td><span class="dm-status ${statusClass}">${statusText}</span></td>
            <td>
                <div class="dm-battery ${batteryClass}">
                    <div class="dm-battery-icon">
                        <i class="fas fa-battery-${battery > 75 ? 'full' : battery > 50 ? 'three-quarters' : battery > 25 ? 'half' : battery > 10 ? 'quarter' : 'empty'}"></i>
                    </div>
                    <div class="dm-battery-bar">
                        <div class="dm-battery-fill" style="width:${battery}%"></div>
                    </div>
                    <span class="dm-battery-text">${battery}%</span>
                </div>
            </td>
            <td>
                <div class="dm-signal">${signalBars}</div>
            </td>
            <td><span class="dm-badge">${device.connectionType || 'USB'}</span></td>
            <td>${device.androidVersion || '-'}</td>
            <td>
                <span class="dm-usb-status ${device.usbDebugging ? 'enabled' : 'disabled'}">
                    <i class="fas fa-${device.usbDebugging ? 'check' : 'times'}"></i>
                    ${device.usbDebugging ? 'مفعّل' : 'معطّل'}
                </span>
            </td>
            <td><span class="dm-time">${device.lastConnection || '-'}</span></td>
            <td>
                <div class="dm-actions">
                    ${isUnauthorized ? '<button class="dm-action-btn warn" onclick="DeviceManagerPage.showUsbDebugAlert()" title="تفعيل USB Debugging"><i class="fas fa-exclamation-triangle"></i></button>' : ''}
                    ${device.simulated ? '<button class="dm-action-btn danger" onclick="DeviceManagerPage.removeSimDevice(\'' + device.deviceId + '\')" title="إزالة"><i class="fas fa-trash"></i></button>' : ''}
                </div>
            </td>
        </tr>`;
    }

    function _getRowNumber(row) {
        const tbody = row.closest('tbody');
        if (!tbody) return 0;
        const rows = Array.from(tbody.querySelectorAll('tr[data-device-id]'));
        return rows.indexOf(row) + 1;
    }

    /**
     * تحديث يدوي
     */
    function refreshDevices() {
        _refreshDevices();
        if (typeof toast !== 'undefined') {
            toast('تم تحديث قائمة الأجهزة', 'info');
        }
    }

    /**
     * إضافة جهاز تجريبي
     */
    function addSimDevice() {
        const names = ['Samsung Galaxy S23', 'Samsung Galaxy A54', 'Xiaomi Redmi Note 13', 'OPPO A78', 'Huawei P60', 'Realme 11 Pro', 'Samsung Galaxy S24 Ultra'];
        const versions = ['12', '13', '14', '14'];
        const name = names[Math.floor(Math.random() * names.length)];
        AdbService.addSimulatedDevice({
            name,
            androidVersion: versions[Math.floor(Math.random() * versions.length)]
        });
        if (typeof toast !== 'undefined') {
            toast('تم إضافة جهاز تجريبي: ' + name, 'success');
        }
    }

    /**
     * إزالة جهاز تجريبي
     */
    function removeSimDevice(deviceId) {
        AdbService.removeSimulatedDevice(deviceId);
        DeviceService.deleteDevice(deviceId);
        _refreshDevices();
    }

    /**
     * تنبيه USB Debugging
     */
    function showUsbDebugAlert() {
        if (typeof Modal !== 'undefined' && Modal.show) {
            Modal.show(
                '<i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i> تنبيه USB Debugging',
                `<div style="padding:20px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:16px; color:var(--warning);">
                        <i class="fas fa-usb"></i>
                    </div>
                    <p style="font-size:15px; margin-bottom:12px; color:var(--text);">
                        <strong>الجهاز غير مصرح به للاتصال</strong>
                    </p>
                    <p style="font-size:13px; color:var(--text2); margin-bottom:20px; line-height:1.8;">
                        يرجى فتح هاتف Android والقيام بالآتي:<br>
                        1. انتقل إلى <strong>الإعدادات</strong><br>
                        2. اختر <strong>خيارات المطور</strong><br>
                        3. فعّل <strong>تصحيح USB (USB Debugging)</strong><br>
                        4. اقبط نافذة التصريح التي تظهر على الهاتف
                    </p>
                    <button class="btn btn-primary" onclick="DeviceManagerPage.refreshDevices(); if(typeof closeModal==='function') closeModal();" style="width:100%; justify-content:center;">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>`
            );
        } else {
            alert('يرجى تفعيل USB Debugging على الهاتف:\n1. الإعدادات > خيارات المطور\n2. تفعيل تصحيح USB\n3. قبول التصريح على الهاتف');
        }
    }

    function filterDevices(term) {
        _refreshDevices();
    }

    function filterByStatus(status) {
        _refreshDevices();
    }

    function _startAutoRefresh() {
        if (_refreshTimer) clearInterval(_refreshTimer);
        _refreshTimer = setInterval(_refreshDevices, 15000);
    }

    function destroy() {
        if (_refreshTimer) clearInterval(_refreshTimer);
        DeviceService.off('devicesLoaded', _onDevicesUpdate);
        DeviceService.off('liveUpdate', _onDevicesUpdate);
        DeviceService.off('deviceUpdated', _onSingleDeviceUpdate);
        DeviceService.off('deviceOffline', _onDeviceOffline);
    }

    return {
        render,
        refreshDevices,
        addSimDevice,
        removeSimDevice,
        showUsbDebugAlert,
        filterDevices,
        filterByStatus,
        destroy
    };
})();