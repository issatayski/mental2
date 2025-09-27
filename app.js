/* Тренажёр ментальной арифметики — v5 (фикс диапазонов, RU/KZ, без Reset, без подсказок) */

const SPEEDS = { slow:1000, medium:600, fast:300 };
const STORAGE_KEY = "mentalTrainerSettings";
const LANG_KEY = "mentalTrainerLang";

const i18n = {
  ru: {
    opsLegend: "Операции",
    opsHint: "Можно выбрать несколько.",
    rangeLegend: "Диапазон чисел",
    fromLabel: "От",
    toLabel: "До",
    rangeError: "Значение «От» должно быть меньше или равно «До».",
    speedLegend: "Скорость показа",
    speedSlow: "Медленно",
    speedMed: "Средне",
    speedFast: "Быстро",
    countLegend: "Количество показов",
    countHint: "Сколько раз появятся числа/выражения.",
    countError: "Минимум 1.",
    startBtn: "Старт",
    resultBtn: "Результат",
    contacts: "Контакты:",
    siteLabel: "Сайт:"
  },
  kz: {
    opsLegend: "Әрекеттер",
    opsHint: "Бірнешеуін таңдауға болады.",
    rangeLegend: "Сандар диапазоны",
    fromLabel: "Кемінде",
    toLabel: "Көп дегенде",
    rangeError: "«Кемінде» мәні «Көп дегенде» мәнінен артық болмауы тиіс.",
    speedLegend: "Көрсету жылдамдығы",
    speedSlow: "Баяу",
    speedMed: "Орташа",
    speedFast: "Жылдам",
    countLegend: "Көрсету саны",
    countHint: "Сандар/өрнектер қанша рет көрсетіледі.",
    countError: "Ең азы 1.",
    startBtn: "Бастау",
    resultBtn: "Нәтиже",
    contacts: "Байланыс:",
    siteLabel: "Сайт:"
  }
};

const state = {
  settings: { ops:new Set(['+']), min:-9, max:9, speed:'medium', count:20 },
  sequence: [],
  isRunning: false,
  stepIndex: -1,
  timerId: null,
  lastShownNumber: null,
  finished: false,
  lang: (localStorage.getItem(LANG_KEY) || "ru")
};

/** utils */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function loadSettings(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const s = JSON.parse(raw);
    if(Array.isArray(s.ops)) state.settings.ops = new Set(s.ops);
    if(typeof s.min === "number") state.settings.min = s.min;
    if(typeof s.max === "number") state.settings.max = s.max;
    if(typeof s.speed === "string" && SPEEDS[s.speed]) state.settings.speed = s.speed;
    if(Number.isInteger(s.count) && s.count > 0) state.settings.count = s.count;
  }catch{}
}
function saveSettings(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ops:[...state.settings.ops],
    min:state.settings.min,
    max:state.settings.max,
    speed:state.settings.speed,
    count:state.settings.count
  }));
}

/** ui */
const ui = {
  els:{},
  init(){
    this.els.displayText = document.getElementById("displayText");
    this.els.form = document.getElementById("controlsForm");
    this.els.rangeError = document.getElementById("rangeError");
    this.els.countError = document.getElementById("countError");
    this.els.minVal = document.getElementById("minVal");
    this.els.maxVal = document.getElementById("maxVal");
    this.els.count = document.getElementById("count");
    this.els.startBtn = document.getElementById("startBtn");
    this.els.resultBtn = document.getElementById("resultBtn");
    this.els.langBtn = document.getElementById("langBtn");

    this.bumpDisplayFont(1.2);
    this.applyLocale();
    this.syncSettingsToUI();

    this.els.form.addEventListener("change", () => this.onFormChange());
    this.els.startBtn.addEventListener("click", () => runner.start());
    this.els.resultBtn.addEventListener("click", () => runner.showResult());
    this.els.langBtn.addEventListener("click", () => this.toggleLang());

    window.addEventListener("keydown", (e) => {
      if(e.key.toLowerCase()==="s" && !this.els.startBtn.disabled) runner.start();
      else if(e.key.toLowerCase()==="r" && !this.els.resultBtn.disabled) runner.showResult();
    });

    this.renderDisplay("");
    this.validate();
    this.lockControls(false);
  },
  bumpDisplayFont(mult){
    const cs = getComputedStyle(this.els.displayText);
    const fs = parseFloat(cs.fontSize) || 48;
    this.els.displayText.style.fontSize = (fs*mult)+"px";
    this.els.displayText.style.lineHeight = "1.1";
  },
  applyLocale(){
    document.documentElement.lang = state.lang;
    const dict = i18n[state.lang] || i18n.ru;
    const keys = ["opsLegend","opsHint","rangeLegend","fromLabel","toLabel","rangeError","speedLegend","speedSlow","speedMed","speedFast","countLegend","countHint","countError","startBtn","resultBtn","contacts","siteLabel"];
    keys.forEach((k)=>{
      const nodes = document.querySelectorAll(`[data-i18n="${k}"]`);
      nodes.forEach((n)=>{ n.textContent = dict[k]; });
    });
    this.els.startBtn.textContent = dict.startBtn;
    this.els.resultBtn.textContent = dict.resultBtn;
  },
  toggleLang(){
    state.lang = state.lang==="ru" ? "kz":"ru";
    localStorage.setItem(LANG_KEY, state.lang);
    this.applyLocale();
  },
  syncSettingsToUI(){
    this.els.form.querySelectorAll('input[name="ops"]').forEach(inp=>{
      inp.checked = state.settings.ops.has(inp.value);
    });
    this.els.minVal.value = state.settings.min;
    this.els.maxVal.value = state.settings.max;
    this.els.form.querySelectorAll('input[name="speed"]').forEach(inp=>{
      inp.checked = (inp.value===state.settings.speed);
    });
    this.els.count.value = state.settings.count;
  },
  onFormChange(){
    const ops = new Set();
    this.els.form.querySelectorAll('input[name="ops"]:checked').forEach(inp=>ops.add(inp.value));
    state.settings.ops = ops;
    state.settings.min = parseInt(this.els.minVal.value,10);
    state.settings.max = parseInt(this.els.maxVal.value,10);
    const sp = this.els.form.querySelector('input[name="speed"]:checked');
    if(sp) state.settings.speed = sp.value;
    state.settings.count = parseInt(this.els.count.value,10);
    saveSettings();
    this.validate();
  },
  validate(){
    const hasOps = state.settings.ops.size>0;
    const rangeOk = Number.isFinite(state.settings.min) && Number.isFinite(state.settings.max) && state.settings.min <= state.settings.max;
    const countOk = Number.isInteger(state.settings.count) && state.settings.count>=1;
    this.els.rangeError.hidden = rangeOk;
    this.els.countError.hidden = countOk;
    const canStart = hasOps && rangeOk && countOk && !state.isRunning && !state.finished;
    this.els.startBtn.disabled = !canStart;
    this.els.resultBtn.disabled = !state.finished;
  },
  lockControls(lock){
    this.els.form.querySelectorAll("input").forEach(el=>{ el.disabled = lock; });
    this.els.startBtn.disabled = lock || state.finished || this.els.startBtn.disabled;
    this.els.resultBtn.disabled = !state.finished;
    this.els.langBtn.disabled = false;
  },
  renderDisplay(text){ this.els.displayText.textContent = text; }
};

