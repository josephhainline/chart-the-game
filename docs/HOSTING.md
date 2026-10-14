# Hosting the web prototype at chartthegame.com

The web app is a static single-page export served from a private S3 bucket
through CloudFront, with DNS for the domain in Route 53. One CloudFormation
stack (`infra/web-hosting.yaml`) owns all of it; `scripts/deploy-web.mjs`
drives the stack and the uploads. Everything runs in **us-east-1** because
CloudFront only accepts certificates from that region.

Expected cost: about **$0.50/month** (the Route 53 hosted zone). The bucket
holds ~3 MB, CloudFront's permanent free tier covers 1 TB and 10M requests a
month, and the certificate is free.

## The account model

The site lives in its own AWS account, a **member of an organization whose
management account is `rookies-production`**. That account holds nothing else:
no other hosted zones, no other buckets, no shared IAM. It has no payment
method either: while it is a member, its charges consolidate onto the
management account's card, which is the point of putting it in an
organization rather than standing it up alone. The reason for the separate
account is the handoff — if the site is ever given to someone else, the whole account goes
with it and nothing has to be migrated (see **Handing the site over** below).
`rookies-production` itself cannot be handed over: it hosts `joehainline.com`,
`wizardryadventure.com` and `hhcf.us`.

Three identities, in descending power:

| Who | What it is | Used for |
|---|---|---|
| member-account **root** | the account's own root user | billing, contacts, MFA, leaving the org. Never an access key. |
| `chartthegame-admin` | `OrganizationAccountAccessRole`, assumed by the management account's `org-admin` user | `yarn deploy:web:infra` (CloudFormation creating CloudFront/ACM/Route 53 needs broad rights) |
| `chartthegame` | the `chartthegame-web-deploy` IAM user the stack creates | `yarn deploy:web` — upload to the one bucket, invalidate the one distribution, read the stack outputs. Nothing else. |

`chartthegame` is the only long-lived key on the laptop, and it is the one the
deploy script uses by default. (If deploys ever move to CI, replace it with a
GitHub OIDC role and no key at all.)

## One-time setup

### 1. Create the organization and the member account

From `rookies-production` (the management account):

```sh
aws organizations create-organization --feature-set ALL --profile rookies-production

aws organizations create-account \
  --account-name "Chart The Game" \
  --email <an address you control, unique across all of AWS> \
  --role-name OrganizationAccountAccessRole \
  --profile rookies-production

# a minute later, for the new account id:
aws organizations list-create-account-status --states SUCCEEDED \
  --query 'CreateAccountStatuses[].[AccountName,AccountId]' --output text \
  --profile rookies-production
```

The email must not be in use by any other AWS account; a `+` alias works if
the provider delivers it. `--feature-set ALL` keeps service control policies
available (a region restriction, say) and is required for an account to leave
the organization later.

### 2. A non-root identity to assume the role with

`create-account` puts an `OrganizationAccountAccessRole` in the member account
that the management account can assume — but **AWS refuses `AssumeRole` from
root credentials**, and the `rookies-production` profile is the account's root
user. So the management account needs one IAM user that can do nothing except
assume that role:

```sh
aws iam create-user --user-name org-admin --profile rookies-production

cat > /tmp/org-admin-policy.json <<'JSON'
{ "Version": "2012-10-17",
  "Statement": [{ "Sid": "AssumeChartTheGameAdmin", "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::<MEMBER_ACCOUNT_ID>:role/OrganizationAccountAccessRole" }] }
JSON

aws iam put-user-policy --user-name org-admin \
  --policy-name AssumeMemberAccountAdmin \
  --policy-document file:///tmp/org-admin-policy.json --profile rookies-production

aws iam create-access-key --user-name org-admin --profile rookies-production
```

Put that key pair in `~/.aws/credentials` under `[org-admin]`. A second member
account later means another ARN in that policy, not another user.

Then in `~/.aws/config`:

```ini
[profile chartthegame-admin]
role_arn       = arn:aws:iam::<MEMBER_ACCOUNT_ID>:role/OrganizationAccountAccessRole
source_profile = org-admin
region         = us-east-1

[profile chartthegame]
region = us-east-1
```

`chartthegame` has no credentials yet; step 4 creates them. Check the admin
profile works:

