/**
 * A very small raw-WebGL orb. No three.js, no matrices, no textures.
 *
 * One fullscreen quad (2 triangles) and one fragment shader that does all the
 * visual work: value noise -> 3-octave fbm -> swirled sample point -> breathing
 * radius + rim light + pulse ring.
 *
 * State is TWO FLOATS, not shader branches:
 *   u_energy  springs toward a per-state target (calm <-> agitated)
 *   u_pulse   kicked to 1 on answer, decays over ~0.9s (the ring flash)
 * Cross-fading two uniforms gives smooth transitions between the three named
 * states with zero conditionals in GLSL.
 *
 * createOrb() returns null on ANY failure — no getContext, null context, shader
 * compile error, program link error, or a thrown exception. The caller renders a
 * CSS fallback instead. This is decoration; it must never be able to break the
 * chat.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  u_res;
uniform float u_time;
uniform float u_energy;   // 0 = calm, 1 = agitated
uniform float u_pulse;    // 1 -> 0 decay after an answer
uniform vec3  u_core;     // centre colour
uniform vec3  u_rim;      // rim / accent colour

// --- value noise -----------------------------------------------------------
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);       // smoothstep interpolation
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Three octaves is enough structure at 128px; more is invisible and costs fill.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Centred, aspect-correct coords in roughly [-1, 1].
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / min(u_res.x, u_res.y);
  float r = length(uv);
  float ang = atan(uv.y, uv.x);

  float t = u_time;

  // Swirl the sample point; faster and tighter as energy rises.
  float swirl = t * (0.18 + 0.85 * u_energy);
  vec2 sp = vec2(cos(ang + swirl), sin(ang + swirl)) * r * (1.6 + 0.9 * u_energy);
  float n = fbm(sp + vec2(t * 0.25, -t * 0.17));

  // Breathing radius: slow when calm, quicker and shallower when agitated.
  float breathe = 0.030 * sin(t * (1.1 + 2.2 * u_energy));
  float radius = 0.62 + breathe + 0.055 * (n - 0.5) * (0.35 + u_energy);

  // Body and rim. smoothstep widths scale with resolution-independent units.
  float body = smoothstep(radius, radius - 0.30, r);
  float rim  = smoothstep(radius + 0.02, radius - 0.10, r) - smoothstep(radius - 0.10, radius - 0.34, r);

  // Pulse: an outward-travelling ring, brightest right after the kick.
  float ringR = mix(0.20, 1.05, 1.0 - u_pulse);
  float ring  = exp(-pow((r - ringR) * 7.5, 2.0)) * u_pulse;

  // Turbulence brightens the interior as energy rises (the "thinking" look).
  float turb = (0.35 + 0.65 * u_energy) * (n - 0.45);

  vec3 col = u_core * (body * (0.55 + 0.55 * turb));
  col += u_rim * rim * (0.55 + 0.45 * u_energy);
  col += u_rim * ring * 0.85;

  // Alpha follows the visible shape so the canvas composites over any bg.
  float alpha = clamp(body * 0.92 + rim * 0.95 + ring * 0.8, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

/** Per-state energy targets. */
const ENERGY = { idle: 0.15, thinking: 0.85, answering: 0.4 };

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[orb] shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ core?: number[], rim?: number[], reducedMotion?: boolean }} [opts]
 * @returns {null | {
 *   setState(s: 'idle'|'thinking'|'answering'): void,
 *   pulse(): void,
 *   setColors(core:number[], rim:number[]): void,
 *   setReducedMotion(v:boolean): void,
 *   setPaused(v:boolean): void,
 *   resize(): void,
 *   destroy(): void,
 * }}
 */
export function createOrb(canvas, opts = {}) {
  try {
    if (!canvas || typeof canvas.getContext !== "function") return null;

    const gl =
      canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false }) ||
      canvas.getContext("experimental-webgl", { alpha: true, antialias: false });
    if (!gl) return null;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[orb] program link failed:", gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    // Fullscreen quad.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      energy: gl.getUniformLocation(prog, "u_energy"),
      pulse: gl.getUniformLocation(prog, "u_pulse"),
      core: gl.getUniformLocation(prog, "u_core"),
      rim: gl.getUniformLocation(prog, "u_rim"),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let core = opts.core ?? [0.78, 0.66, 0.32];
    let rim = opts.rim ?? [0.85, 0.72, 0.36];
    let energy = ENERGY.idle;
    let target = ENERGY.idle;
    let pulse = 0;
    let reduced = !!opts.reducedMotion;
    let paused = false;
    let raf = 0;
    let dead = false;
    let last = 0;
    let clock = 0;

    function resize() {
      // Cap DPR at 2: past that the orb is fill-rate for no visible gain.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // A hidden or not-yet-laid-out canvas measures 0, which would lock in a
      // 1x1 drawing buffer that never recovers. Fall back to the CSS default
      // size and let the next resize() correct it.
      const cw = canvas.clientWidth || opts.fallbackSize || 128;
      const ch = canvas.clientHeight || opts.fallbackSize || 128;
      const w = Math.max(1, Math.round(cw * dpr));
      const h = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, clock);
      gl.uniform1f(U.energy, energy);
      gl.uniform1f(U.pulse, pulse);
      gl.uniform3fv(U.core, core);
      gl.uniform3fv(U.rim, rim);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function frame(now) {
      if (dead) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      clock += dt;

      // Spring energy toward the target; decay the pulse.
      energy += (target - energy) * Math.min(1, dt * 4.5);
      if (pulse > 0) pulse = Math.max(0, pulse - dt / 0.9);

      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (dead || raf || paused) return;
      // Reduced motion: draw ONE static frame and never loop. Honouring the
      // preference by animating slower still animates.
      if (reduced) {
        energy = target;
        pulse = 0;
        resize();
        draw();
        return;
      }
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function onLost(e) {
      // Context loss is permanent from our side: tear down and let the caller
      // fall back to CSS rather than render a frozen or black canvas.
      e.preventDefault();
      dead = true;
      stop();
      opts.onContextLost?.();
    }
    canvas.addEventListener("webglcontextlost", onLost, false);

    resize();
    start();

    return {
      setState(s) {
        target = ENERGY[s] ?? ENERGY.idle;
        if (reduced) {
          energy = target;
          resize();
          draw();
        }
      },
      pulse() {
        pulse = 1;
        if (reduced) draw();
      },
      setColors(nextCore, nextRim) {
        if (nextCore) core = nextCore;
        if (nextRim) rim = nextRim;
        if (reduced || paused) draw();
      },
      setReducedMotion(v) {
        reduced = !!v;
        stop();
        start();
      },
      setPaused(v) {
        paused = !!v;
        if (paused) stop();
        else start();
      },
      resize() {
        resize();
        if (reduced || paused) draw();
      },
      destroy() {
        dead = true;
        stop();
        canvas.removeEventListener("webglcontextlost", onLost);
        try {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          /* best effort */
        }
      },
    };
  } catch (err) {
    console.warn("[orb] initialisation failed; using CSS fallback.", err);
    return null;
  }
}

/** "#C8A951" -> [0.78, 0.66, 0.32]. Returns null on anything unparseable. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
