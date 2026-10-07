// Router de API simulado: reemplaza al servidor de la aplicación con datos en memoria.
// Todo vive en memoria; los cambios (altas, bajas, reservas, etc.) se ven en la demo hasta recargar.
import * as seed from './seed';
import { foto } from './seed';
import { APP_VERSION } from '../config/version';

type Res = { status: number; data: any };
type Ctx = { params: Record<string, string>; query: URLSearchParams; body: any };

const ok = (data: any, status = 200): Res => ({ status, data });
const fail = (status: number, error: string, extra: any = {}): Res => ({ status, data: { error, ...extra } });

const db = {
  usuarios: seed.usuarios.map((x) => ({ ...x })),
  suscriptores: seed.suscriptores.map((x) => ({ ...x })),
  invitados: seed.invitados.map((x) => ({ ...x })),
  ninos: seed.ninos.map((x) => ({ ...x })),
  registros: seed.registros.map((x) => ({ ...x })),
  registrosNinos: seed.registrosNinos.map((x) => ({ ...x })),
  logs: seed.logs.map((x) => ({ ...x })),
  importaciones: seed.importaciones.map((x) => ({ ...x })),
  turnos: seed.turnos.map((x) => ({ ...x })),
  reservas: seed.reservas.map((x) => ({ ...x })),
  config: JSON.parse(JSON.stringify(seed.guarderiaConfig)),
};

let seq = 1000;
const uid = (p: string) => `${p}_${++seq}`;
const iso = () => new Date().toISOString();
const norm = (s: any) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const has = (v: any, q: string) => norm(v).includes(norm(q));
const pad = (n: number) => String(n).padStart(2, '0');
const fechaKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const currentSuscriptorId = () => {
  try { return JSON.parse(localStorage.getItem('suscriptor') || 'null')?.id || null; } catch { return null; }
};
const currentUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

const log = (tipo: string, accion: string, detalles?: string, metadata?: any) => {
  const u = currentUser();
  db.logs.unshift({
    id: uid('log'), tipo, usuario: u?.id || null, usuarioNombre: u?.nombre || 'Sistema', accion,
    detalles: detalles || null, metadata: metadata ? JSON.stringify(metadata) : null, fecha: iso(),
  });
};

const suscById = (id: string) => db.suscriptores.find((s) => s.id === id);
const ninoById = (id: string) => db.ninos.find((n) => n.id === id);
const invById = (id: string) => db.invitados.find((i) => i.id === id);

const fmtSusc = (s: any) => ({
  ...s,
  cantidadInvitados: db.invitados.filter((i) => i.suscriptor === s.id && i.activo).length,
});
const suscMini = (s: any) => s && ({ _id: s.id, id: s.id, email: s.email, nombre: s.nombre, apellido: s.apellido, habilitado: s.habilitado });
const fmtInv = (i: any) => ({ ...i, suscriptor: suscMini(suscById(i.suscriptor)) || null });
const padresOf = (n: any) =>
  (n.padreIds || []).map(suscById).filter(Boolean).map((s: any) => ({
    id: s.id, nombre: s.nombre, apellido: s.apellido, email: s.email, telefono: s.telefono, foto: s.foto, tipoMembresia: s.tipoMembresia,
  }));
const fmtNino = (n: any) => {
  const { padreIds, ...rest } = n;
  return { ...rest, padres: padresOf(n) };
};
const ninoMini = (n: any) => ({ id: n.id, nombre: n.nombre, apellido: n.apellido, foto: n.foto, estadoPago: n.estadoPago });

const fileUrl = (f: any, fallback: string | null) => {
  if (f && typeof f !== 'string' && typeof URL !== 'undefined' && (f instanceof Blob)) return URL.createObjectURL(f);
  return typeof f === 'string' && f ? f : fallback;
};
const bool = (v: any, def = false) => (v === undefined || v === null || v === '' ? def : v === true || v === 'true');

// ---------- Turnos (slots virtuales a partir de la disponibilidad) ----------
const DAY_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const horasDelDia = (f: Date) => {
  const arr: boolean[] = db.config.disponibilidad[DAY_KEY[f.getDay()]] || [];
  return arr.map((a, i) => (a ? `${pad(i)}:00` : null)).filter(Boolean) as string[];
};
const rangoFechas = (q: URLSearchParams) => {
  const fecha = q.get('fecha');
  if (fecha) { const d = new Date(fecha); return { ini: startOfDay(d), fin: endOfDay(d) }; }
  const mes = parseInt(q.get('mes') || '', 10);
  const anio = parseInt(q.get('anio') || '', 10);
  if (mes && anio) return { ini: new Date(anio, mes - 1, 1), fin: new Date(anio, mes, 0, 23, 59, 59, 999) };
  return null;
};
const reservasDeTurno = (turnoId: string) => db.reservas.filter((r) => r.turno === turnoId);
const ninoConSusc = (r: any) => {
  const n = ninoById(r.nino)!;
  const s = suscById(r.suscriptor);
  return { id: n.id, nombre: n.nombre, apellido: n.apellido, foto: n.foto, suscriptor: s ? { id: s.id, nombre: s.nombre, apellido: s.apellido } : null, reservaId: r.id };
};

