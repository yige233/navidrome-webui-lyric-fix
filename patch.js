document.head.append(
  html(
    "style",
    `.react-jinke-music-player-main .music-player-lyric {
      white-space: break-spaces;
      font-size: 25px;
    }
    .music-player-lyric::first-line {
      font-size: 36px;
    }`,
  ),
);

function html(tagName, attrs = {}, listeners = {}, ...children) {
  const element = document.createElement(tagName);

  if (listeners instanceof Node || typeof listeners === "string") {
    children.unshift(listeners);
  } else {
    for (const eventName in listeners) {
      if (typeof eventName !== "string") continue;
      element.addEventListener(eventName, listeners[eventName]);
    }
  }
  // 检测attrs和listeners是否是元素或文本节点，如果是，将其放入children数组
  if (attrs instanceof Node || typeof attrs === "string") {
    children.unshift(attrs);
  } else {
    for (const attrName in attrs) {
      if (typeof attrName !== "string" || typeof attrs[attrName] === "undefined") continue;
      element.setAttribute(attrName, attrs[attrName]);
    }
  }
  for (const child of children.filter((i) => i)) {
    element.append(child);
  }
  return element;
}
/**
 *
 * @param {string} selector
 * @param {number} timeout
 * @returns {Promise<HTMLElement}
 */
