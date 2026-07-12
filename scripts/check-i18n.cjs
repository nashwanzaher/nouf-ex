// Check i18n keys
const path = require('path');
const root = path.join(__dirname, '..');
const en = require(path.join(root, 'apps/web/src/i18n/locales/en.json'));
const ar = require(path.join(root, 'apps/web/src/i18n/locales/ar.json'));
const zh = require(path.join(root, 'apps/web/src/i18n/locales/zh.json'));

const keys = [
    'tabEmail', 'tabPhone', 'tabQr',
    'phone', 'phonePlaceholder',
    'detectedEmail', 'detectedPhone', 'invalidPhone',
    'showPassword', 'hidePassword', 'capsLockOn',
    'rememberMe', 'signingIn', 'verifying', 'verify',
    'retryHint', 'changeLanguage', 'backToHome',
    'qrTitle', 'qrHelp',
    'useEmailInstead', 'usePhoneInstead', 'useQr',
    'sslSecured', 'twoFactorAvailable', 'recoverAccess'
];

let allOk = true;
for (const k of keys) {
    const enVal = en.authLogin?.[k];
    const arVal = ar.authLogin?.[k];
    const zhVal = zh.authLogin?.[k];

    const enOk = enVal ? '✓' : '❌';
    const arOk = arVal ? '✓' : '❌';
    const zhOk = zhVal ? '✓' : '❌';

    if (!enVal || !arVal || !zhVal) allOk = false;

    const enShort = enVal ? enVal.substring(0, 25) : 'MISSING';
    const arShort = arVal ? arVal.substring(0, 25) : 'MISSING';
    const zhShort = zhVal ? zhVal.substring(0, 25) : 'MISSING';

    console.log(`${enOk}${arOk}${zhOk}  ${k.padEnd(22)} | en: ${enShort.padEnd(25)} | ar: ${arShort}`);
}

console.log('');
console.log(allOk ? '✅ All keys present in 3 languages' : '❌ Some keys missing!');
