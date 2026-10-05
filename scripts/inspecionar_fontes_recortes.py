#!/usr/bin/env python3
"""
Inspeciona fontes tabulares oficiais do IBGE usadas na migração de ibge_malhas_tema.

Objetivo:
- baixar arquivos ODS diretamente do GeoFTP oficial;
- ler ODS usando somente a biblioteca padrão do Python;
- mostrar nomes de planilhas e primeiras linhas não vazias;
- não alterar arquivos do projeto nem gerar snapshot definitivo nesta etapa.

Uso:
    python scripts/inspecionar_fontes_recortes.py
    python scripts/inspecionar_fontes_recortes.py amazonia_legal
    python scripts/inspecionar_fontes_recortes.py metropolitana --linhas 20

O script é ferramenta de desenvolvimento/auditoria. O servidor MCP em produção NÃO
depende de Python nem faz parsing de planilhas.
"""
from __future__ import annotations

import argparse
import io
import sys
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable
import json

NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
TABLE_NAME = f"{{{NS['table']}}}name"
ROW_REPEAT = f"{{{NS['table']}}}number-rows-repeated"
COL_REPEAT = f"{{{NS['table']}}}number-columns-repeated"


MANIFESTO = Path(__file__).with_name("fontes_recortes_ibge.json")


def carregar_fontes() -> dict[str, dict[str, str]]:
    dados = json.loads(MANIFESTO.read_text(encoding="utf-8"))
    fontes = dados.get("fontes", {})
    if not isinstance(fontes, dict):
        raise RuntimeError("Manifesto sem objeto 'fontes'")
    return {
        tema: fonte
        for tema, fonte in fontes.items()
        if isinstance(fonte, dict) and fonte.get("tipo") == "ods" and fonte.get("url")
    }

def baixar(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "ibge-br-mcp-lab/1.0 "
                "(auditoria tecnica; fonte publica oficial do IBGE)"
            )
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def texto_celula(cell: ET.Element) -> str:
    partes: list[str] = []
    for p in cell.findall(".//text:p", NS):
        txt = "".join(p.itertext()).strip()
        if txt:
            partes.append(txt)
    return " ".join(partes).strip()


def linhas_planilha(table: ET.Element) -> Iterable[list[str]]:
    for row in table.findall("table:table-row", NS):
        repeticoes_linha = min(int(row.get(ROW_REPEAT, "1")), 10000)
        valores: list[str] = []
        for cell in list(row):
            if cell.tag not in {
                f"{{{NS['table']}}}table-cell",
                f"{{{NS['table']}}}covered-table-cell",
            }:
                continue
            repeticoes_col = min(int(cell.get(COL_REPEAT, "1")), 10000)
            valor = texto_celula(cell)
            valores.extend([valor] * repeticoes_col)

        while valores and not valores[-1]:
            valores.pop()

        for _ in range(repeticoes_linha):
            yield valores.copy()


def ler_ods(dados: bytes) -> list[tuple[str, list[list[str]]]]:
    with zipfile.ZipFile(io.BytesIO(dados)) as zf:
        xml = zf.read("content.xml")
    root = ET.fromstring(xml)
    spreadsheet = root.find(".//office:spreadsheet", NS)
    if spreadsheet is None:
        raise RuntimeError("content.xml não contém office:spreadsheet")

    saida: list[tuple[str, list[list[str]]]] = []
    for table in spreadsheet.findall("table:table", NS):
        nome = table.get(TABLE_NAME, "(sem nome)")
        linhas = [row for row in linhas_planilha(table) if any(c.strip() for c in row)]
        saida.append((nome, linhas))
    return saida


def imprimir_fonte(tema: str, fonte: dict[str, str], max_linhas: int) -> None:
    print("=" * 88)
    print(f"TEMA: {tema}")
    print(f"VERSÃO: {fonte.get('versao', '-')}")
    print(f"FINALIDADE: {fonte.get('finalidade', '-')}")
    print(f"URL: {fonte['url']}")
    print("Baixando...", flush=True)
    dados = baixar(fonte["url"])
    print(f"Bytes: {len(dados):,}")
    planilhas = ler_ods(dados)
    print(f"Planilhas: {len(planilhas)}")
    for nome, linhas in planilhas:
        print(f"\n--- PLANILHA: {nome} | linhas não vazias: {len(linhas)} ---")
        for i, row in enumerate(linhas[:max_linhas], start=1):
            print(f"{i:03d}: {row}")


def main() -> int:
    fontes = carregar_fontes()
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "tema",
        nargs="?",
        choices=sorted(fontes),
        help="Inspeciona somente uma fonte ODS; omitido = todas.",
    )
    parser.add_argument("--linhas", type=int, default=12, help="Linhas por planilha.")
    args = parser.parse_args()

    selecionadas = (
        [(args.tema, fontes[args.tema])]
        if args.tema
        else list(fontes.items())
    )
    falhas = 0
    for tema, fonte in selecionadas:
        try:
            imprimir_fonte(tema, fonte, max(1, args.linhas))
        except Exception as exc:
            falhas += 1
            print(f"ERRO em {tema}: {type(exc).__name__}: {exc}", file=sys.stderr)

    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
