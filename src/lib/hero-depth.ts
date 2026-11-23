// A small, optional CSS 3D enhancement, fetched only after load and viewport
// entry on a capable fine-pointer device. No render loop or scroll interception.
export function enableHeroDepth(map: HTMLElement) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const board = map.querySelector<HTMLElement>('.gp-route-board');
  if (!board || motion.matches) return;
  map.dataset.depthReady = 'true';
  let frame = 0;
  let x = 0;
  let y = 0;
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0;
    board.style.removeProperty('--depth-x');
    board.style.removeProperty('--depth-y');
  };
  map.addEventListener('pointermove', event => {
    if (motion.matches || !map.hasAttribute('data-visible') || event.pointerType === 'touch') return;
    x = event.clientX; y = event.clientY;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const box = map.getBoundingClientRect();
      board.style.setProperty('--depth-x', `${((x - box.left) / box.width - .5) * 7}deg`);
      board.style.setProperty('--depth-y', `${((y - box.top) / box.height - .5) * -5}deg`);
    });
  }, { passive: true });
  map.addEventListener('pointerleave', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  motion.addEventListener('change', () => {
    if (motion.matches) { reset(); delete map.dataset.depthReady; }
  });
}
