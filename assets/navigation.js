(() => {
 const root = document.querySelector('.user-website');
 const menu = document.querySelector('.nav2-menu');
 const opener = document.querySelector('.nav2-burger');
 const resize = () => { if (!root) return; root.classList.toggle('is-desktop', innerWidth >= 1180); root.classList.toggle('is-mobile', innerWidth < 1180); root.classList.remove('is-tablet'); };
 resize(); addEventListener('resize', resize);
 const toggle = (open) => { menu?.classList.toggle('menu-active',open); opener?.setAttribute('aria-expanded',String(open)); if(open) menu?.querySelector('a')?.focus(); else opener?.focus(); };
 document.querySelectorAll('.nav2-burger,.nav2-closer,.nav2-caret').forEach(button => {
 const activate = () => { if(button.matches('.nav2-caret')) { const parent=button.closest('.has-dropdown'); const open=parent.classList.toggle('dropdown-open');button.setAttribute('aria-expanded',String(open)); } else toggle(button.matches('.nav2-burger')); };
 button.addEventListener('click',activate);button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
 });
 addEventListener('keydown',event=>{if(event.key==='Escape')toggle(false);});
})();


/* Homepage 2027 enquiry popup */
(() => {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/') return;

  const popup = document.createElement('div');
  popup.className = 'ks-intake-popup';
  popup.setAttribute('aria-hidden','true');
  popup.innerHTML = `
    <section class="ks-intake-card" role="dialog" aria-modal="true" aria-labelledby="ks-intake-title">
      <button class="ks-intake-close" type="button" aria-label="Close">×</button>
      <p class="ks-intake-kicker">2027 bookings</p>
      <h2 id="ks-intake-title">Looking for a regular gardener in 2027?</h2>
      <p>KS Garden Services is taking enquiries for regular garden maintenance in Newton-le-Willows and selected surrounding areas.</p>
      <div class="ks-intake-actions">
        <a class="ks-intake-primary" href="/prices/">Yes — get an estimated price</a>
        <button class="ks-intake-secondary" type="button">Not right now</button>
      </div>
    </section>
  `;

  document.body.appendChild(popup);

  const close = () => {
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden','true');
  };

  popup.querySelector('.ks-intake-close')?.addEventListener('click',close);
  popup.querySelector('.ks-intake-secondary')?.addEventListener('click',close);
  popup.addEventListener('click',e => { if (e.target === popup) close(); });
  document.addEventListener('keydown',e => { if (e.key === 'Escape') close(); });

  setTimeout(() => {
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden','false');
  }, 2200);
})();
