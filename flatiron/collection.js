import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {plans,byId} from './plans.js';
import {createMaterials} from './materials.js';
import {buildResidence} from './model.js';
import {createResidenceLighting} from './lighting.js';
import './ambient.js';
const $=s=>document.querySelector(s),wrap=$('#canvas-wrap');
const touchInput=matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&matchMedia('(max-width:1000px)').matches);
document.body.classList.toggle('touch-input',touchInput);
const themeButton=$('#theme-toggle'),themeMeta=$('meta[name="theme-color"]');
let particleField;
function setTheme(value,persist=true){
 const dark=value==='dark';
 document.documentElement.dataset.theme=dark?'dark':'light';
 themeButton.setAttribute('aria-pressed',String(dark));
 themeButton.querySelector('strong').textContent=dark?'Light edition':'Dark edition';
 themeButton.title=dark?'Return to the light presentation':'View the dark presentation';
 themeMeta.content=dark?'#111110':'#f5f3ee';
 if(persist)try{localStorage.setItem('flatiron-theme',dark?'dark':'light')}catch{}
 particleField?.sync();
}
setTheme(document.documentElement.dataset.theme,false);
themeButton.onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.05,200),topCamera=new T.OrthographicCamera(-10,10,10,-10,.05,200);
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,touchInput?1.5:2));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=T.SRGBColorSpace;wrap.appendChild(renderer.domElement);
let frameRequest=0,exporting=false;
function requestRender(){if(!frameRequest&&!exporting&&!document.hidden&&!renderer.getContext().isContextLost())frameRequest=requestAnimationFrame(animate);}
function invalidateScene(){renderer.shadowMap.needsUpdate=true;requestRender();}
let activeCamera=camera;
const controls=new OrbitControls(activeCamera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3;controls.maxDistance=65;controls.maxPolarAngle=Math.PI/2-.08;controls.mouseButtons.RIGHT=T.MOUSE.PAN;
// Keep right-button drags on the viewer so the browser cannot start a native drag.
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('dragstart',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2)e.preventDefault();});
controls.addEventListener('change',requestRender);
const ambient=new T.HemisphereLight(0xf5f9ff,0x93917e,2.4);scene.add(ambient);const sun=new T.DirectionalLight(0xfff0db,3.0);sun.position.set(-8,19,12);sun.castShadow=true;sun.shadow.mapSize.set(touchInput?1024:2048,touchInput?1024:2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:55});sun.shadow.normalBias=.028;sun.shadow.bias=-.0003;scene.add(sun);const fill=new T.DirectionalLight(0xe0ecf2,1.2);fill.position.set(12,8,-10);scene.add(fill);
const env=document.createElement('canvas');env.width=512;env.height=256;const ec=env.getContext('2d'),gr=ec.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#ffffff');gr.addColorStop(.48,'#d6dfdf');gr.addColorStop(.52,'#94958b');gr.addColorStop(1,'#74796e');ec.fillStyle=gr;ec.fillRect(0,0,512,256);ec.fillStyle='white';ec.fillRect(80,40,130,83);ec.fillRect(335,30,75,75);const envTexture=new T.CanvasTexture(env);envTexture.mapping=T.EquirectangularReflectionMapping;envTexture.colorSpace=T.SRGBColorSpace;scene.environment=envTexture;scene.environmentIntensity=.7;
const mat=createMaterials(renderer),ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.y=-.25;ground.receiveShadow=true;scene.add(ground);
let lighting,lightingMode='cozy';
let current,model,mode='3d',furnished=true,fullWalls=false,labels=false,activeRoom='all',labelEls=[],tween=null;
let roomTour=null,tourTimer=0;
const TOUR_MOVE_MS=1200,TOUR_PAUSE_MS=3000;
let walk=null,walkLoading=false,walkGeneration=0,savedWalk=null,preserveNextResize=false;
renderer.domElement.tabIndex=0;
renderer.domElement.setAttribute('aria-label','Interactive residence. Drag to turn, zoom with the wheel or a pinch, or use the room buttons for a preset view.');
$('.hint').textContent=touchInput?'Drag to turn · Pinch to zoom · Two fingers to move':'Drag to turn · Scroll to zoom · Right-drag to move';
function walkState(state){
 const touring=state.tour.status==='running';
 document.body.classList.toggle('guided-tour',touring);
 $('#walk-pause').hidden=!state.paused;$('#walk-touch').hidden=!touchInput||state.paused||touring;
 $('#walk-tour-start').hidden=!current.walk?.tour?.length;
 $('#walk-tour-start').textContent=state.tour.status==='paused'?'Resume guided tour':state.tour.status==='complete'?'Replay guided tour':'Start guided tour';
 $('#walk-tour-pause').hidden=!touring;$('#walk-tour-takeover').hidden=!touring;$('#walk-pause-button').hidden=touring;
 $('#walk-tour-progress').textContent=touring?`GUIDED TOUR · ${state.tour.name} · ${state.tour.stage+1} / ${state.tour.total}`:'WASD / arrows · Mouse look · Esc pauses · R resets';
 $('#walk-resume').textContent=touchInput?'Start / resume walking':state.locked?'Resume walking':'Start / resume walking';
 $('#walk-drag').hidden=touchInput||!state.reason;
 $('#walk-message').innerHTML=state.reason||(state.tour.status==='paused'?`Guided tour paused at ${state.tour.name}.<br>Resume the tour or start walking manually.`:touchInput?'Hold the arrow buttons to move.<br>Drag the view to look around. Tap Pause to stop.':'Mouse to look · WASD or arrows to walk.<br>Escape pauses · R returns to the entrance.');
}
function exitWalk(){
 ++walkGeneration;walkLoading=false;$('#view-walk').disabled=false;$('#view-walk').textContent='Walk inside';
 if(!walk)return;
 walk.dispose();walk=null;controls.enabled=true;document.body.classList.remove('walking','guided-tour');$('#walk-pause').hidden=true;$('#walk-bar').hidden=true;$('#walk-touch').hidden=true;
 mode=savedWalk.mode;activeRoom=savedWalk.activeRoom;camera.copy(savedWalk.camera);topCamera.copy(savedWalk.topCamera);controls.target.copy(savedWalk.target);activeCamera=mode==='3d'?camera:topCamera;controls.object=activeCamera;controls.enableRotate=mode==='3d';model.setWalls(fullWalls);
 document.body.classList.toggle('comparing',mode==='compare');document.body.classList.toggle('plan',mode==='plan');$('#compare-pane').hidden=mode!=='compare';
 for(const value of ['3d','plan','compare','walk']){$('#view-'+value).classList.toggle('selected',value===mode);$('#view-'+value).setAttribute('aria-pressed',String(value===mode));}
 sun.position.set(...(mode==='3d'?[-8,19,12]:[-2,25,3]));savedWalk=null;preserveNextResize=true;highlightRoom();applyLighting();requestRender();$('#view-walk').focus();
}
async function enterWalk(){
 stopRoomTour();
 if(walk||walkLoading||!current.walk)return;
 const generation=++walkGeneration;walkLoading=true;$('#view-walk').disabled=true;$('#view-walk').textContent='Preparing…';
 try {
  const {createWalkthrough}=await import('./walkthrough.js');
  if(generation!==walkGeneration||!current.walk)return;
  savedWalk={mode,activeRoom,camera:camera.clone(),topCamera:topCamera.clone(),target:controls.target.clone()};
  // Clear residual orbit damping before taking camera control, preserving the saved view.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;
  $('#walk-title').textContent='THE '+current.name.toUpperCase()+' · '+(touchInput?'TOUCH WALKTHROUGH':'DESKTOP WALKTHROUGH');
  const session=createWalkthrough({plan:current,model,element:renderer.domElement,scene,requestRender,onState:walkState,touch:touchInput,touchControls:$('#walk-touch')});
  walk=session;mode='walk';tween=null;controls.enabled=false;activeCamera=session.camera;model.setWalls(true);
  document.body.classList.add('walking');document.body.classList.remove('plan','comparing');$('#compare-pane').hidden=true;$('#walk-bar').hidden=false;
  for(const value of ['3d','plan','compare','walk']){$('#view-'+value).classList.toggle('selected',value==='walk');$('#view-'+value).setAttribute('aria-pressed',String(value==='walk'));}
  sun.position.set(-8,19,12);applyLighting();resize();$('#walk-resume').focus({preventScroll:true});if(touchInput&&!matchMedia('(orientation:landscape)').matches)$('#stage').scrollIntoView({block:'start'});
 }catch(error){if(walk)exitWalk();else if(savedWalk){camera.copy(savedWalk.camera);topCamera.copy(savedWalk.topCamera);controls.target.copy(savedWalk.target);savedWalk=null;}$('#status').textContent=error.message;requestRender();}
 finally{if(generation===walkGeneration){walkLoading=false;$('#view-walk').disabled=false;$('#view-walk').textContent='Walk inside';}}
}
$('#view-walk').onclick=enterWalk;$('#walk-resume').onclick=()=>walk?.resume();$('#walk-drag').onclick=()=>walk?.useDrag();$('#walk-tour-start').onclick=()=>walk?.startTour();$('#walk-tour-pause').onclick=()=>walk?.pause();$('#walk-tour-takeover').onclick=()=>walk?.takeControl();$('#walk-pause-button').onclick=()=>walk?.pause();$('#walk-reset').onclick=()=>walk?.reset();$('#walk-exit').onclick=exitWalk;$('#walk-return').onclick=exitWalk;
$('#featured-walk').onclick=()=>{selectPlan('grotto');enterWalk();};
const format=n=>n.toLocaleString('en-US'),pad=n=>String(n).padStart(2,'0');
// Temporarily show Walk links for Grotto only; the Ellé prototype remains available in source.
const showWalkLink=p=>p.id==='grotto'&&Boolean(p.walk);
let lastBeds;for(const [i,p] of plans.entries()){if(lastBeds!==p.beds){const group=document.createElement('div');group.className='collection-group';group.textContent=p.beds===0?'STUDIO':p.beds===1?'ONE BEDROOM':'TWO BEDROOM COLLECTION';$('#collection').append(group);lastBeds=p.beds;}const b=document.createElement('button');b.className='residence';b.dataset.plan=p.id;b.innerHTML=`<span class="num">${pad(i+1)}</span><span>The ${p.name}</span><span class="res-area">${format(p.area)}</span><span class="arrow">↗</span>`;b.onclick=()=>selectPlan(p.id);if(showWalkLink(p)){const row=document.createElement('div');row.className='residence-row';const walkButton=document.createElement('button');walkButton.className='residence-walk';walkButton.dataset.walkPlan=p.id;walkButton.textContent='Walk ↗';walkButton.setAttribute('aria-label','Walk through The '+p.name);walkButton.onclick=()=>{selectPlan(p.id);enterWalk();};row.append(b,walkButton);$('#collection').append(row);}else $('#collection').append(b);const option=document.createElement('option');option.value=p.id;option.textContent=`The ${p.name} · ${format(p.area)} sq. ft. · ${p.beds?p.beds+' bed':'Studio'} · ${p.baths} bath`;$('#plan-select').append(option);}
function cameraHome(){const aspect=wrap.clientWidth/wrap.clientHeight;const size=Math.max(model.width,model.depth);const direction=new T.Vector3(.85,1.35,1.35).normalize();const extent= Math.max(size*.655,Math.hypot(model.width,model.depth)*.43);const distance=extent/Math.tan(T.MathUtils.degToRad(18))*Math.max(1,1.18/aspect);camera.position.copy(direction.multiplyScalar(distance));controls.target.set(0,0,0);camera.lookAt(0,0,0);}
function frameTop(){const aspect=wrap.clientWidth/wrap.clientHeight;const width=Math.max(model.width*1.07,model.depth*1.07*aspect);topCamera.left=-width/2;topCamera.right=width/2;topCamera.top=width/aspect/2;topCamera.bottom=-width/aspect/2;topCamera.zoom=1;topCamera.updateProjectionMatrix();topCamera.position.set(0,35,.0001);topCamera.up.set(0,0,-1);controls.target.set(0,0,0);topCamera.lookAt(0,0,0);}
let viewportWidth=0,viewportHeight=0;
function resize(){
 const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h||exporting)return;
 const oldAspect=viewportWidth/viewportHeight,aspect=w/h,first=!viewportWidth;
 const changed=w!==viewportWidth||h!==viewportHeight;
 viewportWidth=w;viewportHeight=h;if(changed)renderer.setSize(w,h,false);
 if(walk){walk.camera.aspect=aspect;walk.camera.updateProjectionMatrix();requestRender();return;}
 camera.aspect=aspect;camera.updateProjectionMatrix();
 // Resize the frustum without throwing away a user's orbit, pan, or zoom.
 if(model&&!preserveNextResize){
  if(first){if(mode==='3d')cameraHome();else frameTop();}
  else if(mode==='3d'&&oldAspect!==aspect){
   const ratio=Math.max(1,1.18/aspect)/Math.max(1,1.18/oldAspect);
   camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
   if(tween){tween.from.sub(tween.fromTarget).multiplyScalar(ratio).add(tween.fromTarget);tween.to.sub(tween.target).multiplyScalar(ratio).add(tween.target);}
  }else if(mode!=='3d'){
   const center=(topCamera.top+topCamera.bottom)/2,half=(topCamera.right-topCamera.left)/aspect/2;
   topCamera.top=center+half;topCamera.bottom=center-half;topCamera.updateProjectionMatrix();
  }
 }
 preserveNextResize=false;controls.update();requestRender();
}
new ResizeObserver(resize).observe(wrap);
function setLighting(value){lightingMode=value;applyLighting();}
function applyLighting(){const cozy=lightingMode==='cozy'&&mode!=='compare';const flat=cozy&&mode==='plan';ambient.intensity=cozy?(flat?1.15:.65):2.4;sun.intensity=cozy?(flat?1.5:1.05):3;fill.intensity=cozy?(flat?.5:.3):1.2;scene.environmentIntensity=cozy?(flat?.42:.3):.7;renderer.toneMappingExposure=cozy?(flat?1.1:1.05):1.15;mat.lamp.emissiveIntensity=cozy?1.7:0;lighting?.setState(cozy,furnished);$('#lighting').setAttribute('aria-pressed',String(lightingMode==='cozy'));$('#lighting').textContent=lightingMode==='cozy'?'Cozy light':'Daylight';invalidateScene();}
$('#lighting').onclick=()=>setLighting(lightingMode==='cozy'?'day':'cozy');
function setMode(value){stopRoomTour();if(value==='walk')return enterWalk();if(walk||walkLoading)exitWalk();mode=value;sun.position.set(...(value==='3d'?[-8,19,12]:[-2,25,3]));tween=null;activeRoom='all';activeCamera=value==='3d'?camera:topCamera;controls.object=activeCamera;controls.enableRotate=value==='3d';document.body.classList.toggle('comparing',value==='compare');document.body.classList.toggle('plan',value==='plan');$('#compare-pane').hidden=value!=='compare';for(const v of ['3d','plan','compare']){$('#view-'+v).classList.toggle('selected',v===value);$('#view-'+v).setAttribute('aria-pressed',String(v===value));}$('#model-caption').textContent=value==='compare'?'TRACED 3D MODEL':value==='plan'?'FLOOR PLAN':furnished?'FURNISHED RESIDENCE':'ARCHITECTURAL SHELL';highlightRoom();applyLighting();resize();if(value==='3d')cameraHome();else frameTop();controls.update();requestRender();}