/** generator */
const generator = {
  genStart(min, max, lastShown){
    for(let i=0;i<1000;i++){
      const v = randInt(min,max);
      if(v!==lastShown) return v;
    }
    return randInt(min,max);
  },
  genStep(current, ops, min, max, lastShown){
    const arr = Array.from(ops);
    for(let t=0;t<200;t++){
      const op = pick(arr);
      let b = randInt(min,max);
      if(b===lastShown) continue;
      if(op==="*"){
        if(b===0) continue;
        return {op,b,r:current*b,fallback:false};
      }
      if(op===":"){
        if(b===0) continue;
        if(current % b === 0) return {op,b,r:current/b,fallback:false};
        continue;
      }
      if(op==="+") return {op,b,r:current+b,fallback:false};
      if(op==="-") return {op,b,r:current-b,fallback:false};
    }
    const op = ops.has("+")?"+":"-";
    const b = this.safeNonRepeat(min,max,lastShown);
    const r = op==="+"? current+b : current-b;
    return {op,b,r,fallback:true};
  },
  safeNonRepeat(min,max,lastShown){
    for(let i=0;i<200;i++){ const v=randInt(min,max); if(v!==lastShown) return v; }
    return randInt(min,max);
  },
  buildSequence(settings){
    const seq = [];
    const {min,max,count,ops} = settings;
    const a0 = this.genStart(min,max,state.lastShownNumber);
    let current = a0, lastShown=a0;
    seq.push({a:a0,op:null,b:null,r:a0});
    for(let i=0;i<count;i++){
      const step = this.genStep(current,ops,min,max,lastShown);
      seq.push({a:current,op:step.op,b:step.b,r:step.r,fallback:step.fallback});
      current = step.r; lastShown = step.b;
    }
    return seq;
  }
};

/** runner */
const runner = {
  start(){
    if(state.isRunning || state.finished) return;
    if(state.settings.ops.size===0) return;
    if(state.settings.min>state.settings.max) return;
    if(!Number.isInteger(state.settings.count) || state.settings.count<1) return;

    state.sequence = generator.buildSequence(state.settings);
    state.stepIndex = 0;
    state.isRunning = true;
    state.finished = false;
    ui.lockControls(true);

    const first = state.sequence[0];
    state.lastShownNumber = first.r;
    ui.renderDisplay(String(first.r));

    const delay = SPEEDS[state.settings.speed] || SPEEDS.medium;
    const runNext = () => {
      if(!state.isRunning) return;
      state.stepIndex++;
      if(state.stepIndex >= state.sequence.length){
        state.isRunning = false;
        state.finished = true;
        state.timerId = null;
        ui.lockControls(false);
        ui.validate();
        return;
      }
      const step = state.sequence[state.stepIndex];
      if(step.op){
        const sym = {"+":"", "-":"-", "*":"*", ":":":"}[step.op] || "";
        const showAbs = Math.abs(step.b);
        ui.renderDisplay(sym ? `${sym} ${showAbs}` : `${showAbs}`);
        state.lastShownNumber = step.b;
      }else{
        ui.renderDisplay(String(step.r));
        state.lastShownNumber = step.r;
      }
      state.timerId = setTimeout(runNext, delay);
    };
    state.timerId = setTimeout(runNext, delay);
  },
  showResult(){
    if(!state.finished || state.sequence.length===0) return;
    const last = state.sequence[state.sequence.length-1].r;
    ui.renderDisplay(String(last));
    setTimeout(()=>{ this.reset(true); }, 2000); // silent reset, keep display
    ui.lockControls(true);
    ui.validate();
  },
  reset(keepDisplay=false){
    if(state.timerId){ clearTimeout(state.timerId); state.timerId=null; }
    state.isRunning=false;
    state.finished=false;
    state.stepIndex=-1;
    state.sequence=[];
    state.lastShownNumber=null;
    if(!keepDisplay){ ui.renderDisplay(""); }
    ui.lockControls(false);
    ui.validate();
  }
};

document.addEventListener("DOMContentLoaded", ()=>{
  loadSettings();
  ui.init();
});
