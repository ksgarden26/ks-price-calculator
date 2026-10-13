/**
 * KS Garden Services — private owner-only Plant ID.
 * Add ONLY to the private CRM Apps Script project.
 * Store the Pl@ntNet API key in Script Properties as KS_PLANTNET_API_KEY.
 * Never add to the public customer referral/intake project.
 *
 * Photo identification is advisory. Do not rely on it for edible/poisonous
 * plant decisions or species-sensitive pruning without checking.
 */
function identifyKsPlant(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const apiKey=PropertiesService.getScriptProperties().getProperty("KS_PLANTNET_API_KEY");
  if(!apiKey)throw new Error("Plant ID is not connected yet. Set KS_PLANTNET_API_KEY in the private CRM Script Properties.");
  const organ=String(input.organ||"auto").trim();
  if(!["auto","leaf","flower","fruit","bark"].includes(organ))
    throw new Error("Choose an available plant feature.");
  const source=String(input.photoBase64||"");
  if(source.length<400||source.length>5.5*1024*1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(source))
    throw new Error("Please choose a JPEG photo under 4 MB.");
  let bytes;
  try{bytes=Utilities.base64Decode(source)}
  catch(e){throw new Error("The photo could not be read. Try taking another photograph.");}
  if(bytes.length<250||bytes.length>4*1024*1024)
    throw new Error("Photo too large. Please use a photo under 4 MB.");
  // JPEG signature; the mobile client converts source images to JPEG using canvas,
  // so EXIF location data is removed rather than sent to the service.
  if((bytes[0]&255)!==255||(bytes[1]&255)!==216||(bytes[2]&255)!==255)
    throw new Error("Please use a JPEG photo or let the app convert the picture.");
  const blob=Utilities.newBlob(bytes,"image/jpeg","ks-garden-plant.jpg");
  const endpoint="https://my-api.plantnet.org/v2/identify/all"+
    "?lang=en&nb-results=5&api-key="+encodeURIComponent(apiKey);
  const response=UrlFetchApp.fetch(endpoint,{
    method:"post",
    payload:{images:blob,organs:organ},
    headers:{Accept:"application/json"},
    muteHttpExceptions:true
  });
  const status=response.getResponseCode();
  if(status===401||status===403)throw new Error("Plant ID authorisation failed. Check the Pl@ntNet API key and account.");
  if(status===429)throw new Error("Today's Plant ID allowance has been reached. Please try again later.");
  if(status===404||status===422)throw new Error("That plant wasn't recognised. Try a closer, brighter photograph of a leaf or flower.");
  if(status<200||status>=300)throw new Error("Plant ID is temporarily unavailable (service status "+status+").");
  let data;
  try{data=JSON.parse(response.getContentText())}
  catch(e){throw new Error("The identification service returned an unreadable result.");}
  const options=(Array.isArray(data.results)?data.results:[]).slice(0,5).map(item=>{
    const species=item.species||{}, family=species.family||{};
    const names=Array.isArray(species.commonNames)?species.commonNames:[];
    return {
      scientificName:String(species.scientificNameWithoutAuthor||species.scientificName||"").slice(0,160),
      commonName:String(names[0]||"").slice(0,120),
      family:String(family.scientificNameWithoutAuthor||family.scientificName||"").slice(0,100),
      score:Math.max(0,Math.min(1,Number(item.score)||0))
    };
  }).filter(item=>item.scientificName);
  return {results:options,remainingRequests:Number.isFinite(Number(data.remainingIdentificationRequests))?
    Number(data.remainingIdentificationRequests):null};
}