function updateRoomTour(){
 document.body.classList.toggle('room-playing',!!roomTour);
 const button=$('#play-rooms');if(!button)return;
 button.textContent=roomTour?(roomTour.paused?'▶ Resume tour':'Ⅱ Pause tour'):'▶ Tour rooms';
 button.setAttribute('aria-pressed',String(!!roomTour&&!roomTour.paused));
 if(roomTour){const step=roomTour.steps[roomTour.index];$('#model-caption').textContent=(roomTour.paused?'PAUSED · ':'')+step.name+' · '+(roomTour.index+1)+' / '+roomTour.steps.length;}
 else $('#model-caption').textContent=furnished?'FURNISHED RESIDENCE':'ARCHITECTURAL SHELL';
}
function setTourProgress(fraction,duration=0){
 const progress=$('#room-tour-progress'),fill=progress.firstElementChild;
 progress.hidden=!roomTour;
 fill.style.transition='none';fill.style.transform=`scaleX(${Math.max(0,Math.min(1,fraction))})`;
 if(duration){fill.getBoundingClientRect();fill.style.transition=`transform ${duration}ms linear`;fill.style.transform='scaleX(0)';}
}
function beginTourDwell(tour,duration=TOUR_PAUSE_MS){
 if(roomTour!==tour||tour.paused)return;
 tour.phase='dwell';tour.remaining=duration;tour.deadline=performance.now()+duration;
 setTourProgress(duration/TOUR_PAUSE_MS,duration);
 tourTimer=setTimeout(()=>{
  if(roomTour!==tour||tour.paused)return;
  if(++tour.index===tour.steps.length){stopRoomTour();return;}
  playRoomStep();
 },duration);
}
function stopRoomTour(){
 if(!roomTour)return;
 clearTimeout(tourTimer);tourTimer=0;roomTour=null;tween=null;updateRoomTour();$('#room-tour-progress').hidden=true;
}
function pauseRoomTour(){
 if(!roomTour||roomTour.paused)return;
 clearTimeout(tourTimer);tourTimer=0;
 if(roomTour.phase==='dwell')roomTour.remaining=Math.max(0,roomTour.deadline-performance.now());
 roomTour.paused=true;tween=null;setTourProgress((roomTour.remaining||TOUR_PAUSE_MS)/TOUR_PAUSE_MS);updateRoomTour();
}
function playRoomStep(){
 const tour=roomTour;if(!tour||tour.paused)return;
 const step=tour.steps[tour.index];
 tour.phase='moving';tour.remaining=TOUR_PAUSE_MS;setTourProgress(1);
 if(step.id==='all'){
  const from=camera.position.clone(),fromTarget=controls.target.clone();cameraHome();
  const to=camera.position.clone(),target=controls.target.clone();camera.position.copy(from);controls.target.copy(fromTarget);
  activeRoom='all';highlightRoom();tween={start:performance.now(),duration:TOUR_MOVE_MS,from,to,fromTarget,target};requestRender();
 }else focus(step.id,true);
 updateRoomTour();
 tween.onComplete=()=>beginTourDwell(tour);
}
function toggleRoomTour(){
 if(roomTour){if(roomTour.paused){roomTour.paused=false;if(roomTour.phase==='dwell')beginTourDwell(roomTour,roomTour.remaining);else playRoomStep();updateRoomTour();}else pauseRoomTour();return;}
 setMode('3d');
 roomTour={index:0,paused:false,steps:[...current.rooms.map(({id,name})=>({id,name})),{id:'all',name:'Full residence'}]};
 playRoomStep();
}
controls.addEventListener('start',stopRoomTour);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRoomTour();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')pauseRoomTour();});

