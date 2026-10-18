-- ─── PAC · Documentos actualizados (Coordinación) ───────────────────────────
-- Enlaces a los documentos de cada curso: el PAC aprobado (Word / PDF), documentos de referencia (PEC, memoria…) y otros.
-- Solo coordinación (pac_es_admin) los ve y los cambia. Se puede volver a ejecutar sin perder datos.
-- Si la base de datos ya está en marcha, basta con ejecutar este archivo (también está al final de schema.sql).

create table if not exists pac_documentos (
  id         bigint generated always as identity primary key,
  tipo       text not null default 'otro' check (tipo in ('pac', 'referencia', 'otro')),
  titulo     text not null check (length(trim(titulo)) > 0),
  curso      text not null default '',
  enlace     text not null check (enlace ~* '^https?://'),
  notas      text not null default '',
  creado     timestamptz not null default now(),
  creado_por text not null default lower(coalesce(auth.jwt() ->> 'email', ''))
);
alter table pac_documentos enable row level security;
drop policy if exists "ver documentos"       on pac_documentos;
drop policy if exists "gestionar documentos" on pac_documentos;
create policy "ver documentos"       on pac_documentos for select to authenticated using (pac_es_admin());
create policy "gestionar documentos" on pac_documentos for all    to authenticated
  using (pac_es_admin()) with check (pac_es_admin());
grant select, insert, update, delete on pac_documentos to authenticated;
revoke all on pac_documentos from anon;

notify pgrst, 'reload schema';
