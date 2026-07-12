/**
 * Mobile Bottom Navigation — شريط التنقل السفلي للموبايل
 * يظهر فقط على الشاشات الصغيرة ويوفر وصول سريع للصفحات الأساسية
 * ============================================================
 */

const MobileNav = (() => {
    var _injected = false;
    var _currentPage = '';

    var NAV_ITEMS = [
        { page: 'dashboard',         icon: 'fa-tachometer-alt', label: 'الرئيسية' },
        { page: 'device-manager',    icon: 'fa-mobile-alt',    label: 'الأجهزة' },
        { page: 'newTransaction',    icon: 'fa-plus-circle',   label: 'جديد',    isCenter: true },
        { page: 'wallet-numbers',    icon: 'fa-wallet',        label: 'المحافظ' },
        { page: 'reports',           icon: 'fa-chart-bar',     label: 'التقارير' }
    ];

    /**
     * حقن شريط التنقل السفلي في DOM
     */
    function inject() {
        if (_injected) return;
        var pgApp = document.getElementById('pg-app');
        if (!pgApp) { setTimeout(inject, 200); return; }

        // إنشاء الشريط
        var nav = document.createElement('nav');
        nav.id = 'mobile-bottom-nav';
        nav.className = 'mobile-bottom-nav';
        nav.innerHTML = NAV_ITEMS.map(function(item) {
            if (item.isCenter) {
                return '<button class="mbn-item mbn-center" data-page="' + item.page + '" onclick="MobileNav.goTo(\'' + item.page + '\')">' +
                    '<div class="mbn-center-icon"><i class="fas ' + item.icon + '"></i></div>' +
                    '<span>' + item.label + '</span></button>';
            }
            return '<button class="mbn-item" data-page="' + item.page + '" onclick="MobileNav.goTo(\'' + item.page + '\')">' +
                '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span></button>';
        }).join('');

        pgApp.appendChild(nav);

        // إضافة مسافة سفلية للمحتوى لمنع التغطية
        var style = document.createElement('style');
        style.id = 'mobile-nav-spacer';
        style.textContent = '@media (max-width: 768px) { #pg-app { padding-bottom: 72px !important; } }';
        if (!document.getElementById('mobile-nav-spacer')) {
            document.head.appendChild(style);
        }

        _injected = true;
        _observePageChanges();
    }

    /**
     * التنقل لصفحة محددة
     */
    function goTo(page) {
        if (typeof App !== 'undefined' && App.navigate) {
            App.navigate(page);
        }
        setActive(page);
        if (typeof closeSidebar === 'function') closeSidebar();
    }

    /**
     * تحديد العنصر النشط
     */
    function setActive(page) {
        _currentPage = page;
        document.querySelectorAll('.mbn-item').forEach(function(item) {
            var itemPage = item.dataset.page;
            var isActive = itemPage === page ||
                             (page === 'new-transaction' && itemPage === 'newTransaction') ||
                             (page === 'transactions' && itemPage === 'newTransaction') ||
                             (page === 'device-dashboard' && itemPage === 'device-manager') ||
                             (page === 'wallet-numbers' && itemPage === 'wallet-numbers');
            item.classList.toggle('active', isActive);
        });
    }

    /**
     * مراقبة تغييرات الصفحة من القائمة الجانبية
     */
    function _observePageChanges() {
        var observer = new MutationObserver(function() {
            var title = document.getElementById('page-title');
            if (title) {
                var titleText = title.textContent;
                var pageMap = {
                    'لوحة التحكم': 'dashboard',
                    'العمليات': 'transactions',
                    'التقارير': 'reports',
                    'Device Manager': 'device-manager',
                    'لوحة تحكم الأجهزة': 'device-dashboard',
                    'Wallet Numbers': 'wallet-numbers'
                };
                var keys = Object.keys(pageMap);
                for (var i = 0; i < keys.length; i++) {
                    if (titleText.indexOf(keys[i]) !== -1) {
                        setActive(pageMap[keys[i]]);
                        break;
                    }
                }
            }
        });

        var pageTitle = document.getElementById('page-title');
        if (pageTitle) observer.observe(pageTitle, { childList: true, characterData: true, subtree: true });
    }

    return { inject: inject, goTo: goTo, setActive: setActive };
})();

// حقن تلقائياً بعد تحميل التطبيق
(function initMobileNav() {
    function tryInject() {
        var pgApp = document.getElementById('pg-app');
        if (pgApp) {
            MobileNav.inject();
        } else {
            setTimeout(tryInject, 300);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(tryInject, 600); });
    } else {
        setTimeout(tryInject, 600);
    }
})();