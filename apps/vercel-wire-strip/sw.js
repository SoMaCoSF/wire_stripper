self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('wire-strip-v1').then((c) => c.addAll([
      './',
      './index.html',
      './styles.css',
      './app.js',
      './content/WIRE_STRIPPER_APP.md',
      './content/DEV_DIARY.md',
      './content/diagrams.md',
      './content/gamification.md',
      './content/power_sample.json',
      './content/hexaphexaH_wirestripper.md'
    ]))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