// ---------- Tabla de rutas ----------
type Handler = (c: Ctx) => Res;
const routes: Array<{ m: string; re: RegExp; keys: string[]; h: Handler }> = [];
const route = (m: string, pattern: string, h: Handler) => {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ m, re, keys, h });
};

// Auth
route('POST', '/auth/login', ({ body }) => {
  const username = String(body?.username || 'admin').trim() || 'admin';
  const u = db.usuarios.find((x) => x.username === username && x.activo) || db.usuarios[0];
  return ok({ token: 'demo-token-admin', usuario: { id: u.id, username: u.username, nombre: u.nombre, rol: u.rol, puedeEditarReglamento: u.puedeEditarReglamento } });
});
route('POST', '/auth-suscriptor/login', ({ body }) => {
  const email = String(body?.email || '').trim().toLowerCase();
  const s = db.suscriptores.find((x) => x.email === email && x.habilitado) || db.suscriptores[0];
  return ok({
    token: 'demo-token-suscriptor',
    suscriptor: { id: s.id, email: s.email, nombre: s.nombre, apellido: s.apellido, telefono: s.telefono, foto: s.foto, tipoMembresia: s.tipoMembresia },
    requiereCambioPassword: false,
  });
});
route('POST', '/auth-suscriptor/cambiar-password', () => ok({ message: 'Contraseña actualizada correctamente' }));

// Usuarios
route('GET', '/usuarios', () => ok([...db.usuarios].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
route('POST', '/usuarios', ({ body }) => {
  if (db.usuarios.some((u) => u.username === body.username)) return fail(400, 'El nombre de usuario ya existe. Por favor, elige otro.');
  const u = { id: uid('user'), username: body.username, nombre: body.nombre, rol: body.rol, activo: true, puedeEditarReglamento: !!body.puedeEditarReglamento, createdAt: iso(), updatedAt: iso() };
  db.usuarios.unshift(u);
  log('crear_usuario', `Usuario creado: ${u.nombre}`);
  return ok(u, 201);
});
route('PUT', '/usuarios/:id', ({ params, body }) => {
  const u = db.usuarios.find((x) => x.id === params.id);
  if (!u) return fail(404, 'Usuario no encontrado');
  const { password, ...rest } = body || {};
  Object.assign(u, rest, { updatedAt: iso() });
  log('editar_usuario', `Usuario editado: ${u.nombre}`);
  return ok(u);
});
route('DELETE', '/usuarios/:id', ({ params }) => {
  const u = db.usuarios.find((x) => x.id === params.id);
  if (!u) return fail(404, 'Usuario no encontrado');
  u.activo = false;
  return ok({ message: 'Usuario desactivado correctamente' });
});

// Suscriptores
route('GET', '/suscriptores/estadisticas-invitados', ({ query }) => {
  const now = new Date();
  const mes = parseInt(query.get('mes') || '') || now.getMonth() + 1;
  const anio = parseInt(query.get('anio') || '') || now.getFullYear();
  const porSusc = new Map<string, number>();
  db.registros.forEach((r) => {
    const f = new Date(r.fecha);
    if (r.permitido && r.suscriptor && f.getMonth() + 1 === mes && f.getFullYear() === anio) porSusc.set(r.suscriptor, (porSusc.get(r.suscriptor) || 0) + 1);
  });
  const datos = Array.from(porSusc.entries()).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
    const s = suscById(id)!;
    const esNuevo = s.reglamentoInvitados === 'limitado';
    return { suscriptorId: s.id, nombre: s.nombre, apellido: s.apellido, email: s.email, tipoMembresia: s.tipoMembresia, ingresosMes: n, esNuevo, limite: esNuevo ? 4 : null, reglamentoInvitados: s.reglamentoInvitados };
  });
  return ok({ mes, anio, datos });
});
route('GET', '/suscriptores/disponibles', () => ok(db.suscriptores.filter((s) => s.habilitado && !s.eliminado).map(fmtSusc)));
route('GET', '/suscriptores', ({ query }) => {
  let list = db.suscriptores.slice();
  const hab = query.get('habilitado');
  if (hab !== null && hab !== '') list = list.filter((s) => s.habilitado === (hab === 'true'));
  const origen = query.get('origen');
  if (origen) list = list.filter((s) => s.origen === origen);
  const q = query.get('busqueda');
  if (q) list = list.filter((s) => has(s.email, q) || has(s.nombre, q) || has(s.apellido, q) || has(s.telefono, q));
  list = query.get('eliminado') === 'true' ? list.filter((s) => s.eliminado) : list.filter((s) => !s.eliminado);
  return ok(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(fmtSusc));
});
route('GET', '/suscriptores/:id/detalle', ({ params }) => {
  const s = suscById(params.id);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  const registros = db.registros.filter((r) => r.suscriptor === s.id).slice(0, 50).map((r) => {
    const i = invById(r.invitado);
    return { ...r, invitadoRef: i ? { nombre: i.nombre, apellido: i.apellido, idDocumento: i.idDocumento } : null };
  });
  return ok({ suscriptor: fmtSusc(s), registros, invitados: db.invitados.filter((i) => i.suscriptor === s.id && i.activo) });
});
route('GET', '/suscriptores/:id', ({ params }) => {
  const s = suscById(params.id);
  return s ? ok(fmtSusc(s)) : fail(404, 'Suscriptor no encontrado');
});
route('POST', '/suscriptores/enviar-credenciales-masivo', ({ body }) => {
  const ids: string[] = body?.ids || body?.suscriptorIds || [];
  return ok(ids.map((id) => ({ id, success: true })));
});
route('POST', '/suscriptores/mi-foto', ({ body }) => {
  const s = suscById(currentSuscriptorId());
  const url = fileUrl(body?.foto, s?.foto || null);
  if (s) s.foto = url as string;
  return ok({ foto: url });
});
route('POST', '/suscriptores/:id/foto', ({ params, body }) => {
  const s = suscById(params.id);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  s.foto = fileUrl(body?.foto, s.foto) as string;
  return ok({ foto: s.foto });
});
route('POST', '/suscriptores/:id/enviar-credenciales', ({ params }) => {
  const s = suscById(params.id);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  log('enviar_email', `Credenciales enviadas a ${s.email}`);
  return ok({ message: 'Credenciales enviadas correctamente' });
});
route('POST', '/suscriptores/:id/cambiar-password', () => ok({ message: 'Contraseña actualizada correctamente' }));
route('POST', '/suscriptores', ({ body }) => {
  if (db.suscriptores.some((s) => s.email === body.email)) return fail(400, 'Ya existe un suscriptor con ese email');
  const s: any = {
    id: uid('susc'), idDocumento: body.idDocumento || null, nombre: body.nombre, apellido: body.apellido, email: body.email, telefono: body.telefono || null,
    foto: foto(body.nombre || 'N', body.apellido || 'N'), passwordChanged: false, habilitado: bool(body.habilitado, true), fechaHabilitacion: iso(), origen: 'manual',
    sucursal: body.sucursal || null, tipoMembresia: body.tipoMembresia || 'gold', reglamentoInvitados: body.reglamentoInvitados || null, eliminado: false, eliminadoAt: null,
    createdAt: iso(), updatedAt: iso(),
  };
  db.suscriptores.unshift(s);
  log('crear_suscriptor', `Suscriptor creado: ${s.nombre} ${s.apellido}`);
  return ok(fmtSusc(s), 201);
});
route('PUT', '/suscriptores/:id', ({ params, body }) => {
  const s = suscById(params.id);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  Object.assign(s, body, { updatedAt: iso() });
  if ('habilitado' in (body || {})) s.habilitado = bool(body.habilitado);
  log('editar_suscriptor', `Suscriptor editado: ${s.nombre} ${s.apellido}`);
  return ok(fmtSusc(s));
});
route('DELETE', '/suscriptores/:id', ({ params }) => {
  const s = suscById(params.id);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  s.eliminado = true; s.eliminadoAt = iso();
  log('eliminar_suscriptor', `Suscriptor eliminado: ${s.nombre} ${s.apellido}`);
  return ok({ message: 'Suscriptor eliminado correctamente', suscriptor: s });
});

