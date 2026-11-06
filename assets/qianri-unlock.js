(() => {
  'use strict';
  const form = document.getElementById('qianri-unlock-form');
  const input = document.getElementById('qianri-password');
  const status = document.getElementById('qianri-status');
  const submit = form.querySelector('button');
  const record = JSON.parse(document.getElementById('qianri-encrypted').textContent);
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const encoded = value => btoa(String.fromCharCode(...value));
  // The value is a derived key, never the password. It is scoped to this tab,
  // this period and this build; it is still a bearer credential until tab close.
  const storageKey = `qianri-v1-${record.period}-${record.salt}`;
  function savedKey() { try { return sessionStorage.getItem(storageKey); } catch (_) { return null; } }
  function saveKey(value) { try { sessionStorage.setItem(storageKey, value); } catch (_) {} }
  function clearKey() { try { sessionStorage.removeItem(storageKey); } catch (_) {} }
  function busy(value) { submit.disabled = value; form.setAttribute('aria-busy', String(value)); }
  async function openWith(raw) {
    const key = await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes(record.iv), tagLength:128}, key, bytes(record.ciphertext));
    return new TextDecoder('utf-8', {fatal:true}).decode(plaintext);
  }
  function show(html) { document.open(); document.write(html); document.close(); }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!globalThis.crypto?.subtle) {
      status.textContent = '此浏览器无法解锁课程，请使用支持安全连接的现代浏览器。'; return;
    }
    if (!input.value) { status.textContent = '请输入本期密码。'; input.focus(); return; }
    busy(true); status.textContent = '正在验证密码……';
    let raw;
    try {
      const password = new TextEncoder().encode(input.value.normalize('NFC'));
      input.value = '';
      const material = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
      password.fill(0);
      raw = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:bytes(record.salt), iterations:record.iterations}, material, 256));
      const html = await openWith(raw);
      saveKey(encoded(raw));
      show(html);
    } catch (_) {
      status.textContent = '密码不正确，请重新输入。'; input.focus();
    } finally { if (raw) raw.fill(0); busy(false); }
  });
  const prior = savedKey();
  if (prior && globalThis.crypto?.subtle) {
    busy(true); status.textContent = '正在进入课程……';
    (async () => {
      let raw;
      try { raw = bytes(prior); show(await openWith(raw)); }
      catch (_) { clearKey(); status.textContent = '请输入本期密码，进入课程目录。'; }
      finally { if (raw) raw.fill(0); busy(false); }
    })();
  }
})();
