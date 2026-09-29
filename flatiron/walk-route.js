// Grid search uses the same clearance and collision rules as manual walking.
// The returned points are simplified only when the walking solver can follow a straight segment.
export function planWalkRoute(world,from,to,step=.16){
 const clear=(a,b)=>{const moved=world.move(a,b.x-a.x,b.z-a.z);return Math.hypot(moved.x-b.x,moved.z-b.z)<.025;};
 const destination=world.canStand(to.x,to.z)?to:(()=>{
  for(let ring=1;ring<=3;ring++)for(let i=0;i<24;i++){
   const angle=i*Math.PI/12,p={x:to.x+Math.cos(angle)*ring*step/2,z:to.z+Math.sin(angle)*ring*step/2};
   if(world.canStand(p.x,p.z))return p;
  }
  throw Error('A guided tour stop has no standing room.');
 })();
 if(clear(from,destination))return [destination];
 const bounds=world.floors.flat(),xs=bounds.map(p=>p[0]),zs=bounds.map(p=>p[1]);
 const minX=Math.floor((Math.min(...xs)-from.x)/step)-1,maxX=Math.ceil((Math.max(...xs)-from.x)/step)+1;
 const minZ=Math.floor((Math.min(...zs)-from.z)/step)-1,maxZ=Math.ceil((Math.max(...zs)-from.z)/step)+1;
 const key=(x,z)=>x+','+z,point=(x,z)=>({x:from.x+x*step,z:from.z+z*step});
 const valid=new Map(),canUse=(x,z)=>{
  if(x<minX||x>maxX||z<minZ||z>maxZ)return false;
  const id=key(x,z);if(!valid.has(id)){const p=point(x,z);valid.set(id,world.canStand(p.x,p.z));}return valid.get(id);
 };
 const heap=[],push=node=>{heap.push(node);for(let i=heap.length-1;i>0;){const parent=(i-1)>>1;if(heap[parent].f<=heap[i].f)break;[heap[i],heap[parent]]=[heap[parent],heap[i]];i=parent;}},pop=()=>{
  const first=heap[0],last=heap.pop();if(heap.length){heap[0]=last;for(let i=0;;){const left=i*2+1,right=left+1,small=right<heap.length&&heap[right].f<heap[left].f?right:left;if(small>=heap.length||heap[i].f<=heap[small].f)break;[heap[i],heap[small]]=[heap[small],heap[i]];i=small;}}return first;
 };
 const best=new Map([['0,0',0]]),parents=new Map(),closed=new Set();
 push({x:0,z:0,g:0,f:Math.hypot(destination.x-from.x,destination.z-from.z)});
 let found=null;
 for(let explored=0;heap.length&&explored<30000;){
  const current=pop(),id=key(current.x,current.z);if(closed.has(id))continue;closed.add(id);explored++;
  const here=point(current.x,current.z);
  if(Math.hypot(here.x-destination.x,here.z-destination.z)<step*1.6&&clear(here,destination)){found=id;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const nx=current.x+dx,nz=current.z+dz,nid=key(nx,nz);if(closed.has(nid)||!canUse(nx,nz))continue;
   if(dx&&dz&&(!canUse(current.x+dx,current.z)||!canUse(current.x,current.z+dz)))continue;
   const next=point(nx,nz);if(!clear(here,next))continue;
   const g=current.g+Math.hypot(dx,dz)*step;if(g>=(best.get(nid)??Infinity))continue;
   best.set(nid,g);parents.set(nid,id);push({x:nx,z:nz,g,f:g+Math.hypot(next.x-destination.x,next.z-destination.z)});
  }
 }
 if(!found)throw Error('The guided tour cannot reach a room through the current layout.');
 const raw=[destination];for(let id=found;id!=='0,0';id=parents.get(id)){const [x,z]=id.split(',').map(Number);raw.unshift(point(x,z));}
 const simplified=[];let anchor=from,index=0;
 while(index<raw.length){let far=index;for(let i=raw.length-1;i>index;i--)if(clear(anchor,raw[i])){far=i;break;}simplified.push(raw[far]);anchor=raw[far];index=far+1;}
 return simplified;
}
