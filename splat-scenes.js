// The splat dioramas behind the industry explorer on capture.html, also cycled through by the
// spatial capture viewer on index.html. Exposes SplatScenes.build(scene, pointCount) and SplatScenes.scenes.
(function(){
'use strict';
// Shape kit for the industry dioramas. Points are shared out by surface area, so a scene is just a
// list of shapes. A color is a hex number, or a function of the shape's (a, b) coordinates, 0 to 1
// across each face, that may return -1 to leave a hole.
function buildIndustryScene(draw, N){
  const R = Math.random, parts = [], TAU = Math.PI*2;
  const fn = c => typeof c === 'function' ? c : () => c;
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  // Each part maps (a, b), both 0 to 1, onto its surface. k is its width-to-height ratio in (a, b),
  // so its points can be laid on an even, jittered grid instead of falling in random clumps.
  const part = (area, s, k, gen) => parts.push({area, s, k, gen});
  const kit = {
    quad(o, u, v, c, s=1){
      const f = fn(c);
      part(Math.hypot(...cross(u, v)), s, Math.hypot(...u)/Math.max(1e-6, Math.hypot(...v)), (a, b) => {
        const h = f(a, b);
        return h < 0 ? null : [o[0]+a*u[0]+b*v[0], o[1]+a*u[1]+b*v[1], o[2]+a*u[2]+b*v[2], h];
      });
    },
    tri(p, q, r, c, s=1){
      const f = fn(c), u = q.map((x, i) => x - p[i]), v = r.map((x, i) => x - p[i]);
      part(Math.hypot(...cross(u, v))/2, s, 1, (a, b) => {
        if (a + b > 1){ a = 1-a; b = 1-b; }
        const h = f(a, b);
        return h < 0 ? null : [p[0]+a*u[0]+b*v[0], p[1]+a*u[1]+b*v[1], p[2]+a*u[2]+b*v[2], h];
      });
    },
    // Axis-aligned box. c can also be {top, front, back, left, right, side}; a and b run along x or z, then up.
    box(x0, y0, z0, x1, y1, z1, c, s=1, skip='bottom'){
      const w = x1-x0, h = y1-y0, d = z1-z0;
      const pick = n => (c && typeof c === 'object') ? (c[n] ?? c.side) : c;
      const face = (n, o, u, v) => { if (!skip.includes(n)) kit.quad(o, u, v, pick(n), s); };
      face('top', [x0,y1,z0], [w,0,0], [0,0,d]);
      face('bottom', [x0,y0,z0], [w,0,0], [0,0,d]);
      face('front', [x0,y0,z1], [w,0,0], [0,h,0]);
      face('back', [x0,y0,z0], [w,0,0], [0,h,0]);
      face('left', [x0,y0,z0], [0,0,d], [0,h,0]);
      face('right', [x1,y0,z0], [0,0,d], [0,h,0]);
    },
    // Cylinder, or a cone with r1, from (x, y, z) along an axis. c gets (angle, height), 0 to 1.
    cyl(x, y, z, r0, h, c, s=1, {r1 = r0, axis = 'y', caps = true} = {}){
      const f = fn(c), slant = Math.hypot(h, r0-r1);
      const at = axis === 'y' ? (p, q, w) => [x+p, y+q, z+w] : axis === 'x' ? (p, q, w) => [x+q, y+p, z+w] : (p, q, w) => [x+p, y+w, z+q];
      part(Math.PI*(r0+r1)*slant, s, Math.PI*(r0+r1)/Math.max(1e-6, slant), (a, b) => {
        const r = r0 + (r1-r0)*b, t = a*TAU, hh = f(a, b);
        return hh < 0 ? null : [...at(Math.cos(t)*r, b*h, Math.sin(t)*r), hh];
      });
      if (caps) [[0, r0], [h, r1]].forEach(([q, r]) => {
        if (r > 0) part(Math.PI*r*r, s, 4, (a, b) => {
          const t = a*TAU, rr = r*Math.sqrt(b), hh = typeof caps === 'number' ? caps : f(a, q ? 1 : 0);
          return hh < 0 ? null : [...at(Math.cos(t)*rr, q, Math.sin(t)*rr), hh];
        });
      });
    },
    // Sphere, squashed by [sx, sy, sz]. c gets (height from -1 to 1, angle 0 to 1).
    ball(x, y, z, r, c, s=1, [sx, sy, sz] = [1, 1, 1]){
      const f = fn(c);
      part(4*Math.PI*r*r*(sx*sy + sy*sz + sx*sz)/3, s, Math.PI, (a, b) => {
        const u = b*2-1, t = a*TAU, q = Math.sqrt(1-u*u), h = f(u, a);
        return h < 0 ? null : [x+Math.cos(t)*q*r*sx, y+u*r*sy, z+Math.sin(t)*q*r*sz, h];
      });
    },
    // Flat disc facing along an axis. c gets (radius 0 to 1, angle 0 to 1).
    disc(x, y, z, r, c, s=1, axis='y'){
      const f = fn(c);
      part(Math.PI*r*r, s, 4, (a, b) => {
        const t = a*TAU, rr = r*Math.sqrt(b), h = f(Math.sqrt(b), a);
        if (h < 0) return null;
        const p = Math.cos(t)*rr, q = Math.sin(t)*rr;
        return axis === 'y' ? [x+p, y, z+q, h] : axis === 'x' ? [x, y+q, z+p, h] : [x+p, y+q, z, h];
      });
    },
    // Rod or pipe between two points. Thin ones get a minimum share of points so they stay visible.
    tube(p, q, r, c, s=.8, w=1){
      const f = fn(c), d = q.map((x, i) => x - p[i]), L = Math.hypot(...d), ax = d.map(x => x/L);
      let e1 = cross(ax, Math.abs(ax[1]) < .9 ? [0,1,0] : [1,0,0]); const l1 = Math.hypot(...e1); e1 = e1.map(x => x/l1);
      const e2 = cross(ax, e1);
      part(Math.max(TAU*r, .1)*L*w, s, L/Math.max(.02, TAU*r), (a, b) => {
        const t = b*TAU, h = f(a, b), cs = Math.cos(t)*r, sn = Math.sin(t)*r;
        return h < 0 ? null : [0, 1, 2].map(i => p[i] + d[i]*a + e1[i]*cs + e2[i]*sn).concat(h);
      });
    },
    // Points along a path; at(t) gives [x, y, z] for t from 0 to 1.
    path(at, len, c, s=.8, w=1, jitter=.015){
      const f = fn(c);
      part(len*.1*w, s, 1e3, a => {
        const p = at(a), h = f(a, 0);
        return h < 0 ? null : [p[0]+(R()-.5)*jitter*2, p[1]+(R()-.5)*jitter*2, p[2]+(R()-.5)*jitter*2, h];
      });
    },
    pipe(pts, r, c, s=.9){   // straight runs with round elbows
      for (let i=1; i<pts.length; i++) kit.tube(pts[i-1], pts[i], r, c, s);
      for (let i=1; i<pts.length-1; i++) kit.ball(...pts[i], r*1.2, c, s);
    },
    ring(x, y, z, r, c, s=.8, axis='y', w=1){
      kit.path(t => {
        const a = t*Math.PI*2, p = Math.cos(a)*r, q = Math.sin(a)*r;
        return axis === 'y' ? [x+p, y, z+q] : axis === 'x' ? [x, y+q, z+p] : [x+p, y+q, z];
      }, 2*Math.PI*r, c, s, w, .01);
    }
  };
  draw(kit, R);

  const total = parts.reduce((a, p) => a + p.area, 0);
  const want = parts.map(p => p.area/total*N), cnt = want.map(Math.floor);
  const rest = N - cnt.reduce((a, b) => a + b, 0);
  want.map((w, j) => [w - cnt[j], j]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, j]) => cnt[j]++);
  const pts = []; let last = [0, -1.1, 0, 0xFFFFFF];
  parts.forEach((p, j) => {
    const n = cnt[j]; if (!n) return;
    const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n*p.k)))), rows = Math.ceil(n/cols);
    const cells = Array.from({length: cols*rows}, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--){ const m = Math.floor(R()*(i + 1)); [cells[i], cells[m]] = [cells[m], cells[i]]; }
    for (let i = 0; i < n; i++){
      let r = p.gen((cells[i] % cols + R())/cols, (Math.floor(cells[i]/cols) + R())/rows);
      for (let tries = 0; !r && tries < 40; tries++) r = p.gen(R(), R());   // landed in a hole: try anywhere
      if (r) last = r;
      pts.push([last, p.s]);
    }
  });
  // Splat size follows point spacing, the way a denser capture uses smaller splats.
  const base = Math.min(.19, Math.max(.08, 1.9*Math.sqrt(total/N)));
  // Loosely ranked by height, so each point travels to a similar height in the next scene.
  const rank = pts.map(([r]) => r[1] + (R()-.5)*.5);
  const order = pts.map((_, i) => i).sort((a, b) => rank[a] - rank[b]);
  const out = {pos: new Float32Array(N*3), col: new Float32Array(N*3), size: new Float32Array(N)};
  order.forEach((src, i) => {
    const [r, s] = pts[src], h = r[3];
    out.pos[i*3] = r[0]; out.pos[i*3+1] = r[1]; out.pos[i*3+2] = r[2];
    for (let c=0; c<3; c++) out.col[i*3+c] = Math.min(1, Math.max(0, ((h >> (16 - 8*c)) & 255)/255 + (R()-.5)*.06));
    out.size[i] = base*s*(.85 + R()*.5);
  });
  return out;
}

