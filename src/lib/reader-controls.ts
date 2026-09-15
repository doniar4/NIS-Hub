export function readerKeyDelta(event:Pick<KeyboardEvent,"key"|"altKey"|"ctrlKey"|"metaKey"|"shiftKey"|"target">):number{
 if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return 0;
 const target=event.target;
 if(target instanceof Element&&target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),dialog,[role="dialog"]'))return 0;
 return event.key==="ArrowRight"||event.key==="PageDown"?1:event.key==="ArrowLeft"||event.key==="PageUp"?-1:0;
}
export function readerScale(width:number,height:number,baseWidth:number,baseHeight:number,fit:"width"|"page",zoom:number){
 return Math.max(0.05,Math.min(width/baseWidth,fit==="page"?height/baseHeight:Infinity))*zoom;
}
