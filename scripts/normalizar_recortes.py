#!/usr/bin/env python3
"""
Gera snapshots JSON reproduzíveis dos recortes temáticos a partir das fontes ODS
oficiais registradas em scripts/fontes_recortes_ibge.json.

O script é de desenvolvimento. O runtime MCP consome somente os JSON gerados.

Uso:
    python scripts/normalizar_recortes.py
    python scripts/normalizar_recortes.py amazonia_legal fronteira
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

# Reutiliza o leitor ODS stdlib e o manifesto já auditados.
from inspecionar_fontes_recortes import baixar, carregar_fontes, ler_ods

ROOT = Path(__file__).resolve().parents[1]
DESTINO = ROOT / "src" / "data" / "recortes"
MODULO_TS = ROOT / "src" / "data" / "recortes-gerados.ts"


def primeira_planilha(dados: bytes) -> tuple[str, list[list[str]]]:
    planilhas = ler_ods(dados)
    if not planilhas:
        raise RuntimeError("ODS sem planilhas")
    # Nas fontes auditadas, a primeira planilha é a tabela de dados; as demais
    # são dicionários ou recortes auxiliares.
    return planilhas[0]


def tabela(dados: bytes) -> tuple[str, list[str], list[dict[str, str]]]:
    nome, linhas = primeira_planilha(dados)
    if len(linhas) < 2:
        raise RuntimeError(f"Planilha {nome!r} sem linhas de dados")
    cab = [str(x).strip() for x in linhas[0]]
    if len(cab) != len(set(cab)):
        raise RuntimeError(f"Cabeçalhos duplicados em {nome!r}: {cab}")
    regs: list[dict[str, str]] = []
    for linha in linhas[1:]:
        vals = list(linha) + [""] * max(0, len(cab) - len(linha))
        regs.append({k: str(v).strip() for k, v in zip(cab, vals)})
    return nome, cab, regs


def exigir(cab: list[str], esperados: set[str], tema: str) -> None:
    faltantes = sorted(esperados - set(cab))
    if faltantes:
        raise RuntimeError(f"{tema}: colunas ausentes: {faltantes}; recebidas={cab}")


def normalizar(tema: str, fonte: dict[str, str], dados: bytes) -> dict:
    nome_planilha, cab, regs = tabela(dados)

    esperado = fonte.get("contagem_esperada_bruta")
    if esperado is not None and len(regs) != int(esperado):
        versao = fonte["versao"]
        raise RuntimeError(
            f"{tema}: fonte retornou {len(regs)} registros; esperado para o vintage "
            f"{versao} = {esperado}"
        )

    if tema == "amazonia_legal":
        exigir(cab, {"CD_MUN", "NM_MUN", "SIGLA_UF", "AREA_TOT", "AREA_INT", "PORC_INT"}, tema)
        saida = [
            {
                "codigo_municipio": r["CD_MUN"],
                "municipio": r["NM_MUN"],
                "uf": r["SIGLA_UF"],
                "area_total_km2": r["AREA_TOT"],
                "area_no_recorte_km2": r["AREA_INT"],
                "percentual_no_recorte": r["PORC_INT"],
            }
            for r in regs
        ]
    elif tema == "costeiro":
        exigir(cab, {"CD_MUN", "NM_MUN"}, tema)
        saida = [{"codigo_municipio": r["CD_MUN"], "municipio": r["NM_MUN"]} for r in regs]
    elif tema == "semiarido":
        exigir(cab, {"CD_MUN", "NM_MUN"}, tema)
        saida = [{"codigo_municipio": r["CD_MUN"], "municipio": r["NM_MUN"]} for r in regs]
    elif tema == "fronteira":
        exigir(
            cab,
            {"CD_MUN", "NM_MUN", "SIGLA_UF", "TOCA_LIM", "AREA INT", "PORC_INT", "FAIXA_SEDE", "CID_GEMEA"},
            tema,
        )
        saida = [
            {
                "codigo_municipio": r["CD_MUN"],
                "municipio": r["NM_MUN"],
                "uf": r["SIGLA_UF"],
                "toca_limite_internacional": r["TOCA_LIM"],
                "area_no_recorte_km2": r["AREA INT"],
                "percentual_no_recorte": r["PORC_INT"],
                "sede_na_faixa": r["FAIXA_SEDE"],
                "cidade_gemea": r["CID_GEMEA"],
            }
            for r in regs
        ]
    elif tema in {"metropolitana", "ride"}:
        exigir(
            cab,
            {
                "COD_RECMETROPOL", "NOME_RECMETROPOL", "COD_CATMETROPOL",
                "NOME_CATMETROPOL", "COD_MUN", "NOME_MUN", "SIGLA_UF", "LEG", "DATA"
            },
            tema,
        )
        codigos_categoria = set(fonte.get("codigos_categoria_incluir", []))
        if not codigos_categoria:
            raise RuntimeError(
                f"{tema}: codigos_categoria_incluir não definido no manifesto; "
                "não é permitido classificar RM/RIDE por heurística textual"
            )

        selecionados = [r for r in regs if r["COD_CATMETROPOL"] in codigos_categoria]
        observados = {r["COD_CATMETROPOL"] for r in selecionados}
        ausentes = codigos_categoria - observados
        if ausentes:
            raise RuntimeError(
                f"{tema}: códigos de categoria declarados no manifesto não encontrados: "
                f"{sorted(ausentes)}"
            )

        esperado_snapshot = fonte.get("contagem_esperada_snapshot")
        if esperado_snapshot is not None and len(selecionados) != int(esperado_snapshot):
            raise RuntimeError(
                f"{tema}: classificação produziu {len(selecionados)} registros; "
                f"esperado = {esperado_snapshot}"
            )

        saida = [
            {
                "codigo_recorte": r["COD_RECMETROPOL"],
                "recorte": r["NOME_RECMETROPOL"],
                "codigo_categoria": r["COD_CATMETROPOL"],
                "categoria": r["NOME_CATMETROPOL"],
                "codigo_municipio": r["COD_MUN"],
                "municipio": r["NOME_MUN"],
                "uf": r["SIGLA_UF"],
                "legislacao": r["LEG"],
                "data": r["DATA"],
            }
            for r in selecionados
        ]
    else:
        raise RuntimeError(f"Normalizador ODS ainda não definido para {tema}")

    codigos = [r.get("codigo_municipio") for r in saida if r.get("codigo_municipio")]
    if codigos and any(len(c) != 7 or not c.isdigit() for c in codigos):
        ruins = [c for c in codigos if len(c) != 7 or not c.isdigit()][:5]
        raise RuntimeError(f"{tema}: códigos municipais inválidos: {ruins}")

    return {
        "tema": tema,
        "versao": fonte["versao"],
        "fonte_url": fonte["url"],
        "produto_url": fonte.get("produto"),
        "planilha": nome_planilha,
        "sha256_fonte": hashlib.sha256(dados).hexdigest(),
        "total_registros": len(saida),
        "registros": saida,
    }



def escrever_modulo_ts() -> None:
    snapshots = [
        json.loads(caminho.read_text(encoding="utf-8"))
        for caminho in sorted(DESTINO.glob("*.json"))
    ]
    payload = json.dumps(
        {s["tema"]: s for s in snapshots},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    conteudo = (
        "/* Arquivo gerado pelos normalizadores de recortes. Não editar manualmente. */\n"
        'import type { SnapshotRecorte } from "./recortes-snapshot.js";\n\n'
        f"export const RECORTES_GERADOS = {payload} as const satisfies "
        "Record<string, SnapshotRecorte>;\n"
    )
    MODULO_TS.write_text(conteudo, encoding="utf-8")


def main() -> int:
    fontes = carregar_fontes()
    fontes = {tema: fonte for tema, fonte in fontes.items() if fonte.get("snapshot_pronto") is True}
    parser = argparse.ArgumentParser()
    parser.add_argument("temas", nargs="*", choices=sorted(fontes))
    args = parser.parse_args()
    temas = args.temas or sorted(fontes)

    DESTINO.mkdir(parents=True, exist_ok=True)
    falhas = 0
    snapshots: list[dict] = []
    for tema in temas:
        try:
            fonte = fontes[tema]
            dados = baixar(fonte["url"])
            snapshot = normalizar(tema, fonte, dados)
            snapshots.append(snapshot)
            caminho = DESTINO / f"{tema}.json"
            caminho.write_text(
                json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"{tema}: {snapshot['total_registros']} registros -> {caminho}")
        except Exception as exc:
            falhas += 1
            print(f"ERRO {tema}: {type(exc).__name__}: {exc}", file=sys.stderr)

    if falhas == 0:
        escrever_modulo_ts()
        print(f"módulo TypeScript -> {MODULO_TS}")

    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
