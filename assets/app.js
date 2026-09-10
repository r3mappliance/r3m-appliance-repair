/* R3M app v1 — local-first. All data access goes through `store` so a cloud backend can replace it later. */
(function(){
'use strict';
var CFG={
  owner:'Ramez', biz:'R3M Appliance Repair', phone:'+14694464242', phoneDisplay:'(469) 446-4242',
  reviewLink:'r3mappliancerepair.com/review',
  appliances:['Refrigerator','Freezer','Washer','Dryer','Dishwasher','Oven / Range','Cooktop','Microwave','Ice maker','Garbage disposal','Wine cooler','Vent hood','Other'],
  brands:['Samsung','LG','Whirlpool','GE','Maytag','KitchenAid','Frigidaire','Bosch','Electrolux','Kenmore','Amana','JennAir','Sub-Zero','Wolf','Viking','Thermador','Miele','Dacor','Fisher & Paykel','Speed Queen','Haier','Other'],
  cities:['Rockwall','Heath','Fate','Royse City','Rowlett','Forney','Sunnyvale','McLendon-Chisholm','Garland','Mesquite','Wylie','Sachse','Other'],
  statuses:[['scheduled','Scheduled'],['onway','On my way'],['working','Working'],['done','Done'],['paid','Paid'],['cancelled','Cancelled']],
  onway:["Hi {name}, this is Ramez with R3M Appliance Repair. I'm on my way to you now, see you in about {eta} minutes.","Hi {name}, Ramez from R3M here. Heading your way now, should be there in roughly {eta} minutes."],
  review:["Hi {name}, this is Ramez with R3M Appliance Repair. Thanks for having me out today. If you have 30 seconds, a quick review helps my small business more than you know: {link} Thank you!","Hi {name}, Ramez here from R3M Appliance Repair. Glad I could get you taken care of today. If you're happy with the repair, would you mind leaving a quick review? {link} It really helps. Thanks!","Hi {name}, thank you for choosing R3M Appliance Repair today. One small favor: a short Google review goes a long way for a one-man shop. {link} Appreciate you!","Hi {name}, it's Ramez (R3M Appliance Repair). Thanks again for today. If everything is running right, a quick review here would mean a lot: {link} Call or text me anytime if you need anything."]
};

/* ---------- storage (IndexedDB) ---------- */
var DB=null;
function open(){return new Promise(function(res,rej){var r=indexedDB.open('r3m',2);r.onupgradeneeded=function(e){var d=e.target.result;['customers','jobs','photos','meta'].forEach(function(n){if(!d.objectStoreNames.contains(n)){var s=d.createObjectStore(n,{keyPath:n==='meta'?'k':'id'});if(n==='jobs'){s.createIndex('date','date');s.createIndex('customerId','customerId');}if(n==='photos')s.createIndex('jobId','jobId');}});};r.onsuccess=function(){DB=r.result;res(DB);};r.onerror=function(){rej(r.error);};});}
function tx(name,mode,fn){return new Promise(function(res,rej){var t=DB.transaction(name,mode);var s=t.objectStore(name);var out=fn(s);t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out);};t.onerror=function(){rej(t.error);};});}
function all(name){return new Promise(function(res,rej){var r=DB.transaction(name).objectStore(name).getAll();r.onsuccess=function(){res(r.result||[]);};r.onerror=function(){rej(r.error);};});}
function get(name,id){return new Promise(function(res,rej){var r=DB.transaction(name).objectStore(name).get(id);r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
function put(name,obj){return tx(name,'readwrite',function(s){s.put(obj);});}
function del(name,id){return tx(name,'readwrite',function(s){s.delete(id);});}
function nextWO(){return get('meta','wo_seq').then(function(m){var n=(m&&m.v)||1000;n+=1;return put('meta',{k:'wo_seq',v:n}).then(function(){return 'WO-'+n;});});}
function migrate(){return all('jobs').then(function(js){var missing=js.filter(function(j){return !j.wo;}).sort(function(a,b){return (a.created||0)-(b.created||0);});return missing.reduce(function(p,j){return p.then(function(){return nextWO().then(function(w){j.wo=w;return put('jobs',j);});});},Promise.resolve());});}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
var store={
  customers:function(){return all('customers');}, customer:function(id){return get('customers',id);}, saveCustomer:function(c){c.updated=Date.now();return put('customers',c).then(function(){return c;});},
  jobs:function(){return all('jobs');}, job:function(id){return get('jobs',id);}, saveJob:function(j){j.updated=Date.now();return put('jobs',j).then(function(){return j;});}, deleteJob:function(id){return del('jobs',id);},
  photos:function(jobId){return all('photos').then(function(p){return p.filter(function(x){return x.jobId===jobId;});});}, savePhoto:function(p){return put('photos',p);}, deletePhoto:function(id){return del('photos',id);},
  exportAll:function(){return Promise.all([all('customers'),all('jobs'),all('photos'),all('meta')]).then(function(r){return {v:2,exported:new Date().toISOString(),customers:r[0],jobs:r[1],photos:r[2],meta:r[3]};});},
  importAll:function(d){if(d.meta)d.meta.forEach(function(m){put('meta',m);});return Promise.all([].concat((d.customers||[]).map(function(c){return put('customers',c);}),(d.jobs||[]).map(function(j){return put('jobs',j);}),(d.photos||[]).map(function(p){return put('photos',p);})));}
};

/* ---------- helpers ---------- */
function $(s,el){return (el||document).querySelector(s);} function $$(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s));}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function todayStr(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(s){if(!s)return '';var p=s.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]);return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}
function fmtTime(t){if(!t)return '';var p=t.split(':');var h=+p[0],m=p[1];var ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+m+' '+ap;}
function digits(p){var d=String(p||'').replace(/\D/g,'');if(d.length===10)d='1'+d;return d;}
function money(n){n=+n||0;return '$'+n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});}
function first(n){return (String(n||'').trim().split(/\s+/)[0]||'there');}
function isIOS(){return /iPhone|iPad|iPod/.test(navigator.userAgent);}
function smsUrl(phone,body){var d=digits(phone);return 'sms:'+(d?'+'+d:'')+(isIOS()?'&':'?')+'body='+encodeURIComponent(body);}
function mapsUrl(c){var q=encodeURIComponent([c.address,c.city,'TX'].filter(Boolean).join(', '));return isIOS()?'maps://?q='+q:'https://www.google.com/maps/search/?api=1&query='+q;}
function toast(t){var el=$('#toast');el.textContent=t;el.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.display='none';},1800);}
function statusLabel(s){var f=CFG.statuses.filter(function(x){return x[0]===s;})[0];return f?f[1]:s;}
function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
function opts(list,val){return list.map(function(v){return '<option'+(v===val?' selected':'')+'>'+esc(v)+'</option>';}).join('');}
function resizeImage(file,max){return new Promise(function(res,rej){var img=new Image();var u=URL.createObjectURL(file);img.onload=function(){var s=Math.min(1,max/Math.max(img.width,img.height));var c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.82));};img.onerror=rej;img.src=u;});}

