import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

test('website text keeps the requested punctuation style without em dashes', () => {
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.(html|js|json)$/.test(entry.name)) {
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /\u2014|&mdash;|&#8212;|&#x2014;/i, path.relative(ROOT, file));
      }
    }
  };
  scan(path.join(ROOT, 'site', 'public'));
});
