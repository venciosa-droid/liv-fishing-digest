// Synthetic fixtures only; these are not real weather readings.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const htmlPath=path.join(__dirname,'../galoc/print.html');
const raw=fs.readFileSync(htmlPath,'utf8');
assert(/id="print"/.test(raw),'Print button is on the page');
assert(!/<a[^>]*>Galoc Station<\/a>/.test(raw)&&!/<a[^>]*>All fishing grounds<\/a>/.test(raw),'top nav links to Galoc Station and All fishing grounds are removed');
assert(fs.readFileSync(path.join(__dirname,'../galoc/index.html'),'utf8').includes('href="print.html"'),'Galoc page still links to the 7-day plan');
assert(/Color key/.test(raw)&&/Green/.test(raw)&&/Yellow/.test(raw)&&/Red/.test(raw)&&/Blue/.test(raw),'color key names all four inks');
assert(/print-color-adjust:\s*exact/.test(raw)&&/-webkit-print-color-adjust:\s*exact/.test(raw),'print keeps ink colors');
assert(/FRESH_MS=12\*60\*60e3/.test(raw),'client refreshes when saved data is older than 12 hours');
assert(/DATA_URL='fresh7.json'/.test(raw),'page loads the published snapshot first');
assert(/api\.open-meteo\.com\/v1\//.test(raw)&&/marine-api\.open-meteo\.com/.test(raw)&&/apiUrl\('gfs'/.test(raw)&&/apiUrl\('ecmwf'/.test(raw),'live refresh uses ECMWF, Marine, and GFS');
assert(/never invented/.test(raw)||/No values were invented/.test(raw),'does not invent missing values');
assert(/Wind is in kph/.test(raw),'wind unit is kph');
assert(/font:18px/.test(raw),'body text is at least 18px on screen');
assert(!/<table/.test(raw)&&!/tableHtml/.test(raw),'dense tables are gone');
const pub=fs.readFileSync('/workspace/liv-fishing-dashboard/publish_digest.sh','utf8');
assert(/make_fresh7_json\.py/.test(pub)&&/galoc_print\.html/.test(pub),'digest publish regenerates the 7-day plan');
const redirect=fs.readFileSync(path.join(__dirname,'../fresh7/index.html'),'utf8');
assert(/galoc\/print\.html/.test(redirect),'stable /fresh7/ URL points at the live plan');

const nodes={};const node=id=>nodes[id]??=({textContent:'',innerHTML:'',hidden:false,disabled:false,className:'',onclick:null,setAttribute(){}});
const store={};
const ctx={
  console,Date,Number,Math,JSON,Intl,String,Object,Array,Promise,
  setTimeout,clearTimeout,
  document:{getElementById:node,addEventListener(){}},
  addEventListener(){},
  localStorage:{getItem(k){return store[k]??null},setItem(k,v){store[k]=String(v)}},
  fetch:async()=>{throw new Error('fetch should not run in unit tests')},
  window:{print(){}}
};
vm.createContext(ctx);
let src=raw.split('<script>')[1].split('</script>')[0];
src=src.slice(0,src.lastIndexOf('/* boot */'));
vm.runInContext(src,ctx);

const now=Date.parse('2026-11-15T00:30:00+08:00');
const days=vm.runInContext('planDays('+now+')',ctx);
assert.deepStrictEqual([...days],['2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21'],'seven days start from today in PHT');
const next=vm.runInContext('planDays('+Date.parse('2026-11-16T08:00:00+08:00')+')',ctx);
assert.strictEqual(next[0],'2026-11-16','the window rolls forward the next morning');
assert.strictEqual(next[6],'2026-11-22','the seventh day is today plus six');

assert(vm.runInContext('isFresh('+(now-11*3600e3)+','+now+')',ctx),'11-hour snapshot is fresh');
assert(!vm.runInContext('isFresh('+(now-13*3600e3)+','+now+')',ctx),'13-hour snapshot is stale');
assert(!vm.runInContext('isFresh(null,'+now+')',ctx),'missing timestamp is not fresh');

assert.strictEqual(vm.runInContext('kph(10)',ctx),19,'10 kn is 19 kph');
assert.strictEqual(vm.runInContext('kph(null)',ctx),null,'missing wind stays UNAVAILABLE, not invented');

function hour(day,hr,opts={}){
  const sea=opts.sea||'GOOD';
  const rating=opts.rating||sea;
  const w=opts.w==null?10:opts.w;
  return {day,hour:hr,w_kph:opts.missing?null:w,g_kph:opts.missing?null:w+2,dir:'NE',ck:0.3,cdir:'SW',rating,sea,mm:0};
}
function night(start,opts){
  const nxt=vm.runInContext(`addDays(${JSON.stringify(start)},1)`,ctx);
  const out=[];
  for(let h=18;h<24;h++)out.push(hour(start,h,opts));
  for(let h=0;h<6;h++)out.push(hour(nxt,h,opts));
  return out;
}
const iceFull=vm.runInContext('iceAndCatch('+JSON.stringify([night('2026-11-13'),night('2026-11-14')])+')',ctx);
assert.deepStrictEqual({ice:iceFull.ice,catch:iceFull.catch,supply:iceFull.supply},{ice:'Full',catch:'High',supply:'Supply'},'two good nights => full ice, high catch, supply');

const iceLittle=vm.runInContext('iceAndCatch('+JSON.stringify([night('2026-11-13',{sea:'POOR',rating:'POOR',w:22}),night('2026-11-14',{sea:'POOR',rating:'POOR',w:22})])+')',ctx);
assert.deepStrictEqual({ice:iceLittle.ice,catch:iceLittle.catch,supply:iceLittle.supply},{ice:'Little',catch:'Very light',supply:'Hold'},'two poor nights => little ice, hold');

const iceNa=vm.runInContext('iceAndCatch('+JSON.stringify([[],[]])+')',ctx);
assert.strictEqual(iceNa.ice,'UNAVAILABLE','missing hours are UNAVAILABLE, not invented');

assert.strictEqual(vm.runInContext('confidence("2026-11-15",'+now+')',ctx),'High','today is High confidence');
assert.strictEqual(vm.runInContext('confidence("2026-11-16",'+now+')',ctx),'High','tomorrow (still within 48h of midnight today+buffer) uses the day-start rule');
// now is 00:30 on the 15th; 48h later is 00:30 on the 17th; the 17th starts at 00:00 on the 17th, which is within 48h
assert.strictEqual(vm.runInContext('confidence("2026-11-17",'+now+')',ctx),'High','day starting within 48h is High');
assert.strictEqual(vm.runInContext('confidence("2026-11-18",'+now+')',ctx),'Lower','after 48h confidence is Lower');

assert.strictEqual(vm.runInContext('fmtPht('+now+')',ctx),'Sun 15 Nov 2026, 12:30 AM PHT','Updated time is in PHT');
assert.strictEqual(vm.runInContext('mdLabel("2026-11-15")',ctx),'Nov 15','date is short month name plus day');
assert.strictEqual(vm.runInContext('weekdayLong("2026-11-15")',ctx),'Sunday','weekday is the full name');
assert.strictEqual(vm.runInContext('dayLabel("2026-11-15")',ctx),'Nov 15 Sunday','plain label is date then weekday');
assert.strictEqual(vm.runInContext('mdLabel("2026-01-05")',ctx),'Jan 5','January uses a short month name too');

const jsonPath=path.join(__dirname,'../galoc/fresh7.json');
assert(fs.existsSync(jsonPath),'published snapshot exists');
const snap=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
assert(Number.isFinite(snap.at),'snapshot has an issue time');
assert(snap.areas&&snap.areas.galoc&&snap.areas.coron,'snapshot has Galoc and Coron');
assert((snap.areas.galoc.ecmwf.hourly.time||[]).length>=24,'Galoc ECMWF hours are present');
assert((snap.areas.galoc.marine.hourly.time||[]).length>=24,'Galoc Marine hours are present');

const payload=snap;
const rendered=vm.runInContext('render('+JSON.stringify(payload)+','+now+')',ctx);
assert.deepStrictEqual([...rendered.days],[...days],'render uses the next 7 days from today, not a fixed week');
assert.strictEqual(rendered.galoc.length,7,'Galoc has 7 day rows');
assert.strictEqual(rendered.coron.length,7,'Coron has 7 day rows');
assert(nodes.updated.textContent.includes('PHT'),'Updated line shows PHT');
assert(/class="day /.test(nodes.galoc.innerHTML),'Galoc day cards are rendered');
assert(/>(GOOD|CAUTION|WARNING|UNAVAILABLE)</.test(nodes.galoc.innerHTML),'one plain-word verdict per day');
assert(/Ice: (Yes|Ready less|No|UNAVAILABLE)/.test(nodes.galoc.innerHTML)&&/Supply: (Yes|Ready less|No|UNAVAILABLE)/.test(nodes.galoc.innerHTML),'ice and supply in plain words');
assert(!/ECMWF|GFS|landing lag/.test(nodes.sum.innerHTML+nodes.notes.innerHTML),'no model jargon in the summary or notes');
assert(/Wind: /.test(nodes.galoc.innerHTML)&&/Current: /.test(nodes.galoc.innerHTML),'Galoc shows Wind and Current lines');
assert(/Wind: /.test(nodes.coron.innerHTML)&&/Current: /.test(nodes.coron.innerHTML),'Coron shows Wind and Current lines');
assert(/kph from /.test(nodes.galoc.innerHTML)||/Wind: UNAVAILABLE/.test(nodes.galoc.innerHTML),'wind is in kph with a direction when known');
assert(/(weak|medium|strong) \(\d+\.\d+ kt\)/.test(nodes.galoc.innerHTML)||/Current: UNAVAILABLE/.test(nodes.galoc.innerHTML),'current uses weak/medium/strong and kt, or UNAVAILABLE');
assert.strictEqual(vm.runInContext('nightWind([{w_kph:10,dir:"NE"},{w_kph:22,dir:"E"}]).text',ctx),'22 kph from E','night wind is the max fishing-hour wind');
assert.strictEqual(vm.runInContext('nightWind([{w_kph:10,dir:"NE"},{w_kph:22,dir:"E"}]).over',ctx),true,'wind above 18 kph is flagged');
assert.strictEqual(vm.runInContext('nightWind([{w_kph:null},{w_kph:null}]).text',ctx),'UNAVAILABLE','missing wind is UNAVAILABLE');
assert.strictEqual(vm.runInContext('nightCurrent([{ck:0.3},{ck:0.6}]).text',ctx),'medium (0.6 kt)','current word follows the max fishing-hour current');
assert.strictEqual(vm.runInContext('nightCurrent([]).text',ctx),'UNAVAILABLE','missing current is UNAVAILABLE');
assert.strictEqual(vm.runInContext('currentWord(0.2)',ctx),'weak');
assert.strictEqual(vm.runInContext('currentWord(0.5)',ctx),'medium');
assert.strictEqual(vm.runInContext('currentWord(1.2)',ctx),'strong');
assert(nodes.galoc.innerHTML.includes('Nov 15')&&nodes.galoc.innerHTML.includes('Sunday')&&nodes.galoc.innerHTML.includes('Saturday'),'Galoc table uses Nov 15 over weekday');
assert(nodes.coron.innerHTML.includes('Nov 15')&&nodes.coron.innerHTML.includes('Sunday'),'Coron table uses the same date labels');
assert(nodes.sum.innerHTML.includes('Nov 15')&&nodes.sum.innerHTML.includes('Sunday'),'summary uses short month name and weekday');
assert(/class="md"/.test(nodes.galoc.innerHTML)&&/<span class="wk">Sunday<\/span>/.test(nodes.galoc.innerHTML),'date is on top and weekday is on the line below');
const wed=rendered.galoc.find(r=>r.day==='2026-11-18');
assert(wed&&wed.conf==='Lower'&&wed.md==='Nov 18'&&wed.wk==='Wednesday','Wed 18 keeps * data and the new labels');
assert(/GOOD/.test(raw)&&/CAUTION/.test(raw)&&/WARNING/.test(raw),'color key uses plain words');
assert.strictEqual(vm.runInContext('plainVerdict({fishing:"GOOD / MARGINAL"})',ctx),'CAUTION','marginal is CAUTION');
assert.strictEqual(vm.runInContext('plainVerdict({fishing:"VERY POOR"})',ctx),'WARNING','very poor is WARNING');
assert.strictEqual(vm.runInContext('plainVerdict({fishing:"UNAVAILABLE"})',ctx),'UNAVAILABLE','missing stays UNAVAILABLE');
assert.strictEqual(vm.runInContext('iceWords("Some")',ctx),'Ready less','some ice is Ready less');
assert.strictEqual(vm.runInContext('supplyWords("Hold")',ctx),'No','hold is No');
console.log('fresh7 tests ok');
console.log('Galoc verdicts:');
for(const r of rendered.galoc){
  console.log(`  ${r.md} ${r.wk}  ${vm.runInContext('plainVerdict('+JSON.stringify(r)+')',ctx)}  Ice: ${vm.runInContext('iceWords('+JSON.stringify(r.ice)+')',ctx)}  Supply: ${vm.runInContext('supplyWords('+JSON.stringify(r.supply)+')',ctx)}  Wind: ${r.goWindText}  Current: ${r.goCurrentText}`);
}
