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
