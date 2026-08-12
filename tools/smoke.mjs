/**
 * Headless browser smoke test: routes mount, and the chat widget works.
 *
 * `node --test tools/verify-corpus.mjs` proves the data and the scorer; this
 * proves the app actually runs. A Vue template can reference an undefined
 * property, render nothing, and still build clean — the only thing that catches
 * that is loading the page and reading the console.
 *
 * No browser-automation dependency: this drives the installed Chrome over CDP
 * using the WebSocket and fetch that Node 22 already ships.
 *
 *   npm run smoke                            # builds, serves, tests
 *   node tools/smoke.mjs http://host:port    # against an already-running server
 *
 * Exit codes: 0 all clean, 1 a check failed, 2 the harness couldn't start
 * (Chrome missing, server never came up) — a distinct code so CI can tell
 * "the app is broken" from "the test rig is broken".
 */
import { spawn } from "node:child_process";
import { once } from "node:events";

const PREVIEW_PORT = 8774;
const BASE = (process.argv[2] || `http://localhost:${PREVIEW_PORT}`).replace(/\/$/, "");
const SERVE = !process.argv[2]; // no URL given -> start our own preview server
const CHROME = process.env.CHROME_PATH || "google-chrome";

/** Route, plus a string that must appear in the rendered DOM. */
const ROUTES = [
  ["", "quick-reference desk"],
  ["#/quick-links", "Quick Links"],
  ["#/knowledge", "Knowledge"],
  ["#/knowledge/reservist-checklist", "Readiness"],
  ["#/knowledge/eval-fitrep?a=rules", "FITREP"],
  ["#/knowledge/ranks", "Rank"],
  ["#/knowledge/combatant-commands", "Combatant"],
  ["#/knowledge/navy-fleets", "Fleet"],
  ["#/knowledge/joint-codes", "Joint"],
  ["#/knowledge/phonetic-alphabet", "Phonetic"],
  ["#/knowledge/awards", "Precedence"],
  ["#/knowledge/directives", "BUPERSINST"],
  // Reachable even though /quick-links is the front door for it: the assistant
  // cites `quicklinks#personnel`, and its "Open in Knowledge" deep-link goes
  // here. The coverage guard below is what surfaced that this route existed and
  // had never once been loaded.
  ["#/knowledge/quicklinks?a=personnel", "Navy System Quick Links"],
  ["#/tools/checklist", "Readiness Checklist"],
  ["#/tools/due", "Due Dates & Calendar"],
  ["#/tools/eval", "EVAL / FITREP Due Date"],
  ["#/tools/points", "Good Years"],
  ["#/tools/phonetic", "Phonetic Speller"],
  ["#/tools/ranks", "Rank Explorer"],
  ["#/tools/ribbons", "Ribbon Rack Calculator"],
  ["#/about", "About SALTDOG"],
  ["#/knowledge/does-not-exist", "Knowledge"], // bad topic id -> index, not blank
  ["#/nonsense", "quick-reference desk"], // catch-all
];

/**
 * Assert the list above covers every registered tool and topic.
 *
 * The expectation strings are hand-written on purpose — "does the DOM actually
 * contain BUPERSINST" is a real check and a derived one could only assert that a
 * page rendered its own title. But a hand-written list silently stops covering
 * new work, and it did: the Due Dates tool and the Directives topic both shipped
 * and neither was smoked, while the run still reported 40/40 clean. So the LIST
 * stays hand-written and its COMPLETENESS is derived.
 */
async function coverageGaps() {
  const { TOOLS } = await import("../src/data/tools.js");
  const { ALL_TOPICS } = await import("../src/data/index.js");
  const routes = ROUTES.map(([r]) => r);
  const gaps = [];
  for (const t of TOOLS) {
    if (!routes.some((r) => r.startsWith(`#/tools/${t.id}`))) gaps.push(`#/tools/${t.id}`);
  }
  for (const t of ALL_TOPICS) {
    if (!routes.some((r) => r.startsWith(`#/knowledge/${t.id}`))) gaps.push(`#/knowledge/${t.id}`);
  }
  return gaps;
}

/* ------------------------------------------------------------------ servers */

/** Wait until `url` answers, or give up. Returns true on success. */
async function waitForServer(url, ms = 20000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return false;
}

async function startPreview() {
  const proc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "preview", "--port", String(PREVIEW_PORT), "--strictPort"],
    { stdio: "ignore" },
  );
  proc.on("error", (err) => {
    console.error(`Could not start vite preview: ${err.message}`);
    process.exit(2);
  });
  if (!(await waitForServer(BASE))) {
    proc.kill();
    console.error(`vite preview never answered on ${BASE}. Did you run npm run build?`);
    process.exit(2);
  }
  return proc;
}

/* ---------------------------------------------------------------- CDP glue */

let browser = null;

async function launch() {
  const port = 9333 + Math.floor(process.pid % 500);
  const proc = spawn(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    "about:blank",
  ]);
  proc.on("error", (err) => {
    console.error(`Could not launch ${CHROME}: ${err.message}`);
    process.exit(2);
  });

  // Poll for the debugger endpoint rather than sleeping a fixed interval.
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const wsUrl = (await res.json()).webSocketDebuggerUrl;
      if (wsUrl) return { proc, wsUrl };
    } catch {
      /* not up yet */
    }
  }
  proc.kill();
  console.error("Chrome DevTools endpoint never came up.");
  process.exit(2);
}

/**
 * Open one page, run `body(page)`, close it. `page.problems` accumulates every
 * console error/warning and uncaught exception seen while it was open — Vue's
 * "property was accessed during render but is not defined" arrives as a warning,
 * so warnings are failures here, not noise.
 *
 * `opts.watchNetwork` additionally enables the Network domain, blocks every URL
 * off this origin, and records attempted requests in `page.requests`. Opt-in
 * rather than always-on: it exists for the /go redirector, whose whole job is to
 * navigate somewhere this test suite must never actually reach, and enabling it
 * everywhere would change what the other checks are allowed to load.
 */
