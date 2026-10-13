export function cancelledError() {
  return Object.assign(new Error('저장을 중단했습니다. 입력한 내용은 유지되며 다시 저장할 수 있습니다.'), { code: 'SAVE_CANCELLED' });
}

// Race the operation as well as aborting it: a stalled SDK/token request may
// ignore the signal. Its late completion must not continue to catalog writes.
export async function withDeadline(task, { signal, timeoutMs = 30000, timeoutMessage = '서버 응답이 지연되고 있습니다. 입력한 내용은 유지되니 다시 시도해주세요.' } = {}) {
  const controller = new AbortController();
  let timer;
  const restart = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(Object.assign(new Error(timeoutMessage), { code: 'OPERATION_TIMEOUT' })), timeoutMs);
  };
  const onCancel = () => controller.abort(cancelledError());
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  signal?.addEventListener('abort', onCancel, { once: true });
  restart();
  if (signal?.aborted) onCancel();
  try {
    return await Promise.race([aborted, Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return task(controller.signal, restart);
    })]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
