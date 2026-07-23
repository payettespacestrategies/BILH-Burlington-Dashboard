// ====================================================================
// SITE SCENARIOS TAB — Lahey HMC Burlington Planning Dashboard
// Program categories become scalable GSF "blocks" (×factor instances)
// that drag / drop onto the floor levels of the three key buildings,
// with the vector campus site plan alongside.
// Requires: index.html main script (S, el, fmt, catMetrics, floorSF...),
//           js/site-svg.js (SITE_SVG_INLINE), js/floor-svgs.js (FLOOR_SVGS).
// ====================================================================

// ── Constants ───────────────────────────────────────────────────────────
var SS_GRID_DIV       = 50;    // dashed grid interval in feet
var SS_CANVAS_PX      = 300;   // level canvas viewport pixel size
var SS_GRID_PX_PER_FT = 2.0;   // logical px per foot at zoom=1
var SS_BLOCK_AR       = 1.5;   // default aspect ratio of a program block
var SS_BLOCK_HT       = 12;    // section height (ft) of a placed block

// Site map display
var SITE_VB       = [455, 305, 1560, 1105];  // crop of the site plan svg (svg units)
var SITE_PX_PER_FT= 0.32;                    // world px per foot at zoom=1
var SS_ZOOM=1.0, SS_PAN_X=0, SS_PAN_Y=0;

// Floor plan svg lookup: S.buildings floor "plan" name → FLOOR_SVGS key
var SS_PLAN_KEY = {
  "26_0722_Stilits_level1":"stilts_L1",
  "26_0722_Stiilts_level2&3":"stilts_L2",
  "26_0722_Stilits_levels4-5-6":"stilts_L456",
  "31_BurlingtonMallRoad_level1&2":"mall31_L1L2",
  "26_0722_67SouthBedford_level1&2":"sb67_L1",
  "26_0722_67SouthBedford_level3":"sb67_L3",
  "26_0722_67SouthBedford_level4":"sb67_L4"
};

// Site-plan footprints, label anchors and highlight colors per building id
var SS_SITE_META = {
  stilts: {
    color:"#3CA09E", short:"ST", label:[740,1075],
    footprint:"738.84 577.92 687.96 577.92 687.96 567.24 656.76 567.24 656.76 577.92 651.6 577.92 651.6 797.4 612.36 797.4 612.36 954.48 651.6 954.48 651.6 909.48 681.6 909.48 681.6 924.48 670.08 924.48 670.08 943.32 681.6 943.32 681.6 954.48 722.04 954.48 722.04 942.96 732.48 942.96 732.48 1023.84 820.2 1023.84 820.2 1034.76 828.84 1034.76 828.84 1023.84 862.44 1023.84 862.44 916.92 820.2 916.92 820.2 882.36 843.36 882.36 843.36 835.08 871.08 835.08 871.08 806.28 854.88 806.28 854.88 792.24 864.84 792.24 864.84 766.92 810.96 715.92 810.96 694.8 810.96 645 819.6 645 819.6 550.2 764.04 550.2 764.04 566.88 744.6 566.88 744.6 577.92 738.84 577.92"
  },
  bmr31: {
    color:"#5670E0", short:"31M", label:[1172,430],
    footprint:"1120.2 457.08 1157.16 457.08 1157.16 471 1174.44 471 1174.44 449.28 1195.32 449.28 1195.32 457.08 1224.12 457.08 1224.12 561 1195.32 561 1195.32 565.44 1174.44 565.44 1174.44 543.72 1157.16 543.72 1157.16 561 1120.2 561 1120.2 458.28"
  },
  sb67: {
    color:"#FEB522", short:"67SB", label:[1360,1160],
    footprint:"1217.4 1068.6 1202.64 1062 1182.96 1106.28 1231.44 1128 1238.04 1113.24 1252.8 1119.84 1259.4 1104.96 1274.16 1111.56 1288.92 1078.2 1354.44 1107.48 1360.92 1092.72 1375.8 1099.2 1382.28 1084.44 1397.04 1091.04 1411.44 1058.76 1457.4 1079.16 1463.88 1064.52 1478.64 1071.12 1485.24 1056.36 1500.12 1062.84 1526.28 1003.68 1482.48 984.36 1469.4 1013.88 1421.16 992.28 1410.36 1015.92 1395.48 1009.44 1380.48 1043.28 1300.68 1007.52 1287.12 1036.92 1272.36 1030.44 1255.68 1067.88 1224 1053.84 1217.4 1068.6"
  }
};

// ── Small helpers ───────────────────────────────────────────────────────
function f2(n){ return Number(n).toFixed(2); }
function darkenColor(hex,amt){
  if(!hex||hex[0]!=='#'||hex.length<7) return "#888";
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16),f=1-amt;
  return "#"+[r,g,b].map(function(v){return Math.max(0,Math.round(v*f)).toString(16).padStart(2,"0");}).join("");
}
function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// Drawing-unit → feet conversion, from the editable Project Assumptions
function ssFtPerUnit(){
  return Number(S.assumptions.plan_scale_ft_per_inch.v) / Number(S.assumptions.plan_units_per_inch.v);
}
function ssPxPerFt(){ return SS_GRID_PX_PER_FT; }

// Canvas world size (ft) for a building — fits its largest floor outline
function ssGridFt(bldg){
  var mx=0;
  bldg.floors.forEach(function(f){
    var fp=FLOOR_SVGS[ssPlanKey(f.plan)];
    if(fp) mx=Math.max(mx, fp.vb[2], fp.vb[3]);
  });
  var ft=mx*ssFtPerUnit();
  return Math.max(200, Math.ceil(ft*1.12/SS_GRID_DIV)*SS_GRID_DIV);
}
function ssFitZoom(bldg){
  var z=SS_CANVAS_PX/(ssGridFt(bldg)*SS_GRID_PX_PER_FT);
  return Math.max(0.05, Math.round(z*100)/100);
}
function ssBldg(id){ for(var i=0;i<S.buildings.length;i++){ if(S.buildings[i].id===id) return S.buildings[i]; } return null; }
function ssCat(id){ for(var i=0;i<S.program.length;i++){ if(S.program[i].id===id) return S.program[i]; } return null; }

// ── Block metrics ───────────────────────────────────────────────────────
// A block = the sum of ALL rooms in one program category, in GSF terms
// (NSF → DGSF → GSF chain from the Program tab), scaled by its factor.
function ssCatGSF(cat){ return catMetrics(cat).gsf; }
function ssBlockGSF(catId, factor){
  var cat=ssCat(catId);
  return cat ? ssCatGSF(cat)*(Number(factor)||0) : 0;
}
function ssBlockDims(gsf){
  var wft=Math.sqrt(Math.max(1,gsf)*SS_BLOCK_AR), hft=Math.sqrt(Math.max(1,gsf)/SS_BLOCK_AR);
  return {gw:Math.round(wft*ssPxPerFt()), gh:Math.round(hft*ssPxPerFt())};
}
// Headline stats for a scaled block ("the admin office program is 200 people…")
function ssBlockStats(catId, factor){
  var cat=ssCat(catId); if(!cat) return "";
  var m=catMetrics(cat), f=Number(factor)||0;
  if(cat.id==="gec") return fmt(m.examRooms*f)+" exam rooms · "+fmt(m.daily*f)+" visits/day";
  if(cat.id==="dnt") return fmt(catKPUCount(cat)*f)+" KPUs · "+f1(m.orDaily*f)+" OR cases/day";
  if(cat.id==="adm") return fmt((m.headcount||0)*f)+" people";
  return "";
}

// ====================================================================
// FLOOR MASK + SMART FILL
// Each floor outline is rasterized (synchronously, from its <line>
// segments) into a grid of SS_MASK_FT × SS_MASK_FT cells. A dropped
// block "pours" into the outline from its seed point: nearest-free-cell
// snap, then Chebyshev-distance growth over free interior cells until
// the block's GSF is reached — so blocks keep their area, hug the
// outline and neighboring blocks, and can never fall outside the floor.
// ====================================================================
var SS_MASK_FT = 3;          // fill-grid cell size in feet (9 SF / cell)
var _ssClassCache = {};      // key|fpu → {W,H,upc,cls} (0 white · 1 wall/grey blocked · 2 colored)
var _ssClassPending = {};
var _ssMaskCache = {};       // key|fpu|avail → mask

// Legacy plan-name mapping (old saved states); new plan names equal FLOOR_SVGS keys
function ssPlanKey(plan){
  if(FLOOR_SVGS[plan]) return plan;
  return SS_PLAN_KEY[plan]||plan;
}

// Async: rasterize the floor plan svg (with its fills) and classify each cell.
// Grey / dark → blocked · colored → placeable · white → placeable if inside.
function ssClassGrid(key){
  var fpu=ssFtPerUnit();
  var ck=key+"|"+fpu.toFixed(5);
  if(_ssClassCache[ck]) return _ssClassCache[ck];
  if(_ssClassPending[ck]) return null;
  var fp=FLOOR_SVGS[key]; if(!fp) return null;
  _ssClassPending[ck]=true;
  var upc=SS_MASK_FT/fpu;
  var W=Math.ceil(fp.vb[2]/upc), H=Math.ceil(fp.vb[3]/upc);
  var img=new Image();
  var url=URL.createObjectURL(new Blob([fp.svg],{type:"image/svg+xml"}));
  img.onload=function(){
    try{
      var cv=document.createElement("canvas"); cv.width=W; cv.height=H;
      var ctx=cv.getContext("2d",{willReadFrequently:true});
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
      ctx.drawImage(img,0,0,W,H);
      var d=ctx.getImageData(0,0,W,H).data;
      var cls=new Uint8Array(W*H);
      for(var i=0;i<W*H;i++){
        var r=d[i*4],g=d[i*4+1],b=d[i*4+2];
        var v=Math.max(r,g,b), sat=v-Math.min(r,g,b);
        if(sat>28) cls[i]=2;            // colored — placeable
        else if(v>=225) cls[i]=0;       // white-ish (incl. faint dashed grid lines)
        else cls[i]=1;                  // wall lines / grey unusable area — blocked
      }
      _ssClassCache[ck]={W:W,H:H,upc:upc,cls:cls};
    }finally{
      URL.revokeObjectURL(url);
      delete _ssClassPending[ck];
    }
    if(state.tab==="scenarios"){
      var bp=document.getElementById("ss-bldg-panel"); if(bp) buildBuildingPanel(bp);
      var pp=document.getElementById("ss-prog-panel"); if(pp) buildBlocksPanel(pp);
      var sp=document.getElementById("ss-site-panel"); if(sp) buildSitePanel(sp);
    }
  };
  img.onerror=function(){ URL.revokeObjectURL(url); delete _ssClassPending[ck]; };
  img.src=url;
  return null;
}

