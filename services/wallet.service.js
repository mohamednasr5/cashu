/**
 * Wallet Service — خدمة إدارة أرقام المحافظ والشبكات
 * يدير جميع عمليات CRUD للمحافظ مع Firebase Realtime Database
 * ============================================================
 */
'use strict';

const WalletService = (() => {

    let _walletsCache = {};
    let _initialized = false;
    let _unsubscribeWallets = null;
    const _eventHandlers = new Map();

    const CARRIERS = [
        { id: 'vodafone', label: 'Vodafone', color: '#e60012' },
        { id: 'orange', label: 'Orange', color: '#ff6600' },
        { id: 'etisalat', label: 'Etisalat', color: '#0645AD' },
        { id: 'we', label: 'WE', color: '#7c3aed' }
    ];

    /**
     * تهيئة خدمة المحافظ
     */
    async function init() {
        if (_initialized) return;
        _initialized = true;

        // الاستماع لتحديثات Firebase
        _unsubscribeWallets = FirebaseService.onWalletsChange((wallets) => {
            _walletsCache = wallets || {};
            _emit('walletsLoaded', { wallets: _walletsCache });
        });

        // تحميل البيانات الأولية
        _walletsCache = await FirebaseService.getAllWallets();
        _emit('initialized', { count: Object.keys(_walletsCache).length });
    }

    /**
     * إضافة محفظة جديدة
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async function addWallet(data) {
        const phoneId = 'PH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const wallet = {
            deviceId: data.deviceId || '',
            phoneNumber: data.phoneNumber || '',
            carrier: data.carrier || 'vodafone',
            walletName: data.walletName || '',
            balance: parseFloat(data.balance) || 0,
            dailyLimit: parseFloat(data.dailyLimit) || 0,
            monthlyLimit: parseFloat(data.monthlyLimit) || 0,
            status: data.status || 'online',
            battery: data.battery || 0,
            signal: data.signal || 0,
            lastSeen: Date.now(),
            notes: data.notes || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const result = await FirebaseService.saveWallet(phoneId, wallet);
        if (result.success) {
            _walletsCache[phoneId] = wallet;
            _emit('walletAdded', { phoneId, wallet });
        }
        return { ...result, phoneId, wallet };
    }

    /**
     * تحديث محفظة موجودة
     * @param {string} phoneId
     * @param {Object} updates
     */
    async function updateWallet(phoneId, updates) {
        const existing = _walletsCache[phoneId];
        if (!existing) return { success: false, error: 'المحفظة غير موجودة' };

        const merged = { ...existing, ...updates, updatedAt: Date.now() };
        const result = await FirebaseService.saveWallet(phoneId, merged);
        if (result.success) {
            _walletsCache[phoneId] = merged;
            _emit('walletUpdated', { phoneId, wallet: merged });
        }
        return result;
    }

    /**
     * حذف محفظة
     * @param {string} phoneId
     */
    async function deleteWallet(phoneId) {
        const result = await FirebaseService.deleteWallet(phoneId);
        if (result.success) {
            delete _walletsCache[phoneId];
            _emit('walletDeleted', { phoneId });
        }
        return result;
    }

    /**
     * الحصول على جميع المحافظ
     * @returns {Array}
     */
    function getAllWallets() {
        return Object.entries(_walletsCache).map(([id, w]) => ({ phoneId: id, ...w }));
    }

    /**
     * الحصول على محفظة بالمعرف
     */
    function getWallet(phoneId) {
        return _walletsCache[phoneId] ? { phoneId, ..._walletsCache[phoneId] } : null;
    }

    /**
     * الحصول على المحافظ حسب الشبكة
     */
    function getWalletsByCarrier(carrierId) {
        return getAllWallets().filter(w => w.carrier === carrierId);
    }

    /**
     * إحصائيات المحافظ
     */
    function getStats() {
        const wallets = getAllWallets();
        const byCarrier = {};
        CARRIERS.forEach(c => {
            byCarrier[c.id] = wallets.filter(w => w.carrier === c.id).length;
        });
        const online = wallets.filter(w => w.status === 'online').length;
        const totalBalance = wallets.reduce((s, w) => s + (w.balance || 0), 0);

        return {
            total: wallets.length,
            online,
            offline: wallets.length - online,
            totalBalance: totalBalance.toFixed(2),
            byCarrier
        };
    }

    /**
     * الحصول على قائمة الشبكات
     */
    function getCarriers() {
        return [...CARRIERS];
    }

    /**
     * الحصول على اسم الشبكة
     */
    function getCarrierLabel(carrierId) {
        const carrier = CARRIERS.find(c => c.id === carrierId);
        return carrier ? carrier.label : carrierId;
    }

    /**
     * الحصول على لون الشبكة
     */
    function getCarrierColor(carrierId) {
        const carrier = CARRIERS.find(c => c.id === carrierId);
        return carrier ? carrier.color : 'var(--text2)';
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
        if (_unsubscribeWallets) _unsubscribeWallets();
        _walletsCache = {};
        _initialized = false;
        _eventHandlers.clear();
    }

    return {
        init,
        addWallet,
        updateWallet,
        deleteWallet,
        getAllWallets,
        getWallet,
        getWalletsByCarrier,
        getStats,
        getCarriers,
        getCarrierLabel,
        getCarrierColor,
        on,
        off,
        cleanup
    };
})();