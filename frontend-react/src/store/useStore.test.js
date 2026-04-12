/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/wasm', () => ({
  batchProcessProcurements: (items) => items,
  generatePlatformUserId: () => 'mock-id',
}));

vi.mock('../services/websocket.js', () => ({
  registerFetchController: () => () => {},
  wsManager: { connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

describe('useStore – session token separation (issue #338)', () => {
  let useStore;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    const mod = await import('./useStore.js');
    useStore = mod.useStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loadUser stores WS token under wsToken key, not authToken', async () => {
    const REAL_AUTH_TOKEN = 'real-api-jwt-token';
    const WS_TOKEN = 'ws-specific-jwt-token';
    const USER_ID = 'user-123';

    localStorage.setItem('authToken', REAL_AUTH_TOKEN);
    localStorage.setItem('userId', USER_ID);

    const mockFetch = vi.fn((url) => {
      if (url.includes(`/users/${USER_ID}/ws_token/`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: WS_TOKEN }),
        });
      }
      if (url.includes(`/users/${USER_ID}/`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: USER_ID, email: 'test@test.com', role: 'buyer' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', mockFetch);

    await useStore.getState().loadUser(USER_ID);

    // Wait for fire-and-forget getWsToken to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(localStorage.getItem('authToken')).toBe(REAL_AUTH_TOKEN);
    expect(localStorage.getItem('wsToken')).toBe(WS_TOKEN);
  });

  it('logout clears wsToken along with other auth keys', async () => {
    localStorage.setItem('authToken', 'tok');
    localStorage.setItem('refreshToken', 'ref');
    localStorage.setItem('wsToken', 'ws');
    localStorage.setItem('userId', 'u1');

    const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    vi.stubGlobal('fetch', mockFetch);

    await useStore.getState().logout();

    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('wsToken')).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
  });
});