// Invitados
route('GET', '/invitados', ({ query }) => {
  let list = db.invitados.slice();
  const susc = query.get('suscriptor');
  if (susc) list = list.filter((i) => i.suscriptor === susc);
  const qr = query.get('codigoQR');
  if (qr) list = list.filter((i) => i.codigoQR === qr);
  else {
    if (query.get('eliminado') === 'true') list = list.filter((i) => !i.activo);
    else if (query.get('activo') !== null && query.get('activo') !== '') list = list.filter((i) => i.activo === (query.get('activo') === 'true'));
    else list = list.filter((i) => i.activo);
    const q = query.get('busqueda');
    if (q) list = list.filter((i) => has(i.idDocumento, q) || has(i.nombre, q) || has(i.apellido, q) || has(i.email, q));
  }
  list.sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));
  return ok(list.map(fmtInv));
});
route('GET', '/invitados/publico/codigo-qr/:codigo', ({ params }) => {
  const i = db.invitados.find((x) => x.codigoQR === decodeURIComponent(params.codigo));
  if (!i) return fail(404, 'Código QR no encontrado. Verificá que el código QR sea correcto.');
  const s = suscById(i.suscriptor);
  return ok({ nombre: i.nombre, apellido: i.apellido, idDocumento: i.idDocumento, fotoPerfil: i.fotoPerfil, codigoQR: i.codigoQR, activo: i.activo, suscriptor: s ? { nombre: s.nombre, apellido: s.apellido } : null });
});
route('GET', '/invitados/:id', ({ params }) => {
  const i = invById(params.id);
  return i ? ok(fmtInv(i)) : fail(404, 'Invitado no encontrado');
});
route('POST', '/invitados/:id/qr-temporal', ({ params }) => {
  const i = invById(params.id);
  if (!i) return fail(404, 'Invitado no encontrado');
  const ttlSeconds = 120;
  return ok({ qrTemporal: `TMPQR-${i.id}-${Date.now()}`, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(), ttlSeconds });
});
route('POST', '/invitados/:id/enviar-email', ({ params }) => (invById(params.id) ? ok({ message: 'Email enviado correctamente' }) : fail(404, 'Invitado no encontrado')));
route('POST', '/invitados/:id/enviar-whatsapp', ({ params }) => (invById(params.id) ? ok({ message: 'WhatsApp enviado correctamente' }) : fail(404, 'Invitado no encontrado')));
route('POST', '/invitados', ({ body }) => {
  if (!bool(body.waiverAceptado)) return fail(400, 'Debes aceptar el contrato de seguro para crear el invitado');
  const suscId = body.suscriptor || currentSuscriptorId();
  const s = suscById(suscId);
  if (!s || s.eliminado) return fail(404, 'Suscriptor no encontrado o eliminado');
  const idDocumento = body.idDocumento || `INV${Math.floor(10000000 + Math.random() * 89999999)}`;
  if (db.invitados.some((i) => i.idDocumento === idDocumento && i.activo)) return fail(400, 'Ya existe un invitado activo con ese ID');
  const n = db.invitados.length + 1;
  const inv: any = {
    id: uid('inv'), idDocumento, nombre: body.nombre, apellido: body.apellido, email: body.email || null, telefono: body.telefono || null,
    fotoPerfil: fileUrl(body.fotoPerfil, foto(body.nombre || 'N', body.apellido || 'N')), waiverAceptado: true, waiverAceptadoAt: iso(), suscriptor: s.id,
    activo: bool(body.activo, true), codigoBarras: `PH${100000 + n * 37}`, codigoQR: `QRINV-${1000 + n}-${seq}`, createdAt: iso(), updatedAt: iso(),
  };
  db.invitados.unshift(inv);
  log('crear_invitado', `Invitado creado: ${inv.nombre} ${inv.apellido} (ID: ${inv.idDocumento})`, `Suscriptor: ${s.nombre} ${s.apellido}`);
  return ok(fmtInv(inv), 201);
});
route('PUT', '/invitados/:id', ({ params, body }) => {
  const i = invById(params.id);
  if (!i) return fail(404, 'Invitado no encontrado');
  const { fotoPerfil, activo, waiverAceptado, ...rest } = body || {};
  Object.assign(i, rest, { updatedAt: iso() });
  if (fotoPerfil) i.fotoPerfil = fileUrl(fotoPerfil, i.fotoPerfil) as string;
  if (activo !== undefined) i.activo = bool(activo);
  if (waiverAceptado !== undefined && bool(waiverAceptado)) i.waiverAceptado = true;
  log('editar_invitado', `Invitado editado: ${i.nombre} ${i.apellido}`);
  return ok(fmtInv(i));
});
route('DELETE', '/invitados/:id', ({ params }) => {
  const i = invById(params.id);
  if (!i) return fail(404, 'Invitado no encontrado');
  i.activo = false;
  log('eliminar_invitado', `Invitado eliminado: ${i.nombre} ${i.apellido}`);
  return ok({ message: 'Invitado eliminado correctamente', invitado: i });
});

