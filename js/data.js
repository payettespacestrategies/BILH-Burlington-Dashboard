// ====================================================================
// BILH BURLINGTON PLANNING DASHBOARD — INITIAL STATE
// Model program: BIDMC Chestnut Square Outpatient Practice
// (10,000 DGSF outpatient clinic — per M. Hinchcliffe email 2026-07-17)
// ====================================================================
var S = {
  project: {
    name: "BILH Burlington Planning Dashboard",
    client: "Beth Israel Lahey Health",
    location: "Burlington, Massachusetts",
    program_title: "BIDMC Chestnut Square Outpatient Practice — model program for a 10,000 DGSF outpatient clinic",
    version: "v0.1 · 2026-07-22",
    generated: "2026-07-22"
  },
  settings: {
    target_dgsf: 10000,   // model clinic target
    n_g_ratio: 0.65       // assumed net-to-gross for capacity checks
  },
  program_categories: [
    {
      code: "C1", name: "Exam & Consultation", color: "#96EBF6",
      rooms: [
        {id:"c1_exam",    name:"Examination Room",                qty:16, size:100, seats:null, notes:"", ficm:"HC-7b", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9},
        {id:"c1_minor",   name:"Exam Room — Minor Procedure",     qty:2,  size:140, seats:null, notes:"", ficm:"HC-7b", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9},
        {id:"c1_pos",     name:"Exam Room — Patient of Size",     qty:1,  size:200, seats:null, notes:"", ficm:"HC-7b", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9},
        {id:"c1_consult", name:"Consultation Room",               qty:2,  size:100, seats:4,    notes:"", ficm:"HC-7b", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9}
      ]
    },
    {
      code: "C2", name: "Patient Support", color: "#FFF4C7",
      rooms: [
        {id:"c2_wait",    name:"Waiting Room",                    qty:1,  size:580, seats:25,   notes:"", ficm:"HC-7d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.75, room_height:10},
        {id:"c2_checkin", name:"Check-in / Check-out",            qty:1,  size:246, seats:4,    notes:"", ficm:"HC-7d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:2,    room_height:9},
        {id:"c2_vitals",  name:"Vitals Area",                     qty:2,  size:80,  seats:1,    notes:"", ficm:"HC-7d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c2_wc",      name:"Patient Toilet Room",             qty:6,  size:60,  seats:null, notes:"", ficm:"HC-7d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9},
        {id:"c2_wcpos",   name:"Patient Toilet — Patient of Size",qty:1,  size:80,  seats:null, notes:"", ficm:"HC-7d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9}
      ]
    },
    {
      code: "C3", name: "Clinical Support", color: "#52D1ED",
      rooms: [
        {id:"c3_nursing", name:"Nursing",                         qty:1,  size:140, seats:4,    notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.75, room_height:9},
        {id:"c3_ma",      name:"Medical Assistant Station",       qty:4,  size:35,  seats:1,    notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_meds",    name:"Medication Control Area",         qty:1,  size:80,  seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_clean",   name:"Clean Supply",                    qty:1,  size:100, seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_soiled",  name:"Soiled Utility",                  qty:1,  size:100, seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_equip",   name:"Equipment Storage",               qty:1,  size:100, seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_wheel",   name:"Wheelchair Alcove",               qty:2,  size:30,  seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c3_evs",     name:"Environmental Services",          qty:1,  size:50,  seats:null, notes:"", ficm:"HC-7a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9}
      ]
    },
    {
      code: "C4", name: "Staff & Administrative Support", color: "#98ACE5",
      rooms: [
        {id:"c4_office",  name:"Office",                          qty:3,  size:80,  seats:1,    notes:"", ficm:"1b", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c4_shared",  name:"Shared Work Area",                qty:5,  size:175, seats:6,    notes:"", ficm:"1c", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.75, room_height:9},
        {id:"c4_break",   name:"Break Room & Locker Area",        qty:1,  size:250, seats:10,   notes:"", ficm:"1a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.75, room_height:9},
        {id:"c4_supply",  name:"Office Supplies",                 qty:1,  size:80,  seats:null, notes:"", ficm:"1a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c4_conf",    name:"Conference / Interview Room",     qty:1,  size:250, seats:10,   notes:"", ficm:"3d", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c4_telemed", name:"Tele-med / Huddle / Dictation",   qty:3,  size:65,  seats:2,    notes:"", ficm:"1c", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.5,  room_height:9},
        {id:"c4_wc",      name:"Staff Toilet Room",               qty:3,  size:60,  seats:null, notes:"", ficm:"6a", comfort:"Indoor Conditioned", circulation:"", aspect_ratio:1.25, room_height:9}
      ]
    }
  ]
};

// ====================================================================
// KEY BUILDING REGISTRY — the three key buildings on the Burlington campus
// Floor plates are approximate, measured from Carolyn Booth's floor outline
// SVGs (2026-07-22) at the site plan scale (100 ft = 57.72 SVG units).
// ====================================================================
var BLDG_REGISTRY = [
  {
    id: "stilts", name: "Stilts", short: "ST",
    sub: "Medical Center — partially buried; 7 levels max",
    note: "Levels approximated from available plans (L1 / L2–L3 / L4–L6). Mechanical & buried portions not modeled.",
    gridFt: 900,
    siteLabel: [740, 1075],
    levels: [
      {label:"L1", svgKey:"stilts_L1",   plate:250500},
      {label:"L2", svgKey:"stilts_L2L3", plate:181000},
      {label:"L3", svgKey:"stilts_L2L3", plate:181000},
      {label:"L4", svgKey:"stilts_L456", plate:137000},
      {label:"L5", svgKey:"stilts_L456", plate:137000},
      {label:"L6", svgKey:"stilts_L456", plate:137000}
    ]
  },
  {
    id: "mall31", name: "31 Mall Road", short: "31M",
    sub: "2 levels; two 3-level towers (mech / elevator override — excluded)",
    note: "Both levels share the same footprint. Tower levels are mechanical / elevator override and are not counted.",
    gridFt: 400,
    siteLabel: [1172, 430],
    levels: [
      {label:"L1", svgKey:"mall31_L1L2", plate:31500},
      {label:"L2", svgKey:"mall31_L1L2", plate:31500}
    ]
  },
  {
    id: "sb67", name: "67 South Bedford", short: "67SB",
    sub: "4 levels max; steps up and down from 2 to 4 levels",
    note: "L1–L2 share the full footprint; the plate steps down at L3 and L4.",
    gridFt: 700,
    siteLabel: [1360, 1160],
    levels: [
      {label:"L1", svgKey:"sb67_L1L2", plate:61100},
      {label:"L2", svgKey:"sb67_L1L2", plate:61100},
      {label:"L3", svgKey:"sb67_L3",   plate:46300},
      {label:"L4", svgKey:"sb67_L4",   plate:35100}
    ]
  }
];
function bldgDef(id){ for(var i=0;i<BLDG_REGISTRY.length;i++){ if(BLDG_REGISTRY[i].id===id) return BLDG_REGISTRY[i]; } return null; }

// Highlight colors for the key buildings (site map + badges)
var BLDG_COLORS = { stilts:"#6DAEDB", mall31:"#82ddb3", sb67:"#ffc838" };

// Footprint outlines of the key buildings on the site plan SVG (site svg coords)
var SITE_KEY_FOOTPRINTS = {
  mall31: "1120.2 457.08 1157.16 457.08 1157.16 471 1174.44 471 1174.44 449.28 1195.32 449.28 1195.32 457.08 1224.12 457.08 1224.12 561 1195.32 561 1195.32 565.44 1174.44 565.44 1174.44 543.72 1157.16 543.72 1157.16 561 1120.2 561 1120.2 458.28",
  sb67: "1217.4 1068.6 1202.64 1062 1182.96 1106.28 1231.44 1128 1238.04 1113.24 1252.8 1119.84 1259.4 1104.96 1274.16 1111.56 1288.92 1078.2 1354.44 1107.48 1360.92 1092.72 1375.8 1099.2 1382.28 1084.44 1397.04 1091.04 1411.44 1058.76 1457.4 1079.16 1463.88 1064.52 1478.64 1071.12 1485.24 1056.36 1500.12 1062.84 1526.28 1003.68 1482.48 984.36 1469.4 1013.88 1421.16 992.28 1410.36 1015.92 1395.48 1009.44 1380.48 1043.28 1300.68 1007.52 1287.12 1036.92 1272.36 1030.44 1255.68 1067.88 1224 1053.84 1217.4 1068.6",
  stilts: "738.84 577.92 687.96 577.92 687.96 567.24 656.76 567.24 656.76 577.92 651.6 577.92 651.6 797.4 612.36 797.4 612.36 954.48 651.6 954.48 651.6 909.48 681.6 909.48 681.6 924.48 670.08 924.48 670.08 943.32 681.6 943.32 681.6 954.48 722.04 954.48 722.04 942.96 732.48 942.96 732.48 1023.84 820.2 1023.84 820.2 1034.76 828.84 1034.76 828.84 1023.84 862.44 1023.84 862.44 916.92 820.2 916.92 820.2 882.36 843.36 882.36 843.36 835.08 871.08 835.08 871.08 806.28 854.88 806.28 854.88 792.24 864.84 792.24 864.84 766.92 810.96 715.92 810.96 694.8 810.96 645 819.6 645 819.6 550.2 764.04 550.2 764.04 566.88 744.6 566.88 744.6 577.92 738.84 577.92"
};

// ====================================================================
// FICM / Healthcare color catalog (PAYETTE_FICM_TAXONOMY 04/16/2024
// "COLOR Groupings" + PAYETTE_HEALTHCARE_PLAN_COLORS "HC - OVERALL" 03/11/2022)
// ====================================================================
var FICM_CATALOG = [
  // ---- Office (FICM) ----
  {code:"1a",  hex:"#98ACE5", group:"Office",      label:"Office support — workroom, storage"},
  {code:"1b",  hex:"#B6CDEF", group:"Office",      label:"Office — enclosed"},
  {code:"1c",  hex:"#C5E1FF", group:"Office",      label:"Office — open / computational / write-up"},
  {code:"1d",  hex:"#E6F7FF", group:"Office",      label:"Office — circulation within suite"},
  // ---- Learning (FICM) ----
  {code:"2a",  hex:"#66C6C1", group:"Learning",    label:"Learning support — teaching lab / classroom / assembly"},
  {code:"2b",  hex:"#39946a", group:"Learning",    label:"Learning — teaching lab / shop / maker"},
  {code:"2c",  hex:"#82ddb3", group:"Learning",    label:"Learning — classroom / auditorium / computer lab"},
  {code:"2d",  hex:"#E9FFF7", group:"Learning",    label:"Learning — circulation within suite"},
  // ---- Circulation (FICM) ----
  {code:"3a",  hex:"#FEB522", group:"Circulation", label:"Elevator, egress stair"},
  {code:"3b",  hex:"#FFDF5A", group:"Circulation", label:"Monumental stairs / extra"},
  {code:"3c",  hex:"#FFFBEB", group:"Circulation", label:"General circulation, exterior plaza"},
  // ---- Community (FICM) ----
  {code:"3d",  hex:"#b9f8db", group:"Community",   label:"Enclosed — meeting / collab / study / lounge / kitchenette"},
  {code:"3e",  hex:"#FFF4C7", group:"Community",   label:"Open collab / commons / lounge / exhibit / café"},
  // ---- Research (FICM) ----
  {code:"4a",  hex:"#F28D79", group:"Research",    label:"Research — lab support"},
  {code:"4b",  hex:"#F2AA9C", group:"Research",    label:"Research — lab open & enclosed"},
  {code:"4c",  hex:"#F9D9C7", group:"Research",    label:"Research — write-up / computational"},
  {code:"4d",  hex:"#FFEED4", group:"Research",    label:"Research — circulation within suite"},
  // ---- Specialty (FICM) ----
  {code:"5a",  hex:"#E068B5", group:"Specialty",   label:"Specialty — support (core & animal)"},
  {code:"5b",  hex:"#1b543a", group:"Specialty",   label:"Specialty — core lab / animal holding"},
  {code:"5c",  hex:"#EFB1D0", group:"Specialty",   label:"Specialty — office (core & animal)"},
  {code:"5d",  hex:"#FCDEDE", group:"Specialty",   label:"Specialty — circulation within suite"},
  // ---- Support (FICM) ----
  {code:"6a",  hex:"#C2C3C8", group:"Support",     label:"Support — building / MEP / storage"},
  {code:"6b",  hex:"#E7E7E7", group:"Support",     label:"Support — unfinished area / shell"},
  // ---- Healthcare palette (selected) ----
  {code:"HC-1h", hex:"#5670E0", group:"HC Vertical",   label:"HC — clean elevator highlight"},
  {code:"HC-2h", hex:"#3CA09E", group:"HC Inpatient",  label:"HC — inpatient highlight"},
  {code:"HC-7a", hex:"#52D1ED", group:"HC Outpatient", label:"HC — outpatient (alt)"},
  {code:"HC-7b", hex:"#96EBF6", group:"HC Outpatient", label:"HC — outpatient (clinic / OB / behavioral)"},
  {code:"HC-7d", hex:"#F1FFFF", group:"HC Outpatient", label:"HC — circulation outpatient"},
  {code:"HC-3",  hex:"#FEB522", group:"HC Food",       label:"HC — food services (servery / café)"},
  {code:"HC-4B", hex:"#FFAF7D", group:"HC Surgical",   label:"HC — surgical services"},
  {code:"HC-4C", hex:"#ffc838", group:"HC Emergency",  label:"HC — emergency services"},
  {code:"HC-4d", hex:"#FFEED4", group:"HC Emergency",  label:"HC — circulation surgical/emergency"},
  {code:"HC-5h", hex:"#FF26B0", group:"HC Vertical",   label:"HC — soiled elevator highlight"},
  {code:"7a",    hex:"#FFF3B0", group:"Outdoor",       label:"Outdoor — program space (lawns, courts, pavilions, trails)"},
  {code:"7b",    hex:"#FFB74D", group:"Housing",       label:"Housing — residential space"}
];
function ficmEntry(code){ for(var i=0;i<FICM_CATALOG.length;i++){ if(FICM_CATALOG[i].code===code) return FICM_CATALOG[i]; } return null; }
function ficmHex(code){ var e=ficmEntry(code); return e?e.hex:null; }

// Default FICM code per program category
var CAT_CODE_TO_FICM = { C1:"HC-7b", C2:"HC-7d", C3:"HC-7a", C4:"1a" };
function defaultFicmForRoom(cat){ return CAT_CODE_TO_FICM[cat.code] || "6a"; }

var COMFORT_CHOICES = ["Indoor Conditioned","In/Out Covered","Outdoor Exposed"];
var CIRCULATION_CHOICES = ["Indoor Conditioned","In/Out Covered"];
