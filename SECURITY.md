# Security policy

## Supported versions

Security fixes are applied to the latest published release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for
`apazureck/paged-pdf-js`. Do not open a public issue for an undisclosed
vulnerability.

Include:

- the affected version and browser,
- a minimal reproduction,
- the security impact, and
- any suggested mitigation.

## Security model

`paged-pdf-js` performs conversion in the user's browser and does not include a
backend service. Input is cloned and active HTML content is removed before
pagination. External resources can still initiate browser requests and are
subject to the browser's CORS and Content Security Policy rules.

Applications remain responsible for deciding which URLs and documents users
may load.
