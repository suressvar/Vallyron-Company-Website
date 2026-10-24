const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#primary-nav');
const mobileNav=matchMedia('(max-width: 800px)');
const menuBackground=[...document.querySelectorAll('main,.site-footer')];
const previousInert=new Map();
function closeMenu(returnFocus=false){
  const wasOpen=menuButton?.getAttribute('aria-expanded')==='true';
  menuButton?.setAttribute('aria-expanded','false');
  menuButton?.setAttribute('aria-label','Open navigation');
  menu?.classList.remove('is-open');document.body.classList.remove('menu-open');
  previousInert.forEach((value,element)=>{element.inert=value;});previousInert.clear();
  if(wasOpen&&returnFocus&&mobileNav.matches)menuButton.focus();
}
menuButton?.addEventListener('click',()=>{
  if(menuButton.getAttribute('aria-expanded')==='true'){closeMenu(true);return;}
  menuButton.setAttribute('aria-expanded','true');menuButton.setAttribute('aria-label','Close navigation');
  menu.classList.add('is-open');document.body.classList.add('menu-open');
  menuBackground.forEach(element=>{previousInert.set(element,element.inert);element.inert=true;});
  menu.querySelector('a')?.focus();
});
document.addEventListener('keydown',event=>{
  if(menuButton?.getAttribute('aria-expanded')!=='true')return;
  if(event.key==='Escape'){event.preventDefault();closeMenu(true);}
  if(event.key==='Tab'){
    const items=[menuButton,...menu.querySelectorAll('a')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
menu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>closeMenu()));
mobileNav.addEventListener('change',event=>{if(!event.matches)closeMenu();});
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
  const fields=[...form.querySelectorAll('.field input,.field select,.field textarea,input[name="consent"]')];
  form.noValidate=true; // Keep native required validation when JavaScript is unavailable.
  function validateField(field){
    const value=field.value.trim();
    let message='';
    if(field.validity.valueMissing)message=field.type==='checkbox'?'Please agree to the privacy policy before sending.':field.tagName==='SELECT'?'Please select an area of interest.':'Please enter '+field.labels[0].textContent.replace(/\s*\*.*/,'').toLowerCase()+'.';
    else if(field.validity.typeMismatch)message='Enter a valid email address, such as you@company.com.';
    else if(field.name==='name'&&value.length<2)message='Please enter at least 2 characters for your name.';
    else if(field.name==='company'&&value.length<2)message='Please enter at least 2 characters for your company.';
    else if(field.name==='message'&&value.length<20)message='Please add a little more detail (at least 20 characters).';
    else if(!field.validity.valid)message=field.validationMessage;
    const id=field.id+'-error';
    let error=document.getElementById(id);
    if(!error){
      error=document.createElement('p');error.id=id;error.className='field-error';
      const parent=field.closest('.field')||field.closest('.checkbox-label');
      if(parent.classList.contains('field'))parent.append(error);else parent.after(error);
      field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),id].filter(Boolean).join(' '));
    }
    error.textContent=message;error.hidden=!message;
    if(message)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');
    return !message;
  }
  fields.forEach(field=>{
    field.addEventListener('blur',()=>validateField(field));
    field.addEventListener('input',()=>{if(field.hasAttribute('aria-invalid'))validateField(field);});
    field.addEventListener('change',()=>{if(field.hasAttribute('aria-invalid'))validateField(field);});
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const invalid=fields.filter(field=>!validateField(field));
    if(invalid.length){
      status.textContent='Please check '+invalid.length+' '+(invalid.length===1?'field':'fields')+' marked in the form.';
      status.className='form-status error';invalid[0].focus();return;
    }
    const button=form.querySelector('[type="submit"]');
    button.disabled=true;form.setAttribute('aria-busy','true');button.textContent='Sending…';status.textContent='';status.className='form-status';
    try{
      const values=Object.fromEntries(new FormData(form));values.elapsed=Date.now()-started;
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values),signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({message:'Contact delivery is not connected on this host. Your message has not been sent.'}));
      if(!response.ok)throw new Error(data.message||'Your message could not be sent. Please try again.');
      status.textContent=data.message;status.classList.add('success');form.reset();fields.forEach(field=>field.removeAttribute('aria-invalid'));form.querySelectorAll('.field-error').forEach(error=>{error.hidden=true;error.textContent='';});started=Date.now();
    }catch(error){status.textContent=error.name==='TimeoutError'?'The request timed out. Your entries are still here; please try again.':error instanceof TypeError?'We could not connect. Check your connection and try again; your entries are still here.':error.message;status.classList.add('error');}
    finally{form.removeAttribute('aria-busy');button.disabled=false;button.innerHTML='Send your message <span aria-hidden="true">↗</span>';status.focus();}
  });
}
