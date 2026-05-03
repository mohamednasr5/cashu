<div align="center">

# 💸 cashty
### نظام إدارة المحافظ الإلكترونية

**🔥 مدعوم بـ Firebase Realtime Database**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-orange?logo=firebase)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

> **⚡ برمجة: المهندس محمد حماد**  
> 📞 **01279934735**

</div>

---

## 🌟 المميزات

| الميزة | التفاصيل |
|--------|---------|
| 🏦 إدارة المحافظ | فودافون كاش · اورانج كاش · اتصالات كاش · وي باي |
| 💰 العمليات | إرسال · استلام · سحب · إيداع |
| 📊 الإحصائيات | لوحة تحكم شاملة مع رسوم بيانية |
| 👥 إدارة العملاء | سجل كامل للعملاء والمعاملات |
| 📱 تكامل Android | استقبال SMS تلقائياً |
| 🔒 صلاحيات | مدير · كاشير · مشاهد |
| 🔥 Firebase | مزامنة فورية — لا قاعدة بيانات محلية |
| 📡 WebSocket | تحديثات لحظية |

---

## 🚀 التثبيت المحلي

```bash
# 1. استنساخ المستودع
git clone https://github.com/YOUR_USERNAME/cashty.git
cd cashty

# 2. تثبيت الحزم
npm install

# 3. ضبط المتغيرات
cp .env.example .env
# عدّل .env وأضف FIREBASE_DATABASE_URL

# 4. تشغيل التطبيق
npm run dev
```

---

## 🔑 متغيرات البيئة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `PORT` | منفذ الخادم | `3000` |
| `JWT_SECRET` | مفتاح التشفير (32 حرف+) | `super_secret_key...` |
| `FIREBASE_DATABASE_URL` | رابط قاعدة البيانات | `https://cashty-cd354-default-rtdb.firebaseio.com` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON حساب الخدمة | `{"type":"service_account",...}` |

---

## 🔥 إعداد Firebase

### 1. تمكين Realtime Database
- افتح [Firebase Console](https://console.firebase.google.com)
- اختر مشروع **cashty-cd354**
- من القائمة: **Build → Realtime Database → Create database**
- اختر الوضع **Test mode** مبدئياً

### 2. الحصول على Service Account
```
Firebase Console → Project Settings → Service Accounts
→ Generate new private key → حمّل الـ JSON
```

### 3. نشر قواعد الأمان
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database
```

---

## 📦 النشر على GitHub

### إعداد Secrets في GitHub
```
Settings → Secrets → Actions → New repository secret
```

| الاسم | القيمة |
|-------|--------|
| `FIREBASE_DATABASE_URL` | `https://cashty-cd354-default-rtdb.firebaseio.com` |
| `FIREBASE_SERVICE_ACCOUNT` | محتوى ملف الـ JSON كاملاً |
| `JWT_SECRET` | مفتاح سري قوي |
| `RAILWAY_TOKEN` | توكن Railway (للنشر التلقائي) |

### النشر على Railway
```bash
# تثبيت Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## 📁 هيكل المشروع

```
cashty/
├── src/
│   ├── database.js          # Firebase adapter
│   ├── index.js             # Express server
│   ├── middleware/
│   │   └── auth.js          # JWT middleware
│   ├── routes/
│   │   ├── auth.js          # المصادقة
│   │   ├── wallets.js       # المحافظ
│   │   ├── transactions.js  # المعاملات
│   │   ├── stats.js         # الإحصائيات
│   │   ├── customers.js     # العملاء
│   │   ├── reports.js       # التقارير
│   │   └── android.js       # تكامل Android
│   └── utils/
│       └── websocket.js
├── public/
│   ├── index.html           # الواجهة (RTL عربي)
│   ├── css/style.css
│   └── js/app.js
├── firebase/
│   └── database.rules.json  # قواعد أمان Firebase
├── .github/
│   └── workflows/
│       ├── deploy.yml       # نشر تلقائي
│       └── firebase-rules.yml
├── firebase.json
├── .env.example
└── README.md
```

---

## 🔐 الدخول الافتراضي

| | |
|--|--|
| **المستخدم** | `admin` |
| **كلمة المرور** | `admin123` |

> ⚠️ غيّر كلمة المرور فوراً بعد أول دخول

---

## 📊 بنية Firebase Realtime Database

```
cashty-cd354/
├── users/           # المستخدمين
├── wallets/         # المحافظ
├── transactions/    # المعاملات
├── customers/       # العملاء
├── sms_messages/    # رسائل SMS
├── android_devices/ # الأجهزة
├── activity_log/    # سجل الأحداث
└── settings/        # إعدادات النظام
```

---

<div align="center">

**⚡ cashty v2.0**  
برمجة: **المهندس محمد حماد** | 📞 **01279934735**  
🔥 Firebase Realtime Database | 🟢 Node.js + Express

</div>
