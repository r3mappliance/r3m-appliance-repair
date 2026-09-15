/* R3M site script: analytics + lead forms */
(function(){
  // Google Analytics (loaded here so pages need no inline scripts)
  var g=document.createElement('script'); g.async=true; g.src='https://www.googletagmanager.com/gtag/js?id=G-FJN3FGSH20'; document.head.appendChild(g);
  window.dataLayer=window.dataLayer||[]; function gtag(){dataLayer.push(arguments);} window.gtag=gtag;
  gtag('js',new Date()); gtag('config','G-FJN3FGSH20');

  var ENDPOINT='https://formspree.io/f/mrenbjrv';
  function status(form,msg,ok){
    var box=form.querySelector('.form-status')||form.parentNode.querySelector('.form-status');
    if(!box){box=document.createElement('p'); box.className='form-status'; form.appendChild(box);}
    box.textContent=msg; box.style.marginTop='12px'; box.style.fontWeight='700'; box.style.color=ok?'#16a34a':'#dc2626';
  }
  function wire(form){
    // honeypot
    if(!form.querySelector('[name=_gotcha]')){
      var hp=document.createElement('input'); hp.type='text'; hp.name='_gotcha'; hp.tabIndex=-1; hp.autocomplete='off';
      hp.style.cssText='position:absolute;left:-9999px;opacity:0;height:0;width:0'; form.appendChild(hp);
    }
    if(!form.querySelector('[name=_subject]')){
      var s=document.createElement('input'); s.type='hidden'; s.name='_subject'; s.value='New Service Request from R3M Website'; form.appendChild(s);
    }
    var started=Date.now();
    var action=form.getAttribute('action')||ENDPOINT;
    var isJsonApi=action.indexOf('/api/')===0; // our own serverless endpoints expect JSON, not multipart FormData
    form.addEventListener('submit',function(ev){
      ev.preventDefault();
      if(Date.now()-started<2500){ status(form,'Please take a second and try again.',false); return; } // bot speed check
      var btn=form.querySelector('button[type=submit]'); var old=btn?btn.textContent:'';
      if(btn){btn.disabled=true; btn.textContent='Sending...';}
      var fd=new FormData(form);
      var opts;
      if(isJsonApi){
        opts={method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(Object.fromEntries(fd.entries()))};
      } else {
        fd.append('page',location.pathname);
        opts={method:'POST',body:fd,headers:{Accept:'application/json'}};
      }
      fetch(action,opts)
        .then(function(r){ if(!r.ok) throw new Error('bad'); form.reset(); status(form,'Thank you. Your request was sent successfully. R3M will contact you shortly, and you will get a confirmation email if you provided one.',true); if(window.gtag) gtag('event','generate_lead',{form_location:location.pathname}); })
        .catch(function(){ status(form,'Your request could not be sent. Please check the required fields, or call (469) 446-4242.',false); })
        .then(function(){ if(btn){btn.disabled=false; btn.textContent=old;} });
    });
  }
  document.addEventListener('DOMContentLoaded',function(){
    var forms=document.querySelectorAll('form[data-demo-form], form#service-request-form');
    for(var i=0;i<forms.length;i++) wire(forms[i]);
    var rv=document.querySelectorAll('[data-platform]');
    for(var j=0;j<rv.length;j++) rv[j].addEventListener('click',function(){ if(window.gtag) gtag('event','review_click',{platform:this.getAttribute('data-platform')}); });
  });
})();