// Mask for one level. If availSF is given (Stilts Level 3), only the TOP
// availSF of placeable area stays usable — the rest is cut off below an
// auto-computed horizontal divider line (returned in mask.divider).
function ssFloorMask(key, availSF){
  var fpu=ssFtPerUnit();
  var hasAvail=(availSF!==undefined&&availSF!==null);
  var ck=key+"|"+fpu.toFixed(5)+"|"+(hasAvail?Math.round(availSF):"-");
  if(_ssMaskCache[ck]) return _ssMaskCache[ck];
  var cg=ssClassGrid(key);
  if(!cg) return null;
  var W=cg.W,H=cg.H,cls=cg.cls;
  var cellSF=SS_MASK_FT*SS_MASK_FT;
  // exterior flood over white cells from the borders
  var ext=new Uint8Array(W*H), stack=[];
  for(var x=0;x<W;x++){ stack.push(x,(H-1)*W+x); }
  for(var y=0;y<H;y++){ stack.push(y*W, y*W+W-1); }
  while(stack.length){
    var p=stack.pop();
    if(ext[p]||cls[p]!==0) continue;
    ext[p]=1;
    var cx=p%W, cy=(p-cx)/W;
    if(cx>0)stack.push(p-1); if(cx<W-1)stack.push(p+1);
    if(cy>0)stack.push(p-W); if(cy<H-1)stack.push(p+W);
  }
  var interior=new Uint8Array(W*H);
  for(var j=0;j<W*H;j++){ if((cls[j]===0&&!ext[j])||cls[j]===2) interior[j]=1; }
  var divider=null;
  if(hasAvail){
    var target=Math.max(0,Number(availSF)||0);
    var cum=0, cutRow=H;
    for(var ry=0;ry<H;ry++){
      var rowCnt=0;
      for(var rx=0;rx<W;rx++){ if(interior[ry*W+rx]) rowCnt++; }
      cum+=rowCnt*cellSF;
      if(cum>=target){ cutRow=ry+1; break; }
    }
    // grey out everything below the divider row
    var byRow={};
    for(var cy2=cutRow;cy2<H;cy2++){
      for(var cx2=0;cx2<W;cx2++){
        var p2=cy2*W+cx2;
        if(interior[p2]){ interior[p2]=0; (byRow[cy2]=byRow[cy2]||[]).push(cx2); }
      }
    }
    var runs=[];
    Object.keys(byRow).forEach(function(rk){
      var row=byRow[rk].sort(function(a,b){return a-b;});
      var yy=+rk, st=row[0], prev=row[0];
      for(var i2=1;i2<=row.length;i2++){
        if(i2<row.length && row[i2]===prev+1){ prev=row[i2]; continue; }
        runs.push({y:yy,x0:st,x1:prev});
        if(i2<row.length){ st=row[i2]; prev=row[i2]; }
      }
    });
    divider={row:cutRow, runs:runs, availActual:Math.min(cum,target>0?cum:0)};
  }
  var free=0;
  for(var j2=0;j2<W*H;j2++){ if(interior[j2]) free++; }
  var mask={W:W,H:H,upc:cg.upc,cellSF:cellSF,interior:interior,freeCount:free,divider:divider};
  _ssMaskCache[ck]=mask;
  return mask;
}

// Binary min-heap of [key, value]
function ssHeapPush(h,k,v){
  h.push([k,v]); var i=h.length-1;
  while(i>0){ var p=(i-1)>>1; if(h[p][0]<=h[i][0])break; var t=h[p];h[p]=h[i];h[i]=t; i=p; }
}
function ssHeapPop(h){
  var top=h[0], last=h.pop();
  if(h.length){ h[0]=last;
    for(var i=0;;){ var l=2*i+1, r=l+1, m=i;
      if(l<h.length&&h[l][0]<h[m][0])m=l;
      if(r<h.length&&h[r][0]<h[m][0])m=r;
      if(m===i)break; var t=h[m];h[m]=h[i];h[i]=t; i=m; }
  }
  return top;
}

// Nearest free interior cell to (sx,sy) — plain BFS proximity search
function ssNearestFree(mask,taken,sx,sy){
  var W=mask.W,H=mask.H;
  var start=sy*W+sx;
  if(mask.interior[start]&&!taken[start]) return start;
  var seen=new Uint8Array(W*H), q=[start]; seen[start]=1;
  var qi=0;
  while(qi<q.length){
    var p=q[qi++];
    var cx=p%W, cy=(p-cx)/W;
    var nb=[];
    if(cx>0)nb.push(p-1); if(cx<W-1)nb.push(p+1);
    if(cy>0)nb.push(p-W); if(cy<H-1)nb.push(p+W);
    for(var i=0;i<nb.length;i++){
      var n=nb[i];
      if(seen[n])continue;
      seen[n]=1;
      if(mask.interior[n]&&!taken[n]) return n;
      q.push(n);
    }
  }
  return -1;
}

// Compute the fill regions for all blocks placed on one level.
// Returns [{item, cells, runs, bbox, centroid, gsf, fitGSF, truncated}], in item order.
function ssComputeFills(bdef, bs, li){
  var lvlDef=bdef.floors[li];
  var key=ssPlanKey(lvlDef.plan);
  var mask=ssFloorMask(key, lvlDef.avail_sf);
  var items=bs.levels[li]||[];
  var out=[];
  if(!mask){ items.forEach(function(it){ out.push({item:it,cells:[],runs:[],bbox:null,centroid:null,gsf:ssBlockGSF(it.catId,it.factor),fitGSF:0,truncated:true}); }); return out; }
  var W=mask.W,H=mask.H;
  var taken=new Uint8Array(W*H);
  items.forEach(function(item){
    var gsf=ssBlockGSF(item.catId,item.factor);
    var need=Math.max(1,Math.round(gsf/mask.cellSF));
    var su=isFinite(item.su)?item.su:FLOOR_SVGS[key].vb[2]/2;
    var sv=isFinite(item.sv)?item.sv:FLOOR_SVGS[key].vb[3]/2;
    var sx=Math.max(0,Math.min(W-1,Math.round(su/mask.upc)));
    var sy=Math.max(0,Math.min(H-1,Math.round(sv/mask.upc)));
    var seedIdx=ssNearestFree(mask,taken,sx,sy);
    if(seedIdx<0){
      out.push({item:item,cells:[],runs:[],bbox:null,centroid:null,gsf:gsf,fitGSF:0,truncated:true});
      return;
    }
    var s0x=seedIdx%W, s0y=(seedIdx-s0x)/W;
    // Chebyshev-priority growth
    var cells=[];
    var inQ=new Uint8Array(W*H);
    var heap=[]; ssHeapPush(heap,0,seedIdx); inQ[seedIdx]=1;
    while(cells.length<need && heap.length){
      var p=ssHeapPop(heap)[1];
      cells.push(p); taken[p]=1;
      var cx=p%W, cy=(p-cx)/W;
      var nb=[];
      if(cx>0)nb.push(p-1); if(cx<W-1)nb.push(p+1);
      if(cy>0)nb.push(p-W); if(cy<H-1)nb.push(p+W);
      for(var i=0;i<nb.length;i++){
        var n=nb[i];
        if(inQ[n]||!mask.interior[n]||taken[n]) continue;
        inQ[n]=1;
        var nx=n%W, ny=(n-nx)/W;
        var dxx=Math.abs(nx-s0x), dyy=Math.abs(ny-s0y);
        ssHeapPush(heap, Math.max(dxx,dyy)*1000+(dxx+dyy), n);
      }
    }
    // Row RLE runs + bbox + centroid
    var byRow={}, minX=1e9,minY=1e9,maxX=-1,maxY=-1, sumX=0,sumY=0;
    cells.forEach(function(p){
      var cx2=p%W, cy2=(p-cx2)/W;
      (byRow[cy2]=byRow[cy2]||[]).push(cx2);
      if(cx2<minX)minX=cx2; if(cx2>maxX)maxX=cx2;
      if(cy2<minY)minY=cy2; if(cy2>maxY)maxY=cy2;
      sumX+=cx2; sumY+=cy2;
    });
    var runs=[];
    Object.keys(byRow).forEach(function(rk){
      var row=byRow[rk].sort(function(a,b){return a-b;});
      var y=+rk, st=row[0], prev=row[0];
      for(var i2=1;i2<=row.length;i2++){
        if(i2<row.length && row[i2]===prev+1){ prev=row[i2]; continue; }
        runs.push({y:y,x0:st,x1:prev});
        if(i2<row.length){ st=row[i2]; prev=row[i2]; }
      }
    });
    // Perimeter edges (cell-boundary segments where neighbor is outside the region)
    var inRegion=new Uint8Array(W*H);
    cells.forEach(function(p){ inRegion[p]=1; });
    var edges=[];
    cells.forEach(function(p){
      var cx3=p%W, cy3=(p-cx3)/W;
      if(cx3===0||!inRegion[p-1])   edges.push([cx3,cy3,cx3,cy3+1]);
      if(cx3===W-1||!inRegion[p+1]) edges.push([cx3+1,cy3,cx3+1,cy3+1]);
      if(cy3===0||!inRegion[p-W])   edges.push([cx3,cy3,cx3+1,cy3]);
      if(cy3===H-1||!inRegion[p+W]) edges.push([cx3,cy3+1,cx3+1,cy3+1]);
    });
    out.push({
      item:item, cells:cells, runs:runs, edges:edges,
      bbox:cells.length?{x0:minX,y0:minY,x1:maxX+1,y1:maxY+1}:null,
      centroid:cells.length?[sumX/cells.length+0.5, sumY/cells.length+0.5]:null,
      gsf:gsf, fitGSF:cells.length*mask.cellSF,
      truncated:cells.length<need
    });
  });
  return out;
}

// Drop-event position → floor-svg-unit seed coordinates (relative to vb origin)
function ssDropSeed(e, cRect, panX, panY, lz, key, worldPx0){
  var fp=FLOOR_SVGS[key];
  var wx=(e.clientX-cRect.left-panX)/lz;
  var wy=(e.clientY-cRect.top-panY)/lz;
  if(!fp) return {su:0, sv:0};
  var pxPerU=ssFtPerUnit()*SS_GRID_PX_PER_FT;
  var ox=(worldPx0-fp.vb[2]*pxPerU)/2, oy=(worldPx0-fp.vb[3]*pxPerU)/2;
  return {su:(wx-ox)/pxPerU, sv:(wy-oy)/pxPerU};
}

// ── Scenario state ──────────────────────────────────────────────────────
function ssDefaultBlocks(){
  return S.program.map(function(c){ return {id:c.id+"_1", catId:c.id, factor:1}; });
}
function ssNewScenario(name){
  return {
    name: name,
    buildings: S.buildings.map(function(b){
      return {
        id: b.id,
        levels:      b.floors.map(function(){ return []; }),
        levelZoom:   b.floors.map(function(){ return ssFitZoom(b); }),
        levelPan:    b.floors.map(function(){ return [0,0]; }),
        levelHeights:b.floors.map(function(f,i){ return i*14; }),
        sectionLine: null
      };
    }),
    blocks: ssDefaultBlocks()
  };
}
var SS = {
  activeScenario: 0,
  activeBuilding: 0,
  scenarios: [ssNewScenario("Scenario 1")],
  _sectionDrawMode: false
};

