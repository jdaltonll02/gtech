const active = new Set();

export function enqueue(name, work, { retries = 3, delayMs = 60_000 } = {}) {
  const promise = (async () => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try { return await work(); }
      catch (error) {
        if (attempt === retries) {
          console.error('Background job failed', { job: name, message: error.message, attempts: attempt + 1 });
          return undefined;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * (2 ** attempt)));
      }
    }
  })();
  active.add(promise);
  promise.finally(() => active.delete(promise));
}

export async function drainJobs() { await Promise.allSettled(active); }
