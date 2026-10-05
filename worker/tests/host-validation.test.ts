import { describe, expect, it } from "vitest";
import { hostnamePermitido } from "../src/host-validation.js";

describe("hostnamePermitido", () => {
  it("aceita desenvolvimento local", () => {
    expect(hostnamePermitido(new Request("http://127.0.0.1:8787/mcp"))).toBe(true);
    expect(hostnamePermitido(new Request("http://localhost:8787/mcp"))).toBe(true);
  });

  it("aceita o domínio canônico", () => {
    expect(
      hostnamePermitido(new Request("https://censosenso.poderdapalavra.org/mcp")),
    ).toBe(true);
  });

  it("mantém workers.dev como fallback operacional", () => {
    expect(
      hostnamePermitido(
        new Request("https://censosenso-mcp.radar-urbano-hilaliskandar.workers.dev/mcp"),
      ),
    ).toBe(true);
  });

  it("rejeita hostname arbitrário", () => {
    expect(hostnamePermitido(new Request("https://attacker.example/mcp"))).toBe(false);
  });
});
