import * as T from 'three';
import {materialPalette,textureSeed,paletteVersion} from './material-palette.js';
export function createMaterials(renderer){
performance.mark('materials-start');
let seed=textureSeed;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function surface(kind,base,repeat=[1,1],strength=.3){const n=kind==='plaster'?256:512,c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d'),im=ctx.createImageData(n,n),heights=new Float32Array(n*n),col=new T.Color(base);const rgb=[col.r,col.g,col.b].map(v=>T.ColorManagement.fromWorkingColorSpace(new T.Color(v,v,v),T.SRGBColorSpace).r*255);
// Seamless low-frequency plaster relief, generated from a tiny periodic noise grid.
const plaster=kind==='plaster'?Float32Array.from({length:32*32},()=>rand()-.5):null;
for(let y=0;y<n;y++)for(let x=0;x<n;x++){let noise=rand()-.5,h=.5,t=0;if(kind==='wood'){let plank=Math.floor(x/32),joint=x%32<1 || (y+(plank%3)*79)%256<2;h=joint?.1:.55+.065*Math.sin(x*.9+Math.sin(y*.034)*2)+noise*.05;t=(plank%4-1.5)*2+Math.sin(x*1.7+Math.sin(y*.043))*1.5+noise*5;if(joint)t-=16}
else if(kind==='fabric'){h=.45+((x%4<2)!==(y%4<2)?.22:0)+noise*.11;t=noise*26+((x+y)%4)*2}
else if(kind==='tile'){let grout=x%64<2||y%32<2;h=grout?.1:.55+noise*.015;t=grout?-32:noise*9+Math.floor(y/32)%2*5}
else if(kind==='stone'){h=.5+noise*.1;t=noise*12+(Math.sin(x*.047+y*.08+Math.sin(y*.025)*4)>.995?8:0)}
else if(plaster){const gx=x/8,gz=y/8,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);const a=plaster[iz*32+ix],b=plaster[iz*32+(ix+1)%32],c=plaster[((iz+1)%32)*32+ix],d=plaster[((iz+1)%32)*32+(ix+1)%32],v=(a+(b-a)*ux)*(1-uz)+(c+(d-c)*ux)*uz;h=.5+v*.8+noise*.07;t=v*22+noise*4;}
else {h=.5+noise*.18;t=noise*14}heights[y*n+x]=h;let i=(y*n+x)*4;for(let k=0;k<3;k++)im.data[i+k]=Math.max(0,Math.min(255,rgb[k]+t));im.data[i+3]=255}
ctx.putImageData(im,0,0);const nc=document.createElement('canvas');nc.width=nc.height=n;const nx=nc.getContext('2d'),ni=nx.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let dx=(heights[y*n+(x+1)%n]-heights[y*n+(x+n-1)%n])*strength,dy=(heights[((y+1)%n)*n+x]-heights[((y+n-1)%n)*n+x])*strength;const inv=1/Math.sqrt(dx*dx+dy*dy+1),i=(y*n+x)*4;ni.data[i]=(-dx*inv*.5+.5)*255;ni.data[i+1]=(-dy*inv*.5+.5)*255;ni.data[i+2]=(inv*.5+.5)*255;ni.data[i+3]=255}nx.putImageData(ni,0,0);const map=new T.CanvasTexture(c),normalMap=new T.CanvasTexture(nc);for(const t of [map,normalMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())}map.colorSpace=T.SRGBColorSpace;return new T.MeshStandardMaterial({map,normalMap,roughness:kind==='stone'?.36:.82,normalScale:new T.Vector2(.7,.7)});}
const mat={};
for(const [key,record] of Object.entries(materialPalette)){
 const {label,texture,tileMeters,strength,...properties}=record;
 // Independent seeds keep unrelated textures unchanged when a material is added.
 seed=[...key].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,textureSeed);
 mat[key]=texture?surface(texture,properties.color,tileMeters.map(v=>1/v),strength):new T.MeshStandardMaterial(properties);
 if(texture)mat[key].roughness=properties.roughness;
 if(key==='glass'||key==='lamp')mat[key].side=T.DoubleSide;
 mat[key].name=label;mat[key].userData={key,paletteVersion,tileMeters};
}
performance.measure('materials','materials-start');return mat;
}
