# Changelog

All notable public changes to CensoSenso MCP will be documented in this file.

The public project uses the pre-1.0 policy in [docs/VERSIONAMENTO.md](docs/VERSIONAMENTO.md).

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
- Snapshot SHA-256: `dc6e4eebffb4d755d8899eadae4ce876e565506b0cce5657f08a2835e290acc7`.

See [docs/RELEASE_0_6_0.md](docs/RELEASE_0_6_0.md) for release notes.
