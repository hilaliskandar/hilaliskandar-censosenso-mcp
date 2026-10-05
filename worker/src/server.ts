/**
 * Construção do McpServer para o transporte HTTP.
 *
 * A superfície de tools/resources/prompts é reutilizada do pacote pai. Enquanto
 * não houver endpoint HTTP público próprio do CensoSenso, o handshake não
 * anuncia ícone remoto.
 */

import { McpServer } from "@modelcontextprotocol/server";

import { registerAll, SERVER_INSTRUCTIONS, SERVER_VERSION } from "../../dist/server.js";
import { SERVER_CONFIG } from "./config.js";
import type { RecordUsage } from "./usage-core.js";
import { announceServedVersions } from "../../dist/discover.js";

/** Builds a fresh MCP server with the shared tool/resource/prompt surface. */
export function buildServer(record: RecordUsage = () => {}): McpServer {
  const server = new McpServer(
    {
      name: SERVER_CONFIG.name,
      version: SERVER_VERSION,
      title: SERVER_CONFIG.title,
      websiteUrl: SERVER_CONFIG.websiteUrl,
    },
    { instructions: SERVER_INSTRUCTIONS }
  );

  const encaminhar: RecordUsage = (kind, name, forma) => record(kind, name, forma);
  registerAll(server, encaminhar as Parameters<typeof registerAll>[1]);
  announceServedVersions(server);
  return server;
}
