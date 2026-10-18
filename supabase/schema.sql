-- PAC (Plan Anual de Centro) · estructura de la base de datos (Supabase / PostgreSQL)
-- Ejecutar una vez en Supabase → SQL Editor. Después, ejecutar seed.sql (el PAC importado del Word).
-- Puede ir en el mismo proyecto de Supabase que el Control de baños y la Reserva de espacios:
-- todas las tablas empiezan por pac_ y la coordinación del PAC es independiente.

-- ── Cursos: un PAC por curso escolar ─────────────────────────────────────────
create table if not exists pac_cursos (
  id         serial primary key,
  nombre     text not null unique,                 -- "2026/2027"
  lema       text,                                 -- aparece en la portada
  subtitulo  text,                                 -- "Escuelas Salesianas María Auxiliadora · Nervión"
  estado     text not null default 'abierto' check (estado in ('abierto', 'cerrado')),  -- cerrado = solo lectura
  activo     boolean not null default false,       -- el que se abre al entrar
  creado     timestamptz not null default now()
);

-- ── Apartados: el índice del PAC (árbol) y su contenido ──────────────────────
-- bloques: lista de bloques con formato cerrado (párrafo, título, lista, tabla, destacado, imagen, salto).
create table if not exists pac_apartados (
  id              uuid primary key default gen_random_uuid(),
  curso_id        int  not null references pac_cursos(id) on delete cascade,
  padre_id        uuid references pac_apartados(id) on delete cascade,
  orden           int  not null default 0,
  titulo          text not null,
  numerado        boolean not null default true,     -- false: Presentación, Objetivos… (sin número en el índice)
  orientacion     text not null default 'vertical' check (orientacion in ('vertical', 'horizontal')),
  bloques         jsonb not null default '[]',
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'redaccion', 'revision', 'revisado')),
  version         int  not null default 1,           -- evita que dos personas se pisen al guardar
  actualizado_por text,
  actualizado_nombre text,
  actualizado_en  timestamptz
);
create index if not exists pac_apartados_curso on pac_apartados (curso_id, padre_id, orden);

-- ── Historial: cada vez que cambia el contenido se guarda la versión anterior ──
create table if not exists pac_versiones (
  id           bigserial primary key,
  apartado_id  uuid not null references pac_apartados(id) on delete cascade,
  version      int  not null,
  titulo       text,
  bloques      jsonb not null,
  autor        text,
  autor_nombre text,
  fecha        timestamptz not null default now()
);
create index if not exists pac_versiones_apartado on pac_versiones (apartado_id, id desc);

-- ── Roles (equipos): quién edita qué ─────────────────────────────────────────
-- Un rol tiene personas (correos) y apartados. Quien está en un rol edita sus apartados y todo lo que cuelga de ellos.
create table if not exists pac_roles (
  id          serial primary key,
  nombre      text not null unique,      -- "Equipo de Orientación"
  descripcion text,
  color       text not null default '#3490b0'
);
create table if not exists pac_rol_miembros (
  rol_id  int  not null references pac_roles(id) on delete cascade,
  email   text not null check (email = lower(email)),
  primary key (rol_id, email)
);
create table if not exists pac_rol_apartados (
  rol_id       int  not null references pac_roles(id) on delete cascade,
  apartado_id  uuid not null references pac_apartados(id) on delete cascade,
  primary key (rol_id, apartado_id)
);

-- ── Coordinación del PAC (administración): estructura, roles, cursos y revisión ──
create table if not exists pac_admin (
  email text primary key check (email = lower(email))
);

-- ── Funciones de permisos ─────────────────────────────────────────────────────
create or replace function pac_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function pac_es_profesorado() returns boolean
language sql stable as $$ select pac_email() like '%@salesianas.org' $$;

create or replace function pac_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pac_admin where email = pac_email())
$$;

