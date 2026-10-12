/**
 * KS Garden Services — private on-site area measuring add-on.
 * Install ONLY in the owner-only Apps Script CRM, not public enquiries.
 * Manual MULTIPLE rectangle and Google Maps outline estimates are both supported.
 * Entries save to a dedicated Measurements sheet. No customer is contacted.
 */
const KS_AREA_COLUMNS_ = [
  "Measurement ID","Created At","Customer","Enquiry ID","Surface",
  "Method","Length (m)","Width (m)","Area (m²)","Notes","Outline (Lat/Lng)","Rectangles (JSON)"
];
function ksAreaSheet_() {
  const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sheet=ss.getSheetByName("Measurements");
  if(!sheet){
    sheet=ss.insertSheet("Measurements");
    sheet.getRange(1,1,1,KS_AREA_COLUMNS_.length).setValues([KS_AREA_COLUMNS_]);
    sheet.setFrozenRows(1);
  }else{
    // One new column only; existing measurements remain in their original rows.
    const existing=String(sheet.getRange(1,12).getValue()||"").trim();
    if(existing&&existing!==KS_AREA_COLUMNS_[11])
      throw Error("Measurements column L is already used. No records were changed.");
    if(!existing)sheet.getRange(1,12).setValue(KS_AREA_COLUMNS_[11]);
  }
  return sheet;
}
function ksAreaSafeText_(value,maxLength) {
  let s=String(value||"").trim().slice(0,maxLength);
  if(/^[=+@-]/.test(s)) s="'"+s;
  return s;
}
function ksAreaCustomer_(id) {
  if(!id)return {id:"",name:"Unassigned"};
  const lead=getLeads().find(x=>String(x.id)===String(id));
  if(!lead)throw Error("This customer is not in your private CRM.");
  return {id:String(lead.id),name:String(lead.name||"Unnamed customer")};
}
/** Save an area estimate after a deliberate tap. Only the business owner can access. */
function ksSaveAreaMeasurement(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const method=String(input.method||"manual");
  const surface=String(input.surface||"driveway");
  if(!["manual","map"].includes(method))throw Error("Unknown measuring method.");
  if(!["driveway","patio","lawn","other"].includes(surface))throw Error("Choose a valid surface.");
  const area=Number(input.area);
  const length=Number(input.length);
  const width=Number(input.width);
  if(!Number.isFinite(area)||area<=0||area>1000000)throw Error("Enter a valid area in square metres.");
  let rectangles="",rectangleCount=0;
  if(method==="manual"){
    if(Array.isArray(input.rectangles)&&input.rectangles.length){
      if(input.rectangles.length>25)throw Error("You can add up to 25 rectangles.");
      const dimensions=input.rectangles.map((r,i)=>{
        const l=Number(r&&r.length),w=Number(r&&r.width);
        if(!Number.isFinite(l)||!Number.isFinite(w)||l<=0||w<=0||l>10000||w>10000)
          throw Error("Rectangle "+(i+1)+" requires positive length and width in metres.");
        if(l*w>1000000)throw Error("Rectangle "+(i+1)+" is too large.");
        return {length:Number(l.toFixed(3)),width:Number(w.toFixed(3))};
      });
      const calculated=dimensions.reduce((sum,r)=>sum+r.length*r.width,0);
      if(calculated>1000000||Math.abs(calculated-area)>Math.max(.05,calculated*.002))
        throw Error("Rectangle total does not match the submitted area.");
      rectangles=JSON.stringify(dimensions);
      rectangleCount=dimensions.length;
    }else{
      if(!Number.isFinite(length)||length<=0||length>10000||
         !Number.isFinite(width)||width<=0||width>10000||
         Math.abs((length*width)-area)>Math.max(.05,area*.002))
        throw Error("Length, width and area do not match.");
      rectangles=JSON.stringify([{length:Number(length.toFixed(3)),width:Number(width.toFixed(3))}]);
      rectangleCount=1;
    }
  }else if(Array.isArray(input.rectangles)&&input.rectangles.length){
    throw Error("Rectangles are supported in manual measuring mode only.");
  }
  let outline="";
  if(method==="map"){
    const points=Array.isArray(input.points)?input.points:[];
    if(points.length<3||points.length>60)throw Error("Draw at least three corners on the map.");
    const clean=points.map(p=>{
      const lat=Number(p.lat),lng=Number(p.lng);
      if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180)
        throw Error("The map contains an invalid coordinate.");
      return [Number(lat.toFixed(7)),Number(lng.toFixed(7))];
    });
    // Independently recompute map area on the server rather than trusting submitted totals.
    const rad=Math.PI/180,Earth=6371008.8;
    const origin=clean[0],cos=Math.cos(origin[0]*rad);
    const planar=clean.map(p=>[(p[1]-origin[1])*rad*cos*Earth,(p[0]-origin[0])*rad*Earth]);
    let twiceArea=0;
    for(let i=0;i<planar.length;i++){
      const a=planar[i],b=planar[(i+1)%planar.length];
      twiceArea+=a[0]*b[1]-b[0]*a[1];
    }
    const calculated=Math.abs(twiceArea)/2;
    if(calculated<=0||calculated>1000000||Math.abs(calculated-area)>Math.max(.5,calculated*.03))
      throw Error("Map area did not validate. Redraw the outline.");
    outline=JSON.stringify(clean);
  }
  const lead=ksAreaCustomer_(String(input.leadId||"").trim());
  const record=[
    Utilities.getUuid(),
    new Date(),
    ksAreaSafeText_(lead.name,120),
    lead.id,
    surface,
    method,
    method==="manual"&&rectangleCount===1
      ?JSON.parse(rectangles)[0].length:"",
    method==="manual"&&rectangleCount===1
      ?JSON.parse(rectangles)[0].width:"",
    Number(area.toFixed(2)),
    ksAreaSafeText_(input.notes,600),
    outline,
    rectangles
  ];
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw Error("CRM is busy. Try again.");
  try{ksAreaSheet_().appendRow(record);}finally{lock.releaseLock();}
  return {ok:true,id:record[0],area:record[8],customer:lead.name,
    rectangles:rectangleCount};
}
/** Show up to 20 newest saved measurements for one selected CRM customer. */
function ksListAreaMeasurements(leadId){
  ksBookingOwnerOnly_();
  const id=String(leadId||"").trim();
  if(!id)return [];
  ksAreaCustomer_(id);
  const sh=ksAreaSheet_(),n=sh.getLastRow();
  if(n<2)return [];
  return sh.getRange(2,1,n-1,KS_AREA_COLUMNS_.length).getValues()
    .filter(r=>String(r[3])===id).slice(-20).reverse().map(r=>({
      id:String(r[0]),date:Utilities.formatDate(new Date(r[1]),"Europe/London","dd MMM yyyy"),
      surface:String(r[4]),method:String(r[5]),area:Number(r[8]),notes:String(r[9]||""),
      rectangles:(()=>{
        try{
          const list=JSON.parse(String(r[11]||"[]"));
          return Array.isArray(list)?list:[];
        }catch(e){return [];}
      })()
    }));
}
