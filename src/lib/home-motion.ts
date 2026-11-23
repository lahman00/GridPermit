// Decorative progressive enhancement. Content is always visible without this
// module. No continuous animation loop, telemetry, or scroll interception.
export function enhanceHomeMotion() {
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(min-width: 1021px) and (hover: hover) and (pointer: fine)');
  if (!body.classList.contains('gp-home-page') || reduced.matches || !fine.matches) return;
  body.dataset.homeMotion = '';
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.setAttribute('data-home-enter', '');
      observer.unobserve(entry.target);
    }
  }, { threshold: .08 });
  document.querySelectorAll('.gp-project-nav,.gp-home-path,.gp-home-discover,.gp-statement,.gp-trust-editorial,.gp-lab-section').forEach(section => observer.observe(section));
  const stop = () => { delete body.dataset.homeMotion; observer.disconnect(); };
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); });
  fine.addEventListener('change', () => { if (!fine.matches) stop(); });
  document.addEventListener('keydown', event => {
    if (['Tab','PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(event.key)) stop();
  }, { capture: true });
}