/* ---------- views ---------- */
var app=$('#app'), title=$('#title'), back=$('#back'), act=$('#act');
function setTop(t,showBack,action){title.textContent=t;back.style.display=showBack?'':'none';act.style.display=action?'':'none';act.textContent=action?action.label:'';act.onclick=action?action.fn:null;}
function setTab(name){$$('.tabs a').forEach(function(a){a.classList.toggle('on',a.dataset.tab===name);});}
function go(h){location.hash=h;}

function jobCard(j,c){
  var name=c?c.name:'(no customer)';var sub=[j.appliance,j.brand].filter(Boolean).join(' · ');var where=c?[c.address,c.city].filter(Boolean).join(', '):'';
  return '<div class="card job" data-go="#/job/'+j.id+'"><div class="when">'+esc(j.time?fmtTime(j.time).replace(' ','<small>')+'</small>':'—')+'</div><div class="body"><div class="name">'+esc(name)+'</div><div class="sub">'+esc(sub||'Appliance repair')+(where?' · '+esc(where):'')+'</div><span class="chip '+esc(j.status)+'">'+esc(statusLabel(j.status))+'</span> <span class="chip wo">'+esc(j.wo||'')+'</span>'+(j.price?' <span class="chip">'+money(j.price)+'</span>':'')+'</div></div>';
}
function bind(){$$('[data-go]').forEach(function(el){el.onclick=function(){go(el.dataset.go);};});}