// Kiosco de invitados
route('POST', '/registros/validar-ingreso', ({ body }) => {
  const valor = String(body?.valor || '').trim();
  const tipo = body?.tipo;
  let inv: any;
  if (tipo === 'id') inv = db.invitados.find((i) => i.idDocumento.toLowerCase() === valor.toLowerCase() && i.activo);
  else if (tipo === 'codigoBarras') inv = db.invitados.find((i) => i.codigoBarras === valor && i.activo);
  else if (valor.startsWith('TMPQR-')) inv = invById(valor.split('-')[1]);
  else inv = db.invitados.find((i) => i.codigoQR === valor && i.activo);
  const deny = (motivo: string, extra: any = {}) => {
    db.registros.unshift({ id: uid('reg'), idInvitado: inv?.idDocumento || valor, invitado: inv?.id || null, suscriptor: inv?.suscriptor || null, permitido: false, motivo, fecha: iso(), createdAt: iso(), updatedAt: iso() });
    log('validar_ingreso', `Intento de ingreso denegado: ${inv ? inv.nombre + ' ' + inv.apellido : valor}`, `Motivo: ${motivo}`);
    return ok({ permitido: false, motivo, ...extra });
  };
  if (!inv) return deny(`${tipo === 'id' ? 'ID' : 'Código QR'} no válido o invitado inactivo`);
  const invInfo = { nombre: inv.nombre, apellido: inv.apellido, idDocumento: inv.idDocumento, fotoPerfil: inv.fotoPerfil };
  const s = suscById(inv.suscriptor);
  if (!s || !s.habilitado) return deny('El suscriptor no está habilitado para hoy', { invitado: invInfo });
  if (s.reglamentoInvitados === 'limitado') {
    const now = new Date();
    const n = db.registros.filter((r) => r.permitido && r.suscriptor === s.id && new Date(r.fecha).getMonth() === now.getMonth()).length;
    if (n >= 4) return deny('Límite mensual de invitados alcanzado (4)', { invitado: invInfo });
  }
  db.registros.unshift({ id: uid('reg'), idInvitado: inv.idDocumento, invitado: inv.id, suscriptor: s.id, permitido: true, motivo: 'Ingreso permitido', fecha: iso(), createdAt: iso(), updatedAt: iso() });
  log('validar_ingreso', `Ingreso permitido: ${inv.nombre} ${inv.apellido} (ID: ${inv.idDocumento})`, `Suscriptor: ${s.nombre} ${s.apellido}`);
  return ok({ permitido: true, motivo: 'Ingreso permitido', invitado: invInfo, suscriptor: { nombre: s.nombre, apellido: s.apellido, email: s.email } });
});
route('GET', '/registros', ({ query }) => {
  let list = db.registros.slice();
  const d = query.get('fechaDesde'); if (d) list = list.filter((r) => new Date(r.fecha) >= new Date(d));
  const h = query.get('fechaHasta'); if (h) list = list.filter((r) => new Date(r.fecha) <= endOfDay(new Date(h)));
  const p = query.get('permitido'); if (p !== null && p !== '') list = list.filter((r) => r.permitido === (p === 'true'));
  const id = query.get('id'); if (id) list = list.filter((r) => r.idInvitado === id);
  const sid = query.get('suscriptorId'); if (sid) list = list.filter((r) => r.suscriptor === sid);
  list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return ok(list.slice(0, 1000).map((r) => {
    const i = invById(r.invitado); const s = suscById(r.suscriptor);
    return {
      ...r,
      invitado: i ? { nombre: i.nombre, apellido: i.apellido, idDocumento: i.idDocumento, fotoPerfil: i.fotoPerfil } : null,
      suscriptor: s ? { nombre: s.nombre, apellido: s.apellido, email: s.email, habilitado: s.habilitado, foto: s.foto } : null,
    };
  }));
});

