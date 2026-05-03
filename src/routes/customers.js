const express = require('express');
const router  = express.Router();
const { dbGet, dbPush, dbUpdate } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { search, limit=50, offset=0 } = req.query;
    const obj = await dbGet('customers') || {};
    let list = Object.entries(obj).map(([id,c])=>({id,...c}));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c=>(c.name||'').toLowerCase().includes(s)||(c.phone||'').includes(s));
    }
    list.sort((a,b)=>(b.total_transactions||0)-(a.total_transactions||0));
    const total = list.length;
    list = list.slice(parseInt(offset), parseInt(offset)+parseInt(limit));
    res.json({ customers: list, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, national_id, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const r = await dbPush('customers', {
      name, phone:phone||'', national_id:national_id||'', notes:notes||'',
      total_transactions:0, total_amount:0,
      created_at:new Date().toISOString(), last_transaction:null
    });
    res.json({ id: r.id, message: 'تم إضافة العميل' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, national_id, notes } = req.body;
    await dbUpdate(`customers/${req.params.id}`, { name, phone, national_id, notes });
    res.json({ message: 'تم تحديث العميل' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
