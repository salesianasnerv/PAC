# PAC · Plan Anual de Centro

Web para redactar entre todo el claustro el Plan Anual de Centro sin que el formato se descuadre. Se entra con la cuenta de Microsoft 365 del colegio.

- **Todo el claustro lee** el PAC completo, con su índice.
- **Cada equipo edita solo sus apartados.** Quién edita qué se decide con **roles**: un rol (por ejemplo, «Equipo de Orientación») tiene personas y apartados. Quien está en el rol edita esos apartados y todo lo que cuelga de ellos.
- **El formato no se puede romper.** Cada apartado se escribe con bloques: párrafo, subtítulo, lista, tabla, tabla de objetivos, destacado, imagen y salto de página. Solo se puede poner negrita, cursiva, subrayado y enlaces. La letra, los colores, los tamaños y los márgenes los pone siempre la web. Lo que se pega desde Word llega sin su formato, y las tablas pegadas se convierten en tablas del PAC (con sus celdas unidas).
- **La numeración y el índice son automáticos.** Si se mueve o se añade un apartado, todo se renumera solo.
- **Descargas en cualquier momento**, del PAC completo o de un solo apartado (con sus subapartados):
  - **PDF maquetado:** portada, índice con números de página, cabecera con el logo, pie con la sección y la página, títulos y tablas con los colores corporativos, y la fila de títulos repetida cuando una tabla pasa de página. Los apartados marcados como «horizontal» salen en páginas apaisadas.
  - **Word (.docx):** el mismo diseño, con los estilos de Word (Título 1, 2 y 3), un índice automático de Word, la cabecera y el pie, y las páginas apaisadas donde toque.
- **Seguimiento:** el estado de cada apartado (Pendiente, En redacción, Listo para revisar, Revisado), quién lo cambió por última vez y qué apartados siguen vacíos. Se puede filtrar por equipo.
- **Historial:** cada vez que alguien guarda, se conserva la versión anterior. Se puede ver y recuperar.
- **Sin pisarse:** si dos personas editan a la vez el mismo apartado, la segunda en guardar recibe un aviso y elige qué hacer. Mientras se escribe, se guarda un borrador en el navegador.
- **Un PAC por curso.** Al empezar el curso, coordinación crea el nuevo a partir del anterior: se copian el índice, los equipos y, si se quiere, el contenido. Los PAC antiguos se pueden cerrar y quedan en solo lectura.

## Coordinación

Las cuentas de coordinación ven el menú **Coordinación**, con tres pantallas:

- **Índice y apartados:** cambiar títulos, subir y bajar apartados, meterlos o sacarlos de nivel, añadir subapartados, quitarles el número (Presentación, Objetivos…), ponerlos en horizontal y borrarlos.
- **Roles y permisos:** crear, renombrar y borrar roles; añadir o quitar personas (se pueden pegar varios correos a la vez, y si falta `@salesianas.org` se añade solo); marcar los apartados que edita cada rol; y gestionar las cuentas de coordinación.
- **Cursos y portada:** el lema y el subtítulo de la portada, el curso actual, cerrar o reabrir un PAC y crear el del curso siguiente.

Además, coordinación edita cualquier apartado y es la única que puede marcarlos como **Revisado**. Si un equipo cambia un apartado ya revisado, vuelve solo a «En redacción».

## Probarla ahora (modo prueba)

Con `supabaseUrl` vacío en `config.js` (así viene), la web funciona sin servidor y guarda los datos solo en tu navegador. Ya trae cargado el **PAC 2026/2027 importado del Word**: 80 apartados con sus tablas e imágenes, y un rol por cada equipo y departamento.

Al entrar eliges con qué permisos probar: **Coordinación**, **Miembro del Equipo de Orientación** (solo puede editar el 1.4) o **Profesorado** (solo lectura). El enlace «Volver al PAC importado del Word» deshace todo lo probado.

## Ponerla en marcha (reutiliza el Supabase del Control de baños)

Las tablas de esta web empiezan por `pac_` y no tocan las del Control de baños ni las de la Reserva de espacios. Como ese proyecto ya tiene configurado el acceso con Microsoft 365, **no hace falta pedir nada a informática**.

