/**
 * Pre-Flight Production Environment Verification CLI (Phase 6.2).
 * Usage:
 *   npm run verify:prod
 *   npm run verify:prod -- --strict
 *
 * SECURITY: Prints ONLY variable names and boolean/format statuses; never outputs secrets.
 */

import { validateProductionEnv } from '../src/lib/security/env-validator';

const strict = process.argv.includes('--strict');
const result = validateProductionEnv(process.env, { strict });

console.info('\n============================================================');
console.info(`Axis LinkUp — Environment Pre-Flight Check (${strict ? 'STRICT PROD' : 'STANDARD'})`);
console.info('============================================================\n');

const maxKeyLen = Math.max(...Object.keys(result.summary).map((k) => k.length), 36);
for (const [key, status] of Object.entries(result.summary)) {
  const icon = status === 'configured' ? 'OK' : status === 'warning' ? 'WARN' : 'MISSING';
  console.info(`  ${key.padEnd(maxKeyLen)}  [${icon}]`);
}

if (result.warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const w of result.warnings) {
    console.warn(`  - ${w}`);
  }
}

if (result.errors.length > 0) {
  console.error('\nErrors:');
  for (const e of result.errors) {
    console.error(`  - ${e}`);
  }
  console.error('\nPre-flight check FAILED. Resolve the errors above before production cutover.\n');
  process.exit(1);
}

console.info('\nPre-flight check PASSED. Environment configuration is ready.\n');
process.exit(0);
