// Runs before the first body text is painted. CSS font-display:optional handles
// unsupported connection APIs, failed font files and slow responses as well.
export const fontBootstrap = `(()=>{try{const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;if(c&&(c.saveData||c.effectiveType==="slow-2g"||c.effectiveType==="2g")){document.documentElement.dataset.font="system"}}catch{}})()`;
