# Changelog

All notable public changes to CensoSenso MCP will be documented in this file.

The public project uses the pre-1.0 policy in [docs/VERSIONAMENTO.md](docs/VERSIONAMENTO.md).

## [0.7.0] - 2026-10-07

### Added
- `ibge_mapa`, a 24th MCP tool for municipal choropleth maps in SVG.
- Choropleth classification by quantiles or equal intervals for 2–50 municipalities of the same state.
- Combined provenance for SIDRA indicator values and official IBGE municipal meshes.
- Structured map output with classes, municipal values, bounding box, source URLs and complete SVG.

### Changed
- Public tool surface grows from 23 to 24 tools.
- The cartography cluster now covers geometry retrieval (`ibge_malhas`) and derived municipal thematic maps (`ibge_mapa`).
- Public surface baseline advances to `surface-stdio-0.7.0.json`.

### Validated
- Main test suite, coverage, OpenAI/MCP contracts, eval catalog and Worker tests pass with the 24-tool surface.
- Production `tools/list` confirmed 24 tools after deployment.

## [0.6.0] - 2026-10-05

### Added
- 23 MCP tools over official IBGE data sources.
- Local STDIO and remote Streamable HTTP transports.
- Structured provenance and attribution.
- SIDRA statistics mode with full-set distributions and rankings.
- Topological municipal adjacency and centroid-distance mode.
- Seven versioned territorial snapshots.
- Search/fetch discovery contract.
- Public security, privacy, contribution and lineage documentation.
- Reproducible validation gate for the 645 municipalities of São Paulo.

### Changed
- Public version line starts at 0.6.0. Previous 4.x, 5.x and 6.x identifiers belong to internal laboratory history and are not public releases.
- Canonical public endpoint: `https://censosenso.poderdapalavra.org/mcp`.
- Public source repository: `hilaliskandar/hilaliskandar-censosenso-mcp`.

### Security
- `/metrics` is private by default.
- Host/origin validation is enforced by the remote transport.
- MCP tools are read-only.
- Rate limiting protects against bursts and accidental abuse.

### Validated
- 645/645 São Paulo municipalities passed structural validation.
- 21/21 deterministic sample municipalities passed live `ibge_geocodigo` and `ibge_localidade` checks.
- Snapshot SHA-256: `a215de0ed21d5538db07a35e65c8dcd9fb1c201491c1ee1f4d0aaaa757810d86`.
- Public validation evidence: `validation/sp/0.6.0/`.

See [docs/RELEASE_0_6_0.md](docs/RELEASE_0_6_0.md) for release notes.
