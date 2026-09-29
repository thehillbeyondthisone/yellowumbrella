import * as T from 'three';
import {createCollisionWorld} from './walk-collision.js';
import {planWalkRoute} from './walk-route.js';
import {walkthroughCeiling} from './material-palette.js';

// Rounds each corner of a planned route with a short curve, tightening or dropping it wherever the curve would clip a wall.
function smoothRoute(world,start,path){
 const clear=(a,b)=>{const moved=world.move(a,b.x-a.x,b.z-a.z);return Math.hypot(moved.x-b.x,moved.z-b.z)<.025;};
 const corners=[start,...path],points=[start];
 for(let i=1;i<corners.length-1;i++){
  const p=corners[i-1],c=corners[i],n=corners[i+1],inLength=Math.hypot(c.x-p.x,c.z-p.z),outLength=Math.hypot(n.x-c.x,n.z-c.z);
  let curve=null;
  for(const radius of [.75,.45,.22]){
   const r=Math.min(radius,inLength*.45,outLength*.45);if(r<.05)break;
   const a={x:c.x-(c.x-p.x)/inLength*r,z:c.z-(c.z-p.z)/inLength*r},b={x:c.x+(n.x-c.x)/outLength*r,z:c.z+(n.z-c.z)/outLength*r},samples=[];
   for(let k=0;k<=8;k++){const t=k/8,u=1-t;samples.push({x:u*u*a.x+2*u*t*c.x+t*t*b.x,z:u*u*a.z+2*u*t*c.z+t*t*b.z});}
   let previous=points[points.length-1];
   if(samples.every(q=>{const ok=clear(previous,q);previous=q;return ok;})){curve=samples;break;}
  }
  points.push(...(curve||[c]));
 }
 points.push(corners[corners.length-1]);
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
 return {points,lengths,total:lengths[lengths.length-1]};
}
function sampleRoute(route,distance){
 const {points,lengths}=route,s=Math.max(0,Math.min(route.total,distance));let i=1;
 while(i<points.length-1&&lengths[i]<s)i++;
 const t=(s-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
 return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,z:points[i-1].z+(points[i].z-points[i-1].z)*t};
}