// Niños
route('GET', '/ninos', ({ query }) => {
  let list = db.ninos.slice();
  const s = query.get('suscriptor'); if (s) list = list.filter((n) => n.padreIds.includes(s));
  const e = query.get('estadoPago'); if (e) list = list.filter((n) => n.estadoPago === e);
  const q = query.get('busqueda'); if (q) list = list.filter((n) => has(n.nombre, q) || has(n.apellido, q));
  list.sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre));
  return ok(list.map(fmtNino));
});
route('GET', '/ninos/:id', ({ params }) => {
  const n = ninoById(params.id);
  return n ? ok(fmtNino(n)) : fail(404, 'Niño no encontrado');
});
route('POST', '/ninos', ({ body }) => {
  const suscId = body.suscriptor || currentSuscriptorId();
  const s = suscById(suscId);
  if (!s) return fail(404, 'Suscriptor no encontrado');
  const existente = db.ninos.find((n) => norm(n.nombre) === norm(body.nombre) && norm(n.apellido) === norm(body.apellido) && fechaKey(n.fechaNacimiento) === fechaKey(body.fechaNacimiento));
  if (existente) {
    if (!existente.padreIds.includes(s.id)) existente.padreIds.push(s.id);
    return ok(fmtNino(existente), 200);
  }
  const n: any = {
    id: uid('nino'), nombre: body.nombre, apellido: body.apellido, fechaNacimiento: new Date(body.fechaNacimiento).toISOString(),
    foto: fileUrl(body.foto, foto(body.nombre || 'N', body.apellido || 'N')), codigoQR: `QRNINO-${2000 + db.ninos.length}-${seq}`, estadoPago: 'pagado',
    ultimoPago: iso(), padreIds: [s.id], createdAt: iso(), updatedAt: iso(),
  };
  db.ninos.unshift(n);
  log('crear_invitado', `Niño creado: ${n.nombre} ${n.apellido}`, `Suscriptor: ${s.nombre} ${s.apellido}`);
  return ok(fmtNino(n), 201);
});
route('PUT', '/ninos/:id/marcar-pagado', ({ params }) => {
  const n = ninoById(params.id);
  if (!n) return fail(404, 'Niño no encontrado');
  n.estadoPago = 'pagado'; n.ultimoPago = iso();
  return ok(fmtNino(n));
});
route('PUT', '/ninos/:id', ({ params, body }) => {
  const n = ninoById(params.id);
  if (!n) return fail(404, 'Niño no encontrado');
  const { foto: f, fechaNacimiento, suscriptor, ...rest } = body || {};
  Object.assign(n, rest, { updatedAt: iso() });
  if (fechaNacimiento) n.fechaNacimiento = new Date(fechaNacimiento).toISOString();
  if (f) n.foto = fileUrl(f, n.foto) as string;
  return ok(fmtNino(n));
});
route('DELETE', '/ninos/:id', ({ params }) => {
  const i = db.ninos.findIndex((n) => n.id === params.id);
  if (i < 0) return fail(404, 'Niño no encontrado');
  db.ninos.splice(i, 1);
  db.reservas = db.reservas.filter((r) => r.nino !== params.id);
  return ok({ message: 'Niño eliminado correctamente' });
});

