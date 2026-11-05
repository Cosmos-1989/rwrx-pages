(() => {
  'use strict';
  const form = document.getElementById('qianri-unlock-form');
  const input = document.getElementById('qianri-password');
  const status = document.getElementById('qianri-status');
  const submit = form.querySelector('button');
  const record = JSON.parse(document.getElementById('qianri-encrypted').textContent);
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!globalThis.crypto?.subtle) {
      status.textContent = '此浏览器无法解锁课程，请使用支持安全连接的现代浏览器。';
      return;
    }
    if (!input.value) {
      status.textContent = '请输入本期密码。';
      input.focus();
      return;
    }
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = '正在验证密码……';
    try {
      const password = new TextEncoder().encode(input.value.normalize('NFC'));
      const material = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveKey']);
      password.fill(0);
      const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt: bytes(record.salt), iterations: record.iterations}, material, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
      const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(record.iv), tagLength: 128}, key, bytes(record.ciphertext));
      const html = new TextDecoder('utf-8', {fatal: true}).decode(plaintext);
      input.value = '';
      document.open();
      document.write(html);
      document.close();
    } catch (_) {
      input.value = '';
      status.textContent = '密码不正确，请重新输入。';
      input.focus();
    } finally {
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
