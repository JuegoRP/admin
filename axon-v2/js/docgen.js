// docgen.js — operátorský dokument: bloky z dat → náhled (HTML), DOCX, tisk.
import { S, t, esc } from "./state.js";
import { addr, stationCodes } from "./model.js";
import { zipStore, download } from "./io.js";

const F = (arr, keys) => (arr||[]).filter(r => keys.some(k => r[k] && String(r[k]).trim()));

// Postaví bloky dokumentu ze VŠECH záložek + custom odstavců (Dokumentace).
export function buildDoc(AXP){
  const bl=[];
  bl.push({h1: t("Dokumentace stroje","Machine documentation")});
  if(AXP.head.vendor) bl.push({p: "Vendor: "+AXP.head.vendor});

  // custom odstavce, které mají placement "top"
  customAt(AXP,"top",bl);

  // Layout / stanice
  const st=F(AXP.workflow,["cislo","nazev","popis"]);
  bl.push({h2: t("Layout / stanice","Layout / stations")});
  if(AXP.layout_img) bl.push({img: AXP.layout_img});
  if(st.length) bl.push({table:{head:[t("Stanice","Station"),t("Název","Name"),t("Funkce","Function")], rows: st.map(s=>[s.cislo,s.nazev,s.popis])}});
  customAt(AXP,"layout",bl);

  // Alarmy — pro operátora
  const al=F(AXP.alarms,["cislo","header","popis"]);
  bl.push({h2: t("Alarmy — řešení pro operátora","Alarms — operator solutions")});
  if(al.length) bl.push({table:{head:[t("Chyba","Error"),"Header",t("Popis","Description"),t("Řešení","Solution")], rows: al.map(a=>[a.cislo,a.header,a.popis,a.reseni])}});
  customAt(AXP,"alarms",bl);

  // Safety
  const sf=AXP.safety||{};
  const stops=F(sf.stops,["name"]), zones=F(sf.zones,["name"]);
  if(stops.length||zones.length){
    bl.push({h2:"Safety"});
    if(stops.length) bl.push({table:{head:["Stop","Category",t("Signál","Signal"),t("Popis","Description")], rows: stops.map(s=>[s.name,s.category,s.signal,s.popis])}});
    if(zones.length) bl.push({h3:t("Bezpečnostní zóny","Safety zones")});
    if(zones.length) bl.push({table:{head:[t("Zóna","Zone"),"Enabling","Monitoring","Stop cat.",t("Popis","Description")], rows: zones.map(z=>[z.name,z.enabling,z.monitoring,z.stop_cat,z.popis])}});
  }
  customAt(AXP,"safety",bl);

  // Programy
  const pr=F(AXP.programs,["cislo","nazev"]);
  if(pr.length){ bl.push({h2:t("Programy","Programs")}); bl.push({table:{head:[t("Č.","No."),t("Program","Program"),t("Popis","Description"),t("Stanice","Stations")], rows: pr.map(p=>[p.cislo,p.nazev,p.popis,(p.stations||[]).join(", ")])}}); }

  // Produkty
  const pd=F(AXP.products,["id","nazev"]);
  if(pd.length){ bl.push({h2:t("Produkty","Products")}); bl.push({table:{head:[t("ID typu","Type ID"),t("Název","Name"),t("Stanice","Stations"),t("Popis","Description")], rows: pd.map(p=>[p.id,p.nazev,(p.stations||[]).join(", "),p.popis])}}); }

  // Nástroje
  (AXP.tools||[]).forEach(tl=>{
    const rows=F(tl.rows,["jmeno","typ"]); if(!rows.length && !(tl.head&&tl.head.ip)) return;
    bl.push({h2:t("Nástroj","Tool")+": "+(tl.name||"")});
    if(tl.head&&tl.head.ip) bl.push({p:"IP: "+tl.head.ip+(tl.head.dev?" · "+tl.head.dev:"")});
    if(rows.length) bl.push({table:{head:[t("Typ","Type"),t("Adresa","Address"),t("Jméno","Name"),t("Popis","Description")], rows: rows.map(r=>{const a=addr(r);return [r.typ,a.plc,r.jmeno,r.popis]})}});
  });

  // Signály (Interface)
  const sig=F(AXP.interface,["jmeno","typ"]);
  if(sig.length){ bl.push({h2:t("Signály","Signals")}); bl.push({table:{head:[t("Typ","Type"),t("Adr robot","Robot"),t("Adr PLC","PLC"),t("Jméno","Name"),t("Popis","Description")], rows: sig.map(r=>{const a=addr(r);return [r.typ,a.robot,a.plc,r.jmeno,r.popis]})}}); }

  customAt(AXP,"bottom",bl);
  return bl;
}
function customAt(AXP,where,bl){
  ((AXP.doc&&AXP.doc.blocks)||[]).filter(b=>(b.placement||"bottom")===where).forEach(b=>{
    if(b.header) bl.push({h3:b.header, human:true});
    if(b.text) bl.push({p:b.text, human:true});
    if(b.image) bl.push({img:b.image});
  });
}

