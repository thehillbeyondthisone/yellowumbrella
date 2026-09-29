import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

export function polygonArea(points){return Math.abs(points.reduce((v,a,i)=>{const b=points[(i+1)%points.length];return v+a[0]*b[1]-b[0]*a[1]},0))/2}
export function buildResidence(p,mat){
 const root=new T.Group(),shell=new T.Group(),walls=new T.Group(),fixed=new T.Group(),loose=new T.Group(),tall=new T.Group(),glass=new T.Group(),frames=new T.Group();
 root.add(shell,walls,fixed,loose,tall,glass,frames);
 const geometryCache=new Map(),ownedGeometry=new Set();
 function cached(key,create){if(!geometryCache.has(key))geometryCache.set(key,create());return geometryCache.get(key);}
 function meterUV(geo){const pos=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));uv.setXY(i,ny>=nx&&ny>=nz?pos.getX(i):nx>nz?pos.getZ(i):pos.getX(i),ny>=nx&&ny>=nz?-pos.getZ(i):pos.getY(i));}return geo;}
 const S=Math.sqrt(p.area*.09290304/polygonArea(p.footprint));
 const pts=[...p.footprint,...p.balcony],xs=pts.map(v=>v[0]),zs=pts.map(v=>v[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 const X=x=>(x-cx)*S,Z=z=>(z-cz)*S;
 function mesh(geo,m,parent,x=0,y=0,z=0){ownedGeometry.add(geo);const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=m!==mat.glass;o.receiveShadow=true;parent.add(o);return o}
 function box(parent,x,y,z,w,h,d,m,r=0){const geo=cached(`box:${w}:${h}:${d}:${r}`,()=>meterUV(r?new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d)));const o=mesh(geo,m,parent,x,y+h/2,z);o.userData.bottom=y;o.userData.height=h;return o}
 function cylinder(parent,x,y,z,r,h,m){return mesh(cached(`cylinder:${r}:${h}`,()=>new T.CylinderGeometry(r,r,h,16)),m,parent,x,y+h/2,z)}
 function sphere(parent,x,y,z,w,h,d,m){const o=mesh(cached('sphere',()=>new T.SphereGeometry(1,20,12)),m,parent,x,y,z);o.scale.set(w,h,d);return o}
 function polygon(points,y,h,m,parent=shell){const shape=new T.Shape(points.map(v=>new T.Vector2(X(v[0]),-Z(v[1]))));const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});g.rotateX(-Math.PI/2);return mesh(g,m,parent,0,y,0)}
 function slab(r,y,h,m,parent=shell){return box(parent,X((r[0]+r[2])/2),y,Z((r[1]+r[3])/2),(r[2]-r[0])*S,h,(r[3]-r[1])*S,m)}
 polygon(p.footprint,-.24,.24,mat.cabinet);polygon(p.footprint,.002,.025,mat.wood);
 if(p.balcony.length)polygon(p.balcony,-.16,.19,mat.deck);
 for(const r of p.rooms.filter(r=>r.material==='tile')){if(r.polygon)polygon(r.polygon,.03,.012,mat.tile);else slab(r.rect,.03,.012,mat.tile);}
 function segment(a,b,width,height,y,m,parent){const len=Math.hypot(b[0]-a[0],b[1]-a[1])*S;const o=box(parent,X((a[0]+b[0])/2),y,Z((a[1]+b[1])/2),len+width,height,width,m);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);return o}
 // Split collinear wall runs around explicit openings; works for diagonal runs too.
 const perimeter=p.footprint.map((a,i)=>[...a,...p.footprint[(i+1)%p.footprint.length],8]);
 const raw=p.wallMode==='explicit'||p.id==='elle'?p.walls:[...perimeter,...p.walls];
 const wallPieces=[];
 for(const w of raw){const a=w.slice(0,2),b=w.slice(2,4),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1)continue;const ux=dx/len,uz=dz/len;let intervals=[[0,len]];
  for(const o of p.openings){const dist=v=>Math.abs((v[0]-a[0])*uz-(v[1]-a[1])*ux);if(dist(o.a)>4||dist(o.b)>4)continue;const ts=[o.a,o.b].map(v=>(v[0]-a[0])*ux+(v[1]-a[1])*uz).sort((x,y)=>x-y);intervals=intervals.flatMap(([l,r])=>ts[1]<=l||ts[0]>=r?[[l,r]]:[[l,Math.max(l,ts[0])],[Math.min(r,ts[1]),r]].filter(v=>v[1]-v[0]>1));}
  for(const [l,r] of intervals){wallPieces.push({a:[a[0]+ux*l,a[1]+uz*l],b:[a[0]+ux*r,a[1]+uz*r],t:w[4]?Math.max(.075,Math.min(.18,w[4]*S)):.105});}
 }
 const onEdge=(pt,w,tolerance=6)=>{const dx=w[2]-w[0],dz=w[3]-w[1],l=Math.hypot(dx,dz);return l&&Math.abs((pt[0]-w[0])*dz-(pt[1]-w[1])*dx)/l<tolerance&&pt[0]>=Math.min(w[0],w[2])-tolerance&&pt[0]<=Math.max(w[0],w[2])+tolerance&&pt[1]>=Math.min(w[1],w[3])-tolerance&&pt[1]<=Math.max(w[1],w[3])+tolerance;};
 const inside=pt=>{let yes=false;for(let i=0,j=p.footprint.length-1;i<p.footprint.length;j=i++){const a=p.footprint[i],b=p.footprint[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 for(const w of wallPieces){const o=segment(w.a,w.b,w.t,2.74,0,mat.wall,walls);const mid=[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2];o.userData.wall=true;o.userData.terrace=!inside(mid)&&!perimeter.some(v=>onEdge(mid,v));segment(w.a,w.b,w.t+.012,.065,.03,mat.white,shell);}
 for(const o of p.openings){const window=o.kind==='window',isGlass=o.kind==='glassDoor',len=Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1])*S;
  if(window){segment(o.a,o.b,.10,.18,.025,mat.wall,shell);segment(o.a,o.b,.025,2.0,.22,mat.glass,glass);for(let j=0;j<=3;j++){const v=[o.a[0]+(o.b[0]-o.a[0])*j/3,o.a[1]+(o.b[1]-o.a[1])*j/3];box(glass,X(v[0]),.2,Z(v[1]),.04,2.06,.04,mat.metal);}for(const h of [.22,2.25])segment(o.a,o.b,.045,.04,h,mat.metal,glass);}
  else {const frame=new T.Group();frame.position.set(X(o.a[0]),.025,Z(o.a[1]));frame.rotation.y=-Math.atan2(o.b[1]-o.a[1],o.b[0]-o.a[0]);frames.add(frame);frame.userData={opening:o,clearHeight:2.14};
   // Open portals communicate position without assuming hinges or swing direction.
   const trim=isGlass?mat.metal:mat.trim,post=.055,head=.06;
   for(const x of [0,len])box(frame,x,0,0,post,2.14,.17,trim);
   box(frame,len/2,2.14,0,len+post,head,.17,trim);
  }
  const headerBottom=window?2.26:2.225;
  segment(o.a,o.b,.12,2.74-headerBottom,headerBottom,mat.wall,tall);
 }
 // Rail only on terrace edges that are not shared with the enclosed polygon.
 for(let i=0;i<p.balcony.length;i++){const a=p.balcony[i],b=p.balcony[(i+1)%p.balcony.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];const shared=perimeter.some(w=>{const dx=w[2]-w[0],dy=w[3]-w[1],l=Math.hypot(dx,dy);return l&&Math.abs((mid[0]-w[0])*dy-(mid[1]-w[1])*dx)/l<5&&mid[0]>=Math.min(w[0],w[2])-5&&mid[0]<=Math.max(w[0],w[2])+5&&mid[1]>=Math.min(w[1],w[3])-5&&mid[1]<=Math.max(w[1],w[3])+5});if(shared)continue;segment(a,b,.03,.035,1.05,mat.dark,fixed);const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*S/.22);for(let j=0;j<=count;j++)box(fixed,X(a[0]+(b[0]-a[0])*j/count),.04,Z(a[1]+(b[1]-a[1])*j/count),.022,1.03,.022,mat.dark);}
 const fabricLight=mat.fabric,bedding=mat.bedding,water=mat.water;
 function furnish(it){const r=it.rect,rotation=it.rotation||0,turn=rotation%180!==0&&rotation%90===0;let w=(r[2]-r[0])*S,d=(r[3]-r[1])*S;if(it.localSize)[w,d]=it.localSize.map(v=>v*S);else if(turn)[w,d]=[d,w];const g=new T.Group();g.position.set(X((r[0]+r[2])/2),.04,Z((r[1]+r[3])/2));g.rotation.y=-rotation*Math.PI/180;g.userData.item=it;const isLoose=['bed','nightstand','sofa','chair','stool','coffee','table','desk','rug','side','console','diningRound','tv'].includes(it.kind);(isLoose?loose:fixed).add(g);
 const B=(x,y,z,ww,hh,dd,m=mat.cabinet,rr=0)=>box(g,x,y,z,Math.max(.005,ww),Math.max(.005,hh),Math.max(.005,dd),m,rr),C=(x,y,z,rr,hh,m)=>cylinder(g,x,y,z,rr,hh,m),E=(x,y,z,ww,hh,dd,m)=>sphere(g,x,y,z,ww,hh,dd,m);
 const legs=(height,inset=.08)=>{for(const x of [-w/2+inset,w/2-inset])for(const z of [-d/2+inset,d/2-inset])C(x,0,z,.022,height,mat.dark)};
 const counterTop=(y,holes)=>{const xs=[-w/2,w/2,...holes.flatMap(h=>[h.x-h.w/2,h.x+h.w/2])].sort((a,b)=>a-b),zs=[-d/2,d/2,...holes.flatMap(h=>[h.z-h.d/2,h.z+h.d/2])].sort((a,b)=>a-b);for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2,ww=xs[i]-xs[i-1],dd=zs[j]-zs[j-1];if(ww<.001||dd<.001||x<-w/2||x>w/2||z<-d/2||z>d/2||holes.some(h=>Math.abs(x-h.x)<h.w/2&&Math.abs(z-h.z)<h.d/2))continue;B(x,y,z,ww,.045,dd,mat.stone);}};
 switch(it.kind){
 case 'rug':B(0,0,0,w,.018,d,mat.rug,.02);break;
 case 'stool':B(0,.44,0,w,.075,d,fabricLight,.035);B(0,.49,-d/2+.025,w,.20,.05,mat.blue,.02);legs(.44,Math.min(.06,w*.2,d*.2));break;
 case 'bed':{B(0,.12,0,w,.26,d,mat.cabinet,.055);B(0,.36,0,w-.05,.22,d-.05,bedding,.07);B(0,.58,d*.12,w-.035,.12,d*.72,bedding,.055);B(0,.70,d*.29,w,.035,d*.28,mat.blue,.018);B(0,.06,-d/2+.035,w+.06,1.02,.10,fabricLight,.025);for(const x of [-w*.25,w*.25])B(x,.61,-d*.30,w*.41,.15,d*.20,bedding,.07);legs(.14);break;}
 case 'sofa':case 'chair':{const arm=Math.min(.13,w*.15),back=.14;B(0,.12,0,w,.25,d,mat.dark,.05);B(0,.35,-d/2+back/2,w,.46,back,mat.blue,.055);B(-w/2+arm/2,.30,0,arm,.40,d,mat.blue,.045);B(w/2-arm/2,.30,0,arm,.40,d,mat.blue,.045);const n=it.kind==='chair'?1:Math.max(2,Math.round(w/.65));for(let j=0;j<n;j++){const cw=(w-arm*2)/n,x=-w/2+arm+cw*(j+.5);B(x,.36,.06,cw-.018,.15,d-.20,fabricLight,.045);const cushion=B(x,.52,-d/2+.18,cw-.04,.30,.13,mat.blue,.055);cushion.rotation.x=-.12;}legs(.15);break;}
 case 'coffee':case 'table':case 'desk':case 'side':case 'console':{const h=it.kind==='coffee'?.40:it.kind==='side'?.49:.74;B(0,h,0,w,.055,d,it.kind==='coffee'?mat.stone:mat.cabinet,.025);legs(h);if(it.kind==='desk'){B(0,h+.055,-d*.10,w*.38,.012,d*.38,mat.dark);B(0,h+.065,-d*.29,w*.40,.26,.018,mat.dark,.01);}if(it.kind==='coffee'){B(-w*.13,h+.06,0,w*.28,.03,d*.4,bedding,.01);B(-w*.13,h+.09,0,w*.28,.012,d*.4,mat.blue);C(w*.26,h+.06,0,.07,.14,mat.white);E(w*.26,h+.30,0,.13,.20,.12,mat.green);}break;}
 case 'diningRound':{const o=C(0,.74,0,1,.06,mat.cabinet);o.scale.set(w/2,1,d/2);C(0,.03,0,.16,.70,mat.dark);break;}
 case 'nightstand':B(0,.06,0,w,.42,d,mat.cabinet,.025);B(0,.25,d/2+.006,w*.35,.018,.015,mat.gold);C(0,.48,0,.085,.08,mat.gold);C(0,.56,0,.013,.20,mat.gold);C(0,.72,0,.13,.18,mat.lamp);break;
 case 'counter':{B(0,.08,0,w,.76,d,mat.cabinet);B(0,.03,d*.06,w-.05,.07,d-.06,mat.dark);const count=Math.max(1,Math.round(w/.5));for(let j=0;j<count;j++){const cw=w/count,x=-w/2+cw*(j+.5);B(x,.12,d/2+.008,cw-.016,.67,.015,mat.cabinet);B(x,.69,d/2+.027,Math.min(.15,cw*.55),.018,.025,mat.dark);}
 // Transform source inserts into the counter's local axes, including diagonal runs.
 const angle=rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),holes=[];
 for(const v of p.items.filter(v=>v.kind==='sink')){const hr=v.rect,dx=(hr[0]+hr[2]-r[0]-r[2])*S/2,dz=(hr[1]+hr[3]-r[1]-r[3])*S/2;let sw=(hr[2]-hr[0])*S,sd=(hr[3]-hr[1])*S;if(v.localSize)[sw,sd]=v.localSize.map(n=>n*S);else if((v.rotation||0)%180!==0)[sw,sd]=[sd,sw];const relative=((v.rotation||0)-rotation)*Math.PI/180,hx=c*dx+s*dz,hz=-s*dx+c*dz,hw=Math.abs(Math.cos(relative))*sw*.76+Math.abs(Math.sin(relative))*sd*.72,hd=Math.abs(Math.sin(relative))*sw*.76+Math.abs(Math.cos(relative))*sd*.72;if(Math.abs(hx)+hw/2<w/2&&Math.abs(hz)+hd/2<d/2)holes.push({x:hx,z:hz,w:hw,d:hd});}
 counterTop(.84,holes);break;}
 case 'sink':case 'vanity':{const vanity=it.kind==='vanity',count=it.basins||1,bw=w/count*.78,bd=d*.74,centers=Array.from({length:count},(_,i)=>-w/2+w/count*(i+.5));if(vanity){B(0,.1,0,w,.70,d,mat.cabinet);counterTop(.80,centers.map(x=>({x,z:0,w:bw,d:bd})));}const y=vanity?.845:.888;for(const center of centers){B(center,y-.05,0,bw,.018,bd,mat.dark,.02);B(center,y-.039,0,bw*.82,.012,bd*.80,mat.metal,.015);for(const x of [-bw/2,bw/2])B(center+x,y-.045,0,.022,.07,bd,mat.metal);for(const z of [-bd/2,bd/2])B(center,y-.045,z,bw,.07,.022,mat.metal);C(center,y,-d*.43,.016,.26,mat.metal);B(center,y+.23,-d*.26,.027,.027,d*.34,mat.metal);}if(vanity){const mirror=new T.Group();mirror.position.copy(g.position);mirror.rotation.copy(g.rotation);tall.add(mirror);box(mirror,0,1.12,-d/2+.01,w*.88,.84,.025,mat.metal);}break;}
 case 'stove':B(0,.89,0,w,.025,d,mat.dark,.01);for(const x of [-w*.25,w*.25])for(const z of [-d*.23,d*.23]){C(x,.918,z,Math.min(w,d)*.17,.012,mat.metal);C(x,.93,z,Math.min(w,d)*.12,.012,mat.dark);}break;
 case 'fridge':B(0,.02,0,w,1.94,d,mat.metal,.025);B(0,.66,d/2+.01,w-.015,.015,.02,mat.dark);B(0,.7,d/2+.01,.009,1.2,.021,mat.dark);for(const x of [-.045,.045])B(x,1.1,d/2+.035,.022,.48,.032,mat.dark);break;
 case 'laundry':{B(0,.03,0,w,1.65,d,mat.white,.02);for(const h of [.44,1.21]){const drum=C(0,h,d/2+.016,Math.min(w*.32,.24),.03,mat.metal);drum.rotation.x=Math.PI/2;const inner=C(0,h,d/2+.037,Math.min(w*.25,.18),.032,mat.dark);inner.rotation.x=Math.PI/2;B(0,h+.31,d/2+.01,w*.78,.09,.02,mat.metal);}break;}
 case 'tub':{B(0,.03,0,w,.48,d,mat.white,.07);B(0,.50,0,w*.76,.012,d*.80,water,.09);for(const x of [-w*.45,w*.45])B(x,.45,0,w*.09,.08,d*.89,mat.white,.025);for(const z of [-d*.46,d*.46])B(0,.45,z,w*.88,.08,d*.07,mat.white,.025);C(0,.52,-d*.31,.025,.01,mat.metal);break;}
 case 'shower':{B(0,.02,0,w,.045,d,mat.tile);C(0,.07,0,.025,.008,mat.metal);const screen=new T.Group();screen.position.copy(g.position);screen.rotation.copy(g.rotation);glass.add(screen);box(screen,0,.10,-d/2,w,1.95,.018,mat.glass);box(screen,-w/2,.10,0,.018,1.95,d,mat.glass);box(screen,-w/2,.10,-d/2,.025,2.0,.025,mat.metal);break;}
 case 'toilet':B(0,.03,0,w*.44,.32,d*.50,mat.white,.06);E(0,.42,d*.12,w*.43,.17,d*.36,mat.white);E(0,.568,d*.12,w*.33,.018,d*.26,mat.dark);E(0,.584,d*.12,w*.27,.018,d*.21,mat.white);B(0,.06,-d*.33,w*.75,.68,d*.24,mat.white,.04);break;
 case 'closet':{B(0,.02,0,w,.055,d,mat.cabinet);const shelf=new T.Group();shelf.position.copy(g.position);shelf.rotation.copy(g.rotation);tall.add(shelf);box(shelf,0,1.85,0,w,.035,d,mat.white);box(shelf,0,1.6,0,w,.018,.018,mat.metal);for(let x=-w/2+.08;x<w/2;x+=.13)box(shelf,x,1.07,0,.035,.52,d*.65,Math.round(x*100)%2?fabricLight:mat.blue);break;}
 case 'tv':B(0,.03,0,w,.36,d,mat.cabinet,.02);B(0,.41,0,w*.9,.72,.025,mat.dark,.01);break;
 case 'utility':B(0,.03,0,w,.55,d,mat.white,.03);B(0,.59,0,w*.7,.015,d*.7,mat.tile,.03);break;
 }
 }
 // Rugs first to retain consistent material ordering.
 for(const it of p.items)furnish(it);
 function setWalls(full){const height=full?2.74:.78;for(const o of walls.children){const h=o.userData.terrace?.78:height;o.scale.y=h/2.74;o.position.y=h/2;}tall.visible=full;
  // Section the jambs at the wall plane. Hide the head entirely in cutaway;
  // never squash a complete portal or leave its overhead shadow in the room.
  for(const frame of frames.children){for(const post of frame.children.slice(0,2)){const h=full?post.userData.height:Math.max(0,height-frame.position.y);post.scale.y=h/post.userData.height;post.position.y=h/2;}frame.children[2].visible=full;}
  // Trim glazing from its top, retaining sill heights and rail thicknesses.
  root.updateMatrixWorld(true);glass.traverse(o=>{if(!o.isMesh)return;const bottom=o.userData.bottom,h=o.userData.height,parentY=o.parent.getWorldPosition(new T.Vector3()).y;const visibleHeight=full?h:Math.max(0,Math.min(h,height-parentY-bottom));o.visible=visibleHeight>0;o.scale.y=visibleHeight/h;o.position.y=bottom+visibleHeight/2;});
 }
 setWalls(false);
 return {root,shell,walls,fixed,loose,tall,glass,frames,S,X,Z,cx,cz,wallPieces,width:(Math.max(...xs)-Math.min(...xs))*S,depth:(Math.max(...zs)-Math.min(...zs))*S,setWalls,dispose(){for(const geo of ownedGeometry)geo.dispose();ownedGeometry.clear();geometryCache.clear();}};
}
