/**
 * KS Garden Services — PRIVATE CRM booking ↔ Google Calendar add-on.
 * Add this as BookingAddon.gs to the PRIVATE owner-only Google Apps Script project.
 * Do NOT add it to the separate public website intake script.
 * Owner must set script property KS_OWNER_EMAIL to their signed-in Google account email.
 * Project timezone must be Europe/London.
 */
const KS_BOOKING_CALENDAR_ID = "info@ksgardenservices.co.uk";
const KS_BOOKING_COLUMNS = [
  "Booking ID","Enquiry ID","Customer","Service","Start Date","Start Time",
  "End Time","Repeat","Visit Count","Address","Calendar iCalUID",
  "Status","Invite Customer","Created At","Booking Type"
];

function ksBookingOwnerOnly_() {
  const expected = PropertiesService.getScriptProperties().getProperty("KS_OWNER_EMAIL");
  const active = Session.getActiveUser().getEmail();
  if (!expected || !active || active.toLowerCase() !== expected.toLowerCase()) {
    throw new Error("Private owner authorisation is required. Check KS_OWNER_EMAIL and your private CRM deployment.");
  }
}
function ksBookingSheet_() {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  let sh = ss.getSheetByName("Bookings");
  if (!sh) {
    sh = ss.insertSheet("Bookings");
    sh.getRange(1,1,1,KS_BOOKING_COLUMNS.length).setValues([KS_BOOKING_COLUMNS]);
    sh.setFrozenRows(1);
  }
  // Existing test sheets may have been created before Booking Type was added.
  if (String(sh.getRange(1,15).getValue()) !== "Booking Type") sh.getRange(1,15).setValue("Booking Type");
  return sh;
}
function ksBookingRow_(data) {
  return [data.bookingId,data.leadId,data.name,data.service,data.date,data.start,
    data.end,data.frequency,data.count,data.address,data.eventId,data.status,
    data.invited ? "Yes" : "No",new Date(),data.kind];
}
function ksBookingDate_(date,time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time)))
    throw new Error("Enter a valid date and HH:mm time.");
  const y=Number(date.slice(0,4)),m=Number(date.slice(5,7)),d=Number(date.slice(8,10));
  const hh=Number(time.slice(0,2)),mm=Number(time.slice(3,5));
  const out=new Date(y,m-1,d,hh,mm);
  if(out.getFullYear()!==y || out.getMonth()!==m-1 || out.getDate()!==d ||
     out.getHours()!==hh || out.getMinutes()!==mm) throw new Error("Invalid local date or time.");
  return out;
}
function ksBookingSeriesRecurrence_(frequency,count) {
  const rec=CalendarApp.newRecurrence().setTimeZone("Europe/London");
  if(frequency==="monthly")return rec.addMonthlyRule().times(count);
  return rec.addWeeklyRule().interval(Number(frequency)).times(count);
}
/**
 * Idempotent confirmation: a given bookingId can never create more than one event.
 * No sending happens without inviteCustomer === true and a valid email on the CRM lead.
 * Never expose this function through a public/anonymous Apps Script deployment.
 */
