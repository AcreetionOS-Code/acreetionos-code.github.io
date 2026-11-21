    document.querySelectorAll('.faq-q').forEach(function(btn) {
      btn.addEventListener('click', function() {
        this.classList.toggle('open');
        this.nextElementSibling.classList.toggle('open');
      });
    });
  
