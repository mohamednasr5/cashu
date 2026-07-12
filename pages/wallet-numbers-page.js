/**
 * صفحة أرقام المحافظ — Wallet Numbers Page
 * إضافة وإدارة أرقام الهواتف والمحافظ مع الشبكات
 * ============================================================
 */
'use strict';

const WalletNumbersPage = (() => {

    let _editMode = null; // phoneId إذا كنا في وضع التعديل

    /**
     * عرض صفحة المحافظ
     */
    function render() {
        const pageContent = document.getElementById('page-content');
        if (!pageContent) return;

        pageContent.innerHTML = getHTML();
        _bindEvents();
        _refreshWallets();
    }

    /**
     * HTML الصفحة
     */
    function getHTML() {
        const carriers = WalletService.getCarriers();
        const carrierOptions = carriers.map(c =>
            `<option value="${c.id}">${c.label}</option>`
        ).join('');

        return `
        <div class="wn-page">
            <!-- قسم إضافة رقم جديد -->
            <div class="wn-add-section">
                <div class="wn-section-header">
                    <h3><i class="fas fa-plus-circle" style="color:var(--red); margin-left:8px;"></i> إضافة رقم جديد</h3>
                    <button class="btn btn-secondary btn-sm" id="wn-toggle-form" onclick="WalletNumbersPage.toggleForm()">
                        <i class="fas fa-chevron-down" id="wn-form-toggle-icon"></i>
                    </button>
                </div>
                <div class="wn-form-card" id="wn-form-card">
                    <div class="wn-form-grid">
                        <div class="wn-field">
                            <label>رقم الهاتف</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-phone field-icon"></i>
                                <input type="tel" id="wn-phone" placeholder="01xxxxxxxxx" maxlength="11" dir="ltr"
                                    oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                            </div>
                        </div>
                        <div class="wn-field">
                            <label>نوع الشبكة</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-sim-card field-icon"></i>
                                <select id="wn-carrier" class="wn-select">
                                    ${carrierOptions}
                                </select>
                            </div>
                        </div>
                        <div class="wn-field">
                            <label>اسم المحفظة</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-wallet field-icon"></i>
                                <input type="text" id="wn-wallet-name" placeholder="مثال: محفظة أحمد">
                            </div>
                        </div>
                        <div class="wn-field">
                            <label>الرصيد الحالي (ج.م)</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-coins field-icon"></i>
                                <input type="number" id="wn-balance" placeholder="0.00" step="0.01" min="0" dir="ltr">
                            </div>
                        </div>
                        <div class="wn-field">
                            <label>الحد اليومي (ج.م)</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-calendar-day field-icon"></i>
                                <input type="number" id="wn-daily-limit" placeholder="0.00" step="0.01" min="0" dir="ltr">
                            </div>
                        </div>
                        <div class="wn-field">
                            <label>الحد الشهري (ج.م)</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-calendar-alt field-icon"></i>
                                <input type="number" id="wn-monthly-limit" placeholder="0.00" step="0.01" min="0" dir="ltr">
                            </div>
                        </div>
                        <div class="wn-field wn-field-full">
                            <label>ملاحظات</label>
                            <div class="wn-input-wrap">
                                <i class="fas fa-sticky-note field-icon"></i>
                                <textarea id="wn-notes" placeholder="ملاحظات إضافية..." rows="2"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="wn-form-actions">
                        <button class="btn btn-primary wn-submit-btn" onclick="WalletNumbersPage.saveWallet()">
                            <i class="fas fa-save"></i>
                            <span id="wn-submit-text">حفظ الرقم</span>
                        </button>
                        <button class="btn btn-secondary" onclick="WalletNumbersPage.resetForm()">
                            <i class="fas fa-undo"></i>
                            <span>إعادة تعيين</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- شريط البحث والفلاتر -->
            <div class="wn-toolbar">
                <div class="wn-search-wrap">
                    <i class="fas fa-search"></i>
                    <input type="text" id="wn-search" placeholder="بحث بالرقم أو الاسم..." oninput="WalletNumbersPage.filterWallets()">
                </div>
                <div class="wn-carrier-filters" id="wn-carrier-filters">
                    <button class="wn-filter-btn active" data-carrier="all" onclick="WalletNumbersPage.filterByCarrier('all', this)">الكل</button>
                    ${carriers.map(c =>
                        `<button class="wn-filter-btn" data-carrier="${c.id}" onclick="WalletNumbersPage.filterByCarrier('${c.id}', this)" style="--c:${c.color}">
                            ${c.label}
                        </button>`
                    ).join('')}
                </div>
            </div>

            <!-- جدول المحافظ -->
            <div class="wn-table-wrap">
                <table class="dm-table wn-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>رقم الهاتف</th>
                            <th>الشبكة</th>
                            <th>اسم المحفظة</th>
                            <th>الرصيد</th>
                            <th>الحد اليومي</th>
                            <th>الحد الشهري</th>
                            <th>الحالة</th>
                            <th>ملاحظات</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="wn-table-body">
                        <tr>
                            <td colspan="10" class="dm-empty">
                                <i class="fas fa-wallet"></i>
                                <p>جاري تحميل المحافظ...</p>
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
        WalletService.on('walletsLoaded', _onWalletsUpdate);
        WalletService.on('walletAdded', _onWalletsUpdate);
        WalletService.on('walletUpdated', _onWalletsUpdate);
        WalletService.on('walletDeleted', _onWalletsUpdate);
    }

    function _onWalletsUpdate() {
        _refreshWallets();
    }

    let _currentCarrierFilter = 'all';

    /**
     * تحديث جدول المحافظ
     */
    function _refreshWallets() {
        const tbody = document.getElementById('wn-table-body');
        if (!tbody) return;

        const searchTerm = (document.getElementById('wn-search')?.value || '').toLowerCase();
        let wallets = WalletService.getAllWallets();

        if (searchTerm) {
            wallets = wallets.filter(w =>
                (w.phoneNumber || '').includes(searchTerm) ||
                (w.walletName || '').toLowerCase().includes(searchTerm) ||
                (w.notes || '').toLowerCase().includes(searchTerm)
            );
        }

        if (_currentCarrierFilter !== 'all') {
            wallets = wallets.filter(w => w.carrier === _currentCarrierFilter);
        }

        if (!wallets.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="dm-empty">
                        <i class="fas fa-wallet"></i>
                        <p>لا توجد محافظ${searchTerm || _currentCarrierFilter !== 'all' ? ' تطابق البحث' : ' مضافة بعد'}</p>
                        <p class="dm-empty-hint">استخدم النموذج أعلاه لإضافة رقم جديد</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = wallets.map((w, i) => _buildWalletRow(w, i + 1)).join('');
    }

    /**
     * بناء صف المحفظة
     */
    function _buildWalletRow(wallet, index) {
        const carrier = WalletService.getCarrierLabel(wallet.carrier);
        const carrierColor = WalletService.getCarrierColor(wallet.carrier);
        const isOnline = wallet.status === 'online';

        return `
        <tr data-phone-id="${wallet.phoneId || ''}">
            <td>${index}</td>
            <td>
                <span class="wn-phone-number" dir="ltr">${wallet.phoneNumber || '-'}</span>
            </td>
            <td>
                <span class="wn-carrier-badge" style="background:${carrierColor}20; color:${carrierColor}; border:1px solid ${carrierColor}40;">
                    ${carrier}
                </span>
            </td>
            <td><strong>${wallet.walletName || '-'}</strong></td>
            <td class="wn-balance">${(wallet.balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</td>
            <td>${(wallet.dailyLimit || 0).toLocaleString('ar-EG')} ج.م</td>
            <td>${(wallet.monthlyLimit || 0).toLocaleString('ar-EG')} ج.م</td>
            <td>
                <span class="dm-status ${isOnline ? 'status-online' : 'status-offline'}">
                    <i class="fas fa-${isOnline ? 'check-circle' : 'times-circle'}"></i>
                    ${isOnline ? 'متصل' : 'غير متصل'}
                </span>
            </td>
            <td><span class="wn-notes-cell">${wallet.notes || '-'}</span></td>
            <td>
                <div class="dm-actions">
                    <button class="dm-action-btn edit" onclick="WalletNumbersPage.editWallet('${wallet.phoneId}')" title="تعديل">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="dm-action-btn danger" onclick="WalletNumbersPage.deleteWallet('${wallet.phoneId}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }

    /**
     * حفظ محفظة (إضافة أو تعديل)
     */
    async function saveWallet() {
        const phone = document.getElementById('wn-phone')?.value.trim();
        const carrier = document.getElementById('wn-carrier')?.value;
        const walletName = document.getElementById('wn-wallet-name')?.value.trim();
        const balance = document.getElementById('wn-balance')?.value;
        const dailyLimit = document.getElementById('wn-daily-limit')?.value;
        const monthlyLimit = document.getElementById('wn-monthly-limit')?.value;
        const notes = document.getElementById('wn-notes')?.value.trim();

        // التحقق من المدخلات
        if (!phone || phone.length < 11) {
            _showToast('يرجى إدخال رقم هاتف صحيح (11 رقم)', 'error');
            return;
        }
        if (!walletName) {
            _showToast('يرجى إدخال اسم المحفظة', 'error');
            return;
        }

        const data = {
            phoneNumber: phone,
            carrier,
            walletName,
            balance: parseFloat(balance) || 0,
            dailyLimit: parseFloat(dailyLimit) || 0,
            monthlyLimit: parseFloat(monthlyLimit) || 0,
            notes
        };

        let result;
        if (_editMode) {
            result = await WalletService.updateWallet(_editMode, data);
            if (result.success) {
                _showToast('تم تحديث المحفظة بنجاح', 'success');
                _editMode = null;
                document.getElementById('wn-submit-text').textContent = 'حفظ الرقم';
            } else {
                _showToast('فشل التحديث: ' + (result.error || ''), 'error');
            }
        } else {
            result = await WalletService.addWallet(data);
            if (result.success) {
                _showToast('تم إضافة المحفظة بنجاح', 'success');
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
        const wallet = WalletService.getWallet(phoneId);
        if (!wallet) return;

        _editMode = phoneId;
        document.getElementById('wn-phone').value = wallet.phoneNumber || '';
        document.getElementById('wn-carrier').value = wallet.carrier || 'vodafone';
        document.getElementById('wn-wallet-name').value = wallet.walletName || '';
        document.getElementById('wn-balance').value = wallet.balance || '';
        document.getElementById('wn-daily-limit').value = wallet.dailyLimit || '';
        document.getElementById('wn-monthly-limit').value = wallet.monthlyLimit || '';
        document.getElementById('wn-notes').value = wallet.notes || '';

        document.getElementById('wn-submit-text').textContent = 'تحديث الرقم';

        // فتح النموذج إذا كان مغلق
        const formCard = document.getElementById('wn-form-card');
        if (formCard && formCard.style.display === 'none') {
            formCard.style.display = 'block';
            const icon = document.getElementById('wn-form-toggle-icon');
            if (icon) icon.style.transform = 'rotate(180deg)';
        }

        // التمرير للنموذج
        formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * حذف محفظة
     */
    async function deleteWallet(phoneId) {
        if (!confirm('هل أنت متأكد من حذف هذه المحفظة؟')) return;

        const result = await WalletService.deleteWallet(phoneId);
        if (result.success) {
            _showToast('تم حذف المحفظة', 'success');
        } else {
            _showToast('فشل الحذف', 'error');
        }
    }

    /**
     * إعادة تعيين النموذج
     */
    function resetForm() {
        _editMode = null;
        const fields = ['wn-phone', 'wn-wallet-name', 'wn-balance', 'wn-daily-limit', 'wn-monthly-limit', 'wn-notes'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('wn-carrier').selectedIndex = 0;
        document.getElementById('wn-submit-text').textContent = 'حفظ الرقم';
    }

    /**
     * إظهار/إخفاء النموذج
     */
    function toggleForm() {
        const card = document.getElementById('wn-form-card');
        const icon = document.getElementById('wn-form-toggle-icon');
        if (!card) return;
        const isHidden = card.style.display === 'none';
        card.style.display = isHidden ? 'block' : 'none';
        if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : '';
    }

    /**
     * فلترة حسب الشبكة
     */
    function filterByCarrier(carrier, btn) {
        _currentCarrierFilter = carrier;
        document.querySelectorAll('.wn-filter-btn').forEach(b => b.classList.remove('active'));
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
            const wrap = document.getElementById('toast-wrap');
            if (!wrap) return;
            const t = document.createElement('div');
            t.className = `toast toast-${type || 'info'}`;
            t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${message}`;
            wrap.appendChild(t);
            setTimeout(() => t.remove(), 4000);
        }
    }

    function destroy() {
        WalletService.off('walletsLoaded', _onWalletsUpdate);
        WalletService.off('walletAdded', _onWalletsUpdate);
        WalletService.off('walletUpdated', _onWalletsUpdate);
        WalletService.off('walletDeleted', _onWalletsUpdate);
    }

    return {
        render,
        saveWallet,
        editWallet,
        deleteWallet,
        resetForm,
        toggleForm,
        filterByCarrier,
        filterWallets,
        destroy
    };
})();