// ─── PAC · documento maquetado para imprimir o guardar en PDF (con Paged.js) ──
// imprimir.html?curso=ID                → el PAC completo: portada, índice y todos los apartados
// imprimir.html?curso=ID&apartado=ID    → solo ese apartado y lo que cuelga de él
(() => {
  "use strict";
  const CFG = window.APP_CONFIG, api = window.PAC_DATOS;
  const { esc, arbol, rama, bloquesHTML, vacio } = window.PAC;
  const $ = (s) => document.querySelector(s);
  const q = new URLSearchParams(location.search);

  // Las tablas que pasan de una página a otra repiten su fila de títulos
  class RepetirCabeceras extends Paged.Handler {
    renderNode(clone, node) {
      if (!clone || clone.nodeType !== 1 || clone.closest("thead")) return;
      const tabla = clone.closest("table[data-split-from]");
      if (!tabla || tabla.querySelector(":scope > thead")) return;
      const cab = node.closest?.("table")?.querySelector(":scope > thead");
      if (!cab) return;
      const copia = cab.cloneNode(true);
      [copia, ...copia.querySelectorAll("*")].forEach((el) => { el.removeAttribute("data-ref"); el.removeAttribute("id"); });
      tabla.insertBefore(copia, tabla.firstChild);
    }
  }
  Paged.registerHandlers(RepetirCabeceras);

  async function empezar() {
    try {
      if (api.DEMO && !window.PAC_INICIAL) await cargarScript("datos-iniciales.js");
      const user = await api.sesion();
      if (!user) throw new Error("Para descargar el PAC tienes que haber entrado antes en la web con tu cuenta del colegio.");
      const cursos = await api.cursos();
      const curso = cursos.find((c) => String(c.id) === q.get("curso")) || cursos.find((c) => c.activo) || cursos[0];
      if (!curso) throw new Error("No hay ningún PAC.");
      const T = arbol(await api.apartados(curso.id));
      const raiz = q.get("apartado") ? T.porId.get(q.get("apartado")) : null;
      if (q.get("apartado") && !raiz) throw new Error("Ese apartado ya no existe.");

      const nombreArchivo = `PAC ${curso.nombre.replace("/", "-")}` + (raiz ? ` - ${raiz.numero ? raiz.numero + " " : ""}${raiz.titulo}` : "");
      document.title = nombreArchivo.replace(/[\\/:*?"<>|]/g, "");
      $("#titulo").innerHTML = `<b>${esc(raiz ? raiz.etiqueta : "PAC completo")}</b> · PAC ${esc(curso.nombre)}`;

      const plantilla = document.createElement("template");
      plantilla.innerHTML = documento(curso, T, raiz);
      $("#estadoTxt").textContent = "Maquetando las páginas…";
      const previo = new Paged.Previewer();
      const flujo = await previo.preview(plantilla.content, ["documento.css", "imprimir.css", ...(raiz ? [] : ["imprimir-portada.css"])], $("#paginas"));
      $("#estado").hidden = true;
      $("#titulo").innerHTML += ` · ${flujo.total} páginas. <span style="font-size:13px">Pulsa el botón y elige <b>Guardar como PDF</b> como destino.</span>`;
      const b = $("#btnImprimir"); b.disabled = false; b.addEventListener("click", () => window.print());
    } catch (e) {
      console.error(e);
      $("#estado").innerHTML = `<p style="color:#c0262d">${esc(e.message || e)}</p><p><a href="./">Volver al PAC</a></p>`;
      $("#titulo").innerHTML = "<b>No se ha podido preparar el documento</b>";
    }
  }

  function cargarScript(src) {
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se ha podido cargar " + src)); document.head.appendChild(s); });
  }

  // ¿Va en páginas apaisadas? (el apartado o alguno de sus «padres»)
  const horizontal = (n) => { for (let p = n; p; p = p.padre) if (p.orientacion === "horizontal") return true; return false; };

  function documento(curso, T, raiz) {
    const nodos = raiz ? rama(raiz) : T.lista;
    const nivelBase = raiz ? raiz.nivel - 1 : 0;
    // La cabecera (logo) y el nombre del curso para las páginas: van dentro del primer bloque
    // para que no ocupen una página propia antes de la portada
    const marcas = `<div class="cabecera-run"><img src="img/logo-horizontal.png" alt=""></div>
      <span class="marca-curso">Plan Anual de Centro · ${esc(curso.nombre)}</span>`;
    let html = `<div class="doc">`;

    if (!raiz) {
      html += `<section class="portada">${marcas}
        <div class="franja-color f-azul"></div><div class="franja-color f-verde"></div>
        <div class="logo-portada"><img src="img/logo-vertical.png" alt=""></div>
        <div class="titulo">
          <div class="eyebrow">${esc(CFG.centro || "")}</div>
          <h1>Plan Anual<br>de Centro</h1>
          <div class="curso">Curso ${esc(curso.nombre)}</div>
          <div class="regla"></div>
          ${curso.lema ? `<div class="lema">${esc(curso.lema)}</div>` : ""}
        </div>
        <div class="pie-portada"><b>${esc(curso.subtitulo || CFG.centro || "")}</b><span>${esc(CFG.direccion || "")}</span><span>${esc(CFG.web || "")}</span></div>
      </section>
      <section class="indice-doc"><h1>Índice</h1><div class="regla"></div><ol class="toc">
        ${T.lista.filter((n) => n.nivel <= 3).map((n) => `<li class="l${n.nivel}"><span class="n">${esc(n.numero)}</span><span class="t">${esc(n.titulo)}</span><span class="puntos"></span><a class="pag" href="#ap-${n.id}"></a></li>`).join("")}
      </ol></section>`;
    } else {
      html += marcas + `<div class="solo-apartado"><div><b>Plan Anual de Centro ${esc(curso.nombre)}</b>${esc(CFG.centro || "")}</div></div>`;
    }

    nodos.forEach((n, k) => {
      const nivel = n.nivel - nivelBase;               // 1 = el apartado que abre (sección o apartado exportado)
      const clase = `ap n${Math.min(3, nivel)}${horizontal(n) ? " horizontal" : ""}`;
      let cab;
      if (nivel === 1) {
        cab = `<span class="seccion">${esc(n.etiqueta)}</span><div class="apertura">${n.numero && !raiz ? `<div class="num-grande">${esc(n.numero)}</div>` : ""}
          <h2 class="ap-titulo">${raiz && n.numero ? `<span class="num">${esc(n.numero)}</span>` : ""}<span>${esc(n.titulo)}</span></h2></div>`;
      } else {
        const h = nivel === 2 ? "h3" : "h4";
        cab = `<${h} class="ap-titulo">${n.numero ? `<span class="num">${esc(n.numero)}</span>` : ""}<span>${esc(n.titulo)}</span></${h}>`;
      }
      const cuerpo = vacio(n.bloques) ? (n.hijos.length ? "" : '<p class="vacio">(Apartado pendiente de redactar)</p>') : bloquesHTML(n.bloques, { sinRowspan: true });
      html += `<section class="${clase}${k === 0 ? " primero" : ""}" id="ap-${n.id}">${cab}${cuerpo}</section>`;
    });
    return html + "</div>";
  }

  empezar();
})();
