export const MAX_PRINT_BYTES = 5_000_000;
export function printError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Use prints PNG, JPG ou WebP.';
  if (file.size > MAX_PRINT_BYTES) return 'Cada print deve ter até 5 MB.';
  return null;
}