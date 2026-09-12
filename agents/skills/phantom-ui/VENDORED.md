# Vendored phantom-ui

The files next to this note are the standalone build of
[`@aejkatappaja/phantom-ui`](https://github.com/Aejkatappaja/phantom-ui) version **1.6.1**,
copied byte-for-byte from the published npm package so agents and offline projects can use
the component without registry access.

| File | Source path inside the package |
| --- | --- |
| `phantom-ui.standalone.js` | `dist/phantom-ui.standalone.js` |
| `phantom-ui.standalone.d.ts` | `dist/phantom-ui.standalone.d.ts` |
| `LICENSE` | `LICENSE` (MIT, upstream) |

Provenance of this copy:

- package: `@aejkatappaja/phantom-ui@1.6.1`
- tarball: <https://registry.npmjs.org/@aejkatappaja/phantom-ui/-/phantom-ui-1.6.1.tgz>
- integrity: `sha512-7ZT4sW0YjuQp+Edq/5CM13l+ZUlNR5GtpfF+WbUVTzO9UvtfDv6d6qcPZdPP7PS1W6lP2fKpqVQiWb0iWdDheQ==`
- shasum: `8eea8c39fe47454fc1bd2cde79acce0bd6c33406`
- license: MIT

The standalone build bundles Lit, so the element works with no dependency and no build step.
Upstream asks vendored copies to record the version next to the files, which is what this
note is for: a vendored copy does not receive updates on its own.

## Updating

```bash
tmp="$(mktemp -d)"
cd "${tmp}"
npm pack @aejkatappaja/phantom-ui@<version>
tar xzf ./*.tgz
cp package/dist/phantom-ui.standalone.js \
   package/dist/phantom-ui.standalone.d.ts \
   package/LICENSE \
   <this directory>/
```

Then refresh the version, integrity and shasum above from:

```bash
npm view @aejkatappaja/phantom-ui@<version> dist.integrity dist.shasum
```
