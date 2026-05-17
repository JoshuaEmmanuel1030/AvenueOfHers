export function parseSupabaseError(error: any): string {
  if (error?.code === '23505') {
    if (error?.message?.includes('sku')) return 'This SKU is already in use. Please choose a unique SKU.';
    return 'A duplicate entry already exists.';
  }
  return error?.message || 'Something went wrong.';
}
