// model.js — čistá logika: adresování, validace, pomocné výběry. Bez DOM.
import { S, t } from "./state.js";

// Spočítá adresu signálu (read-only, neměnná). Vstup: {typ, byte, bit}.
export function addr(sig){
  const b = (sig.byte===""||sig.byte==null) ? "" : parseInt(sig.byte,10);
  const bit = (sig.bit===""||sig.bit==null) ? "" : parseInt(sig.bit,10);
  const T = (sig.typ||"").toUpperCase();
  if(b==="" && b!==0) return {robot:"", plc:""};
  if(T==="DI") return {robot:b+"."+bit, plc:"I"+b+"."+bit};
  if(T==="DO") return {robot:b+"."+bit, plc:"Q"+b+"."+bit};
  if(T==="AI"||T==="GI") return {robot:"IW"+b, plc:"IW"+b};
  if(T==="AO"||T==="GO") return {robot:"QW"+b, plc:"QW"+b};
  return {robot:b+(bit!==""?"."+bit:""), plc:b+(bit!==""?"."+bit:"")};
}

// Vygeneruje prázdné I/O pro rozsah N byte: N×8 DI + N×8 DO (rezerva, jména prázdná).
export function genEmptyIO(byteRange){
  const N = parseInt(byteRange,10) || 16;
  const rows = [];
  for(let b=0;b<N;b++) for(let bit=0;bit<8;bit++) rows.push({typ:"DI", byte:b, bit:bit, jmeno:"", popis:""});
  for(let b=0;b<N;b++) for(let bit=0;bit<8;bit++) rows.push({typ:"DO", byte:b, bit:bit, jmeno:"", popis:""});
  return rows;
}

// Rozdělí signály na vstupy/výstupy (pro zobrazení vedle sebe).
export function splitIO(rows){
  const inp=[], out=[];
  (rows||[]).forEach((r,i)=>{ const T=(r.typ||"").toUpperCase(); (T==="DO"||T==="AO"||T==="GO"?out:inp).push({r,i}); });
  return {inp, out};
}

// Kódy stanic z Layoutu (pro dropdowny v Programs/Products).
export function stationCodes(AXP){
  return (AXP.workflow||[]).map(r=>(r.cislo||"").trim()).filter(Boolean);
}

// Validace — vrací pole varování (řetězce).
export function validate(AXP){
  const warn=[];
  // unikátní názvy signálů (prázdné = rezerva, OK). Hlídá Interface + Tools + Safety IO.
  const names={};
  const collect = rows => (rows||[]).forEach(r=>{
    const nm=(r.jmeno||"").trim(); if(!nm) return;
    if(names[nm]) warn.push(t("Duplicitní název signálu: ","Duplicate signal name: ")+nm); else names[nm]=1;
  });
  collect(AXP.interface);
  (AXP.tools||[]).forEach(tl=>collect(tl.rows));
  collect(AXP.safety && AXP.safety.io);
  // mezery v kódech stanic
  (AXP.workflow||[]).forEach(r=>{ if(/\s/.test((r.cislo||""))) warn.push(t("Mezera v kódu stanice: ","Space in station code: ")+r.cislo); });
  // mezery v ID produktů
  (AXP.products||[]).forEach(r=>{ if(/\s/.test((r.id||""))) warn.push(t("Mezera v ID produktu: ","Space in product ID: ")+r.id); });
  return warn;
}

// Sloučí Interface signály do plochého seznamu s vypočtenými adresami (pro export/docs).
export function flatSignals(AXP){
  return (AXP.interface||[]).filter(r=>r.jmeno||r.typ).map(r=>{
    const a=addr(r);
    return {typ:(r.typ||"").toUpperCase(), adr_robot:a.robot, adr_plc:a.plc, jmeno:r.jmeno||"", popis:r.popis||""};
  });
}