// ---- náhled HTML ----
export function toHTML(bl){
  return bl.map(b=>{
    if(b.h1) return '<h1>'+esc(b.h1)+'</h1>';
    if(b.h2) return '<h2 style="border-top:1px solid rgba(255,255,255,.1);padding-top:14px;margin-top:18px">'+esc(b.h2)+'</h2>';
    if(b.h3) return '<h3'+(b.human?' style="color:#0affcb"':'')+'>'+esc(b.h3)+(b.human?' ✎':'')+'</h3>';
    if(b.p) return '<p'+(b.human?' style="border-left:2px solid #0affcb;padding-left:10px"':'')+'>'+esc(b.p)+'</p>';
    if(b.img) return '<img src="'+b.img+'" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.15);margin:8px 0">';
    if(b.table) return '<table class="doc-tbl"><thead><tr>'+b.table.head.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>'+b.table.rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
    return "";
  }).join("");
}

// ---- DOCX ----
function xe(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,"")}
function dPara(text,o){o=o||{};const rpr=(o.b?"<w:b/>":"")+(o.sz?'<w:sz w:val="'+o.sz+'"/>':"")+(o.color?'<w:color w:val="'+o.color+'"/>':"");const ppr=o.sp?'<w:pPr><w:spacing w:before="'+o.sp+'" w:after="60"/></w:pPr>':"";return '<w:p>'+ppr+'<w:r>'+(rpr?"<w:rPr>"+rpr+"</w:rPr>":"")+'<w:t xml:space="preserve">'+xe(text)+'</w:t></w:r></w:p>'}
function dCell(text,head){const shd=head?'<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>':"";const rpr=head?"<w:rPr><w:b/></w:rPr>":"";return '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>'+shd+'</w:tcPr><w:p><w:r>'+rpr+'<w:t xml:space="preserve">'+xe(text)+'</w:t></w:r></w:p></w:tc>'}
function dTable(head,rows){const bd='<w:tblBorders><w:top w:val="single" w:sz="4" w:color="DDDDDD"/><w:left w:val="single" w:sz="4" w:color="DDDDDD"/><w:bottom w:val="single" w:sz="4" w:color="DDDDDD"/><w:right w:val="single" w:sz="4" w:color="DDDDDD"/><w:insideH w:val="single" w:sz="4" w:color="EEEEEE"/><w:insideV w:val="single" w:sz="4" w:color="EEEEEE"/></w:tblBorders>';let x='<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>'+bd+'</w:tblPr><w:tr>'+head.map(h=>dCell(h,1)).join("")+'</w:tr>';rows.forEach(r=>{x+='<w:tr>'+r.map(c=>dCell(c,0)).join("")+'</w:tr>'});return x+'</w:tbl><w:p/>'}
export function downloadDOCX(bl){
  let body="";
  bl.forEach(b=>{
    if(b.h1) body+=dPara(b.h1,{b:1,sz:36});
    else if(b.h2) body+=dPara(b.h2,{b:1,sz:28,sp:200});
    else if(b.h3) body+=dPara(b.h3,{b:1,sz:22,sp:120, color:b.human?"0A8F73":undefined});
    else if(b.p) body+=dPara(b.p,{sz:20, color:b.human?"0A8F73":undefined});
    else if(b.table) body+=dTable(b.table.head,b.table.rows);
    else if(b.img) body+=dPara("[ "+t("obrázek","image")+" ]",{color:"999999",sz:18});
  });
  body=dPara("RVbot · Axon · "+new Date().toISOString().slice(0,10),{color:"888888",sz:18})+body;
  const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
  const CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const RELS='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  download("dokumentace.docx", zipStore([{name:"[Content_Types].xml",data:CT},{name:"_rels/.rels",data:RELS},{name:"word/document.xml",data:doc}]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}
