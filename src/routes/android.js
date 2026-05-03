const express = require('express');
const router  = express.Router();
const { dbGet, dbPush, dbUpdate, dbGetAll } = require('../database');

router.get('/devices', async (req, res) => {
  try {
    const obj = await dbGet('android_devices') || {};
    const list = Object.entries(obj).map(([id,d])=>({id,...d}));
    res.json(list);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/register', async (req, res) => {
  try {
    const { device_id, device_name, model, android_version, wallet_id } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id مطلوب' });

    const obj = await dbGet('android_devices') || {};
    const existing = Object.entries(obj).find(([,d])=>d.device_id===device_id);

    if (existing) {
      await dbUpdate(`android_devices/${existing[0]}`, {
        device_name, model, android_version, wallet_id: wallet_id||'',
        is_connected:true, last_seen:new Date().toISOString()
      });
      res.json({ message: 'تم تحديث الجهاز', id: existing[0] });
    } else {
      const r = await dbPush('android_devices', {
        device_id, device_name:device_name||'', model:model||'',
        android_version:android_version||'', wallet_id:wallet_id||'',
        is_connected:true, last_seen:new Date().toISOString(),
        created_at:new Date().toISOString()
      });
      res.json({ message: 'تم تسجيل الجهاز', id: r.id });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/sms', async (req, res) => {
  try {
    const { device_id, sender, message, received_at } = req.body;
    if (!message) return res.status(400).json({ error: 'الرسالة مطلوبة' });

    const r = await dbPush('sms_messages', {
      device_id:device_id||'', sender:sender||'', message,
      is_processed:false,
      received_at: received_at||new Date().toISOString(),
      created_at:  new Date().toISOString()
    });

    // Update device last_seen
    if (device_id) {
      const obj = await dbGet('android_devices')||{};
      const entry = Object.entries(obj).find(([,d])=>d.device_id===device_id);
      if (entry) await dbUpdate(`android_devices/${entry[0]}`, { last_seen:new Date().toISOString(), is_connected:true });
    }

    res.json({ id: r.id, message: 'تم استلام الرسالة' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
