(()=>{
"use strict";
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(n);
const num=id=>{const n=Number($(id).value);return Number.isFinite(n)&&n>0?n:0};
const round2=n=>Math.round((n+Number.EPSILON)*100)/100;
const areaText=n=>Number(n).toFixed(2)+" m²";
const fields=["qCustomer","qNumber","qEmail","qPhone","qAddress","qType","qSurface","qHours","qHourlyRate","qMaterials","qWaste","qTravel","qOther","qDiscount","qVat","qSandKg","qSealerCoverage","qCoats","qTubLitres","qStatus","qValidDays","qNotes","rWash","rWeed","rSand","rSeal","rPre","sWash","sWeed","sSand","sSeal","sPre"];
const checked=new Set(["sWash","sWeed","sSand","sSeal","sPre"]);
const services=[
  ["sWash","rWash","Pressure washing"],
  ["sWeed","rWeed","Weed removal / treatment"],
  ["sSand","rSand","Re-sanding joints"],
  ["sSeal","rSeal","Sealing"],
  ["sPre","rPre","Pre-treatment / specialist clean"]
];
let sections=[],currentId="",photo=null,photoMode="calibrate",refPoints=[],outline=[],selectedPhotoUrl="";
const node=(tag,cls,content)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=String(content);return x};
function status(message,error=false){
 const el=$("qbStatus");el.textContent=message;el.classList.toggle("error",error);
}
function numberText(n){return Number(n).toLocaleString("en-GB",{maximumFractionDigits:2})}
function quoteNo(){const d=new Date(),part=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("");const v=new Uint32Array(1);crypto.getRandomValues(v);return "KS-Q-"+part+"-"+String(v[0]%10000).padStart(4,"0")}
function calc(){
 const totalArea=round2(Math.max(0,sections.reduce((sum,s)=>sum+s.area*(s.sign||1),0)));
 const items=[];
 for(const [tick,rate,label] of services){
  if($(tick).checked){
   const price=round2(totalArea*num(rate));items.push({label:label+" — "+areaText(totalArea),sum:price});
  }
 }
 const labour=round2(num("qHours")*num("qHourlyRate")),materials=num("qMaterials"),waste=num("qWaste"),travel=num("qTravel"),other=num("qOther");
 const hiddenExtras=round2(labour+materials+waste+travel+other);
 if(hiddenExtras)items.push({label:"Additional work, materials & site costs",sum:hiddenExtras});
 const beforeDiscount=round2(items.reduce((sum,item)=>sum+item.sum,0));
 const discount=Math.min(num("qDiscount"),beforeDiscount);
 const net=round2(beforeDiscount-discount),vat=round2(net*num("qVat")/100),total=round2(net+vat);
 return {totalArea,items,labour,materials,waste,travel,other,net,discount,vat,total};
}
function renderSections(){
 $("mSections").replaceChildren();
 $("mCount").textContent=String(sections.length);
 $("mTotal").textContent=areaText(calc().totalArea);
 for(const [index,s] of sections.entries()){
  const row=node("div","qb-section-row"),desc=node("div");
  const sign=s.sign===-1?"− ":"+ ";
  desc.append(node("strong","",sign+areaText(s.area)+" · "+s.name));
  desc.append(node("small","",s.method||"Measured on site"));
  const remove=node("button","","Remove");remove.type="button";
  remove.onclick=()=>{sections.splice(index,1);renderAll()};
  row.append(desc,remove);$("mSections").append(row);
 }
 if(!sections.length)$("mSections").append(node("p","qb-muted","No sections yet. Add at least one measured shape."));
}
function renderAll(){
 const c=calc();renderSections();
 $("qGrandTotal").textContent=money(c.total);
 const material=$("qMaterialsEstimate");material.replaceChildren();
 if($("sSand").checked&&num("qSandKg")){
  material.append(node("p","","Kiln-dried sand planning quantity: "+numberText(round2(c.totalArea*num("qSandKg")))+" kg (using the kg/m² allowance you entered)."));
 }
 if($("sSeal").checked&&num("qSealerCoverage")){
  const coats=Math.max(1,Math.round(num("qCoats")||1)),litres=round2(c.totalArea*coats/num("qSealerCoverage"));
  let detail="Sealer planning quantity: "+numberText(litres)+" litres for "+coats+" coat(s), using your stated product coverage.";
  if(num("qTubLitres"))detail+=" Allow "+Math.ceil(litres/num("qTubLitres"))+" tub(s) of "+numberText(num("qTubLitres"))+" L.";
  material.append(node("p","",detail));
 }
 if(!material.children.length)material.append(node("p","","Enter the coverage specified by your sand or sealer supplier to calculate a material quantity. Coverage varies with surface, joint size and product."));
 const date=new Date();
 $("qPaperNo").textContent="Quote: "+($("qNumber").value||"Draft");
 $("qPaperDate").textContent="Prepared "+date.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
 $("qPaperTitle").textContent=$("qType").value+" — "+$("qSurface").value;
 const client=$("qPaperClient");client.replaceChildren();
 const clientText=[$("qCustomer").value,$("qAddress").value].filter(Boolean).join("\n");
 client.append(node("p","qb-paper-client",clientText||"Customer quotation"));
 const lines=$("qPaperLines");lines.replaceChildren();
 const areaLine=node("div","qb-paper-line");
 areaLine.append(node("span","","Measured work area"),node("strong","",areaText(c.totalArea)));
 lines.append(areaLine);
 for(const item of c.items){
  const line=node("div","qb-paper-line");line.append(node("span","",item.label),node("strong","",money(item.sum)));
  lines.append(line);
 }
 if(c.discount){const line=node("div","qb-paper-line");line.append(node("span","","Discount"),node("strong","","−"+money(c.discount)));lines.append(line)}
 if(c.vat){const line=node("div","qb-paper-line");line.append(node("span","","VAT ("+numberText(num("qVat"))+"%)"),node("strong","",money(c.vat)));lines.append(line)}
 $("qPaperTotal").textContent=money(c.total);
 const notes=$("qPaperNotes");notes.replaceChildren();
 if($("qNotes").value.trim())notes.append(node("p","qb-paper-notes",$("qNotes").value.trim()));
 const valid=Number($("qValidDays").value);
 notes.append(node("p","qb-disclaimer","Quote valid for "+(Number.isInteger(valid)&&valid>=1?valid:30)+" days from date prepared, subject to site conditions and confirmation of scope."));
}
function updateShape(){
 const shape=$("mShape").value;
 $("mLengthLabel").hidden=shape==="manual";
 $("mWidthLabel").hidden=shape==="manual";
 $("mSecondWidthLabel").hidden=shape!=="trapezium";
 $("mAreaLabel").hidden=shape!=="manual";
 $("mLengthLabel").firstChild.textContent=shape==="trapezium"?"Perpendicular height (m)":"Length / perpendicular height (m)";
 $("mWidthLabel").firstChild.textContent=shape==="trapezium"?"First parallel width (m)":"Width / base (m)";
 updateInstant();
}
function sectionArea(){
 const shape=$("mShape").value,a=num("mLength"),b=num("mWidth"),c=num("mSecondWidth");
 if(shape==="rectangle")return a*b;
 if(shape==="triangle")return a*b/2;
 if(shape==="trapezium")return a*(b+c)/2;
 return num("mArea");
}
function updateInstant(){
 const area=sectionArea();
 $("mInstant").textContent="Section: "+(area>0?areaText(area):"enter dimensions");
}
$("mShape").addEventListener("change",updateShape);
for(const id of ["mLength","mWidth","mSecondWidth","mArea"])$(id).addEventListener("input",updateInstant);
$("mAdd").addEventListener("click",()=>{
 const a=sectionArea();
 if(!Number.isFinite(a)||a<=0||a>1000000){status("Enter valid positive measurements first.",true);return}
 const shape=$("mShape").selectedOptions[0].textContent,sign=Number($("mSign").value);
 sections.push({name:$("mName").value.trim()||shape,area:round2(a),sign,method:shape+" — measured dimensions"});
 if(sections.length>80)sections.splice(0,1);
 $("mLength").value="";$("mWidth").value="";$("mSecondWidth").value="";$("mArea").value="";$("mName").value="";
 status("Section added. Add further parts or deductions.");updateInstant();renderAll();
});
$("qbDimsTab").onclick=()=>setMeasureMode("dims");
$("qbPhotoTab").onclick=()=>setMeasureMode("photo");
function setMeasureMode(mode){
 $("qbDimsPanel").hidden=mode!=="dims";$("qbPhotoPanel").hidden=mode!=="photo";
 $("qbDimsTab").setAttribute("aria-pressed",String(mode==="dims"));
 $("qbPhotoTab").setAttribute("aria-pressed",String(mode==="photo"));
}
function photoState(){
 const c=$("pCanvas"),context=c.getContext("2d"),w=c.width,h=c.height;
 context.clearRect(0,0,w,h);context.fillStyle="#e4ebe4";context.fillRect(0,0,w,h);
 if(photo)context.drawImage(photo,0,0,w,h);
 context.lineWidth=Math.max(2,w/300);
 function dot([x,y],color,index){
  context.beginPath();context.fillStyle=color;context.strokeStyle="white";context.lineWidth=2;
  context.arc(x,y,Math.max(6,w/140),0,2*Math.PI);context.fill();context.stroke();
  context.fillStyle="white";context.font="bold "+Math.max(12,w/60)+"px sans-serif";
  context.fillText(String(index+1),x+9,y-10);
 }
 if(refPoints.length){
  context.strokeStyle="#ffbf37";context.lineWidth=Math.max(3,w/220);
  if(refPoints.length===2){context.beginPath();context.moveTo(...refPoints[0]);context.lineTo(...refPoints[1]);context.stroke()}
  refPoints.forEach((p,i)=>dot(p,"#b8780e",i));
 }
 if(outline.length){
  context.strokeStyle="#fff";context.lineWidth=Math.max(4,w/190);
  context.beginPath();outline.forEach((p,i)=>i?context.lineTo(...p):context.moveTo(...p));
  if(outline.length>=3)context.closePath();
  context.stroke();
  context.fillStyle="rgba(43,115,68,.30)";if(outline.length>=3)context.fill();
  context.strokeStyle="#27713e";context.lineWidth=Math.max(2,w/330);
  context.stroke();
  outline.forEach((p,i)=>dot(p,"#226b43",i));
 }
 const a=photoArea();
 let message=photo?"Reference: "+refPoints.length+"/2 points. Outline: "+outline.length+" points. ":"Upload a photo to start.";
 if(refPoints.length===2){
  message+="Reference length "+(num("pLength")?numberText(num("pLength"))+" m":"not yet entered")+". ";
 }
 if(a)message+="Estimated area: "+areaText(a)+". Check against a measured dimension before quoting.";
 $("pReadout").textContent=message;
}
function photoArea(){
 if(refPoints.length!==2||outline.length<3||!num("pLength"))return 0;
 const dx=refPoints[0][0]-refPoints[1][0],dy=refPoints[0][1]-refPoints[1][1];
 const px=Math.hypot(dx,dy);if(px<10)return 0;
 let sum=0;for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length];sum+=a[0]*b[1]-b[0]*a[1];
 }
 return Math.abs(sum)/2*Math.pow(num("pLength")/px,2);
}
function photoButtonMode(mode){
 photoMode=mode;$("pCalibrate").setAttribute("aria-pressed",String(mode==="calibrate"));
 $("pTrace").setAttribute("aria-pressed",String(mode==="trace"));
 status(mode==="calibrate"?"Tap both ends of your measured reference.":"Tap each corner of the driveway boundary in order.");
}
$("pCalibrate").onclick=()=>photoButtonMode("calibrate");
$("pTrace").onclick=()=>photoButtonMode("trace");
$("pUndo").onclick=()=>{if(photoMode==="trace")outline.pop();else refPoints.pop();photoState()};
$("pClear").onclick=()=>{refPoints=[];outline=[];photoState();status("All photo points cleared.")};
$("pLength").addEventListener("input",photoState);
$("pCanvas").addEventListener("click",event=>{
 if(!photo)return;
 const canvas=$("pCanvas"),r=canvas.getBoundingClientRect();
 const p=[(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height];
 if(!p.every(Number.isFinite))return;
 if(photoMode==="calibrate"){
  if(refPoints.length===2)refPoints=[];
  refPoints.push(p);if(refPoints.length===2)photoButtonMode("trace");
 }else{if(outline.length>=50){status("Maximum 50 outline points.",true);return}outline.push(p)}
 photoState();
});
$("pImage").addEventListener("change",async event=>{
 const file=event.target.files[0];if(!file)return;
 const oldUrl=selectedPhotoUrl;selectedPhotoUrl=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=selectedPhotoUrl;await img.decode();
  photo=img;const maxDim=1100;const scale=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=$("pCanvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  $("pEmpty").hidden=true;refPoints=[];outline=[];
  photoButtonMode("calibrate");photoState();status("Photo loaded. Set a reference distance measured on the same flat surface.");
 }catch(err){photo=null;status("The photo couldn't be opened. Try a JPEG or an image saved from Photos.",true);}
 finally{if(oldUrl)URL.revokeObjectURL(oldUrl)}
});
$("pAdd").onclick=()=>{
 const area=photoArea();
 if(!Number.isFinite(area)||area<=0||area>1000000){status("Set two reference points, enter their measured length and trace at least three boundary points.",true);return}
 sections.push({name:$("pName").value.trim()||"Photo-traced section",area:round2(area),sign:1,method:"Approximate photo trace; verify physically"});
 status("Photo-traced area added as an estimate. Check it with a real measurement.");
 renderAll();
};
async function api(path,method="GET",data){
 const o={method,credentials:"same-origin",cache:"no-store"};
 if(data!==undefined){o.headers={"Content-Type":"application/json"};o.body=JSON.stringify(data)}
 const res=await fetch(path,o),body=await res.json().catch(()=>({}));
 if(!res.ok){const e=new Error(body.error||"Unable to contact the private quote service.");e.status=res.status;throw e}
 return body;
}
async function auth(){
 try{
  await api("/api/admin/session");
  $("qbSignIn").hidden=true;$("qbApp").hidden=false;renderAll();
  await loadQuotes();
 }catch(e){
  $("qbApp").hidden=true;$("qbSignIn").hidden=false;
 }
 sendHeight();
}
function snapshot(){
 const values={};
 for(const id of fields){
  if(checked.has(id))values[id]=$(id).checked;
  else values[id]=$(id).value;
 }
 return {values,sections:sections.map(s=>({name:s.name,area:s.area,sign:s.sign,method:s.method}))};
}
function applyQuote(q){
 const snap=q.snapshot||{},values=snap.values||{};
 for(const id of fields){
  if(!Object.prototype.hasOwnProperty.call(values,id))continue;
  if(checked.has(id))$(id).checked=Boolean(values[id]);
  else $(id).value=String(values[id]??"");
 }
 sections=Array.isArray(snap.sections)?snap.sections.filter(s=>typeof s==="object"&&Number.isFinite(Number(s.area))&&Number(s.area)>=0&&Number(s.area)<1000000).map(s=>({
   name:String(s.name||"Section").slice(0,70),area:Number(s.area),sign:s.sign===-1?-1:1,method:String(s.method||"Measured")
 })): [];
 currentId=q.id;renderAll();status("Quote loaded. Make any changes and save again.");
 document.getElementById("qbCustomer").scrollIntoView({behavior:"smooth",block:"start"});
}
function reset(){
 for(const id of fields){
  if(checked.has(id))$(id).checked=id==="sWash";
  else if(id==="qCoats")$(id).value="2";
  else if(id==="qValidDays")$(id).value="30";
  else if(id==="qType")$(id).selectedIndex=0;
  else if(id==="qSurface")$(id).selectedIndex=0;
  else if(id==="qStatus")$(id).value="Draft";
  else $(id).value="";
 }
 sections=[];currentId="";$("qNumber").value=quoteNo();
 renderAll();status("New draft started.");
}
$("qbNew").onclick=()=>{if(!currentId||confirm("Start a new blank quote? Unsaved changes will be lost."))reset()};
async function save(){
 const name=$("qCustomer").value.trim();if(!name){status("Add the customer's name before saving.",true);$("qCustomer").focus();return;}
 if(!$("qNumber").value.trim())$("qNumber").value=quoteNo();
 const c=calc(),payload={
  id:currentId||undefined,quote_no:$("qNumber").value.trim(),customer_name:name,
  area_m2:c.totalArea,total_gbp:c.total,status:$("qStatus").value,snapshot:snapshot()
 };
 const btn=$("qSave");btn.disabled=true;
 try{
  const result=await api("/api/admin/quotes","POST",payload);
  currentId=result.id;status("Saved securely to your KS admin account.");
  $("qSavedState").textContent="Quote saved · "+new Date().toLocaleString("en-GB");
  await loadQuotes();
 }catch(e){status(e.message,true)}
 finally{btn.disabled=false}
}
$("qSave").onclick=save;
async function loadQuotes(){
 const container=$("qSavedList");container.replaceChildren(node("p","qb-muted","Loading saved quotes…"));
 try{
  const data=await api("/api/admin/quotes"),quotes=data.quotes||[];
  container.replaceChildren();
  if(!quotes.length){container.append(node("p","qb-muted","No saved quotations yet."));return}
  for(const q of quotes){
    const row=node("div","qb-saved-row"),d=node("div");
    d.append(node("strong","",q.customer_name+" · "+q.quote_no));
    d.append(node("small","",q.status+" · "+areaText(q.area_m2)+" · "+money(q.total_gbp)));
    const actions=node("div","qb-actions"),open=node("button","","Edit"),remove=node("button","","Delete");
    open.type=remove.type="button";
    open.onclick=()=>applyQuote(q);
    remove.onclick=async()=>{
      if(!confirm("Permanently delete this saved quotation?"))return;
      try{
        await api("/api/admin/quotes/"+q.id,"DELETE");
        if(currentId===q.id)currentId="";
        status("Saved quote deleted.");await loadQuotes();
      }catch(e){status(e.message,true)}
    };
    actions.append(open,remove);row.append(d,actions);container.append(row);
  }
 }catch(e){container.replaceChildren(node("p","qb-muted",e.message))}
}
$("qReload").onclick=loadQuotes;
function summaryText(){
 const c=calc();
 const lines=[
  "KS Garden Services — Quotation",
  "Keeping Gardens Looking Their Best.",
  "Quote: "+$("qNumber").value,
  "Customer: "+$("qCustomer").value,
  $("qAddress").value,
  "Service: "+$("qType").value+" ("+$("qSurface").value+")",
  "Measured area: "+areaText(c.totalArea),
  ...c.items.map(x=>x.label+": "+money(x.sum)),
  c.discount?"Discount: -"+money(c.discount):"",
  c.vat?"VAT: "+money(c.vat):"",
  "TOTAL: "+money(c.total),
  $("qNotes").value,
  "Valid for "+($("qValidDays").value||"30")+" days, subject to confirmation.",
  "info@ksgardenservices.co.uk"
 ];
 return lines.filter(Boolean).join("\n");
}
$("qCopy").onclick=async()=>{
 try{await navigator.clipboard.writeText(summaryText());status("Customer quote copied. You can paste it into WhatsApp or an email.")}
 catch{status("Copy was blocked by your browser. Use Print / Save PDF instead.",true)}
};
$("qbPrint").onclick=()=>window.print();
$("qPrint2").onclick=()=>window.print();
for(const id of fields){
 $(id).addEventListener(checked.has(id)?"change":"input",renderAll);
 if(!checked.has(id))$(id).addEventListener("change",renderAll);
}
function sendHeight(){
 if(window.parent!==window)window.parent.postMessage({type:"ks-quote-height",height:document.documentElement.scrollHeight},location.origin);
}
if("ResizeObserver" in window)new ResizeObserver(sendHeight).observe(document.body);
window.addEventListener("message",e=>{if(e.origin===location.origin&&e.data?.type==="ks-refresh-quotes")auth()});
window.addEventListener("load",sendHeight);
reset();updateShape();photoState();auth();
})();