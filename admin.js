// ─── PAC · coordinación: índice, roles y permisos, cursos y portada ──────────
(() => {
  "use strict";
  const { esc, ESTADOS, vacio } = window.PAC;
  const A = () => window.APP;
  const C = { sec: "indice", cont: null, rolSel: null, renombrando: null, admins: [] };

  async function ver(sec, cont) {
    C.sec = sec; C.cont = cont;
    if (sec === "roles") { try { C.admins = await A().api.admins(); } catch (e) { A().fallo(e); } }
    pintar();
  }
  function pintar() {
    if (C.sec === "roles") return roles();
    if (C.sec === "cursos") return cursos();
    return indice();
  }
  // Vuelve a leer apartados y roles (tras un cambio de coordinación)
  async function refrescar() {
    const S = A().S;
    [S.aps, S.roles] = await Promise.all([A().api.apartados(S.curso.id), A().api.roles()]);
    A().reconstruir(); A().pintarCabecera(); A().pintarArbol();
    pintar();
  }
  async function hacer(fn, ok) {
    try { await fn(); await refrescar(); if (ok) A().toast(ok); } catch (e) { A().fallo(e); }
  }

  // ════ Índice y apartados ═════════════════════════════════════════════════
  function indice() {
    const S = A().S, I = A().icono;
    const fila = (n) => {
      const roles = A().rolesDe(n.id).filter((r) => r.apartados.includes(n.id));
      const est = ESTADOS[n.estado] || ESTADOS.pendiente;
      return `<div class="est-fila nivel${Math.min(4, n.nivel)}" data-id="${n.id}">
        <span class="n">${esc(n.numero || "—")}</span>
        ${C.renombrando === n.id ? `<input class="t" data-renombrar value="${esc(n.titulo)}" aria-label="Título">`
          : `<span class="t">${esc(n.titulo)} ${roles.map((r) => `<span class="rol-chip" style="--c:${esc(r.color)}"><i></i>${esc(r.nombre)}</span>`).join(" ")} ${vacio(n.bloques) ? '<span class="tag-vacio">vacío</span>' : ""}</span>`}
        <span class="estado" style="--c:${est.color}">${est.txt}</span>
        <span class="acc">
          <button type="button" data-a="renombrar" title="Cambiar el título">${I("lapiz")}</button>
          <button type="button" data-a="subir" title="Subir">${I("arriba")}</button>
          <button type="button" data-a="bajar" title="Bajar">${I("abajo")}</button>
          <button type="button" data-a="fuera" title="Sacar un nivel (deja de ser subapartado)">${I("izq")}</button>
          <button type="button" data-a="dentro" title="Meter un nivel (pasa a ser subapartado del de arriba)">${I("der")}</button>
          <button type="button" data-a="hijo" title="Añadir un subapartado">${I("mas")}</button>
          <button type="button" data-a="numerado" class="${n.numerado ? "on" : ""}" title="${n.numerado ? "Lleva número en el índice (pulsa para quitárselo)" : "Sin número (pulsa para numerarlo)"}">Nº</button>
          <button type="button" data-a="orientacion" class="${n.orientacion === "horizontal" ? "on" : ""}" title="Páginas en horizontal en el PDF y el Word (para tablas muy anchas)">${n.orientacion === "horizontal" ? "Horiz." : "Vert."}</button>
          <button type="button" data-a="abrir" title="Abrir">${I("ojo")}</button>
          <button type="button" data-a="borrar" class="peligro" title="Borrar el apartado y lo que cuelga de él">${I("papelera")}</button>
        </span>
      </div>`;
    };
    C.cont.innerHTML = `<div class="panel"><h2>Índice y apartados · PAC ${esc(S.curso.nombre)}</h2>
      <p class="sub">La numeración se calcula sola. Cambia aquí el orden, los títulos y los niveles; el contenido lo escribe cada equipo desde su apartado.
      <b>Nº</b>: quitar el número (Presentación, Objetivos…). <b>Horiz.</b>: ese apartado sale en páginas apaisadas en el PDF y el Word.
      Los equipos que editan cada apartado se eligen en <a href="#/admin/roles">Roles y permisos</a>.</p>
      <div>${S.T.lista.map(fila).join("")}</div>
      <div class="alta-persona" style="margin-top:14px"><input id="nuevoPrincipal" placeholder="Título del nuevo apartado principal"><button type="button" class="btn primario" id="btnNuevoPrincipal">Añadir apartado principal</button></div>
    </div>`;
    C.cont.querySelector("[data-renombrar]")?.focus();
  }

  // Reordena los hermanos de un padre según la lista dada (orden 1, 2, 3…)
  const hermanos = (padreId) => A().S.T.lista.filter((x) => (x.padre_id || null) === (padreId || null));
  const filasOrden = (lista, padreId) => lista.map((x, k) => ({ id: x.id, padre_id: padreId || null, orden: k + 1 }));

  async function accionIndice(id, a) {
    const S = A().S, n = A().nodo(id);
    if (a === "renombrar") { C.renombrando = id; return indice(); }
    if (a === "abrir") return A().ir("#/ap/" + id);
    if (a === "subir" || a === "bajar") {
      const l = hermanos(n.padre_id), i = l.indexOf(n), j = i + (a === "subir" ? -1 : 1);
      if (j < 0 || j >= l.length) return;
      [l[i], l[j]] = [l[j], l[i]];
      return hacer(() => A().api.reordenar(filasOrden(l, n.padre_id)));
    }
    if (a === "fuera") {
      if (!n.padre) return A().toast("Ya es un apartado principal");
      const p = n.padre, nuevos = hermanos(p.padre_id);
      nuevos.splice(nuevos.indexOf(p) + 1, 0, n);
      const viejos = hermanos(n.padre_id).filter((x) => x !== n);
      return hacer(() => A().api.reordenar([...filasOrden(viejos, n.padre_id), ...filasOrden(nuevos, p.padre_id)]));
    }
    if (a === "dentro") {
      const l = hermanos(n.padre_id), i = l.indexOf(n);
      if (i === 0) return A().toast("No hay ningún apartado encima en el que meterlo");
      const p = l[i - 1];
      return hacer(() => A().api.reordenar([...filasOrden(l.filter((x) => x !== n), n.padre_id), { id: n.id, padre_id: p.id, orden: p.hijos.length + 1 }]));
    }
    if (a === "hijo") {
      const r = await A().dialogo(`<h2>Nuevo subapartado de «${esc(n.etiqueta)}»</h2>
        <div class="campo"><label for="tNuevo">Título</label><input id="tNuevo" required></div>
        <div class="dlg-botones"><button class="btn" value="">Cancelar</button><button class="btn primario" value="ok">Añadir</button></div>`, { alAbrir: (d) => d.querySelector("#tNuevo").focus() });
      const t = document.getElementById("tNuevo").value.trim();
      if (r !== "ok" || !t) return;
      S.abiertos.add(n.id);
      return hacer(() => A().api.crearApartado({ curso_id: S.curso.id, padre_id: n.id, orden: n.hijos.length + 1, titulo: t }), "Subapartado añadido");
    }
    if (a === "numerado") return hacer(() => A().api.actualizarApartado(id, { numerado: !n.numerado }));
    if (a === "orientacion") return hacer(() => A().api.actualizarApartado(id, { orientacion: n.orientacion === "horizontal" ? "vertical" : "horizontal" }));
    if (a === "borrar") {
      const total = window.PAC.rama(n).length;
      if (!(await A().confirmar("Borrar apartado", `Se borra <b>${esc(n.etiqueta)}</b>${total > 1 ? ` y sus ${total - 1} subapartados` : ""}, con todo su contenido e historial. No se puede deshacer.`, "Borrar", true))) return;
      return hacer(() => A().api.borrarApartado(id), "Apartado borrado");
    }
  }
  async function guardarTitulo(input) {
    const id = input.closest("[data-id]").dataset.id, t = input.value.trim();
    C.renombrando = null;
    if (!t || t === A().nodo(id).titulo) return indice();
    await hacer(() => A().api.actualizarApartado(id, { titulo: t }), "Título cambiado");
  }

  // ════ Roles y permisos ════════════════════════════════════════════════════
  function roles() {
    const S = A().S;
    const sel = C.rolSel === "coord" ? "coord" : S.roles.find((r) => r.id === C.rolSel) || null;
    C.cont.innerHTML = `<div class="panel"><h2>Roles y permisos</h2>
      <p class="sub">Todo el claustro puede <b>leer</b> el PAC. Para <b>editar</b>, una persona tiene que estar en un rol (equipo) que tenga asignado el apartado:
      el rol edita esos apartados y todo lo que cuelga de ellos. <b>Coordinación</b> lo puede hacer todo.</p>
      <div class="roles">
        <div>
          <div class="roles-lista">
            <button type="button" class="rol-item${sel === "coord" ? " activo" : ""}" data-rol="coord" style="--c:#ee712a"><i></i><span><b>Coordinación del PAC</b><small>${C.admins.length} cuentas · lo edita todo</small></span></button>
            ${S.roles.map((r) => `<button type="button" class="rol-item${sel && sel.id === r.id ? " activo" : ""}" data-rol="${r.id}" style="--c:${esc(r.color)}"><i></i><span>${esc(r.nombre)}<small>${r.miembros.length} ${r.miembros.length === 1 ? "persona" : "personas"} · ${r.apartados.length} ${r.apartados.length === 1 ? "apartado" : "apartados"}</small></span></button>`).join("")}
          </div>
          <button type="button" class="btn primario" id="btnNuevoRol" style="margin-top:10px;width:100%">+ Nuevo rol</button>
        </div>
        <div>${sel === "coord" ? coordinacion() : sel ? rolEd(sel) : '<p class="mini">Elige un rol de la lista para ver quién está y qué apartados edita, o crea uno nuevo.</p>'}</div>
      </div></div>`;
  }
  const personas = (lista, attr) => `<div class="personas">${lista.map((e) => `<span class="persona">${esc(e)}<button type="button" ${attr}="${esc(e)}" title="Quitar">×</button></span>`).join("") || '<span class="mini">Nadie todavía.</span>'}</div>`;
  const altaPersona = (id) => `<div class="alta-persona"><input id="${id}" placeholder="nombre.apellido@salesianas.org (puedes pegar varios)"><button type="button" class="btn primario" data-alta="${id}">Añadir</button></div>`;
  function coordinacion() {
    return `<h3 style="margin-top:0">Coordinación del PAC</h3>
      <p class="mini">Estas cuentas cambian el índice, los roles y los cursos, editan cualquier apartado y marcan los apartados como revisados.</p>
      ${personas(C.admins, "data-quitar-admin")}${altaPersona("altaAdmin")}`;
  }
  function rolEd(r) {
    const S = A().S;
    const incluidos = new Set(r.apartados);
    const heredado = (n) => { for (let p = n.padre; p; p = p.padre) if (incluidos.has(p.id)) return true; return false; };
    return `<div class="campos">
        <label class="campo">Nombre del rol<input id="rolNombre" value="${esc(r.nombre)}"></label>
        <label class="campo">Color<input id="rolColor" type="color" value="${esc(r.color || "#3490b0")}" style="height:42px;padding:4px"></label>
      </div>
      <label class="campo" style="margin-top:10px">Descripción (opcional)<textarea id="rolDesc">${esc(r.descripcion || "")}</textarea></label>
      <div class="acciones" style="display:flex;gap:8px;margin:10px 0"><button type="button" class="btn primario" id="btnGuardarRol">Guardar nombre y color</button><button type="button" class="btn peligro" id="btnBorrarRol">Borrar rol</button></div>
      <h3>Personas</h3>${personas(r.miembros, "data-quitar")}${altaPersona("altaMiembro")}
      <h3>Apartados que edita <span class="mini" style="text-transform:none;letter-spacing:0">(PAC ${esc(S.curso.nombre)})</span></h3>
      <ul class="arbol-check">${S.T.lista.map((n) => {
        const h = heredado(n);
        return `<li><label class="${h ? "heredado" : ""}" style="padding-left:${(n.nivel - 1) * 20 + 6}px"><input type="checkbox" data-ap-rol="${n.id}"${incluidos.has(n.id) || h ? " checked" : ""}${h ? " disabled" : ""}>
          <span class="n">${esc(n.numero)}</span><span>${esc(n.titulo)}${h ? ' <span class="mini">(incluido)</span>' : ""}</span></label></li>`;
      }).join("")}</ul>`;
  }
  // "ana.perez, luis@salesianas.org" → ["ana.perez@salesianas.org", "luis@salesianas.org"]
  function correos(txt) {
    const dom = A().CFG.dominio;
    const l = String(txt).toLowerCase().split(/[\s,;]+/).map((x) => x.replace(/^<|>$/g, "")).filter(Boolean).map((x) => (x.includes("@") ? x : x + "@" + dom));
    const malos = l.filter((x) => !x.endsWith("@" + dom) || !/^[^@\s]+@[^@\s]+$/.test(x));
    if (malos.length) throw new Error(`Solo cuentas @${dom}: revisa ${malos.join(", ")}`);
    return [...new Set(l)];
  }

  // ════ Cursos y portada ════════════════════════════════════════════════════
  function cursos() {
    const S = A().S;
    C.cont.innerHTML = `<div class="panel"><h2>Cursos y portada</h2>
      <p class="sub">Cada curso tiene su PAC. Al empezar el curso, crea el nuevo a partir del anterior: se copian el índice, los equipos asignados y, si quieres, el contenido como punto de partida.
      Un PAC <b>cerrado</b> queda en solo lectura (salvo para coordinación). El <b>curso actual</b> es el que se abre al entrar.</p>
      <div class="cursos">${S.cursos.map((c) => `<div class="curso${c.activo ? " actual" : ""}" data-curso="${c.id}">
        <div class="curso-cab"><h3>PAC ${esc(c.nombre)} ${c.activo ? '<span class="rol-etq" style="background:#ee712a">Curso actual</span>' : ""} ${c.estado === "cerrado" ? '<span class="tag-vacio">Cerrado</span>' : ""}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${c.id !== S.curso.id ? '<button type="button" class="btn" data-c="abrir">Abrir este PAC</button>' : ""}
            ${!c.activo ? '<button type="button" class="btn" data-c="actual">Marcar como actual</button>' : ""}
            <button type="button" class="btn" data-c="estado">${c.estado === "cerrado" ? "Reabrir" : "Cerrar (solo lectura)"}</button>
            <button type="button" class="btn primario" data-c="duplicar">Nuevo curso a partir de este</button>
          </div></div>
        <div class="campos">
          <label class="campo">Lema del curso (portada)<input data-campo-curso="lema" value="${esc(c.lema || "")}"></label>
          <label class="campo">Subtítulo de la portada<input data-campo-curso="subtitulo" value="${esc(c.subtitulo || "")}"></label>
        </div>
        <button type="button" class="btn" data-c="guardar" style="margin-top:10px">Guardar portada</button>
      </div>`).join("")}</div></div>`;
  }
  const siguiente = (nombre) => { const m = /^(\d{4})\D+(\d{4})$/.exec(nombre || ""); return m ? `${+m[1] + 1}/${+m[2] + 1}` : ""; };
  async function accionCurso(id, a, caja) {
    const S = A().S, c = S.cursos.find((x) => x.id === id);
    try {
      if (a === "abrir") { try { localStorage.setItem("pac_curso", id); } catch {} await A().cargar(id); return A().ir("#/admin/cursos"); }
      if (a === "actual") await A().api.guardarCurso({ id, activo: true });
      if (a === "estado") {
        const cerrar = c.estado !== "cerrado";
        if (cerrar && !(await A().confirmar("Cerrar el PAC " + c.nombre, "Quedará en solo lectura para todo el claustro. Coordinación podrá seguir cambiándolo y reabrirlo.", "Cerrar"))) return;
        await A().api.guardarCurso({ id, estado: cerrar ? "cerrado" : "abierto" });
      }
      if (a === "guardar") {
        const datos = { id };
        caja.querySelectorAll("[data-campo-curso]").forEach((i) => (datos[i.dataset.campoCurso] = i.value.trim()));
        await A().api.guardarCurso(datos); A().toast("Portada guardada");
      }
      if (a === "duplicar") {
        const r = await A().dialogo(`<h2>Nuevo PAC a partir del ${esc(c.nombre)}</h2>
          <p class="sub">Se copian el índice y los equipos asignados a cada apartado. Todos los apartados empiezan como «Pendiente».</p>
          <div class="campo"><label for="nCurso">Curso</label><input id="nCurso" value="${esc(siguiente(c.nombre))}" placeholder="2027/2028"></div>
          <label class="check" style="margin-top:12px"><input type="checkbox" id="nCopiar" checked> Copiar también el contenido (para actualizarlo en lugar de empezar de cero)</label>
          <div class="dlg-botones"><button class="btn" value="">Cancelar</button><button class="btn primario" value="ok">Crear</button></div>`);
        const nombre = document.getElementById("nCurso").value.trim(), copiar = document.getElementById("nCopiar").checked;
        if (r !== "ok" || !nombre) return;
        A().trabajando(true, "Creando el PAC " + nombre + "…");
        try { const nuevo = await A().api.duplicarCurso(id, nombre, copiar); try { localStorage.setItem("pac_curso", nuevo); } catch {} await A().cargar(nuevo); }
        finally { A().trabajando(false); }
        A().toast("PAC " + nombre + " creado"); return cursos();
      }
      await A().cargar(S.curso.id); cursos();
    } catch (e) { A().fallo(e); }
  }

  // ─── Eventos ──────────────────────────────────────────────────────────────
  document.getElementById("vAdmin").addEventListener("click", async (e) => {
    const S = A().S, t = e.target;
    // Índice
    const ai = t.closest("[data-a]");
    if (ai) return accionIndice(ai.closest("[data-id]").dataset.id, ai.dataset.a);
    if (t.closest("#btnNuevoPrincipal")) {
      const inp = document.getElementById("nuevoPrincipal"), tt = inp.value.trim();
      if (!tt) return inp.focus();
      return hacer(() => A().api.crearApartado({ curso_id: S.curso.id, padre_id: null, orden: S.T.raiz.length + 1, titulo: tt }), "Apartado añadido");
    }
    // Roles
    const ri = t.closest("[data-rol]");
    if (ri) { C.rolSel = ri.dataset.rol === "coord" ? "coord" : Number(ri.dataset.rol); return roles(); }
    if (t.closest("#btnNuevoRol")) {
      const r = await A().dialogo(`<h2>Nuevo rol</h2><p class="sub">Por ejemplo, un equipo, un departamento o una etapa.</p>
        <div class="campo"><label for="nRol">Nombre</label><input id="nRol"></div>
        <div class="dlg-botones"><button class="btn" value="">Cancelar</button><button class="btn primario" value="ok">Crear</button></div>`, { alAbrir: (d) => d.querySelector("#nRol").focus() });
      const nombre = document.getElementById("nRol").value.trim();
      if (r !== "ok" || !nombre) return;
      try { C.rolSel = await A().api.guardarRol({ nombre }); await refrescar(); } catch (err) { A().fallo(err); }
      return;
    }
    const rol = S.roles.find((r) => r.id === C.rolSel);
    if (t.closest("#btnGuardarRol")) {
      const nombre = document.getElementById("rolNombre").value.trim();
      if (!nombre) return A().toast("El rol necesita un nombre");
      return hacer(() => A().api.guardarRol({ id: rol.id, nombre, color: document.getElementById("rolColor").value, descripcion: document.getElementById("rolDesc").value.trim() }), "Rol guardado");
    }
    if (t.closest("#btnBorrarRol")) {
      if (!(await A().confirmar("Borrar el rol", `Las ${rol.miembros.length} personas de «${esc(rol.nombre)}» dejarán de poder editar sus apartados (el contenido no se borra).`, "Borrar rol", true))) return;
      C.rolSel = null; return hacer(() => A().api.borrarRol(rol.id), "Rol borrado");
    }
    const alta = t.closest("[data-alta]");
    if (alta) {
      const inp = document.getElementById(alta.dataset.alta);
      try {
        const l = correos(inp.value); if (!l.length) return inp.focus();
        for (const em of l) {
          if (alta.dataset.alta === "altaAdmin") { if (!C.admins.includes(em)) await A().api.addAdmin(em); }
          else if (!rol.miembros.includes(em)) await A().api.addMiembro(rol.id, em);
        }
        if (alta.dataset.alta === "altaAdmin") C.admins = await A().api.admins();
        await refrescar(); A().toast(l.length === 1 ? "Añadida " + l[0] : `Añadidas ${l.length} personas`);
      } catch (err) { A().fallo(err); }
      return;
    }
    const q = t.closest("[data-quitar]");
    if (q) return hacer(() => A().api.delMiembro(rol.id, q.dataset.quitar));
    const qa = t.closest("[data-quitar-admin]");
    if (qa) {
      if (qa.dataset.quitarAdmin === S.user.email) return A().toast("No puedes quitarte a ti");
      try { await A().api.delAdmin(qa.dataset.quitarAdmin); C.admins = await A().api.admins(); roles(); } catch (err) { A().fallo(err); }
      return;
    }
    // Cursos
    const cc = t.closest("[data-c]");
    if (cc) { const caja = cc.closest("[data-curso]"); return accionCurso(Number(caja.dataset.curso), cc.dataset.c, caja); }
  });
  document.getElementById("vAdmin").addEventListener("change", async (e) => {
    const t = e.target.closest("[data-ap-rol]");
    if (!t) return;
    const rol = A().S.roles.find((r) => r.id === C.rolSel);
    await hacer(() => A().api.setRolApartado(rol.id, t.dataset.apRol, t.checked));
  });
  document.getElementById("vAdmin").addEventListener("keydown", (e) => {
    if (e.target.matches("[data-renombrar]")) {
      if (e.key === "Enter") guardarTitulo(e.target);
      if (e.key === "Escape") { C.renombrando = null; indice(); }
    }
    if (e.key === "Enter" && e.target.id === "nuevoPrincipal") document.getElementById("btnNuevoPrincipal").click();
    if (e.key === "Enter" && (e.target.id === "altaMiembro" || e.target.id === "altaAdmin")) e.target.nextElementSibling.click();
  });
  document.getElementById("vAdmin").addEventListener("focusout", (e) => { if (e.target.matches("[data-renombrar]") && C.renombrando) guardarTitulo(e.target); });

  window.ADMIN = { ver };
})();