async function withPage(url, body, opts = {}) {
  const ws = new WebSocket(browser.wsUrl);
  await once(ws, "open");

  const problems = [];
  const requests = [];
  const pending = new Map();
  let msgId = 0;

  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) {
      problems.push(
        `console.${m.params.type}: ${m.params.args
          .map((a) => a.value ?? a.description ?? a.type)
          .join(" ")
          .slice(0, 300)}`,
      );
    }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      problems.push(`exception: ${(d.exception?.description || d.text).slice(0, 300)}`);
    }
    // Every request the page ASKS for, whether or not it was allowed to happen.
    // Recorded from requestWillBeSent so a blocked navigation still proves intent.
    if (m.method === "Network.requestWillBeSent") {
      requests.push({ url: m.params.request.url, type: m.params.type });
    }
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });

  const raw = (method, params, sessionId) =>
    new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { result: target } = await raw("Target.createTarget", { url: "about:blank" });
  const attached = await raw("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  const sid = attached.result.sessionId;

  await raw("Runtime.enable", {}, sid);
  await raw("Page.enable", {}, sid);

  if (opts.watchNetwork) {
    await raw("Network.enable", {}, sid);
    // Zero egress. The assertion is made on `requestWillBeSent`, which fires
    // when the page ASKS to navigate — before and independently of whether the
    // host answers. So the check proves intent without a packet leaving, which
    // is what lets it pass on a build machine with no network and mean the same
    // thing there as it does here. Testing a redirect by letting it reach a
    // CAC-gated `.mil` host would be both slow and a check that fails when the
    // internet does, which teaches people to ignore it.
    //
    // Scoped to `.mil` rather than everything off-origin: the localhost preview
    // server has to keep working, and a broad `https://*/*` would block the page
    // under test from loading at all.
    await raw("Network.setBlockedURLs", { urls: ["*://*.mil/*", "*://*.mil"] }, sid);
  }

  await raw("Page.navigate", { url }, sid);

  /** Evaluate an expression in the page and return its value. */
  const evaluate = async (expression) => {
    const res = await raw(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sid,
    );
    const details = res.result?.exceptionDetails;
    if (details) {
      problems.push(`eval threw: ${(details.exception?.description || details.text).slice(0, 300)}`);
      return undefined;
    }
    return res.result?.result?.value;
  };

  /** Poll an expression until it's truthy. Returns false on timeout. */
  const waitFor = async (expression, ms = 6000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const page = { evaluate, waitFor, problems, requests, fail: (msg) => problems.push(msg) };

  try {
    await body(page);
  } catch (err) {
    problems.push(`test error: ${err.message}`);
  }

  await raw("Target.closeTarget", { targetId: target.targetId });
  ws.close();
  return problems;
}

/* ------------------------------------------------------------------- cases */

const results = [];
const record = (label, problems) => {
  results.push([label, problems]);
  if (problems.length) {
    console.log(`FAIL  ${label}`);
    for (const p of problems) console.log(`        ${p}`);
  } else {
    console.log(`ok    ${label}`);
  }
};

/** Every route mounts the shell and renders its own content. */
async function checkRoutes() {
  const gaps = await coverageGaps();
  record("route coverage", gaps.map((g) => `${g} is registered but never smoked`));

  for (const [route, expect] of ROUTES) {
    const problems = await withPage(`${BASE}/${route}`, async (page) => {
      const found = await page.waitFor(
        `document.body.innerText.includes(${JSON.stringify(expect)})`,
      );
      if (!found) page.fail(`missing expected text: "${expect}"`);
      if (!(await page.evaluate('!!document.getElementById("main")'))) {
        page.fail("app shell did not render (#main absent)");
      }
    });
    record(route || "/", problems);
  }
}
/**
 * The chat widget end to end: open, ask a question with a known answer, get a
 * cited card, follow the citation, land on the right section.
 */
async function checkChat() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');
    await page.evaluate('document.querySelector(".salt-fab").click()');

    if (!(await page.waitFor('!!document.querySelector(\'[role="dialog"]\')'))) {
      page.fail("chat panel did not open");
      return;
    }

    // Disclosure is a hard requirement, not decoration — assert it's on screen.
    const disclosed = await page.evaluate(
      `document.querySelector('[role="dialog"]').innerText.includes("Not an AI")`,
    );
    if (!disclosed) page.fail('panel is missing the "Not an AI" disclosure');

    // Focus should be in the input on open.
    const focused = await page.evaluate('document.activeElement?.tagName === "INPUT"');
    if (!focused) page.fail("opening the panel did not focus the input");

    // Type a golden question and submit through the real form.
    const typed = await page.evaluate(`(() => {
      const el = document.querySelector('[role="dialog"] input');
      if (!el) return false;
      el.value = 'how many points do I need for a good year';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (!typed) {
      page.fail("could not find the chat input");
      return;
    }
    await page.evaluate(
      `document.querySelector('[role="dialog"] form').dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}))`,
    );

    // Match on the question text, not the "You asked" eyebrow: that label is
    // uppercased by CSS and innerText reports the transformed text.
    const answered = await page.waitFor(
      `/open in knowledge|MNCC/i.test(document.querySelector('[role="log"]').innerText)`,
      8000,
    );
    if (!answered) {
      page.fail("no answer appeared in the transcript");
      return;
    }

    // A real answer cites a card and offers the deep link. If retrieval fell
    // through to the unknown branch, that's a scorer regression the golden
    // question tests should have caught — surface it here too.
    const log = await page.evaluate(`document.querySelector('[role="log"]').innerText`);
    if (/couldn't find|don't have|not sure/i.test(log || "")) {
      page.fail(`golden question returned the unknown fallback: ${log?.slice(0, 160)}`);
    }

    // Follow the citation and confirm we land on the cited section, focused.
    const clicked = await page.evaluate(`(() => {
      const btns = [...document.querySelectorAll('[role="log"] a, [role="log"] button')];
      const target = btns.find(b => /open in knowledge|open the card|view/i.test(b.innerText));
      if (!target) return false;
      target.click();
      return true;
    })()`);
    if (!clicked) {
      page.fail("answer card had no citation link to follow");
      return;
    }

    const landed = await page.waitFor(`location.hash.includes("/knowledge/")`, 6000);
    if (!landed) page.fail("citation did not navigate to a knowledge route");

    const anchor = await page.evaluate("location.hash");
    if (anchor && !anchor.includes("a=")) {
      page.fail(`citation lost its section anchor: ${anchor}`);
    }

    const onSection = await page.waitFor(
      `document.activeElement?.classList?.contains("salt-section")`,
      3000,
    );
    if (!onSection) page.fail("focus did not move to the cited section");

    // The panel must close when navigating, or it covers the destination.
    if (await page.evaluate('!!document.querySelector(\'[role="dialog"]\')')) {
      page.fail("chat panel stayed open after following a citation");
    }
  });
  record("chat: ask → cite → deep-link → focus", problems);
}

/** The orb must render something in every capability/preference cell. */
async function checkOrb() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');
    await page.evaluate('document.querySelector(".salt-fab").click()');
    await page.waitFor('!!document.querySelector(\'[role="dialog"]\')');

    // Headless Chrome with --disable-gpu still gives WebGL via SwiftShader, so
    // this exercises the real WebGL path; the fallback path is asserted by
    // createOrb() returning null, which we can't force from here.
    //
    // "a canvas exists" is not enough — a canvas hidden at init measures 0 and
    // gets a 1x1 drawing buffer that paints nothing while still being present,
    // aria-hidden, and non-zero-dimensioned. So: read actual pixels.
    const state = await page.evaluate(`(() => {
      const canvas = document.querySelector('[role="dialog"] canvas');
      const fallback = document.querySelector('[role="dialog"] .salt-orb-css');
      const out = {
        hasCanvas: !!canvas,
        hasFallback: !!fallback,
        canvasHidden: canvas ? canvas.getAttribute('aria-hidden') : null,
        srText: document.querySelector('[role="dialog"] .sr-only')?.innerText || '',
        buffer: canvas ? [canvas.width, canvas.height] : null,
        css: canvas ? [Math.round(canvas.getBoundingClientRect().width),
                       Math.round(canvas.getBoundingClientRect().height)] : null,
        litPixels: 0,
      };
      return out;
    })()`);

    // Pixel readback has to happen inside a rAF callback, via readPixels on the
    // live context. drawImage()/toDataURL() see an empty buffer: without
    // preserveDrawingBuffer the drawing buffer is cleared once composited, which
    // is the correct default and NOT an orb bug.
    state.litPixels = await page.evaluate(`new Promise(resolve => {
      const c = document.querySelector('[role="dialog"] canvas');
      const gl = c && c.getContext('webgl');
      if (!gl) return resolve(-1);
      requestAnimationFrame(() => {
        const px = new Uint8Array(c.width * c.height * 4);
        gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let lit = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 8) lit++;
        resolve(lit);
      });
    })`);

    if (!state?.hasCanvas && !state?.hasFallback) {
      page.fail("orb rendered neither a canvas nor the CSS fallback");
    }
    if (state?.hasCanvas) {
      if (state.canvasHidden !== "true") page.fail("orb canvas is not aria-hidden");

      // The drawing buffer must track the CSS box, or the orb is a blurry or
      // pinhole render regardless of what the shader does.
      const [bw, bh] = state.buffer || [0, 0];
      const [cw, ch] = state.css || [0, 0];
      if (cw < 8 || ch < 8) page.fail(`orb has no layout box (${cw}x${ch} CSS px)`);
      if (bw < cw || bh < ch) {
        page.fail(`orb drawing buffer ${bw}x${bh} is smaller than its ${cw}x${ch} CSS box`);
      }

      // A shader that compiles but renders nothing is the failure mode a
      // dimensions check can't see. The orb fills roughly a third of its square
      // box, so 5% is a floor, not a target.
      if (state.litPixels < 0) {
        page.fail("orb canvas has no WebGL context but the fallback did not render");
      } else {
        const lit = state.litPixels / Math.max(1, bw * bh);
        if (lit < 0.05) {
          page.fail(`orb painted almost nothing (${(lit * 100).toFixed(1)}% of pixels lit)`);
        }
      }
    }
    if (!state?.srText?.trim()) {
      page.fail("orb state is not exposed as screen-reader text");
    }
  });
  record("orb: renders, paints, and is hidden from AT", problems);
}

/** Every icon-only button must actually render a glyph and carry a label. */
async function checkIconButtons() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');
    await page.evaluate('document.querySelector(".salt-fab").click()');
    await page.waitFor('!!document.querySelector(\'[role="dialog"]\')');

    // A bare `icon` attribute alongside `:icon="path"` makes Vuetify render an
    // icon-shaped button with no glyph inside — visually an empty coloured
    // square, and nothing in the build or the DOM structure objects.
    const bad = await page.evaluate(`(() => {
      const out = [];
      for (const b of document.querySelectorAll('button.v-btn--icon')) {
        const hasGlyph = !!b.querySelector('svg path, i.v-icon');
        const label = (b.getAttribute('aria-label') || b.innerText || '').trim();
        if (!hasGlyph || !label) {
          out.push((b.className.split(' ').find(c => c.startsWith('salt-')) || b.className.slice(0, 40))
            + (hasGlyph ? '' : ' [no glyph]') + (label ? '' : ' [no accessible name]'));
        }
      }
      return out;
    })()`);

    for (const b of bad || []) page.fail(`icon button: ${b}`);
  });
  record("icon buttons: render a glyph and have a name", problems);
}

/**
 * The icons must actually be there.
 *
 * A broken favicon is the definition of a silent defect: the tab shows a generic
 * page glyph, nothing logs to the console, no build step complains, and the
 * "before" and "after" states look identical to anyone not watching the network
 * panel. This site is served from a GitHub Pages SUBPATH, so an href that misses
 * the base 404s in production while working perfectly on localhost, where the app
 * happens to sit at the root.
 *
 * The hrefs are read out of the live DOM and fetched through the browser's own URL
 * resolution rather than string-compared against a list here, so the base is
 * actually exercised. One honest limit on the `startsWith("/")` branch: Vite
 * rewrites root-absolute hrefs in index.html to "./" at build time, so that case
 * is unreachable from the HTML and the branch survives being mutated in. It is
 * kept for hrefs injected at runtime, which Vite never sees. The branch with real
 * teeth is the fully-qualified "https://…" one, which Vite passes through
 * untouched — mutated in, it fails on both the relativity and the fetch.
 */
async function checkFavicon() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');

    const icons = await page.evaluate(`(() => {
      const out = [];
      for (const l of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
        // .href is the RESOLVED absolute URL; .getAttribute is what was authored.
        out.push({ rel: l.getAttribute('rel'), raw: l.getAttribute('href'), url: l.href });
      }
      return out;
    })()`);

    if (!icons || icons.length < 2) {
      page.fail(`expected an svg icon, an ico, and a touch icon; found ${icons?.length ?? 0}`);
      return;
    }

    for (const icon of icons) {
      if (/^(https?:)?\/\//.test(icon.raw) || icon.raw.startsWith("/")) {
        page.fail(`${icon.rel} href "${icon.raw}" is not relative — it will 404 under a subpath`);
      }
      const probe = await page.evaluate(
        `fetch(${JSON.stringify(icon.url)}).then(async r =>
           r.status + ':' + (r.headers.get('content-type') || '?') + ':' + (await r.blob()).size)
         .catch(e => 'threw:' + e.message)`,
      );
      const [status, type, size] = String(probe).split(":");
      if (status !== "200") {
        page.fail(`${icon.rel} ${icon.raw} returned ${probe}`);
        continue;
      }
      if (!/^image\//.test(type)) {
        page.fail(`${icon.rel} ${icon.raw} served as "${type}", not an image type`);
      }
      // A zero-length or near-empty file still returns 200. The ICO holds three
      // frames and the touch icon is 180px, so both are comfortably over 1 KiB.
      if (Number(size) < 500) {
        page.fail(`${icon.rel} ${icon.raw} is only ${size} bytes — truncated or a placeholder`);
      }
    }

    // Bare /favicon.ico, which link unfurlers and feed readers request without
    // reading the HTML at all. Served from the app root, so it is unaffected by
    // the subpath issue above and is a genuinely separate guarantee.
    const bare = await page.evaluate(
      `fetch('./favicon.ico').then(r => r.status + ':' + (r.headers.get('content-type') || '?'))
       .catch(e => 'threw:' + e.message)`,
    );
    if (!String(bare).startsWith("200:image/")) {
      page.fail(`an unadorned request for favicon.ico returned ${bare}`);
    }

    /**
     * theme-color: exactly one tag, and its content tracks the REAL app bar
     * colour rather than a literal that can drift from the palette.
     *
     * MEASURED ACROSS A TOGGLE, to make the result independent of the host's
     * colour preference. Deleting the `watchEffect` in useAppTheme.js was caught
     * on load here, but only incidentally: index.html ships the DARK surface as
     * its static default, this headless Chrome reports no dark preference, so
     * `initialTheme()` picked light and the mismatch was visible immediately. On
     * a machine that prefers dark, the static default and the initial theme
     * agree and a load-only comparison would have nothing to say. The toggle is
     * what makes the sync load-bearing in either environment.
     */
    const readMeta = () =>
      page.evaluate(`(() => {
        const tags = [...document.querySelectorAll('meta[name="theme-color"]')];
        const bar = document.querySelector('.v-app-bar');
        return JSON.stringify({
          count: tags.length,
          media: tags.map(t => t.getAttribute('media')),
          content: tags.map(t => t.getAttribute('content')),
          bar: bar ? getComputedStyle(bar).backgroundColor : null,
        });
      })()`);

    // The meta is authored as hex; computed style comes back as rgb().
    const asRgb = (v) => {
      const hex = (v || "").replace("#", "").toLowerCase();
      if (!/^[0-9a-f]{6}$/.test(hex)) return null;
      return `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
    };

    const compare = (m, when) => {
      const rgb = asRgb(m.content[0]);
      if (!rgb) {
        page.fail(`${when}: theme-color content "${m.content[0]}" is not a 6-digit hex colour`);
      } else if (m.bar && m.bar !== rgb) {
        page.fail(`${when}: theme-color is ${m.content[0]} (${rgb}) but the app bar renders ${m.bar}`);
      }
    };

    const before = JSON.parse(await readMeta());
    if (before.count !== 1) {
      page.fail(`expected exactly 1 theme-color tag, found ${before.count} — the browser uses the first that applies`);
    }
    if (before.media.some(Boolean)) {
      page.fail(`theme-color carries a media attribute (${before.media}); the persisted theme choice beats the OS preference`);
    }
    compare(before, "on load");

    const toggled = await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('.v-app-bar button')]
        .find(b => /theme/i.test(b.getAttribute('aria-label') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (!toggled) {
      page.fail("no theme toggle button found, so the theme-color sync could not be exercised");
      return;
    }

    await page.waitFor(
      `getComputedStyle(document.querySelector('.v-app-bar')).backgroundColor !== ${JSON.stringify(before.bar)}`,
      3000,
    );
    const after = JSON.parse(await readMeta());
    if (after.bar === before.bar) {
      page.fail("the app bar colour did not change, so this proves nothing about the sync");
    }
    compare(after, "after toggling the theme");
  });
  record("favicon: icons resolve under a subpath, theme-color matches the app bar", problems);
}

