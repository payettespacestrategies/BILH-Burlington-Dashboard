// ====================================================================
// SITE SCENARIOS TAB — BILH Burlington
// Drag / drop program rooms onto the floor levels of the three key
// buildings (Stilts · 31 Mall Road · 67 South Bedford), with the
// campus site plan alongside. Adapted from the RUSM dashboard.
// ====================================================================

// ── Constants ───────────────────────────────────────────────────────────
var SS_GRID_DIV       = 50;    // dashed grid interval in feet
var SS_CANVAS_PX      = 300;   // level canvas viewport pixel size (fixed)
var SS_GRID_PX_PER_FT = 2.0;   // logical px per foot at zoom=1

// Site map display
var SITE_VB        = [455, 305, 1560, 1105];   // crop of the site svg (svg units)
var SITE_FT_PER_U  = 100/57.72;                // site svg: 57.72 units = 100 ft
var SITE_PX_PER_FT = 0.32;                     // world px per foot at zoom=1
var SS_ZOOM=1.0, SS_PAN_X=0, SS_PAN_Y=0;

function ssPxPerFt(){ return SS_GRID_PX_PER_FT; }
function ssNG(){ return (S.settings && S.settings.n_g_ratio) || 0.65; }

// Fit-to-viewport default zoom for a building's level canvases
function ssFitZoom(bdef){
  var z = SS_CANVAS_PX / (bdef.gridFt * SS_GRID_PX_PER_FT);
  return Math.max(0.1, Math.round(z*100)/100);
}

// ── State ───────────────────────────────────────────────────────────────
function ssNewScenario(name){
  return {
    name: name,
    buildings: BLDG_REGISTRY.map(function(b){
      return {
        id: b.id,
        levels:      b.levels.map(function(){ return []; }),
        levelZoom:   b.levels.map(function(){ return ssFitZoom(b); }),
        levelPan:    b.levels.map(function(){ return [0,0]; }),
        levelHeights:b.levels.map(function(l,i){ return i*14; }),  // vertical datum (ft) per level
        sectionLine: null   // {x1,y1,x2,y2} in world px (zoom=1), or null
      };
    }),
    groups: []
  };
}
var SS = {
  activeScenario: 0,
  activeBuilding: 0,
  scenarios: [ssNewScenario("Scenario 1")],
  _drag: null
};

// Make sure a scenario (e.g. from an imported JSON) matches the registry
function ssNormalizeScenario(sc){
  if(!sc.groups) sc.groups=[];
  var byId = {};
  (sc.buildings||[]).forEach(function(bs){ byId[bs.id]=bs; });
  sc.buildings = BLDG_REGISTRY.map(function(b){
    var bs = byId[b.id] || { id:b.id, levels:[], levelZoom:[], levelPan:[] };
    var n = b.levels.length;
    bs.levels    = (bs.levels||[]).slice(0,n);    while(bs.levels.length<n)    bs.levels.push([]);
    bs.levelZoom = (bs.levelZoom||[]).slice(0,n); while(bs.levelZoom.length<n) bs.levelZoom.push(ssFitZoom(b));
    bs.levelPan  = (bs.levelPan||[]).slice(0,n);  while(bs.levelPan.length<n)  bs.levelPan.push([0,0]);
    bs.levelHeights = (bs.levelHeights||[]).slice(0,n); while(bs.levelHeights.length<n) bs.levelHeights.push(bs.levelHeights.length*14);
    if(bs.sectionLine===undefined) bs.sectionLine=null;
    return bs;
  });
  return sc;
}

function ssScenario(){ return SS.scenarios[SS.activeScenario]; }

// ── Category / room abbreviations ──────────────────────────────────────
function ssCatAbbrev(n){ return n.split(" ").map(function(w){return w[0]||"";}).join("").slice(0,3).toUpperCase(); }
function darkenColor(hex,amt){
  if(!hex||hex[0]!=='#'||hex.length<7) return "#888";
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16),f=1-amt;
  return "#"+[r,g,b].map(function(v){return Math.max(0,Math.round(v*f)).toString(16).padStart(2,"0");}).join("");
}

// Returns {bi, li} if rectId is placed in any building/level, else null
function ssAssignmentOf(rectId){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    var lvls=sc.buildings[bi].levels;
    for(var li=0;li<lvls.length;li++){
      if(lvls[li].some(function(it){return it.id===rectId;}))
        return {bi:bi,li:li};
    }
  }
  return null;
}
function ssIsAssigned(id){ return ssAssignmentOf(id)!==null; }
function ssBadgeFor(asgn){
  var b=BLDG_REGISTRY[asgn.bi];
  return b ? (b.short+"·"+b.levels[asgn.li].label) : "?";
}

// Placed NSF helpers (also used by Overview + Excel export)
function ssPlacedNSFForLevel(bldgId, li){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    if(sc.buildings[bi].id===bldgId){
      var lvl=sc.buildings[bi].levels[li]||[];
      return lvl.reduce(function(s,it){return s+(it.nsf||0);},0);
    }
  }
  return 0;
}
function ssPlacedNSFForBuilding(bldgId){
  var sc=ssScenario();
  for(var bi=0;bi<sc.buildings.length;bi++){
    if(sc.buildings[bi].id===bldgId){
      return sc.buildings[bi].levels.reduce(function(s,lvl){
        return s + lvl.reduce(function(t,it){return t+(it.nsf||0);},0);
      },0);
    }
  }
  return 0;
}

// ── Build flat program rect list from S ─────────────────────────────────
function ssBuildProgramRects(){
  var rects=[];
  var ssIdPrefixMap={};
  S.program_categories.forEach(function(cat){
    var ca=ssCatAbbrev(cat.name);
    var catName=cat.code+" "+cat.name;
    cat.rooms.forEach(function(r){
      var qty=Number(r.qty)||0,nsf=Number(r.size)||0;
      if(!qty||!nsf) return;
      var ar=parseFloat(r.aspect_ratio)||1.5; if(ar<1)ar=1;
      var SS_PROG_SCALE=2.2;
      var pw=Math.round(Math.sqrt(nsf*ar)*SS_PROG_SCALE);
      var ph=Math.round(Math.sqrt(nsf/ar)*SS_PROG_SCALE);
      var gw=Math.round(Math.sqrt(nsf*ar)*ssPxPerFt());
      var gh=Math.round(Math.sqrt(nsf/ar)*ssPxPerFt());
      var raFull=r.name.replace(/[^A-Za-z0-9]/g," ").trim().split(/\s+/).map(function(w){return w.slice(0,3).toUpperCase();}).join("").slice(0,6)||"RMX";
      var baseId=ca+"_"+raFull;
      if(!ssIdPrefixMap[baseId]) ssIdPrefixMap[baseId]=0;
      ssIdPrefixMap[baseId]++;
      var idPrefix = ssIdPrefixMap[baseId]>1 ? baseId+"_"+ssIdPrefixMap[baseId] : baseId;
      var rmColor = ficmHex(r.ficm)||cat.color||"#E3E6EC";
      for(var i=0;i<qty;i++){
        var n=String(i+1); while(n.length<3)n="0"+n;
        rects.push({
          id:idPrefix+"_"+n, name:r.name,
          catName:catName, catColor:rmColor,
          pw:pw, ph:ph,
          gw:gw, gh:gh,
          nsf:nsf, roomHeight:Number(r.room_height)||null,
          typeKey:idPrefix
        });
      }
    });
  });
  rects.sort(function(a,b){return b.nsf-a.nsf;});
  return rects;
}

