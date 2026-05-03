const express = require('express');
const router  = express.Router();
const { dbGet } = require('../database');

router.get('/overview', async (req, res) => {
  try {
    const [walletsObj, txObj, devicesObj] = await Promise.all([
      dbGet('wallets'), dbGet('transactions'), dbGet('android_devices')
    ]);

    const wallets = Object.entries(walletsObj||{}).filter(([,w])=>w.is_active).map(([id,w])=>({id,...w}));
    const txs     = Object.values(txObj||{}).filter(t=>t.status==='completed');

    const total_balance = wallets.reduce((s,w)=>s+(w.balance||0),0);
    const today  = new Date().toISOString().slice(0,10);
    const month  = new Date().toISOString().slice(0,7);

    const todayTxs = txs.filter(t=>t.created_at.slice(0,10)===today);
    const monthTxs = txs.filter(t=>t.created_at.slice(0,7)===month);

    const sumStats = arr => ({
      count:       arr.length,
      in_amount:   arr.filter(t=>['receive','deposit'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
      out_amount:  arr.filter(t=>['send','withdraw'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
      total_fees:  arr.reduce((s,t)=>s+(t.fee||0),0)
    });

    const wallets_summary = wallets.map(w => {
      const wtxs  = txs.filter(t=>t.wallet_id===w.id);
      const wToday = wtxs.filter(t=>t.created_at.slice(0,10)===today);
      const wMonth = wtxs.filter(t=>t.created_at.slice(0,7)===month);
      return {
        ...w,
        today_in:  wToday.filter(t=>['receive','deposit'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        today_out: wToday.filter(t=>['send','withdraw'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        month_out: wMonth.filter(t=>['send','withdraw'].includes(t.type)).reduce((s,t)=>s+t.amount,0)
      };
    });

    const recent_transactions = Object.entries(txObj||{})
      .map(([id,t])=>({id,...t}))
      .filter(t=>t.status==='completed')
      .sort((a,b)=>b.created_at.localeCompare(a.created_at))
      .slice(0,10)
      .map(t => {
        const w = (walletsObj||{})[t.wallet_id]||{};
        return { ...t, wallet_name: w.name, provider: w.provider, color: w.color };
      });

    const connected_devices = Object.values(devicesObj||{}).filter(d=>d.is_connected).length;

    res.json({
      total_balance,
      wallet_count:        wallets.length,
      today:               sumStats(todayTxs),
      month:               sumStats(monthTxs),
      wallets_summary,
      low_balance_wallets: wallets_summary.filter(w=>w.balance<1000),
      near_limit_wallets:  wallets_summary.filter(w=>w.daily_limit>0 && (w.today_out/w.daily_limit)>0.8),
      recent_transactions,
      connected_devices
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/chart/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days)||30;
    const txObj = await dbGet('transactions');
    const cutoff = new Date(Date.now() - days*86400000).toISOString();

    const byDate = {};
    Object.values(txObj||{})
      .filter(t=>t.status==='completed' && t.created_at >= cutoff)
      .forEach(t => {
        const d = t.created_at.slice(0,10);
        if (!byDate[d]) byDate[d] = { date:d, in_amount:0, out_amount:0, fees:0, count:0 };
        if (['receive','deposit'].includes(t.type)) byDate[d].in_amount += t.amount;
        if (['send','withdraw'].includes(t.type))   byDate[d].out_amount += t.amount;
        byDate[d].fees += t.fee||0;
        byDate[d].count++;
      });

    res.json(Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date)));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/chart/provider', async (req, res) => {
  try {
    const [txObj, walletsObj] = await Promise.all([dbGet('transactions'), dbGet('wallets')]);
    const byProvider = {};
    Object.values(txObj||{})
      .filter(t=>t.status==='completed')
      .forEach(t => {
        const w = (walletsObj||{})[t.wallet_id]||{};
        const p = w.provider||'unknown';
        if (!byProvider[p]) byProvider[p] = { provider:p, count:0, amount:0, fees:0 };
        byProvider[p].count++;
        byProvider[p].amount += t.amount;
        byProvider[p].fees   += t.fee||0;
      });
    res.json(Object.values(byProvider));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