/**
 * The search engine must not be in the first-paint graph.
 *
 * This is easy to lose silently: AppShell mounts ChatWidget on every page, so a
 * single static `import { ask } from lib/retrieval` anywhere in the chat's
 * dependency chain pulls the scorer, corpus builder, and alias table into the
 * entry chunk. Lazily building the corpus then saves nothing, and no test that
 * looks at behaviour would notice — the chat still works perfectly. Only the
 * network waterfall shows it.
 */
async function checkLazySearch() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');

    const fetched = () =>
      page.evaluate(
        `performance.getEntriesByType('resource').some(r => /\\/search-/.test(r.name))`,
      );

    if (await fetched()) {
      page.fail("the search chunk is fetched on first paint; it should load when the widget opens");
    }

    await page.evaluate('document.querySelector(".salt-fab").click()');
    await page.waitFor('!!document.querySelector(\'[role="dialog"]\')');
    // Chips arrive with the chunk, so waiting on them waits on the fetch.
    await page.waitFor(`document.querySelectorAll('[role="dialog"] .v-chip').length > 0`);

    if (!(await fetched())) {
      page.fail("opening the widget did not fetch the search chunk");
    }
    // Starters are async now; the panel must never render empty and chipless.
    const intro = await page.evaluate(
      `/Ask about drill/.test(document.querySelector('[role="dialog"]').innerText)`,
    );
    if (!intro) page.fail("the panel has no intro text while the engine loads");
  });
  record("search engine: deferred until the widget opens", problems);
}

