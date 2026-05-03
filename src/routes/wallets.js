const express = require('express');
const router  = express.Router();
const { dbGet, dbSet, dbPush, dbUpdate, dbRemove, dbGetAll } = require('../database');
const { requireAdmin } = require('../middleware/auth');

const PROVIDER_LIMITS = {
  vodafone:  { daily: 60000,  monthly: 200000 },
  orange:    { daily: 70000,  monthly: 400000 },
  etisalat:  { daily: 120000, monthly: 400000 },
  we:        { daily: 50000,  monthly: 200000 }
};

// ── helpers ───────────────────────────────────────────────────────
async function computeWalletStats(walletId) {
  const txObj = await dbGet('transactions') || {};
  const txs   = Object.values(txObj).filter(t => t.wallet_id === walletId && t.status === 'completed');
  const today = new Date().toISOString().slice(0,10);
  const month = new Date().toISOString().slice(0,7);

  let today_in=0, today_out=0, month_out=0, today_count=0;
  for (const t of txs) {
    const d = (t.created_at||'').slice(0,10);
    const m = (t.created_at||'').slice(0,7);
    if (d === today) {
      today_count++;
      if (['receive','deposit'].includes(t.type))  today_in  += t.amount||0;
      if (['send','withdraw'].includes(t.type))     today_out += t.amount||0;
    }
    if (m === month && ['send','withdraw'].includes(t.type)) month_out += t.amount||0;
  }
  return { today_in, today_out, month_out, today_count };
}

// ── GET / ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const walletsObj = await dbGet('wallets') || {};
    const list = await Promise.all(
      Object.entries(walletsObj)
        .filter(([,w]) => w.is_active)
        .map(async ([id, w]) => {
          const stats = await computeWalletStats(id);
          return { id, ...w, ...stats };
        })
    );
    list.sort((a,b) => (a.sort_order||0) - (b.sort_order||0));
    res.json(list);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const w = await dbGet(`wallets/${req.params.id}`);
    if (!w) return res.status(404).json({ error: 'المحفظة غير موجودة' });
    res.json({ id: req.params.id, ...w });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST / ────────────────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, provider, phone_number, owner_name, national_id,
            balance, daily_limit, monthly_limit, notes, pin_hint, color, android_device_id } = req.body;

    if (!name || !provider || !phone_number || !owner_name)
      return res.status(400).json({ error: 'البيانات الأساسية مطلوبة' });

    const limits = PROVIDER_LIMITS[provider] || PROVIDER_LIMITS.vodafone;
    const walletsObj = await dbGet('wallets') || {};
    const maxOrder = Object.values(walletsObj).reduce((m,w) => Math.max(m, w.sort_order||0), 0);

    const result = await dbPush('wallets', {
      name, provider, phone_number, owner_name,
      national_id:    national_id || '',
      balance:        parseFloat(balance) || 0,
      daily_limit:    parseFloat(daily_limit)   || limits.daily,
      monthly_limit:  parseFloat(monthly_limit) || limits.monthly,
      notes:          notes || '',
      pin_hint:       pin_hint || '',
      color:          color || '#4CAF50',
      android_device_id: android_device_id || '',
      sort_order:     maxOrder + 1,
      is_active:      true,
      created_at:     new Date().toISOString(),
      updated_at:     new Date().toISOString()
    });

    await dbPush('activity_log', {
      user_id: req.user.id, action: 'wallet_create',
      details: `إنشاء محفظة: ${name} - ${phone_number}`,
      created_at: new Date().toISOString()
    });

    res.json({ id: result.id, message: 'تم إضافة المحفظة بنجاح' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /:id ──────────────────────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const existing = await dbGet(`wallets/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'المحفظة غير موجودة' });

    const allowed = ['name','owner_name','national_id','balance','daily_limit',
                     'monthly_limit','notes','pin_hint','color','android_device_id','is_active'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    await dbUpdate(`wallets/${req.params.id}`, updates);
    res.json({ message: 'تم تحديث المحفظة بنجاح' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /:id/balance ────────────────────────────────────────────
router.patch('/:id/balance', async (req, res) => {
  try {
    const { balance } = req.body;
    if (balance === undefined || balance < 0)
      return res.status(400).json({ error: 'رصيد غير صحيح' });

    const w = await dbGet(`wallets/${req.params.id}`);
    if (!w) return res.status(404).json({ error: 'المحفظة غير موجودة' });

    await dbUpdate(`wallets/${req.params.id}`, { balance: parseFloat(balance), updated_at: new Date().toISOString() });

    await dbPush('activity_log', {
      user_id: req.user.id, action: 'balance_update',
      details: `تحديث رصيد ${w.name}: ${w.balance} → ${balance}`,
      created_at: new Date().toISOString()
    });

    res.json({ message: 'تم تحديث الرصيد', balance });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /:id ───────────────────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbUpdate(`wallets/${req.params.id}`, { is_active: false });
    res.json({ message: 'تم تعطيل المحفظة' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id/transactions ─────────────────────────────────────────
router.get('/:id/transactions', async (req, res) => {
  try {
    const { limit=50, offset=0, type, date_from, date_to } = req.query;
    const txObj = await dbGet('transactions') || {};
    let txs = Object.entries(txObj)
      .map(([id,t]) => ({ id, ...t }))
      .filter(t => t.wallet_id === req.params.id);

    if (type)      txs = txs.filter(t => t.type === type);
    if (date_from) txs = txs.filter(t => t.created_at >= date_from);
    if (date_to)   txs = txs.filter(t => t.created_at.slice(0,10) <= date_to);

    txs.sort((a,b) => b.created_at.localeCompare(a.created_at));
    const total = txs.length;
    txs = txs.slice(parseInt(offset), parseInt(offset)+parseInt(limit));

    res.json({ transactions: txs, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /reorder ─────────────────────────────────────────────────
router.post('/reorder', requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body;
    for (const { id, sort_order } of orders)
      await dbUpdate(`wallets/${id}`, { sort_order });
    res.json({ message: 'تم إعادة الترتيب' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
