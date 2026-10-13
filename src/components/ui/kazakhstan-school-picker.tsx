"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CheckIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {SceneViewToggle} from "./scene-view-toggle";
import {createKazakhstanRelief, defaultMapCamera, mapProjection, type MapCamera} from "@/lib/kazakhstan-relief";
import regions from "@/lib/data/kazakhstan-regions.json";
import { cityById, nisCities, schoolLabel, schoolsInCity, schoolCatalogSource } from "@/lib/schools";
import { schoolCopy } from "@/lib/school-copy";
import { useI18n } from "../locale-provider";

export type SchoolSelection = { city: string; school: string };

export function KazakhstanSchoolPicker({ value, onChange, disabled = false }: {
  value: SchoolSelection; onChange: (value: SchoolSelection) => void; disabled?: boolean;
}) {
  const { locale } = useI18n(), p = schoolCopy(locale), id = useId();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"2d" | "3d">("3d"), [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState(defaultMapCamera), [dragging, setDragging] = useState(false);
  const drag = useRef<{pointer: number; x: number; y: number; camera: MapCamera; moved: boolean} | null>(null);
  const suppressClick = useRef(false), frame = useRef<number | null>(null), pendingCamera = useRef(camera);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({width: 0, height: 0});
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setStageSize({width: element.clientWidth, height: element.clientHeight}));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const projection = useMemo(() => mapProjection(camera), [camera]);
  const fitScale = stageSize.width ? Math.min(
    (stageSize.width - 16) * 648 / (2 * projection.halfWidth * stageSize.width),
    (stageSize.height - 24) * 648 / (2 * projection.halfHeight * stageSize.width),
  ) : 1;
  const relief = useMemo(() => createKazakhstanRelief(camera), [camera]);
  const rotationHint = locale === "kk" ? "Картаны сүйреп айналдырыңыз немесе бағыттау пернелерін басыңыз"
    : locale === "en" ? "Drag to rotate, or use the arrow keys"
    : "Вращайте карту перетаскиванием или стрелками на клавиатуре";
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  function updateCamera(next: MapCamera) {
    pendingCamera.current = next;
    if (frame.current === null) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setCamera(pendingCamera.current);
    });
  }
  function endRotation(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function beginRotation(event: PointerEvent<HTMLDivElement>) {
    if (mode !== "3d" || disabled || !event.isPrimary || event.button !== 0 || drag.current) return;
    suppressClick.current = false;
    drag.current = {pointer: event.pointerId, x: event.clientX, y: event.clientY, camera: pendingCamera.current, moved: false};
  }
  function rotate(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const x = event.clientX - start.x, y = event.clientY - start.y;
    if (!start.moved && Math.hypot(x, y) < 6) return;
    if (!start.moved) {
      start.moved = true;
      suppressClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    const sensitivity = 180 / Math.max(300, event.currentTarget.clientWidth);
    updateCamera({yaw: start.camera.yaw + x * sensitivity, elevation: Math.min(75, Math.max(20, start.camera.elevation - y * .18))});
  }
  function rotateWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || mode !== "3d" || disabled) return;
    const step = event.shiftKey ? 2 : 10, current = pendingCamera.current;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) {
      event.preventDefault();
      updateCamera(event.key === "Home" ? defaultMapCamera : {
        yaw: current.yaw + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
        elevation: Math.min(75, Math.max(20, current.elevation + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0))),
      });
    }
  }
  function resetMap() { setZoom(1); updateCamera(defaultMapCamera); }
  const controls = locale === "kk" ? {view:"Карта көрінісі",in:"Жақындату",out:"Алыстату",reset:"Картаны қалпына келтіру"}
    : locale === "en" ? {view:"Map view",in:"Zoom in",out:"Zoom out",reset:"Reset map"}
    : {view:"Вид карты",in:"Приблизить карту",out:"Отдалить карту",reset:"Сбросить вид карты"};
  const city = cityById(value.city), schools = schoolsInCity(value.city);
  const search = query.trim().toLocaleLowerCase();
  const visibleCities = nisCities.filter(row => !search || [row.name_ru, row.name_kk, row.name_en]
    .some(name => name.toLocaleLowerCase().includes(search)));
  function selectCity(cityId: string) {
    if (disabled) return;
    // A city change always clears the school. Even one-school cities require an explicit choice.
    onChange({ city: cityId, school: cityId === value.city ? value.school : "" });
  }
  function activate(event: KeyboardEvent<SVGGElement>, cityId: string) {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); selectCity(cityId); }
  }
  return <div className="kz-school-picker" data-mode={mode} data-rotating={dragging || undefined} aria-busy={disabled}
    style={{"--kz-camera": projection.matrix, "--kz-upright": projection.upright, "--kz-fit-scale": fitScale} as CSSProperties}>
    <div className="kz-map-pane glass-surface">
      <div className="kz-map-caption"><span>{locale === "kk" ? "Қазақстан" : locale === "en" ? "Kazakhstan" : "Казахстан"}</span><span>{p.network}</span></div>
      <div className="kz-map-toolbar">
        <div className="kz-zoom-controls" role="group" aria-label={controls.reset}>
          <button type="button" aria-label={controls.out} disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-.2))}><Minus size={16}/></button>
          <span aria-live="polite">{Math.round(zoom*100)}%</span>
          <button type="button" aria-label={controls.in} disabled={zoom>=1.8} onClick={()=>setZoom(z=>Math.min(1.8,z+.2))}><Plus size={16}/></button>
          <button type="button" aria-label={controls.reset} disabled={disabled || (zoom===1 && camera.yaw===45 && camera.elevation===34)} onClick={resetMap}><RotateCcw size={15}/></button>
        </div>
        <SceneViewToggle className="kz-view-switch" view={mode} onChange={setMode} label={controls.view}/>
      </div>
      <div ref={stage} className="kz-map-stage glass-surface" role="group" aria-label={p.map}
        tabIndex={mode === "3d" && !disabled ? 0 : undefined} aria-describedby={mode === "3d" ? `${id}-map-hint` : undefined}
        onPointerDown={beginRotation} onPointerMove={rotate} onPointerUp={endRotation} onPointerCancel={endRotation}
        onLostPointerCapture={endRotation} onPointerLeave={event => { if (!drag.current?.moved) endRotation(event); }}
        onKeyDown={rotateWithKeys} onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        <div className="kz-map-camera">
        <svg className="kz-map" viewBox="-14 -18 648 380" data-selection={!!value.city || undefined} role="group" aria-label={p.map}>
          <defs>
            <filter id={`${id}-matte`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5"/></filter>
            <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>
            {regions.map(region=><path key={region.pcode} id={`${id}-${region.pcode}`} d={region.path}/>)}
            <linearGradient id={`${id}-selected`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--kz-selected-start)" /><stop offset="100%" stopColor="var(--kz-selected-end)" />
            </linearGradient>
          </defs>
          <g className="kz-map-world" style={{transform:`translate(${city?.x ?? 310}px, ${city?.y ?? 170}px) scale(${zoom}) translate(${-1*(city?.x ?? 310)}px, ${-1*(city?.y ?? 170)}px)`}}>
          <g className="kz-map-shadow" aria-hidden="true" transform={`translate(${projection.offsetX} ${projection.offsetY})`} filter={`url(#${id}-shadow)`}>{regions.map(region=><use key={region.pcode} href={`#${id}-${region.pcode}`}/>)}</g>
          <g className="kz-map-depth" aria-hidden="true">{relief.map(region=><g key={region.pcode}>
            <path className="kz-relief-light" d={region.light}/><path className="kz-relief-shade" d={region.shade}/>
          </g>)}</g>
          <g className="kz-regions" aria-hidden="true">
            {regions.map((region, index) => <path key={region.pcode} d={region.path} className="kz-region"
              data-tone={index % 4} data-selected={city?.region === region.pcode || undefined}
              fill={city?.region === region.pcode ? `url(#${id}-selected)` : undefined} vectorEffect="non-scaling-stroke" />)}
          </g>
          {nisCities.map(row => <g key={row.id} transform={`translate(${row.x} ${row.y})`}><g className="kz-city-upright"><g className="kz-city" data-selected={value.city === row.id || undefined}
            role="button" tabIndex={disabled ? -1 : 0}
            aria-label={schoolLabel(row, locale)} aria-pressed={value.city === row.id} aria-disabled={disabled}
            onClick={() => selectCity(row.id)} onKeyDown={event => activate(event, row.id)}>
            <title>{schoolLabel(row, locale)}</title>
            <g className="kz-city-column" aria-hidden="true">
              <path className="kz-column-left" d="M-6 -16L0 -12V4L-6 0Z"/>
              <path className="kz-column-right" d="M0 -12L6 -16V0L0 4Z"/>
              <path className="kz-column-top" d="M0 -20L6 -16L0 -12L-6 -16Z"/>
            </g>
            <g className="kz-city-marker">
            <circle className="kz-city-glow" r="12" filter={`url(#${id}-matte)`} aria-hidden="true"/>
            <circle className="kz-city-target" r="13" />
            {value.city === row.id && <circle className="kz-city-halo" r="10" />}
            <circle className="kz-city-dot" r={value.city === row.id ? 4.5 : 3.3} />
            <text className="kz-city-label" x={row.id === "oskemen" ? -8 : 8}
              y={row.id === "kokshetau" ? 15 : row.id === "taraz" || row.id === "turkistan" ? -9 : -4}
              textAnchor={row.id === "oskemen" ? "end" : "start"}>{schoolLabel(row, locale)}</text>
            </g>
          </g></g></g>)}
          </g>
        </svg>
        </div>
      </div>
      <p className="kz-map-hint" id={`${id}-map-hint`}>{p.chooseCityHint}{mode === "3d" && <> · {rotationHint}</>}</p>
      <div className="kz-city-controls">
        <label className="kz-city-select"><span className="field-label">{p.city}</span>
          <select className="field" value={value.city} onChange={event => selectCity(event.target.value)} disabled={disabled}>
            <option value="">{p.cityPlaceholder}</option>
            {nisCities.map(row => <option key={row.id} value={row.id}>{schoolLabel(row, locale)}</option>)}
          </select>
        </label>
        <div className="kz-city-browse">
          <label className="kz-city-search"><MagnifyingGlassIcon aria-hidden="true" />
            <input type="search" aria-label={p.search} placeholder={p.search} value={query}
              onChange={event => setQuery(event.target.value)} disabled={disabled} />
          </label>
          <div className="kz-city-list" role="group" aria-label={p.city}>
            {visibleCities.map(row => <button type="button" key={row.id} disabled={disabled} aria-pressed={value.city === row.id}
              onClick={() => selectCity(row.id)}>{schoolLabel(row, locale)}</button>)}
            {!visibleCities.length && <p role="status">{p.empty}</p>}
          </div>
        </div>
      </div>
    </div>
    <div className="kz-school-pane glass-surface">
      <label className="kz-school-city-select"><span className="field-label">{p.city}</span>
        <select className="field" value={value.city} onChange={event => selectCity(event.target.value)} disabled={disabled}>
          <option value="">{p.cityPlaceholder}</option>
          {nisCities.map(row => <option key={row.id} value={row.id}>{schoolLabel(row, locale)}</option>)}
        </select>
      </label>
      <div className="kz-school-heading" data-city-selected={!!city} aria-live="polite" aria-atomic="true">
        <p>{p.schools}</p><h2>{city ? schoolLabel(city, locale) : p.chooseSchool}</h2>
        {city && <span>{p.count.replace("{count}", String(schools.length))}</span>}
      </div>
      {city ? <fieldset className="kz-school-list" key={value.city} disabled={disabled}>
        <legend className="sr-only">{p.chooseSchool}</legend>
        {schools.map(row => <label className="kz-school-option" key={row.id}>
          <input type="radio" name="school" value={row.id} checked={value.school === row.id}
            onChange={() => onChange({ city: row.city_id, school: row.id })} />
          <span className="kz-school-option-body glass-surface"><span className="kz-school-symbol" aria-hidden="true">N</span>
            <strong>{schoolLabel(row, locale)}</strong><span className="kz-school-check" aria-hidden="true"><CheckIcon /></span>
          </span>
        </label>)}
      </fieldset> : <div className="kz-school-empty"><span className="kz-empty-symbol" aria-hidden="true">NIS</span><p>{p.chooseCityHint}</p></div>}
      <div className="kz-school-footnote"><p>{p.later}</p><a href={schoolCatalogSource} target="_blank" rel="noopener noreferrer">{p.source} ↗</a>
        <a className="kz-map-credit" href="https://github.com/arodionoff/geokz" target="_blank" rel="noopener noreferrer" title="geoKZ, CC BY 4.0">geoKZ · CC BY 4.0 ↗</a>
      </div>
    </div>
  </div>;
}
