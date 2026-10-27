// src/lib/helpers.ts

export const formatTime = (secs: number): string => {
  if (isNaN(secs)) return '0:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

/**
 * Race a promise against a timeout. If the promise takes longer than `ms`
 * milliseconds, it rejects with a timeout error rather than hanging Node.js indefinitely.
 */
export const withTimeout = <T>(promiseLike: PromiseLike<T> | Promise<T>, ms: number = 3000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promiseLike)
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};