// ── Main tab ──────────────────────────────────────────────────────────────
function tabSiteScenarios(){
  ssNormalizeScenario(ssScenario());
  var outer=el("div",{style:"display:flex;flex-direction:column;gap:0"});

  // Top bar
  var topBar=el("div",{style:"display:flex;align-items:center;gap:8px;padding:8px 0 10px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:10px"});
  topBar.appendChild(el("span",{style:"font-weight:800;font-size:13px;color:#1F2A44;margin-right:4px"},["Site Scenarios"]));
  SS.scenarios.forEach(function(sc,i){
    topBar.appendChild(el("button",{
      style:"padding:4px 14px;border-radius:16px;border:"+(i===SS.activeScenario?"2px solid #1F2A44;background:#1F2A44;color:#fff":"1px solid #ccd2dc;background:#fff;color:#1F2A44")+";font-size:12px;font-weight:700;cursor:pointer",
      onclick:function(){SS.activeScenario=i;SS.activeBuilding=0;renderSiteTab();}
    },[sc.name]));
  });
  topBar.appendChild(el("button",{
    style:"padding:4px 12px;border-radius:16px;border:1px dashed #aaa;background:#fff;color:#888;font-size:12px;cursor:pointer",
    onclick:function(){SS.scenarios.push(ssNewScenario("Scenario "+(SS.scenarios.length+1)));SS.activeScenario=SS.scenarios.length-1;SS.activeBuilding=0;renderSiteTab();}
  },["+ Scenario"]));
  var btnStyle="padding:5px 12px;border-radius:4px;border:1px solid var(--line2);background:#fff;font-size:12px;font-weight:700;cursor:pointer;color:#1F2A44";
  topBar.appendChild(el("div",{style:"margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"},[
    el("button",{style:btnStyle,onclick:function(){ssPrintBuildings();}},[" ⤓ Buildings PDF"]),
    el("button",{style:btnStyle,onclick:function(){ssPrintSiteMap();}},[" ⤓ Site PDF"]),
    el("button",{style:btnStyle,onclick:function(){ssExportScenarios();}},[" ⤓ Scenarios JSON"]),
    el("label",{style:btnStyle+";cursor:pointer"},[
      " ⤒ Import JSON",
      el("input",{type:"file",accept:".json",style:"display:none",
        onchange:function(e){ssImportScenarios(e);}})
    ])
  ]));
  outer.appendChild(topBar);

  // Two-column layout
  var cols=el("div",{style:"display:grid;grid-template-columns:300px 1fr;gap:10px"});
  var progPanel=el("div",{id:"ss-prog-panel",style:"background:#fff;border:1px solid var(--line);border-radius:6px;display:flex;flex-direction:column;max-height:calc(100vh - 160px)"});
  buildProgramPanel(progPanel);
  var rightCol=el("div",{style:"display:flex;flex-direction:column;gap:10px;min-width:0"});
  var bldgPanel=el("div",{id:"ss-bldg-panel",style:"background:#fff;border:1px solid var(--line);border-radius:6px;padding:10px"});
  buildBuildingPanel(bldgPanel);
  var sitePanel=el("div",{id:"ss-site-panel",style:"background:#fff;border:1px solid var(--line);border-radius:6px;padding:10px"});
  buildSitePanel(sitePanel);
  rightCol.appendChild(bldgPanel);
  rightCol.appendChild(sitePanel);
  cols.appendChild(progPanel);
  cols.appendChild(rightCol);
  outer.appendChild(cols);
  return outer;
}

function renderSiteTab(){
  var v=$("#view");v.innerHTML="";v.appendChild(tabSiteScenarios());
}

// ====================================================================
// PROGRAM PANEL (groups, rect view, list view)
// ====================================================================
function ssEnsureGroups(){
  var sc=ssScenario();
  if(!sc.groups) sc.groups=[];
  return sc.groups;
}

var SS_SELECTION = [];
var SS_PROG_VIEW = "rect";
var SS_EXPANDED_TYPES = {};

function ssIsSelected(id){ return SS_SELECTION.indexOf(id)>=0; }
function ssToggleSelect(id){
  var i=SS_SELECTION.indexOf(id);
  if(i>=0) SS_SELECTION.splice(i,1);
  else SS_SELECTION.push(id);
}
function ssClearSelection(){ SS_SELECTION=[]; }

function ssGroupOf(rectId){
  var groups=ssEnsureGroups();
  for(var i=0;i<groups.length;i++){
    if(groups[i].rects.some(function(r){return r.id===rectId;})) return groups[i];
  }
  return null;
}

function ssCreateGroupFromSelection(){
  if(SS_SELECTION.length<1){ return; }
  var groups=ssEnsureGroups();
  var allRects=ssBuildProgramRects();
  var byId={};
  allRects.forEach(function(r){byId[r.id]=r;});
  var validIds=SS_SELECTION.filter(function(id){
    return !ssIsAssigned(id) && !ssGroupOf(id);
  });
  if(validIds.length<2){ alert("Select at least 2 unassigned, ungrouped rooms."); return; }
  var groupRects=validIds.map(function(id){return byId[id];}).filter(Boolean);
  var totalNSF=groupRects.reduce(function(s,r){return s+(r.nsf||0);},0);
  var cats=[...new Set(groupRects.map(function(r){return r.catName;}))];
  var name=cats.length===1?cats[0]+" group":"Mixed group";
  var color=groupRects[0].catColor||"#C2C3C8";
  var id="GRP_"+Date.now();
  groups.push({id:id,name:name,color:color,rects:groupRects,nsf:totalNSF});
  ssClearSelection();
  var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
}

function ssDisbandGroup(groupId){
  var groups=ssEnsureGroups();
  var i=groups.findIndex(function(g){return g.id===groupId;});
  if(i>=0) groups.splice(i,1);
  var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
}

function buildProgramPanelList(container, scrollWrap, allRects, groupedIds){
  var byCategory=[], catMap={};
  allRects.forEach(function(rect){
    if(groupedIds.has(rect.id)) return;
    if(!catMap[rect.catName]){catMap[rect.catName]={catName:rect.catName,color:rect.catColor,types:[],typeMap:{}};byCategory.push(catMap[rect.catName]);}
    var cm=catMap[rect.catName];
    if(!cm.typeMap[rect.typeKey]){
      cm.typeMap[rect.typeKey]={typeKey:rect.typeKey,name:rect.name,color:rect.catColor,rects:[]};
      cm.types.push(cm.typeMap[rect.typeKey]);
    }
    cm.typeMap[rect.typeKey].rects.push(rect);
  });

  byCategory.forEach(function(cat){
    var catDiv=el("div",{style:"margin-bottom:10px"});
    catDiv.appendChild(el("div",{style:"font-size:11px;font-weight:800;color:#1F2A44;margin-bottom:4px"},[cat.catName]));

    cat.types.forEach(function(typeGroup){
      var expanded=!!SS_EXPANDED_TYPES[typeGroup.typeKey];
      var typeWrap=el("div",{style:"border:1px solid var(--line);border-radius:5px;margin-bottom:4px;overflow:hidden"});

      var someAssigned=typeGroup.rects.some(function(r){return ssIsAssigned(r.id);});
      var headRow=el("div",{"data-type-header":"1",style:[
        "display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer",
        "background:"+(someAssigned?"#f5f5f5":typeGroup.color+"22")
      ].join(";")});
      headRow.appendChild(el("span",{style:"font-size:10px;color:#888;width:12px;flex-shrink:0;transition:transform .15s;transform:rotate("+(expanded?"90":"0")+"deg)"},["▶"]));
      headRow.appendChild(el("div",{style:"width:10px;height:10px;border-radius:2px;background:"+typeGroup.color+";flex-shrink:0;border:1px solid rgba(0,0,0,0.2)"}));
      headRow.appendChild(el("div",{style:"flex:1;font-size:12px;font-weight:600;color:#1F2A44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"},[typeGroup.name]));
      headRow.appendChild(el("span",{style:"font-size:10px;color:#888;font-weight:700"},["("+typeGroup.rects.length+")"]));
      if(someAssigned){
        var assignedCount=typeGroup.rects.filter(function(r){return ssIsAssigned(r.id);}).length;
        headRow.appendChild(el("span",{style:"font-size:9px;color:#1F4D7A;font-weight:700;background:#fff;border:1px solid #1F4D7A44;border-radius:8px;padding:0 6px"},[assignedCount+"/"+typeGroup.rects.length+" placed"]));
      }
      headRow.addEventListener("click",function(){
        SS_EXPANDED_TYPES[typeGroup.typeKey]=!SS_EXPANDED_TYPES[typeGroup.typeKey];
        var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
      });
      typeWrap.appendChild(headRow);

      if(expanded){
        var listBody=el("div",{style:"max-height:260px;overflow-y:auto;border-top:1px solid var(--line)"});
        typeGroup.rects.forEach(function(rect,idx){
          var assigned=ssIsAssigned(rect.id);
          var selected=ssIsSelected(rect.id);
          var instRow=el("div",{
            "data-rect-id":rect.id,
            draggable:assigned?"false":"true",
            style:[
              "display:flex;align-items:center;gap:6px;padding:3px 8px 3px 28px;font-size:10.5px",
              "cursor:"+(assigned?"default":"pointer"),
              "background:"+(selected?"#1F4D7A18":(idx%2?"#fafafa":"#fff")),
              "opacity:"+(assigned?"0.4":"1"),
              "border-left:3px solid "+(selected?"#1F4D7A":"transparent")
            ].join(";")
          });
          instRow.appendChild(el("span",{style:"color:#888;min-width:20px"},["#"+(idx+1)]));
          instRow.appendChild(el("span",{style:"flex:1;color:#1F2A44;font-family:monospace;font-size:9.5px"},[rect.id]));
          instRow.appendChild(el("span",{style:"color:#666"},[fmt(rect.nsf)+" SF"]));
          if(rect.roomHeight) instRow.appendChild(el("span",{style:"color:#999;font-size:9px"},[rect.roomHeight+"'"]));
          var asgn=ssAssignmentOf(rect.id);
          if(asgn) instRow.appendChild(el("span",{style:"font-size:8px;font-weight:800;color:#fff;background:#1F4D7A;border-radius:4px;padding:0 4px"},[ssBadgeFor(asgn)]));

          if(!assigned){
            instRow.addEventListener("click",function(e){
              e.stopPropagation();
              ssToggleSelect(rect.id);
              var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
            });
            instRow.addEventListener("dragstart",function(e){
              e.dataTransfer.effectAllowed="move";
              var dragIds=(SS_SELECTION.indexOf(rect.id)>=0 && SS_SELECTION.length>1) ? SS_SELECTION.slice() : [rect.id];
              var dragRects=dragIds.map(function(id){return allRects.find(function(r){return r.id===id;});}).filter(Boolean);
              e.dataTransfer.setData("text/plain",JSON.stringify({
                isMultiPack:true,
                rects:dragRects.map(function(r){return {id:r.id,name:r.name,catName:r.catName,catColor:r.catColor,gw:r.gw,gh:r.gh,nsf:r.nsf,roomHeight:r.roomHeight};})
              }));
              setTimeout(function(){instRow.style.opacity="0.2";},0);
            });
            instRow.addEventListener("dragend",function(){instRow.style.opacity="1";});
          }
          listBody.appendChild(instRow);
        });
        typeWrap.appendChild(listBody);
      }
      catDiv.appendChild(typeWrap);
    });
    container.appendChild(catDiv);
  });
}

