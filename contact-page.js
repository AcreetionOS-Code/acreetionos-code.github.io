document.querySelectorAll('.faq-q').forEach(function(el){
  el.addEventListener('click',function(){
    var answer=this.nextElementSibling;
    var isOpen=answer.classList.contains('open');
    document.querySelectorAll('.faq-a.open').forEach(function(a){a.classList.remove('open');});
    document.querySelectorAll('.faq-q.open').forEach(function(q){q.classList.remove('open');});
    if(!isOpen){answer.classList.add('open');this.classList.add('open');}
  });
});
