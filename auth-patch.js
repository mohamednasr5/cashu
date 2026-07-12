/**
 * Auth Patch — إضافة بيانات دخول المسؤول
 * يضيف المستخدم hammad بكلمة مرور 521988 كمسؤول
 * يعمل كـ patch فوق app.js بدون تعديله
 * ============================================================
 */
'use strict';

(function patchAuth() {
    function applyPatch() {
        if (typeof Auth === 'undefined' || typeof DB === 'undefined' || typeof hashPw === 'undefined') {
            setTimeout(applyPatch, 100);
            return;
        }

        // حفظ الدالة الأصلية
        const originalLogin = Auth.login;

        // بيانات المسؤول
        const ADMIN_USERNAME = 'hammad';
        const ADMIN_PASSWORD = '521988';
        const ADMIN_NAME = 'محمد حماد';
        const ADMIN_ROLE = 'admin';

        // التأكد من وجود المستخدم في قاعدة البيانات
        function ensureAdminExists() {
            const username = ADMIN_USERNAME.toLowerCase().trim();
            let user = DB.users.byUser(username);

            if (!user) {
                // إنشاء المستخدم إذا لم يكن موجوداً
                // Auth.PERMISSIONS هي array، الصلاحيات الحقيقية في ROLE_DEFAULTS
                const adminPerms = (Auth.ROLE_DEFAULTS && Auth.ROLE_DEFAULTS.admin)
                    ? { ...Auth.ROLE_DEFAULTS.admin }
                    : {
                        viewDashboard: true,
                        addTransactions: true,
                        editTransactions: true,
                        deleteTransactions: true,
                        viewReports: true,
                        exportReports: true,
                        manageFees: true,
                        manageUsers: true,
                        viewProfits: true,
                        viewVault: true,
                        viewLatestTxns: true,
                        viewTxnsOnly: true,
                        manageSuppliers: true,
                        manageBackup: true,
                        skipBackupPrompt: true
                    };

                DB.users.add({
                    id: typeof uuid === 'function' ? uuid() : ('U_' + Date.now()),
                    username: username,
                    password: hashPw(ADMIN_PASSWORD),
                    name: ADMIN_NAME,
                    role: ADMIN_ROLE,
                    branchId: 'main',
                    permissions: adminPerms,
                    active: true,
                    createdAt: new Date().toISOString()
                });

                console.log('[AuthPatch] تم إنشاء مستخدم مسؤول:', ADMIN_USERNAME);
            } else {
                // تحديث كلمة المرور والأذونات إذا لزم الأمر
                const needsUpdate = user.password !== hashPw(ADMIN_PASSWORD) || !user.active;
                if (needsUpdate) {
                    DB.users.update(user.id, {
                        password: hashPw(ADMIN_PASSWORD),
                        active: true,
                        role: ADMIN_ROLE,
                        name: ADMIN_NAME,
                        permissions: user.permissions || (Auth.ROLE_DEFAULTS && Auth.ROLE_DEFAULTS.admin) || {}
                    });
                }
            }
        }

        // استبدال دالة تسجيل الدخول
        Auth.login = function(username, password) {
            const inputUser = (username || '').toLowerCase().trim();

            // إذا كان المستخدم هو المسؤول
            if (inputUser === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                ensureAdminExists();

                // جلب بيانات المستخدم المحدثة
                const user = DB.users.byUser(inputUser);
                if (user && user.active) {
                    const session = {
                        userId: user.id,
                        username: user.username,
                        name: user.name,
                        role: user.role,
                        branchId: (user.branchId === 'main') ? 'main' : user.branchId,
                        permissions: user.permissions
                    };
                    DB.session.set(session);
                    console.log('[AuthPatch] تم تسجيل دخول:', ADMIN_USERNAME);
                    return { ok: true, sess: session };
                }
            }

            // للمستخدمين الآخرين — استدعاء الدالة الأصلية
            return originalLogin.call(this, username, password);
        };

        console.log('[AuthPatch] تم تفعيل بيانات دخول المسؤول بنجاح');
    }

    // بدء التطبيق
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(applyPatch, 200));
    } else {
        setTimeout(applyPatch, 200);
    }
})();