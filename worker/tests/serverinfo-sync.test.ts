import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SERVER_CONFIG } from "../src/config.js";

const raizWorker = join(dirname(fileURLToPath(import.meta.url)), "..");
const raiz = join(raizWorker, "..");
const leia = (f: string) => readFileSync(join(raiz, f), "utf8");

const manifesto = JSON.parse(leia("server.json")) as {
  name?: string;
  title?: string;
  websiteUrl?: string;
  icons?: Array<{ src?: string }>;
};

describe("identidade do handshake, manifesto e Worker", () => {
  it("mantém o título do Worker sincronizado com server.json", () => {
    expect(manifesto.title).toBeTruthy();
    expect(SERVER_CONFIG.title).toBe(manifesto.title);
  });

  it("mantém o websiteUrl sincronizado com server.json", () => {
    expect(manifesto.websiteUrl).toBeTruthy();
    expect(SERVER_CONFIG.websiteUrl).toBe(manifesto.websiteUrl);
  });

  it("usa o nome técnico CensoSenso no Worker", () => {
    expect(SERVER_CONFIG.name).toBe("censosenso-mcp");
    expect(manifesto.name).toBe("io.github.hilaliskandar/censosenso-mcp");
  });

  it("não anuncia ícone remoto enquanto não existe endpoint público próprio", () => {
    expect(manifesto.icons).toBeUndefined();
    const workerServer = leia("worker/src/server.ts");
    expect(workerServer).not.toMatch(/icons:\s*\[/);
  });

  it("não herda domínio operacional do projeto de referência", () => {
    const material = [
      leia("worker/src/config.ts"),
      leia("worker/src/server.ts"),
      leia("worker/wrangler.jsonc"),
    ].join("\n");
    expect(material).not.toContain("ibge.sidneybissoli.com");
    expect(material).not.toContain("sbissoli76@gmail.com");
  });
});
