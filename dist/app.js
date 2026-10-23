const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#primary-nav');
function closeMenu() { menuButton?.setAttribute('aria-expanded','false'); menu?.classList.remove('is-open'); document.body.classList.remove('menu-open'); }
menuButton?.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);document.body.classList.toggle('menu-open',open);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();menuButton?.focus();}if(event.key==='Tab'&&menuButton?.getAttribute('aria-expanded')==='true'){const items=[menuButton,...menu.querySelectorAll('a')];const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
menu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
matchMedia('(min-width: 801px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}});},{threshold:.08}) : null;
document.querySelectorAll('.reveal').forEach(el=>{if(observer)observer.observe(el);else el.classList.add('visible');});
document.querySelectorAll('.faq details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open)document.querySelectorAll('.faq details').forEach(other=>{if(other!==detail)other.open=false;});}));
const strengthCards = document.querySelectorAll('.strength-card');
const strengthPanels = document.querySelectorAll('.strength-panel');
if(strengthCards.length && strengthPanels.length){
  function activateStrength(target){
    strengthCards.forEach(card=>{
      const isTarget = card.dataset.target === target;
      card.classList.toggle('is-active', isTarget);
      card.setAttribute('aria-selected', String(isTarget));
    });
    strengthPanels.forEach(panel=>{
      const isTarget = panel.id === `panel-${target}`;
      panel.classList.toggle('is-active', isTarget);
      panel.setAttribute('aria-hidden', String(!isTarget));
    });
  }
  strengthCards.forEach(card=>{
    const target = card.dataset.target;
    card.addEventListener('mouseenter',()=>activateStrength(target));
    card.addEventListener('click',e=>{
      if(e.target.closest('a')) return;
      activateStrength(target);
    });
    card.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        if(e.target.closest('a')) return;
        e.preventDefault();
        activateStrength(target);
      }
    });
  });
}
const interest = new URLSearchParams(location.search).get('interest');
if(interest&&document.querySelector('#interest')) {const select=document.querySelector('#interest');if([...select.options].some(option=>option.value===interest))select.value=interest;}
const form = document.querySelector('#contact-form');
if(form){
  const status=document.querySelector('#form-status');
  let started=Date.now();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;button.textContent='Sending…';status.textContent='';status.className='form-status';
    try{
      const values=Object.fromEntries(new FormData(form));values.elapsed=Date.now()-started;
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values),signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({message:'Contact delivery is not connected on this host. Your message has not been sent.'}));
      if(!response.ok)throw new Error(data.message||'Your message could not be sent. Please try again.');
      status.textContent=data.message;status.classList.add('success');form.reset();started=Date.now();
    }catch(error){status.textContent=error.name==='TimeoutError'?'The request timed out. Please try again.':error.message;status.classList.add('error');}
    finally{button.disabled=false;button.innerHTML='Send your message <span aria-hidden="true">↗</span>';status.focus();}
  });
}
