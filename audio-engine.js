
// === SFX Sync v2: one-shot per move, frame-accurate, mobile-safe ===
(function(){
  const AC = window.AudioContext || window.webkitAudioContext;
  const els = {
    move:  document.getElementById('s-move'),
    cap:   document.getElementById('s-cap'),
    win:   document.getElementById('s-win'),
    lose:  document.getElementById('s-lose'),
    desist:document.getElementById('s-desist'),
    open:  document.getElementById('openSound'),
    close: document.getElementById('closeSound')
  };
  let ctx=null, buffers={}, unlocked=false;
  let muted = (localStorage.getItem('muted')==='1');
  let lastToken = null; // avoid double-fire

  function unlockOnce(){
    if (unlocked) return;
    unlocked = true;
    if (AC){
      try{
        ctx = ctx || new AC();
        const b = ctx.createBuffer(1,1,22050);
        const s = ctx.createBufferSource(); s.buffer=b; s.connect(ctx.destination); s.start(0);
      }catch(_){}
    } else {
      try{ Object.values(els).forEach(a=>{ if(!a) return; a.volume=0; a.currentTime=0; a.play().then(()=>a.pause()).catch(()=>{}); }); }catch(_){}
    }
  }
  window.addEventListener('pointerdown', unlockOnce, { once:true });

  async function preload(){
    if (!AC) return;
    ctx = ctx || new AC();
    const keys = Object.keys(els);
    await Promise.all(keys.map(async k=>{
      const el = els[k]; if (!el || !el.src) return;
      try{
        const res = await fetch(el.src, { mode:'cors' });
        const buf = await res.arrayBuffer();
        buffers[k] = await new Promise((resolve,reject)=>{
          const p = ctx.decodeAudioData(buf, resolve, reject); if (p && p.then) p.then(resolve).catch(reject);
        });
      }catch(_){}
    }));
  }
  preload();

  function _playTag(key){
    const el = els[key]; if (!el) return;
    try{ el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(()=>{}); }catch(_){}
  }
  function _playWebAudio(key){
    if (!buffers[key] || !ctx) return false;
    try{
      if (ctx.state==='suspended') ctx.resume();
      const src = ctx.createBufferSource(); src.buffer = buffers[key];
      const g = ctx.createGain(); g.gain.value = 0.95;
      src.connect(g).connect(ctx.destination); src.start(0);
      return true;
    }catch(_){ return false; }
  }
  function play(key, token){
    if (muted) return;
    if (token && token===lastToken) return; // gate double-trigger
    lastToken = token || null;
    if (!_playWebAudio(key)) _playTag(key);
    // clear token on next frame to allow later plays
    requestAnimationFrame(()=>{ lastToken=null; });
  }
  function playSync(key){
    // align to next frame boundary for animation sync
    let t=null;
    function go(ts){ if (t===null) t=ts; play(key, 'f-'+(Math.floor(ts)||0)); }
    requestAnimationFrame(go);
  }
  function setMuted(v){
    muted = !!v;
    try{ localStorage.setItem('muted', muted?'1':'0'); }catch(_){}
    Object.values(els).forEach(a=>{ if (a) a.muted = muted; });
    if (!muted && ctx && ctx.state==='suspended') try{ ctx.resume(); }catch(_){}
  }

  window.SFX = { play, playSync, setMuted, get muted(){ return muted; } };

  // Patch global play sites if old code still calls audio tags directly
  const map = { sMove:'move', sCap:'cap', sWin:'win', sLose:'lose', sDesist:'desist', openSound:'open', closeSound:'close' };
  for (const id in map){
    const el = document.getElementById(id);
    if (!el) continue;
    el.play = (function(orig, key){ return function(){ play(key); return Promise.resolve(); }; })(el.play, map[id]);
  }
})();
