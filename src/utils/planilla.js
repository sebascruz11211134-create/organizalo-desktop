// Cálculo de planilla para Costa Rica — única fuente de tasas para todas las
// pantallas. Revisar cada enero (la CCSS y Hacienda publican cambios).
//
// CCSS 2026 (IVM sube cada 3 años; vigente 1 ene 2026 – 31 dic 2028):
//   Trabajador 10,83% = SEM 5,50 + IVM 4,33 + Banco Popular 1,00
//   Patrono    26,83% = SEM 9,25 + IVM 5,58 + cuota BP 0,25          (CCSS 15,08)
//                     + Asignaciones Familiares 5,00 + IMAS 0,50 + INA 1,50
//                     + aporte BP 0,25 + FCL 1,50 + OPC 2,00 + INS 1,00 (LPT 11,75)
// Renta 2026: Decreto 45333-H (tramos mensuales y créditos fiscales).

export const TASAS_OBRERO = { sem: 0.055, ivm: 0.0433, bp: 0.01 };
export const TASAS_PATRONO = {
  sem: 0.0925, ivm: 0.0558, bpCuota: 0.0025,
  asignaciones: 0.05, imas: 0.005, ina: 0.015, bpAporte: 0.0025, fcl: 0.015, opc: 0.02, ins: 0.01,
};
export const TOTAL_OBRERO = 0.1083;
export const TOTAL_PATRONO = 0.2683;

export const TRAMOS_RENTA_2026 = [
  { hasta: 918000,   tasa: 0.00 },
  { hasta: 1347000,  tasa: 0.10 },
  { hasta: 2364000,  tasa: 0.15 },
  { hasta: 4727000,  tasa: 0.20 },
  { hasta: Infinity, tasa: 0.25 },
];
export const CREDITO_HIJO = 1710;     // mensual por hijo
export const CREDITO_CONYUGE = 2590;  // mensual por cónyuge

const r = n => Math.round(n);

// Salario mensual del empleado. La pantalla Empleados lo guardaba como
// "salario" y Planillas como "salarioBruto" (misma lista): se aceptan ambos.
export const salarioDe = emp => parseFloat(emp?.salarioBruto ?? emp?.salario) || 0;

// Impuesto al salario mensual: por tramos sobre el salario bruto, menos
// créditos fiscales (nunca negativo).
export function calcRenta(bruto, { hijos = 0, conyuge = false } = {}) {
  let imp = 0, prev = 0;
  for (const { hasta, tasa } of TRAMOS_RENTA_2026) {
    if (bruto <= prev) break;
    imp += (Math.min(bruto, hasta) - prev) * tasa;
    prev = hasta;
  }
  if (imp <= 0) return 0;
  const creditos = (parseInt(hijos) || 0) * CREDITO_HIJO + (conyuge ? CREDITO_CONYUGE : 0);
  return Math.max(0, r(imp - creditos));
}

export function calcNomina(emp) {
  const bruto = salarioDe(emp);
  // Trabajador: CCSS (SEM + IVM) y Banco Popular por separado; suman 10,83%.
  const ccssT = r(bruto * (TASAS_OBRERO.sem + TASAS_OBRERO.ivm));
  const bpT   = r(bruto * TASAS_OBRERO.bp);
  const renta = emp.aplicaRenta ? calcRenta(bruto, { hijos: emp.hijos, conyuge: emp.conyuge }) : 0;
  const dedTotal = ccssT + bpT + renta;

  const p = TASAS_PATRONO;
  const ccssP  = r(bruto * (p.sem + p.ivm + p.bpCuota));
  const asignP = r(bruto * p.asignaciones);
  const imasP  = r(bruto * p.imas);
  const inaP   = r(bruto * p.ina);
  const bpP    = r(bruto * p.bpAporte);
  const fclP   = r(bruto * p.fcl);
  const opcP   = r(bruto * p.opc);
  const insP   = r(bruto * p.ins);
  const patTotal = ccssP + asignP + imasP + inaP + bpP + fclP + opcP + insP;

  return {
    bruto, ccssT, bpT, renta, dedTotal, neto: bruto - dedTotal,
    ccssP, asignP, imasP, inaP, bpP, fclP, opcP, insP, patTotal,
    costoTotal: bruto + patTotal, aguinaldo: r(bruto / 12),
  };
}

// Tarifa por hora ordinaria: la del empleado si la tiene; si no, la derivada
// del salario mensual (÷ 30 días ÷ 8 horas). Antes se dividía el salario
// mensual entre 48 (horas de UNA semana): cada hora salía ~5 veces más cara.
export function tarifaHora(emp) {
  const propia = parseFloat(emp.tarifaHora);
  if (propia > 0) return propia;
  return salarioDe(emp) / 240;
}

export function calcHoras(emp, semKey, semanasData) {
  const tarifa = tarifaHora(emp);
  const get = (tipo) => Number(semanasData[`${emp.id}_${semKey}_${tipo}`] || 0);
  const hN = get("normal"), hTM = get("tm"), hD = get("doble");
  const bruto = r(hN * tarifa + hTM * tarifa * 1.5 + hD * tarifa * 2);
  return { hN, hTM, hD, tarifa, bruto };
}

// Asiento contable de la planilla del mes. Gasto = salarios brutos + cargas
// patronales. Pasivos: neto a pagar a los empleados, CCSS (obrera + patronal,
// incluye Banco Popular y LPT) y renta retenida a Hacienda.
export function lineasAsientoPlanilla(tot) {
  const lineas = [
    { cuentaCodigo: "5101", cuentaNombre: "Gasto salarios",                  debe: tot.bruto,    haber: 0 },
    { cuentaCodigo: "5102", cuentaNombre: "Cargas sociales patronales",      debe: tot.patTotal, haber: 0 },
    { cuentaCodigo: "2101", cuentaNombre: "CxP nómina — empleados (neto)",   debe: 0, haber: tot.neto },
    { cuentaCodigo: "2102", cuentaNombre: "CxP CCSS (obrera + patronal)",    debe: 0, haber: tot.ccssT + tot.bpT + tot.patTotal },
  ];
  if (tot.renta > 0) lineas.push({ cuentaCodigo: "2103", cuentaNombre: "Impuesto al salario retenido", debe: 0, haber: tot.renta });
  return lineas;
}

// Un solo asiento de planilla por mes. El id es fijo ("planilla-YYYY-MM"): si
// dos equipos confirman el mismo mes sin sincronizar, la sincronización (que
// une por id) deja uno solo. Los asientos creados antes de este cambio no
// tienen planillaMes: se reconocen por su descripción "Planilla <mes> — ...".
export const idAsientoPlanilla = mes => `planilla-${mes}`;
export function asientoPlanillaExistente(asientos, mes, etiquetaMes) {
  return asientos.find(a => a.estado !== "anulado" && (
    a.id === idAsientoPlanilla(mes) ||
    a.planillaMes === mes ||
    (!a.planillaMes && typeof a.descripcion === "string" &&
      a.descripcion.toLowerCase().startsWith(`planilla ${etiquetaMes}`.toLowerCase()))
  ));
}
