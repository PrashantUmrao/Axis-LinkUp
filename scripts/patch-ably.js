/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.resolve(__dirname, '../node_modules/ably/build/ably.js'),
  path.resolve(__dirname, '../node_modules/ably/build/ably-node.js'),
  path.resolve(__dirname, '../node_modules/ably/build/modular/index.mjs'),
];

const targetSuper = '    var __super = (...args) => {\n      super(...args);\n    };';
const replacementSuper =
  '    super(typeof messageOrValues === "object" ? (messageOrValues && messageOrValues.message) : messageOrValues);\n    var __super = () => {};';

const targetAgent = 'var agent = "ably-js/" + version;';
const replacementAgent = 'var agent = "pubsub-device/3.1.0";';

for (const targetFile of filesToPatch) {
  if (fs.existsSync(targetFile)) {
    let content = fs.readFileSync(targetFile, 'utf8');
    let changed = false;

    if (content.includes(targetSuper)) {
      content = content.replaceAll(targetSuper, replacementSuper);
      changed = true;
      console.log(`[patch-ably] Patched super constructor in ${path.basename(targetFile)}`);
    }

    if (content.includes(targetAgent)) {
      content = content.replaceAll(targetAgent, replacementAgent);
      changed = true;
      console.log(`[patch-ably] Patched agent string in ${path.basename(targetFile)}`);
    }

    if (changed) {
      fs.writeFileSync(targetFile, content, 'utf8');
    } else {
      console.log(`[patch-ably] Already patched: ${path.basename(targetFile)}`);
    }
  }
}