function waitUntil(selector, timeout = 1e4) {
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("timeout"));
    }, timeout);
  });
}
function padStart(str) {
  return str.toString().padStart(2, "0");
}
function hotKey(code, modifierStr = "") {
  const modifier = { ctrl: false, shift: false, alt: false, meta: false };
  ["ctrl", "shift", "alt", "meta"].forEach((i) => modifierStr.toLowerCase().includes(i) && (modifier[i] = true));
  /**
   *
   * @param {KeyboardEvent} e
   * @returns
   */
  return (e) => {
    return e.code === code && e.ctrlKey === modifier.ctrl && e.shiftKey === modifier.shift && e.altKey === modifier.alt && e.metaKey === modifier.meta;
  };
}
class pipLyricHandler extends EventTarget {
  /** @type {Window} */
  pip;
  /** @type {HTMLDivElement} */
  container = html(
    "div",
    html("div", { class: "background" }),
    html(
      "div",
      { class: "backdrop" },
      html("div", { class: "lyric-container-single hidden" }, html("span", { class: "ol" }), html("span", { class: "tl" })),
      html(
        "div",
        { class: "lyric-container-dual" },
        html("div", { class: "odd highlight" }, html("span", { class: "ol" }), html("span", { class: "tl" })),
        html("div", { class: "even" }, html("span", { class: "ol" }), html("span", { class: "tl" })),
      ),
      html("div", { class: "info hidden" }),
    ),
    html("div", { class: "progress-bar" }),
  );
  /** 是否启用注音 */
  ruby = true;
  /** @type {{start:number,value:string}[]} */
  lyrics = [];
  /** @type {string} */
  musicName;
  /** @type {number} */
  offset = 0;
  /** 当前音乐播放位置 */
  currentTime = 0;
  /**
   * 从页面中找到的audio元素
   * @type {HTMLAudioElement}
   */
  audioELem = null;
  static get pipStyle() {
    return `body {
      overflow: hidden;
    }
    .background {
      top: 0%;
      left: 0%;
      width: 100%;
      height: 100%;
      position: fixed;
      zoom: 1;
      background-size: cover;
      background-position: 50% 50%;
      background-repeat: no-repeat;
      z-index: -999;
    }
    .backdrop {
      top: 0%;
      left: 0%;
      width: 100%;
      height: 100%;
      position: fixed;
      background-color: #00000082;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lyric-container-single {
      color: #00e8ff;
      display: flex;
      flex-direction: column;
      text-align: center;
      user-select: none;
    }
    .lyric-container-dual {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      width: 90%;
      user-select: none;
      color: #ffffff
    }
    .lyric-container-dual > div {
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
    }
    .lyric-container-dual .odd {
      align-items: flex-start;
      padding-top: 5px;
    }
    .lyric-container-dual .even {
      align-items: flex-end;
      padding-bottom: 5px;
    }
    .lyric-container-dual .highlight {
      color: #00e8ff
    }
    .progress-bar {
      position: fixed;
      width: 100%;
      left: 0;
      height: 5%;
      max-height: 5px;
      background-color: #ff5252;
      bottom: 0;
      border-radius: 3px;
      transform-origin: left center;
      will-change: transform;
    }
    .progress-bar.playing {
      background-color: #00e8ff;
    }
    .progress-bar.lrc-reloading {
      background-color: #ffc107;
    }
    .hidden {
      display: none;
    }
    .info {
      position: fixed;
      bottom: 5px;
      left: 5px;
      color: aliceblue;
      font-family: Consolas;
      white-space: break-spaces;
    }
    span {
      white-space: pre;
    }
    .ol {
      font-size: 1.2em;
    }
    .tl {
      font-size: 0.9em;
    }`;
  }
  info = (() => {
    const infoObj = {};
    return (info = {}) => {
      Object.assign(infoObj, info);
      this.$(".info").textContent = Object.entries({
        ...infoObj,
        歌词偏移: `${this.offset} 毫秒`,
        歌曲: this.musicName,
        注音: this.ruby ? "启用" : "禁用",
      })
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    };
  })();
  constructor() {
    super();
    window.addEventListener("contextmenu", (e) => {
      if (document.querySelector(".lyric-btn")?.contains(e.target)) {
        e.preventDefault();
        this.openPiP();
      }
    });
    this.init();
  }
  static mergeLyric(lines) {
    const merged = [];
    for (let line of lines) {
      if (merged.find((i) => i.start === line.start)) continue;
      const sameTime = lines.filter((i) => i.start === line.start);
      merged.push({
        start: line.start,
        value: sameTime.map((i) => i.value).join("\n"),
      });
    }
    return merged;
  }
  /**
   *
   * @param {string} slector
   * @returns {HTMLElement}
   */
  $(slector) {
    return slector ? this.container.querySelector(slector) : this.container;
  }
  /**
   *
   * @param {string} slector
   * @returns {HTMLElement[]}
   */
  $a(selector) {
    return selector ? this.container.querySelectorAll(selector) : this.container.children;
  }
  init() {
    waitUntil("audio.music-player-audio")
      .then((elem) => {
        const time = (t) => `${Math.floor(t / 60)}:${padStart(Math.floor(t % 60))}${(t % 1).toFixed(2).slice(1).padEnd(2, "0")}`;
        const animation = () => {
          const currentTime = elem.currentTime;
          const duration = elem.duration;
          this.currentTime = currentTime;
          this.info({ 播放进度: `${time(currentTime)} / ${time(duration)}` });
          this.showLyric(currentTime);
          this.progress.set(currentTime, duration);
          playing && (rafId = requestAnimationFrame(animation));
        };
        this.audioELem = elem;
        let playing = true;
        let rafId = null;
        elem.addEventListener("play", () => {
          this.progress.play();
          playing = true;
          rafId = requestAnimationFrame(animation);
        });
        elem.addEventListener("pause", () => {
          this.progress.pause();
          playing = false;
          cancelAnimationFrame(rafId);
        });
        elem.addEventListener("ended", () => {
          playing = false;
          this.progress.set(0, 0);
          this.progress.pause();
          cancelAnimationFrame(rafId);
        });
        elem.addEventListener("volumechange", () => this.info({ 音量: elem.volume }));
        this.info({ 音量: elem.volume });
      })
      .catch(() => (this.audioELem = null));
  }
  async openPiP() {
    if (!("documentPictureInPicture" in window)) return console.log("浏览器不支持文档画中画");
    const pip = await window.documentPictureInPicture.requestWindow().catch((e) => void console.error("打开画中画失败", e));
    if (!pip) return;
    this.pip = pip;
    pip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.$(".lyric-container-single.hidden")) return;
      pip.resizeTo(this.$(".lyric-container-single").offsetWidth + 30, pip.outerHeight);
    });
    pip.addEventListener("keydown", (e) => {
      const multipler = 5;
      const step = 100;
      if (hotKey("ArrowRight")(e)) {
        this.offset += step;
      }
      if (hotKey("ArrowRight", `ctrl`)(e)) {
        this.offset += step * multipler;
      }
      if (hotKey("ArrowLeft")(e)) {
        this.offset -= step;
      }
      if (hotKey("ArrowLeft", `ctrl`)(e)) {
        this.offset -= step * multipler;
      }
      if (hotKey("KeyI")(e)) {
        this.$(".info").classList.toggle("hidden");
      }
      if (hotKey("KeyP")(e)) {
        this.ruby = !this.ruby;
      }
      if (hotKey("KeyT")(e)) {
        this.$a("span.tl").forEach((tl) => tl.classList.toggle("hidden"));
      }
      if (hotKey("KeyM")(e)) {
        this.$(".lyric-container-single").classList.toggle("hidden");
        this.$(".lyric-container-dual").classList.toggle("hidden");
      }
      if (hotKey("KeyR")(e)) {
        this.offset = 0;
      }
      if (hotKey("KeyR", "ctrl")(e)) {
        if (this.musicId) {
          const barStyle = this.$(".progress-bar").classList;
          barStyle.add("lrc-reloading");
          Promise.all([this.loadLyric(this.musicId), new Promise((resolve) => setTimeout(resolve, 300))]).finally(() => barStyle.remove("lrc-reloading"));
        }
      }
      this.info();
    });
    pip.document.head.append(html("link", { rel: "icon", type: "image/png", sizes: "192x192", href: "./android-chrome-192x192.png" }));
    pip.document.head.append(html("style", pipLyricHandler.pipStyle));
    pip.document.body.append(this.container);
  }
  showLyric(currentTime, force = false) {
    const ruby = (text = "") => {
      const makeRuby = (main, reading) => (reading ? html("ruby", main, html("rp", "("), html("rt", reading), html("rp", ")")) : main);
      const cleared = text.replace("\\", "");
      const matches = [...cleared.matchAll(/(?:^|\s)([^\s(]+?)\(([^)]+)\)/g)];
      if (matches.length === 0) return [text];
      const separator = new RegExp(matches.map((i) => i[0].replace(/[()]/g, "\\$&")).join("|"), "g");
      const splitted = cleared.split(separator);
      const processed = matches.map((i) => makeRuby(i[1], i[2]));
      return splitted.map((v, i) => [v, processed[i]].filter((i) => typeof i !== "undefined")).flat();
    };

    const fillLyric = (selector, lyric) => {
      const [ol, tl] = this.$a(selector);
      const [olText, tlText] = lyric.split("\n");
      ol.innerHTML = "";
      if (olText) {
        const applied = olText === this.musicName || !this.ruby ? [olText] : ruby(olText);
        ol.append(...applied);
      }
      tl.textContent = tlText ?? "";
    };
    const appliedTime = currentTime * 1000 + this.offset;
    const currentLrcIndex = this.lyrics.findLastIndex((i) => appliedTime >= i.start);
    if (this.lastLyricIndex == currentLrcIndex && !force) return;
    this.lastLyricIndex = currentLrcIndex;
    const currentLyric = this.lyrics[currentLrcIndex]?.value ?? this.musicName;
    const nextLyric = this.lyrics[currentLrcIndex + 1]?.value ?? "";
    this.dispatchEvent(new CustomEvent("lyric", { detail: currentLyric }));
    fillLyric(".lyric-container-single span", currentLyric);
    if (currentLrcIndex % 2 === 0) {
      fillLyric(".lyric-container-dual > .odd span", currentLyric);
      fillLyric(".lyric-container-dual > .even span", nextLyric);
      this.$(".lyric-container-dual > .odd").classList.add("highlight");
      this.$(".lyric-container-dual > .even").classList.remove("highlight");
    } else {
      fillLyric(".lyric-container-dual > .odd span", nextLyric);
      fillLyric(".lyric-container-dual > .even span", currentLyric);
      this.$(".lyric-container-dual > .odd").classList.remove("highlight");
      this.$(".lyric-container-dual > .even").classList.add("highlight");
    }
  }
  async fetchLyric(id) {
    if (!id) return [];
    const params = ["username", "subsonic-salt", "subsonic-token"].map((i) => localStorage.getItem(i));
    try {
      const res = await fetch(`/rest/getLyricsBySongId.view?c=NavidromeUI&f=json&v=1.8.0&u=${params[0]}&s=${params[1]}&t=${params[2]}&id=${id}`);
      const {
        "subsonic-response": {
          lyricsList: { structuredLyrics },
        },
      } = await res.json();
      if (!Array.isArray(structuredLyrics) || structuredLyrics.length === 0) return [];
      return structuredLyrics;
    } catch (e) {
      console.log(`获取歌词失败`, e);
      return [];
    }
  }
  songChange(state) {
    if (!this.audioELem) this.init();
    const { musicSrc, cover, singer, name } = state;
    const bgImage = new URL(`${location.origin}${cover}`);
    this.musicId = new URLSearchParams(musicSrc).get("id");
    this.progress.set(0, 0);
    this.musicName = `${name} - ${singer}`;
    this.offset = 0;
    this.lyrics = [{ start: -1, value: this.musicName }];
    this.lastLyricIndex = -1;
    bgImage.searchParams.set("size", 600);
    this.$(".background").style.backgroundImage = `url(${bgImage.href})`;
    this.loadLyric(this.musicId);
    if (this.pip) this.pip.document.title = this.musicName;
  }
  async loadLyric(musicId) {
    const [rawlrc = {}] = await this.fetchLyric(musicId);
    if (rawlrc.offset) this.offset = rawlrc.offset;
    const mergedLrc = pipLyricHandler.mergeLyric(rawlrc.line ?? []);
    const appliedLrc = [{ start: -1, value: this.musicName }, ...mergedLrc.sort((a, b) => a.start - b.start)];
    this.lyrics = appliedLrc;
    this.showLyric(this.currentTime, true);
  }
  get progress() {
    const progressbar = this.$(".progress-bar");
    return {
      set(currentTime, duration) {
        const percent = duration > 0 ? currentTime / duration : 0;
        progressbar.style.transform = `scaleX(${percent})`;
      },
      play() {
        progressbar.classList.add("playing");
      },
      pause() {
        progressbar.classList.remove("playing");
      },
    };
  }
}
const pipLyric = new pipLyricHandler();
