// Synthetic fixtures only; these are not real weather readings.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes={};const node=id=>nodes[id]??=( {textContent:'',innerHTML:'',value:'0',checked:true,disabled:false,className:'',attrs:{},style:{},parentNode:{classList:{toggle(){}}},setAttribute(k,v){this.attrs[k]=v},classList:{toggle(){}},closest(){return null}});
const ctx={console,Date,URLSearchParams,Set,Number,Math,JSON,setTimeout,clearTimeout,setInterval,clearInterval,document:{getElementById:node,addEventListener(){}},addEventListener(){},localStorage:{getItem(){return null},setItem(){}}};
vm.createContext(ctx);
const raw=fs.readFileSync(require('path').join(__dirname,'../galoc/index.html'),'utf8');
assert(raw.includes("DATA_URL='../data.json'"),'Galoc page reads ../data.json');
assert(!/leaflet/i.test(raw),'no Leaflet on the light Galoc page');
assert(/18 kph line/.test(raw)&&/means gust/.test(raw),'18 kph line and gust legend are visible');
let src=raw.split('<script>')[1].split('</script>')[0];
src=src.slice(0,src.lastIndexOf('/* boot */'));
vm.runInContext(src,ctx);
vm.runInContext(`
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
assert(DATA_URL==='../data.json','data path');
assert(FORECAST_DAYS==='8'&&PAST_HOURS===48,'forecast window');
const found=galocFrom({areas:[{id:'coron',name:'Coron'},{id:'galoc',name:'Galoc',lat:11.9273,lng:119.8768}]});
assert(found&&found.id==='galoc'&&found.lat===11.9273,'galocFrom picks only Galoc');
assert(galocFrom({areas:[{id:'tara',name:'Tara'}]})===null,'missing Galoc is null');
const time=['2026-11-09T06:00','2026-11-09T07:00','2026-11-09T08:00','2026-11-09T09:00'];
const area={id:'galoc',name:'Galoc'};
const fixture={at:tPHT(time[2]),ids:'galoc',ecmwf:[{hourly:{time,wind_speed_10m:[2,3,4,23],wind_gusts_10m:[4,5,6,30],wind_direction_10m:[0,45,90,135],precipitation:[0,0,0,2]}}],marine:[{hourly_units:{ocean_current_velocity:'km/h'},hourly:{time:[time[0],time[2],time[3]],ocean_current_velocity:[0,0.4,4],ocean_current_direction:[0,90,180]}}]};
let result=computeLive(area,0,fixture,time[2]);
assert(result.rating==='GOOD','complete calm fixture GOOD');
assert(result.wind.kt===4&&result.wind.gustKt===6&&result.wind.dir==='E','wind/gust/direction selected correctly');
assert(result.current.kt===0.2&&result.current.dir==='E','Marine timestamp match, not index');
assert(result.rain.mmHour===0&&result.rain.mm3h===0,'hourly and trailing rain');
result=computeLive(area,0,fixture,time[3]);
assert(result.rating==='VERY POOR'&&result.wind.kt===23&&result.current.dir==='S','future fixture updates all fields and rating');
result=computeLive(area,0,fixture,time[1]);assert(result.current.kt===null&&result.rating===U,'missing exact marine hour unavailable');
result=computeLive(area,0,fixture,'2026-11-10T00:00');assert(result.wind.kt===null&&result.current.kt===null&&result.rating===U,'outside coverage unavailable');
assert(rain3([0,null,0],2)===null&&rain3([0,0],1)===null,'rain requires all three hours');
fixture.ecmwf[0].hourly.wind_speed_10m[2]=null;assert(computeLive(area,0,fixture,time[2]).rating===U,'null wind not GOOD');fixture.ecmwf[0].hourly.wind_speed_10m[2]=4;
fixture.ecmwf[0].hourly.precipitation[1]=null;assert(computeLive(area,0,fixture,time[2]).rating===U,'missing rain not GOOD');fixture.ecmwf[0].hourly.precipitation[1]=0;
assert(computeLive(area,0,{...fixture,marine:null},time[2]).rating===U,'missing entire Marine API not GOOD');
assert(kph(10)===19&&kph(9.7)===18&&kph(0)===0&&kph(null)===null,'kt x 1.852 rounded');
assert(windTone(18)==='near'&&windTone(17)==='near'&&windTone(16)==='ok'&&windTone(19)==='bad','18 kph threshold tones');
assert(windLabel({kt:17.3,gustKt:24.3,deg:67.5})==='ENE 32 kph g45','label format');
assert(windLabel({kt:null,gustKt:5,deg:90})==='wind UNAVAILABLE'&&windLabel(null)==='wind UNAVAILABLE','missing wind label');
assert(currentLabel({kt:1.6,dir:'NW'})==='Current → NW 1.6 kt'&&currentLabel({kt:0,dir:'E'})==='Current → E 0.0 kt','current label format');
assert(currentLabel({kt:null,dir:null})==='Current UNAVAILABLE'&&currentLabel(null)==='Current UNAVAILABLE','missing current');
assert(curTone(0.49)==='fav'&&curTone(0.5)==='mod'&&curTone(0.89)==='mod'&&curTone(0.9)==='str'&&curTone(1.49)==='str'&&curTone(1.5)==='vs'&&curTone(null)==='na','current scale');
assert(!/ECMWF/.test(currentLabel({kt:1,dir:'N'})),'current never labelled ECMWF');
assert(forecastLabel(time[2]).includes('8:00 AM')&&forecastLabel(time[2]).endsWith('PHT'),'PHT date/hour');
AREA=area;D={areas:[area],reportTime:'Fri 13 Nov 2026 · ~6:20 AM PHT · morning'};LIVE=fixture;selectedTime=time[3];forecastTimes=time;
const view=currentView();
assert(view._forecast&&view.rating==='VERY POOR'&&view.wind.kt===23,'selected-hour overlay');
selectedTime='2026-11-10T00:00';forecastTimes=time.concat(['2026-11-10T00:00']);
assert(currentView().rating===U&&currentView().wind.kt===null,'no report substitution');
forecastTimes=time;selectedTime=null;
assert(!currentView()._forecast&&currentView().rating==null,'report marked snapshot when no forecast hour');
const h=(t,rating,wkt,ckt)=>({time:t,rating,wind:{kt:wkt,gustKt:wkt+2,dir:'E',deg:90},current:{kt:ckt,dir:'W'},rain:{mm3h:0,intensity:'Light'},score:hourScore(wkt,ckt,0)});
const goodHours=[h(time[0],'GOOD',4,0.3),h(time[1],'GOOD',4,0.3),h(time[2],'GOOD',5,0.3),h(time[3],'POOR',18,0.3)];
const runs=bestRuns(goodHours);
assert(runs.length===1&&runs[0].length===3&&runs[0][0].rating==='GOOD','best window is the GOOD stretch');
assert(describeRun(runs[0]).includes('GOOD')&&describeRun(runs[0]).includes('kph')&&describeRun(runs[0]).includes('0.3 kt'),'window text uses kph and current');
assert(bestRuns([h(time[0],'POOR',18,0.2),h(time[1],'VERY POOR',22,0.2)]).length===0,'no window when nothing is good or marginal');
assert(bestRuns([h(time[0],'MARGINAL',12,0.6),h(time[1],'MARGINAL',12,0.6)])[0][0].rating==='MARGINAL','falls back to marginal stretch');
const mixed=bestRuns([h(time[0],'GOOD',4,0.3),h(time[1],'POOR',18,0.3),h(time[2],'GOOD',4,0.3),h(time[3],'GOOD',4,0.3)]);
assert(mixed.length===2&&mixed[0][0].time===time[0]&&mixed[1][0].time===time[2],'windows listed in time order');

assert(hourSpan('2026-11-13T00:00','2026-11-13T23:00')==='All day','full day is All day, not 12 AM');
assert(hourSpan('2026-11-13T10:00','2026-11-13T23:00')==='10 AM–12 AM','do not collapse a long range to 10–12 AM');
assert(hourSpan('2026-11-13T17:00','2026-11-13T22:00')==='5–11 PM','same-afternoon collapse');
assert(hourSpan('2026-11-13T07:00','2026-11-13T07:00')==='7–8 AM','single hour uses exclusive end');

console.log('PASS: Galoc extract, ratings, UNAVAILABLE, 18 kph, current scale, no ECMWF current, windows');
`,ctx);

