const paths={
 activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',external:'<path d="M7 17 17 7M7 7h10v10"/>',
 users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2m6 0v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>','credit-card':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
 route:'<path d="M12 3v18M3 12h18m-5-5 5 5-5 5M8 7l-5 5 5 5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',terminal:'<path d="m5 7 5 5-5 5m8 0h6"/>',
 check:'<path d="m5 12 4 4L19 6"/>',x:'<path d="m6 6 12 12M6 18 18 6"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
 play:'<path d="m8 4 13 8-13 8V4Z"/>',message:'<path d="M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0Z"/><path d="M7 9h9M7 13h6"/>',eye:'<path d="M2 12S5 5 12 5s10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 warning:'<path d="M12 3 2 21h20L12 3Zm0 5v6m0 3v1"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',chart:'<path d="M3 3v18h18M7 16v-4m5 4V7m5 9V4"/>',
 trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v6m-5 1h10"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m4 5v3"/>'
};
export function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.activity}</svg>`;}
