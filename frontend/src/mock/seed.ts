// Datos de demostración (100% en memoria). No hay backend ni base de datos.
// Las fechas se generan relativas a "hoy" para que la demo siempre se vea viva.

const DAY = 86400000;
const now = () => Date.now();
const daysAgo = (d: number, h = 10, m = 0) => {
  const t = new Date(now() - d * DAY);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

export const avatar = (nombre: string, apellido: string, hue = 150) => {
  const ini = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},70%,45%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},70%,30%)'/></linearGradient></defs><rect width='200' height='200' fill='url(#g)'/><text x='100' y='122' font-family='Arial,Helvetica,sans-serif' font-size='76' font-weight='700' fill='white' text-anchor='middle'>${ini}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const hueOf = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
export const foto = (n: string, a: string) => avatar(n, a, hueOf(n + a));


const NOMBRES = ['Ana','Luis','Marta','Pablo','Lucía','Hernán','Paula','Gastón','Noelia','Sebastián','Florencia','Matías','Carolina','Federico','Daniela','Maximiliano','Brenda','Leandro','Micaela','Cristian','Eugenia','Ariel','Soledad','Damián','Romina','Rodrigo','Celeste','Ignacio','Antonella','Walter','Natalia','Ramiro','Jimena','Emiliano','Gisela','Axel','Luciana','Kevin','Mariana','Lisandro'];
const APELLIDOS = ['López','Martínez','Pérez','González','Rodríguez','Sánchez','Ruiz','Flores','Benavídez','Quiroga','Aguirre','Giménez','Ponce','Moyano','Bustos','Cabrera','Villarreal','Maldonado','Funes','Ferreyra','Arce','Britos','Carrizo','Heredia','Montenegro','Olivera','Paredes','Salas','Tapia','Vera'];
const MEMB = ['gold','silver','gold','family','fms','gold_family','gold_familiar','silver'];
const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const suscData: Array<[string, string, string, string, boolean, string, string | null]> = [
  ['Martina', 'Gómez', 'martina.gomez@demo.com', '+54 351 555-0101', true, 'gold', null],
  ['Lucas', 'Fernández', 'lucas.fernandez@demo.com', '+54 351 555-0102', true, 'gold', 'limitado'],
  ['Sofía', 'Ramírez', 'sofia.ramirez@demo.com', '+54 351 555-0103', true, 'silver', null],
  ['Mateo', 'Álvarez', 'mateo.alvarez@demo.com', '+54 351 555-0104', true, 'gold_family', 'ilimitado'],
  ['Valentina', 'Torres', 'valentina.torres@demo.com', '+54 351 555-0105', true, 'gold', null],
  ['Joaquín', 'Díaz', 'joaquin.diaz@demo.com', '+54 351 555-0106', false, 'silver', null],
  ['Camila', 'Romero', 'camila.romero@demo.com', '+54 351 555-0107', true, 'fms', null],
  ['Tomás', 'Sosa', 'tomas.sosa@demo.com', '+54 351 555-0108', true, 'gold', null],
  ['Julieta', 'Acosta', 'julieta.acosta@demo.com', '+54 351 555-0109', true, 'gold_familiar', null],
  ['Nicolás', 'Medina', 'nicolas.medina@demo.com', '+54 351 555-0110', false, 'gold', null],
  ['Agustina', 'Herrera', 'agustina.herrera@demo.com', '+54 351 555-0111', true, 'family', null],
  ['Franco', 'Silva', 'franco.silva@demo.com', '+54 351 555-0112', true, 'silver', null],
];

for (let i = 12; i < 60; i++) {
  const n = NOMBRES[i % NOMBRES.length];
  const a = APELLIDOS[(i * 7) % APELLIDOS.length];
  suscData.push([n, a, `${sinAcentos(n)}.${sinAcentos(a)}${i}@demo.com`, `+54 351 555-${String(100 + i).padStart(4, '0')}`, i % 9 !== 0, MEMB[i % MEMB.length], i % 5 === 0 ? 'limitado' : i % 11 === 0 ? 'ilimitado' : null]);
}

export const suscriptores = suscData.map((s, i) => ({
  id: `susc_${i + 1}`,
  idDocumento: `DOC${30000000 + i * 137}`,
  nombre: s[0],
  apellido: s[1],
  email: s[2],
  telefono: s[3],
  foto: foto(s[0], s[1]),
  passwordChanged: true,
  habilitado: s[4],
  fechaHabilitacion: s[4] ? daysAgo(1 + ((i * 3) % 60)) : null,
  origen: i % 4 === 0 ? 'manual' : 'csv',
  sucursal: i % 3 === 0 ? 'Centro' : 'Nueva Córdoba',
  tipoMembresia: s[5],
  reglamentoInvitados: s[6],
  eliminado: false,
  eliminadoAt: null as string | null,
  createdAt: daysAgo(30 + ((i * 7) % 240)),
  updatedAt: daysAgo(i % 30),
}));

const invData: Array<[string, string, number, boolean]> = [
  ['Carla', 'Benítez', 1, true], ['Diego', 'Paz', 1, true], ['Lara', 'Ríos', 2, true],
  ['Bruno', 'Castro', 2, true], ['Emma', 'Molina', 3, true], ['Iván', 'Ortiz', 3, true],
  ['Rocío', 'Vega', 4, true], ['Santino', 'Luna', 4, true], ['Abril', 'Núñez', 5, true],
  ['Ezequiel', 'Peña', 5, true], ['Milagros', 'Cruz', 7, true], ['Gonzalo', 'Ibarra', 8, true],
  ['Pilar', 'Juárez', 9, true], ['Facundo', 'Rojas', 11, true], ['Bianca', 'Domínguez', 12, true],
  ['Ramiro', 'Soto', 1, false], ['Delfina', 'Campos', 2, true], ['Thiago', 'Ledesma', 8, true],
];

for (let i = 18; i < 90; i++) {
  invData.push([NOMBRES[(i * 3) % NOMBRES.length], APELLIDOS[(i * 5 + 2) % APELLIDOS.length], 1 + ((i * 7) % 60), i % 13 !== 0]);
}

export const invitados = invData.map((g, i) => ({
  id: `inv_${i + 1}`,
  idDocumento: `INV${40000000 + i * 211}`,
  nombre: g[0],
  apellido: g[1],
  email: `${g[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@invitado.demo`,
  telefono: `+54 9 351 555-${String(2000 + i)}`,
  fotoPerfil: foto(g[0], g[1]),
  waiverAceptado: true,
  waiverAceptadoAt: daysAgo(2 + ((i * 3) % 60)),
  suscriptor: `susc_${g[2]}`,
  activo: g[3],
  codigoBarras: `PH${String(100000 + i * 37)}`,
  codigoQR: `QRINV-${1000 + i}`,
  createdAt: daysAgo(3 + ((i * 5) % 90)),
  updatedAt: daysAgo(i % 5),
}));

const ninoData: Array<[string, string, string, number[], string]> = [
  ['Benjamín', '2018-04-12', 'Gómez', [1], 'pagado'],
  ['Olivia', '2019-09-03', 'Gómez', [1], 'pagado'],
  ['Lautaro', '2017-02-21', 'Fernández', [2], 'pagado'],
  ['Emilia', '2020-06-30', 'Ramírez', [3], 'pendiente'],
  ['Santiago', '2016-11-08', 'Álvarez', [4, 9], 'pagado'],
  ['Renata', '2019-01-17', 'Torres', [5], 'pagado'],
  ['Máximo', '2018-07-25', 'Romero', [7], 'pagado'],
  ['Isabella', '2021-03-14', 'Acosta', [9], 'pendiente'],
];

for (let i = 8; i < 40; i++) {
  const padre = 1 + ((i * 3) % 60);
  ninoData.push([NOMBRES[(i * 2) % NOMBRES.length], `20${15 + (i % 7)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 3) % 27)).padStart(2, '0')}`, suscData[padre - 1][1], i % 6 === 0 ? [padre, 1 + ((padre + 11) % 60)] : [padre], i % 5 === 0 ? 'pendiente' : 'pagado']);
}

export const ninos = ninoData.map((n, i) => ({
  id: `nino_${i + 1}`,
  nombre: n[0],
  apellido: n[2],
  fechaNacimiento: new Date(n[1]).toISOString(),
  foto: foto(n[0], n[2]),
  codigoQR: `QRNINO-${2000 + i}`,
  estadoPago: n[4],
  ultimoPago: n[4] === 'pagado' ? daysAgo(5 + i) : null,
  padreIds: n[3].map((x) => `susc_${x}`),
  createdAt: daysAgo(3 + ((i * 7) % 150)),
  updatedAt: daysAgo(i % 30),
}));

export const usuarios = [
  { id: 'user_1', username: 'admin', nombre: 'Administrador Demo', rol: 'administrador', activo: true, puedeEditarReglamento: true, createdAt: daysAgo(200), updatedAt: daysAgo(10) },
  { id: 'user_2', username: 'recepcion', nombre: 'Recepción Centro', rol: 'recepcion', activo: true, puedeEditarReglamento: false, createdAt: daysAgo(150), updatedAt: daysAgo(30) },
  { id: 'user_3', username: 'recepcion2', nombre: 'Recepción Nueva Córdoba', rol: 'recepcion', activo: true, puedeEditarReglamento: false, createdAt: daysAgo(100), updatedAt: daysAgo(15) },
  { id: 'user_5', username: 'recepcion3', nombre: 'Recepción Güemes', rol: 'recepcion', activo: true, puedeEditarReglamento: false, createdAt: daysAgo(90), updatedAt: daysAgo(9) },
  { id: 'user_6', username: 'gerente', nombre: 'Gerencia General', rol: 'administrador', activo: true, puedeEditarReglamento: true, createdAt: daysAgo(180), updatedAt: daysAgo(4) },
  { id: 'user_7', username: 'recepcion4', nombre: 'Recepción Cerro', rol: 'recepcion', activo: true, puedeEditarReglamento: false, createdAt: daysAgo(70), updatedAt: daysAgo(6) },
  { id: 'user_4', username: 'exempleado', nombre: 'Ex Empleado', rol: 'recepcion', activo: false, puedeEditarReglamento: false, createdAt: daysAgo(300), updatedAt: daysAgo(120) },
];

// Registros de ingreso de invitados (últimos 10 días)
export const registros: any[] = [];
{
  let k = 1;
  const activos = invitados.filter((i) => i.activo);
  for (let d = 0; d < 25; d++) {
    const cant = d === 0 ? 14 : 8 + ((d * 3) % 9);
    for (let j = 0; j < cant; j++) {
      const inv = activos[(d * 5 + j * 3) % activos.length];
      const permitido = (d + j) % 7 !== 3;
      registros.push({
        id: `reg_${k++}`,
        idInvitado: inv.idDocumento,
        invitado: inv.id,
        suscriptor: inv.suscriptor,
        permitido,
        motivo: permitido ? 'Ingreso permitido' : 'Suscriptor no habilitado',
        fecha: daysAgo(d, 7 + ((j * 2) % 14), (j * 11) % 60),
        createdAt: daysAgo(d),
        updatedAt: daysAgo(d),
      });
    }
  }
  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// Registros de niños (check-in / check-out). Algunos quedan "activos" hoy.
export const registrosNinos: any[] = [];
{
  let k = 1;
  for (let d = 1; d < 20; d++) {
    for (let j = 0; j < 5; j++) {
      const n = ninos[(d + j * 2) % ninos.length];
      const h = 8 + j * 2;
      registrosNinos.push({ id: `rn_${k++}`, nino: n.id, tipo: 'check_in', fecha: daysAgo(d, h, 5) });
      registrosNinos.push({ id: `rn_${k++}`, nino: n.id, tipo: 'check_out', fecha: daysAgo(d, h + 2, 0) });
    }
  }
  // Hoy: tres niños dentro de la guardería
  const hoy = new Date();
  const mk = (n: any, minAtras: number) => ({
    id: `rn_${k++}`, nino: n.id, tipo: 'check_in', fecha: new Date(hoy.getTime() - minAtras * 60000).toISOString(),
  });
  registrosNinos.push(mk(ninos[0], 95), mk(ninos[4], 40), mk(ninos[5], 12), mk(ninos[9], 70), mk(ninos[14], 25), mk(ninos[20], 55), mk(ninos[27], 8), mk(ninos[33], 110));
  registrosNinos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const logTypes: Array<[string, string]> = [
  ['login', 'Inicio de sesión'], ['validar_ingreso', 'Ingreso permitido'], ['crear_invitado', 'Invitado creado'],
  ['editar_suscriptor', 'Suscriptor editado'], ['crear_reserva', 'Reserva creada'], ['importar_csv', 'Importación de suscriptores'],
  ['eliminar_invitado', 'Invitado eliminado'], ['enviar_email', 'Credenciales enviadas por email'], ['crear_turno', 'Turno creado'],
];
export const logs: any[] = Array.from({ length: 300 }, (_, i) => {
  const [tipo, accion] = logTypes[i % logTypes.length];
  const u = usuarios[i % 3];
  return {
    id: `log_${i + 1}`,
    tipo,
    usuario: u.id,
    usuarioNombre: u.nombre,
    accion: `${accion}: ${invitados[i % invitados.length].nombre} ${invitados[i % invitados.length].apellido}`,
    detalles: `Suscriptor: ${suscriptores[i % suscriptores.length].nombre} ${suscriptores[i % suscriptores.length].apellido}`,
    metadata: null,
    fecha: daysAgo(Math.floor(i / 10), 8 + (i % 12), (i * 7) % 60),
  };
}).sort((a, b) => b.fecha.localeCompare(a.fecha));

export const importaciones = [
  { id: 'imp_1', fecha: daysAgo(3), usuario: 'user_1', nombreArchivo: 'suscriptores_octubre.xlsx', cantidadRegistros: 120, registrosExitosos: 118, registrosConError: 2, errores: ['Fila 14: email inválido', 'Fila 87: documento duplicado'], sucursal: 'Centro', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  { id: 'imp_2', fecha: daysAgo(18), usuario: 'user_1', nombreArchivo: 'suscriptores_septiembre.csv', cantidadRegistros: 95, registrosExitosos: 95, registrosConError: 0, errores: [], sucursal: 'Nueva Córdoba', createdAt: daysAgo(18), updatedAt: daysAgo(18) },
  { id: 'imp_3', fecha: daysAgo(40), usuario: 'user_2', nombreArchivo: 'altas_agosto.csv', cantidadRegistros: 60, registrosExitosos: 57, registrosConError: 3, errores: ['Fila 3: teléfono faltante'], sucursal: 'Centro', createdAt: daysAgo(40), updatedAt: daysAgo(40) },
].map((i) => ({ ...i }));
for (let k = 4; k <= 15; k++) {
  const ok = 60 + ((k * 13) % 80);
  const err = k % 3 === 0 ? 2 + (k % 4) : 0;
  importaciones.push({ id: `imp_${k}`, fecha: daysAgo(40 + k * 12), usuario: k % 2 ? 'user_1' : 'user_2', nombreArchivo: `altas_${k}.${k % 2 ? 'xlsx' : 'csv'}`, cantidadRegistros: ok + err, registrosExitosos: ok, registrosConError: err, errores: err ? ['Fila 5: email inválido', 'Fila 9: documento duplicado'] : [], sucursal: k % 2 ? 'Centro' : 'Nueva Córdoba', createdAt: daysAgo(40 + k * 12), updatedAt: daysAgo(40 + k * 12) } as any);
}

// Disponibilidad horaria de la guardería
const rango = (ini: number, fin: number) => Array.from({ length: 24 }, (_, h) => h >= ini && h <= fin);
export const guarderiaConfig = {
  disponibilidad: {
    monday: rango(8, 21), tuesday: rango(8, 21), wednesday: rango(8, 21), thursday: rango(8, 21), friday: rango(8, 21),
    saturday: rango(9, 18), sunday: rango(10, 16),
  } as Record<string, boolean[]>,
};

export const turnos: any[] = [];
export const reservas: any[] = [];
{
  const pad = (n: number) => String(n).padStart(2, '0');
  let t = 1;
  let r = 1;
  for (let d = -5; d < 30; d++) {
    const f = new Date();
    f.setDate(f.getDate() + d);
    f.setHours(0, 0, 0, 0);
    [9, 10, 12, 15, 17, 18, 19].forEach((hora, idx) => {
      const turno = { id: `turno_${t++}`, fecha: f.toISOString(), hora: `${pad(hora)}:00`, capacidad: 20, activo: true };
      turnos.push(turno);
      const n = ninos[(d + idx + 8) % ninos.length];
      const n2 = ninos[(d + idx + 3 + 8) % ninos.length];
      [n, n2].slice(0, idx % 3 === 2 ? 1 : 2).forEach((nn) => {
        if (reservas.some((x) => x.turno === turno.id && x.nino === nn.id)) return;
        reservas.push({ id: `res_${r++}`, turno: turno.id, nino: nn.id, suscriptor: nn.padreIds[0], fechaReserva: daysAgo(Math.max(0, 1 - d)) });
      });
    });
  }
}