function ssNormalizeScenario(sc){
  if(!Array.isArray(sc.blocks)||!sc.blocks.length) sc.blocks=ssDefaultBlocks();
  var byId={};
  (sc.buildings||[]).forEach(function(bs){ byId[bs.id]=bs; });
  sc.buildings=S.buildings.map(function(b){
    var bs=byId[b.id]||{id:b.id};
    var n=b.floors.length;
    bs.levels      =(bs.levels||[]).slice(0,n);      while(bs.levels.length<n)      bs.levels.push([]);
    bs.levelZoom   =(bs.levelZoom||[]).slice(0,n);   while(bs.levelZoom.length<n)   bs.levelZoom.push(ssFitZoom(b));
    bs.levelPan    =(bs.levelPan||[]).slice(0,n);    while(bs.levelPan.length<n)    bs.levelPan.push([0,0]);
    bs.levelHeights=(bs.levelHeights||[]).slice(0,n);while(bs.levelHeights.length<n)bs.levelHeights.push(bs.levelHeights.length*14);
    if(bs.sectionLine===undefined) bs.sectionLine=null;
    return bs;
  });
  return sc;
}
function ssScenario(){ return SS.scenarios[SS.activeScenario]; }

// Where is this block instance placed? → {bi, li} or null
function ssAssignmentOf(blockId){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    var lvls=sc.buildings[bi].levels;
    for(var li=0;li<lvls.length;li++){
      if(lvls[li].some(function(it){return it.id===blockId;})) return {bi:bi,li:li};
    }
  }
  return null;
}
function ssIsAssigned(id){ return ssAssignmentOf(id)!==null; }
function ssBadgeFor(asgn){
  var b=S.buildings[asgn.bi];
  var meta=SS_SITE_META[b.id]||{};
  return (meta.short||b.id)+"·"+b.floors[asgn.li].label.replace("Level ","L");
}

function ssPlacedGSFForLevel(bldgId, li){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    if(sc.buildings[bi].id===bldgId){
      return (sc.buildings[bi].levels[li]||[]).reduce(function(s,it){return s+ssBlockGSF(it.catId,it.factor);},0);
    }
  }
  return 0;
}
function ssPlacedGSFForBuilding(bldgId){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    if(sc.buildings[bi].id===bldgId){
      return sc.buildings[bi].levels.reduce(function(s,lvl){
        return s+lvl.reduce(function(t,it){return t+ssBlockGSF(it.catId,it.factor);},0);
      },0);
    }
  }
  return 0;
}

// ====================================================================
// MAIN TAB
// ====================================================================
function tabScenarios(){
  ssNormalizeScenario(ssScenario());
  // kick off floor plan rasterization for every level (async, cached)
  S.buildings.forEach(function(b){ b.floors.forEach(function(f){ ssClassGrid(ssPlanKey(f.plan)); }); });
  var outer=el("div",{style:"display:flex;flex-direction:column;gap:0"});

  // Top bar — scenario pills + exports
  var topBar=el("div",{style:"display:flex;align-items:center;gap:8px;padding:2px 0 12px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:12px"});
  topBar.appendChild(el("span",{class:"eyebrow"},["Scenarios"]));
  SS.scenarios.forEach(function(sc,i){
    topBar.appendChild(el("button",{
      class:"seg sm",
      style:i===SS.activeScenario?"background:var(--ink);color:#fff":"",
      onclick:function(){SS.activeScenario=i;SS.activeBuilding=0;renderSiteTab();}
    },[sc.name]));
  });
  topBar.appendChild(el("button",{
    class:"seg sm",style:"border-style:dashed;color:var(--faint)",
    onclick:function(){SS.scenarios.push(ssNewScenario("Scenario "+(SS.scenarios.length+1)));SS.activeScenario=SS.scenarios.length-1;SS.activeBuilding=0;renderSiteTab();}
  },["+ Scenario"]));
  topBar.appendChild(el("div",{style:"margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"},[
    el("button",{class:"seg sm",onclick:function(){ssPrintBuildings();}},["⤓ Buildings PDF"]),
    el("button",{class:"seg sm",onclick:function(){ssPrintSiteMap();}},["⤓ Site PDF"]),
    el("button",{class:"seg sm",onclick:function(){ssExportScenarios();}},["⤓ Scenarios JSON"]),
    el("label",{class:"seg sm",style:"cursor:pointer"},[
      "⤒ Import JSON",
      el("input",{type:"file",accept:".json",style:"display:none",
        onchange:function(e){ssImportScenarios(e);}})
    ])
  ]));
  outer.appendChild(topBar);

  // Two-column layout: blocks panel | buildings + site
  var cols=el("div",{style:"display:grid;grid-template-columns:320px 1fr;gap:14px;align-items:start"});
  var progPanel=el("div",{id:"ss-prog-panel",style:"background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;max-height:calc(100vh - 170px);overflow-y:auto;padding:14px"});
  buildBlocksPanel(progPanel);
  var rightCol=el("div",{style:"display:flex;flex-direction:column;gap:14px;min-width:0"});
  var bldgPanel=el("div",{id:"ss-bldg-panel",style:"background:var(--card);border:1px solid var(--line);padding:14px"});
  buildBuildingPanel(bldgPanel);
  var sitePanel=el("div",{id:"ss-site-panel",style:"background:var(--card);border:1px solid var(--line);padding:14px"});
  buildSitePanel(sitePanel);
  rightCol.appendChild(bldgPanel);
  rightCol.appendChild(sitePanel);
  cols.appendChild(progPanel);
  cols.appendChild(rightCol);
  outer.appendChild(cols);
  return outer;
}
function renderSiteTab(){
  var v=$("#view");v.innerHTML="";v.appendChild(tabScenarios());
}

// ====================================================================
// PROGRAM BLOCKS PANEL
// Each category = one block type; instances can be added / removed and
// scaled by a factor (×1, ×0.5, …). Block area = category GSF × factor.
// ====================================================================
function buildBlocksPanel(container){
  var _saved=container.scrollTop;
  container.innerHTML="";
  var sc=ssScenario();

  container.appendChild(el("h3",null,["Program Blocks"]));
  container.appendChild(el("div",{class:"hint",style:"margin:0 0 12px"},
    ["Each block is the sum of a whole program category in GSF (NSF × dept grossing × building grossing, live from the Program tab). Add blocks and scale each one by a factor — e.g. an extra Admin block at ×0.5 = half the office program. Drag a block onto a floor level."]));

  S.program.forEach(function(cat){
    var m=catMetrics(cat);
    var catWrap=el("div",{style:"margin-bottom:16px;border:1px solid var(--line)"});

    // Category band
    var band=el("div",{style:"display:flex;align-items:center;gap:8px;padding:7px 10px;background:"+cat.color});
    band.appendChild(el("span",{style:"font-weight:900;font-size:13px;color:#233044;flex:1"},[cat.name]));
    band.appendChild(el("span",{style:"font-size:11px;font-weight:700;color:#233044;background:rgba(255,255,255,.7);padding:1px 8px;border-radius:9px"},[fmt(m.gsf)+" GSF ea"]));
    band.appendChild(el("button",{
      title:"Add a block of this category",
      style:"width:22px;height:22px;border:1px solid rgba(35,48,68,.4);background:rgba(255,255,255,.8);border-radius:3px;cursor:pointer;font-weight:900;line-height:1;padding:0",
      onclick:function(){
        var n=1; sc.blocks.forEach(function(b){ if(b.catId===cat.id) n++; });
        var id=cat.id+"_"+n;
        while(sc.blocks.some(function(b){return b.id===id;})) id=cat.id+"_"+(++n);
        sc.blocks.push({id:id, catId:cat.id, factor:1});
        buildBlocksPanel(container);
      }
    },["+"]));
    catWrap.appendChild(band);

    // Block instances
    var body=el("div",{style:"padding:8px 10px;display:flex;flex-direction:column;gap:8px"});
    var instances=sc.blocks.filter(function(b){return b.catId===cat.id;});
    if(!instances.length){
      body.appendChild(el("div",{style:"font-size:11px;color:var(--faint);font-style:italic"},["No blocks — click + to add one."]));
    }
    instances.forEach(function(block){
      var asgn=ssAssignmentOf(block.id);
      var assigned=asgn!==null;
      var gsf=ssBlockGSF(block.catId, block.factor);
      // Chip sized proportional to GSF (display scale)
      var dw=Math.max(70,Math.round(Math.sqrt(Math.max(1,gsf)*SS_BLOCK_AR)*0.62));
      var dh=Math.max(46,Math.round(Math.sqrt(Math.max(1,gsf)/SS_BLOCK_AR)*0.62));

      var chip=el("div",{
        "data-block-id":block.id,
        draggable:assigned?"false":"true",
        title:cat.name+" × "+block.factor+" — "+fmt(gsf)+" GSF"+(assigned?" (placed)":""),
        style:[
          "position:relative","width:"+dw+"px","height:"+dh+"px",
          "background:"+cat.color,
          "border:1.5px solid "+darkenColor(cat.color,0.3),
          "cursor:"+(assigned?"default":"grab"),
          "opacity:"+(assigned?"0.4":"1"),
          "padding:4px 6px","box-sizing:border-box","flex-shrink:0"
        ].join(";")
      });
      var lblRow=el("div",{style:"display:flex;align-items:center;gap:4px"});
      lblRow.appendChild(el("span",{style:"font-weight:900;font-size:12px;color:#233044"},["× "]));
      var fInp=el("input",{
        type:"text",value:String(block.factor),
        title:"Scale factor for this block",
        style:"width:34px;font-size:12px;font-weight:900;border:1px solid rgba(35,48,68,.35);background:rgba(255,255,255,.8);padding:1px 3px;text-align:center;font-family:inherit;color:#233044"+(assigned?";pointer-events:none;opacity:.6":"")
      });
      fInp.addEventListener("change",function(){
        var v=parseFloat(fInp.value.replace(/[^0-9.]/g,""));
        block.factor=(isNaN(v)||v<=0)?1:Math.round(v*100)/100;
        buildBlocksPanel(container);
      });
      fInp.addEventListener("mousedown",function(e){e.stopPropagation();});
      lblRow.appendChild(fInp);
      lblRow.appendChild(el("span",{style:"font-size:10px;font-weight:700;color:#233044;margin-left:auto"},[fmt(gsf)+" GSF"]));
      chip.appendChild(lblRow);
      var stats=ssBlockStats(block.catId, block.factor);
      if(stats) chip.appendChild(el("div",{style:"font-size:9px;color:#233044;opacity:.75;margin-top:2px;line-height:1.25"},[stats]));

      if(assigned){
        chip.appendChild(el("span",{style:"position:absolute;top:-8px;right:-6px;background:#233044;color:#fff;font-size:8px;font-weight:800;border-radius:5px;padding:0 5px;line-height:12px;pointer-events:none"},[ssBadgeFor(asgn)]));
      } else {
        // Remove instance
        chip.appendChild(el("button",{
          title:"Remove this block",
          style:"position:absolute;top:-7px;right:-7px;width:15px;height:15px;border-radius:50%;border:1px solid #C0392B66;background:#fff;color:#C0392B;font-size:9px;cursor:pointer;line-height:1;padding:0",
          onclick:function(e){
            e.stopPropagation();
            var i=sc.blocks.indexOf(block);
            if(i>=0) sc.blocks.splice(i,1);
            buildBlocksPanel(container);
          }
        },["✕"]));
        chip.addEventListener("dragstart",function(e){
          e.dataTransfer.effectAllowed="move";
          e.dataTransfer.setData("text/plain",JSON.stringify({isBlock:true,id:block.id,catId:block.catId,factor:block.factor}));
          setTimeout(function(){chip.style.opacity="0.25";},0);
        });
        chip.addEventListener("dragend",function(){chip.style.opacity="1";});
      }
      body.appendChild(chip);
    });

    // Category placement summary
    var totalGSF=instances.reduce(function(s,b){return s+ssBlockGSF(b.catId,b.factor);},0);
    var placedGSF=instances.reduce(function(s,b){return s+(ssIsAssigned(b.id)?ssBlockGSF(b.catId,b.factor):0);},0);
    body.appendChild(el("div",{style:"font-size:10px;color:var(--mut);border-top:1px solid var(--line);padding-top:6px"},[
      instances.length+" block"+(instances.length===1?"":"s")+" · "+fmt(totalGSF)+" GSF · placed "+fmt(placedGSF)+" · unplaced "+fmt(totalGSF-placedGSF)
    ]));
    catWrap.appendChild(body);
    container.appendChild(catWrap);
  });

  // Grand totals vs building capacity
  var allTotal=0, allPlaced=0;
  sc.blocks.forEach(function(b){
    var g=ssBlockGSF(b.catId,b.factor);
    allTotal+=g; if(ssIsAssigned(b.id)) allPlaced+=g;
  });
  var cap=0, capReady=true;
  S.buildings.forEach(function(b){ b.floors.forEach(function(f){
    var m=ssFloorMask(ssPlanKey(f.plan), f.avail_sf);
    if(m) cap+=m.freeCount*m.cellSF; else capReady=false;
  }); });
  var sum=el("div",{style:"border-top:2px solid var(--ink);padding-top:8px;font-size:11px;color:var(--ink)"});
  sum.appendChild(el("div",{style:"display:flex;justify-content:space-between;font-weight:900"},[
    el("span",null,["All blocks"]), el("span",null,[fmt(allTotal)+" GSF"])]));
  sum.appendChild(el("div",{style:"display:flex;justify-content:space-between"},[
    el("span",null,["Placed"]), el("span",null,[fmt(allPlaced)+" GSF"])]));
  sum.appendChild(el("div",{style:"display:flex;justify-content:space-between"},[
    el("span",null,["Unplaced remainder"]), el("span",{style:allTotal-allPlaced>0?"color:#C0392B;font-weight:700":""},[fmt(allTotal-allPlaced)+" GSF"])]));
  sum.appendChild(el("div",{style:"display:flex;justify-content:space-between;color:var(--faint);margin-top:2px"},[
    el("span",null,["All-building usable area (grey excluded)"]), el("span",null,[capReady?fmt(cap)+" SF":"…"])]));
  container.appendChild(sum);

  container.scrollTop=_saved;
}

