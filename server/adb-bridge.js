#!/usr/bin/env node
/**
 * ADB Bridge Server — خادم وسيط لتواصل المتصفح مع أجهزة Android عبر ADB
 * يُشغّل محلياً ويستخدم WebSocket للتواصل مع الواجهة
 *
 * الاستخدام:
 *   node server/adb-bridge.js
 *   node server/adb-bridge.js --port 8765
 *   node server/adb-bridge.js --adb /custom/path/to/adb
 *
 * المتطلبات:
 *   - Node.js 16+
 *   - ADB مثبّت ومضاف لمتغيرات النظام (PATH)
 *   - USB Debugging مفعّل على الهاتف
 * ============================================================
 */

const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');

// ==================== الإعدادات ====================
const args = process.argv.slice(2);
const PORT = parseInt((args.find((a, i) => a === '--port' && args[i + 1]) && args[args.indexOf('--port') + 1]) || '8765');
const ADB_PATH = (args.find((a, i) => a === '--adb' && args[i + 1]) && args[args.indexOf('--adb') + 1]) || 'adb';
const POLL_INTERVAL = 8000; // استطلاع كل 8 ثوانٍ

// ==================== المتغيرات ====================
const wss = new WebSocketServer({ port: PORT });
const connectedClients = new Set();
let knownDevices = new Map();
let pollTimer = null;

console.log(`
╔══════════════════════════════════════════╗
║       ADB Bridge Server v1.0.0          ║
║   برمجة وتطوير ♥ محمد حماد             ║
╠══════════════════════════════════════════╣
║  Port:    ${PORT.toString().padEnd(28)}║
║  ADB:     ${(ADB_PATH).padEnd(28)}║
║  Polling: Every ${POLL_INTERVAL / 1000}s${' '.repeat(23 - (POLL_INTERVAL / 1000).toString().length)}║
╚══════════════════════════════════════════╝
`);

// ==================== WebSocket ====================
wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log(`[+] عميل متصل (${connectedClients.size} متصل)`);

    // إرسال قائمة الأجهزة الحالية فوراً
    sendToClient(ws, {
        type: 'device_list',
        devices: Array.from(knownDevices.values())
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            handleMessage(ws, msg);
        } catch (e) {
            console.warn('رسالة غير صالحة:', e.message);
        }
    });

    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log(`[-] عميل منفصل (${connectedClients.size} متصل)`);
    });

    ws.on('error', (err) => {
        console.error('خطأ WebSocket:', err.message);
    });
});

/**
 * معالجة الرسائل الواردة
 */
function handleMessage(ws, msg) {
    switch (msg.type) {
        case 'get_devices':
            pollDevices();
            break;
        case 'adb_command':
            executeAdbCommand(msg.deviceId, msg.command)
                .then(result => sendToClient(ws, { type: 'command_result', ...result }))
                .catch(err => sendToClient(ws, { type: 'command_result', success: false, error: err.message }));
            break;
        case 'install_apk':
            if (msg.deviceId && msg.apkPath) {
                executeAdbCommand(msg.deviceId, `install ${msg.apkPath}`)
                    .then(result => sendToClient(ws, { type: 'command_result', ...result }))
                    .catch(err => sendToClient(ws, { type: 'command_result', success: false, error: err.message }));
            }
            break;
        default:
            console.log(`نوع رسالة غير معروف: ${msg.type}`);
    }
}

// ==================== ADB Commands ====================

/**
 * التحقق من توفر ADB
 */
