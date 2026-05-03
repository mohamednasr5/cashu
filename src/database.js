// ═══════════════════════════════════════════════════════════════════
//  cashty — Firebase Realtime Database adapter
//  برمجة: المهندس محمد حماد | 01279934735
// ═══════════════════════════════════════════════════════════════════

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

let firebaseApp = null;
let db = null;

function initFirebase() {
  if (firebaseApp) return db;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  } else {
    firebaseApp = admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL ||
        'https://cashty-cd354-default-rtdb.firebaseio.com'
    });
  }

  db = admin.database();
  console.log('🔥 Firebase Realtime Database متصل');
  return db;
}

function getDB() {
  if (!db) initFirebase();
  return db;
}

async function dbGet(path) {
  const snap = await getDB().ref(path).get();
  return snap.exists() ? snap.val() : null;
}

async function dbSet(path, data) {
  await getDB().ref(path).set(data);
  return data;
}

async function dbPush(path, data) {
  const r = await getDB().ref(path).push(data);
  return { id: r.key, ...data };
}

async function dbUpdate(path, data) {
  await getDB().ref(path).update(data);
  return data;
}

async function dbRemove(path) {
  await getDB().ref(path).remove();
}

async function dbGetAll(path) {
  const snap = await getDB().ref(path).get();
  if (!snap.exists()) return [];
  const val = snap.val();
  return Object.entries(val).map(([id, item]) => ({ id, ...item }));
}

async function initDB() {
  initFirebase();

  const users = await dbGet('users');
  const adminExists = users
    ? Object.values(users).some(u => u.username === 'admin')
    : false;

  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await dbPush('users', {
      username:   'admin',
      password:   hashedPassword,
      full_name:  'مدير النظام',
      role:       'admin',
      phone:      '01279934735',
      is_active:  true,
      created_at: new Date().toISOString(),
      last_login: null
    });
    console.log('✅ تم إنشاء حساب المدير الافتراضي: admin / admin123');
  }

  const settings = await dbGet('settings');
  if (!settings) {
    await dbSet('settings', {
      shop_name:          'cashty',
      shop_phone:         '01279934735',
      currency:           'جنيه مصري',
      default_fee_send:   '0.5',
      default_fee_receive:'0',
      default_fee_withdraw:'1',
      auto_sms_parse:     '1',
      low_balance_alert:  '1000',
      developer:          'المهندس محمد حماد | 01279934735'
    });
  }

  console.log('✅ قاعدة بيانات Firebase جاهزة');
}

module.exports = { getDB, initDB, dbGet, dbSet, dbPush, dbUpdate, dbRemove, dbGetAll };
