/**
 * KS Garden Services — private Google Maps satellite-area integration.
 * Install in your PRIVATE CRM Apps Script project only.
 *
 * Project Settings > Script properties:
 *   KS_GOOGLE_MAPS_API_KEY = your restricted Google Maps JavaScript API key
 *
 * A browser-side Google Maps JavaScript key is necessarily visible to the browser
 * while loading Google's map. Restrict it to Maps JavaScript API and authorised
 * HTTPS referrers in Google Cloud, and set quotas/billing alerts to limit costs.
 * Never commit the key to GitHub or put it in Index.html/Code.gs.
 */
function ksAreaGoogleMapsConfiguration() {
  ksBookingOwnerOnly_();
  const key=String(PropertiesService.getScriptProperties()
    .getProperty("KS_GOOGLE_MAPS_API_KEY") || "").trim();
  return key ? {available:true, key:key} : {available:false};
}
