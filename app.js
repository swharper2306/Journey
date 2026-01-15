/* =========================================================
   Journey’s Sparkle Studio ✨
   app.js — Dress Up + Glam + Bricks + Stickers + Missions
   (No external libraries, GitHub Pages friendly)
   ========================================================= */

(() => {
  "use strict";

  /* ----------------- Helpers ----------------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  };

  /* ----------------- Sound + TTS ----------------- */
  let soundOn = store.get("journey_soundOn", true);
  let ttsOn = store.get("journey_ttsOn", true);
  let ttsVoice = null;

  function initVoices() {
    const voices = speechSynthesis.getVoices?.() || [];
    // Prefer a feminine-ish English voice if available
    ttsVoice =
      voices.find(v => /en/i.test(v.lang) && /female|woman|samantha|victoria|karen|zira/i.test(v.name)) ||
      voices.find(v => /en/i.test(v.lang)) ||
      null;
  }
  if ("speechSynthesis" in window) {
    initVoices();
    window.speechSynthesis.onvoiceschanged = initVoices;
  }

  function beep(type = "tap") {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);

      const now = ctx.currentTime;
      o.type = "sine";
      const base = (type === "win") ? 660 : (type === "bad") ? 220 : 440;
      o.frequency.setValueAtTime(base, now);
      o.frequency.exponentialRampToValueAtTime(base * 1.15, now + 0.08);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      o.start(now);
      o.stop(now + 0.14);
      setTimeout(() => ctx.close?.(), 250);
    } catch {}
  }

  function speak(text) {
    if (!ttsOn || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.15;
      if (ttsVoice) u.voice = ttsVoice;
      speechSynthesis.speak(u);
    } catch {}
  }

  /* ----------------- Global score/badges ----------------- */
  const STATE = store.get("journey_state", {
    stars: 0,
    badges: {},
    missions: {},
    dress: { hair: "pony", outfit: "party", shoes: "sneakers", acc: { crown:false, glasses:false, wand:false, bag:false } },
    glam: { tool: "lips", lips: null, blush: null, shadow: null, liner: null, freckles: null, sparkles: null },
    bricks: { mode: "place", color: "#ff4fd8", grid: Array(12*12).fill(null), goal: "Tower", tallest: 0 },
    stickers: { placed: [], bg: "look1" }
  });

  function saveState() { store.set("journey_state", STATE); }

  function addStars(n, reason = "") {
    STATE.stars = Math.max(0, (STATE.stars | 0) + (n | 0));
    $("#stars").textContent = String(STATE.stars);
    if (reason) $("#subline").textContent = reason;
    saveState();
  }

  function unlockBadge(id, title, desc, emoji = "🏅") {
    if (STATE.badges[id]) return false;
    STATE.badges[id] = { title, desc, emoji, at: Date.now() };
    const count = Object.keys(STATE.badges).length;
    $("#badges").textContent = String(count);
    addStars(5, `Badge unlocked: ${title}!`);
    beep("win");
    speak(`Badge unlocked! ${title}!`);
    renderBadges();
    saveState();
    return true;
  }

  function isMissionDone(id) { return !!STATE.missions[id]; }
  function setMissionDone(id, done = true) {
    STATE.missions[id] = !!done;
    saveState();
    renderMissions();
    maybeAwardMissionBadges();
  }

  /* ----------------- Tabs ----------------- */
  function setupTabs() {
    $$(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        beep("tap");
        $$(".tab").forEach(b => b.classList.remove("active"));
        $$(".panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const name = btn.dataset.tab;
        $(`#tab-${name}`).classList.add("active");

        const tabTitles = {
          dress: "Dress Up Designer",
          glam: "Glam Makeup Palette",
          bricks: "Brick Builder",
          stickers: "Sticker Room",
          missions: "Mission Board",
          trophy: "Trophy Room"
        };
        $("#subline").textContent = tabTitles[name] || "Sparkle time!";
      });
    });
  }

  /* ----------------- Buttons: Sound/TTS/Reset ----------------- */
  function setupTopButtons() {
    const soundBtn = $("#soundBtn");
    const ttsBtn = $("#ttsBtn");

    function paint() {
      soundBtn.textContent = soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF";
      ttsBtn.textContent = ttsOn ? "🗣️ Read: ON" : "🔕 Read: OFF";
    }
    paint();

    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      store.set("journey_soundOn", soundOn);
      paint();
      beep("tap");
    });

    ttsBtn.addEventListener("click", () => {
      ttsOn = !ttsOn;
      store.set("journey_ttsOn", ttsOn);
      paint();
      beep("tap");
      if (ttsOn) speak("Reading is on!");
    });

    $("#resetAll").addEventListener("click", () => {
      beep("bad");
      const ok = confirm("Reset everything for Journey? This clears looks, stickers, bricks, missions, stars, and badges.");
      if (!ok) return;

      localStorage.removeItem("journey_state");
      localStorage.removeItem("journey_soundOn");
      localStorage.removeItem("journey_ttsOn");
      location.reload();
    });
  }

  /* =========================================================
     DRESS UP
     ========================================================= */
  const HAIR_STYLES = {
    pony: { colorA: "#fbbf24", colorB: "#f59e0b", shape: "pony" },
    waves: { colorA: "#fda4af", colorB: "#fb7185", shape: "waves" },
    bob:   { colorA: "#93c5fd", colorB: "#60a5fa", shape: "bob" },
    braids:{ colorA: "#c4b5fd", colorB: "#a78bfa", shape: "braids" }
  };

  const OUTFITS = {
    party:    { top: ["#ff4fd8","#a78bfa"], skirt: ["#a78bfa","#ff4fd8"], belt: false, necklace: true },
    sporty:   { top: ["#60a5fa","#34d399"], skirt: ["#34d399","#60a5fa"], belt: true,  necklace: false },
    princess: { top: ["#a78bfa","#fb7185"], skirt: ["#fb7185","#a78bfa"], belt: true,  necklace: true },
    lego:     { top: ["#fbbf24","#60a5fa"], skirt: ["#34d399","#fbbf24"], belt: true,  necklace: false }
  };

  const SHOES = {
    sneakers: "#374151",
    heels:    "#ff4fd8",
    boots:    "#a78bfa",
    flats:    "#60a5fa"
  };

  function applyHair(key) {
    const h = HAIR_STYLES[key] || HAIR_STYLES.pony;
    const hair = $("#hair");
    hair.className = `hair hair-${h.shape}`;
    hair.style.background = `linear-gradient(135deg, ${h.colorA}, ${h.colorB})`;

    // Simple shape variations via border-radius + size
    if (h.shape === "pony") {
      hair.style.borderRadius = "120px 120px 90px 90px";
      hair.style.height = "110px";
      hair.style.width = "210px";
    } else if (h.shape === "waves") {
      hair.style.borderRadius = "90px 90px 110px 110px";
      hair.style.height = "125px";
      hair.style.width = "220px";
    } else if (h.shape === "bob") {
      hair.style.borderRadius = "70px 70px 60px 60px";
      hair.style.height = "90px";
      hair.style.width = "195px";
    } else if (h.shape === "braids") {
      hair.style.borderRadius = "110px 110px 120px 120px";
      hair.style.height = "120px";
      hair.style.width = "215px";
    }
  }

  function applyOutfit(key) {
    const o = OUTFITS[key] || OUTFITS.party;
    const top = $("#topWear");
    const skirt = $("#skirtWear");

    top.style.background = `linear-gradient(135deg, ${o.top[0]}, ${o.top[1]})`;
    skirt.style.background = `linear-gradient(135deg, ${o.skirt[0]}, ${o.skirt[1]})`;

    $("#belt").style.opacity = o.belt ? "1" : "0";
    $("#necklace").style.opacity = o.necklace ? "1" : "0";
  }

  function applyShoes(key) {
    const c = SHOES[key] || SHOES.sneakers;
    $("#shoeL").style.background = c;
    $("#shoeR").style.background = c;
  }

  function applyAccessories(accState) {
    for (const id of ["crown","glasses","wand","bag"]) {
      const el = $(`#${id}`);
      if (!el) continue;
      el.classList.toggle("on", !!accState[id]);
    }
  }

  function setDressMsg(text) {
    $("#dressMsg").textContent = text;
  }

  function setupDress() {
    // Restore from state
    applyHair(STATE.dress.hair);
    applyOutfit(STATE.dress.outfit);
    applyShoes(STATE.dress.shoes);
    applyAccessories(STATE.dress.acc);

    // Hair buttons
    $$("[data-hair]").forEach(b => {
      b.addEventListener("click", () => {
        const k = b.dataset.hair;
        STATE.dress.hair = k;
        applyHair(k);
        addStars(1, "Cute hair! ⭐");
        beep("tap");
        setDressMsg(`Hair: ${k}!`);
        speak(`Hair set to ${k}!`);
        setMissionDone("hair", true);
        saveState();
        maybeOutfitComboReward();
      });
    });

    // Outfit buttons
    $$("[data-outfit]").forEach(b => {
      b.addEventListener("click", () => {
        const k = b.dataset.outfit;
        STATE.dress.outfit = k;
        applyOutfit(k);
        addStars(1, "Outfit time! ⭐");
        beep("tap");
        setDressMsg(`Outfit: ${k}!`);
        speak(`Outfit set to ${k}!`);
        setMissionDone("outfit", true);
        saveState();
        maybeOutfitComboReward();
      });
    });

    // Shoes buttons
    $$("[data-shoes]").forEach(b => {
      b.addEventListener("click", () => {
        const k = b.dataset.shoes;
        STATE.dress.shoes = k;
        applyShoes(k);
        addStars(1, "Shoes picked! ⭐");
        beep("tap");
        setDressMsg(`Shoes: ${k}!`);
        speak(`Shoes set to ${k}!`);
        setMissionDone("shoes", true);
        saveState();
        maybeOutfitComboReward();
      });
    });

    // Accessories toggles
    $$("[data-acc]").forEach(b => {
      b.addEventListener("click", () => {
        const k = b.dataset.acc;
        STATE.dress.acc[k] = !STATE.dress.acc[k];
        applyAccessories(STATE.dress.acc);
        addStars(1, "Accessory sparkle! ⭐");
        beep("tap");
        const on = STATE.dress.acc[k] ? "on" : "off";
        setDressMsg(`${k} ${on}!`);
        speak(`${k} ${on}!`);
        setMissionDone("acc", true);
        saveState();
        maybeOutfitComboReward();
      });
    });

    $("#randomLook").addEventListener("click", () => {
      beep("tap");
      STATE.dress.hair = pick(Object.keys(HAIR_STYLES));
      STATE.dress.outfit = pick(Object.keys(OUTFITS));
      STATE.dress.shoes = pick(Object.keys(SHOES));
      for (const k of Object.keys(STATE.dress.acc)) STATE.dress.acc[k] = Math.random() < 0.5;

      applyHair(STATE.dress.hair);
      applyOutfit(STATE.dress.outfit);
      applyShoes(STATE.dress.shoes);
      applyAccessories(STATE.dress.acc);

      addStars(2, "Random look! ⭐⭐");
      setDressMsg("Random look created! ✨");
      speak("Random look created!");
      setMissionDone("randomLook", true);
      saveState();
      maybeOutfitComboReward();
    });

    $("#saveLook").addEventListener("click", () => {
      beep("tap");
      store.set("journey_savedLook", STATE.dress);
      addStars(2, "Look saved! ⭐⭐");
      setDressMsg("Saved your look!");
      speak("Saved your look!");
      setMissionDone("saveLook", true);
      saveState();
    });

    $("#loadLook").addEventListener("click", () => {
      beep("tap");
      const saved = store.get("journey_savedLook", null);
      if (!saved) {
        setDressMsg("No saved look yet. Try Save Look!");
        speak("No saved look yet.");
        return;
      }
      STATE.dress = saved;
      applyHair(saved.hair);
      applyOutfit(saved.outfit);
      applyShoes(saved.shoes);
      applyAccessories(saved.acc);
      addStars(1, "Loaded saved look! ⭐");
      setDressMsg("Loaded your saved look!");
      speak("Loaded your saved look!");
      saveState();
      maybeOutfitComboReward();
    });

    $("#dressRead").addEventListener("click", () => {
      speak("Welcome to Dress Up! Pick hair, outfit, shoes, and accessories. Then save your favorite look!");
    });
  }

  function maybeOutfitComboReward() {
    const { hair, outfit, shoes, acc } = STATE.dress;

    // Mission: fully styled
    const anyAcc = Object.values(acc).some(Boolean);
    if (hair && outfit && shoes && anyAcc) setMissionDone("fullStyle", true);

    // Combo badge (fun, not strict)
    if (outfit === "princess" && acc.crown && acc.wand) {
      unlockBadge("princess", "Princess Sparkle", "Crown + wand + princess outfit!", "👑");
    }
    if (outfit === "lego" && shoes === "sneakers") {
      unlockBadge("builder", "Builder Buddy", "Builder outfit + sneakers!", "🧱");
    }
    if (outfit === "party" && (acc.glasses || acc.bag)) {
      unlockBadge("party", "Party Pop", "Party look with accessories!", "🎉");
    }
  }

  /* =========================================================
     GLAM
     ========================================================= */
  const COLOR_SETS = {
    lips:   ["#ff4fd8","#fb7185","#f43f5e","#fbbf24","#a78bfa","#60a5fa"],
    blush:  ["rgba(255,79,216,.35)","rgba(251,113,133,.35)","rgba(251,191,36,.28)","rgba(167,139,250,.30)"],
    shadow: ["rgba(167,139,250,.35)","rgba(96,165,250,.28)","rgba(52,211,153,.22)","rgba(251,191,36,.25)"],
    liner:  ["rgba(0,0,0,.35)","rgba(0,0,0,.22)","rgba(96,165,250,.28)","rgba(167,139,250,.28)"],
    freckles:["rgba(170,92,41,.35)","rgba(120,62,22,.30)","rgba(0,0,0,.18)"],
    sparkles:["rgba(255,255,255,.95)","rgba(251,191,36,.90)","rgba(255,79,216,.85)","rgba(96,165,250,.85)"]
  };

  function renderSwatches(tool) {
    const box = $("#swatches");
    box.innerHTML = "";
    const colors = COLOR_SETS[tool] || [];
    colors.forEach(c => {
      const d = document.createElement("button");
      d.className = "swatch";
      d.style.background = c;
      d.title = "Pick";
      d.addEventListener("click", () => {
        beep("tap");
        applyGlam(tool, c);
        addStars(1, "Glam! ⭐");
        setGlamMsg(`${tool} set!`);
        speak(`${tool} set!`);
        setMissionDone("glamColor", true);
        maybeGlamComplete();
      });
      box.appendChild(d);
    });
  }

  function setGlamMsg(text) { $("#glamMsg").textContent = text; }

  function applyGlam(tool, color) {
    if (tool === "lips") {
      $("#glamLips").style.background = color;
      $("#glamLips").style.opacity = "1";
      STATE.glam.lips = color;
      // also mirror to dress doll
      $("#lip").style.background = color;
      $("#lip").style.opacity = "1";
    }
    if (tool === "blush") {
      $("#glamCheeks").style.opacity = "1";
      // cheeks are pseudo elements; easiest is background on container + opacity
      $("#glamCheeks").style.background = "transparent";
      $("#glamCheeks").style.filter = "blur(.1px)";
      $("#glamCheeks").style.setProperty("--blushColor", color);
      // apply via actual element background using gradient trick
      $("#glamCheeks").style.background =
        `radial-gradient(circle at 20% 60%, ${color}, transparent 60%),
         radial-gradient(circle at 80% 60%, ${color}, transparent 60%)`;
      STATE.glam.blush = color;

      // mirror to doll blush
      const b = $("#blush");
      b.style.opacity = "1";
      b.style.setProperty("--bColor", color);
      b.style.background =
        `radial-gradient(circle at 20% 60%, ${color}, transparent 60%),
         radial-gradient(circle at 80% 60%, ${color}, transparent 60%)`;
    }
    if (tool === "shadow") {
      $("#glamShadow").style.opacity = "1";
      $("#glamShadow").style.background =
        `radial-gradient(circle at 30% 60%, ${color}, transparent 60%),
         radial-gradient(circle at 70% 60%, ${color}, transparent 60%)`;
      STATE.glam.shadow = color;

      // mirror to doll shadow
      const s = $("#shadow");
      s.style.opacity = "1";
      s.style.background =
        `radial-gradient(circle at 30% 60%, ${color}, transparent 60%),
         radial-gradient(circle at 70% 60%, ${color}, transparent 60%)`;
    }

    if (tool === "liner") {
      $("#glamLiner").style.background = color;
      $("#glamLiner").style.opacity = "1";
      STATE.glam.liner = color;
      const d = $("#liner");
      d.classList.add("on");
      d.style.background =
        `radial-gradient(50px 18px at 38% 54%, ${color}, transparent 70%),
         radial-gradient(50px 18px at 62% 54%, ${color}, transparent 70%)`;
      d.style.opacity = "1";
    }

    if (tool === "freckles") {
      $("#glamFreckles").style.opacity = "1";
      $("#glamFreckles").style.background = color;
      STATE.glam.freckles = color;
      const d = $("#freckles");
      d.classList.add("on");
      d.style.opacity = "1";
      d.style.background =
        `radial-gradient(circle at 40% 62%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 44% 68%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 48% 60%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 60% 62%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 56% 68%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 52% 60%, ${color} 0 2px, transparent 3px)`;
    }

    if (tool === "sparkles") {
      $("#glamSparkles").style.opacity = "1";
      $("#glamSparkles").style.background = color;
      STATE.glam.sparkles = color;
      const d = $("#faceSparkles");
      d.classList.add("on");
      d.style.opacity = "1";
      d.style.background =
        `radial-gradient(circle at 30% 28%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 70% 26%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 52% 44%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 34% 60%, ${color} 0 2px, transparent 3px),
         radial-gradient(circle at 66% 62%, ${color} 0 2px, transparent 3px)`;
    }


    saveState();
  }

  function setTool(tool) {
    STATE.glam.tool = tool;
    $$(".toolBtn").forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
    renderSwatches(tool);
    saveState();
  }

  function maybeGlamComplete() {
    if (STATE.glam.lips && STATE.glam.blush && STATE.glam.shadow) {
      setMissionDone("glamFull", true);
      unlockBadge("glam", "Glam Star", "Lip + blush + shadow complete!", "💄");
    }
  }

  function setupGlam() {
    setTool(STATE.glam.tool || "lips");


    // restore saved makeup onto the face preview + doll
    if (STATE.glam.lips) applyGlam("lips", STATE.glam.lips);
    if (STATE.glam.blush) applyGlam("blush", STATE.glam.blush);
    if (STATE.glam.shadow) applyGlam("shadow", STATE.glam.shadow);
    if (STATE.glam.liner) applyGlam("liner", STATE.glam.liner);
    if (STATE.glam.freckles) applyGlam("freckles", STATE.glam.freckles);
    if (STATE.glam.sparkles) applyGlam("sparkles", STATE.glam.sparkles);

    // restore saved glam colors
    if (STATE.glam.lips) applyGlam("lips", STATE.glam.lips);
    if (STATE.glam.blush) applyGlam("blush", STATE.glam.blush);
    if (STATE.glam.shadow) applyGlam("shadow", STATE.glam.shadow);

    $$(".toolBtn").forEach(b => {
      b.addEventListener("click", () => {
        beep("tap");
        setTool(b.dataset.tool);
        setGlamMsg(`Tool: ${b.dataset.tool}`);
        speak(`Tool set to ${b.dataset.tool}`);
        setMissionDone("glamTool", true);
      });
    });

    $("#glamRandom").addEventListener("click", () => {
      beep("tap");
      const lips = pick(COLOR_SETS.lips);
      const blush = pick(COLOR_SETS.blush);
      const shadow = pick(COLOR_SETS.shadow);
      applyGlam("lips", lips);
      applyGlam("blush", blush);
      applyGlam("shadow", shadow);
      addStars(2, "Random glam! ⭐⭐");
      setGlamMsg("Random glam created!");
      speak("Random glam created!");
      setMissionDone("glamRandom", true);
      maybeGlamComplete();
    });

    $("#glamClear").addEventListener("click", () => {
      beep("bad");
      STATE.glam.lips = null;
      STATE.glam.blush = null;
      STATE.glam.shadow = null;
      STATE.glam.liner = null;
      STATE.glam.freckles = null;
      STATE.glam.sparkles = null;
      $("#glamLips").style.opacity = "0";
      $("#glamCheeks").style.opacity = "0";
      $("#glamShadow").style.opacity = "0";
      $("#glamLiner").style.opacity = "0";
      $("#glamFreckles").style.opacity = "0";
      $("#glamSparkles").style.opacity = "0";
      $("#lip").style.opacity = "0";
      $("#shadow").style.opacity = "0";
      $("#liner").style.opacity = "0"; $("#liner").classList.remove("on");
      $("#freckles").style.opacity = "0"; $("#freckles").classList.remove("on");
      $("#faceSparkles").style.opacity = "0"; $("#faceSparkles").classList.remove("on");
      $("#blush").style.opacity = "0";
      addStars(0, "Cleared glam.");
      setGlamMsg("Cleared. Try new colors!");
      speak("Cleared. Try new colors!");
      saveState();
    });

    $("#glamSave").addEventListener("click", () => {
      beep("tap");
      store.set("journey_savedGlam", STATE.glam);
      addStars(2, "Glam saved! ⭐⭐");
      setGlamMsg("Saved glam look!");
      speak("Saved glam look!");
      setMissionDone("glamSave", true);
      saveState();
    });

    $("#glamLoad").addEventListener("click", () => {
      beep("tap");
      const g = store.get("journey_savedGlam", null);
      if (!g) {
        setGlamMsg("No saved glam yet. Try Save!");
        speak("No saved glam yet.");
        return;
      }
      STATE.glam = g;
      if (g.lips) applyGlam("lips", g.lips);
      if (g.blush) applyGlam("blush", g.blush);
      if (g.shadow) applyGlam("shadow", g.shadow);
      setTool(g.tool || "lips");
      addStars(1, "Loaded glam! ⭐");
      setGlamMsg("Loaded saved glam!");
      speak("Loaded saved glam!");
      saveState();
      maybeGlamComplete();
    });

    $("#glamRead").addEventListener("click", () => {
      speak("Welcome to Glam! Choose lipstick, blush, or eyeshadow, then pick a color. Make a full glam look to unlock a badge!");
    });
  }

  /* =========================================================
     BRICKS
     ========================================================= */
  const BRICK_COLORS = [
    "#ff4fd8", "#fb7185", "#a78bfa", "#60a5fa", "#34d399", "#fbbf24", "#f97316", "#ffffff"
  ];

  function renderBrickSwatches() {
    const box = $("#brickSwatches");
    box.innerHTML = "";
    BRICK_COLORS.forEach(c => {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c;
      b.title = c;
      b.addEventListener("click", () => {
        beep("tap");
        STATE.bricks.color = c;
        saveState();
      });
      box.appendChild(b);
    });
  }

  function renderBrickBoard() {
    const board = $("#brickBoard");
    board.innerHTML = "";
    for (let i = 0; i < 144; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const color = STATE.bricks.grid[i];
      if (color) {
        cell.classList.add("filled");
        cell.style.background = `linear-gradient(135deg, ${color}, rgba(255,255,255,.12))`;
      }
      if (STATE.bricks.mode === "erase") cell.classList.add("erase");

      cell.addEventListener("click", () => onBrickCell(i));
      board.appendChild(cell);
    }
    updateBrickStats();
  }

  function updateBrickStats() {
    const count = STATE.bricks.grid.filter(Boolean).length;
    $("#brickCount").textContent = String(count);

    // Tallest tower: max filled count per column
    let tallest = 0;
    for (let x = 0; x < 12; x++) {
      let col = 0;
      for (let y = 0; y < 12; y++) {
        const idx = y * 12 + x;
        if (STATE.bricks.grid[idx]) col++;
      }
      tallest = Math.max(tallest, col);
    }
    STATE.bricks.tallest = tallest;
    $("#brickTallest").textContent = String(tallest);
    $("#brickGoalText").textContent = String(STATE.bricks.goal);

    // Goal checks
    if (tallest >= 8) setMissionDone("tower8", true);
    if (tallest >= 10) unlockBadge("tower", "Tower Builder", "Built a tall tower!", "🏗️");

    saveState();
  }

  function onBrickCell(i) {
    beep("tap");
    const mode = STATE.bricks.mode;
    if (mode === "place") {
      if (!STATE.bricks.grid[i]) addStars(1, "Brick placed! ⭐");
      STATE.bricks.grid[i] = STATE.bricks.color;
      setMissionDone("brickPlace", true);
    } else {
      if (STATE.bricks.grid[i]) addStars(1, "Brick erased! ⭐");
      STATE.bricks.grid[i] = null;
      setMissionDone("brickErase", true);
    }
    renderBrickBoard();
    checkBrickGoals();
  }

  function checkBrickGoals() {
    // Super simple goals: Tower / Heart / Rainbow (easy-ish)
    const goal = STATE.bricks.goal;
    if (goal === "Tower") {
      if (STATE.bricks.tallest >= 8) {
        $("#brickMsg").textContent = "Goal complete: Tall Tower! 🎉";
        addStars(4, "Tower goal complete! ⭐⭐⭐⭐");
        beep("win");
        speak("Goal complete! Tall tower!");
        setMissionDone("brickGoal", true);
        unlockBadge("goalTower", "Goal Getter", "Completed a brick goal!", "🎯");
        STATE.bricks.goal = pick(["Heart","Rainbow"]);
        saveState();
        renderBrickBoard();
      } else {
        $("#brickMsg").textContent = "Build higher! Try reaching 8 blocks tall.";
      }
    } else if (goal === "Heart") {
      if (matchesHeartPattern()) {
        $("#brickMsg").textContent = "Goal complete: Heart! 💖";
        addStars(5, "Heart goal complete! ⭐⭐⭐⭐⭐");
        beep("win");
        speak("Goal complete! Heart!");
        setMissionDone("brickGoal", true);
        unlockBadge("heart", "Heart Builder", "Built a heart pattern!", "💖");
        STATE.bricks.goal = pick(["Tower","Rainbow"]);
        saveState();
        renderBrickBoard();
      } else {
        $("#brickMsg").textContent = "Try to make a heart near the center 💖";
      }
    } else if (goal === "Rainbow") {
      if (matchesRainbowPattern()) {
        $("#brickMsg").textContent = "Goal complete: Rainbow! 🌈";
        addStars(6, "Rainbow goal complete! ⭐⭐⭐⭐⭐⭐");
        beep("win");
        speak("Goal complete! Rainbow!");
        setMissionDone("brickGoal", true);
        unlockBadge("rainbow", "Rainbow Maker", "Built a rainbow pattern!", "🌈");
        STATE.bricks.goal = pick(["Tower","Heart"]);
        saveState();
        renderBrickBoard();
      } else {
        $("#brickMsg").textContent = "Make a rainbow stripe somewhere 🌈";
      }
    }
  }

  // Simple pattern helpers (very forgiving)
  function matchesHeartPattern() {
    // Check a small 5x5 area around center for "heart-ish" filled cells
    const centerX = 6, centerY = 6;
    const must = [
      [-1,-2],[1,-2],
      [-2,-1],[2,-1],
      [-2,0],[2,0],
      [-1,1],[1,1],
      [0,2]
    ];
    return must.every(([dx,dy]) => {
      const x = centerX + dx, y = centerY + dy;
      const idx = y * 12 + x;
      return STATE.bricks.grid[idx];
    });
  }

  function matchesRainbowPattern() {
    // Any row that has 5+ filled cells in a run counts
    for (let y = 0; y < 12; y++) {
      let run = 0;
      for (let x = 0; x < 12; x++) {
        const idx = y * 12 + x;
        if (STATE.bricks.grid[idx]) run++;
        else run = 0;
        if (run >= 5) return true;
      }
    }
    return false;
  }

  function setBrickMode(mode) {
    STATE.bricks.mode = mode;
    $("#brickModePlace").classList.toggle("primary", mode === "place");
    $("#brickModeErase").classList.toggle("primary", mode === "erase");
    renderBrickBoard();
    saveState();
  }

  function setupBricks() {
    renderBrickSwatches();
    renderBrickBoard();
    $("#brickGoalText").textContent = STATE.bricks.goal;

    $("#brickModePlace").addEventListener("click", () => { beep("tap"); setBrickMode("place"); });
    $("#brickModeErase").addEventListener("click", () => { beep("tap"); setBrickMode("erase"); });

    $("#brickClear").addEventListener("click", () => {
      beep("bad");
      STATE.bricks.grid = Array(144).fill(null);
      saveState();
      renderBrickBoard();
      $("#brickMsg").textContent = "Cleared! Build something new 🧱";
      speak("Cleared! Build something new.");
      setMissionDone("brickClear", true);
    });

    $("#brickGoal").addEventListener("click", () => {
      beep("tap");
      STATE.bricks.goal = pick(["Tower","Heart","Rainbow"]);
      saveState();
      renderBrickBoard();
      $("#brickMsg").textContent = `New Goal: ${STATE.bricks.goal}!`;
      speak(`New goal: ${STATE.bricks.goal}`);
      setMissionDone("brickNewGoal", true);
    });

    $("#brickRead").addEventListener("click", () => {
      speak("Welcome to Brick Builder! Tap squares to place blocks. Use erase to remove. Try to complete the goal for a badge!");
    });

    // Mission starter
    if (STATE.bricks.grid.some(Boolean)) setMissionDone("brickPlace", true);
  }

  /* =========================================================
     STICKERS
     ========================================================= */
  const STICKERS = ["💖","🌸","🦄","🎀","👑","✨","🌈","🧸","🐱","🐶","🍓","🧁","⭐","💎","🪄","🩷"];

  function renderStickerTray() {
    const tray = $("#stickerTray");
    tray.innerHTML = "";
    STICKERS.forEach(e => {
      const s = document.createElement("div");
      s.className = "sticker";
      s.textContent = e;
      s.draggable = true;

      s.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", e);
        beep("tap");
      });

      // Touch-friendly fallback: tap-to-place randomly
      s.addEventListener("click", () => {
        beep("tap");
        const room = $("#room");
        const rect = room.getBoundingClientRect();
        const x = rand(80, rect.width - 80);
        const y = rand(90, rect.height - 120);
        placeSticker(e, x, y);
        setMissionDone("stickerPlace", true);
      });

      tray.appendChild(s);
    });
  }

  function placeSticker(emoji, x, y) {
    const room = $("#room");
    const item = document.createElement("div");
    item.className = "placed";
    item.textContent = emoji;

    // position within room
    item.style.left = `${x - 35}px`;
    item.style.top = `${y - 35}px`;

    // drag within room
    makeDraggable(item, room);

    room.appendChild(item);

    STATE.stickers.placed.push({ emoji, x, y });
    saveState();
    updateStickerStats();

    addStars(1, "Sticker placed! ⭐");
    beep("tap");

    if (STATE.stickers.placed.length >= 10) setMissionDone("stickers10", true);
    if (STATE.stickers.placed.length >= 15) unlockBadge("decorator", "Room Decorator", "Placed lots of stickers!", "🧸");
  }

  function updateStickerStats() {
    $("#stickerCount").textContent = String(STATE.stickers.placed.length);
    $("#stickerStars").textContent = String(STATE.stickers.placed.length); // fun display
    saveState();
  }

  function clearPlacedStickers() {
    $$("#room .placed").forEach(n => n.remove());
    STATE.stickers.placed = [];
    saveState();
    updateStickerStats();
  }

  function loadPlacedStickers() {
    clearPlacedStickers();
    const room = $("#room");
    const rect = room.getBoundingClientRect();
    STATE.stickers.placed.forEach(p => {
      placeSticker(p.emoji, clamp(p.x, 70, rect.width - 70), clamp(p.y, 80, rect.height - 100));
    });
  }

  function setupStickerRoom() {
    renderStickerTray();

    // Room background picker
    function setRoomBg(key) {
      const k = key || "look1";
      room.style.backgroundImage = `url(./assets_journey/images_journey/${k}.jpg)`;
      STATE.stickers.bg = k;
      saveState();
    }
    setRoomBg(STATE.stickers.bg || "look1");

    $$("[data-room-bg]").forEach(btn => {
      btn.addEventListener("click", () => {
        beep("tap");
        setRoomBg(btn.dataset.roomBg);
        setMissionDone("stickers", true);
        $("#stickerMsg").textContent = "Background changed! Keep decorating 💖";
      });
    });


    const room = $("#room");
    room.addEventListener("dragover", (ev) => ev.preventDefault());
    room.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const emoji = ev.dataTransfer.getData("text/plain");
      if (!emoji) return;
      const rect = room.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      placeSticker(emoji, x, y);
      setMissionDone("stickerPlace", true);
    });

    // restore placed stickers
    if (STATE.stickers.placed.length) {
      // We'll place fresh DOM elements using saved positions
      const saved = [...STATE.stickers.placed];
      STATE.stickers.placed = [];
      saved.forEach(p => placeSticker(p.emoji, p.x, p.y));
    }
    updateStickerStats();

    $("#stickerSave").addEventListener("click", () => {
      beep("tap");
      store.set("journey_savedRoom", STATE.stickers.placed);
      addStars(2, "Room saved! ⭐⭐");
      $("#stickerMsg").textContent = "Saved your room!";
      speak("Saved your room!");
      setMissionDone("stickerSave", true);
      saveState();
    });

    $("#stickerLoad").addEventListener("click", () => {
      beep("tap");
      const saved = store.get("journey_savedRoom", null);
      if (!saved) {
        $("#stickerMsg").textContent = "No saved room yet. Try Save Room!";
        speak("No saved room yet.");
        return;
      }
      // load
      clearPlacedStickers();
      const roomRect = room.getBoundingClientRect();
      saved.forEach(p => {
        placeSticker(p.emoji,
          clamp(p.x, 70, roomRect.width - 70),
          clamp(p.y, 80, roomRect.height - 100)
        );
      });
      addStars(2, "Room loaded! ⭐⭐");
      $("#stickerMsg").textContent = "Loaded your saved room!";
      speak("Loaded your saved room!");
      setMissionDone("stickerLoad", true);
    });

    $("#stickerClear").addEventListener("click", () => {
      beep("bad");
      clearPlacedStickers();
      $("#stickerMsg").textContent = "Cleared! Decorate again!";
      speak("Cleared. Decorate again!");
      setMissionDone("stickerClear", true);
    });

    $("#stickerRead").addEventListener("click", () => {
      speak("Welcome to Sticker Room! Drag stickers onto the room, or tap a sticker to place it. Save your room when it looks perfect!");
    });
  }

  // Drag helper (mouse + touch)
  function makeDraggable(el, container) {
    let dragging = false;
    let offX = 0, offY = 0;

    const start = (clientX, clientY) => {
      const r = el.getBoundingClientRect();
      dragging = true;
      offX = clientX - r.left;
      offY = clientY - r.top;
      el.style.cursor = "grabbing";
      el.style.zIndex = "5";
    };

    const move = (clientX, clientY) => {
      if (!dragging) return;
      const cr = container.getBoundingClientRect();
      const x = clamp(clientX - cr.left - offX, 0, cr.width - el.offsetWidth);
      const y = clamp(clientY - cr.top - offY, 0, cr.height - el.offsetHeight);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      el.style.zIndex = "";
      // update state positions
      syncStickersToState();
    };

    el.style.cursor = "grab";
    el.addEventListener("mousedown", (e) => { start(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", end);

    el.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      start(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive:false });

    window.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (!t) return;
      move(t.clientX, t.clientY);
    }, { passive:true });

    window.addEventListener("touchend", end);
  }

  function syncStickersToState() {
    // Rebuild state from DOM positions (keeps it consistent after dragging)
    const room = $("#room");
    const cr = room.getBoundingClientRect();
    const placed = $$("#room .placed");
    const data = placed.map(el => {
      const r = el.getBoundingClientRect();
      const x = r.left - cr.left + r.width/2;
      const y = r.top - cr.top + r.height/2;
      return { emoji: el.textContent, x, y };
    });
    STATE.stickers.placed = data;
    saveState();
    updateStickerStats();
  }

  /* =========================================================
     MISSIONS + BADGES
     ========================================================= */
  const MISSIONS = [
    { id:"hair",       text:"Pick a hair style", stars: 2 },
    { id:"outfit",     text:"Pick an outfit", stars: 2 },
    { id:"acc",        text:"Turn on an accessory", stars: 2 },
    { id:"saveLook",   text:"Save your favorite look", stars: 3 },

    { id:"glamTool",   text:"Choose a makeup tool", stars: 2 },
    { id:"glamColor",  text:"Pick a makeup color", stars: 2 },
    { id:"glamFull",   text:"Make a full glam look", stars: 4 },

    { id:"brickPlace", text:"Place a brick", stars: 2 },
    { id:"tower8",     text:"Build a tower 8 blocks tall", stars: 4 },
    { id:"brickGoal",  text:"Complete a brick goal", stars: 5 },

    { id:"stickerPlace", text:"Place a sticker", stars: 2 },
    { id:"stickers10",   text:"Place 10 stickers", stars: 4 },
    { id:"stickerSave",  text:"Save your sticker room", stars: 4 },
  ];

  function renderMissions() {
    const box = $("#missionList");
    if (!box) return;
    box.innerHTML = "";
    MISSIONS.forEach(m => {
      const row = document.createElement("div");
      row.className = "missionRow" + (isMissionDone(m.id) ? " done" : "");
      row.innerHTML = `
        <div class="missionLeft">${isMissionDone(m.id) ? "✅" : "⬜"} ${m.text}</div>
        <div class="missionRight">⭐ +${m.stars}</div>
      `;
      box.appendChild(row);
    });

    const doneCount = MISSIONS.filter(m => isMissionDone(m.id)).length;
    $("#missionMsg").textContent = `Missions done: ${doneCount}/${MISSIONS.length}`;
  }

  function maybeAwardMissionBadges() {
    const doneCount = MISSIONS.filter(m => isMissionDone(m.id)).length;

    if (doneCount >= 4) unlockBadge("starter", "Sparkle Starter", "Completed 4 missions!", "✨");
    if (doneCount >= 8) unlockBadge("hero", "Studio Hero", "Completed 8 missions!", "🌟");
    if (doneCount >= MISSIONS.length) unlockBadge("all", "Studio Superstar", "Completed ALL missions!", "🏆");

    // award stars once per mission completion (only the first time)
    // To avoid double-awarding, we track granted missions in a separate key.
    const granted = store.get("journey_missionGranted", {});
    let changed = false;
    MISSIONS.forEach(m => {
      if (isMissionDone(m.id) && !granted[m.id]) {
        addStars(m.stars, `Mission complete: ${m.text}`);
        beep("win");
        granted[m.id] = true;
        changed = true;
      }
    });
    if (changed) store.set("journey_missionGranted", granted);

    saveState();
    renderBadges();
  }

  function setupMissionsUI() {
    renderMissions();
    maybeAwardMissionBadges();

    $("#missionRead").addEventListener("click", () => {
      const undone = MISSIONS.filter(m => !isMissionDone(m.id)).slice(0, 4);
      if (!undone.length) {
        speak("All missions complete! You are a Studio Superstar!");
      } else {
        speak("Here are your next missions: " + undone.map(m => m.text).join(". "));
      }
    });

    $("#missionReset").addEventListener("click", () => {
      beep("bad");
      const ok = confirm("Reset missions? (Badges and stars stay.)");
      if (!ok) return;
      STATE.missions = {};
      store.set("journey_missionGranted", {});
      saveState();
      renderMissions();
      $("#missionMsg").textContent = "Missions reset!";
      speak("Missions reset!");
    });
  }

  /* =========================================================
     TROPHIES / BADGES
     ========================================================= */
  const BADGE_CATALOG = [
    { id:"starter", title:"Sparkle Starter", desc:"Complete 4 missions!", emoji:"✨" },
    { id:"hero", title:"Studio Hero", desc:"Complete 8 missions!", emoji:"🌟" },
    { id:"all", title:"Studio Superstar", desc:"Complete ALL missions!", emoji:"🏆" },

    { id:"princess", title:"Princess Sparkle", desc:"Princess outfit + crown + wand!", emoji:"👑" },
    { id:"builder", title:"Builder Buddy", desc:"Builder outfit + sneakers!", emoji:"🧱" },
    { id:"party", title:"Party Pop", desc:"Party look with accessories!", emoji:"🎉" },

    { id:"glam", title:"Glam Star", desc:"Lip + blush + shadow complete!", emoji:"💄" },

    { id:"tower", title:"Tower Builder", desc:"Built a tall tower!", emoji:"🏗️" },
    { id:"goalTower", title:"Goal Getter", desc:"Completed a brick goal!", emoji:"🎯" },
    { id:"heart", title:"Heart Builder", desc:"Built a heart pattern!", emoji:"💖" },
    { id:"rainbow", title:"Rainbow Maker", desc:"Built a rainbow pattern!", emoji:"🌈" },

    { id:"decorator", title:"Room Decorator", desc:"Placed lots of stickers!", emoji:"🧸" },
  ];

  function renderBadges() {
    const grid = $("#badgeGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const owned = STATE.badges || {};
    const count = Object.keys(owned).length;
    $("#badges").textContent = String(count);

    BADGE_CATALOG.forEach(b => {
      const isOwned = !!owned[b.id];
      const card = document.createElement("div");
      card.className = "badge" + (isOwned ? "" : " locked");
      card.innerHTML = `
        <div>${b.emoji} ${b.title}${isOwned ? " ✅" : ""}</div>
        <div class="bdesc">${b.desc}</div>
      `;
      grid.appendChild(card);
    });
  }

  /* =========================================================
     Background sparkles on canvas
     ========================================================= */
  function setupCanvasBG() {
    const c = $("#bg");
    const ctx = c.getContext("2d");
    let w=0,h=0,dpr=1;
    let stars = [];

    function resize(){
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = c.width = Math.floor(innerWidth * dpr);
      h = c.height = Math.floor(innerHeight * dpr);
      c.style.width = innerWidth + "px";
      c.style.height = innerHeight + "px";
      stars = Array.from({length: Math.floor((innerWidth*innerHeight)/18000)}, () => ({
        x: Math.random()*w, y: Math.random()*h,
        r: rand(1*dpr, 2.6*dpr),
        a: rand(.12, .55),
        s: rand(.15*dpr, .6*dpr),
        hue: rand(290, 340)
      }));
    }
    window.addEventListener("resize", resize);
    resize();

    function tick(){
      ctx.clearRect(0,0,w,h);
      for (const s of stars){
        s.y += s.s;
        if (s.y > h + 10) { s.y = -10; s.x = Math.random()*w; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 95%, 75%, ${s.a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ----------------- Subline + initial counts ----------------- */
  function hydrateHeader() {
    $("#stars").textContent = String(STATE.stars | 0);
    $("#badges").textContent = String(Object.keys(STATE.badges || {}).length);
    $("#subline").textContent = "Ready to sparkle!";
  }

  /* ----------------- Init ----------------- */
  function init() {
    setupCanvasBG();
    hydrateHeader();
    setupTabs();
    setupTopButtons();

    setupDress();
    setupGlam();
    setupBricks();
    setupStickerRoom();

    setupMissionsUI();
    renderBadges();

    // Gentle “welcome”
    setTimeout(() => {
      $("#subline").textContent = "Welcome, Journey! Pick a tab and have fun 💖";
      speak("Welcome, Journey! Pick a tab and have fun!");
    }, 400);

    // Small “first-time” badge nudge
    if (!store.get("journey_first", false)) {
      store.set("journey_first", true);
      addStars(3, "First visit bonus! ⭐⭐⭐");
      unlockBadge("starterHint", "Welcome Sparkle", "First visit to Sparkle Studio!", "✨");
      // starterHint is not in catalog — still counts in badge count, but hidden
      // If you want it visible, add it to BADGE_CATALOG.
    }
  }

  // Ensure hidden welcome badge doesn't break rendering:
  // add a graceful check: renderBadges uses BADGE_CATALOG.
  // The "starterHint" badge is counted but not displayed; that's okay.

  // Start
  document.addEventListener("DOMContentLoaded", init);

})();
