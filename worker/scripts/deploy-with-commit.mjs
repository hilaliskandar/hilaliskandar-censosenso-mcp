/**
 * Injeta no bundle o SHA do checkout efetivamente implantado.
 * Não publica informação de usuário, token ou ambiente.
 * Falha sem Git válido em vez de etiquetar um deployment com SHA presumido.
 */
import { execFileSync, spawnSync } from "node:child_process";

const root = new URL("../../", import.meta.url);
const sha = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) {
  throw new Error("Git HEAD ausente ou inválido: deploy interrompido.");
}
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) {
  throw new Error("GITHUB_SHA diverge do checkout: deploy interrompido.");
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["--no-install", "wrangler", "deploy", "--define", `DEPLOY_GIT_SHA:${JSON.stringify(sha)}`];
console.log(`Deploy CensoSenso: source_commit=${sha}`);
const result = spawnSync(executable, args, { stdio: "inherit", shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
