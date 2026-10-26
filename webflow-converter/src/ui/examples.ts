/**
 * "Load example" content: a realistic AI-style landing snippet (nav with hover, hero with a canvas,
 * card grid with images, GSAP from a CDN). It includes a few things that cannot be native
 * (`:root` variable, `::before`, a descendant selector, `@keyframes`) so the result panel shows
 * how they are routed to embeds.
 *
 * Ownership: ui.
 */

const GSAP_CDN = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>';

const CSS = `:root {
  --brand: #146ef5;
}

.page_wrapper {
  font-family: Inter, system-ui, sans-serif;
  color: #0f172a;
  background-color: #ffffff;
}

.nav_component {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.nav_logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  text-decoration: none;
}

.nav_menu {
  display: flex;
  gap: 2rem;
}

.nav_link {
  font-size: 0.9375rem;
  color: #475569;
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav_link:hover {
  color: #146ef5;
}

.section_hero {
  position: relative;
  overflow: hidden;
  padding: 7rem 2.5rem 6rem;
}

.section_hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(60% 50% at 50% 0%, rgba(20, 110, 245, 0.18), transparent);
  pointer-events: none;
}

.hero_canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.6;
}

.hero_content {
  position: relative;
  max-width: 48rem;
  margin: 0 auto;
  text-align: center;
}

.hero_title {
  margin: 0 0 1.5rem;
  font-size: 4rem;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.hero_title span {
  color: var(--brand);
}

.hero_text {
  margin: 0 0 2.5rem;
  font-size: 1.25rem;
  line-height: 1.6;
  color: #475569;
}

.hero_actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.button {
  display: inline-block;
  padding: 0.875rem 1.75rem;
  border-radius: 0.5rem;
  background-color: #146ef5;
  color: #ffffff;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.button:hover {
  background-color: #0b5ad4;
  transform: translateY(-0.125rem);
}

.button.is-secondary {
  background-color: transparent;
  color: #0f172a;
  box-shadow: inset 0 0 0 1px #cbd5e1;
}

.section_features {
  padding: 5rem 2.5rem;
  background-color: #f8fafc;
}

.features_grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
  max-width: 72rem;
  margin: 0 auto;
}

.feature_card {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  background-color: #ffffff;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.feature_card:hover {
  box-shadow: 0 1.25rem 2.5rem rgba(15, 23, 42, 0.08);
  transform: translateY(-0.25rem);
}

.feature_image {
  display: block;
  width: 100%;
  height: 12rem;
  object-fit: cover;
}

.feature_body {
  padding: 1.5rem;
}

.feature_badge {
  display: inline-block;
  margin-bottom: 0.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background-color: #e8f0fe;
  color: #146ef5;
  font-size: 0.75rem;
  font-weight: 600;
  animation: pulse 3s ease-in-out infinite;
}

.feature_title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.feature_text {
  margin: 0;
  line-height: 1.6;
  color: #64748b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (max-width: 991px) {
  .hero_title {
    font-size: 3rem;
  }
  .features_grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .nav_menu {
    display: none;
  }
  .section_hero {
    padding: 5rem 1.5rem 4rem;
  }
  .features_grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 479px) {
  .hero_title {
    font-size: 2.25rem;
  }
  .hero_actions {
    flex-direction: column;
  }
}`;

const BODY = `<div class="page_wrapper">
  <header class="nav_component">
    <a href="#" class="nav_logo" aria-label="Nimbus home">Nimbus</a>
    <nav class="nav_menu" aria-label="Main">
      <a href="#features" class="nav_link">Features</a>
      <a href="#pricing" class="nav_link">Pricing</a>
      <a href="#docs" class="nav_link">Docs</a>
    </nav>
    <a href="#signup" class="button">Get started</a>
  </header>

  <main>
    <section class="section_hero">
      <canvas class="hero_canvas" data-hero-canvas aria-hidden="true"></canvas>
      <div class="hero_content">
        <h1 class="hero_title" data-reveal>Analytics that <span>move as fast</span> as your team</h1>
        <p class="hero_text" data-reveal>Nimbus turns raw product events into clear, shareable dashboards in minutes. No SQL required.</p>
        <div class="hero_actions" data-reveal>
          <a href="#signup" class="button">Start free trial</a>
          <a href="#demo" class="button is-secondary">Watch demo</a>
        </div>
      </div>
    </section>

    <section class="section_features" id="features">
      <div class="features_grid">
        <article class="feature_card" data-card>
          <img class="feature_image" src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80" alt="Analytics dashboard with line and bar charts" width="800" height="533" loading="lazy">
          <div class="feature_body">
            <span class="feature_badge">New</span>
            <h2 class="feature_title">Live dashboards</h2>
            <p class="feature_text">Every chart updates in real time as events stream in.</p>
          </div>
        </article>
        <article class="feature_card" data-card>
          <img class="feature_image" src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80" alt="Laptop showing a revenue report" width="800" height="533" loading="lazy">
          <div class="feature_body">
            <span class="feature_badge">Teams</span>
            <h2 class="feature_title">Shared workspaces</h2>
            <p class="feature_text">Invite your team, comment on charts and keep one source of truth.</p>
          </div>
        </article>
        <article class="feature_card" data-card>
          <img class="feature_image" src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80" alt="Code editor open on a laptop" width="800" height="533" loading="lazy">
          <div class="feature_body">
            <span class="feature_badge">API</span>
            <h2 class="feature_title">Developer friendly</h2>
            <p class="feature_text">Send events from any stack with one line of code.</p>
          </div>
        </article>
      </div>
    </section>
  </main>
</div>`;

const JS = `document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero canvas: slowly drifting dots
  const canvas = document.querySelector('[data-hero-canvas]');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const dots = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(20, 110, 245, 0.5)';
      for (const d of dots) {
        d.x = (d.x + d.vx + 1) % 1;
        d.y = (d.y + d.vy + 1) % 1;
        ctx.beginPath();
        ctx.arc(d.x * canvas.width, d.y * canvas.height, d.r * window.devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduceMotion) requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  // GSAP entrance animations
  if (window.gsap && !reduceMotion) {
    gsap.from('[data-reveal]', { y: 32, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 });
    gsap.from('[data-card]', { y: 48, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.15, delay: 0.3 });
  }
});`;

const indent = (text: string, spaces: number): string => {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => (l ? pad + l : l))
    .join('\n');
};

/** Example for the "All-in-One" tab: a full HTML file with `<style>` and `<script>`. */
export const EXAMPLE_COMBINED = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nimbus | Analytics for modern teams</title>
  <style>
${indent(CSS, 4)}
  </style>
</head>
<body>
${indent(BODY, 2)}

  ${GSAP_CDN}
  <script>
${indent(JS, 4)}
  </script>
</body>
</html>
`;

/** Same example split for the "Separate Files" tab. The CDN tag stays in the HTML, like in an index.html. */
export const EXAMPLE_SEPARATE: { html: string; css: string; js: string } = {
  html: `${BODY}\n\n${GSAP_CDN}\n`,
  css: `${CSS}\n`,
  js: `${JS}\n`,
};