-- ¿Puede la persona que ha entrado editar este apartado? (por un rol suyo en él o en alguno de sus «padres»)
create or replace function pac_puede_editar(ap uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive cadena as (
    select id, padre_id from pac_apartados where id = ap
    union all
    select a.id, a.padre_id from pac_apartados a join cadena c on a.id = c.padre_id
  )
  select pac_es_admin() or exists (
    select 1 from cadena c
      join pac_rol_apartados ra on ra.apartado_id = c.id
      join pac_rol_miembros m on m.rol_id = ra.rol_id
    where m.email = pac_email()
  )
$$;

-- ── Reglas al guardar un apartado (no se pueden saltar desde la web) ──────────
create or replace function pac_al_guardar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  admin boolean := pac_es_admin();
  cerrado boolean;
begin
  select estado = 'cerrado' into cerrado from pac_cursos where id = new.curso_id;
  if cerrado and not admin then
    raise exception 'El PAC de este curso está cerrado: solo coordinación puede cambiarlo';
  end if;
  if tg_op = 'UPDATE' then
    if not admin and (new.titulo is distinct from old.titulo or new.padre_id is distinct from old.padre_id
        or new.orden is distinct from old.orden or new.curso_id is distinct from old.curso_id
        or new.numerado is distinct from old.numerado) then
      raise exception 'Solo coordinación puede cambiar el índice (títulos, orden y apartados)';
    end if;
    if not admin and new.estado = 'revisado' and old.estado is distinct from 'revisado' then
      raise exception 'Solo coordinación puede marcar un apartado como revisado';
    end if;
    if new.bloques is distinct from old.bloques or new.titulo is distinct from old.titulo then
      if new.version is distinct from old.version then
        raise exception 'Otra persona ha guardado este apartado mientras lo editabas. Recarga para ver sus cambios.'
          using errcode = 'P0409';
      end if;
      insert into pac_versiones (apartado_id, version, titulo, bloques, autor, autor_nombre, fecha)
        values (old.id, old.version, old.titulo, old.bloques, old.actualizado_por, old.actualizado_nombre, coalesce(old.actualizado_en, now()));
      new.version := old.version + 1;
      new.actualizado_por := nullif(pac_email(), '');
      new.actualizado_en := now();
      -- Un editor que cambia un apartado ya revisado lo devuelve a «en redacción»
      if not admin and old.estado = 'revisado' then new.estado := 'redaccion'; end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists pac_apartados_guardar on pac_apartados;
create trigger pac_apartados_guardar before insert or update on pac_apartados
  for each row execute function pac_al_guardar();

-- ── Nuevo curso a partir de otro: copia índice, contenido y asignación de roles ──
create or replace function pac_duplicar_curso(origen int, nuevo text, copiar_contenido boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare
  cid int;
begin
  if not pac_es_admin() then raise exception 'Solo coordinación puede crear cursos'; end if;
  insert into pac_cursos (nombre, lema, subtitulo, estado, activo)
    select nuevo, null, subtitulo, 'abierto', false from pac_cursos where id = origen
    returning id into cid;
  create temp table mapa on commit drop as
    select id as viejo, gen_random_uuid() as nuevo from pac_apartados where curso_id = origen;
  insert into pac_apartados (id, curso_id, padre_id, orden, titulo, numerado, orientacion, bloques, estado)
    select m.nuevo, cid, mp.nuevo, a.orden, a.titulo, a.numerado, a.orientacion,
           case when copiar_contenido then a.bloques else '[]'::jsonb end, 'pendiente'
    from pac_apartados a join mapa m on m.viejo = a.id left join mapa mp on mp.viejo = a.padre_id
    order by a.padre_id nulls first;
  insert into pac_rol_apartados (rol_id, apartado_id)
    select ra.rol_id, m.nuevo from pac_rol_apartados ra join mapa m on m.viejo = ra.apartado_id;
  return cid;
end $$;

-- ── Seguridad: todo el profesorado @salesianas.org lee; cada cual edita lo suyo ──
alter table pac_cursos        enable row level security;
alter table pac_apartados     enable row level security;
alter table pac_versiones     enable row level security;
alter table pac_roles         enable row level security;
alter table pac_rol_miembros  enable row level security;
alter table pac_rol_apartados enable row level security;
alter table pac_admin         enable row level security;

do $$ declare t text; begin
  foreach t in array array['pac_cursos', 'pac_roles', 'pac_rol_miembros', 'pac_rol_apartados'] loop
    execute format('drop policy if exists "leer" on %I', t);
    execute format('drop policy if exists "gestionar" on %I', t);
    execute format('create policy "leer" on %I for select to authenticated using (pac_es_profesorado())', t);
    execute format('create policy "gestionar" on %I for all to authenticated using (pac_es_admin()) with check (pac_es_admin())', t);
  end loop;
end $$;

drop policy if exists "leer apartados"    on pac_apartados;
drop policy if exists "crear apartados"   on pac_apartados;
drop policy if exists "editar apartados"  on pac_apartados;
drop policy if exists "borrar apartados"  on pac_apartados;
create policy "leer apartados"   on pac_apartados for select to authenticated using (pac_es_profesorado());
create policy "crear apartados"  on pac_apartados for insert to authenticated with check (pac_es_admin());
create policy "editar apartados" on pac_apartados for update to authenticated
  using (pac_puede_editar(id)) with check (pac_puede_editar(id));
create policy "borrar apartados" on pac_apartados for delete to authenticated using (pac_es_admin());

-- El historial lo escribe la base de datos (trigger) al guardar; lo lee todo el profesorado.
-- La regla de escritura es por si el trigger se ejecuta con las reglas de seguridad activas.
drop policy if exists "leer versiones"    on pac_versiones;
drop policy if exists "guardar versiones" on pac_versiones;
create policy "leer versiones"    on pac_versiones for select to authenticated using (pac_es_profesorado());
create policy "guardar versiones" on pac_versiones for insert to authenticated with check (pac_puede_editar(apartado_id));

-- Coordinación: todos ven quién coordina; coordinación añade cuentas del colegio y quita a otras (no a sí misma)
drop policy if exists "ver coordinacion"    on pac_admin;
drop policy if exists "nueva coordinacion"  on pac_admin;
drop policy if exists "quitar coordinacion" on pac_admin;
create policy "ver coordinacion"    on pac_admin for select to authenticated using (pac_es_profesorado());
create policy "nueva coordinacion"  on pac_admin for insert to authenticated
  with check (pac_es_admin() and email like '%@salesianas.org');
create policy "quitar coordinacion" on pac_admin for delete to authenticated
  using (pac_es_admin() and email <> pac_email());

-- ── Primeras cuentas de coordinación (después se gestionan desde la web) ─────
insert into pac_admin (email) values
  ('mangeles.chavez@salesianas.org'),
  ('laura.ramos@salesianas.org'),
  ('rocio.cano@salesianas.org')
on conflict do nothing;
