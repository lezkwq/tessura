import { describe, expect, it } from 'vitest';
import { printError } from '@/lib/print-upload';
describe('Print upload limits', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s at 5 MB', type => expect(printError({type,size:5_000_000})).toBeNull());
  it('rejects above 5 MB', () => expect(printError({type:'image/png',size:5_000_001})).toBe('Cada print deve ter até 5 MB.'));
  it('rejects other types', () => expect(printError({type:'image/gif',size:10})).toBe('Use prints PNG, JPG ou WebP.'));
});