function buildProgramPanel(container){
  var _savedScroll=0;
  var _existingScroll=container.querySelector("[id='ss-prog-scrollwrap']");
  if(_existingScroll) _savedScroll=_existingScroll.scrollTop;
  container.innerHTML="";
  var groups=ssEnsureGroups();
  SS_SELECTION=SS_SELECTION.filter(function(id){return !ssIsAssigned(id);});

  container.appendChild(el("div",{style:"font-weight:800;font-size:13px;color:#1F2A44;margin:8px 10px 0"},["Program"]));

  var toolbar=el("div",{id:"ss-prog-toolbar",style:[
    "display:flex;align-items:center;gap:6px;padding:8px 10px 6px",
    "background:#fff;border-bottom:1px solid var(--line)",
    "flex-shrink:0;min-height:36px;border-radius:6px 6px 0 0"
  ].join(";")});
  if(SS_SELECTION.length>0){
    toolbar.appendChild(el("span",{class:"ss-sel-toolbar",style:"font-size:11px;color:#1F4D7A;font-weight:600"},[SS_SELECTION.length+" selected"]));
    toolbar.appendChild(el("button",{
      style:"padding:2px 10px;font-size:11px;border:1px solid #1F4D7A;background:#1F4D7A;color:#fff;border-radius:12px;cursor:pointer;font-weight:600",
      onclick:function(){ssCreateGroupFromSelection();},
    },["Group selected"]));
    toolbar.appendChild(el("button",{
      style:"padding:2px 8px;font-size:11px;border:1px solid #ccd2dc;background:#fff;color:#888;border-radius:12px;cursor:pointer",
      onclick:function(){ssClearSelection();var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);}
    },["Clear"]));
  } else {
    toolbar.appendChild(el("span",{style:"font-size:10px;color:#aaa"},["Click or drag-select rooms · then Group selected"]));
  }
  var viewToggle=el("div",{style:"margin-left:auto;display:flex;gap:2px;background:#F1F4F8;border-radius:6px;padding:2px;flex-shrink:0"});
  ["rect","list"].forEach(function(mode){
    viewToggle.appendChild(el("button",{
      style:[
        "padding:3px 9px;font-size:10px;font-weight:700;border:none;border-radius:4px;cursor:pointer",
        SS_PROG_VIEW===mode?"background:#1F4D7A;color:#fff":"background:transparent;color:#888"
      ].join(";"),
      onclick:function(){SS_PROG_VIEW=mode;var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);}
    },[mode==="rect"?"▭ Rects":"☰ List"]));
  });
  toolbar.appendChild(viewToggle);
  container.appendChild(toolbar);

  var scrollWrap=el("div",{id:"ss-prog-scrollwrap",style:"flex:1;overflow-y:auto;padding:10px;position:relative"});
  container.appendChild(scrollWrap);
  if(_savedScroll>0){
    requestAnimationFrame(function(){scrollWrap.scrollTop=_savedScroll;});
  }
  var origContainer=container;
  container=scrollWrap;

  var allRects=ssBuildProgramRects();
  var groupedIds=new Set();
  groups.forEach(function(g){g.rects.forEach(function(r){groupedIds.add(r.id);});});

  // ── GROUPS section ──
  if(groups.length>0){
    container.appendChild(el("div",{style:"font-size:11px;font-weight:800;color:#1F2A44;margin-bottom:4px;margin-top:4px"},["Groups"]));
    groups.forEach(function(grp){
      var assigned=ssIsAssigned(grp.id);
      var groupWrap=el("div",{style:"display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:5px 8px;border:1px solid "+darkenColor(grp.color,0.2)+";border-radius:5px;background:"+(assigned?"rgba(0,0,0,0.04)":grp.color+"33")});

      var strip=el("div",{style:"display:flex;gap:1px;align-items:center;flex:1;flex-wrap:wrap"});
      grp.rects.forEach(function(r){
        strip.appendChild(el("div",{
          title:r.id+" | "+r.name+" | "+r.nsf+" NSF",
          style:[
            "width:"+Math.max(4,Math.round(r.pw*0.5))+"px","height:"+Math.max(4,Math.round(r.ph*0.5))+"px",
            "background:"+r.catColor,
            "border:1px solid "+darkenColor(r.catColor,0.3),
            "border-radius:2px","flex-shrink:0",
            "opacity:"+(assigned?"0.3":"1")
          ].join(";")
        }));
      });
      groupWrap.appendChild(strip);

      var infoCol=el("div",{style:"display:flex;flex-direction:column;min-width:80px;font-size:10px;color:#555"});
      infoCol.appendChild(el("span",{style:"font-weight:600;font-size:11px;color:#1F2A44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px"},[grp.name]));
      infoCol.appendChild(el("span",null,[fmt(grp.nsf)+" NSF"]));
      infoCol.appendChild(el("span",null,[grp.rects.length+" rooms"]));
      groupWrap.appendChild(infoCol);

      if(!assigned){
        groupWrap.setAttribute("draggable","true");
        groupWrap.style.cursor="grab";
        groupWrap.addEventListener("dragstart",function(e){
          e.dataTransfer.effectAllowed="move";
          var gw=Math.max(16,Math.round(Math.sqrt(grp.nsf*2)*ssPxPerFt()));
          var gh=Math.max(12,Math.round(grp.nsf/Math.sqrt(grp.nsf*2)*ssPxPerFt()));
          e.dataTransfer.setData("text/plain",JSON.stringify({
            id:grp.id,name:grp.name,catName:grp.name,catColor:grp.color,
            gw:gw,gh:gh,nsf:grp.nsf,isGroup:true
          }));
          setTimeout(function(){groupWrap.style.opacity="0.25";},0);
        });
        groupWrap.addEventListener("dragend",function(){groupWrap.style.opacity="1";});
      }

      groupWrap.appendChild(el("button",{
        title:"Disband group",
        style:"width:18px;height:18px;border-radius:50%;border:1px solid #C0392B44;background:#fff;color:#C0392B;font-size:10px;cursor:pointer;flex-shrink:0;padding:0;line-height:1",
        onclick:function(e){e.stopPropagation();ssDisbandGroup(grp.id);}
      },["✕"]));
      container.appendChild(groupWrap);
    });
    container.appendChild(el("div",{style:"border-top:1px solid var(--line);margin:8px 0"}));
  }

  // ── Individual rooms by category — RECT VIEW or LIST VIEW ──
  if(SS_PROG_VIEW==="list"){
    buildProgramPanelList(container, scrollWrap, allRects, groupedIds);
  } else {
  var byCategory=[],catMap={};
  allRects.forEach(function(rect){
    if(groupedIds.has(rect.id)) return;
    if(!catMap[rect.catName]){catMap[rect.catName]={catName:rect.catName,color:rect.catColor,rects:[]};byCategory.push(catMap[rect.catName]);}
    catMap[rect.catName].rects.push(rect);
  });

  byCategory.forEach(function(grp){
    var div=el("div",{style:"margin-bottom:10px"});
    div.appendChild(el("div",{style:"font-size:11px;font-weight:800;color:#1F2A44;margin-bottom:4px"},[grp.catName]));
    var row=el("div",{style:"display:flex;flex-wrap:wrap;gap:3px;align-items:flex-end"});
    grp.rects.forEach(function(rect){
      var asgn=ssAssignmentOf(rect.id);
      var assigned=asgn!==null;
      var selected=ssIsSelected(rect.id);
      var wrap=el("div",{"data-rect-id":rect.id,style:"position:relative;display:inline-block;flex-shrink:0"});

      if(assigned){
        wrap.appendChild(el("div",{style:"position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#1F4D7A;color:#fff;font-size:7px;font-weight:800;border-radius:5px;padding:0 3px;line-height:11px;pointer-events:none;z-index:3;white-space:nowrap"},[ssBadgeFor(asgn)]));
      }
      if(selected){
        wrap.appendChild(el("div",{style:"position:absolute;inset:-3px;border:2px solid #1F4D7A;border-radius:4px;pointer-events:none;z-index:4"}));
      }

      var rectEl=el("div",{
        title:rect.id+" | "+rect.name+" | "+rect.nsf+" NSF",
        draggable:assigned?"false":"true",
        style:[
          "width:"+rect.pw+"px","height:"+rect.ph+"px",
          "background:"+rect.catColor,
          "border:1px solid "+darkenColor(rect.catColor,0.3),
          "border-radius:2px",
          "cursor:"+(assigned?"default":(selected?"pointer":"grab")),
          "opacity:"+(assigned?"0.28":"1"),
          "position:relative","box-sizing:border-box","transition:opacity .2s"
        ].join(";")
      });

      if(rect.ph>=18&&rect.pw>=28){
        rectEl.appendChild(el("div",{style:"position:absolute;bottom:2px;left:3px;font-size:8px;color:#1F2A4488;line-height:1;pointer-events:none;white-space:nowrap;overflow:hidden;max-width:"+(rect.pw-6)+"px"},[rect.id]));
      }

      if(!assigned){
        rectEl.addEventListener("click",function(e){
          e.stopPropagation();
          ssToggleSelect(rect.id);
          var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
        });
        rectEl.addEventListener("dragstart",function(e){
          e.dataTransfer.effectAllowed="move";
          e.dataTransfer.setData("text/plain",JSON.stringify({
            id:rect.id,name:rect.name,catName:rect.catName,catColor:rect.catColor,
            pw:rect.pw,ph:rect.ph,gw:rect.gw,gh:rect.gh,nsf:rect.nsf,roomHeight:rect.roomHeight||null
          }));
          SS._drag=rect;
          setTimeout(function(){rectEl.style.opacity="0.15";},0);
        });
        rectEl.addEventListener("dragend",function(){rectEl.style.opacity="1";SS._drag=null;});
      }
      wrap.appendChild(rectEl);
      row.appendChild(wrap);
    });
    div.appendChild(row);
    container.appendChild(div);
  });
  } // end rect-view branch

  container.addEventListener("click",function(e){
    if(e.target===container){ssClearSelection();buildProgramPanel(origContainer);}
  });

  // ── Drag-select (rubberband) ──
  var dsActive=false,dsx=0,dsy=0;
  var dsBox=el("div",{style:"position:absolute;border:1.5px solid #1F4D7A;background:rgba(31,77,122,0.08);pointer-events:none;display:none;z-index:100"});
  container.style.position="relative";
  container.appendChild(dsBox);
  container.addEventListener("mousedown",function(e){
    var tg=e.target;
    if(tg.getAttribute&&tg.getAttribute("draggable")==="true") return;
    if(tg.tagName==="BUTTON"||tg.tagName==="INPUT"||tg.tagName==="SELECT") return;
    if(tg.closest&&tg.closest("[data-type-header]")) return;
    if(tg.closest&&tg.closest("[data-rect-id]")&&SS_PROG_VIEW==="list") return;
    var cr=container.getBoundingClientRect();
    dsx=e.clientX-cr.left;
    dsy=e.clientY-cr.top+container.scrollTop;
    dsActive=true;
    dsBox.style.left=dsx+"px";dsBox.style.top=(dsy-container.scrollTop)+"px";
    dsBox.style.width="0";dsBox.style.height="0";
    dsBox.style.display="block";
    e.preventDefault();
  });
  document.addEventListener("mousemove",function(e){
    if(!dsActive)return;
    var cr=container.getBoundingClientRect();
    var cx=e.clientX-cr.left,cy=e.clientY-cr.top+container.scrollTop;
    var x1=Math.min(dsx,cx),y1=Math.min(dsy,cy);
    var x2=Math.max(dsx,cx),y2=Math.max(dsy,cy);
    dsBox.style.left=x1+"px";dsBox.style.top=(y1-container.scrollTop)+"px";
    dsBox.style.width=(x2-x1)+"px";dsBox.style.height=(y2-y1)+"px";
    var allWraps=container.querySelectorAll("[data-rect-id]");
    allWraps.forEach(function(wrap){
      var wr=wrap.getBoundingClientRect();
      var wx1=wr.left-cr.left,wy1=wr.top-cr.top+container.scrollTop;
      var wx2=wx1+wr.width,wy2=wy1+wr.height;
      var hit=(wx2>x1&&wx1<x2&&wy2>y1&&wy1<y2);
      var id=wrap.getAttribute("data-rect-id");
      if(hit&&!ssIsAssigned(id)&&SS_SELECTION.indexOf(id)<0) SS_SELECTION.push(id);
    });
    var tb=origContainer.querySelector(".ss-sel-toolbar");
    if(tb) tb.textContent=SS_SELECTION.length+" selected";
  });
  document.addEventListener("mouseup",function(){
    if(!dsActive)return;
    dsActive=false;dsBox.style.display="none";
    var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
  });
}

