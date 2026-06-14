// builder.js — editor se záložkami (Interface, Tool, Layout, Programs, Products, Alarms, Safety, Dokumentace, Revision)
import { S, t, esc, saveProject, importProject } from "./state.js";
import { addr, genEmptyIO, splitIO, stationCodes, validate } from "./model.js";
import { makeXLSX, download } from "./io.js";
import { buildDoc, toHTML, downloadDOCX } from "./docgen.js";

const IST='width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.15);color:inherit;padding:5px 7px;border-radius:5px;font:inherit;font-size:12px';
const TBLS = {};      // registr editovatelných polí: id -> array
let TID = 0;

const TABS = [
  ["interface","Interface","Interface"],["tool","Tool","Tool"],["workflow","Layout","Layout"],
  ["programs","Programy","Programs"],["products","Produkty","Products"],["alarms","Alarmy","Alarms"],
  ["safety","Safety","Safety"],["doc","Dokumentace","Documentation"],["revision","Revize","Revision"],
];
const lbl = c => S.lang==="en" ? c.en : c.cs;
const hint = c => (c.opts && c.opts.hint) || "";

// ---------- generická editovatelná tabulka ----------
// cols: [{k,cs,en,type,opts}]  type: text|num|area|ro|sel|selSrc|stations|check
function editTable(arr, cols, opt){
  opt = opt||{};
  const id = "t"+(TID++); TBLS[id]=arr;
  const editKeys = cols.filter(c=>!["ro","stations","check"].includes(c.type)).map(c=>c.k);
  const th = cols.map(c=>'<th title="'+esc(hint(c))+'" style="text-align:left;padding:6px;opacity:.6;font-size:10px;text-transform:uppercase;white-space:nowrap">'+esc(lbl(c))+(hint(c)?' <span style="opacity:.5">ⓘ</span>':'')+'</th>').join("")+'<th></th>';
  const body = arr.map((r,i)=>rowHTML(id,cols,r,i,opt)).join("");
  const tbl = '<div style="overflow-x:auto"><table class="ax-tbl" data-tbl="'+id+'" data-cols="'+editKeys.join(",")+'"><thead><tr>'+th+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  const addBtn = opt.noAdd ? "" : '<button class="btn btn-g" style="margin-top:10px" data-act="add" data-tbl="'+id+'">+ '+(opt.addLabel||t("Řádek","Row"))+'</button>';
  return { id, html: tbl + addBtn };
}
function rowHTML(id, cols, r, i, opt){
  const cells = cols.map(c=>{
    const o=c.opts||{}, k=c.k, val=r[k];
    const w=o.w?('max-width:'+o.w+';'):'';
    let cell;
    if(c.type==="ro"){ const v=o.calc?o.calc(r):(val||""); cell='<input value="'+esc(v)+'" readonly tabindex="-1" style="'+IST+';'+w+'opacity:.55;cursor:default">'; }
    else if(c.type==="area"){ cell='<textarea data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" rows="'+(o.rows||2)+'"'+(o.max?' maxlength="'+o.max+'"':'')+' style="'+IST+';resize:vertical;'+w+'">'+esc(val||"")+'</textarea>'; }
    else if(c.type==="num"){ cell='<input type="number" data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" value="'+esc(val==null?"":val)+'" style="'+IST+';'+w+'">'; }
    else if(c.type==="check"){ cell='<input type="checkbox" data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" '+(val?"checked":"")+' style="width:16px;height:16px">'; }
    else if(c.type==="sel"){ cell='<select data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" style="'+IST+';'+w+'">'+selOpts(o.options||[],val)+'</select>'; }
    else if(c.type==="selSrc"){ cell='<select data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" style="'+IST+';'+w+'">'+selOpts([""].concat(o.src()),val)+'</select>'; }
    else if(c.type==="stations"){ cell=stationsCell(id,i,k,r[k]||[]); }
    else { cell='<input data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'"'+(o.max?' maxlength="'+o.max+'"':'')+' value="'+esc(val||"")+'" style="'+IST+';'+w+'">'; }
    return '<td style="padding:3px;vertical-align:top">'+cell+'</td>';
  }).join("");
  const del = (opt.fixedFn&&opt.fixedFn(r)) ? '<span style="opacity:.3" title="'+t("výchozí","default")+'">🔒</span>' : '<button data-act="del" data-tbl="'+id+'" data-row="'+i+'" style="background:none;border:none;color:#e77;cursor:pointer;font-size:15px">✕</button>';
  return '<tr>'+cells+'<td style="padding:3px;text-align:center">'+del+'</td></tr>';
}
function selOpts(arr, cur){ return arr.map(o=>{const v=typeof o==="object"?o.v:o, lab=typeof o==="object"?o.l:o; return '<option value="'+esc(v)+'"'+(String(v)===String(cur==null?"":cur)?" selected":"")+'>'+esc(lab===""?"—":lab)+'</option>';}).join(""); }
function stationsCell(id,i,k,vals){
  const chips=(vals||[]).map((s,j)=>'<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(10,255,203,.1);border:1px solid rgba(10,255,203,.3);border-radius:6px;padding:2px 6px;font-size:11px;margin:1px">'+esc(s)+' <b data-act="stadel" data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" data-j="'+j+'" style="cursor:pointer;color:#e77">×</b></span>').join("");
  const opts=stationCodes(S.AXP).filter(s=>!(vals||[]).includes(s));
  const dd=opts.length
    ? '<select data-act="staadd" data-tbl="'+id+'" data-row="'+i+'" data-k="'+k+'" style="'+IST+';width:auto;margin-top:3px">'+selOpts([{v:"",l:"+ "+t("stanice","station")}].concat(opts))+'</select>'
    : '<span style="font-size:11px;opacity:.4">'+t("(nejdřív Layout)","(define Layout)")+'</span>';
  return '<div>'+chips+'<br>'+dd+'</div>';
}

// IO sloupce (Interface + Tool + Safety použijí variantu)
function ioCols(typeOpts){ return [
  {k:"typ",cs:"Typ",en:"Type",type:"sel",opts:{w:"66px",options:typeOpts||["DI","DO","AI","AO","GI","GO"]}},
  {k:"byte",cs:"Byte",en:"Byte",type:"num",opts:{w:"58px",hint:t("číslo bytu","byte")}},
  {k:"bit",cs:"Bit",en:"Bit",type:"num",opts:{w:"48px",hint:"0–7"}},
  {k:"adr_robot",cs:"Adr robot",en:"Robot",type:"ro",opts:{w:"82px",calc:r=>addr(r).robot}},
  {k:"adr_plc",cs:"Adr PLC",en:"PLC",type:"ro",opts:{w:"82px",calc:r=>addr(r).plc}},
  {k:"jmeno",cs:"Jméno",en:"Name",type:"text",opts:{hint:t("unikátní","unique")}},
  {k:"popis",cs:"Popis",en:"Description",type:"text"},
];}

function headFields(obj, defs, extra){
  return '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">'+
    defs.map(d=>'<div style="min-width:120px;flex:1"><label style="font-size:11px;opacity:.6;display:block;margin-bottom:3px">'+(S.lang==="en"?d[2]:d[1])+'</label><input data-head="'+d[0]+'" value="'+esc(obj[d[0]]||"")+'" style="'+IST+'"></div>').join("")+
    (extra||"")+'</div>';
}
function byteRangeSel(cur, act){
  return '<select data-act="'+act+'" style="'+IST+';width:auto">'+selOpts([8,16,32,64,128,256].map(n=>({v:String(n),l:n+" B"})), cur||"16")+'</select>';
}

// ---------- hlavní render ----------
export function render(){
  const app = document.getElementById("ax-app"); if(!app) return;
  TID=0; for(const k in TBLS) delete TBLS[k];
  const A = S.AXP;
  const bar = TABS.map(tb=>'<button data-act="tab" data-tab="'+tb[0]+'" style="background:'+(S.tab===tb[0]?'var(--teal)':'transparent')+';color:'+(S.tab===tb[0]?'#06231b':'inherit')+';border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">'+(S.lang==="en"?tb[2]:tb[1])+'</button>').join("");
  const tools='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-left:auto"><button class="btn btn-g" data-act="save">⬇ '+t("Uložit","Save")+'</button><button class="btn btn-g" data-act="loadbtn">⬆ '+t("Načíst","Load")+'</button><input type="file" id="ax-loadf" accept=".json" hidden></div>';
  let body="";
  if(S.tab==="interface") body=renderInterface();
  else if(S.tab==="tool") body=renderTool();
  else if(S.tab==="workflow") body=renderLayout();
  else if(S.tab==="programs") body=editTable(A.programs, progCols(), {addLabel:t("Program","Program")}).html;
  else if(S.tab==="products") body=editTable(A.products, prodCols(), {addLabel:t("Produkt","Product")}).html;
  else if(S.tab==="alarms") body=editTable(A.alarms, alarmCols(), {addLabel:t("Alarm","Alarm")}).html;
  else if(S.tab==="safety") body=renderSafety();
  else if(S.tab==="doc") body=renderDoc();
  else if(S.tab==="revision") body=renderRevision();

  const warn=validate(A);
  const warnHtml = warn.length?'<div style="margin-top:14px;padding:10px;border:1px solid #e77;border-radius:8px;background:rgba(230,119,119,.08);font-size:12px"><b>⚠ '+t("Kontrola","Check")+' ('+warn.length+'):</b> '+warn.slice(0,8).map(esc).join(" · ")+(warn.length>8?" …":"")+'</div>':'';
  app.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:14px">'+bar+tools+'</div><div>'+body+'</div>'+warnHtml;
}

function progCols(){ return [
  {k:"cislo",cs:"Č.",en:"No.",type:"text",opts:{w:"110px",hint:t("krátký název ~10 zn.","short ~10 chars")}},
  {k:"nazev",cs:"Program",en:"Program",type:"text"},
  {k:"stations",cs:"Stanice",en:"Stations",type:"stations",opts:{w:"170px"}},
  {k:"popis",cs:"Popis",en:"Description",type:"area",opts:{rows:4}},
];}
function prodCols(){ return [
  {k:"id",cs:"ID typu",en:"Type ID",type:"text",opts:{w:"100px",hint:"Gi_TypeNum"}},
  {k:"nazev",cs:"Název",en:"Name",type:"text"},
  {k:"stations",cs:"Stanice",en:"Stations",type:"stations",opts:{w:"170px"}},
  {k:"popis",cs:"Popis",en:"Description",type:"area",opts:{rows:2}},
];}
function alarmCols(){ return [
  {k:"cislo",cs:"Číslo chyby",en:"Error #",type:"text",opts:{w:"96px",max:12,hint:"0–65535"}},
  {k:"header",cs:"Header",en:"Header",type:"text",opts:{max:40}},
  {k:"popis",cs:"Popis",en:"Description",type:"area",opts:{rows:2,max:80,hint:"2×40 (ABB)"}},
  {k:"reseni",cs:"Řešení",en:"Solution",type:"area",opts:{rows:2,max:80,hint:"2×40 (ABB)"}},
];}

function renderInterface(){
  const A=S.AXP;
  const vendor='<div style="min-width:130px"><label style="font-size:11px;opacity:.6;display:block;margin-bottom:3px">Vendor</label><select data-head="vendor" style="'+IST+'">'+selOpts(["","ABB","Fanuc","KUKA","Siemens"],A.head.vendor)+'</select></div>';
  const head = headFields(A.head, [["ip_plc","IP PLC","PLC IP"],["mask_plc","Maska PLC","PLC mask"],["gw_plc","GW PLC","PLC gateway"],["dev_plc","Device PLC","PLC device"],["ip_robot","IP robot","Robot IP"],["mask_robot","Maska robota","Robot mask"],["gw_robot","GW robota","Robot gateway"],["dev_robot","Device robot","Robot device"]], vendor);
  const {inp,out}=splitIO(A.interface);
  const toolsbar='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px;align-items:center">'+byteRangeSel(A.head.byte_range,"setrange")+'<button class="btn btn-g" data-act="emptyio">'+t("Prázdné I/O","Empty I/O")+'</button><button class="btn btn-g" data-act="xlsx">⬇ XLSX</button></div>';
  return head+'<p style="opacity:.55;font-size:12px;margin:0 0 4px">'+t("Vstupy a výstupy vedle sebe, adresy se počítají samy (nejdou editovat). Prázdné jméno = rezerva.","Inputs/outputs side by side, addresses auto-computed (read-only). Empty name = reserve.")+'</p>'+toolsbar+
    '<div class="io-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--teal)">Inputs</div>'+ioSide(inp,"in")+'</div><div><div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--cyan)">Outputs</div>'+ioSide(out,"out")+'</div></div>';
}
function ioSide(items, side){
  const id="t"+(TID++); TBLS[id]=S.AXP.interface;
  const cols=ioCols(); const editKeys=cols.filter(c=>c.type!=="ro").map(c=>c.k);
  const th=cols.map(c=>'<th style="text-align:left;padding:5px;opacity:.6;font-size:10px;text-transform:uppercase;white-space:nowrap">'+esc(lbl(c))+'</th>').join("")+'<th></th>';
  const rowsH=items.map(({r,i})=>rowHTML(id,cols,r,i,{})).join("");
  return '<div style="overflow-x:auto"><table class="ax-tbl" data-tbl="'+id+'" data-cols="'+editKeys.join(",")+'"><thead><tr>'+th+'</tr></thead><tbody>'+rowsH+'</tbody></table></div><button class="btn btn-g" style="margin-top:8px" data-act="addio" data-side="'+side+'">+ '+t("Řádek","Row")+'</button>';
}

function renderTool(){
  const A=S.AXP;
  const sub=A.tools.map((tl,i)=>'<button data-act="tool" data-i="'+i+'" style="background:'+(S.toolIdx===i?'var(--cyan)':'transparent')+';color:'+(S.toolIdx===i?'#06231b':'inherit')+';border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:5px 11px;font:inherit;font-size:12px;cursor:pointer">'+esc(tl.name||("Tool "+(i+1)))+'</button>').join("");
  const idx=Math.min(S.toolIdx, A.tools.length-1); const tl=A.tools[idx]; if(!tl) return "<p>—</p>";
  const head=headFields(tl.head, [["ip","IP","IP"],["dev","Device","Device"],["mask","Maska","Mask"],["gw","Gateway","Gateway"]]);
  const nameField='<div style="margin-bottom:8px"><label style="font-size:11px;opacity:.6;display:block;margin-bottom:3px">'+t("Název nástroje","Tool name")+'</label><input data-toolname="'+idx+'" value="'+esc(tl.name||"")+'" style="'+IST+';max-width:240px"></div>';
  const toolsbar='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px">'+byteRangeSel(tl.byte_range,"settoolrange")+'<button class="btn btn-g" data-act="toolempty">'+t("Prázdné I/O","Empty I/O")+'</button></div>';
  const tbl=editTable(tl.rows, ioCols(), {addLabel:t("Signál","Signal")});
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">'+sub+'<button class="btn btn-g" data-act="addtool">+ Tool</button>'+(A.tools.length>1?'<button class="btn btn-g" data-act="deltool" style="color:#e77">✕</button>':'')+'</div>'+
    '<p style="opacity:.55;font-size:12px;margin:0 0 8px">'+t("Nástroj komunikuje jako PLC — device, adresa, rozsah byte. Více nástrojů = sub-záložky.","Tool communicates like PLC — device, address, byte range. Multiple tools = sub-tabs.")+'</p>'+nameField+head+toolsbar+tbl.html;
}

function renderLayout(){
  const A=S.AXP;
  const img='<div style="margin-bottom:14px"><label style="font-size:12px;opacity:.7">'+t("Obrázek layoutu","Layout image")+'</label><br><input type="file" data-act="layoutimg" accept="image/*" style="font-size:12px;margin-top:4px">'+(A.layout_img?'<div style="margin-top:8px"><img src="'+A.layout_img+'" style="max-width:100%;max-height:240px;border-radius:8px;border:1px solid rgba(255,255,255,.15)"></div>':'')+'</div>';
  const cols=[
    {k:"cislo",cs:"Stanice",en:"Station",type:"text",opts:{w:"110px",hint:t("krátký kód, bez mezer","short code, no spaces")}},
    {k:"nazev",cs:"Název",en:"Name",type:"text",opts:{w:"200px"}},
    {k:"popis",cs:"Popis funkce",en:"Function",type:"area",opts:{rows:3}},
  ];
  return img+editTable(A.workflow, cols, {addLabel:t("Stanice","Station")}).html;
}

function renderSafety(){
  const A=S.AXP, sf=A.safety;
  const subs=[["interface","Interface"],["stops","Stops"],["zones","Zones"]];
  const bar=subs.map(s=>'<button data-act="ssub" data-s="'+s[0]+'" style="background:'+(S.safetySub===s[0]?'var(--teal)':'transparent')+';color:'+(S.safetySub===s[0]?'#06231b':'inherit')+';border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:5px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">'+s[1]+'</button>').join("");
  let inner="";
  if(S.safetySub==="interface"){
    const head=headFields(sf.head,[["src_addr","Source adresa","Source address"],["dst_addr","Destination adresa","Destination address"]]);
    const toolsbar='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px">'+byteRangeSel(sf.head.byte_range,"setsafrange")+'<button class="btn btn-g" data-act="safempty">'+t("Prázdné SDI/O","Empty SDI/O")+'</button></div>';
    inner=head+toolsbar+editTable(sf.io, ioCols(["SDI","SDO"]), {addLabel:t("Signál","Signal")}).html;
  } else if(S.safetySub==="stops"){
    const cols=[
      {k:"name",cs:"Název",en:"Name",type:"text",opts:{w:"120px"}},
      {k:"category",cs:"Category",en:"Category",type:"sel",opts:{w:"90px",options:["0","1"]}},
      {k:"signal",cs:"Signál (SDI)",en:"Signal (SDI)",type:"selSrc",opts:{w:"150px",src:()=>sdiNames("SDI")}},
      {k:"popis",cs:"Popis",en:"Description",type:"text"},
    ];
    inner='<p style="opacity:.55;font-size:12px;margin:0 0 8px">'+t("EStop (Cat 0) a AStop (Cat 1) jsou výchozí (zamčené). Přidej vlastní (Guard, General…).","EStop (Cat 0) and AStop (Cat 1) are defaults (locked). Add custom (Guard, General…).")+'</p>'+editTable(sf.stops, cols, {addLabel:"Stop", fixedFn:r=>r.fixed}).html;
  } else {
    const cols=[
      {k:"name",cs:"Jméno zóny",en:"Zone name",type:"text",opts:{w:"150px",max:20}},
      {k:"enabling",cs:"Enabling (SDI)",en:"Enabling (SDI)",type:"selSrc",opts:{w:"130px",src:()=>sdiNames("SDI")}},
      {k:"monitoring",cs:"Monitoring (SDO)",en:"Monitoring (SDO)",type:"selSrc",opts:{w:"130px",src:()=>sdiNames("SDO")}},
      {k:"allow_inside",cs:"Allow Inside",en:"Allow Inside",type:"check"},
      {k:"stop_cat",cs:"Stop cat.",en:"Stop cat.",type:"sel",opts:{w:"80px",options:["0","1"]}},
      {k:"popis",cs:"Popis",en:"Description",type:"area",opts:{rows:2}},
    ];
    inner='<p style="opacity:.55;font-size:12px;margin:0 0 8px">'+t("Signály jsou volitelné (zóna funguje i bez nich).","Signals optional (zone works without them).")+'</p>'+editTable(sf.zones, cols, {addLabel:t("Zóna","Zone")}).html;
  }
  return '<div style="display:flex;gap:6px;margin-bottom:14px">'+bar+'</div>'+inner;
}
function sdiNames(filter){ return (S.AXP.safety.io||[]).filter(r=>!filter||(r.typ||"").toUpperCase()===filter).map(r=>(r.jmeno||"").trim()).filter(Boolean); }

function renderDoc(){
  const A=S.AXP;
  const tpl='<div style="margin-bottom:14px"><label style="font-size:12px;opacity:.7">'+t("Hlavičkový papír (template, obrázek)","Header paper (template image)")+'</label><br><input type="file" data-act="docimg" accept="image/*" style="font-size:12px;margin-top:4px">'+(A.doc.template_img?'<div style="margin-top:8px"><img src="'+A.doc.template_img+'" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid rgba(255,255,255,.15)"></div>':'')+'</div>';
  const cols=[
    {k:"placement",cs:"Umístění",en:"Placement",type:"sel",opts:{w:"120px",options:[{v:"top",l:t("Nahoře","Top")},{v:"layout",l:"Layout"},{v:"alarms",l:"Alarmy"},{v:"safety",l:"Safety"},{v:"bottom",l:t("Dole","Bottom")}]}},
    {k:"header",cs:"Header",en:"Header",type:"text",opts:{w:"180px"}},
    {k:"text",cs:"Text",en:"Text",type:"area",opts:{rows:3}},
  ];
  return '<p style="opacity:.55;font-size:12px;margin:0 0 10px">'+t("Vlastní odstavce (píše člověk) zůstanou pevné a označí se barvou. Vygenerované části se přepisují podle dat.","Human-written paragraphs stay fixed and color-marked. Generated parts re-render from data.")+'</p>'+
    tpl+editTable(A.doc.blocks, cols, {addLabel:t("Odstavec","Paragraph")}).html+
    '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" data-act="gendoc">📄 '+t("Vygenerovat dokument","Generate document")+'</button><button class="btn btn-g" data-act="docx">⬇ DOCX</button></div><div id="ax-docprev" style="margin-top:16px"></div>';
}

function renderRevision(){
  const A=S.AXP;
  const rows=(A.revisions||[]).slice().reverse().map(r=>'<tr><td style="padding:5px"><code>'+esc(r.ver)+'</code></td><td style="padding:5px">'+esc(r.who||"—")+'</td><td style="padding:5px;font-size:11px;opacity:.7">'+esc(r.when||"")+'</td><td style="padding:5px">'+esc(r.note||"")+'</td></tr>').join("");
  return '<p style="opacity:.55;font-size:12px;margin:0 0 10px">'+t("Lokální historie verzí. Sdílení mezi uživateli a cloud přijdou s placenou verzí (backend).","Local version history. Multi-user sharing and cloud come with the paid version (backend).")+'</p><button class="btn btn-p" data-act="addrev">+ '+t("Nová revize","New revision")+'</button>'+
    (rows?'<div style="overflow-x:auto;margin-top:14px"><table class="ax-tbl"><thead><tr><th style="text-align:left;padding:5px;opacity:.6;font-size:11px">Ver</th><th style="text-align:left;padding:5px;opacity:.6;font-size:11px">'+t("Kdo","Who")+'</th><th style="text-align:left;padding:5px;opacity:.6;font-size:11px">'+t("Kdy","When")+'</th><th style="text-align:left;padding:5px;opacity:.6;font-size:11px">'+t("Poznámka","Note")+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p style="opacity:.4;margin-top:14px">'+t("Zatím žádné revize.","No revisions yet.")+'</p>');
}

// ---------- event wiring (jednou) ----------
export function wireOnce(app){
  app.addEventListener("input", e=>updateFromEl(e.target,false), false);
  app.addEventListener("change", e=>{ if(handleFile(e.target)) return; if(e.target.dataset && e.target.dataset.act){ onAct(e.target); return; } updateFromEl(e.target,true); }, false);
  app.addEventListener("click", e=>{ const b=e.target.closest("[data-act]"); if(b && (b.tagName==="BUTTON"||b.tagName==="B")) onAct(b); }, false);
  app.addEventListener("paste", onPaste, true);
}
function updateFromEl(el, isChange){
  if(!el || !el.dataset) return;
  if(el.dataset.tbl!=null && el.dataset.row!=null && el.dataset.k){
    const arr=TBLS[el.dataset.tbl]; if(!arr) return; const row=arr[+el.dataset.row]; if(!row) return;
    row[el.dataset.k]=(el.type==="checkbox")?el.checked:el.value; saveProject();
    if(isChange && (el.dataset.k==="typ"||el.dataset.k==="byte"||el.dataset.k==="bit")) render();
    return;
  }
  if(el.dataset.head){ setHead(el); return; }
  if(el.dataset.toolname!=null){ const i=+el.dataset.toolname; if(S.AXP.tools[i]){ S.AXP.tools[i].name=el.value; saveProject(); } if(isChange) render(); return; }
}
function setHead(el){
  const k=el.dataset.head, v=el.value;
  if(S.tab==="interface") S.AXP.head[k]=v;
  else if(S.tab==="tool") S.AXP.tools[Math.min(S.toolIdx,S.AXP.tools.length-1)].head[k]=v;
  else if(S.tab==="safety") S.AXP.safety.head[k]=v;
  saveProject();
}
function onAct(b){
  const act=b.dataset.act, A=S.AXP;
  if(act==="tab"){ S.tab=b.dataset.tab; render(); }
  else if(act==="ssub"){ S.safetySub=b.dataset.s; render(); }
  else if(act==="tool"){ S.toolIdx=+b.dataset.i; render(); }
  else if(act==="add"){ const arr=TBLS[b.dataset.tbl]; if(arr){ arr.push({}); saveProject(); render(); } }
  else if(act==="del"){ const arr=TBLS[b.dataset.tbl]; if(arr){ arr.splice(+b.dataset.row,1); saveProject(); render(); } }
  else if(act==="addio"){ A.interface.push({typ:b.dataset.side==="out"?"DO":"DI",byte:"",bit:"",jmeno:"",popis:""}); saveProject(); render(); }
  else if(act==="emptyio"){ if(A.interface.length && !confirm(t("Přepíše současné I/O. Pokračovat?","Overwrite current I/O?"))) return; A.interface=genEmptyIO(A.head.byte_range); saveProject(); render(); }
  else if(act==="setrange"){ A.head.byte_range=b.value; saveProject(); }
  else if(act==="settoolrange"){ A.tools[S.toolIdx].byte_range=b.value; saveProject(); }
  else if(act==="setsafrange"){ A.safety.head.byte_range=b.value; saveProject(); }
  else if(act==="toolempty"){ const tl=A.tools[S.toolIdx]; if(tl.rows.length && !confirm(t("Přepsat?","Overwrite?"))) return; tl.rows=genEmptyIO(tl.byte_range); saveProject(); render(); }
  else if(act==="safempty"){ const sf=A.safety; if(sf.io.length && !confirm(t("Přepsat?","Overwrite?"))) return; sf.io=genEmptyIO(sf.head.byte_range).map(r=>({typ:r.typ==="DI"?"SDI":"SDO",byte:r.byte,bit:r.bit,jmeno:"",popis:""})); saveProject(); render(); }
  else if(act==="addtool"){ A.tools.push({name:"Tool "+(A.tools.length+1),head:{ip:"",dev:"",mask:"",gw:""},byte_range:"2",rows:[]}); S.toolIdx=A.tools.length-1; saveProject(); render(); }
  else if(act==="deltool"){ if(A.tools.length<=1) return; if(!confirm(t("Smazat nástroj?","Delete tool?"))) return; A.tools.splice(S.toolIdx,1); S.toolIdx=0; saveProject(); render(); }
  else if(act==="staadd"){ const arr=TBLS[b.dataset.tbl]; const row=arr&&arr[+b.dataset.row]; const v=b.value; if(row&&v){ (row[b.dataset.k]=row[b.dataset.k]||[]).push(v); saveProject(); render(); } }
  else if(act==="stadel"){ const arr=TBLS[b.dataset.tbl]; const row=arr&&arr[+b.dataset.row]; if(row&&row[b.dataset.k]){ row[b.dataset.k].splice(+b.dataset.j,1); saveProject(); render(); } }
  else if(act==="xlsx"){ exportXLSX(); }
  else if(act==="gendoc"){ const p=document.getElementById("ax-docprev"); if(p) p.innerHTML='<div class="doc-paper">'+toHTML(buildDoc(A))+'</div>'; }
  else if(act==="docx"){ downloadDOCX(buildDoc(A)); }
  else if(act==="addrev"){ const note=prompt(t("Poznámka k revizi:","Revision note:"),""); if(note===null) return; const who=prompt(t("Kdo (jméno):","Who (name):"),"")||""; A.revisions.push({ver:A.revisions.length+1,who,when:new Date().toISOString().slice(0,16).replace("T"," "),note}); saveProject(); render(); }
  else if(act==="save"){ download("axon-projekt.json", JSON.stringify(A,null,2), "application/json"); }
  else if(act==="loadbtn"){ const f=document.getElementById("ax-loadf"); if(f) f.click(); }
}
function handleFile(el){
  if(!el || !el.dataset) return false;
  if(el.dataset.act==="layoutimg" || el.dataset.act==="docimg"){
    const f=el.files&&el.files[0]; if(!f) return true; const rd=new FileReader();
    rd.onload=()=>{ if(el.dataset.act==="layoutimg") S.AXP.layout_img=rd.result; else S.AXP.doc.template_img=rd.result; saveProject(); render(); };
    rd.readAsDataURL(f); return true;
  }
  if(el.id==="ax-loadf"){
    const f=el.files&&el.files[0]; if(!f) return true; const rd=new FileReader();
    rd.onload=()=>{ try{ importProject(rd.result); render(); }catch(x){ alert(t("Neplatný JSON.","Invalid JSON.")); } };
    rd.readAsText(f); return true;
  }
  return false;
}
function onPaste(e){
  const el=e.target; if(!el || !el.dataset || el.dataset.tbl==null || el.dataset.row==null || !el.dataset.k) return;
  const txt=(e.clipboardData||window.clipboardData).getData("text");
  if(!txt || !/[\t\n]/.test(txt)) return;       // jediná buňka → nech default
  e.preventDefault();
  const table=el.closest("table"); const arr=TBLS[el.dataset.tbl]; if(!table||!arr) return;
  const cols=(table.dataset.cols||"").split(",").filter(Boolean);
  const startCol=Math.max(0, cols.indexOf(el.dataset.k));
  const startRow=+el.dataset.row;
  txt.split(/\r?\n/).filter((l,i,a)=>l.length||i<a.length-1).forEach((line,li)=>{
    if(!line.trim() && line==="") return;
    let row=arr[startRow+li]; if(!row){ row={}; arr.push(row); }
    line.split("\t").forEach((cell,ci)=>{ const key=cols[startCol+ci]; if(key) row[key]=cell; });
  });
  saveProject(); render();
}
function exportXLSX(){
  const sig=(S.AXP.interface||[]).filter(r=>r.jmeno||r.typ);
  if(!sig.length){ alert(t("Prázdná tabulka.","Empty.")); return; }
  const headers=["Type","Byte","Bit","Robot_addr","PLC_addr","Signal_name","Description"];
  const rows=sig.map(r=>{const a=addr(r);return [r.typ,r.byte,r.bit,a.robot,a.plc,r.jmeno,r.popis];});
  download("interface_table.xlsx", makeXLSX(headers,rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
