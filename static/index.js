const control = document.getElementById('control');
const light = document.getElementById('light');
const play = document.getElementById('play');
const pause = document.getElementById('pause');
const audioIn = document.getElementById('audioIn');
const audio = new Audio();
let pickr;

// Arena gradient wave settings
let arenaPos = 0;   // this device's position index (0-based, left→right)
let arenaTotal = 3; // total devices in the arena row

// Ensure controlPanel container exists (some templates may omit it)
if (!document.getElementById('controlPanel')) {
  const cp = document.createElement('div');
  cp.id = 'controlPanel';
  cp.style.position = 'fixed';
  cp.style.bottom = '10px';
  cp.style.left = '10px';
  cp.style.background = 'rgba(0,0,0,0.3)';
  cp.style.padding = '6px';
  cp.style.borderRadius = '6px';
  document.body.appendChild(cp);
  // also add the pickr mount if missing
  const p = document.createElement('div');
  p.className = 'pickr';
  p.style.marginTop = '8px'; // push the color picker lower so it does not overlap buttons
  p.style.display = 'block';
  cp.appendChild(p);
}

const socket = io();

socket.on('connect', () => {
  socket.on('hex', (val) => { document.body.style.backgroundColor = val })
  socket.on('audio', (val) => { getSound(encodeURI(val)); })
  socket.on('pauseAudio', (val) => { audio.pause(); })
  socket.onAny((event, ...args) => {
    console.log(event, args);
  });
});

// Listen for arena-wide wave triggers and animate locally per device
socket.on('arenaWave', ({ color = '#FFFFFF', duration = 3000, width = 1.5 } = {}) => {
  arenaWave(color, duration, width);
});

// enter controller mode
control.onclick = () => {
  console.log('control')
  // make sure you're not in fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen()
      .then(() => console.log('exited full screen mode'))
      .catch((err) => console.error(err));
  }
  // make buttons and controls visible
  document.getElementById('user').classList.remove('fadeOut');
  document.getElementById('controlPanel').style.opacity = 0.6;
  if (!pickr) {
    // create our color picker. You can change the swatches that appear at the bottom
    pickr = Pickr.create({
      el: '.pickr',
      container: document.getElementById('controlPanel'),
      theme: 'classic',
      showAlways: true,
      swatches: [
        'rgba(255, 255, 255, 1)',
        'rgba(244, 67, 54, 1)',
        'rgba(233, 30, 99, 1)',
        'rgba(156, 39, 176, 1)',
        'rgba(103, 58, 183, 1)',
        'rgba(63, 81, 181, 1)',
        'rgba(33, 150, 243, 1)',
        'rgba(3, 169, 244, 1)',
        'rgba(0, 188, 212, 1)',
        'rgba(0, 150, 136, 1)',
        'rgba(76, 175, 80, 1)',
        'rgba(139, 195, 74, 1)',
        'rgba(205, 220, 57, 1)',
        'rgba(255, 235, 59, 1)',
        'rgba(255, 193, 7, 1)',
        'rgba(0, 0, 0, 1)',
      ],
      components: {
        preview: false,
        opacity: false,
        hue: true,
      },
    });

    // Force Pickr panel to scroll with the page instead of being fixed to the viewport
    (function(){
      const style = document.createElement('style');
      style.textContent = `.pcr-app{position:static !important;}`;
      document.head.appendChild(style);
    })();

    pickr.on('change', (e) => {
      // when pickr color value is changed change background and send message on ws to change background
      const hexCode = e.toHEXA().toString();
      document.body.style.backgroundColor = hexCode;
      socket.emit('hex', hexCode)
    });

    // --- Added: effect buttons ---
    const panel = document.getElementById('controlPanel');

    function ensureButton(id, label, onClick) {
      let btn = document.getElementById(id);
      if (!btn) {
        btn = document.createElement('button');
        btn.id = id;
        btn.textContent = label;
        btn.style.margin = '4px';
        panel.appendChild(btn);
      }
      btn.onclick = onClick;
      return btn;
    }

    // Helper to get current selected color (fallback to white)
    function getCurrentHex() {
      try { return pickr.getColor().toHEXA().toString(); } catch (e) { return '#FFFFFF'; }
    }

    ensureButton('btnSparkle', 'Sparkle', () => {
      playTwinkle();
      sparkle(getCurrentHex());
    });

    ensureButton('btnPulse', 'Pulse', () => {
      pulse(getCurrentHex());
    });

    ensureButton('btnPulseWhite', 'Pulse → White', () => {
      // Start a cheer sound and run the white-gradient pulse
      playCheer();
      pulseToWhite(getCurrentHex(), 6000);
    });

    ensureButton('btnCheer', 'Play Cheer', () => {
      playCheer();
    });


    ensureButton('btnArenaWave', 'Arena Wave', () => {
      const color = getCurrentHex();
      // Broadcast to all clients (requires server to re-emit this event)
      socket.emit('arenaWave', { color, duration: 3000, width: 1.5 });
      playEpic();
      // Also run locally as a fallback
      arenaWave(color, 3000, 1.5);
    });

    ensureButton('btnBlinkRedTwice', 'Blink Red Twice', () => {
      blinkRedTwice();
    });

    ensureButton('btnBlinkBlueTwice', 'Blink Blue Twice', () => {
      blinkBlueTwice();
    });

    ensureButton('btnBlinkBlackTwice', 'Blink Black Twice', () => {
  blinkBlackTwice();
});
    ensureButton('btnFlashRedBlackTwice', 'Flash Red/Black Twice', () => {
        flashRedBlackTwice();
    }
);

    ensureButton('btnFlashBlueBlackTwice', 'Flash Blue/Black Twice', () => {
        flashBlueBlackTwice();
    }
);
    // --- End added buttons ---
  }
};