vm.runInContext(`
forecastTimes=time;selectedTime=time[2];
LIVE={at:tPHT(time[2]),ids:'galoc',ecmwf:[{hourly:{time,wind_speed_10m:[2,3,4,23],wind_gusts_10m:[4,5,6,30],wind_direction_10m:[0,45,90,135],precipitation:[0,0,0,2]}}],marine:[{hourly_units:{ocean_current_velocity:'km/h'},hourly:{time,ocean_current_velocity:[0,0,0.4,4],ocean_current_direction:[0,90,90,180]}}]};
AREA={id:'galoc',name:'Galoc'};D={areas:[AREA],reportTime:'Fri 13 Nov 2026 · ~6:20 AM PHT · morning'};
chooseForecast(3);assert(selectedTime===time[3]&&$('forecast-slider').value==='3','slider updates selected timestamp');
assert($('forecast-time').textContent.includes('9:00 AM'),'forecast label follows slider');
assert($('map-forecast-time').textContent.includes('9:00 AM')&&$('map-forecast-time').textContent.endsWith('PHT'),'clock follows slider with PHT');
$('forecast-play').onclick();assert(playTimer!==null&&selectedTime===time[0],'play restarts at end');
$('forecast-play').onclick();assert(playTimer===null&&$('forecast-play').textContent==='▶ Play','pause stops timer');
console.log('PASS: slider selection, date label, play restart and pause');
`,ctx);

