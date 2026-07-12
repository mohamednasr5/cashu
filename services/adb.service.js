/**
 * ADB Service — خدمة إدارة اتصال ADB عبر WebSocket
 * يتواصل مع خادم ADB Bridge المحلي لاكتشاف وإدارة أجهزة Android
 * يدعم وضع المحاكاة عند عدم توفر الخادم
 * ============================================================
 */
'use strict';

const AdbService = (() => {

    const DEFAULT_WS_URL = 'ws://localhost:8765';
    let _ws = null;
    let _connected = false;
    let _reconnectTimer = null;
    let _devices = new Map();
    let _pollingTimer = null;
    let _simulationMode = false;
    let _onDeviceUpdate = null;
    let _onConnectionChange = null;
    const _eventHandlers = new Map();

    /**
     * تهيئة خدمة ADB
     * @param {Object} options
     * @param {string} [options.wsUrl] - رابط WebSocket
     * @param {Function} [options.onDeviceUpdate] - callback عند تحديث جهاز
     * @param {Function} [options.onConnectionChange] - callback عند تغيير حالة الاتصال
     */
    function init(options = {}) {
        if (options.onDeviceUpdate) _onDeviceUpdate = options.onDeviceUpdate;
        if (options.onConnectionChange) _onConnectionChange = options.onConnectionChange;

        _connectWebSocket(options.wsUrl || DEFAULT_WS_URL);

        // بدء الاستطلاع الاحتياطي كل 10 ثوانٍ
        _startPolling();
    }

    /**
     * الاتصال بخادم WebSocket
     */
    function _connectWebSocket(url) {
        try {
            _ws = new WebSocket(url);

            _ws.onopen = () => {
                _connected = true;
                _simulationMode = false;
                _emit('connectionChange', { connected: true, mode: 'live' });
                if (_onConnectionChange) _onConnectionChange(true, 'live');
                _requestDeviceList();
            };

            _ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    _handleMessage(msg);
                } catch (e) {
                    console.warn('[AdbService] رسالة غير صالحة:', e);
                }
            };

            _ws.onclose = () => {
                const wasConnected = _connected;
                _connected = false;
                _ws = null;
                if (wasConnected) {
                    _emit('connectionChange', { connected: false, mode: _simulationMode ? 'simulation' : 'disconnected' });
                    if (_onConnectionChange) _onConnectionChange(false, _simulationMode ? 'simulation' : 'disconnected');
                }
                // محاولة إعادة الاتصال
                _scheduleReconnect(url);
            };

            _ws.onerror = () => {
                // لا نفعّل المحاكاة تلقائياً - ننتظر التأكيد
                if (!_connected && !_simulationMode) {
                    console.info('[AdbService] لا يمكن الاتصال بخادم ADB - سيتم استخدام وضع المحاكاة');
                }
            };

            // مهلة الاتصال
            setTimeout(() => {
                if (!_connected && !_simulationMode) {
                    _enableSimulation();
                }
            }, 3000);

        } catch (e) {
            console.warn('[AdbService] فشل إنشاء WebSocket:', e);
            _enableSimulation();
        }
    }

    /**
     * تفعيل وضع المحاكاة
     */
    function _enableSimulation() {
        _simulationMode = true;
        _emit('connectionChange', { connected: false, mode: 'simulation' });
        if (_onConnectionChange) _onConnectionChange(false, 'simulation');
        console.info('[AdbService] وضع المحاكاة مفعّل');
    }

    /**
     * معالجة الرسائل الواردة من الخادم
     */
    function _handleMessage(msg) {
        switch (msg.type) {
            case 'device_list':
                _handleDeviceList(msg.devices);
                break;
            case 'device_added':
                _handleDeviceUpdate(msg.device);
                break;
            case 'device_removed':
                _devices.delete(msg.deviceId);
                _emit('deviceRemoved', { deviceId: msg.deviceId });
                break;
            case 'device_changed':
                _handleDeviceUpdate(msg.device);
                break;
            case 'usb_debugging_alert':
                _emit('usbDebuggingAlert', msg);
                break;
            default:
                console.log('[AdbService] رسالة غير معروفة:', msg.type);
        }
    }

    /**
     * معالجة قائمة الأجهزة
     */
    function _handleDeviceList(devices) {
        const now = Date.now();
        const oldIds = new Set(_devices.keys());

        devices.forEach(d => {
            const deviceData = {
                deviceId: d.serial || d.deviceId,
                name: d.model || d.name || 'جهاز غير معروف',
                status: d.state || 'device',
                battery: d.battery || Math.floor(Math.random() * 80 + 20),
                signal: d.signal || Math.floor(Math.random() * 5),
                androidVersion: d.version || d.androidVersion || 'غير متوفر',
                usbDebugging: d.usbDebugging !== false,
                connectionType: d.connectionType || 'USB',
                lastSeen: now,
                lastConnection: new Date(now).toLocaleString('ar-EG')
            };
            _devices.set(deviceData.deviceId, deviceData);
            oldIds.delete(deviceData.deviceId);
            if (_onDeviceUpdate) _onDeviceUpdate(deviceData);
        });

        // حذف الأجهزة المنفصلة
        oldIds.forEach(id => {
            _devices.delete(id);
            _emit('deviceRemoved', { deviceId: id });
        });

        _emit('deviceListUpdated', { devices: getAllDevices() });
    }

    /**
     * معالجة تحديث جهاز واحد
     */
    function _handleDeviceUpdate(d) {
        const now = Date.now();
        const existing = _devices.get(d.serial || d.deviceId) || {};
        const deviceData = {
            ...existing,
            deviceId: d.serial || d.deviceId,
            name: d.model || d.name || existing.name || 'جهاز غير معروف',
            status: d.state || existing.status || 'device',
            battery: d.battery ?? existing.battery ?? 0,
            signal: d.signal ?? existing.signal ?? 0,
            androidVersion: d.version || d.androidVersion || existing.androidVersion || 'غير متوفر',
            usbDebugging: d.usbDebugging ?? existing.usbDebugging ?? true,
            connectionType: d.connectionType || existing.connectionType || 'USB',
            lastSeen: now,
            lastConnection: new Date(now).toLocaleString('ar-EG')
        };
        _devices.set(deviceData.deviceId, deviceData);
        if (_onDeviceUpdate) _onDeviceUpdate(deviceData);
        _emit('deviceUpdated', { device: deviceData });
    }

    /**
     * طلب قائمة الأجهزة من الخادم
     */
    function _requestDeviceList() {
        _send({ type: 'get_devices' });
    }

    /**
     * إرسال رسالة للخادم
     */
    function _send(data) {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
            _ws.send(JSON.stringify(data));
        }
    }

    /**
     * جدولة إعادة الاتصال
     */
    function _scheduleReconnect(url) {
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        _reconnectTimer = setTimeout(() => {
            if (!_connected) _connectWebSocket(url);
        }, 10000);
    }

    /**
     * بدء الاستطلاع الدوري للأجهزة
     */
    function _startPolling() {
        if (_pollingTimer) clearInterval(_pollingTimer);
        _pollingTimer = setInterval(() => {
            if (_connected) {
                _requestDeviceList();
            } else if (_simulationMode) {
                _simulateDeviceUpdate();
            }
        }, 10000);
    }

    /**
     * محاكاة تحديث بيانات الأجهزة في وضع المحاكاة
     */
    function _simulateDeviceUpdate() {
        _devices.forEach((device) => {
            device.battery = Math.max(5, device.battery + Math.floor(Math.random() * 7 - 3));
            device.signal = Math.max(0, Math.min(4, device.signal + Math.floor(Math.random() * 3 - 1)));
            device.lastSeen = Date.now();
            device.lastConnection = new Date(device.lastSeen).toLocaleString('ar-EG');
            if (_onDeviceUpdate) _onDeviceUpdate(device);
        });
        _emit('deviceListUpdated', { devices: getAllDevices() });
    }

    /**
     * إضافة جهاز محاكي (للاختبار)
     */
    function addSimulatedDevice(deviceInfo = {}) {
        const now = Date.now();
        const id = deviceInfo.deviceId || 'SIM_' + Math.random().toString(36).substr(2, 8).toUpperCase();
        const device = {
            deviceId: id,
            name: deviceInfo.name || 'Samsung Galaxy S23',
            status: 'device',
            battery: deviceInfo.battery ?? Math.floor(Math.random() * 80 + 20),
            signal: deviceInfo.signal ?? Math.floor(Math.random() * 5),
            androidVersion: deviceInfo.androidVersion || '14',
            usbDebugging: deviceInfo.usbDebugging ?? true,
            connectionType: deviceInfo.connectionType || 'USB',
            lastSeen: now,
            lastConnection: new Date(now).toLocaleString('ar-EG'),
            simulated: true
        };
        _devices.set(id, device);
        if (_onDeviceUpdate) _onDeviceUpdate(device);
        _emit('deviceAdded', { device });
        _emit('deviceListUpdated', { devices: getAllDevices() });
        return device;
    }

    /**
     * إزالة جهاز محاكي
     */
    function removeSimulatedDevice(deviceId) {
        _devices.delete(deviceId);
        _emit('deviceRemoved', { deviceId });
        _emit('deviceListUpdated', { devices: getAllDevices() });
    }

    /**
     * الحصول على جميع الأجهزة
     * @returns {Array}
     */
    function getAllDevices() {
        return Array.from(_devices.values());
    }

    /**
     * الحصول على جهاز بالمعرف
     */
    function getDevice(deviceId) {
        return _devices.get(deviceId) || null;
    }

    /**
     * الحصول على عدد الأجهزة المتصلة
     */
    function getConnectedCount() {
        return getAllDevices().filter(d => d.status === 'device').length;
    }

    /**
     * الحصول على عدد الأجهزة غير المتصلة
     */
    function getDisconnectedCount() {
        return getAllDevices().filter(d => d.status !== 'device').length;
    }

    /**
     * الحصول على متوسط البطارية
     */
    function getAverageBattery() {
        const devices = getAllDevices();
        if (!devices.length) return 0;
        return Math.round(devices.reduce((sum, d) => sum + (d.battery || 0), 0) / devices.length);
    }

    /**
     * آخر الأجهزة اتصالاً
     */
    function getLatestConnected() {
        return getAllDevices()
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, 5);
    }

    /**
     * هل الخدمة في وضع المحاكاة
     */
    function isSimulationMode() {
        return _simulationMode;
    }

    /**
     * هل متصل بالخادم
     */
    function isConnected() {
        return _connected;
    }

    function on(event, handler) {
        if (!_eventHandlers.has(event)) _eventHandlers.set(event, new Set());
        _eventHandlers.get(event).add(handler);
        return () => _eventHandlers.get(event)?.delete(handler);
    }

    function off(event, handler) {
        _eventHandlers.get(event)?.delete(handler);
    }

    function _emit(event, data) {
        const handlers = _eventHandlers.get(event);
        if (handlers) handlers.forEach(h => { try { h(data); } catch(e) { console.error(e); } });
    }

    function cleanup() {
        if (_reconnectTimer) clearTimeout(_reconnectTimer);
        if (_pollingTimer) clearInterval(_pollingTimer);
        if (_ws) { try { _ws.close(); } catch(e) {} }
        _devices.clear();
        _eventHandlers.clear();
    }

    return {
        init,
        getAllDevices,
        getDevice,
        getConnectedCount,
        getDisconnectedCount,
        getAverageBattery,
        getLatestConnected,
        isSimulationMode,
        isConnected,
        addSimulatedDevice,
        removeSimulatedDevice,
        on,
        off,
        cleanup
    };
})();