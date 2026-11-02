/* Wayland Edition gate (issue #615).
 *
 * The Wayland edition is experimental and we do not properly support it, so it
 * is hidden behind a closed dropdown. The download link only appears once the
 * visitor has ticked the acknowledgement checkbox - it cannot be reached
 * otherwise. Nothing is stored: a fresh page load starts closed and unticked.
 */
(function(){
"use strict";
var toggle=document.getElementById('wayland-toggle');
var panel=document.getElementById('wayland-panel');
var ack=document.getElementById('wayland-ack');
var link=document.getElementById('wayland-download');
var hint=document.getElementById('wayland-hint');
if(!toggle||!panel||!ack||!link) return;

var LOCKED='Tick the box to unlock the download.';
var UNLOCKED='Download unlocked - this ISO is experimental.';

function setOpen(open){
  panel.hidden=!open;
  toggle.setAttribute('aria-expanded',open?'true':'false');
  if(!open){
    /* closing gives the gate back: untick and hide the download again */
    ack.checked=false;
    link.hidden=true;
    link.setAttribute('aria-disabled','true');
    if(hint) hint.textContent=LOCKED;
  }
}
function setUnlocked(unlocked){
  link.hidden=!unlocked;
  link.setAttribute('aria-disabled',unlocked?'false':'true');
  if(hint) hint.textContent=unlocked?UNLOCKED:LOCKED;
}

toggle.addEventListener('click',function(){
  setOpen(panel.hidden);
});
ack.addEventListener('change',function(){
  setUnlocked(ack.checked);
});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  if(panel.hidden) return;
  setOpen(false);
  toggle.focus();
});

/* start locked */
setUnlocked(false);
setOpen(false);
})();
