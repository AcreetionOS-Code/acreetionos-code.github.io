document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', function() {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });
});
