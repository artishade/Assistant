#!/usr/bin/env node
/**
 * Optimuse rebrand: identity replacements over the imported base.
 * Scoped, verifiable replacements — no upstream project names survive in
 * user-visible identity. The npm scope (@cherrystudio/*) is a published
 * package namespace and is intentionally NOT touched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// [file relative to root, [ [find, replace], ... ]]
const EDITS = [
  // --- App identity ---
  [
    'app.json',
    [
      ['"name": "Cherry Studio"', '"name": "Optimuse"'],
      ['"slug": "cherry-studio"', '"slug": "optimuse"'],
      ['"scheme": "cherrystudio"', '"scheme": "optimuse"'],
      [
        '"bundleIdentifier": "com.cherryai.cherrystudio-app"',
        '"bundleIdentifier": "com.optimuse.app"',
      ],
      ['"group.com.cherryai.cherrystudio-app"', '"group.com.optimuse.app"'],
      ['"package": "com.cherryai.cherrystudio_app"', '"package": "com.optimuse.app"'],
      ['"organization": "cherryai"', '"organization": "optimuse"'],
      ['"project": "cherry-studio-app"', '"project": "optimuse"'],
      [
        '"bundleIdentifier": "com.cherryai.cherrystudio-app.ExpoWidgetsTarget"',
        '"bundleIdentifier": "com.optimuse.app.ExpoWidgetsTarget"',
      ],
      ['"group.com.cherryai.cherrystudio-app"', '"group.com.optimuse.app"'],
      ['Allow Cherry Studio', 'Allow Optimuse'],
      ['Cherry Studio collects', 'Optimuse collects'],
      ['_cherry-remote._tcp', '_optimuse-remote._tcp'],
      ['Update Cherry Studio on your desktop', 'Update Optimuse desktop'],
      ['Cherry Studio on PC', 'Optimuse desktop on PC'],
    ],
  ],
  [
    'app.config.ts',
    [["`cherrystudio${suffix.replace('.', '-')}`", "`optimuse${suffix.replace('.', '-')}`"]],
  ],
  [
    'package.json',
    [
      ['"name": "cherry-studio-app"', '"name": "optimuse"'],
      ['"version": "0.1.2"', '"version": "0.1.0"'],
    ],
  ],
  [
    'src/frontend/appShell/observability/reportingServices.json',
    [
      [
        '"nativeFlag": "CherryCrashReportingEnabled"',
        '"nativeFlag": "OptimuseCrashReportingEnabled"',
      ],
    ],
  ],
  ['scripts/withReportingAutolinking.js', [['cherry-reporting', 'optimuse-reporting']]],
  // --- iOS native module flag names (crash-reporting module reads this) ---
  [
    'modules/crash-reporting/ios/CrashReportingModule.swift',
    [['CherryCrashReportingEnabled', 'OptimuseCrashReportingEnabled']],
  ],
  [
    'modules/crash-reporting/android/CrashReportingModule.kt',
    [['CherryCrashReportingEnabled', 'OptimuseCrashReportingEnabled']],
  ],
];

// The brand word is a proper noun and stays Latin-script in every locale.
const LOCALE_EDITS = {
  // Keep one shared key surface: brand appears as "Optimuse" in every locale.
  'common.cherryStudio': 'Optimuse',
  'common.cherryStudioDescription': 'A powerful AI assistant',
  'chat.inputPlaceholder': 'Chat with Optimuse',
  'settings.about.contact.subject': 'Optimuse Feedback',
};

function applyEdits(relPath, edits) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    console.error(`MISSING: ${relPath}`);
    process.exitCode = 1;
    return;
  }
  let text = fs.readFileSync(full, 'utf8');
  let changed = 0;
  for (const [find, replace] of edits) {
    if (!text.includes(find)) {
      console.error(`NOT FOUND in ${relPath}: ${JSON.stringify(find.slice(0, 60))}`);
      process.exitCode = 1;
      continue;
    }
    text = text.split(find).join(replace);
    changed += 1;
  }
  fs.writeFileSync(full, text);
  console.log(`OK ${relPath} (${changed} edits)`);
}

for (const [relPath, edits] of EDITS) applyEdits(relPath, edits);

// Locale sweep: replace every "Cherry Studio" brand mention with Optimuse.
// Long sentences keep their translation; only the brand word changes.
const localesDir = path.join(ROOT, 'src/frontend/i18n/locales');
for (const entry of fs.readdirSync(localesDir)) {
  if (!entry.endsWith('.json')) continue;
  const full = path.join(localesDir, entry);
  const raw = fs.readFileSync(full, 'utf8');
  // The brand name is a proper noun and stays Latin-script in every locale.
  const next = raw.split('Cherry Studio').join('Optimuse');
  let out = next;
  for (const [key, value] of Object.entries(LOCALE_EDITS)) {
    const re = new RegExp(`("${key.replace(/\./g, '\\.')}":\\s*")[^"]*(")`);
    out = out.replace(re, `$1${value}$2`);
  }
  if (out !== raw) {
    fs.writeFileSync(full, out);
    const count = (raw.match(/Cherry Studio/g) || []).length;
    console.log(`OK locale ${entry} (${count} brand mentions)`);
  }
}
console.log('Rebrand complete.');
