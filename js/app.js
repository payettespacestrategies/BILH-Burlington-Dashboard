// ====================================================================
// BILH BURLINGTON PLANNING DASHBOARD — core app
// Tabs: Overview · Program · Site Scenarios
// Adapted from the RUSM Program Dashboard (Payette Space Strategies).
// ====================================================================

var TABS = [
  {id:"overview",  label:"Overview"},
  {id:"program",   label:"Program"},
  {id:"scenarios", label:"Site Scenarios"}
];
var state = {tab:"overview"};

// ====================================================================
// Helpers
// ====================================================================
function fmt(n){ if(n===null||n===undefined||isNaN(n))return"—"; return Math.round(n).toLocaleString(); }
function f1(n){ return Number(n).toFixed(1); }
function f2(n){ return Number(n).toFixed(2); }
function pct(n){ return (n*100).toFixed(1)+"%"; }
function $(s){ return document.querySelector(s); }
function el(tag,attrs,kids){
  var e=document.createElement(tag);
  if(attrs)for(var k in attrs){ if(k==="class")e.className=attrs[k];
    else if(k==="html")e.innerHTML=attrs[k];
    else if(k.indexOf("on")===0)e.addEventListener(k.slice(2),attrs[k]);
    else e.setAttribute(k,attrs[k]); }
  (kids||[]).forEach(function(c){ if(typeof c==="string")e.appendChild(document.createTextNode(c)); else if(c)e.appendChild(c); });
  return e;
}
function kpi(label,val){ return el("div",{class:"kpi"},[el("div",{class:"v"},[val]),el("div",{class:"l"},[label])]); }
function tr(cells){ var r=el("tr"); cells.forEach(function(c,i){ r.appendChild(el(i===0?"th":"td",null,[String(c)])); }); return r; }

function catNSF(cat){
  return cat.rooms.reduce(function(a,r){ return a + (Number(r.qty)||0)*(Number(r.size)||0); },0);
}
function programNSF(){
  return S.program_categories.reduce(function(a,c){ return a + catNSF(c); },0);
}
function programDGSF(){
  return Math.round(programNSF() / S.settings.n_g_ratio);
}

// ====================================================================
// Header / shell
// ====================================================================
function renderHeader(){
  $("#hdr-version").textContent = S.project.version;
  var n = programNSF();
  $("#hdr-totals").innerHTML = "Model clinic: <b>"+fmt(n)+"</b> NSF · <b>"+fmt(programDGSF())+"</b> DGSF (target "+fmt(S.settings.target_dgsf)+")";
  $("#footer").textContent = S.project.name+" · "+S.project.version+" · Generated "+S.project.generated+" · Payette";
}
function renderTabs(){
  var t = $("#tabs"); t.innerHTML="";
  TABS.forEach(function(tab){
    var b = el("button",{class:(state.tab===tab.id?"on":""),onclick:function(){ state.tab=tab.id; render(); }}, [tab.label]);
    t.appendChild(b);
  });
}

