// Parses `firebase apps:sdkconfig` output into a Vite .env file.
import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync(process.argv[2], 'utf8');
const pick = (k) => {
  const m = raw.match(new RegExp('"?' + k + '"?\\s*[:=]\\s*"([^"]+)"'));
  return m ? m[1] : '';
};
const c = {
  apiKey: pick('apiKey'), authDomain: pick('authDomain'), projectId: pick('projectId'),
  storageBucket: pick('storageBucket'), messagingSenderId: pick('messagingSenderId'), appId: pick('appId')
};
if (!c.apiKey || !c.appId) { console.error('COULD NOT PARSE CONFIG'); process.exit(1); }
writeFileSync('.env',
  `VITE_FIREBASE_API_KEY=${c.apiKey}\n` +
  `VITE_FIREBASE_AUTH_DOMAIN=${c.authDomain}\n` +
  `VITE_FIREBASE_PROJECT_ID=${c.projectId}\n` +
  `VITE_FIREBASE_STORAGE_BUCKET=${c.storageBucket}\n` +
  `VITE_FIREBASE_MESSAGING_SENDER_ID=${c.messagingSenderId}\n` +
  `VITE_FIREBASE_APP_ID=${c.appId}\n`);
console.log('wrote .env for ' + c.projectId);
