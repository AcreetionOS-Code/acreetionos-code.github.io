window.addEventListener('DOMContentLoaded',()=>{document.getElementById('generate-dd-btn').addEventListener('click',generateDD);});

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-hover-bg]').forEach(function (el) {
    el.addEventListener('mouseover', function () { el.style.background = 'rgba(46,204,113,0.2)'; });
    el.addEventListener('mouseout', function () { el.style.background = ''; });
  });
});
