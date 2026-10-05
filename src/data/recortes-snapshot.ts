export type ValorRecorte = string | number | boolean | null;
export type RegistroRecorte = Record<string, ValorRecorte>;

export interface SnapshotRecorte {
  tema: string;
  versao: string;
  fonte_url: string;
  produto_url?: string;
  planilha?: string;
  crs?: string;
  prj?: string;
  sha256_fonte: string;
  total_registros: number;
  registros: RegistroRecorte[];
}

export interface ConsultaSnapshot {
  codigo?: string;
  campoCodigo?: string;
  limite?: number;
}

export interface ResultadoConsultaSnapshot {
  total: number;
  registros: RegistroRecorte[];
}

const SHA256_RE = /^[a-f0-9]{64}$/i;

export function validarSnapshot(snapshot: SnapshotRecorte): void {
  if (!snapshot.tema.trim()) throw new Error("Snapshot sem tema");
  if (!snapshot.versao.trim()) throw new Error(`Snapshot ${snapshot.tema} sem versão`);
  if (!/^https:\/\//.test(snapshot.fonte_url)) {
    throw new Error(`Snapshot ${snapshot.tema} sem URL HTTPS da fonte`);
  }
  if (!SHA256_RE.test(snapshot.sha256_fonte)) {
    throw new Error(`Snapshot ${snapshot.tema} com SHA-256 inválido`);
  }
  if (!Number.isInteger(snapshot.total_registros) || snapshot.total_registros < 0) {
    throw new Error(`Snapshot ${snapshot.tema} com total_registros inválido`);
  }
  if (snapshot.total_registros !== snapshot.registros.length) {
    throw new Error(
      `Snapshot ${snapshot.tema}: total_registros=${snapshot.total_registros} ` +
        `difere de registros.length=${snapshot.registros.length}`
    );
  }
}

export function consultarSnapshot(
  snapshot: SnapshotRecorte,
  consulta: ConsultaSnapshot = {}
): ResultadoConsultaSnapshot {
  validarSnapshot(snapshot);

  const limite = consulta.limite ?? 50;
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("limite deve ser inteiro positivo");
  }

  let registros = snapshot.registros;
  if (consulta.codigo !== undefined) {
    if (!consulta.campoCodigo) {
      throw new Error("campoCodigo é obrigatório quando codigo é informado");
    }
    const campo = consulta.campoCodigo;
    registros = registros.filter((registro) => String(registro[campo]) === consulta.codigo);
  }

  return {
    total: registros.length,
    registros: registros.slice(0, limite),
  };
}
