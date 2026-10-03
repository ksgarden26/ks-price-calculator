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
const form=document.getElementById("contactForm");if(form){form.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(form),status=document.getElementById("formStatus");const payload={name:fd.get("name"),phone:fd.get("phone"),email:fd.get("email"),postcode:fd.get("postcode"),service:fd.get("service")||"General enquiry",details:fd.get("message"),status:"New Enquiry",source:"Website Contact"};if(!payload.name||!payload.phone||!payload.postcode||!payload.details){alert("Please complete your name, phone number, postcode and enquiry.");return}try{await fetch("https://script.google.com/macros/s/AKfycbwW8E1QVRoCPLFqN2S7zUKpFKoFJWqUneAJuwFyd-0nzwcAK4NFJm94W85aHrUGelOdiw/exec",{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify(payload)});form.reset();status&&status.classList.add("show")}catch(err){window.location.href="mailto:info@ksgardenservices.co.uk?subject="+encodeURIComponent("Website enquiry")}})}
})();