```sh
aws sts get-caller-identity --profile chartthegame-admin
```

It should report an assumed role in the member account. (`org-admin` is also
the identity that lets the management account's **root access key** be
deleted, which AWS recommends — but check what else uses it first.)

### 3. Member-account root hygiene

An account created through Organizations has no root password. From the
member account's email address, do a password reset, sign in as root, then:
enable MFA, and fill in the alternate billing/operations/security contacts.
Do not add a payment method: the organization's card covers this account, and
a card of its own is only needed the day it leaves (step 1 of the handoff,
where it is the new owner's). The root password, MFA and contacts are worth
doing now rather than at handoff, though — the account cannot leave without
them.

Costs roll up to `rookies-production` while the account is a member. Worth
adding a small budget alarm there, scoped to the new linked account.

### 4. Create the stack, then the deploy key

```sh
yarn deploy:web:infra     # runs as chartthegame-admin
```

Takes a few minutes (CloudFront). It prints the four **nameservers** of the
new hosted zone, a `*.cloudfront.net` URL, and the **deploy user** the stack
created (`chartthegame-web-deploy`). Give that user a key:

```sh
aws iam create-access-key --user-name chartthegame-web-deploy --profile chartthegame-admin
```

Put the pair in `~/.aws/credentials` under `[chartthegame]` (that file, not
the repo — nothing here holds credentials):

```ini
[chartthegame]
aws_access_key_id     = AKIA...
aws_secret_access_key = ...
```

### 5. Upload the app

```sh
yarn deploy:web           # runs as chartthegame
```

Check it at the CloudFront URL.

### 6. Point the domain at Route 53

In Squarespace: account → Domains → chartthegame.com → **DNS** → **Domain
Nameservers** → **Use Custom Nameservers**, enter the four nameservers from
step 4, Save. Squarespace will warn that the domain disconnects from
Squarespace hosting and will turn DNSSEC off; both are expected. The domain
has no mail (MX) or other records today, so nothing else needs to be
recreated. Propagation is usually minutes, at most 48 hours. Check with:

```sh
dig +short NS chartthegame.com
```

### 7. Enable the domain

Once `dig` shows the Route 53 nameservers:

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

`node scripts/deploy-web.mjs status` prints the stack outputs (URLs, bucket,
distribution id, nameservers, deploy user). Any command takes `--profile` to
override the default.

## Handing the site over

Nothing in AWS has to move; the account itself changes hands.

1. **Finish the member account's own sign-up** (as its root): **the new
   owner's** payment method, phone verification, contact details, customer
   agreement. An account created by Organizations has been billing to the
   organization's card and cannot leave until it stands on its own.
2. **Leave the organization** — `aws organizations leave-organization` from
   inside the member account, or Remove account from the management console.
   Its costs stop appearing on the `rookies-production` bill.
3. **Delete `OrganizationAccountAccessRole`** in the member account: it
   trusts `rookies-production`, and that trust should not outlive the handoff.
   Delete the `org-admin` user in the management account too, once no other
   member account needs it.
4. **Change the root email** to the new owner, who resets the password and
   re-enrolls MFA.
5. **Delete the deploy key**: `aws iam delete-access-key` for
   `chartthegame-web-deploy`, plus any admin user. The new owner makes their
   own with step 4 of the setup above.
6. **The domain is separate.** It is registered at Squarespace, not in this
   account, so either transfer it to the new owner's registrar (unlock it in
   Squarespace, hand over the auth code) or move the registration into this
   account's Route 53 first, so it travels with the account.
7. **The repo** (GitHub) transfers on its own.

The alternative handoff needs none of this: hand over the repo and the
domain, and let the new owner run this setup in their own account. The
infrastructure is one template, so that works — it just means a new bucket,
distribution and certificate, and a DNS cutover on a live site.

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
stack and keeps the DNS inside the account that would change hands.

## Tear down

```sh
aws s3 rm s3://<BucketName> --recursive --profile chartthegame-admin
aws cloudformation delete-stack --stack-name chartthegame-web --region us-east-1 --profile chartthegame-admin
```

Empty the bucket first or the stack deletion fails on it. Point the
nameservers back to Squarespace (**Use Squarespace nameservers**) if the
domain should show a Squarespace site again. Closing the member account
outright is a management-account action (Organizations → the account →
Close).
