# Deployment

The production site is a static Vite build. It contains the playground,
feature lab, developer manual, browser bundles, TypeScript entry declarations,
an npm-compatible package archive, and a checksummed download manifest.

## Current external status

As checked on 29 July 2026:

- `paged-pdf-js.pazureck.de` resolves to `185.30.32.219`.
- HTTPS presents a certificate that does not match the hostname.
- The HTTPS virtual host returns `403`.
- Plain HTTP redirects to the hosting provider rather than this project.
- `paged-pdf-js` is not yet available from the public npm registry.
- `github.com/apazureck/paged-pdf-js` is not yet public and this checkout has
  no Git remote.

The repository changes can make the release artifact reproducible, but the
server virtual host, TLS certificate, GitHub repository, and npm ownership must
be activated in their respective control panels.

## Build the complete site

```bash
npm ci
npm run validate
```

The deployable directory is `demo-dist/`. Important paths are:

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

The stable download names always represent the current site build. Exact npm
and UNPKG versions are the immutable distribution channel.

## Configure the web server

The included [Nginx example](../deploy/nginx/paged-pdf-js.conf.example) expects
this release layout:

```text
/srv/paged-pdf-js/
  releases/
    <commit>-<run>-<attempt>/
  current -> releases/<active release>
```

Required server work:

1. Create the deployment root and a restricted SSH deployment user.
2. Give that user write access only to the deployment root.
3. Configure the virtual host root as `/srv/paged-pdf-js/current`.
4. Issue a TLS certificate containing `paged-pdf-js.pazureck.de`.
5. Redirect HTTP to HTTPS after the certificate and virtual host work.
6. Confirm JavaScript downloads use a JavaScript MIME type and
   `Access-Control-Allow-Origin: *` so cross-origin ES module imports work.
7. Keep directory listing disabled.

If the public server is managed webspace without SSH, symlinks, or Nginx
access, adapt the final workflow step to the provider's SFTP deployment path.
The complete directory to upload remains `demo-dist/`.

## Create the public GitHub repository

Create `apazureck/paged-pdf-js` as a public repository, add it as `origin`, and
push `main`. GitHub Actions must be enabled.

Create a protected GitHub environment named `production` with:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | SSH hostname for the public server |
| `DEPLOY_USER` | Restricted deployment user |
| `DEPLOY_PATH` | Absolute release root, for example `/srv/paged-pdf-js` |
| `DEPLOY_SSH_KEY` | Private Ed25519 deployment key |
| `DEPLOY_KNOWN_HOSTS` | Pinned `known_hosts` line for the SSH server |

The deployment workflow validates these values, uploads to a unique staging
directory, verifies the archive checksum, activates the release through one
symlink switch, and restores the previous symlink if public smoke checks fail.

Do not store deployment credentials in this repository.

## Publish npm and enable UNPKG

The package name currently returns `404` from the public npm registry. Before
the first release:

1. Confirm the `paged-pdf-js` name is available to your npm account.
2. Enable two-factor authentication on the npm account.
3. Configure npm trusted publishing for:
   - GitHub owner: `apazureck`
   - repository: `paged-pdf-js`
   - workflow: `release.yml`
4. Create and protect a GitHub environment named `npm`.
5. Publish a GitHub Release tagged exactly as `v<package.version>`, currently
   `v0.1.0`.

The release workflow validates, builds, and publishes with npm provenance.
UNPKG and jsDelivr then serve the package automatically:

```text
https://unpkg.com/paged-pdf-js@0.1.0/dist/paged-pdf.min.js
https://cdn.jsdelivr.net/npm/paged-pdf-js@0.1.0/dist/paged-pdf.min.js
```

## Release sequence

1. Merge a validated version bump to `main`.
2. Let CI deploy the static site and its current-build downloads.
3. Publish a GitHub Release with the matching `v<version>` tag.
4. Confirm the npm package and exact-version UNPKG URL.
5. Smoke-test the playground, manual, direct bundle, and one generated PDF.

To roll back the site, repoint `/srv/paged-pdf-js/current` to a previous
directory under `releases/`. npm versions are immutable and must never be
overwritten; publish a corrective version instead.
