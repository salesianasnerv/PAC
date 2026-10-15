// ─── PAC · editor de bloques ────────────────────────────────────────────────
// Cada apartado es una lista de bloques con formato cerrado: párrafo, subtítulo, lista, tabla,
// destacado, imagen y salto de página. Solo se puede poner negrita, cursiva, subrayado y enlaces:
// el diseño (letra, colores, tamaños, márgenes) lo pone siempre la web, por eso el PAC no se descuadra.
(() => {
  "use strict";
  const { esc, limpiarInline, textoPlano, spans, ESTADOS } = window.PAC;
  const A = () => window.APP;
  const $ = (s, el = document) => el.querySelector(s);

  const TIPOS = {
    parrafo: "Párrafo", titulo: "Subtítulo", lista: "Lista", tabla: "Tabla", destacado: "Destacado", imagen: "Imagen", salto: "Salto de página",
  };
  const OBJETIVOS = ["Objetivo", "Acciones", "Concreción de actividades", "Temporalización (trimestre / mes)", "Indicadores de evaluación", "Observaciones", "Evaluación"];
  const nuevo = (tipo) => ({
    parrafo: { tipo, html: "" },
    titulo: { tipo, texto: "" },
    destacado: { tipo, html: "" },
    lista: { tipo, ordenada: false, items: [{ html: "", nivel: 0 }] },
    tabla: { tipo, cabecera: true, filas: [["Columna 1", "Columna 2", "Columna 3"], ["", "", ""], ["", "", ""]] },
    objetivos: { tipo: "tabla", cabecera: true, filas: [OBJETIVOS.slice(), OBJETIVOS.map(() => ""), OBJETIVOS.map(() => "")] },
    imagen: { tipo, src: "", pie: "", ancho: 100 },
    salto: { tipo },
  }[tipo]);

  const E = { n: null, caja: null, bloques: [], original: "", celda: null, estado: "" };
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const hayCambios = () => !!E.n && JSON.stringify(E.bloques) !== E.original;
  const claveBorrador = () => "pac_borrador_" + E.n.id;

  // ─── Abrir ────────────────────────────────────────────────────────────────
  async function abrir(n, caja) {
    Object.assign(E, { n, caja, bloques: copia(n.bloques || []), original: JSON.stringify(n.bloques || []), celda: null });
    E.estado = n.estado === "pendiente" ? "redaccion" : n.estado === "revisado" && !A().S.user.admin ? "redaccion" : n.estado;
    pintar();
    // ¿Quedó un borrador sin guardar en este navegador?
    let b = null; try { b = JSON.parse(localStorage.getItem(claveBorrador())); } catch {}
    if (b && b.version === n.version && JSON.stringify(b.bloques) !== E.original) {
      if (await A().confirmar("Hay cambios sin guardar", `En este navegador quedaron cambios de este apartado sin guardar (${A().fechaHora(b.fecha)}). ¿Quieres recuperarlos?`, "Recuperarlos")) {
        E.bloques = b.bloques; pintar();
      } else borrarBorrador();
    } else if (b) borrarBorrador();
  }
  function cargarBloques(bloques, msg) { if (!E.n) return; E.bloques = copia(bloques); pintar(); if (msg) A().toast(msg); }
  function borrarBorrador() { try { localStorage.removeItem(claveBorrador()); } catch {} }
  let tBorrador;
  function cambio() {
    clearTimeout(tBorrador);
    tBorrador = setTimeout(() => {
      if (!E.n) return;
      try { localStorage.setItem(claveBorrador(), JSON.stringify({ version: E.n.version, bloques: E.bloques, fecha: new Date().toISOString() })); } catch {}
    }, 800);
  }

  // ─── Pintar ───────────────────────────────────────────────────────────────
  const I = (n) => A().icono(n);
  function pintar(enfocar) {
    const S = A().S, n = E.n;
    const estados = Object.entries(ESTADOS).filter(([k]) => k !== "pendiente" && (S.user.admin || k !== "revisado"));
    E.caja.innerHTML = `
      <div class="editor-barra">
        <button type="button" class="btn primario" data-ed="guardar">Guardar</button>
        <button type="button" class="btn" data-ed="cancelar">Cancelar</button>
        <span class="formato" aria-label="Formato del texto">
          <button type="button" data-fmt="bold" title="Negrita (Ctrl+B)"><b>N</b></button>
          <button type="button" data-fmt="italic" title="Cursiva (Ctrl+I)"><i>K</i></button>
          <button type="button" data-fmt="underline" title="Subrayado (Ctrl+U)"><u>S</u></button>
          <button type="button" data-fmt="link" title="Enlace"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></button>
          <button type="button" data-fmt="removeFormat" title="Quitar formato"><svg viewBox="0 0 24 24"><path d="M6 5h12M12 5l-3 14M4 20L20 4"/></svg></button>
        </span>
        <span class="crece"></span>
        <label class="mini">Al guardar, dejarlo como
          <select data-ed="estado">${estados.map(([k, v]) => `<option value="${k}"${k === E.estado ? " selected" : ""}>${v.txt}</option>`).join("")}</select>
        </label>
      </div>
      <div class="papel doc editor-papel${n.orientacion === "horizontal" ? " horizontal" : ""}">
        ${A().tituloAp(n)}
        ${insertar(-1)}
        ${E.bloques.map((b, i) => `<div class="bloque-ed" data-i="${i}">${acciones(b, i)}${bloque(b, i)}</div>${insertar(i)}`).join("")}
        ${!E.bloques.length ? '<p class="vacio">Este apartado está vacío. Añade el primer bloque aquí debajo, o pega texto o una tabla desde Word.</p>' : ""}
        <div class="anadir"><span>Añadir</span>${botonesTipo()}</div>
      </div>
      <p class="ayuda-ed"><kbd>Intro</kbd> nuevo párrafo · <kbd>Mayús</kbd>+<kbd>Intro</kbd> salto de línea · en listas, <kbd>Tab</kbd> sangra el punto · lo que pegues de Word llega sin su formato (las tablas pegadas se convierten en tablas del PAC). Mientras escribes se guarda un borrador en este navegador.</p>`;
    if (enfocar) enfocarEn(enfocar);
  }
  const botonesTipo = () => ["parrafo", "titulo", "lista", "tabla", "objetivos", "destacado", "imagen", "salto"]
    .map((t) => `<button type="button" data-nuevo="${t}">${t === "objetivos" ? "Tabla de objetivos" : TIPOS[t]}</button>`).join("");
  const insertar = (i) => `<div class="insertar" data-tras="${i}"><button type="button" title="Insertar aquí" data-menu-ins="${i}">+</button></div>`;
  function acciones(b, i) {
    const texto = ["parrafo", "titulo", "destacado", "lista"].includes(b.tipo);
    return `<div class="bloque-acc">
      ${texto ? `<select data-convertir="${i}" title="Convertir en" style="font:inherit;font-size:11px;border:0;background:none;color:#5b6b78;font-weight:600">
        ${["parrafo", "titulo", "destacado", "lista"].map((t) => `<option value="${t}"${t === b.tipo ? " selected" : ""}>${TIPOS[t]}</option>`).join("")}</select>` : `<span>${TIPOS[b.tipo]}</span>`}
      <button type="button" data-mover="${i}" data-d="-1" title="Subir">${I("arriba")}</button>
      <button type="button" data-mover="${i}" data-d="1" title="Bajar">${I("abajo")}</button>
      <button type="button" class="borrar" data-borrar="${i}" title="Quitar este bloque">${I("papelera")}</button>
    </div>`;
  }
  function bloque(b, i) {
    switch (b.tipo) {
      case "parrafo": return `<p contenteditable="true" data-campo="html" data-ph="Escribe aquí…">${limpiarInline(b.html)}</p>`;
      case "destacado": return `<aside class="destacado"><p contenteditable="true" data-campo="html" data-ph="Texto destacado (lema, cita, idea clave)…">${limpiarInline(b.html)}</p></aside>`;
      case "titulo": return `<input class="ed-titulo" data-campo="texto" value="${esc(b.texto)}" placeholder="Subtítulo dentro del apartado">`;
      case "salto": return `<div class="ed-salto">Salto de página · lo que sigue empieza en una página nueva (PDF y Word)</div>`;
      case "lista": {
        const tag = b.ordenada ? "ol" : "ul";
        return `<${tag} class="ed-lista">${b.items.map((it, k) => `<li class="n${it.nivel ? 1 : 0}" contenteditable="true" data-item="${k}" data-ph="Punto de la lista…">${limpiarInline(it.html)}</li>`).join("")}</${tag}>
          <div class="ed-opciones"><label><input type="checkbox" data-op="ordenada"${b.ordenada ? " checked" : ""}> Numerada (1, 2, 3…)</label></div>`;
      }
      case "imagen":
        return `<div class="ed-imagen">${b.src ? `<figure class="imagen" style="width:${b.ancho || 100}%;margin:0 auto"><img src="${esc(b.src)}" alt=""></figure>` : '<label class="cargar"><b>Elegir imagen</b><span class="mini">JPG o PNG. Se reduce sola para que el documento no pese.</span><input type="file" accept="image/*" data-op="archivo" hidden></label>'}
          <div class="ed-opciones">
            <input type="text" data-campo="pie" value="${esc(b.pie)}" placeholder="Pie de imagen (opcional)">
            <label>Ancho <select data-op="ancho">${[100, 75, 50, 33].map((a) => `<option value="${a}"${Number(b.ancho || 100) === a ? " selected" : ""}>${a} %</option>`).join("")}</select></label>
            ${b.src ? '<label class="btn">Cambiar imagen<input type="file" accept="image/*" data-op="archivo" hidden></label>' : ""}
          </div></div>`;
      case "tabla": return tablaEd(b, i);
      default: return "";
    }
  }
  function tablaEd(b, i) {
    const sp = spans(b.filas), C = b.filas[0]?.length || 0;
    const celda = (r, s, c, tag) => `<${tag}${s.rs > 1 ? ` rowspan="${s.rs}"` : ""}${s.cs > 1 ? ` colspan="${s.cs}"` : ""}><div contenteditable="true" data-r="${r}" data-c="${c}">${limpiarInline(s.html)}</div></${tag}>`;
    let html = `<div class="ed-tabla-scroll"><table class="tabla ed${C >= 6 ? " ancha" : ""}">`;
    sp.forEach((fila, r) => {
      const tag = b.cabecera && r === 0 ? "th" : "td";
      if (r === 0 && b.cabecera) html += "<thead>";
      if (r === (b.cabecera ? 1 : 0)) html += "<tbody>";
      html += "<tr>" + fila.map((s, c) => (s ? celda(r, s, c, tag) : "")).join("") + "</tr>";
      if (r === 0 && b.cabecera) html += "</thead>";
    });
    html += "</tbody></table></div>";
    return html + `<div class="ed-opciones">
      <button type="button" class="btn" data-tab="fila+">+ Fila debajo</button>
      <button type="button" class="btn" data-tab="col+">+ Columna a la derecha</button>
      <button type="button" class="btn" data-tab="fila-">Quitar fila</button>
      <button type="button" class="btn" data-tab="col-">Quitar columna</button>
      <button type="button" class="btn" data-tab="unir-arriba" title="Une la celda con la de arriba">Unir ↑</button>
      <button type="button" class="btn" data-tab="unir-izq" title="Une la celda con la de la izquierda">Unir ←</button>
      <button type="button" class="btn" data-tab="separar">Separar</button>
      <label><input type="checkbox" data-op="cabecera"${b.cabecera ? " checked" : ""}> Primera fila de títulos</label>
    </div>`;
  }

  function enfocarEn({ i, item, r, c, final }) {
    const caja = E.caja.querySelector(`.bloque-ed[data-i="${i}"]`);
    if (!caja) return;
    const el = item != null ? caja.querySelector(`[data-item="${item}"]`) : r != null ? caja.querySelector(`[data-r="${r}"][data-c="${c}"]`) : caja.querySelector("[contenteditable], input");
    if (!el) return;
    el.focus();
    if (el.isContentEditable) {
      const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(!final);
      const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    }
  }

  // ─── Leer lo que se escribe ───────────────────────────────────────────────
  const idx = (el) => Number(el.closest(".bloque-ed")?.dataset.i);
  function leer(el) {
    const i = idx(el), b = E.bloques[i];
    if (!b) return;
    if (el.dataset.item != null) b.items[el.dataset.item].html = el.innerHTML;
    else if (el.dataset.r != null) b.filas[el.dataset.r][el.dataset.c] = el.innerHTML;
    else if (el.dataset.campo) b[el.dataset.campo] = el.isContentEditable ? el.innerHTML : el.value;
    cambio();
  }

  // ─── Operaciones con bloques ──────────────────────────────────────────────
  function insertarBloque(pos, b, enfocar = true) {
    E.bloques.splice(pos, 0, b);
    pintar(enfocar && { i: pos, r: b.tipo === "tabla" ? (b.cabecera ? 1 : 0) : undefined, c: 0, item: b.tipo === "lista" ? 0 : undefined });
    cambio();
  }
  function convertir(i, tipo) {
    const b = E.bloques[i];
    const lineas = b.tipo === "lista" ? b.items.map((x) => x.html) : b.tipo === "titulo" ? [esc(b.texto)] : String(b.html || "").split(/<br\s*\/?>/);
    const html = lineas.join("<br>");
    E.bloques[i] = tipo === "lista" ? { tipo, ordenada: false, items: lineas.map((h) => ({ html: h, nivel: 0 })) }
      : tipo === "titulo" ? { tipo, texto: textoPlano(html) } : { tipo, html };
    pintar({ i }); cambio();
  }
  // Parte el texto donde está el cursor: devuelve el HTML de lo que queda detrás (y lo quita del elemento)
  function partir(el) {
    const sel = getSelection();
    if (!sel.rangeCount) return "";
    const r = sel.getRangeAt(0); r.deleteContents();
    const resto = document.createRange(); resto.selectNodeContents(el); resto.setStart(r.endContainer, r.endOffset);
    const d = document.createElement("div"); d.appendChild(resto.extractContents());
    return limpiarInline(d.innerHTML);
  }
  const alInicio = (el) => {
    const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return false;
    const r = document.createRange(); r.selectNodeContents(el); r.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
    return r.toString().length === 0 && !r.cloneContents().querySelector?.("img");
  };

  // ─── Tablas: filas, columnas y celdas unidas ──────────────────────────────
  function lider(f, r, c) { while (f[r]?.[c]?.m) r--; while (f[r]?.[c]?.c) c--; return [r, c]; }
  function opTabla(i, op) {
    const b = E.bloques[i];
    if (!E.celda || E.celda.i !== i) return A().toast("Pon antes el cursor en una celda de la tabla");
    const f = b.filas, R = f.length, C = f[0].length;
    const [r, c] = lider(f, E.celda.r, E.celda.c);
    const sp = spans(f)[r][c];
    let foco = { i, r, c };
    if (op === "fila+") {
      const k = r + sp.rs;   // debajo de la celda (y de su unión)
      f.splice(k, 0, Array.from({ length: C }, (_, x) => (k < R && f[k][x]?.m ? { m: 1 } : "")));
      foco = { i, r: k, c: lider(f, k, c)[1] };
    } else if (op === "col+") {
      const k = c + sp.cs;
      f.forEach((fila) => fila.splice(k, 0, k < C && fila[k]?.c ? { c: 1 } : ""));
      foco = { i, r, c: k };
    } else if (op === "fila-") {
      if (R <= 1) return A().toast("La tabla necesita al menos una fila");
      // Si una celda de esta fila sigue hacia abajo, su texto pasa a la fila siguiente
      for (let x = 0; x < C; x++) if (!(typeof f[r][x] === "object") && f[r + 1]?.[x]?.m) f[r + 1][x] = f[r][x];
      f.splice(r, 1);
      foco = { i, r: Math.min(r, f.length - 1), c: 0 };
    } else if (op === "col-") {
      if (C <= 1) return A().toast("La tabla necesita al menos una columna");
      f.forEach((fila) => { if (typeof fila[c] !== "object" && fila[c + 1]?.c) fila[c + 1] = fila[c]; fila.splice(c, 1); });
      foco = { i, r, c: Math.max(0, c - 1) };
    } else if (op === "unir-arriba") {
      if (r === 0) return A().toast("No hay ninguna celda encima");
      const [ra, ca] = lider(f, r - 1, c), spa = spans(f)[ra][ca];
      if (ca !== c || spa.cs !== sp.cs) return A().toast("Solo se pueden unir celdas del mismo ancho");
      const txt = f[r][c]; f[ra][ca] = [f[ra][ca], txt].filter((x) => textoPlano(x)).join("<br>");
      for (let y = r; y < r + sp.rs; y++) for (let x = c; x < c + sp.cs; x++) f[y][x] = x === c ? { m: 1 } : { c: 1 };
      foco = { i, r: ra, c: ca };
    } else if (op === "unir-izq") {
      if (c === 0) return A().toast("No hay ninguna celda a la izquierda");
      const [ri, ci] = lider(f, r, c - 1), spi = spans(f)[ri][ci];
      if (ri !== r || spi.rs !== sp.rs) return A().toast("Solo se pueden unir celdas de la misma altura");
      const txt = f[r][c]; f[ri][ci] = [f[ri][ci], txt].filter((x) => textoPlano(x)).join("<br>");
      for (let y = r; y < r + sp.rs; y++) for (let x = c; x < c + sp.cs; x++) f[y][x] = y === r ? { c: 1 } : { m: 1 };
      foco = { i, r: ri, c: ci };
    } else if (op === "separar") {
      if (sp.rs === 1 && sp.cs === 1) return A().toast("Esta celda no está unida a otras");
      for (let y = r; y < r + sp.rs; y++) for (let x = c; x < c + sp.cs; x++) if (y !== r || x !== c) f[y][x] = "";
    }
    E.celda = null;
    pintar(foco); cambio();
  }

  // Tabla pegada desde Word o Excel → tabla del PAC (con sus celdas unidas)
  function tablaDeHTML(tabla) {
    const filas = [];
    [...tabla.rows].forEach((tr, r) => {
      filas[r] = filas[r] || [];
      let c = 0;
      for (const td of tr.cells) {
        while (filas[r][c] !== undefined) c++;
        const cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
        for (let y = 0; y < rs; y++) for (let x = 0; x < cs; x++) {
          filas[r + y] = filas[r + y] || [];
          filas[r + y][c + x] = y === 0 && x === 0 ? limpiarInline(td.innerHTML) : y === 0 ? { c: 1 } : { m: 1 };
        }
        c += cs;
      }
    });
    const C = Math.max(...filas.map((f) => f.length));
    filas.forEach((f) => { for (let x = 0; x < C; x++) if (f[x] === undefined) f[x] = ""; });
    const primera = filas[0] || [];
    const cabecera = filas.length > 1 && primera.every((x) => typeof x === "object" || textoPlano(x).length < 45);
    if (cabecera) filas[0] = primera.map((x) => (typeof x === "string" ? x.replace(/<\/?[bi]>/g, "") : x));
    return { tipo: "tabla", cabecera, filas };
  }

  // Imagen: se reduce a 1600 px como mucho para que el PAC no pese
  function comprimir(file) {
    return new Promise((ok, mal) => {
      if (!/^image\//.test(file.type)) return mal(new Error("Eso no es una imagen"));
      const lector = new FileReader();
      lector.onerror = () => mal(new Error("No se ha podido leer la imagen"));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error("No se ha podido abrir la imagen"));
        img.onload = () => {
          const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
          if (k === 1 && file.size < 350000 && /png|jpe?g/.test(file.type)) return ok(lector.result);
          const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
          ok(cv.toDataURL("image/jpeg", 0.85));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(file);
    });
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────
  function limpios() {
    const out = [];
    for (const b0 of copia(E.bloques)) {
      const b = b0;
      if (b.tipo === "parrafo" || b.tipo === "destacado") { b.html = limpiarInline(b.html); if (!textoPlano(b.html)) continue; }
      else if (b.tipo === "titulo") { b.texto = String(b.texto || "").trim(); if (!b.texto) continue; }
      else if (b.tipo === "lista") { b.items = b.items.map((it) => ({ html: limpiarInline(it.html), nivel: it.nivel ? 1 : 0 })).filter((it) => textoPlano(it.html)); if (!b.items.length) continue; }
      else if (b.tipo === "tabla") b.filas = b.filas.map((f) => f.map((x) => (typeof x === "string" ? limpiarInline(x) : x)));
      else if (b.tipo === "imagen") { if (!b.src) continue; b.pie = String(b.pie || "").trim(); }
      out.push(b);
    }
    return out;
  }
  async function guardar() {
    const S = A().S, n = E.n, bloques = limpios();
    const btn = E.caja.querySelector('[data-ed="guardar"]'); btn.disabled = true; btn.textContent = "Guardando…";
    try {
      const fila = await A().api.guardarContenido(n.id, { bloques, version: n.version, estado: E.estado }, S.user.nombre);
      terminar(fila);
      A().toast("Guardado");
    } catch (e) {
      btn.disabled = false; btn.textContent = "Guardar";
      if (!e.conflicto) return A().fallo(e);
      const r = await A().dialogo(`<h2>Alguien lo ha cambiado a la vez</h2>
        <p class="sub">Otra persona ha guardado este apartado mientras lo editabas. Tus cambios siguen aquí (y en el borrador de este navegador).</p>
        <div class="dlg-botones"><button class="btn" value="ver">Ver lo suyo (pierdo lo mío)</button><button class="btn primario" value="mio">Guardar lo mío encima</button></div>`);
      if (r === "mio") {
        try {
          const ultima = (await A().api.apartados(n.curso_id)).find((a) => a.id === n.id);
          const fila = await A().api.guardarContenido(n.id, { bloques, version: ultima.version, estado: E.estado }, S.user.nombre);
          terminar(fila); A().toast("Guardado (encima de la otra versión, que queda en el historial)");
        } catch (e2) { A().fallo(e2); }
      } else if (r === "ver") { borrarBorrador(); E.n = null; A().S.editando = false; await A().recargar(); A().ir("#/ap/" + n.id); }
    }
  }
  function terminar(fila) {
    const id = E.n.id;
    borrarBorrador();
    A().actualizarAp(fila);
    E.n = null; A().S.editando = false;
    A().pintarCabecera();
    A().ir("#/ap/" + id);
  }
  function puedeSalir() {
    if (!hayCambios()) { E.n = null; return true; }
    const si = confirm("Tienes cambios sin guardar en este apartado. ¿Salir sin guardar?\n(Se quedan como borrador en este navegador por si los quieres recuperar.)");
    if (si) E.n = null;
    return si;
  }

  // ─── Eventos ──────────────────────────────────────────────────────────────
  document.addEventListener("input", (e) => {
    if (!E.n || !E.caja.contains(e.target)) return;
    if (e.target.matches("[contenteditable], input[data-campo]")) leer(e.target);
  });
  document.addEventListener("focusin", (e) => {
    if (!E.n || !E.caja.contains(e.target)) return;
    const el = e.target;
    if (el.dataset.r != null) E.celda = { i: idx(el), r: Number(el.dataset.r), c: Number(el.dataset.c) };
  });
  // Los botones de formato y de tabla no deben quitar el cursor del texto
  document.addEventListener("mousedown", (e) => {
    if (E.n && E.caja.contains(e.target) && e.target.closest("[data-fmt], [data-tab]")) e.preventDefault();
  });
  document.addEventListener("change", async (e) => {
    if (!E.n || !E.caja.contains(e.target)) return;
    const t = e.target, i = idx(t), b = E.bloques[i];
    if (t.dataset.ed === "estado") { E.estado = t.value; return; }
    if (t.dataset.convertir != null) return convertir(Number(t.dataset.convertir), t.value);
    if (t.dataset.op === "ordenada") { b.ordenada = t.checked; pintar(); cambio(); }
    else if (t.dataset.op === "cabecera") {
      b.cabecera = t.checked;
      if (t.checked) b.filas[0] = b.filas[0].map((x) => (x?.m ? "" : x));
      pintar(); cambio();
    }
    else if (t.dataset.op === "ancho") { b.ancho = Number(t.value); pintar(); cambio(); }
    else if (t.dataset.op === "archivo" && t.files[0]) {
      try { A().trabajando(true, "Preparando la imagen…"); b.src = await comprimir(t.files[0]); pintar(); cambio(); }
      catch (err) { A().fallo(err); }
      A().trabajando(false);
    }
  });
  document.addEventListener("click", async (e) => {
    if (!E.n || !E.caja.contains(e.target)) return;
    const t = e.target.closest("button, [data-ed]");
    if (!t) { E.caja.querySelectorAll(".menu-insertar").forEach((m) => m.remove()); return; }
    const d = t.dataset;
    if (d.ed === "guardar") return guardar();
    if (d.ed === "cancelar") {
      if (!hayCambios() || await A().confirmar("Descartar los cambios", "Se pierde lo que has cambiado desde que abriste el editor.", "Descartar", true)) {
        borrarBorrador(); const id = E.n.id; E.n = null; A().S.editando = false; A().ir("#/ap/" + id);
      }
      return;
    }
    if (d.fmt) {
      if (d.fmt === "link") {
        const url = prompt("Dirección del enlace (https://…)", "https://");
        if (url && /^(https?:\/\/|mailto:)/i.test(url)) document.execCommand("createLink", false, url);
      } else document.execCommand(d.fmt);
      const el = document.activeElement; if (el?.isContentEditable) leer(el);
      return;
    }
    if (d.nuevo) {
      const b = nuevo(d.nuevo);
      const pos = d.pos != null ? Number(d.pos) : E.bloques.length;
      return insertarBloque(pos, b);
    }
    if (d.menuIns != null) {
      E.caja.querySelectorAll(".menu-insertar").forEach((m) => m.remove());
      const m = document.createElement("div"); m.className = "menu-insertar";
      m.innerHTML = botonesTipo().replaceAll('data-nuevo=', `data-pos="${Number(d.menuIns) + 1}" data-nuevo=`);
      t.parentElement.appendChild(m);
      return;
    }
    if (d.mover != null) {
      const i = Number(d.mover), j = i + Number(d.d);
      if (j < 0 || j >= E.bloques.length) return;
      [E.bloques[i], E.bloques[j]] = [E.bloques[j], E.bloques[i]];
      pintar(); cambio();
      E.caja.querySelector(`.bloque-ed[data-i="${j}"]`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (d.borrar != null) {
      const i = Number(d.borrar), b = E.bloques[i];
      const conTexto = b.tipo === "tabla" || b.tipo === "imagen" || (b.tipo === "lista" ? b.items.some((x) => textoPlano(x.html)) : textoPlano(b.html || b.texto || ""));
      if (conTexto && !(await A().confirmar("Quitar bloque", `¿Quitar este bloque (${TIPOS[b.tipo].toLowerCase()})? Si te equivocas, pulsa «Cancelar» en lugar de «Guardar».`, "Quitar", true))) return;
      E.bloques.splice(i, 1); pintar(); cambio();
      return;
    }
    if (d.tab) return opTabla(idx(t), d.tab);
  });

  document.addEventListener("keydown", (e) => {
    if (!E.n || !E.caja.contains(e.target) || !e.target.isContentEditable) return;
    const el = e.target, i = idx(el), b = E.bloques[i];
    if (!b) return;
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertLineBreak"); leer(el); return; }
    if (b.tipo === "parrafo" || b.tipo === "destacado") {
      if (e.key === "Enter") {
        e.preventDefault();
        const resto = partir(el); b.html = limpiarInline(el.innerHTML);
        insertarBloque(i + 1, { tipo: "parrafo", html: resto });
      } else if (e.key === "Backspace" && alInicio(el) && i > 0 && ["parrafo", "destacado"].includes(E.bloques[i - 1].tipo)) {
        e.preventDefault();
        const prev = E.bloques[i - 1], largo = textoPlano(prev.html).length;
        prev.html = limpiarInline(prev.html) + limpiarInline(el.innerHTML);
        E.bloques.splice(i, 1); pintar(); cambio();
        // cursor donde se unieron
        const p = E.caja.querySelector(`.bloque-ed[data-i="${i - 1}"] [contenteditable]`);
        if (p) { p.focus(); colocarCursor(p, largo); }
      }
      return;
    }
    if (b.tipo === "lista" && el.dataset.item != null) {
      const k = Number(el.dataset.item);
      if (e.key === "Enter") {
        e.preventDefault();
        if (!textoPlano(el.innerHTML) && k === b.items.length - 1) {   // Intro en un punto vacío al final: termina la lista
          b.items.pop(); if (!b.items.length) E.bloques.splice(i, 1);
          return insertarBloque(b.items.length ? i + 1 : i, { tipo: "parrafo", html: "" });
        }
        const resto = partir(el); b.items[k].html = limpiarInline(el.innerHTML);
        b.items.splice(k + 1, 0, { html: resto, nivel: b.items[k].nivel });
        pintar({ i, item: k + 1 }); cambio();
      } else if (e.key === "Tab") {
        e.preventDefault(); b.items[k].nivel = e.shiftKey ? 0 : 1; pintar({ i, item: k, final: true }); cambio();
      } else if (e.key === "Backspace" && alInicio(el)) {
        if (b.items[k].nivel) { e.preventDefault(); b.items[k].nivel = 0; pintar({ i, item: k }); cambio(); return; }
        if (k > 0) {
          e.preventDefault();
          const largo = textoPlano(b.items[k - 1].html).length;
          b.items[k - 1].html = limpiarInline(b.items[k - 1].html) + limpiarInline(el.innerHTML);
          b.items.splice(k, 1); pintar(); cambio();
          const p = E.caja.querySelector(`.bloque-ed[data-i="${i}"] [data-item="${k - 1}"]`); if (p) { p.focus(); colocarCursor(p, largo); }
        } else if (!textoPlano(el.innerHTML) && b.items.length === 1) { e.preventDefault(); E.bloques.splice(i, 1); pintar(); cambio(); }
      }
    }
  });
  function colocarCursor(el, n) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let t, resto = n;
    while ((t = w.nextNode())) { if (t.length >= resto) break; resto -= t.length; }
    const r = document.createRange();
    if (t) r.setStart(t, resto); else { r.selectNodeContents(el); r.collapse(false); }
    r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  // Pegar: solo texto con negrita/cursiva/subrayado/enlaces; las tablas pegadas se convierten en tablas del PAC
  document.addEventListener("paste", (e) => {
    if (!E.n || !E.caja.contains(e.target)) return;
    const el = e.target.closest("[contenteditable], input");
    if (!el || el.tagName === "INPUT") return;
    e.preventDefault();
    const html = e.clipboardData.getData("text/html"), txt = e.clipboardData.getData("text/plain");
    const i = idx(el), b = E.bloques[i];
    if (html && /<table/i.test(html) && el.dataset.r == null) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const tablas = [...doc.querySelectorAll("table")].filter((t) => !t.parentElement.closest("table")).map(tablaDeHTML).filter((t) => t.filas.length);
      if (tablas.length) {
        E.bloques.splice(i + 1, 0, ...tablas);
        if ((b.tipo === "parrafo" || b.tipo === "destacado") && !textoPlano(el.innerHTML)) E.bloques.splice(i, 1);
        pintar(); cambio(); A().toast(tablas.length === 1 ? "Tabla pegada" : tablas.length + " tablas pegadas");
        return;
      }
    }
    let limpio = html ? limpiarInline(html.replace(/<!--[\s\S]*?-->/g, "")) : esc(txt).replace(/\r?\n/g, "<br>");
    // En un párrafo, varios párrafos pegados se convierten en varios bloques
    const trozos = limpio.split(/(?:<br>\s*){1,}/).map((x) => x.trim()).filter((x) => textoPlano(x));
    if ((b.tipo === "parrafo") && trozos.length > 1) {
      const resto = partir(el);
      document.execCommand("insertHTML", false, trozos[0]);
      b.html = limpiarInline(el.innerHTML);
      const nuevos = trozos.slice(1).map((h) => ({ tipo: "parrafo", html: h }));
      if (textoPlano(resto)) nuevos.push({ tipo: "parrafo", html: resto });
      E.bloques.splice(i + 1, 0, ...nuevos);
      pintar({ i: i + trozos.length - 1, final: true }); cambio();
      return;
    }
    document.execCommand("insertHTML", false, limpio);
    leer(el);
  });

  window.EDITOR = { abrir, cargarBloques, puedeSalir, hayCambios };
})();