function highlightRoom(){document.querySelectorAll('#rooms button').forEach(b=>b.classList.toggle('active',b.dataset.room===activeRoom));}
function focus(id,automatic=false){if(!automatic)stopRoomTour();if(id==='all'){activeRoom='all';tween=null;setMode('3d');return;}const r=current.rooms.find(r=>r.id===id);if(!r)return;if(mode!=='3d')setMode('3d');activeRoom=id;const target=new T.Vector3(model.X((r.rect[0]+r.rect[2])/2),0,model.Z((r.rect[1]+r.rect[3])/2)),span=Math.max((r.rect[2]-r.rect[0])*model.S,(r.rect[3]-r.rect[1])*model.S);const to=target.clone().add(new T.Vector3(.55,1.3,1.1).normalize().multiplyScalar(Math.max(6,span*2.0)*Math.max(1,.85/camera.aspect)));tween={start:performance.now(),duration:automatic?TOUR_MOVE_MS:550,from:camera.position.clone(),to,fromTarget:controls.target.clone(),target};highlightRoom();requestRender();}
function selectPlan(id,updateURL=true){stopRoomTour();document.body.classList.remove('home');$('#welcome-link').classList.remove('active');$('#welcome-link').removeAttribute('aria-current');if(walk||walkLoading)exitWalk();const p=byId[id]||plans[0];$('#view-walk').hidden=!showWalkLink(p);if(model){lighting.dispose();scene.remove(model.root);model.dispose();}current=p;model=buildResidence(p,mat);scene.add(model.root);lighting=createResidenceLighting(p,model,mat);model.loose.visible=furnished;model.setWalls(fullWalls);labelEls.forEach(v=>v.el.remove());labelEls=[];$('#rooms').replaceChildren();for(const r of [{id:'all',name:'Full residence'},...p.rooms]){const b=document.createElement('button');b.textContent=r.name;b.dataset.room=r.id;b.onclick=()=>focus(r.id);$('#rooms').append(b);if(r.id!=='all'){const el=document.createElement('div');el.className='room-label';el.textContent=r.name;el.hidden=true;wrap.append(el);labelEls.push({el,room:r});}}const play=document.createElement('button');play.id='play-rooms';play.textContent='▶ Tour rooms';play.setAttribute('aria-pressed','false');play.title='Automatically visit each room, pausing for 3 seconds at each view';play.onclick=toggleRoomTour;$('#rooms').append(play);
 const i=plans.indexOf(p);document.title=`The ${p.name} | Flatiron LV`;$('#plan-name').innerHTML=`The ${p.name}<span>.</span>`;$('#area').textContent=format(p.area);$('.stats>div:first-child>span').textContent='SQ. FT.';$('.stats>div:last-child>span').textContent='BATH';$('#beds').textContent=p.beds||'Studio';$('#beds-label').textContent=p.beds?'BEDROOMS':'OPEN LIVING';$('#baths').textContent=p.baths??'—';$('#stage-kicker').textContent=`THE ${p.name.toUpperCase()} / ${pad(i+1)}`;$('#footer-name').innerHTML=`THE ${p.name.toUpperCase()} <i>/</i> FLATIRON LV`;$('#counter').textContent=`${pad(i+1)} / ${pad(plans.length)}`;$('#source-image').src=p.source;$('#source-image').alt=`Original ${p.name} brochure floorplan`;$('#plan-select').value=p.id;document.querySelectorAll('[data-plan]').forEach(b=>{b.classList.toggle('active',b.dataset.plan===p.id);b.setAttribute('aria-current',b.dataset.plan===p.id?'true':'false')});$('#notes').classList.toggle('has-notes',!!p.notes.length);$('#notes').innerHTML='About this representation <span>ⓘ</span>';$('#status').textContent='';if(updateURL&&!window.FLOORPLAN_OFFLINE){const u=new URL(location.href);u.searchParams.set('plan',p.id);history.replaceState(null,'',u);}setMode(mode);$('#loading')?.remove();}
