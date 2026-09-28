// MemeBox site: playful emoji. Anything with class "poke" bursts into emoji when clicked.
// window.MemeFun.burst(x, y) is also used by the try-it soundboard. Off for reduced motion.
(() => {
  'use strict';
  const EMOJI = ['😂', '🤣', '😆', '🔊', '🎉', '😹', '💥', '🤪', '✨'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function burst(x, y, count = 10, extra = []) {
    if (reduce.matches) return;
    const pool = [...extra, ...EMOJI];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 90;
      const s = document.createElement('span');
      s.className = 'fx-burst';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = pool[Math.floor(Math.random() * pool.length)];
      s.style.left = x - 12 + 'px';
      s.style.top = y - 12 + 'px';
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist - 30 + 'px');
      s.style.setProperty('--rot', (Math.random() - 0.5) * 160 + 'deg');
      s.style.animationDelay = i * 18 + 'ms';
      document.body.append(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.poke');
    if (!b) return;
    const r = b.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 12, [b.textContent.trim()]);
    b.classList.remove('pop');
    void b.offsetWidth; // restart the pop animation
    b.classList.add('pop');
  });

  window.MemeFun = Object.freeze({ burst });
})();
