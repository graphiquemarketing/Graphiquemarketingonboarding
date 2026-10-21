-- Datos ficticios para STAGING. Nunca ejecutar en producción.
-- Las cuentas de personal se crean en Supabase Auth (Authentication > Users) y luego se dan de alta en public.staff:
--   insert into public.staff (user_id, role, display_name) values ('<uuid de auth.users>', 'comercial', 'Nombre');
select public._create_request('Contacto ficticio A', 'Ejemplo · Taller Roble', 'roble@ejemplo.test', '5500000001',
  'Ejemplo de staging: queremos cotizaciones desde el sitio.', 'PYME', 'manual', 'Quiero hacer crecer mi negocio', '{}');
select public._create_request('Contacto ficticio B', 'Ejemplo · Andamio Industrial', 'andamio@ejemplo.test', '5500000002',
  'Ejemplo de staging: catálogo de equipos y cotizador.', 'CORPORATE', 'manual', 'Fortalece mi estrategia B2B', '{}');
select public._create_request('Contacto ficticio C', 'Ejemplo · Consultora Lince', 'lince@ejemplo.test', '5500000003',
  null, 'PERSONAL', 'manual', 'Impulsa mi marca personal', '{}');
