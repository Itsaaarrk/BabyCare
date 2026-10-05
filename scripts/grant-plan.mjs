// Gives a family room a plan, for testing. This is the only way a plan can be set before Google
// Play billing exists, and it is deliberately not part of the app: nothing a signed-in user can
// reach is able to do this.
//
//   node scripts/grant-plan.mjs <roomId> <plan> [--days N] [--status S] --emulator
//   node scripts/grant-plan.mjs <roomId> <plan> [--days N] [--status S] --project <firebase-project-id>
//
// plan:   free | plus_monthly | plus_yearly | lifetime   ("free" removes the plan)
// status: active (default) | grace_period | cancelled | paused | expired | none
// --days: how long a subscription runs from now (default 30); lifetime has no end date.
//
// --emulator talks to the local Firebase emulator (npm run test:functions starts one). --project
// uses your own Firebase CLI login, so no key file is needed; run `npx firebase login` first.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PLANS = ['free', 'plus_monthly', 'plus_yearly', 'lifetime'];
const STATUSES = ['none', 'active', 'grace_period', 'paused', 'cancelled', 'expired'];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const [roomId, plan] = args;
const days = Number(flag('--days') ?? 30);
const status = flag('--status') ?? 'active';
const emulator = args.includes('--emulator');
const project = flag('--project');

function usage(message) {
  console.error(`${message}\nUsage: node scripts/grant-plan.mjs <roomId> <plan> [--days N] [--status S] (--emulator | --project <id>)`);
  process.exit(1);
}

if (!roomId || !/^[A-Za-z0-9_-]{1,128}$/.test(roomId)) usage('Give a valid room id.');
if (!PLANS.includes(plan)) usage(`Plan must be one of: ${PLANS.join(', ')}.`);
if (!STATUSES.includes(status)) usage(`Status must be one of: ${STATUSES.join(', ')}.`);
if (!Number.isFinite(days) || days <= 0) usage('--days must be a positive number.');
if (emulator === Boolean(project)) usage('Choose exactly one of --emulator or --project <id>.');

const entitlement =
  plan === 'free'
    ? null
    : {
        plan,
        status,
        expiresAt: plan === 'lifetime' ? null : Date.now() + days * 86_400_000,
        updatedAt: Date.now(),
      };
const path = `/rooms/${roomId}/entitlement`;

if (emulator) {
  // The Functions emulator's Admin SDK uses the namespace named after the demo project.
  const response = await fetch(`http://127.0.0.1:9000${path}.json?ns=demo-babycare`, {
    method: entitlement ? 'PUT' : 'DELETE',
    headers: { Authorization: 'Bearer owner' },
    body: entitlement ? JSON.stringify(entitlement) : undefined,
  });
  if (!response.ok) usage(`Emulator refused: ${response.status} ${await response.text()}`);
} else {
  const dir = mkdtempSync(join(tmpdir(), 'grant-plan-'));
  try {
    const file = join(dir, 'entitlement.json');
    let command;
    if (entitlement) {
      writeFileSync(file, JSON.stringify(entitlement));
      command = ['database:set', path, file, '--force', '--project', project];
    } else {
      command = ['database:remove', path, '--force', '--project', project];
    }
    const result = spawnSync('npx', ['firebase', ...command], { stdio: 'inherit', shell: true });
    if (result.status !== 0) process.exit(result.status ?? 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(entitlement ? `Room ${roomId} is now ${plan} (${status}).` : `Room ${roomId} is back on the Free plan.`);
