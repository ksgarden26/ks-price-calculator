/**
 * Owner-only KS Garden Services daily diary and manual customer call-backs.
 * Install in the same PRIVATE Apps Script project as BookingAddon.gs and Code.gs.
 * Run setupKsDailyBookingBrief() once as the signed-in owner to enable.
 * No customer messages are sent by this file.
 */
function setupKsDailyBookingBrief() {
  ksBookingOwnerOnly_();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction()==="ksSendDailyBookingBriefTrigger_")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("ksSendDailyBookingBriefTrigger_")
    .timeBased().atHour(7).everyDays(1).inTimezone("Europe/London").create();
  return "Owner's morning diary and customer call-back brief enabled for around 7am.";
}
function ksBriefDay_(offset) {
  const bits=Utilities.formatDate(new Date(),"Europe/London","yyyy-MM-dd").split("-").map(Number);
  const date=new Date(bits[0],bits[1]-1,bits[2]+offset);
  const next=new Date(bits[0],bits[1]-1,bits[2]+offset+1);
  return {date,next,label:Utilities.formatDate(date,"Europe/London","EEE d MMM")};
}
/** Used by the private owner-authorised time trigger, not a website/public endpoint. */
function ksSendDailyBookingBriefTrigger_() {
  const calendar=CalendarApp.getCalendarById(KS_BOOKING_CALENDAR_ID);
  if(!calendar)throw Error("KS Google Calendar cannot be accessed.");
  const today=ksBriefDay_(0),tomorrow=ksBriefDay_(1);
  const bookings=ksBookingSheet_().getDataRange().getValues().slice(1)
    .filter(r=>String(r[11])==="Confirmed");
  const byEvent={};
  for(const row of bookings)if(row[10])byEvent[String(row[10])]=row;
  const leads=getLeads(), byLead={};
  for(const lead of leads)byLead[String(lead.id)]=lead;
  const clean=v=>String(v==null?"":v).replace(/[\r\n]+/g," ").trim();
  const time=v=>Utilities.formatDate(v,"Europe/London","HH:mm");
  const getEvents=day=>calendar.getEvents(day.date,day.next)
    .filter(e=>e.getTitle().startsWith("KS | "))
    .sort((a,b)=>a.getStartTime()-b.getStartTime());
  const todayEvents=getEvents(today), tomorrowEvents=getEvents(tomorrow);
  function eventLine(event){
    const row=byEvent[String(event.getId())];
    const lead=row?byLead[String(row[1])]:null;
    const address=clean(event.getLocation() || (row?row[9]:""));
    return "  • "+time(event.getStartTime())+" "+clean(event.getTitle())+
      (address?" | "+address:"")+(lead&&lead.phone?" | "+clean(lead.phone):"");
  }
  const calls=[];
  for(const event of tomorrowEvents){
    const row=byEvent[String(event.getId())];
    if(!row)continue;
    const contact=String(row[15]||"phone");
    if(contact==="email")continue;
    const action=contact==="sms"?"TEXT":contact==="letter"?"PREPARE CARD":
      contact==="inperson"?"CONFIRM IN PERSON":"PHONE";
    const lead=byLead[String(row[1])];
    calls.push("  • "+action+" "+clean(row[2])+" | "+
      (lead&&lead.phone?clean(lead.phone):"no telephone number")+
      " | "+tomorrow.label+" "+time(event.getStartTime()));
  }
  // CRM quote/enquiry follow-ups also appear in the same morning checklist.
  const cutoff=Utilities.formatDate(tomorrow.next,"Europe/London","yyyyMMdd");
  const due=leads.filter(lead=>{
    if(["Won","Lost"].includes(String(lead.status||"")))return false;
    const value=clean(lead.follow).slice(0,10).replace(/-/g,"");
    return /^\d{8}$/.test(value)&&value<cutoff;
  }).slice(0,40);
  if(!todayEvents.length&&!tomorrowEvents.length&&!due.length)
    return {ok:true,sent:false,reason:"No appointments or follow-ups due."};
  const lines=[
    "KS GARDEN SERVICES — OWNER'S MORNING DIARY",
    "",
    "TODAY — "+today.label+" ("+todayEvents.length+")",
    ...(todayEvents.length?todayEvents.map(eventLine):["  No KS appointments"]),
    "",
    "TOMORROW — "+tomorrow.label+" ("+tomorrowEvents.length+")",
    ...(tomorrowEvents.length?tomorrowEvents.map(eventLine):["  No KS appointments"]),
    "",
    "MANUAL CUSTOMER CONTACT FOR TOMORROW",
    ...(calls.length?calls:["  Nothing requiring a phone call, text or appointment card"]),
    "",
    "QUOTE / ENQUIRY FOLLOW-UPS DUE",
    ...(due.length?due.map(x=>"  • "+clean(x.name)+" | "+clean(x.phone)+
       " | "+clean(x.service)+" | due "+clean(x.follow).slice(0,10)):["  No follow-ups due"]),
    "",
    "Google Calendar also alerts you 24 hours and 1 hour before each booking.",
    "This is only an internal checklist. It does not contact customers."
  ];
  const ownerMail=PropertiesService.getScriptProperties().getProperty("KS_DIGEST_EMAIL")||KS_BOOKING_CALENDAR_ID;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerMail))throw Error("Invalid KS_DIGEST_EMAIL recipient.");
  MailApp.sendEmail({
    to:ownerMail,
    subject:"KS diary: "+todayEvents.length+" today, "+tomorrowEvents.length+" tomorrow, "+calls.length+" customer contacts",
    body:lines.join("\n")
  });
  return {ok:true,sent:true,today:todayEvents.length,tomorrow:tomorrowEvents.length,
    manualContacts:calls.length,followups:due.length};
}
