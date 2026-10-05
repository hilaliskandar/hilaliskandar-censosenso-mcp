# Security Policy

## Security model

CensoSenso is a read-only MCP server over public IBGE data.

The current implementation:

- does not write, mutate or delete IBGE state;
- exposes strict input schemas;
- marks tools as read-only, non-destructive and idempotent;
- supports local STDIO and public Streamable HTTP;
- uses a per-client in-memory rate limiter in the Worker;
- validates Host/Origin through the MCP handler;
- supports optional Bearer authentication through `API_KEY` for the MCP endpoint;
- keeps `/metrics` private by default through a separate `METRICS_API_KEY` contract;
- does not currently require an API key on the public MCP endpoint.

Production endpoint:

`https://censosenso.poderdapalavra.org/mcp`

## State and telemetry

The core data tools are read-only, but the Worker is not literally “state-free”:

- `USAGE` is a Durable Object used for aggregated usage counters;
- an in-memory TTL cache is used for upstream responses;
- `CF_VERSION_METADATA` exposes deploy metadata;
- Cloudflare observability is enabled.

Tool arguments and returned datasets are not intentionally stored in the `USAGE` counters.

The optional Analytics Engine integration exists in code but its binding is not enabled in the current production deployment.

`/metrics` is an operational surface, not a public API. Without `METRICS_API_KEY` it returns 404. When the secret is configured, the route requires the matching Bearer token. This keeps aggregated usage telemetry private even when the MCP endpoint itself is intentionally public, and the route is not advertised on the public landing page.

See [PRIVACY.md](PRIVACY.md) for the data-processing description.

## Authentication

Bearer authentication can be enabled with the `API_KEY` Worker secret/environment binding.

OAuth is not currently enabled.

Authentication changes must be treated as contract/deployment changes and tested against MCP discovery, initialization and tool calls.

## Transport security

The public endpoint is served by Cloudflare over HTTPS.

Security-sensitive tests include Host/Origin checks and HTTP end-to-end scripts under `worker/scripts/` and `tests/m6-*.test.ts`.

## Dependency and build security

Before production deployment, the repository runs `npm run gate:deploy`. Dependency lockfiles are versioned and production builds use `npm ci`.

Security-relevant dependency changes must update both package manifests and lockfiles and pass the full gate.

## Supported versions

Security maintenance is focused on the current 6.x line.

| Version | Supported |
| ------- | --------- |
| 6.x     | ✅ |
| < 6.0   | ❌ |

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue before maintainers have had a reasonable opportunity to assess it.

Use GitHub private vulnerability reporting when available:

<https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/security/advisories/new>

Include:

- affected version/commit;
- affected transport (STDIO/HTTP/both);
- reproduction steps;
- expected and observed behavior;
- relevant request/response material with secrets removed.
