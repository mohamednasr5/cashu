/**
 * لوحة تحكم الأجهزة — Device Dashboard Page
 * تعرض إحصائيات شاملة عن الأجهزة والمحافظ والخزينة
 * ============================================================
 */
'use strict';

const DeviceDashboardPage = (() => {

    var _updateTimer = null;

    /**
     * عرض لوحة التحكم
     */
    function render() {
        var pageContent = document.getElementById('page-content');
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
        return '<div class="dd-page">' +

        /* ===== بطاقات الإحصائيات — 7 بطاقات ===== */
        '<div class="dd-stats-grid">' +
            _statCard('dd-stat-devices', 'fa-mobile-alt', '#3b82f6, #1d4ed8', 'dd-val-devices', '0', 'إجمالي الأجهزة') +
            _statCard('dd-stat-wallets', 'fa-wallet', 'var(--red), var(--red-dark)', 'dd-val-wallets', '0', 'إجمالي المحافظ') +
            _statCard('dd-stat-treasury', 'fa-vault', '#10b981, #059669', 'dd-val-treasury', '0', 'رصيد الخزينة (ج.م)') +
            _statCard('dd-stat-online', 'fa-link', '#3b82f6, #1d4ed8', 'dd-val-online', '0', 'الأجهزة المتصلة') +
            _statCard('dd-stat-offline', 'fa-unlink', '#ef4444, #dc2626', 'dd-val-offline', '0', 'الأجهزة غير المتصلة') +
            _statCard('dd-stat-battery', 'fa-battery-three-quarters', '#f59e0b, #d97706', 'dd-val-battery', '0%', 'متوسط البطارية') +
            _statCard('dd-stat-balance', 'fa-coins', '#8b5cf6, #7c3aed', 'dd-val-balance', '0', 'إجمالي أرصدة المحافظ (ج.م)') +
        '</div>' +

        /* ===== الصف الثاني: توزيع الشبكات + آخر العمليات ===== */
        '<div class="dd-row">' +
            '<div class="dd-card">' +
                '<div class="dd-card-header">' +
                    '<h3><i class="fas fa-chart-pie" style="color:var(--purple); margin-left:8px;"></i> توزيع المحافظ حسب الشبكة</h3>' +
                '</div>' +
                '<div class="dd-card-body">' +
                    '<div class="dd-carrier-stats" id="dd-carrier-stats"><p style="text-align:center; color:var(--text2); padding:30px;">جاري التحميل...</p></div>' +
                '</div>' +
            '</div>' +

            '<div class="dd-card">' +
                '<div class="dd-card-header">' +
                    '<h3><i class="fas fa-history" style="color:var(--info); margin-left:8px;"></i> آخر الأجهزة اتصالاً</h3>' +
                '</div>' +
                '<div class="dd-card-body">' +
                    '<div class="dd-latest-list" id="dd-latest-devices"><p style="text-align:center; color:var(--text2); padding:30px;">جاري التحميل...</p></div>' +
                '</div>' +
            '</div>' +
        '</div>' +

        /* ===== حالة اتصال ADB ===== */
        '<div class="dd-card">' +
            '<div class="dd-card-header">' +
                '<h3><i class="fas fa-server" style="color:var(--success); margin-left:8px;"></i> حالة الاتصال</h3>' +
            '</div>' +
            '<div class="dd-card-body">' +
                '<div class="dd-connection-info" id="dd-connection-info"><p style="text-align:center; color:var(--text2); padding:20px;">جاري الفحص...</p></div>' +
            '</div>' +
        '</div>' +

        /* التوقيع */
        '<div class="dm-footer">' +
            '<span>برمجة وتطوير <span class="dm-heart">&#10084;&#65039;</span> محمد حماد</span>' +
            '<a href="https://www.facebook.com/en.mohamed.nasr" target="_blank" rel="noopener"><i class="fab fa-facebook"></i></a>' +
        '</div>' +
        '</div>';
    }

    function _statCard(id, icon, colors, valueId, value, label) {
        return '<div class="dd-stat-card" id="' + id + '">' +
            '<div class="dd-stat-icon" style="background:linear-gradient(135deg, ' + colors + ');">' +
                '<i class="fas ' + icon + '"></i>' +
            '</div>' +
            '<div class="dd-stat-info">' +
                '<span class="dd-stat-value" id="' + valueId + '">' + value + '</span>' +
                '<span class="dd-stat-label">' + label + '</span>' +
            '</div>' +
        '</div>';
    }

    /**
     * ربط الأحداث
     */
    function _bindEvents() {
        DeviceService.on('devicesLoaded', _refreshAll);
        DeviceService.on('liveUpdate', _refreshAll);
        WalletService.on('walletsLoaded', _refreshAll);
        WalletService.on('treasuryUpdated', _refreshAll);
        AdbService.on('connectionChange', _updateConnectionInfo);
    }

    /**
     * تحديث جميع البيانات
     */
    function _refreshAll() {
        _updateDeviceStats();
        _updateWalletStats();
        _updateTreasuryStats();
        _updateCarrierStats();
        _updateLatestDevices();
        _updateConnectionInfo();
    }

    /**
     * تحديث إحصائيات الأجهزة
     */
    function _updateDeviceStats() {
        var stats = DeviceService.getStats();
        _setStatValue('dd-val-devices', stats.total);
        _setStatValue('dd-val-online', stats.online);
        _setStatValue('dd-val-offline', stats.offline);
        _setStatValue('dd-val-battery', stats.avgBattery + '%');
    }

    /**
     * تحديث إحصائيات المحافظ
     */
    function _updateWalletStats() {
        var stats = WalletService.getStats();
        _setStatValue('dd-val-wallets', stats.total);
        _setStatValue('dd-val-balance', parseFloat(stats.totalBalance).toLocaleString('ar-EG'));
    }

    /**
     * تحديث إحصائيات الخزينة
     */
    function _updateTreasuryStats() {
        var treasury = WalletService.getTreasury();
        var total = parseFloat(treasury.total) || 0;
        _setStatValue('dd-val-treasury', total.toLocaleString('ar-EG', { minimumFractionDigits: 2 }));
    }

    /**
     * تحديث توزيع الشبكات
     */
    function _updateCarrierStats() {
        var container = document.getElementById('dd-carrier-stats');
        if (!container) return;

        var carriers = WalletService.getCarriers();
        var stats = WalletService.getStats();
        var total = stats.total || 1;

        var html = '<div class="dd-carrier-bars">';
        carriers.forEach(function(c) {
            var count = stats.byCarrier[c.id] || 0;
            var pct = Math.round((count / total) * 100);
            html += '<div class="dd-carrier-item">' +
                '<div class="dd-carrier-label">' +
                    '<span class="dd-carrier-dot" style="background:' + c.color + '"></span>' +
                    '<span>' + c.label + '</span>' +
                '</div>' +
                '<div class="dd-carrier-bar-track">' +
                    '<div class="dd-carrier-bar-fill" style="width:' + pct + '%; background:' + c.color + '"></div>' +
                '</div>' +
                '<div class="dd-carrier-count">' + count + ' (' + pct + '%)</div>' +
            '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * تحديث آخر الأجهزة اتصالاً
     */
    function _updateLatestDevices() {
        var container = document.getElementById('dd-latest-devices');
        if (!container) return;

        var latest = DeviceService.getStats().latest;

        if (!latest || !latest.length) {
            container.innerHTML = '<p style="text-align:center; color:var(--text2); padding:30px;">لا توجد أجهزة مسجلة</p>';
            return;
        }

        var html = '<div class="dd-latest-items">';
        latest.forEach(function(d, i) {
            var isOnline = d.status === 'device' || d.status === 'online';
            var timeAgo = _timeAgo(d.lastSeen);
            html += '<div class="dd-latest-item ' + (isOnline ? 'online' : 'offline') + '">' +
                '<div class="dd-latest-rank">' + (i + 1) + '</div>' +
                '<div class="dd-latest-info">' +
                    '<span class="dd-latest-name">' + (d.deviceName || 'غير معروف') + '</span>' +
                    '<span class="dd-latest-id">' + (d.deviceId || '-') + '</span>' +
                '</div>' +
                '<div class="dd-latest-meta">' +
                    '<span class="dm-status ' + (isOnline ? 'status-online' : 'status-offline') + '" style="font-size:11px;">' +
                        '<i class="fas fa-' + (isOnline ? 'check' : 'times') + '-circle"></i> ' +
                        (isOnline ? 'متصل' : 'غير متصل') +
                    '</span>' +
                    '<span class="dd-latest-time">' + timeAgo + '</span>' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    /**
     * تحديث حالة الاتصال
     */
    function _updateConnectionInfo() {
        var container = document.getElementById('dd-connection-info');
        if (!container) return;

        var isConnected = AdbService.isConnected();
        var isSim = AdbService.isSimulationMode();
        var deviceCount = AdbService.getAllDevices().length;

        var statusColor = isConnected ? 'var(--success)' : isSim ? 'var(--warning)' : 'var(--text3)';
        var statusText = isConnected ? 'متصل بالخادم' : isSim ? 'وضع المحاكاة' : 'غير متصل';
        var statusIcon = isConnected ? 'check-circle' : isSim ? 'flask' : 'times-circle';

        var connType = isConnected ? 'WebSocket مباشر' : isSim ? 'محاكاة محلية' : 'غير متاح';

        container.innerHTML = '<div class="dd-conn-grid">' +
            '<div class="dd-conn-item"><span class="dd-conn-label">حالة الخادم</span><span class="dd-conn-value" style="color:' + statusColor + '"><i class="fas fa-' + statusIcon + '"></i> ' + statusText + '</span></div>' +
            '<div class="dd-conn-item"><span class="dd-conn-label">الأجهزة المكتشفة</span><span class="dd-conn-value">' + deviceCount + '</span></div>' +
            '<div class="dd-conn-item"><span class="dd-conn-label">نوع الاتصال</span><span class="dd-conn-value">' + connType + '</span></div>' +
            '<div class="dd-conn-item"><span class="dd-conn-label">آخر تحديث</span><span class="dd-conn-value">' + new Date().toLocaleTimeString('ar-EG') + '</span></div>' +
        '</div>' +
        (!isConnected && !isSim ?
        '<div style="margin-top:16px; padding:14px; background:rgba(230,0,18,0.06); border:1px solid rgba(230,0,18,0.15); border-radius:var(--radius-sm); text-align:center;">' +
            '<p style="font-size:13px; color:var(--text2); margin-bottom:8px;"><i class="fas fa-info-circle" style="color:var(--info); margin-left:4px;"></i> لتشغيل الاتصال المباشر بالأجهزة، يرجى تشغيل خادم ADB Bridge</p>' +
            '<code style="font-size:11px; color:var(--text3); background:var(--bg3); padding:4px 10px; border-radius:6px;" dir="ltr">node server/adb-bridge.js</code>' +
        '</div>' : '');
    }

    function _setStatValue(elementId, value) {
        var el = document.getElementById(elementId);
        if (el && el.textContent !== String(value)) {
            el.textContent = value;
            el.style.transform = 'scale(1.15)';
            setTimeout(function() { el.style.transform = 'scale(1)'; }, 200);
        }
    }

    function _timeAgo(timestamp) {
        if (!timestamp) return 'غير متوفر';
        var diff = Date.now() - timestamp;
        var mins = Math.floor(diff / 60000);
        if (mins < 1) return 'الآن';
        if (mins < 60) return 'منذ ' + mins + ' دقيقة';
        var hours = Math.floor(mins / 60);
        if (hours < 24) return 'منذ ' + hours + ' ساعة';
        var days = Math.floor(hours / 24);
        return 'منذ ' + days + ' يوم';
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
        WalletService.off('treasuryUpdated', _refreshAll);
        AdbService.off('connectionChange', _updateConnectionInfo);
    }

    return {
        render: render,
        destroy: destroy
    };
})();