// ====================================================================
// BUILDING PANEL — level canvases with real floor outlines
// ====================================================================
function buildBuildingPanel(container){
  container.innerHTML="";
  var sc=ssScenario();
  ssNormalizeScenario(sc);

  var hdr=el("div",{style:"display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap"});
  hdr.appendChild(el("h3",{style:"margin:0 6px 0 0"},["Key Buildings"]));
  S.buildings.forEach(function(b,bi){
    var meta=SS_SITE_META[b.id]||{};
    hdr.appendChild(el("button",{
      class:"seg sm",
      style:bi===SS.activeBuilding?"background:var(--ink);color:#fff":"",
      onclick:function(){SS.activeBuilding=bi;buildBuildingPanel(container);var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);}
    },[el("span",{class:"dot",style:"background:"+(meta.color||"#ccc")}), b.name]));
  });
  container.appendChild(hdr);

  var bdef=S.buildings[SS.activeBuilding];
  var bs=sc.buildings[SS.activeBuilding];
  if(!bdef||!bs) return;
  var gridFt=ssGridFt(bdef);

  var legendRow=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap"});
  legendRow.appendChild(el("div",{class:"hint",style:"margin:0;flex:1;min-width:200px"},
    [gridFt+"′ canvas · grid = "+SS_GRID_DIV+"′ · scroll or +/− to zoom · dropped blocks auto-fill the usable floor area keeping their GSF ("+SS_MASK_FT+"′ cells) · grey = unusable · drag a placed block to re-flow it · hover for × delete"]));
  // Section draw toggle
  if(!SS._sectionDrawMode) SS._sectionDrawMode=false;
  legendRow.appendChild(el("button",{
    class:"seg sm",
    title:"Draw a section cut line — appears on all levels. Short tick marks indicate viewing direction.",
    style:SS._sectionDrawMode?"background:#C0392B;border-color:#C0392B;color:#fff":"",
    onclick:function(){
      SS._sectionDrawMode=!SS._sectionDrawMode;
      buildBuildingPanel(container);
    }
  },[SS._sectionDrawMode?"✕ Cancel Section":"📐 Draw Section"]));
  if(bs.sectionLine){
    legendRow.appendChild(el("button",{
      class:"seg sm",style:"color:#C0392B",
      title:"Remove the current section line",
      onclick:function(){bs.sectionLine=null;buildBuildingPanel(container);}
    },["✕ Clear"]));
  }
  container.appendChild(legendRow);

  var worldPx0=gridFt*SS_GRID_PX_PER_FT;   // world px at zoom=1

  var levelsRow=el("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax("+(SS_CANVAS_PX+2)+"px,1fr));gap:12px"});

  bdef.floors.forEach(function(lvlDef,li){
    var items=bs.levels[li];
    var plate=floorSF(lvlDef.units2);
    var lvlGSF=items.reduce(function(s,it){return s+ssBlockGSF(it.catId,it.factor);},0);
    var lz=bs.levelZoom[li]||ssFitZoom(bdef);
    var scaledCanvas=Math.round(worldPx0*lz);

    var card=el("div",{style:"display:flex;flex-direction:column;border:1px solid var(--line);overflow:hidden"});

    var canvasWrap=el("div",{style:"position:relative;width:100%;height:"+SS_CANVAS_PX+"px;background:#fff;flex-shrink:0;overflow:hidden"});
    var panX=bs.levelPan[li][0],panY=bs.levelPan[li][1];
    var innerWorld=el("div",{style:"position:absolute;top:"+panY+"px;left:"+panX+"px;width:"+scaledCanvas+"px;height:"+scaledCanvas+"px;transform-origin:top left"});

    // Grid lines
    var svgNS="http://www.w3.org/2000/svg";
    var gridSvg=document.createElementNS(svgNS,"svg");
    gridSvg.setAttribute("width",scaledCanvas);
    gridSvg.setAttribute("height",scaledCanvas);
    gridSvg.style.cssText="position:absolute;top:0;left:0;pointer-events:none;z-index:1";
    var step=SS_GRID_DIV*ssPxPerFt()*lz;
    var numLines=Math.floor(gridFt/SS_GRID_DIV);
    for(var gi=0;gi<=numLines;gi++){
      var gp=gi*step;
      var vl=document.createElementNS(svgNS,"line");
      vl.setAttribute("x1",gp);vl.setAttribute("y1",0);vl.setAttribute("x2",gp);vl.setAttribute("y2",scaledCanvas);
      vl.setAttribute("stroke","#1266cc");vl.setAttribute("stroke-width",gi===0||gi===numLines?"1.2":"0.5");
      vl.setAttribute("stroke-dasharray",gi===0||gi===numLines?"none":"4,4");
      vl.setAttribute("opacity","0.25");
      gridSvg.appendChild(vl);
      var hl=document.createElementNS(svgNS,"line");
      hl.setAttribute("x1",0);hl.setAttribute("y1",gp);hl.setAttribute("x2",scaledCanvas);hl.setAttribute("y2",gp);
      hl.setAttribute("stroke","#1266cc");hl.setAttribute("stroke-width",gi===0||gi===numLines?"1.2":"0.5");
      hl.setAttribute("stroke-dasharray",gi===0||gi===numLines?"none":"4,4");
      hl.setAttribute("opacity","0.25");
      gridSvg.appendChild(hl);
    }
    innerWorld.appendChild(gridSvg);

    // Floor plan background
    var fp=FLOOR_SVGS[ssPlanKey(lvlDef.plan)];
    if(fp){
      var pxPerU=ssFtPerUnit()*SS_GRID_PX_PER_FT*lz;
      var fw=fp.vb[2]*pxPerU, fh=fp.vb[3]*pxPerU;
      var ox=(scaledCanvas-fw)/2, oy=(scaledCanvas-fh)/2;
      var fpDiv=document.createElement("div");
      fpDiv.style.cssText="position:absolute;left:"+ox+"px;top:"+oy+"px;width:"+fw+"px;height:"+fh+"px;pointer-events:none;z-index:1;opacity:0.9";
      fpDiv.innerHTML=fp.svg;
      var fpSvg=fpDiv.querySelector("svg");
      if(fpSvg){
        fpSvg.setAttribute("width",fw);
        fpSvg.setAttribute("height",fh);
        fpSvg.setAttribute("preserveAspectRatio","xMidYMid meet");
        fpSvg.style.display="block";
      }
      innerWorld.appendChild(fpDiv);
    }

    // Placed blocks — smart-filled regions that hug the floor outline
    var lvlMask=ssFloorMask(ssPlanKey(lvlDef.plan), lvlDef.avail_sf);
    var fills=ssComputeFills(bdef, bs, li);
    var cellPx=SS_MASK_FT*SS_GRID_PX_PER_FT*lz;   // display px per mask cell
    var fox=0, foy=0;
    if(fp){
      var pxPerU2=ssFtPerUnit()*SS_GRID_PX_PER_FT*lz;
      fox=(scaledCanvas-fp.vb[2]*pxPerU2)/2;
      foy=(scaledCanvas-fp.vb[3]*pxPerU2)/2;
    }

    // Available-Area divider (Stilts Level 3): grey out the area below the
    // computed line so only avail_sf of white area remains placeable above it.
    if(lvlMask&&lvlMask.divider){
      var dv=lvlMask.divider;
      if(dv.runs.length){
        var cutSvg=document.createElementNS(svgNS,"svg");
        var cbb={x0:1e9,y0:1e9,x1:-1,y1:-1};
        dv.runs.forEach(function(rn){
          if(rn.x0<cbb.x0)cbb.x0=rn.x0; if(rn.x1+1>cbb.x1)cbb.x1=rn.x1+1;
          if(rn.y<cbb.y0)cbb.y0=rn.y;   if(rn.y+1>cbb.y1)cbb.y1=rn.y+1;
        });
        cutSvg.setAttribute("viewBox",cbb.x0+" "+cbb.y0+" "+(cbb.x1-cbb.x0)+" "+(cbb.y1-cbb.y0));
        cutSvg.setAttribute("width",(cbb.x1-cbb.x0)*cellPx);
        cutSvg.setAttribute("height",(cbb.y1-cbb.y0)*cellPx);
        cutSvg.setAttribute("preserveAspectRatio","none");
        cutSvg.style.cssText="position:absolute;left:"+(fox+cbb.x0*cellPx)+"px;top:"+(foy+cbb.y0*cellPx)+"px;pointer-events:none;z-index:1";
        dv.runs.forEach(function(rn){
          var rc=document.createElementNS(svgNS,"rect");
          rc.setAttribute("x",rn.x0);rc.setAttribute("y",rn.y);
          rc.setAttribute("width",rn.x1-rn.x0+1);rc.setAttribute("height",1.03);
          rc.setAttribute("fill","#d2d0cf");rc.setAttribute("fill-opacity","0.85");
          cutSvg.appendChild(rc);
        });
        innerWorld.appendChild(cutSvg);
      }
      if(dv.row<lvlMask.H&&fp){
        var lineY=foy+dv.row*cellPx;
        innerWorld.appendChild(el("div",{style:[
          "position:absolute","left:"+fox+"px","top:"+(lineY-1)+"px",
          "width:"+(fp.vb[2]*ssFtPerUnit()*SS_GRID_PX_PER_FT*lz)+"px","height:2px",
          "background:#233044","z-index:5","pointer-events:none"
        ].join(";")}));
      }
    }

    var noFitCount=0;
    fills.forEach(function(f,ii){
      var item=f.item;
      if(!f.bbox){
        // Block couldn't get any cells (no free area) — show a removable warning chip
        var cat0=ssCat(item.catId);
        var chip=el("div",{style:"position:absolute;left:4px;top:"+(4+noFitCount*20)+"px;z-index:20;background:#fff;border:1px solid #C0392B;color:#C0392B;font-size:9px;font-weight:800;padding:1px 5px;display:flex;align-items:center;gap:5px"},
          ["⚠ "+(cat0?cat0.name:item.catId)+" ×"+item.factor+" — no room",
           el("span",{style:"cursor:pointer;font-weight:900",onclick:function(ev){
             ev.stopPropagation();
             var idx=items.indexOf(item);
             if(idx>=0) items.splice(idx,1);
             var pp=document.getElementById("ss-prog-panel");if(pp)buildBlocksPanel(pp);
             buildBuildingPanel(container);
           }},["✕"])]);
        canvasWrap.appendChild(chip);
        noFitCount++;
        return;
      }
      var cat=ssCat(item.catId);
      var color=cat?cat.color:"#C2C3C8";
      var bw=(f.bbox.x1-f.bbox.x0)*cellPx, bh=(f.bbox.y1-f.bbox.y0)*cellPx;
      var bx=fox+f.bbox.x0*cellPx, by=foy+f.bbox.y0*cellPx;

      var rEl=el("div",{
        title:(cat?cat.name:item.catId)+" × "+item.factor+" | "+fmt(f.gsf)+" GSF"+(f.truncated?" — ⚠ only "+fmt(f.fitGSF)+" GSF fits here":""),
        style:[
          "position:absolute","left:"+bx+"px","top:"+by+"px",
          "width:"+bw+"px","height:"+bh+"px",
          "cursor:move","user-select:none","z-index:"+(2+ii),
          "overflow:visible"
        ].join(";")
      });

      var svgNSr="http://www.w3.org/2000/svg";
      var rsvg=document.createElementNS(svgNSr,"svg");
      rsvg.setAttribute("viewBox",f.bbox.x0+" "+f.bbox.y0+" "+(f.bbox.x1-f.bbox.x0)+" "+(f.bbox.y1-f.bbox.y0));
      rsvg.setAttribute("width",bw); rsvg.setAttribute("height",bh);
      rsvg.setAttribute("preserveAspectRatio","none");
      rsvg.style.cssText="display:block;pointer-events:none;overflow:visible";
      f.runs.forEach(function(rn){
        var rc=document.createElementNS(svgNSr,"rect");
        rc.setAttribute("x",rn.x0);rc.setAttribute("y",rn.y);
        rc.setAttribute("width",rn.x1-rn.x0+1);rc.setAttribute("height",1.03);
        rc.setAttribute("fill",color);rc.setAttribute("fill-opacity","0.82");
        rsvg.appendChild(rc);
      });
      if(f.edges&&f.edges.length){
        var dstr="";
        f.edges.forEach(function(e2){ dstr+="M"+e2[0]+" "+e2[1]+"L"+e2[2]+" "+e2[3]; });
        var per=document.createElementNS(svgNSr,"path");
        per.setAttribute("d",dstr);
        per.setAttribute("stroke",darkenColor(color,0.35));
        per.setAttribute("stroke-width","0.16");
        per.setAttribute("fill","none");
        rsvg.appendChild(per);
      }
      rEl.appendChild(rsvg);

      // Label at region centroid
      if(bw>=46&&bh>=16){
        var lxPct=((f.centroid[0]-f.bbox.x0)/(f.bbox.x1-f.bbox.x0))*100;
        var lyPct=((f.centroid[1]-f.bbox.y0)/(f.bbox.y1-f.bbox.y0))*100;
        rEl.appendChild(el("div",{style:"position:absolute;left:"+lxPct+"%;top:"+lyPct+"%;transform:translate(-50%,-50%);font-size:9px;font-weight:800;color:#233044;pointer-events:none;text-align:center;line-height:1.25;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 4px #fff;white-space:nowrap"},
          [(cat?cat.name:item.catId)+" ×"+item.factor,
           el("br"),
           fmt(f.gsf)+" GSF"+(f.truncated?" ⚠":"")]));
      }

      var delBtn=el("div",{
        title:"Remove from this level",
        style:"position:absolute;top:-7px;right:-7px;width:15px;height:15px;border-radius:50%;background:#C0392B;color:#fff;font-size:9px;line-height:15px;text-align:center;cursor:pointer;z-index:10;display:none;box-shadow:0 1px 3px #0004",
        onclick:function(e){
          e.stopPropagation();e.preventDefault();
          var idx=items.indexOf(item);
          if(idx>=0) items.splice(idx,1);
          var pp=document.getElementById("ss-prog-panel");if(pp)buildBlocksPanel(pp);
          buildBuildingPanel(container);
          var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
        }
      },["×"]);
      rEl.addEventListener("mouseenter",function(){delBtn.style.display="block";});
      rEl.addEventListener("mouseleave",function(){delBtn.style.display="none";});
      rEl.appendChild(delBtn);

      // Drag to re-seed (same level, other level, or other building)
      rEl.setAttribute("draggable","true");
      rEl.addEventListener("dragstart",function(e){
        if(e.target===delBtn){e.preventDefault();return;}
        e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",JSON.stringify({
          id:item.id,
          fromBuilding:SS.activeBuilding,fromLevel:li,
          isBuildingMove:true
        }));
        setTimeout(function(){rEl.style.opacity="0.3";},0);
      });
      rEl.addEventListener("dragend",function(){rEl.style.opacity="1";});

      innerWorld.appendChild(rEl);
    });

    canvasWrap.appendChild(innerWorld);

    // Section line overlay
    var sectionSvg=document.createElementNS(svgNS,"svg");
    sectionSvg.setAttribute("width",SS_CANVAS_PX);sectionSvg.setAttribute("height",SS_CANVAS_PX);
    sectionSvg.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15";
    canvasWrap.appendChild(sectionSvg);

    function drawSectionLine(){
      sectionSvg.innerHTML="";
      if(!bs.sectionLine) return;
      var sl=bs.sectionLine;
      var x1=sl.x1*lz+bs.levelPan[li][0], y1=sl.y1*lz+bs.levelPan[li][1];
      var x2=sl.x2*lz+bs.levelPan[li][0], y2=sl.y2*lz+bs.levelPan[li][1];
      var ln=document.createElementNS(svgNS,"line");
      ln.setAttribute("x1",x1);ln.setAttribute("y1",y1);ln.setAttribute("x2",x2);ln.setAttribute("y2",y2);
      ln.setAttribute("stroke","#C0392B");ln.setAttribute("stroke-width","2.5");ln.setAttribute("stroke-dasharray","8,4");
      sectionSvg.appendChild(ln);
      var dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||1;
      var pux=-(dy/len), puy=dx/len;
      [[x1,y1],[x2,y2]].forEach(function(pt){
        var tk=document.createElementNS(svgNS,"line");
        tk.setAttribute("x1",pt[0]);tk.setAttribute("y1",pt[1]);
        tk.setAttribute("x2",pt[0]+pux*10);tk.setAttribute("y2",pt[1]+puy*10);
        tk.setAttribute("stroke","#C0392B");tk.setAttribute("stroke-width","2.5");
        sectionSvg.appendChild(tk);
      });
      [[x1,y1],[x2,y2]].forEach(function(pt){
        var dot=document.createElementNS(svgNS,"circle");
        dot.setAttribute("cx",pt[0]);dot.setAttribute("cy",pt[1]);dot.setAttribute("r","3.5");
        dot.setAttribute("fill","#C0392B");
        sectionSvg.appendChild(dot);
      });
    }
    drawSectionLine();

    // Section line drawing
    var sectionDrawing=false, sdStartX=0, sdStartY=0;
    canvasWrap.addEventListener("mousedown",function(e){
      if(!SS._sectionDrawMode) return;
      var cr=canvasWrap.getBoundingClientRect();
      sdStartX=(e.clientX-cr.left-bs.levelPan[li][0])/lz;
      sdStartY=(e.clientY-cr.top-bs.levelPan[li][1])/lz;
      sectionDrawing=true;
      e.preventDefault();e.stopPropagation();
    });
    document.addEventListener("mousemove",function(e){
      if(!sectionDrawing) return;
      var cr=canvasWrap.getBoundingClientRect();
      var rawX=(e.clientX-cr.left-bs.levelPan[li][0])/lz;
      var rawY=(e.clientY-cr.top-bs.levelPan[li][1])/lz;
      var ddx=rawX-sdStartX, ddy=rawY-sdStartY;
      var dist=Math.sqrt(ddx*ddx+ddy*ddy);
      var angle=Math.atan2(ddy,ddx);
      var snapAngle=Math.round(angle/(Math.PI/4))*(Math.PI/4);
      bs.sectionLine={x1:sdStartX,y1:sdStartY,
        x2:sdStartX+Math.cos(snapAngle)*dist,
        y2:sdStartY+Math.sin(snapAngle)*dist};
      drawSectionLine();
    });
    document.addEventListener("mouseup",function(){
      if(!sectionDrawing) return;
      sectionDrawing=false;
      SS._sectionDrawMode=false;
      buildBuildingPanel(container);
    });

    // Pan
    var canvasPanning=false,cpsx=0,cpsy=0,cpox=0,cpoy=0;
    canvasWrap.addEventListener("mousedown",function(e){
      if(SS._sectionDrawMode) return;
      if(e.target!==canvasWrap&&e.target!==innerWorld&&e.target.tagName!=="svg"&&e.target.tagName!=="line"&&e.target.tagName!=="rect"&&e.target.tagName!=="polygon"&&e.target.tagName!=="polyline"&&e.target.tagName!=="path"&&e.target.tagName!=="text") return;
      canvasPanning=true;cpsx=e.clientX;cpsy=e.clientY;
      cpox=bs.levelPan[li][0];cpoy=bs.levelPan[li][1];
      canvasWrap.style.cursor="grabbing";e.preventDefault();
    });
    document.addEventListener("mousemove",function(e){
      if(!canvasPanning)return;
      var vw=canvasWrap.clientWidth||SS_CANVAS_PX;
      var minPanX=Math.min(0,vw-scaledCanvas);
      var minPanY=Math.min(0,SS_CANVAS_PX-scaledCanvas);
      bs.levelPan[li][0]=Math.max(minPanX,Math.min(0,cpox+(e.clientX-cpsx)));
      bs.levelPan[li][1]=Math.max(minPanY,Math.min(0,cpoy+(e.clientY-cpsy)));
      innerWorld.style.left=bs.levelPan[li][0]+"px";
      innerWorld.style.top=bs.levelPan[li][1]+"px";
      drawSectionLine();
    });
    document.addEventListener("mouseup",function(){if(canvasPanning){canvasPanning=false;canvasWrap.style.cursor=SS._sectionDrawMode?"copy":"crosshair";}});
    canvasWrap.style.cursor=SS._sectionDrawMode?"copy":"crosshair";
    canvasWrap.addEventListener("wheel",function(e){
      e.preventDefault();e.stopPropagation();
      var newZ=Math.max(0.05,Math.min(4.0,(bs.levelZoom[li]||ssFitZoom(bdef))*(e.deltaY<0?1.15:1/1.15)));
      bs.levelZoom[li]=Math.round(newZ*100)/100;
      bs.levelPan[li]=[0,0];
      buildBuildingPanel(container);
    },{passive:false});

    // Drop target
    canvasWrap.addEventListener("dragover",function(e){
      e.preventDefault();e.dataTransfer.dropEffect="move";
      canvasWrap.style.background="#ecf4f6";
    });
    canvasWrap.addEventListener("dragleave",function(){
      canvasWrap.style.background="#fff";
    });
    canvasWrap.addEventListener("drop",function(e){
      e.preventDefault();
      canvasWrap.style.background="#fff";
      var raw=e.dataTransfer.getData("text/plain"),data;
      try{data=JSON.parse(raw);}catch(ex){return;}
      if(!data||!data.id) return;
      var cRect=canvasWrap.getBoundingClientRect();
      var curPanX=bs.levelPan[li][0],curPanY=bs.levelPan[li][1];

      var dropMask=ssFloorMask(ssPlanKey(lvlDef.plan), lvlDef.avail_sf);
      if(!dropMask){ return; }
      if(dropMask.freeCount<=0){ alert("No usable (white / colored) area on "+lvlDef.label+" — grey area can't hold program."); return; }
      var seed=ssDropSeed(e, cRect, curPanX, curPanY, lz, ssPlanKey(lvlDef.plan), worldPx0);
      if(data.isBuildingMove){
        var srcB=ssScenario().buildings[data.fromBuilding];
        if(!srcB) return;
        var srcItems=srcB.levels[data.fromLevel];
        var srcIdx=srcItems.findIndex(function(it){return it.id===data.id;});
        if(srcIdx<0) return;
        if(data.fromBuilding===SS.activeBuilding && data.fromLevel===li){
          srcItems[srcIdx].su=seed.su; srcItems[srcIdx].sv=seed.sv;
        } else {
          var moved=srcItems.splice(srcIdx,1)[0];
          moved.su=seed.su; moved.sv=seed.sv;
          items.push(moved);
        }
      } else if(data.isBlock){
        if(ssIsAssigned(data.id)) return;
        items.push({
          id:data.id, catId:data.catId, factor:data.factor,
          su:seed.su, sv:seed.sv,
          roomHeight:SS_BLOCK_HT
        });
      } else return;

      var pp=document.getElementById("ss-prog-panel");if(pp)buildBlocksPanel(pp);
      buildBuildingPanel(container);
      var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
    });

    card.appendChild(canvasWrap);

    // Footer
    var footer=el("div",{style:"padding:6px 8px;border-top:1px solid var(--line);background:#fafbfc;display:flex;flex-direction:column;gap:2px"});
    var fRow=el("div",{style:"display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap"});
    fRow.appendChild(el("span",{style:"font-weight:900;font-size:12px;color:var(--accent)"},[lvlDef.label]));
    var zoomBar=el("div",{style:"display:flex;align-items:center;gap:3px"});
    var makeZBtn=function(lbl,mult){
      return el("button",{
        style:"width:18px;height:16px;font-size:11px;border:1px solid var(--line2);background:#fff;cursor:pointer;padding:0;line-height:1;color:var(--ink)",
        onclick:function(e){
          e.stopPropagation();
          bs.levelZoom[li]=Math.round(Math.max(0.05,Math.min(4.0,(bs.levelZoom[li]||ssFitZoom(bdef))*mult))*100)/100;
          bs.levelPan[li]=[0,0];
          buildBuildingPanel(container);
        }
      },[lbl]);
    };
    zoomBar.appendChild(makeZBtn("−",1/1.25));
    zoomBar.appendChild(el("span",{style:"font-size:10px;min-width:30px;text-align:center;color:var(--mut)"},[Math.round((bs.levelZoom[li]||1)*100)+"%"]));
    zoomBar.appendChild(makeZBtn("+",1.25));
    fRow.appendChild(zoomBar);
    // Level datum height (ft) — for the section view
    var htWrap=el("span",{style:"display:flex;align-items:center;gap:3px;font-size:10px;color:var(--mut)"});
    htWrap.appendChild(el("span",null,["HT"]));
    var htInp=el("input",{type:"text",value:String(bs.levelHeights[li]||0),title:"Level datum height (ft) — used by the section view",
      style:"width:32px;font-size:10px;border:1px solid var(--line2);padding:1px 3px;text-align:center"});
    htInp.addEventListener("change",function(){
      var v=parseFloat(htInp.value.replace(/[^0-9.\-]/g,""));
      bs.levelHeights[li]=isNaN(v)?0:v;
      buildSectionView(container, bdef, bs);
    });
    htWrap.appendChild(htInp);
    htWrap.appendChild(el("span",null,["′"]));
    fRow.appendChild(htWrap);
    fRow.appendChild(el("span",{style:"font-size:10px;color:var(--mut)"},[fmt(floorSFRounded(lvlDef.units2))+" GSF plate"]));
    footer.appendChild(fRow);

    var avail=lvlMask?lvlMask.freeCount*lvlMask.cellSF:null;

    // Available Area input (levels with an avail_sf setting, e.g. Stilts L3)
    if(lvlDef.avail_sf!==undefined){
      var aRow=el("div",{style:"display:flex;align-items:center;gap:5px;font-size:10px;color:var(--ink)"});
      aRow.appendChild(el("span",{style:"font-weight:800"},["Available Area"]));
      var aInp=el("input",{type:"text",value:String(lvlDef.avail_sf),
        title:"Placeable (white) area above the divider line, in SF — the line moves to match",
        style:"width:58px;font-size:10px;font-weight:700;border:1px solid var(--line2);padding:1px 4px;text-align:center;font-family:inherit"});
      aInp.addEventListener("change",function(){
        var v=parseFloat(aInp.value.replace(/[^0-9.]/g,""));
        lvlDef.avail_sf=(isNaN(v)||v<0)?0:Math.round(v);
        buildBuildingPanel(container);
        var pp=document.getElementById("ss-prog-panel");if(pp)buildBlocksPanel(pp);
        var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
      });
      aInp.addEventListener("mousedown",function(e){e.stopPropagation();});
      aRow.appendChild(aInp);
      aRow.appendChild(el("span",{style:"color:var(--mut)"},["SF · white area above the line"]));
      footer.appendChild(aRow);
    }

    if(!lvlMask){
      footer.appendChild(el("div",{style:"font-size:10px;color:var(--faint)"},["Rasterizing floor plan…"]));
    } else if(lvlGSF>0){
      var pctFill=avail>0?lvlGSF/avail:(lvlGSF>0?2:0);
      var pctColor=pctFill>1?"#C0392B":(pctFill>0.9?"#E67E22":"#2E7D32");
      var sRow=el("div",{style:"display:flex;gap:10px;align-items:center;flex-wrap:wrap"});
      sRow.appendChild(el("span",{style:"font-size:10px;font-weight:700;color:var(--ink)"},[fmt(lvlGSF)+" GSF placed"]));
      sRow.appendChild(el("span",{style:"font-size:10px;color:"+pctColor+";font-weight:800"},[(pctFill*100).toFixed(0)+"% of "+fmt(avail)+" SF usable"+(pctFill>1?" — OVERFLOW":"")]));
      footer.appendChild(sRow);
    } else {
      footer.appendChild(el("div",{style:"font-size:10px;color:var(--faint)"},["Drop program blocks here · "+fmt(avail)+" SF usable (grey = unusable)"]));
    }
    card.appendChild(footer);
    levelsRow.appendChild(card);
  });

  container.appendChild(levelsRow);

  // Building total
  var bTot=ssPlacedGSFForBuilding(bdef.id);
  var bCap=0, capReady=true;
  bdef.floors.forEach(function(f2){
    var m2=ssFloorMask(ssPlanKey(f2.plan), f2.avail_sf);
    if(m2) bCap+=m2.freeCount*m2.cellSF; else capReady=false;
  });
  container.appendChild(el("div",{class:"hint",style:"margin-top:8px"},
    [bdef.name+": "+fmt(bTot)+" GSF placed of "+(capReady?fmt(bCap):"…")+" SF usable area"+(capReady&&bCap>0?" ("+(bTot/bCap*100).toFixed(0)+"%)":"")+". Grey areas are unusable; usable area measured from the floor plan SVGs at the Project Assumptions scale."]));
  buildSectionView(container, bdef, bs);
}