// Kiosco de niños
const ninosCheckInHoy = (ninoId?: string) => {
  const hoy = startOfDay(new Date());
  return db.registrosNinos.filter((r) => r.tipo === 'check_in' && new Date(r.fecha) >= hoy && (!ninoId || r.nino === ninoId));
};
route('POST', '/ninos-kiosco/validar-ingreso', ({ body }) => {
  const codigo = String(body?.codigoQR || '').trim();
  const n = db.ninos.find((x) => x.codigoQR === codigo);
  if (!n) return { status: 404, data: { permitido: false, motivo: 'Código QR no encontrado', nino: null } };
  const hoy = startOfDay(new Date());
  const ultimo = db.registrosNinos.filter((r) => r.nino === n.id && new Date(r.fecha) >= hoy).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const tipo = ultimo && ultimo.tipo === 'check_in' ? 'check_out' : 'check_in';
  const reg = { id: uid('rn'), nino: n.id, tipo, fecha: iso() };
  db.registrosNinos.unshift(reg);
  const requierePago = tipo === 'check_in' && ninosCheckInHoy(n.id).length >= 3;
  const montoPago = requierePago ? 5 : 0;
  log('validar_ingreso', `${tipo === 'check_in' ? 'Check-in' : 'Check-out'} permitido: ${n.nombre} ${n.apellido}`);
  return ok({
    permitido: true,
    motivo: requierePago ? `Check-in exitoso — Se requiere pago de $${montoPago} USD` : tipo === 'check_in' ? 'Check-in exitoso' : 'Check-out exitoso',
    requierePago, montoPago, ninosIngresadosHoy: new Set(ninosCheckInHoy().map((r) => r.nino)).size,
    nino: { ...ninoMini(n), padres: padresOf(n) }, tipo, fecha: reg.fecha,
  });
});
route('GET', '/ninos-kiosco/publico/codigo-qr/:codigo', ({ params }) => {
  const n = db.ninos.find((x) => x.codigoQR === decodeURIComponent(params.codigo));
  return n ? ok(fmtNino(n)) : fail(404, 'Código QR no encontrado');
});

// Registros de niños
route('GET', '/registros-ninos/activos', () => {
  const ultimo = new Map<string, any>();
  [...db.registrosNinos].sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach((r) => { if (!ultimo.has(r.nino)) ultimo.set(r.nino, r); });
  const data = Array.from(ultimo.values()).filter((r) => r.tipo === 'check_in').map((r) => {
    const n = ninoById(r.nino); if (!n) return null;
    const padres = padresOf(n).map((p: any) => ({ ...p, telefono: p.telefono || null }));
    return {
      nino: ninoMini(n), registroId: r.id, checkInAt: r.fecha, minutosEnGuarderia: Math.max(0, Math.floor((Date.now() - new Date(r.fecha).getTime()) / 60000)),
      padres, telefonoRecordatorio: padres.find((p: any) => p.telefono)?.telefono || null,
    };
  }).filter(Boolean).sort((a: any, b: any) => a.checkInAt.localeCompare(b.checkInAt));
  return ok({ data, total: data.length });
});
route('POST', '/registros-ninos/:id/checkout-manual', ({ params }) => {
  const n = ninoById(params.id);
  if (!n) return fail(404, 'Niño no encontrado');
  const reg = { id: uid('rn'), nino: n.id, tipo: 'check_out', fecha: iso() };
  db.registrosNinos.unshift(reg);
  log('validar_ingreso', `Check-out manual desde admin: ${n.nombre} ${n.apellido}`);
  return ok({ message: 'Check-out manual registrado', data: { id: reg.id, tipo: reg.tipo, fecha: reg.fecha, nino: ninoMini(n) } });
});
route('GET', '/registros-ninos', ({ query }) => {
  let list = db.registrosNinos.slice();
  const d = query.get('desde'); if (d) list = list.filter((r) => new Date(r.fecha) >= startOfDay(new Date(d)));
  const h = query.get('hasta'); if (h) list = list.filter((r) => new Date(r.fecha) <= endOfDay(new Date(h)));
  const n = query.get('nino'); if (n) list = list.filter((r) => r.nino === n);
  const t = query.get('tipo'); if (t) list = list.filter((r) => r.tipo === t);
  const s = query.get('suscriptor'); if (s) list = list.filter((r) => ninoById(r.nino)?.padreIds.includes(s));
  list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const page = parseInt(query.get('page') || '1', 10);
  const limit = parseInt(query.get('limit') || '50', 10);
  const data = list.slice((page - 1) * limit, page * limit).filter((r) => ninoById(r.nino)).map((r) => {
    const nn = ninoById(r.nino)!;
    return { id: r.id, tipo: r.tipo, fecha: r.fecha, nino: { ...ninoMini(nn), padres: padresOf(nn).map((p: any) => ({ ...p, telefono: p.telefono || null })) } };
  });
  return ok({ data, total: list.length, page, limit });
});

