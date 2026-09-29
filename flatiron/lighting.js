import * as T from 'three';

// Positions use the same source pixels as rooms and furniture; heights use meters.
// Explicit room lights replace that room's inferred lights. lights: [] suppresses them.
export function resolveLights(plan) {
 const center=r=>[(r[0]+r[2])/2,(r[1]+r[3])/2];
 const inside=(pt,r)=>pt[0]>=r[0]&&pt[0]<=r[2]&&pt[1]>=r[1]&&pt[1]<=r[3];
 const gap=(pt,r)=>Math.hypot(Math.max(r[0]-pt[0],0,pt[0]-r[2]),Math.max(r[1]-pt[1],0,pt[1]-r[3]));
 // Room rectangles are traced, so a piece drawn tight against a wall can land just outside its
 // room (Monaco's upper nightstand). Adopt an unclaimed item into the nearest room within ADOPT
 // source pixels; items inside a room always stay with that room.
 const ADOPT=44;
 const roomItems=plan.rooms.map(()=>[]);
 for(const item of plan.items){
  const c=center(item.rect);
  let home=plan.rooms.findIndex(r=>inside(c,r.rect));
  if(home<0)plan.rooms.forEach((r,i)=>{const d=gap(c,r.rect);if(d<=ADOPT&&(home<0||d<gap(c,plan.rooms[home].rect)))home=i});
  if(home>=0)roomItems[home].push(item);
 }
 const result=[];
 for(const [index,room] of plan.rooms.entries()){
  if(room.lights!==undefined){result.push(...room.lights.map(l=>({...l,room:room.id,source:'indicated'})));continue;}
  if(room.material==='deck'||/balcony|closet|utility/i.test(room.id))continue;
  const items=roomItems[index];
  const add=(kind,position,extra={})=>result.push({kind,position,room:room.id,source:'inferred',...extra});
  if(/bath/i.test(room.id)){const vanity=items.find(i=>i.kind==='vanity');add('task',vanity?center(vanity.rect):center(room.rect));}
  else if(/kitchen/i.test(room.id)){const counters=items.filter(i=>i.kind==='counter');if(counters.length)for(const i of counters.slice(0,2))add('task',center(i.rect));else add('ceiling',center(room.rect));}
  else {
   const stands=items.filter(i=>i.kind==='nightstand'||i.kind==='side');
   for(const i of stands.slice(0,2))add('table',center(i.rect),{height:i.kind==='nightstand'?.85:.87,loose:true});
   if(!stands.length||/living/i.test(room.id)){const anchor=items.find(i=>i.kind==='coffee')||items.find(i=>i.kind==='bed');add('ceiling',anchor?center(anchor.rect):center(room.rect));}
  }
 }
 return plan.lights!==undefined?plan.lights.map(l=>({...l,source:'indicated'})):result;
}

export function createResidenceLighting(plan,model,mat){
 const group=new T.Group();group.name='Residence lighting';model.root.add(group);
 const records=resolveLights(plan),lamps=[];
 for(const record of records){
  const table=record.kind==='table',height=record.height??(table?.85:2.4);
  const x=model.X(record.position[0]),z=model.Z(record.position[1]);
  // Downward spots give localized pools without the six shadow passes of point lights.
  const light=new T.SpotLight(record.color??0xffd29b,record.intensity??(table?5:record.kind==='task'?13:19),record.distance??(table?3.2:6),table?1.25:1.05,.85,2);
  light.position.set(x,height,z);light.target.position.set(x,.05,z);group.add(light,light.target);
  // Budget shadow work consistently across apartments; all other lights remain inexpensive.
  if(!table&&lamps.filter(l=>l.light.castShadow).length<2){light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.normalBias=.035;light.shadow.bias=-.0003;}
  lamps.push({record,light});
 }
 return {records,setState(cozy,furnished){for(const {record,light} of lamps){light.visible=cozy&&(!record.loose||furnished);}},dispose(){for(const {light} of lamps)light.dispose();group.traverse(o=>o.geometry?.dispose());group.removeFromParent();}};
}
