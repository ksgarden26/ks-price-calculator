/**
 * KS Garden Services — Intake -> Quotes sync
 * Install into the SAME Apps Script project as Code.gs and CustomerIntakeAddon.gs.
 * Existing Quotes rows are NEVER overwritten or deleted.
 * Default: dry run. Explicit ksSyncCustomerIntake() is required to save.
 * Identifies customers conservatively using phone + postcode OR email + postcode.
 * Ambiguous matches are flagged for manual review.
 */
const KS_SYNC_COLS = ['CRM Enquiry ID','CRM Sync Status','CRM Sync Time'];
function ksSyncNormal_(v){return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g,'');}
function ksSyncContact_(v){return String(v == null ? '' : v).trim().toLowerCase();}
function ksSyncHeaders_(sh){
 const start=KS_CUSTOMER_INTAKE_HEADERS.length+1;
 const actual=sh.getRange(1,start,1,KS_SYNC_COLS.length).getValues()[0];
 const any=actual.some(x=>String(x).trim());
 if(any && actual.some((v,i)=>v!==KS_SYNC_COLS[i]))throw Error('Unexpected columns after Customer Intake. Stop and inspect.');
 if(!any)sh.getRange(1,start,1,KS_SYNC_COLS.length).setValues([KS_SYNC_COLS]);
 return start;
}
function ksSyncAssess_(values, quotes) {
 const full=String(values[5]||'').trim();
 const phone=ksSyncNormal_(values[7]), email=ksSyncContact_(values[8]);
 const postcode=ksSyncNormal_(values[12]), address=String(values[10]||'').trim();
 if(!full||!postcode||(!phone&&!email))return {status:'REVIEW: incomplete identity'};
 const matches=quotes.filter(q=>{
   if(ksSyncNormal_(q.postcode)!==postcode)return false;
   return (phone && ksSyncNormal_(q.phone)===phone) ||
          (email && ksSyncContact_(q.email)===email);
 });
 if(matches.length>1)return {status:'REVIEW: multiple CRM matches'};
 if(matches.length===1){
   // Do not overwrite current CRM contact details, quotes, schedules or statuses.
   return {status:'LINKED: existing CRM record',id:matches[0].id};
 }
 return {status:'CREATE: new CRM record',lead:{
   name:full,phone:String(values[7]||''),email:String(values[8]||''),
   postcode:String(values[12]||''),address:address,
   service:String(values[16]||'New customer registration'),
   source:'New Customer Details',status:'New Enquiry',
   waste:String(values[18]||''),
   notes:'Customer Intake linked. See Customer Intake tab for billing, pet and access details.'
 }};
}
function ksCustomerIntakeSync_(dryRun) {
 const lock=LockService.getScriptLock();lock.waitLock(25000);
 try {
  const sh=ksCustomerIntakeSheet_();
  const start=KS_CUSTOMER_INTAKE_HEADERS.length+1;
  const last=sh.getLastRow();if(last<2)return {dryRun,created:0,linked:0,review:0,skipped:0,details:[]};
  const rows=sh.getRange(2,1,last-1,KS_CUSTOMER_INTAKE_HEADERS.length+3).getValues();
  const quotes=getLeads().slice();
  const result={dryRun,created:0,linked:0,review:0,skipped:0,details:[]};
  if(!dryRun)ksSyncHeaders_(sh);
  const usedIds=new Set(quotes.map(x=>String(x.id)));
  for(let i=0;i<rows.length;i++){
   const row=rows[i],rowNumber=i+2;
   if(!row[5])continue;
   if(String(row[start-1]||'').trim()) {result.skipped++;continue;}
   // Exclude the earlier synthetic test record.
   if(String(row[5]).trim().toLowerCase()==='mr test example') {result.skipped++;continue;}
   const decision=ksSyncAssess_(row,quotes);
   if(decision.status.startsWith('REVIEW')){
     result.review++;result.details.push({row:rowNumber,name:row[5],status:decision.status});
     if(!dryRun)sh.getRange(rowNumber,start+1).setValue(decision.status);
     continue;
   }
   if(decision.id){
     result.linked++;result.details.push({row:rowNumber,name:row[5],status:decision.status});
     if(!dryRun){
      sh.getRange(rowNumber,start,1,3).setValues([[decision.id,decision.status,new Date()]]);
     }
   } else {
     result.created++;result.details.push({row:rowNumber,name:row[5],status:decision.status});
     if(!dryRun){
      // A new enquiry is created only; existing rows are never touched.
      const id=Utilities.getUuid();
      decision.lead.id=id;
      saveLead(decision.lead);
      sh.getRange(rowNumber,start,1,3).setValues([[id,'CREATED: new CRM enquiry',new Date()]]);
      quotes.push(Object.assign({},decision.lead,{id:id}));
      usedIds.add(id);
     } else {
      quotes.push(Object.assign({},decision.lead,{id:'dry-run-'+rowNumber}));
     }
   }
  }
  return result;
 } finally {lock.releaseLock();}
}
function ksPreviewCustomerIntakeSync(){
 const summary=ksCustomerIntakeSync_(true);
 Logger.log(JSON.stringify(summary));
 return summary;
}
function ksSyncCustomerIntake(){
 const summary=ksCustomerIntakeSync_(false);
 Logger.log(JSON.stringify(summary));
 return summary;
}
