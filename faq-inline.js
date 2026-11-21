document.addEventListener('DOMContentLoaded', function () {
  var submitBtn = document.getElementById('submit-issue');
  if (submitBtn) { submitBtn.addEventListener('click', function () { submitIssue(); }); }
  document.querySelectorAll('[data-hover-glow]').forEach(function (el) {
    el.addEventListener('mouseover', function () { el.style.boxShadow = '0 0 15px rgba(97,175,239,0.4)'; el.style.transform = 'translateY(-2px)'; });
    el.addEventListener('mouseout', function () { el.style.boxShadow = 'none'; el.style.transform = 'none'; });
  });
});
