/**
 * Longitud del código por correo. Debe coincidir con Supabase › Authentication › Email › «Email OTP Length».
 * Se usa 6. La verificación en dos pasos del equipo (TOTP) siempre es de 6.
 */
export const EMAIL_OTP_LENGTH = (() => {
  const n = Number(process.env.NEXT_PUBLIC_EMAIL_OTP_LENGTH ?? 6);
  return Number.isInteger(n) && n >= 6 && n <= 10 ? n : 6;
})();
export const TOTP_LENGTH = 6;