function checkAdbAvailable() {
    try {
        execSync(`${ADB_PATH} version`, { stdio: 'pipe' });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * تنفيذ أمر ADB وإرجاع النتيجة
 */
function executeAdbCommand(deviceId, command) {
    return new Promise((resolve, reject) => {
        const fullCmd = deviceId ? `${ADB_PATH} -s ${deviceId} ${command}` : `${ADB_PATH} ${command}`;
        const proc = spawn(ADB_PATH, deviceId ? ['-s', deviceId, ...command.split(' ')] : command.split(' '), {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout.trim(), deviceId });
            } else {
                reject(new Error(stderr.trim() || `ADB exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * الحصول على قائمة الأجهزة
 */
function getDeviceList() {
    return new Promise((resolve, reject) => {
        const proc = spawn(ADB_PATH, ['devices', '-l'], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { console.error('ADB stderr:', d.toString()); });

        proc.on('close', (code) => {
            if (code !== 0) { reject(new Error('فشل الحصول على قائمة الأجهزة')); return; }

            const lines = stdout.trim().split('\n').slice(1); // تخطي السطر الأول
            const devices = [];

            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 2) return;

                const serial = parts[0];
                const state = parts[1];

                // استخراج الخصائص الإضافية
                const props = {};
                parts.slice(2).forEach(p => {
                    const [key, ...vals] = p.split(':');
                    if (vals.length) props[key] = vals.join(':');
                });

                devices.push({ serial, state, model: props.model || props.product || '', device: props.device || '' });
            });

            resolve(devices);
        });

        proc.on('error', (err) => reject(err));
    });
}

/**
 * استطلاع الأجهزة وتحديث البيانات
 */
async function pollDevices() {
    try {
        const rawDevices = await getDeviceList();
        const currentSerials = new Set(rawDevices.map(d => d.serial));
        const now = Date.now();

        // كشف الأجهزة الجديدة والمحدّثة
        for (const raw of rawDevices) {
            const existing = knownDevices.get(raw.serial);
            const deviceData = await enrichDeviceData(raw, existing);

            if (existing) {
                // تحديث بيانات موجودة
                if (existing.state !== raw.state) {
                    broadcast({ type: 'device_changed', device: deviceData });
                }
            } else {
                // جهاز جديد
                broadcast({ type: 'device_added', device: deviceData });

                // تنبيه إذا كان غير مصرح
                if (raw.state === 'unauthorized') {
                    broadcast({ type: 'usb_debugging_alert', deviceId: raw.serial });
                }
            }

            knownDevices.set(raw.serial, deviceData);
        }

        // كشف الأجهزة المنفصلة
        for (const [serial, device] of knownDevices) {
            if (!currentSerials.has(serial)) {
                broadcast({ type: 'device_removed', deviceId: serial });
                knownDevices.delete(serial);
            }
        }

        // إرسال القائمة الكاملة
        broadcast({
            type: 'device_list',
            devices: Array.from(knownDevices.values())
        });

    } catch (err) {
        console.error('خطأ في استطلاع الأجهزة:', err.message);
    }
}

/**
 * إثراء بيانات الجهاز بمعلومات إضافية
 */
async function enrichDeviceData(raw, existing) {
    const isOnline = raw.state === 'device';
    const serial = raw.serial;
    let battery = existing?.battery || 0;
    let signal = existing?.signal || 0;
    let version = existing?.androidVersion || '';
    let usbDebugging = isOnline;

    if (isOnline) {
        // قراءة البطارية
        try {
            const battResult = await executeAdbCommand(serial, 'shell dumpsys battery');
            const levelMatch = battResult.output.match(/level:\s*(\d+)/);
            if (levelMatch) battery = parseInt(levelMatch[1]);
        } catch (e) {}

        // قراءة قوة الشبكة
        try {
            const signalResult = await executeAdbCommand(serial, 'shell dumpsys telephony.registry | grep mSignalStrength');
            const signalMatch = signalResult.output.match(/mSignalStrength=(\d+)/);
            if (signalMatch) {
                const asu = parseInt(signalMatch[1]);
                signal = Math.min(4, Math.max(0, Math.round(asu / 8)));
            }
        } catch (e) {
            // طريقة بديلة
            try {
                const altResult = await executeAdbCommand(serial, 'shell getprop gsm.signal.strength');
                const altMatch = altResult.output.match(/\d+/);
                if (altMatch) signal = Math.min(4, Math.max(0, Math.round(parseInt(altMatch[0]) / 8)));
            } catch (e2) {}
        }

        // قراءة إصدار أندرويد
        try {
            const verResult = await executeAdbCommand(serial, 'shell getprop ro.build.version.release');
            version = verResult.output.trim() || version;
        } catch (e) {}

        // التحقق من USB Debugging
        try {
            const debugResult = await executeAdbCommand(serial, 'shell settings get global adb_enabled');
            usbDebugging = debugResult.output.trim() === '1';
        } catch (e) {}
    }

    return {
        deviceId: serial,
        serial,
        name: raw.model ? raw.model.replace(/_/g, ' ') : raw.device || 'جهاز Android',
        state: raw.state,
        status: raw.state,
        battery,
        signal,
        androidVersion: version,
        usbDebugging,
        connectionType: 'USB',
        lastSeen: Date.now(),
        lastConnection: new Date().toLocaleString('ar-EG')
    };
}

// ==================== Utilities ====================

function broadcast(data) {
    const msg = JSON.stringify(data);
    connectedClients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(msg);
        }
    });
}

function sendToClient(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

// ==================== Start ====================

// التحقق من ADB
if (!checkAdbAvailable()) {
    console.error('⚠️  لم يتم العثور على ADB! يرجى تثبيته وإضافته لمتغيرات النظام.');
    console.error('   تحميل: https://developer.android.com/studio/releases/platform-tools');
    console.error('');
    console.error('   أو حدد المسار يدوياً: node server/adb-bridge.js --adb /path/to/adb');
    process.exit(1);
}

console.log('[✓] ADB متوفر');
console.log(`[*] جاري الاستماع على المنفذ ${PORT}...`);
console.log('');

// بدء الاستطلاع الدوري
pollDevices();
pollTimer = setInterval(pollDevices, POLL_INTERVAL);

// إغلاق نظيف
process.on('SIGINT', () => {
    console.log('\n[*] جاري إغلاق الخادم...');
    clearInterval(pollTimer);
    connectedClients.forEach(ws => ws.close());
    wss.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('خطأ غير متوقع:', err.message);
});