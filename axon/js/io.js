// io.js — export XLSX, ZIP (store), CSV import. Bez DOM (kromě download helperu).
import { esc } from "./state.js";

// ---- ZIP (store, bez komprese) ----
const CRC=(()=>{const tb=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;tb[n]=c>>>0}return tb})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
export function zipStore(files){
  const enc=new TextEncoder();const parts=[],cd=[];let off=0;
  const u16=n=>[n&255,(n>>8)&255], u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255];
  files.forEach(f=>{
    const name=enc.encode(f.name), data=typeof f.data=="string"?enc.encode(f.data):f.data, crc=crc32(data), len=data.length;
    const lh=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(len),u32(len),u16(name.length),u16(0));
    parts.push(new Uint8Array(lh),name,data);
    const ch=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(len),u32(len),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off));
    cd.push(new Uint8Array(ch),name); off+=lh.length+name.length+len;
  });
  let cdoff=off,cdlen=0; cd.forEach(p=>cdlen+=p.length);
  const eo=[].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdlen),u32(cdoff),u16(0));
  const all=parts.concat(cd,[new Uint8Array(eo)]); let total=0; all.forEach(p=>total+=p.length);
  const out=new Uint8Array(total); let q=0; all.forEach(p=>{out.set(p,q);q+=p.length}); return out;
}

// ---- XLSX ----
function colL(i){let s="";i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function xe(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,"")}
function sheetXml(headers,rows){
  let x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  [headers].concat(rows).forEach((row,r)=>{x+='<row r="'+(r+1)+'">';row.forEach((c,ci)=>{x+='<c r="'+colL(ci)+(r+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xe(c)+'</t></is></c>'});x+='</row>'});
  return x+'</sheetData></worksheet>';
}
export function makeXLSX(headers,rows){
  const CT='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const RELS='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const WB='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Interface" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const WBR='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  return zipStore([{name:"[Content_Types].xml",data:CT},{name:"_rels/.rels",data:RELS},{name:"xl/workbook.xml",data:WB},{name:"xl/_rels/workbook.xml.rels",data:WBR},{name:"xl/worksheets/sheet1.xml",data:sheetXml(headers,rows)}]);
}

// ---- CSV import ----
export function parseCSV(text){
  const rows=[]; let row=[], cur="", q=false;
  const sep = (text.split("\n")[0].split(";").length > text.split("\n")[0].split(",").length) ? ";" : ",";
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++} else q=false } else cur+=ch }
    else { if(ch==='"') q=true; else if(ch===sep){row.push(cur);cur=""} else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n")i++; if(cur!==""||row.length){row.push(cur);rows.push(row);row=[];cur=""} } else cur+=ch }
  }
  if(cur!==""||row.length){row.push(cur);rows.push(row)}
  return rows;
}

// ---- download helper (DOM) ----
export function download(filename, data, mime){
  const blob = new Blob([data], {type: mime||"application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
