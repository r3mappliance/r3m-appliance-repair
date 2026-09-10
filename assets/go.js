(function(){
var T=["Hi {name}, this is Ramez with R3M Appliance Repair. Thanks for having me out today. If you have 30 seconds, a quick review helps my small business more than you know: {link} Thank you!", "Hi {name}, Ramez here from R3M Appliance Repair. Glad I could get you taken care of today. If you're happy with the repair, would you mind leaving a quick review? {link} It really helps. Thanks!", "Hi {name}, thank you for choosing R3M Appliance Repair today. One small favor: a short Google review goes a long way for a one-man shop. {link} Appreciate you!", "Hi {name}, it's Ramez (R3M Appliance Repair). Thanks again for today. If everything is running right, a quick review here would mean a lot: {link} Call or text me anytime if you need anything."], LINK="r3mappliancerepair.com/review", i=Math.floor(Math.random()*T.length);
var name=document.getElementById('name'),phone=document.getElementById('phone'),msg=document.getElementById('msg'),toast=document.getElementById('toast');
function first(){var n=name.value.trim().split(/\s+/)[0];return n?n.replace(/^./,function(c){return c.toUpperCase();}):'there';}
function build(){msg.value=T[i].replace('{name}',first()).replace('{link}',LINK);}
function digits(){var d=phone.value.replace(/\D/g,'');if(d.length===10)d='1'+d;return d;}
function say(t){toast.textContent=t;toast.style.display='block';setTimeout(function(){toast.style.display='none';},1800);}
function log(how){try{var L=JSON.parse(localStorage.getItem('r3m_go_log')||'[]');L.unshift({n:name.value.trim()||'—',p:phone.value.trim(),how:how,t:Date.now()});L=L.slice(0,50);localStorage.setItem('r3m_go_log',JSON.stringify(L));render();}catch(e){}}
function render(){var el=document.getElementById('log');try{var L=JSON.parse(localStorage.getItem('r3m_go_log')||'[]');if(!L.length){el.innerHTML='<div><span style="color:var(--muted)">Nothing sent yet.</span></div>';return;}el.innerHTML=L.map(function(x){var d=new Date(x.t);return '<div><span><b>'+x.n.replace(/</g,'&lt;')+'</b> '+(x.p||'')+'</span><span style="color:var(--muted)">'+x.how+' · '+(d.getMonth()+1)+'/'+d.getDate()+'</span></div>';}).join('');}catch(e){el.innerHTML='';}}
name.addEventListener('input',build);
document.getElementById('shuffle').onclick=function(){i=(i+1)%T.length;build();};
document.getElementById('sms').onclick=function(e){e.preventDefault();var d=digits();if(!d){say('Enter the phone number');phone.focus();return;}var body=encodeURIComponent(msg.value);var ios=/iPhone|iPad|iPod/.test(navigator.userAgent);location.href='sms:+'+d+(ios?'&':'?')+'body='+body;log('SMS');};
document.getElementById('wa').onclick=function(e){e.preventDefault();var d=digits();window.open('https://wa.me/'+(d||'')+'?text='+encodeURIComponent(msg.value),'_blank');log('WhatsApp');};
document.getElementById('mail').onclick=function(e){e.preventDefault();location.href='mailto:?subject='+encodeURIComponent('Thank you from R3M Appliance Repair')+'&body='+encodeURIComponent(msg.value);log('Email');};
document.getElementById('copy').onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(msg.value).then(function(){say('Copied');log('Copied');},function(){msg.select();document.execCommand('copy');say('Copied');});};
build();render();
})();
