// ==UserScript==
// @name         Infinite Craft auto craft cheat
// @namespace    https://neal.fun/infinite-craft
// @version      1.0.0
// @description  idk just auto farm script
// @author       bobar developer
// @match        https://neal.fun/infinite-craft/*
// @grant        none
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

//use tamper mokey to run

(() => {
  "use strict";

  const $ = s => document.querySelector(s);

  function fireMouse(t, type, x, y) {
    t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, buttons: type === "mouseup" ? 0 : 1 }));
  }

  function firePointer(t, type, x, y) {
    t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1 }));
  }

  function dragToPoint(el, x, y) {
    const r = el.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;
    firePointer(el, "pointerdown", sx, sy);
    firePointer(document, "pointermove", x, y);
    firePointer(document, "pointerup", x, y);
    fireMouse(el, "mousedown", sx, sy);
    fireMouse(document, "mousemove", x, y);
    fireMouse(document, "mouseup", x, y);
  }

  function getDropPoint() {
    const sb = $("#sidebar");
    const right = sb ? sb.getBoundingClientRect().left : innerWidth;
    return { x: Math.max(100, right * 0.55), y: innerHeight * 0.5 };
  }

  function getItems() {
    const root = $(".items");
    if (!root) return [];
    return [...root.querySelectorAll(".item[data-item-text]")].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 20 && r.height > 10;
    });
  }

  function itemKey(el) {
    return el.getAttribute("data-item-id") ?? el.getAttribute("data-item-text");
  }

  function pairKey(a, b) {
    const x = itemKey(a), y = itemKey(b);
    return x < y ? x + "|" + y : y + "|" + x;
  }

  function pairLabel(a, b) {
    return `${a.getAttribute("data-item-text")} + ${b.getAttribute("data-item-text")}`;
  }

  let running = false;
  let done = 0;
  let total = 50;
  let speed = 900;
  let queueSize = 30;
  let timer = null;
  const tried = new Set();
  let queue = [];

  const style = document.createElement("style");
  style.textContent = `
    #icPanel{position:fixed;right:18px;bottom:18px;width:320px;background:rgba(15,18,30,.75);border:1px solid rgba(255,255,255,.15);border-radius:16px;backdrop-filter:blur(10px);box-shadow:0 20px 40px rgba(0,0,0,.4);color:white;font:12.5px system-ui;z-index:999999}
    #icHeader{padding:12px;cursor:grab}
    #icTitle strong{font-size:13px}
    #icTitle span{font-size:11px;opacity:.7}
    .icCard{margin:10px;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px;background:rgba(255,255,255,.05)}
    .icInput{width:100%;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:white}
    .icBtn{width:100%;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.1);color:white;font-weight:600;cursor:pointer}
    .icBtn.green{background:rgba(60,220,150,.25)}
    .icBtn.red{background:rgba(255,80,90,.25)}
    #icProgWrap{height:8px;background:rgba(255,255,255,.15);border-radius:999px;overflow:hidden}
    #icProg{height:100%;width:0%;background:linear-gradient(90deg,#7aaaff,#3cdca0)}
    #icLog{max-height:90px;overflow:auto;font-size:11px}
    .icLogItem{padding:6px;border-radius:8px;background:rgba(255,255,255,.05);margin-top:5px}
    #icFooter{padding:10px;font-size:11px;opacity:.6;display:flex;justify-content:space-between}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.id = "icPanel";
  panel.innerHTML = `
    <div id="icHeader">
      <div id="icTitle">
        <strong>Infinite Craft Bot</strong><br>
        <span>Made by bobar developer discord server: https://discord.gg/feXU9Mzg</span>
      </div>
    </div>

    <div class="icCard">
      Total attempts
      <input class="icInput" id="icTotal" type="number" value="50">
      Queue size
      <input class="icInput" id="icQueue" type="number" value="30">
      Speed (ms)
      <input class="icInput" id="icSpeed" type="number" value="900">
    </div>

    <div class="icCard">
      <button class="icBtn green" id="icStart">Start</button><br><br>
      <button class="icBtn red" id="icStop">Stop</button>
      <div style="margin-top:10px">
        <div id="icProgWrap"><div id="icProg"></div></div>
        <div id="icProgress">0 / 50</div>
      </div>
    </div>

    <div class="icCard">
      Recent attempts
      <div id="icLog"></div>
    </div>

    <div id="icFooter">
      <span>F8 = toggle</span>
      <span id="icItems">Items: 0</span>
    </div>
  `;
  document.body.appendChild(panel);

  const elTotal = $("#icTotal");
  const elQueue = $("#icQueue");
  const elSpeed = $("#icSpeed");
  const elProg = $("#icProg");
  const elProgress = $("#icProgress");
  const elLog = $("#icLog");
  const elItems = $("#icItems");

  function log(t) {
    const d = document.createElement("div");
    d.className = "icLogItem";
    d.textContent = t;
    elLog.prepend(d);
    while (elLog.children.length > 8) elLog.lastChild.remove();
  }

  function refill() {
    const items = getItems();
    let added = 0;
    while (added < queueSize) {
      const a = items[Math.random() * items.length | 0];
      const b = items[Math.random() * items.length | 0];
      if (!a || !b || a === b) continue;
      const k = pairKey(a, b);
      if (tried.has(k)) continue;
      tried.add(k);
      queue.push({ a, b, label: pairLabel(a, b) });
      added++;
    }
  }

  function step() {
    if (!running || done >= total) return stop();
    if (queue.length === 0) refill();
    const next = queue.shift();
    const p = getDropPoint();
    dragToPoint(next.a, p.x, p.y);
    setTimeout(() => {
      dragToPoint(next.b, p.x, p.y);
      done++;
      elProg.style.width = `${done / total * 100}%`;
      elProgress.textContent = `${done} / ${total}`;
      log(next.label);
      timer = setTimeout(step, speed);
    }, 180);
  }

  function start() {
    total = +elTotal.value;
    queueSize = +elQueue.value;
    speed = +elSpeed.value;
    done = 0;
    queue = [];
    running = true;
    tried.clear();
    elLog.innerHTML = "";
    step();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
  }

  $("#icStart").onclick = start;
  $("#icStop").onclick = stop;

  window.addEventListener("keydown", e => {
    if (e.code === "F8") running ? stop() : start();
  });

  setInterval(() => elItems.textContent = `Items: ${getItems().length}`, 1000);
})();
