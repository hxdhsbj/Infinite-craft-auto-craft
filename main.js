// ==UserScript==
// @name         Infinite Craft Bot (Auto Combine + GUI + no repeat pairs + Discord button)
// @namespace    infinitecraft.bot.gui.norepeat.discord
// @match        https://neal.fun/infinite-craft/*
// @grant        none
// @version      6.0
// ==/UserScript==

(() => {
  "use strict";

  const DISCORD_INVITE = "https://discord.gg/feXU9Mzg";

  const $ = (sel) => document.querySelector(sel);

  function fireMouse(target, type, x, y) {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      clientX: x, clientY: y, buttons: type === "mouseup" ? 0 : 1
    }));
  }

  function firePointer(target, type, x, y) {
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: 1, pointerType: "mouse", isPrimary: true,
      clientX: x, clientY: y,
      buttons: type === "pointerup" ? 0 : 1
    }));
  }

  function dragToPoint(el, x, y) {
    const r = el.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;

    firePointer(el, "pointerdown", sx, sy);
    firePointer(document, "pointermove", sx + 2, sy + 2);
    firePointer(document, "pointermove", x, y);
    firePointer(document, "pointerup", x, y);

    fireMouse(el, "mousedown", sx, sy);
    fireMouse(document, "mousemove", x, y);
    fireMouse(document, "mouseup", x, y);
  }

  function getSidebarRect() {
    const sb = $("#sidebar") || $(".sidebar-inner") || $(".sidebar");
    return sb ? sb.getBoundingClientRect() : null;
  }

  function getDropPoint() {
    const sb = getSidebarRect();
    const safeRight = sb ? sb.left : window.innerWidth;
    return { x: Math.max(90, Math.floor(safeRight * 0.55)), y: Math.floor(window.innerHeight * 0.50) };
  }

  function getItems() {
    const root = $(".items");
    if (!root) return [];
    const items = [...root.querySelectorAll(".item[data-item-text]")];
    return items.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10 && r.bottom > 0 && r.top < innerHeight;
    });
  }

  function getItemKey(el) {
    const id = el.getAttribute("data-item-id");
    if (id !== null && id !== undefined) return `id:${id}`;
    return `t:${(el.getAttribute("data-item-text") || el.innerText || "").trim()}`;
  }

  function pairKey(a, b) {
    const ka = getItemKey(a);
    const kb = getItemKey(b);
    return (ka < kb) ? `${ka}|${kb}` : `${kb}|${ka}`;
  }

  function pairLabel(a, b) {
    const ta = (a.getAttribute("data-item-text") || a.innerText || "").trim();
    const tb = (b.getAttribute("data-item-text") || b.innerText || "").trim();
    return `${ta} + ${tb}`;
  }

  let running = false;
  let done = 0;
  let targetAttempts = 50;
  let intervalMs = 900;
  let batchPairs = 30;

  let timer = null;
  const tried = new Set();
  let queue = [];

  const style = document.createElement("style");
  style.textContent = `
    #icPanel{
      position:fixed; right:18px; bottom:18px; z-index:999999;
      width:360px; max-width: calc(100vw - 36px);
      color: rgba(255,255,255,.92);
      background: rgba(70,72,85,.92);
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 26px;
      box-shadow: 0 18px 50px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
      font: 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto;
      overflow:hidden;
    }

    #icHeader{
      padding: 18px 18px 8px;
      user-select:none;
      cursor: grab;
    }
    #icHeader:active{ cursor: grabbing; }

    #icTitle{
      font-size: 28px;
      font-weight: 800;
      letter-spacing: .2px;
    }

    #icSubRow{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      margin-top: 6px;
      color: rgba(255,255,255,.72);
      font-size: 16px;
      overflow:hidden;
    }

    #icSubText{
      min-width: 0;
      overflow:hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #icDiscordBtn{
      flex: none;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(120,170,255,.35);
      background: rgba(120,170,255,.18);
      color: rgba(255,255,255,.92);
      text-decoration:none;
      font-weight: 800;
      font-size: 13px;
      transition: transform .08s ease, background .15s ease, border-color .15s ease;
      white-space: nowrap;
    }
    #icDiscordBtn:hover{
      background: rgba(120,170,255,.25);
      border-color: rgba(120,170,255,.55);
    }
    #icDiscordBtn:active{ transform: scale(.99); }

    #icBody{
      padding: 12px 18px 16px;
      display:grid;
      gap: 14px;
    }

    .icCard{
      background: rgba(0,0,0,.12);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 22px;
      padding: 16px;
    }

    .icLabel{
      color: rgba(255,255,255,.90);
      font-size: 18px;
      margin-bottom: 6px;
      font-weight: 650;
    }

    .icInput{
      width:100%;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.95);
      outline: none;
      font-size: 22px;
      font-weight: 700;
      box-sizing: border-box;
    }

    .icBtn{
      width:100%;
      padding: 18px 16px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.95);
      font-weight: 900;
      font-size: 24px;
      cursor: pointer;
      transition: transform .08s ease, filter .15s ease;
    }
    .icBtn:active{ transform: scale(.99); }

    #icStart{ background: rgba(80,180,130,.55); }
    #icStop{ background: rgba(190,90,105,.55); }

    #icProgWrap{
      height: 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.10);
      overflow:hidden;
    }
    #icProg{
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, rgba(120,200,255,.95), rgba(60,220,150,.95));
      transition: width .18s ease;
    }
    #icProgressText{
      margin-top: 8px;
      color: rgba(255,255,255,.85);
      font-size: 18px;
      font-weight: 800;
    }

    #icLog{
      display:grid;
      gap: 10px;
      max-height: 190px;
      overflow:auto;
      padding-right: 6px;
    }
    .icLogItem{
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 18px;
      padding: 12px 14px;
      font-size: 18px;
      font-weight: 700;
      color: rgba(255,255,255,.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #icFooter{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding: 14px 18px 18px;
      color: rgba(255,255,255,.65);
      font-weight: 700;
      font-size: 18px;
    }

    #icLog::-webkit-scrollbar{ width: 10px; }
    #icLog::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.25); border-radius: 999px; }
    #icLog::-webkit-scrollbar-track{ background: rgba(255,255,255,.08); border-radius: 999px; }
  `;
  document.documentElement.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "icPanel";
  panel.innerHTML = `
    <div id="icHeader">
      <div id="icTitle">Infinite Craft Bot</div>
      <div id="icSubRow">
        <div id="icSubText">Made by bobar developer</div>
        <a id="icDiscordBtn" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Join Discord</a>
      </div>
    </div>

    <div id="icBody">
      <div class="icCard">
        <div class="icLabel">Total attempts</div>
        <input class="icInput" id="icCount" type="number" min="1" value="50">
        <div class="icLabel" style="margin-top:14px;">Queue size</div>
        <input class="icInput" id="icBatch" type="number" min="1" value="30">
        <div class="icLabel" style="margin-top:14px;">Speed (ms)</div>
        <input class="icInput" id="icSpeed" type="number" min="200" value="900">
      </div>

      <div class="icCard">
        <button class="icBtn" id="icStart">Start</button>
        <div style="height:14px;"></div>
        <button class="icBtn" id="icStop">Stop</button>

        <div style="margin-top:16px;">
          <div id="icProgWrap"><div id="icProg"></div></div>
          <div id="icProgressText">0 / 50</div>
        </div>
      </div>

      <div class="icCard">
        <div class="icLabel">Recent attempts</div>
        <div id="icLog"></div>
      </div>
    </div>

    <div id="icFooter">
      <div>F8 = toggle</div>
      <div id="icItemsText">Items: 0</div>
    </div>
  `;
  (document.body || document.documentElement).appendChild(panel);

  (() => {
    const header = panel.querySelector("#icHeader");
    let dragging = false, startX = 0, startY = 0, startRight = 18, startBottom = 18;

    header.addEventListener("mousedown", (e) => {
      const t = e.target;
      if (t && (t.id === "icDiscordBtn")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const right = parseFloat(panel.style.right || "18");
      const bottom = parseFloat(panel.style.bottom || "18");
      startRight = isNaN(right) ? 18 : right;
      startBottom = isNaN(bottom) ? 18 : bottom;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.right = `${Math.max(8, startRight - dx)}px`;
      panel.style.bottom = `${Math.max(8, startBottom - dy)}px`;
    });

    window.addEventListener("mouseup", () => dragging = false);
  })();

  const elCount = panel.querySelector("#icCount");
  const elBatch = panel.querySelector("#icBatch");
  const elSpeed = panel.querySelector("#icSpeed");

  const elStart = panel.querySelector("#icStart");
  const elStop = panel.querySelector("#icStop");

  const elProg = panel.querySelector("#icProg");
  const elProgressText = panel.querySelector("#icProgressText");
  const elItemsText = panel.querySelector("#icItemsText");
  const elLog = panel.querySelector("#icLog");

  function addLog(line) {
    const div = document.createElement("div");
    div.className = "icLogItem";
    div.textContent = line;
    elLog.prepend(div);
    while (elLog.children.length > 12) elLog.removeChild(elLog.lastChild);
  }

  function uiSync() {
    const pct = targetAttempts > 0 ? Math.min(100, (done / targetAttempts) * 100) : 0;
    elProg.style.width = `${pct}%`;
    elProgressText.textContent = `${done} / ${targetAttempts}`;
    elItemsText.textContent = `Items: ${getItems().length}`;
  }

  function setFromInputs() {
    targetAttempts = Math.max(1, Number(elCount.value || 1));
    batchPairs = Math.max(1, Number(elBatch.value || 1));
    intervalMs = Math.max(200, Number(elSpeed.value || 200));
    uiSync();
  }

  elCount.addEventListener("change", setFromInputs);
  elBatch.addEventListener("change", setFromInputs);
  elSpeed.addEventListener("change", setFromInputs);

  function refillQueue() {
    const items = getItems();
    if (items.length < 2) return 0;

    let added = 0;
    const wanted = batchPairs;
    const maxTries = Math.max(600, wanted * 60);
    let tries = 0;

    while (added < wanted && tries < maxTries) {
      tries++;

      const a = items[(Math.random() * items.length) | 0];
      let b = a;
      for (let i = 0; i < 10 && b === a; i++) {
        b = items[(Math.random() * items.length) | 0];
      }
      if (b === a) continue;

      const key = pairKey(a, b);
      if (tried.has(key)) continue;
      if (queue.some(q => q.key === key)) continue;

      queue.push({ aEl: a, bEl: b, key, label: pairLabel(a, b) });
      tried.add(key);
      added++;
    }
    return added;
  }

  function stop() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    uiSync();
  }

  function scheduleNext() {
    if (!running) return;
    timer = setTimeout(loopOnce, intervalMs);
  }

  function loopOnce() {
    if (!running) return;

    if (done >= targetAttempts) {
      stop();
      addLog(`Done ✅ (${done} attempts)`);
      return;
    }

    if (queue.length === 0) {
      const added = refillQueue();
      if (added === 0) {
        stop();
        addLog("No new pairs left.");
        return;
      }
    }

    const next = queue.shift();
    uiSync();

    if (!next?.aEl?.isConnected || !next?.bEl?.isConnected) {
      addLog("DOM refresh → skipped");
      return scheduleNext();
    }

    const dp = getDropPoint();

    dragToPoint(next.aEl, dp.x, dp.y);
    setTimeout(() => {
      dragToPoint(next.bEl, dp.x, dp.y);
      done++;
      addLog(next.label);
      uiSync();
      scheduleNext();
    }, 180);
  }

  function startFresh() {
    setFromInputs();
    done = 0;
    queue = [];
    running = true;
    elLog.innerHTML = "";
    addLog("Start ✅");
    refillQueue();
    uiSync();
    loopOnce();
  }

  elStart.addEventListener("click", startFresh);
  elStop.addEventListener("click", stop);

  window.addEventListener("keydown", (e) => {
    if (e.code === "F8") {
      if (running) stop();
      else startFresh();
    }
  });

  setFromInputs();
  uiSync();

  setInterval(() => {
    if (!document.body.contains(panel)) return;
    elItemsText.textContent = `Items: ${getItems().length}`;
  }, 1000);
})();
