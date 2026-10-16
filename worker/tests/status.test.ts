import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVER_CONFIG } from "../src/config.js";
import { buildStatus } from "../src/status.js";

afterEach(() => vi.unstubAllGlobals());

describe("buildStatus", () => {
  it("sem binding version_metadata → sem bloco deploy", () => {
    const status = buildStatus({});
    expect(status).toEqual({
      status: "ok",
      name: SERVER_CONFIG.name,
      version: SERVER_CONFIG.version,
      mcp: SERVER_CONFIG.mcpRoute,
    });
  });

  it("expõe SHA do checkout apenas quando injetado e válido", () => {
    const sha = "a".repeat(40);
    vi.stubGlobal("DEPLOY_GIT_SHA", sha);
    expect(buildStatus({})).toMatchObject({ source_commit: sha });
    vi.stubGlobal("DEPLOY_GIT_SHA", "desconhecido");
    expect(buildStatus({})).not.toHaveProperty("source_commit");
  });

  it("com binding → bloco deploy com id/tag/timestamp", () => {
    const status = buildStatus({
      CF_VERSION_METADATA: { id: "abc123", tag: "", timestamp: "2026-08-06T12:00:00Z" },
    });
    expect(status).toMatchObject({
      deploy: { id: "abc123", tag: null, timestamp: "2026-08-06T12:00:00Z" },
    });
  });
});
