(() => {
"use strict";
const form=document.getElementById("appointmentForm");
const $=name=>form.elements.namedItem(name);
const el=id=>document.getElementById(id);
const status=(message,error=false)=>{const e=el("appointmentStatus");e.textContent=message;e.style.color=error?"#a03232":"#23663d";};
const pad=n=>String(n).padStart(2,"0");
const isISODate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"));
const dateTime=(date,time)=>date.replace(/-/g,"")+"T"+time.replace(":","")+"00";
const esc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
const fold=line=>{let parts=[],current="",bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>73){parts.push(current);current=" ";bytes=1;}current+=c;bytes+=n;}parts.push(current);return parts.join("\r\n");};
const timezone=[
"BEGIN:VTIMEZONE","TZID:Europe/London","X-LIC-LOCATION:Europe/London",
"BEGIN:DAYLIGHT","TZOFFSETFROM:+0000","TZOFFSETTO:+0100","TZNAME:BST","DTSTART:19700329T010000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU","END:DAYLIGHT",
"BEGIN:STANDARD","TZOFFSETFROM:+0100","TZOFFSETTO:+0000","TZNAME:GMT","DTSTART:19701025T020000","RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU","END:STANDARD","END:VTIMEZONE"];
const windowTimes={morning:["08:00","12:00","morning (8am–12pm)"],afternoon:["12:00","17:00","afternoon (12pm–5pm)"],day:["08:00","17:00","daytime (8am–5pm)"]};
let lastKey="", lastUid="";
function frequencyDescription(v){return {once:"one-off",1:"weekly",2:"fortnightly",3:"every three weeks",4:"every four weeks",monthly:"monthly"}[v]||"one-off";}
function rule(a){if(a.frequency==="once")return "";if(a.frequency==="monthly")return "FREQ=MONTHLY;COUNT="+a.count;return "FREQ=WEEKLY;INTERVAL="+a.frequency+";COUNT="+a.count;}
function read(){
if(!form.reportValidity())throw Error("Please complete the visit date and required fields.");
const date=$("date").value;
if(!isISODate(date))throw Error("Enter a valid visit date.");
let windowName=$("window").value;
let [start,end,description]=windowTimes[windowName]||[$("start").value,$("end").value,"agreed time"];
if(!/^\d{2}:\d{2}$/.test(start)||!/^\\d{2}:\\d{2}$/.test(end)||start>=end)throw Error("The finishing time must be after the start time.");
let frequency=$("frequency").value;
let count=frequency==="once"?1:Number($("count").value);
if(!Number.isInteger(count)||count<1||count>52||(frequency!=="once"&&count<2))throw Error("Choose between 2 and 52 regular visits.");
return {customer:$("customer").value.trim(),service:$("service").value, date,start,end, description,frequency,count,address:$("address").value.trim()};
}
function uid(a){
const key=JSON.stringify(a);if(key!==lastKey){lastKey=key;lastUid=crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);}
return lastUid+"@ksgardenservices.co.uk";
}
function content(a){
const dtstamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
const description=a.service+".\nVisit window: "+a.description+".\nThis is a planned appointment. Weather or changes may require a separate confirmation or revised date.\nContact: info@ksgardenservices.co.uk | 07715 559 170\nhttps://ksgardenservices.co.uk";
const lines=[
"BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//KS Garden Services//Appointment Calendar//EN","CALSCALE:GREGORIAN",
...timezone,"BEGIN:VEVENT","UID:"+uid(a),"DTSTAMP:"+dtstamp,
"DTSTART;TZID=Europe/London:"+dateTime(a.date,a.start),
"DTEND;TZID=Europe/London:"+dateTime(a.date,a.end),
"SUMMARY:"+esc("KS Garden Services — "+a.service),
"DESCRIPTION:"+esc(description),
"CLASS:PRIVATE","TRANSP:OPAQUE",
...(a.address?["LOCATION:"+esc(a.address)]:[]),
...(rule(a)?["RRULE:"+rule(a)]:[]),
"BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:"+esc("KS Garden Services garden visit tomorrow"),"END:VALARM",
"END:VEVENT","END:VCALENDAR"];
return lines.map(fold).join("\r\n")+"\r\n";
}
function file(a){return new File([content(a)],"KS-Garden-Services-"+a.date+(a.frequency==="once"?"":"-regular")+".ics",{type:"text/calendar;charset=utf-8"});}
function download(f){const link=document.createElement("a");const url=URL.createObjectURL(f);link.href=url;link.download=f.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function readableDate(s){return new Intl.DateTimeFormat("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/London"}).format(new Date(s+"T12:00:00Z"));}
function message(a){
const regular=a.frequency!=="once";
return "Hi"+(a.customer?" "+a.customer:"")+",\n\nJust confirming your "+a.service.toLowerCase()+" "+(regular?"appointments":"appointment")+" with KS Garden Services.\n\nFirst visit: "+readableDate(a.date)+"\nExpected visit window: "+a.description+".\n"+(regular?"Repeats "+frequencyDescription(a.frequency)+" for "+a.count+" planned visits.\n":"")+(a.address?"Location: "+a.address+"\n":"")+"\nYou can add this to your calendar using the calendar invitation I'll send over. Please note visits may move due to weather or unforeseen circumstances, and I'll always let you know of any changes.\n\nThanks,\nKarl\nKS Garden Services";
}
function update(){
const regular=$("frequency").value!=="once";
el("countLabel").classList.toggle("hidden",!regular);
el("startLabel").classList.toggle("hidden",$("window").value!=="exact");
el("endLabel").classList.toggle("hidden",$("window").value!=="exact");
el("repeatNote").textContent=regular?"Regular maintenance: your customer can import one calendar file containing "+$("count").value+" "+frequencyDescription($("frequency").value)+" appointments. Only include visits you expect to honour.":"One-off: the customer will see a single booking in their calendar.";
try{const a=readSilent();if(a)el("appointmentSummary").textContent=readableDate(a.date)+" · "+a.description+" · "+frequencyDescription(a.frequency)+(regular?" ("+a.count+" visits)":"");else el("appointmentSummary").textContent="Choose a date to prepare the calendar appointment.";}catch{el("appointmentSummary").textContent="Check the date and times above.";}
parentResize();
}
function readSilent(){if(!$("date").value)return null;return read();}
function parentResize(){if(window.parent===window)return;window.parent.postMessage({type:"ks-appointment-height",height:document.documentElement.scrollHeight},location.origin);}
form.addEventListener("input",update);form.addEventListener("change",update);
el("downloadInvite").addEventListener("click",()=>{try{const a=read();download(file(a));status("Calendar invite downloaded. Send the file to your customer or import it into a calendar.");}catch(e){status(e.message,true)}});
el("shareInvite").addEventListener("click",async()=>{try{const a=read(),f=file(a);if(navigator.canShare?.({files:[f]})&&navigator.share){await navigator.share({files:[f],title:"KS Garden Services appointment",text:"Your KS Garden Services calendar invitation."});status("Share sheet opened. Confirm the correct recipient before sending.");}else{download(f);status("Your device does not support direct file sharing here. The .ics file has been downloaded for you to attach.");}}catch(e){if(e.name!=="AbortError")status(e.message,true)}});
el("googleInvite").addEventListener("click",()=>{try{const a=read();const p=new URLSearchParams({action:"TEMPLATE",text:"KS Garden Services — "+a.service,dates:dateTime(a.date,a.start)+"/"+dateTime(a.date,a.end),ctz:"Europe/London",details:a.service+". Visit window: "+a.description+". Subject to weather and confirmation. Contact info@ksgardenservices.co.uk",location:a.address});if(rule(a))p.set("recur","RRULE:"+rule(a));window.open("https://calendar.google.com/calendar/render?"+p.toString(),"_blank","noopener");status("Google Calendar opened. Check and save the event there.");}catch(e){status(e.message,true)}});
el("copyConfirmation").addEventListener("click",async()=>{try{const a=read(),txt=message(a);if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(txt);else{const t=document.createElement("textarea");t.value=txt;t.style.position="fixed";t.style.left="-9999px";document.body.append(t);t.select();if(!document.execCommand("copy"))throw Error("Your browser could not copy the message.");t.remove();}status("Customer confirmation copied. Attach the .ics file separately when you send it.");}catch(e){status(e.message,true)}});
el("resetAppointment").addEventListener("click",()=>{form.reset();lastKey="";lastUid="";status("Ready for the next customer.");update();});
$("frequency").addEventListener("change",()=>{$("service").value=$("frequency").value==="once"?"Garden tidy-up":"Regular garden maintenance";});
if(window.ResizeObserver){new ResizeObserver(parentResize).observe(document.body);}
update();
})();