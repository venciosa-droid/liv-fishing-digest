// Synthetic fixtures only; these are not real weather readings.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes={};const node=id=>nodes[id]??=( {textContent:'',innerHTML:'',value:'0',checked:true,disabled:false,className:'',attrs:{},style:{},parentNode:{classList:{toggle(){}}},setAttribute(k,v){this.attrs[k]=v},classList:{toggle(){}}});
const ctx={console,Date,URLSearchParams,Set,Number,Math,JSON,setTimeout,clearTimeout,setInterval,clearInterval,document:{getElementById:node,addEventListener(){}},addEventListener(){},localStorage:{getItem(){return null},setItem(){}}};
vm.createContext(ctx);
let src=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8').split('<script>')[1].split('</script>')[0];src=src.slice(0,src.lastIndexOf('\ninitMap();'));
vm.runInContext(src,ctx);
vm.runInContext(`
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const time=['2026-11-09T06:00','2026-11-09T07:00','2026-11-09T08:00','2026-11-09T09:00'];
const area={id:'one',name:'Test fixture'};
const fixture={at:tPHT(time[2]),ids:'one',ecmwf:[{hourly:{time,wind_speed_10m:[2,3,4,23],wind_gusts_10m:[4,5,6,30],wind_direction_10m:[0,45,90,135],precipitation:[0,0,0,2]}}],marine:[{hourly_units:{ocean_current_velocity:'km/h'},hourly:{time:[time[0],time[2],time[3]],ocean_current_velocity:[0,0.4,4],ocean_current_direction:[0,90,180]}}]};
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
D={areas:[{...area,wind:{kt:1},rain:{mm3h:0},current:{kt:0},rating:'GOOD'}]};LIVE=fixture;selectedTime=time[3];
assert(merged()[0].wind.kt===23&&merged()[0].rating==='VERY POOR','selected-hour map overlay');
selectedTime='2026-11-10T00:00';assert(merged()[0].rating===U&&merged()[0].wind.kt===null,'no report substitution');
selectedTime=null;assert(!merged()[0]._forecast,'report marked snapshot when no forecast');
assert(forecastLabel(time[2]).includes('8:00 AM')&&forecastLabel(time[2]).endsWith('PHT'),'PHT date/hour');
console.log('PASS: timestamp alignment, forecast overlay, wind/gust/direction, rain completeness, nulls, missing sources, no fallback, PHT labels');
`,ctx);
// Test controls without rendering map: actual handlers with a synthetic timeline.
vm.runInContext(`
D=null;forecastTimes=time;selectedTime=time[2];LIVE=fixture;
chooseForecast(3);assert(selectedTime===time[3]&&$('forecast-slider').value==='3','slider updates selected timestamp');
assert($('forecast-time').textContent.includes('9:00 AM'),'forecast label follows slider');
assert($('map-forecast-time').textContent.includes('9:00 AM')&&$('map-forecast-time').textContent.includes('2026')&&$('map-forecast-time').textContent.endsWith('PHT'),'map date/time follows slider with year and PHT');
$('forecast-play').onclick();assert(playTimer!==null&&selectedTime===time[0],'play restarts at end');
$('forecast-play').onclick();assert(playTimer===null&&$('forecast-play').textContent==='▶ Play','pause stops timer');
console.log('PASS: slider selection, date label, play restart and pause');
`,ctx);
// Wind display helpers (display only; fishing rating rules unchanged).
vm.runInContext(`
assert(kph(10)===19&&kph(9.7)===18&&kph(0)===0&&kph(null)===null&&kph('')===null,'kt x 1.852 rounded');
assert(compass(0)==='N'&&compass(67.5)==='ENE'&&compass(359)==='N'&&compass(11.2)==='N'&&compass(11.3)==='NNE'&&compass(200)==='SSW'&&compass(null)==='—','direction to 16-point compass');
assert(windToward(90)===270&&windToward(0)===180&&windToward(270)===90&&windToward(350)===170&&windToward(null)===null,'arrow points blowing toward (from+180)');
assert(windTone(18)==='near'&&windTone(17)==='near'&&windTone(16)==='ok'&&windTone(19)==='bad'&&windTone(null)==='na','18 kph threshold tones');
assert(WINDCOL.ok==='#22c55e'&&WINDCOL.bad==='#ef4444','green/red colors');
assert(windLabel({kt:17.3,gustKt:24.3,deg:67.5})==='ENE 32 kph g45','label format');
assert(windLabel({kt:null,gustKt:5,deg:90})==='wind UNAVAILABLE'&&windLabel(null)==='wind UNAVAILABLE','missing wind label');
assert(windLabel({kt:12.3,gustKt:18.1,dir:'ESE'})==='ESE 23 kph g34','report snapshot compass fallback');
let r=computeLive(area,0,fixture,time[3]);assert(r.wind.deg===135&&windToward(r.wind.deg)===315&&windLabel(r.wind)==='SE 43 kph g56','forecast hour wind degrees');
fixture.ecmwf[0].hourly.wind_speed_10m[3]=null;r=computeLive(area,0,fixture,time[3]);assert(r.wind.deg===null&&windLabel(r.wind)==='wind UNAVAILABLE','no arrow without speed');
console.log('PASS: kph conversion, compass mapping, arrow rotation, 18 kph threshold colors, UNAVAILABLE label');
`,ctx);
// Current line under the wind label (Open-Meteo Marine).
vm.runInContext(`
assert(currentLabel({kt:1.6,dir:'NW'})==='Current → NW 1.6 kt'&&currentLabel({kt:0,dir:'E'})==='Current → E 0.0 kt','current label format');
assert(currentLabel({kt:null,dir:null})==='Current UNAVAILABLE'&&currentLabel(null)==='Current UNAVAILABLE'&&currentLabel({kt:'',dir:'N'})==='Current UNAVAILABLE','missing current');
assert(curTone(0.49)==='fav'&&curTone(0.5)==='mod'&&curTone(0.89)==='mod'&&curTone(0.9)==='str'&&curTone(1.49)==='str'&&curTone(1.5)==='vs'&&curTone(null)==='na','current scale matches curClass');
[0.2,0.5,0.9,1.5].forEach((k,i)=>assert(curClass(k)===['Favorable','Moderate','Strong','Very Strong'][i],'curClass unchanged'));
fixture.ecmwf[0].hourly.wind_speed_10m[3]=23;
let c=computeLive(area,0,fixture,time[3]).current;assert(currentLabel(c)==='Current → S 2.2 kt'&&curTone(c.kt)==='vs','forecast hour current label (4 km/h)');
c=computeLive(area,0,fixture,time[1]).current;assert(currentLabel(c)==='Current UNAVAILABLE','missing marine hour shows UNAVAILABLE');
assert(!/ECMWF/.test(currentLabel({kt:1,dir:'N'})),'never labelled ECMWF');
console.log('PASS: current line label, color scale, UNAVAILABLE, slider hour');
`,ctx);
// Past 48 hours: slider window, labels, jumps, Now, no report fallback, fetch params.
vm.runInContext(`
const H=36e5,NOW=Date.UTC(2026,10,11,10,10);   // Wed 11 Nov 2026 18:10 PHT
const pht=ms=>new Date(ms+8*H).toISOString().slice(0,16);
assert(pht(nowHourMs(NOW))==='2026-11-11T18:00','current hour PHT');
assert(isPast('2026-11-11T17:00',NOW)&&!isPast('2026-11-11T18:00',NOW)&&!isPast('2026-11-12T06:00',NOW),'isPast');
assert(timeLabel('2026-11-09T18:00',NOW)==='Past · Mon, Nov 9, 2026, 6:00 PM PHT'&&timeLabel('2026-11-12T06:00',NOW).startsWith('Forecast for Thu'),'past/forecast labels');
assert(dayWord('2026-11-10T08:00',NOW)==='Yesterday'&&dayWord('2026-11-09T20:00',NOW)==='2 days ago'&&dayWord('2026-11-11T02:00',NOW)==='Earlier today','day words');
const T=[];for(let t=Date.UTC(2026,10,8,16);t<=Date.UTC(2026,10,13,15);t+=H)T.push(pht(t));   // Nov 9 00:00 .. Nov 13 23:00 PHT
assert(T.length===120,'120 hourly steps');
assert(T[hoursAgoIdx(T,0,NOW)]==='2026-11-11T18:00'&&T[hoursAgoIdx(T,24,NOW)]==='2026-11-10T18:00'&&T[hoursAgoIdx(T,48,NOW)]==='2026-11-09T18:00','jump indexes');
// rebuild against the real clock with synthetic times around now
const realNow=Date.now(),RT2=[];for(let t=nowHourMs(realNow)-60*H;t<=nowHourMs(realNow)+60*H;t+=H)RT2.push(pht(t));
const series=n=>RT2.map((_,i)=>i%7);
D={areas:[{id:'one',name:'Fixture',lat:0,lng:0,wind:{kt:99},rain:{mm3h:0},current:{kt:9},rating:'GOOD'}]};
LIVE={at:realNow,ids:'one',ecmwf:[{hourly:{time:RT2,wind_speed_10m:series(),wind_gusts_10m:series(),wind_direction_10m:series(),precipitation:RT2.map(()=>0)}}],marine:[{hourly_units:{ocean_current_velocity:'km/h'},hourly:{time:RT2,ocean_current_velocity:RT2.map(()=>0.5),ocean_current_direction:RT2.map(()=>90)}}]};
const saveRender=renderMap;renderMap=()=>{};selectedTime=null;
rebuildForecastTimes();
assert(forecastTimes[0]===pht(nowHourMs(realNow)-48*H)&&forecastTimes[forecastTimes.length-1]===RT2[RT2.length-1],'slider spans now-48h to forecast end');
assert(selectedTime===pht(nowHourMs(realNow)),'default selection is the current hour, not slider start');
$('forecast-m48').onclick();assert(selectedTime===forecastTimes[0]&&$('forecast-time').textContent.startsWith('Past · '),'-48h jump + Past label');
assert($('map-forecast-time').textContent.startsWith('Past · ')&&$('past-hint').textContent.includes('landing'),'map clock past + landing hint');
const m=merged()[0];assert(m._forecast&&m.wind.kt!==99&&m.current.kt!==9,'past hour uses model values, not report');
$('forecast-m24').onclick();assert(selectedTime===pht(nowHourMs(realNow)-24*H),'-24h jump');
$('forecast-now').onclick();assert(selectedTime===pht(nowHourMs(realNow))&&$('forecast-time').textContent.startsWith('Forecast for')&&$('past-hint').textContent==='','Now returns to current hour');
$('forecast-m48').onclick();$('forecast-play').onclick();assert(selectedTime===forecastTimes[0]&&playTimer!==null,'play starts from selected past hour');stopPlayback();
const keep=LIVE.ecmwf[0].hourly.wind_speed_10m.slice();LIVE.ecmwf[0].hourly.wind_speed_10m=keep.map(()=>null);assert(merged()[0].rating===U&&merged()[0].wind.kt===null,'missing past data UNAVAILABLE');LIVE.ecmwf[0].hourly.wind_speed_10m=keep;
renderMap=saveRender;
`,ctx);
vm.runInContext(`
var urls=[];getJSON=async u=>{urls.push(u);return [{}]};
fetchLive([{id:'one',lat:1,lng:2}]).then(()=>{assert(urls.length===2&&urls.every(u=>u.includes('past_days=2')&&u.includes('forecast_days=3')&&u.includes('timezone=Asia%2FManila')),'past_days on both requests');console.log('PASS: past 48h window, labels, jumps, Now, play, no fallback, past_days requests')}).catch(e=>{console.error(e);process_exit(1)});
`,Object.assign(ctx,{process_exit:c=>process.exit(c)}));
