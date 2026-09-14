#!/usr/bin/env node
/**
 * Export the web app as a relocatable static bundle.
 *
 * Expo inlines the site's base path at build time (asset URLs, router prefix).
 * Static hosts like Claude Artifacts serve the page under a path we don't know
 * up front, so we build with a sentinel base path and patch the output so the
 * base is discovered at runtime from `location.pathname`.
 *
 * Usage: node scripts/build-web-artifact.mjs <outputDir>
 * Output: <outputDir>/index.html (a body fragment: title + styles + root div +
 *         loader script), <outputDir>/_expo/..., <outputDir>/assets/...
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, 'dist-artifact'));
const SENTINEL = '/__ctgbase__';
const appJsonPath = path.join(root, 'app.json');

const original = fs.readFileSync(appJsonPath, 'utf8');
const config = JSON.parse(original);
config.expo.experiments = { ...(config.expo.experiments ?? {}), baseUrl: SENTINEL };
config.expo.web = { ...(config.expo.web ?? {}), output: 'single' };

fs.rmSync(outDir, { recursive: true, force: true });
try {
  fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');
  execSync(`npx expo export -p web --output-dir "${outDir}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
} finally {
  fs.writeFileSync(appJsonPath, original);
}

// 1. Patch the JS bundle: string literals starting with the sentinel become
//    runtime concatenations with the detected base; the escaped copy inside the
//    embedded app config is blanked.
const jsDir = path.join(outDir, '_expo', 'static', 'js', 'web');
const bundles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
if (bundles.length !== 1) throw new Error(`Expected one bundle, found ${bundles.join(', ')}`);
const bundlePath = path.join(jsDir, bundles[0]);
let js = fs.readFileSync(bundlePath, 'utf8');
const before = (js.match(/__ctgbase__/g) ?? []).length;
js = js.replace(/\\"\/__ctgbase__\\"/g, '\\"\\"');
js = js.replace(/(?<!\\)"\/__ctgbase__/g, '(globalThis.__CTG_BASE__||"")+"');
const leftover = (js.match(/__ctgbase__/g) ?? []).length;
if (leftover) throw new Error(`Sentinel still present ${leftover} times after patching`);
fs.writeFileSync(bundlePath, js);
console.log(`Patched ${before} base-path references in ${bundles[0]}`);

// 2. Rewrite index.html into a fragment the artifact host can wrap: keep the
//    title and styles, drop preloads/links that bake in the base, and load the
//    bundle from the runtime-detected base.
const htmlPath = path.join(outDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const bundleRel = path.posix.join('_expo/static/js/web', bundles[0]);

const fragment = `<title>Chart The Game</title>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover">
${styles}
<style>
  html, body, #root { height: 100%; }
  body { margin: 0; background-color: #EEF1F5; overflow: hidden; }
  #root { display: flex; }
</style>
<div id="root"></div>
<script>
  (function () {
    // Base path = directory of the page. Works at "/", "/x/", "/x/index.html".
    var p = location.pathname.replace(/\\/index\\.html?$/, '').replace(/\\/+$/, '');
    globalThis.__CTG_BASE__ = p;
    // Some sandboxes refuse history writes; keep navigation working regardless.
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      history[m] = function () {
        try { return orig.apply(history, arguments); } catch (e) { return undefined; }
      };
    });
    var s = document.createElement('script');
    s.src = p + '/${bundleRel}';
    s.defer = true;
    document.body.appendChild(s);
  })();
</script>
`;
fs.writeFileSync(htmlPath, fragment);

// 3. Remove files the fragment doesn't reference.
for (const f of ['+not-found.html', '_sitemap.html']) {
  fs.rmSync(path.join(outDir, f), { force: true });
}

// 4. Emit a manifest of supporting files (published path → source path).
const files = {};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const rel = path.relative(outDir, full).split(path.sep).join('/');
      if (rel !== 'index.html') files[rel] = rel;
    }
  }
};
walk(outDir);
fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(files, null, 2));
delete files['files.json'];
console.log(`Wrote fragment index.html and ${Object.keys(files).length} supporting files to ${outDir}`);
