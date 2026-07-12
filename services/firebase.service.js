/**
 * Firebase Service — خدمة الاتصال بقاعدة بيانات Firebase Realtime Database
 * يدير جميع عمليات القراءة والكتابة للأجهزة والمحافظ والخزينة والعمليات
 * ============================================================
 */
'use strict';

const FirebaseService = (() => {

    var _db = null;
    var _app = null;
    var _initialized = false;
    var _listeners = new Map();

    var FIREBASE_CONFIG = {
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

    function _loadFirebaseSDK() {
        return new Promise(function(resolve, reject) {
            if (typeof firebase !== 'undefined') { resolve(); return; }
            var script = document.createElement('script');
            script.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js';
            script.onload = function() {
                var dbScript = document.createElement('script');
                dbScript.src = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js';
                dbScript.onload = resolve;
                dbScript.onerror = function() { reject(new Error('فشل تحميل Firebase Database SDK')); };
                document.head.appendChild(dbScript);
            };
            script.onerror = function() { reject(new Error('فشل تحميل Firebase App SDK')); };
            document.head.appendChild(script);
        });
    }

    function _ref(path) {
        var currentUser = _getCurrentUser();
        if (!currentUser) return _db.ref(path);
        return _db.ref('users/' + currentUser + '/' + path);
    }

    function _getCurrentUser() {
        try {
            var usernameEl = document.getElementById('topbar-username');
            if (usernameEl && usernameEl.textContent) {
                return usernameEl.textContent.trim();
            }
            var stored = localStorage.getItem('vc_user') || localStorage.getItem('currentUser');
            if (stored) {
                try { return JSON.parse(stored).username; } catch(e) { return stored; }
            }
        } catch(e) {}
        return null;
    }

    // ==================== عمليات الأجهزة ====================

    async function saveDevice(deviceId, data) {
        await _ensureInit();
        try {
            var cleanData = Object.assign({}, data, { updatedAt: Date.now() });
            await _ref('devices/' + deviceId).set(cleanData);
            _emit('deviceUpdated', { deviceId: deviceId, data: cleanData });
            return { success: true, data: cleanData };
        } catch (error) {
            _emit('error', { source: 'saveDevice', error: error.message });
            return { success: false, error: error.message };
        }
    }

    async function deleteDevice(deviceId) {
        await _ensureInit();
        try {
            await _ref('devices/' + deviceId).remove();
            _emit('deviceDeleted', { deviceId: deviceId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function getAllDevices() {
        await _ensureInit();
        try {
            var snapshot = await _ref('devices').once('value');
            return snapshot.val() || {};
        } catch (error) {
            _emit('error', { source: 'getAllDevices', error: error.message });
            return {};
        }
    }

    function onDevicesChange(callback) {
        _ensureInit().then(function() {
            var listener = _ref('devices').on('value', function(snapshot) {
                callback(snapshot.val() || {});
            });
            _listeners.set('devices', function() { _ref('devices').off('value', listener); });
        });
        return function() {
            var unsub = _listeners.get('devices');
            if (unsub) unsub();
        };
    }

    // ==================== عمليات المحافظ ====================

    async function saveWallet(phoneId, data) {
        await _ensureInit();
        try {
            var cleanData = Object.assign({}, data, { updatedAt: Date.now() });
            await _ref('phones/' + phoneId).set(cleanData);
            _emit('walletUpdated', { phoneId: phoneId, data: cleanData });
            return { success: true, data: cleanData };
        } catch (error) {
            _emit('error', { source: 'saveWallet', error: error.message });
            return { success: false, error: error.message };
        }
    }

    async function deleteWallet(phoneId) {
        await _ensureInit();
        try {
            await _ref('phones/' + phoneId).remove();
            _emit('walletDeleted', { phoneId: phoneId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function getAllWallets() {
        await _ensureInit();
        try {
            var snapshot = await _ref('phones').once('value');
            return snapshot.val() || {};
        } catch (error) {
            _emit('error', { source: 'getAllWallets', error: error.message });
            return {};
        }
    }

    function onWalletsChange(callback) {
        _ensureInit().then(function() {
            var listener = _ref('phones').on('value', function(snapshot) {
                callback(snapshot.val() || {});
            });
            _listeners.set('wallets', function() { _ref('phones').off('value', listener); });
        });
        return function() {
            var unsub = _listeners.get('wallets');
            if (unsub) unsub();
        };
    }

    // ==================== عمليات الخزينة ====================

    async function getTreasury() {
        await _ensureInit();
        try {
            var snapshot = await _ref('treasury').once('value');
            var data = snapshot.val();
            return data || { total: 0, history: {} };
        } catch (error) {
            return { total: 0, history: {} };
        }
    }

    async function updateTreasury(amount, reason, phoneId) {
        await _ensureInit();
        try {
            var treasury = await getTreasury();
            var newTotal = (treasury.total || 0) + amount;
            var txId = 'TX_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

            var txRecord = {
                amount: amount,
                reason: reason || '',
                phoneId: phoneId || '',
                timestamp: Date.now(),
                balanceAfter: newTotal
            };

            // تحديث الخزينة
            await _ref('treasury/total').set(newTotal);
            await _ref('treasury/history/' + txId).set(txRecord);

            _emit('treasuryUpdated', { txId: txId, amount: amount, total: newTotal, reason: reason });
            return { success: true, txId: txId, total: newTotal };
        } catch (error) {
            _emit('error', { source: 'updateTreasury', error: error.message });
            return { success: false, error: error.message };
        }
    }

    function onTreasuryChange(callback) {
        _ensureInit().then(function() {
            var listener = _ref('treasury').on('value', function(snapshot) {
                callback(snapshot.val() || { total: 0, history: {} });
            });
            _listeners.set('treasury', function() { _ref('treasury').off('value', listener); });
        });
        return function() {
            var unsub = _listeners.get('treasury');
            if (unsub) unsub();
        };
    }

    // ==================== نظام الأحداث ====================

    var _eventHandlers = new Map();

    function on(event, handler) {
        if (!_eventHandlers.has(event)) _eventHandlers.set(event, new Set());
        _eventHandlers.get(event).add(handler);
        return function() { _eventHandlers.get(event) && _eventHandlers.get(event).delete(handler); };
    }

    function off(event, handler) {
        if (_eventHandlers.get(event)) _eventHandlers.get(event).delete(handler);
    }

    function _emit(event, data) {
        var handlers = _eventHandlers.get(event);
        if (handlers) handlers.forEach(function(h) { try { h(data); } catch(e) { console.error(e); } });
    }

    async function _ensureInit() {
        if (!_initialized) await init();
    }

    function cleanup() {
        _listeners.forEach(function(unsub) { try { unsub(); } catch(e) {} });
        _listeners.clear();
        _eventHandlers.clear();
    }

    return {
        init: init,
        on: on,
        off: off,
        cleanup: cleanup,
        saveDevice: saveDevice,
        deleteDevice: deleteDevice,
        getAllDevices: getAllDevices,
        onDevicesChange: onDevicesChange,
        saveWallet: saveWallet,
        deleteWallet: deleteWallet,
        getAllWallets: getAllWallets,
        onWalletsChange: onWalletsChange,
        getTreasury: getTreasury,
        updateTreasury: updateTreasury,
        onTreasuryChange: onTreasuryChange,
        _getCurrentUser: _getCurrentUser
    };
})();