// Turnos de guardería
route('GET', '/turnos/config', () => ok(db.config));
route('PUT', '/turnos/config', ({ body }) => {
  if (body?.disponibilidad) db.config = { disponibilidad: body.disponibilidad };
  log('configurar_guarderia', 'Configuración de guardería actualizada');
  return ok(db.config);
});
route('GET', '/turnos/admin-reservados', ({ query }) => {
  const rango = rangoFechas(query);
  if (!rango) return fail(400, 'Debe enviar fecha o mes y año');
  const incluirPasados = query.get('incluirPasados') === 'true';
  const hoy = startOfDay(new Date());
  const out = db.turnos.filter((t) => {
    const f = new Date(t.fecha);
    if (f < rango.ini || f > rango.fin) return false;
    if (!incluirPasados && startOfDay(f) < hoy) return false;
    return reservasDeTurno(t.id).length > 0;
  }).map((t) => {
    const rs = reservasDeTurno(t.id);
    return { id: t.id, fecha: fechaKey(t.fecha), hora: t.hora, capacidad: t.capacidad, cantidadNinos: rs.length, ninos: rs.map(ninoConSusc) };
  }).sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  return ok(out);
});
route('GET', '/turnos/reservas/suscriptor/:id', ({ params }) => {
  const ids = new Set(db.ninos.filter((n) => n.padreIds.includes(params.id)).map((n) => n.id));
  const out = db.reservas.filter((r) => r.suscriptor === params.id || ids.has(r.nino)).map((r) => {
    const t = db.turnos.find((x) => x.id === r.turno)!; const n = ninoById(r.nino)!;
    return { id: r.id, turno: { id: t.id, fecha: t.fecha, hora: t.hora, capacidad: t.capacidad }, nino: { id: n.id, nombre: n.nombre, apellido: n.apellido, foto: n.foto, fechaNacimiento: n.fechaNacimiento }, fechaReserva: r.fechaReserva };
  }).sort((a, b) => b.fechaReserva.localeCompare(a.fechaReserva));
  return ok(out);
});
route('POST', '/turnos/reservar', ({ body }) => {
  const payload = Array.isArray(body) ? body : [body];
  if (payload.some((p) => !p.turno || !p.nino || !p.suscriptor)) return fail(400, 'Turno, niño y suscriptor son requeridos');
  const resultados: any[] = [];
  for (const item of payload) {
    let turno = db.turnos.find((t) => t.id === item.turno);
    if (!turno && String(item.turno).startsWith('slot-')) {
      const parts = String(item.turno).replace('slot-', '').split('-');
      const hora = parts.pop() as string;
      const [y, m, d] = parts.join('-').split('-').map(Number);
      const f = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (!horasDelDia(f).includes(hora)) { resultados.push({ turno: item.turno, error: 'Horario no permitido para ese día' }); continue; }
      turno = db.turnos.find((t) => fechaKey(t.fecha) === fechaKey(f) && t.hora === hora);
      if (!turno) { turno = { id: uid('turno'), fecha: f.toISOString(), hora, capacidad: 20, activo: true }; db.turnos.push(turno); }
    }
    if (!turno) { resultados.push({ turno: item.turno, error: 'Turno no encontrado' }); continue; }
    if (startOfDay(new Date(turno.fecha)) < startOfDay(new Date())) { resultados.push({ turno: item.turno, error: 'No se pueden reservar turnos en fechas pasadas' }); continue; }
    if (reservasDeTurno(turno.id).length >= turno.capacidad) { resultados.push({ turno: item.turno, error: 'El turno está lleno' }); continue; }
    if (db.reservas.some((r) => r.turno === turno!.id && r.nino === item.nino)) { resultados.push({ turno: item.turno, error: 'El niño ya está reservado en este turno' }); continue; }
    const r = { id: uid('res'), turno: turno.id, nino: item.nino, suscriptor: item.suscriptor, fechaReserva: iso() };
    db.reservas.push(r);
    const n = ninoById(r.nino); const s = suscById(r.suscriptor);
    log('crear_reserva', `Reserva creada para ${n?.nombre} ${n?.apellido}`, `Turno: ${fechaKey(turno.fecha)} ${turno.hora}`);
    resultados.push({
      id: r.id, turno: { id: turno.id, fecha: turno.fecha, hora: turno.hora, capacidad: turno.capacidad },
      nino: n && { id: n.id, nombre: n.nombre, apellido: n.apellido, foto: n.foto }, suscriptor: s && { id: s.id, nombre: s.nombre, apellido: s.apellido }, fechaReserva: r.fechaReserva,
    });
  }
  return ok(resultados, 201);
});
route('DELETE', '/turnos/reservar/:id', ({ params }) => {
  const i = db.reservas.findIndex((r) => r.id === params.id);
  if (i < 0) return fail(404, 'Reserva no encontrada');
  db.reservas.splice(i, 1);
  log('eliminar_reserva', 'Reserva eliminada');
  return ok({ message: 'Reserva eliminada correctamente' });
});
route('GET', '/turnos', ({ query }) => {
  const rango = rangoFechas(query);
  if (!rango) return fail(400, 'Debe enviar fecha o mes y año');
  const slots: any[] = [];
  const cur = startOfDay(rango.ini);
  const end = startOfDay(rango.fin);
  while (cur <= end) {
    const key = fechaKey(cur);
    const delDia = db.turnos.filter((t) => fechaKey(t.fecha) === key);
    const horas = Array.from(new Set([...horasDelDia(cur), ...delDia.map((t) => t.hora)])).sort();
    horas.forEach((hora) => {
      const t = delDia.find((x) => x.hora === hora);
      const rs = t ? reservasDeTurno(t.id) : [];
      slots.push({ id: t?.id || `slot-${key}-${hora}`, fecha: key, hora, capacidad: t?.capacidad || 20, cantidadNinos: rs.length, ninos: rs.map(ninoConSusc) });
    });
    cur.setDate(cur.getDate() + 1);
  }
  return ok(slots);
});