function confirmGardenBooking(input) {
  ksBookingOwnerOnly_();
  input=input||{};
  const bookingId=String(input.bookingId||"").trim();
  const leadId=String(input.leadId||"").trim();
  const kind=String(input.kind||"job");
  if(!["quote","job"].includes(kind))throw new Error("Unknown booking type.");
  if(!/^[A-Za-z0-9_-]{12,100}$/.test(bookingId) || !leadId)throw new Error("Missing booking reference or CRM enquiry.");
  const freq=String(input.frequency||"once");
  if(!["once","1","2","3","4","monthly"].includes(freq))throw new Error("Invalid visit frequency.");
  if(kind==="quote" && freq!=="once")throw new Error("Quotation visits must be one-off appointments.");
  const count=freq==="once"?1:Number(input.count);
  if(!Number.isInteger(count)||count<1||count>52||(freq!=="once"&&count<2))throw new Error("Visit count must be between 2 and 52 for maintenance.");

  const start=ksBookingDate_(String(input.date||""),String(input.start||""));
  const end=ksBookingDate_(String(input.date||""),String(input.end||""));
  if(end<=start || end-start > 9*60*60*1000)throw new Error("Visit end time must be after the start time (maximum nine hours).");
  if(start<new Date(Date.now()-60*60*1000))throw new Error("Cannot confirm a past visit.");

  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))throw new Error("Booking system is busy; retry.");
  try {
    const sh=ksBookingSheet_(), n=sh.getLastRow();
    if(n>1){
      const prior=sh.getRange(2,1,n-1,KS_BOOKING_COLUMNS.length).getValues();
      const existing=prior.find(r=>String(r[0])===bookingId);
      if(existing){
        if(String(existing[11])==="Confirmed")
          return {ok:true,alreadyConfirmed:true,eventId:String(existing[10]||""),bookingId};
        throw new Error("This booking needs review before retrying; no duplicate calendar entry was created.");
      }
      const sameVisit=prior.find(r=>String(r[1])===leadId && String(r[4])===String(input.date) &&
        String(r[7])===freq && String(r[11])==="Confirmed" && (String(r[14]||"job")===kind));
      if(sameVisit)return {ok:true,alreadyConfirmed:true,eventId:String(sameVisit[10]||""),bookingId:String(sameVisit[0])};
      if(kind==="job"&&freq!=="once"&&prior.some(r=>String(r[1])===leadId && String(r[7])!=="once" &&
        String(r[14]||"job")==="job" && String(r[11])==="Confirmed"))
        throw new Error("This customer already has a recurring maintenance series. Reschedule the existing series rather than creating another.");
    }
    const leads=getLeads();
    const lead=leads.find(l=>String(l.id)===leadId);
    if(!lead)throw new Error("CRM customer record not found.");
    if(!lead.name)throw new Error("CRM customer has no name.");
    const invite=input.inviteCustomer===true;
    const email=String(lead.email||"").trim();
    if(invite && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Customer invitation requested but there is no valid email saved in the CRM.");
    const calendar=CalendarApp.getCalendarById(KS_BOOKING_CALENDAR_ID);
    if(!calendar)throw new Error("Business Google Calendar is not accessible to this Apps Script account.");
    const service=String(lead.service||"Garden maintenance").slice(0,100);
    const title=kind==="quote" ? "KS | Quote visit — "+lead.name+" — "+service
      : "KS | "+lead.name+" — "+service;
    const description=(kind==="quote"?"KS Garden Services quotation / garden assessment"
      :"KS Garden Services confirmed work visit")+"\nCRM enquiry: "+leadId+
      "\nService: "+service+"\nBusiness phone: 07715 559 170"+
      "\nWeather or other schedule changes will be communicated separately.";
    const options={description,location:String(lead.address||lead.postcode||"").slice(0,230)};
    if(invite){options.guests=email;options.sendInvites=true;}

    // Reserve booking ID BEFORE Calendar write. Prevents accidental duplicate creation if response fails.
    const rowNum=sh.getLastRow()+1;
    sh.getRange(rowNum,1,1,KS_BOOKING_COLUMNS.length).setValues([
      ksBookingRow_({bookingId,leadId,name:lead.name,service,date:input.date,
        start:input.start,end:input.end,frequency:freq,count,address:options.location,
        eventId:"",status:"Creating",invited:invite,kind})
    ]);
    let event;
    try {
      event=freq==="once"
        ? calendar.createEvent(title,start,end,options)
        : calendar.createEventSeries(title,start,end,ksBookingSeriesRecurrence_(freq,count),options);
      event.addPopupReminder(24*60); // Owner's Google Calendar reminder; customer reminders follow their settings.
      sh.getRange(rowNum,11,1,2).setValues([[event.getId(),"Confirmed"]]);
    } catch(err) {
      sh.getRange(rowNum,12).setValue("Needs review");
      throw new Error("Calendar confirmation needs review. Check the calendar before retrying: "+String(err.message||err));
    }
    // The status update is secondary; the Booking row remains the source of truth.
    let crmStatusUpdated=false;
    // A quotation appointment is only a viewing; it must NEVER count as won work.
    const nextStatus=kind==="job"?"Won":
      (["New Enquiry","Contacted"].includes(lead.status)?"Site Visit / Photos Needed":lead.status);
    if(nextStatus!==lead.status){
      try{saveLead(Object.assign({},lead,{status:nextStatus}));crmStatusUpdated=true;}
      catch(e){Logger.log("CRM status update failed: "+e);}
    }
    return {ok:true,alreadyConfirmed:false,bookingId,eventId:event.getId(),
      kind,frequency:freq,count,customerInvited:invite,crmStatusUpdated};
  } finally {
    lock.releaseLock();
  }
}

function getGardenBookings(leadId) {
  ksBookingOwnerOnly_();
  const rows=ksBookingSheet_().getDataRange().getValues().slice(1);
  return rows.filter(r=>!leadId||String(r[1])===String(leadId))
    .map(r=>({bookingId:r[0],leadId:r[1],customer:r[2],service:r[3],
      date:r[4],start:r[5],end:r[6],frequency:r[7],count:r[8],
      eventId:r[10],status:r[11],invited:r[12],kind:r[14]||"job"}));
}
