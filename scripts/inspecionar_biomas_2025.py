#!/usr/bin/env python3
"""Inspeciona o ZIP Shapefile oficial de Biomas 2025 sem dependências externas.

Extrai:
- lista de arquivos do ZIP;
- pares .shp/.shx/.dbf/.prj;
- conteúdo do .prj;
- cabeçalho DBF (número de registros, tamanho do header/registro);
- definição dos campos DBF;
- amostra de atributos decodificada em UTF-8/CP1252/Latin-1 de forma defensiva.

Não interpreta geometria; essa etapa vem depois da auditoria estrutural.
"""
from __future__ import annotations

import argparse
import io
import json
import struct
import sys
import urllib.request
import zipfile
from pathlib import Path

DEFAULT_URL = (
    "https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/"
    "2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip"
)


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ibge-br-mcp-lab/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def decodificar(b: bytes) -> str:
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            return b.decode(enc).rstrip(" \x00")
        except UnicodeDecodeError:
            pass
    return b.decode("latin-1", errors="replace").rstrip(" \x00")


def ler_dbf(data: bytes, amostra: int = 10) -> dict:
    if len(data) < 32:
        raise RuntimeError("DBF pequeno demais")

    nreg = struct.unpack("<I", data[4:8])[0]
    header_len = struct.unpack("<H", data[8:10])[0]
    record_len = struct.unpack("<H", data[10:12])[0]

    campos = []
    pos = 32
    while pos + 32 <= header_len and data[pos] != 0x0D:
        desc = data[pos:pos + 32]
        nome = decodificar(desc[0:11])
        tipo = chr(desc[11])
        tamanho = desc[16]
        decimais = desc[17]
        campos.append({
            "nome": nome,
            "tipo": tipo,
            "tamanho": tamanho,
            "decimais": decimais,
        })
        pos += 32

    registros = []
    base = header_len
    for i in range(min(nreg, amostra)):
        ini = base + i * record_len
        fim = ini + record_len
        if fim > len(data):
            break
        rec = data[ini:fim]
        if not rec or rec[0:1] == b"*":
            continue
        cursor = 1
        out = {}
        for campo in campos:
            raw = rec[cursor:cursor + campo["tamanho"]]
            cursor += campo["tamanho"]
            out[campo["nome"]] = decodificar(raw).strip()
        registros.append(out)

    return {
        "numero_registros": nreg,
        "tamanho_header": header_len,
        "tamanho_registro": record_len,
        "campos": campos,
        "amostra": registros,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--arquivo", type=Path, help="Usa ZIP local em vez de baixar")
    parser.add_argument("--saida", type=Path, help="Grava JSON UTF-8")
    parser.add_argument("--amostra", type=int, default=10)
    args = parser.parse_args()

    dados = args.arquivo.read_bytes() if args.arquivo else baixar(args.url)

    with zipfile.ZipFile(io.BytesIO(dados)) as z:
        nomes = z.namelist()
        bases = {}
        for nome in nomes:
            p = Path(nome)
            ext = p.suffix.lower()
            if ext in {".shp", ".shx", ".dbf", ".prj", ".cpg"}:
                bases.setdefault(str(p.with_suffix("")), set()).add(ext)

        dbfs = [n for n in nomes if n.lower().endswith(".dbf")]
        prjs = [n for n in nomes if n.lower().endswith(".prj")]
        cpgs = [n for n in nomes if n.lower().endswith(".cpg")]

        resultado = {
            "url": args.url,
            "tamanho_zip_bytes": len(dados),
            "arquivos": nomes,
            "conjuntos_shapefile": {
                base: sorted(exts) for base, exts in sorted(bases.items())
            },
            "prj": {
                nome: decodificar(z.read(nome)) for nome in prjs
            },
            "cpg": {
                nome: decodificar(z.read(nome)) for nome in cpgs
            },
            "dbf": {
                nome: ler_dbf(z.read(nome), args.amostra) for nome in dbfs
            },
        }

    texto = json.dumps(resultado, ensure_ascii=False, indent=2) + "\n"
    if args.saida:
        args.saida.write_text(texto, encoding="utf-8")
        print(f"Auditoria UTF-8 gravada em: {args.saida}")
    else:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        print(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
