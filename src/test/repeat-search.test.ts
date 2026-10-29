import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/lib/apify.server', () => ({
  assertOwner: vi.fn(), startRun: vi.fn(), readRun: vi.fn(), readDataset: vi.fn(),
  cleanPlace: vi.fn(), baseInput: {},
}));

import { beginSearch } from '@/lib/prospeccao.functions';
import { startRun } from '@/lib/apify.server';

type SearchStatus = 'ready' | 'exhausted' | 'running';
const input = { city: 'Balneario Camboriu', state: 'SC', niche: 'hamburgueria' };
const rows = [{ id: 'first', score: 4.8 }, { id: 'second', score: 4.2 }];

function setup(status: SearchStatus, batch: typeof rows) {
  const search = { id: 'existing-search', status };
  const selected = { select: vi.fn(), match: vi.fn(), maybeSingle: vi.fn() };
  selected.select.mockReturnValue(selected);
  selected.match.mockReturnValue(selected);
  selected.maybeSingle.mockResolvedValue({ data: search, error: null });
  const claim = { eq: vi.fn(), in: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  claim.eq.mockReturnValue(claim);
  claim.in.mockReturnValue(claim);
  claim.select.mockReturnValue(claim);
  claim.maybeSingle.mockResolvedValue({ data: null, error: null });
  const update = vi.fn().mockReturnValue(claim);
  const rpc = vi.fn().mockResolvedValue({ data: batch, error: null });
  const db = { from: vi.fn().mockReturnValue({ ...selected, update }), rpc };
  // The mocked builder exposes the original handler, so no RPC protocol is bypassed.
  const call = beginSearch as unknown as (args: {
    data: typeof input; context: { supabase: typeof db; userId: string };
  }) => Promise<{ search: { status: string }; batch: typeof rows }>;
  return { call: () => call({ data: input, context: { supabase: db, userId: 'owner' } }), rpc, update, claim };
}

describe('repeat searches use the full eligible reserve first', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the same companies on two identical searches without starting Apify', async () => {
    const test = setup('ready', rows);
    expect((await test.call()).batch).toEqual(rows);
    expect((await test.call()).batch).toEqual(rows);
    expect(test.rpc).toHaveBeenCalledTimes(2);
    expect(startRun).not.toHaveBeenCalled();
  });

  it('returns eligible reserve companies even when the saved status is exhausted', async () => {
    const test = setup('exhausted', rows);
    expect(await test.call()).toEqual({ search: { id: 'existing-search', status: 'ready' }, batch: rows });
    expect(test.update).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
  });

  it('returns the reserve immediately during a running search without starting another actor', async () => {
    const test = setup('running', rows);
    expect((await test.call()).search.status).toBe('ready');
    expect(startRun).not.toHaveBeenCalled();
  });

  it('does not restart an already running actor when no eligible reserves exist', async () => {
    const test = setup('running', []);
    expect((await test.call()).batch).toEqual([]);
    expect(test.rpc).toHaveBeenCalledWith('take_all', { p_search: 'existing-search' });
    expect(test.update).not.toHaveBeenCalled();
    expect(startRun).not.toHaveBeenCalled();
  });

  it('allows claiming an exhausted search only after an empty reserve is read', async () => {
    const test = setup('exhausted', []);
    await test.call();
    expect(test.claim.in).toHaveBeenCalledWith('status', ['idle', 'ready', 'failed', 'exhausted']);
    expect(test.rpc.mock.invocationCallOrder[0]).toBeLessThan(test.update.mock.invocationCallOrder[0] ?? 0);
  });
});