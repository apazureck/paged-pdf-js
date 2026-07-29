# Contributing

Thank you for helping improve `paged-pdf-js`.

## Development setup

```bash
npm install
npx playwright install chromium
npm run validate
```

Please add tests before implementation changes and keep statement, branch,
function, and line coverage above 80%.

## Pull requests

- Keep changes focused and describe the user-visible behavior.
- Add unit tests and a browser test for critical conversion flows.
- Do not commit generated bundles, test reports, credentials, or private PDFs.
- Use conventional commit messages such as `feat:`, `fix:`, `test:`, and
  `docs:`.
- Document browser/CORS implications for new resource-loading behavior.

## Architecture

Paged.js integration, DOM capture, and PDF authoring are separate modules.
Please keep new renderers behind that boundary so the public API can remain
stable.
