// Small, dependency-free, planar collision world. All distances are in meters.
export function pointInPolygon(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function createCollisionWorld(plan,model,radius=.22){
 const boxes=[],floors=[plan.footprint,plan.balcony].filter(p=>p.length).map(p=>p.map(v=>[model.X(v[0]),model.Z(v[1])]));
 const add=(x,z,w,d,angle,kind)=>boxes.push({x,z,hx:w/2,hz:d/2,c:Math.cos(angle),s:Math.sin(angle),kind});
 const segment=(a,b,thickness,kind)=>{const x1=model.X(a[0]),z1=model.Z(a[1]),x2=model.X(b[0]),z2=model.Z(b[1]);add((x1+x2)/2,(z1+z2)/2,Math.hypot(x2-x1,z2-z1)+thickness,thickness,Math.atan2(z2-z1,x2-x1),kind);};
 for(const w of model.wallPieces)segment(w.a,w.b,w.t,'wall');
 for(const o of plan.openings){if(o.kind==='window')segment(o.a,o.b,.025,'glass');else {const angle=Math.atan2(o.b[1]-o.a[1],o.b[0]-o.a[0]);for(const p of [o.a,o.b])add(model.X(p[0]),model.Z(p[1]),.055,.17,angle,'frame');}}
 const looseKinds=new Set(['bed','nightstand','sofa','chair','stool','coffee','table','desk','rug','side','console','diningRound','tv']);
 for(const it of plan.items){if(['rug','sink','stove'].includes(it.kind)||(model.loose?.visible===false&&looseKinds.has(it.kind)))continue;const r=it.rect,angle=(it.rotation||0)*Math.PI/180;let w=(r[2]-r[0])*model.S,d=(r[3]-r[1])*model.S;if(it.localSize)[w,d]=it.localSize.map(v=>v*model.S);else if(it.localSize)[w,d]=it.localSize.map(v=>v*model.S);else if(it.localSize)[w,d]=it.localSize.map(v=>v*model.S);else if((it.rotation||0)%180!==0&&(it.rotation||0)%90===0)[w,d]=[d,w];add(model.X((r[0]+r[2])/2),model.Z((r[1]+r[3])/2),w,d,angle,it.kind);}
 // Stay on supported floors, including the full player radius at exterior edges.
 const supported=(x,z)=>floors.some(p=>pointInPolygon(x,z,p));
 function onFloor(x,z){if(!supported(x,z))return false;for(let i=0;i<24;i++){const a=i*Math.PI/12;if(!supported(x+Math.cos(a)*radius,z+Math.sin(a)*radius))return false;}return true;}
 function penetration(x,z,b){
  const dx=x-b.x,dz=z-b.z,lx=dx*b.c+dz*b.s,lz=-dx*b.s+dz*b.c;
  const qx=Math.max(-b.hx,Math.min(b.hx,lx)),qz=Math.max(-b.hz,Math.min(b.hz,lz));let nx=lx-qx,nz=lz-qz,dist=Math.hypot(nx,nz),amount;
  if(dist>=radius)return null;
  if(dist>1e-8){nx/=dist;nz/=dist;amount=radius-dist+.00001;}
  else if(b.hx-Math.abs(lx)<b.hz-Math.abs(lz)){nx=lx<0?-1:1;nz=0;amount=b.hx-Math.abs(lx)+radius+.00001;}
  else {nx=0;nz=lz<0?-1:1;amount=b.hz-Math.abs(lz)+radius+.00001;}
  return {x:(nx*b.c-nz*b.s)*amount,z:(nx*b.s+nz*b.c)*amount};
 }
 const canStand=(x,z)=>onFloor(x,z)&&!boxes.some(b=>penetration(x,z,b));
 function step(position,dx,dz){
  let x=position.x+dx,z=position.z+dz;
  for(let pass=0;pass<6;pass++){let hit=false;for(const b of boxes){const p=penetration(x,z,b);if(p){x+=p.x;z+=p.z;hit=true;}}if(!hit)break;}
  if(canStand(x,z))return {x,z};
  // Slide at exterior floor edges; never project the player into unsupported space.
  if(canStand(x,position.z))return {x,z:position.z};
  if(canStand(position.x,z))return {x:position.x,z};
  return position;
 }
 function move(position,dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.045));let p={...position};for(let i=0;i<steps;i++)p=step(p,dx/steps,dz/steps);return p;}
 return {boxes,floors,radius,canStand,move};
}
