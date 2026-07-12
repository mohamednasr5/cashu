/**
 * Device Module — الوحدة الرئيسية لربط نظام إدارة الأجهزة بالتطبيق الحالي
 * يضيف الصفحات الجديدة للقائمة الجانبية ونظام التنقل بدون تعديل أي ملف موجود
 * ============================================================
 * الملفات المعدلة: index.html فقط (إضافة سكريبت واحد)
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
        { page: 'device-dashboard', icon: 'fa-tachometer-alt', label: 'لوحة الأجهزة', perm: 'viewDashboard' },
        { page: 'device-manager', icon: 'fa-mobile-alt', label: 'Device Manager', perm: 'viewDashboard' },
        { page: 'wallet-numbers', icon: 'fa-wallet', label: 'Wallet Numbers', perm: 'viewDashboard' }
    ];

    // صفحة مرجع الوجهات
    const NEW_ROUTES = {
        'device-dashboard': () => DeviceDashboardPage.render(),
        'device-manager':   () => DeviceManagerPage.render(),
        'wallet-numbers':    () => WalletNumbersPage.render()
    };

    /**
     * تهيئة الوحدة — تُستدعى مرة واحدة بعد تحميل التطبيق
     */
    async function init() {
        if (_initialized) return;

        // 1. تهيئة Firebase
        const fbOk = await FirebaseService.init();
        console.log('[DeviceModule] Firebase:', fbOk ? 'متصل' : 'غير متصل');

        // 2. تهيئة الخدمات
        AdbService.init({
            onDeviceUpdate: (device) => DeviceService.init(),
            onConnectionChange: () => {}
        });

        await DeviceService.init();
        await WalletService.init();

        // 3. حقن العناصر الجديدة في التطبيق
        _injectNavigation();
        _injectRoutes();

        _initialized = true;
        console.log('[DeviceModule] تم التهيئة بنجاح');
    }

    /**
     * حقن عناصر القائمة الجديدة في الـ Sidebar
     * يوسع App._buildNav بإضافة العناصر الجديدة
     */
    function _injectNavigation() {
        if (typeof App === 'undefined' || !App._buildNav) {
            console.warn('[DeviceModule] لم يتم العثور على App._buildNav');
            return;
        }

        // حفظ الدالة الأصلية
        _originalBuildNav = App._buildNav;

        // استبدال الدالة بنسخة موسعة
        App._buildNav = function(permissions) {
            // استدعاء الدالة الأصلية أولاً
            _originalBuildNav.call(this, permissions);

            // إضافة العناصر الجديدة
            const nav = document.getElementById('sb-nav');
            if (!nav) return;

            const perms = permissions || (typeof Auth !== 'undefined' ? Auth.getPermissions() : {});

            NEW_MENU_ITEMS.forEach(item => {
                if (item.divider) {
                    nav.insertAdjacentHTML('beforeend',
                        '<div class="sb-divider"></div>'
                    );
                    return;
                }

                // التحقق من الأذونات
                if (item.perm && perms && !perms[item.perm]) return;

                const link = document.createElement('a');
                link.href = '#';
                link.className = 'nav-item';
                link.dataset.page = item.page;
                link.innerHTML = `<i class="fas ${item.icon}"></i><span>${item.label}</span>`;

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof App !== 'undefined' && App.navigate) {
                        App.navigate(item.page);
                    } else {
                        _fallbackNavigate(item.page, item.label);
                    }
                    if (typeof closeSidebar === 'function') closeSidebar();
                });

                nav.appendChild(link);
            });
        };

        // إعادة بناء القائمة إذا كان التطبيق يعمل بالفعل
        const nav = document.getElementById('sb-nav');
        if (nav && nav.children.length > 0) {
            // التطبيق يعمل بالفعل - نعيد بناء القائمة
            const perms = typeof Auth !== 'undefined' && Auth.getPermissions ? Auth.getPermissions() : {};
            App._buildNav(perms);
        }
    }

    /**
     * حقن المسارات الجديدة في نظام التنقل
     */
    function _injectRoutes() {
        if (typeof App === 'undefined' || !App.navigate) {
            console.warn('[DeviceModule] لم يتم العثور على App.navigate');
            return;
        }

        _originalNavigate = App.navigate;

        App.navigate = function(pageKey) {
            // تدمير الصفحة الحالية إذا كانت من وحدتنا
            _destroyCurrentPage();

            // التحقق من المسارات الجديدة أولاً
            if (NEW_ROUTES[pageKey]) {
                _currentPage = pageKey;
                const pageContent = document.getElementById('page-content');
                const pageTitle = document.getElementById('page-title');

                if (pageContent) {
                    // تنظيف الرسوم البيانية السابقة (إن وجدت)
                    if (typeof App !== 'undefined' && App._chartInstances) {
                        Object.values(App._chartInstances).forEach(c => { try { c.destroy(); } catch(e) {} });
                        App._chartInstances = {};
                    }
                    pageContent.innerHTML = '';
                }

                if (pageTitle) {
                    const titles = {
                        'device-dashboard': 'لوحة تحكم الأجهزة',
                        'device-manager': 'Device Manager',
                        'wallet-numbers': 'Wallet Numbers'
                    };
                    pageTitle.textContent = titles[pageKey] || pageKey;
                }

                // تنشيط عنصر القائمة
                document.querySelectorAll('#sb-nav .nav-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.page === pageKey);
                });

                // تنفيذ المسار الجديد
                NEW_ROUTES[pageKey]();
                return;
            }

            // للمسارات الأصلية - استدعاء الدالة الأصلية
            return _originalNavigate.call(this, pageKey);
        };
    }

    /**
     * التنقل الاحتياطي (إذا لم يتم العثور على App.navigate)
     */
    function _fallbackNavigate(pageKey, label) {
        _destroyCurrentPage();

        if (NEW_ROUTES[pageKey]) {
            _currentPage = pageKey;
            const pageContent = document.getElementById('page-content');
            const pageTitle = document.getElementById('page-title');

            if (pageTitle) pageTitle.textContent = label || pageKey;
            if (pageContent) pageContent.innerHTML = '';

            document.querySelectorAll('#sb-nav .nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.page === pageKey);
            });

            NEW_ROUTES[pageKey]();
        }
    }

    /**
     * تدمير الصفحة الحالية
     */
    function _destroyCurrentPage() {
        const destroyers = {
            'device-manager': () => DeviceManagerPage.destroy(),
            'wallet-numbers': () => WalletNumbersPage.destroy(),
            'device-dashboard': () => DeviceDashboardPage.destroy()
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
        AdbService.cleanup();
        DeviceService.cleanup();
        WalletService.cleanup();
        FirebaseService.cleanup();
        _initialized = false;
    }

    return {
        init,
        cleanup
    };
})();

// ============================================================
// التهيئة التلقائية بعد تحميل التطبيق
// ============================================================
(function waitForApp() {
    function tryInit() {
        if (typeof App !== 'undefined' && App._buildNav && App.navigate) {
            // التطبيق جاهز - تهيئة الوحدة
            DeviceModule.init().catch(err => {
                console.error('[DeviceModule] خطأ في التهيئة:', err);
            });
        } else {
            // الانتظار و المحاولة مجدداً
            setTimeout(tryInit, 300);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(tryInit, 500));
    } else {
        setTimeout(tryInit, 500);
    }
})();