/**
 * A progress bar at 0% must not LOOK full.
 *
 * Vuetify paints the unfilled track in currentColor at `--v-border-opacity`,
 * and both themes raise that variable to ~1 for crisp table rules — so an empty
 * bar rendered as a solid filled bar, and "0 of 20 good years" read as done.
 * Nothing in the DOM was wrong; only the pixels were.
 */
async function checkProgressBars() {
  for (const [route, label] of [
    ["#/tools/points", "points"],
    ["#/tools/checklist", "checklist"],
  ]) {
    const problems = await withPage(`${BASE}/${route}`, async (page) => {
      // Start from a clean slate so the bars really are at zero.
      await page.evaluate('localStorage.clear(); location.reload()');
      await page.waitFor('!!document.querySelector(".v-progress-linear[aria-valuenow]")', 8000);

      const bars = await page.evaluate(`(() => {
        return [...document.querySelectorAll('.v-progress-linear[aria-valuenow]')].map(p => {
          const track = p.querySelector('.v-progress-linear__background');
          return {
            value: Number(p.getAttribute('aria-valuenow')),
            name: p.getAttribute('aria-label') || '',
            // Decorative bars duplicating adjacent text are legitimately
            // aria-hidden and exempt from the naming rule — but still visible,
            // so the track check applies to them.
            hidden: p.getAttribute('aria-hidden') === 'true',
            trackOpacity: track ? Number(getComputedStyle(track).opacity) : null,
          };
        });
      })()`);

      if (!bars?.length) {
        page.fail("no determinate progress bar found");
        return;
      }
      for (const b of bars) {
        if (b.value === 0 && b.trackOpacity !== null && b.trackOpacity > 0.5) {
          page.fail(
            `"${b.name || "(decorative)"}" is at 0% but its track paints at opacity ${b.trackOpacity} — reads as full`,
          );
        }
        if (!b.hidden && !b.name.trim()) {
          page.fail("a progress bar is exposed to AT with no accessible name");
        }
      }
    });
    record(`progress bars: ${label} at zero reads as empty`, problems);
  }
}

/**
 * The rack renders real ribbon artwork, in precedence order, short row on top.
 *
 * Three things here can only be checked in a browser. The sprite is a background
 * image, so a wrong path or a missing file yields an element that is present,
 * sized, and completely blank — the DOM looks right and the rack is invisible.
 * The row split is computed from the selection, so a top-down layout regression
 * still produces the correct number of ribbons in the correct number of rows,
 * just with the junior awards in the short row. And selecting out of precedence
 * order must still sort: the picker offers awards grouped by category, so the
 * click order is routinely not the wear order.
 */
