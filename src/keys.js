import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyDir = resolve(__dirname, '..');

let privateKey, publicKey;
try {
    privateKey = fs.readFileSync(resolve(keyDir, 'id_rsa_priv.pem'), 'utf8');
    publicKey  = fs.readFileSync(resolve(keyDir, 'id_rsa_pub.pem'),  'utf8');
} catch (err) {
    console.error('Fatal: cannot read RSA key file:', err.message);
    process.exit(1);
}

export { privateKey, publicKey };