light.onclick = () => {
  // safari requires playing on input before allowing audio
  audio.muted = true;
  audio.play().then(audio.muted = false)

  // in light mode make it full screen and fade buttons
  document.documentElement.requestFullscreen();
  document.getElementById('user').classList.add('fadeOut');
  // if you were previously in control mode remove color picker and hide controls
  if (pickr) {
    // this is annoying because of the pickr package
    pickr.destroyAndRemove();
    document.getElementById('controlPanel').append(Object.assign(document.createElement('div'), { className: 'pickr' }));
    pickr = undefined;
  }
  document.getElementById('controlPanel').style.opacity = 0;
};


const getSound = (query, loop = false, random = false) => {
  const url = `https://freesound.org/apiv2/search/text/?query=${query}+"&fields=name,previews&token=U5slaNIqr6ofmMMG2rbwJ19mInmhvCJIryn2JX89&format=json`;
  fetch(url)
    .then((response) => response.clone().text())
    .then((data) => {
      console.log(data);
      data = JSON.parse(data);
      if (data.results.length >= 1) var src = random ? choice(data.results).previews['preview-hq-mp3'] : data.results[0].previews['preview-hq-mp3'];
      audio.src = src;
      audio.play();
      console.log(src);
    })
    .catch((error) => console.log(error));
};

play.onclick = () => {
  socket.emit('audio', audioIn.value)
  getSound(encodeURI(audioIn.value));
};
pause.onclick = () => {
  socket.emit('pauseAudio', audioIn.value)
  audio.pause();
};
audioIn.onkeyup = (e) => { if (e.keyCode === 13) { play.click(); } };

function sparkle(color, duration = 3000) {
  let on = true;
  const interval = setInterval(() => {
    const hex = (color === '#FFFFFF') ? (on ? '#000000' : '#FFFFFF') : (on ? color : '#FFFFFF');
    document.body.style.backgroundColor = hex;
    socket.emit('hex', hex);
    on = !on;
  }, 200);
  setTimeout(() => clearInterval(interval), duration);
}

// Blink the screen red twice
function blinkRedTwice(duration = 300) {
  let count = 0;
  const maxBlinks = 4; // red → white → red → white (2 full blinks)

  function blink() {
    if (count >= maxBlinks) return;

    // Even counts = red, odd counts = white
    const color = (count % 2 === 0) ? '#FF0000' : '#FFFFFF';
    document.body.style.backgroundColor = color;
    socket.emit('hex', color);

    count++;
    setTimeout(blink, duration);
  }

  blink();
}

// Blink the screen blue twice
function blinkBlueTwice(duration = 300) {
  let count = 0;
  const maxBlinks = 4; // blue → white → blue → white (2 full blinks)

  function blink() {
    if (count >= maxBlinks) return;

    // Even counts = blue, odd counts = white
    const color = (count % 2 === 0) ? '#0000FF' : '#FFFFFF';
    document.body.style.backgroundColor = color;
    socket.emit('hex', color);

    count++;
    setTimeout(blink, duration);
  }

  blink();
}

// Blink the screen black twice
function blinkBlackTwice(duration = 300) {
  let count = 0;
  const maxBlinks = 4; // black → white → black → white (2 full blinks)

  function blink() {
    if (count >= maxBlinks) return;

    // Even counts = black, odd counts = white
    const color = (count % 2 === 0) ? '#000000' : '#FFFFFF';
    document.body.style.backgroundColor = color;
    socket.emit('hex', color);

    count++;
    setTimeout(blink, duration);
  }

  blink();
}