function viewToday(){
  setTop("Today",false,{label:'+ Job',fn:function(){go('#/job/new');}});setTab('today');
  Promise.all([store.jobs(),store.customers()]).then(function(r){
    var cm={};r[1].forEach(function(c){cm[c.id]=c;});var t=todayStr();
    var todays=r[0].filter(function(j){return j.date===t&&j.status!=='cancelled';}).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});
    var open=r[0].filter(function(j){return j.date<t&&['scheduled','onway','working','done'].indexOf(j.status)>=0;}).sort(function(a,b){return b.date.localeCompare(a.date);});
    var upcoming=r[0].filter(function(j){return j.date>t&&j.status!=='cancelled';}).sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time);}).slice(0,5);
    var h='';
    h+='<div class="section">'+esc(fmtDate(t))+' · '+todays.length+' job'+(todays.length===1?'':'s')+'</div>';
    h+=todays.length?todays.map(function(j){return jobCard(j,cm[j.customerId]);}).join(''):'<div class="card empty">Nothing scheduled today.<br><button class="btn primary small mt" data-go="#/job/new">Add a job</button></div>';
    if(open.length){h+='<div class="section">Still open (past days)</div>'+open.map(function(j){return jobCard(j,cm[j.customerId]).replace('<div class="when">','<div class="when">'+esc(fmtDate(j.date).split(',')[0])+'<br>');}).join('');}
    if(upcoming.length){h+='<div class="section">Coming up</div>'+upcoming.map(function(j){return jobCard(j,cm[j.customerId]).replace('<div class="when">','<div class="when">'+esc(fmtDate(j.date).replace(/^\w+, /,''))+'<br>');}).join('');}
    app.innerHTML=h;bind();
  });
}

function viewJobs(){
  setTop('Jobs',false,{label:'+ Job',fn:function(){go('#/job/new');}});setTab('jobs');
  Promise.all([store.jobs(),store.customers()]).then(function(r){
    var cm={};r[1].forEach(function(c){cm[c.id]=c;});
    var jobs=r[0].sort(function(a,b){return (b.date+(b.time||'')).localeCompare(a.date+(a.time||''));});
    app.innerHTML='<input class="search" id="q" placeholder="Search WO #, name, phone, address…"><div id="list"></div>';
    function render(q){q=(q||'').toLowerCase();var list=jobs.filter(function(j){var c=cm[j.customerId]||{};var hay=[j.wo,(j.wo||'').replace(/\D/g,''),c.name,c.phone,digits(c.phone),c.city,c.address,j.appliance,j.brand,j.model,j.issue].join(' ').toLowerCase();return !q||hay.indexOf(q)>=0||hay.indexOf(q.replace(/\D/g,''))>=0&&/\d/.test(q);});
      var h='',last='';list.forEach(function(j){var m=j.date.slice(0,7);if(m!==last){last=m;var d=new Date(+m.slice(0,4),+m.slice(5)-1,1);h+='<div class="section">'+d.toLocaleDateString('en-US',{month:'long',year:'numeric'})+'</div>';}h+=jobCard(j,cm[j.customerId]).replace('<div class="when">','<div class="when">'+esc(fmtDate(j.date).replace(/^\w+, /,''))+'<br>');});
      $('#list').innerHTML=h||'<div class="card empty">No jobs yet.</div>';bind();}
    render('');$('#q').oninput=function(){render(this.value);};
  });
}

function viewCustomers(){
  setTop('Customers',false,{label:'+ New',fn:function(){go('#/customer/new');}});setTab('customers');
  Promise.all([store.customers(),store.jobs()]).then(function(r){
    var count={};r[1].forEach(function(j){count[j.customerId]=(count[j.customerId]||0)+1;});
    var cs=r[0].sort(function(a,b){return a.name.localeCompare(b.name);});
    app.innerHTML='<input class="search" id="q" placeholder="Search customers…"><div id="list"></div>';
    function render(q){q=(q||'').toLowerCase();var list=cs.filter(function(c){return !q||[c.name,c.phone,c.address,c.city].join(' ').toLowerCase().indexOf(q)>=0;});
      $('#list').innerHTML=list.length?list.map(function(c){return '<div class="card job" data-go="#/customer/'+c.id+'"><div class="body"><div class="name">'+esc(c.name)+'</div><div class="sub">'+esc([c.phone,c.address,c.city].filter(Boolean).join(' · '))+'</div></div><div class="pill">'+(count[c.id]||0)+' job'+((count[c.id]||0)===1?'':'s')+'</div></div>';}).join(''):'<div class="card empty">No customers yet.</div>';bind();}
    render('');$('#q').oninput=function(){render(this.value);};
  });
}

