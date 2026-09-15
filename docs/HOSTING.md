# Hosting the web prototype at chartthegame.com

The web app is a static single-page export served from a private S3 bucket
through CloudFront, with DNS for the domain in Route 53. One CloudFormation
stack (`infra/web-hosting.yaml`) owns all of it; `scripts/deploy-web.mjs`
drives the stack and the uploads. Everything runs in **us-east-1** because
CloudFront only accepts certificates from that region.

Expected cost: about **$0.50/month** (the Route 53 hosted zone). The bucket
holds ~3 MB, CloudFront's permanent free tier covers 1 TB and 10M requests a
month, and the certificate is free.

AWS profile: the script defaults to `rookies-production` (override with
`--profile` or `AWS_PROFILE`). Note that this profile's credentials are the
account **root user**; a scoped IAM user or role would be safer for routine
deploys.

## One-time setup

1. **Create the stack** (hosted zone, bucket, CloudFront; no domain yet):

   ```sh
   yarn deploy:web:infra
   ```

   Takes a few minutes (CloudFront). It prints the four **nameservers** of
   the new hosted zone and a `*.cloudfront.net` URL.

2. **Upload the app** and check it at the CloudFront URL:

   ```sh
   yarn deploy:web
   ```

3. **Point the domain at Route 53.** In Squarespace: account → Domains →
   chartthegame.com → **DNS** → **Domain Nameservers** → **Use Custom
   Nameservers**, enter the four nameservers from step 1, Save. Squarespace
   will warn that the domain disconnects from Squarespace hosting and will
   turn DNSSEC off; both are expected. The domain has no mail (MX) or other
   records today, so nothing else needs to be recreated. Propagation is
   usually minutes, at most 48 hours. Check with:

   ```sh
   dig +short NS chartthegame.com
   ```

4. **Enable the domain** once `dig` shows the Route 53 nameservers:

   ```sh
   yarn deploy:web:infra --domain
   ```

   This requests the certificate for `chartthegame.com` and
   `www.chartthegame.com`, validates it through DNS records the stack writes
   into the hosted zone, attaches it to CloudFront and creates the apex and
   `www` alias records. Allow 10–15 minutes. https://chartthegame.com then
   serves the app.

## Every later deploy

```sh
yarn deploy:web
```

Exports the app (`web.output: "single"` in `app.json`, so every route falls
back to `index.html`), syncs it to the bucket (hashed bundle and asset files
are cached for a year, `index.html` is never cached) and invalidates the
CloudFront cache. Add `--skip-build` to re-upload an existing `dist-web/`.

`node scripts/deploy-web.mjs status` prints the stack outputs (URLs,
bucket, distribution id, nameservers).

## How routing works

CloudFront maps S3's 403/404 for any missing key to `/index.html` with a
200, so a direct hit or refresh on `/team/t_floyd14u` loads the app and
expo-router reads the path. The trade-off is that unknown paths also return
the app instead of a real 404, which is fine for a prototype.

## Alternative that costs nothing

Squarespace's own DNS supports ALIAS records at the apex, so the domain
could stay on Squarespace DNS: add the two ACM validation CNAMEs, an ALIAS
at `@` and a CNAME at `www` pointing at the CloudFront domain. That saves
the $0.50/month zone but needs the certificate requested by hand and four
records typed into Squarespace; the Route 53 route keeps every step in one
stack and matches how the other domains in this AWS account are hosted.

## Tear down

```sh
aws s3 rm s3://<BucketName> --recursive --profile rookies-production
aws cloudformation delete-stack --stack-name chartthegame-web --region us-east-1 --profile rookies-production
```

Empty the bucket first or the stack deletion fails on it. Point the
nameservers back to Squarespace (**Use Squarespace nameservers**) if the
domain should show a Squarespace site again.