async function checkRibbonRack() {
  const problems = await withPage(`${BASE}/#/tools/ribbons`, async (page) => {
    await page.evaluate("localStorage.clear(); location.reload()");
    await page.waitFor('!!document.querySelector(\'input[type="checkbox"]\')', 8000);

    // Four awards, chosen LAST-first so a missing sort is visible: the Kuwait
    // ribbon is #66 and the Medal of Honor is #1.
    const picked = await page.evaluate(`(() => {
      const want = ['Kuwait Liberation Medal (Kuwait)', 'National Defense Service Medal',
                    'Medal of Honor', 'Good Conduct Medal'];
      const labels = [...document.querySelectorAll('.v-selection-control')];
      let n = 0;
      for (const title of want) {
        const row = labels.find(l => l.textContent.trim() === title);
        if (row) { row.querySelector('input').click(); n++; }
      }
      return n;
    })()`);
    if (picked !== 4) {
      page.fail(`could not select 4 known awards by label (selected ${picked})`);
      return;
    }

    await page.waitFor(`document.querySelectorAll('.salt-rack-row').length === 2`, 4000);

    const rack = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.salt-rack-row')];
      return rows.map(r => [...r.querySelectorAll('.salt-ribbon')].map(el => {
        const cs = getComputedStyle(el);
        return {
          title: el.getAttribute('title'),
          image: cs.backgroundImage,
          offset: cs.backgroundPositionY,
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
        };
      }));
    })()`);

    const flat = rack.flat();
    if (rack.map((r) => r.length).join("/") !== "1/3") {
      page.fail(
        `4 ribbons laid out as ${rack.map((r) => r.length).join("/")}; a rack is built bottom-up, so it must be 1/3 with the senior award alone on top`,
      );
    }
    if (rack[0]?.[0]?.title !== "Medal of Honor") {
      page.fail(`top-left ribbon is "${rack[0]?.[0]?.title}", expected the most senior award`);
    }
    if (flat.at(-1)?.title !== "Kuwait Liberation Medal (Kuwait)") {
      page.fail(`bottom-right ribbon is "${flat.at(-1)?.title}", expected the most junior award`);
    }

    // Every tile must actually resolve to the sprite, at a distinct offset.
    for (const r of flat) {
      if (!/ribbons\.png/.test(r.image)) {
        page.fail(`"${r.title}" has no ribbon artwork (background-image: ${r.image})`);
      }
      if (r.w < 20 || r.h < 8) {
        page.fail(`"${r.title}" rendered ${r.w}x${r.h}; the sprite tile has no box to paint into`);
      }
    }
    if (new Set(flat.map((r) => r.offset)).size !== flat.length) {
      page.fail(
        `sprite offsets repeat (${flat.map((r) => r.offset).join(", ")}) — different awards are showing the same ribbon`,
      );
    }

    // The sprite is a background image, so a 404 does not fail the page. Fetch it.
    const sprite = await page.evaluate(
      `fetch('./img/ribbons.png').then(r => r.ok + ':' + r.headers.get('content-type'))`,
    );
    if (!/^true:image/.test(String(sprite))) {
      page.fail(`the sprite sheet did not load (${sprite})`);
    }
  });
  record("ribbon rack: real artwork, precedence order, short row on top", problems);
}

/**
 * Rank insignia render as distinct artwork, on the right rank.
 *
 * The data-level tests prove the indices are a dense sequence and the sheet is
 * the right size, which is everything provable without a browser. What they
 * cannot see is the failure this checks for: a background sprite that resolves to
 * nothing. A 404 on a CSS `background-image` does not fail the page, does not log,
 * and leaves a correctly-sized empty box — so a wrong path or a sheet that never
 * shipped looks identical to "this rank has no insignia".
 *
 * Distinctness is the second half: if every rank computed the same offset the page
 * would show 25 identical chevrons, which reads as a rendering quirk rather than a
 * bug. Scale is the third, and it needs its own assertion — distinct offsets are
 * only *meaningful* if the sheet is scaled so one tile equals one element box.
 * `background-size: cover` keeps all 126 offsets distinct while cropping every
 * tile to the same visual region, so the offsets alone do not prove correctness.
 *
 * All three are read COMPUTED rather than from the style attribute, so a
 * stylesheet that overrides any of them still fails.
 */
async function checkRankInsignia() {
  // Imported rather than typed: this is the number the sheet was cut with, and
  // hardcoding it here would let the check pass a sheet it no longer describes.
  const { SPRITE_COLS: SHEET_COLS } = await import("../src/data/ranks.js");
  const problems = await withPage(`${BASE}/#/tools/ranks`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-insignia")', 8000);

    const cells = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('table tbody tr')];
      return rows.map(tr => {
        const el = tr.querySelector('.salt-insignia');
        const cs = el && getComputedStyle(el);
        const box = el && el.getBoundingClientRect();
        return {
          grade: tr.querySelector('td')?.textContent.trim(),
          has: !!el,
          image: cs?.backgroundImage ?? '',
          pos: cs?.backgroundPosition ?? '',
          size: cs?.backgroundSize ?? '',
          w: box ? Math.round(box.width) : 0,
          h: box ? Math.round(box.height) : 0,
        };
      }).filter(r => r.grade);
    })()`);

    const drawn = cells.filter((c) => c.has);
    if (drawn.length < 20) {
      page.fail(`only ${drawn.length} of ${cells.length} rank rows rendered an insignia sprite`);
      return;
    }

    for (const c of drawn) {
      if (!/ranks\.png/.test(c.image)) {
        page.fail(`${c.grade}: no insignia artwork (background-image: ${c.image})`);
        break;
      }
      if (c.w < 24 || c.h < 24) {
        page.fail(`${c.grade}: sprite box is ${c.w}x${c.h}, too small to show a tile`);
        break;
      }
    }

    // Every rank must sit on its own tile. Duplicate offsets mean the sheet is
    // being sampled at one spot for everybody.
    const offsets = drawn.map((c) => c.pos);
    const unique = new Set(offsets).size;
    if (unique !== offsets.length) {
      page.fail(
        `${offsets.length} insignia share only ${unique} distinct sprite offsets — ` +
          "different ranks are showing the same artwork",
      );
    }

    // The sheet must be scaled so one tile is exactly one element box, or the
    // distinct offsets above all land inside the same visible crop. `cover` and
    // `contain` are the two ways to get this wrong and keep the offsets distinct.
    const box = drawn[0];
    // `auto` is optional in the pattern: Chrome normalizes the computed value of
    // `576px auto` to plain `576px`, so requiring the keyword fails on correct CSS.
    if (!/^\d+(\.\d+)?px( auto)?$/.test(box.size)) {
      page.fail(
        `background-size is "${box.size}"; it must be an explicit width with auto ` +
          "height, or one tile does not map to one element box",
      );
    } else if (Math.abs(parseFloat(box.size) - SHEET_COLS * box.w) > 1) {
      page.fail(
        `sheet is scaled to ${parseFloat(box.size)}px across a ${box.w}px box; ` +
          `${SHEET_COLS} tiles per row means it must be ${SHEET_COLS * box.w}px, ` +
          "so every offset is landing between tiles",
      );
    }

    // E-1 is the one paygrade with no insignia in any service; it must show the
    // em-dash placeholder rather than an empty cell that reads as missing data.
    const e1 = cells.find((c) => c.grade === "E-1");
    if (!e1) {
      page.fail("the enlisted table has no E-1 row to check the no-insignia case against");
    } else if (e1.has) {
      page.fail("E-1 rendered an insignia sprite, but no service has E-1 insignia");
    }

    // A background image's 404 is silent, so fetch the sheet directly.
    const sheet = await page.evaluate(
      `fetch('./img/ranks.png').then(r => r.ok + ':' + r.headers.get('content-type'))`,
    );
    if (!/^true:image/.test(String(sheet))) {
      page.fail(`the insignia sheet did not load (${sheet})`);
    }
  });
  record("rank insignia: real artwork, one distinct tile per rank", problems);
}

/**
 * The two maps draw real geometry at a real size.
 *
 * The data tests prove the path strings are well-formed and enclose the right
 * cities. What they cannot see is whether any of it reached the screen. An inline
 * SVG fails quietly in more ways than an <img>: a `d` attribute the browser
 * refuses to parse renders an empty <path> with no console error, a viewBox typo
 * collapses the whole figure to zero height, and `defineAsyncComponent` on a
 * chunk that fails to load leaves the <figure> mounted and empty. All three look
 * identical in the DOM — the element is there, the page is fine, the map is gone.
 * So this measures the rendered bounding box of the geometry itself.
 */
async function checkMaps() {
  const { AOR_ORDER } = await import("../src/data/geo.js");
  const problems = [];

  for (const [route, expect] of [
    ["#/knowledge/combatant-commands", { aors: AOR_ORDER.length, pins: 6, zones: 0 }],
    ["#/knowledge/navy-fleets", { aors: 0, pins: 6, zones: 6 }],
  ]) {
    const found = await withPage(`${BASE}/${route}`, async (page) => {
      // The component is async — waiting for the <svg>, not the <figure>, is
      // what makes this a check of the loaded chunk rather than the placeholder.
      await page.waitFor('!!document.querySelector(".salt-map svg .salt-map-land")', 8000);

      const map = await page.evaluate(`(() => {
        const svg = document.querySelector('.salt-map svg');
        const land = svg.querySelector('.salt-map-land');
        const r = svg.getBoundingClientRect();
        const lb = land.getBBox();
        return {
          label: svg.getAttribute('aria-label') || '',
          role: svg.getAttribute('role') || '',
          w: Math.round(r.width), h: Math.round(r.height),
          land: { x: lb.x, y: lb.y, w: lb.width, h: lb.height },
          // getBBox() is user space, so it is blind to the viewBox — the one
          // attribute that decides how user space lands on the screen. These are
          // the same path measured in CSS pixels, as a fraction of the <svg>.
          fill: (() => {
            const c = land.getBoundingClientRect();
            return { w: c.width / r.width, h: c.height / r.height };
          })(),
          landLen: (land.getAttribute('d') || '').length,
          aors: svg.querySelectorAll('.salt-map-aor').length,
          pins: svg.querySelectorAll('.salt-map-pins circle').length,
          zones: svg.querySelectorAll('.salt-map-zones ellipse').length,
          // Fills are what say "this region is CENTCOM". A path with no fill
          // renders as an outline, which reads as a border on the map.
          filled: [...svg.querySelectorAll('.salt-map-aor')]
            .filter(p => { const f = getComputedStyle(p).fill; return f && f !== 'none'; }).length,
        };
      })()`);

      if (map.role !== "img" || map.label.length < 40) {
        page.fail(
          `the map is role="${map.role}" with a ${map.label.length}-character label; ` +
            "an SVG without both is invisible to a screen reader",
        );
      }
      if (map.w < 400 || map.h < 150) {
        page.fail(`the map rendered ${map.w}x${map.h} — too small to be the world`);
      }

      // getBBox() is the whole point of doing this in a browser: it is the
      // geometry the renderer actually resolved, so it is zero for a `d` the
      // browser rejected even though the attribute string is still right there.
      if (map.land.w < 900 || map.land.h < 400) {
        page.fail(
          `the coastline path has a ${map.land.w.toFixed(0)}x${map.land.h.toFixed(0)} ` +
            `bounding box in a 1000x500 viewBox (d is ${map.landLen} chars) — the ` +
            "browser did not draw the geometry it was given",
        );
      }
      // ...and the viewBox has to map that geometry onto the frame. A viewBox
      // with a wrong height renders a correct 1000x482 bbox and then scales it
      // to three times the height of its own <svg>, so the visible result is an
      // empty rectangle with the world drawn somewhere off-frame. Every
      // user-space measurement above is still perfect. This is the check that
      // fails, and it is why the same path is measured twice.
      if (map.fill.w < 0.9 || map.fill.w > 1.05 || map.fill.h < 0.85 || map.fill.h > 1.05) {
        page.fail(
          `the coastline occupies ${(map.fill.w * 100).toFixed(0)}%x` +
            `${(map.fill.h * 100).toFixed(0)}% of the ${map.w}x${map.h} frame it is ` +
            "drawn in — the viewBox does not match the projected extent",
        );
      }

      // Land must span most of the frame in BOTH axes. A single scale factor
      // applied to one axis, or a lon/lat swap, keeps a plausible-looking box.
      if (map.land.x > 20 || map.land.y > 60) {
        page.fail(
          `the coastline starts at ${map.land.x.toFixed(0)},${map.land.y.toFixed(0)} ` +
            "rather than near the top-left of the viewBox — the projection is offset",
        );
      }

      if (map.aors !== expect.aors) page.fail(`${map.aors} AOR polygons, expected ${expect.aors}`);
      if (map.filled !== expect.aors) {
        page.fail(`${map.filled} of ${map.aors} AOR polygons have a fill`);
      }
      if (map.pins !== expect.pins) page.fail(`${map.pins} HQ pins, expected ${expect.pins}`);
      if (map.zones !== expect.zones) {
        page.fail(`${map.zones} fleet zone ellipses, expected ${expect.zones}`);
      }

      // Hovering a region has to name it, because a fill change alone tells you
      // which shape the cursor is on and not what it is called.
      if (expect.aors) {
        const named = await page.evaluate(`(() => {
          const p = document.querySelector('.salt-map-aor');
          p.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(
            () => res(document.querySelector('.salt-map figcaption')?.textContent.trim() || ''))));
        })()`);
        if (!/^US[A-Z]+$/.test(String(named))) {
          page.fail(`hovering a region captioned "${named}" instead of naming the command`);
        }
      }
    });
    problems.push(...found.map((p) => `${route}: ${p}`));
  }

  record("world maps: real geometry, labelled and to scale", problems);
}

/**
 * The checklist's "go do it" buttons resolve to real addresses.
 *
 * This is the same class of defect as the ribbon sprite: `systemsFor()` drops
 * ids it doesn't recognize, so a renamed system id produces a row that renders
 * nothing at all and looks like a deliberate design choice. Only a browser can
 * tell the difference between "this item has no application behind it" and "the
 * link silently evaporated" — the data-level check in verify-corpus can prove
 * the ids resolve, but not that the component put them on the page.
 *
 * Also checks the two things that make an external link safe and honest: a
 * `_blank` target needs `rel="noopener"`, and a CAC-gated system has to say so
 * before the click rather than after.
 */
async function checkSystemLinks() {
  const problems = await withPage(`${BASE}/#/tools/checklist`, async (page) => {
    await page.waitFor('!!document.querySelector(\'input[type="checkbox"]\')', 8000);

    const links = await page.evaluate(`(() => {
      return [...document.querySelectorAll('.salt-syslinks a')].map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      }));
    })()`);

    if (!Array.isArray(links) || links.length < 10) {
      page.fail(
        `only ${links?.length ?? 0} system links on the checklist; most items name an application, so the rows are not rendering`,
      );
      return;
    }

    for (const l of links) {
      if (!/^(https:\/\/|tel:)/.test(String(l.href))) {
        page.fail(`system link "${l.text}" points at "${l.href}"`);
      }
      if (l.target === "_blank" && !/noopener/.test(l.rel || "")) {
        page.fail(`"${l.text}" opens a new tab without rel=noopener`);
      }
      if (!l.text) page.fail(`a system link rendered with no visible name (${l.href})`);
    }

    // NSIPS is CAC-gated and appears on the very first item. The gate has to be
    // legible to a screen reader, not just drawn as an icon.
    const cacStated = await page.evaluate(
      `[...document.querySelectorAll('.salt-syslinks a')]
         .some(a => /requires a CAC/i.test(a.textContent))`,
    );
    if (!cacStated) page.fail("no system link states the CAC requirement in text");

    // A portal-routed system must show the hop. PRIMS-2 (annual.pfa) links
    // MyNavy Portal; without the label it reads as a working deep link.
    const via = await page.evaluate(
      `[...document.querySelectorAll('.salt-syslinks a')]
         .some(a => /via MyNavy/i.test(a.textContent))`,
    );
    if (!via) page.fail('no portal-routed link is labelled "via ..." — the indirection is invisible');
  });
  record("system links: checklist items link the real application", problems);

  /**
   * The other three surfaces that render a link row, each of which can fail
   * silently and differently.
   *
   * The knowledge one is not hypothetical: `<SystemLinks :ids="topic.systems">`
   * shipped before any topic declared `systems`, so the row rendered nothing on
   * every knowledge page and looked exactly like a page with nothing to link.
   * A component that renders an empty div when its data is missing cannot tell
   * you it is missing — only a check that expects buttons can.
   */
  for (const [label, url, min] of [
    ["home", `${BASE}/`, 4],
    ["a knowledge topic", `${BASE}/#/knowledge/eval-fitrep`, 2],
    ["the points tracker", `${BASE}/#/tools/points`, 2],
  ]) {
    const problems = await withPage(url, async (page) => {
      const ok = await page.waitFor(
        `document.querySelectorAll('.salt-syslinks a').length >= ${min}`,
        8000,
      );
      if (!ok) {
        const n = await page.evaluate(`document.querySelectorAll('.salt-syslinks a').length`);
        page.fail(`${label} rendered ${n} system links, expected at least ${min}`);
      }
    });
    record(`system links: ${label} links its systems`, problems);
  }
}