1. **Base de datos.** En https://supabase.com, abre el proyecto del Control de baños y entra en *SQL Editor*. Pega y ejecuta `supabase/schema.sql` y después `supabase/seed.sql`, que carga el PAC 2026/2027 importado del Word y los roles de partida. Si lo ejecutas dos veces no pasa nada: si el curso ya existe, `seed.sql` no lo toca.
2. **Cuentas de coordinación.** Al final de `schema.sql` hay tres cuentas (mangeles.chavez, laura.ramos y rocio.cano). Cámbialas antes de ejecutarlo si hace falta; las demás se añaden desde la web.
3. **Publicar.** Sube esta carpeta a un repositorio nuevo de GitHub (por ejemplo, `pac`). En https://vercel.com, entra en *Add New → Project* e impórtalo. En *Framework Preset* elige **Other**, sin comando de compilación. Anota la dirección que te dé (por ejemplo, `https://pac-nervion.vercel.app`).
4. **Permitir la vuelta tras el login.** En Supabase, en *Authentication → URL Configuration → Redirect URLs*, añade `https://pac-nervion.vercel.app/**` (con tu dirección). **No cambies la *Site URL***, porque es la del Control de baños.
5. **Pasar a modo real.** En `config.js`, borra las dos líneas vacías de `supabaseUrl` y `supabaseAnonKey`, quita las `//` de las dos de debajo y súbelo a GitHub. Vercel publica la nueva versión solo en un minuto.
6. **Poner a cada persona en su rol.** En *Coordinación → Roles y permisos*, añade los correos de cada equipo. Revisa también qué apartados tiene cada rol: los de partida son uno por equipo y uno por departamento.
7. Añádela al portal https://claustro-utilidades.vercel.app/ (en `utilidades.js`).

## Seguridad

- Solo pueden entrar cuentas **@salesianas.org**. Lo comprueban las reglas RLS de `supabase/schema.sql`, no solo la web.
- La base de datos solo deja guardar un apartado a coordinación o a alguien que esté en un rol con ese apartado (o con uno de sus «padres»). Aunque alguien intente saltarse la web, no puede editar lo que no le toca.
- Solo coordinación puede cambiar el índice (títulos, orden, niveles), los roles y los cursos, y marcar apartados como revisados.
- En un PAC cerrado solo puede escribir coordinación.
- El historial lo escribe la propia base de datos cada vez que cambia un apartado, así que no se puede borrar desde la web.

## Algunas notas

- **PDF:** el botón abre el documento ya maquetado. Pulsa **Guardar como PDF** y, en el cuadro de impresión, elige *Guardar como PDF* como destino. Funciona mejor en Chrome o Edge. El PAC completo tarda unos segundos en maquetarse.
- **Word:** al abrirlo, Word pregunta si quieres **actualizar los campos**. Di que sí y se rellena el índice con los números de página. Si no lo pregunta, pulsa con el botón derecho sobre el índice y elige *Actualizar campos*. El documento usa la letra corporativa **Fira Sans** (gratuita). Si el ordenador no la tiene instalada, Word pone una parecida; para que se vea igual que el PDF, instálala desde `fonts/` o desde Google Fonts.
- **Imágenes:** se reducen solas al subirlas (1600 px como mucho) para que el PAC no pese.
- **Importar un PAC de Word** (solo hace falta si algún curso se quiere empezar desde un Word): `Herramientas/importar_pac.py`, en la carpeta de fuera, genera `datos-iniciales.js` y `seed.sql` a partir del .docx.

## Archivos

- `index.html`, `styles.css`, `app.js`: la web (entrar, índice, lectura, seguimiento y descargas).
- `editor.js`: el editor de bloques.
- `admin.js`: las pantallas de coordinación.
- `render.js`: la numeración y el paso del contenido a HTML. Lo comparten la web, el PDF y el Word.
- `documento.css`: el aspecto del contenido (igual en la web y en el PDF).
- `imprimir.html`, `imprimir.js`, `imprimir.css`: el documento maquetado para PDF (con Paged.js, en `lib/`).
- `word.js`: el documento de Word (con la librería docx, en `lib/`).
- `datos.js`: el acceso a los datos (modo prueba o Supabase).
- `config.js`: la conexión con Supabase y los datos del centro que salen en la portada.
- `datos-iniciales.js`: el PAC importado del Word (solo se usa en el modo prueba).
- `supabase/schema.sql`, `supabase/seed.sql`: la base de datos y el PAC inicial.
- `fonts/`: Fira Sans (licencia libre OFL). `img/`: logotipos para el PDF y el Word.