vm.runInContext(`
var H=36e5,NOW=Date.UTC(2026,10,11,10,10);
const pht=ms=>new Date(ms+8*H).toISOString().slice(0,16);
assert(pht(nowHourMs(NOW))==='2026-11-11T18:00','current hour PHT');
assert(isPast('2026-11-11T17:00',NOW)&&!isPast('2026-11-11T18:00',NOW),'isPast');
assert(timeLabel('2026-11-09T18:00',NOW)==='Past · Mon, Nov 9, 2026, 6:00 PM PHT','past label');
const realNow=Date.now(),RT2=[];for(let t=nowHourMs(realNow)-60*H;t<=nowHourMs(realNow)+60*H;t+=H)RT2.push(pht(t));
AREA={id:'galoc',name:'Galoc',lat:11.9,lng:119.8,wind:{kt:99},rain:{mm3h:0},current:{kt:9},rating:'GOOD'};
D={areas:[AREA],reportTime:'Fri 13 Nov 2026 · ~6:20 AM PHT · morning'};
LIVE={at:realNow,ids:'galoc',ecmwf:[{hourly:{time:RT2,wind_speed_10m:RT2.map((_,i)=>i%7),wind_gusts_10m:RT2.map((_,i)=>i%7),wind_direction_10m:RT2.map((_,i)=>i%7),precipitation:RT2.map(()=>0)}}],marine:[{hourly_units:{ocean_current_velocity:'km/h'},hourly:{time:RT2,ocean_current_velocity:RT2.map(()=>0.5),ocean_current_direction:RT2.map(()=>90)}}]};
const saveRender=render;render=()=>{};selectedTime=null;
rebuildForecastTimes();
assert(forecastTimes[0]===pht(nowHourMs(realNow)-48*H)&&forecastTimes[forecastTimes.length-1]===RT2[RT2.length-1],'slider spans now-48h to forecast end');
assert(selectedTime===pht(nowHourMs(realNow)),'default selection is the current hour');
$('forecast-m48').onclick();assert(selectedTime===forecastTimes[0]&&$('forecast-time').textContent.startsWith('Past · '),'-48h jump + Past label');
assert($('map-forecast-time').textContent.startsWith('Past · ')&&$('past-hint').textContent.includes('landing'),'past clock + landing hint');
const m=currentView();assert(m._forecast&&m.wind.kt!==99&&m.current.kt!==9,'past hour uses model values, not report');
$('forecast-m24').onclick();assert(selectedTime===pht(nowHourMs(realNow)-24*H),'-24h jump');
$('forecast-now').onclick();assert(selectedTime===pht(nowHourMs(realNow))&&$('forecast-time').textContent.startsWith('Forecast for')&&$('past-hint').textContent==='','Now returns to current hour');
const keep=LIVE.ecmwf[0].hourly.wind_speed_10m.slice();LIVE.ecmwf[0].hourly.wind_speed_10m=keep.map(()=>null);assert(currentView().rating===U&&currentView().wind.kt===null,'missing past data UNAVAILABLE');LIVE.ecmwf[0].hourly.wind_speed_10m=keep;
render=saveRender;
`,ctx);

vm.runInContext(`
var urls=[];getJSON=async u=>{urls.push(u);return [{}]};
fetchLive([{id:'galoc',lat:11.9273,lng:119.8768}]).then(()=>{
  assert(urls.length===2,'two requests');
  assert(urls.every(u=>u.includes('past_days=2')&&u.includes('forecast_days=8')&&u.includes('timezone=Asia%2FManila')),'past_days, 8-day forecast, PHT');
  assert(urls.every(u=>u.includes('11.9273')&&u.includes('119.8768')),'Galoc coordinates only');
  console.log('PASS: past 48h window, labels, jumps, Now, Galoc-only fetch, past_days requests');
}).catch(e=>{console.error(e);process_exit(1)});
`,Object.assign(ctx,{process_exit:c=>process.exit(c)}));