// ── Section View: cross-section through all levels at the drawn line ──
function buildSectionView(container, bdef, bs){
  var existing=document.getElementById("ss-section-view");
  if(existing) existing.remove();
  if(!bs || !bs.sectionLine) return;

  var sl=bs.sectionLine;
  var dx=sl.x2-sl.x1, dy=sl.y2-sl.y1;
  var lineLenPx=Math.sqrt(dx*dx+dy*dy);
  if(lineLenPx<2) return;
  var lineLenFt=lineLenPx/SS_GRID_PX_PER_FT;
  var svgNS="http://www.w3.org/2000/svg";

  var gridFtSec=ssGridFt(bdef);
  var worldPx0Sec=gridFtSec*SS_GRID_PX_PER_FT;
  var levelData=bdef.floors.map(function(lvlDef,li){
    var fills=ssComputeFills(bdef, bs, li);
    var key=ssPlanKey(lvlDef.plan);
    var fp=FLOOR_SVGS[key];
    var pxPerU=ssFtPerUnit()*SS_GRID_PX_PER_FT;
    var fox=fp?(worldPx0Sec-fp.vb[2]*pxPerU)/2:0;
    var foy=fp?(worldPx0Sec-fp.vb[3]*pxPerU)/2:0;
    var cellPx=SS_MASK_FT*SS_GRID_PX_PER_FT;
    var hits=[];
    fills.forEach(function(f){
      if(!f.runs||!f.runs.length) return;
      var ints=[];
      f.runs.forEach(function(rn){
        var rx1=fox+rn.x0*cellPx, ry1=foy+rn.y*cellPx;
        var rx2=fox+(rn.x1+1)*cellPx, ry2=foy+(rn.y+1)*cellPx;
        var t0=0, t1=1;
        var p=[-(dx), dx, -(dy), dy];
        var q=[sl.x1-rx1, rx2-sl.x1, sl.y1-ry1, ry2-sl.y1];
        var rejected=false;
        for(var i=0;i<4;i++){
          if(p[i]===0){ if(q[i]<0){rejected=true;break;} }
          else {
            var r=q[i]/p[i];
            if(p[i]<0){ if(r>t1){rejected=true;break;} if(r>t0)t0=r; }
            else { if(r<t0){rejected=true;break;} if(r<t1)t1=r; }
          }
        }
        if(!rejected && t0<t1) ints.push([t0,t1]);
      });
      if(!ints.length) return;
      // Merge the per-run intervals into continuous cut segments
      ints.sort(function(a,b){return a[0]-b[0];});
      var eps=(cellPx*0.5)/lineLenPx;
      var merged=[ints[0].slice()];
      for(var mi=1;mi<ints.length;mi++){
        var last=merged[merged.length-1];
        if(ints[mi][0]<=last[1]+eps) last[1]=Math.max(last[1],ints[mi][1]);
        else merged.push(ints[mi].slice());
      }
      merged.forEach(function(iv){
        hits.push({
          item:f.item, gsf:f.gsf,
          startFt:(iv[0]*lineLenPx)/SS_GRID_PX_PER_FT,
          endFt:(iv[1]*lineLenPx)/SS_GRID_PX_PER_FT
        });
      });
    });
    return hits;
  });

  var anyHits=levelData.some(function(h){return h.length>0;});

  var sectionPanel=el("div",{id:"ss-section-view",class:"box",style:"margin-top:12px;padding:14px"});
  var hdrRow=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:6px"});
  hdrRow.appendChild(el("h3",{style:"margin:0"},["Section — "+bdef.name]));
  hdrRow.appendChild(el("div",{class:"hint",style:"margin:0;flex:1"},
    ["Cut line length: "+Math.round(lineLenFt)+"′ · Looking in direction of tick marks · set level datums with the HT fields"]));
  sectionPanel.appendChild(hdrRow);

  if(!anyHits){
    sectionPanel.appendChild(el("div",{style:"color:var(--faint);font-size:12px;padding:16px;text-align:center"},
      ["Section line doesn't cross any placed blocks on any level."]));
    container.parentElement.insertBefore(sectionPanel, container.nextSibling);
    return;
  }

  var pxPerFtX=3.0, pxPerFtY=3.0;
  var topHt=0;
  bdef.floors.forEach(function(lvlDef,li){
    var lh=bs.levelHeights[li]||0;
    var tallest=(bs.levels[li]||[]).reduce(function(m,it){return Math.max(m,it.roomHeight||SS_BLOCK_HT);},SS_BLOCK_HT);
    topHt=Math.max(topHt, lh+tallest);
  });
  var maxHeight=Math.max(30, Math.ceil((topHt+5)/10)*10);
  var svgW=Math.max(200, lineLenFt*pxPerFtX+90);
  var svgH=maxHeight*pxPerFtY+50;

  var svg=document.createElementNS(svgNS,"svg");
  svg.setAttribute("width",svgW);svg.setAttribute("height",svgH);
  svg.style.cssText="background:#fafbfc;border:1px solid var(--line);display:block";

  function fx(ft){ return 50+ft*pxPerFtX; }
  function fy(ft){ return svgH-20-ft*pxPerFtY; }

  var ground=document.createElementNS(svgNS,"line");
  ground.setAttribute("x1",fx(0));ground.setAttribute("y1",fy(0));
  ground.setAttribute("x2",fx(lineLenFt));ground.setAttribute("y2",fy(0));
  ground.setAttribute("stroke","#233044");ground.setAttribute("stroke-width","2");
  svg.appendChild(ground);

  for(var hft=0; hft<=maxHeight; hft+=10){
    var ty=fy(hft);
    var tickLine=document.createElementNS(svgNS,"line");
    tickLine.setAttribute("x1",fx(0)-5);tickLine.setAttribute("y1",ty);
    tickLine.setAttribute("x2",fx(0));tickLine.setAttribute("y2",ty);
    tickLine.setAttribute("stroke","#999");tickLine.setAttribute("stroke-width","1");
    svg.appendChild(tickLine);
    var tickLbl=document.createElementNS(svgNS,"text");
    tickLbl.setAttribute("x",fx(0)-8);tickLbl.setAttribute("y",ty+3);
    tickLbl.setAttribute("font-size","9");tickLbl.setAttribute("fill","#999");tickLbl.setAttribute("text-anchor","end");
    tickLbl.textContent=hft;
    svg.appendChild(tickLbl);
  }

  levelData.forEach(function(hits,li){
    var lh=bs.levelHeights[li]||0;
    var datumLn=document.createElementNS(svgNS,"line");
    datumLn.setAttribute("x1",fx(0));datumLn.setAttribute("y1",fy(lh));
    datumLn.setAttribute("x2",fx(lineLenFt));datumLn.setAttribute("y2",fy(lh));
    datumLn.setAttribute("stroke","#bbb");datumLn.setAttribute("stroke-width","1");datumLn.setAttribute("stroke-dasharray","3,3");
    svg.appendChild(datumLn);
    var datumLbl=document.createElementNS(svgNS,"text");
    datumLbl.setAttribute("x",fx(lineLenFt)+4);datumLbl.setAttribute("y",fy(lh)+3);
    datumLbl.setAttribute("font-size","9");datumLbl.setAttribute("fill","#8494ab");datumLbl.setAttribute("font-weight","700");
    datumLbl.textContent=bdef.floors[li].label.replace("Level ","L")+" @ "+lh+"′";
    svg.appendChild(datumLbl);

    hits.forEach(function(h){
      var cat=ssCat(h.item.catId);
      var roomH=h.item.roomHeight||SS_BLOCK_HT;
      var x1=fx(h.startFt), x2=fx(h.endFt);
      var y1=fy(lh+roomH), y2=fy(lh);
      var rect=document.createElementNS(svgNS,"rect");
      rect.setAttribute("x",Math.min(x1,x2));rect.setAttribute("y",y1);
      rect.setAttribute("width",Math.max(1,Math.abs(x2-x1)));rect.setAttribute("height",Math.max(1,y2-y1));
      rect.setAttribute("fill",(cat?cat.color:"#ccc"));
      rect.setAttribute("stroke","rgba(0,0,0,0.35)");rect.setAttribute("stroke-width","1");
      var title=document.createElementNS(svgNS,"title");
      title.textContent=(cat?cat.name:h.item.catId)+" × "+h.item.factor+" — "+fmt(h.gsf)+" GSF";
      rect.appendChild(title);
      svg.appendChild(rect);
      if(Math.abs(x2-x1)>40){
        var lbl=document.createElementNS(svgNS,"text");
        lbl.setAttribute("x",(x1+x2)/2);lbl.setAttribute("y",(y1+y2)/2+3);
        lbl.setAttribute("font-size","8");lbl.setAttribute("fill","#233044");lbl.setAttribute("text-anchor","middle");
        lbl.textContent=(cat?cat.name:h.item.catId)+" ×"+h.item.factor;
        svg.appendChild(lbl);
      }
    });
  });

  var xLbl=document.createElementNS(svgNS,"text");
  xLbl.setAttribute("x",fx(lineLenFt/2));xLbl.setAttribute("y",svgH-4);
  xLbl.setAttribute("font-size","10");
  xLbl.setAttribute("fill","#8494ab");xLbl.setAttribute("text-anchor","middle");xLbl.setAttribute("font-weight","700");
  xLbl.textContent=Math.round(lineLenFt)+"′ section length";
  svg.appendChild(xLbl);

  var svgWrap=el("div",{style:"overflow-x:auto"});
  svgWrap.appendChild(svg);
  sectionPanel.appendChild(svgWrap);

  container.parentElement.insertBefore(sectionPanel, container.nextSibling);
}