/**
 * The companion-app link in the drawer leaves the site, and every way it can
 * break leaves it looking fine.
 *
 * `:to` instead of `:href` is the easy mistake — vue-router treats the absolute
 * URL as a path, so the link renders, highlights, and silently lands on the
 * catch-all route back at Home. A rendered anchor proves nothing here; only the
 * resolved `href` does. Hence the exact-string comparison rather than a substring
 * match: GitHub Pages paths are case-sensitive and `/WEBNAVFIT/` is a 404, which
 * is exactly what a copy from that project's own README would have produced.
 *
 * The reachability of the host is deliberately NOT asserted. This suite must pass
 * offline and on a build machine with no egress, and a check that fails when the
 * network is down teaches people to ignore it.
 */
async function checkCompanionLinks() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(\'nav[aria-label="Main navigation"]\')', 8000);

    const link = await page.evaluate(`(() => {
      const nav = document.querySelector('nav[aria-label="Main navigation"]');
      const a = [...nav.querySelectorAll('a')].find(x => /WEBNAVFIT/i.test(x.textContent));
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return {
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        text: (a.querySelector('.v-list-item-title')?.textContent || '').trim(),
        sr: (a.querySelector('.sr-only')?.textContent || '').trim(),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    })()`);

    if (!link) {
      page.fail("no WEBNAVFIT link in the navigation drawer");
      return;
    }
    const WANT = "https://thepollywog.github.io/webnavfit/";
    if (link.href !== WANT) {
      page.fail(`WEBNAVFIT link points at "${link.href}", expected exactly "${WANT}"`);
    }
    if (link.target !== "_blank") {
      page.fail("the WEBNAVFIT link replaces this tab instead of opening a new one");
    }
    if (!/noopener/.test(link.rel || "")) {
      page.fail("the WEBNAVFIT link opens a new tab without rel=noopener");
    }
    if (!link.text) page.fail("the WEBNAVFIT link rendered with no visible title");
    if (!/new tab/i.test(link.sr)) {
      page.fail(
        "the WEBNAVFIT link does not announce that it leaves the site — every " +
          "other drawer item is a route, so the new-tab glyph is the only cue " +
          "and a glyph alone is not available to a screen reader",
      );
    }
    if (link.w < 100 || link.h < 20) {
      page.fail(`the WEBNAVFIT link has no layout box (${link.w}x${link.h} CSS px)`);
    }

    // Its own group, so departing the site is distinguishable from navigating it.
    const grouped = await page.evaluate(
      `[...document.querySelectorAll('.v-list-subheader')]
         .some(e => /companion/i.test(e.textContent))`,
    );
    if (!grouped) page.fail("the companion-app group lost its subheader");
  });
  record("companion apps: WEBNAVFIT opens externally from the drawer", problems);
}

