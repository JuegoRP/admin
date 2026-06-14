// main.js — entry: init, jazyk, motiv (light/dark), drag&drop, jednorázové wiring.
import { S, loadProject, importProject, saveProject, t } from "./state.js";
import { render, wireOnce } from "./builder.js";
import { parseCSV } from "./io.js";

function applyLang(){
  document.documentElement.lang = S.lang;
  document.querySelectorAll("[data-i-cs]").forEach(el=>{ el.textContent = S.lang==="en" ? el.getAttribute("data-i-en") : el.getAttribute("data-i-cs"); });
  document.querySelectorAll(".lang button").forEach(b=> b.classList.toggle("on", b.dataset.l===S.lang));
  render();
}
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  const tb=document.getElementById("theme-toggle"); if(tb) tb.textContent = theme==="light" ? "☀️" : "🌙";
  try{ localStorage.setItem("axon_theme", theme); }catch(e){}
}

// drag & drop importu
function importTable(text){
  const rows=parseCSV(text); if(!rows.length) return false;
  const head=rows[0].map(h=>(h||"").toLowerCase().trim());
  const find=(...keys)=>head.findIndex(h=>keys.some(k=>h.includes(k)));
  const iTyp=find("type","typ"), iByte=find("byte"), iBit=find("bit"),
        iName=find("name","signal","jmen","jméno"), iDesc=find("desc","popis");
  const hasHeader = iTyp>=0||iName>=0;
  const data=(hasHeader?rows.slice(1):rows).filter(r=>r.join("").trim()).map(r=>({
    typ:(iTyp>=0?r[iTyp]:r[0]||"").toUpperCase().trim(),
    byte:iByte>=0?r[iByte]:"", bit:iBit>=0?r[iBit]:"",
    jmeno:iName>=0?r[iName]:(r[1]||""), popis:iDesc>=0?r[iDesc]:(r[2]||""),
  }));
  if(!data.length) return false;
  S.AXP.interface = (S.AXP.interface||[]).concat(data); S.tab="interface"; saveProject(); render(); return true;
}
function handleDropFile(f){
  const rd=new FileReader();
  rd.onload=()=>{
    const name=(f.name||"").toLowerCase();
    if(name.endsWith(".json")){ try{ importProject(rd.result); render(); }catch(e){ alert(t("Neplatný JSON projekt.","Invalid JSON project.")); } }
    else if(name.endsWith(".csv")){ if(!importTable(rd.result)) alert(t("Nepodařilo se načíst CSV.","Could not read CSV.")); }
    else alert(t("Přetáhni .json (projekt) nebo .csv (tabulka). XLSX vlož přes Ctrl+V do editoru.","Drop .json (project) or .csv (table). For XLSX use Ctrl+V paste in the editor."));
  };
  rd.readAsText(f);
}

window.addEventListener("DOMContentLoaded", ()=>{
  S.AXP = loadProject();
  try{ S.lang = localStorage.getItem("axon_lang") || "en"; }catch(e){ S.lang="en"; }
  const theme = (()=>{ try{ return localStorage.getItem("axon_theme") || "dark"; }catch(e){ return "dark"; } })();
  applyTheme(theme);

  const app = document.getElementById("ax-app");
  if(app) wireOnce(app);
  document.querySelectorAll(".lang button").forEach(b=> b.addEventListener("click", ()=>{ S.lang=b.dataset.l; try{localStorage.setItem("axon_lang",S.lang)}catch(e){} applyLang(); }));
  const tb=document.getElementById("theme-toggle");
  if(tb) tb.addEventListener("click", ()=>{ const cur=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light"; applyTheme(cur); });

  // drag & drop
  const drop=document.getElementById("ax-drop");
  window.addEventListener("dragover", e=>{ if(e.dataTransfer && Array.prototype.includes.call(e.dataTransfer.types,"Files")){ e.preventDefault(); if(drop) drop.classList.add("on"); } });
  window.addEventListener("dragleave", e=>{ if(e.relatedTarget===null && drop) drop.classList.remove("on"); });
  window.addEventListener("drop", e=>{ e.preventDefault(); if(drop) drop.classList.remove("on"); const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) handleDropFile(f); });

  applyLang();
});
