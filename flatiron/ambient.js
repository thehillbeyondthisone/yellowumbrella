// Ambient music for presentations. Bundled tracks come from dist/audio (listed by the build);
// files added in the browser are kept locally in IndexedDB so they survive reloads.
const AUDIO_FILE=/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;
const root=document.querySelector('#ambient');
if(root)ambient(root);

function ambient(root){
 const $=s=>root.querySelector(s);
 const toggle=$('.ambient-toggle'),title=$('.ambient-title'),next=$('.ambient-next'),volume=$('.ambient-volume'),add=$('.ambient-add'),remove=$('.ambient-remove'),picker=$('.ambient-file');
 const audio=new Audio(),prefs=readPrefs();
 let bundled=[],added=[],index=prefs.index|0,playing=false,fader=0,failures=0;
 audio.preload='none';
 volume.value=prefs.volume??.45;
 const tracks=()=>[...bundled,...added];

 function readPrefs(){try{return JSON.parse(localStorage.getItem('flatiron-ambient'))||{}}catch{return {}}}
 function savePrefs(){try{localStorage.setItem('flatiron-ambient',JSON.stringify({volume:+volume.value,index}))}catch{}}
 function paintVolume(){volume.style.setProperty('--level',volume.value*100+'%')}

 // Interval-based so fades still finish in a background tab.
 function fadeTo(target,ms,done){
  clearInterval(fader);
  const from=audio.volume,start=performance.now();
  fader=setInterval(()=>{
   const k=Math.min(1,(performance.now()-start)/ms);
   audio.volume=from+(target-from)*k*k*(3-2*k);
   if(k===1){clearInterval(fader);done?.()}
  },30);
 }

 async function start(){
  const list=tracks(),track=list[index];
  if(!track){picker.click();return}
  if(audio.dataset.src!==track.src){audio.src=track.src;audio.dataset.src=track.src}
  audio.loop=list.length===1;
  if(audio.paused)audio.volume=0;
  playing=true;render();
  try{await audio.play()}catch{playing=false;render();return}
  if(!playing){audio.pause();return}
  fadeTo(+volume.value,1800);
 }
 function stop(){playing=false;render();fadeTo(0,800,()=>{if(!playing)audio.pause()})}
 function step(delta){
  const list=tracks();if(!list.length)return;
  index=(index+delta+list.length)%list.length;savePrefs();render();
  if(playing)fadeTo(0,500,()=>{audio.pause();if(playing)start()});
 }

 function render(){
  const list=tracks(),track=list[index],label=!track?'Add ambient music':playing?'Pause ambient music':'Play ambient music';
  root.classList.toggle('is-playing',playing);
  root.classList.toggle('is-empty',!list.length);
  toggle.setAttribute('aria-pressed',String(playing));
  toggle.setAttribute('aria-label',label);toggle.title=label;
  title.textContent=playing&&track?track.name:'Ambient';
  title.title=track?track.name:'';
  next.hidden=list.length<2;
  remove.hidden=!track?.user;
  if('mediaSession' in navigator&&track)try{navigator.mediaSession.metadata=new MediaMetadata({title:track.name,artist:'Flatiron LV'})}catch{}
 }

 toggle.addEventListener('click',()=>playing?stop():start());
 next.addEventListener('click',()=>step(1));
 add.addEventListener('click',()=>picker.click());
 volume.addEventListener('input',()=>{if(playing){clearInterval(fader);audio.volume=+volume.value}paintVolume();savePrefs()});
 audio.addEventListener('ended',()=>step(1));
 audio.addEventListener('playing',()=>{failures=0});
 audio.addEventListener('error',()=>{
  if(!audio.getAttribute('src'))return;
  if(playing&&++failures<tracks().length)step(1);else{playing=false;render()}
 });

 picker.addEventListener('change',async()=>{
  const files=[...picker.files].filter(f=>f.type.startsWith('audio/')||AUDIO_FILE.test(f.name));
  picker.value='';
  if(!files.length)return;
  const first=tracks().length;
  for(const file of files){
   const track={name:trackName(file.name),src:URL.createObjectURL(file),user:true};
   added.push(track);
   try{track.id=await store('readwrite',s=>s.add({name:track.name,blob:file}))}catch{}
  }
  if(playing){index=first-1;step(1)}else{index=first;savePrefs();start()}
 });

 remove.addEventListener('click',()=>{
  const track=tracks()[index];if(!track?.user)return;
  const wasPlaying=playing;
  clearInterval(fader);playing=false;
  audio.pause();audio.removeAttribute('src');delete audio.dataset.src;audio.load();
  URL.revokeObjectURL(track.src);
  added=added.filter(t=>t!==track);
  if(track.id!=null)store('readwrite',s=>s.delete(track.id)).catch(()=>{});
  if(index>=tracks().length)index=0;
  savePrefs();render();
  if(wasPlaying&&tracks().length)start();
 });

 if('mediaSession' in navigator)try{
  navigator.mediaSession.setActionHandler('play',start);
  navigator.mediaSession.setActionHandler('pause',stop);
  navigator.mediaSession.setActionHandler('nexttrack',()=>step(1));
 }catch{}

 paintVolume();render();
 Promise.all([bundledTracks(),store('readonly',s=>s.getAll()).catch(()=>[])]).then(([fromBuild,fromBrowser])=>{
  bundled=fromBuild;
  added=(fromBrowser||[]).map(r=>({id:r.id,name:r.name,src:URL.createObjectURL(r.blob),user:true}));
  if(index>=tracks().length)index=0;
  render();
 });
}

function trackName(file){return file.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim()}

function bundledTracks(){
 if(Array.isArray(window.AMBIENT_TRACKS))return Promise.resolve(window.AMBIENT_TRACKS);
 if(location.protocol==='file:')return Promise.resolve([]);
 return fetch('audio/playlist.json').then(r=>r.ok?r.json():[]).then(l=>Array.isArray(l)?l:[]).catch(()=>[]);
}

function store(mode,request){
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open('flatiron-ambient',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('tracks',{keyPath:'id',autoIncrement:true});
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{
   const db=open.result,tx=db.transaction('tracks',mode),req=request(tx.objectStore('tracks'));
   tx.oncomplete=()=>{db.close();resolve(req.result)};
   tx.onerror=()=>{db.close();reject(tx.error)};
  };
 });
}
