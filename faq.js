document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.faq-question, .faq-q, .accordion-btn, [data-faq]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      this.parentElement.classList.toggle('open');
    });
  });
});