function flashRedBlackTwice() {
  const body = document.body;
  let count = 0;
  const colors = ["red", "black"];
  const interval = setInterval(() => {
    body.style.backgroundColor = colors[count % 2];
    count++;
    if (count >= 4) { // 2 cycles = 4 changes
      clearInterval(interval);
    }
  }, 300); // change every 300ms
}

function flashBlueBlackTwice() {
  const body = document.body;
  let count = 0;
  const colors = ["blue", "black"];
  const interval = setInterval(() => {
    body.style.backgroundColor = colors[count % 2];
    count++;
    if (count >= 4) {
      clearInterval(interval);
    }
  }, 300);
}

// --- Added helpers and effects ---
function hexToRgb(h) {
  const r = parseInt(h.slice(1,3), 16), g = parseInt(h.slice(3,5), 16), b = parseInt(h.slice(5,7), 16);
  return { r, g, b };
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v=>{
    const s = Math.max(0, Math.min(255, v|0)).toString(16).padStart(2,'0');
    return s;
  }).join('');
}
function mix(hex1, hex2, t){
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  const r = a.r + (b.r - a.r) * t;
  const g = a.g + (b.g - a.g) * t;
  const bch = a.b + (b.b - a.b) * t;
  return rgbToHex(r,g,bch);
}

// Smooth pulse: bright ↔ dim around the chosen color
function pulse(color, duration = 10000) {
  const start = Date.now();
  const tick = () => {
    const t = (Date.now() - start) / duration;
    if (t >= 1) return;
    // Use sine for breathing: 0→1→0
    const phase = (Math.sin(t * Math.PI * 4) + 1) / 2; // 0..1..0
    const c = mix('#000000', color, 0.3 + 0.7*phase); // avoid going totally dark
    document.body.style.backgroundColor = c;
    socket.emit('hex', c);
    requestAnimationFrame(tick);
  };
  tick();
}

// Pulse toward WHITE and back (color → white → color) with synced cheer sound
function pulseToWhite(color, duration = 10000) {
  const start = performance.now();
  const white = '#FFFFFF';
  function frame(now){
    const t = Math.min(1, (now - start) / duration); // 0..1
    // Smooth 0→1→0 curve
    const w = Math.sin(t * Math.PI * 2); // 0..1..0
    const c = mix(color, white, w);
    document.body.style.backgroundColor = c;
    socket.emit('hex', c);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // stop any cheer audio started with this effect
      audio.pause();
      audio.currentTime = 0;
      socket.emit('pauseAudio');
    }
  }
  requestAnimationFrame(frame);
}

function playCheer(){
  socket.emit('audio', 'crowd cheer');
  getSound(encodeURI('crowd cheer'));
}

function playVibration(){
  const q = 'mobile-phone-vibration';
  socket.emit('audio', q);
  getSound(encodeURI(q));
}

function playEpic(){
    const q = 'epic';
    socket.emit('audio', q);
    getSound(encodeURI(q));
}

function playTwinkle(){
    const q = 'twinkle whoosh';
    socket.emit('audio', q);
    getSound(encodeURI(q));
}

function showLogo(){
  const teamLogoUrl = '/static/gg.png';
  document.body.style.background = `url(${teamLogoUrl}) center/50% no-repeat`; // show logo centered
  // also send a neutral background color so remote clients update
  const c = '#FFFFFF';
  document.body.style.backgroundColor = c;
  socket.emit('hex', c);
}

// Victory wave: quick sequential pulses (single-device fallback = triple pulse)
function victoryWave(color){
  // If this is a single device, emulate a wave by three quick pulses
  const seq = [0, 200, 400];
  seq.forEach((delay) => {
    setTimeout(() => {
      document.body.style.backgroundColor = color;
      socket.emit('hex', color);
      setTimeout(() => {
        const dim = mix('#000000', color, 0.2);
        document.body.style.backgroundColor = dim;
        socket.emit('hex', dim);
      }, 300);
    }, delay);
  });
}

// Arena-wide gradient wave: animate left→right by blending neutral→color per device position
function arenaWave(color, duration = 3000, width = 1.5) {
  const neutral = '#FFFFFF';
  const start = performance.now();
  const lastIndex = Math.max(0, arenaTotal - 1);

  function frame(now) {
    const t = Math.min(1, (now - start) / duration); // 0..1
    const center = t * lastIndex; // Wave center sweeps from index 0 to lastIndex
    const d = Math.abs(arenaPos - center); // Distance from wave center
    const w = Math.max(0, 1 - d / Math.max(0.0001, width)); // Weight based on distance
    const c = mix(color, neutral, w); // Blend from target color to white

    // Update the background color directly
    document.body.style.backgroundColor = c;

    socket.emit('hex', c); // Emit the current color
    if (t < 1) requestAnimationFrame(frame); // Continue animation
  }

  requestAnimationFrame(frame);
}
// --- End added helpers and effects ---