// ====================================================================
// SITE MAP PANEL
// ====================================================================
function buildSitePanel(container){
  container.innerHTML="";

  var hdr=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap"});
  hdr.appendChild(el("h3",{style:"margin:0"},["Site — "+ssScenario().name]));
  hdr.appendChild(el("span",{class:"hint",style:"margin:0"},["Click a highlighted building to open its levels · drag to pan · scroll to zoom"]));
  var zr=el("div",{style:"margin-left:auto;display:flex;gap:4px;align-items:center"});
  [["＋",1.25],["－",1/1.25]].forEach(function(z){
    zr.appendChild(el("button",{style:"padding:2px 8px;border:1px solid var(--line2);background:#fff;cursor:pointer;font-size:13px",
      onclick:function(){SS_ZOOM=Math.max(0.4,Math.min(5,SS_ZOOM*z[1]));buildSitePanel(container);}},[z[0]]));
  });
  zr.appendChild(el("span",{style:"font-size:11px;min-width:36px;text-align:center;color:var(--mut)"},[Math.round(SS_ZOOM*100)+"%"]));
  zr.appendChild(el("button",{style:"padding:2px 8px;border:1px solid var(--line2);background:#fff;cursor:pointer;font-size:11px",
    onclick:function(){SS_ZOOM=1;SS_PAN_X=0;SS_PAN_Y=0;buildSitePanel(container);}},["Reset"]));
  hdr.appendChild(zr);
  container.appendChild(hdr);

  var viewport=el("div",{id:"ss-site-viewport",
    style:"position:relative;overflow:hidden;border:1px solid var(--line);background:#f4f6f9;width:100%;height:480px;cursor:grab"});
  var pxPerU=ssFtPerUnit()*SITE_PX_PER_FT*SS_ZOOM;
  var worldW=Math.round(SITE_VB[2]*pxPerU);
  var worldH=Math.round(SITE_VB[3]*pxPerU);
  var world=el("div",{id:"ss-site-world",
    style:"position:absolute;top:"+SS_PAN_Y+"px;left:"+SS_PAN_X+"px;width:"+worldW+"px;height:"+worldH+"px"});

  var vbStr=SITE_VB.join(" ");
  var siteMapDiv=document.createElement("div");
  siteMapDiv.style.cssText="position:absolute;top:0;left:0;width:"+worldW+"px;height:"+worldH+"px;pointer-events:none;";
  siteMapDiv.innerHTML=SITE_SVG_INLINE;
  var embSvg=siteMapDiv.querySelector("svg");
  if(embSvg){
    embSvg.setAttribute("viewBox",vbStr);
    embSvg.setAttribute("preserveAspectRatio","xMidYMid slice");
    embSvg.style.width=worldW+"px";
    embSvg.style.height=worldH+"px";
    embSvg.style.position="absolute";
    embSvg.style.top="0";embSvg.style.left="0";
  }
  world.appendChild(siteMapDiv);

  // Overlay: key building highlights + labels + scale bar
  var svgNS="http://www.w3.org/2000/svg";
  var overlaysvg=document.createElementNS(svgNS,"svg");
  overlaysvg.setAttribute("width",worldW);overlaysvg.setAttribute("height",worldH);
  overlaysvg.setAttribute("viewBox",vbStr);
  overlaysvg.style.cssText="position:absolute;top:0;left:0;pointer-events:none;";
  S.buildings.forEach(function(b,bi){
    var meta=SS_SITE_META[b.id];
    if(!meta) return;
    var active=(bi===SS.activeBuilding);
    var poly=document.createElementNS(svgNS,"polygon");
    poly.setAttribute("points",meta.footprint);
    poly.setAttribute("fill",meta.color);
    poly.setAttribute("fill-opacity",active?"0.8":"0.45");
    poly.setAttribute("stroke",active?"#233044":darkenColor(meta.color,0.4));
    poly.setAttribute("stroke-width",active?"4":"1.5");
    poly.style.pointerEvents="auto";
    poly.style.cursor="pointer";
    poly.addEventListener("click",function(){
      SS.activeBuilding=bi;
      var bp=document.getElementById("ss-bldg-panel");if(bp)buildBuildingPanel(bp);
      buildSitePanel(container);
    });
    poly.appendChild((function(){var t=document.createElementNS(svgNS,"title");t.textContent=b.name;return t;})());
    overlaysvg.appendChild(poly);

    var placed=ssPlacedGSFForBuilding(b.id);
    var lx=meta.label[0], ly=meta.label[1];
    var mkText=function(txt, dyv, size, weight){
      var t=document.createElementNS(svgNS,"text");
      t.setAttribute("x",lx);t.setAttribute("y",ly+dyv);
      t.setAttribute("font-size",size);t.setAttribute("font-weight",weight);
      t.setAttribute("text-anchor","middle");t.setAttribute("fill","#233044");
      t.setAttribute("stroke","#FFFFFF");t.setAttribute("stroke-width","5");
      t.setAttribute("paint-order","stroke");
      t.setAttribute("font-family","Archivo, Roboto, Arial, sans-serif");
      t.textContent=txt;
      return t;
    };
    overlaysvg.appendChild(mkText(b.name, 0, 30, 800));
    overlaysvg.appendChild(mkText(placed>0 ? fmt(placed)+" GSF placed" : b.floors.length+" levels", 30, 22, 600));
  });

  // Scale bar (200 ft) — at the Project Assumptions drawing scale
  var barFt=200, barU=barFt/ssFtPerUnit();
  var sbX=SITE_VB[0]+SITE_VB[2]-barU-40, sbY=SITE_VB[1]+SITE_VB[3]-42;
  var sbBg=document.createElementNS(svgNS,"rect");
  sbBg.setAttribute("x",sbX-12);sbBg.setAttribute("y",sbY-30);
  sbBg.setAttribute("width",barU+24);sbBg.setAttribute("height",48);
  sbBg.setAttribute("fill","rgba(255,255,255,0.8)");sbBg.setAttribute("rx","5");
  overlaysvg.appendChild(sbBg);
  var sb=document.createElementNS(svgNS,"line");
  sb.setAttribute("x1",sbX);sb.setAttribute("y1",sbY);sb.setAttribute("x2",sbX+barU);sb.setAttribute("y2",sbY);
  sb.setAttribute("stroke","#333");sb.setAttribute("stroke-width","3");overlaysvg.appendChild(sb);
  [sbX,sbX+barU].forEach(function(tx){
    var tk=document.createElementNS(svgNS,"line");
    tk.setAttribute("x1",tx);tk.setAttribute("y1",sbY-7);tk.setAttribute("x2",tx);tk.setAttribute("y2",sbY+7);
    tk.setAttribute("stroke","#333");tk.setAttribute("stroke-width","2.5");overlaysvg.appendChild(tk);
  });
  var st=document.createElementNS(svgNS,"text");
  st.setAttribute("x",sbX+barU/2);st.setAttribute("y",sbY-10);st.setAttribute("font-size","18");
  st.setAttribute("fill","#333");st.setAttribute("text-anchor","middle");st.setAttribute("font-weight","600");
  st.setAttribute("font-family","Archivo, Roboto, Arial, sans-serif");
  st.textContent=barFt+"′";overlaysvg.appendChild(st);
  world.appendChild(overlaysvg);

  // Pan / zoom
  var panDrag=false,psx=0,psy=0,ppx=0,ppy=0;
  viewport.addEventListener("mousedown",function(e){
    if(e.target.tagName==="BUTTON"||e.target.tagName==="polygon")return;
    panDrag=true;psx=e.clientX;psy=e.clientY;ppx=SS_PAN_X;ppy=SS_PAN_Y;viewport.style.cursor="grabbing";
  });
  document.addEventListener("mousemove",function(e){
    if(!panDrag)return;
    SS_PAN_X=ppx+(e.clientX-psx);SS_PAN_Y=ppy+(e.clientY-psy);
    world.style.left=SS_PAN_X+"px";world.style.top=SS_PAN_Y+"px";
  });
  document.addEventListener("mouseup",function(){if(panDrag){panDrag=false;viewport.style.cursor="grab";}});
  viewport.addEventListener("wheel",function(e){
    e.preventDefault();SS_ZOOM=Math.max(0.4,Math.min(5,SS_ZOOM*(e.deltaY<0?1.1:0.91)));buildSitePanel(container);
  },{passive:false});

  viewport.appendChild(world);
  container.appendChild(viewport);
  container.appendChild(el("div",{class:"hint",style:"margin-top:6px"},["Site plan: Burlington campus vector plan (C. Booth, 2026-07-22) · scale bar = 200 ft at the Project Assumptions drawing scale · highlighted footprints are the three key buildings"]));
}