function viewCustomer(id){
  setTab('customers');
  Promise.all([id==='new'?Promise.resolve({id:uid(),name:'',phone:'',email:'',address:'',city:'Rockwall',notes:'',created:Date.now(),isNew:true}):store.customer(id),store.jobs()]).then(function(r){
    var c=r[0];if(!c){app.innerHTML='<div class="card empty">Customer not found.</div>';return;}
    var jobs=r[1].filter(function(j){return j.customerId===c.id;}).sort(function(a,b){return b.date.localeCompare(a.date);});
    var editing=c.isNew||location.hash.indexOf('/edit')>0;
    setTop(c.isNew?'New customer':c.name,true,editing?null:{label:'Edit',fn:function(){go('#/customer/'+c.id+'/edit');}});
    if(editing){
      app.innerHTML='<div class="card"><label>Full name</label><input id="f_name" value="'+esc(c.name)+'" placeholder="Sarah Johnson"><label>Mobile</label><input id="f_phone" type="tel" inputmode="tel" value="'+esc(c.phone)+'" placeholder="(469) 555-1234"><label>Email <span class="muted">(optional)</span></label><input id="f_email" type="email" value="'+esc(c.email)+'"><label>Street address</label><input id="f_address" value="'+esc(c.address)+'" placeholder="123 Main St"><label>City</label><select id="f_city">'+opts(CFG.cities,c.city)+'</select><label>Notes <span class="muted">(gate code, dog, parking…)</span></label><textarea id="f_notes">'+esc(c.notes)+'</textarea><button class="btn primary mt" id="save">Save customer</button>'+(c.isNew?'':'<button class="btn ghost" id="cancel">Cancel</button>')+'</div>';
      $('#save').onclick=function(){c.name=$('#f_name').value.trim();if(!c.name){toast('Name is required');return;}c.phone=$('#f_phone').value.trim();c.email=$('#f_email').value.trim();c.address=$('#f_address').value.trim();c.city=$('#f_city').value;c.notes=$('#f_notes').value.trim();var wasNew=c.isNew;delete c.isNew;store.saveCustomer(c).then(function(){toast('Saved');var ret=sessionStorage.getItem('r3m_return');if(wasNew&&ret){sessionStorage.removeItem('r3m_return');sessionStorage.setItem('r3m_pick_customer',c.id);go(ret);}else go('#/customer/'+c.id);});};
      if($('#cancel'))$('#cancel').onclick=function(){go('#/customer/'+c.id);};
      return;
    }
    var h='<div class="card">'+(c.phone?'<div class="kv"><b>Phone</b><span>'+esc(c.phone)+'</span></div>':'')+(c.email?'<div class="kv"><b>Email</b><span>'+esc(c.email)+'</span></div>':'')+(c.address||c.city?'<div class="kv"><b>Address</b><span>'+esc([c.address,c.city].filter(Boolean).join(', '))+'</span></div>':'')+(c.notes?'<div class="kv"><b>Notes</b><span>'+esc(c.notes)+'</span></div>':'')+'</div>';
    h+='<div class="grid3">'+(c.phone?'<a class="btn small" href="tel:'+esc(c.phone)+'">Call</a><a class="btn small" href="'+esc(smsUrl(c.phone,''))+'">Text</a>':'')+(c.address?'<a class="btn small" href="'+esc(mapsUrl(c))+'" target="_blank">Directions</a>':'')+'</div>';
    h+='<button class="btn primary mt" id="newjob">+ New job for '+esc(first(c.name))+'</button>';
    h+='<div class="section">Job history</div>'+(jobs.length?jobs.map(function(j){return jobCard(j,c).replace('<div class="when">','<div class="when">'+esc(fmtDate(j.date).replace(/^\w+, /,''))+'<br>');}).join(''):'<div class="card empty">No jobs yet.</div>');
    app.innerHTML=h;bind();$('#newjob').onclick=function(){sessionStorage.setItem('r3m_pick_customer',c.id);go('#/job/new');};
  });
}

