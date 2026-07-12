/**
 * Firebase Service — خدمة الاتصال بقاعدة بيانات Firebase Realtime Database
 * يدير جميع عمليات القراءة والكتابة للحصول على بيانات الأجهزة والمحافظ
 * ============================================================
 */
'use strict';

const FirebaseService = (() => {

    let _db = null;
    let _app = null;
    let _initialized = false;
    let _listeners = new Map();

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyA0npWMzuk2eD1qilckDTET-nN3o0iPWmg",
        authDomain: "hammad-3fea4.firebaseapp.com",
        databaseURL: "https://hammad-3fea4-default-rtdb.firebaseio.com",
        projectId: "hammad-3fea4",
        storageBucket: "hammad-3fea4.firebasestorage.app",
        messagingSenderId: "706588452002",
        appId: "1:706588452002:web:9939aa5fd52bb5cc00e3fb",
        measurementId: "G-5YXX1H0K68"
    };

    /**
     * تهيئة اتصال Firebase
     * @returns {Promise<boolean>}
     */
    async function init() {
        if (_initialized && _db) return true;
        try {
            if (typeof firebase === 'undefined') {
                await _loadFirebaseSDK();
            }
            if (!firebase.apps.length) {
                _app = firebase.initializeApp(FIREBASE_CONFIG);
            } else {
                _app = firebase.apps[0];
            }
            _db = firebase.database();
            _initialized = true;
            _emit('initialized', { success: true });
            return true;
        } catch (error) {
            console.error('[FirebaseService] فشل التهيئة:', error);
            _emit('error', { source: 'init', error: error.message });
            return false;
        }
    }

    /**
     * تحميل Firebase SDK ديناميكياً
     */
    function _loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            if (typeof firebase !== 'undefined') { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
            script.onload = () => {
                const dbScript = document.createElement('script');
                dbScript.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js';
                dbScript.onload = resolve;
                dbScript.onerror = () => reject(new Error('فشل تحميل Firebase Database SDK'));
                document.head.appendChild(dbScript);
            };
            script.onerror = () => reject(new Error('فشل تحميل Firebase App SDK'));
            document.head.appendChild(script);
        });
    }

    /**
     * الحصول على مرجع لقاعدة البيانات مع مسار المستخدم
     * @param {string} path
     * @returns {firebase.database.Reference}
     */
    function _ref(path) {
        const currentUser = _getCurrentUser();
        if (!currentUser) return _db.ref(path);
        return _db.ref(`users/${currentUser}/${path}`);
    }

    /**
     * الحصول على اسم المستخدم الحالي من النظام
     */
    function _getCurrentUser() {
        try {
            const usernameEl = document.getElementById('topbar-username');
            if (usernameEl && usernameEl.textContent) {
                return usernameEl.textContent.trim();
            }
            const stored = localStorage.getItem('vc_user') || localStorage.getItem('currentUser');
            if (stored) {
                try { return JSON.parse(stored).username; } catch(e) { return stored; }
            }
        } catch(e) {}
        return null;
    }

    // ==================== عمليات الأجهزة ====================

    /**
     * حفظ أو تحديث بيانات جهاز
     * @param {string} deviceId
     * @param {Object} data
     */
    async function saveDevice(deviceId, data) {
        await _ensureInit();
        try {
            const cleanData = { ...data, updatedAt: Date.now() };
            await _ref(`devices/${deviceId}`).set(cleanData);
            _emit('deviceUpdated', { deviceId, data: cleanData });
            return { success: true, data: cleanData };
        } catch (error) {
            _emit('error', { source: 'saveDevice', error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف جهاز
     * @param {string} deviceId
     */
    async function deleteDevice(deviceId) {
        await _ensureInit();
        try {
            await _ref(`devices/${deviceId}`).remove();
            _emit('deviceDeleted', { deviceId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * الحصول على جميع الأجهزة
     * @returns {Promise<Object>}
     */
    async function getAllDevices() {
        await _ensureInit();
        try {
            const snapshot = await _ref('devices').once('value');
            return snapshot.val() || {};
        } catch (error) {
            _emit('error', { source: 'getAllDevices', error: error.message });
            return {};
        }
    }

    /**
     * الاستماع لتغييرات الأجهزة في الوقت الفعلي
     * @param {Function} callback
     * @returns {Function} إلغاء الاشتراك
     */
    function onDevicesChange(callback) {
        _ensureInit().then(() => {
            const listener = _ref('devices').on('value', (snapshot) => {
                callback(snapshot.val() || {});
            });
            _listeners.set('devices', () => _ref('devices').off('value', listener));
        });
        return () => {
            const unsub = _listeners.get('devices');
            if (unsub) unsub();
        };
    }

    // ==================== عمليات المحافظ ====================

    /**
     * حفظ أو تحديث محفظة
     * @param {string} phoneId
     * @param {Object} data
     */
    async function saveWallet(phoneId, data) {
        await _ensureInit();
        try {
            const cleanData = { ...data, updatedAt: Date.now() };
            await _ref(`phones/${phoneId}`).set(cleanData);
            _emit('walletUpdated', { phoneId, data: cleanData });
            return { success: true, data: cleanData };
        } catch (error) {
            _emit('error', { source: 'saveWallet', error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف محفظة
     * @param {string} phoneId
     */
    async function deleteWallet(phoneId) {
        await _ensureInit();
        try {
            await _ref(`phones/${phoneId}`).remove();
            _emit('walletDeleted', { phoneId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * الحصول على جميع المحافظ
     * @returns {Promise<Object>}
     */
    async function getAllWallets() {
        await _ensureInit();
        try {
            const snapshot = await _ref('phones').once('value');
            return snapshot.val() || {};
        } catch (error) {
            _emit('error', { source: 'getAllWallets', error: error.message });
            return {};
        }
    }

    /**
     * الاستماع لتغييرات المحافظ في الوقت الفعلي
     * @param {Function} callback
     * @returns {Function} إلغاء الاشتراك
     */
    function onWalletsChange(callback) {
        _ensureInit().then(() => {
            const listener = _ref('phones').on('value', (snapshot) => {
                callback(snapshot.val() || {});
            });
            _listeners.set('wallets', () => _ref('phones').off('value', listener));
        });
        return () => {
            const unsub = _listeners.get('wallets');
            if (unsub) unsub();
        };
    }

    // ==================== نظام الأحداث ====================

    const _eventHandlers = new Map();

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

    async function _ensureInit() {
        if (!_initialized) await init();
    }

    /**
     * تنظيف جميع الاشتراكات
     */
    function cleanup() {
        _listeners.forEach(unsub => { try { unsub(); } catch(e) {} });
        _listeners.clear();
        _eventHandlers.clear();
    }

    return {
        init,
        on,
        off,
        cleanup,
        saveDevice,
        deleteDevice,
        getAllDevices,
        onDevicesChange,
        saveWallet,
        deleteWallet,
        getAllWallets,
        onWalletsChange,
        _getCurrentUser
    };
})();