for(const v of ['3d','plan','compare'])$('#view-'+v).onclick=()=>setMode(v);
$('#plan-select').onchange=e=>selectPlan(e.target.value);function stepResidence(direction){const index=Math.max(0,plans.indexOf(current)),next=(index+direction+plans.length)%plans.length;selectPlan(plans[next].id);}
$('#previous').onclick=()=>stepResidence(-1);$('#next').onclick=()=>stepResidence(1);
$('#furnished').onclick=()=>{furnished=!furnished;model.loose.visible=furnished;applyLighting();$('#furnished').setAttribute('aria-pressed',String(furnished));$('#model-caption').textContent=furnished?'FURNISHED RESIDENCE':'ARCHITECTURAL SHELL';};$('#walls').onclick=()=>{fullWalls=!fullWalls;model.setWalls(fullWalls);$('#walls').setAttribute('aria-pressed',String(fullWalls));invalidateScene();};$('#labels').onclick=()=>{labels=!labels;$('#labels').setAttribute('aria-pressed',String(labels));requestRender();};$('#reset').onclick=()=>focus('all');
const modal=$('#modal');
new MutationObserver(()=>{if(modal.open)stopRoomTour();}).observe(modal,{attributes:true,attributeFilter:['open']});$('#close-modal').onclick=()=>modal.close();modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
$('#reference').onclick=()=>{walk?.pause();$('#modal-content').innerHTML=`<div class="eyebrow">SUPPLIED FLOOR PLAN</div><h2>The ${current.name} · ${format(current.area)} sq. ft.</h2><img src="${current.source}" alt="Original ${current.name} plan"><p class="source-note">Cropped from the supplied Flatiron LV brochure. This drawing guides the model’s footprint and arrangement.</p>`;modal.showModal()};
$('#notes').onclick=()=>{walk?.pause();$('#modal-content').innerHTML=`<div class="eyebrow">ABOUT THE REPRESENTATION</div><h2>Drawn from the original.</h2><p>The ${current.name} follows the supplied brochure. Interior photographs guide the shared finishes. This is a marketing visualization, with vertical dimensions and some small fixtures estimated.</p><ul><li>The undimensioned vector plan is scaled uniformly to ${format(current.area)} square feet of enclosed footprint, excluding the balcony. The advertised area convention is unconfirmed.</li><li>Full walls are assumed to be 2.74 m high. Low walls are a presentation cutaway. Doors, windows, cabinetry and furniture heights are estimated.</li><li>Cozy lighting uses suggested fixture locations based on furniture and room use; actual installed lighting is unverified.</li><li>Use Plan view and Compare to inspect the source arrangement. Room and bath counts follow the clearer PDF labels. Utility equipment identities remain unspecified.</li></ul>${current.notes.map(n=>`<p class="flag">${n}</p>`).join('')}<p class="source-note">Original procedural materials. Three.js renderer (MIT license).</p>`;modal.showModal()};
// A multi-touch gesture or a drag must never become a room-selection tap.
const pointers=new Map();let tap=null;
renderer.domElement.addEventListener('pointerdown',e=>{
 stopRoomTour();tween=null;pointers.set(e.pointerId,[e.clientX,e.clientY]);
 tap=pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
});
renderer.domElement.addEventListener('pointermove',e=>{if(tap&&tap.id===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)tap=null;});
for(const type of ['pointercancel','lostpointercapture'])renderer.domElement.addEventListener(type,e=>{pointers.delete(e.pointerId);tap=null;});
renderer.domElement.addEventListener('pointerup',e=>{
 const hit=tap&&tap.id===e.pointerId&&pointers.size===1&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=8;
 pointers.delete(e.pointerId);tap=null;
 if(!hit||walk||mode==='compare')return;
 const b=renderer.domElement.getBoundingClientRect(),ray=new T.Raycaster();
 ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),activeCamera);
 const pt=new T.Vector3();if(ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.04),pt)){
  const x=pt.x/model.S+model.cx,z=pt.z/model.S+model.cz;
  const r=current.rooms.find(r=>x>=r.rect[0]&&x<=r.rect[2]&&z>=r.rect[1]&&z<=r.rect[3]);if(r)focus(r.id);
 }
});
renderer.domElement.addEventListener('webglcontextlost',e=>{
 e.preventDefault();stopRoomTour();walk?.pause();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;
 $('#status').textContent='3D view paused. Waiting for graphics to recover…';
});
renderer.domElement.addEventListener('webglcontextrestored',()=>{$('#status').textContent='';resize();invalidateScene();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;}else{resize();invalidateScene();}});
let imageURL;
modal.addEventListener('close',()=>{if(imageURL){URL.revokeObjectURL(imageURL);imageURL=null;}});
async function presentImage(canvas,filename){
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not prepare the image. Please try again.')),'image/png'));
 if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);
 $('#modal-content').innerHTML='<h2>Your residence image.</h2><img class="image-export" alt="Exported residence view"><p>Touch and hold the image to save it, or use the options below.</p><div class="image-actions"><button id="share-image" hidden>Share / Save to Photos</button><a id="download-image">Download PNG</a></div><p id="image-status" role="status"></p>';
 $('.image-export').src=imageURL;
 const link=$('#download-image');link.href=imageURL;link.download=filename;
 const file=new File([blob],filename,{type:'image/png'}),share=$('#share-image');
 if(navigator.canShare?.({files:[file]})){
  share.hidden=false;share.onclick=async()=>{try{await navigator.share({files:[file],title:filename});}catch(error){if(error.name!=='AbortError')$('#image-status').textContent='Sharing is unavailable. Touch and hold the image, or download the PNG.';}};
 }
 modal.showModal();
}