// ====================================================================
// BUILDING PANEL — level canvases with real floor outlines
// ====================================================================
function buildBuildingPanel(container){
  container.innerHTML="";
  var sc=ssScenario();
  ssNormalizeScenario(sc);

  var hdr=el("div",{style:"display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap"});
  hdr.appendChild(el("div",{style:"font-weight:800;font-size:13px;color:#1F2A44;margin-right:4px"},["Key Buildings"]));
  BLDG_REGISTRY.forEach(function(b,bi){
    hdr.appendChild(el("button",{
      style:"padding:3px 12px;border-radius:14px;font-size:11px;font-weight:700;cursor:pointer;border:"+(bi===SS.activeBuilding?"2px solid #1F2A44;background:#1F2A44;color:#fff":"1px solid #ccd2dc;background:#fff;color:#1F2A44"),
      onclick:function(){SS.activeBuilding=bi;buildBuildingPanel(container);var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);}
    },[el("span",{class:"dot",style:"background:"+(BLDG_COLORS[b.id]||"#ccc")+";width:8px;height:8px;margin-right:5px"}), b.name]));
  });
  container.appendChild(hdr);

  var bdef=BLDG_REGISTRY[SS.activeBuilding];
  var bs=sc.buildings[SS.activeBuilding];
  if(!bdef||!bs) return;

  var legendRow=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:8px"});
  legendRow.appendChild(el("div",{style:"font-size:10px;color:#888;flex:1"},
    [bdef.sub+" · "+bdef.gridFt+"′ canvas · grid = "+SS_GRID_DIV+"′ · scroll or +/− to zoom each level · hover a placed room for ↻ rotate / × delete"]));
  // Section line draw toggle
  if(!SS._sectionDrawMode) SS._sectionDrawMode=false;
  legendRow.appendChild(el("button",{
    title:"Draw a section cut line — appears on all levels. Short tick marks indicate viewing direction.",
    style:"padding:3px 10px;font-size:11px;border:1px solid "+(SS._sectionDrawMode?"#C0392B":"var(--line2)")+
          ";background:"+(SS._sectionDrawMode?"#C0392B":"#fff")+";color:"+(SS._sectionDrawMode?"#fff":"#1F2A44")+
          ";border-radius:4px;cursor:pointer;font-weight:700;white-space:nowrap",
    onclick:function(){
      SS._sectionDrawMode=!SS._sectionDrawMode;
      buildBuildingPanel(container);
    }
  },[SS._sectionDrawMode?"✕ Cancel Section":"📐 Draw Section"]));
  if(bs.sectionLine){
    legendRow.appendChild(el("button",{
      title:"Remove the current section line",
      style:"padding:3px 8px;font-size:11px;border:1px solid #C0392B44;color:#C0392B;background:#fff;border-radius:4px;cursor:pointer",
      onclick:function(){bs.sectionLine=null;buildBuildingPanel(container);}
    },["✕ Clear"]));
  }
  legendRow.appendChild(el("button",{
    title:"Re-read NSF and dimensions for all placed rooms from the current program. Does not move rooms.",
    style:"padding:3px 10px;font-size:11px;border:1px solid var(--line2);background:#fff;border-radius:4px;cursor:pointer;color:#1F2A44;white-space:nowrap;flex-shrink:0",
    onclick:function(){
      var allRects=ssBuildProgramRects();
      var rectById={};
      allRects.forEach(function(r){rectById[r.id]=r;});
      sc.buildings.forEach(function(b2){
        b2.levels.forEach(function(lvl){
          lvl.forEach(function(item){
            var src=rectById[item.id];
            if(src){
              item.nsf=src.nsf; item.catColor=src.catColor;
              item.catName=src.catName; item.name=src.name;
              item.gw=src.gw; item.gh=src.gh;
              item.roomHeight=src.roomHeight||null;
            }
          });
        });
      });
      var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
      buildBuildingPanel(container);
      var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
    }
  },["⟳ Sync to program"]));
  container.appendChild(legendRow);

  var worldPx0=bdef.gridFt*SS_GRID_PX_PER_FT;   // world size at zoom=1

  var levelsRow=el("div",{style:"display:grid;grid-template-columns:repeat(auto-fill,minmax("+(SS_CANVAS_PX+2)+"px,1fr));gap:12px"});

  bdef.levels.forEach(function(lvlDef,li){
    var items=bs.levels[li];
    var lvlNSF=items.reduce(function(s,it){return s+(it.nsf||0);},0);
    var capNSF=Math.round(lvlDef.plate*ssNG());
    var lz=bs.levelZoom[li]||ssFitZoom(bdef);
    var scaledCanvas=Math.round(worldPx0*lz);

    var card=el("div",{style:"display:flex;flex-direction:column;border:1px solid var(--line);border-radius:6px;overflow:hidden"});

    var canvasWrap=el("div",{style:"position:relative;width:100%;height:"+SS_CANVAS_PX+"px;background:#fff;flex-shrink:0;overflow:hidden"});
    var panX=bs.levelPan[li][0],panY=bs.levelPan[li][1];
    var innerWorld=el("div",{style:"position:absolute;top:"+panY+"px;left:"+panX+"px;width:"+scaledCanvas+"px;height:"+scaledCanvas+"px;transform-origin:top left"});

    // ── Grid lines (dashed, every 50ft) ──
    var svgNS="http://www.w3.org/2000/svg";
    var gridSvg=document.createElementNS(svgNS,"svg");
    gridSvg.setAttribute("width",scaledCanvas);
    gridSvg.setAttribute("height",scaledCanvas);
    gridSvg.style.cssText="position:absolute;top:0;left:0;pointer-events:none;z-index:1";
    var step=SS_GRID_DIV*ssPxPerFt()*lz;
    var numLines=Math.floor(bdef.gridFt/SS_GRID_DIV);
    for(var gi=0;gi<=numLines;gi++){
      var gp=gi*step;
      var vl=document.createElementNS(svgNS,"line");
      vl.setAttribute("x1",gp);vl.setAttribute("y1",0);vl.setAttribute("x2",gp);vl.setAttribute("y2",scaledCanvas);
      vl.setAttribute("stroke","#1F4D7A");vl.setAttribute("stroke-width",gi===0||gi===numLines?"1.2":"0.5");
      vl.setAttribute("stroke-dasharray",gi===0||gi===numLines?"none":"4,4");
      vl.setAttribute("opacity","0.30");
      gridSvg.appendChild(vl);
      var hl=document.createElementNS(svgNS,"line");
      hl.setAttribute("x1",0);hl.setAttribute("y1",gp);hl.setAttribute("x2",scaledCanvas);hl.setAttribute("y2",gp);
      hl.setAttribute("stroke","#1F4D7A");hl.setAttribute("stroke-width",gi===0||gi===numLines?"1.2":"0.5");
      hl.setAttribute("stroke-dasharray",gi===0||gi===numLines?"none":"4,4");
      hl.setAttribute("opacity","0.30");
      gridSvg.appendChild(hl);
    }
    innerWorld.appendChild(gridSvg);

    // ── Floor outline background ──
    var fp=FLOOR_SVGS[lvlDef.svgKey];
    if(fp){
      var pxPerU=FLOOR_FT_PER_UNIT*SS_GRID_PX_PER_FT*lz;
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

    // ── Placed room rectangles ──
    items.forEach(function(item,ii){
      var px=Math.round((item.px||10)*lz),py=Math.round((item.py||10)*lz);
      var gw=Math.round((item.gw||20)*lz),gh=Math.round((item.gh||20)*lz);
      var gwD=Math.max(8,gw),ghD=Math.max(8,gh);

      var rEl=el("div",{
        title:item.name+" | "+item.nsf+" NSF | "+item.id,
        style:[
          "position:absolute","left:"+px+"px","top:"+py+"px",
          "width:"+gwD+"px","height:"+ghD+"px",
          "background:"+item.catColor,
          "border:1.5px solid "+darkenColor(item.catColor,0.3),
          "border-radius:3px","box-sizing:border-box",
          "cursor:move","user-select:none","z-index:2",
          "overflow:visible"
        ].join(";")
      });

      if(ghD>=16&&gwD>=22){
        rEl.appendChild(el("div",{style:"position:absolute;bottom:1px;left:2px;font-size:7px;line-height:1;color:#1F2A4499;pointer-events:none;white-space:nowrap;overflow:hidden;max-width:"+(gwD-4)+"px"},[item.id]));
      }

      var rotBtn=el("div",{
        title:"Rotate 90°",
        style:"position:absolute;top:-6px;left:-6px;width:14px;height:14px;border-radius:50%;background:#1F4D7A;color:#fff;font-size:9px;line-height:14px;text-align:center;cursor:pointer;z-index:10;display:none;box-shadow:0 1px 3px #0004",
        onclick:function(e){
          e.stopPropagation();e.preventDefault();
          var oldGw=item.gw,oldGh=item.gh;
          var centrX=(item.px||0)+oldGw/2, centrY=(item.py||0)+oldGh/2;
          item.gw=oldGh; item.gh=oldGw;
          item.px=Math.max(0,Math.min(worldPx0-item.gw,Math.round(centrX-item.gw/2)));
          item.py=Math.max(0,Math.min(worldPx0-item.gh,Math.round(centrY-item.gh/2)));
          buildBuildingPanel(container);
          var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
        }
      },["↻"]);

      var delBtn=el("div",{
        style:"position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#C0392B;color:#fff;font-size:9px;line-height:14px;text-align:center;cursor:pointer;z-index:10;display:none;box-shadow:0 1px 3px #0004",
        onclick:function(e){
          e.stopPropagation();e.preventDefault();
          items.splice(ii,1);
          var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
          buildBuildingPanel(container);
          var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
        }
      },["×"]);
      rEl.addEventListener("mouseenter",function(){rotBtn.style.display="block";delBtn.style.display="block";});
      rEl.addEventListener("mouseleave",function(){rotBtn.style.display="none";delBtn.style.display="none";});
      rEl.appendChild(rotBtn);
      rEl.appendChild(delBtn);

      // Unified drag: reposition on same level OR move across levels/buildings
      rEl.setAttribute("draggable","true");
      var dragOffX=0,dragOffY=0;
      rEl.addEventListener("mousedown",function(e){
        var r=rEl.getBoundingClientRect();
        dragOffX=e.clientX-r.left;
        dragOffY=e.clientY-r.top;
      });
      rEl.addEventListener("dragstart",function(e){
        if(e.target===delBtn||e.target===rotBtn){e.preventDefault();return;}
        e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",JSON.stringify({
          id:item.id,name:item.name,catName:item.catName,catColor:item.catColor,
          gw:item.gw,gh:item.gh,nsf:item.nsf,roomHeight:item.roomHeight||null,
          fromBuilding:SS.activeBuilding,fromLevel:li,
          dragOffX:dragOffX,dragOffY:dragOffY,
          isBuildingMove:true
        }));
        setTimeout(function(){rEl.style.opacity="0.3";},0);
      });
      rEl.addEventListener("dragend",function(){rEl.style.opacity="1";});

      innerWorld.appendChild(rEl);
    });

    canvasWrap.appendChild(innerWorld);

    // ── Section line overlay (fixed to viewport, on top of innerWorld) ──
    var sectionSvg=document.createElementNS(svgNS,"svg");
    sectionSvg.setAttribute("width",SS_CANVAS_PX);sectionSvg.setAttribute("height",SS_CANVAS_PX);
    sectionSvg.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:15";
    canvasWrap.appendChild(sectionSvg);

    function drawSectionLine(){
      sectionSvg.innerHTML="";
      if(!bs.sectionLine) return;
      var sl=bs.sectionLine;
      // Convert world coords (zoom=1) to display px (apply zoom + pan)
      var x1=sl.x1*lz+bs.levelPan[li][0], y1=sl.y1*lz+bs.levelPan[li][1];
      var x2=sl.x2*lz+bs.levelPan[li][0], y2=sl.y2*lz+bs.levelPan[li][1];
      var ln=document.createElementNS(svgNS,"line");
      ln.setAttribute("x1",x1);ln.setAttribute("y1",y1);ln.setAttribute("x2",x2);ln.setAttribute("y2",y2);
      ln.setAttribute("stroke","#C0392B");ln.setAttribute("stroke-width","2.5");ln.setAttribute("stroke-dasharray","8,4");
      sectionSvg.appendChild(ln);
      // Direction tick marks (perpendicular short lines at each end, on the viewing side)
      var dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy)||1;
      var pux=-(dy/len), puy=dx/len;
      var tickLen=10;
      [[x1,y1],[x2,y2]].forEach(function(pt){
        var tk=document.createElementNS(svgNS,"line");
        tk.setAttribute("x1",pt[0]);tk.setAttribute("y1",pt[1]);
        tk.setAttribute("x2",pt[0]+pux*tickLen);tk.setAttribute("y2",pt[1]+puy*tickLen);
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

    // ── Section line drawing (active only while SS._sectionDrawMode) ──
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
      // Snap to nearest 45° increment around the start point
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

    // ── Pan within canvas ──
    var canvasPanning=false,cpsx=0,cpsy=0,cpox=0,cpoy=0;
    canvasWrap.addEventListener("mousedown",function(e){
      if(SS._sectionDrawMode) return;  // section drawing takes priority
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
      var newZ=Math.max(0.08,Math.min(4.0,(bs.levelZoom[li]||ssFitZoom(bdef))*(e.deltaY<0?1.15:1/1.15)));
      bs.levelZoom[li]=Math.round(newZ*100)/100;
      bs.levelPan[li]=[0,0];
      buildBuildingPanel(container);
    },{passive:false});

    // ── Drop target ──
    canvasWrap.addEventListener("dragover",function(e){
      e.preventDefault();e.dataTransfer.dropEffect="move";
      canvasWrap.style.background="#EEF5FB";
    });
    canvasWrap.addEventListener("dragleave",function(){
      canvasWrap.style.background="#fff";
    });
    canvasWrap.addEventListener("drop",function(e){
      e.preventDefault();
      canvasWrap.style.background="#fff";
      var raw=e.dataTransfer.getData("text/plain"),data;
      try{data=JSON.parse(raw);}catch(ex){return;}
      if(!data||(!data.id&&!data.isMultiPack)) return;
      var cRect=canvasWrap.getBoundingClientRect();
      var curPanX=bs.levelPan[li][0],curPanY=bs.levelPan[li][1];
      var dropX=Math.max(0,Math.min(worldPx0-(data.gw||20),Math.round((e.clientX-cRect.left-curPanX)/lz)));
      var dropY=Math.max(0,Math.min(worldPx0-(data.gh||20),Math.round((e.clientY-cRect.top-curPanY)/lz)));

      if(data.isMultiPack && data.rects){
        var packRects=data.rects.filter(function(r){return !ssIsAssigned(r.id);}).slice(0,25);
        var px0=dropX, py0=dropY, rowH=0, maxRowW=Math.min(worldPx0*0.6, 600);
        packRects.forEach(function(r){
          if(px0-dropX+r.gw>maxRowW){ px0=dropX; py0+=rowH+4; rowH=0; }
          var fx=Math.max(0,Math.min(worldPx0-r.gw,px0));
          var fy=Math.max(0,Math.min(worldPx0-r.gh,py0));
          items.push({
            id:r.id,name:r.name,catName:r.catName,catColor:r.catColor,
            nsf:r.nsf,gw:r.gw,gh:r.gh,roomHeight:r.roomHeight||null,
            px:fx,py:fy
          });
          if(r.gh>rowH)rowH=r.gh;
          px0+=r.gw+3;
        });
      } else if(data.isGroup){
        var grp=ssEnsureGroups().find(function(g){return g.id===data.id;});
        if(!grp) return;
        if(grp.rects.some(function(r){return ssIsAssigned(r.id);})) return;
        var offsetX=0,offsetY=0,rowH2=0;
        grp.rects.forEach(function(r){
          if(offsetX+r.gw>worldPx0*0.6){offsetX=0;offsetY+=rowH2+4;rowH2=0;}
          items.push({
            id:r.id,name:r.name,catName:r.catName,catColor:r.catColor,
            nsf:r.nsf,gw:r.gw,gh:r.gh,roomHeight:r.roomHeight||null,
            px:Math.max(0,Math.min(worldPx0-r.gw,dropX+offsetX)),
            py:Math.max(0,Math.min(worldPx0-r.gh,dropY+offsetY))
          });
          if(r.gh>rowH2)rowH2=r.gh;
          offsetX+=r.gw+3;
        });
      } else if(data.isBuildingMove){
        var srcB=ssScenario().buildings[data.fromBuilding];
        if(!srcB) return;
        var srcItems=srcB.levels[data.fromLevel];
        var srcIdx=srcItems.findIndex(function(it){return it.id===data.id;});
        if(srcIdx<0) return;
        var offX=Math.round((data.dragOffX||0)/lz);
        var offY=Math.round((data.dragOffY||0)/lz);
        var adjX=Math.max(0,Math.min(worldPx0-(srcItems[srcIdx].gw||20),dropX-offX));
        var adjY=Math.max(0,Math.min(worldPx0-(srcItems[srcIdx].gh||20),dropY-offY));
        if(data.fromBuilding===SS.activeBuilding && data.fromLevel===li){
          srcItems[srcIdx].px=adjX;
          srcItems[srcIdx].py=adjY;
        } else {
          var moved=srcItems.splice(srcIdx,1)[0];
          moved.px=adjX; moved.py=adjY;
          items.push(moved);
        }
      } else {
        if(ssIsAssigned(data.id)) return;
        items.push({
          id:data.id,name:data.name,catName:data.catName,catColor:data.catColor,
          nsf:data.nsf,gw:data.gw||20,gh:data.gh||20,px:dropX,py:dropY,roomHeight:data.roomHeight||null
        });
      }
      var pp=document.getElementById("ss-prog-panel");if(pp)buildProgramPanel(pp);
      buildBuildingPanel(container);
      var sp=document.getElementById("ss-site-panel");if(sp)buildSitePanel(sp);
    });

    card.appendChild(canvasWrap);

    // Footer: level name + zoom controls + stats
    var footer=el("div",{style:"padding:5px 8px;border-top:1px solid var(--line);background:#F7F9FC;display:flex;flex-direction:column;gap:2px"});
    var fRow=el("div",{style:"display:flex;justify-content:space-between;align-items:center;gap:4px"});
    fRow.appendChild(el("span",{style:"font-weight:800;font-size:12px;color:#1F4D7A"},[lvlDef.label]));
    var zoomBar=el("div",{style:"display:flex;align-items:center;gap:3px"});
    var makeZBtn=function(lbl,mult){
      return el("button",{
        style:"width:18px;height:16px;font-size:11px;border:1px solid #ccd2dc;border-radius:3px;background:#fff;cursor:pointer;padding:0;line-height:1;color:#1F2A44",
        onclick:function(e){
          e.stopPropagation();
          bs.levelZoom[li]=Math.round(Math.max(0.08,Math.min(4.0,(bs.levelZoom[li]||ssFitZoom(bdef))*mult))*100)/100;
          bs.levelPan[li]=[0,0];
          buildBuildingPanel(container);
        }
      },[lbl]);
    };
    zoomBar.appendChild(makeZBtn("−",1/1.25));
    zoomBar.appendChild(el("span",{style:"font-size:10px;min-width:32px;text-align:center;color:#666"},[Math.round((bs.levelZoom[li]||1)*100)+"%"]));
    zoomBar.appendChild(makeZBtn("+",1.25));
    fRow.appendChild(zoomBar);
    // Level datum height (ft) — used by the section view
    var htWrap=el("span",{style:"display:flex;align-items:center;gap:3px;font-size:10px;color:#666"});
    htWrap.appendChild(el("span",null,["HT"]));
    var htInp=el("input",{type:"text",value:String(bs.levelHeights[li]||0),title:"Level datum height (ft) — used by the section view",
      style:"width:34px;font-size:10px;border:1px solid #ccd2dc;border-radius:3px;padding:1px 3px;text-align:center"});
    htInp.addEventListener("change",function(){
      var v=parseFloat(htInp.value.replace(/[^0-9.\-]/g,""));
      bs.levelHeights[li]=isNaN(v)?0:v;
      buildSectionView(container, bdef, bs);
    });
    htWrap.appendChild(htInp);
    htWrap.appendChild(el("span",null,["′"]));
    fRow.appendChild(htWrap);
    fRow.appendChild(el("span",{style:"font-size:10px;color:#666"},["~"+fmt(lvlDef.plate)+" SF plate"]));
    fRow.appendChild(el("span",{style:"font-size:10px;color:#666"},[items.length+" spaces"]));
    footer.appendChild(fRow);
    if(lvlNSF>0){
      var pctFill=capNSF>0?lvlNSF/capNSF:0;
      var pctColor=pctFill>1?"#C0392B":(pctFill>0.85?"#E67E22":"#2E7D32");
      var sRow=el("div",{style:"display:flex;gap:10px;align-items:center"});
      sRow.appendChild(el("span",{style:"font-size:10px;font-weight:600;color:#1F2A44"},[fmt(lvlNSF)+" NSF placed"]));
      sRow.appendChild(el("span",{style:"font-size:10px;color:"+pctColor+";font-weight:700"},[(pctFill*100).toFixed(0)+"% of ~"+fmt(capNSF)+" NSF cap @ N:G "+f2(ssNG())]));
      footer.appendChild(sRow);
    } else {
      footer.appendChild(el("div",{style:"font-size:10px;color:#bbb"},["Drop rooms here"]));
    }
    card.appendChild(footer);
    levelsRow.appendChild(card);
  });

  container.appendChild(levelsRow);
  if(bdef.note) container.appendChild(el("div",{style:"font-size:10px;color:#aaa;margin-top:6px"},[bdef.note+" Floor plates are approximate."]));
  buildSectionView(container, bdef, bs);
}

