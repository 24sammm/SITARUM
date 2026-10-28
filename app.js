const portGeoJSON=window.harborPortData;
const awsGeoJSON=window.sipelAwsData;
const argGeoJSON=window.sitarumArgData;
const wharves=portGeoJSON.features.map(feature=>({
  ...feature.properties,
  coords:[feature.geometry.coordinates[1],feature.geometry.coordinates[0]]
}));
const awsStations=awsGeoJSON.features.map(feature=>({
  ...feature.properties,
  coords:[feature.geometry.coordinates[1],feature.geometry.coordinates[0]]
}));
const argStations=argGeoJSON.features.map(feature=>({
  ...feature.properties,
  coords:[feature.geometry.coordinates[1],feature.geometry.coordinates[0]]
}));
const categoryLabels={
  umum:'Pelabuhan umum',
  penyeberangan:'Pelabuhan penyeberangan',
  perikanan:'Pelabuhan perikanan',
  khusus:'Terminal khusus (Tersus/TUKS)'
};
const initialCenter=[-6.15,106.15],initialZoom=8.4;
const map=L.map('map',{zoomControl:false,scrollWheelZoom:true}).setView(initialCenter,initialZoom);
const streetMap=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19,crossOrigin:'anonymous'
});
const imageryMap=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
  attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',maxZoom:19,crossOrigin:'anonymous'
});
streetMap.addTo(map);
const basemapControl=L.control({position:'topright'});
basemapControl.onAdd=()=>{
  const container=L.DomUtil.create('div','basemap-picker leaflet-control');
  container.innerHTML='<button class="basemap-trigger" type="button" aria-expanded="false" aria-haspopup="true"><span>Basemap</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button><div class="basemap-menu" hidden><button type="button" class="basemap-option is-active" data-basemap="street"><span>Peta jalan</span><span class="basemap-check" aria-hidden="true">✓</span></button><button type="button" class="basemap-option" data-basemap="imagery"><span>Imagery</span><span class="basemap-check" aria-hidden="true">✓</span></button></div>';
  const trigger=container.querySelector('.basemap-trigger'),menu=container.querySelector('.basemap-menu');
  const closeMenu=()=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false')};
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.on(trigger,'click',()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden))});
  L.DomEvent.on(container,'click',event=>{
    const option=event.target.closest('[data-basemap]');
    if(!option)return;
    const imagery=option.dataset.basemap==='imagery';
    if(imagery){map.removeLayer(streetMap);imageryMap.addTo(map)}
    else{map.removeLayer(imageryMap);streetMap.addTo(map)}
    container.querySelectorAll('.basemap-option').forEach(button=>button.classList.toggle('is-active',button===option));
    const label=imagery?'Imagery © Esri':'Basemap © OpenStreetMap';
    document.getElementById('basemapCredit').innerHTML=`<i></i> ${label}`;
    closeMenu();
  });
  map.on('click',closeMenu);
  return container;
};
basemapControl.addTo(map);
L.control.zoom({position:'topleft'}).addTo(map);
const markerLayer=L.layerGroup().addTo(map);
const awsMarkerLayer=L.layerGroup().addTo(map);
const argMarkerLayer=L.layerGroup().addTo(map);
const typeInputs=[...document.querySelectorAll('[data-filter]')];
const regionInputs=[...document.querySelectorAll('[data-region]')];
const awsToggle=document.getElementById('awsToggle');
const argToggle=document.getElementById('argToggle');
const toast=document.getElementById('toast'),exportBtn=document.getElementById('exportBtn'),exportMenu=document.getElementById('exportMenu');
let toastTimer;

