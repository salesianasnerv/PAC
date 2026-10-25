-- PAC · las personas de cada rol salen de los grupos de Microsoft 365 (25-10-2026). PEDIR VISTO BUENO A MARIÁN ANTES.
-- Ejecutar en Supabase → SQL Editor, proyecto «Acceso Microsoft 365». Se puede volver a ejecutar.
--
-- Qué cambia
--   · Cada rol del PAC puede tener enlazado un grupo de Microsoft 365 (los que se sincronizan cada noche:
--     Equipo Directivo, Comisión Pedagógica, Orientación, Pastoral, Comunicación…). Las personas del grupo
--     editan los apartados del rol sin apuntarlas a mano, y dejan de hacerlo cuando salen del grupo.
--   · Se siguen pudiendo apuntar personas a mano (por ejemplo, en los departamentos, que no tienen grupo).
--   · Al ejecutarlo se enlazan solos los roles que tienen grupo con el mismo sentido (lista de abajo).
--     Los demás se enlazan, si hace falta, en Coordinación → Roles y permisos.
--   · Solo cambia QUIÉN edita cada apartado. Leer el PAC sigue igual (cualquier cuenta del colegio).

begin;

alter table pac_roles add column if not exists grupo_entra text;

-- Personas de los grupos enlazados (solo nombre y correo del personal, solo para cuentas del colegio)
create or replace function pac_miembros_grupos()
returns table (rol_id int, email text, nombre text)
language sql stable security definer set search_path = public as $$
  select r.id, lower(p.email::text), p.nombre::text
  from pac_roles r join personal p on p.activo and r.grupo_entra = any(p.grupos_entra)
  where pac_es_profesorado()
  order by p.nombre
$$;

-- Grupos que se pueden enlazar
create or replace function pac_grupos_m365()
returns table (clave text, nombre text)
language sql stable security definer set search_path = public as $$
  select g.clave::text, g.nombre::text from entra_grupos g where pac_es_profesorado() order by g.nombre
$$;

-- ¿Puede editar este apartado? Ahora también por el grupo de Microsoft 365 del rol
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
    where exists (select 1 from pac_rol_miembros m where m.rol_id = ra.rol_id and m.email = pac_email())
       or exists (select 1 from pac_roles r join personal p on p.activo and lower(p.email::text) = pac_email()
                  where r.id = ra.rol_id and r.grupo_entra = any(p.grupos_entra))
  )
$$;

revoke execute on function pac_miembros_grupos(), pac_grupos_m365() from public, anon;
grant execute on function pac_miembros_grupos(), pac_grupos_m365() to authenticated;

-- Enlaces de partida (solo si el rol aún no tiene grupo)
update pac_roles r set grupo_entra = v.clave
from (values
  ('Equipo Directivo', 'equipo_directivo'),
  ('Comisión Pedagógica', 'comision_pedagogica'),
  ('Equipo de Orientación', 'orientacion'),
  ('Equipo de Pastoral', 'pastoral'),
  ('Equipo de Comunicación', 'comunicacion'),
  ('Equipo de Idiomas/Bilingüismo', 'idiomas'),
  ('Equipo de Convivencia/Mediación', 'convivencia'),
  ('Equipo Transformación Digital', 'tde')
) as v(rol, clave)
where r.nombre = v.rol and r.grupo_entra is null and exists (select 1 from entra_grupos g where g.clave = v.clave);

commit;

-- Comprobación: cada rol, su grupo y cuántas personas entran por el grupo y a mano
select r.nombre as rol, coalesce(g.nombre, '—') as grupo_m365,
       (select count(*) from personal p where p.activo and r.grupo_entra = any(p.grupos_entra)) as por_grupo,
       (select count(*) from pac_rol_miembros m where m.rol_id = r.id) as a_mano
from pac_roles r left join entra_grupos g on g.clave = r.grupo_entra
order by r.nombre;
