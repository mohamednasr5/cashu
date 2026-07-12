/**
 * Device Module — الوحدة الرئيسية لربط نظام إدارة الأجهزة بالتطبيق الحالي
 * يضيف الصفحات الجديدة للقائمة الجانبية ونظام التنقل بدون تعديل أي ملف موجود
 * ============================================================
 * الحل: حقن التنقل يتم أولاً BEFORE أي خدمة حتى لا يتعطل إذا فشل Firebase
 * ============================================================
 */
'use strict';

const DeviceModule = (() => {

    let _initialized = false;
    let _currentPage = null;
    let _originalBuildNav = null;
    let _originalNavigate = null;

    // عناصر القائمة الجديدة
    const NEW_MENU_ITEMS = [
        { divider: true },
        { page: 'device-dashboard', icon: 'fa-tachometer-alt', label: 'لوحة الأجهزة' },
        { page: 'device-manager', icon: 'fa-mobile-alt', label: 'Device Manager' },
        { page: 'wallet-numbers', icon: 'fa-wallet', label: 'Wallet Numbers' }
    ];

    // صفحة مرجع الوجهات
    const NEW_ROUTES = {
        'device-dashboard': function() { DeviceDashboardPage.render(); },
        'device-manager': function() { DeviceManagerPage.render(); },
        'wallet-numbers': function() { WalletNumbersPage.render(); }
    };

    /**
     * تهيئة الوحدة
     * الخطوة 1: حقن التنقل فوراً (بدون انتظار Firebase)
     * الخطوة 2: تهيئة الخدمات في الخلفية
     */
    function init() {
        if (_initialized) return;
        _initialized = true;

        // 1. حقن التنقل أولاً — هذا يضمن ظهور العناصر في القائمة
        _injectNavigation();
        _injectRoutes();

        console.log('[DeviceModule] تم حقن التنقل بنجاح');

        // 2. تهيئة الخدمات في الخلفية (غير مزامن)
        _initServices().catch(function(err) {
            console.warn('[DeviceModule] تحذير: بعض الخدمات لم تبدأ:', err.message);
        });
    }

    /**
     * تهيئة الخدمات في الخلفية
     */
    async function _initServices() {
        try {
            var fbOk = await FirebaseService.init();
            console.log('[DeviceModule] Firebase:', fbOk ? 'متصل' : 'غير متصل');
        } catch(e) {
            console.warn('[DeviceModule] Firebase init error:', e.message);
        }

        try {
            AdbService.init({
                onDeviceUpdate: function(device) { DeviceService.init(); },
                onConnectionChange: function() {}
            });
        } catch(e) {
            console.warn('[DeviceModule] ADB init error:', e.message);
        }

        try { await DeviceService.init(); } catch(e) {}
        try { await WalletService.init(); } catch(e) {}

        console.log('[DeviceModule] تم تهيئة جميع الخدمات');
    }

    /**
     * حقن عناصر القائمة الجديدة في الـ Sidebar
     */
    function _injectNavigation() {
        if (typeof App === 'undefined' || !App._buildNav) {
            console.warn('[DeviceModule] App._buildNav غير موجود بعد — سنعاوض لاحقاً');
            setTimeout(_injectNavigation, 300);
            return;
        }

        // حفظ الدالة الأصلية
        _originalBuildNav = App._buildNav;

        // استبدال الدالة بنسخة موسعة
        App._buildNav = function(permissions) {
            // استدعاء الدالة الأصلية أولاً
            try {
                _originalBuildNav.call(this, permissions);
            } catch(e) {
                console.warn('[DeviceModule] خطأ في _buildNav الأصلي:', e);
            }

            // إضافة العناصر الجديدة
            var nav = document.getElementById('sb-nav');
            if (!nav) {
                // محاولة ثانية بـ querySelector
                nav = document.querySelector('.sb-nav');
            }
            if (!nav) return;

            NEW_MENU_ITEMS.forEach(function(item) {
                if (item.divider) {
                    var divider = document.createElement('div');
                    divider.className = 'sb-divider';
                    nav.appendChild(divider);
                    return;
                }

                var link = document.createElement('a');
                link.href = '#';
                link.className = 'nav-item';
                link.setAttribute('data-page', item.page);
                link.innerHTML = '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span>';

                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof App !== 'undefined' && App.navigate) {
                        App.navigate(item.page);
                    } else {
                        _fallbackNavigate(item.page, item.label);
                    }
                    if (typeof closeSidebar === 'function') closeSidebar();
                });

                nav.appendChild(link);
            });

            console.log('[DeviceModule] تمت إضافة عناصر القائمة الجديدة');
        };

        // إعادة بناء القائمة إذا كان التطبيق يعمل بالفعل (المستخدم مسجل الدخول)
        var nav = document.getElementById('sb-nav');
        if (nav && nav.children.length > 0) {
            try {
                App._buildNav();
            } catch(e) {
                console.warn('[DeviceModule] خطأ في إعادة بناء القائمة:', e);
            }
        }
    }

    /**
     * حقن المسارات الجديدة في نظام التنقل
     */
    function _injectRoutes() {
        if (typeof App === 'undefined' || !App.navigate) {
            console.warn('[DeviceModule] App.navigate غير موجود بعد — سنعاوض لاحقاً');
            setTimeout(_injectRoutes, 300);
            return;
        }

        _originalNavigate = App.navigate;

        App.navigate = function(pageKey) {
            // تدمير الصفحة الحالية إذا كانت من وحدتنا
            _destroyCurrentPage();

            // التحقق من المسارات الجديدة أولاً
            if (NEW_ROUTES[pageKey]) {
                _currentPage = pageKey;
                var pageContent = document.getElementById('page-content');
                var pageTitle = document.getElementById('page-title');

                if (pageContent) {
                    // تنظيف الرسوم البيانية السابقة
                    if (typeof App !== 'undefined' && App._chartInstances) {
                        try {
                            Object.values(App._chartInstances).forEach(function(c) { try { c.destroy(); } catch(e) {} });
                            App._chartInstances = {};
                        } catch(e) {}
                    }
                    pageContent.innerHTML = '';
                }

                if (pageTitle) {
                    var titles = {
                        'device-dashboard': 'لوحة تحكم الأجهزة',
                        'device-manager': 'Device Manager',
                        'wallet-numbers': 'Wallet Numbers'
                    };
                    pageTitle.textContent = titles[pageKey] || pageKey;
                }

                // تنشيط عنصر القائمة
                document.querySelectorAll('#sb-nav .nav-item').forEach(function(item) {
                    var isActive = item.getAttribute('data-page') === pageKey;
                    item.classList.toggle('active', isActive);
                });

                // تنفيذ المسار الجديد
                try {
                    NEW_ROUTES[pageKey]();
                } catch(e) {
                    console.error('[DeviceModule] خطأ في عرض الصفحة:', pageKey, e);
                    if (pageContent) {
                        pageContent.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2);"><i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:16px;display:block;color:var(--warning);"></i><p>حدث خطأ أثناء تحميل الصفحة</p><p style="font-size:12px;margin-top:8px;">' + e.message + '</p></div>';
                    }
                }
                return;
            }

            // للمسارات الأصلية - استدعاء الدالة الأصلية
            return _originalNavigate.call(this, pageKey);
        };

        console.log('[DeviceModule] تم حقن نظام التنقل');
    }

    /**
     * التنقل الاحتياطي
     */
    function _fallbackNavigate(pageKey, label) {
        _destroyCurrentPage();

        if (NEW_ROUTES[pageKey]) {
            _currentPage = pageKey;
            var pageContent = document.getElementById('page-content');
            var pageTitle = document.getElementById('page-title');

            if (pageTitle) pageTitle.textContent = label || pageKey;
            if (pageContent) pageContent.innerHTML = '';

            document.querySelectorAll('#sb-nav .nav-item').forEach(function(item) {
                item.classList.toggle('active', item.getAttribute('data-page') === pageKey);
            });

            NEW_ROUTES[pageKey]();
        }
    }

    /**
     * تدمير الصفحة الحالية
     */
    function _destroyCurrentPage() {
        var destroyers = {
            'device-manager': function() { try { DeviceManagerPage.destroy(); } catch(e) {} },
            'wallet-numbers': function() { try { WalletNumbersPage.destroy(); } catch(e) {} },
            'device-dashboard': function() { try { DeviceDashboardPage.destroy(); } catch(e) {} }
        };

        if (_currentPage && destroyers[_currentPage]) {
            try { destroyers[_currentPage](); } catch(e) {}
        }
        _currentPage = null;
    }

    /**
     * تنظيف جميع الموارد
     */
    function cleanup() {
        _destroyCurrentPage();
        try { AdbService.cleanup(); } catch(e) {}
        try { DeviceService.cleanup(); } catch(e) {}
        try { WalletService.cleanup(); } catch(e) {}
        try { FirebaseService.cleanup(); } catch(e) {}
        _initialized = false;
    }

    return {
        init: init,
        cleanup: cleanup
    };
})();

// ============================================================
// التهيئة التلقائية بعد تحميل التطبيق
// ============================================================
(function waitForApp() {
    function tryInit() {
        if (typeof App !== 'undefined' && App._buildNav && App.navigate) {
            DeviceModule.init();
        } else {
            setTimeout(tryInit, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(tryInit, 300); });
    } else {
        setTimeout(tryInit, 300);
    }
})();