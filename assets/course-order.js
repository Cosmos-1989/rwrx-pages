'use strict';
// Move complete question/answer pairs. Canonical fragment IDs never change.
(() => {
 const data = document.getElementById('course-context');
 const key = new URLSearchParams(location.search).get('course');
 if (!data || !key) return;
 let context;
 try { context = JSON.parse(data.textContent)[key]; } catch { return; }
 if (!context) return;
 const prose = document.querySelector('.article > .prose');
 const questions = [...prose.children].filter(el => /^q-\d+$/.test(el.id));
 const pairs = context.order.map(n => [document.getElementById(`q-${n}`), document.getElementById(`a-${n}`)]);
 if (questions.length !== pairs.length || new Set(context.order).size !== pairs.length ||
     pairs.some(pair => pair.some(el => !el || el.parentElement !== prose))) return;
 const marker = document.createComment('course question order');
 prose.insertBefore(marker, questions[0]);
 for (const pair of pairs) for (const el of pair) prose.insertBefore(el, marker);
 marker.remove();
 const nav = document.querySelector('.toc nav');
 const tocPairs = context.order.map(n => [nav.querySelector(`a[href="#q-${n}"]`), nav.querySelector(`a[href="#a-${n}"]`)]);
 if (tocPairs.every(pair => pair.every(Boolean))) {
  const tocMarker = document.createComment('course contents order');
  nav.insertBefore(tocMarker, nav.querySelector('a[href^="#q-"]'));
  for (const pair of tocPairs) for (const el of pair) nav.insertBefore(el, tocMarker);
  tocMarker.remove();
 }
 const numbers = new Map(context.order.map((canonical, i) => [canonical, i + 1]));
 function renumber(text, canonical) {
  return text.replace(new RegExp(`第${canonical}题`), `第${numbers.get(canonical)}题`)
             .replace(new RegExp(`参考答案${canonical}(?!\\d)`), `参考答案${numbers.get(canonical)}`);
 }
 pairs.forEach(([question, answer], i) => {
  const canonical = context.order[i];
  const heading = question.querySelector(':scope > h2');
  if (heading) heading.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = renumber(n.textContent, canonical); });
  answer.querySelector(':scope > summary')?.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = renumber(n.textContent, canonical); });
  tocPairs[i].filter(Boolean).forEach(el => el.textContent = renumber(el.textContent, canonical));
 });
 document.querySelectorAll('.evidence-anchor').forEach(el => {
  const canonical = Number(el.dataset.evidenceGroup.match(/^q(\d+)-/)?.[1]);
  if (!numbers.has(canonical)) return;
  el.dataset.evidenceLabel = renumber(el.dataset.evidenceLabel, canonical);
  el.setAttribute('aria-label', `${el.dataset.evidenceLabel}的文本证据`);
 });
 const banner = document.createElement('aside');
 banner.className = 'course-reading-context';
 banner.setAttribute('aria-label', '当前课程');
 const course = document.createElement('a');
 course.href = `${document.body.dataset.root || '../'}${context.course}/#lesson-${context.lesson}`;
 course.textContent = `${context.title} · 第${context.lesson}讲`;
 const text = document.createElement('p');
 text.textContent = `${context.topic}：本讲重点题优先，其余题目保留完整题组。`;
 const reset = document.createElement('a');
 const url = new URL(location.href); url.searchParams.delete('course');
 reset.href = url.pathname + url.search + url.hash;
 reset.textContent = '按题库题序阅读';
 banner.append(course, text, reset);
 document.querySelector('.article-header').after(banner);
})();
