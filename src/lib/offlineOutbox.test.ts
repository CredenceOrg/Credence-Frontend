import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock identity epoch module before importing the outbox.
const getIdentityEpochMock = vi.fn<[], string | number | null>(() => 'epoch-1');
vi.mock('./identityEpoch', () => ({
  getIdentityEpoch: () => getIdentityEpochMock(),
}));

import {
  clearOutbox,
  enqueueSettingsPatch,
  flushOutbox,
  getOutboxEntries,
  getOutboxStatus,
  OUTBOX_STORAGE_KEY,
  resetOutboxForTests,
} from './offlineOutbox';

type FetchMock = ReturnType<typeof vi.fn>;

const makeResponse = (ok: boolean, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => ({}),
    text: async () => '',
  }) as unknown as Response;

describe('offlineOutbox', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    getIdentityEpochMock.mockReturnValue('epoch-1');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    resetOutboxForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
    resetOutboxForTests();
    vi.clearAllMocks();
  });

  describe('enqueueSettingsPatch', () => {
    it('persists a single entry to localStorage', () => {
      enqueueSettingsPatch({ theme: 'dark' });

      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      expect(raw).not.toBeNull();

      const entries = getOutboxEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].body).toEqual({ theme: 'dark' });
      expect(entries[0].epoch).toBe('epoch-1');
      expect(entries[0].attempts).toBe(0);
      expect(typeof entries[0].createdAt).toBe('number');
    });

    it('coalesces multiple enqueues into the latest body', () => {
      enqueueSettingsPatch({ theme: 'dark' });
      enqueueSettingsPatch({ theme: 'light', locale: 'en' });
      enqueueSettingsPatch({ locale: 'fr' });

      const entries = getOutboxEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].body).toEqual({ locale: 'fr' });
      expect(entries[0].attempts).toBe(0);
    });

    it('drops entries from a previous identity epoch when enqueuing', () => {
      enqueueSettingsPatch({ theme: 'dark' });

      getIdentityEpochMock.mockReturnValue('epoch-2');
      enqueueSettingsPatch({ theme: 'light' });

      const entries = getOutboxEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].epoch).toBe('epoch-2');
      expect(entries[0].body).toEqual({ theme: 'light' });
    });
  });

  describe('getOutboxEntries', () => {
    it('drops stale-epoch entries on read', () => {
      enqueueSettingsPatch({ theme: 'dark' });
      expect(getOutboxEntries()).toHaveLength(1);

      getIdentityEpochMock.mockReturnValue('epoch-2');
      expect(getOutboxEntries()).toHaveLength(0);
      expect(localStorage.getItem(OUTBOX_STORAGE_KEY)).toBeNull();
    });

    it('returns an empty array when storage is empty', () => {
      expect(getOutboxEntries()).toEqual([]);
    });

    it('returns an empty array when storage is corrupted', () => {
      localStorage.setItem(OUTBOX_STORAGE_KEY, 'not-json');
      expect(getOutboxEntries()).toEqual([]);
    });
  });

  describe('flushOutbox', () => {
    it('replays the queued body and clears the outbox on success', async () => {
      fetchMock.mockResolvedValue(makeResponse(true));
      enqueueSettingsPatch({ theme: 'dark' });

      const result = await flushOutbox();

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/settings');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ theme: 'dark' });

      expect(getOutboxEntries()).toHaveLength(0);
      expect(localStorage.getItem(OUTBOX_STORAGE_KEY)).toBeNull();
    });

    it('replays entries in order', async () => {
      // Force two distinct entries by enqueuing under different epochs is not
      // possible (coalescing), so simulate ordering by writing storage directly.
      const now = Date.now();
      localStorage.setItem(
        OUTBOX_STORAGE_KEY,
        JSON.stringify([
          { epoch: 'epoch-1', body: { step: 1 }, createdAt: now, attempts: 0 },
          { epoch: 'epoch-1', body: { step: 2 }, createdAt: now + 1, attempts: 0 },
        ]),
      );

      fetchMock.mockResolvedValue(makeResponse(true));

      const result = await flushOutbox();

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(firstBody).toEqual({ step: 1 });
      expect(secondBody).toEqual({ step: 2 });
      expect(getOutboxEntries()).toHaveLength(0);
    });

    it('keeps the entry and increments attempts on failure', async () => {
      fetchMock.mockResolvedValue(makeResponse(false, 500));
      enqueueSettingsPatch({ theme: 'dark' });

      const result = await flushOutbox();

      expect(result.ok).toBe(false);
      const entries = getOutboxEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].attempts).toBe(1);
      expect(entries[0].body).toEqual({ theme: 'dark' });
    });

    it('drops stale-epoch entries without sending them', async () => {
      enqueueSettingsPatch({ theme: 'dark' });
      getIdentityEpochMock.mockReturnValue('epoch-2');

      const result = await flushOutbox();

      expect(result.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(getOutboxEntries()).toHaveLength(0);
    });

    it('is single-flight: concurrent flushes share one request', async () => {
      let resolveFetch: (value: Response) => void = () => {};
      fetchMock.mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );
      enqueueSettingsPatch({ theme: 'dark' });

      const first = flushOutbox();
      const second = flushOutbox();

      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolveFetch(makeResponse(true));
      const [r1, r2] = await Promise.all([first, second]);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns ok when the outbox is empty', async () => {
      const result = await flushOutbox();
      expect(result.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('backoff', () => {
    it('schedules retries with exponential backoff between attempts', async () => {
      fetchMock.mockResolvedValue(makeResponse(false, 500));
      enqueueSettingsPatch({ theme: 'dark' });

      // First attempt fails immediately.
      await flushOutbox();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getOutboxEntries()[0].attempts).toBe(1);

      // Before the backoff delay elapses, no retry should fire.
      await vi.advanceTimersByTimeAsync(100);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance past the first backoff window; a retry should fire.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);

      const attemptsAfterSecond = getOutboxEntries()[0]?.attempts ?? 0;
      expect(attemptsAfterSecond).toBeGreaterThanOrEqual(2);
    });
  });

  describe('clearOutbox', () => {
    it('removes all entries from storage', () => {
      enqueueSettingsPatch({ theme: 'dark' });
      expect(getOutboxEntries()).toHaveLength(1);

      clearOutbox();

      expect(getOutboxEntries()).toHaveLength(0);
      expect(localStorage.getItem(OUTBOX_STORAGE_KEY)).toBeNull();
    });
  });

  describe('getOutboxStatus', () => {
    it('reports empty when nothing is queued', () => {
      expect(getOutboxStatus().pending).toBe(0);
    });

    it('reports pending count when entries exist', () => {
      enqueueSettingsPatch({ theme: 'dark' });
      const status = getOutboxStatus();
      expect(status.pending).toBe(1);
    });
  });
});