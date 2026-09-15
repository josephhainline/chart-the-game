#!/usr/bin/env node
/**
 * Host the web app on AWS (S3 + CloudFront + Route 53), see docs/HOSTING.md.
 *
 *   node scripts/deploy-web.mjs infra            create/update the stack (no custom domain)
 *   node scripts/deploy-web.mjs infra --domain   same, plus certificate + chartthegame.com records
 *                                                (only after the nameservers point at the hosted zone)
 *   node scripts/deploy-web.mjs site             export the web app, upload it, invalidate the CDN
 *   node scripts/deploy-web.mjs site --skip-build   upload the existing dist-web/ export
 *   node scripts/deploy-web.mjs status           print the stack outputs (nameservers, URLs)
 *
 * Options: --profile <aws profile> (default: $AWS_PROFILE or rookies-production)
 *          --stack <name> (default chartthegame-web)   --region <region> (default us-east-1)
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--'));
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const profile = option('profile', process.env.AWS_PROFILE ?? 'rookies-production');
const region = option('region', 'us-east-1');
const stack = option('stack', 'chartthegame-web');
const distDir = path.join(root, 'dist-web');
const template = path.join(root, 'infra', 'web-hosting.yaml');

const aws = (cmdArgs, opts = {}) =>
  execFileSync('aws', ['--profile', profile, '--region', region, ...cmdArgs], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts });

function outputs() {
  const raw = aws(['cloudformation', 'describe-stacks', '--stack-name', stack, '--output', 'json', '--query', 'Stacks[0].Outputs']);
  return Object.fromEntries(JSON.parse(raw).map((o) => [o.OutputKey, o.OutputValue]));
}

function printStatus() {
  const out = outputs();
  console.log(`Site:          ${out.SiteUrl}`);
  console.log(`CloudFront:    https://${out.DistributionDomainName}`);
  console.log(`Bucket:        ${out.BucketName}`);
  console.log(`Distribution:  ${out.DistributionId}`);
  console.log(`Nameservers:   ${out.NameServers}`);
}

function infra() {
  const enableDomain = flag('domain') ? 'true' : 'false';
  console.log(`Deploying stack ${stack} in ${region} (profile ${profile}, custom domain: ${enableDomain})`);
  aws(
    ['cloudformation', 'deploy', '--stack-name', stack, '--template-file', template, '--no-fail-on-empty-changeset', '--parameter-overrides', `EnableCustomDomain=${enableDomain}`],
    { stdio: 'inherit' },
  );
  printStatus();
}

function build() {
  // The export must be a single index.html (web.output "single") so every route can fall back to it.
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  if (appJson.expo.web?.output !== 'single') throw new Error('app.json: expo.web.output must be "single" for SPA hosting');
  fs.rmSync(distDir, { recursive: true, force: true });
  execSync(`npx expo export -p web --output-dir "${distDir}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  for (const f of ['+not-found.html', '_sitemap.html', 'metadata.json']) fs.rmSync(path.join(distDir, f), { force: true });
}

function site() {
  if (!flag('skip-build')) build();
  if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error(`No export at ${distDir}; run without --skip-build`);
  const { BucketName, DistributionId } = outputs();
  const bucket = `s3://${BucketName}`;
  // Hashed bundle and asset files never change under the same name: cache them for a year.
  aws(['s3', 'sync', distDir, bucket, '--delete', '--exclude', 'index.html', '--exclude', 'favicon.ico', '--cache-control', 'public, max-age=31536000, immutable'], { stdio: 'inherit' });
  // The entry document (and favicon) must always be re-checked so a new deploy is picked up.
  aws(['s3', 'cp', path.join(distDir, 'index.html'), `${bucket}/index.html`, '--cache-control', 'no-cache', '--content-type', 'text/html; charset=utf-8'], { stdio: 'inherit' });
  if (fs.existsSync(path.join(distDir, 'favicon.ico'))) {
    aws(['s3', 'cp', path.join(distDir, 'favicon.ico'), `${bucket}/favicon.ico`, '--cache-control', 'public, max-age=86400'], { stdio: 'inherit' });
  }
  const inv = aws(['cloudfront', 'create-invalidation', '--distribution-id', DistributionId, '--paths', '/*', '--output', 'text', '--query', 'Invalidation.Id']);
  console.log(`Invalidation ${inv.trim()} created`);
  printStatus();
}

switch (command) {
  case 'infra':
    infra();
    break;
  case 'site':
    site();
    break;
  case 'status':
    printStatus();
    break;
  default:
    console.error('usage: node scripts/deploy-web.mjs <infra [--domain] | site [--skip-build] | status> [--profile p] [--stack s] [--region r]');
    process.exit(2);
}
