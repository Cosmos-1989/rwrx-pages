'use strict';
const dialog=document.querySelector('#search-dialog'), input=document.querySelector('#search-input'), results=document.querySelector('#search-results'), status=document.querySelector('#search-status');
let searchIndex=null,searchLoad=null,opener=null;
const root=document.body.dataset.root||'./';
async function loadSearch(){if(searchIndex)return searchIndex;if(!searchLoad)searchLoad=fetch(root+'assets/search-index.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(x=>searchIndex=x).catch(e=>{searchLoad=null;throw e});return searchLoad;}
async function openSearch(){opener=document.activeElement;dialog.showModal();input.focus();await doSearch();}
function closeSearch(){dialog.close();opener?.focus();}
async function doSearch(){const q=input.value.trim().toLocaleLowerCase();results.replaceChildren();if(!q){status.textContent='输入关键词，查找知识点、题组与课文。';return;}status.textContent='正在检索…';try{const data=await loadSearch();if(input.value.trim().toLocaleLowerCase()!==q)return;const terms=q.split(/\s+/);const found=data.filter(p=>terms.every(t=>(p.title+' '+(p.aliases||'')+' '+p.topic+' '+p.text).toLocaleLowerCase().includes(t))).sort((a,b)=>Number(b.title.includes(q))-Number(a.title.includes(q)));status.textContent=`找到 ${found.length} 篇条目`;if(!found.length){results.textContent='没有找到相关内容。试试更短的关键词，如「环境」或「语境」。';return;}for(const p of found.slice(0,30)){const a=document.createElement('a');a.href=root+p.id+'/';const meta=document.createElement('small');meta.textContent=p.category+' / '+p.topic;const title=document.createElement('strong');title.textContent=p.title;const summary=document.createElement('p');summary.textContent=p.summary;a.append(meta,title,summary);results.append(a);}}catch{status.textContent='搜索索引加载失败，请检查连接后重新输入。';}}
document.querySelector('.search-trigger').addEventListener('click',openSearch);document.querySelector('.search-close').addEventListener('click',closeSearch);input.addEventListener('input',doSearch);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSearch();}});document.addEventListener('keydown',e=>{if(e.key==='/'&&!dialog.open&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();openSearch();}});
let selected='all';const listInput=document.querySelector('#list-search');
function filter(){const q=(listInput?.value||'').trim().toLowerCase();let count=0;document.querySelectorAll('.filter-item').forEach(el=>{const show=(selected==='all'||el.dataset.topic===selected||el.dataset.parent===selected||el.dataset.origin===selected)&&el.dataset.search.toLowerCase().includes(q);el.hidden=!show;if(show)count++;});document.querySelector('#list-count').textContent=count+' 篇条目';const empty=document.querySelector('#list-empty');empty.hidden=count!==0;if(count===0&&document.querySelector('.exam-origin-index'))empty.textContent=q?'没有找到匹配条目。请更换关键词。':'该类别暂无收录题目。';}
function selectCatalogFilter(button){selected=button.dataset.filter;document.querySelectorAll('.filter').forEach(x=>{x.classList.toggle('active',x===button);x.setAttribute('aria-pressed',String(x===button));});document.querySelectorAll('[data-exam-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.examFilter===selected)));filter();}
document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>selectCatalogFilter(b)));
document.querySelectorAll('[data-exam-filter]').forEach(b=>b.addEventListener('click',()=>{const filterButton=[...document.querySelectorAll('.filter')].find(x=>x.dataset.filter===b.dataset.examFilter);if(!filterButton)return;selectCatalogFilter(filterButton);document.querySelector('.catalog-results')?.scrollIntoView({block:'start',behavior:'smooth'});}));listInput?.addEventListener('input',filter);
document.querySelector('.print-button')?.addEventListener('click',()=>window.print());
const marginButtons=[...document.querySelectorAll('[data-margin-filter]')];let marginKind='全部';
function filterMargins(kind){marginKind=kind;marginButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marginFilter===kind)));document.querySelectorAll('.margin-note').forEach(n=>n.hidden=kind!=='全部'&&n.dataset.noteKind!==kind);document.querySelectorAll('.margin-notes').forEach(d=>{const visible=d.querySelectorAll('.margin-note:not([hidden])').length;d.hidden=visible===0;d.querySelector('summary span').textContent=visible;});document.querySelectorAll('[data-annotation-ref]').forEach(a=>a.hidden=document.getElementById(a.dataset.annotationRef).hidden);}
marginButtons.forEach(b=>b.addEventListener('click',()=>filterMargins(b.dataset.marginFilter)));
if(matchMedia('(max-width:700px)').matches)document.querySelectorAll('.margin-notes').forEach(d=>d.open=false);
// Native details work without JavaScript; the name attribute and this fallback
// keep each action focused on one paragraph, including legacy fragment links.
const paragraphTranslations=[...document.querySelectorAll('.paragraph-translation')];
paragraphTranslations.forEach(d=>d.addEventListener('toggle',()=>{
 if(d.open)paragraphTranslations.forEach(other=>{if(other!==d)other.open=false;});
}));
let printMarginKind='全部';
window.addEventListener('beforeprint',()=>{printMarginKind=marginKind;filterMargins('全部');document.querySelectorAll('details.answer,details.margin-notes,details.context-group').forEach(d=>{d.dataset.previousOpen=String(d.open);d.open=true;});});
window.addEventListener('afterprint',()=>{document.querySelectorAll('details.answer,details.margin-notes,details.context-group').forEach(d=>d.open=d.dataset.previousOpen==='true');filterMargins(printMarginKind);});
// Evidence follows the same fragment history as ordinary reading anchors.
const evidenceToolbar=document.querySelector('.evidence-toolbar');
const evidenceStatus=document.querySelector('#evidence-status');
const evidenceReturn=document.querySelector('#evidence-return');
// Browsers percent-encode non-ASCII fragments; DOM ids retain their characters.
function fragmentId(hash=location.hash){const id=hash.slice(1);try{return decodeURIComponent(id);}catch{return id;}}
function clearEvidence(){
 document.querySelectorAll('.evidence-active').forEach(el=>el.classList.remove('evidence-active'));
 document.querySelectorAll('.option-analysis.is-evidence-active').forEach(el=>el.classList.remove('is-evidence-active'));
 if(evidenceToolbar){evidenceToolbar.hidden=true;delete evidenceToolbar.dataset.group;}
}
function evidenceAnchors(group){
 // Follow the numbered proof list, including comparisons with excerpts later on the page.
 return [...document.querySelectorAll('.evidence-anchor')]
  .filter(el=>el.dataset.evidenceGroup===group)
  .sort((a,b)=>Number(a.id.split('-').pop())-Number(b.id.split('-').pop()));
}
function syncEvidence(target){
 clearEvidence();
 if(!target?.matches('.evidence-anchor')||!evidenceToolbar)return;
 const group=target.dataset.evidenceGroup;
 document.querySelectorAll('[data-evidence-for]').forEach(el=>{
  if(el.dataset.evidenceFor.split(' ').includes(group))el.classList.add('evidence-active');
 });
 const option=document.getElementById('analysis-'+group);
 option?.classList.add('is-evidence-active');
 const anchors=evidenceAnchors(group);
 const index=anchors.indexOf(target);
 evidenceStatus.textContent=`${target.dataset.evidenceLabel} · 证据 ${index+1} / ${anchors.length}`;
 evidenceReturn.href='#analysis-'+group;
 evidenceToolbar.dataset.group=group;evidenceToolbar.hidden=false;
 evidenceToolbar.querySelector('[data-evidence-step="-1"]').disabled=index===0;
 evidenceToolbar.querySelector('[data-evidence-step="1"]').disabled=index===anchors.length-1;
}
function navigateEvidence(id){
 if(fragmentId()!==id)history.pushState(null,'','#'+id);
 revealAnchor(true);updateToc();
}
document.querySelectorAll('[data-evidence-step]').forEach(button=>button.addEventListener('click',()=>{
 const anchors=evidenceAnchors(evidenceToolbar.dataset.group);
 const index=anchors.findIndex(el=>el.id===fragmentId());
 const next=anchors[index+Number(button.dataset.evidenceStep)];if(next)navigateEvidence(next.id);
}));
function dismissEvidence(){
 const target=document.getElementById(fragmentId());
 if(target?.matches('.evidence-anchor')){
  const paragraph=target.closest('.source-paragraph')||target.closest('p[id]');
  history.replaceState(null,'',paragraph?'#'+paragraph.id:location.pathname+location.search);
  target.classList.remove('anchor-target');
  if(paragraph){paragraph.setAttribute('tabindex','-1');paragraph.focus({preventScroll:true});}
 }
 clearEvidence();
}
document.querySelector('#evidence-clear')?.addEventListener('click',dismissEvidence);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&evidenceToolbar&&!evidenceToolbar.hidden&&!dialog.open)dismissEvidence();});
function revealAnchor(scroll=false){document.querySelectorAll('.anchor-target').forEach(el=>el.classList.remove('anchor-target'));const target=document.getElementById(fragmentId());syncEvidence(target);if(!target)return;if(target.matches('.margin-note')&&target.hidden)filterMargins('全部');if(target.matches('details'))target.open=true;for(let d=target.closest('details');d;d=d.parentElement?.closest('details'))d.open=true;target.classList.add('anchor-target');const clearance=(document.querySelector('.site-header')?.getBoundingClientRect().height||98)+26;const rootPadding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;target.style.scrollMarginTop=Math.max(0,clearance-rootPadding)+'px';if(scroll){const marginOnDesktop=target.matches('.margin-note')&&!matchMedia('(max-width:700px)').matches;target.scrollIntoView({block:marginOnDesktop?'nearest':'start',behavior:'instant'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{
 if(a.matches('.classical-mark')||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;
 // SVG links do not expose HTMLAnchorElement.hash.
 const hash=a.getAttribute('href');
 if(!hash||!document.getElementById(fragmentId(hash)))return;
 e.preventDefault();if(location.hash!==hash)history.pushState(null,'',hash);
 revealAnchor(true);updateToc();
}));
window.addEventListener('hashchange',()=>revealAnchor(true));window.addEventListener('popstate',()=>revealAnchor(true));revealAnchor(Boolean(location.hash));
const tocLinks=[...document.querySelectorAll('.toc nav a')];let tocPending=false;
function updateToc(){if(!tocLinks.length)return;const threshold=(document.querySelector('.site-header')?.getBoundingClientRect().height||98)+55;let current=tocLinks[0];for(const a of tocLinks){const el=document.getElementById(fragmentId(a.hash));if(el&&el.getBoundingClientRect().top<=threshold)current=a;}tocLinks.forEach(a=>{a.classList.toggle('current',a===current);if(a===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
window.addEventListener('scroll',()=>{if(tocPending)return;tocPending=true;requestAnimationFrame(()=>{updateToc();tocPending=false;});},{passive:true});window.addEventListener('resize',updateToc);updateToc();
// Hover explanations are also available by keyboard and touch. Ordinary links
// remain usable without JavaScript and retain modified-click browser behavior.
const classicalMarks=[...document.querySelectorAll('.classical-mark')];
if(classicalMarks.length){
 const panel=document.createElement('aside');panel.className='classical-popover';panel.id='classical-popover';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','文言知识释义');
 const entries=document.createElement('div');entries.className='gloss-entries';
 const close=document.createElement('button');close.type='button';close.className='gloss-close';close.textContent='×';close.setAttribute('aria-label','关闭释义');
 panel.append(entries,close);document.body.append(panel);
 let active=null,timer=null,pinned=false;
 function hide(returnFocus=false){clearTimeout(timer);const previous=active;active?.setAttribute('aria-expanded','false');panel.hidden=true;active=null;pinned=false;if(returnFocus&&previous){previous.focus({preventScroll:true});panel.hidden=true;active=null;previous.setAttribute('aria-expanded','false');}}
 function position(){if(!active||panel.hidden)return;const r=active.getBoundingClientRect(),box=panel.getBoundingClientRect(),gap=12;let x=Math.min(Math.max(gap,r.left),innerWidth-box.width-gap);let y=r.bottom+9;if(y+box.height>innerHeight-gap)y=Math.max(gap,r.top-box.height-9);panel.style.left=x+'px';panel.style.top=y+'px';}
 function show(a,lock=false){
  clearTimeout(timer);if(active!==a){active?.setAttribute('aria-expanded','false');pinned=false;}active=a;pinned=pinned||lock;
  const rows=JSON.parse(a.dataset.glosses||'[]');entries.replaceChildren();
  rows.forEach(row=>{
   const item=document.createElement('section');item.className='gloss-entry';
   const type=document.createElement('p');type.className='gloss-type gloss-type-'+({'实词':'content','虚词':'function','语法':'grammar','文化常识':'culture'}[row.kind]||'content');type.textContent=row.kind;
   const heading=document.createElement('h3');heading.textContent=row.label;
   const explanation=document.createElement('p');explanation.className='gloss-body';explanation.textContent=row.explanation;
   item.append(type,heading,explanation);
   for(const source of row.sourceNotes||[]){
    const extra=source.explanation!==row.explanation;
    const notes=extra?document.createElement('details'):document.createElement('div');notes.className='gloss-source';
    if(extra){const summary=document.createElement('summary');summary.textContent='原注与出处';const text=document.createElement('p');text.textContent=source.explanation;notes.append(summary,text);}
    for(const link of source.links||[]){const a=document.createElement('a');a.href=link.url;a.textContent=link.label;notes.append(a);}
    if(extra||notes.childElementCount)item.append(notes);
   }
   if(row.url){const detail=document.createElement('a');detail.className='gloss-link';detail.textContent='阅读知识条目 →';detail.href=row.url;item.append(detail);}
   entries.append(item);
  });
  panel.hidden=false;a.setAttribute('aria-expanded','true');position();
 }
 function later(){clearTimeout(timer);if(!pinned)timer=setTimeout(()=>{if(!panel.matches(':hover')&&!active?.matches(':hover')&&!panel.contains(document.activeElement)&&document.activeElement!==active)hide();},180);}
 classicalMarks.forEach(a=>{a.removeAttribute('title');a.setAttribute('aria-haspopup','dialog');a.setAttribute('aria-expanded','false');a.setAttribute('aria-controls',panel.id);a.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show(a);});a.addEventListener('pointerleave',later);a.addEventListener('focus',()=>show(a));a.addEventListener('blur',later);a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();show(a,true);if(e.detail===0)(panel.querySelector('.gloss-link')||close).focus();});});
 panel.addEventListener('pointerenter',()=>clearTimeout(timer));panel.addEventListener('pointerleave',later);panel.addEventListener('focusout',later);close.addEventListener('click',()=>hide(true));
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('.classical-mark'))hide();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();hide(panel.contains(document.activeElement));}});
 window.addEventListener('scroll',()=>{if(!panel.hidden)hide();},{passive:true});window.addEventListener('resize',()=>{if(!panel.hidden)position();});
 window.addEventListener('beforeprint',()=>hide());
 function revealGloss(){const id=document.getElementById(fragmentId())?.dataset.glossId;if(!id)return;const a=classicalMarks.find(a=>JSON.parse(a.dataset.glosses).some(row=>row.id===id));if(a)show(a,true);}
 window.addEventListener('hashchange',revealGloss);window.addEventListener('popstate',revealGloss);
 document.addEventListener('click',event=>{const a=event.target.closest('a[href^="#"]');if(a&&!a.matches('.classical-mark'))revealGloss();});
 revealGloss();
}
