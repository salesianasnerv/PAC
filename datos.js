// ─── PAC · acceso a datos ───────────────────────────────────────────────────
// Dos modos con las mismas funciones:
//  · MODO PRUEBA (supabaseUrl vacío en config.js): todo se guarda en este navegador.
//  · MODO REAL: Supabase con inicio de sesión de Microsoft 365. Los permisos los impone la base de datos.
(() => {
  "use strict";
  const CFG = window.APP_CONFIG;
  const DEMO = !CFG.supabaseUrl;
  const nombreDeEmail = (e) => String(e || "").split("@")[0].split(/[._-]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
  const uuid = () => crypto.randomUUID?.() || "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  const conflicto = () => Object.assign(new Error("Otra persona ha guardado este apartado mientras lo editabas. Recarga para ver sus cambios."), { conflicto: true });

  // ══ MODO PRUEBA ═══════════════════════════════════════════════════════════
  const CLAVE = "pac_demo_v1";
  const demo = {
    _db() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(CLAVE)); } catch {}
      if (!d) d = this._inicial();
      return d;
    },
    _set(d) {
      try { localStorage.setItem(CLAVE, JSON.stringify(d)); }
      catch { throw new Error("El navegador no tiene sitio para guardar más (modo prueba). Quita alguna imagen grande."); }
    },
    _inicial() {
      const ini = window.PAC_INICIAL || { curso: { nombre: "2026/2027" }, apartados: [], roles: [] };
      const d = { cursos: [], apartados: [], versiones: [], roles: [], miembros: [], rolAp: [], admins: ["coordinacion.demo@salesianas.org"], n: 1 };
      d.cursos.push({ id: 1, nombre: ini.curso.nombre, lema: ini.curso.lema || "", subtitulo: ini.curso.subtitulo || "", estado: "abierto", activo: true });
      for (const a of ini.apartados) {
        d.apartados.push({ id: a.id, curso_id: 1, padre_id: a.padre, orden: a.orden, titulo: a.titulo, numerado: a.numerado,
          orientacion: a.orientacion || "vertical", bloques: a.bloques, estado: "pendiente", version: 1, actualizado_por: null, actualizado_nombre: null, actualizado_en: null });
      }
      (ini.roles || []).forEach((r, i) => {
        d.roles.push({ id: i + 1, nombre: r.nombre, descripcion: "", color: "#3490b0" });
        r.apartados.forEach((ap) => d.rolAp.push({ rol_id: i + 1, apartado_id: ap }));
      });
      // Para probar los permisos: una persona ficticia en el Equipo de Orientación
      const ori = d.roles.find((r) => r.nombre === "Equipo de Orientación");
      if (ori) d.miembros.push({ rol_id: ori.id, email: "orientacion.demo@salesianas.org" });
      d.n = d.roles.length + 10;
      return d;
    },
    _id(d) { return ++d.n; },
    _yo: null,
    _puede(d, apId) {
      if (d.admins.includes(this._yo)) return true;
      const mis = new Set(d.miembros.filter((m) => m.email === this._yo).map((m) => m.rol_id));
      for (let a = d.apartados.find((x) => x.id === apId); a; a = d.apartados.find((x) => x.id === a.padre_id)) {
        if (d.rolAp.some((ra) => ra.apartado_id === a.id && mis.has(ra.rol_id))) return true;
      }
      return false;
    },
    _admin(d) { if (!d.admins.includes(this._yo)) throw new Error("Solo coordinación puede hacer esto"); },

    async sesion() {
      let email = null;
      try { email = localStorage.getItem("pac_demo_yo"); } catch {}
      if (!email) return null;
      this._yo = email;
      const d = this._db(); this._set(d);
      return { email, nombre: email.startsWith("coordinacion") ? "Coordinación (prueba)" : email.startsWith("lectura") ? "Profesorado (prueba)" : nombreDeEmail(email) + " (prueba)", admin: d.admins.includes(email) };
    },
    async login(email) { try { localStorage.setItem("pac_demo_yo", email); } catch {} location.reload(); },
    async logout() { try { localStorage.removeItem("pac_demo_yo"); } catch {} location.reload(); },
    async reiniciar() { try { localStorage.removeItem(CLAVE); } catch {} location.reload(); },

    async cursos() { return this._db().cursos.slice().sort((a, b) => b.nombre.localeCompare(a.nombre)); },
    async apartados(cursoId) { return this._db().apartados.filter((a) => a.curso_id === cursoId).map((a) => ({ ...a })); },
    async roles() {
      const d = this._db();
      return d.roles.map((r) => ({ ...r, miembros: d.miembros.filter((m) => m.rol_id === r.id).map((m) => m.email).sort(),
        apartados: d.rolAp.filter((x) => x.rol_id === r.id).map((x) => x.apartado_id) })).sort((a, b) => a.nombre.localeCompare(b.nombre));
    },
    async admins() { return [...this._db().admins].sort(); },

    async guardarContenido(id, c, nombre) {
      const d = this._db(), a = d.apartados.find((x) => x.id === id);
      if (!this._puede(d, id)) throw new Error("No tienes permiso para editar este apartado");
      if (d.cursos.find((x) => x.id === a.curso_id)?.estado === "cerrado" && !d.admins.includes(this._yo)) throw new Error("El PAC de este curso está cerrado");
      if (a.version !== c.version) throw conflicto();
      d.versiones.push({ id: this._id(d), apartado_id: id, version: a.version, titulo: a.titulo, bloques: a.bloques, autor: a.actualizado_por, autor_nombre: a.actualizado_nombre, fecha: a.actualizado_en || new Date().toISOString() });
      // En el navegador hay poco sitio: se guardan solo las 8 últimas versiones de cada apartado
      const suyas = d.versiones.filter((v) => v.apartado_id === id);
      if (suyas.length > 8) { const fuera = new Set(suyas.slice(0, suyas.length - 8).map((v) => v.id)); d.versiones = d.versiones.filter((v) => !fuera.has(v.id)); }
      Object.assign(a, { bloques: c.bloques, version: a.version + 1, actualizado_por: this._yo, actualizado_nombre: nombre, actualizado_en: new Date().toISOString() });
      if (c.estado) a.estado = c.estado;
      else if (a.estado === "revisado" && !d.admins.includes(this._yo)) a.estado = "redaccion";
      this._set(d); return { ...a };
    },
    async cambiarEstado(id, estado) {
      const d = this._db(), a = d.apartados.find((x) => x.id === id);
      if (!this._puede(d, id)) throw new Error("No tienes permiso para cambiar este apartado");
      if (estado === "revisado" && !d.admins.includes(this._yo)) throw new Error("Solo coordinación puede marcar un apartado como revisado");
      a.estado = estado; this._set(d); return { ...a };
    },
    async versiones(id) { return this._db().versiones.filter((v) => v.apartado_id === id).sort((a, b) => b.id - a.id); },

    // Índice (solo coordinación)
    async crearApartado(ap) {
      const d = this._db(); this._admin(d);
      const n = { id: uuid(), numerado: true, orientacion: "vertical", bloques: [], estado: "pendiente", version: 1, actualizado_por: null, actualizado_nombre: null, actualizado_en: null, ...ap };
      d.apartados.push(n); this._set(d); return { ...n };
    },
    async actualizarApartado(id, cambios) {
      const d = this._db(); this._admin(d);
      Object.assign(d.apartados.find((x) => x.id === id), cambios); this._set(d);
    },
    async reordenar(filas) {
      const d = this._db(); this._admin(d);
      for (const f of filas) Object.assign(d.apartados.find((x) => x.id === f.id), { padre_id: f.padre_id, orden: f.orden });
      this._set(d);
    },
    async borrarApartado(id) {
      const d = this._db(); this._admin(d);
      const fuera = new Set([id]);
      let cambio = true;
      while (cambio) { cambio = false; for (const a of d.apartados) if (a.padre_id && fuera.has(a.padre_id) && !fuera.has(a.id)) { fuera.add(a.id); cambio = true; } }
      d.apartados = d.apartados.filter((a) => !fuera.has(a.id));
      d.rolAp = d.rolAp.filter((x) => !fuera.has(x.apartado_id));
      d.versiones = d.versiones.filter((v) => !fuera.has(v.apartado_id));
      this._set(d);
    },

    // Roles
    async guardarRol(r) {
      const d = this._db(); this._admin(d);
      if (d.roles.some((x) => x.nombre.toLowerCase() === r.nombre.toLowerCase() && x.id !== r.id)) throw new Error("Ya hay un rol con ese nombre");
      if (r.id) { Object.assign(d.roles.find((x) => x.id === r.id), { nombre: r.nombre, descripcion: r.descripcion || "", color: r.color || "#3490b0" }); this._set(d); return r.id; }
      const id = this._id(d); d.roles.push({ id, nombre: r.nombre, descripcion: r.descripcion || "", color: r.color || "#3490b0" }); this._set(d); return id;
    },
    async borrarRol(id) {
      const d = this._db(); this._admin(d);
      d.roles = d.roles.filter((r) => r.id !== id); d.miembros = d.miembros.filter((m) => m.rol_id !== id); d.rolAp = d.rolAp.filter((x) => x.rol_id !== id); this._set(d);
    },
    async addMiembro(rolId, email) {
      const d = this._db(); this._admin(d);
      if (d.miembros.some((m) => m.rol_id === rolId && m.email === email)) throw new Error("Esa persona ya está en el rol");
      d.miembros.push({ rol_id: rolId, email }); this._set(d);
    },
    async delMiembro(rolId, email) { const d = this._db(); this._admin(d); d.miembros = d.miembros.filter((m) => !(m.rol_id === rolId && m.email === email)); this._set(d); },
    async setRolApartado(rolId, apId, si) {
      const d = this._db(); this._admin(d);
      d.rolAp = d.rolAp.filter((x) => !(x.rol_id === rolId && x.apartado_id === apId));
      if (si) d.rolAp.push({ rol_id: rolId, apartado_id: apId });
      this._set(d);
    },

    // Coordinación
    async addAdmin(email) { const d = this._db(); this._admin(d); if (d.admins.includes(email)) throw new Error("Esa cuenta ya está en coordinación"); d.admins.push(email); this._set(d); },
    async delAdmin(email) { const d = this._db(); this._admin(d); if (email === this._yo) throw new Error("No puedes quitarte a ti"); d.admins = d.admins.filter((e) => e !== email); this._set(d); },

    // Cursos
    async guardarCurso(c) {
      const d = this._db(); this._admin(d);
      const x = d.cursos.find((y) => y.id === c.id);
      Object.assign(x, c);
      if (c.activo) d.cursos.forEach((y) => (y.activo = y.id === c.id));
      this._set(d);
    },
    async duplicarCurso(origen, nombre, copiar) {
      const d = this._db(); this._admin(d);
      if (d.cursos.some((c) => c.nombre === nombre)) throw new Error("Ya existe ese curso");
      const id = this._id(d), o = d.cursos.find((c) => c.id === origen);
      d.cursos.push({ id, nombre, lema: "", subtitulo: o.subtitulo, estado: "abierto", activo: false });
      const mapa = new Map(d.apartados.filter((a) => a.curso_id === origen).map((a) => [a.id, uuid()]));
      for (const a of d.apartados.filter((a) => a.curso_id === origen)) {
        d.apartados.push({ ...a, id: mapa.get(a.id), curso_id: id, padre_id: a.padre_id ? mapa.get(a.padre_id) : null,
          bloques: copiar ? JSON.parse(JSON.stringify(a.bloques)) : [], estado: "pendiente", version: 1, actualizado_por: null, actualizado_nombre: null, actualizado_en: null });
      }
      for (const ra of d.rolAp.filter((x) => mapa.has(x.apartado_id))) d.rolAp.push({ rol_id: ra.rol_id, apartado_id: mapa.get(ra.apartado_id) });
      this._set(d); return id;
    },
  };

  // ══ MODO REAL: Supabase + Microsoft 365 ══════════════════════════════════
  const sb = DEMO ? null : supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const ok = (r) => { if (r.error) throw r.error; return r.data; };
  const unico = (r, txt) => { if (r.error?.code === "23505") throw new Error(txt); return ok(r); };
  const COLS = "id, curso_id, padre_id, orden, titulo, numerado, orientacion, bloques, estado, version, actualizado_por, actualizado_nombre, actualizado_en";
  const real = {
    async sesion() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const u = session.user, email = (u.email || "").toLowerCase();
      if (!email.endsWith("@" + CFG.dominio)) {
        await sb.auth.signOut();
        throw new Error(`Solo se permite el acceso con cuentas @${CFG.dominio}.`);
      }
      const adm = await sb.from("pac_admin").select("email").eq("email", email).limit(1);
      return { email, nombre: u.user_metadata?.full_name || u.user_metadata?.name || nombreDeEmail(email), admin: !adm.error && adm.data.length > 0 };
    },
    async login() {
      ok(await sb.auth.signInWithOAuth({ provider: "azure", options: { scopes: "email profile", redirectTo: location.origin + location.pathname } }));
    },
    async logout() { await sb.auth.signOut(); location.reload(); },

    async cursos() { return ok(await sb.from("pac_cursos").select("*").order("nombre", { ascending: false })); },
    async apartados(cursoId) {
      const out = [];
      for (let i = 0; ; i += 500) {
        const l = ok(await sb.from("pac_apartados").select(COLS).eq("curso_id", cursoId).order("orden").range(i, i + 499));
        out.push(...l); if (l.length < 500) return out;
      }
    },
    async roles() {
      const [r, m, a] = await Promise.all([
        sb.from("pac_roles").select("*").order("nombre"), sb.from("pac_rol_miembros").select("*"), sb.from("pac_rol_apartados").select("*")]);
      const M = ok(m), A = ok(a);
      return ok(r).map((x) => ({ ...x, miembros: M.filter((y) => y.rol_id === x.id).map((y) => y.email).sort(), apartados: A.filter((y) => y.rol_id === x.id).map((y) => y.apartado_id) }));
    },
    async admins() { return ok(await sb.from("pac_admin").select("email").order("email")).map((x) => x.email); },

    async guardarContenido(id, c, nombre) {
      const cambios = { bloques: c.bloques, version: c.version, actualizado_nombre: nombre };
      if (c.estado) cambios.estado = c.estado;
      const r = await sb.from("pac_apartados").update(cambios).eq("id", id).select(COLS);
      if (r.error && (r.error.code === "P0409" || /Otra persona/.test(r.error.message))) throw conflicto();
      const l = ok(r);
      if (!l.length) throw new Error("No tienes permiso para editar este apartado");
      return l[0];
    },
    async cambiarEstado(id, estado) {
      const l = ok(await sb.from("pac_apartados").update({ estado }).eq("id", id).select(COLS));
      if (!l.length) throw new Error("No tienes permiso para cambiar este apartado");
      return l[0];
    },
    async versiones(id) { return ok(await sb.from("pac_versiones").select("*").eq("apartado_id", id).order("id", { ascending: false }).limit(60)); },

    async crearApartado(ap) { return ok(await sb.from("pac_apartados").insert(ap).select(COLS))[0]; },
    async actualizarApartado(id, cambios) { ok(await sb.from("pac_apartados").update(cambios).eq("id", id)); },
    async reordenar(filas) { for (const f of filas) ok(await sb.from("pac_apartados").update({ padre_id: f.padre_id, orden: f.orden }).eq("id", f.id)); },
    async borrarApartado(id) { ok(await sb.from("pac_apartados").delete().eq("id", id)); },

    async guardarRol(r) {
      const datos = { nombre: r.nombre, descripcion: r.descripcion || "", color: r.color || "#3490b0" };
      if (r.id) { unico(await sb.from("pac_roles").update(datos).eq("id", r.id), "Ya hay un rol con ese nombre"); return r.id; }
      return unico(await sb.from("pac_roles").insert(datos).select("id"), "Ya hay un rol con ese nombre")[0].id;
    },
    async borrarRol(id) { ok(await sb.from("pac_roles").delete().eq("id", id)); },
    async addMiembro(rolId, email) { unico(await sb.from("pac_rol_miembros").insert({ rol_id: rolId, email }), "Esa persona ya está en el rol"); },
    async delMiembro(rolId, email) { ok(await sb.from("pac_rol_miembros").delete().eq("rol_id", rolId).eq("email", email)); },
    async setRolApartado(rolId, apId, si) {
      if (si) ok(await sb.from("pac_rol_apartados").upsert({ rol_id: rolId, apartado_id: apId }));
      else ok(await sb.from("pac_rol_apartados").delete().eq("rol_id", rolId).eq("apartado_id", apId));
    },

    async addAdmin(email) { unico(await sb.from("pac_admin").insert({ email }), "Esa cuenta ya está en coordinación"); },
    async delAdmin(email) { ok(await sb.from("pac_admin").delete().eq("email", email)); },

    async guardarCurso(c) {
      const { id, ...datos } = c;
      if (datos.activo) ok(await sb.from("pac_cursos").update({ activo: false }).neq("id", id));
      ok(await sb.from("pac_cursos").update(datos).eq("id", id));
    },
    async duplicarCurso(origen, nombre, copiar) {
      const r = await sb.rpc("pac_duplicar_curso", { origen, nuevo: nombre, copiar_contenido: copiar });
      if (r.error?.code === "23505") throw new Error("Ya existe ese curso");
      return ok(r);
    },
  };

  window.PAC_DATOS = Object.assign(DEMO ? demo : real, { DEMO, nombreDeEmail, uuid });
})();