async function exportImage(options={}){
 if(exporting||walk)return;
 stopRoomTour();
 exporting=true;if(frameRequest){cancelAnimationFrame(frameRequest);frameRequest=0;}
 const download=options.download!==false,button=$('#export');button.disabled=true;$('#status').textContent='Preparing high-resolution image…';
 const w=wrap.clientWidth,h=wrap.clientHeight,pixelRatio=renderer.getPixelRatio();
 const savedAspect=camera.aspect,savedTop=[topCamera.left,topCamera.right,topCamera.top,topCamera.bottom];
 try{
  const outW=2400,renderH=1684,renderW=mode==='compare'?1200:outW,aspect=renderW/renderH;
  camera.aspect=aspect;camera.updateProjectionMatrix();
  if(mode!=='3d'){const span=Math.max(model.width*1.07,model.depth*1.07*aspect);topCamera.left=-span/2;topCamera.right=span/2;topCamera.top=span/aspect/2;topCamera.bottom=-span/aspect/2;topCamera.updateProjectionMatrix();}
  renderer.setPixelRatio(1);renderer.setSize(renderW,renderH,false);renderer.render(scene,activeCamera);
  const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=1800;const c=canvas.getContext('2d');c.fillStyle='#f2f4ec';c.fillRect(0,0,outW,1800);c.drawImage(renderer.domElement,0,0);
  if(mode==='compare'){
   const img=new Image();img.src=current.source;await img.decode();const scale=Math.min(1080/img.width,1500/img.height);c.fillStyle='#f8f5ee';c.fillRect(1200,0,1200,renderH);c.drawImage(img,1260+(1080-img.width*scale)/2,100+(1500-img.height*scale)/2,img.width*scale,img.height*scale);c.fillStyle='#738169';c.font='18px Arial';c.fillText('TRACED 3D MODEL',48,52);c.fillText('ORIGINAL BROCHURE',1248,52);
  }else if(labels){
   for(const r of current.rooms){const pt=new T.Vector3(model.X((r.rect[0]+r.rect[2])/2),.95,model.Z((r.rect[1]+r.rect[3])/2)).project(activeCamera);if(pt.z>1)continue;const x=(pt.x*.5+.5)*renderW,y=(-pt.y*.5+.5)*renderH;c.font='20px Arial';const tw=c.measureText(r.name).width;c.fillStyle='#ffffffdd';c.fillRect(x-tw/2-12,y-20,tw+24,34);c.fillStyle='#506046';c.textAlign='center';c.fillText(r.name,x,y+4);c.textAlign='left';}
  }
  c.fillStyle='#26342b';c.font='40px Georgia';c.fillText(`The ${current.name}`,52,1742);c.fillStyle='#7c8870';c.font='20px Arial';c.fillText(`FLATIRON LV  /  ${format(current.area)} SQ. FT.  /  ${mode==='3d'?'3D RESIDENCE':mode==='compare'?'SOURCE COMPARISON':'PLAN VIEW'}`,52,1775);c.textAlign='right';c.font='17px Arial';c.fillText('Brochure-based visualization · Dimensions estimated',2348,1765);
  const filename=`flatiron-${current.id}-${mode==='3d'?'hero':mode}.png`;
  if(download&&touchInput){await presentImage(canvas,filename);$('#status').textContent='Image ready';return;}
  const data=canvas.toDataURL('image/png');if(download){const a=document.createElement('a');a.href=data;a.download=filename;a.click();}$('#status').textContent=download?'Image download started':'';return data;
 }finally{renderer.setPixelRatio(pixelRatio);renderer.setSize(w,h,false);camera.aspect=savedAspect;camera.updateProjectionMatrix();[topCamera.left,topCamera.right,topCamera.top,topCamera.bottom]=savedTop;topCamera.updateProjectionMatrix();button.disabled=false;exporting=false;requestRender();}
}
$('#export').onclick=()=>exportImage().catch(error=>{$('#status').textContent=error.message||'Unable to save image. Please try again.';});
function animate(t){frameRequest=0;if(exporting)return;if(walk){const moving=walk.update(t);renderer.render(scene,activeCamera);if(moving)requestRender();return;}if(tween){const k=Math.min(1,(t-tween.start)/(matchMedia('(prefers-reduced-motion: reduce)').matches?1:(tween.duration||550))),e=1-Math.pow(1-k,3);camera.position.lerpVectors(tween.from,tween.to,e);controls.target.lerpVectors(tween.fromTarget,tween.target,e);if(k===1){const done=tween.onComplete;tween=null;done?.();}}const moving=controls.update();for(const {el,room:r} of labelEls){el.hidden=!labels||mode==='compare';if(el.hidden)continue;const p=new T.Vector3(model.X((r.rect[0]+r.rect[2])/2),.95,model.Z((r.rect[1]+r.rect[3])/2)).project(activeCamera);el.style.left=(p.x*.5+.5)*wrap.clientWidth+'px';el.style.top=(-p.y*.5+.5)*wrap.clientHeight+'px';el.style.display=p.z<1?'block':'none';}renderer.render(scene,activeCamera);if(tween||moving)requestRender();}
function showWelcome(updateURL=true){
 stopRoomTour();
 if(walk||walkLoading)exitWalk();
 document.body.classList.add('home');
 document.title='3D Floorplan Presentation | Flatiron LV';
 $('#plan-name').innerHTML='Overview<span>.</span>';
 $('#area').textContent='9';$('.stats>div:first-child>span').textContent='RESIDENCES';
 $('#beds').textContent='2';$('#beds-label').textContent='WALKTHROUGHS';
 $('#baths').textContent='3D';$('.stats>div:last-child>span').textContent='FLOORPLANS';
 $('#plan-select').value='';
 $('#welcome-link').classList.add('active');
 $('#welcome-link').setAttribute('aria-current','page');
 document.querySelectorAll('[data-plan]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-current','false');});
 $('#footer-name').innerHTML='THE RESIDENCE COLLECTION <i>/</i> FLATIRON LV';
 $('#counter').textContent='09 RESIDENCES';
 if(updateURL&&!window.FLOORPLAN_OFFLINE){const u=new URL(location.href);u.searchParams.delete('plan');history.replaceState(null,'',u);}
}
$('#welcome-link').onclick=()=>showWelcome();
const welcome=$('#welcome');
function createParticleField(canvas){
 const context=canvas.getContext('2d'),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let width=0,height=0,ratio=1,points=[],frame=0,last=0,pointer=null;
 const active=()=>document.documentElement.dataset.theme==='dark'&&document.body.classList.contains('home')&&!document.hidden;
 function seed(){
  const count=Math.max(18,Math.min(34,Math.round(width*height/23000)));
  points=Array.from({length:count},(_,index)=>({x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22,r:index%7===0?2.1:1.15+Math.random()*.65,w:.7+Math.random()*.7}));
 }
 function resizeParticles(){
  const box=canvas.getBoundingClientRect();width=Math.max(1,box.width);height=Math.max(1,box.height);ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);seed();draw();
 }
 function draw(){
  context.clearRect(0,0,width,height);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d<105){context.strokeStyle=`rgba(239,123,67,${(1-d/105)*.13})`;context.lineWidth=.65;context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();}
  }
  for(const point of points){context.beginPath();context.fillStyle=point.r>2?'rgba(255,189,151,.8)':'rgba(239,123,67,.62)';context.shadowColor='#ef7b43';context.shadowBlur=point.r*4;context.arc(point.x,point.y,point.r,0,Math.PI*2);context.fill();}
  context.shadowBlur=0;
 }
 function tick(time){
  frame=0;if(!active()){context.clearRect(0,0,width,height);return;}
  const step=Math.min(2,last?(time-last)/16.67:1);last=time;
  for(let i=0;i<points.length;i++){
   const point=points[i];point.vx+=(width*.5-point.x)*.0000025*point.w*step;point.vy+=(height*.5-point.y)*.0000025*point.w*step;
   if(pointer){const dx=point.x-pointer.x,dy=point.y-pointer.y,d=Math.max(18,Math.hypot(dx,dy));if(d<155){const force=(1-d/155)*.045*step;point.vx+=dx/d*force;point.vy+=dy/d*force;}}
   for(let j=i+1;j<points.length;j++){
    const other=points[j],dx=other.x-point.x,dy=other.y-point.y,d=Math.max(.01,Math.hypot(dx,dy)),gap=point.r+other.r+3;
    if(d<gap){const impulse=(gap-d)*.018;point.vx-=dx/d*impulse;point.vy-=dy/d*impulse;other.vx+=dx/d*impulse;other.vy+=dy/d*impulse;}
   }
   point.vx*=.998;point.vy*=.998;point.x+=point.vx*step;point.y+=point.vy*step;
   if(point.x<0||point.x>width){point.x=Math.max(0,Math.min(width,point.x));point.vx*=-.84}if(point.y<0||point.y>height){point.y=Math.max(0,Math.min(height,point.y));point.vy*=-.84}
  }
  draw();frame=requestAnimationFrame(tick);
 }
 function sync(){
  cancelAnimationFrame(frame);frame=0;last=0;
  if(!active()){context.clearRect(0,0,width,height);return;}
  if(motion.matches){draw();return;}frame=requestAnimationFrame(tick);
 }
 welcome.addEventListener('pointermove',event=>{const box=welcome.getBoundingClientRect();pointer={x:event.clientX-box.left,y:event.clientY-box.top}});
 welcome.addEventListener('pointerleave',()=>{pointer=null});
 new ResizeObserver(resizeParticles).observe(welcome);
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',sync);resizeParticles();sync();
 return {sync};
}
particleField=createParticleField($('#particle-field'));
welcome.addEventListener('pointermove',e=>{
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const r=welcome.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
 welcome.style.setProperty('--glow-x',Math.round(x*100)+'%');welcome.style.setProperty('--glow-y',Math.round(y*100)+'%');
 welcome.style.setProperty('--drift-x',(x-.5)*12+'px');welcome.style.setProperty('--drift-y',(y-.5)*12+'px');
});
welcome.addEventListener('pointerleave',()=>{for(const name of ['--glow-x','--glow-y','--drift-x','--drift-y'])welcome.style.removeProperty(name);});
// Presentation text size: one scale drives the residence panel's type and its column width.
const TYPE_STEPS=[.85,.92,1,1.1,1.22];
let typeStep=TYPE_STEPS.indexOf(1);
const typeDots=[...$('.type-size-track').children];
function applyTypeScale(persist=true){
 typeStep=Math.min(TYPE_STEPS.length-1,Math.max(0,typeStep));
 const scale=TYPE_STEPS[typeStep];
 document.documentElement.style.setProperty('--type-scale',String(scale));
 $('#type-smaller').disabled=typeStep===0;$('#type-larger').disabled=typeStep===TYPE_STEPS.length-1;
 $('#type-size-value').textContent=Math.round(scale*100)+'%';
 for(const [i,dot] of typeDots.entries()){dot.classList.toggle('on',i<=typeStep);dot.classList.toggle('current',i===typeStep);}
 if(persist)try{localStorage.setItem('flatiron-type-scale',String(typeStep))}catch{}
}
try{const saved=localStorage.getItem('flatiron-type-scale');if(saved!==null&&TYPE_STEPS[Number(saved)])typeStep=Number(saved)}catch{}
$('#type-smaller').onclick=()=>{typeStep--;applyTypeScale()};
$('#type-larger').onclick=()=>{typeStep++;applyTypeScale()};
applyTypeScale(false);

const initialPlan=window.FLOORPLAN_INITIAL||new URLSearchParams(location.search).get('plan');
selectPlan(initialPlan&&byId[initialPlan]?initialPlan:'elle',false);resize();requestRender();
window.floorplan={plans,selectPlan,setMode,setLighting,focus,exportImage,renderer,scene,setTypeScale(step){typeStep=step;applyTypeScale()},get typeScale(){return TYPE_STEPS[typeStep]},setLabels(value){labels=value;$('#labels').setAttribute('aria-pressed',String(value));requestRender()},invalidate:invalidateScene,get walkthrough(){return walk},exitWalk,get lighting(){return lighting},get model(){return model},get camera(){return activeCamera},getState:()=>({plan:current.id,mode,lighting:lightingMode,furnished,fullWalls,labels,activeRoom,area:current.area,width:model.width,depth:model.depth})};
window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('plan');selectPlan(id&&byId[id]?id:'elle',false);});




