// ─── PAC · documento de Word (.docx) con el diseño corporativo ──────────────
// Usa la librería docx (lib/docx.iife.js), que se carga solo al pulsar «Word».
// Portada, índice automático de Word (se rellena al abrir el documento), cabecera con el logo,
// pie con la sección y el número de página, títulos con estilos de Word y tablas con cabecera repetida.
(() => {
  "use strict";
  const { spans, limpiarInline, textoPlano, rama, vacio } = window.PAC;

  const AZUL = "3490B0", AZUL_OSC = "24708C", VERDE = "B6BC00", NARANJA = "EE712A", TEXTO = "1F2A33", SUAVE = "5B6B78", LINEA = "CFDDE4", CEBRA = "F3F8FA", CLARO = "EAF4F8";
  const FUENTE = "Fira Sans";
  // A4 en twips (1 cm = 567)
  const A4 = { w: 11906, h: 16838 };
  const MARGEN_V = { top: 1360, bottom: 1134, left: 1134, right: 1020, header: 600, footer: 560 };
  const MARGEN_H = { top: 1134, bottom: 964, left: 1020, right: 1020, header: 500, footer: 480 };
  const ancho = (h) => (h ? A4.h - MARGEN_H.left - MARGEN_H.right : A4.w - MARGEN_V.left - MARGEN_V.right);

  async function bytes(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("No se ha podido leer " + url);
    return new Uint8Array(await r.arrayBuffer());
  }
  const dataABytes = (src) => Uint8Array.from(atob(src.split(",")[1]), (c) => c.charCodeAt(0));
  const tamImagen = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok({ w: 800, h: 600 }); i.src = src; });

  async function generar({ curso, T, apartadoId, cfg }) {
    const d = window.docx;
    const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType,
      HeadingLevel, TableOfContents, Header, Footer, PageNumber, PageOrientation, TabStopType, LevelFormat, ExternalHyperlink,
      SimpleField, VerticalAlign, PageBreak, TableLayoutType } = d;

    const raiz = apartadoId ? T.porId.get(apartadoId) : null;
    const nodos = raiz ? rama(raiz) : T.lista;
    const nivelBase = raiz ? raiz.nivel - 1 : 0;
    const logoH = await bytes("img/logo-horizontal.png");
    const logoV = raiz ? null : await bytes("img/logo-vertical.png");
    let numLista = 0;

    // ── Texto con formato (HTML limpio) → trozos de Word ──
    function runs(html, base = {}) {
      const out = [];
      const doc = new DOMParser().parseFromString("<div>" + limpiarInline(html) + "</div>", "text/html");
      (function visitar(nodo, f) {
        for (const h of nodo.childNodes) {
          if (h.nodeType === 3) { if (h.nodeValue) out.push(new TextRun({ text: h.nodeValue, ...base, ...f })); continue; }
          const t = h.tagName.toLowerCase();
          if (t === "br") { out.push(new TextRun({ break: 1, ...base })); continue; }
          if (t === "a") {
            out.push(new ExternalHyperlink({ link: h.getAttribute("href"), children: [new TextRun({ text: h.textContent, ...base, ...f, color: AZUL_OSC, underline: {} })] }));
            continue;
          }
          visitar(h, { ...f, ...(t === "b" ? { bold: true } : t === "i" ? { italics: true } : t === "u" ? { underline: {} } : {}) });
        }
      })(doc.body.firstChild, {});
      return out.length ? out : [new TextRun({ text: "", ...base })];
    }

    // ── Bloques → elementos de Word ──
    async function bloques(lista, horizontal) {
      const out = [];
      for (const b of lista || []) {
        if (b.tipo === "parrafo") out.push(new Paragraph({ style: "Texto", children: runs(b.html) }));
        else if (b.tipo === "titulo") out.push(new Paragraph({ style: "SubtituloPAC", children: [new TextRun(b.texto)] }));
        else if (b.tipo === "destacado") out.push(new Paragraph({ style: "Destacado", children: runs(b.html) }));
        else if (b.tipo === "salto") out.push(new Paragraph({ children: [new PageBreak()] }));
        else if (b.tipo === "lista") {
          const inst = ++numLista;
          for (const it of b.items) out.push(new Paragraph({ style: "Texto", alignment: AlignmentType.LEFT, numbering: { reference: b.ordenada ? "pac-num" : "pac-vinetas", level: it.nivel ? 1 : 0, instance: b.ordenada ? inst : 0 }, spacing: { after: 60 }, children: runs(it.html) }));
        } else if (b.tipo === "imagen" && /^data:image\/(png|jpe?g|gif)/.test(b.src || "")) {
          const tam = await tamImagen(b.src);
          const maxPx = (ancho(horizontal) / 1440) * 96 * (Math.min(100, b.ancho || 100) / 100);
          const k = Math.min(1, maxPx / tam.w, (horizontal ? 420 : 760) / tam.h);
          const tipo = /png/.test(b.src) ? "png" : /gif/.test(b.src) ? "gif" : "jpg";
          out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: b.pie ? 40 : 200 }, children: [new ImageRun({ type: tipo, data: dataABytes(b.src), transformation: { width: Math.round(tam.w * k), height: Math.round(tam.h * k) } })] }));
          if (b.pie) out.push(new Paragraph({ style: "Pie", children: [new TextRun(b.pie)] }));
        } else if (b.tipo === "tabla" && b.filas?.length) out.push(tabla(b, horizontal), new Paragraph({ spacing: { after: 120 }, children: [] }));
      }
      return out;
    }

    // Anchos de columna: el mismo reparto que en la web y el PDF
    function anchos(filas, total) {
      const w = window.PAC.anchosColumnas(filas).map((x) => Math.floor(x * total));
      w[w.length - 1] += total - w.reduce((a, b) => a + b, 0);
      return w;
    }
    function tabla(b, horizontal) {
      const total = ancho(horizontal), C = b.filas[0].length;
      const w = anchos(b.filas, total), sp = spans(b.filas);
      const tam = C >= 6 ? 14 : 16;   // medios puntos: 7 o 8 pt
      const borde = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
      const filas = sp.map((fila, r) => {
        const cab = b.cabecera && r === 0, par = !cab && (r - (b.cabecera ? 1 : 0)) % 2 === 1;
        const celdas = [];
        fila.forEach((s, c) => {
          if (!s) return;
          const anchoCelda = w.slice(c, c + s.cs).reduce((a, x) => a + x, 0);
          const fondo = cab ? AZUL : s.rs > 1 ? CLARO : par ? CEBRA : null;
          celdas.push(new TableCell({
            columnSpan: s.cs > 1 ? s.cs : undefined, rowSpan: s.rs > 1 ? s.rs : undefined,
            width: { size: anchoCelda, type: WidthType.DXA },
            verticalAlign: cab ? VerticalAlign.CENTER : VerticalAlign.TOP,
            shading: fondo ? { type: ShadingType.CLEAR, color: "auto", fill: fondo } : undefined,
            borders: cab ? { top: { style: BorderStyle.SINGLE, size: 4, color: AZUL }, bottom: { style: BorderStyle.SINGLE, size: 4, color: AZUL }, left: { style: BorderStyle.SINGLE, size: 4, color: AZUL }, right: { style: BorderStyle.SINGLE, size: 4, color: AZUL } } : { top: borde, bottom: borde, left: borde, right: borde },
            margins: { top: 70, bottom: 70, left: 90, right: 90 },
            children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(s.html, { size: tam, ...(cab ? { bold: true, color: "FFFFFF" } : c === 0 ? { color: TEXTO } : {}) }) })],
          }));
        });
        return new TableRow({ tableHeader: cab, cantSplit: false, children: celdas });
      });
      return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, rows: filas });
    }

    // ── Títulos de los apartados (estilos Título 1-3 de Word: los usa el índice) ──
    function titulo(n) {
      const nivel = n.nivel - nivelBase;
      const heading = nivel === 1 ? HeadingLevel.HEADING_1 : nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      return new Paragraph({ heading, children: [
        ...(n.numero ? [new TextRun({ text: n.numero + "  ", color: nivel === 1 ? VERDE : AZUL })] : []),
        new TextRun(n.titulo)] });
    }

    // ── Cabecera y pie ──
    const cabecera = (h) => new Header({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: ancho(h) }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 4 } },
      children: [new ImageRun({ type: "png", data: logoH, transformation: { width: 92, height: 34 } }),
        new TextRun({ text: "\tPLAN ANUAL DE CENTRO · " + curso.nombre, size: 14, color: SUAVE, characterSpacing: 20 })],
    })] });
    const pie = (h) => new Footer({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: ancho(h) }],
      children: [new SimpleField(' STYLEREF "Heading 1" \\* MERGEFORMAT ', raiz ? raiz.etiqueta : ""),
        new TextRun({ text: "\t" }), new TextRun({ children: [PageNumber.CURRENT], bold: true, color: AZUL, size: 17 })],
      run: { size: 15, color: SUAVE },
    })] });
    const pagina = (h) => ({ size: { width: A4.w, height: A4.h, orientation: h ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: h ? MARGEN_H : MARGEN_V });

    // ── Secciones ──
    const secciones = [];
    if (!raiz) {
      secciones.push({
        properties: { page: { size: { width: A4.w, height: A4.h }, margin: { top: 1134, bottom: 1134, left: 1300, right: 1300 } } },
        children: [
          new Paragraph({ shading: { type: ShadingType.CLEAR, color: "auto", fill: AZUL }, spacing: { after: 0 }, children: [new TextRun({ text: " ", size: 20 })] }),
          new Paragraph({ shading: { type: ShadingType.CLEAR, color: "auto", fill: VERDE }, spacing: { after: 1100 }, children: [new TextRun({ text: " ", size: 6 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1000 }, children: [new ImageRun({ type: "png", data: logoV, transformation: { width: 250, height: 217 } })] }),
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: (cfg.centro || "").toUpperCase(), bold: true, color: NARANJA, size: 21, characterSpacing: 40 })] }),
          new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: "Plan Anual", bold: true, color: AZUL, size: 80 })] }),
          new Paragraph({ spacing: { after: 160, line: 240 }, children: [new TextRun({ text: "de Centro", bold: true, color: AZUL, size: 80 })] }),
          new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: "Curso " + curso.nombre, color: TEXTO, size: 44 })] }),
          new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: "▬▬▬", color: VERDE, size: 28 })] }),
          ...(curso.lema ? [new Paragraph({ spacing: { after: 1400 }, children: [new TextRun({ text: curso.lema, italics: true, color: AZUL_OSC, size: 28 })] })] : [new Paragraph({ spacing: { after: 1400 }, children: [] })]),
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 18, color: NARANJA, space: 8 } }, spacing: { after: 40 }, children: [new TextRun({ text: curso.subtitulo || cfg.centro || "", bold: true, color: AZUL, size: 22 })] }),
          new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: cfg.direccion || "", color: SUAVE, size: 17 })] }),
          new Paragraph({ children: [new TextRun({ text: cfg.web || "", color: SUAVE, size: 17 })] }),
        ],
      });
      secciones.push({
        properties: { page: pagina(false) },
        headers: { default: cabecera(false) }, footers: { default: pie(false) },
        children: [
          new Paragraph({ style: "TituloIndice", children: [new TextRun("Índice")] }),
          new TableOfContents("Índice", { hyperlink: true, headingStyleRange: "1-3" }),
          new Paragraph({ style: "Pie", alignment: AlignmentType.LEFT, children: [new TextRun("Si el índice aparece vacío, pulsa con el botón derecho sobre él y elige «Actualizar campos».")] }),
        ],
      });
    } else {
      secciones.push(null);   // la cabecera del apartado va al principio del cuerpo
    }

    // El cuerpo se parte en secciones cuando cambia la orientación (páginas apaisadas)
    const horiz = (n) => { for (let p = n; p; p = p.padre) if (p.orientacion === "horizontal") return true; return false; };
    let actual = null;
    for (const n of nodos) {
      const h = horiz(n);
      if (!actual || actual.h !== h) {
        actual = { h, children: [] };
        secciones.push({ properties: { page: pagina(h) }, headers: { default: cabecera(h) }, footers: { default: pie(h) }, children: actual.children, h });
      }
      actual.children.push(titulo(n));
      if (vacio(n.bloques)) { if (!n.hijos.length) actual.children.push(new Paragraph({ style: "Texto", children: [new TextRun({ text: "(Apartado pendiente de redactar)", italics: true, color: SUAVE })] })); }
      else actual.children.push(...(await bloques(n.bloques, h)));
    }
    if (raiz) {
      secciones.shift();
      secciones[0].children.unshift(new Paragraph({ style: "Pie", alignment: AlignmentType.LEFT, children: [new TextRun({ text: `Plan Anual de Centro ${curso.nombre} · ${cfg.centro || ""}`, color: SUAVE })] }));
    }
    secciones.forEach((s) => delete s.h);

    const doc = new Document({
      creator: "PAC · " + (cfg.centro || ""),
      title: `Plan Anual de Centro ${curso.nombre}` + (raiz ? ` · ${raiz.etiqueta}` : ""),
      features: { updateFields: !raiz },
      styles: {
        default: {
          document: { run: { font: FUENTE, size: 19, color: TEXTO }, paragraph: { spacing: { after: 120, line: 276 } } },
          heading1: { run: { font: FUENTE, size: 40, bold: true, color: AZUL }, paragraph: { pageBreakBefore: !raiz, spacing: { before: 0, after: 320 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 6 } } } },
          heading2: { run: { font: FUENTE, size: 27, bold: true, color: AZUL }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true } },
          heading3: { run: { font: FUENTE, size: 22, bold: true, color: AZUL_OSC }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true } },
          hyperlink: { run: { color: AZUL_OSC, underline: {} } },
        },
        paragraphStyles: [
          { id: "Texto", name: "Texto PAC", basedOn: "Normal", quickFormat: true, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 } } },
          { id: "SubtituloPAC", name: "Subtítulo PAC", basedOn: "Normal", quickFormat: true, run: { size: 16, bold: true, color: NARANJA, allCaps: true, characterSpacing: 16 }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true } },
          { id: "Destacado", name: "Destacado PAC", basedOn: "Normal", quickFormat: true, run: { size: 22, italics: true, color: AZUL_OSC },
            paragraph: { spacing: { before: 80, after: 240 }, indent: { left: 280, right: 280 }, shading: { type: ShadingType.CLEAR, color: "auto", fill: "F6F7E3" }, border: { left: { style: BorderStyle.SINGLE, size: 36, color: VERDE, space: 10 } } } },
          { id: "Pie", name: "Pie de imagen PAC", basedOn: "Normal", run: { size: 16, italics: true, color: SUAVE }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 200 } } },
          { id: "TituloIndice", name: "Título índice PAC", basedOn: "Normal", run: { size: 48, bold: true, color: AZUL }, paragraph: { spacing: { after: 360 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: VERDE, space: 6 } } } },
          { id: "TOC1", name: "toc 1", basedOn: "Normal", run: { bold: true, size: 21, color: TEXTO }, paragraph: { spacing: { before: 160, after: 40 }, tabStops: [{ type: TabStopType.RIGHT, position: ancho(false), leader: "dot" }] } },
          { id: "TOC2", name: "toc 2", basedOn: "Normal", run: { size: 19 }, paragraph: { indent: { left: 400 }, spacing: { after: 30 }, tabStops: [{ type: TabStopType.RIGHT, position: ancho(false), leader: "dot" }] } },
          { id: "TOC3", name: "toc 3", basedOn: "Normal", run: { size: 17, color: SUAVE }, paragraph: { indent: { left: 800 }, spacing: { after: 20 }, tabStops: [{ type: TabStopType.RIGHT, position: ancho(false), leader: "dot" }] } },
        ],
      },
      numbering: {
        config: [
          { reference: "pac-vinetas", levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { run: { color: VERDE, bold: true }, paragraph: { indent: { left: 360, hanging: 260 } } } },
            { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { run: { color: AZUL }, paragraph: { indent: { left: 760, hanging: 260 } } } }] },
          { reference: "pac-num", levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { run: { color: AZUL, bold: true }, paragraph: { indent: { left: 400, hanging: 300 } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2)", alignment: AlignmentType.LEFT, style: { run: { color: AZUL }, paragraph: { indent: { left: 800, hanging: 300 } } } }] },
        ],
      },
      sections: secciones,
    });
    const blob = await incrustarFuentes(await Packer.toBlob(doc));
    const nombre = (`PAC ${curso.nombre.replace("/", "-")}` + (raiz ? ` - ${raiz.numero ? raiz.numero + " " : ""}${raiz.titulo}` : "")).replace(/[\\/:*?"<>|]/g, "") + ".docx";
    return { blob, nombre };
  }

  // ── La letra corporativa va dentro del .docx (normal, negrita, cursiva y negrita cursiva) ──
  // Así el Word se ve igual en cualquier ordenador aunque no tenga Fira Sans instalada.
  // Las fuentes incrustadas van «ofuscadas» como pide el formato de Office: los 32 primeros bytes, con una clave por fuente.
  function ofuscar(buf, clave) {
    const k = clave.replace(/[{}-]/g, "").match(/../g).map((h) => parseInt(h, 16)).reverse();
    const out = new Uint8Array(buf);
    for (let i = 0; i < 32 && i < out.length; i++) out[i] ^= k[i % k.length];
    return out;
  }
  async function incrustarFuentes(blob) {
    if (!window.JSZip) return blob;
    try {
      const zip = await JSZip.loadAsync(blob);
      const caras = [["Regular", "embedRegular"], ["Bold", "embedBold"], ["Italic", "embedItalic"], ["BoldItalic", "embedBoldItalic"]];
      let rels = "", emb = "";
      for (let i = 0; i < caras.length; i++) {
        const [cara, etiqueta] = caras[i];
        const clave = "{" + (crypto.randomUUID ? crypto.randomUUID() : window.PAC_DATOS.uuid()).toUpperCase() + "}";
        zip.file(`word/fonts/FiraSans-${cara}.odttf`, ofuscar(await bytes(`fonts/FiraSans-${cara}.ttf`), clave));
        rels += `<Relationship Id="rIdFira${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/FiraSans-${cara}.odttf"/>`;
        emb += `<w:${etiqueta} r:id="rIdFira${i + 1}" w:fontKey="${clave}"/>`;
      }
      const fuente = `<w:font w:name="${FUENTE}"><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/>${emb}</w:font>`;
      let ft = await zip.file("word/fontTable.xml").async("string");
      ft = /<\/w:fonts>/.test(ft) ? ft.replace("</w:fonts>", fuente + "</w:fonts>") : ft.replace(/<w:fonts([^>]*)\/>/, `<w:fonts$1>${fuente}</w:fonts>`);
      zip.file("word/fontTable.xml", ft);
      const rr = zip.file("word/_rels/fontTable.xml.rels");
      let r = rr ? await rr.async("string") : '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
      r = /<\/Relationships>/.test(r) ? r.replace("</Relationships>", rels + "</Relationships>") : r.replace(/<Relationships([^>]*)\/>/, `<Relationships$1>${rels}</Relationships>`);
      zip.file("word/_rels/fontTable.xml.rels", r);
      let ct = await zip.file("[Content_Types].xml").async("string");
      if (!/Extension="odttf"/.test(ct)) ct = ct.replace("</Types>", '<Default ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont" Extension="odttf"/></Types>');
      zip.file("[Content_Types].xml", ct);
      // Que Word las conserve si alguien vuelve a guardar el documento
      let st = await zip.file("word/settings.xml").async("string");
      if (!/embedTrueTypeFonts/.test(st)) st = /<w:displayBackgroundShape[^>]*\/>/.test(st) ? st.replace(/(<w:displayBackgroundShape[^>]*\/>)/, "$1<w:embedTrueTypeFonts/>") : st.replace(/(<w:settings[^>]*>)/, "$1<w:embedTrueTypeFonts/>");
      zip.file("word/settings.xml", st);
      return await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
    } catch (e) { console.warn("No se ha podido incrustar la letra en el Word", e); return blob; }
  }

  window.PAC_WORD = { generar };
})();
