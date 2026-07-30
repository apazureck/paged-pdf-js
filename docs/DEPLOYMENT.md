# Deployment

The production site is a static Vite build containing the playground, feature
gallery, developer manual, browser bundles, TypeScript declarations, npm
archive, and checksummed download manifest.

The public repository is
[`apazureck/paged-pdf-js`](https://github.com/apazureck/paged-pdf-js). CI
validates every pull request and protected `main` update. A successful trusted
push to `main` can deploy after the repository owner approves the protected
`production` environment.

## Build the complete site

Local validation requires Node.js 20.19+, Python 3.12+, and PHP 8.2+ with the
ZIP extension available to the PHP CLI.

```bash
npm ci
npm run validate
```

The deployable directory is `demo-dist/`:

```text
demo-dist/
  index.html
  gallery.html
  manual.html
  downloads/
    paged-pdf.min.js
    paged-pdf.js
    paged-pdf.cjs
    index.d.ts
    paged-pdf-js-<version>.tgz
    manifest.json
```

## Hosting requirements

The automated deployment is designed for the current managed webgo webspace.
It requires:

- an FTP account jailed to this site's document root;
- explicit FTPS with certificate validation and protected data transfers;
- PHP 8.2 or later with `ZipArchive`;
- HTTPS with a certificate valid for `paged-pdf-js.pazureck.de`;
- permission for PHP to create directories, replace site files, and delete the
  temporary deployment controls.

The verified FTPS endpoint for the current server is
`s219.goserver.host:21`. Its certificate covers `*.goserver.host`. Do not use
the website hostname as the FTPS host unless its FTP certificate is also valid
for that name.

## GitHub production secrets

Store every connection value in the protected `production` environment:

| Secret | Meaning |
|---|---|
| `FTP_HOST` | Certificate-valid FTPS host, currently `s219.goserver.host` |
| `FTP_PORT` | Explicit-FTPS port, currently `21` |
| `FTP_USER` | FTP user jailed to the website document root |
| `FTP_PASSWORD` | Password for that dedicated FTP user |
| `FTP_SERVER_DIR` | Relative directory inside the jail; use `.` for its root |

Set values through GitHub's environment settings or the CLI. Do not place
actual values in a command saved in shell history:

```bash
gh secret set FTP_HOST --env production
gh secret set FTP_PORT --env production
gh secret set FTP_USER --env production
gh secret set FTP_PASSWORD --env production
gh secret set FTP_SERVER_DIR --env production
```

Repository contributors cannot read GitHub secret values. Fork pull-request
workflows do not receive them, external contributors require workflow
approval, and the deployment job cannot access them until the repository owner
approves the `production` environment.

## How the FTPS release works

The deploy job:

1. downloads the exact site artifact built from the validated `main` commit;
2. validates all local paths, file count, and total uncompressed size;
3. creates a ZIP plus a uniquely named PHP extractor;
4. generates a fresh 256-bit deployment token;
5. embeds the expected SHA-256 archive hash and exact file list in the
   temporary extractor;
6. uploads the ZIP first and the PHP extractor last over explicit FTPS;
7. invokes the extractor with an HTTPS `POST` and the token in a request
   header;
8. smoke-tests the homepage, manual, and browser bundle;
9. removes uploaded control files in both PHP and FTPS cleanup paths.

The PHP extractor returns `404` for a wrong method or token. It rejects:

- absolute, parent-relative, empty, backslash, or NUL-containing ZIP paths;
- duplicate paths, directory entries, and symbolic links;
- archives over 5,000 files or 150 MiB uncompressed;
- an unexpected checksum or file list;
- symlinked destination parents and non-file destination collisions.

Files are extracted into a private staging directory. Assets are published
before HTML entry points, with `index.html` last. The managed-file manifest at
`.well-known/paged-pdf-managed-files.json` allows later deployments to remove
only stale files owned by this project. Unrelated hosting files are not
deleted.

The generated PHP script contains a one-run token and is never committed. It
deletes itself, the archive, and staging directory after every
authorized attempt. A permission-restricted persistent lock file serializes
releases. Errors returned publicly use fixed categories and never
include FTP credentials or server filesystem paths.

## First deployment

1. Point the domain's document root at the FTP account's jailed root.
2. Enable PHP 8.2+ and the ZIP extension for that document root.
3. Issue the correct TLS certificate for `paged-pdf-js.pazureck.de`.
4. Add all five `production` environment secrets.
5. Merge the deployment pull request to `main`.
6. Approve the pending `production` environment deployment.
7. Confirm:

   ```text
   https://paged-pdf-js.pazureck.de/
   https://paged-pdf-js.pazureck.de/manual.html
   https://paged-pdf-js.pazureck.de/downloads/paged-pdf.min.js
   ```

If a release must be rolled back, revert the responsible commit through a
pull request. The resulting validated `main` build redeploys the previous
site. GitHub retains each built site artifact for 14 days for diagnosis.

## Publish npm and enable UNPKG

Before the first npm release:

1. Confirm the `paged-pdf-js` package name for the npm account.
2. Enable two-factor authentication on npm.
3. Configure npm trusted publishing:
   - GitHub owner: `apazureck`
   - repository: `paged-pdf-js`
   - workflow: `release.yml`
4. Publish a GitHub Release tagged exactly as `v<package.version>`.

The workflow publishes with npm provenance through OIDC, so no long-lived
`NPM_TOKEN` is stored. UNPKG and jsDelivr then serve the package:

```text
https://unpkg.com/paged-pdf-js@0.1.0/dist/paged-pdf.min.js
https://cdn.jsdelivr.net/npm/paged-pdf-js@0.1.0/dist/paged-pdf.min.js
```

Published npm versions are immutable. Release a corrective version instead of
overwriting an existing package.