function viewJob(id){
  setTab('jobs');
  var isNew=id==='new';
  Promise.all([isNew?Promise.resolve(null):store.job(id),store.customers()]).then(function(r){
    var j=r[0],cs=r[1].sort(function(a,b){return a.name.localeCompare(b.name);});
    if(!isNew&&!j){app.innerHTML='<div class="card empty">Job not found.</div>';return;}
    var editing=isNew||location.hash.indexOf('/edit')>0;
    if(isNew){j={id:uid(),wo:'',customerId:sessionStorage.getItem('r3m_pick_customer')||'',date:todayStr(),time:'',appliance:'Refrigerator',brand:'',model:'',issue:'',status:'scheduled',price:'',deposit:'',depositDate:'',notes:'',privateNotes:'',created:Date.now()};sessionStorage.removeItem('r3m_pick_customer');}
    if(editing){
      setTop(isNew?'New job':'Edit job',true,null);
      app.innerHTML='<div class="card">'+(j.wo?'<span class="pill">'+esc(j.wo)+'</span>':'<span class="pill">WO # assigned on save</span>')+'<label>Customer</label><select id="f_cust"><option value="">— choose —</option>'+cs.map(function(c){return '<option value="'+c.id+'"'+(c.id===j.customerId?' selected':'')+'>'+esc(c.name)+(c.city?' · '+esc(c.city):'')+'</option>';}).join('')+'</select><button class="btn ghost small" id="addcust" style="margin-top:6px">+ Add new customer</button>'
        +'<div class="row"><div><label>Date</label><input id="f_date" type="date" value="'+esc(j.date)+'"></div><div><label>Time</label><input id="f_time" type="time" value="'+esc(j.time)+'"></div></div>'
        +'<div class="row"><div><label>Appliance</label><select id="f_app">'+opts(CFG.appliances,j.appliance)+'</select></div><div><label>Brand</label><select id="f_brand"><option value="">—</option>'+opts(CFG.brands,j.brand)+'</select></div></div>'
        +'<label>Model # <span class="muted">(optional)</span></label><input id="f_model" value="'+esc(j.model)+'" autocapitalize="characters">'
        +'<label>Problem</label><textarea id="f_issue" placeholder="Not cooling, leaking, no heat…">'+esc(j.issue)+'</textarea>'
        +'<div class="row"><div><label>Price ($)</label><input id="f_price" type="number" inputmode="decimal" value="'+esc(j.price)+'" placeholder="0"></div><div><label>Status</label><select id="f_status">'+CFG.statuses.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===j.status?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></div></div>'
        +'<div class="row"><div><label>Deposit taken ($)</label><input id="f_dep" type="number" inputmode="decimal" value="'+esc(j.deposit)+'" placeholder="0"></div><div><label>Deposit date</label><input id="f_depdate" type="date" value="'+esc(j.depositDate||'')+'"></div></div>'+'<label>Work notes <span class="muted">(printed on the invoice)</span></label><textarea id="f_notes" placeholder="Replaced heating element and thermal fuse. Tested 2 cycles.">'+esc(j.notes)+'</textarea>'+'<label>Private notes <span class="muted">(only you see these)</span></label><textarea id="f_pnotes" placeholder="Part cost $42 from Marcone. Customer wants a call before any extra charge.">'+esc(j.privateNotes||'')+'</textarea><button class="btn primary mt" id="save">Save job</button>'+(isNew?'':'<button class="btn ghost" id="cancel">Cancel</button><button class="btn ghost danger" id="del">Delete job</button>')+'</div>';
      $('#addcust').onclick=function(){sessionStorage.setItem('r3m_return','#/job/'+(isNew?'new':j.id+'/edit'));go('#/customer/new');};
      $('#save').onclick=function(){j.customerId=$('#f_cust').value;if(!j.customerId){toast('Pick a customer');return;}j.date=$('#f_date').value||todayStr();j.time=$('#f_time').value;j.appliance=$('#f_app').value;j.brand=$('#f_brand').value;j.model=$('#f_model').value.trim();j.issue=$('#f_issue').value.trim();j.price=$('#f_price').value;j.status=$('#f_status').value;j.deposit=$('#f_dep').value;j.depositDate=$('#f_depdate').value;if(j.deposit&&!j.depositDate)j.depositDate=todayStr();j.notes=$('#f_notes').value.trim();j.privateNotes=$('#f_pnotes').value.trim();(j.wo?Promise.resolve(j.wo):nextWO().then(function(w){j.wo=w;})).then(function(){return store.saveJob(j);}).then(function(){toast('Saved '+j.wo);go('#/job/'+j.id);});};
      if($('#cancel'))$('#cancel').onclick=function(){go('#/job/'+j.id);};
      if($('#del'))$('#del').onclick=function(){if(confirm('Delete this job?'))store.deleteJob(j.id).then(function(){go('#/jobs');});};
      return;
    }
    var c=cs.filter(function(x){return x.id===j.customerId;})[0]||{name:'(no customer)'};
    setTop((j.wo?j.wo+' · ':'')+c.name,true,{label:'Edit',fn:function(){go('#/job/'+j.id+'/edit');}});
    store.photos(j.id).then(function(photos){
      var h='<div class="status-bar">'+CFG.statuses.map(function(s){return '<button data-st="'+s[0]+'" class="'+(s[0]===j.status?'on':'')+'">'+s[1]+'</button>';}).join('')+'</div>';
      h+='<div class="card"><div class="kv"><b>When</b><span>'+esc(fmtDate(j.date))+(j.time?' · '+esc(fmtTime(j.time)):'')+'</span></div><div class="kv"><b>Appliance</b><span>'+esc([j.appliance,j.brand,j.model].filter(Boolean).join(' · '))+'</span></div>'+(j.issue?'<div class="kv"><b>Problem</b><span>'+esc(j.issue)+'</span></div>':'')+(c.address||c.city?'<div class="kv"><b>Address</b><span>'+esc([c.address,c.city].filter(Boolean).join(', '))+'</span></div>':'')+(c.phone?'<div class="kv"><b>Phone</b><span>'+esc(c.phone)+'</span></div>':'')+(c.notes?'<div class="kv"><b>Customer notes</b><span>'+esc(c.notes)+'</span></div>':'')+'<div class="kv"><b>Price</b><span>'+(j.price?money(j.price):'—')+(j.status==='paid'?' · paid':'')+'</span></div>'+(+j.deposit?'<div class="kv"><b>Deposit</b><span>'+money(j.deposit)+(j.depositDate?' · '+esc(fmtDate(j.depositDate)):'')+'</span></div><div class="kv"><b>Balance due</b><span>'+(j.status==='paid'?'$0':money((+j.price||0)-(+j.deposit||0)))+'</span></div>':'')+(j.notes?'<div class="kv"><b>Work notes</b><span>'+esc(j.notes)+'</span></div>':'')+'</div>'+(j.privateNotes?'<div class="card private"><b>Private notes</b><div class="muted" style="white-space:pre-wrap;margin-top:4px">'+esc(j.privateNotes)+'</div></div>':'');
      h+='<div class="grid3">'+(c.phone?'<a class="btn small" href="tel:'+esc(c.phone)+'">Call</a><a class="btn small" href="'+esc(smsUrl(c.phone,''))+'">Text</a>':'<span></span><span></span>')+(c.address?'<a class="btn small" href="'+esc(mapsUrl(c))+'" target="_blank">Directions</a>':'<span></span>')+'</div>';
      h+='<div class="grid2 mt"><a class="btn blue small" id="onway" href="#">On my way (text)</a><a class="btn green small" id="review" href="#">Send review link</a></div>';
      h+='<div class="section">Photos</div><div class="photos" id="photos">'+photos.map(function(p){return '<img src="'+p.data+'" data-pid="'+p.id+'">';}).join('')+'<label class="add">+ Photo<input type="file" accept="image/*" capture="environment" id="pfile" style="display:none"></label></div>';
      h+='<div class="section">Wrap up</div><div class="grid2"><button class="btn small" id="markdone">Mark done</button><button class="btn green small" id="markpaid">Mark paid</button></div><a class="btn small mt" href="#/invoice/'+j.id+'">Invoice / receipt</a>';
      app.innerHTML=h;
      $$('.status-bar button').forEach(function(b){b.onclick=function(){j.status=b.dataset.st;store.saveJob(j).then(function(){viewJob(j.id);});};});
      $('#markdone').onclick=function(){j.status='done';store.saveJob(j).then(function(){viewJob(j.id);});};
      $('#markpaid').onclick=function(){var p=j.price||prompt('Total price ($)');if(p!==null){j.price=p;j.status='paid';store.saveJob(j).then(function(){viewJob(j.id);});}};
      $('#onway').onclick=function(e){e.preventDefault();var eta=prompt('ETA in minutes?','20');if(eta===null)return;var body=pick(CFG.onway).replace('{name}',first(c.name)).replace('{eta}',eta);if(j.status==='scheduled'){j.status='onway';store.saveJob(j);}location.href=smsUrl(c.phone,body);};
      $('#review').onclick=function(e){e.preventDefault();var body=pick(CFG.review).replace('{name}',first(c.name)).replace('{link}',CFG.reviewLink);j.reviewAsked=Date.now();store.saveJob(j);location.href=smsUrl(c.phone,body);};
      $('#pfile').onchange=function(){var f=this.files[0];if(!f)return;resizeImage(f,1400).then(function(data){return store.savePhoto({id:uid(),jobId:j.id,data:data,created:Date.now()});}).then(function(){toast('Photo added');viewJob(j.id);}).catch(function(){toast('Could not add photo');});};
      $$('#photos img').forEach(function(im){im.onclick=function(){if(confirm('Delete this photo?'))store.deletePhoto(im.dataset.pid).then(function(){viewJob(j.id);});};});
    });
  });
}

