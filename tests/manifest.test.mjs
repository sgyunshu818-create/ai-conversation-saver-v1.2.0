import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

test('manifest declares side panel entry and permission', () => {
  assert.ok(manifest.permissions.includes('sidePanel'));
  assert.deepEqual(manifest.side_panel, {
    default_path: 'src/sidepanel/sidepanel.html',
  });
  assert.ok(fs.existsSync(manifest.side_panel.default_path));
});

test('extension opens in side panel by default without popup entry', () => {
  assert.equal(manifest.action.default_popup, undefined);
});

test('extension declares custom icons for browser chrome', () => {
  assert.deepEqual(manifest.icons, {
    16: 'src/assets/icons/chatai-memo-16.png',
    32: 'src/assets/icons/chatai-memo-32.png',
    48: 'src/assets/icons/chatai-memo-48.png',
    128: 'src/assets/icons/chatai-memo-128.png',
  });
  assert.deepEqual(manifest.action.default_icon, manifest.icons);
  for (const iconPath of Object.values(manifest.icons)) {
    assert.ok(fs.existsSync(iconPath), `${iconPath} should exist`);
  }
});
