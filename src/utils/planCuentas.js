/**
 * planCuentas.js — Plan de Cuentas Estándar Costa Rica (NIIF PYMES)
 * Se usa como catálogo por defecto cuando la empresa no tiene uno propio.
 */

export const PLAN_DEFAULT = [
  // ── ACTIVO ──────────────────────────────────────────────────────────────────
  { codigo:"1",      nombre:"ACTIVO",                              tipo:"activo",     nivel:1, esGrupo:true  },
  { codigo:"1.1",    nombre:"Activo Circulante",                   tipo:"activo",     nivel:2, esGrupo:true  },
  { codigo:"1.1.01", nombre:"Caja",                                tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.02", nombre:"Bancos",                              tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.03", nombre:"Cuentas por cobrar clientes",         tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.04", nombre:"Otras cuentas por cobrar",            tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.05", nombre:"Inventario de mercancías",            tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.06", nombre:"Gastos pagados por adelantado",       tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.1.07", nombre:"IVA crédito fiscal",                  tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.2",    nombre:"Activo No Circulante",                tipo:"activo",     nivel:2, esGrupo:true  },
  { codigo:"1.2.01", nombre:"Propiedad, planta y equipo",          tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.2.02", nombre:"Depreciación acumulada",              tipo:"activo",     nivel:3, esGrupo:false },
  { codigo:"1.2.03", nombre:"Activos intangibles",                 tipo:"activo",     nivel:3, esGrupo:false },

  // ── PASIVO ──────────────────────────────────────────────────────────────────
  { codigo:"2",      nombre:"PASIVO",                              tipo:"pasivo",     nivel:1, esGrupo:true  },
  { codigo:"2.1",    nombre:"Pasivo Circulante",                   tipo:"pasivo",     nivel:2, esGrupo:true  },
  { codigo:"2.1.01", nombre:"Cuentas por pagar proveedores",       tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.02", nombre:"IVA por pagar",                       tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.03", nombre:"CCSS por pagar",                      tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.04", nombre:"Planilla por pagar",                  tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.05", nombre:"Impuesto sobre la renta por pagar",   tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.06", nombre:"Otras cuentas por pagar",             tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.1.07", nombre:"Préstamos bancarios corto plazo",     tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.2",    nombre:"Pasivo No Circulante",                tipo:"pasivo",     nivel:2, esGrupo:true  },
  { codigo:"2.2.01", nombre:"Préstamos bancarios largo plazo",     tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.2.02", nombre:"Provisión para aguinaldo",            tipo:"pasivo",     nivel:3, esGrupo:false },
  { codigo:"2.2.03", nombre:"Provisión para cesantía",             tipo:"pasivo",     nivel:3, esGrupo:false },

  // ── PATRIMONIO ───────────────────────────────────────────────────────────────
  { codigo:"3",      nombre:"PATRIMONIO",                          tipo:"patrimonio", nivel:1, esGrupo:true  },
  { codigo:"3.1",    nombre:"Capital social",                      tipo:"patrimonio", nivel:2, esGrupo:false },
  { codigo:"3.2",    nombre:"Utilidades retenidas",                tipo:"patrimonio", nivel:2, esGrupo:false },
  { codigo:"3.3",    nombre:"Utilidad / pérdida del período",      tipo:"patrimonio", nivel:2, esGrupo:false },
  { codigo:"3.4",    nombre:"Reservas",                            tipo:"patrimonio", nivel:2, esGrupo:false },

  // ── INGRESOS ─────────────────────────────────────────────────────────────────
  { codigo:"4",      nombre:"INGRESOS",                            tipo:"ingreso",    nivel:1, esGrupo:true  },
  { codigo:"4.1",    nombre:"Ingresos de operación",               tipo:"ingreso",    nivel:2, esGrupo:true  },
  { codigo:"4.1.01", nombre:"Ventas de mercancías",                tipo:"ingreso",    nivel:3, esGrupo:false },
  { codigo:"4.1.02", nombre:"Ingresos por servicios",              tipo:"ingreso",    nivel:3, esGrupo:false },
  { codigo:"4.1.03", nombre:"Devoluciones y descuentos en ventas", tipo:"ingreso",    nivel:3, esGrupo:false },
  { codigo:"4.2",    nombre:"Otros ingresos",                      tipo:"ingreso",    nivel:2, esGrupo:true  },
  { codigo:"4.2.01", nombre:"Intereses ganados",                   tipo:"ingreso",    nivel:3, esGrupo:false },
  { codigo:"4.2.02", nombre:"Ingresos por alquiler",               tipo:"ingreso",    nivel:3, esGrupo:false },
  { codigo:"4.2.03", nombre:"Otros ingresos no operativos",        tipo:"ingreso",    nivel:3, esGrupo:false },

  // ── COSTOS ───────────────────────────────────────────────────────────────────
  { codigo:"5",      nombre:"COSTOS",                              tipo:"costo",      nivel:1, esGrupo:true  },
  { codigo:"5.1.01", nombre:"Costo de ventas / mercancías",        tipo:"costo",      nivel:3, esGrupo:false },
  { codigo:"5.1.02", nombre:"Costo de servicios prestados",        tipo:"costo",      nivel:3, esGrupo:false },
  { codigo:"5.1.03", nombre:"Compras de mercancías",               tipo:"costo",      nivel:3, esGrupo:false },

  // ── GASTOS ───────────────────────────────────────────────────────────────────
  { codigo:"6",      nombre:"GASTOS",                              tipo:"gasto",      nivel:1, esGrupo:true  },
  { codigo:"6.1",    nombre:"Gastos de ventas",                    tipo:"gasto",      nivel:2, esGrupo:true  },
  { codigo:"6.1.01", nombre:"Salarios ventas",                     tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.1.02", nombre:"Cargas sociales ventas",              tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.1.03", nombre:"Comisiones por ventas",               tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.1.04", nombre:"Publicidad y mercadeo",               tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2",    nombre:"Gastos de administración",            tipo:"gasto",      nivel:2, esGrupo:true  },
  { codigo:"6.2.01", nombre:"Salarios administración",             tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.02", nombre:"Cargas sociales administración",      tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.03", nombre:"Alquileres",                          tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.04", nombre:"Servicios públicos (luz, agua)",      tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.05", nombre:"Comunicaciones y tecnología",         tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.06", nombre:"Seguros",                             tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.07", nombre:"Depreciaciones",                      tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.08", nombre:"Papelería y útiles",                  tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.2.09", nombre:"Honorarios profesionales",            tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.3",    nombre:"Gastos financieros",                  tipo:"gasto",      nivel:2, esGrupo:true  },
  { codigo:"6.3.01", nombre:"Intereses bancarios",                 tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.3.02", nombre:"Comisiones bancarias",                tipo:"gasto",      nivel:3, esGrupo:false },
  { codigo:"6.3.03", nombre:"Diferencial cambiario",               tipo:"gasto",      nivel:3, esGrupo:false },
];

export const TIPOS_CUENTA = ["activo","pasivo","patrimonio","ingreso","costo","gasto"];
