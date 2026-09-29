// One SF-Symbols-like set: filled glyphs for transport, 2px round strokes
// elsewhere. <Icon name="play" size={24} />
const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const NUM = 'text-anchor="middle" font-size="8.4" font-weight="750" style="font-stretch:75%;font-family:inherit" fill="currentColor"'
const NEXT = '<path d="M2.8 6.6v10.8a.9.9 0 0 0 1.38.76L12 13.1v4.3a.9.9 0 0 0 1.38.76l8.3-5.4a.9.9 0 0 0 0-1.52l-8.3-5.4A.9.9 0 0 0 12 6.6v4.3L4.18 5.84A.9.9 0 0 0 2.8 6.6z" fill="currentColor"/>'
const REPEAT = `<path d="M4 11.5V10a3 3 0 0 1 3-3h12.5M17 4.5 19.5 7 17 9.5M20 12.5V14a3 3 0 0 1-3 3H4.5M7 19.5 4.5 17 7 14.5" ${S}/>`
const STAR = 'M12 2.9l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 17l-5.5 2.9 1.05-6.15L3.1 9.4l6.15-.9z'

const ICONS = {
  play: '<path d="M7.5 4.8v14.4a1 1 0 0 0 1.52.85l11.4-7.2a1 1 0 0 0 0-1.7L9.02 3.95A1 1 0 0 0 7.5 4.8z" fill="currentColor"/>',
  pause: '<rect x="5.5" y="4" width="4.6" height="16" rx="1.3" fill="currentColor"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.3" fill="currentColor"/>',
  next: NEXT,
  prev: `<g transform="translate(24 0) scale(-1 1)">${NEXT}</g>`,
  back15: `<path d="M12 4.2a8.3 8.3 0 1 1-8.1 6.4" ${S} stroke-width="1.9"/><path d="M12.6 1.4 9 4.2l3.6 2.8z" fill="currentColor"/><text x="12.2" y="15.6" ${NUM}>15</text>`,
  fwd30: `<path d="M12 4.2a8.3 8.3 0 1 0 8.1 6.4" ${S} stroke-width="1.9"/><path d="M11.4 1.4 15 4.2l-3.6 2.8z" fill="currentColor"/><text x="11.8" y="15.6" ${NUM}>30</text>`,
  shuffle: `<path d="M3 7h3.2c2 0 3 1 4.2 2.9l2.5 4.2c1.2 1.9 2.2 2.9 4.2 2.9H20.5M3 17h3.2c1.3 0 2.2-.5 3-1.5M14.2 8.5c.8-1 1.7-1.5 3-1.5h3.3M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" ${S}/>`,
  repeat: REPEAT,
  repeat1: `${REPEAT}<path d="M11.2 10.9 12.6 10v4.4" ${S} stroke-width="1.6"/>`,
  lyrics: `<path d="M6 4h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.6 3.4c-.4.3-.9 0-.9-.5V17H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" ${S} stroke-width="1.9"/><path d="M8.2 11.8c0-1.6.8-2.6 2-3M13.2 11.8c0-1.6.8-2.6 2-3" ${S} stroke-width="1.8"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="14" cy="12" r="1.3" fill="currentColor"/>`,
  star: `<path d="${STAR}" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  starline: `<path d="${STAR}" ${S} stroke-width="1.8"/>`,
  more: '<circle cx="5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="19" cy="12" r="1.9" fill="currentColor"/>',
  search: `<circle cx="10.5" cy="10.5" r="6.6" ${S} stroke-width="2.2"/><path d="M15.4 15.4 20.5 20.5" ${S} stroke-width="2.4"/>`,
  plus: `<path d="M12 5v14M5 12h14" ${S} stroke-width="2.2"/>`,
  minus: `<path d="M5 12h14" ${S} stroke-width="2.2"/>`,
  sort: `<path d="M8 19.5V5M4.5 8.5 8 5l3.5 3.5M16 4.5V19M12.5 15.5 16 19l3.5-3.5" ${S}/>`,
  import: `<path d="M12 3.5v11M7.5 10 12 14.5 16.5 10M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15" ${S}/>`,
  export: `<path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8M4.5 15v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V15" ${S}/>`,
  restore: `<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" ${S}/><path d="M12 8v4.2l2.8 1.8" ${S}/>`,
  tab_library: '<rect x="3.5" y="4" width="3.6" height="16" rx="1" fill="currentColor"/><rect x="9.3" y="4" width="3.6" height="16" rx="1" fill="currentColor"/><path d="M15.3 5.3l3.3-.9 3.6 13.8-3.3.9z" fill="currentColor"/>',
  tab_search: `<circle cx="10.5" cy="10.5" r="6.6" ${S} stroke-width="2.4"/><path d="M15.4 15.4 20.5 20.5" ${S} stroke-width="2.6"/>`,
  tab_playlists: `<path d="M3.5 6h11M3.5 11h11M3.5 16h6" ${S} stroke-width="2.3"/><path d="M17.5 18V8.2l3.6-1" ${S} stroke-width="2.1"/><circle cx="15.6" cy="18" r="2.4" fill="currentColor"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="2.4"/>`,
  chev: `<path d="M9 5l7 7-7 7" ${S} stroke-width="2.4"/>`,
  back: `<path d="M15 5l-7 7 7 7" ${S} stroke-width="2.4"/>`,
  trash: `<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.9 13h9.2l.9-13" ${S}/>`,
  pencil: `<path d="M14.5 5.5l4 4L8.5 19.5H4.5v-4z" ${S}/>`,
  playnext: `<path d="M4 5.5v7l5.5-3.5z" fill="currentColor"/><path d="M12.5 7h8M4 17h16.5M12.5 12h8" ${S}/>`,
  queue: `<path d="M3.5 6h11M3.5 11h11M3.5 16h7" ${S}/><path d="M18 13v7M14.5 16.5h7" ${S}/>`,
  paste: `<rect x="8" y="3" width="8" height="4" rx="1" ${S}/><path d="M9 5H6.5A2.5 2.5 0 0 0 4 7.5v11A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 17.5 5H15" ${S}/>`,
  xfill: '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="#15120e" stroke-width="2" stroke-linecap="round"/>',
  note: `<path d="M9 18V5.5l11-2V16" ${S} stroke-width="1.6"/><circle cx="6.5" cy="18" r="2.5" ${S} stroke-width="1.6"/><circle cx="17.5" cy="16" r="2.5" ${S} stroke-width="1.6"/>`,
}

export default function Icon({ name, size = 22, className, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}
