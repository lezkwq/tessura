import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as protectedRoute } from '@/routes/_authenticated/route';
import { Route as loginRoute } from '@/routes/login';
import { Route as homeRoute } from '@/routes/index';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: vi.fn() } } }));

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it('sends signed-out protected visits to /login', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'No session', status: 400, __isAuthError: true } });
    const guard = protectedRoute.options.beforeLoad;
    if (!guard) throw new Error('Missing guard');
    await expect((guard as () => Promise<void>)()).rejects.toMatchObject({ options: { to: '/login', replace: true } });
  });
  it('sends signed-out home visits to /login', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError', message: 'No session', status: 400, __isAuthError: true } });
    const guard = homeRoute.options.beforeLoad;
    if (!guard) throw new Error('Missing home guard');
    await expect((guard as () => Promise<void>)()).rejects.toMatchObject({ options: { to: '/login' } });
  });
  it('sends an existing session away from login to /dashboard', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'owner' } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    const guard = loginRoute.options.beforeLoad;
    if (!guard) throw new Error('Missing login guard');
    await expect((guard as () => Promise<void>)()).rejects.toMatchObject({ options: { to: '/dashboard', replace: true } });
  });
});
