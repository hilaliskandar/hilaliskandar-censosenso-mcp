#!/usr/bin/env python3
"""Audita categorias metropolitanas/RIDE preservando UTF-8 de ponta a ponta.

Evitar redirecionar stdout nativo do Python com ">" no Windows PowerShell antigo:
a combinação CP1252/CP850 pode transformar "Região" em "RegiÒo", "São" em
"SÒo", "Área" em "┴rea" etc.

Uso recomendado:
    python scripts/auditar_categorias_metropolitanas.py \
        --saida categorias_metropolitanas_utf8.txt \
        --saida-json categorias_metropolitanas_utf8.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from inspecionar_fontes_recortes import baixar, carregar_fontes
from normalizar_recortes import tabela


def auditar() -> tuple[str, dict]:
    fontes = carregar_fontes()
    fonte = fontes["metropolitana"]
    _, cab, regs = tabela(baixar(fonte["url"]))

    campos = ["NOME_RECMETROPOL", "NOME_CATMETROPOL", "NOME_SUBCATMETROPOL"]
    for campo in campos:
        if campo not in cab:
            raise SystemExit(f"Coluna ausente: {campo}")

    pares_necessarios = [
        "COD_RECMETROPOL",
        "NOME_RECMETROPOL",
        "COD_CATMETROPOL",
        "NOME_CATMETROPOL",
    ]
    for campo in pares_necessarios:
        if campo not in cab:
            raise SystemExit(f"Coluna ausente: {campo}")

    linhas: list[str] = []
    saida_json: dict[str, object] = {
        "fonte_url": fonte["url"],
        "versao": fonte["versao"],
        "total_registros": len(regs),
        "campos": {},
    }

    for campo in campos:
        cont = Counter(r[campo] for r in regs)
        linhas.append(f"## {campo} — {len(cont)} valores distintos")
        for valor, n in sorted(cont.items(), key=lambda x: (x[0], x[1])):
            linhas.append(f"{n:4d} | {valor}")
        linhas.append("")
        saida_json["campos"][campo] = [
            {"valor": valor, "n": n}
            for valor, n in sorted(cont.items(), key=lambda x: (x[0], x[1]))
        ]

    pares_categoria = Counter(
        (r["COD_CATMETROPOL"], r["NOME_CATMETROPOL"]) for r in regs
    )
    linhas.append(
        f"## COD_CATMETROPOL × NOME_CATMETROPOL — "
        f"{len(pares_categoria)} pares distintos"
    )
    for (codigo, nome), n in sorted(pares_categoria.items(), key=lambda x: (x[0][0], x[0][1])):
        linhas.append(f"{n:4d} | {codigo} | {nome}")
    linhas.append("")
    saida_json["pares_categoria"] = [
        {"codigo": codigo, "nome": nome, "n": n}
        for (codigo, nome), n in sorted(
            pares_categoria.items(), key=lambda x: (x[0][0], x[0][1])
        )
    ]

    pares_recorte = Counter(
        (r["COD_RECMETROPOL"], r["NOME_RECMETROPOL"]) for r in regs
    )
    linhas.append(
        f"## COD_RECMETROPOL × NOME_RECMETROPOL — "
        f"{len(pares_recorte)} pares distintos"
    )
    for (codigo, nome), n in sorted(pares_recorte.items(), key=lambda x: (x[0][0], x[0][1])):
        linhas.append(f"{n:4d} | {codigo} | {nome}")
    linhas.append("")
    saida_json["pares_recorte"] = [
        {"codigo": codigo, "nome": nome, "n": n}
        for (codigo, nome), n in sorted(
            pares_recorte.items(), key=lambda x: (x[0][0], x[0][1])
        )
    ]

    return "\n".join(linhas), saida_json


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--saida",
        type=Path,
        help="Grava relatório textual diretamente em UTF-8, sem passar pelo redirecionamento do shell.",
    )
    parser.add_argument(
        "--saida-json",
        type=Path,
        help="Grava auditoria estruturada em JSON UTF-8.",
    )
    args = parser.parse_args()

    texto, estruturado = auditar()

    if args.saida:
        args.saida.write_text(texto + "\n", encoding="utf-8")
        print(f"Relatório UTF-8 gravado em: {args.saida}")
    else:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        print(texto)

    if args.saida_json:
        args.saida_json.write_text(
            json.dumps(estruturado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"JSON UTF-8 gravado em: {args.saida_json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
