// For a demo project the Functions emulator's Admin SDK uses the database namespace named after the
// project, which starts wide open. Load the real rules into it so the app is tested against them.
// Run after `firebase emulators:start --project demo-babycare`.
import { readFileSync } from 'node:fs';

const NAMESPACE = 'demo-babycare';
const response = await fetch(`http://127.0.0.1:9000/.settings/rules.json?ns=${NAMESPACE}`, {
  method: 'PUT',
  headers: { Authorization: 'Bearer owner' },
  body: readFileSync('database.rules.json', 'utf8'),
});
if (!response.ok) {
  console.error(`Could not load rules: ${response.status} ${await response.text()}`);
  process.exit(1);
}
console.log(`Loaded database.rules.json into the "${NAMESPACE}" namespace.`);
