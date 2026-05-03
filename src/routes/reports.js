const express = require('express');
const router  = express.Router();
const { dbGet } = require('../database');

router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().slice(0,10);
    const [txObj, walletsObj] = await Promise.all([dbGet('transactions'), dbGet('wallets')]);

    const txs = Object.entries(txObj||{})
      .map(([id,t])=>({id,...t}))
      .filter(t=>t.created_at.slice(0,10)===d && t.status==='completed');

    const byWallet = {};
    txs.forEach(t => {
      const w = (walletsObj||{})[t.wallet_id]||{};
      if (!byWallet[t.wallet_id]) byWallet[t.wallet_id] = {
        wallet_id:t.wallet_id, wallet_name:w.name, provider:w.provider,
        count:0, in_amount:0, out_amount:0, fees:0
      };
      byWallet[t.wallet_id].count++;
      if (['receive','deposit'].includes(t.type)) byWallet[t.wallet_id].in_amount += t.amount;
      if (['send','withdraw'].includes(t.type))   byWallet[t.wallet_id].out_amount += t.amount;
      byWallet[t.wallet_id].fees += t.fee||0;
    });

    res.json({
      date: d,
      summary: {
        count:     txs.length,
        in_amount: txs.filter(t=>['receive','deposit'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        out_amount:txs.filter(t=>['send','withdraw'].includes(t.type)).reduce((s,t)=>s+t.amount,0),
        fees:      txs.reduce((s,t)=>s+(t.fee||0),0)
      },
      by_wallet:    Object.values(byWallet),
      transactions: txs
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