// ====================================================================
// OVERVIEW TAB
// ====================================================================
function tabOverview(){
  var v = el("div");

  var kpis = el("div",{class:"kpis"});
  var n = programNSF();
  var examCount = 0, roomTypes = 0;
  S.program_categories.forEach(function(c){
    roomTypes += c.rooms.length;
    c.rooms.forEach(function(r){ if(/exam/i.test(r.name)) examCount += Number(r.qty)||0; });
  });
  kpis.appendChild(kpi("Program NSF", fmt(n)));
  kpis.appendChild(kpi("Target DGSF", fmt(S.settings.target_dgsf)));
  kpis.appendChild(kpi("Implied DGSF", fmt(programDGSF())));
  kpis.appendChild(kpi("N:G assumed", f2(S.settings.n_g_ratio)));
  kpis.appendChild(kpi("Exam Rooms", fmt(examCount)));
  kpis.appendChild(kpi("Space Types", fmt(roomTypes)));
  v.appendChild(el("div",{class:"card"},[
    el("h3",null,["Model Program Snapshot"]),
    el("div",{class:"note",style:"margin-bottom:8px"},[S.project.program_title]),
    kpis
  ]));

  // Program mix bar
  var mix = el("div",{class:"card"},[el("h3",null,["Program Mix"])]);
  S.program_categories.forEach(function(c){
    var cn = catNSF(c);
    mix.appendChild(el("div",{style:"display:flex;align-items:center;gap:8px;margin:6px 0"},[
      el("span",{class:"dot",style:"background:"+c.color}),
      el("span",{style:"min-width:230px;font-size:12px;font-weight:600"},[c.code+" "+c.name]),
      el("div",{class:"bar",style:"flex:1"},[
        el("div",{style:"background:"+c.color+";width:"+(n?(cn/n*100).toFixed(1):0)+"%"}),
        el("div",{class:"bar-lbl"},[fmt(cn)+" NSF · "+(n?(cn/n*100).toFixed(0):0)+"%"])
      ])
    ]));
  });
  v.appendChild(mix);

  // Key buildings
  var bcard = el("div",{class:"card"},[el("h3",null,["Key Buildings — Burlington Campus"])]);
  var bt = el("table");
  bt.appendChild(el("tr",null,[
    el("th",null,["Building"]), el("th",null,["Levels"]), el("th",{class:"num"},["Approx. Plate Range"]),
    el("th",{class:"num"},["Approx. Total GSF"]), el("th",{class:"num"},["Placed NSF"]), el("th",null,["Notes"])
  ]));
  BLDG_REGISTRY.forEach(function(b){
    var plates = b.levels.map(function(l){return l.plate;});
    var total = plates.reduce(function(a,p){return a+p;},0);
    var placed = (typeof ssPlacedNSFForBuilding==="function") ? ssPlacedNSFForBuilding(b.id) : 0;
    bt.appendChild(el("tr",null,[
      el("td",null,[el("span",{class:"dot",style:"background:"+(BLDG_COLORS[b.id]||"#ccc")}), el("b",null,[b.name])]),
      el("td",null,[String(b.levels.length)+" ("+b.levels[0].label+"–"+b.levels[b.levels.length-1].label+")"]),
      el("td",{class:"num"},[fmt(Math.min.apply(null,plates))+" – "+fmt(Math.max.apply(null,plates))+" SF"]),
      el("td",{class:"num"},[fmt(total)+" SF"]),
      el("td",{class:"num"},[placed>0?fmt(placed)+" NSF":"—"]),
      el("td",{style:"font-size:12px;color:#555"},[b.sub])
    ]));
  });
  bcard.appendChild(bt);
  bcard.appendChild(el("div",{class:"note"},["Floor plates measured from the vector site plan / floor outlines (C. Booth, 2026-07-22) — approximate, for planning only. Placed NSF reflects the active site scenario."]));
  v.appendChild(bcard);

  // Site aerial
  v.appendChild(el("div",{class:"card"},[
    el("h3",null,["Campus 3D Site Plan"]),
    el("img",{src:"assets/siteplan_3d_color.jpg",style:"width:100%;max-width:1100px;border:1px solid var(--line);border-radius:4px",alt:"Burlington campus 3D site plan"})
  ]));

  // FICM legend (codes used in the program)
  var used = {};
  S.program_categories.forEach(function(c){ c.rooms.forEach(function(r){ if(r.ficm) used[r.ficm]=true; }); });
  var leg = el("div",{class:"card"},[el("h3",null,["FICM / Healthcare Color Legend (codes in use)"])]);
  var legrow = el("div",{class:"legend"});
  FICM_CATALOG.forEach(function(f){
    if(!used[f.code]) return;
    legrow.appendChild(el("span",null,[el("span",{class:"dot",style:"background:"+f.hex}), f.code+" — "+f.label]));
  });
  leg.appendChild(legrow);
  v.appendChild(leg);

  // Project meta
  v.appendChild(el("div",{class:"card"},[
    el("h3",null,["Project Meta"]),
    el("table",null,[
      tr(["Project", S.project.name]),
      tr(["Client",  S.project.client]),
      tr(["Location",S.project.location]),
      tr(["Model program", S.project.program_title]),
      tr(["N:G ratio (assumed)", f2(S.settings.n_g_ratio)+" (grossing factor "+f2(1/S.settings.n_g_ratio)+")"]),
      tr(["Generated", S.project.generated])
    ])
  ]));
  return v;
}

