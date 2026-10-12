/**
 * KS Garden Services — Customer Intake (DRAFT)
 * Add to the Google Apps Script project that owns the public intake endpoint.
 * Do not publish until the public HTML/endpoint connection has been tested.
 *
 * Does NOT collect or store gate/key-safe codes.
 * Uses separate tab so existing Quotes headers/rows stay unchanged.
 * Public submit handlers must call ksSaveCustomerIntake_(payload) only after
 * verifying the expected form fields and consent.
 */
const KS_CUSTOMER_INTAKE_SHEET = 'Customer Intake';
const KS_CUSTOMER_INTAKE_HEADERS = [
 'Received At','Customer ID','Title','First Name','Surname','Full Name','Xero Invoice Name',
 'Phone','Email','Contact Preference','Address','Town','Postcode',
 'Invoice Delivery','Payment Method','Billing Notes','Services','Frequency',
 'Green Waste','Garden Notes','Access Method','Code Required',
 'Spare Key Requested','Lock Gate','Pets','Hazards','Access Notes',
 'Animal Waste Acknowledged','Privacy Accepted','Source'
];
function ksIntakeClean_(value, max) {
 return value == null ? '' : String(value).trim().slice(0,max || 500);
}
function ksSheetSafe_(v) {
 // Protect Google Sheets from interpreting untrusted customer text as formulas.
 const text=String(v == null ? '' : v);
 return /^[\\s]*[=+@-]/.test(text) ? "'"+text : text;
}
function ksIntakeRecord_(p) {
 p = p || {};
 const first=ksIntakeClean_(p.firstName,100);
 const last=ksIntakeClean_(p.surname,100);
 const title=ksIntakeClean_(p.title,30);
 const allowedTitles=['Mr','Mrs','Miss','Ms','Mx','Dr','Prof','Other'];
 if(!allowedTitles.includes(title)) throw new Error('Please select a title.');
 if(!first || !last) throw new Error('First name and surname are required.');
 const phone=ksIntakeClean_(p.phone,70);
 const postcode=ksIntakeClean_(p.postcode,30).toUpperCase();
 const address=ksIntakeClean_(p.address,300);
 if(!phone || !postcode || !address) throw new Error('Phone and garden address are required.');
 if(p.privacyAccepted !== true || p.animalWasteAcknowledged !== true)
   throw new Error('Required customer acknowledgements are missing.');
 if(Object.prototype.hasOwnProperty.call(p,'accessCode') ||
    Object.prototype.hasOwnProperty.call(p,'gateCode') ||
    Object.prototype.hasOwnProperty.call(p,'keySafeCode'))
   throw new Error('Security codes must be arranged privately, not sent with this form.');
 const full=[title,first,last].join(' ');
 const xero=[title,first.charAt(0).toUpperCase(),last].join(' ');
 return {
  id: Utilities.getUuid(), received:new Date(), title:title, first:first, last:last,
  full:full,xero:xero,phone:phone,email:ksIntakeClean_(p.email,200),
  contact:ksIntakeClean_(p.contactPreference,50),
  address:address,town:ksIntakeClean_(p.town,100),postcode:postcode,
  delivery:ksIntakeClean_(p.invoiceDelivery,80),
  payment:ksIntakeClean_(p.paymentMethod,80),
  billing:ksIntakeClean_(p.billingNotes,1000),
  services:ksIntakeClean_(p.services,1000),
  frequency:ksIntakeClean_(p.frequency,80),
  waste:ksIntakeClean_(p.waste,100),
  garden:ksIntakeClean_(p.gardenNotes,1000),
  access:ksIntakeClean_(p.accessMethod,150),
  codeRequired:ksIntakeClean_(p.codeRequired,30),
  spare:ksIntakeClean_(p.spareKey,100),
  lock:ksIntakeClean_(p.lockGate,50),
  pets:ksIntakeClean_(p.pets,80),
  hazards:ksIntakeClean_(p.hazards,1000),
  accessNotes:ksIntakeClean_(p.accessNotes,1000),
  source:'New Customer Details'
 };
}
function ksCustomerIntakeSheet_() {
 // Uses CFG.SPREADSHEET_ID from the existing CRM project.
 const book=SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
 let sheet=book.getSheetByName(KS_CUSTOMER_INTAKE_SHEET);
 if(!sheet) {
  sheet=book.insertSheet(KS_CUSTOMER_INTAKE_SHEET);
  sheet.getRange(1,1,1,KS_CUSTOMER_INTAKE_HEADERS.length)
       .setValues([KS_CUSTOMER_INTAKE_HEADERS]);
  sheet.setFrozenRows(1);
 }
 const headers=sheet.getRange(1,1,1,KS_CUSTOMER_INTAKE_HEADERS.length).getValues()[0];
 if(headers.some((h,i)=>h!==KS_CUSTOMER_INTAKE_HEADERS[i]))
   throw new Error('Customer Intake columns do not match the expected layout.');
 return sheet;
}
function ksSaveCustomerIntake_(raw) {
 const p=ksIntakeRecord_(raw);
 const lock=LockService.getScriptLock();
 lock.waitLock(25000);
 try {
  ksCustomerIntakeSheet_().appendRow([
   p.received,p.id,p.title,p.first,p.last,p.full,p.xero,
   p.phone,p.email,p.contact,p.address,p.town,p.postcode,
   p.delivery,p.payment,p.billing,p.services,p.frequency,
   p.waste,p.garden,p.access,p.codeRequired,
   p.spare,p.lock,p.pets,p.hazards,p.accessNotes,
   'Yes','Yes',p.source
  ].map((cell)=>cell instanceof Date ? cell : ksSheetSafe_(cell)));
 } finally {lock.releaseLock();}
 // Never include any access codes or security secrets in notification emails.
 MailApp.sendEmail({
  to:CFG.NOTIFY_EMAIL,
  subject:'NEW CUSTOMER DETAILS — '+p.full,
  body:'KS Garden Services — new customer details\n\n'+
       'Customer: '+p.full+'\nPhone: '+p.phone+'\nEmail: '+p.email+
       '\nPostcode: '+p.postcode+
       '\nAccess arrangement: '+p.access+
       '\nCode needed: '+p.codeRequired+
       '\nPets: '+p.pets+
       '\n\nFull details are in the Customer Intake tab. No entry/access code is collected.'
 });
 return {ok:true,id:p.id};
}
/**
 * Smoke-test validation only — does not append rows or send emails.
 * Run this in the Apps Script editor before connecting public submissions.
 */
function ksTestCustomerIntakeValidation() {
 const sample={
  title:'Mr',firstName:'Test',surname:'Example',
  phone:'07000000000',address:'1 Sample Road',postcode:'WA12 0AA',
  accessMethod:'Side or rear gate',codeRequired:'No',
  privacyAccepted:true,animalWasteAcknowledged:true
 };
 const record=ksIntakeRecord_(sample);
 if(record.full !== 'Mr Test Example' || record.xero !== 'Mr T Example')
   throw new Error('Name formatting failed');
 return {ok:true,fullName:record.full,xeroInvoiceName:record.xero};
}
