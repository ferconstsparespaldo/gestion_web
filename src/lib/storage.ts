const BUCKET_PRODUCTOS =
  import.meta.env.VITE_STORAGE_BUCKET_PRODUCTOS?.trim() || 'productos';

const BUCKET_ASSETS =
  import.meta.env.VITE_STORAGE_BUCKET_ASSETS?.trim() || 'assets';

const LOGO_PATH = 'Logo/Logo.png';

export const STORAGE = {
  bucketProductos: BUCKET_PRODUCTOS,
  bucketAssets: BUCKET_ASSETS,
  logoPath: LOGO_PATH,
  logoUrlPorDefecto: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET_ASSETS}/${LOGO_PATH}`,
};
