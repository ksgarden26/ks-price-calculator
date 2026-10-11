/**
 * KS Garden Services – PRIVATE CRM enquiry removal.
 *
 * Intentionally owner-only: never add to the public enquiries Apps Script.
 * One explicit deletion removes the same enquiry ID from Quotes, Customer Details,
 * preferences and its optional garden records. Existing bookings or keys prevent
 * deletion so calendar appointments and physical keys cannot be orphaned.
 * Google Sheets version history / the user's spreadsheet backup support recovery.
 */
function ksDeleteEnquiryRecord(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const id=String(input.id||"").trim();
  const expectedName=String(input.name||"").trim();
  if(!/^[\w-]{10,100}$/.test(id)||!expectedName) {
    throw new Error("Missing enquiry reference or customer name. Refresh the CRM and retry.");
  }

  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error("Another CRM update is running. Please try again.");
  try{
    const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
    const quotes=ss.getSheetByName("Quotes");
    if(!quotes||quotes.getLastRow()<2)throw new Error("Enquiry could not be found.");
    if(String(quotes.getRange(1,22).getValue())!=="Enquiry ID")
      throw new Error("Quotes sheet format has changed. Nothing was deleted.");

    const rowIds=quotes.getRange(2,22,quotes.getLastRow()-1,1).getValues();
    const matchIndexes=[];
    rowIds.forEach((row,i)=>{if(String(row[0]).trim()===id)matchIndexes.push(i+2)});
    if(matchIndexes.length!==1)throw new Error(
      matchIndexes.length?"Duplicate enquiry references found. Nothing was deleted.":"Enquiry no longer exists; refresh the CRM.");

    const rowNumber=matchIndexes[0];
    const name=String(quotes.getRange(rowNumber,2).getValue()).trim();
    const status=String(quotes.getRange(rowNumber,9).getValue()).trim();
    if(name!==expectedName)throw new Error("Customer details changed. Refresh and review before deleting.");
    if(status==="Won")throw new Error("This is won work. Cancel/close it properly rather than deleting the customer.");

    // Prevent a CRM delete leaving calendar events or customer-held keys orphaned.
    const safeguards=[
      {name:"Bookings",column:2,header:"Enquiry ID",error:"An appointment exists for this enquiry. Cancel the booking before deleting it."},
      {name:"Customer Keys",column:3,header:"CRM Enquiry ID",error:"A customer key is registered. Return/reconcile the key before deleting the enquiry."}
    ];
    for(const rule of safeguards){
      const sh=ss.getSheetByName(rule.name);
      if(!sh||sh.getLastRow()<2)continue;
      if(String(sh.getRange(1,rule.column).getValue())!==rule.header)
        throw new Error(rule.name+" sheet format changed. Nothing was deleted.");
      const rows=sh.getRange(2,rule.column,sh.getLastRow()-1,1).getValues();
      if(rows.some(r=>String(r[0]).trim()===id))throw new Error(rule.error);
    }

    const related=[
      {name:"Customer Details",column:1,header:"Enquiry ID"},
      {name:"Customer Preferences",column:1,header:"Enquiry ID"},
      {name:"Garden Check-ins",column:2,header:"Enquiry ID"},
      {name:"Garden Plants",column:2,header:"Enquiry ID"},
      {name:"Measurements",column:4,header:"Enquiry ID"}
    ];
    // Check all linked sheet structures before deleting any data.
    const removal=[];
    for(const rule of related){
      const sh=ss.getSheetByName(rule.name);
      if(!sh||sh.getLastRow()<2)continue;
      if(String(sh.getRange(1,rule.column).getValue()).trim()!==rule.header)
        throw new Error(rule.name+" sheet format changed. Nothing was deleted.");
      const matches=[];
      sh.getRange(2,rule.column,sh.getLastRow()-1,1).getValues()
        .forEach((r,i)=>{if(String(r[0]).trim()===id)matches.push(i+2)});
      if(matches.length)removal.push({sh,rows:matches});
    }
    // Deleting from bottom to top preserves each row index.
    for(const item of removal){
      item.rows.sort((a,b)=>b-a).forEach(row=>item.sh.deleteRow(row));
    }
    quotes.deleteRow(rowNumber);
    return {ok:true,id,customer:name,relatedRowsRemoved:removal.reduce((n,item)=>n+item.rows.length,0)};
  }finally{
    lock.releaseLock();
  }
}
