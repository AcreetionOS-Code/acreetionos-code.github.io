async function loadNewsletters() {
            const container = document.getElementById("newsletters");
            try {
                const listRes = await fetch("newsletters/list.json");
                if (!listRes.ok) { container.innerHTML = '<p class="error">No newsletters yet.</p>'; return; }
                const entries = await listRes.json();
                if (entries.length === 0) { container.innerHTML = '<p class="error">No newsletters yet.</p>'; return; }
                container.innerHTML = "";
                for (const entry of entries) {
                    const dataRes = await fetch("newsletters/" + entry.filename);
                    const data = await dataRes.json();
                    const div = document.createElement("div");
                    div.className = "newsletter-entry";
                    div.innerHTML = '<h2>' + esc(data.subject) + '</h2><div class="newsletter-date">' + esc(data.date_display) + '</div><div class="newsletter-body">' + esc(data.body) + '</div>';
                    container.appendChild(div);
                }
            } catch (err) { container.innerHTML = '<p class="error">Failed to load newsletters.</p>'; }
        }
        function esc(str) { return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
        document.getElementById('info-icon').addEventListener('click', function() {
          var dd = document.getElementById('info-dropdown');
          dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
        });
        document.getElementById('sub-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('sub-email').value.trim();
            const msg = document.getElementById('sub-msg');
            if (!email) { msg.className = 'sub-msg error'; msg.textContent = 'Please enter your email.'; return; }
            msg.textContent = 'Subscribing...';
            msg.className = 'sub-msg';
            try {
                const recaptchaToken = (window.getRecaptchaToken) ? await window.getRecaptchaToken('newsletter_subscribe') : null;
                const res = await fetch('/api/newsletter/subscribe', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({email: email, recaptchaToken: recaptchaToken})
                });
                const data = await res.json();
                if (data.success) { msg.className = 'sub-msg success'; msg.textContent = 'Subscribed! Check your inbox for confirmation.'; }
                else { msg.className = 'sub-msg error'; msg.textContent = data.message || data.error || 'Failed to subscribe.'; }
            } catch(e) { msg.className = 'sub-msg error'; msg.textContent = 'Network error. Try again.'; }
        });
        loadNewsletters();
