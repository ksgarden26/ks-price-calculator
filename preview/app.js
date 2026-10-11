(function(){
const KEY="ks_cookie_preferences";
const banner=document.getElementById("ks-cookie"), modal=document.getElementById("ks-cookie-modal");
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){return null}}
function save(p){localStorage.setItem(KEY,JSON.stringify(p));banner&&banner.classList.remove("show");modal&&modal.classList.remove("show");window.dispatchEvent(new CustomEvent("ksconsentchange",{detail:p}))}
function openPrefs(){modal&&modal.classList.add("show")}
if(banner&&!read()) banner.classList.add("show");
document.querySelectorAll("[data-cookie-action='accept']").forEach(b=>b.onclick=()=>save({essential:true,analytics:true,marketing:true}));
document.querySelectorAll("[data-cookie-action='reject']").forEach(b=>b.onclick=()=>save({essential:true,analytics:false,marketing:false}));
document.querySelectorAll("[data-cookie-action='manage']").forEach(b=>b.onclick=openPrefs);
document.querySelectorAll("[data-cookie-settings]").forEach(b=>b.onclick=openPrefs);
document.querySelectorAll("[data-cookie-action='close']").forEach(b=>b.onclick=()=>modal&&modal.classList.remove("show"));
document.querySelectorAll("[data-cookie-action='save']").forEach(b=>b.onclick=()=>save({essential:true,analytics:!!document.getElementById("prefAnalytics")?.checked,marketing:!!document.getElementById("prefMarketing")?.checked}));
const p=read(); if(p){const a=document.getElementById("prefAnalytics"),m=document.getElementById("prefMarketing");if(a)a.checked=!!p.analytics;if(m)m.checked=!!p.marketing}
const mb=document.getElementById("menuBtn"),nav=document.getElementById("mainNav");if(mb&&nav)mb.onclick=()=>{const o=nav.classList.toggle("open");mb.setAttribute("aria-expanded",String(o))}
// Online enquiry form submissions are temporarily disabled while the public CRM endpoint is secured.
})();