// ── Section View: cross-section through all levels at the drawn section line ──
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

  // For each level, find rooms the section line passes through, and the
  // [start,end] ft range along the line where each room is crossed.
  var levelData=bdef.levels.map(function(lvlDef,li){
    var items=bs.levels[li]||[];
    var hits=[];
    items.forEach(function(item){
      var rx1=item.px||0, ry1=item.py||0, rx2=rx1+(item.gw||0), ry2=ry1+(item.gh||0);
      // Liang-Barsky style clip of the line segment against the room rect
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
      if(!rejected && t0<t1){
        hits.push({
          item:item,
          startFt:(t0*lineLenPx)/SS_GRID_PX_PER_FT,
          endFt:(t1*lineLenPx)/SS_GRID_PX_PER_FT
        });
      }
    });
    return hits;
  });

  var anyHits=levelData.some(function(h){return h.length>0;});

  var sectionPanel=el("div",{id:"ss-section-view",class:"card",style:"margin-top:10px;margin-bottom:0"});
  var hdrRow=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:6px"});
  hdrRow.appendChild(el("h3",{style:"margin:0;font-size:14px"},["Section — "+bdef.name]));
  hdrRow.appendChild(el("div",{style:"font-size:10px;color:#888;flex:1"},
    ["Cut line length: "+Math.round(lineLenFt)+"′ · Looking in direction of tick marks · set level datums with the HT fields"]));
  sectionPanel.appendChild(hdrRow);

  if(!anyHits){
    sectionPanel.appendChild(el("div",{style:"color:#aaa;font-size:12px;padding:20px;text-align:center"},
      ["Section line doesn't cross any placed rooms on any level."]));
    container.parentElement.insertBefore(sectionPanel, container.nextSibling);
    return;
  }

  // SVG section: x = position along cut line (ft), y = height (ft, inverted)
  var pxPerFtX=3.0, pxPerFtY=3.0;
  var topHt=0;
  bdef.levels.forEach(function(lvlDef,li){
    var lh=bs.levelHeights[li]||0;
    var tallest=(bs.levels[li]||[]).reduce(function(m,it){return Math.max(m,it.roomHeight||10);},10);
    topHt=Math.max(topHt, lh+tallest);
  });
  var maxHeight=Math.max(30, Math.ceil((topHt+5)/10)*10);
  var svgW=Math.max(200, lineLenFt*pxPerFtX+90);
  var svgH=maxHeight*pxPerFtY+50;

  var svg=document.createElementNS(svgNS,"svg");
  svg.setAttribute("width",svgW);svg.setAttribute("height",svgH);
  svg.style.cssText="background:#fafbfc;border:1px solid var(--line);border-radius:4px;display:block";

  function fx(ft){ return 50+ft*pxPerFtX; }
  function fy(ft){ return svgH-20-ft*pxPerFtY; }

  // Ground line
  var ground=document.createElementNS(svgNS,"line");
  ground.setAttribute("x1",fx(0));ground.setAttribute("y1",fy(0));
  ground.setAttribute("x2",fx(lineLenFt));ground.setAttribute("y2",fy(0));
  ground.setAttribute("stroke","#1F2A44");ground.setAttribute("stroke-width","2");
  svg.appendChild(ground);

  // Y-axis height ticks (every 10ft)
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

  // Level datum lines + room boxes
  levelData.forEach(function(hits,li){
    var lh=bs.levelHeights[li]||0;
    var datumLn=document.createElementNS(svgNS,"line");
    datumLn.setAttribute("x1",fx(0));datumLn.setAttribute("y1",fy(lh));
    datumLn.setAttribute("x2",fx(lineLenFt));datumLn.setAttribute("y2",fy(lh));
    datumLn.setAttribute("stroke","#bbb");datumLn.setAttribute("stroke-width","1");datumLn.setAttribute("stroke-dasharray","3,3");
    svg.appendChild(datumLn);
    var datumLbl=document.createElementNS(svgNS,"text");
    datumLbl.setAttribute("x",fx(lineLenFt)+4);datumLbl.setAttribute("y",fy(lh)+3);
    datumLbl.setAttribute("font-size","9");datumLbl.setAttribute("fill","#888");datumLbl.setAttribute("font-weight","700");
    datumLbl.textContent=bdef.levels[li].label+" @ "+lh+"′";
    svg.appendChild(datumLbl);

    hits.forEach(function(h){
      var roomH=h.item.roomHeight||10;
      var x1=fx(h.startFt), x2=fx(h.endFt);
      var y1=fy(lh+roomH), y2=fy(lh);
      var rect=document.createElementNS(svgNS,"rect");
      rect.setAttribute("x",Math.min(x1,x2));rect.setAttribute("y",y1);
      rect.setAttribute("width",Math.max(1,Math.abs(x2-x1)));rect.setAttribute("height",Math.max(1,y2-y1));
      rect.setAttribute("fill",h.item.catColor||"#ccc");
      rect.setAttribute("stroke","rgba(0,0,0,0.35)");rect.setAttribute("stroke-width","1");
      var title=document.createElementNS(svgNS,"title");
      title.textContent=h.item.name+" ("+h.item.id+") — "+roomH+"′ tall";
      rect.appendChild(title);
      svg.appendChild(rect);
      if(Math.abs(x2-x1)>30){
        var lbl=document.createElementNS(svgNS,"text");
        lbl.setAttribute("x",(x1+x2)/2);lbl.setAttribute("y",(y1+y2)/2+3);
        lbl.setAttribute("font-size","8");lbl.setAttribute("fill","#1F2A44");lbl.setAttribute("text-anchor","middle");
        lbl.textContent=h.item.id;
        svg.appendChild(lbl);
      }
    });
  });

  // X-axis length label
  var xLbl=document.createElementNS(svgNS,"text");
  xLbl.setAttribute("x",fx(lineLenFt/2));xLbl.setAttribute("y",svgH-4);
  xLbl.setAttribute("font-size","10");
  xLbl.setAttribute("fill","#888");xLbl.setAttribute("text-anchor","middle");xLbl.setAttribute("font-weight","700");
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

  var hdr=el("div",{style:"display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"});
  hdr.appendChild(el("div",{style:"font-weight:800;font-size:13px;color:#1F2A44"},["Site — "+ssScenario().name]));
  hdr.appendChild(el("span",{style:"font-size:10px;color:#888"},["Click a highlighted building to open its levels · drag to pan · scroll to zoom"]));
  var zr=el("div",{style:"margin-left:auto;display:flex;gap:4px;align-items:center"});
  [["＋",1.25],["－",1/1.25]].forEach(function(z){
    zr.appendChild(el("button",{style:"padding:2px 8px;border:1px solid #ccd2dc;border-radius:3px;cursor:pointer;font-size:13px",
      onclick:function(){SS_ZOOM=Math.max(0.4,Math.min(5,SS_ZOOM*z[1]));buildSitePanel(container);}},[z[0]]));
  });
  zr.appendChild(el("span",{style:"font-size:11px;min-width:36px;text-align:center;color:#555"},[Math.round(SS_ZOOM*100)+"%"]));
  zr.appendChild(el("button",{style:"padding:2px 8px;border:1px solid #ccd2dc;border-radius:3px;cursor:pointer;font-size:11px",
    onclick:function(){SS_ZOOM=1;SS_PAN_X=0;SS_PAN_Y=0;buildSitePanel(container);}},["Reset"]));
  hdr.appendChild(zr);
  container.appendChild(hdr);

  var viewport=el("div",{id:"ss-site-viewport",
    style:"position:relative;overflow:hidden;border:1px solid var(--line);border-radius:4px;background:#F4F6F9;width:100%;height:480px;cursor:grab"});
  var pxPerU=SITE_FT_PER_U*SITE_PX_PER_FT*SS_ZOOM;
  var worldW=Math.round(SITE_VB[2]*pxPerU);
  var worldH=Math.round(SITE_VB[3]*pxPerU);
  var world=el("div",{id:"ss-site-world",
    style:"position:absolute;top:"+SS_PAN_Y+"px;left:"+SS_PAN_X+"px;width:"+worldW+"px;height:"+worldH+"px"});

  // ── Inline SVG site map ──
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

  // ── Overlay: key building highlights + labels + scale bar ──
  var svgNS="http://www.w3.org/2000/svg";
  var overlaysvg=document.createElementNS(svgNS,"svg");
  overlaysvg.setAttribute("width",worldW);overlaysvg.setAttribute("height",worldH);
  overlaysvg.setAttribute("viewBox",vbStr);
  overlaysvg.style.cssText="position:absolute;top:0;left:0;pointer-events:none;";
  BLDG_REGISTRY.forEach(function(b,bi){
    var ptsStr=SITE_KEY_FOOTPRINTS[b.id];
    if(!ptsStr) return;
    var active=(bi===SS.activeBuilding);
    var poly=document.createElementNS(svgNS,"polygon");
    poly.setAttribute("points",ptsStr);
    poly.setAttribute("fill",BLDG_COLORS[b.id]||"#999");
    poly.setAttribute("fill-opacity",active?"0.8":"0.45");
    poly.setAttribute("stroke",active?"#1F2A44":darkenColor(BLDG_COLORS[b.id]||"#999",0.4));
    poly.setAttribute("stroke-width",active?"4":"1.5");
    poly.style.pointerEvents="auto";
    poly.style.cursor="pointer";
    poly.addEventListener("click",function(){
      SS.activeBuilding=bi;
      var bp=document.getElementById("ss-bldg-panel");if(bp)buildBuildingPanel(bp);
      buildSitePanel(container);
    });
    poly.appendChild((function(){var t=document.createElementNS(svgNS,"title");t.textContent=b.name+" — "+b.sub;return t;})());
    overlaysvg.appendChild(poly);

    // Label
    var placed=ssPlacedNSFForBuilding(b.id);
    var lx=b.siteLabel[0], ly=b.siteLabel[1];
    var mkText=function(txt, dy, size, weight){
      var t=document.createElementNS(svgNS,"text");
      t.setAttribute("x",lx);t.setAttribute("y",ly+dy);
      t.setAttribute("font-size",size);t.setAttribute("font-weight",weight);
      t.setAttribute("text-anchor","middle");t.setAttribute("fill","#1F2A44");
      t.setAttribute("stroke","#FFFFFF");t.setAttribute("stroke-width","5");
      t.setAttribute("paint-order","stroke");
      t.setAttribute("font-family","Roboto, Helvetica Neue, Arial, sans-serif");
      t.textContent=txt;
      return t;
    };
    overlaysvg.appendChild(mkText(b.name, 0, 30, 800));
    overlaysvg.appendChild(mkText(placed>0 ? fmt(placed)+" NSF placed" : b.levels.length+" levels", 30, 22, 600));
  });

  // Scale bar (200 ft)
  var barFt=200, barU=barFt/SITE_FT_PER_U;
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
  st.setAttribute("font-family","Roboto, Helvetica Neue, Arial, sans-serif");
  st.textContent=barFt+"′";overlaysvg.appendChild(st);
  world.appendChild(overlaysvg);

  // Pan
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
  container.appendChild(el("div",{style:"font-size:10px;color:#aaa;margin-top:4px"},["Site plan: Burlington campus vector plan (C. Booth, 2026-07-22) · scale bar = 200 ft · highlighted footprints are the three key buildings"]));
}