/**
 * The /go redirector: a real browser, a real query, a real navigation attempt.
 *
 * This is the check that matters most for this feature and the hardest one to do
 * honestly. The unit tests prove the resolver and even run the emitted page's
 * script against a stub `location` — but a stub cannot tell you that the page
 * PARSES in a browser, that it is served at the path a search engine will hit, or
 * that the inline script runs before anything else can interfere. Only loading
 * it does that.
 *
 * Egress is blocked and the assertion is on the attempted request, so nothing
 * leaves the machine and the result is identical offline. See `watchNetwork`.
 *
 * Two cases, because they exercise opposite halves:
 *   ?q=nsips  must leave for NSIPS         — the redirect works
 *   ?q=xyzzy  must NOT leave, and must land in the app with the query intact —
 *             a miss is handed to the assistant instead of guessing a .mil host
 */
async function checkGoRedirect() {
  const NSIPS = "https://www.nsips.cloud.navy.mil/";

  // Directory form, exactly as GitHub Pages will resolve it: `…/go?q=%s` gets a
  // 301 to `…/go/?q=%s` there (measured, not assumed — Pages preserves the query
  // string across its directory-slash redirect). vite preview does not issue
  // that 301, so the trailing slash is written out here.
  const hit = await withPage(
    `${BASE}/go/?q=nsips`,
    async (page) => {
      // Poll the recorded requests rather than the page's own state: by the time
      // the navigation is attempted the document may be gone, so `evaluate` would
      // race against its own teardown.
      const deadline = Date.now() + 6000;
      let attempt = null;
      while (Date.now() < deadline && !attempt) {
        attempt = page.requests.find((r) => /nsips\.cloud\.navy\.mil/.test(r.url));
        if (!attempt) await new Promise((r) => setTimeout(r, 100));
      }

      if (!attempt) {
        const seen = page.requests.map((r) => r.url).join(", ") || "(none)";
        page.fail(`"go nsips" never tried to reach NSIPS. Requests seen: ${seen}`);
        return;
      }
      if (attempt.url !== NSIPS) {
        page.fail(`redirected to "${attempt.url}", expected exactly "${NSIPS}"`);
      }
      if (attempt.type !== "Document") {
        page.fail(`NSIPS was requested as ${attempt.type}, not a navigation`);
      }
      // It must not have gone through the app first. The whole reason this is a
      // hand-written page is that it beats Vue to the redirect; a Document
      // request for the SPA entry means it didn't.
      const bootedApp = page.requests.some((r) => r.type === "Document" && /\/index\.html|\/#\//.test(r.url));
      if (bootedApp) page.fail("the redirector loaded the app before redirecting");
    },
    { watchNetwork: true },
  );
  record("go: ?q=nsips redirects to NSIPS", hit);

  const miss = await withPage(
    `${BASE}/go/?q=xyzzy`,
    async (page) => {
      // Lands in the app, which then renders the miss card. Waiting on the text
      // rather than the URL because the hash route resolves before the view
      // mounts, and asserting on `location` alone would pass with a blank page.
      //
      // Optional-chained because this check straddles a real document swap: the
      // redirector replaces itself, and polling during the swap sees a document
      // whose `body` is still null. Unguarded, that throws inside the page and
      // lands in `problems` as a spurious failure of an otherwise-correct
      // redirect — which is exactly what it did the first time.
      const landed = await page.waitFor(
        'document.body?.innerText?.includes("No shortcut for that yet") === true',
        8000,
      );
      if (!landed) page.fail("an unknown query did not land on the /go page's miss card");

      const href = await page.evaluate("location.href");
      if (!/#\/go/.test(href || "")) page.fail(`unknown query ended up at "${href}"`);
      // The query has to survive the hand-off, or the "ask the assistant" offer
      // has nothing to ask about.
      if (!/xyzzy/.test(href || "")) page.fail(`the query was dropped in transit: "${href}"`);
      const offers = await page.evaluate('document.body?.innerText?.includes("xyzzy") === true');
      if (!offers) page.fail("the miss card does not show what was searched for");

      // Nothing off-origin was attempted for a query that resolves to nothing.
      const leaked = page.requests.filter((r) => /\.mil/.test(r.url));
      if (leaked.length) {
        page.fail(`an unknown query tried to leave for ${leaked.map((r) => r.url).join(", ")}`);
      }
    },
    { watchNetwork: true },
  );
  record("go: an unknown query lands in-app instead of guessing", miss);
}

/**
 * The assistant expands to fill the viewport, and the choice sticks.
 *
 * Measured in pixels rather than by class name, because every way this can fail
 * leaves the class exactly where it should be: `inset: 0` does nothing without
 * clearing the `width` and `max-height` the corner size sets, and a `.v-card`
 * with a `max-height` in a `min()` will happily carry a `--full` class at 430px
 * wide. The class asserts intent; only the rect asserts the result.
 *
 * It also checks the two things "full screen" breaks that nothing else would
 * notice: the FAB must not stay behind the panel as an invisible tab stop, and
 * the panel must remain non-modal — no overlay, `aria-modal` still false — since
 * the whole design premise is reading the page alongside it.
 */
async function checkExpandChat() {
  const problems = await withPage(`${BASE}/#/knowledge/ranks`, async (page) => {
    await page.waitFor('!!document.querySelector(".salt-fab")');
    await page.evaluate('document.querySelector(".salt-fab").click()');
    if (!(await page.waitFor('!!document.querySelector(\'[role="dialog"]\')'))) {
      page.fail("chat panel did not open");
      return;
    }

    /**
     * Measured against `documentElement.clientWidth`, not `innerWidth`.
     * `innerWidth` includes the classic scrollbar, which a `position: fixed`
     * element correctly does not cover — so a properly full-screen panel comes
     * back ~15px narrow and the obvious assertion fails on working code.
     */
    const rect = () =>
      page.evaluate(`(() => {
        const p = document.querySelector('[role="dialog"]');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height),
                 vw: document.documentElement.clientWidth,
                 vh: document.documentElement.clientHeight,
                 full: p.classList.contains('salt-panel--full') };
      })()`);
    const FILLS = `(() => {
      const p = document.querySelector('[role="dialog"]');
      if (!p) return false;
      const r = p.getBoundingClientRect();
      const d = document.documentElement;
      return r.width >= d.clientWidth - 2 && r.height >= d.clientHeight - 2;
    })()`;

    const small = await rect();
    if (!small) {
      page.fail("panel vanished before it could be measured");
      return;
    }
    if (small.full) page.fail("panel started expanded when nothing was stored");
    if (small.w > small.vw * 0.7) {
      page.fail(`corner panel is ${small.w}px of a ${small.vw}px viewport — not a corner panel`);
    }

    const clicked = await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')]
        .find(b => /expand the assistant/i.test(b.getAttribute('aria-label') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (!clicked) {
      page.fail("no expand button found in the panel header");
      return;
    }

    if (!(await page.waitFor(FILLS, 3000))) {
      const big = await rect();
      page.fail(
        `expanding gave ${big?.w}x${big?.h} in a ${big?.vw}x${big?.vh} viewport` +
          ` (class applied: ${big?.full})`,
      );
    }

    // Expanded is still not modal — that is the entire reason it isn't a
    // v-dialog. An overlay here would mean the page can't be read behind it.
    const modality = await page.evaluate(`(() => {
      const p = document.querySelector('[role="dialog"]');
      return {
        ariaModal: p?.getAttribute('aria-modal'),
        overlay: !!document.querySelector('.v-overlay__scrim'),
      };
    })()`);
    if (modality?.ariaModal !== "false") {
      page.fail(`expanded panel claims aria-modal="${modality?.ariaModal}"`);
    }
    if (modality?.overlay) page.fail("expanding the panel added a modal scrim");

    // The FAB is underneath the panel now. Leaving it in the tab order gives a
    // keyboard user a focusable control they cannot see.
    const fabReachable = await page.evaluate(`(() => {
      const fab = document.querySelector('.salt-fab');
      if (!fab) return false;
      const cs = getComputedStyle(fab);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    })()`);
    if (fabReachable) page.fail("the FAB is still focusable underneath the expanded panel");

    // The size preference is the same class of bug as the theme toggle losing
    // its choice, so it gets the same reload assertion.
    await page.evaluate("location.reload()");
    await page.waitFor('!!document.querySelector(".salt-fab")');
    await page.evaluate('document.querySelector(".salt-fab").click()');
    const restored = await page.waitFor(FILLS, 4000);
    if (!restored) page.fail("the expanded size did not survive a reload");

    // Collapsing must restore the FAB, or closing from the corner is impossible.
    await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')]
        .find(b => /shrink the assistant/i.test(b.getAttribute('aria-label') || ''));
      btn?.click();
    })()`);
    const backToCorner = await page.waitFor(`(() => {
      const r = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
      const fab = document.querySelector('.salt-fab');
      return r && r.width < document.documentElement.clientWidth * 0.7 &&
        fab && getComputedStyle(fab).display !== 'none';
    })()`, 3000);
    if (!backToCorner) page.fail("collapsing did not return the panel to the corner with its FAB");
  });
  record("assistant: expands to full screen, stays non-modal, persists", problems);
}

/** Checklist ticks persist across a reload. */
async function checkPersistence() {
  const problems = await withPage(`${BASE}/#/tools/checklist`, async (page) => {
    await page.waitFor('!!document.querySelector(\'input[type="checkbox"]\')');
    await page.evaluate('document.querySelector(\'input[type="checkbox"]\').click()');

    const stored = await page.waitFor(
      `Object.keys(JSON.parse(localStorage.getItem("saltdog:checklist")||'{"data":{}}').data||{}).length > 0`,
      3000,
    );
    if (!stored) {
      page.fail("ticking an item did not write to localStorage");
      return;
    }

    await page.evaluate("location.reload()");
    const survived = await page.waitFor(
      `document.querySelector('input[type="checkbox"]')?.getAttribute('aria-checked') === 'true' ||
       document.querySelector('input[type="checkbox"]')?.checked === true`,
      6000,
    );
    if (!survived) page.fail("checklist state did not survive a reload");
  });
  record("persistence: checklist survives reload", problems);
}

/** The theme toggle flips the theme AND remembers the choice across a reload. */
async function checkTheme() {
  const problems = await withPage(`${BASE}/`, async (page) => {
    await page.waitFor('!!document.querySelector(".v-application")');
    const before = await page.evaluate('document.querySelector(".v-application").className');

    const clicked = await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('.v-app-bar button')]
        .find(b => /theme/i.test(b.getAttribute('aria-label') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (!clicked) {
      page.fail("no theme toggle button found in the app bar");
      return;
    }

    const flipped = await page.waitFor(
      `document.querySelector(".v-application").className !== ${JSON.stringify(before)}`,
      3000,
    );
    if (!flipped) page.fail("clicking the theme toggle did not change the theme");

    const after = await page.evaluate('document.querySelector(".v-application").className');
    await page.evaluate("location.reload()");
    await page.waitFor('!!document.querySelector(".v-application")');
    const restored = await page.waitFor(
      `document.querySelector(".v-application").className === ${JSON.stringify(after)}`,
      4000,
    );
    // The whole point of persisting the choice: "I picked light, why is it dark
    // again" is the bug that makes a theme toggle feel broken.
    if (!restored) page.fail("theme choice did not survive a reload");
  });
  record("theme: toggles and persists", problems);
}

/** About page export/import/clear round-trip, without touching the file picker. */
async function checkAboutStorage() {
  const problems = await withPage(`${BASE}/#/tools/checklist`, async (page) => {
    await page.waitFor('!!document.querySelector(\'input[type="checkbox"]\')');
    await page.evaluate('document.querySelector(\'input[type="checkbox"]\').click()');
    await page.waitFor('!!localStorage.getItem("saltdog:checklist")', 3000);

    await page.evaluate('location.hash = "#/about"');
    if (!(await page.waitFor('document.body.innerText.includes("Your stored data")', 6000))) {
      page.fail("About page did not render the stored-data section");
      return;
    }

    // The panel must actually list the entry, not just claim to.
    const listed = await page.evaluate(
      `document.body.innerText.includes("checklist")`,
    );
    if (!listed) page.fail("stored-data table did not list the checklist entry");

    // Clear-all stays disabled until the confirmation phrase is typed exactly.
    const gated = await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => /delete all stored data/i.test(b.innerText));
      return btn ? btn.disabled : null;
    })()`);
    if (gated !== true) {
      page.fail(`clear-all button was not gated behind the typed confirmation (disabled=${gated})`);
    }
  });
  record("about: stored-data panel lists entries and gates deletion", problems);
}

/* -------------------------------------------------------------------- main */

const server = SERVE ? await startPreview() : null;
if (!SERVE && !(await waitForServer(BASE, 5000))) {
  console.error(`Nothing is serving ${BASE}.`);
  process.exit(2);
}

browser = await launch();
try {
  await checkRoutes();
  await checkChat();
  await checkOrb();
  await checkIconButtons();
  await checkFavicon();
  await checkLazySearch();
  await checkProgressBars();
  await checkRibbonRack();
  await checkRankInsignia();
  await checkMaps();
  await checkSystemLinks();
  await checkCompanionLinks();
  await checkGoRedirect();
  await checkExpandChat();
  await checkPersistence();
  await checkTheme();
  await checkAboutStorage();
} finally {
  // Kill both even if a check threw, or the run leaves a Chrome and a vite
  // holding port 8774 behind for the next invocation to trip over.
  browser.proc.kill();
  server?.kill();
}

const failed = results.filter(([, p]) => p.length);
console.log(`\n${results.length - failed.length}/${results.length} checks clean`);
process.exit(failed.length ? 1 : 0);
