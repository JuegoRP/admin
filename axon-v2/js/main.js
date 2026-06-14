// main.js — entry point: inicializace, jazyk, jednorázové wiring, první render.
import { S, loadProject } from "./state.js";
import { render, wireOnce } from "./builder.js";

function applyLang(){
  document.documentElement.lang = S.lang;
  document.querySelectorAll("[data-i-cs]").forEach(el=>{ el.textContent = S.lang==="en" ? el.getAttribute("data-i-en") : el.getAttribute("data-i-cs"); });
  document.querySelectorAll(".lang button").forEach(b=> b.classList.toggle("on", b.dataset.l===S.lang));
  render();
}

window.addEventListener("DOMContentLoaded", ()=>{
  S.AXP = loadProject();
  try{ S.lang = localStorage.getItem("axon_lang") || "cs"; }catch(e){ S.lang="cs"; }
  const app = document.getElementById("ax-app");
  if(app) wireOnce(app);
  document.querySelectorAll(".lang button").forEach(b=> b.addEventListener("click", ()=>{ S.lang=b.dataset.l; try{localStorage.setItem("axon_lang",S.lang)}catch(e){} applyLang(); }));
  applyLang();
});