// ====================================================================
// PDF / JSON export
// ====================================================================
function ssPrintBuildings(){
  var bp=document.getElementById("ss-bldg-panel");
  if(!bp){alert("Navigate to the Site Scenarios tab first.");return;}
  var pw=window.open("","_blank","width=1200,height=900");
  if(!pw){alert("Pop-up blocked — please allow pop-ups.");return;}
  var saved=SS.activeBuilding;
  var blocks=[];
  S.buildings.forEach(function(b,bi){
    SS.activeBuilding=bi;
    buildBuildingPanel(bp);
    var secEl=document.getElementById("ss-section-view");
    var secHtml=secEl?secEl.outerHTML:"";
    blocks.push('<div class="bldg-block"><h2>'+escHtml(b.name)+'</h2>'+bp.innerHTML+secHtml+'</div>');
  });
  SS.activeBuilding=saved;
  buildBuildingPanel(bp);
  pw.document.write(
    '<html><head><title>'+escHtml(ssScenario().name)+' — Key Building Layouts</title>'+
    '<style>body{margin:0;padding:16px;font-family:Roboto,Arial,sans-serif;background:#fff;color:#233044}'+
    ':root{--line:#e2e6ec;--line2:#ccd2dc;--ink:#233044;--mut:#54637d;--faint:#8494ab;--accent:#1266cc;--card:#fff}'+
    'h1{font-size:18px;font-weight:800;margin:0 0 10px}h2{font-size:14px;font-weight:800;margin:14px 0 6px}h3{font-size:13px;font-weight:800;margin:0 0 4px}'+
    '.bldg-block{page-break-inside:avoid;margin-bottom:18px;border-top:1px solid #ddd;padding-top:8px}'+
    '.hint{font-size:10px;color:#8494ab}'+
    'button,label{display:none !important}'+
    '.note{font-size:10px;color:#888;margin-top:6px}'+
    '@media print{@page{size:landscape A3;margin:10mm}}</style></head>'+
    '<body><h1>'+escHtml(ssScenario().name)+' — Key Building Layouts | Lahey HMC Burlington</h1>'+
    blocks.join("")+
    '<div class="note">Exported from '+escHtml(S.project.name)+' · '+new Date().toLocaleDateString()+' · Floor plates measured at the Project Assumptions scale</div>'+
    '<script>window.onload=function(){window.print();};<\/script>'+
    '</body></html>'
  );
  pw.document.close();
}

