/** Variables de entorno. Se leen al usarse (no al compilar) para que el build no dependa de secretos. */
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example.`);
  return v;
}
export const env = {
  supabaseUrl: () => req('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: () => req('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: () => req('SUPABASE_SERVICE_ROLE_KEY'),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  ipSalt: () => req('IP_HASH_SALT'),
  resendKey: () => process.env.RESEND_API_KEY || '',
  emailFrom: () => process.env.EMAIL_FROM || 'Graphique Marketing <portal@graphiquemarketing.com.mx>',
  emailInternal: () => process.env.EMAIL_INTERNAL || '',
  isProduction: () => process.env.PORTAL_ENV === 'production',
};
