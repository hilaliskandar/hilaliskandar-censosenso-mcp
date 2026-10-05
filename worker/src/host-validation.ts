import { SERVER_CONFIG } from "./config.js";

/**
 * Valida o hostname efetivo da URL da requisição contra a lista explícita
 * aceita pelo transporte MCP. Mantido em módulo puro para ser testável fora do
 * runtime Cloudflare.
 */
export function hostnamePermitido(request: Request): boolean {
  let hostname: string;
  try {
    hostname = new URL(request.url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  return SERVER_CONFIG.extraAllowedHostnames.includes(hostname);
}
