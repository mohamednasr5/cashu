const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { dbGet, dbGetAll, dbPush, dbUpdate, dbSet } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ── Login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });

    const usersObj = await dbGet('users');
    if (!usersObj) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const entry = Object.entries(usersObj)
      .map(([id, u]) => ({ id, ...u }))
      .find(u => u.username === username && u.is_active);

    if (!entry || !bcrypt.compareSync(password, entry.password))
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    await dbUpdate(`users/${entry.id}`, { last_login: new Date().toISOString() });

    const token = jwt.sign(
      { id: entry.id, username: entry.username, role: entry.role },
      process.env.JWT_SECRET || 'cashty_secret_2024',
      { expiresIn: '24h' }
    );

    // activity log
    await dbPush('activity_log', {
      user_id:    entry.id,
      action:     'login',
      details:    `تسجيل دخول`,
      created_at: new Date().toISOString()
    });

    res.json({
      token,
      user: { id: entry.id, username: entry.username, full_name: entry.full_name, role: entry.role, phone: entry.phone }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Me ────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  const u = await dbGet(`users/${req.user.id}`);
  if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const { password, ...rest } = u;
  res.json({ id: req.user.id, ...rest });
});

// ── Change password ───────────────────────────────────────────────
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    const user = await dbGet(`users/${req.user.id}`);
    if (!bcrypt.compareSync(old_password, user.password))
      return res.status(400).json({ error: 'كلمة المرور القديمة غير صحيحة' });
    if (new_password.length < 6)
      return res.status(400).json({ error: 'كلمة المرور الجديدة 6 أحرف على الأقل' });

    await dbUpdate(`users/${req.user.id}`, { password: bcrypt.hashSync(new_password, 10) });
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Get users (admin) ─────────────────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersObj = await dbGet('users') || {};
    const users = Object.entries(usersObj).map(([id, u]) => {
      const { password, ...rest } = u;
      return { id, ...rest };
    });
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Create user ───────────────────────────────────────────────────
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, role, phone } = req.body;
    if (!username || !password || !full_name)
      return res.status(400).json({ error: 'البيانات المطلوبة غير مكتملة' });

    const usersObj = await dbGet('users') || {};
    if (Object.values(usersObj).some(u => u.username === username))
      return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });

    const result = await dbPush('users', {
      username,
      password:   bcrypt.hashSync(password, 10),
      full_name,
      role:       role || 'cashier',
      phone:      phone || '',
      is_active:  true,
      created_at: new Date().toISOString(),
      last_login: null
    });
    res.json({ id: result.id, message: 'تم إنشاء الحساب بنجاح' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Update user ───────────────────────────────────────────────────
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { full_name, role, phone, is_active } = req.body;
    await dbUpdate(`users/${req.params.id}`, { full_name, role, phone, is_active });
    res.json({ message: 'تم تحديث الحساب بنجاح' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