// Palette and helpers shared by the dioramas. Everything sits on a floor at y = -1.1 inside about
// a 3.2 x 3.2 footprint, fronts face +z, and cutaway rooms keep their back and left walls.
const Y0 = -1.1;
const P = {ink:0x4A5580, dark:0x39406A, paper:0xF6F8FC, sky:0xDCE4F2, yellow:0xFFC61A, blue:0x2D5BE3, red:0xFF5B3A,
  green:0x36D399, green2:0x1F7A55, wall:0xEDE6DA, wall2:0xE3D5BF, glassLo:0xFFE3A0, glassHi:0x8FB4E8, steel:0xB8BCC8, gold:0xE0B040};
const mixHex = (a, b, t) => {
  t = Math.min(1, Math.max(0, t));
  const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255))*t);
  return ch(16) << 16 | ch(8) << 8 | ch(0);
};
const WOOD = [0xC99A63, 0xB5824E, 0xD8AE78];
const wood = (v, n=10) => WOOD[Math.floor(v*n) % 3];
const pickOne = a => a[Math.floor(Math.random()*a.length)];
const inBox = (x, y, x0, y0, x1, y1) => x > x0 && x < x1 && y > y0 && y < y1;
const leafy = () => mixHex(P.green, P.green2, Math.random());

