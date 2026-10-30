(() => {
  'use strict';
  const data=window.TRIP_DATA, geometry=window.RouteGeometry;
  if(!data || !geometry) return;
  const root=document.querySelector('#map'),toolbar=document.querySelector('#map-toolbar');
  if(!root || !toolbar) return;
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const status=document.querySelector('#map-status'),info=document.querySelector('#map-selection');
  const list=document.querySelector('#control-details');
  const models=[], cards=new Map();
  let map, libraries, light, selected=null, hovered=null, controlsVisible=true;
  const setStatus=message=>{status.textContent=message;};
  const modelVisible=model=>model.group.visible && (!model.control || controlsVisible);
  const sources=item=>`<p><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">官方管制公告 ↗</a>${item.geometry?.source ? ` · <a href="${esc(item.geometry.source)}" target="_blank" rel="noopener noreferrer">里程定位參考 ↗</a>` : ''}</p>`;
  function showInfo(model) {
    info.hidden=false;
    info.querySelector('.map-selection-copy').innerHTML=model.html;
  }
  function repaint() {
    for(const model of models) {
      const active=model===selected || model===hovered;
      model.line.setOptions({strokeColor:active ? '#fff176' : model.color,strokeWeight:active ? model.weight+5 : model.weight,zIndex:active ? 40 : model.control ? 20 : 5,strokeOpacity:active ? 1 : .9});
      model.halo.setOptions({strokeColor:active ? '#593c00' : '#fff',strokeWeight:active ? model.weight+10 : model.weight+3,zIndex:active ? 39 : model.control ? 19 : 4});
      model.line.setMap(modelVisible(model) ? map : null);
      model.halo.setMap(modelVisible(model) ? map : null);
      model.hit.setMap(modelVisible(model) ? map : null);
    }
    const activeModel=hovered || selected;
    if(light) {
      light.setMap(activeModel && modelVisible(activeModel) ? map : null);
      if(activeModel)light.setCenter(activeModel.focusPoint || activeModel.path[Math.floor(activeModel.path.length/2)]);
    }
    for(const [id,card] of cards) card.classList.toggle('is-highlighted',models.some(m=>m.controlId===id && (m===selected || m===hovered) && modelVisible(m)));
  }
  function clearSelection() {
    selected=null;hovered=null;info.hidden=true;repaint();
  }
  function addLine(group,path,{title,html,color,controlId=null}) {
    const control=controlId!==null,weight=control ? 10 : 5;
    const base={path,geodesic:false,clickable:false,map:group.visible ? map : null};
    const halo=new libraries.Polyline({...base,strokeColor:'#fff',strokeWeight:weight+3,strokeOpacity:.9,zIndex:control ? 19 : 4});
    const line=new libraries.Polyline({...base,strokeColor:color,strokeWeight:weight,strokeOpacity:.9,zIndex:control ? 20 : 5});
    const hit=new libraries.Polyline({...base,clickable:true,strokeOpacity:0,strokeWeight:26,zIndex:control ? 22 : 7});
    const model={group,line,halo,hit,path,title,html,color,weight,control,controlId};
    models.push(model);group.models.push(model);
    hit.addListener('mouseover',event=>{model.focusPoint=event?.latLng || path[Math.floor(path.length/2)];hovered=model;repaint();showInfo(model);});
    hit.addListener('mouseout',()=>{hovered=null;repaint();if(selected)showInfo(selected);else info.hidden=true;});
    hit.addListener('click',event=>{model.focusPoint=event?.latLng || path[Math.floor(path.length/2)];selected=model;repaint();showInfo(model);});
    return model;
  }
  function fit(group) {
    const bounds=new libraries.LatLngBounds();let count=0;
    for(const m of group ? group.models : models.filter(m=>modelVisible(m))) if(!m.control) for(const p of m.path){bounds.extend(p);count++;}
    if(count) map.fitBounds(bounds,32);
  }
  function asLocation(value) {
    if(Array.isArray(value))return {lat:value[0],lng:value[1]};
    const match=String(value).match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    return match ? {lat:Number(match[1]),lng:Number(match[2])} : value;
  }
  function endpoint(segment,which) {
    if(which==='origin' && segment.originMeeting)return asLocation(data.meeting.coordinates || data.meeting.navigationQuery);
    const night=segment[which+'Lodging'];
    return night ? asLocation(data.lodgings[night].coordinates) : asLocation(segment[which]);
  }
  function summarizeRoute(route) {
    const minutes=Math.ceil((route.durationMillis || 0)/60000);
    return `${(route.distanceMeters/1000).toFixed(1)}公里 · 純騎程約${Math.floor(minutes/60)}小時${minutes%60}分`;
  }
  function groupSummary(group) {
    const state=group.loaded===group.segments.length ? '已載入' : `${group.loaded}/${group.segments.length}段`;
    const minutes=Math.ceil(group.duration/60000);
    group.summary.textContent=`${group.label}｜${state}${group.loaded ? ` · ${(group.distance/1000).toFixed(1)}公里 · 純騎程${Math.floor(minutes/60)}小時${minutes%60}分` : ''}${group.failed ? ` · ${group.failed}段失敗，可點重試` : ''}`;
  }
  function attachControls(group,segment,route) {
    for(const item of data.controlMap.sections) {
      const spec=item.geometry;
      if(!spec || !spec.segments.includes(segment.code))continue;
      let path=[];
      if(spec.legIndex!==undefined) path=(route.legs?.[spec.legIndex]?.path || []).map(geometry.point);
      else path=geometry.mileageSlice(route.path,spec);
      if(path.length<2)continue;
      const color={window:'#ce203d',mobile:'#bc5700',unknown:'#8055b5'}[item.kind];
      const html=`<strong>${esc(item.title)}</strong><p>${esc(item.time)}</p><p>${esc(item.detail)}</p><p class="map-precision">${esc(spec.note)}</p><small>公告核對 ${esc(data.controlMap.checked)}；通行依現場指揮。</small>${sources(item)}`;
      const model=addLine(group,path,{title:item.title,html,color,controlId:item.id});
      const card=cards.get(item.id);
      card.querySelector('.control-location-status').textContent='已對齊載入路線 · '+spec.note;
      card._models.push(model);
    }
  }
  async function loadGroup(group) {
    if(group.loading)return;
    if(group.loaded===group.segments.length) {repaint();return;}
    group.loading=true;group.button.setAttribute('aria-busy','true');group.failed=0;
    for(const segment of group.segments) {
      if(group.done.has(segment.code))continue;
      setStatus(`正在取得${group.label}：${segment.code} ${segment.title}（Google機車路線）`);
      try {
        const {routes}=await libraries.Route.computeRoutes({
          origin:endpoint(segment,'origin'),destination:endpoint(segment,'destination'),
          intermediates:(segment.via || []).map(location=>({location:asLocation(location)})),
          travelMode:'TWO_WHEELER',routeModifiers:{avoidHighways:true,avoidTolls:true,avoidFerries:true},
          optimizeWaypointOrder:false,polylineQuality:'HIGH_QUALITY',language:'zh-TW',region:'TW',
          fields:['path','legs','distanceMeters','durationMillis','warnings']
        });
        const route=routes?.[0];
        if(!route?.path?.length)throw new Error('NO_ROUTE');
        const path=route.path.map(geometry.point);
        if(path.some(p=>!Number.isFinite(p.lat) || !Number.isFinite(p.lng)))throw new Error('INVALID_PATH');
        const summary=summarizeRoute(route);
        const html=`<strong>${esc(group.label)}｜${esc(segment.title)}</strong><p>${esc(summary)}</p><p>${esc(segment.note || group.note)}</p><p>途經點順序固定；Google仍可能因封路改線。純騎程不含餐休、泡湯及工區停等。</p>${(route.warnings || []).map(w=>`<p>${esc(w)}</p>`).join('')}`;
        addLine(group,path,{title:segment.title,html,color:group.color});
        attachControls(group,segment,route);
        group.done.add(segment.code);group.loaded++;group.distance+=route.distanceMeters || 0;group.duration+=route.durationMillis || 0;
      }catch(error){
        group.failed++;
        // Do not expose request URLs, keys or arbitrary provider HTML in the page.
        const message=String(error.code || error.message || 'UNKNOWN');
        const code=message.match(/REQUEST_DENIED|PERMISSION_DENIED|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED|ZERO_RESULTS|NO_ROUTE|INVALID_REQUEST|INVALID_ARGUMENT/)?.[0] || 'ROUTE_ERROR';
        group.errors.textContent+=`${segment.code} 未能取得路線（${code}）。保留每日導航；可重試。 `;
      }
      groupSummary(group);repaint();
    }
    group.loading=false;group.button.removeAttribute('aria-busy');
    group.errors.hidden=!group.failed;
    if(!group.failed)group.errors.textContent='';
    groupSummary(group);
    setStatus(group.failed ? `${group.label}部分路段載入失敗；請查看下方提示，未以直線替代。` : `${group.label}道路路線已載入。滑入或點擊線條查看；管制時間以公告及現場為準。`);
    if(group.visible && group.models.length)fit(group);
    repaint();
  }
  function makeGroup(label,color,segments,note='',initial=false) {
    const button=document.createElement('button');button.type='button';button.className='map-toggle';
    button.style.setProperty('--day-color',color);button.textContent=label;button.setAttribute('aria-pressed',String(initial));
    button.classList.toggle('active',initial);toolbar.appendChild(button);
    const row=document.createElement('div');row.className='map-route-result';
    const summary=document.createElement('p'),errors=document.createElement('p');errors.className='map-route-errors';errors.hidden=true;
    row.append(summary,errors);document.querySelector('#map-route-results').appendChild(row);
    const group={label,color,segments,note,visible:initial,models:[],done:new Set(),loaded:0,failed:0,loading:false,distance:0,duration:0,button,summary,errors};
    groupSummary(group);
    button.addEventListener('click',async()=>{
      if(group.loading)return;
      if(group.failed){group.visible=true;group.errors.textContent='';}
      else group.visible=!group.visible;
      button.setAttribute('aria-pressed',String(group.visible));button.classList.toggle('active',group.visible);
      if(selected?.group===group && !group.visible)clearSelection();
      repaint();if(group.visible){await loadGroup(group);fit(group);}
    });
    return group;
  }
  function renderControls() {
    list.innerHTML=`<p>橙：機動管制 · 紅：限時通行／夜間封閉 · 紫：待複核。只有符合路線的工區才畫粗線；小數里程依參考樁位沿道路推估，並非測量界線。官方資料核對 ${esc(data.controlMap.checked)}。</p>`;
    for(const item of data.controlMap.sections) {
      const card=document.createElement('details');card.className='map-control-card';card._models=[];
      card.innerHTML=`<summary>${esc(item.title)}<span>${esc(item.time)}</span></summary><p class="control-location-status">尚未載入對應路線／未匹配樁位；不繪製推測直線。</p><p>${esc(item.detail)}</p>${sources(item)}`;
      const activate=(pin=false)=>{
        const model=card._models.find(modelVisible);
        if(!model)return;
        if(pin)selected=model;else hovered=model;
        repaint();showInfo(model);
      };
      card.addEventListener('mouseenter',()=>activate());
      card.addEventListener('mouseleave',()=>{hovered=null;repaint();if(selected)showInfo(selected);else info.hidden=true;});
      card.addEventListener('focusin',()=>activate());
      card.addEventListener('focusout',event=>{if(!card.contains(event.relatedTarget)){hovered=null;repaint();if(selected)showInfo(selected);else info.hidden=true;}});
      card.querySelector('summary').addEventListener('click',()=>activate(true));
      cards.set(item.id,card);list.appendChild(card);
    }
  }
  async function start() {
    renderControls();
    document.querySelector('#map-selection-close').addEventListener('click',clearSelection);
    window.gm_authFailure=()=>{setStatus('Google地圖授權失敗：請確認此網站來源、Maps JavaScript API、Routes API與帳單設定。每日導航與管制清單仍可使用。');};
    try {
      await new Promise((resolve,reject)=>{
        window.gehrGoogleMapsReady=()=>{clearTimeout(timer);resolve();};
        const script=document.createElement('script');
        const params=new URLSearchParams({key:window.GEHR_MAPS_BROWSER_KEY,callback:'gehrGoogleMapsReady',loading:'async',v:'weekly',language:'zh-TW',region:'TW'});
        script.src='https://maps.googleapis.com/maps/api/js?'+params;
        script.async=true;script.onerror=()=>{clearTimeout(timer);reject(new Error('MAP_LOAD_FAILED'));};
        const timer=setTimeout(()=>reject(new Error('MAP_LOAD_TIMEOUT')),25000);
        document.head.appendChild(script);
      });
      const [maps,routes,core]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('routes'),google.maps.importLibrary('core')]);
      libraries={...maps,...routes,...core};
      map=new libraries.Map(root,{center:{lat:23.7,lng:121},zoom:7,gestureHandling:'cooperative',mapTypeControl:false,streetViewControl:false,fullscreenControl:true});
      light=new libraries.Circle({radius:75,strokeColor:'#fff176',strokeWeight:3,fillColor:'#fff176',fillOpacity:.5,clickable:false,zIndex:50});
      map.addListener('click',clearSelection);
      document.addEventListener('keydown',event=>{if(event.key==='Escape')clearSelection();});
      const groups=data.days.map(day=>makeGroup(day.day===1 ? 'Day 1 · 北宜主線' : `Day ${day.day} · ${day.date}`,day.color,day.segments,day.focus,day.day===1));
      for(const day of data.days) if(day.alternative)makeGroup(`Day ${day.day} · ${day.alternative.mapLabel}`,day.day===1 ? '#687d98' : '#478687',day.alternative.segments,day.alternative.note);
      makeGroup('Day 1 · 西部備案','#8055b5',data.controlMap.western.segments,data.controlMap.western.note);
      const controls=document.createElement('button');controls.type='button';controls.className='map-toggle active';controls.textContent='管制色帶';controls.setAttribute('aria-pressed','true');
      controls.addEventListener('click',()=>{controlsVisible=!controlsVisible;controls.setAttribute('aria-pressed',String(controlsVisible));controls.classList.toggle('active',controlsVisible);if(!controlsVisible && (selected?.control || hovered?.control))clearSelection();repaint();});toolbar.appendChild(controls);
      const all=document.createElement('button');all.type='button';all.className='map-toggle';all.textContent='顯示已載入路線全貌';all.addEventListener('click',()=>fit());toolbar.appendChild(all);
      await loadGroup(groups[0]);
    }catch(error){
      setStatus('Google地圖未能載入。請確認網路、網站金鑰限制與兩項API已啟用；下方官方管制及每日導航仍可使用。');
      root.textContent='地圖暫時無法顯示';
    }
  }
  void start();
})();