// Loaded only after Walk inside is selected. No game engine or additional assets.
export function createWalkthrough({plan,model,element,scene,requestRender,onState,touch=false,touchControls}){
 if(!plan.walk)throw Error('This residence does not yet have a walkthrough.');
 const world=createCollisionWorld(plan,model),spawn={x:model.X(plan.walk.spawn[0]),z:model.Z(plan.walk.spawn[1])},keys=new Set();
 if(!world.canStand(spawn.x,spawn.z))throw Error('The walkthrough starting point is obstructed.');
 const camera=new T.PerspectiveCamera(68,element.clientWidth/element.clientHeight,.055,100);camera.rotation.order='YXZ';
 let position={...spawn},yaw=0,pitch=-.06,bob=0,paused=true,dragMode=false,dragging=false,last=0,disposed=false;
 let tour={status:'idle',stages:[],stage:0,distance:0,speed:0,accel:0,yawVel:0,heading:0,stride:0,dwell:0,blocked:0};
 const touchMoves=new Map();let lookPointer=null;
 const bindings=[],listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);bindings.push(()=>target.removeEventListener(type,fn,options));};
 const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
 // Eye-level ceiling is inexpensive, scoped to this session, and does not block the existing lighting.
 const shape=new T.Shape(plan.footprint.map(p=>new T.Vector2(model.X(p[0]),-model.Z(p[1]))));
 const ceilingGeometry=new T.ShapeGeometry(shape);ceilingGeometry.rotateX(-Math.PI/2);
 const ceilingMaterial=new T.MeshStandardMaterial({...walkthroughCeiling,side:T.DoubleSide});
 const ceiling=new T.Mesh(ceilingGeometry,ceilingMaterial);ceiling.position.y=2.74;ceiling.receiveShadow=false;scene.add(ceiling);
 function notify(reason=''){onState({paused,dragMode,locked:document.pointerLockElement===element,reason,tour:{status:tour.status,stage:tour.stage,total:tour.stages.length,name:tour.stages[tour.stage]?.name||''}});requestRender();}
 function syncCamera(){camera.position.set(position.x,1.69+bob,position.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
 function clearInput(){keys.clear();touchMoves.clear();lookPointer=null;touchControls?.querySelectorAll('button').forEach(b=>b.classList.remove('active'));last=0;}
 function reset(){const wasGuided=tour.status!=='idle';tour.status='idle';if(wasGuided){paused=true;dragMode=false;}position={...spawn};bob=0;yaw=Math.atan2(-(model.X(plan.walk.lookAt[0])-spawn.x),-(model.Z(plan.walk.lookAt[1])-spawn.z));pitch=-.06;clearInput();syncCamera();notify();}
 function pause(){clearInput();paused=true;dragging=false;if(tour.status==='running')tour.status='paused';if(document.pointerLockElement===element)document.exitPointerLock();notify();}
 function resume(){if(disposed)return;tour.status='idle';dragMode=false;clearInput();if(touch){paused=false;element.focus({preventScroll:true});notify();return;}try{const pending=element.requestPointerLock();pending?.catch(()=>{if(!disposed)notify('Mouse capture is unavailable. Choose Drag to look instead.');});}catch{notify('Mouse capture is unavailable. Choose Drag to look instead.');}}
 function useDrag(){tour.status='idle';dragMode=true;paused=false;keys.clear();last=0;element.focus();notify();}
 function startTour(){
  if(disposed||!plan.walk.tour?.length)return;
  if(tour.status==='paused'){Object.assign(tour,{status:'running',speed:0,accel:0,yawVel:0});paused=false;last=0;notify();return;}
  reset();
  const stages=[],stops=plan.walk.tour;let from={...spawn};
  try{for(const stop of stops){const to={x:model.X(stop.at[0]),z:model.Z(stop.at[1])},path=planWalkRoute(world,from,to);stages.push({name:stop.name,route:smoothRoute(world,from,path)});from=path[path.length-1];}}
  catch(error){paused=true;notify(error.message);return;}
  tour={status:'running',stages,stage:0,distance:0,speed:0,accel:0,yawVel:0,heading:yaw,stride:0,dwell:0,blocked:0};
  clearInput();dragMode=false;paused=false;element.focus({preventScroll:true});
  if(document.pointerLockElement===element)document.exitPointerLock();
  notify();
 }
 function takeControl(){tour.status='idle';bob=0;syncCamera();if(touch)resume();else useDrag();}
 listen(document,'pointerlockchange',()=>{if(disposed||tour.status==='running')return;paused=document.pointerLockElement!==element;keys.clear();last=0;notify();});
 listen(document,'pointerlockerror',()=>{if(!disposed){paused=true;notify('Mouse capture is unavailable. Choose Drag to look instead.');}});
 listen(window,'keydown',e=>{
  if(e.code==='Escape'){pause();return;}
  if(tour.status==='running'&&movementKeys.has(e.code)){takeControl();keys.add(e.code);e.preventDefault();return;}
  if(paused||document.querySelector('dialog[open]')||(dragMode&&document.activeElement!==element))return;
  if(movementKeys.has(e.code)){e.preventDefault();keys.add(e.code);requestRender();}
  if(e.code==='KeyR'){e.preventDefault();reset();}
 });
 listen(window,'keyup',e=>{keys.delete(e.code);if(!paused)requestRender();});
 listen(document,'mousemove',e=>{if(paused||tour.status==='running'||!(document.pointerLockElement===element||(dragMode&&dragging)))return;yaw-=e.movementX*.002;pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.002));syncCamera();requestRender();});
 listen(element,'pointerdown',e=>{if(tour.status==='running'&&e.button===0)takeControl();if(dragMode&&!paused&&e.button===0){dragging=true;element.focus();element.setPointerCapture(e.pointerId);}});
 listen(element,'pointerup',()=>{dragging=false;});listen(element,'lostpointercapture',()=>{dragging=false;});
 if(touch){
  listen(element,'pointerdown',e=>{if(paused||lookPointer)return;e.preventDefault();lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};element.setPointerCapture(e.pointerId);});
  listen(element,'pointermove',e=>{
   if(paused||lookPointer?.id!==e.pointerId)return;
   yaw-=(e.clientX-lookPointer.x)*.005;pitch=Math.max(-1.35,Math.min(1.35,pitch-(e.clientY-lookPointer.y)*.005));
   lookPointer.x=e.clientX;lookPointer.y=e.clientY;syncCamera();requestRender();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(element,type,e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;});
  for(const button of touchControls.querySelectorAll('[data-move]')){
   listen(button,'contextmenu',e=>e.preventDefault());
   listen(button,'pointerdown',e=>{if(tour.status==='running')takeControl();if(paused)return;e.preventDefault();button.setPointerCapture(e.pointerId);touchMoves.set(e.pointerId,button.dataset.move);button.classList.add('active');requestRender();});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>{touchMoves.delete(e.pointerId);if(![...touchMoves.values()].includes(button.dataset.move))button.classList.remove('active');if(!paused)requestRender();});
  }
 }
 listen(window,'blur',pause);listen(document,'visibilitychange',()=>{if(document.hidden)pause();});
 // Walks the smoothed route with spring-damped speed and heading: eases in and out of each stop, slows for turns, and looks ahead into curves.
 function updateTour(dt){
  const stage=tour.stages[tour.stage];
  if(!stage){tour.status='complete';paused=true;notify('Guided tour complete. Replay it or take control.');return false;}
  const settle=()=>{
   const turn=Math.atan2(Math.sin(tour.heading-yaw),Math.cos(tour.heading-yaw));
   tour.yawVel+=(4.8*Math.max(-.8,Math.min(.8,turn))-4.4*tour.yawVel)*dt;yaw+=tour.yawVel*dt;
   pitch+=(-.035-pitch)*(1-Math.exp(-dt*2.5));
   tour.stride+=dt*tour.speed*7.4;bob=Math.sin(tour.stride)*.008*Math.min(1,tour.speed/.95);
   syncCamera();return turn;
  };
  if(tour.dwell>0){
   tour.dwell=Math.max(0,tour.dwell-dt);
   const upcoming=tour.stages[tour.stage+1]?.route;
   if(upcoming&&tour.dwell<1.3){const ahead=sampleRoute(upcoming,1.2),ax=ahead.x-position.x,az=ahead.z-position.z;if(Math.hypot(ax,az)>.2)tour.heading=Math.atan2(-ax,-az);}
   settle();
   if(!tour.dwell){tour.stage++;tour.distance=0;if(tour.stage===tour.stages.length){tour.status='complete';paused=true;notify('Guided tour complete. Replay it or take control.');return false;}notify();}
   return true;
  }
  const route=stage.route,remaining=route.total-tour.distance;
  if(remaining<.01){tour.speed=tour.accel=0;tour.dwell=2.4;settle();notify();return true;}
  // Any drift from where the previous stage ended is blended out over the first metre instead of snapping.
  if(!tour.distance)tour.offset={x:position.x-route.points[0].x,z:position.z-route.points[0].z};
  const ahead=sampleRoute(route,tour.distance+1.2),ax=ahead.x-position.x,az=ahead.z-position.z;
  if(Math.hypot(ax,az)>.2)tour.heading=Math.atan2(-ax,-az);
  const turn=settle();
  const desired=.95*Math.max(.3,1-Math.abs(turn)/1.4),arrival=Math.sqrt(2*.35*Math.max(0,remaining-.01));
  tour.accel+=(7.3*(desired-tour.speed)-5.4*tour.accel)*dt;tour.speed=Math.max(0,tour.speed+tour.accel*dt);
  if(tour.speed>arrival){tour.accel=Math.min(tour.accel,(arrival-tour.speed)/Math.max(dt,1e-3));tour.speed=arrival;}
  tour.distance+=Math.min(remaining,Math.max(tour.speed,.06)*dt);
  const target=sampleRoute(route,tour.distance),fade=Math.max(0,1-tour.distance),dx=target.x+tour.offset.x*fade-position.x,dz=target.z+tour.offset.z*fade-position.z,step=Math.hypot(dx,dz);
  const next=world.move(position,dx,dz),advanced=Math.hypot(next.x-position.x,next.z-position.z);
  tour.blocked=step>1e-4&&advanced<step*.35?tour.blocked+dt:0;
  if(tour.blocked>.75){tour.status='paused';paused=true;notify('The tour is blocked. Take control or reset its position.');return false;}
  position=next;syncCamera();return true;
 }
 function update(t){
  if(tour.status==='running'){
   const dt=last?Math.min(.05,Math.max(0,(t-last)/1000)):0;last=t;
   return updateTour(dt);
  }
  if(paused||(!keys.size&&!touchMoves.size)){last=0;return false;}
  const dt=last?Math.min(.05,Math.max(0,(t-last)/1000)):0;last=t;
  const held=direction=>[...touchMoves.values()].includes(direction);
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp')||held('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||held('back'));
  const side=Number(keys.has('KeyD')||keys.has('ArrowRight')||held('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||held('left'));
  const length=Math.hypot(forward,side);if(!length)return false;
  const distance=dt*1.4/length;bob=0;
  position=world.move(position,(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*distance,(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*distance);
  syncCamera();return true;
 }
 reset();notify();
 return {camera,world,update,resume,useDrag,pause,reset,startTour,takeControl,getState:()=>({position:{...position},yaw,pitch,paused,dragMode,locked:document.pointerLockElement===element,tour:{status:tour.status,stage:tour.stage,total:tour.stages.length,name:tour.stages[tour.stage]?.name||'',distance:tour.distance,speed:tour.speed}}),dispose(){disposed=true;clearInput();for(const remove of bindings)remove();if(document.pointerLockElement===element)document.exitPointerLock();scene.remove(ceiling);ceilingGeometry.dispose();ceilingMaterial.dispose();}};
}
