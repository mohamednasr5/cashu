/**
 * صفحة أرقام المحافظ — Wallet Numbers Page
 * إضافة وإدارة أرقام الهواتف والمحافظ + الخزينة + السحب والإرسال
 * ============================================================
 */
'use strict';

const WalletNumbersPage = (() => {

    var _editMode = null;
    var _currentCarrierFilter = 'all';
    var _activeTab = 'wallets'; // wallets | send | withdraw | treasury

    /**
     * عرض صفحة المحافظ
     */
    function render() {
        var pageContent = document.getElementById('page-content');
        if (!pageContent) return;

        pageContent.innerHTML = getHTML();
        _bindEvents();
        _refreshWallets();
        _refreshTreasury();
    }

    /**
     * HTML الصفحة الكامل
     */
    function getHTML() {
        var carriers = WalletService.getCarriers();
        var carrierOptions = carriers.map(function(c) {
            return '<option value="' + c.id + '">' + c.label + '</option>';
        }).join('');

        return '<div class="wn-page">' +

        /* ===== بطاقة الخزينة العلوية ===== */
        '<div class="wn-treasury-card" id="wn-treasury-card">' +
            '<div class="wn-treasury-left">' +
                '<div class="wn-treasury-icon"><i class="fas fa-vault"></i></div>' +
                '<div class="wn-treasury-info">' +
                    '<span class="wn-treasury-label">إجمالي الخزينة</span>' +
                    '<span class="wn-treasury-value" id="wn-treasury-total">0.00 ج.م</span>' +
                '</div>' +
            '</div>' +
            '<div class="wn-treasury-right">' +
                '<div class="wn-treasury-stat">' +
                    '<span class="wn-treasury-stat-val" id="wn-treasury-wallets-count">0</span>' +
                    '<span class="wn-treasury-stat-lbl">محفظة</span>' +
                '</div>' +
                '<div class="wn-treasury-stat">' +
                    '<span class="wn-treasury-stat-val" id="wn-treasury-wallets-balance">0</span>' +
                    '<span class="wn-treasury-stat-lbl">أرصدة المحافظ</span>' +
                '</div>' +
            '</div>' +
        '</div>' +

        /* ===== تبويبات العمليات ===== */
        '<div class="wn-tabs">' +
            '<button class="wn-tab active" data-tab="wallets" onclick="WalletNumbersPage.switchTab(\'wallets\', this)">' +
                '<i class="fas fa-wallet"></i> المحافظ' +
            '</button>' +
            '<button class="wn-tab" data-tab="send" onclick="WalletNumbersPage.switchTab(\'send\', this)">' +
                '<i class="fas fa-paper-plane"></i> إرسال أموال' +
            '</button>' +
            '<button class="wn-tab" data-tab="withdraw" onclick="WalletNumbersPage.switchTab(\'withdraw\', this)">' +
                '<i class="fas fa-money-bill-wave"></i> سحب نقدي' +
            '</button>' +
            '<button class="wn-tab" data-tab="treasury" onclick="WalletNumbersPage.switchTab(\'treasury\', this)">' +
                '<i class="fas fa-history"></i> سجل الخزينة' +
            '</button>' +
        '</div>' +

        /* ===== تبويب المحافظ ===== */
        '<div class="wn-tab-content active" id="wn-tab-wallets">' +

            /* قسم إضافة رقم جديد */
            '<div class="wn-add-section">' +
                '<div class="wn-section-header">' +
                    '<h3><i class="fas fa-plus-circle" style="color:var(--red); margin-left:8px;"></i> إضافة رقم جديد</h3>' +
                    '<button class="btn btn-secondary btn-sm" id="wn-toggle-form" onclick="WalletNumbersPage.toggleForm()">' +
                        '<i class="fas fa-chevron-down" id="wn-form-toggle-icon"></i>' +
                    '</button>' +
                '</div>' +
                '<div class="wn-form-card" id="wn-form-card">' +
                    '<div class="wn-form-grid">' +
                        '<div class="wn-field">' +
                            '<label>رقم الهاتف</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-phone field-icon"></i>' +
                                '<input type="tel" id="wn-phone" placeholder="01xxxxxxxxx" maxlength="11" dir="ltr" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field">' +
                            '<label>نوع الشبكة</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-sim-card field-icon"></i>' +
                                '<select id="wn-carrier" class="wn-select">' + carrierOptions + '</select>' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field">' +
                            '<label>اسم المحفظة</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-wallet field-icon"></i>' +
                                '<input type="text" id="wn-wallet-name" placeholder="مثال: محفظة أحمد">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field">' +
                            '<label>الرصيد الحالي (ج.م)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-coins field-icon"></i>' +
                                '<input type="number" id="wn-balance" placeholder="0.00" step="0.01" min="0" dir="ltr">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field">' +
                            '<label>الحد اليومي (ج.م)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-calendar-day field-icon"></i>' +
                                '<input type="number" id="wn-daily-limit" placeholder="0.00" step="0.01" min="0" dir="ltr">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field">' +
                            '<label>الحد الشهري (ج.م)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-calendar-alt field-icon"></i>' +
                                '<input type="number" id="wn-monthly-limit" placeholder="0.00" step="0.01" min="0" dir="ltr">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>ملاحظات</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-sticky-note field-icon"></i>' +
                                '<textarea id="wn-notes" placeholder="ملاحظات إضافية..." rows="2"></textarea>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="wn-form-actions">' +
                        '<button class="btn btn-primary wn-submit-btn" onclick="WalletNumbersPage.saveWallet()">' +
                            '<i class="fas fa-save"></i>' +
                            '<span id="wn-submit-text">حفظ الرقم</span>' +
                        '</button>' +
                        '<button class="btn btn-secondary" onclick="WalletNumbersPage.resetForm()">' +
                            '<i class="fas fa-undo"></i>' +
                            '<span>إعادة تعيين</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* شريط البحث والفلاتر */
            '<div class="wn-toolbar">' +
                '<div class="wn-search-wrap">' +
                    '<i class="fas fa-search"></i>' +
                    '<input type="text" id="wn-search" placeholder="بحث بالرقم أو الاسم..." oninput="WalletNumbersPage.filterWallets()">' +
                '</div>' +
                '<div class="wn-carrier-filters" id="wn-carrier-filters">' +
                    '<button class="wn-filter-btn active" data-carrier="all" onclick="WalletNumbersPage.filterByCarrier(\'all\', this)">الكل</button>' +
                    carriers.map(function(c) {
                        return '<button class="wn-filter-btn" data-carrier="' + c.id + '" onclick="WalletNumbersPage.filterByCarrier(\'' + c.id + '\', this)" style="--c:' + c.color + '">' + c.label + '</button>';
                    }).join('') +
                '</div>' +
            '</div>' +

            /* جدول المحافظ */
            '<div class="wn-table-wrap">' +
                '<table class="dm-table wn-table">' +
                    '<thead>' +
                        '<tr>' +
                            '<th>#</th>' +
                            '<th>رقم الهاتف</th>' +
                            '<th>الشبكة</th>' +
                            '<th>اسم المحفظة</th>' +
                            '<th>الرصيد</th>' +
                            '<th>المستخدم اليومي</th>' +
                            '<th>الحد اليومي</th>' +
                            '<th>الحالة</th>' +
                            '<th>ملاحظات</th>' +
                            '<th>إجراءات</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody id="wn-table-body">' +
                        '<tr><td colspan="10" class="dm-empty"><i class="fas fa-wallet"></i><p>جاري تحميل المحافظ...</p></td></tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>' +

        /* ===== تبويب إرسال أموال ===== */
        '<div class="wn-tab-content" id="wn-tab-send">' +
            '<div class="wn-operation-card">' +
                '<div class="wn-op-header">' +
                    '<i class="fas fa-paper-plane" style="color:var(--info);"></i>' +
                    '<h3>إرسال أموال من محفظة</h3>' +
                '</div>' +
                '<div class="wn-op-body">' +
                    '<div class="wn-form-grid">' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>اختر المحفظة</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-wallet field-icon"></i>' +
                                '<select id="wn-send-wallet" class="wn-select" onchange="WalletNumbersPage.onSendWalletChange()">' +
                                    '<option value="">-- اختر محفظة --</option>' +
                                '</select>' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>رصيد المحفظة المتاح</label>' +
                            '<div class="wn-balance-display" id="wn-send-balance-display">' +
                                '<i class="fas fa-coins"></i> <span id="wn-send-wallet-balance">0.00</span> ج.م' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>اسم المستلم</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-user field-icon"></i>' +
                                '<input type="text" id="wn-send-recipient-name" placeholder="اسم المستلم">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>رقم المستلم</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-phone field-icon"></i>' +
                                '<input type="tel" id="wn-send-recipient-number" placeholder="01xxxxxxxxx" maxlength="11" dir="ltr" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>المبلغ (ج.م)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-money-bill field-icon"></i>' +
                                '<input type="number" id="wn-send-amount" placeholder="0.00" step="0.01" min="0.01" dir="ltr">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>ملاحظات (اختياري)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-sticky-note field-icon"></i>' +
                                '<input type="text" id="wn-send-notes" placeholder="ملاحظات إضافية...">' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="wn-form-actions" style="margin-top:16px;">' +
                        '<button class="btn btn-primary wn-submit-btn" onclick="WalletNumbersPage.sendMoney()" style="background:linear-gradient(135deg, #3b82f6, #1d4ed8);">' +
                            '<i class="fas fa-paper-plane"></i> إرسال الأموال' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +

        /* ===== تبويب سحب نقدي ===== */
        '<div class="wn-tab-content" id="wn-tab-withdraw">' +
            '<div class="wn-operation-card">' +
                '<div class="wn-op-header">' +
                    '<i class="fas fa-money-bill-wave" style="color:#10b981;"></i>' +
                    '<h3>سحب نقدي من محفظة</h3>' +
                '</div>' +
                '<div class="wn-op-body">' +
                    '<div class="wn-form-grid">' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>اختر المحفظة</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-wallet field-icon"></i>' +
                                '<select id="wn-withdraw-wallet" class="wn-select" onchange="WalletNumbersPage.onWithdrawWalletChange()">' +
                                    '<option value="">-- اختر محفظة --</option>' +
                                '</select>' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>رصيد المحفظة المتاح</label>' +
                            '<div class="wn-balance-display" id="wn-withdraw-balance-display">' +
                                '<i class="fas fa-coins"></i> <span id="wn-withdraw-wallet-balance">0.00</span> ج.م' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>مبلغ السحب (ج.م)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-money-bill field-icon"></i>' +
                                '<input type="number" id="wn-withdraw-amount" placeholder="0.00" step="0.01" min="0.01" dir="ltr">' +
                            '</div>' +
                        '</div>' +
                        '<div class="wn-field wn-field-full">' +
                            '<label>ملاحظات (اختياري)</label>' +
                            '<div class="wn-input-wrap">' +
                                '<i class="fas fa-sticky-note field-icon"></i>' +
                                '<input type="text" id="wn-withdraw-notes" placeholder="سبب السحب أو ملاحظات...">' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="wn-form-actions" style="margin-top:16px;">' +
                        '<button class="btn btn-primary wn-submit-btn" onclick="WalletNumbersPage.withdrawCash()" style="background:linear-gradient(135deg, #10b981, #059669);">' +
                            '<i class="fas fa-money-bill-wave"></i> سحب نقدي' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +

        /* ===== تبويب سجل الخزينة ===== */
        '<div class="wn-tab-content" id="wn-tab-treasury">' +
            '<div class="wn-table-wrap">' +
                '<table class="dm-table wn-table">' +
                    '<thead>' +
                        '<tr>' +
                            '<th>#</th>' +
                            '<th>الوقت</th>' +
                            '<th>العملية</th>' +
                            '<th>المبلغ</th>' +
                            '<th>الرصيد بعد العملية</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody id="wn-treasury-history-body">' +
                        '<tr><td colspan="5" class="dm-empty"><i class="fas fa-history"></i><p>جاري تحميل السجل...</p></td></tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>' +

        /* التوقيع */
        '<div class="dm-footer">' +
            '<span>برمجة وتطوير <span class="dm-heart">&#10084;&#65039;</span> محمد حماد</span>' +
            '<a href="https://www.facebook.com/en.mohamed.nasr" target="_blank" rel="noopener">' +
                '<i class="fab fa-facebook"></i>' +
            '</a>' +
        '</div>' +
        '</div>';
    }

    /**
     * ربط الأحداث
     */
    function _bindEvents() {
        WalletService.on('walletsLoaded', _onWalletsUpdate);
        WalletService.on('walletAdded', _onWalletsUpdate);
        WalletService.on('walletUpdated', _onWalletsUpdate);
        WalletService.on('walletDeleted', _onWalletsUpdate);
        WalletService.on('treasuryUpdated', _onTreasuryUpdate);
        WalletService.on('transaction', _onTransaction);
    }

    function _onWalletsUpdate() {
        _refreshWallets();
        _refreshWalletSelectors();
    }

    function _onTreasuryUpdate() {
        _refreshTreasury();
    }

    function _onTransaction() {
        _refreshTreasuryHistory();
    }

    /**
     * تحديث جدول المحافظ
     */
    function _refreshWallets() {
        var tbody = document.getElementById('wn-table-body');
        if (!tbody) return;

        var searchTerm = (document.getElementById('wn-search') ? document.getElementById('wn-search').value : '').toLowerCase();
        var wallets = WalletService.getAllWallets();

        if (searchTerm) {
            wallets = wallets.filter(function(w) {
                return (w.phoneNumber || '').includes(searchTerm) ||
                       (w.walletName || '').toLowerCase().includes(searchTerm) ||
                       (w.notes || '').toLowerCase().includes(searchTerm);
            });
        }

        if (_currentCarrierFilter !== 'all') {
            wallets = wallets.filter(function(w) { return w.carrier === _currentCarrierFilter; });
        }

        if (!wallets.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="dm-empty"><i class="fas fa-wallet"></i><p>لا توجد محافظ' +
                (searchTerm || _currentCarrierFilter !== 'all' ? ' تطابق البحث' : ' مضافة بعد') +
                '</p><p class="dm-empty-hint">استخدم النموذج أعلاه لإضافة رقم جديد</p></td></tr>';
            return;
        }

        tbody.innerHTML = wallets.map(function(w, i) { return _buildWalletRow(w, i + 1); }).join('');
    }

    /**
     * بناء صف المحفظة
     */
    function _buildWalletRow(wallet, index) {
        var carrier = WalletService.getCarrierLabel(wallet.carrier);
        var carrierColor = WalletService.getCarrierColor(wallet.carrier);
        var isOnline = wallet.status === 'online';
        var dailyUsed = parseFloat(wallet.dailyUsed) || 0;
        var dailyLimit = parseFloat(wallet.dailyLimit) || 0;

        return '<tr data-phone-id="' + (wallet.phoneId || '') + '">' +
            '<td>' + index + '</td>' +
            '<td><span class="wn-phone-number" dir="ltr">' + (wallet.phoneNumber || '-') + '</span></td>' +
            '<td><span class="wn-carrier-badge" style="background:' + carrierColor + '20; color:' + carrierColor + '; border:1px solid ' + carrierColor + '40;">' + carrier + '</span></td>' +
            '<td><strong>' + (wallet.walletName || '-') + '</strong></td>' +
            '<td class="wn-balance">' + (wallet.balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج.م</td>' +
            '<td>' + dailyUsed.toLocaleString('ar-EG') + (dailyLimit > 0 ? ' / ' + dailyLimit.toLocaleString('ar-EG') : '') + ' ج.م</td>' +
            '<td>' + (dailyLimit > 0 ? dailyLimit.toLocaleString('ar-EG') + ' ج.م' : '-') + '</td>' +
            '<td><span class="dm-status ' + (isOnline ? 'status-online' : 'status-offline') + '">' +
                '<i class="fas fa-' + (isOnline ? 'check-circle' : 'times-circle') + '"></i> ' +
                (isOnline ? 'متصل' : 'غير متصل') +
            '</span></td>' +
            '<td><span class="wn-notes-cell">' + (wallet.notes || '-') + '</span></td>' +
            '<td><div class="dm-actions">' +
                '<button class="dm-action-btn edit" onclick="WalletNumbersPage.editWallet(\'' + wallet.phoneId + '\')" title="تعديل"><i class="fas fa-pen"></i></button>' +
                '<button class="dm-action-btn danger" onclick="WalletNumbersPage.deleteWallet(\'' + wallet.phoneId + '\')" title="حذف"><i class="fas fa-trash"></i></button>' +
            '</div></td>' +
        '</tr>';
    }

    /**
     * تحديث عرض الخزينة
     */
    function _refreshTreasury() {
        var treasury = WalletService.getTreasury();
        var total = parseFloat(treasury.total) || 0;
        var stats = WalletService.getStats();
        var walletsBalance = parseFloat(stats.totalBalance) || 0;

        var totalEl = document.getElementById('wn-treasury-total');
        if (totalEl) totalEl.textContent = total.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) + ' ج.م';

        var countEl = document.getElementById('wn-treasury-wallets-count');
        if (countEl) countEl.textContent = stats.total;

        var balEl = document.getElementById('wn-treasury-wallets-balance');
        if (balEl) balEl.textContent = walletsBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

        // تحديث سجل الخزينة
        _refreshTreasuryHistory();

        // تحديث قوائم المحافظ في الإرسال والسحب
        _refreshWalletSelectors();
    }

    /**
     * تحديث قوائم اختيار المحافظ في الإرسال والسحب
     */
    function _refreshWalletSelectors() {
        var wallets = WalletService.getAllWallets().filter(function(w) {
            return (parseFloat(w.balance) || 0) > 0;
        });

        var options = '<option value="">-- اختر محفظة --</option>';
        wallets.forEach(function(w) {
            var carrier = WalletService.getCarrierLabel(w.carrier);
            options += '<option value="' + w.phoneId + '" data-balance="' + (w.balance || 0) + '">' +
                carrier + ' - ' + (w.walletName || w.phoneNumber) + ' (' + (w.balance || 0).toFixed(2) + ' ج.م)</option>';
        });

        var sendSel = document.getElementById('wn-send-wallet');
        if (sendSel) {
            var currentSendVal = sendSel.value;
            sendSel.innerHTML = options;
            sendSel.value = currentSendVal;
        }

        var withdrawSel = document.getElementById('wn-withdraw-wallet');
        if (withdrawSel) {
            var currentWithdrawVal = withdrawSel.value;
            withdrawSel.innerHTML = options;
            withdrawSel.value = currentWithdrawVal;
        }
    }

    /**
     * تحديث سجل الخزينة
     */
    function _refreshTreasuryHistory() {
        var tbody = document.getElementById('wn-treasury-history-body');
        if (!tbody) return;

        var history = WalletService.getTreasuryHistory();

        if (!history.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="dm-empty"><i class="fas fa-history"></i><p>لا توجد عمليات مسجلة</p></td></tr>';
            return;
        }

        tbody.innerHTML = history.map(function(tx, i) {
            var isPositive = tx.amount > 0;
            var date = tx.timestamp ? new Date(tx.timestamp).toLocaleString('ar-EG') : '-';
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + date + '</td>' +
                '<td>' + (tx.reason || '-') + '</td>' +
                '<td style="color:' + (isPositive ? 'var(--success)' : 'var(--red)') + '; font-weight:700;">' +
                    (isPositive ? '+' : '') + (tx.amount || 0).toFixed(2) + ' ج.م</td>' +
                '<td>' + (tx.balanceAfter || 0).toFixed(2) + ' ج.م</td>' +
            '</tr>';
        }).join('');
    }

    /**
     * تبديل التبويبات
     */
    function switchTab(tab, btn) {
        _activeTab = tab;

        // تحديث أزرار التبويبات
        document.querySelectorAll('.wn-tab').forEach(function(t) { t.classList.remove('active'); });
        if (btn) btn.classList.add('active');

        // إخفاء/إظهار المحتوى
        document.querySelectorAll('.wn-tab-content').forEach(function(c) { c.classList.remove('active'); });
        var tabEl = document.getElementById('wn-tab-' + tab);
        if (tabEl) tabEl.classList.add('active');

        // تحديث البيانات عند التبديل
        if (tab === 'send' || tab === 'withdraw') {
            _refreshWalletSelectors();
        } else if (tab === 'treasury') {
            _refreshTreasuryHistory();
        }
    }

    /**
     * عند تغيير اختيار محفظة الإرسال
     */
    function onSendWalletChange() {
        var sel = document.getElementById('wn-send-wallet');
        var balanceEl = document.getElementById('wn-send-wallet-balance');
        if (!sel || !balanceEl) return;

        var opt = sel.options[sel.selectedIndex];
        var balance = opt && opt.dataset.balance ? parseFloat(opt.dataset.balance) : 0;
        balanceEl.textContent = balance.toFixed(2);
    }

    /**
     * عند تغيير اختيار محفظة السحب
     */
    function onWithdrawWalletChange() {
        var sel = document.getElementById('wn-withdraw-wallet');
        var balanceEl = document.getElementById('wn-withdraw-wallet-balance');
        if (!sel || !balanceEl) return;

        var opt = sel.options[sel.selectedIndex];
        var balance = opt && opt.dataset.balance ? parseFloat(opt.dataset.balance) : 0;
        balanceEl.textContent = balance.toFixed(2);
    }

    /**
     * إرسال أموال
     */
    async function sendMoney() {
        var phoneId = document.getElementById('wn-send-wallet') ? document.getElementById('wn-send-wallet').value : '';
        var amount = document.getElementById('wn-send-amount') ? parseFloat(document.getElementById('wn-send-amount').value) : 0;
        var recipientName = document.getElementById('wn-send-recipient-name') ? document.getElementById('wn-send-recipient-name').value.trim() : '';
        var recipientNumber = document.getElementById('wn-send-recipient-number') ? document.getElementById('wn-send-recipient-number').value.trim() : '';
        var notes = document.getElementById('wn-send-notes') ? document.getElementById('wn-send-notes').value.trim() : '';

        if (!phoneId) { _showToast('يرجى اختيار المحفظة', 'error'); return; }
        if (!amount || amount <= 0) { _showToast('يرجى إدخال مبلغ صحيح', 'error'); return; }
        if (!recipientName && !recipientNumber) { _showToast('يرجى إدخال اسم أو رقم المستلم', 'error'); return; }

        _showToast('جاري إرسال الأموال...', 'info');

        var result = await WalletService.sendFromWallet(phoneId, amount, recipientName, recipientNumber, notes);
        if (result.success) {
            _showToast('تم إرسال ' + amount.toFixed(2) + ' ج.م بنجاح', 'success');
            // مسح الحقول
            if (document.getElementById('wn-send-amount')) document.getElementById('wn-send-amount').value = '';
            if (document.getElementById('wn-send-recipient-name')) document.getElementById('wn-send-recipient-name').value = '';
            if (document.getElementById('wn-send-recipient-number')) document.getElementById('wn-send-recipient-number').value = '';
            if (document.getElementById('wn-send-notes')) document.getElementById('wn-send-notes').value = '';
            _refreshWalletSelectors();
            onSendWalletChange();
        } else {
            _showToast('فشل الإرسال: ' + (result.error || ''), 'error');
        }
    }

    /**
     * سحب نقدي
     */
    async function withdrawCash() {
        var phoneId = document.getElementById('wn-withdraw-wallet') ? document.getElementById('wn-withdraw-wallet').value : '';
        var amount = document.getElementById('wn-withdraw-amount') ? parseFloat(document.getElementById('wn-withdraw-amount').value) : 0;
        var notes = document.getElementById('wn-withdraw-notes') ? document.getElementById('wn-withdraw-notes').value.trim() : '';

        if (!phoneId) { _showToast('يرجى اختيار المحفظة', 'error'); return; }
        if (!amount || amount <= 0) { _showToast('يرجى إدخال مبلغ صحيح', 'error'); return; }

        _showToast('جاري السحب...', 'info');

        var result = await WalletService.withdrawFromWallet(phoneId, amount, notes);
        if (result.success) {
            _showToast('تم سحب ' + amount.toFixed(2) + ' ج.م بنجاح', 'success');
            // مسح الحقول
            if (document.getElementById('wn-withdraw-amount')) document.getElementById('wn-withdraw-amount').value = '';
            if (document.getElementById('wn-withdraw-notes')) document.getElementById('wn-withdraw-notes').value = '';
            _refreshWalletSelectors();
            onWithdrawWalletChange();
        } else {
            _showToast('فشل السحب: ' + (result.error || ''), 'error');
        }
    }

    /**
     * حفظ محفظة (إضافة أو تعديل)
     */
    async function saveWallet() {
        var phone = document.getElementById('wn-phone') ? document.getElementById('wn-phone').value.trim() : '';
        var carrier = document.getElementById('wn-carrier') ? document.getElementById('wn-carrier').value : 'vodafone';
        var walletName = document.getElementById('wn-wallet-name') ? document.getElementById('wn-wallet-name').value.trim() : '';
        var balance = document.getElementById('wn-balance') ? document.getElementById('wn-balance').value : '';
        var dailyLimit = document.getElementById('wn-daily-limit') ? document.getElementById('wn-daily-limit').value : '';
        var monthlyLimit = document.getElementById('wn-monthly-limit') ? document.getElementById('wn-monthly-limit').value : '';
        var notes = document.getElementById('wn-notes') ? document.getElementById('wn-notes').value.trim() : '';

        if (!phone || phone.length < 11) {
            _showToast('يرجى إدخال رقم هاتف صحيح (11 رقم)', 'error');
            return;
        }
        if (!walletName) {
            _showToast('يرجى إدخال اسم المحفظة', 'error');
            return;
        }

        var data = {
            phoneNumber: phone,
            carrier: carrier,
            walletName: walletName,
            balance: parseFloat(balance) || 0,
            dailyLimit: parseFloat(dailyLimit) || 0,
            monthlyLimit: parseFloat(monthlyLimit) || 0,
            notes: notes
        };

        var result;
        if (_editMode) {
            result = await WalletService.updateWallet(_editMode, data);
            if (result.success) {
                _showToast('تم تحديث المحفظة بنجاح (الخزينة تم تعديلها حسب فرق الرصيد)', 'success');
                _editMode = null;
                var submitText = document.getElementById('wn-submit-text');
                if (submitText) submitText.textContent = 'حفظ الرقم';
            } else {
                _showToast('فشل التحديث: ' + (result.error || ''), 'error');
            }
        } else {
            result = await WalletService.addWallet(data);
            if (result.success) {
                var addedBalance = parseFloat(balance) || 0;
                if (addedBalance > 0) {
                    _showToast('تم إضافة المحفظة و ' + addedBalance.toFixed(2) + ' ج.م للخزينة', 'success');
                } else {
                    _showToast('تم إضافة المحفظة بنجاح', 'success');
                }
                resetForm();
            } else {
                _showToast('فشل الإضافة: ' + (result.error || ''), 'error');
            }
        }
    }

    /**
     * تعديل محفظة
     */
    function editWallet(phoneId) {
        var wallet = WalletService.getWallet(phoneId);
        if (!wallet) return;

        _editMode = phoneId;
        var wnPhone = document.getElementById('wn-phone');
        var wnCarrier = document.getElementById('wn-carrier');
        var wnWalletName = document.getElementById('wn-wallet-name');
        var wnBalance = document.getElementById('wn-balance');
        var wnDailyLimit = document.getElementById('wn-daily-limit');
        var wnMonthlyLimit = document.getElementById('wn-monthly-limit');
        var wnNotes = document.getElementById('wn-notes');

        if (wnPhone) wnPhone.value = wallet.phoneNumber || '';
        if (wnCarrier) wnCarrier.value = wallet.carrier || 'vodafone';
        if (wnWalletName) wnWalletName.value = wallet.walletName || '';
        if (wnBalance) wnBalance.value = wallet.balance || '';
        if (wnDailyLimit) wnDailyLimit.value = wallet.dailyLimit || '';
        if (wnMonthlyLimit) wnMonthlyLimit.value = wallet.monthlyLimit || '';
        if (wnNotes) wnNotes.value = wallet.notes || '';

        var submitText = document.getElementById('wn-submit-text');
        if (submitText) submitText.textContent = 'تحديث الرقم';

        // فتح النموذج إذا كان مغلق
        var formCard = document.getElementById('wn-form-card');
        if (formCard && formCard.style.display === 'none') {
            formCard.style.display = 'block';
            var icon = document.getElementById('wn-form-toggle-icon');
            if (icon) icon.style.transform = 'rotate(180deg)';
        }

        // التمرير للنموذج
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * حذف محفظة
     */
    async function deleteWallet(phoneId) {
        var wallet = WalletService.getWallet(phoneId);
        var bal = wallet ? (parseFloat(wallet.balance) || 0) : 0;
        var confirmMsg = 'هل أنت متأكد من حذف هذه المحفظة؟';
        if (bal > 0) {
            confirmMsg += '\nسيتم طرح ' + bal.toFixed(2) + ' ج.م من الخزينة (الرصيد المتبقي)';
        }
        if (!confirm(confirmMsg)) return;

        var result = await WalletService.deleteWallet(phoneId);
        if (result.success) {
            _showToast('تم حذف المحفظة' + (bal > 0 ? ' وطرح ' + bal.toFixed(2) + ' ج.م من الخزينة' : ''), 'success');
        } else {
            _showToast('فشل الحذف', 'error');
        }
    }

    /**
     * إعادة تعيين النموذج
     */
    function resetForm() {
        _editMode = null;
        var fields = ['wn-phone', 'wn-wallet-name', 'wn-balance', 'wn-daily-limit', 'wn-monthly-limit', 'wn-notes'];
        fields.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.value = '';
        });
        var wnCarrier = document.getElementById('wn-carrier');
        if (wnCarrier) wnCarrier.selectedIndex = 0;
        var submitText = document.getElementById('wn-submit-text');
        if (submitText) submitText.textContent = 'حفظ الرقم';
    }

    /**
     * إظهار/إخفاء النموذج
     */
    function toggleForm() {
        var card = document.getElementById('wn-form-card');
        var icon = document.getElementById('wn-form-toggle-icon');
        if (!card) return;
        var isHidden = card.style.display === 'none';
        card.style.display = isHidden ? 'block' : 'none';
        if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : '';
    }

    /**
     * فلترة حسب الشبكة
     */
    function filterByCarrier(carrier, btn) {
        _currentCarrierFilter = carrier;
        document.querySelectorAll('.wn-filter-btn').forEach(function(b) { b.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        _refreshWallets();
    }

    function filterWallets() {
        _refreshWallets();
    }

    /**
     * Toast notification
     */
    function _showToast(message, type) {
        if (typeof toast === 'function') {
            toast(message, type);
        } else {
            var wrap = document.getElementById('toast-wrap');
            if (!wrap) return;
            var t = document.createElement('div');
            t.className = 'toast toast-' + (type || 'info');
            var iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle';
            t.innerHTML = '<i class="fas fa-' + iconName + '"></i> ' + message;
            wrap.appendChild(t);
            setTimeout(function() { if (t.parentNode) t.remove(); }, 4000);
        }
    }

    function destroy() {
        WalletService.off('walletsLoaded', _onWalletsUpdate);
        WalletService.off('walletAdded', _onWalletsUpdate);
        WalletService.off('walletUpdated', _onWalletsUpdate);
        WalletService.off('walletDeleted', _onWalletsUpdate);
        WalletService.off('treasuryUpdated', _onTreasuryUpdate);
        WalletService.off('transaction', _onTransaction);
    }

    return {
        render: render,
        saveWallet: saveWallet,
        editWallet: editWallet,
        deleteWallet: deleteWallet,
        resetForm: resetForm,
        toggleForm: toggleForm,
        filterByCarrier: filterByCarrier,
        filterWallets: filterWallets,
        switchTab: switchTab,
        onSendWalletChange: onSendWalletChange,
        onWithdrawWalletChange: onWithdrawWalletChange,
        sendMoney: sendMoney,
        withdrawCash: withdrawCash,
        destroy: destroy
    };
})();