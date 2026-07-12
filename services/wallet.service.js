/**
 * Wallet Service — خدمة إدارة أرقام المحافظ والشبكات والخزينة
 * يدير جميع عمليات CRUD للمحافظ + إضافة الرصيد للخزينة + السحب والإرسال
 * ============================================================
 */
'use strict';

const WalletService = (() => {

    var _walletsCache = {};
    var _treasuryCache = { total: 0, history: {} };
    var _initialized = false;
    var _unsubscribeWallets = null;
    var _unsubscribeTreasury = null;
    var _eventHandlers = new Map();

    var CARRIERS = [
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

        // الاستماع لتحديثات المحافظ
        _unsubscribeWallets = FirebaseService.onWalletsChange(function(wallets) {
            _walletsCache = wallets || {};
            _emit('walletsLoaded', { wallets: _walletsCache });
        });

        // الاستماع لتحديثات الخزينة
        _unsubscribeTreasury = FirebaseService.onTreasuryChange(function(treasury) {
            _treasuryCache = treasury || { total: 0, history: {} };
            _emit('treasuryUpdated', { treasury: _treasuryCache });
        });

        // تحميل البيانات الأولية
        try {
            _walletsCache = await FirebaseService.getAllWallets();
            _treasuryCache = await FirebaseService.getTreasury();
        } catch(e) {
            console.warn('[WalletService] خطأ في تحميل البيانات الأولية:', e);
        }

        _emit('initialized', { count: Object.keys(_walletsCache).length });
    }

    /**
     * إضافة محفظة جديدة
     * الرصيد يُضاف تلقائياً للخزينة
     */
    async function addWallet(data) {
        var phoneId = 'PH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        var balance = parseFloat(data.balance) || 0;

        var wallet = {
            deviceId: data.deviceId || '',
            phoneNumber: data.phoneNumber || '',
            carrier: data.carrier || 'vodafone',
            walletName: data.walletName || '',
            balance: balance,
            dailyLimit: parseFloat(data.dailyLimit) || 0,
            monthlyLimit: parseFloat(data.monthlyLimit) || 0,
            dailyUsed: 0,
            monthlyUsed: 0,
            status: data.status || 'online',
            battery: data.battery || 0,
            signal: data.signal || 0,
            lastSeen: Date.now(),
            notes: data.notes || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        var result = await FirebaseService.saveWallet(phoneId, wallet);
        if (result.success) {
            _walletsCache[phoneId] = wallet;

            // إضافة الرصيد للخزينة
            if (balance > 0) {
                var treasuryResult = await FirebaseService.updateTreasury(
                    balance,
                    'إضافة رصيد محفظة: ' + (data.walletName || data.phoneNumber),
                    phoneId
                );
                if (treasuryResult.success) {
                    _treasuryCache.total = treasuryResult.total;
                    _emit('treasuryUpdated', { treasury: _treasuryCache });
                }
            }

            _emit('walletAdded', { phoneId: phoneId, wallet: wallet });
        }
        return Object.assign({}, result, { phoneId: phoneId, wallet: wallet });
    }

    /**
     * تحديث محفظة موجودة
     */
    async function updateWallet(phoneId, updates) {
        var existing = _walletsCache[phoneId];
        if (!existing) return { success: false, error: 'المحفظة غير موجودة' };

        // حساب الفرق في الرصيد للخزينة
        var oldBalance = parseFloat(existing.balance) || 0;
        var newBalance = parseFloat(updates.balance) !== undefined ? parseFloat(updates.balance) : oldBalance;
        var balanceDiff = newBalance - oldBalance;

        var merged = Object.assign({}, existing, updates, { updatedAt: Date.now() });
        var result = await FirebaseService.saveWallet(phoneId, merged);
        if (result.success) {
            _walletsCache[phoneId] = merged;

            // تحديث الخزينة إذا تغير الرصيد
            if (balanceDiff !== 0) {
                await FirebaseService.updateTreasury(
                    balanceDiff,
                    'تعديل رصيد محفظة: ' + (merged.walletName || merged.phoneNumber),
                    phoneId
                );
                // إعادة تحديث الخزينة
                _treasuryCache = await FirebaseService.getTreasury();
                _emit('treasuryUpdated', { treasury: _treasuryCache });
            }

            _emit('walletUpdated', { phoneId: phoneId, wallet: merged });
        }
        return result;
    }

    /**
     * حذف محفظة — يُطرح الرصيد المتبقي من الخزينة
     */
    async function deleteWallet(phoneId) {
        var wallet = _walletsCache[phoneId];
        var remainingBalance = wallet ? (parseFloat(wallet.balance) || 0) : 0;

        var result = await FirebaseService.deleteWallet(phoneId);
        if (result.success) {
            delete _walletsCache[phoneId];

            // طرح الرصيد المتبقي من الخزينة
            if (remainingBalance > 0) {
                await FirebaseService.updateTreasury(
                    -remainingBalance,
                    'حذف محفظة: ' + (wallet.walletName || wallet.phoneNumber),
                    phoneId
                );
                _treasuryCache = await FirebaseService.getTreasury();
                _emit('treasuryUpdated', { treasury: _treasuryCache });
            }

            _emit('walletDeleted', { phoneId: phoneId });
        }
        return result;
    }

    /**
     * سحب نقدي من محفظة — يُطرح من رصيد المحفظة والخزينة
     * @param {string} phoneId
     * @param {number} amount
     * @param {string} notes
     * @returns {Promise<Object>}
     */
    async function withdrawFromWallet(phoneId, amount, notes) {
        var wallet = _walletsCache[phoneId];
        if (!wallet) return { success: false, error: 'المحفظة غير موجودة' };

        var bal = parseFloat(wallet.balance) || 0;
        if (amount > bal) return { success: false, error: 'الرصيد غير كافي. الرصيد المتاح: ' + bal.toFixed(2) + ' ج.م' };

        var dailyLimit = parseFloat(wallet.dailyLimit) || 0;
        var dailyUsed = parseFloat(wallet.dailyUsed) || 0;
        if (dailyLimit > 0 && (dailyUsed + amount) > dailyLimit) {
            return { success: false, error: 'تجاوزت الحد اليومي. المتبقي اليوم: ' + (dailyLimit - dailyUsed).toFixed(2) + ' ج.م' };
        }

        var newBalance = bal - amount;
        var newDailyUsed = dailyUsed + amount;

        var updated = Object.assign({}, wallet, {
            balance: newBalance,
            dailyUsed: newDailyUsed,
            updatedAt: Date.now()
        });

        var result = await FirebaseService.saveWallet(phoneId, updated);
        if (result.success) {
            _walletsCache[phoneId] = updated;

            // طرح من الخزينة
            await FirebaseService.updateTreasury(
                -amount,
                'سحب نقدي: ' + (notes || '') + ' — ' + (wallet.walletName || wallet.phoneNumber),
                phoneId
            );
            _treasuryCache = await FirebaseService.getTreasury();

            _emit('walletUpdated', { phoneId: phoneId, wallet: updated });
            _emit('treasuryUpdated', { treasury: _treasuryCache });
            _emit('transaction', {
                type: 'withdraw',
                phoneId: phoneId,
                amount: amount,
                balanceAfter: newBalance,
                walletName: wallet.walletName || wallet.phoneNumber,
                notes: notes || '',
                timestamp: Date.now()
            });
        }
        return result;
    }

    /**
     * إرسال أموال من محفظة — يُطرح من رصيد المحفظة والخزينة
     * @param {string} phoneId
     * @param {number} amount
     * @param {string} recipientName
     * @param {string} recipientNumber
     * @param {string} notes
     * @returns {Promise<Object>}
     */
    async function sendFromWallet(phoneId, amount, recipientName, recipientNumber, notes) {
        var wallet = _walletsCache[phoneId];
        if (!wallet) return { success: false, error: 'المحفظة غير موجودة' };

        var bal = parseFloat(wallet.balance) || 0;
        if (amount > bal) return { success: false, error: 'الرصيد غير كافي. الرصيد المتاح: ' + bal.toFixed(2) + ' ج.م' };

        var dailyLimit = parseFloat(wallet.dailyLimit) || 0;
        var dailyUsed = parseFloat(wallet.dailyUsed) || 0;
        if (dailyLimit > 0 && (dailyUsed + amount) > dailyLimit) {
            return { success: false, error: 'تجاوزت الحد اليومي. المتبقي اليوم: ' + (dailyLimit - dailyUsed).toFixed(2) + ' ج.م' };
        }

        var newBalance = bal - amount;
        var newDailyUsed = dailyUsed + amount;

        var updated = Object.assign({}, wallet, {
            balance: newBalance,
            dailyUsed: newDailyUsed,
            updatedAt: Date.now()
        });

        var result = await FirebaseService.saveWallet(phoneId, updated);
        if (result.success) {
            _walletsCache[phoneId] = updated;

            // طرح من الخزينة
            await FirebaseService.updateTreasury(
                -amount,
                'إرسال أموال: ' + (recipientName || recipientNumber || '') + ' — من ' + (wallet.walletName || wallet.phoneNumber),
                phoneId
            );
            _treasuryCache = await FirebaseService.getTreasury();

            _emit('walletUpdated', { phoneId: phoneId, wallet: updated });
            _emit('treasuryUpdated', { treasury: _treasuryCache });
            _emit('transaction', {
                type: 'send',
                phoneId: phoneId,
                amount: amount,
                balanceAfter: newBalance,
                walletName: wallet.walletName || wallet.phoneNumber,
                recipientName: recipientName || '',
                recipientNumber: recipientNumber || '',
                notes: notes || '',
                timestamp: Date.now()
            });
        }
        return result;
    }

    /**
     * الحصول على جميع المحافظ
     */
    function getAllWallets() {
        return Object.keys(_walletsCache).map(function(id) {
            return Object.assign({ phoneId: id }, _walletsCache[id]);
        });
    }

    /**
     * الحصول على محفظة بالمعرف
     */
    function getWallet(phoneId) {
        return _walletsCache[phoneId] ? Object.assign({ phoneId: phoneId }, _walletsCache[phoneId]) : null;
    }

    /**
     * الحصول على المحافظ حسب الشبكة
     */
    function getWalletsByCarrier(carrierId) {
        return getAllWallets().filter(function(w) { return w.carrier === carrierId; });
    }

    /**
     * إحصائيات المحافظ
     */
    function getStats() {
        var wallets = getAllWallets();
        var byCarrier = {};
        CARRIERS.forEach(function(c) {
            byCarrier[c.id] = wallets.filter(function(w) { return w.carrier === c.id; }).length;
        });
        var online = wallets.filter(function(w) { return w.status === 'online'; }).length;
        var totalBalance = wallets.reduce(function(s, w) { return s + (w.balance || 0); }, 0);

        return {
            total: wallets.length,
            online: online,
            offline: wallets.length - online,
            totalBalance: totalBalance.toFixed(2),
            byCarrier: byCarrier
        };
    }

    /**
     * الحصول على بيانات الخزينة
     */
    function getTreasury() {
        return _treasuryCache;
    }

    /**
     * الحصول على سجل العمليات من الخزينة
     */
    function getTreasuryHistory() {
        var history = _treasuryCache.history || {};
        return Object.keys(history).map(function(id) {
            return Object.assign({ txId: id }, history[id]);
        }).sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    }

    function getCarriers() {
        return CARRIERS.slice();
    }

    function getCarrierLabel(carrierId) {
        var carrier = CARRIERS.find(function(c) { return c.id === carrierId; });
        return carrier ? carrier.label : carrierId;
    }

    function getCarrierColor(carrierId) {
        var carrier = CARRIERS.find(function(c) { return c.id === carrierId; });
        return carrier ? carrier.color : 'var(--text2)';
    }

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

    function cleanup() {
        if (_unsubscribeWallets) _unsubscribeWallets();
        if (_unsubscribeTreasury) _unsubscribeTreasury();
        _walletsCache = {};
        _treasuryCache = { total: 0, history: {} };
        _initialized = false;
        _eventHandlers.clear();
    }

    return {
        init: init,
        addWallet: addWallet,
        updateWallet: updateWallet,
        deleteWallet: deleteWallet,
        withdrawFromWallet: withdrawFromWallet,
        sendFromWallet: sendFromWallet,
        getAllWallets: getAllWallets,
        getWallet: getWallet,
        getWalletsByCarrier: getWalletsByCarrier,
        getStats: getStats,
        getTreasury: getTreasury,
        getTreasuryHistory: getTreasuryHistory,
        getCarriers: getCarriers,
        getCarrierLabel: getCarrierLabel,
        getCarrierColor: getCarrierColor,
        on: on,
        off: off,
        cleanup: cleanup
    };
})();