const INDUSTRY_SCENES = {
  // A dollhouse cut of an apartment: living room, bedroom, and a kitchen island.
  'real-estate'({quad, box, cyl, ball}, R){
    quad([-1.5,Y0,-1.5], [3,0,0], [0,0,3], (a, b) => {
      const x = -1.5 + a*3, z = -1.5 + b*3;
      if (x > .4 && z < .15) return mixHex(0xE9E3D6, 0xDCD4C3, R());
      const e = ((x + .65)/.72)**2 + ((z - .05)/.5)**2;
      if (e < 1) return e > .72 ? P.red : P.blue;
      return wood(a, 11);
    });
    quad([-1.5,Y0,-1.5], [3,0,0], [0,1.45,0], (a, b) => {
      const x = -1.5 + a*3, y = b*1.45;
      if (y < .08) return P.ink;
      for (const cx of [-.7, 1.0]){
        if (inBox(x, y, cx-.34, .6, cx+.34, 1.2)) return mixHex(P.glassLo, P.glassHi, (y - .6)/.6);
        if (inBox(x, y, cx-.4, .54, cx+.4, 1.26)) return P.paper;
      }
      return P.wall;
    });
    quad([-1.5,Y0,-1.5], [0,0,3], [0,1.45,0], (a, b) => {
      const z = -1.5 + a*3, y = b*1.45;
      if (y < .08) return P.ink;
      if (inBox(z, y, .6, 0, 1.1, 1.12)) return 0x9C6B3F;             // front door
      if (inBox(z, y, .54, 0, 1.16, 1.18)) return P.paper;
      if (inBox(z, y, -.84, .62, -.16, 1.05)) return mixHex(P.blue, P.green, (y - .62)/.43);   // a print
      if (inBox(z, y, -.9, .56, -.1, 1.11)) return P.yellow;
      return P.wall2;
    });
    quad([.4,Y0,-1.5], [0,0,1.65], [0,1.45,0], (a, b) => {   // partition with a doorway
      const z = -1.5 + a*1.65, y = b*1.45;
      if (z > -.8 && z < -.25 && y < 1.12) return -1;
      return y < .08 ? P.ink : P.wall;
    });
    box(-1.3, Y0, .45, -.1, Y0+.4, .9, P.blue);                       // sofa
    box(-1.3, Y0, .8, -.1, Y0+.82, .95, 0x2449B8);
    box(-1.42, Y0, .45, -1.3, Y0+.58, .95, 0x2449B8); box(-.1, Y0, .45, .02, Y0+.58, .95, 0x2449B8);
    box(-.95, Y0+.3, -.25, -.35, Y0+.36, .2, 0xB5824E);              // coffee table
    cyl(-1.22, Y0, -1.22, .13, .4, P.red, 1, {r1: .17});              // plant
    ball(-1.22, Y0+.82, -1.22, .32, leafy);
    box(.72, Y0, -1.42, 1.42, Y0+.4, -.2, {top: (a, b) => b > .42 ? P.yellow : P.paper, side: P.paper});   // bed
    box(.8, Y0+.4, -1.36, 1.04, Y0+.5, -1.14, P.paper); box(1.1, Y0+.4, -1.36, 1.34, Y0+.5, -1.14, P.paper);
    box(.68, Y0, -1.5, 1.46, Y0+.78, -1.42, 0x9C6B3F);
    box(.46, Y0, -1.44, .64, Y0+.38, -1.2, 0xB5824E);
    ball(.55, Y0+.52, -1.32, .08, P.glassLo);
    box(.78, Y0, .55, 1.42, Y0+.88, 1.05, {top: 0xD8AE78, side: P.paper});   // kitchen island and stools
    [.95, 1.25].forEach(x => { cyl(x, Y0, 1.28, .03, .55, P.ink, .8, {caps: false}); cyl(x, Y0+.55, 1.28, .12, .05, P.yellow); });
  },

  // A limestone church with a copper roof, a rose window, and a bell tower, on a lawn.
  historic({quad, tri, box, cyl, ball, disc, tube}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => {
      const x = -1.6 + a*3.2, z = -1.6 + b*3.2;
      if (Math.abs(x) < .26 && z > .5) return Math.floor(z*7) % 2 ? 0xD9D4C7 : 0xC4BDAE;
      return mixHex(0x3E8E5E, 0x62B576, R());
    });
    const stone = () => mixHex(0xEADFC8, 0xD2C2A2, R()), trim = 0xF4ECDA;
    const side = (a, b) => {                                          // arched windows down the nave
      const z = -1.4 + a*1.9, y = b*1.3;
      for (const zc of [-1.05, -.45, .1]){
        const dz = z - zc, arch = r => Math.abs(dz) < r && y > .54 - r && (y < .82 || Math.hypot(dz, y - .82) < r);
        if (arch(.12)) return mixHex(P.blue, 0x7FA6F0, R()*.8);
        if (arch(.16)) return trim;
      }
      return stone();
    };
    quad([-.7,Y0,-1.4], [0,0,1.9], [0,1.3,0], side);
    quad([.7,Y0,-1.4], [0,0,1.9], [0,1.3,0], side);
    quad([-.7,Y0,-1.4], [1.4,0,0], [0,1.3,0], stone);
    quad([-.7,Y0,.5], [1.4,0,0], [0,2,0], (a, b) => {                 // gable front
      const x = -.7 + a*1.4, y = b*2;
      if (y > 1.3 && Math.abs(x) > 2 - y) return -1;
      const rr = Math.hypot(x, y - 1.32);
      if (rr < .26) return rr < .07 ? P.yellow : [P.yellow, P.red, P.blue, P.green][Math.floor((Math.atan2(y - 1.32, x)/Math.PI + 1)*4) % 4];
      if (rr < .31) return trim;
      const door = r => Math.abs(x) < r && (y < .55 || Math.hypot(x, y - .55) < r);
      if (door(.2)) return 0x8A5A3A;
      if (door(.25)) return trim;
      return stone();
    });
    const copper = () => mixHex(0x5FB597, 0x3F8F76, R());
    quad([-.8,Y0+1.25,-1.48], [0,0,2.06], [.8,.8,0], copper);
    quad([.8,Y0+1.25,-1.48], [0,0,2.06], [-.8,.8,0], copper);
    box(-1.22, Y0, -.02, -.72, Y0+2.1, .48, {top: stone, side: (a, b) => b*2.1 > 1.62 && b*2.1 < 1.92 && Math.abs(a - .5) < .26 ? 0x2E3558 : stone()});
    disc(-.97, Y0+1.3, .49, .13, r => r > .8 ? P.dark : P.paper, 1, 'z');
    tube([-.97, Y0+1.3, .5], [-.97, Y0+1.39, .5], .008, P.dark, .5); tube([-.97, Y0+1.3, .5], [-.9, Y0+1.3, .5], .008, P.dark, .5);
    const apex = [-.97, Y0+2.95, .23], b0 = [-1.22, Y0+2.1, -.02], b1 = [-.72, Y0+2.1, -.02], b2 = [-.72, Y0+2.1, .48], b3 = [-1.22, Y0+2.1, .48];
    [[b0, b1], [b1, b2], [b2, b3], [b3, b0]].forEach(([p, q]) => tri(p, q, apex, copper));
    ball(-.97, Y0+3, .23, .05, P.yellow);
    [[1.3, .25, .3], [1.25, -.95, .26], [-1.35, -1.15, .24]].forEach(([x, z, r]) => {
      cyl(x, Y0, z, .05, .35, 0x8A5A3A, .8, {caps: false});
      ball(x, Y0 + .35 + r*.9, z, r, () => mixHex(0x2F8F5B, 0x57B870, R()));
    });
  },

  // A concrete frame going up, a tower crane lifting a beam, and cones along the front.
  construction({quad, box, cyl, tube}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], () => pickOne([0xB5824E, 0x9C6B3F, 0xC99A63, 0xA87A4F]));
    const X = [-1.35, -.55, .25], Z = [-1.2, -.35, .5];
    [0, .72, 1.44].forEach(h => box(-1.45, Y0+h, -1.3, .35, Y0+h+.08, .6, {top: 0xC9CDD7, side: 0xA3A9B8}));
    [.08, .8].forEach(h => X.forEach(x => Z.forEach(z => box(x-.05, Y0+h, z-.05, x+.05, Y0+h+.64, z+.05, 0xB4B9C6, .8, 'bottom,top'))));
    X.forEach(x => Z.forEach(z => tube([x, Y0+1.52, z], [x, Y0+1.76, z], .01, 0xC0643A, .6)));   // rebar
    const cx = 1.05, cz = -.95, jy = Y0+2.35, yl = P.yellow;
    [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(([i, j]) => tube([cx+i*.09, Y0, cz+j*.09], [cx+i*.09, jy, cz+j*.09], .014, yl, .7));
    for (let y = Y0; y < jy - .1; y += .22){                         // mast lattice on the faces we see
      tube([cx-.09, y, cz+.09], [cx+.09, y+.22, cz+.09], .01, yl, .6);
      tube([cx+.09, y, cz-.09], [cx+.09, y+.22, cz+.09], .01, yl, .6);
    }
    [-.07, .07].forEach(dz => tube([1.75, jy, cz+dz], [-1.55, jy, cz+dz], .014, yl, .7));
    tube([-1.55, jy+.18, cz], [cx, jy+.18, cz], .012, yl, .7);
    for (let x = -1.55; x < cx - .05; x += .2) tube([x, jy, cz-.07], [x+.1, jy+.18, cz], .009, yl, .5);
    tube([cx, jy, cz], [cx, jy+.45, cz], .014, yl, .7);               // tower head and ties
    tube([cx, jy+.45, cz], [-1.1, jy+.18, cz], .006, 0xD9DDE6, .5);
    tube([cx, jy+.45, cz], [1.7, jy, cz], .006, 0xD9DDE6, .5);
    box(1.45, jy-.24, cz-.12, 1.72, jy, cz+.12, 0xA3A9B8);          // counterweight
    box(cx-.22, jy-.2, cz+.1, cx+.02, jy-.02, cz+.28, {front: P.glassHi, side: P.paper});   // cab
    tube([-.75, jy, cz], [-.75, Y0+1.98, cz], .006, 0xD9DDE6, .5);   // hook, slings, and a beam
    box(-.8, Y0+1.9, cz-.05, -.7, Y0+1.99, cz+.05, P.red, .8);
    tube([-.75, Y0+1.9, cz], [-1.1, Y0+1.8, cz], .005, 0xD9DDE6, .5); tube([-.75, Y0+1.9, cz], [-.4, Y0+1.8, cz], .005, 0xD9DDE6, .5);
    box(-1.15, Y0+1.72, cz-.05, -.35, Y0+1.8, cz+.05, P.red, .9);
    [[-1.25, 1.2], [-.65, 1.3], [-.05, 1.2]].forEach(([x, z]) => {
      cyl(x, Y0+.03, z, .12, .36, (a, b) => b > .38 && b < .6 ? P.paper : P.red, .8, {r1: .025, caps: false});
      box(x-.14, Y0, z-.14, x+.14, Y0+.03, z+.14, P.red, .8);
    });
    box(.62, Y0, .85, 1.34, Y0+.11, 1.3, 0xD8AE78); box(.66, Y0+.11, .88, 1.3, Y0+.22, 1.27, 0xC99A63);
  },

  // A white model on a blueprint base, with dimension lines, scale figures, and a tree.
  architecture({quad, box, cyl, ball, tube}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => {
      const line = v => Math.abs((v*3.2) % .4 - .2) > .17;
      return line(a) || line(b) ? 0x7FA0EC : 0x2446B8;
    });
    const glass = (a, b) => mixHex(0x9CC0F2, 0xDCE9FA, (a + b)*.5 + R()*.2);
    box(-1.2, Y0, -1.0, .5, Y0+.8, -.05, {top: 0xE9ECF3, side: P.paper, front: (a, b) => b > .22 && b < .82 && a > .06 && a < .94 ? glass(a, b) : P.paper});
    box(-.5, Y0+.8, -.75, 1.25, Y0+1.42, .55, {top: 0xE9ECF3, side: P.paper,
      front: (a, b) => b > .2 && b < .8 ? glass(a, b) : P.paper, right: (a, b) => b > .2 && b < .8 && a > .1 ? glass(a, b) : P.paper});
    [[1.15, .45], [1.15, -.65]].forEach(([x, z]) => tube([x, Y0, z], [x, Y0+.8, z], .025, P.paper, .8));
    tube([-1.2, Y0+.02, 1.05], [1.25, Y0+.02, 1.05], .01, P.yellow, .7, 1.5);   // dimension lines
    [-1.2, 1.25].forEach(x => {
      tube([x, Y0+.02, .95], [x, Y0+.02, 1.15], .01, P.yellow, .7, 1.5);
      tube([x, Y0+.02, x < 0 ? -.05 : .55], [x, Y0+.02, .98], .006, 0xBFD0F5, .5);
    });
    tube([1.45, Y0, .55], [1.45, Y0+1.42, .55], .01, P.yellow, .7, 1.5);
    [Y0, Y0+1.42].forEach(y => tube([1.36, y, .55], [1.54, y, .55], .01, P.yellow, .7, 1.5));
    [[-.2, .72], [.3, .95]].forEach(([x, z]) => { cyl(x, Y0, z, .045, .3, P.paper, .7, {r1: .035}); ball(x, Y0+.36, z, .05, P.paper, .7); });
    cyl(-1.35, Y0, .55, .035, .3, 0xD8AE78, .7, {caps: false});
    ball(-1.35, Y0+.55, .55, .26, leafy);
  },

  // A room after a fire and a burst pipe: soot, a boarded window, standing water, caution tape.
  restoration({quad, box, cyl, disc}, R){
    quad([-1.5,Y0,-1.5], [3,0,0], [0,0,3], (a, b) => {
      const x = -1.5 + a*3, z = -1.5 + b*3;
      const e = ((x - .3)/1)**2 + ((z - .25)/.62)**2 + .12*Math.sin(x*6)*Math.sin(z*5);
      if (e < 1) return mixHex(0x3F74D8, 0xA9C8F5, R()*.6 + (e < .45 ? .25 : 0));
      return mixHex(wood(a, 11), 0x5C4636, Math.max(0, 1 - e*.55)*.5);
    });
    quad([-1.5,Y0,-1.5], [3,0,0], [0,1.9,0], (a, b) => {
      const x = -1.5 + a*3, y = b*1.9;
      if (y < .1) return P.ink;
      if (inBox(x, y, -.2, .75, .8, 1.5)){
        const u = x + .2, v = (y - .75)/.75;
        return Math.abs(u - v) < .1 || Math.abs(u - (1 - v)) < .1 || Math.abs(v - .5) < .09 ? 0xD8AE78 : 0x2B3152;
      }
      const soot = Math.max(0, 1 - Math.hypot((x - .3)*.75, (y - 1.7)*1.05)/1.15);
      return mixHex(P.wall, 0x6E5A4B, Math.min(.85, soot*1.3 + R()*.12));
    });
    quad([-1.5,Y0,-1.5], [0,0,3], [0,1.9,0], (a, b) => {            // water line on the side wall
      const y = b*1.9, tide = .5 + .04*Math.sin(a*19);
      if (y < .1) return P.ink;
      if (Math.abs(y - tide) < .025) return 0x8C6A45;
      return y < tide ? mixHex(0xC9B99A, 0xB9A784, R()) : mixHex(P.wall2, 0x6E5A4B, Math.max(0, y - 1.3)*.5);
    });
    const tape = a => Math.floor(a*26) % 2 ? P.yellow : 0x232A45;
    cyl(1.25, Y0, 1.2, .04, .95, P.yellow, .8, {caps: false});
    quad([-1.5, Y0+.86, .6], [2.75, 0, .6], [0, .09, 0], tape, .8);
    quad([1.25, Y0+.86, 1.2], [0, 0, -2.7], [0, .09, 0], tape, .8);
    cyl(-.45, Y0+.28, .75, .27, .3, P.red, 1, {axis: 'z', caps: false});   // air mover drying the floor
    disc(-.45, Y0+.28, 1.05, .27, r => (r*6) % 1 < .3 ? P.dark : 0xFF7A5E, 1, 'z');
    box(-.72, Y0, .72, -.18, Y0+.08, 1.08, 0xD9432A);
    box(-1.38, Y0, -1.38, -1.02, Y0+.55, -1.05, {side: P.paper, top: 0xD5DAE6});   // dehumidifier
    box(-.5, Y0, -.95, .45, Y0+.04, -.85, 0x5C4636); box(.1, Y0, -.7, .2, Y0+.04, .1, 0x4A3B30);   // fallen boards
  },

  // A set: a painted flat braced from behind, a camera on sticks, a director's chair, a softbox.
  film({quad, box, cyl, ball, disc, tube}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => {
      const x = -1.6 + a*3.2, z = -1.6 + b*3.2;
      const mark = (cx, cz) => (Math.abs(z - cz) < .03 && Math.abs(x - cx) < .15) || (Math.abs(x - cx) < .03 && z > cz && z < cz + .22);
      if (mark(.15, .05) || mark(-.55, -.45)) return P.yellow;
      return Math.floor(b*9) % 2 ? 0x7A5A40 : 0x8C6A4B;
    });
    quad([-1.4,Y0,-1.25], [2.8,0,0], [0,1.9,0], (a, b) => {
      const x = -1.4 + a*2.8, y = b*1.9;
      if (y < .12) return P.paper;
      if (inBox(x, y, .35, .8, 1.05, 1.55)){                          // a window onto a painted night
        if (Math.abs(x - .7) < .025 || Math.abs(y - 1.18) < .025) return P.paper;
        return Math.hypot(x - .88, y - 1.4) < .1 ? 0xFFF1B8 : mixHex(0x1E3A8A, 0x3558C8, (y - .8)/.75);
      }
      if (inBox(x, y, .29, .74, 1.11, 1.61)) return P.paper;
      if (inBox(x, y, -.95, .95, -.35, 1.4)) return mixHex(P.red, P.yellow, (x + .95)/.6);
      if (inBox(x, y, -1.01, .89, -.29, 1.46)) return P.yellow;
      return Math.floor(a*28) % 2 ? 0x2BA59A : 0x31B2A6;
    });
    [-.9, .9].forEach(x => { tube([x, Y0+1.5, -1.27], [x, Y0, -1.75], .025, 0xD8AE78, .8); ball(x, Y0+.08, -1.72, .09, 0x9A7B55); });
    const cx = .9, cz = .65, wd = 0xD8AE78;                            // director's chair
    box(cx-.2, Y0+.42, cz-.18, cx+.2, Y0+.46, cz+.17, P.red);
    box(cx-.2, Y0+.62, cz+.15, cx+.2, Y0+.86, cz+.18, P.red);
    [-.2, .2].forEach(dx => {
      tube([cx+dx, Y0, cz-.18], [cx+dx, Y0+.44, cz+.17], .015, wd, .7);
      tube([cx+dx, Y0, cz+.17], [cx+dx, Y0+.44, cz-.18], .015, wd, .7);
      tube([cx+dx, Y0+.44, cz+.17], [cx+dx, Y0+.88, cz+.17], .015, wd, .7);
      tube([cx+dx, Y0+.6, cz-.18], [cx+dx, Y0+.6, cz+.17], .015, wd, .7);
    });
    const slate = (a, b) => b > .8 ? (Math.floor(a*6 + b*3) % 2 ? P.paper : P.dark) : (Math.abs(b - .45) < .03 || Math.abs(b - .25) < .03 ? P.paper : P.dark);
    quad([cx-.13, Y0+.46, cz-.05], [.26, 0, 0], [0, .2, -.02], slate);   // clapperboard on the seat
    quad([cx-.13, Y0+.66, cz-.07], [.26, .08, 0], [0, .04, -.005], a => Math.floor(a*6) % 2 ? P.paper : P.dark);
    const hx = -.55, hy = Y0+1.05, hz = .6, legs = 0x8A90AA;           // camera on a tripod
    [[-.32, -.2], [.28, -.25], [0, .38]].forEach(([dx, dz]) => tube([hx, hy, hz], [hx+dx, Y0, hz+dz], .016, legs, .7));
    box(hx-.13, hy, hz-.25, hx+.13, hy+.28, hz+.25, 0x6A7090);
    cyl(hx, hy+.14, hz-.45, .1, .2, P.ink, 1, {axis: 'z', caps: false});
    disc(hx, hy+.14, hz-.45, .1, 0x8FB4E8, 1, 'z');
    [hz-.12, hz+.14].forEach(z => cyl(hx-.02, hy+.46, z, .17, .04, a => Math.floor(a*6) % 2 ? 0x9AA0BC : 0x767C98, 1, {axis: 'x'}));
    tube([1.25, Y0, -.35], [1.25, Y0+1.45, -.35], .018, legs, .7);    // softbox on a stand
    [[-.2, -.15], [.2, -.15], [0, .22]].forEach(([dx, dz]) => tube([1.25, Y0+.3, -.35], [1.25+dx, Y0, -.35+dz], .014, legs, .7));
    const lit = () => mixHex(0xFFF4D6, 0xFFFFFF, R());
    box(1.1, Y0+1.4, -.6, 1.4, Y0+1.8, -.1, {left: lit, front: lit, side: P.dark});
  },

  // Machinery: a green tank on saddles, a pump, pipe runs, gauges, and a yellow safety rail.
  industrial({quad, box, cyl, ball, disc, tube, pipe, ring}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => {
      const x = -1.6 + a*3.2, z = -1.6 + b*3.2;
      if (Math.abs(z - 1.0) < .04 || Math.abs(z - 1.45) < .04) return P.yellow;
      return (Math.floor(x*8) + Math.floor(z*8)) % 2 ? 0x8C93A8 : 0x7C8398;
    });
    cyl(-1.15, Y0+.78, -.7, .52, 2.15, a => mixHex(0x3E9C7A, 0x2C7A5F, R()*.4 + (Math.abs(a - .25) < .02 ? .6 : 0)), 1, {axis: 'x'});
    [-.75, .55].forEach(x => box(x-.1, Y0, -1.08, x+.1, Y0+.4, -.32, 0x5A6488));
    box(-.4, Y0, .1, .5, Y0+.14, .6, 0x5A6488);                        // pump and motor on a skid
    cyl(-.3, Y0+.4, .35, .19, .5, P.blue, 1, {axis: 'x'});
    ball(.34, Y0+.4, .35, .2, P.blue);
    pipe([[.34, Y0+.6, .35], [.34, Y0+1.55, .35], [.34, Y0+1.55, -.35], [1.35, Y0+1.55, -.35], [1.35, Y0, -.35]], .06, P.red);
    pipe([[-.6, Y0+1.3, -.7], [-.6, Y0+1.95, -.7], [-1.5, Y0+1.95, -.7]], .07, P.steel);
    tube([-1.4, Y0+2.05, -1.25], [1.4, Y0+2.05, -1.25], .08, P.steel);
    tube([-1.4, Y0+1.85, -1.25], [1.4, Y0+1.85, -1.25], .05, 0xE8A33A);
    ring(.34, Y0+1.15, .47, .13, P.yellow, .8, 'z', 1.4);             // valve wheel
    tube([.34, Y0+1.15, .47], [.34, Y0+1.15, .38], .02, P.yellow, .7);
    [[-.25, Y0+.8], [.3, Y0+.95]].forEach(([x, y]) => disc(x, y, -.17, .1, (r, t) => r > .82 ? P.dark : (Math.abs(t - .12) < .025 && r < .7 ? P.red : P.paper), 1, 'z'));
    [-1.4, -.7, 0, .7, 1.4].forEach(x => tube([x, Y0, 1.45], [x, Y0+.8, 1.45], .02, P.yellow, .7));
    [.8, .42].forEach(y => tube([-1.4, Y0+y, 1.45], [1.4, Y0+y, 1.45], .02, P.yellow, .7));
    box(1.0, Y0, .05, 1.45, Y0+1.1, .4, {side: 0xD5DAE6, front: (a, b) => {   // control cabinet
      if (inBox(a, b, .15, .62, .85, .86)) return 0x7FD6B0;
      if (b > .3 && b < .46 && (a*6) % 1 < .5) return [P.red, P.green, P.yellow][Math.floor(a*6) % 3];
      return 0xD5DAE6;
    }});
  },

  // An event room set for dinner: round tables, gold chairs, a velvet drape, and string lights.
  hospitality({quad, cyl, ball, disc, tube, path}, R){
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => (Math.floor(a*14) + Math.floor(b*14)) % 2 ? 0xC99A63 : 0xB5824E);
    quad([-1.6,Y0,-1.55], [3.2,0,0], [0,2.1,0], a => mixHex(0x8E2A36, 0xD24A55, .5 + .5*Math.sin(a*44)));
    const table = (x, z) => {
      cyl(x, Y0, z, .43, .7, a => mixHex(P.paper, 0xCBD6EA, R()*.25 + (Math.sin(a*Math.PI*28) > .7 ? .3 : 0)), 1, {caps: false});
      disc(x, Y0+.7, z, .45, P.paper);
      cyl(x, Y0+.7, z, .035, .16, P.sky, .7, {caps: false});
      ball(x, Y0+.92, z, .08, () => pickOne([P.red, 0xFF8FA3, P.yellow]), .8);
      for (let i = 0; i < 6; i++){
        const t = i/6*Math.PI*2 + .3, dx = Math.cos(t), dz = Math.sin(t), cx = x + dx*.64, cz = z + dz*.64;
        disc(cx, Y0+.42, cz, .11, 0xE0B24A, .8);
        quad([cx + dx*.1 + dz*.1, Y0+.42, cz + dz*.1 - dx*.1], [-dz*.2, 0, dx*.2], [0, .38, 0], 0xE0B24A, .8);
        tube([cx, Y0, cz], [cx, Y0+.42, cz], .012, 0xC9962E, .6);
      }
    };
    table(-.75, -.45); table(.7, -.6); table(-.05, .75);
    const poles = [[-1.5, -1.45], [1.5, -1.45], [1.5, 1.45], [-1.5, 1.45]], py = Y0+2.05;
    poles.forEach(([x, z]) => tube([x, Y0, z], [x, py, z], .02, 0x8A90AA, .7));
    const strand = ([x0, z0], [x1, z1], sag) => {
      const at = t => [x0 + (x1-x0)*t, py - sag*4*t*(1-t), z0 + (z1-z0)*t], len = Math.hypot(x1-x0, z1-z0), nb = Math.round(len*6);
      path(at, len, 0x5A6488, .5, .6, .004);
      path(t => at((Math.floor(t*nb) + .5)/nb), len, () => pickOne([0xFFE3A0, 0xFFF4D6, 0xFFD27A]), 1.3, 1.6, .03);
    };
    strand(poles[0], poles[2], .45); strand(poles[1], poles[3], .45); strand(poles[0], poles[1], .3); strand(poles[3], poles[2], .3);
  },

  // A gallery: framed paintings, a bust on a plinth, a bench, and a rope line.
  museums({quad, box, cyl, ball, disc, tube, path}, R){
    quad([-1.5,Y0,-1.5], [3,0,0], [0,0,3], a => [0xA87A4F, 0x9C6B3F, 0xB5824E][Math.floor(a*12) % 3]);
    const frame = (x, y, x0, y0, x1, y1, art) => {
      if (inBox(x, y, x0, y0, x1, y1)) return art((x - x0)/(x1 - x0), (y - y0)/(y1 - y0));
      if (inBox(x, y, x0-.05, y0-.05, x1+.05, y1+.05)) return P.gold;
      return null;
    };
    const landscape = (u, v) => v > .45 - .08*Math.sin(u*7)
      ? (Math.hypot(u - .72, v - .78) < .1 ? P.yellow : mixHex(0x8FB4E8, 0xDCE4F2, v))
      : mixHex(0x3E8E5E, 0x7CC47F, v*2);
    const blocks = (u, v) => {
      if (Math.abs(u - .38) < .03 || Math.abs(v - .6) < .03 || (Math.abs(u - .78) < .03 && v < .6)) return 0x232A45;
      if (u < .38) return v > .6 ? P.red : P.blue;
      return v < .6 ? (u > .78 ? P.yellow : P.paper) : 0xF2EFE8;
    };
    const flowers = (u, v) => {
      for (const [fx, fy] of [[.3, .62], [.55, .74], [.74, .55]]){
        const d = Math.hypot(u - fx, (v - fy)*1.3);
        if (d < .05) return 0xB5524B;
        if (d < .12) return P.yellow;
      }
      return u > .42 && u < .48 && v < .7 ? P.green2 : mixHex(0x2D5BE3, 0x5A7FE8, v);
    };
    quad([-1.5,Y0,-1.5], [3,0,0], [0,1.75,0], (a, b) => {
      const x = -1.5 + a*3, y = b*1.75;
      if (y < .08) return 0xC8C2B6;
      return frame(x, y, -1.25, .6, -.1, 1.4, landscape) ?? frame(x, y, .25, .7, 1.2, 1.38, blocks) ?? 0xF3F0EA;
    });
    quad([-1.5,Y0,-1.5], [0,0,3], [0,1.75,0], (a, b) => {
      const z = -1.5 + a*3, y = b*1.75;
      if (y < .08) return 0xC8C2B6;
      return frame(z, y, -1.1, .62, .3, 1.45, flowers) ?? 0xF3F0EA;
    });
    const marble = () => mixHex(0xF4F2ED, 0xD6D3CC, R());
    box(.55, Y0, .15, 1.0, Y0+.85, .6, P.paper);                        // bust on a plinth
    ball(.775, Y0+1.0, .375, .22, marble, 1, [1, .5, .65]);
    cyl(.775, Y0+1.05, .375, .06, .14, marble, .8, {caps: false});
    ball(.775, Y0+1.3, .375, .13, marble, 1, [.85, 1.1, .95]);
    [-1.1, -.2].forEach(x => { cyl(x, Y0, .3, .03, .68, P.gold, .7, {caps: false}); ball(x, Y0+.7, .3, .045, P.gold, .7); disc(x, Y0+.01, .3, .1, P.gold, .7); });
    path(t => [-1.1 + .9*t, Y0 + .66 - .64*t*(1 - t), .3], .95, 0xC8413A, .8, 1.4, .012);
    box(-.95, Y0+.3, .95, .2, Y0+.38, 1.22, 0xB5824E);                  // bench
    [-.85, .1].forEach(x => box(x-.04, Y0, 1.0, x+.04, Y0+.3, 1.17, 0x5A6488));
    tube([-1.4, Y0+1.68, -1.3], [1.3, Y0+1.68, -1.3], .015, 0x8A90AA, .6);   // track lights
    [-.65, .7].forEach(x => cyl(x, Y0+1.56, -1.3, .05, .12, P.dark, .7, {r1: .03}));
  },

  // A red-brick storefront with a striped awning, a display window, and a sidewalk sign.
  retail({quad, box, ball, tube}, R){
    quad([-1.6,Y0,-1.0], [3.2,0,0], [0,0,2.6], (a, b) => {
      if (b > .9) return 0x7C8398;
      return (a*3.2) % .8 < .02 || (b*2.6) % .8 < .02 ? 0xA9AEBC : mixHex(0xCDD1DB, 0xC0C5D0, R());
    });
    const brick = (x, y) => {
      const off = Math.floor(y/.09) % 2 ? .1 : 0;
      if (y % .09 < .014 || (x + off + 10) % .2 < .014) return 0xD9D0C0;
      return pickOne([0xB5523B, 0xA8472F, 0xC25E43]);
    };
    box(-1.45, Y0, -1.25, 1.45, Y0+2.05, -.95, {top: 0x9A8F80, side: (a, b) => brick(a*.3, b*2.05), front: (a, b) => {
      const x = -1.45 + a*2.9, y = b*2.05;
      if (y > 1.95) return P.paper;                                     // cornice
      if (inBox(x, y, -1.3, 1.44, 1.3, 1.76)) return inBox(x, y, -1.2, 1.53, 1.2, 1.67) && Math.floor((x + 1.2)*9) % 3 !== 2 ? P.dark : P.yellow;
      if (inBox(x, y, -1.18, .32, .5, 1.22)){                          // display window
        if (y < .44) return P.paper;
        if (y < .72 && Math.floor((x + 1.18)*5) % 2) return [P.red, P.blue, P.green, P.yellow][Math.floor((x + 1.18)*2.5) % 4];
        return mixHex(0x9CC0F2, 0xE4EEFB, ((x + y)*1.5) % 1 < .25 ? .8 : .2);
      }
      if (inBox(x, y, -1.24, .26, .56, 1.28)) return P.paper;
      if (inBox(x, y, .72, 0, 1.18, 1.3)) return inBox(x, y, .8, .7, 1.1, 1.2) ? 0x9CC0F2 : P.blue;   // door
      if (inBox(x, y, .66, 0, 1.24, 1.36)) return P.paper;
      return brick(x, y);
    }}, 1, 'bottom,back');
    const stripe = a => Math.floor(a*12) % 2 ? P.paper : P.blue;
    quad([-1.25, Y0+1.4, -.95], [1.8, 0, 0], [0, -.3, .6], stripe);    // awning and its scalloped edge
    quad([-1.25, Y0+1.1, -.35], [1.8, 0, 0], [0, -.13, 0], (a, b) => b > .4 + .6*Math.sqrt(Math.max(0, 1 - (2*((a*12) % 1) - 1)**2)) ? -1 : stripe(a));
    const board = (a, b) => (a < .08 || a > .92 || b < .06 || b > .94) ? 0xB5824E
      : (Math.abs(b - .7) < .04 && a > .2 && a < .8) || (Math.abs(b - .5) < .03 && a > .25 && a < .65) ? P.paper : P.dark;
    quad([-.2, Y0, .4], [.4, 0, 0], [0, .62, -.16], board);            // sidewalk sign
    quad([.2, Y0, .08], [-.4, 0, 0], [0, .62, .16], board);
    box(1.25, Y0, -.9, 1.52, Y0+.32, -.62, 0x8A91A6);                   // planter
    ball(1.385, Y0+.55, -.76, .22, leafy);
    tube([-1.45, Y0, 1.35], [-1.45, Y0+1.9, 1.35], .025, 0x5A6488, .7);   // street lamp
    ball(-1.45, Y0+1.95, 1.35, .1, P.glassLo);
  },

  // A classroom: chalkboard, desks and chairs in rows, a globe, and a clock.
  education({quad, box, ball, disc, tube}, R){
    quad([-1.5,Y0,-1.5], [3,0,0], [0,0,3], (a, b) => (Math.floor(a*10) + Math.floor(b*10)) % 2 ? 0xE6E1D3 : 0xCFC8B6);
    const wallpaint = () => mixHex(P.sky, 0xCFD9EC, R()*.5);
    quad([-1.5,Y0,-1.5], [3,0,0], [0,1.9,0], (a, b) => {
      const x = -1.5 + a*3, y = b*1.9;
      if (y < .1) return 0x8A90AA;
      if (inBox(x, y, -1.12, .78, .82, 1.62)){
        const chalk = (Math.abs(y - 1.45) < .018 && x > -.95 && x < -.1 && Math.floor(x*14) % 4 !== 3)
          || (Math.abs(y - 1.3) < .018 && x > -.95 && x < -.35)
          || (Math.abs(y - 1.15) < .018 && x > -.95 && x < -.2 && Math.floor(x*10) % 3 !== 2)
          || Math.abs(Math.hypot(x - .42, y - 1.2) - .2) < .015 || (Math.abs(x - .42) < .012 && Math.abs(y - 1.2) < .2);
        return chalk ? 0xE8EDE6 : mixHex(0x2F6B55, 0x285E4A, R());
      }
      if (inBox(x, y, -1.18, .72, .88, 1.68)) return 0xB5824E;
      return wallpaint();
    });
    box(-1.12, Y0+.72, -1.5, .82, Y0+.76, -1.42, 0x9C6B3F);           // chalk tray
    disc(1.2, Y0+1.45, -1.49, .14, r => r > .85 ? P.red : P.paper, 1, 'z');   // clock
    tube([1.2, Y0+1.45, -1.48], [1.2, Y0+1.55, -1.48], .008, P.dark, .5); tube([1.2, Y0+1.45, -1.48], [1.27, Y0+1.45, -1.48], .008, P.dark, .5);
    quad([-1.5,Y0,-1.5], [0,0,3], [0,1.9,0], (a, b) => {            // windows along the side wall
      const z = -1.5 + a*3, y = b*1.9;
      if (y < .1) return 0x8A90AA;
      for (const zc of [-.55, .6]){
        if (inBox(z, y, zc - .38, .8, zc + .38, 1.6)) return Math.abs(z - zc) < .02 ? P.paper : mixHex(P.glassLo, P.glassHi, (y - .8)/.8);
        if (inBox(z, y, zc - .44, .74, zc + .44, 1.66)) return P.paper;
      }
      return wallpaint();
    });
    [-.2, .75].forEach(z => [-.95, -.15, .65].forEach(x => {             // desks and chairs, facing the board
      box(x - .27, Y0+.55, z - .17, x + .27, Y0+.6, z + .17, 0xD8AE78);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([i, j]) => tube([x + i*.23, Y0, z + j*.13], [x + i*.23, Y0+.55, z + j*.13], .01, 0x8A90AA, .5));
      box(x - .17, Y0+.34, z + .26, x + .17, Y0+.38, z + .56, P.yellow, .9);
      box(x - .17, Y0+.38, z + .53, x + .17, Y0+.72, z + .57, P.yellow, .9);
      tube([x, Y0, z + .41], [x, Y0+.34, z + .41], .012, 0x8A90AA, .5);
    }));
    box(-.8, Y0+.6, -.15, -.62, Y0+.66, .0, P.red, .8);                // a book
    box(.72, Y0, -1.3, 1.42, Y0+.7, -.82, {top: 0xB5824E, side: 0x9C6B3F});   // teacher's desk and globe
    tube([1.18, Y0+.7, -1.05], [1.18, Y0+.86, -1.05], .015, P.gold, .6);
    ball(1.18, Y0+1.03, -1.05, .17, (u, t) => Math.sin(t*19 + u*3) + Math.cos(u*7 - t*9) > .7 ? P.green : P.blue);
  },

  // A real room dissolving into a game grid, with a floating VR headset and voxel pieces.
  games({quad, box, cyl, ball, path}, R){
    const hash = (i, j) => { const s = Math.sin(i*127.1 + j*311.7)*43758.5453; return s - Math.floor(s); };
    quad([-1.6,Y0,-1.6], [3.2,0,0], [0,0,3.2], (a, b) => {
      const x = -1.6 + a*3.2, z = -1.6 + b*3.2;
      if (x < -.35 + (hash(Math.floor(x/.2), Math.floor(z/.2)) - .5)*.9) return wood(b, 10);
      const g = v => Math.abs(((v % .4) + .4) % .4 - .2) > .175;
      return g(x) || g(z) ? 0x7FB0FF : 0x22367E;
    });
    box(-1.35, Y0, -.9, -.75, Y0+.4, -.35, P.red);                      // the real side: armchair and plant
    box(-1.35, Y0, -.9, -1.22, Y0+.85, -.35, 0xD9432A);
    box(-1.35, Y0, -.98, -.75, Y0+.58, -.9, 0xD9432A); box(-1.35, Y0, -.35, -.75, Y0+.58, -.27, 0xD9432A);
    cyl(-1.3, Y0, .75, .12, .34, P.sky, 1, {r1: .15});
    ball(-1.3, Y0+.68, .75, .26, leafy);
    const hy = Y0+1.1;                                                  // VR headset
    box(-.6, hy, -.28, .6, hy+.6, .28, {side: P.paper, front: (a, b) => (a + b*.6) % 1 < .12 ? 0x8FB4E8 : mixHex(P.dark, P.ink, b)});
    box(-.54, hy+.05, -.4, .54, hy+.55, -.28, 0x5A6488);
    path(t => [Math.cos(Math.PI*t)*.62, hy+.3, -.26 - Math.sin(Math.PI*t)*.7], 2.2, 0x5A6488, 1, 1.8, .035);
    const vox = (x, y, z, c, s=.2) => box(x - s/2, y, z - s/2, x + s/2, y + s, z + s/2, c, .9);
    [0, 1, 2].forEach(n => vox(1.0, Y0 + n*.2, -.9, 0x9C6B3F));          // voxel tree
    [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]].forEach(([i, j]) => vox(1.0 + i*.2, Y0+.6, -.9 + j*.2, P.green));
    [[0, 0], [1, 0], [0, 1]].forEach(([i, j]) => vox(.9 + i*.2, Y0+.8, -1.0 + j*.2, 0x2FB57F));
    vox(.95, Y0+.55, .75, P.yellow, .22); vox(-.2, Y0+.25, 1.05, P.red, .18); vox(.35, Y0+1.95, -.6, P.blue, .2); vox(1.35, Y0+1.25, .2, P.green, .16);
    cyl(.8, Y0+1.05, .45, .15, .04, P.yellow, 1, {axis: 'z'});          // a coin
  }
};

window.SplatScenes = {build: buildIndustryScene, scenes: INDUSTRY_SCENES};
})();
