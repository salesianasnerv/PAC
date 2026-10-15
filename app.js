// ─── PAC · la web: entrar, índice, leer, seguimiento y descargas ────────────
// El editor está en editor.js, la coordinación en admin.js y el Word en word.js.
(() => {
  "use strict";
  const CFG = window.APP_CONFIG;
  const api = window.PAC_DATOS;
  const { esc, arbol, bloquesHTML, vacio, textoPlano, ESTADOS } = window.PAC;

  // ─── Utilidades ────────────────────────────────────────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fechaHora = (s) => s ? new Date(s).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const fechaCorta = (s) => s ? new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";
  const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function toast(msg, mal) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false; t.classList.toggle("mal", !!mal);
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), mal ? 6000 : 3500);
  }
  function fallo(e) { console.error(e); toast(e?.message || String(e), true); }
  function trabajando(si, txt) { $("#trabajando").hidden = !si; if (txt) $("#trabajandoTxt").textContent = txt; }

  // Diálogo: devuelve el value del botón pulsado ("" si se cierra)
  function dialogo(html, { ancho = false, alAbrir } = {}) {
    const d = $("#dialogo");
    $("#dlgCuerpo").innerHTML = html;
    d.classList.toggle("ancho", ancho);
    d.returnValue = "";
    return new Promise((ok) => {
      d.addEventListener("close", () => ok(d.returnValue), { once: true });
      d.showModal();
      alAbrir?.(d);
    });
  }
  async function confirmar(titulo, texto, si = "Sí", peligro = false) {
    const r = await dialogo(`<h2>${esc(titulo)}</h2><p class="sub">${texto}</p>
      <div class="dlg-botones"><button class="btn" value="">Cancelar</button><button class="btn ${peligro ? "aviso" : "primario"}" value="si">${esc(si)}</button></div>`);
    return r === "si";
  }

  const ICONOS = {
    lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    word: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M8.5 12l1.5 6 2-4.5 2 4.5 1.5-6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arriba: '<path d="M12 19V5M6 11l6-6 6 6"/>', abajo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    izq: '<path d="M19 12H5M11 6l-6 6 6 6"/>', der: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', mas: '<path d="M12 5v14M5 12h14"/>',
    papelera: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    ojo: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icono = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ""}</svg>`;

  // ─── Estado ──────────────────────────────────────────────────────────────
  const S = { user: null, cursos: [], curso: null, aps: [], T: null, roles: [], abiertos: new Set(), actual: null, editando: false, filtroEstado: "", filtroRol: "" };

  const nodo = (id) => S.T?.porId.get(id);
  const cerrado = () => S.curso?.estado === "cerrado";
  // Roles de la persona que ha entrado
  const misRoles = () => S.roles.filter((r) => r.miembros.includes(S.user.email));
  // Roles asignados a un apartado o a alguno de sus «padres» (los que lo pueden editar)
  function rolesDe(id) {
    const out = [];
    for (let n = nodo(id); n; n = n.padre) S.roles.forEach((r) => { if (r.apartados.includes(n.id) && !out.includes(r)) out.push(r); });
    return out;
  }
  function puedeEditar(id) {
    if (S.user.admin) return true;
    if (cerrado()) return false;
    const mios = new Set(misRoles().map((r) => r.id));
    return rolesDe(id).some((r) => mios.has(r.id));
  }

  // ─── Arranque ────────────────────────────────────────────────────────────
  async function arrancar() {
    $("#demoAviso").hidden = !api.DEMO;
    $("#loginDemo").hidden = !api.DEMO;
    $("#loginReal").hidden = api.DEMO;
    try {
      if (api.DEMO && !window.PAC_INICIAL) await cargarScript("datos-iniciales.js");
      S.user = await api.sesion();
    } catch (e) { $("#loginError").textContent = e.message; }
    if (!S.user) { $("#login").hidden = false; return; }
    document.body.classList.remove("sin-sesion");
    $("#sesion").hidden = false;
    $("#usuario").textContent = S.user.nombre;
    $("#rolEtq").hidden = !S.user.admin;
    $("#tabs").hidden = false;
    $("#tabAdmin").hidden = !S.user.admin;
    $("#app").hidden = false;
    try { await cargar(); } catch (e) { fallo(e); return; }
    window.addEventListener("hashchange", ruta);
    ruta();
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => {
      if ([...document.scripts].some((s) => s.getAttribute("src") === src)) return ok();
      const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se ha podido cargar " + src));
      document.head.appendChild(s);
    });
  }

  // Cursos, apartados y roles del curso elegido
  async function cargar(cursoId) {
    S.cursos = await api.cursos();
    if (!S.cursos.length) throw new Error("Todavía no hay ningún PAC. Ejecuta seed.sql en Supabase (ver README).");
    let guardado = null; try { guardado = Number(localStorage.getItem("pac_curso")); } catch {}
    S.curso = S.cursos.find((c) => c.id === (cursoId || guardado)) || S.cursos.find((c) => c.activo) || S.cursos[0];
    const [aps, roles] = await Promise.all([api.apartados(S.curso.id), api.roles()]);
    S.aps = aps; S.roles = roles;
    reconstruir();
    pintarCabecera();
  }
  function reconstruir() {
    S.T = arbol(S.aps);
    S.texto = new Map(S.T.lista.map((n) => [n.id, normal(n.titulo + " " + textoDe(n.bloques))]));
  }
  function textoDe(bloques) {
    return (bloques || []).map((b) => b.tipo === "tabla" ? b.filas.flat().filter((c) => typeof c === "string").join(" ")
      : b.tipo === "lista" ? b.items.map((i) => i.html).join(" ") : b.html || b.texto || b.pie || "").join(" ").replace(/<[^>]+>/g, " ");
  }
  // Tras guardar un apartado: se actualiza sin volver a pedir todo
  function actualizarAp(fila) {
    const i = S.aps.findIndex((a) => a.id === fila.id);
    if (i >= 0) S.aps[i] = { ...S.aps[i], ...fila }; else S.aps.push(fila);
    reconstruir();
  }
  async function recargar() { await cargar(S.curso.id); ruta(); }

  function pintarCabecera() {
    const sel = $("#cursoSel");
    sel.innerHTML = S.cursos.map((c) => `<option value="${c.id}"${c.id === S.curso.id ? " selected" : ""}>PAC ${esc(c.nombre)}${c.estado === "cerrado" ? " · cerrado" : ""}</option>`).join("");
    $("#cursoSelCaja").hidden = false;
    $("#cursoTxt").textContent = cerrado() ? "Solo lectura: este PAC está cerrado" : "";
    $("#btnPdfTodo").hidden = $("#btnWordTodo").hidden = false;
    const mios = S.T.lista.filter((n) => puedeEditar(n.id) && (S.user.admin ? false : true));
    $("#tabMios").hidden = !mios.length;
    $("#nMios").textContent = mios.length;
  }

  // ─── Rutas: #/ap/<id> · #/mios · #/seguimiento · #/admin/<sección> ────────
  function ir(hash) { if (location.hash === hash) ruta(); else location.hash = hash; }
  function ruta() {
    if (S.editando && location.hash !== S.hashEditor) {
      // Se sale del editor: si hay cambios sin guardar se pregunta; si no se quiere salir, se vuelve a dejar la dirección como estaba
      if (!window.EDITOR.puedeSalir()) { history.replaceState(null, "", S.hashEditor); return; }
      S.editando = false;
    }
    const h = location.hash.replace(/^#\/?/, "").split("/");
    const vista = h[0] === "mios" ? "mios" : h[0] === "seguimiento" ? "seguimiento" : h[0] === "admin" && S.user.admin ? "admin" : "pac";
    $$("nav [data-vista]").forEach((b) => b.classList.toggle("activa", b.dataset.vista === vista));
    $("#tabAdmin").classList.remove("abierto");
    $("#vPac").hidden = vista !== "pac"; $("#vMios").hidden = vista !== "mios"; $("#vSeguimiento").hidden = vista !== "seguimiento"; $("#vAdmin").hidden = vista !== "admin";
    if (vista === "pac") {
      const id = h[0] === "ap" && nodo(h[1]) ? h[1] : S.actual && nodo(S.actual) ? S.actual : S.T.lista[0]?.id;
      verApartado(id, h[2] === "editar");
    } else if (vista === "mios") verMios();
    else if (vista === "seguimiento") verSeguimiento();
    else window.ADMIN.ver(h[1] || "indice", $("#vAdmin"));
  }

  // ─── Índice lateral ────────────────────────────────────────────────────────
  function pintarArbol() {
    const li = (n) => {
      const abierto = S.abiertos.has(n.id);
      const est = ESTADOS[n.estado] || ESTADOS.pendiente;
      return `<li class="${abierto ? "abierto" : ""}" data-li="${n.id}"><div class="fila-nodo">${n.hijos.length ? `<button type="button" class="plegar" data-plegar="${n.id}" aria-label="${abierto ? "Plegar" : "Desplegar"}"></button>` : '<span class="hueco"></span>'}
        <button type="button" class="nodo${n.id === S.actual ? " activo" : ""}" data-ap="${n.id}" title="${esc(est.txt)}">
          <span class="n">${esc(n.numero)}</span><span class="t">${esc(n.titulo)}</span>${puedeEditar(n.id) && !S.user.admin ? icono("lapiz").replace("<svg", '<svg class="lapiz"') : ""}<span class="punto" style="--c:${est.color}"></span>
        </button></div>${n.hijos.length ? `<ol>${n.hijos.map(li).join("")}</ol>` : ""}</li>`;
    };
    $("#arbol").innerHTML = S.T.raiz.map(li).join("");
  }
  $("#arbol").addEventListener("click", (e) => {
    const p = e.target.closest("[data-plegar]");
    if (p) { const id = p.dataset.plegar; S.abiertos.has(id) ? S.abiertos.delete(id) : S.abiertos.add(id); pintarArbol(); return; }
    const b = e.target.closest("[data-ap]");
    if (b) { ir("#/ap/" + b.dataset.ap); $("#indice").classList.remove("abierto"); }
  });
  $("#btnIndiceMovil").addEventListener("click", () => {
    const i = $("#indice"); i.classList.toggle("abierto");
    $("#btnIndiceMovil").setAttribute("aria-expanded", i.classList.contains("abierto"));
  });

  // Buscar en títulos y contenido
  $("#buscar").addEventListener("input", (e) => {
    const q = normal(e.target.value.trim()), caja = $("#resultados");
    if (q.length < 2) { caja.hidden = true; $("#arbol").hidden = false; return; }
    const res = S.T.lista.filter((n) => S.texto.get(n.id).includes(q)).slice(0, 25);
    caja.hidden = false; $("#arbol").hidden = true;
    caja.innerHTML = res.length ? res.map((n) => {
      const t = S.texto.get(n.id), i = t.indexOf(q);
      const trozo = t.slice(Math.max(0, i - 40), i + q.length + 60);
      return `<button type="button" data-ap="${n.id}"><b>${esc(n.etiqueta)}</b>…${esc(trozo).replace(esc(q), `<mark>${esc(q)}</mark>`)}…</button>`;
    }).join("") : '<p class="mini" style="padding:6px">Nada encontrado.</p>';
  });
  $("#resultados").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ap]"); if (!b) return;
    ir("#/ap/" + b.dataset.ap); $("#buscar").value = ""; $("#resultados").hidden = true; $("#arbol").hidden = false;
  });

  // ─── Ver un apartado ──────────────────────────────────────────────────────
  function cabeceraAp(n) {
    const est = ESTADOS[n.estado] || ESTADOS.pendiente;
    const migas = []; for (let p = n.padre; p; p = p.padre) migas.unshift(p);
    const roles = rolesDe(n.id);
    const puede = puedeEditar(n.id);
    const opcionesEstado = Object.entries(ESTADOS).filter(([k]) => S.user.admin || k !== "revisado" || n.estado === "revisado")
      .map(([k, v]) => `<option value="${k}"${k === n.estado ? " selected" : ""}>${v.txt}</option>`).join("");
    return `<div class="ap-cab">
      <div>
        <div class="migas"><span>PAC ${esc(S.curso.nombre)}</span>${migas.map((m) => `<span>›</span><button type="button" data-ap="${m.id}">${esc(m.etiqueta)}</button>`).join("")}</div>
        <div class="ap-meta">
          ${puede && !S.editando ? `<select class="estado-sel" data-estado="${n.id}" aria-label="Estado" style="--c:${est.color}">${opcionesEstado}</select>` : `<span class="estado" style="--c:${est.color}">${est.txt}</span>`}
          ${roles.length ? `<span>Lo edita:</span> ${roles.map((r) => `<span class="rol-chip" style="--c:${esc(r.color)}"><i></i>${esc(r.nombre)}</span>`).join(" ")}` : '<span>Sin equipo asignado (solo coordinación)</span>'}
          ${n.actualizado_en ? `<span>· Última modificación: ${esc(n.actualizado_nombre || api.nombreDeEmail(n.actualizado_por))}, ${fechaHora(n.actualizado_en)}</span>` : ""}
        </div>
      </div>
      <div class="ap-botones">
        ${puede ? `<button type="button" class="btn edit" data-accion="editar">${icono("lapiz")}Editar</button>` : ""}
        <button type="button" class="btn" data-accion="historial" title="Versiones anteriores">${icono("reloj")}Historial</button>
        <button type="button" class="btn" data-accion="pdf" title="Este apartado${n.hijos.length ? " y sus subapartados" : ""} en PDF">${icono("pdf")}PDF</button>
        <button type="button" class="btn" data-accion="word" title="Este apartado${n.hijos.length ? " y sus subapartados" : ""} en Word">${icono("word")}Word</button>
      </div>
    </div>`;
  }
  const tituloAp = (n) => {
    const h = n.nivel === 1 ? "h2" : n.nivel === 2 ? "h3" : "h4";
    return `<${h} class="ap-titulo">${n.numero ? `<span class="num">${esc(n.numero)}</span>` : ""}<span>${esc(n.titulo)}</span></${h}>`;
  };

  function verApartado(id, editar) {
    const n = nodo(id);
    if (!n) { $("#contenido").innerHTML = '<div class="panel"><p>Este PAC aún no tiene apartados.</p></div>'; pintarArbol(); return; }
    S.actual = id;
    for (let p = n.padre; p; p = p.padre) S.abiertos.add(p.id);
    if (n.hijos.length) S.abiertos.add(n.id);
    pintarArbol();
    $(`[data-ap="${id}"].nodo`)?.scrollIntoView({ block: "nearest" });
    if (editar && puedeEditar(id)) {
      S.editando = true; S.hashEditor = location.hash;
      $("#contenido").innerHTML = cabeceraAp(n) + '<div id="editorCaja"></div>';
      window.EDITOR.abrir(n, $("#editorCaja"));
      return;
    }
    S.editando = false;
    const est = (h) => ESTADOS[h.estado] || ESTADOS.pendiente;
    $("#contenido").innerHTML = cabeceraAp(n) + `<div class="papel doc${n.orientacion === "horizontal" ? " horizontal" : ""}">
      ${tituloAp(n)}
      ${vacio(n.bloques) ? `<div class="aviso-vacio">Este apartado está vacío${puedeEditar(id) ? ": pulsa <b>Editar</b> para escribirlo." : "."}</div>` : bloquesHTML(n.bloques)}
      ${n.hijos.length ? `<div class="hijos"><h5>Contiene</h5><div class="hijos-lista">${n.hijos.map((h) =>
        `<button type="button" class="hijo" data-ap="${h.id}" style="--c:${est(h).color}"><b>${esc(h.numero)}</b><span>${esc(h.titulo)}</span></button>`).join("")}</div></div>` : ""}
    </div>`;
  }

  $("#contenido").addEventListener("click", async (e) => {
    const ap = e.target.closest("[data-ap]");
    if (ap && !e.target.closest(".editor-papel")) { ir("#/ap/" + ap.dataset.ap); window.scrollTo({ top: $("#main").offsetTop - 10 }); return; }
    const acc = e.target.closest("[data-accion]")?.dataset.accion;
    if (!acc) return;
    const n = nodo(S.actual);
    if (acc === "editar") ir(`#/ap/${n.id}/editar`);
    else if (acc === "historial") historial(n);
    else if (acc === "pdf") pdf(n.id);
    else if (acc === "word") word(n.id);
  });
  $("#contenido").addEventListener("change", async (e) => {
    const s = e.target.closest("[data-estado]");
    if (!s) return;
    try { actualizarAp(await api.cambiarEstado(s.dataset.estado, s.value)); toast("Estado: " + ESTADOS[s.value].txt); }
    catch (err) { fallo(err); }
    if (!S.editando) verApartado(S.actual);
  });

  // ─── Historial de versiones ───────────────────────────────────────────────
  async function historial(n) {
    let vs;
    try { vs = await api.versiones(n.id); } catch (e) { return fallo(e); }
    const lista = vs.length ? vs.map((v, i) => `<div class="version"><div><b>Versión ${v.version}</b> <small>${fechaHora(v.fecha)} · ${esc(v.autor_nombre || (v.autor ? api.nombreDeEmail(v.autor) : "importado del Word"))}</small></div>
      <div><button type="button" class="btn mini" data-ver="${i}">${icono("ojo")}Ver</button>${puedeEditar(n.id) ? ` <button type="button" class="btn mini" data-restaurar="${i}">Recuperar</button>` : ""}</div></div>`).join("")
      : '<p class="sub">Todavía no hay versiones anteriores: se guardan cada vez que alguien cambia el apartado.</p>';
    const r = await dialogo(`<h2>Historial · ${esc(n.etiqueta)}</h2><p class="sub">Versión actual: ${n.version || 1}${n.actualizado_en ? ` (${esc(n.actualizado_nombre || "")}, ${fechaHora(n.actualizado_en)})` : ""}</p>
      <div class="versiones">${lista}</div><div id="previa"></div><div class="dlg-botones"><button class="btn" value="">Cerrar</button></div>`, {
      ancho: true,
      alAbrir: (d) => d.querySelector(".versiones")?.addEventListener("click", (e) => {
        const v = e.target.closest("[data-ver]"), rs = e.target.closest("[data-restaurar]");
        if (v) d.querySelector("#previa").innerHTML = `<h3 class="mini" style="margin:14px 0 6px">Versión ${vs[v.dataset.ver].version}</h3><div class="vista-previa"><div class="papel doc">${bloquesHTML(vs[v.dataset.ver].bloques)}</div></div>`;
        if (rs) { S.restaurar = vs[rs.dataset.restaurar]; d.close("restaurar"); }
      }),
    });
    if (r === "restaurar" && S.restaurar) {
      const v = S.restaurar; S.restaurar = null;
      ir(`#/ap/${n.id}/editar`);
      setTimeout(() => window.EDITOR.cargarBloques(v.bloques, `Recuperada la versión ${v.version}. Revisa y pulsa «Guardar» para quedártela.`), 0);
    }
  }

  // ─── Mis apartados ────────────────────────────────────────────────────────
  function filaAp(n, { estadoEditable = false } = {}) {
    const est = ESTADOS[n.estado] || ESTADOS.pendiente;
    const roles = rolesDe(n.id);
    const sel = estadoEditable && puedeEditar(n.id)
      ? `<select data-estado-tabla="${n.id}">${Object.entries(ESTADOS).filter(([k]) => S.user.admin || k !== "revisado" || n.estado === "revisado").map(([k, v]) => `<option value="${k}"${k === n.estado ? " selected" : ""}>${v.txt}</option>`).join("")}</select>`
      : `<span class="estado" style="--c:${est.color}">${est.txt}</span>`;
    return `<tr class="click" data-ap="${n.id}">
      <td class="n sangria${Math.min(3, n.nivel - 1)}">${esc(n.numero)}</td>
      <td>${esc(n.titulo)} ${vacio(n.bloques) ? '<span class="tag-vacio">vacío</span>' : ""}</td>
      <td>${roles.map((r) => `<span class="rol-chip" style="--c:${esc(r.color)}"><i></i>${esc(r.nombre)}</span>`).join(" ") || '<span class="mini">—</span>'}</td>
      <td>${sel}</td>
      <td class="mini">${n.actualizado_en ? `${fechaCorta(n.actualizado_en)} · ${esc(n.actualizado_nombre || api.nombreDeEmail(n.actualizado_por))}` : "—"}</td>
    </tr>`;
  }
  const cabTabla = '<thead><tr><th></th><th>Apartado</th><th>Lo edita</th><th>Estado</th><th>Última modificación</th></tr></thead>';

  function verMios() {
    const mios = S.T.lista.filter((n) => puedeEditar(n.id));
    const roles = misRoles();
    $("#vMios").innerHTML = `<div class="panel"><h2>Mis apartados</h2>
      <p class="sub">${roles.length ? `Estás en: ${roles.map((r) => `<b>${esc(r.nombre)}</b>`).join(", ")}. ` : ""}Estos son los apartados que puedes editar${cerrado() ? " (el PAC de este curso está cerrado: ahora solo se puede leer)" : ""}. Cuando termines uno, ponlo en <b>Listo para revisar</b>.</p>
      ${mios.length ? `<div class="scroll-x"><table class="tabla-ui">${cabTabla}<tbody>${mios.map((n) => filaAp(n, { estadoEditable: true })).join("")}</tbody></table></div>` : '<p class="mini">No tienes apartados asignados. Si crees que deberías, díselo a coordinación.</p>'}
    </div>`;
  }

  // ─── Seguimiento: cómo va cada apartado ────────────────────────────────────
  function verSeguimiento() {
    const todos = S.T.lista;
    const cuenta = (k) => todos.filter((n) => (n.estado || "pendiente") === k).length;
    const vacios = todos.filter((n) => vacio(n.bloques)).length;
    const f = S.filtroEstado, fr = S.filtroRol;
    const rolF = S.roles.find((r) => String(r.id) === fr);
    const lista = todos.filter((n) => (!f || (f === "vacio" ? vacio(n.bloques) : n.estado === f)) && (!rolF || rolesDe(n.id).includes(rolF)));
    $("#vSeguimiento").innerHTML = `<div class="panel"><h2>Seguimiento del PAC ${esc(S.curso.nombre)}</h2>
      <p class="sub">Cómo va cada apartado. Pulsa una tarjeta para filtrar y una fila para abrir el apartado.</p>
      <div class="progreso" title="Revisados">${Object.entries(ESTADOS).map(([k, v]) => `<i style="--c:${v.color};width:${(100 * cuenta(k)) / Math.max(1, todos.length)}%"></i>`).join("")}</div>
      <div class="kpis">
        ${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" class="kpi${f === k ? " activo" : ""}" data-filtro="${k}" style="--c:${v.color}"><b>${cuenta(k)}</b><span>${v.txt}</span></button>`).join("")}
        <button type="button" class="kpi${f === "vacio" ? " activo" : ""}" data-filtro="vacio" style="--c:#ee712a"><b>${vacios}</b><span>Sin contenido</span></button>
      </div>
      <div class="ed-opciones" style="margin-bottom:10px"><label>Equipo: <select id="filtroRol"><option value="">Todos</option>${S.roles.map((r) => `<option value="${r.id}"${String(r.id) === fr ? " selected" : ""}>${esc(r.nombre)}</option>`).join("")}</select></label>
        ${f || fr ? '<button type="button" class="btn" id="quitarFiltro">Quitar filtros</button>' : ""}<span>${lista.length} de ${todos.length} apartados</span></div>
      <div class="scroll-x"><table class="tabla-ui">${cabTabla}<tbody>${lista.map((n) => filaAp(n, { estadoEditable: S.user.admin })).join("")}</tbody></table></div>
    </div>`;
  }
  $("#vSeguimiento").addEventListener("click", (e) => {
    const k = e.target.closest("[data-filtro]");
    if (k) { S.filtroEstado = S.filtroEstado === k.dataset.filtro ? "" : k.dataset.filtro; verSeguimiento(); return; }
    if (e.target.closest("#quitarFiltro")) { S.filtroEstado = S.filtroRol = ""; verSeguimiento(); return; }
    if (e.target.closest("select")) return;
    const tr = e.target.closest("[data-ap]"); if (tr) ir("#/ap/" + tr.dataset.ap);
  });
  for (const v of ["#vSeguimiento", "#vMios"]) {
    $(v).addEventListener("change", async (e) => {
      if (e.target.id === "filtroRol") { S.filtroRol = e.target.value; verSeguimiento(); return; }
      const s = e.target.closest("[data-estado-tabla]"); if (!s) return;
      try { actualizarAp(await api.cambiarEstado(s.dataset.estadoTabla, s.value)); toast("Estado: " + ESTADOS[s.value].txt); } catch (err) { fallo(err); }
      ruta(); pintarArbol();
    });
  }
  $("#vMios").addEventListener("click", (e) => { if (e.target.closest("select")) return; const tr = e.target.closest("[data-ap]"); if (tr) ir("#/ap/" + tr.dataset.ap); });

  // ─── Descargas ─────────────────────────────────────────────────────────────
  function pdf(apId) {
    const url = `imprimir.html?curso=${S.curso.id}${apId ? "&apartado=" + encodeURIComponent(apId) : ""}`;
    const w = window.open(url, "_blank");
    if (!w) location.href = url;
  }
  async function word(apId) {
    trabajando(true, "Preparando el documento de Word…");
    try {
      await cargarScript("lib/docx.iife.js");
      const { blob, nombre } = await window.PAC_WORD.generar({ curso: S.curso, T: S.T, apartadoId: apId, cfg: CFG });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Descargado: " + nombre);
    } catch (e) { fallo(e); }
    trabajando(false);
  }
  $("#btnPdfTodo").addEventListener("click", () => pdf(null));
  $("#btnWordTodo").addEventListener("click", () => word(null));

  // ─── Cabecera, menú y sesión ──────────────────────────────────────────────
  $("#cursoSel").addEventListener("change", async (e) => {
    if (S.editando && !window.EDITOR.puedeSalir()) { e.target.value = S.curso.id; return; }
    S.editando = false;
    try { localStorage.setItem("pac_curso", e.target.value); } catch {}
    S.actual = null; S.abiertos.clear();
    try { await cargar(Number(e.target.value)); ir("#/"); } catch (err) { fallo(err); }
  });
  $("#tabs").addEventListener("click", (e) => {
    const m = e.target.closest("[data-menu]");
    if (m) { m.parentElement.classList.toggle("abierto"); return; }
    const b = e.target.closest("[data-ir]");
    if (b) ir(b.dataset.ir);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu-g")) $("#tabAdmin").classList.remove("abierto"); });
  $("#btnLogin").addEventListener("click", () => api.login().catch((e) => ($("#loginError").textContent = e.message)));
  $$("[data-demo]").forEach((b) => b.addEventListener("click", () => api.login(b.dataset.demo)));
  $("#btnSalir").addEventListener("click", () => { if (!S.editando || window.EDITOR.puedeSalir()) api.logout(); });
  $("#btnReiniciar").addEventListener("click", async () => {
    if (await confirmar("Volver al PAC importado", "Se borra todo lo que hayas probado en este navegador y se vuelve a cargar el PAC tal como estaba en el Word.", "Volver a empezar", true)) api.reiniciar();
  });
  window.addEventListener("beforeunload", (e) => { if (S.editando && window.EDITOR.hayCambios()) { e.preventDefault(); e.returnValue = ""; } });

  window.APP = { S, api, CFG, $, $$, esc, icono, toast, fallo, dialogo, confirmar, trabajando, ir, ruta, recargar, cargar, actualizarAp, reconstruir,
    puedeEditar, rolesDe, misRoles, nodo, cerrado, fechaHora, tituloAp, pintarArbol, pintarCabecera, verApartado };
  window.addEventListener("DOMContentLoaded", arrancar);
})();
