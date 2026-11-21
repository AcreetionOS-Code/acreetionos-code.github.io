    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active')});
        document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active')});
        this.classList.add('active');
        document.getElementById('tab-' + this.getAttribute('data-tab')).classList.add('active');
      });
    });

    // Before/After slider drag — click anywhere on slider to move handle
    var slider = document.getElementById('slider');
    var after = document.getElementById('slider-after');
    var handle = document.getElementById('slider-handle');
    var isDragging = false;

    function setSlider(x) {
      var rect = slider.getBoundingClientRect();
      var pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      after.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      handle.style.left = pct + '%';
    }

    // Drag the handle OR click anywhere on the slider to set position
    slider.addEventListener('mousedown', function(e) { isDragging = true; setSlider(e.clientX); e.preventDefault(); });
    document.addEventListener('mousemove', function(e) { if (isDragging) setSlider(e.clientX); });
    document.addEventListener('mouseup', function() { isDragging = false; });

    slider.addEventListener('touchstart', function(e) { isDragging = true; setSlider(e.touches[0].clientX); e.preventDefault(); });
    document.addEventListener('touchmove', function(e) { if (isDragging) setSlider(e.touches[0].clientX); });
    document.addEventListener('touchend', function() { isDragging = false; });
  
