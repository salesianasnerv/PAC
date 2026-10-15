// ─── PAC · motor común: índice numerado y contenido → HTML ──────────────────
// Lo usan la web (app.js), el PDF (imprimir.js) y el Word (word.js).
(() => {
  "use strict";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── Índice: árbol ordenado con la numeración calculada (nadie la escribe a mano) ──
  // Devuelve { raiz: [nodos], porId: Map, lista: [nodos en orden de lectura] }.
  // Cada nodo: { ...apartado, hijos, nivel (1…), numero ("3.1.2" o ""), etiqueta ("3.1.2. Título") }
  function arbol(apartados) {
    const porId = new Map(apartados.map((a) => [a.id, { ...a, hijos: [] }]));
    const raiz = [];
    for (const n of porId.values()) {
      const p = n.padre_id && porId.get(n.padre_id);
      (p ? p.hijos : raiz).push(n);
    }
    const ordenar = (l) => l.sort((a, b) => a.orden - b.orden || String(a.titulo).localeCompare(b.titulo));
    const lista = [];
    (function numerar(nodos, prefijo, nivel, padre) {
      ordenar(nodos);
      let i = 0;
      for (const n of nodos) {
        n.nivel = nivel;
        n.padre = padre || null;
        n.numero = n.numerado && prefijo !== null ? (prefijo ? prefijo + "." : "") + ++i : "";
        n.etiqueta = (n.numero ? n.numero + ". " : "") + n.titulo;
        lista.push(n);
        numerar(n.hijos, n.numero || null, nivel + 1, n);
      }
    })(raiz, "", 1, null);
    return { raiz, porId, lista };
  }

  // Todos los nodos de una rama (el propio y los que cuelgan de él), en orden de lectura
  function rama(nodo) {
    const out = [];
    (function r(n) { out.push(n); n.hijos.forEach(r); })(nodo);
    return out;
  }

  // ── Texto con formato: solo negrita, cursiva, subrayado, enlaces y saltos de línea ──
  // Todo lo demás (fuentes, colores, tamaños, estilos pegados de Word…) se quita.
  function limpiarInline(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    const salida = [];
    (function visitar(nodo) {
      for (const h of nodo.childNodes) {
        if (h.nodeType === 3) { salida.push(esc(h.nodeValue.replace(/ /g, " "))); continue; }
        if (h.nodeType !== 1) continue;
        const t = h.tagName.toLowerCase();
        const st = h.getAttribute("style") || "";
        if (t === "br") { salida.push("<br>"); continue; }
        if (t === "script" || t === "style" || t === "template") continue;
        let abre = "", cierra = "";
        if (t === "b" || t === "strong" || /font-weight:\s*(bold|[6-9]00)/.test(st)) { abre += "<b>"; cierra = "</b>" + cierra; }
        if (t === "i" || t === "em" || /font-style:\s*italic/.test(st)) { abre += "<i>"; cierra = "</i>" + cierra; }
        if (t === "u" || /text-decoration[^;]*underline/.test(st)) { abre += "<u>"; cierra = "</u>" + cierra; }
        if (t === "a") {
          const href = (h.getAttribute("href") || "").trim();
          if (/^(https?:|mailto:)/i.test(href)) { abre += `<a href="${esc(href)}">`; cierra = "</a>" + cierra; }
        }
        const bloque = /^(p|div|li|h[1-6]|tr|blockquote)$/.test(t);
        salida.push(abre); visitar(h); salida.push(cierra);
        if (bloque && h.nextSibling) salida.push("<br>");
      }
    })(doc.body.firstChild);
    return salida.join("")
      .replace(/<(b|i|u)><\/\1>/g, "")
      .replace(/(<br>\s*){3,}/g, "<br><br>")
      .replace(/^(\s|<br>)+|(\s|<br>)+$/g, "");
  }
  const textoPlano = (html) => new DOMParser().parseFromString("<div>" + (html || "") + "</div>", "text/html").body.textContent.trim();

  // ── Tablas: la rejilla guarda celdas unidas como {m:1} (con la de arriba) y {c:1} (con la de la izquierda) ──
  const unida = (c) => c && typeof c === "object";
  // Para cada celda «real»: cuántas filas y columnas ocupa
  function spans(filas) {
    const R = filas.length, C = filas[0]?.length || 0, out = [];
    for (let r = 0; r < R; r++) {
      out.push([]);
      for (let c = 0; c < C; c++) {
        const x = filas[r][c];
        if (unida(x)) { out[r].push(null); continue; }
        let cs = 1; while (c + cs < C && filas[r][c + cs]?.c) cs++;
        let rs = 1; while (r + rs < R && filas[r + rs][c]?.m) rs++;
        out[r].push({ rs, cs, html: x || "" });
      }
    }
    return out;
  }

  // ── Bloques → HTML (misma salida para la web y para el PDF) ──
  function bloquesHTML(bloques, op = {}) {
    return (bloques || []).map((b) => bloqueHTML(b, op)).join("\n");
  }
  function bloqueHTML(b, op) {
    switch (b.tipo) {
      case "parrafo": return `<p>${limpiarInline(b.html)}</p>`;
      case "titulo": return `<h4 class="subtitulo">${esc(b.texto)}</h4>`;
      case "destacado": return `<aside class="destacado"><p>${limpiarInline(b.html)}</p></aside>`;
      case "salto": return `<div class="salto-pagina"></div>`;
      case "lista": {
        const tag = b.ordenada ? "ol" : "ul";
        let html = `<${tag}>`, abierta = false;
        for (const it of b.items || []) {
          if (it.nivel > 0 && !abierta) { html = html.replace(/<\/li>$/, "") + `<${tag}>`; abierta = true; }
          else if (!it.nivel && abierta) { html += `</${tag}></li>`; abierta = false; }
          html += `<li>${limpiarInline(it.html)}</li>`;
        }
        if (abierta) html += `</${tag}></li>`;
        return html + `</${tag}>`;
      }
      case "imagen": {
        if (!/^data:image\/(png|jpe?g|gif|webp);base64,/.test(b.src || "") && !/^https:\/\//.test(b.src || "")) return "";
        const ancho = Math.min(100, Math.max(15, Number(b.ancho) || 100));
        return `<figure class="imagen" style="width:${ancho}%"><img src="${esc(b.src)}" alt="${esc(b.pie || "")}">${b.pie ? `<figcaption>${esc(b.pie)}</figcaption>` : ""}</figure>`;
      }
      case "tabla": {
        const filas = b.filas || [];
        if (!filas.length) return "";
        const sp = spans(filas), C = filas[0].length;
        const fila = (r, celda) => "<tr>" + sp[r].map((s) => s && `<${celda}${s.rs > 1 ? ` rowspan="${s.rs}"` : ""}${s.cs > 1 ? ` colspan="${s.cs}"` : ""}>${limpiarInline(s.html)}</${celda}>`).join("") + "</tr>";
        let html = `<table class="tabla cols-${Math.min(C, 9)}${C >= 6 ? " ancha" : ""}">`;
        let desde = 0;
        if (b.cabecera) { html += "<thead>" + fila(0, "th") + "</thead>"; desde = 1; }
        html += "<tbody>";
        for (let r = desde; r < filas.length; r++) html += fila(r, "td");
        return html + "</tbody></table>";
      }
      default: return "";
    }
  }

  // ¿Tiene contenido de verdad? (para avisar de los apartados vacíos)
  const vacio = (bloques) => !(bloques || []).some((b) =>
    b.tipo === "imagen" || b.tipo === "tabla" ||
    (b.tipo === "lista" && b.items?.some((i) => textoPlano(i.html))) ||
    ((b.tipo === "parrafo" || b.tipo === "destacado") && textoPlano(b.html)) || (b.tipo === "titulo" && b.texto));

  const ESTADOS = {
    pendiente: { txt: "Pendiente", color: "#94a3b8" },
    redaccion: { txt: "En redacción", color: "#ee712a" },
    revision: { txt: "Listo para revisar", color: "#3490b0" },
    revisado: { txt: "Revisado", color: "#8a9400" },
  };

  window.PAC = { esc, arbol, rama, limpiarInline, textoPlano, spans, bloquesHTML, vacio, ESTADOS };
})();