// ====================================================================
// PROGRAM TAB — fully editable
// ====================================================================
function tabProgram(){
  var v = el("div");
  var cats = S.program_categories;

  var card = el("div",{class:"card"},[
    el("h3",null,["Outpatient Clinic — Editable Model Program"]),
    el("div",{class:"note"},["Click any cell to edit. Drag a row's ⋮⋮ handle to reorder it within a category, or drop it onto a different category to move it there. Drag a category's ⋮⋮ handle to reorder categories. FICM tints the row. People = Qty × Seats (calculated automatically). Click Notes to open the multiline editor."])
  ]);

  cats.forEach(function(cat, ci){
    var catColor = cat.color;
    var catName = cat.code+" "+cat.name;
    var rooms = cat.rooms || (cat.rooms=[]);
    var catTotal = catNSF(cat);

    var wrap = el("div",{class:"prog-cat",draggable:"true","data-ci":ci});
    var head = el("div",{class:"prog-cat-head",style:"background:"+catColor},[
      el("span",{class:"cat-drag-handle",title:"Drag to reorder category"},["⋮⋮"]),
      el("input",{type:"text",value:catName,style:"flex:1;font-weight:800;font-size:14px;border:none;background:transparent;color:#1F2A44",
        onchange:function(e){ cat.name = e.target.value.replace(/^[A-Z]\d+\s*/,""); }
      }),
      el("span",{class:"nasf-total"},[fmt(catTotal)+" NSF"]),
      el("button",{title:"Add room",onclick:function(){
        rooms.push({id:"new_"+Date.now(),name:"New room",qty:1,size:100,seats:null,notes:"",ficm:defaultFicmForRoom(cat),comfort:"",circulation:""});
        render();
      }},["+ Room"]),
      el("button",{title:"Delete category",style:"color:#C0392B",onclick:function(){
        if(confirm("Delete category “"+catName+"” and all its rooms?")){
          cats.splice(ci,1); render();
        }
      }},["✕"])
    ]);
    wrap.appendChild(head);

    // Category drag-and-drop (reorder categories, or accept a row dropped on the category)
    wrap.addEventListener("dragstart", function(e){
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/category", String(ci));
      wrap.classList.add("dragging");
    });
    wrap.addEventListener("dragend", function(){
      wrap.classList.remove("dragging");
      Array.prototype.forEach.call(card.querySelectorAll(".prog-cat"), function(w2){
        w2.classList.remove("cat-drag-over-top"); w2.classList.remove("cat-drag-over-bottom"); w2.classList.remove("cat-row-drop-target");
      });
    });
    wrap.addEventListener("dragover", function(e){
      var types = e.dataTransfer.types;
      var isCatDrag = Array.prototype.includes.call(types, "text/category");
      var isRowDrag = Array.prototype.includes.call(types, "text/plain");
      if(!isCatDrag && !isRowDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if(isCatDrag){
        var rect = wrap.getBoundingClientRect();
        var before = (e.clientY - rect.top) < rect.height/2;
        wrap.classList.toggle("cat-drag-over-top", before);
        wrap.classList.toggle("cat-drag-over-bottom", !before);
      } else {
        wrap.classList.add("cat-row-drop-target");
      }
    });
    wrap.addEventListener("dragleave", function(){
      wrap.classList.remove("cat-drag-over-top"); wrap.classList.remove("cat-drag-over-bottom"); wrap.classList.remove("cat-row-drop-target");
    });
    wrap.addEventListener("drop", function(e){
      wrap.classList.remove("cat-drag-over-top"); wrap.classList.remove("cat-drag-over-bottom"); wrap.classList.remove("cat-row-drop-target");
      var catRaw = e.dataTransfer.getData("text/category");
      if(catRaw !== ""){
        e.preventDefault(); e.stopPropagation();
        var srcCi = parseInt(catRaw,10);
        if(srcCi === ci) return;
        var rect = wrap.getBoundingClientRect();
        var before = (e.clientY - rect.top) < rect.height/2;
        var insertAt = before ? ci : ci+1;
        var movedCat = cats.splice(srcCi, 1)[0];
        if(srcCi < insertAt) insertAt -= 1;
        cats.splice(insertAt, 0, movedCat);
        render();
        return;
      }
      var rowRaw = e.dataTransfer.getData("text/plain");
      if(rowRaw !== ""){
        e.preventDefault(); e.stopPropagation();
        var src = rowRaw.split(":");
        if(src.length!==2) return;
        var srcCat = parseInt(src[0],10), srcRow = parseInt(src[1],10);
        var srcRooms = cats[srcCat] && cats[srcCat].rooms;
        if(!srcRooms) return;
        if(srcCat === ci) return;
        var moved = srcRooms.splice(srcRow, 1)[0];
        rooms.push(moved);
        render();
      }
    });

    var t = el("table",{class:"prog-tbl"});
    var hdRow = el("tr",null,[
      el("th",{style:"width:18px"},[""]),
      el("th",{style:"width:30px"},["#"]),
      el("th",{style:"min-width:180px"},["Space"]),
      el("th",{class:"num col-qty"},["Qty"]),
      el("th",{class:"num col-size"},["Size Ea"]),
      el("th",{class:"num col-nasf"},["NSF"]),
      el("th",{class:"num col-seats"},["Seats"]),
      el("th",{class:"num col-sfseat"},["SF/Seat"]),
      el("th",{class:"num col-people"},["People"]),
      el("th",{class:"col-ficm",style:"text-align:center"},["FICM"]),
      el("th",null,["Space Comfort"]),
      el("th",null,["Circulation"]),
      el("th",{class:"col-aspect"},["Max AR"]),
      el("th",{class:"col-height"},["Room Height"]),
      el("th",null,["Notes"]),
      el("th",{style:"width:30px"},[""])
    ]);
    t.appendChild(hdRow);

    rooms.forEach(function(r, ri){
      if(r.ficm===undefined || r.ficm===null) r.ficm = defaultFicmForRoom(cat);
      if(r.comfort===undefined) r.comfort = "";
      if(r.circulation===undefined) r.circulation = "";

      var rowNASF = (Number(r.qty)||0)*(Number(r.size)||0);
      var rowPeople = (Number(r.qty)||0)*(Number(r.seats)||0);
      var ficmHexValue = ficmHex(r.ficm) || catColor;

      var trEl = el("tr",{
        draggable:"true",
        "data-cat":ci,
        "data-row":ri,
        style:"background:"+ficmHexValue+"22"
      },[
        el("td",{class:"drag-cell",title:"Drag to reorder"},["⋮⋮"]),
        el("td",{class:"row-num"},[String(ri+1)]),
        el("td",{style:"min-width:180px"},[textCell(r,"name")]),
        el("td",{class:"num col-qty"},[numCell(r,"qty")]),
        el("td",{class:"num col-size"},[numCell(r,"size")]),
        el("td",{class:"num col-nasf"},[el("b",null,[fmt(rowNASF)])]),
        el("td",{class:"num col-seats"},[numCell(r,"seats")]),
        el("td",{class:"num col-sfseat"},[sfPerSeatCell(r)]),
        el("td",{class:"num col-people"},[el("b",{style:"color:#1F2A44"},[fmt(rowPeople)])]),
        el("td",{class:"ficm-cell"},[ficmSelectCell(r)]),
        el("td",{class:"choice-cell"},[choiceSelectCell(r,"comfort",COMFORT_CHOICES)]),
        el("td",{class:"choice-cell"},[choiceSelectCell(r,"circulation",CIRCULATION_CHOICES)]),
        el("td",{class:"col-aspect"},[aspectRatioCell(r)]),
        el("td",{class:"col-height"},[roomHeightCell(r)]),
        el("td",{style:"min-width:120px"},[notesCell(r)]),
        el("td",null,[el("button",{class:"del-btn",onclick:function(){
          rooms.splice(ri,1); render();
        }},["✕"])])
      ]);

      trEl.addEventListener("dragstart", function(e){
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", ci+":"+ri);
        trEl.classList.add("dragging");
      });
      trEl.addEventListener("dragend", function(e){
        e.stopPropagation();
        trEl.classList.remove("dragging");
        Array.prototype.forEach.call(t.querySelectorAll("tr"), function(r2){
          r2.classList.remove("drag-over-top"); r2.classList.remove("drag-over-bottom");
        });
      });
      trEl.addEventListener("dragover", function(e){
        if(!Array.prototype.includes.call(e.dataTransfer.types, "text/plain")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        var rect = trEl.getBoundingClientRect();
        var before = (e.clientY - rect.top) < rect.height/2;
        trEl.classList.toggle("drag-over-top", before);
        trEl.classList.toggle("drag-over-bottom", !before);
      });
      trEl.addEventListener("dragleave", function(e){
        e.stopPropagation();
        trEl.classList.remove("drag-over-top"); trEl.classList.remove("drag-over-bottom");
      });
      trEl.addEventListener("drop", function(e){
        var raw = (e.dataTransfer.getData("text/plain")||"");
        if(raw==="") return;
        e.preventDefault();
        e.stopPropagation();
        trEl.classList.remove("drag-over-top"); trEl.classList.remove("drag-over-bottom");
        var src = raw.split(":");
        if(src.length!==2) return;
        var srcCat = parseInt(src[0],10), srcRow = parseInt(src[1],10);
        if(srcCat === ci && srcRow === ri) return;
        var srcRooms = cats[srcCat] && cats[srcCat].rooms;
        if(!srcRooms) return;
        var rect = trEl.getBoundingClientRect();
        var before = (e.clientY - rect.top) < rect.height/2;
        var insertAt = before ? ri : ri+1;
        var moved = srcRooms.splice(srcRow, 1)[0];
        if(srcCat === ci && srcRow < insertAt) insertAt -= 1;
        rooms.splice(insertAt, 0, moved);
        render();
      });

      t.appendChild(trEl);
    });
    wrap.appendChild(t);
    wrap.appendChild(el("div",{class:"prog-totals"},[
      el("span",null,["Category Total: "+fmt(catTotal)+" NSF · " + rooms.length + " space types"])
    ]));
    card.appendChild(wrap);
  });

  card.appendChild(el("button",{class:"add-cat",onclick:function(){
    var name = prompt("New category name:");
    if(!name) return;
    cats.push({code:"C"+(cats.length+1), name:name, color:"#E3E6EC", rooms:[]});
    render();
  }},["+ Add Category"]));

  var n = programNSF();
  card.appendChild(el("div",{style:"margin-top:14px;padding:14px;background:#1F2A44;color:#fff;border-radius:6px;display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:16px"},[
    el("span",null,["TOTAL OUTPATIENT CLINIC"]),
    el("span",null,[fmt(n)+" NSF · "+fmt(programDGSF())+" DGSF @ N:G "+f2(S.settings.n_g_ratio)+" (target "+fmt(S.settings.target_dgsf)+" DGSF)"])
  ]));
  v.appendChild(card);
  return v;
}

// FICM picker — swatch-only (colored square opens the dropdown of all codes)
function ficmSelectCell(r){
  var entry = ficmEntry(r.ficm);
  var hex = (entry && entry.hex) || "#E3E6EC";
  var box = el("span",{class:"ficm-pick",title:(entry?(entry.code+" — "+entry.label):"Pick FICM color"),style:"background:"+hex});
  var sel = document.createElement("select");
  var groups = {};
  FICM_CATALOG.forEach(function(f){
    if(!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });
  Object.keys(groups).forEach(function(g){
    var og = document.createElement("optgroup"); og.label = g;
    groups[g].forEach(function(f){
      var o = document.createElement("option");
      o.value = f.code;
      o.textContent = f.code+" — "+f.label;
      o.style.background = f.hex;
      o.style.color = "#1F2A44";
      if(r.ficm===f.code) o.selected = true;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.addEventListener("change", function(){ r.ficm = sel.value; render(); });
  box.appendChild(sel);
  return box;
}

// Generic choice dropdown (Comfort, Circulation) — blank-default
function choiceSelectCell(r, key, choices){
  var sel = document.createElement("select");
  var blank = document.createElement("option"); blank.value=""; blank.textContent="—";
  sel.appendChild(blank);
  choices.forEach(function(c){
    var o = document.createElement("option");
    o.value = c; o.textContent = c;
    if(r[key]===c) o.selected = true;
    sel.appendChild(o);
  });
  if(!r[key]) sel.classList.add("empty");
  sel.addEventListener("change", function(){
    r[key] = sel.value;
    if(!sel.value) sel.classList.add("empty"); else sel.classList.remove("empty");
    render();
  });
  return sel;
}

// Notes cell with popup textarea
function notesCell(r){
  var preview = (r.notes || "").substring(0, 40);
  if(r.notes && r.notes.length > 40) preview += "...";
  var btn = el("button", {
    class: "notes-btn",
    title: "Click to edit notes",
    onclick: function(){
      var popup = el("div", {class: "notes-popup"});
      var overlay = el("div", {class: "notes-overlay", onclick: function(e){
        if(e.target === overlay) closePopup();
      }});
      var textarea = el("textarea", {
        placeholder: "Enter notes...",
        style: "width:100%;height:120px;padding:8px;border:1px solid #ccd2dc;border-radius:4px;resize:vertical;font-family:inherit;font-size:13px;"
      });
      textarea.value = r.notes || "";
      var saveBtn = el("button", {
        onclick: function(){ r.notes = textarea.value; render(); closePopup(); },
        style: "padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;margin-right:6px;cursor:pointer;"
      }, ["Save"]);
      var cancelBtn = el("button", {
        onclick: closePopup,
        style: "padding:6px 12px;background:#ddd;color:#333;border:none;border-radius:4px;cursor:pointer;"
      }, ["Cancel"]);
      function closePopup(){ document.body.removeChild(overlay); }
      popup.appendChild(el("div", {style: "margin-bottom:8px;font-weight:600;color:#1F2A44;"}, ["Edit Notes"]));
      popup.appendChild(textarea);
      popup.appendChild(el("div", {style: "margin-top:12px;display:flex;justify-content:flex-end;"}, [saveBtn, cancelBtn]));
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
      textarea.focus();
    }
  }, [preview || "Notes..."]);
  return btn;
}
function textCell(obj,key){
  var i = el("input",{type:"text",value: obj[key]==null?"":obj[key]});
  i.addEventListener("change",function(){ obj[key]=i.value; render(); });
  return i;
}
function numCell(obj,key){
  var i = el("input",{type:"text",class:"num",value: obj[key]==null?"":obj[key]});
  i.addEventListener("change",function(){
    var v = i.value.trim()===""?null:parseFloat(i.value.replace(/,/g,""));
    obj[key]=(isNaN(v)?null:v); render();
  });
  return i;
}
// Editable SF/Seat: derived from size/seats; editing back-solves size = SF/Seat × seats
function sfPerSeatCell(r){
  var seats = Number(r.seats)||0;
  var size  = Number(r.size)||0;
  if(seats<=0) return el("span",{style:"color:#999"},["—"]);
  var i = el("input",{type:"text",class:"num",value: f1(size/seats), title:"Edit to back-solve Size Ea = SF/Seat × Seats"});
  i.addEventListener("change",function(){
    var v = parseFloat(i.value.replace(/,/g,""));
    if(!isNaN(v) && v>0){
      r.size = Math.round(v * seats);
    }
    render();
  });
  return i;
}
// Aspect ratio — used to shape program rects in Site Scenarios
function aspectRatioCell(r){
  var i = el("input",{type:"text",class:"aspect-inp",value: r.aspect_ratio ? String(r.aspect_ratio) : "",placeholder:"e.g. 2"});
  i.addEventListener("change",function(){
    var v = parseFloat(i.value.replace(/[^0-9.]/g,""));
    r.aspect_ratio = (isNaN(v)||v<=0) ? null : v;
  });
  return i;
}
// Room floor-to-ceiling height (ft)
function roomHeightCell(r){
  var i = el("input",{type:"text",class:"aspect-inp",value: r.room_height ? String(r.room_height) : "",placeholder:"e.g. 9"});
  i.addEventListener("change",function(){
    var v = parseFloat(i.value.replace(/[^0-9.]/g,""));
    r.room_height = (isNaN(v)||v<=0) ? null : v;
  });
  return i;
}

// ====================================================================
// EXPORT / IMPORT
// ====================================================================
function exportJSON(){
  var data = {
    _type: "BILH_Burlington_Dashboard",
    _version: "1.0",
    _exported: new Date().toISOString(),
    state: S,
    scenarios: (typeof SS!=="undefined") ? SS.scenarios : []
  };
  var dataStr = "data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(data,null,2));
  var a=document.createElement("a"); a.setAttribute("href",dataStr); a.setAttribute("download","BILH_Burlington_Dashboard_state.json");
  document.body.appendChild(a); a.click(); a.remove();
}
function importJSON(ev){
  var f=ev.target.files[0]; if(!f)return;
  var r=new FileReader();
  r.onload=function(e){
    try{
      var ns = JSON.parse(e.target.result);
      // Accept both the wrapped export format and a bare state object
      var st = ns.state || ns;
      if(!st.program_categories || !st.project){ alert("This JSON doesn't look like a BILH Burlington Dashboard state file."); return; }
      S = st;
      if(Array.isArray(ns.scenarios) && ns.scenarios.length && typeof SS!=="undefined"){
        SS.scenarios = ns.scenarios;
        SS.activeScenario = 0; SS.activeBuilding = 0;
      }
      render();
      alert("State imported. All tabs updated.");
    }catch(err){ alert("JSON parse error: "+err.message); }
  };
  r.readAsText(f);
  ev.target.value="";
}
function exportXLSX(){
  if(typeof XLSX==="undefined"){ alert("Excel export requires internet access (loads SheetJS from CDN). State JSON export still works offline."); return; }
  var wb = XLSX.utils.book_new();

  // README
  var ro = [
    ["BILH Burlington Planning Dashboard — Exported Program Workbook"],
    ["Version", S.project.version],
    ["Project", S.project.name],
    ["Model program", S.project.program_title],
    ["Generated", new Date().toISOString().slice(0,10)]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ro), "README");

  // Program
  var rows = [
    ["BILH Burlington — Outpatient Clinic Model Program"],
    ["Generated: "+(new Date().toISOString().slice(0,10))],
    [],
    ["Program Group","#","Space Description","Qty","Size Ea","Area NSF","Seats","SF/Seat","People","FICM","Space Comfort","Circulation","Notes"]
  ];
  var grandTotal = 0;
  S.program_categories.forEach(function(c){
    var catTotal = catNSF(c);
    grandTotal += catTotal;
    rows.push([c.code+" "+c.name, "", "", "", "", catTotal, "", "", "", "", "", "", ""]);
    c.rooms.forEach(function(r, ri){
      var nasf = (Number(r.qty)||0)*(Number(r.size)||0);
      var people = (Number(r.qty)||0)*(Number(r.seats)||0);
      var sfPerSeat = (r.seats && r.seats > 0) ? Math.round(nasf / people) : "";
      rows.push(["", ri+1, r.name, r.qty||"", r.size||"", nasf, r.seats||"", sfPerSeat, people, r.ficm||"", r.comfort||"", r.circulation||"", r.notes||""]);
    });
  });
  rows.push([]);
  rows.push(["TOTAL NSF","","","","",grandTotal,"","","","","","",""]);
  rows.push(["TOTAL DGSF @ N:G "+f2(S.settings.n_g_ratio),"","","","",Math.round(grandTotal/S.settings.n_g_ratio),"","","","","","",""]);
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:30},{wch:5},{wch:38},{wch:8},{wch:10},{wch:12},{wch:8},{wch:8},{wch:8},{wch:8},{wch:18},{wch:18},{wch:32}];
  XLSX.utils.book_append_sheet(wb, ws, "Program");

  // Buildings (per level, with placed NSF from active scenario)
  var bl = [["Building","Level","Approx. Plate SF","Placed NSF (active scenario)","Utilization @ N:G "+f2(S.settings.n_g_ratio)]];
  BLDG_REGISTRY.forEach(function(b){
    b.levels.forEach(function(lvl, li){
      var placed = (typeof ssPlacedNSFForLevel==="function") ? ssPlacedNSFForLevel(b.id, li) : 0;
      var cap = lvl.plate * S.settings.n_g_ratio;
      bl.push([b.name, lvl.label, lvl.plate, placed, cap>0?placed/cap:0]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bl), "Buildings");

  // Summary
  var sumS = [
    ["Summary"],
    [],
    ["Model program NSF", grandTotal],
    ["Implied DGSF @ N:G "+f2(S.settings.n_g_ratio), Math.round(grandTotal/S.settings.n_g_ratio)],
    ["Target DGSF", S.settings.target_dgsf],
    []
  ];
  BLDG_REGISTRY.forEach(function(b){
    var total = b.levels.reduce(function(a,l){return a+l.plate;},0);
    sumS.push([b.name+" — approx. total GSF", total]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumS), "Summary");

  XLSX.writeFile(wb, "BILH_Burlington_Dashboard_export.xlsx");
}

// ====================================================================
// ROOM ID GENERATION (for graphic export)
// ====================================================================
function getCatAbbrev(catName){
  return catName.replace(/[^A-Za-z ]/g,"").split(" ").filter(Boolean).map(function(w){return w[0].toUpperCase();}).join("").slice(0,3);
}
function getRoomAbbrev(roomName){
  var clean = roomName.replace(/[^A-Za-z ]/g," ").trim();
  var words = clean.split(/\s+/).filter(function(w){return w.length>0;});
  if(!words.length) return "RMX";
  return words[0].toUpperCase().slice(0,3);
}
function generateRoomId(catAbbrev, roomAbbrev, index){
  var n = String(index+1);
  while(n.length<3) n = "0"+n;
  return catAbbrev+"_"+roomAbbrev+"_"+n;
}

// ====================================================================
// GRAPHIC PROGRAM SVG EXPORT
// ====================================================================
function exportGraphicProgramSVG(){
  var SCALE = 0.08;      // px per SF
  var MARGIN = 18;
  var CAT_GAP = 32;
  var ROOM_GAP = 4;
  var COL_GAP = 4;
  var MAX_COL_HEIGHT = 420;
  var FONT = "Roboto, Helvetica Neue, Arial, sans-serif";

  function darkenHex(hex, p){
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    var f=1-p;
    return "#"+[Math.round(r*f),Math.round(g*f),Math.round(b*f)].map(function(v){return v.toString(16).padStart(2,"0");}).join("");
  }
  function escXml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  var allCatGroups = [];
  S.program_categories.forEach(function(cat){
    var catAbbrev = getCatAbbrev(cat.name);
    var rects = [];
    cat.rooms.forEach(function(r){
      var qty = Number(r.qty)||0;
      var nsf = Number(r.size)||0;
      if(qty<=0 || nsf<=0) return;
      var maxAr = parseFloat(r.aspect_ratio)||2.0;
      if(maxAr < 1) maxAr = 1;
      var areaPx = nsf * SCALE;
      var w = Math.sqrt(areaPx * maxAr);
      var h = areaPx / w;
      if(w < 6){ w=6; h=areaPx/6; }
      if(h < 4){ h=4; w=areaPx/4; }
      w = Math.round(w); h = Math.round(h);
      var roomAbbrev = getRoomAbbrev(r.name);
      for(var i=0;i<qty;i++){
        rects.push({
          w:w, h:h, nsf:nsf,
          id: generateRoomId(catAbbrev, roomAbbrev, i),
          name: r.name,
          color: (ficmHex(r.ficm)||cat.color||"#E3E6EC"),
          strokeColor: darkenHex(ficmHex(r.ficm)||cat.color||"#E3E6EC", 0.35)
        });
      }
    });
    if(rects.length>0) allCatGroups.push({name:cat.code+" "+cat.name, color:cat.color, rects:rects, abbrev:catAbbrev});
  });

  if(allCatGroups.length===0){ alert("No rooms to export."); return; }

  function layoutCategory(rects){
    var sorted = rects.slice().sort(function(a,b){return (b.w*b.h)-(a.w*a.h);});
    var cols = [];
    sorted.forEach(function(rect){
      var placed = false;
      for(var ci=0;ci<cols.length;ci++){
        var col = cols[ci];
        var usedH = col.items.reduce(function(s,it){return s+it.rect.h+ROOM_GAP;},0);
        if(usedH + rect.h <= MAX_COL_HEIGHT){
          col.items.push({rect:rect, y:usedH});
          placed = true; break;
        }
      }
      if(!placed){
        cols.push({items:[{rect:rect, y:0}]});
      }
    });
    return cols;
  }

  var svgGroups = [];
  var cursorX = MARGIN;
  var totalHeight = 0;

  allCatGroups.forEach(function(grp){
    var cols = layoutCategory(grp.rects);
    var colXs = [], groupW = 0;
    cols.forEach(function(col, ci){
      colXs.push(groupW);
      var colW = col.items.reduce(function(mx,it){return Math.max(mx,it.rect.w);},0);
      col.colW = colW;
      groupW += colW + (ci<cols.length-1?COL_GAP:0);
    });
    var labelH = 28;
    var catH = 0;
    cols.forEach(function(col){
      var h = col.items.reduce(function(s,it){return s+it.rect.h+ROOM_GAP;},0);
      if(h>catH) catH=h;
    });
    svgGroups.push({grp:grp, cols:cols, colXs:colXs, x:cursorX, w:groupW, h:catH+labelH, labelH:labelH});
    totalHeight = Math.max(totalHeight, catH+labelH);
    cursorX += groupW + CAT_GAP;
  });

  var svgW = cursorX - CAT_GAP + MARGIN;
  var svgH = totalHeight + MARGIN*2;

  var svgParts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+svgW+'" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'">',
    '<rect width="'+svgW+'" height="'+svgH+'" fill="#FAFAFA"/>',
    '<style>text{font-family:'+FONT+';}</style>'
  ];

  svgGroups.forEach(function(sg){
    var gx = sg.x, gy = MARGIN;
    svgParts.push('<rect x="'+gx+'" y="'+gy+'" width="'+sg.w+'" height="'+(sg.labelH-4)+'" fill="'+sg.grp.color+'"/>');
    svgParts.push('<text x="'+(gx+6)+'" y="'+(gy+sg.labelH-10)+'" font-size="10" font-weight="800" fill="#1F2A44">'+escXml(sg.grp.name)+'</text>');

    sg.cols.forEach(function(col, ci){
      var colX = gx + sg.colXs[ci];
      col.items.forEach(function(it){
        var rx = colX;
        var ry = gy + sg.labelH + it.y;
        var rw = it.rect.w, rh = it.rect.h;
        svgParts.push('<rect x="'+rx+'" y="'+ry+'" width="'+rw+'" height="'+rh+'" fill="'+it.rect.color+'" stroke="'+it.rect.strokeColor+'" stroke-width="1">');
        svgParts.push('<title>'+escXml(it.rect.id+' | '+it.rect.name+' | '+it.rect.nsf+' NSF')+'</title>');
        svgParts.push('</rect>');
        svgParts.push('<desc data-id="'+escXml(it.rect.id)+'">'+escXml(it.rect.name)+'</desc>');
        if(rh >= 14 && rw >= 24){
          svgParts.push('<text x="'+(rx+3)+'" y="'+(ry+rh-3)+'" font-size="7" fill="#1F2A4499" font-weight="600">'+escXml(it.rect.id)+'</text>');
        }
        svgParts.push('<rect id="'+escXml(it.rect.id)+'" x="'+rx+'" y="'+ry+'" width="'+rw+'" height="'+rh+'" fill="transparent" stroke="none"/>');
      });
    });
  });

  svgParts.push('</svg>');
  var svgStr = svgParts.join("\n");

  var blob = new Blob([svgStr], {type:"image/svg+xml"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "BILH_Burlington_Graphic_Program.svg";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ====================================================================
// Master render
// ====================================================================
function render(){
  renderHeader();
  renderTabs();
  var v = $("#view"); v.innerHTML="";
  var fn = ({overview:tabOverview,program:tabProgram,scenarios:tabSiteScenarios})[state.tab];
  if(fn) v.appendChild(fn());
}
