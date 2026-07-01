/**
 * SimulationEngine — topic-agnostic canvas simulation engine.
 * No external dependencies. Mount once, swap configs.
 * API: SimulationEngine.mount(targetEl, config, options) → { unmount, setState }
 */
const SimulationEngine = (() => {
  'use strict';

  const FONT = 'system-ui,-apple-system,"Inter","Segoe UI",sans-serif';

  // ── Math helpers (exposed so physicsLoop fns can call them) ────────────────
  function lerp(start, end, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return start + (end - start) * t;
  }
  function cubicEase(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function lerpEased(start, end, t) { return lerp(start, end, cubicEase(t)); }

  // ── DPI-aware canvas (called once per mount, never per config) ─────────────
  function makeCanvas(container) {
    const dpr = window.devicePixelRatio || 1;
    const W   = container.clientWidth  || 540;
    const H   = 300;
    const el  = document.createElement('canvas');
    el.style.cssText = `width:${W}px;height:${H}px;display:block;border-radius:10px;`;
    el.width  = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    const ctx = el.getContext('2d');
    ctx.scale(dpr, dpr);
    return { el, ctx, W, H };
  }

  // ── Tier merging (preserves physicsLoop function references) ───────────────
  function applyTier(config, tier) {
    if (!tier || !config.tiers || !config.tiers[tier]) return config;
    const td = config.tiers[tier];
    const merged = Object.assign({}, config, { states: {} });
    for (const [k, s] of Object.entries(config.states)) {
      merged.states[k] = Object.assign({}, s); // copies physicsLoop reference
    }
    for (const [k, text] of Object.entries(td.statusTextOverrides || {})) {
      if (merged.states[k]) merged.states[k].statusText = text;
    }
    if (td.pedagogicalNotes) merged.pedagogicalNotes = td.pedagogicalNotes;
    return merged;
  }

  // ── Actor factory (deep-clone primitives, reset to initial positions) ───────
  function spawnActors(config) {
    return config.actors.map(a => Object.assign({}, a));
  }

  // ── Color resolution ───────────────────────────────────────────────────────
  function col(key, palette) { return palette[key] || key; }

  // ── Safe text draw (measures, truncates if overflows) ─────────────────────
  function drawText(ctx, text, x, y, maxW, { size = 11, weight = '600', color = '#1e293b', align = 'center', baseline = 'middle' } = {}) {
    ctx.save();
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (maxW) {
      let t = String(text);
      while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
      if (t !== String(text)) t += '…';
      ctx.fillText(t, x, y);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  // ── Rounded rect helper (safe across browsers) ────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Actor drawing ──────────────────────────────────────────────────────────
  function drawActor(ctx, actor, palette, mods) {
    const c = col(actor.color, palette);
    const m = mods ? mods[actor.id] : null;
    ctx.save();
    ctx.translate(actor.x, actor.y);

    if (actor.type === 'complex-path') {
      // Enzyme: U-shape, active site opening at top
      if (m && m.shapeAltered) {
        // Denatured — irregular blob, no proper cleft
        ctx.beginPath();
        ctx.moveTo(-38, -8);
        ctx.bezierCurveTo(-52, -38, -4, -52, 18, -28);
        ctx.bezierCurveTo(46, -4, 48, 30, 22, 44);
        ctx.bezierCurveTo(-2, 58, -36, 44, -44, 20);
        ctx.bezierCurveTo(-60, -4, -24, 16, -38, -8);
        ctx.closePath();
        ctx.fillStyle = c + '28';
        ctx.fill();
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        drawText(ctx, 'denatured', 0, 2, 70, { color: c, size: 10, weight: '700' });
      } else {
        // U-shape: arms at x ± 26, active site cleft open at top
        ctx.beginPath();
        ctx.moveTo(-26, -52);
        ctx.lineTo(-26, 18);
        // Bottom arc
        ctx.arc(0, 18, 26, Math.PI, 0, false);
        ctx.lineTo(26, -52);
        ctx.strokeStyle = c;
        ctx.lineWidth = 3;
        ctx.stroke();
        // Fill interior
        ctx.lineTo(-26, -52);
        ctx.fillStyle = c + '18';
        ctx.fill();
        // Label and active-site markers
        drawText(ctx, 'enzyme', 0, 36, 60, { color: c, size: 10, weight: '700' });
        drawText(ctx, '▼ ▼', 0, -60, 60, { color: c, size: 9, weight: '700' });
        drawText(ctx, 'active site', 0, -68, 80, { color: c, size: 9, weight: '600' });
      }
    } else if (actor.type === 'rect') {
      // Substrate: rounded rectangle
      if (m && m.hidden) { ctx.restore(); return; }
      const w = 34, h = 22;
      roundRect(ctx, -w / 2, -h / 2, w, h, 5);
      ctx.fillStyle = c;
      ctx.fill();
      drawText(ctx, actor.label || actor.id, 0, 0, w - 6, { color: '#fff', size: 9, weight: '700' });
    }

    ctx.restore();
  }

  // ── UI shell ───────────────────────────────────────────────────────────────
  function buildUI(wrap, cfg, handlers, activeTier) {
    // Status box
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `margin:8px 0 4px;padding:8px 12px;border-radius:8px;background:#f1f5f9;font-size:13px;font-weight:500;line-height:1.5;font-family:${FONT};color:#1e293b;min-height:38px;`;
    wrap.appendChild(statusEl);

    // Controls row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    cfg.controls.forEach(ctrl => {
      const btn = document.createElement('button');
      btn.textContent = ctrl.label;
      btn.style.cssText = `padding:7px 14px;border-radius:8px;border:none;cursor:pointer;font-family:${FONT};font-size:13px;font-weight:600;background:${ctrl.isReset ? '#e2e8f0' : cfg.palette.primary};color:${ctrl.isReset ? '#334155' : '#fff'};transition:transform 0.1s,opacity 0.1s;`;
      btn.onmouseover = () => { btn.style.opacity = '0.85'; };
      btn.onmouseout  = () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1)'; };
      btn.onmousedown = () => { btn.style.transform = 'scale(0.95)'; };
      btn.onmouseup   = () => { btn.style.transform = 'scale(1)'; };
      btn.onclick = () => handlers.setState(ctrl.actionState);
      row.appendChild(btn);
    });

    // Tier toggle (if config has tiers)
    let tierBtns = {};
    if (cfg.tiers) {
      const sep = document.createElement('span');
      sep.style.cssText = 'margin-left:auto;display:flex;gap:4px;align-items:center;';
      const lbl = document.createElement('span');
      lbl.textContent = 'Tier:';
      lbl.style.cssText = `font-size:11px;font-weight:700;color:#64748b;font-family:${FONT};`;
      sep.appendChild(lbl);
      ['foundation', 'higher'].forEach(t => {
        const tb = document.createElement('button');
        tb.textContent = t === 'foundation' ? 'F' : 'H';
        tb.dataset.tier = t;
        const isActive = t === (activeTier || 'higher');
        tb.style.cssText = `padding:3px 9px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;font-family:${FONT};transition:all 0.1s;border:1.5px solid ${cfg.palette.primary};background:${isActive ? cfg.palette.primary : 'transparent'};color:${isActive ? '#fff' : cfg.palette.primary};`;
        tb.onclick = () => handlers.setTier(t);
        sep.appendChild(tb);
        tierBtns[t] = tb;
      });
      row.appendChild(sep);
    }

    wrap.appendChild(row);
    return { statusEl, tierBtns };
  }

  // ── Modal overlay ──────────────────────────────────────────────────────────
  function buildModal(onClose) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(15,23,42,0.72);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;box-sizing:border-box;`;
    const box = document.createElement('div');
    box.style.cssText = `background:#fff;border-radius:16px;padding:20px 20px 14px;width:min(600px,100%);position:relative;box-shadow:0 24px 64px rgba(0,0,0,0.35);box-sizing:border-box;`;
    const xBtn = document.createElement('button');
    xBtn.innerHTML = '&#x2715;';
    xBtn.style.cssText = `position:absolute;top:10px;right:12px;background:none;border:none;font-size:17px;cursor:pointer;color:#94a3b8;padding:4px 8px;border-radius:6px;line-height:1;`;
    xBtn.onclick = onClose;
    overlay.onclick = e => { if (e.target === overlay) onClose(); };
    box.appendChild(xBtn);
    overlay.appendChild(box);
    return { overlay, contentEl: box };
  }

  // ── Engine ─────────────────────────────────────────────────────────────────
  return {
    lerp,
    lerpEased,
    cubicEase,

    mount(targetEl, config, options = {}) {
      const { tier = 'higher', mode = 'inline' } = options;

      let cfg      = applyTier(config, tier);
      let actors   = spawnActors(cfg);
      let state    = cfg.initialState;
      let holdCtr  = 0;
      let rafId    = null;
      let lastTs   = null;
      let statusEl = null;
      let tierBtns = {};
      let overlay  = null;
      let wrap     = null;

      // Build container
      if (mode === 'modal') {
        const shell = buildModal(() => instance.unmount());
        overlay = shell.overlay;
        wrap = shell.contentEl;
        document.body.appendChild(overlay);
      } else {
        wrap = document.createElement('div');
        wrap.style.cssText = 'width:100%;';
        targetEl.appendChild(wrap);
      }

      // Title bar
      const titleEl = document.createElement('div');
      titleEl.style.cssText = `font-size:14px;font-weight:600;font-family:${FONT};color:#1e293b;margin-bottom:8px;`;
      titleEl.textContent = cfg.title;
      wrap.appendChild(titleEl);

      // Canvas (DPI-scaled once here, never per config)
      const { el: canvas, ctx, W, H } = makeCanvas(wrap);
      wrap.appendChild(canvas);

      // Status updater
      function refreshStatus() {
        if (!statusEl) return;
        statusEl.textContent = (cfg.states[state] || {}).statusText || '';
      }

      // State transition
      function go(newState) {
        if (!cfg.states[newState]) return;
        if (newState === config.initialState) {
          actors = spawnActors(cfg); // reset actor positions
        }
        state   = newState;
        holdCtr = 0;
        refreshStatus();
      }

      // Tier switcher
      function switchTier(newTier) {
        cfg    = applyTier(config, newTier);
        actors = spawnActors(cfg);
        state  = cfg.initialState;
        holdCtr = 0;
        // Update tier button styles
        for (const [t, btn] of Object.entries(tierBtns)) {
          const active = t === newTier;
          btn.style.background = active ? cfg.palette.primary : 'transparent';
          btn.style.color      = active ? '#fff' : cfg.palette.primary;
        }
        refreshStatus();
      }

      // Build UI
      const ui = buildUI(wrap, cfg, { setState: go, setTier: switchTier }, tier);
      statusEl  = ui.statusEl;
      tierBtns  = ui.tierBtns;
      refreshStatus();

      // Game loop
      function loop(ts) {
        if (!lastTs) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 16.667, 3); // normalised ≈ 60fps units
        lastTs = ts;

        const stObj = cfg.states[state];

        // Physics
        if (stObj && stObj.physicsLoop) {
          stObj.physicsLoop(actors, dt, lerp, lerpEased, W, H, go);
        }

        // Auto hold-frames → nextState
        if (stObj && stObj.holdFrames && stObj.nextState) {
          holdCtr++;
          if (holdCtr >= stObj.holdFrames) { holdCtr = 0; go(stObj.nextState); }
        }

        // Draw
        ctx.fillStyle = cfg.palette.background;
        ctx.fillRect(0, 0, W, H);
        actors.forEach(a => drawActor(ctx, a, cfg.palette, stObj ? stObj.actorModifiers : null));

        rafId = requestAnimationFrame(loop);
      }

      rafId = requestAnimationFrame(loop);

      const instance = {
        unmount() {
          if (rafId)  { cancelAnimationFrame(rafId); rafId = null; }
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (wrap    && wrap.parentNode)    wrap.parentNode.removeChild(wrap);
          overlay = null; wrap = null; statusEl = null;
        },
        setState: go,
      };

      return instance;
    }
  };
})();