function viewMore(){
  setTop('More',false,null);setTab('more');
  Promise.all([store.jobs(),store.customers()]).then(function(r){
    var cm={};r[1].forEach(function(c){cm[c.id]=c;});var m=todayStr().slice(0,7);
    var mj=r[0].filter(function(j){return j.date.slice(0,7)===m&&j.status!=='cancelled';});
    var rev=mj.filter(function(j){return j.status==='paid';}).reduce(function(s,j){return s+(+j.price||0);},0);
    var byCity={},byApp={};mj.forEach(function(j){var c=cm[j.customerId]||{};byCity[c.city||'?']=(byCity[c.city||'?']||0)+1;byApp[j.appliance||'?']=(byApp[j.appliance||'?']||0)+1;});
    function bars(o){return Object.keys(o).sort(function(a,b){return o[b]-o[a];}).map(function(k){return '<div class="bar"><span>'+esc(k)+'</span><b>'+o[k]+'</b></div>';}).join('')||'<div class="muted">—</div>';}
    var asked=mj.filter(function(j){return j.reviewAsked;}).length;
    app.innerHTML='<div class="section">This month</div><div class="stat"><div><b>'+mj.length+'</b><small>jobs</small></div><div><b>'+money(rev)+'</b><small>collected</small></div><div><b>'+r[1].length+'</b><small>customers total</small></div><div><b>'+asked+'</b><small>review links sent</small></div></div>'
      +'<div class="section">By city</div><div class="card">'+bars(byCity)+'</div><div class="section">By appliance</div><div class="card">'+bars(byApp)+'</div>'
      +'<div class="section">Data</div><div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">Right now everything is saved on this phone only. Back it up once a week until the cloud sync is connected.</p><button class="btn small" id="exp">Download backup</button><label class="btn small" style="margin-top:8px">Restore from backup<input type="file" accept="application/json" id="imp" style="display:none"></label></div>'
      +'<div class="section">Shortcuts</div><div class="card"><a class="btn small" href="/go">Review link tool (quick)</a><a class="btn small mt" href="https://business.google.com/reviews" target="_blank" style="margin-top:8px">Google reviews</a></div>'
      +'<p class="muted" style="text-align:center;font-size:12px;margin-top:20px">R3M app v1 · '+esc(CFG.phoneDisplay)+'</p>';
    $('#exp').onclick=function(){store.exportAll().then(function(d){var b=new Blob([JSON.stringify(d)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='r3m-backup-'+todayStr()+'.json';a.click();});};
    $('#imp').onchange=function(){var f=this.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){try{store.importAll(JSON.parse(rd.result)).then(function(){toast('Restored');viewMore();});}catch(e){toast('Bad file');}};rd.readAsText(f);};
  });
}

function viewInvoice(id){
  Promise.all([store.job(id),store.customers()]).then(function(r){var j=r[0];if(!j){app.innerHTML='<div class="card empty">Not found.</div>';return;}var c=r[1].filter(function(x){return x.id===j.customerId;})[0]||{name:''};
    setTop('Invoice '+(j.wo||''),true,{label:'Share / Print',fn:function(){window.print();}});setTab('jobs');
    var price=+j.price||0,dep=+j.deposit||0,paid=j.status==='paid',bal=paid?0:Math.max(0,price-dep);
    var lines=[];if(j.notes)lines.push(j.notes);
    app.innerHTML='<div class="card inv"><div class="inv-head"><img src="/assets/logo.png" alt="R3M"><div class="right"><div style="font-weight:800">'+CFG.biz+'</div><div class="muted" style="font-size:13px">Rockwall, TX · <span class="ph"><span class="ph1">(469)</span> <span class="ph2">446-4242</span></span><br>r3mappliancerepair.com</div></div></div>'
      +'<div class="inv-meta"><div><div class="muted">'+(paid?'RECEIPT':'INVOICE')+'</div><div style="font-weight:800;font-size:18px">'+esc(j.wo||'')+'</div></div><div class="right"><div class="lbl">Date</div><div style="font-weight:800">'+esc(fmtDate(j.date))+'</div></div></div>'
      +'<div class="inv-meta"><div><div class="lbl">Bill to</div><div style="font-weight:800">'+esc(c.name)+'</div><div class="muted" style="font-size:14px">'+esc([c.address,c.city?c.city+', TX':''].filter(Boolean).join(', '))+(c.phone?'<br>'+esc(c.phone):'')+'</div></div><div class="right"><div class="lbl">Appliance</div><div style="font-weight:800">'+esc([j.appliance,j.brand].filter(Boolean).join(' '))+'</div>'+(j.model?'<div class="muted" style="font-size:13px">Model '+esc(j.model)+'</div>':'')+'</div></div>'
      +'<table class="inv-t"><tr><th>Description</th><th class="right">Amount</th></tr><tr><td>'+esc(j.issue?('Service call: '+j.issue):'Appliance repair')+(lines.length?'<div class="muted" style="font-size:13px;white-space:pre-wrap;margin-top:4px">'+esc(lines.join('\n'))+'</div>':'')+'</td><td class="right">'+money(price)+'</td></tr>'
      +(dep?'<tr><td>Deposit received'+(j.depositDate?' '+esc(fmtDate(j.depositDate)):'')+'</td><td class="right">-'+money(dep)+'</td></tr>':'')
      +'<tr class="tot"><td>'+(paid?'PAID IN FULL':'Balance due')+'</td><td class="right">'+(paid?money(price):money(bal))+'</td></tr></table>'
      +'<p class="muted" style="font-size:13px;margin:14px 0 0">All repairs carry a workmanship warranty. Thank you for choosing a local, family-owned shop. Questions? Call or text (469) 446-4242.'+(paid?' If you have 30 seconds, a review at <b>r3mappliancerepair.com/review</b> means a lot.':'')+'</p></div>'
      +'<p class="muted no-print" style="text-align:center;font-size:13px">Tap Share / Print → on iPhone choose the Share icon → Save to Files or send as PDF. Private notes are never printed.</p>';
  });
}

/* ---------- router ---------- */
function route(){var h=location.hash||'#/today';var p=h.slice(2).split('/');window.scrollTo(0,0);
  if(p[0]==='today'||p[0]==='')viewToday();else if(p[0]==='jobs')viewJobs();else if(p[0]==='job')viewJob(p[1]);else if(p[0]==='customers')viewCustomers();else if(p[0]==='customer')viewCustomer(p[1]);else if(p[0]==='more')viewMore();else if(p[0]==='invoice')viewInvoice(p[1]);else viewToday();}
back.onclick=function(){history.length>1?history.back():go('#/today');};
window.addEventListener('hashchange',route);
open().then(migrate).then(route).catch(function(e){app.innerHTML='<div class="card empty">Storage not available in this browser ('+esc(e&&e.message)+'). Try Safari or Chrome.</div>';});
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){});}
})();