// ====================================================================
// PDF / JSON export
// ====================================================================
function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function ssPrintBuildings(){
  var bp=document.getElementById("ss-bldg-panel");
  if(!bp){alert("Navigate to the Site Scenarios tab first.");return;}
  var pw=window.open("","_blank","width=1200,height=900");
  if(!pw){alert("Pop-up blocked — please allow pop-ups.");return;}
  // Capture each building's panel by temporarily switching the active building
  var saved=SS.activeBuilding;
  var blocks=[];
  BLDG_REGISTRY.forEach(function(b,bi){
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
    '<style>body{margin:0;padding:16px;font-family:Roboto,sans-serif;background:#fff;color:#1F2A44}'+
    'h1{font-size:18px;font-weight:800;margin:0 0 10px}h2{font-size:14px;font-weight:800;margin:14px 0 6px}'+
    '.bldg-block{page-break-inside:avoid;margin-bottom:18px;border-top:1px solid #ddd;padding-top:8px}'+
    'button,label{display:none !important}'+
    '.note{font-size:10px;color:#888;margin-top:6px}'+
    '@media print{@page{size:landscape A3;margin:10mm}}</style></head>'+
    '<body><h1>'+escHtml(ssScenario().name)+' — Key Building Layouts | BILH Burlington</h1>'+
    blocks.join("")+
    '<div class="note">Exported from '+escHtml(S.project.name)+' · '+new Date().toLocaleDateString()+' · Floor plates approximate</div>'+
    '<script>window.onload=function(){window.print();};<\/script>'+
    '</body></html>'
  );
  pw.document.close();
}

function ssExportScenarios(){
  var data={
    _type:"BILH_Burlington_Scenarios",
    _version:"1.0",
    _exported:new Date().toISOString(),
    _program_version:S.project.version,
    scenarios:SS.scenarios
  };
  var str=JSON.stringify(data,null,2);
  var blob=new Blob([str],{type:"application/json"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download="BILH_Burlington_Scenarios_"+ssScenario().name.replace(/[^A-Za-z0-9]/g,"_")+".json";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ssImportScenarios(evt){
  var file=evt.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data._type||data._type!=="BILH_Burlington_Scenarios"||!Array.isArray(data.scenarios)){
        alert("This doesn't look like a BILH Burlington Scenarios file.");return;
      }
      var allRects=ssBuildProgramRects();
      var validIds=new Set(allRects.map(function(r){return r.id;}));
      var orphaned=[];
      data.scenarios.forEach(function(sc){
        (sc.buildings||[]).forEach(function(bs){
          (bs.levels||[]).forEach(function(lvl){
            (lvl||[]).forEach(function(item){
              if(!validIds.has(item.id)&&orphaned.indexOf(item.id)<0) orphaned.push(item.id);
            });
          });
        });
      });
      var msg="Loaded "+data.scenarios.length+" scenario(s) from "+
              (data._exported?data._exported.slice(0,10):"unknown date")+
              " (program "+data._program_version+").";
      if(orphaned.length){
        msg+="\n\n⚠ "+orphaned.length+" placed room ID(s) not found in current program (may have been renamed or deleted): "+orphaned.slice(0,5).join(", ")+(orphaned.length>5?" ...":"");
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
    '<style>body{margin:0;padding:16px;font-family:Roboto,sans-serif;background:#fff}'+
    'h2{font-size:16px;font-weight:800;color:#1F2A44;margin:0 0 8px}'+
    '.note{font-size:10px;color:#888;margin-top:6px}'+
    '@media print{@page{size:landscape A3;margin:10mm}}</style></head>'+
    '<body><h2>'+escHtml(ssScenario().name)+' — Site Map | BILH Burlington</h2>'+
    site.outerHTML+
    '<div class="note">'+escHtml(S.project.name)+' · Exported '+new Date().toLocaleDateString()+'</div>'+
    '<script>window.onload=function(){window.print();};<\/script></body></html>'
  );
  pw.document.close();
}
