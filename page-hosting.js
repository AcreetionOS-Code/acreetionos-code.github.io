document.addEventListener('DOMContentLoaded',function(){
document.querySelectorAll('.tab-btn').forEach(function(btn){
btn.addEventListener('click',function(){switchTab(this.getAttribute('data-tab'));});
});
document.getElementById('register-form').addEventListener('submit',registerProvider);
document.getElementById('manage-form').addEventListener('submit',manageListing);
});
