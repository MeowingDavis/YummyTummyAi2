#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const DEFAULT_MODEL = process.env.NANO_BANANA_DEFAULT_MODEL || 'gemini-2.5-flash-image';
const NPX_ROOT = path.join(os.homedir(), '.npm', '_npx');
const RELATIVE_SERVER_INDEX = path.join(
  'node_modules',
  '@lyalindotcom',
  'nano-banana-mcp',
  'dist',
  'server',
  'index.js'
);
const RELATIVE_GEMINI_CLIENT = path.join(
  'node_modules',
  '@lyalindotcom',
  'nano-banana-mcp',
  'dist',
  'server',
  'gemini-client.js'
);

function findNanoBananaInstall() {
  if (!fs.existsSync(NPX_ROOT)) {
    throw new Error(`npx cache root not found: ${NPX_ROOT}`);
  }

  const candidates = [];

  for (const entry of fs.readdirSync(NPX_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const installRoot = path.join(NPX_ROOT, entry.name);
    const serverIndexPath = path.join(installRoot, RELATIVE_SERVER_INDEX);
    const geminiClientPath = path.join(installRoot, RELATIVE_GEMINI_CLIENT);

    if (!fs.existsSync(serverIndexPath) || !fs.existsSync(geminiClientPath)) {
      continue;
    }

    const stat = fs.statSync(serverIndexPath);
    candidates.push({
      installRoot,
      serverIndexPath,
      geminiClientPath,
      mtimeMs: stat.mtimeMs,
    });
  }

  if (candidates.length === 0) {
    throw new Error('No cached nano-banana install found under ~/.npm/_npx');
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0];
}

function patchDefaultModel(geminiClientPath, defaultModel) {
  const source = fs.readFileSync(geminiClientPath, 'utf8');
  const next = source.replace(
    /defaultModel = 'gemini-2\.5-flash-image-preview';/,
    `defaultModel = '${defaultModel}';`
  );

  const currentMatch = next.match(/defaultModel = '([^']+)';/);
  const currentModel = currentMatch ? currentMatch[1] : null;

  if (currentModel !== defaultModel) {
    throw new Error(`Unable to set nano-banana default model to ${defaultModel}`);
  }

  if (next !== source) {
    fs.writeFileSync(geminiClientPath, next);
    return { patched: true, model: currentModel };
  }

  return { patched: false, model: currentModel };
}

async function main() {
  const install = findNanoBananaInstall();
  const patch = patchDefaultModel(install.geminiClientPath, DEFAULT_MODEL);

  if (process.env.NANO_BANANA_WRAPPER_CHECK === '1') {
    console.log(
      JSON.stringify(
        {
          installRoot: install.installRoot,
          serverIndexPath: install.serverIndexPath,
          geminiClientPath: install.geminiClientPath,
          defaultModel: patch.model,
          patched: patch.patched,
        },
        null,
        2
      )
    );
    return;
  }

  await import(pathToFileURL(install.serverIndexPath).href);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
