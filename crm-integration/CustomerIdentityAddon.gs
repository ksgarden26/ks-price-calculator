/** Private CRM repair: preserve existing references, fill missing customer IDs. */
function ksRepairCustomerIds() {
  ksBookingOwnerOnly_();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Customer records are busy. Please try again.');
  try {
    const sh = sheet_();
    // Code.gs maps IDs from column V. Refuse an incompatible sheet layout.
    if (String(sh.getRange(1, 22).getValue()).trim() !== 'Enquiry ID' ||
        String(sh.getRange(1, 2).getValue()).trim() !== 'Customer') {
      throw new Error('Customer ID repair stopped: Quotes column B must be Customer and column V must be Enquiry ID. No customer data was changed.');
    }
    const last = sh.getLastRow();
    if (last < 2) return {ok: true, assigned: 0, converted: 0};
    const rows = sh.getRange(2, 1, last - 1, 22).getValues();
    const seen = new Map(), changes = [];
    let assigned = 0, converted = 0;
    // Validate all existing IDs before making any change. Never guess which
    // customer owns a duplicate ID; linked bookings/keys must remain intact.
    rows.forEach((row, index) => {
      if (!String(row[1] || '').trim()) return;
      const raw = row[21];
      if (raw === '' || raw === null || raw === undefined) return;
      if (!['string', 'number'].includes(typeof raw)) {
        throw new Error('Invalid customer ID on Quotes row ' + (index + 2) + '. No customer data was changed.');
      }
      const id = String(raw);
      if (!id.trim() || id !== id.trim() || ['undefined', 'null'].includes(id)) {
        throw new Error('Invalid customer ID on Quotes row ' + (index + 2) + '. No customer data was changed.');
      }
      if (seen.has(id)) {
        throw new Error('Duplicate Enquiry ID on Quotes rows ' + seen.get(id) + ' and ' + (index + 2) + '. Repair stopped to protect linked records.');
      }
      seen.set(id, index + 2);
    });
    rows.forEach((row, index) => {
      if (!String(row[1] || '').trim()) return;
      const raw = row[21];
      if (raw === '' || raw === null || raw === undefined) {
        let id;
        do { id = Utilities.getUuid(); } while (seen.has(id));
        seen.set(id, index + 2);
        changes.push({row: index + 2, id});
        assigned++;
      } else if (typeof raw === 'number') {
        changes.push({row: index + 2, id: String(raw)});
        converted++;
      }
    });
    changes.forEach(change => {
      sh.getRange(change.row, 22).setNumberFormat('@').setValue(change.id);
    });
    if (changes.length) SpreadsheetApp.flush();
    return {ok: true, assigned, converted};
  } finally {
    lock.releaseLock();
  }
}

function getKsLeadsForAdmin() {
  ksRepairCustomerIds();
  return getLeads().map(lead => Object.assign({}, lead, {id: String(lead.id)}));
}