// Logs
route('GET', '/logs', ({ query }) => {
  let list = db.logs.slice();
  const tipo = query.get('tipo'); if (tipo) list = list.filter((l) => l.tipo === tipo);
  const usuario = query.get('usuario'); if (usuario) list = list.filter((l) => l.usuario === usuario);
  const q = query.get('busqueda'); if (q) list = list.filter((l) => has(l.accion, q) || has(l.detalles, q) || has(l.usuarioNombre, q));
  const d = query.get('fechaDesde'); if (d) list = list.filter((l) => new Date(l.fecha) >= new Date(d));
  const h = query.get('fechaHasta'); if (h) list = list.filter((l) => new Date(l.fecha) <= endOfDay(new Date(h)));
  const page = parseInt(query.get('page') || '1', 10);
  const limit = parseInt(query.get('limit') || '100', 10);
  const logs = list.slice((page - 1) * limit, page * limit).map((l) => {
    const u = db.usuarios.find((x) => x.id === l.usuario);
    return { ...l, usuarioRef: u ? { id: u.id, nombre: u.nombre, username: u.username, rol: u.rol } : null };
  });
  return ok({ logs, pagination: { page, limit, total: list.length, totalPages: Math.max(1, Math.ceil(list.length / limit)) } });
});

// Importaciones (simuladas)
let progreso = { current: 0, total: 0, successful: 0, errors: 0 };
route('GET', '/importaciones/progress', () => {
  if (progreso.total && progreso.current < progreso.total) {
    const step = Math.max(1, Math.round(progreso.total / 6));
    progreso = { ...progreso, current: Math.min(progreso.total, progreso.current + step), successful: Math.min(progreso.total, progreso.current + step) };
  }
  return ok(progreso);
});
route('POST', '/importaciones/preview', ({ body }) => {
  const f = body?.archivo;
  const registros = Array.from({ length: 8 }, (_, i) => ({
    idDocumento: `IMP${50000000 + i * 77}`, nombre: ['Pedro', 'Ana', 'Luis', 'Marta', 'Raúl', 'Elena', 'Hugo', 'Noelia'][i], apellido: ['Quiroga', 'Bravo', 'Maldonado', 'Giménez', 'Pereyra', 'Salas', 'Navarro', 'Cabrera'][i],
    email: `socio${i + 1}@demo.com`, telefono: `+54 351 555-${3000 + i}`, habilitado: true, sucursal: 'Centro', tipoMembresia: i % 3 === 0 ? 'silver' : 'gold',
  }));
  return ok({ registros, total: 120, errores: ['Fila 14: email inválido', 'Fila 87: documento duplicado'], archivo: f?.name || 'archivo.xlsx' });
});
route('POST', '/importaciones/importar', ({ body }) => {
  progreso = { current: 0, total: 120, successful: 0, errors: 0 };
  const imp = { id: uid('imp'), fecha: iso(), usuario: currentUser()?.id || 'user_1', nombreArchivo: body?.archivo?.name || 'importacion.xlsx', cantidadRegistros: 120, registrosExitosos: 118, registrosConError: 2, errores: ['Fila 14: email inválido', 'Fila 87: documento duplicado'], sucursal: 'Centro', createdAt: iso(), updatedAt: iso() };
  db.importaciones.unshift(imp);
  log('importar_csv', `Importación: ${imp.nombreArchivo}`, 'Exitosos: 118, Errores: 2');
  const u = db.usuarios.find((x) => x.id === imp.usuario);
  return ok({ message: 'Importación completada', importacion: { id: imp.id, fecha: imp.fecha, registrosExitosos: 118, registrosConError: 2, totalRegistros: 120, errores: imp.errores, usuario: u && { nombre: u.nombre, username: u.username } } });
});
route('GET', '/importaciones', () => ok(db.importaciones.map((i) => {
  const u = db.usuarios.find((x) => x.id === i.usuario);
  return { ...i, usuario: u ? { nombre: u.nombre, username: u.username } : null };
})));

route('GET', '/version', () => ok({ version: APP_VERSION }));

// ---------- Despacho ----------
export const handleMock = (method: string, rawUrl: string, params: any, rawBody: any): Res => {
  const u = new URL(rawUrl, 'http://mock.local');
  const path = u.pathname.replace(/^\/api(?=\/)/, '');
  const query = u.searchParams;
  if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && query.set(k, String(v)));
  let body: any = rawBody;
  if (typeof FormData !== 'undefined' && rawBody instanceof FormData) {
    body = {};
    rawBody.forEach((v, k) => { body[k] = v; });
  } else if (typeof rawBody === 'string') {
    try { body = JSON.parse(rawBody); } catch { body = {}; }
  }
  const m = method.toUpperCase();
  for (const r of routes) {
    if (r.m !== m) continue;
    const match = r.re.exec(path);
    if (!match) continue;
    const p: Record<string, string> = {};
    r.keys.forEach((k, i) => { p[k] = decodeURIComponent(match[i + 1]); });
    try {
      return r.h({ params: p, query, body: body || {} });
    } catch (e: any) {
      console.error('[mock] error en', m, path, e);
      return fail(500, 'Error interno simulado');
    }
  }
  return fail(404, `Endpoint simulado no encontrado: ${m} ${path}`);
};
