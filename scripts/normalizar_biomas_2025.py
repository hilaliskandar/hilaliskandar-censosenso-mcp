#!/usr/bin/env python3
"""Gera snapshot leve dos atributos do vetor oficial Biomas 2025.

Não inclui geometria. O objetivo é substituir a dependência do WFS para
atributos/listagem, preservando a geometria completa apenas como recurso externo.
"""
from __future__ import annotations

import hashlib
import io
import json
import struct
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFESTO = ROOT / "scripts" / "fontes_recortes_ibge.json"
DESTINO = ROOT / "src" / "data" / "recortes" / "biomas.json"
MODULO_TS = ROOT / "src" / "data" / "recortes-gerados.ts"


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ibge-br-mcp-lab/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def decodificar(b: bytes, encoding: str = "utf-8") -> str:
    return b.decode(encoding).rstrip(" \x00")


def ler_dbf(data: bytes, encoding: str = "utf-8") -> list[dict[str, str]]:
    nreg = struct.unpack("<I", data[4:8])[0]
    header_len = struct.unpack("<H", data[8:10])[0]
    record_len = struct.unpack("<H", data[10:12])[0]

    campos: list[tuple[str, int]] = []
    pos = 32
    while pos + 32 <= header_len and data[pos] != 0x0D:
        desc = data[pos:pos + 32]
        nome = decodificar(desc[0:11], "ascii")
        tamanho = desc[16]
        campos.append((nome, tamanho))
        pos += 32

    out: list[dict[str, str]] = []
    for i in range(nreg):
        ini = header_len + i * record_len
        rec = data[ini:ini + record_len]
        if len(rec) < record_len or rec[0:1] == b"*":
            continue
        cursor = 1
        row: dict[str, str] = {}
        for nome, tamanho in campos:
            raw = rec[cursor:cursor + tamanho]
            cursor += tamanho
            row[nome] = decodificar(raw, encoding).strip()
        out.append(row)
    return out



def escrever_modulo_ts() -> None:
    snapshots = []
    for caminho in sorted(DESTINO.parent.glob("*.json")):
        snapshots.append(json.loads(caminho.read_text(encoding="utf-8")))
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
    manifesto = json.loads(MANIFESTO.read_text(encoding="utf-8"))
    fonte = manifesto["fontes"]["biomas"]
    dados = baixar(fonte["url"])

    with zipfile.ZipFile(io.BytesIO(dados)) as z:
        base = fonte["camada_base"]
        dbf = z.read(base + ".dbf")
        cpg = z.read(base + ".cpg").decode("ascii").strip()
        prj = z.read(base + ".prj").decode("utf-8").strip()

    regs = ler_dbf(dbf, cpg)
    esperado = int(fonte["contagem_esperada_bruta"])
    if len(regs) != esperado:
        raise RuntimeError(f"biomas: {len(regs)} registros; esperado = {esperado}")

    codigos = [r["CD_BIOMA"] for r in regs]
    if len(set(codigos)) != len(codigos):
        raise RuntimeError("biomas: códigos duplicados")
    if sorted(codigos) != ["1", "2", "3", "4", "5", "6"]:
        raise RuntimeError(f"biomas: conjunto inesperado de códigos: {sorted(codigos)}")

    snapshot = {
        "tema": "biomas",
        "versao": fonte["versao"],
        "fonte_url": fonte["url"],
        "produto_url": fonte["produto"],
        "sha256_fonte": hashlib.sha256(dados).hexdigest(),
        "total_registros": len(regs),
        "crs": fonte["crs"],
        "prj": prj,
        "registros": [
            {
                "codigo_bioma": r["CD_BIOMA"],
                "bioma": r["NM_BIOMA"],
            }
            for r in regs
        ],
    }

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    escrever_modulo_ts()
    print(f"biomas: {len(regs)} registros -> {DESTINO}")
    print(f"módulo TypeScript -> {MODULO_TS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
