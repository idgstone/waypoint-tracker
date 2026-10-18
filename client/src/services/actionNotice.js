export function scheduleNoticeDismiss(notice, dismiss, schedule = setTimeout, cancel = clearTimeout) {
  if (!notice.text || notice.persistent) return undefined;
  const timer = schedule(dismiss, 4000);
  return () => cancel(timer);
}
