/**
 * KS Garden Services — PRIVATE, owner-only garden access + key register.
 * Add this file only to the private CRM Apps Script project, NEVER to the
 * publicly accessible customer intake project.
 *
 * Links by Quotes column V ("Enquiry ID") to the existing "Customer Keys"
 * register column C. Does not overwrite existing manually entered key rows.
 *
 * SECURITY: Optional combinations/codes in Customer Keys column O are stored
 * as spreadsheet data, NOT end-to-end encrypted. Only use on an owner-restricted
 * spreadsheet, enable 2-step verification, limit sharing, and never send codes
 * to Xero, emails, messages or the public form without a security review.
 * The regular read endpoint never returns the code to the browser.
 */
const KS_ACCESS_FIELDS_=[
  "Entry Instructions","Pets / Restrictions","Access Code (restricted)"
];
function ksCustomerAccessText_(value,maxLength){
  const val=String(value == null ? "" : value).trim().replace(/[\u0000-\u001F\u007F]/g," ");
  if(val.length>maxLength)throw Error("An access detail is too long (max "+maxLength+" characters).");
  // Prevent sheet formula injection when the cell is written.
  return /^[=+@\-]/.test(val)?"'"+val:val;
}
function ksCustomerAccessSheet_(){
  const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sh=ss.getSheetByName("Customer Keys");
  if(!sh)throw Error("Customer Keys sheet is missing; nothing was saved.");
  const expected=[
    "Key Reference","Customer Name","CRM Enquiry ID","Key / Access Type",
    "Quantity","Date Received","Storage Location","Key Status",
    "Date Returned","Return Method","Last Checked","Notes / Incident Record"
  ];
  const found=sh.getRange(1,1,1,expected.length).getValues()[0];
  for(let i=0;i<expected.length;i++){
    if(String(found[i]||"").trim()!==expected[i])
      throw Error("Customer Keys sheet headers changed. Nothing was saved.");
  }
  // Add only new trailing columns; preserve all original columns and records.
  KS_ACCESS_FIELDS_.forEach((name,i)=>{
    const col=13+i;
    const existing=String(sh.getRange(1,col).getValue()||"").trim();
    if(existing&&existing!==name)
      throw Error("Customer Keys column "+col+" is already in use. Nothing was saved.");
    if(!existing)sh.getRange(1,col).setValue(name);
  });
  return sh;
}
function ksCustomerAccessLead_(leadId){
  const id=String(leadId||"").trim();
  if(!/^[\w-]{10,100}$/.test(id))throw Error("Open a saved CRM customer first.");
  const ss=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const quotes=ss.getSheetByName("Quotes");
  if(!quotes||quotes.getLastRow()<2)throw Error("Customer not found in CRM.");
  if(String(quotes.getRange(1,22).getValue())!=="Enquiry ID")
    throw Error("Quotes header mismatch.");
  const values=quotes.getRange(2,1,quotes.getLastRow()-1,22).getValues();
  const matches=values.filter(row=>String(row[21]).trim()===id);
  if(matches.length!==1)throw Error("Customer could not be uniquely matched by CRM enquiry ID.");
  return {id,name:String(matches[0][1]||"").trim()};
}
function ksCustomerAccessRecord_(sh,leadId){
  const id=String(leadId);
  const ref="KS-ACCESS-"+id;
  const bottom=sh.getLastRow();
  if(bottom<2)return {row:0};
  const entries=sh.getRange(2,1,bottom-1,3).getValues();
  let line=0;
  entries.forEach((v,i)=>{
    if(String(v[0])===ref&&String(v[2])===id){
      if(line)throw Error("Duplicate access references found. Please reconcile Customer Keys first.");
      line=i+2;
    }
  });
  return {row:line,reference:ref};
}
function ksGetCustomerAccess(leadId){
  ksBookingOwnerOnly_();
  const lead=ksCustomerAccessLead_(leadId);
  const sh=ksCustomerAccessSheet_();
  const found=ksCustomerAccessRecord_(sh,lead.id);
  if(!found.row)return {linked:false,leadId:lead.id,customer:lead.name,hasCode:false};
  const v=sh.getRange(found.row,1,1,15).getValues()[0];
  return {
    linked:true,leadId:lead.id,customer:lead.name,reference:String(v[0]||""),
    type:String(v[3]||""),quantity:Number(v[4]||0),
    storage:String(v[6]||""),status:String(v[7]||""),
    notes:String(v[12]||""),pets:String(v[13]||""),
    hasCode:!!String(v[14]||"")
  };
}
function ksSaveCustomerAccess(payload){
  ksBookingOwnerOnly_();
  payload=payload||{};
  const lead=ksCustomerAccessLead_(payload.leadId);
  const choices=["Customer home","Side/rear gate","Key held","Key safe","Coded gate","Other"];
  const type=String(payload.type||"").trim();
  if(!choices.includes(type))throw Error("Choose a valid access arrangement.");
  const quantity=Number(payload.quantity||0);
  if(!Number.isInteger(quantity)||quantity<0||quantity>20)
    throw Error("Enter a valid key quantity (0 to 20).");
  if(type!=="Key held"&&quantity!==0)
    throw Error("Key quantity applies only when a physical key is held.");
  const storage=ksCustomerAccessText_(payload.storage||"",150);
  const notes=ksCustomerAccessText_(payload.notes||"",500);
  const pets=ksCustomerAccessText_(payload.pets||"",350);
  const code=String(payload.code||"").trim();
  if(code.length>90||/[\r\n\u0000-\u001F]/.test(code))
    throw Error("Access code must contain no newlines and be under 90 characters.");
  if(code&&payload.clearCode===true)throw Error("Cannot save and clear a code together.");
  const status=type==="Key held" ? (quantity?"Held":"Awaiting key") : "Access instructions";
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw Error("Another CRM update is running; try again.");
  try{
    const sh=ksCustomerAccessSheet_();
    const found=ksCustomerAccessRecord_(sh,lead.id);
    const existing=found.row?sh.getRange(found.row,1,1,15).getValues()[0]:Array(15).fill("");
    const now=new Date();
    const reference="KS-ACCESS-"+lead.id;
    const priorCode=String(existing[14]||"");
    const newCode=payload.clearCode===true?"":(code?ksCustomerAccessText_(code,90):priorCode);
    const data=[
      reference,lead.name,lead.id,type,type==="Key held"?quantity:0,
      type==="Key held"&&quantity&&!existing[5]?now:existing[5]||"",
      storage,status,existing[8]||"",existing[9]||"",now,
      "Garden access details kept private. Do not copy access codes into general notes.",
      notes,pets,newCode
    ];
    const row=found.row||sh.getLastRow()+1;
    sh.getRange(row,1,1,data.length).setValues([data]);
    return {ok:true,leadId:lead.id,reference,hasCode:!!newCode};
  }finally{lock.releaseLock();}
}

/**
 * Explicit reveal, separate from normal customer/profile reads.
 * Only invoke when the private owner presses Reveal access code.
 */
function ksRevealCustomerAccessCode(leadId) {
  ksBookingOwnerOnly_();
  const lead=ksCustomerAccessLead_(leadId);
  const sh=ksCustomerAccessSheet_();
  const found=ksCustomerAccessRecord_(sh,lead.id);
  if(!found.row)return {ok:true,code:""};
  return {ok:true,code:String(sh.getRange(found.row,15).getValue()||"")};
}
