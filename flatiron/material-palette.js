// Color & Texture Bible v1.0.0 — source of truth used by the renderer.
// tileMeters is the size of one full procedural texture tile, not one plank.
export const paletteVersion='1.1.0';
export const textureSeed=1829;
// Session-only finish: instantiated lazily by the walkthrough, never at startup.
export const walkthroughCeiling={color:'#e8e7df',roughness:.95,emissive:'#d4d7cf',emissiveIntensity:.6};
export const materialPalette={
 wall:{label:'Warm plaster',color:'#f0efea',texture:'plaster',tileMeters:[.8,.8],strength:.55,roughness:.9},
 wood:{label:'Muted oak flooring',color:'#969184',texture:'wood',tileMeters:[2.88,2.4],strength:.12,roughness:.82},
 cabinet:{label:'Pale oak joinery',color:'#e3dece',texture:'wood',tileMeters:[2.4,1.8],strength:.08,roughness:.78},
 stone:{label:'Warm charcoal stone',color:'#55534e',texture:'stone',tileMeters:[1,1],strength:.18,roughness:.42},
 fabric:{label:'Oatmeal upholstery',color:'#d1c7b4',texture:'fabric',tileMeters:[.32,.32],strength:.35,roughness:.94},
 blue:{label:'Deep teal upholstery',color:'#314d5a',texture:'fabric',tileMeters:[.32,.32],strength:.35,roughness:.94},
 rug:{label:'Stone woven rug',color:'#b4b4a6',texture:'fabric',tileMeters:[.4,.4],strength:.25,roughness:.96},
 tile:{label:'Warm gray tile',color:'#bbbcb5',texture:'tile',tileMeters:[2.4,2.4],strength:.25,roughness:.8},
 backsplash:{label:'Sage gray backsplash',color:'#828e8d',texture:'tile',tileMeters:[1.2,1.2],strength:.25,roughness:.65},
 deck:{label:'Weathered deck',color:'#aaa59a',texture:'wood',tileMeters:[2.24,2.4],strength:.15,roughness:.88},
 dark:{label:'Charcoal accents',color:'#292e2e',roughness:.5},
 white:{label:'Ivory ceramic',color:'#f1f1e9',roughness:.24},
 trim:{label:'Satin ivory frames',color:'#e4e1d7',roughness:.65},
 metal:{label:'Brushed nickel',color:'#bac2c3',metalness:.78,roughness:.24},
 gold:{label:'Muted brass',color:'#a6814c',metalness:.7,roughness:.28},
 glass:{label:'Clear cool glazing',color:'#c6e0df',transparent:true,opacity:.22,metalness:.18,roughness:.1},
 green:{label:'Olive foliage',color:'#526b42',roughness:.85},
 lamp:{label:'Warm linen shade',color:'#fff0d4',roughness:.9,emissive:'#ffbf73',emissiveIntensity:1.7},
 bedding:{label:'Warm white bedding',color:'#eeeae0',roughness:.96},
 water:{label:'Pale basin inset',color:'#baccc9',roughness:.26},
};
