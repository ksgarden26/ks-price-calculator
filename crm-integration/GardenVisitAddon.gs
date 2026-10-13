/**
 * KS Garden Services — owner-only GPS customer check-in and Garden Passport.
 * Add to the PRIVATE Apps Script CRM only. Depends on Code.gs and BookingAddon.gs.
 * The customer's address is already in the CRM; GPS is only requested by an
 * explicit press on the owner's phone. The phone's coordinates are NOT stored.
 * Google Maps Geocoder converts CRM addresses to approximate coordinates.
 */
const KS_GARDEN_CHECKIN_HEADERS=[
  "Check-in ID","Enquiry ID","Customer","Checked in at","Check-in method","Note"
];
const KS_GARDEN_PLANT_HEADERS=[
  "Plant record ID","Enquiry ID","Customer","Observed at","Common name",
  "Botanical name","Family","Match confidence","Owner notes","Check-in ID"
];

function ksGardenDataSheet_(name,headers) {
  const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sh=ss.getSheetByName(name);
  if(!sh) {
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function ksGardenFindLead_(id) {
  const lead=getLeads().find(l=>String(l.id)===String(id));
  if(!lead)throw Error("That customer is not in your CRM. Choose an existing enquiry.");
  return lead;
}
function ksGardenCustomers() {
  ksBookingOwnerOnly_();
  return getLeads().filter(x=>x.id&&x.name).slice(0,250)
    .map(x=>({leadId:String(x.id),name:String(x.name),postcode:String(x.postcode||""),
      address:String(x.address||""),status:String(x.status||"")}))
    .sort((a,b)=>a.name.localeCompare(b.name,"en-GB"));
}
function ksGardenPostcode_(value) {
  return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
}
function ksGardenOutcode_(postcode) {
  const v=ksGardenPostcode_(postcode);
  return v.length>=5?v.slice(0,-3):v;
}
function ksGardenExtractPostcode_(response) {
  for(const result of (response&&response.results)||[]) {
    for(const part of result.address_components||[]) {
      if((part.types||[]).includes("postal_code"))return ksGardenPostcode_(part.long_name);
    }
  }
  const txt=((response&&response.results)||[]).map(x=>String(x.formatted_address||"")).join(" ");
  const match=txt.toUpperCase().match(/\b(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/);
  return match?ksGardenPostcode_(match[1]):"";
}
function ksGardenDistance_(lat1,lon1,lat2,lon2) {
  const rad=Math.PI/180;
  const a=Math.sin((lat2-lat1)*rad/2)**2+
    Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
}
function ksGardenCoordsForLead_(lead,geocoder,cache) {
  const line=String(lead.address||"").trim();
  const postcode=String(lead.postcode||"").trim();
  const address=[line,postcode].filter(Boolean).join(", ");
  if(!address)return null;
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,address.toUpperCase());
  const key="ks-garden-geo-"+Utilities.base64EncodeWebSafe(digest).replace(/=/g,"").slice(0,42);
  const cached=cache.get(key);
  if(cached) {
    try{return JSON.parse(cached)}catch(e){}
  }
  try {
    const geo=geocoder.geocode(address+", United Kingdom");
    const first=(geo.results||[])[0];
    const loc=first&&first.geometry&&first.geometry.location;
    if(!loc||!Number.isFinite(Number(loc.lat))||!Number.isFinite(Number(loc.lng)))return null;
    const point={lat:Number(loc.lat),lon:Number(loc.lng),
      granularity:String(first.geometry.location_type||"APPROXIMATE")};
    // Avoid repeat lookups while working, without permanently storing geocodes.
    cache.put(key,JSON.stringify(point),21600);
    return point;
  }catch(err){Logger.log("Geocoding unavailable for a customer address");return null;}
}
/**
 * Return only plausible nearby customer matches, never a definitive check-in.
 * The raw phone GPS position is used in memory and never saved to a sheet/log.
 */
function ksSuggestGardenCustomerAtGps(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const lat=Number(input.latitude),lon=Number(input.longitude),
    accuracy=Number(input.accuracyMeters);
  if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lon)||lon < -180||lon > 180)
    throw Error("Unable to read a valid phone location.");
  if(!Number.isFinite(accuracy)||accuracy<0||accuracy>250)
    throw Error("Your location is not accurate enough yet. Try again outdoors, or select the customer manually.");
  let pc="";
  const geo=Maps.newGeocoder().setRegion("uk");
  try {
    pc=ksGardenExtractPostcode_(geo.reverseGeocode(lat,lon));
  }catch(err){Logger.log("Reverse postcode geocoding unavailable");}
  const outcode=ksGardenOutcode_(pc);
  const leads=getLeads().filter(x=>x.id&&x.name&&(x.address||x.postcode));
  const ranked=leads.map(lead=>{
    const postcode=ksGardenPostcode_(lead.postcode);
    return {lead,rank:pc&&postcode===pc?0:outcode&&ksGardenOutcode_(postcode)===outcode?1:2};
  }).sort((a,b)=>a.rank-b.rank);
  // Favour likely postcodes to reduce Maps lookups. When reverse geocoding
  // is unavailable, we check a bounded shortlist and always offer manual selection.
  const shortlist=ranked.filter(x=>x.rank<=1).slice(0,32);
  const toCheck=shortlist.length?shortlist:ranked.slice(0,32);
  const cache=CacheService.getScriptCache();
  const radius=Math.max(120,Math.min(230,accuracy+90));
  const nearby=[];
  for(const choice of toCheck) {
    const loc=ksGardenCoordsForLead_(choice.lead,geo,cache);
    if(!loc)continue;
    const distance=Math.round(ksGardenDistance_(lat,lon,loc.lat,loc.lon));
    if(distance<=radius)nearby.push({
      leadId:String(choice.lead.id),name:String(choice.lead.name),
      address:String(choice.lead.address||""),postcode:String(choice.lead.postcode||""),
      distanceMetres:distance,approximate:loc.granularity!=="ROOFTOP"
    });
  }
  nearby.sort((a,b)=>a.distanceMetres-b.distanceMetres);
  return {nearby:nearby.slice(0,8),accuracyMetres:Math.round(accuracy),
    checked:toCheck.length,hasNearby:nearby.length>0};
}
function ksConfirmGardenCustomerCheckin(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const lead=ksGardenFindLead_(input.leadId);
  const method=String(input.method||"manual");
  if(!["gps_suggested","manual"].includes(method))throw Error("Invalid check-in method.");
  const id=Utilities.getUuid(),timestamp=new Date();
  const sh=ksGardenDataSheet_("Garden Check-ins",KS_GARDEN_CHECKIN_HEADERS);
  sh.appendRow([id,String(lead.id),String(lead.name),timestamp,
    method==="gps_suggested"?"GPS suggested; owner confirmed":"Owner selected manually",
    "One-off check-in. Precise device GPS was not retained."]);
  return {ok:true,checkinId:id,leadId:String(lead.id),name:String(lead.name)};
}
function ksSaveCustomerGardenPlant(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const lead=ksGardenFindLead_(input.leadId);
  const scientific=String(input.scientificName||"").trim().slice(0,160);
  const common=String(input.commonName||"").trim().slice(0,120);
  const family=String(input.family||"").trim().slice(0,100);
  const notes=String(input.notes||"").trim().slice(0,700);
  const score=Number(input.score);
  if(!scientific||scientific.length>160||!Number.isFinite(score)||score<0||score>1)
    throw Error("Choose a valid plant identification result.");
  const checkinId=String(input.checkinId||"").trim();
  const checkins=ksGardenDataSheet_("Garden Check-ins",KS_GARDEN_CHECKIN_HEADERS);
  // Only associate observations with an owner-confirmed customer visit.
  const recent=checkins.getLastRow()>1?checkins.getRange(2,1,checkins.getLastRow()-1,4).getValues():[];
  const confirmed=recent.some(row=>String(row[0])===checkinId&&
    String(row[1])===String(lead.id)&&
    (new Date()-new Date(row[3]))<12*60*60*1000);
  if(!confirmed)throw Error("Check in with the customer first, then save this plant.");
  const id=Utilities.getUuid();
  ksGardenDataSheet_("Garden Plants",KS_GARDEN_PLANT_HEADERS).appendRow([
    id,String(lead.id),String(lead.name),new Date(),common,scientific,
    family,score,notes,checkinId
  ]);
  return {ok:true,id,customer:lead.name,scientificName:scientific};
}
function ksCustomerGardenPlants(leadId) {
  ksBookingOwnerOnly_();
  ksGardenFindLead_(leadId);
  const sh=ksGardenDataSheet_("Garden Plants",KS_GARDEN_PLANT_HEADERS);
  if(sh.getLastRow()<2)return [];
  return sh.getRange(2,1,sh.getLastRow()-1,KS_GARDEN_PLANT_HEADERS.length)
    .getValues().filter(r=>String(r[1])===String(leadId)).slice(-50).reverse()
    .map(r=>({id:String(r[0]),observedAt:r[3]?(new Date(r[3])).toISOString():"",commonName:r[4],
      scientificName:r[5],score:r[7],notes:r[8]}));
}
