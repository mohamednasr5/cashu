const express = require('express');
const router  = express.Router();
const { dbGet, dbSet, dbPush, dbUpdate } = require('../database');

function calculateFee(provider, type, amount) {
  const fees = {
    vodafone:  { send: Math.max(1, amount*0.005),  receive:0, withdraw: Math.max(3, amount*0.01),  deposit:0 },
    orange:    { send: Math.max(1, Math.min(15,amount*0.005)), receive:0, withdraw: Math.max(3,amount*0.01), deposit:0 },
    etisalat:  { send: Math.max(0.5, Math.min(20,amount*0.001)), receive:0, withdraw: Math.max(5,amount*0.01), deposit:0 },
    we:        { send: Math.max(0.5, Math.min(20,amount*0.001)), receive:0, withdraw: Math.max(3,amount*0.01), deposit:0 }
  };
  return fees[provider]?.[type] || 0;
}

// ── GET / ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { limit=50, offset=0, wallet_id, type, date_from, date_to, search } = req.query;
    const [txObj, walletsObj, usersObj] = await Promise.all([
      dbGet('transactions'), dbGet('wallets'), dbGet('users')
    ]);

    let txs = Object.entries(txObj||{}).map(([id,t]) => {
      const w = (walletsObj||{})[t.wallet_id] || {};
      const u = (usersObj||{})[t.created_by] || {};
      return { id, ...t,
        wallet_name:   w.name, provider: w.provider, wallet_phone: w.phone_number,
        cashier_name:  u.full_name };
    });

    if (wallet_id) txs = txs.filter(t => t.wallet_id === wallet_id);
    if (type)      txs = txs.filter(t => t.type === type);
    if (date_from) txs = txs.filter(t => t.created_at >= date_from);
    if (date_to)   txs = txs.filter(t => t.created_at.slice(0,10) <= date_to);
    if (search) {
      const s = search.toLowerCase();
      txs = txs.filter(t =>
        (t.customer_name||'').toLowerCase().includes(s) ||
        (t.customer_phone||'').includes(s) ||
        (t.reference||'').includes(s)
      );
    }

    txs.sort((a,b) => b.created_at.localeCompare(a.created_at));
    const total = txs.length;
    txs = txs.slice(parseInt(offset), parseInt(offset)+parseInt(limit));
    res.json({ transactions: txs, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST / ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { wallet_id, type, amount, customer_phone, customer_name,
            customer_id, reference, notes, custom_fee } = req.body;

    if (!wallet_id || !type || !amount)
      return res.status(400).json({ error: 'بيانات العملية غير مكتملة' });
    if (parseFloat(amount) <= 0)
      return res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });

    const wallet = await dbGet(`wallets/${wallet_id}`);
    if (!wallet || !wallet.is_active)
      return res.status(404).json({ error: 'المحفظة غير موجودة' });

    const fee        = custom_fee !== undefined ? parseFloat(custom_fee) : calculateFee(wallet.provider, type, parseFloat(amount));
    let net_amount   = parseFloat(amount);
    let new_balance  = parseFloat(wallet.balance) || 0;

    if (['send','withdraw'].includes(type)) {
      if (new_balance < net_amount + fee)
        return res.status(400).json({ error: 'الرصيد غير كافٍ' });
      new_balance -= (net_amount + fee);
    } else if (['receive','deposit'].includes(type)) {
      new_balance += net_amount - fee;
    }

    // Check daily limit
    const txObj  = await dbGet('transactions') || {};
    const today  = new Date().toISOString().slice(0,10);
    const today_out = Object.values(txObj)
      .filter(t => t.wallet_id===wallet_id && t.created_at.slice(0,10)===today && ['send','withdraw'].includes(t.type) && t.status==='completed')
      .reduce((s,t) => s + (t.amount||0), 0);

    if (['send','withdraw'].includes(type) && (today_out + net_amount) > (wallet.daily_limit||60000))
      return res.status(400).json({ error: `تجاوز الحد اليومي. المتبقي: ${((wallet.daily_limit||60000)-today_out).toFixed(2)} ج` });

    const tx = {
      wallet_id, type, amount: net_amount, fee, net_amount,
      customer_phone: customer_phone || '',
      customer_name:  customer_name  || '',
      customer_id:    customer_id    || '',
      reference:      reference      || `TX-${Date.now()}`,
      notes:          notes          || '',
      status:         'completed',
      created_by:     req.user.id,
      created_at:     new Date().toISOString()
    };

    const result = await dbPush('transactions', tx);
    await dbUpdate(`wallets/${wallet_id}`, { balance: new_balance, updated_at: new Date().toISOString() });

    // Update/create customer
    if (customer_phone) {
      const custsObj = await dbGet('customers') || {};
      const custEntry = Object.entries(custsObj).find(([,c]) => c.phone === customer_phone);
      if (custEntry) {
        const [cid, c] = custEntry;
        await dbUpdate(`customers/${cid}`, {
          total_transactions: (c.total_transactions||0)+1,
          total_amount: (c.total_amount||0)+net_amount,
          last_transaction: new Date().toISOString()
        });
      } else if (customer_name) {
        await dbPush('customers', {
          name: customer_name, phone: customer_phone,
          total_transactions: 1, total_amount: net_amount,
          created_at: new Date().toISOString(),
          last_transaction: new Date().toISOString()
        });
      }
    }

    res.json({ id: result.id, message: 'تمت العملية بنجاح', balance: new_balance, fee, net_amount });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const t = await dbGet(`transactions/${req.params.id}`);
    if (!t) return res.status(404).json({ error: 'العملية غير موجودة' });
    res.json({ id: req.params.id, ...t });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /:id/cancel ─────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  try {
    const tx = await dbGet(`transactions/${req.params.id}`);
    if (!tx) return res.status(404).json({ error: 'العملية غير موجودة' });
    if (tx.status !== 'completed')
      return res.status(400).json({ error: 'لا يمكن إلغاء هذه العملية' });

    // Reverse balance
    const wallet = await dbGet(`wallets/${tx.wallet_id}`);
    let new_balance = parseFloat(wallet.balance)||0;
    if (['send','withdraw'].includes(tx.type))      new_balance += (tx.amount + tx.fee);
    else if (['receive','deposit'].includes(tx.type)) new_balance -= (tx.amount - tx.fee);

    await dbUpdate(`transactions/${req.params.id}`, { status: 'cancelled' });
    await dbUpdate(`wallets/${tx.wallet_id}`, { balance: new_balance, updated_at: new Date().toISOString() });

    res.json({ message: 'تم إلغاء العملية واسترداد الرصيد' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
