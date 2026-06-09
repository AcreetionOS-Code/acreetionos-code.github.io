document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const t = entry.target;
                t.style.willChange = 'opacity,transform';
                t.classList.add('active');
                observer.unobserve(t);
                setTimeout(() => { t.style.willChange = ''; }, 900);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.content-box,.dev-card,.event-card,.repo-card,.aside-card').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
});
