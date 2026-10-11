/**
 * KS Garden Services — referral / new customer intake.
 * STANDALONE PUBLIC Apps Script PROJECT — do not install in private CRM project.
 * Google Sheet: KS Garden Services - Quote CRM.
 * Deploy a separate web app, execute as owner, access Anyone, so the customer
 * can fill the form without Google account. This project cannot read contacts.
 */
const KS_REF = {
  SHEET_ID: "1OBGz9VKwv_Aog0H6rpPkUZLtAm3etHIx6YPL1Rr2dIM",
  OWNER_EMAIL: "info@ksgardenservices.co.uk",
  CRM_SHEET: "Quotes",
  DETAILS_SHEET: "Customer Details"
};
const KS_REF_HEADERS = [
  "Enquiry ID","Submitted At","Customer Name","Phone","Email",
  "Garden Address Line 1","Garden Address Line 2","Garden Town",
  "Garden County","Garden Postcode","Billing Address Same as Garden",
  "Billing Name","Billing Address Line 1","Billing Address Line 2",
  "Billing Town","Billing County","Billing Postcode","Invoice Delivery",
  "Invoice Email","Recommended By","Service","Work Details",
  "Contact Preference","Customer Status","Xero Contact ID","Xero Status"
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("New Customer Details | KS Garden Services")
    .addMetaTag("viewport","width=device-width,initial-scale=1");
}
function ksPlain_(value,max) {
  return String(value==null?"":value).trim().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g," ").slice(0,max);
}
function ksSheetSafe_(value,max) {
  const valueText=ksPlain_(value,max);
  return /^[=+\-@\t\r]/.test(valueText)?"'"+valueText:valueText;
}
function ksValidEmail_(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)&&e.length<=254;
}
function ksAddress_(data,prefix) {
  const a1=ksPlain_(data[prefix+"Line1"],170);
  const a2=ksPlain_(data[prefix+"Line2"],170);
  const city=ksPlain_(data[prefix+"Town"],90);
  const county=ksPlain_(data[prefix+"County"],90);
  const postcode=ksPlain_(data[prefix+"Postcode"],12).toUpperCase();
  if(!a1||!city||!postcode || !/^[A-Z0-9 ]{5,10}$/.test(postcode))
    throw Error("Please complete the address, town and a valid UK postcode.");
  return {line1:a1,line2:a2,town:city,county,postcode};
}
function ksAddressText_(a) {
  return [a.line1,a.line2,a.town,a.county,a.postcode].filter(Boolean).join(", ");
}
function ksFollow_(date) {
  const follow=new Date(date.getTime());
  follow.setDate(follow.getDate()+1);
  while(follow.getDay()===0||follow.getDay()===6)follow.setDate(follow.getDate()+1);
  return follow;
}
function ksDetailsSheet_() {
  const ss=SpreadsheetApp.openById(KS_REF.SHEET_ID);
  let sheet=ss.getSheetByName(KS_REF.DETAILS_SHEET);
  if(!sheet){
    sheet=ss.insertSheet(KS_REF.DETAILS_SHEET);
    sheet.getRange(1,1,1,KS_REF_HEADERS.length).setValues([KS_REF_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function ksNotifyOwner_(d,code,jobAddress,billingAddress) {
  const message=[
    "NEW CUSTOMER FORM — RECOMMENDATION",
    "",
    "Name: "+d.name,
    "Phone: "+d.phone,
    "Email: "+(d.email||"Not provided"),
    "Service: "+d.service,
    "Recommended by: "+(d.referredBy||"Not specified"),
    "",
    "Garden address: "+ksAddressText_(jobAddress),
    "Billing address: "+ksAddressText_(billingAddress),
    "Invoice delivery: "+(d.invoiceDelivery==="email"?"Email":
      d.invoiceDelivery==="post"?"Post":"No copy requested — still create invoice in Xero"),
    "Invoice email: "+(d.invoiceDelivery==="email"?d.email:"Not required"),
    "Contact preference: "+d.contactPreference,
    "",
    "Work details: "+(d.details||"None supplied"),
    "",
    "CRM status: New Enquiry",
    "CRM source: Recommendation",
    "Enquiry reference: "+code,
    "Xero: Not added — review and create/match a Xero contact when job accepted.",
    "",
    "Open your private CRM sheet to follow up:",
    "https://docs.google.com/spreadsheets/d/"+KS_REF.SHEET_ID+"/edit"
  ].join("\n");
  MailApp.sendEmail({
    to:KS_REF.OWNER_EMAIL,
    subject:"New recommended customer — "+d.name+" — "+d.service,
    body:message
  });
}
/** Public callable. Writes only new records, never reads/changes existing customers. */
function submitReferral(payload) {
  try {
    payload=payload||{};
    if(ksPlain_(payload.website,100))return {ok:true}; // honeypot
    if(payload.agreed!==true)throw Error("Please confirm we may contact you about this enquiry.");
    const name=ksPlain_(payload.name,100),phone=ksPlain_(payload.phone,30);
    const email=ksPlain_(payload.email,254).toLowerCase();
    if(name.length<2||phone.length<7||phone.length>30)
      throw Error("Please provide your name and telephone number.");
    if(email&&!ksValidEmail_(email))throw Error("Please check your email address.");
    const delivery=ksPlain_(payload.invoiceDelivery,20);
    if(!["email","post","no_copy"].includes(delivery))
      throw Error("Please choose how you would like to receive invoices.");
    if(delivery==="email"&&!ksValidEmail_(email))
      throw Error("An email address is needed for emailed invoices.");
    const contact=ksPlain_(payload.contactPreference,30)||"phone";
    if(!["phone","sms","email"].includes(contact))
      throw Error("Please select a valid contact preference.");
    if(contact==="email"&&!ksValidEmail_(email))
      throw Error("An email address is needed if you'd prefer to be contacted by email.");
    const services=[
      "Regular garden maintenance","Lawn mowing and edging","Borders and weeding",
      "Hedges and shrub cutting","One-off garden tidy","Lawn treatments",
      "Pressure washing","Other / not sure"
    ];
    const service=ksPlain_(payload.service,60);
    if(!services.includes(service))throw Error("Please select a service.");
    const garden=ksAddress_(payload,"garden");
    const same=payload.billingSame===true;
    const billing=same?garden:ksAddress_(payload,"billing");
    const billingName=ksPlain_(payload.billingName,100)||name;
    const referredBy=ksPlain_(payload.referredBy,100);
    const details=ksPlain_(payload.details,1500);
    const started=Number(payload.startedAt);
    if(!Number.isFinite(started)||started>Date.now()+30000||
      Date.now()-started<1800||Date.now()-started>48*60*60*1000)
      throw Error("Please reopen the form and try again.");
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(10000))throw Error("The form is busy. Please try again.");
    let id;
    try {
      const cache=CacheService.getScriptCache();
      const digest=Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        [phone.replace(/\D/g,""),garden.postcode,name.toLowerCase()].join("|")
      ).map(byte=>(byte<0?byte+256:byte).toString(16).padStart(2,"0")).join("");
      const key="ks-ref-"+digest.slice(0,50);
      const previous=cache.get(key);
      if(previous)return {ok:true,id:previous,duplicate:true};
      const now=new Date(),follow=ksFollow_(now);
      id=Utilities.getUuid();
      const notes=[
        "Recommended by: "+(referredBy||"Not specified"),
        "Work notes: "+(details||"None"),
        "Invoice delivery: "+delivery,
        "Billing to: "+billingName,
        "Billing address: "+ksAddressText_(billing),
        "Garden address: "+ksAddressText_(garden),
        "Communication: Minimal (essential messages only)",
        "Preferred contact: "+contact,
        "Xero contact: Not yet created"
      ].join("\n");
      const row=[
        now,ksSheetSafe_(name,100),ksSheetSafe_(phone,30),
        ksSheetSafe_(email,254),garden.postcode,ksSheetSafe_(service,60),
        "","","New Enquiry",follow,"Recommendation","","","",
        ksSheetSafe_(notes,3000),ksSheetSafe_(ksAddressText_(garden),550),
        "","","","","",id
      ];
      // CRM header is preserved exactly; no changes to existing records.
      const crm=SpreadsheetApp.openById(KS_REF.SHEET_ID).getSheetByName(KS_REF.CRM_SHEET);
      if(!crm)throw Error("CRM sheet not configured.");
      const detailsSheet=ksDetailsSheet_();
      const detailRow=[
        id,now,ksSheetSafe_(name,100),ksSheetSafe_(phone,30),ksSheetSafe_(email,254),
        ksSheetSafe_(garden.line1,170),ksSheetSafe_(garden.line2,170),
        ksSheetSafe_(garden.town,90),ksSheetSafe_(garden.county,90),garden.postcode,
        same?"Yes":"No",ksSheetSafe_(billingName,100),
        ksSheetSafe_(billing.line1,170),ksSheetSafe_(billing.line2,170),
        ksSheetSafe_(billing.town,90),ksSheetSafe_(billing.county,90),billing.postcode,
        delivery,delivery==="email"?ksSheetSafe_(email,254):"",
        ksSheetSafe_(referredBy,100),ksSheetSafe_(service,60),
        ksSheetSafe_(details,1500),contact,"New Enquiry","","Not added"
      ];
      // Detailed record first, then enquiry. Any failed second write can be
      // reconciled using the same enquiry UUID; never overwrite existing leads.
      detailsSheet.appendRow(detailRow);
      crm.appendRow(row);
      cache.put(key,id,1200); // duplicate double taps within 20 minutes
    } finally {
      lock.releaseLock();
    }
    let emailNotified=true;
    try {
      ksNotifyOwner_(
        {name,phone,email,invoiceDelivery:delivery,service,referredBy,details,contactPreference:contact},
        id,garden,billing
      );
    } catch(err){
      emailNotified=false;
      console.error("Referral email notification failed: "+err);
    }
    return {ok:true,id,emailNotified};
  } catch(err) {
    console.error("Referral submission rejected: "+err);
    return {ok:false,error:String(err.message||err).slice(0,200)};
  }
}


/**
 * Standalone public website intake (contact page and price calculator).
 * This endpoint can ONLY insert new enquiries and email the owner.
 * It never retrieves, updates or deletes existing customer data.
 */
function doPost(e) {
  let response;
  try {
    const raw=String(e&&e.postData&&e.postData.contents||"");
    if(!raw||raw.length>12000)throw Error("Invalid submission size.");
    const data=JSON.parse(raw);
    if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid submission.");
    if(ksPlain_(data.website,100)) {
      response={ok:true}; // anti-spam honeypot; no new record
    } else {
      response=ksSubmitWebsiteLead_(data);
    }
  }catch(error) {
    // Generic public error; no customer or private script information.
    console.error("Public enquiry rejected: "+(error.message||error));
    response={ok:false,error:"Please check your details and contact us by email if this continues."};
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
function ksPublicPrice_(v) {
  const n=Number(String(v==null?"":v).replace(/[£,\s]/g,""));
  return Number.isFinite(n)&&n>=0&&n<=100000&&String(v||"").trim()?n:"";
}
function ksSubmitWebsiteLead_(data) {
  const name=ksPlain_(data.name||data.customer,100);
  const phone=ksPlain_(data.phone,30);
  const email=ksPlain_(data.email,254).toLowerCase();
  const postcode=ksPlain_(data.postcode,12).toUpperCase();
  const service=ksPlain_(data.service,100)||"General garden enquiry";
  const details=ksPlain_(data.details||data.message||data.notes,1200);
  const address=ksPlain_(data.address,300);
  const guide=ksPublicPrice_(data.guide??data.guidePrice);
  const travel=ksPublicPrice_(data.travel??data.travelMiles);
  const size=ksPlain_(data.size||data.gardenSize,70);
  const condition=ksPlain_(data.condition,70);
  const area=ksPlain_(data.area,100);
  const waste=ksPlain_(data.waste||data.greenWaste,60);
  if(name.length<2||phone.length<7||phone.length>30)
    throw Error("A name and contact telephone number are required.");
  if(email&&!ksValidEmail_(email))throw Error("Invalid email address.");
  if(!postcode||!/^[A-Z0-9 ]{5,10}$/.test(postcode))
    throw Error("Please enter a valid postcode.");
  const sourceText=ksPlain_(data.source,70).toLowerCase();
  const source=/(price|calculator|estimate|guide)/.test(sourceText)?"Website Price Guide":"Website Contact";
  const now=new Date();
  const nextFollow=ksFollow_(now);
  const digest=Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    [name.toLowerCase(),phone.replace(/\D/g,""),postcode,service.toLowerCase(),source].join("|")
  ).map(byte=>(byte<0?byte+256:byte).toString(16).padStart(2,"0")).join("");
  const cache=CacheService.getScriptCache(),key="ks-web-"+digest.slice(0,55);
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw Error("Form is busy.");
  let id;
  try{
    const existing=cache.get(key);
    if(existing)return {ok:true,id:existing,duplicate:true};
    id=Utilities.getUuid();
    const notes=[
      details,
      size?"Garden size: "+size:"",
      condition?"Condition: "+condition:"",
      area?"Area: "+area:"",
      waste?"Green waste: "+waste:""
    ].filter(Boolean).join("\n");
    const row=[
      now,ksSheetSafe_(name,100),ksSheetSafe_(phone,30),
      ksSheetSafe_(email,254),postcode,ksSheetSafe_(service,100),
      guide,"","New Enquiry",nextFollow,source,"","","",
      ksSheetSafe_(notes,2000),ksSheetSafe_(address,300),
      travel,waste?ksSheetSafe_(waste,60):"",
      ksSheetSafe_(size,70),ksSheetSafe_(condition,70),
      ksSheetSafe_(area,100),id
    ];
    const sh=SpreadsheetApp.openById(KS_REF.SHEET_ID).getSheetByName(KS_REF.CRM_SHEET);
    if(!sh)throw Error("Quotes tab is unavailable.");
    sh.appendRow(row);
    cache.put(key,id,1200);
  }finally{lock.releaseLock()}
  let emailNotified=true;
  try{
    MailApp.sendEmail({
      to:KS_REF.OWNER_EMAIL,
      subject:"New "+(source==="Website Price Guide"?"price-guide":"website")+" enquiry — "+name,
      body:[
        "New KS Garden Services enquiry",
        "Customer: "+name,
        "Phone: "+phone,
        "Email: "+(email||"Not provided"),
        "Postcode: "+postcode,
        "Service: "+service,
        "Guide price: "+(guide!==""?"£"+guide:"Not provided"),
        "Source: "+source,
        "Details: "+(notes||"Not provided"),
        "Reference: "+id,
        "Saved as New Enquiry; follow up in your private CRM."
      ].join("\n")
    });
  }catch(err){
    emailNotified=false;
    console.error("Public enquiry alert email failed: "+(err.message||err));
  }
  return {ok:true,id,emailNotified};
}