function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2800)}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function selectedTypes(){return typeInputs.filter(input=>input.checked).map(input=>input.dataset.filter)}
function selectedRegions(){return regionInputs.filter(input=>input.checked).map(input=>input.dataset.region)}
function getVisiblePoints(){const types=selectedTypes(),regions=selectedRegions();return wharves.filter(point=>types.includes(point.category)&&regions.includes(point.district))}
function getExportPoints(){
  const portRows=getVisiblePoints().map(point=>({name:point.name,category:categoryLabels[point.category],siteId:'',sourceCategory:'',district:point.district,coords:point.coords,datum:'WGS 84',source:point.source}));
  const awsRows=awsToggle.checked?awsStations.map(point=>({name:point.name,category:'Stasiun AWS BMKG',siteId:point.siteId,sourceCategory:'AWS',district:'',coords:point.coords,datum:point.datum,source:point.source})):[];
  const argRows=argToggle.checked?argStations.map(point=>({name:point.name,category:'ARG',siteId:point.siteId,sourceCategory:point.sourceCategory,district:'',coords:point.coords,datum:point.datum,source:point.source})):[];
  return [...portRows,...awsRows,...argRows];
}
function updateMap(){
  const visible=getVisiblePoints();markerLayer.clearLayers();
  visible.forEach(point=>{
    const label=categoryLabels[point.category]||'Pelabuhan';
    const isAnchorCategory=point.category==='umum'||point.category==='perikanan';
    const icon=isAnchorCategory
      ?L.divIcon({className:`harbor-pin harbor-anchor-pin anchor-${point.category}`,html:'<svg viewBox="0 0 44 56" aria-hidden="true"><path class="map-pin-shape" d="M22 1.5C10.7 1.5 1.5 10.7 1.5 22c0 14.2 20.5 32.5 20.5 32.5S42.5 36.2 42.5 22C42.5 10.7 33.3 1.5 22 1.5Z"/><circle class="map-pin-center" cx="22" cy="21" r="15"/><g class="map-pin-symbol"><path d="M15 13h14v3H15zM12 18h20v6H12zM10 26h24l-4 5H15z"/><path class="map-anchor" d="M22 25v8m-3.5-5.5h7M20.5 24a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16 32c.2 4 2.6 6.2 6 6.2s5.8-2.2 6-6.2m-12 0 3 2.7m9-2.7-3 2.7"/></g></svg>',iconSize:[22,29],iconAnchor:[11,27]})
      :L.divIcon({className:'harbor-pin',html:`<div class="pin-core pin-${point.category}" aria-hidden="true"></div>`,iconSize:[17,17],iconAnchor:[8,8]});
    const details=[escapeHtml(point.district),escapeHtml(label)];
    if(point.category==='perikanan'&&point.class)details.push(escapeHtml(point.class));
    if(point.manager&&point.manager!=='-')details.push(`Pengelola: ${escapeHtml(point.manager)}`);
    const popup=`<div class="popup-title">${escapeHtml(point.name)}</div><div class="popup-meta">${details.join('<br>')}</div><span class="popup-badge">Sumber: BIG KSP</span>`;
    L.marker(point.coords,{icon,title:point.name}).bindPopup(popup).addTo(markerLayer);
  });
  awsMarkerLayer.clearLayers();
  const visibleAws=awsToggle.checked?awsStations:[];
  visibleAws.forEach(point=>{
    const icon=L.divIcon({className:'aws-map-pin',html:'<span aria-hidden="true"><svg viewBox="0 0 24 24"><circle class="solar-sun" cx="18" cy="5" r="2"/><path class="solar-ray" d="M18 1.5v1m0 5v1m-3.5-3.5h1m5 0h1m-5-2.5.8.8m3.4 3.4.8.8m0-5-.8.8m-3.4 3.4-.8.8"/><path class="solar-panel" d="M4 9h14l2 8H2z"/><path class="solar-grid" d="m7 10-1.2 6m5.2-6v6m3.2-6 1 6M4 13h12"/><path class="solar-leg" d="M10 17v3m-3 1h9"/></svg></span>',iconSize:[27,27],iconAnchor:[13,13]});
    const popup=`<div class="popup-title">${escapeHtml(point.name)}</div><div class="popup-meta">Stasiun AWS BMKG<br>ID: ${escapeHtml(point.siteId)}<br>Datum: ${escapeHtml(point.datum)}</div><span class="popup-badge aws-popup-badge">Sumber: AWS Center</span>`;
    L.marker(point.coords,{icon,title:`${point.name} (${point.siteId})`}).bindPopup(popup).addTo(awsMarkerLayer);
  });
  argMarkerLayer.clearLayers();
  const visibleArg=argToggle.checked?argStations:[];
  visibleArg.forEach(point=>{
    const icon=L.divIcon({className:'arg-map-pin',html:'<svg viewBox="0 0 40 40" aria-hidden="true"><path class="arg-station-mast" d="M17.5 10v26m-3 0h8"/><path class="arg-rain-sensor" d="M14.5 3.5c0-1 1-1.5 2.5-1.5h4c1.5 0 2.5 0.5 2.5 1.5v6.5h-9z"/><path class="arg-sensor-detail" d="M15.5 4h7m-7 4.5h7"/><path class="arg-bracket" d="M13 10h15m-12 0v3"/><path class="arg-control-box" d="M3.5 14.5h10v13h-10z"/><path class="arg-device-detail" d="M5.5 17h6m-6 2.5h6m-6 2.5h3"/><path class="arg-solar-support" d="m17 13 2.8 3.5m.5 8.8-3 3.2"/><path class="arg-solar-panel" d="m20 15.5 16 5-2.6 8-16-5z"/><path class="arg-panel-grid" d="m23 16.5-2.6 8m7.1-6.6-2.6 8m-8.5-2.7 16 5"/></svg>',iconSize:[22,22],iconAnchor:[11,11]});
    const details=[`Stasiun ARG<br>ID: ${escapeHtml(point.siteId)}`,`Datum: ${escapeHtml(point.datum)}`];
    if(point.sourceCategory&&point.sourceCategory!=='ARG')details.push(`Kategori di file: ${escapeHtml(point.sourceCategory)}`);
    const popup=`<div class="popup-title">${escapeHtml(point.name)}</div><div class="popup-meta">${details.join('<br>')}</div><span class="popup-badge arg-popup-badge">Layer: ARG</span>`;
    L.marker(point.coords,{icon,title:`${point.name} (${point.siteId})`}).bindPopup(popup).addTo(argMarkerLayer);
  });
  const categoryCounts=Object.fromEntries(Object.keys(categoryLabels).map(category=>[category,visible.filter(point=>point.category===category).length]));
  document.getElementById('totalMetric').innerHTML=`${visible.length+visibleAws.length+visibleArg.length} <small>titik</small>`;
  document.getElementById('generalMetric').innerHTML=`${categoryCounts.umum+categoryCounts.penyeberangan} <small>titik</small>`;
  document.getElementById('fisheryMetric').innerHTML=`${categoryCounts.perikanan} <small>titik</small>`;
  document.getElementById('specialMetric').innerHTML=`${categoryCounts.khusus} <small>titik</small>`;
  document.getElementById('awsMetric').innerHTML=`${visibleAws.length} <small>titik</small>`;
  document.getElementById('argMetric').innerHTML=`${visibleArg.length} <small>titik</small>`;
  document.getElementById('visibleCount').textContent=`${visible.length+visibleAws.length+visibleArg.length} lokasi ditampilkan`;
  document.getElementById('filterCount').textContent=`${selectedTypes().length} aktif`;
  regionInputs.forEach(input=>{
    const count=wharves.filter(point=>point.district===input.dataset.region&&selectedTypes().includes(point.category)).length;
    input.closest('.region-option').querySelector('b').textContent=count;
  });
}
function createMapLayout(mapImage){
  const output=document.createElement('canvas');output.width=1800;output.height=Math.round(output.width*mapImage.height/mapImage.width);
  const ctx=output.getContext('2d'),roundRect=(x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}};
  ctx.fillStyle='#e7eff0';ctx.fillRect(0,0,output.width,output.height);
  const fit=output.width/mapImage.width,drawW=mapImage.width*fit,drawH=mapImage.height*fit,drawX=0,drawY=0;
  ctx.drawImage(mapImage,drawX,drawY,drawW,drawH);
  const glass='rgba(255,255,255,.91)',line='rgba(31,67,78,.12)',text='#294653',muted='#6e828b';
  roundRect(24,22,440,78,10,glass,line);
  ctx.fillStyle='#087f83';ctx.fillRect(24,39,3,43);
  ctx.fillStyle=muted;ctx.font='700 10px "DM Sans", sans-serif';ctx.letterSpacing='1.4px';ctx.fillText('SITARUM · PROVINSI BANTEN',40,47);ctx.letterSpacing='0';
  ctx.fillStyle=text;ctx.font='700 19px Manrope, "DM Sans", sans-serif';ctx.fillText('Sebaran Pelabuhan & Stasiun Cuaca',40,75);
  const visiblePorts=getVisiblePoints(),types=selectedTypes(),legendItems=[];
  const categoryColors={umum:'#087f83',penyeberangan:'#377ab7',perikanan:'#d99a32',khusus:'#7d69a6'};
  for(const category of types)legendItems.push({label:categoryLabels[category],count:visiblePorts.filter(point=>point.category===category).length,color:categoryColors[category]});
  if(awsToggle.checked)legendItems.push({label:'Stasiun AWS BMKG',count:awsStations.length,color:'#28739a'});
  if(argToggle.checked)legendItems.push({label:'Stasiun ARG',count:argStations.length,color:'#4b8da9'});
  const legendWidth=260,legendHeight=43+legendItems.length*26,legendX=output.width-legendWidth-24,legendY=24;
  roundRect(legendX,legendY,legendWidth,legendHeight,9,glass,line);
  ctx.fillStyle='#087f83';ctx.font='700 10px "DM Sans", sans-serif';ctx.letterSpacing='1.2px';ctx.fillText('LEGENDA',legendX+14,legendY+20);ctx.letterSpacing='0';
  ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(legendX+13,legendY+29);ctx.lineTo(legendX+legendWidth-13,legendY+29);ctx.stroke();
  let rowY=legendY+48;
  legendItems.forEach(item=>{
    ctx.beginPath();ctx.arc(legendX+19,rowY-3,5.5,0,Math.PI*2);ctx.fillStyle=item.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=text;ctx.font='600 10px "DM Sans", sans-serif';ctx.fillText(item.label,legendX+31,rowY);
    ctx.textAlign='right';ctx.fillStyle=muted;ctx.font='600 9px "DM Sans", sans-serif';ctx.fillText(String(item.count),legendX+legendWidth-13,rowY);ctx.textAlign='left';rowY+=26;
  });
  const center=map.getCenter(),zoom=map.getZoom(),metersPerCssPixel=40075016.686*Math.cos(center.lat*Math.PI/180)/(256*Math.pow(2,zoom)),pixelRatio=mapImage.width/document.getElementById('map').clientWidth,targetPx=105,niceMeters=meters=>{const power=Math.pow(10,Math.floor(Math.log10(meters))),fraction=meters/power;return(fraction>=5?5:fraction>=2?2:1)*power},distance=niceMeters(targetPx*metersPerCssPixel),barLength=distance/metersPerCssPixel*fit*pixelRatio;
  const scaleX=42,scaleY=output.height-47;roundRect(scaleX-12,scaleY-31,Math.max(150,barLength+27),47,7,glass,line);
  ctx.fillStyle=text;ctx.font='600 9px "DM Sans", sans-serif';ctx.fillText(distance>=1000?`${distance/1000} km`:`${distance} m`,scaleX,scaleY-14);
  ctx.fillStyle='#fff';ctx.fillRect(scaleX,scaleY,barLength,5);ctx.strokeStyle='#244a59';ctx.lineWidth=1.2;ctx.strokeRect(scaleX,scaleY,barLength,5);ctx.fillStyle='#244a59';ctx.fillRect(scaleX,scaleY,1.5,9);ctx.fillRect(scaleX+barLength-1.5,scaleY,1.5,9);
  const northX=output.width-46,northY=output.height-75;roundRect(northX-19,northY-25,38,64,7,glass,line);ctx.fillStyle=text;ctx.font='700 10px "DM Sans", sans-serif';ctx.textAlign='center';ctx.fillText('N',northX,northY-9);ctx.beginPath();ctx.moveTo(northX,northY-2);ctx.lineTo(northX-8,northY+16);ctx.lineTo(northX,northY+12);ctx.lineTo(northX+8,northY+16);ctx.closePath();ctx.fillStyle='#087f83';ctx.fill();ctx.textAlign='left';
  const attribution=map.hasLayer(imageryMap)?'Imagery © Esri':'© OpenStreetMap contributors';ctx.font='500 8px "DM Sans", sans-serif';const attributionWidth=ctx.measureText(attribution).width+20;roundRect(output.width-attributionWidth-18,output.height-28,attributionWidth,18,5,glass,line);ctx.fillStyle=muted;ctx.fillText(attribution,output.width-attributionWidth-8,output.height-16);
  return output;
}
function closeExportMenu(){exportMenu.hidden=true;exportBtn.setAttribute('aria-expanded','false')}
const workspaceNavItems=[...document.querySelectorAll('.workspace-nav .nav-item')];
function activateNavItem(activeItem){workspaceNavItems.forEach(item=>{const active=item===activeItem;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')})}
workspaceNavItems.filter(item=>item.dataset.scrollTarget).forEach(item=>item.addEventListener('click',()=>{
  activateNavItem(item);document.getElementById(item.dataset.scrollTarget).scrollIntoView({behavior:'smooth',block:'start'});
}));
typeInputs.forEach(input=>input.addEventListener('change',updateMap));
regionInputs.forEach(input=>input.addEventListener('change',updateMap));
awsToggle.addEventListener('change',updateMap);
argToggle.addEventListener('change',updateMap);
document.getElementById('clearFilters').addEventListener('click',()=>{[...typeInputs,...regionInputs,awsToggle,argToggle].forEach(input=>input.checked=true);updateMap()});
document.getElementById('resetView').addEventListener('click',()=>{map.setView(initialCenter,initialZoom);showToast('Tampilan peta dikembalikan ke Provinsi Banten.')});
exportBtn.addEventListener('click',event=>{event.stopPropagation();exportMenu.hidden=!exportMenu.hidden;exportBtn.setAttribute('aria-expanded',String(!exportMenu.hidden))});
document.addEventListener('click',event=>{if(!event.target.closest('.export-wrap'))closeExportMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeExportMenu()});
exportMenu.addEventListener('click',async event=>{
  const option=event.target.closest('[data-export]');if(!option)return;
  closeExportMenu();
  const rows=getExportPoints();
  if(option.dataset.export==='raw'){
    const csvEscape=value=>'"'+String(value??'').replaceAll('"','""')+'"';
    const csv=['nama,kategori,id,kategori_asal,kabupaten_kota,latitude,longitude,sistem_koordinat,sumber',...rows.map(point=>[point.name,point.category,point.siteId,point.sourceCategory,point.district,point.coords[0],point.coords[1],point.datum,point.source].map(csvEscape).join(','))].join('\r\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='sipel-data-banten.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast(`${rows.length} lokasi sesuai filter diekspor ke CSV.`);return;
  }
  if(!window.html2canvas){showToast('Fitur JPG belum termuat. Periksa koneksi internet lalu coba lagi.');return}
  showToast('Menyiapkan gambar peta…');
  try{
    const activeBasemap=map.hasLayer(imageryMap)?imageryMap:streetMap;
    if(activeBasemap.isLoading())await Promise.race([new Promise(resolve=>activeBasemap.once('load',resolve)),new Promise(resolve=>setTimeout(resolve,4000))]);
    await new Promise(resolve=>setTimeout(resolve,150));
    const mapCanvas=await html2canvas(document.getElementById('map'),{useCORS:true,allowTaint:false,scale:2,backgroundColor:'#e8eff0',logging:false,ignoreElements:element=>element.classList?.contains('leaflet-control')||element.classList?.contains('leaflet-popup')});
    const canvas=createMapLayout(mapCanvas);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Gagal membuat JPG')),'image/jpeg',0.94));
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='layout-peta-sitarum-banten.jpg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast(`Layout peta dengan legenda diekspor sebagai JPG (${rows.length} lokasi aktif).`);
  }catch(error){console.error(error);showToast('Gambar peta belum dapat dibuat. Pastikan basemap selesai dimuat lalu coba lagi.')}
});
const aboutModal=document.getElementById('aboutModal');
const aboutClose=document.getElementById('aboutClose');
function openAbout(){aboutModal.hidden=false;document.body.classList.add('modal-open');aboutClose.focus()}
function closeAbout(){aboutModal.hidden=true;document.body.classList.remove('modal-open');document.getElementById('aboutBtn').focus()}
document.getElementById('aboutBtn').addEventListener('click',()=>{activateNavItem(document.getElementById('aboutBtn'));openAbout()});
aboutClose.addEventListener('click',closeAbout);
aboutModal.addEventListener('click',event=>{if(event.target===aboutModal)closeAbout()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!aboutModal.hidden)closeAbout()});
document.getElementById('layersBtn').addEventListener('click',()=>showToast('Gunakan panel kanan untuk memfilter kategori sumber dan kabupaten/kota.'));
updateMap();
