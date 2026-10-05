/**
 * The Worker carries the icon bytes and serves a public HTTP endpoint. The
 * STDIO/server manifest intentionally does not advertise a remote icon yet:
 * adding one is a separate MCP surface change and must never inherit the
 * origin project's infrastructure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..");

function bytesDoIcone(): Buffer {
  const fonte = readFileSync(join(raiz, "worker", "src", "icon.ts"), "utf8");
  const m = fonte.match(/ICON_PNG_BASE64\s*=\s*\n?\s*"([A-Za-z0-9+/=]+)"/);
  if (!m) throw new Error("ICON_PNG_BASE64 not found in worker/src/icon.ts");
  return Buffer.from(m[1]!, "base64");
}

function dimensoesPng(buf: Buffer): { largura: number; altura: number } {
  if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("not a PNG");
  }
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

const manifesto = (): { icons?: Array<{ src: string; mimeType?: string; sizes?: string[] }> } =>
  JSON.parse(readFileSync(join(raiz, "server.json"), "utf8")) as {
    icons?: Array<{ src: string; mimeType?: string; sizes?: string[] }>;
  };

describe("server icon: identidade CensoSenso", () => {
  it("mantém os bytes internos como PNG válido e cópia única", () => {
    expect(() => dimensoesPng(bytesDoIcone())).not.toThrow();
    expect(
      () => readFileSync(join(raiz, "assets", "icon.png")),
      "a second copy of the icon is back — worker/src/icon.ts is the single source",
    ).toThrow();
  });

  it("mantém o ícone remoto fora da superfície STDIO até mudança explícita de contrato", () => {
    expect(manifesto().icons).toBeUndefined();

    const server = readFileSync(join(raiz, "src", "server.ts"), "utf8");
    expect(server).not.toContain("ibge.sidneybissoli.com");
    expect(server).not.toMatch(/icons:\s*\[/);
  });

  it("o ativo interno continua sendo 512x512 PNG", () => {
    const { largura, altura } = dimensoesPng(bytesDoIcone());
    expect({ largura, altura }).toEqual({ largura: 512, altura: 512 });
  });

  it("the icon fits under Smithery's 1 MB ceiling", () => {
    expect(bytesDoIcone().byteLength).toBeLessThan(1024 * 1024);
  });
});