function ssExportScenarios(){
  var data={
    _type:"LaheyHMC_Scenarios",
    _version:"1.0",
    _exported:new Date().toISOString(),
    _program_version:S.project.version,
    scenarios:SS.scenarios
  };
  var str=JSON.stringify(data,null,2);
  var blob=new Blob([str],{type:"application/json"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download="LaheyHMC_Scenarios_"+ssScenario().name.replace(/[^A-Za-z0-9]/g,"_")+".json";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ssImportScenarios(evt){
  var file=evt.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data._type||data._type!=="LaheyHMC_Scenarios"||!Array.isArray(data.scenarios)){
        alert("This doesn't look like a Lahey HMC Scenarios file.");return;
      }
      var catIds=new Set(S.program.map(function(c){return c.id;}));
      var orphaned=[];
      data.scenarios.forEach(function(sc){
        (sc.blocks||[]).forEach(function(b){
          if(!catIds.has(b.catId)&&orphaned.indexOf(b.catId)<0) orphaned.push(b.catId);
        });
      });
      var msg="Loaded "+data.scenarios.length+" scenario(s) from "+
              (data._exported?data._exported.slice(0,10):"unknown date")+
              " (program "+data._program_version+").";
      if(orphaned.length){
        msg+="\n\n⚠ Block categories not in current program: "+orphaned.join(", ");
      }
      if(confirm(msg+"\n\nReplace current scenarios?")){
        SS.scenarios=data.scenarios.map(ssNormalizeScenario);
        SS.activeScenario=0;SS.activeBuilding=0;
        renderSiteTab();
      }
    }catch(err){alert("JSON parse error: "+err.message);}
  };
  reader.readAsText(file);
  evt.target.value="";
}

function ssPrintSiteMap(){
  var site=document.getElementById("ss-site-viewport");
  if(!site){alert("Navigate to the Site Scenarios tab first.");return;}
  var pw=window.open("","_blank","width=1100,height=800");
  if(!pw){alert("Pop-up blocked — please allow pop-ups for this page.");return;}
  pw.document.write(
    '<html><head><title>'+escHtml(ssScenario().name)+' — Site Map</title>'+
    '<style>body{margin:0;padding:16px;font-family:Roboto,Arial,sans-serif;background:#fff}'+
    ':root{--line:#e2e6ec;--line2:#ccd2dc}'+
    'h2{font-size:16px;font-weight:800;color:#233044;margin:0 0 8px}'+
    '.note{font-size:10px;color:#888;margin-top:6px}'+
    '@media print{@page{size:landscape A3;margin:10mm}}</style></head>'+
    '<body><h2>'+escHtml(ssScenario().name)+' — Site Map | Lahey HMC Burlington</h2>'+
    site.outerHTML+
    '<div class="note">'+escHtml(S.project.name)+' · Exported '+new Date().toLocaleDateString()+'</div>'+
    '<script>window.onload=function(){window.print();};<\/script></body></html>'
  );
  pw.document.close();
}
