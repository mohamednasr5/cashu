/**
 * لوحة تحكم الأجهزة — Device Dashboard Page
 * تعرض إحصائيات شاملة عن الأجهزة والمحافظ
 * ============================================================
 */
'use strict';

const DeviceDashboardPage = (() => {

    let _updateTimer = null;

    /**
     * عرض لوحة التحكم
     */
    function render() {
        const pageContent = document.getElementById('page-content');
        if (!pageContent) return;

        pageContent.innerHTML = getHTML();
        _bindEvents();
        _refreshAll();
        _startAutoRefresh();
    }

    /**
     * HTML الصفحة
     */
    function getHTML() {
        return `
        <div class="dd-page">
            <!-- بطاقات الإحصائيات -->
            <div class="dd-stats-grid">
                <div class="dd-stat-card" id="dd-stat-devices">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, #3b82f6, #1d4ed8);">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-devices">0</span>
                        <span class="dd-stat-label">إجمالي الأجهزة</span>
                    </div>
                </div>
                <div class="dd-stat-card" id="dd-stat-wallets">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, var(--red), var(--red-dark));">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-wallets">0</span>
                        <span class="dd-stat-label">إجمالي المحافظ</span>
                    </div>
                </div>
                <div class="dd-stat-card">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, #10b981, #059669);">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-online">0</span>
                        <span class="dd-stat-label">الأجهزة المتصلة</span>
                    </div>
                </div>
                <div class="dd-stat-card">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, #ef4444, #dc2626);">
                        <i class="fas fa-unlink"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-offline">0</span>
                        <span class="dd-stat-label">الأجهزة غير المتصلة</span>
                    </div>
                </div>
                <div class="dd-stat-card">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, #f59e0b, #d97706);">
                        <i class="fas fa-battery-three-quarters"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-battery">0%</span>
                        <span class="dd-stat-label">متوسط البطارية</span>
                    </div>
                </div>
                <div class="dd-stat-card">
                    <div class="dd-stat-icon" style="background:linear-gradient(135deg, #8b5cf6, #7c3aed);">
                        <i class="fas fa-coins"></i>
                    </div>
                    <div class="dd-stat-info">
                        <span class="dd-stat-value" id="dd-val-balance">0</span>
                        <span class="dd-stat-label">إجمالي الأرصدة (ج.م)</span>
                    </div>
                </div>
            </div>

            <!-- الصف الثاني: توزيع الشبكات + آخر الأجهزة -->
            <div class="dd-row">
                <!-- توزيع الشبكات -->
                <div class="dd-card">
                    <div class="dd-card-header">
                        <h3><i class="fas fa-chart-pie" style="color:var(--purple); margin-left:8px;"></i> توزيع المحافظ حسب الشبكة</h3>
                    </div>
                    <div class="dd-card-body">
                        <div class="dd-carrier-stats" id="dd-carrier-stats">
                            <p style="text-align:center; color:var(--text2); padding:30px;">جاري التحميل...</p>
                        </div>
                    </div>
                </div>

                <!-- آخر الأجهزة اتصالاً -->
                <div class="dd-card">
                    <div class="dd-card-header">
                        <h3><i class="fas fa-history" style="color:var(--info); margin-left:8px;"></i> آخر الأجهزة اتصالاً</h3>
                    </div>
                    <div class="dd-card-body">
                        <div class="dd-latest-list" id="dd-latest-devices">
                            <p style="text-align:center; color:var(--text2); padding:30px;">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- حالة اتصال ADB -->
            <div class="dd-card">
                <div class="dd-card-header">
                    <h3><i class="fas fa-server" style="color:var(--success); margin-left:8px;"></i> حالة الاتصال</h3>
                </div>
                <div class="dd-card-body">
                    <div class="dd-connection-info" id="dd-connection-info">
                        <p style="text-align:center; color:var(--text2); padding:20px;">جاري الفحص...</p>
                    </div>
                </div>
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
        DeviceService.on('devicesLoaded', _refreshAll);
        DeviceService.on('liveUpdate', _refreshAll);
        WalletService.on('walletsLoaded', _refreshAll);
        AdbService.on('connectionChange', _updateConnectionInfo);
    }

    /**
     * تحديث جميع البيانات
     */
    function _refreshAll() {
        _updateDeviceStats();
        _updateWalletStats();
        _updateCarrierStats();
        _updateLatestDevices();
        _updateConnectionInfo();
    }

    /**
     * تحديث إحصائيات الأجهزة
     */
    function _updateDeviceStats() {
        const stats = DeviceService.getStats();
        _setStatValue('dd-val-devices', stats.total);
        _setStatValue('dd-val-online', stats.online);
        _setStatValue('dd-val-offline', stats.offline);
        _setStatValue('dd-val-battery', stats.avgBattery + '%');
    }

    /**
     * تحديث إحصائيات المحافظ
     */
    function _updateWalletStats() {
        const stats = WalletService.getStats();
        _setStatValue('dd-val-wallets', stats.total);
        _setStatValue('dd-val-balance', parseFloat(stats.totalBalance).toLocaleString('ar-EG'));
    }

    /**
     * تحديث توزيع الشبكات
     */
    function _updateCarrierStats() {
        const container = document.getElementById('dd-carrier-stats');
        if (!container) return;

        const carriers = WalletService.getCarriers();
        const stats = WalletService.getStats();
        const total = stats.total || 1;

        let html = '<div class="dd-carrier-bars">';
        carriers.forEach(c => {
            const count = stats.byCarrier[c.id] || 0;
            const pct = Math.round((count / total) * 100);
            html += `
            <div class="dd-carrier-item">
                <div class="dd-carrier-label">
                    <span class="dd-carrier-dot" style="background:${c.color}"></span>
                    <span>${c.label}</span>
                </div>
                <div class="dd-carrier-bar-track">
                    <div class="dd-carrier-bar-fill" style="width:${pct}%; background:${c.color}"></div>
                </div>
                <div class="dd-carrier-count">${count} (${pct}%)</div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * تحديث آخر الأجهزة اتصالاً
     */
    function _updateLatestDevices() {
        const container = document.getElementById('dd-latest-devices');
        if (!container) return;

        const latest = DeviceService.getStats().latest;

        if (!latest.length) {
            container.innerHTML = '<p style="text-align:center; color:var(--text2); padding:30px;">لا توجد أجهزة مسجلة</p>';
            return;
        }

        let html = '<div class="dd-latest-items">';
        latest.forEach((d, i) => {
            const isOnline = d.status === 'device' || d.status === 'online';
            const timeAgo = _timeAgo(d.lastSeen);
            html += `
            <div class="dd-latest-item ${isOnline ? 'online' : 'offline'}">
                <div class="dd-latest-rank">${i + 1}</div>
                <div class="dd-latest-info">
                    <span class="dd-latest-name">${d.deviceName || 'غير معروف'}</span>
                    <span class="dd-latest-id">${d.deviceId || '-'}</span>
                </div>
                <div class="dd-latest-meta">
                    <span class="dm-status ${isOnline ? 'status-online' : 'status-offline'}" style="font-size:11px;">
                        <i class="fas fa-${isOnline ? 'check' : 'times'}-circle"></i>
                        ${isOnline ? 'متصل' : 'غير متصل'}
                    </span>
                    <span class="dd-latest-time">${timeAgo}</span>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * تحديث حالة الاتصال
     */
    function _updateConnectionInfo() {
        const container = document.getElementById('dd-connection-info');
        if (!container) return;

        const isConnected = AdbService.isConnected();
        const isSim = AdbService.isSimulationMode();
        const deviceCount = AdbService.getAllDevices().length;

        const statusColor = isConnected ? 'var(--success)' : isSim ? 'var(--warning)' : 'var(--text3)';
        const statusText = isConnected ? 'متصل بالخادم' : isSim ? 'وضع المحاكاة' : 'غير متصل';
        const statusIcon = isConnected ? 'check-circle' : isSim ? 'flask' : 'times-circle';

        container.innerHTML = `
        <div class="dd-conn-grid">
            <div class="dd-conn-item">
                <span class="dd-conn-label">حالة الخادم</span>
                <span class="dd-conn-value" style="color:${statusColor}">
                    <i class="fas fa-${statusIcon}"></i> ${statusText}
                </span>
            </div>
            <div class="dd-conn-item">
                <span class="dd-conn-label">الأجهزة المكتشفة</span>
                <span class="dd-conn-value">${deviceCount}</span>
            </div>
            <div class="dd-conn-item">
                <span class="dd-conn-label">نوع الاتصال</span>
                <span class="dd-conn-value">${isConnected ? 'WebSocket مباشر' : isSim ? 'محاكاة محلية' : 'غير متاح'}</span>
            </div>
            <div class="dd-conn-item">
                <span class="dd-conn-label">آخر تحديث</span>
                <span class="dd-conn-value">${new Date().toLocaleTimeString('ar-EG')}</span>
            </div>
        </div>
        ${!isConnected && !isSim ? `
        <div style="margin-top:16px; padding:14px; background:rgba(230,0,18,0.06); border:1px solid rgba(230,0,18,0.15); border-radius:var(--radius-sm); text-align:center;">
            <p style="font-size:13px; color:var(--text2); margin-bottom:8px;">
                <i class="fas fa-info-circle" style="color:var(--info); margin-left:4px;"></i>
                لتشغيل الاتصال المباشر بالأجهزة، يرجى تشغيل خادم ADB Bridge
            </p>
            <code style="font-size:11px; color:var(--text3); background:var(--bg3); padding:4px 10px; border-radius:6px;" dir="ltr">
                node server/adb-bridge.js
            </code>
        </div>` : ''}`;
    }

    /**
     * تعيين قيمة بطاقة إحصائية مع أنيميشن
     */
    function _setStatValue(elementId, value) {
        const el = document.getElementById(elementId);
        if (el && el.textContent !== String(value)) {
            el.textContent = value;
            el.style.transform = 'scale(1.15)';
            setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
        }
    }

    /**
     * حساب الوقت النسبي
     */
    function _timeAgo(timestamp) {
        if (!timestamp) return 'غير متوفر';
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'الآن';
        if (mins < 60) return `منذ ${mins} دقيقة`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `منذ ${hours} ساعة`;
        const days = Math.floor(hours / 24);
        return `منذ ${days} يوم`;
    }

    function _startAutoRefresh() {
        if (_updateTimer) clearInterval(_updateTimer);
        _updateTimer = setInterval(_refreshAll, 15000);
    }

    function destroy() {
        if (_updateTimer) clearInterval(_updateTimer);
        DeviceService.off('devicesLoaded', _refreshAll);
        DeviceService.off('liveUpdate', _refreshAll);
        WalletService.off('walletsLoaded', _refreshAll);
        AdbService.off('connectionChange', _updateConnectionInfo);
    }

    return {
        render,
        destroy
    };
})();