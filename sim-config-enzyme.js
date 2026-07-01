/**
 * SimConfigEnzyme — proof-case config for the SimulationEngine.
 * Topic: Enzyme-Substrate Interaction (AQA GCSE Biology)
 * Schema: see simulation-engine-brief.md
 */
const SimConfigEnzyme = {
  topicId: 'enzyme-action',
  title: 'Enzyme–Substrate Complex',
  pedagogicalNotes: 'AQA GCSE Biology — enzyme catalysis, active site, lock-and-key model, denaturation.',
  palette: {
    background: '#f8fafc',
    primary:    '#6366f1',
    accent:     '#f43f5e',
    success:    '#10b981',
  },
  initialState: 'idle',
  controls: [
    { label: '▶  Release Substrate', actionState: 'moving' },
    { label: '🔥 Apply Heat',        actionState: 'denatured' },
    { label: '↺  Reset',             actionState: 'idle', isReset: true },
  ],
  actors: [
    {
      id:    'enzyme',
      type:  'complex-path',
      x:     290,
      y:     175,
      color: 'primary',
      label: 'enzyme',
    },
    {
      id:    'substrate',
      type:  'rect',
      x:     80,
      y:     55,
      vx:    2.2,
      vy:    1.6,
      color: 'accent',
      label: 'substrate',
    },
  ],
  states: {
    idle: {
      statusText: 'An enzyme waits with its active site exposed. Press "Release Substrate" to begin.',
      actorModifiers: {},
    },

    moving: {
      statusText: 'Random molecular motion — the substrate will only bind if its shape is complementary to the active site.',
      physicsLoop(actors, dt, lerp, lerpEased, W, H, transitionTo) {
        const sub = actors.find(a => a.id === 'substrate');
        const enz = actors.find(a => a.id === 'enzyme');
        if (!sub || !enz || sub._locked) return;

        // Active site opening: top of the U-shape, centred at enzyme position offset by -88px
        const tx = enz.x;
        const ty = enz.y - 88;

        const dx   = tx - sub.x;
        const dy   = ty - sub.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gradual seek force — mimics random brownian motion biased toward active site
        const seek = 0.055 * dt;
        sub.vx += (dx / dist) * seek;
        sub.vy += (dy / dist) * seek;

        // Integrate
        sub.x += sub.vx * dt;
        sub.y += sub.vy * dt;

        // Bounce off canvas walls
        const m = 22;
        if (sub.x < m)     { sub.x = m;     sub.vx =  Math.abs(sub.vx) * 0.85; }
        if (sub.x > W - m) { sub.x = W - m; sub.vx = -Math.abs(sub.vx) * 0.85; }
        if (sub.y < m)     { sub.y = m;     sub.vy =  Math.abs(sub.vy) * 0.85; }
        if (sub.y > H - m) { sub.y = H - m; sub.vy = -Math.abs(sub.vy) * 0.85; }

        // Speed cap
        const spd = Math.sqrt(sub.vx * sub.vx + sub.vy * sub.vy);
        if (spd > 3.5) { sub.vx = (sub.vx / spd) * 3.5; sub.vy = (sub.vy / spd) * 3.5; }

        // Form complex when substrate reaches active site
        if (dist < 22) {
          sub._locked = true;
          sub.x = tx;
          sub.y = ty;
          sub.vx = 0;
          sub.vy = 0;
          transitionTo('complex');
        }
      },
    },

    complex: {
      statusText: 'Enzyme–substrate complex formed! The complementary shapes bind at the active site — lowering the activation energy of the reaction.',
      holdFrames: 0, // stays until user acts
      actorModifiers: {},
    },

    denatured: {
      statusText: 'High temperature has broken hydrogen bonds in the tertiary structure. The active site is permanently deformed — the substrate can no longer bind.',
      actorModifiers: {
        enzyme: { shapeAltered: true },
      },
      physicsLoop(actors, dt) {
        const sub = actors.find(a => a.id === 'substrate');
        if (!sub || sub._gone) return;
        // Initialise escape on first call
        if (!sub._escaping) {
          sub._escaping = true;
          sub._locked   = false;
          sub.vx = 1.8;
          sub.vy = -2.8;
        }
        sub.x += sub.vx * dt;
        sub.y += sub.vy * dt;
        if (sub.y < -60 || sub.x > 700) sub._gone = true;
      },
    },
  },

  // ── Tier text overrides ──────────────────────────────────────────────────
  tiers: {
    foundation: {
      pedagogicalNotes: 'AQA GCSE Biology Foundation — enzymes as biological catalysts, active site, lock-and-key model, denaturation by high temperature.',
      statusTextOverrides: {
        idle:      'The enzyme has a special shape called the active site. Press "Release Substrate" to see what happens next.',
        moving:    'The substrate moves around and looks for the active site. Only a complementary shape can fit in!',
        complex:   'The substrate fits into the active site — this is called an enzyme–substrate complex.',
        denatured: 'Too much heat has changed the shape of the enzyme (denaturation). The substrate no longer fits.',
      },
    },
    higher: {
      pedagogicalNotes: 'AQA GCSE Biology Higher — enzymes lower activation energy via active site; induced fit; denaturation is permanent structural change above optimum temperature.',
      statusTextOverrides: {
        idle:      'The enzyme exposes its active site — a region with a specific tertiary structure. Release the substrate to observe binding.',
        moving:    'Brownian motion carries the substrate toward the active site. Complementary geometry determines whether binding occurs.',
        complex:   'Enzyme–substrate complex formed. The enzyme lowers activation energy; products are released and the enzyme is recycled unchanged.',
        denatured: 'Above optimum temperature, hydrogen bonds in the tertiary structure break. The active site is permanently denatured — substrate cannot bind.',
      },
    },
  },
};
