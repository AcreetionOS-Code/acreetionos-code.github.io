(function () {
  'use strict';
  var form = document.getElementById('translator-form');
  var urlInput = document.getElementById('document-url');
  var language = document.getElementById('target-language');
  var button = document.getElementById('translate-btn');
  var status = document.getElementById('translation-status');
  var result = document.getElementById('translation-result');
  var output = document.getElementById('translation-output');
  var sourceLink = document.getElementById('source-link');
  var copyButton = document.getElementById('copy-translation');

  function message(text, type) {
    status.textContent = text;
    status.className = 'status ' + (type || '');
    status.hidden = false;
  }

  function sanitize(html) {
    var shell = document.createElement('div');
    shell.innerHTML = html;
    shell.querySelectorAll('script,style,iframe,object,embed,form').forEach(function (node) { node.remove(); });
    shell.querySelectorAll('*').forEach(function (node) {
      Array.from(node.attributes).forEach(function (attr) {
        if (attr.name.indexOf('on') === 0 || /javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
      if (node.tagName === 'A') { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    });
    return shell.innerHTML;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault(); result.hidden = true; button.disabled = true; button.textContent = 'Translating…';
    message('Fetching the document and translating its text. This can take up to a minute.', 'working');
    try {
      var token = window.getRecaptchaToken ? await window.getRecaptchaToken('translate') : null;
      var response = await fetch('/api/translate-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.value.trim(), targetLanguage: language.value, recaptchaToken: token })
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Translation failed.');
      output.dataset.markdown = data.translation;
      output.innerHTML = sanitize(window.marked ? marked.parse(data.translation) : data.translation.replace(/\n/g, '<br>'));
      sourceLink.href = data.sourceUrl; result.hidden = false;
      message(data.truncated ? 'Translation complete. The source was long, so the first section was translated.' : 'Translation complete.', 'success');
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { message(error.message || 'Translation failed. Please try another public link.', 'error'); }
    finally { button.disabled = false; button.textContent = 'Translate document'; }
  });

  copyButton.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(output.dataset.markdown || output.innerText);
      copyButton.textContent = 'Copied!'; setTimeout(function () { copyButton.textContent = 'Copy translation'; }, 1600);
    } catch (e) { message('Your browser could not copy the translation.', 'error'); }
  });
})();
