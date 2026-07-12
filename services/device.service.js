/**
 * Device Service — خدمة إدارة حالة الأجهزة ومزامنتها مع Firebase
 * تعمل كطبقة وسيطة بين ADB Service و Firebase Service
 * ============================================================
 */
'use strict';

const DeviceService = (() => {

    let _devicesCache = {};
    let _initialized = false;
    let _unsubscribeDevices = null;
    const _eventHandlers = new Map();

    /**
     * تهيئة خدمة الأجهزة
     */
    async function init() {
        if (_initialized) return;
        _initialized = true;

        // الاستماع لتحديثات ADB
        AdbService.on('deviceListUpdated', _handleAdbUpdate);
        AdbService.on('deviceAdded', _handleAdbDeviceEvent);
        AdbService.on('deviceUpdated', _handleAdbDeviceEvent);
        AdbService.on('deviceRemoved', _handleAdbDeviceRemoved);

        // الاستماع لتحديثات Firebase
        _unsubscribeDevices = FirebaseService.onDevicesChange((devices) => {
            _devicesCache = devices || {};
            _emit('devicesLoaded', { devices: _devicesCache });
        });

        // تحميل البيانات الأولية من Firebase
        const savedDevices = await FirebaseService.getAllDevices();
        _devicesCache = savedDevices;

        // مزامنة الأجهزة النشطة مع Firebase
        _syncAdbDevicesToFirebase();

        _emit('initialized', {});
    }

    /**
     * معالجة تحديث قائمة ADB
     */
    function _handleAdbUpdate({ devices }) {
        if (!devices || !devices.length) return;
        devices.forEach(device => {
            _saveDeviceToFirebase(device);
        });
        _emit('liveUpdate', { devices });
    }

    function _handleAdbDeviceEvent({ device }) {
        if (device) _saveDeviceToFirebase(device);
    }

    function _handleAdbDeviceRemoved({ deviceId }) {
        if (_devicesCache[deviceId]) {
            _devicesCache[deviceId].status = 'offline';
            FirebaseService.saveDevice(deviceId, _devicesCache[deviceId]);
            _emit('deviceOffline', { deviceId });
        }
    }

    /**
     * حفظ بيانات الجهاز في Firebase
     */
    async function _saveDeviceToFirebase(device) {
        if (!device || !device.deviceId) return;
        const existing = _devicesCache[device.deviceId] || {};
        const merged = {
            deviceId: device.deviceId,
            deviceName: device.name || existing.deviceName || 'غير معروف',
            status: device.status || existing.status || 'offline',
            battery: device.battery ?? existing.battery ?? 0,
            signal: device.signal ?? existing.signal ?? 0,
            connectionType: device.connectionType || existing.connectionType || 'USB',
            androidVersion: device.androidVersion || existing.androidVersion || 'غير متوفر',
            usbDebugging: device.usbDebugging ?? existing.usbDebugging ?? true,
            lastSeen: device.lastSeen || Date.now(),
            lastConnection: device.lastConnection || new Date().toLocaleString('ar-EG')
        };
        _devicesCache[device.deviceId] = merged;
        await FirebaseService.saveDevice(device.deviceId, merged);
    }

    /**
     * مزامنة أجهزة ADB الحالية مع Firebase
     */
    function _syncAdbDevicesToFirebase() {
        const adbDevices = AdbService.getAllDevices();
        adbDevices.forEach(device => _saveDeviceToFirebase(device));
    }

    /**
     * الحصول على جميع الأجهزة من الكاش
     */
    function getAllDevices() {
        return Object.values(_devicesCache);
    }

    /**
     * الحصول على جهاز بالمعرف
     */
    function getDevice(deviceId) {
        return _devicesCache[deviceId] || null;
    }

    /**
     * إحصائيات الأجهزة
     */
    function getStats() {
        const devices = Object.values(_devicesCache);
        const online = devices.filter(d => d.status === 'device' || d.status === 'online');
        const offline = devices.filter(d => d.status !== 'device' && d.status !== 'online');
        const totalBattery = online.reduce((s, d) => s + (d.battery || 0), 0);
        const avgBattery = online.length ? Math.round(totalBattery / online.length) : 0;
        const latest = [...devices]
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, 5);

        return {
            total: devices.length,
            online: online.length,
            offline: offline.length,
            avgBattery,
            latest
        };
    }

    /**
     * حذف جهاز من Firebase والكاش
     */
    async function deleteDevice(deviceId) {
        delete _devicesCache[deviceId];
        await FirebaseService.deleteDevice(deviceId);
        _emit('deviceDeleted', { deviceId });
    }

    /**
     * تحديث بيانات جهاز يدوياً
     */
    async function updateDevice(deviceId, updates) {
        const existing = _devicesCache[deviceId] || {};
        const merged = { ...existing, ...updates, updatedAt: Date.now() };
        _devicesCache[deviceId] = merged;
        await FirebaseService.saveDevice(deviceId, merged);
        _emit('deviceUpdated', { deviceId, device: merged });
        return merged;
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
        if (_unsubscribeDevices) _unsubscribeDevices();
        _devicesCache = {};
        _initialized = false;
        _eventHandlers.clear();
    }

    return {
        init,
        getAllDevices,
        getDevice,
        getStats,
        deleteDevice,
        updateDevice,
        on,
        off,
        cleanup
    };
})();