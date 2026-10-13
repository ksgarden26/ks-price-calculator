/**
 * KS Garden Services — private customer communication preferences.
 * New enquiries default to Minimal: no routine customer messages.
 * A day-of-arrival countdown is a separate optional preference.
 * Personal calendar alerts and owner reminders are never disabled here.
 *
 * Install ONLY in the private owner-only Apps Script CRM project.
 * Requires BookingAddon.gs for ksBookingOwnerOnly_, and Code.gs for saveLead().
 */
const KS_PREFS_COLUMNS = [
  "Enquiry ID","Communication Level","Daytime ETA Tracking",
  "Post-visit Reports","Preferred Contact","Updated At"
];
function ksPrefsSheet_() {
  const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sheet=ss.getSheetByName("Customer Preferences");
  if(!sheet){
    sheet=ss.insertSheet("Customer Preferences");
    sheet.getRange(1,1,1,KS_PREFS_COLUMNS.length).setValues([KS_PREFS_COLUMNS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function ksDefaultPreferences_(leadId) {
  return {leadId:String(leadId||""),communicationLevel:"minimal",daytimeTracking:false,
    postVisitReports:false,preferredContact:"phone"};
}
function ksPrefsByLead_() {
  const sheet=ksPrefsSheet_(),end=sheet.getLastRow(),result={};
  if(end<2)return result;
  for(const row of sheet.getRange(2,1,end-1,KS_PREFS_COLUMNS.length).getValues()){
    if(!row[0])continue;
    const id=String(row[0]);
    result[id]={
      ...ksDefaultPreferences_(id),
      communicationLevel:["minimal","standard","full"].includes(String(row[1]))?String(row[1]):"minimal",
      daytimeTracking:row[2]===true||row[2]==="Yes",
      postVisitReports:row[3]===true||row[3]==="Yes",
      preferredContact:["phone","sms","email","letter","inperson"].includes(String(row[4]))?String(row[4]):"phone"
    };
  }
  return result;
}
function getKsCustomerPreferences(leadId) {
  ksBookingOwnerOnly_();
  const id=String(leadId||"").trim();
  if(!id)return ksDefaultPreferences_(id);
  return ksPrefsByLead_()[id]||ksDefaultPreferences_(id);
}
function ksSavePreferences_(leadId,input) {
  const id=String(leadId||"").trim();
  if(!id)throw Error("Save this enquiry before setting preferences.");
  input=input||{};
  const level=String(input.communicationLevel||"minimal");
  const contact=String(input.preferredContact||"phone");
  if(!["minimal","standard","full"].includes(level))throw Error("Unknown communication preference.");
  if(!["phone","sms","email","letter","inperson"].includes(contact))throw Error("Unknown contact method.");
  // Absence of a checkbox means OFF; customers must opt in.
  const day= input.daytimeTracking===true;
  const reports= input.postVisitReports===true;
  const sheet=ksPrefsSheet_(),n=sheet.getLastRow();
  let line=n+1;
  if(n>1){
    const ids=sheet.getRange(2,1,n-1,1).getValues().flat().map(String);
    const pos=ids.indexOf(id);
    if(pos>=0)line=pos+2;
  }
  sheet.getRange(line,1,1,KS_PREFS_COLUMNS.length)
    .setValues([[id,level,day,reports,contact,new Date()]]);
  return {leadId:id,communicationLevel:level,daytimeTracking:day,
    postVisitReports:reports,preferredContact:contact};
}
function saveKsCustomerPreferences(leadId,input) {
  ksBookingOwnerOnly_();
  const id=String(leadId||"").trim();
  if(!getLeads().some(lead=>String(lead.id)===id))throw Error("CRM customer not found.");
  return ksSavePreferences_(id,input);
}
/** Update an existing CRM lead and its preferences in one owner action. */
function saveKsLeadWithPreferences(lead,preferences) {
  ksBookingOwnerOnly_();
  const saved=saveLead(lead);
  const id=String(saved.id||lead.id||"");
  const stored=ksSavePreferences_(id,preferences);
  return {ok:true,id,preferences:stored};
}
