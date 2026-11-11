// Synthetic fixtures only; these are not real weather readings.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes={};const node=id=>nodes[id]??=( {textContent:'',innerHTML:'',value:'0',checked:true,disabled:false,className:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},classList:{toggle(){}}});
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
