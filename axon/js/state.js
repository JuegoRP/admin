// state.js — sdílený stav, i18n, datový model projektu, persistence
// Vše mutovatelné žije v objektu S (žádné reassigny importovaných bindingů).

export const S = {
  lang: "en",
  tab: "dashboard",
  safetySub: "interface",
  toolIdx: 0,
  AXP: null,        // aktuální projekt
  gen: null,        // poslední vygenerovaný dokument (bloky)
};

export function esc(s){
  return String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}
export function t(cs,en){ return S.lang==="en" ? en : cs; }

// ---- výchozí projekt (datový model — Vojta spec) ----
export function emptyIO(){ return []; }
export function defaultStops(){
  return [
    {name:"EStop", category:"0", signal:"", popis: t("Okamžité zastavení (hard stop na brzdách).","Stop robot immediately (hard stop on brakes)."), fixed:true},
    {name:"AStop", category:"1", signal:"", popis: t("Zastav co nejdříve.","Stops robot as soon as possible."), fixed:true},
  ];
}
export function defaultProject(){
  return {
    head: {ip_plc:"",mask_plc:"",gw_plc:"",dev_plc:"",ip_robot:"",mask_robot:"",gw_robot:"",dev_robot:"",vendor:"",byte_range:"16"},
    interface: emptyIO(),
    tools: [ {name:"Tool 1", head:{ip:"",dev:"",mask:"",gw:""}, byte_range:"2", rows:[]} ],
    workflow: [],
    programs: [],
    products: [],
    alarms: [],
    safety: { head:{src_addr:"",dst_addr:"",byte_range:"8"}, io:[], stops: defaultStops(), zones:[] },
    doc: { template_img:"", blocks:[] },
    revisions: [],
    layout_img: "",
  };
}

// migrace ze staré verze / doplnění chybějících klíčů
export function normalize(p){
  const d = defaultProject();
  if(!p || typeof p!=="object") return d;
  const out = Object.assign(d, p);
  out.head = Object.assign(d.head, p.head||{});
  if(!Array.isArray(out.tools)){
    // starý formát měl tool jako flat tabulku
    out.tools = d.tools;
  }
  out.safety = Object.assign(d.safety, p.safety||{});
  if(!Array.isArray(out.safety.stops) || !out.safety.stops.length) out.safety.stops = defaultStops();
  out.doc = Object.assign(d.doc, p.doc||{});
  ["interface","workflow","programs","products","alarms","revisions"].forEach(k=>{ if(!Array.isArray(out[k])) out[k]=[]; });
  // programs/products stations: migrace z textu na pole
  out.programs.forEach(r=>{ if(typeof r.stations==="undefined") r.stations = r.stanice? [r.stanice]:[]; });
  out.products.forEach(r=>{ if(typeof r.stations==="undefined") r.stations = r.stanice? [r.stanice]:[]; });
  return out;
}

const KEY = "axon_project_v2";
export function loadProject(){
  try{ const s=localStorage.getItem(KEY); if(s) return normalize(JSON.parse(s)); }catch(e){}
  return defaultProject();
}
export function saveProject(){
  try{ localStorage.setItem(KEY, JSON.stringify(S.AXP)); }catch(e){}
}
export function exportProject(){ return JSON.stringify(S.AXP, null, 2); }
export function importProject(json){
  const p = typeof json==="string" ? JSON.parse(json) : json;
  S.AXP = normalize(Array.isArray(p) ? {interface:p} : p);
  saveProject();
}
