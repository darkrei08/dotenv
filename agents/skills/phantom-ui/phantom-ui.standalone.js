var oe=Object.defineProperty;var re=Object.getOwnPropertyDescriptor;var m=(r,t,e,o)=>{for(var s=o>1?void 0:o?re(t,e):t,n=r.length-1,i;n>=0;n--)(i=r[n])&&(s=(o?i(t,e,s):i(s))||s);return o&&s&&oe(t,e,s),s};var W=globalThis,F=W.ShadowRoot&&(W.ShadyCSS===void 0||W.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,rt=Symbol(),_t=new WeakMap,M=class{constructor(t,e,o){if(this._$cssResult$=!0,o!==rt)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(F&&t===void 0){let o=e!==void 0&&e.length===1;o&&(t=_t.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),o&&_t.set(e,t))}return t}toString(){return this.cssText}},I=r=>new M(typeof r=="string"?r:r+"",void 0,rt),st=(r,...t)=>{let e=r.length===1?r[0]:t.reduce((o,s,n)=>o+(i=>{if(i._$cssResult$===!0)return i.cssText;if(typeof i=="number")return i;throw Error("Value passed to 'css' function must be a 'css' function result: "+i+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+r[n+1],r[0]);return new M(e,r,rt)},vt=(r,t)=>{if(F)r.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let o=document.createElement("style"),s=W.litNonce;s!==void 0&&o.setAttribute("nonce",s),o.textContent=e.cssText,r.appendChild(o)}},it=F?r=>r:r=>r instanceof CSSStyleSheet?(t=>{let e="";for(let o of t.cssRules)e+=o.cssText;return I(e)})(r):r;var{is:se,defineProperty:ie,getOwnPropertyDescriptor:ne,getOwnPropertyNames:ae,getOwnPropertySymbols:le,getPrototypeOf:he}=Object,V=globalThis,yt=V.trustedTypes,ce=yt?yt.emptyScript:"",de=V.reactiveElementPolyfillSupport,H=(r,t)=>r,N={toAttribute(r,t){switch(t){case Boolean:r=r?ce:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,t){let e=r;switch(t){case Boolean:e=r!==null;break;case Number:e=r===null?null:Number(r);break;case Object:case Array:try{e=JSON.parse(r)}catch{e=null}}return e}},K=(r,t)=>!se(r,t),$t={attribute:!0,type:String,converter:N,reflect:!1,useDefault:!1,hasChanged:K};Symbol.metadata??=Symbol("metadata"),V.litPropertyMetadata??=new WeakMap;var y=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$t){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let o=Symbol(),s=this.getPropertyDescriptor(t,o,e);s!==void 0&&ie(this.prototype,t,s)}}static getPropertyDescriptor(t,e,o){let{get:s,set:n}=ne(this.prototype,t)??{get(){return this[e]},set(i){this[e]=i}};return{get:s,set(i){let l=s?.call(this);n?.call(this,i),this.requestUpdate(t,l,o)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$t}static _$Ei(){if(this.hasOwnProperty(H("elementProperties")))return;let t=he(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(H("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(H("properties"))){let e=this.properties,o=[...ae(e),...le(e)];for(let s of o)this.createProperty(s,e[s])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[o,s]of e)this.elementProperties.set(o,s)}this._$Eh=new Map;for(let[e,o]of this.elementProperties){let s=this._$Eu(e,o);s!==void 0&&this._$Eh.set(s,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let o=new Set(t.flat(1/0).reverse());for(let s of o)e.unshift(it(s))}else t!==void 0&&e.push(it(t));return e}static _$Eu(t,e){let o=e.attribute;return o===!1?void 0:typeof o=="string"?o:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let o of e.keys())this.hasOwnProperty(o)&&(t.set(o,this[o]),delete this[o]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return vt(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,o){this._$AK(t,o)}_$ET(t,e){let o=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,o);if(s!==void 0&&o.reflect===!0){let n=(o.converter?.toAttribute!==void 0?o.converter:N).toAttribute(e,o.type);this._$Em=t,n==null?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){let o=this.constructor,s=o._$Eh.get(t);if(s!==void 0&&this._$Em!==s){let n=o.getPropertyOptions(s),i=typeof n.converter=="function"?{fromAttribute:n.converter}:n.converter?.fromAttribute!==void 0?n.converter:N;this._$Em=s;let l=i.fromAttribute(e,n.type);this[s]=l??this._$Ej?.get(s)??l,this._$Em=null}}requestUpdate(t,e,o,s=!1,n){if(t!==void 0){let i=this.constructor;if(s===!1&&(n=this[t]),o??=i.getPropertyOptions(t),!((o.hasChanged??K)(n,e)||o.useDefault&&o.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(i._$Eu(t,o))))return;this.C(t,e,o)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:o,reflect:s,wrapped:n},i){o&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,i??e??this[t]),n!==!0||i!==void 0)||(this._$AL.has(t)||(this.hasUpdated||o||(e=void 0),this._$AL.set(t,e)),s===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[s,n]of this._$Ep)this[s]=n;this._$Ep=void 0}let o=this.constructor.elementProperties;if(o.size>0)for(let[s,n]of o){let{wrapped:i}=n,l=this[s];i!==!0||this._$AL.has(s)||l===void 0||this.C(s,void 0,n,l)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(o=>o.hostUpdate?.()),this.update(e)):this._$EM()}catch(o){throw t=!1,this._$EM(),o}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};y.elementStyles=[],y.shadowRootOptions={mode:"open"},y[H("elementProperties")]=new Map,y[H("finalized")]=new Map,de?.({ReactiveElement:y}),(V.reactiveElementVersions??=[]).push("2.1.2");var ut=globalThis,At=r=>r,Y=ut.trustedTypes,Et=Y?Y.createPolicy("lit-html",{createHTML:r=>r}):void 0,Ct="$lit$",A=`lit$${Math.random().toFixed(9).slice(2)}$`,Ot="?"+A,ue=`<${Ot}>`,T=document,L=()=>T.createComment(""),U=r=>r===null||typeof r!="object"&&typeof r!="function",pt=Array.isArray,pe=r=>pt(r)||typeof r?.[Symbol.iterator]=="function",nt=`[ 	
\f\r]`,D=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,St=/-->/g,Rt=/>/g,R=RegExp(`>|${nt}(?:([^\\s"'>=/]+)(${nt}*=${nt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),wt=/'/g,Tt=/"/g,kt=/^(?:script|style|textarea|title)$/i,mt=r=>(t,...e)=>({_$litType$:r,strings:t,values:e}),E=mt(1),Ne=mt(2),De=mt(3),$=Symbol.for("lit-noChange"),u=Symbol.for("lit-nothing"),xt=new WeakMap,w=T.createTreeWalker(T,129);function Mt(r,t){if(!pt(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return Et!==void 0?Et.createHTML(t):t}var me=(r,t)=>{let e=r.length-1,o=[],s,n=t===2?"<svg>":t===3?"<math>":"",i=D;for(let l=0;l<e;l++){let a=r[l],c,d,h=-1,b=0;for(;b<a.length&&(i.lastIndex=b,d=i.exec(a),d!==null);)b=i.lastIndex,i===D?d[1]==="!--"?i=St:d[1]!==void 0?i=Rt:d[2]!==void 0?(kt.test(d[2])&&(s=RegExp("</"+d[2],"g")),i=R):d[3]!==void 0&&(i=R):i===R?d[0]===">"?(i=s??D,h=-1):d[1]===void 0?h=-2:(h=i.lastIndex-d[2].length,c=d[1],i=d[3]===void 0?R:d[3]==='"'?Tt:wt):i===Tt||i===wt?i=R:i===St||i===Rt?i=D:(i=R,s=void 0);let v=i===R&&r[l+1].startsWith("/>")?" ":"";n+=i===D?a+ue:h>=0?(o.push(c),a.slice(0,h)+Ct+a.slice(h)+A+v):a+A+(h===-2?l:v)}return[Mt(r,n+(r[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),o]},P=class r{constructor({strings:t,_$litType$:e},o){let s;this.parts=[];let n=0,i=0,l=t.length-1,a=this.parts,[c,d]=me(t,e);if(this.el=r.createElement(c,o),w.currentNode=this.el.content,e===2||e===3){let h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(s=w.nextNode())!==null&&a.length<l;){if(s.nodeType===1){if(s.hasAttributes())for(let h of s.getAttributeNames())if(h.endsWith(Ct)){let b=d[i++],v=s.getAttribute(h).split(A),_=/([.?@])?(.*)/.exec(b);a.push({type:1,index:n,name:_[2],strings:v,ctor:_[1]==="."?lt:_[1]==="?"?ht:_[1]==="@"?ct:C}),s.removeAttribute(h)}else h.startsWith(A)&&(a.push({type:6,index:n}),s.removeAttribute(h));if(kt.test(s.tagName)){let h=s.textContent.split(A),b=h.length-1;if(b>0){s.textContent=Y?Y.emptyScript:"";for(let v=0;v<b;v++)s.append(h[v],L()),w.nextNode(),a.push({type:2,index:++n});s.append(h[b],L())}}}else if(s.nodeType===8)if(s.data===Ot)a.push({type:2,index:n});else{let h=-1;for(;(h=s.data.indexOf(A,h+1))!==-1;)a.push({type:7,index:n}),h+=A.length-1}n++}}static createElement(t,e){let o=T.createElement("template");return o.innerHTML=t,o}};function x(r,t,e=r,o){if(t===$)return t;let s=o!==void 0?e._$Co?.[o]:e._$Cl,n=U(t)?void 0:t._$litDirective$;return s?.constructor!==n&&(s?._$AO?.(!1),n===void 0?s=void 0:(s=new n(r),s._$AT(r,e,o)),o!==void 0?(e._$Co??=[])[o]=s:e._$Cl=s),s!==void 0&&(t=x(r,s._$AS(r,t.values),s,o)),t}var at=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:o}=this._$AD,s=(t?.creationScope??T).importNode(e,!0);w.currentNode=s;let n=w.nextNode(),i=0,l=0,a=o[0];for(;a!==void 0;){if(i===a.index){let c;a.type===2?c=new B(n,n.nextSibling,this,t):a.type===1?c=new a.ctor(n,a.name,a.strings,this,t):a.type===6&&(c=new dt(n,this,t)),this._$AV.push(c),a=o[++l]}i!==a?.index&&(n=w.nextNode(),i++)}return w.currentNode=T,s}p(t){let e=0;for(let o of this._$AV)o!==void 0&&(o.strings!==void 0?(o._$AI(t,o,e),e+=o.strings.length-2):o._$AI(t[e])),e++}},B=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,o,s){this.type=2,this._$AH=u,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=o,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=x(this,t,e),U(t)?t===u||t==null||t===""?(this._$AH!==u&&this._$AR(),this._$AH=u):t!==this._$AH&&t!==$&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):pe(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==u&&U(this._$AH)?this._$AA.nextSibling.data=t:this.T(T.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:o}=t,s=typeof o=="number"?this._$AC(t):(o.el===void 0&&(o.el=P.createElement(Mt(o.h,o.h[0]),this.options)),o);if(this._$AH?._$AD===s)this._$AH.p(e);else{let n=new at(s,this),i=n.u(this.options);n.p(e),this.T(i),this._$AH=n}}_$AC(t){let e=xt.get(t.strings);return e===void 0&&xt.set(t.strings,e=new P(t)),e}k(t){pt(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,o,s=0;for(let n of t)s===e.length?e.push(o=new r(this.O(L()),this.O(L()),this,this.options)):o=e[s],o._$AI(n),s++;s<e.length&&(this._$AR(o&&o._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let o=At(t).nextSibling;At(t).remove(),t=o}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},C=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,o,s,n){this.type=1,this._$AH=u,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,o.length>2||o[0]!==""||o[1]!==""?(this._$AH=Array(o.length-1).fill(new String),this.strings=o):this._$AH=u}_$AI(t,e=this,o,s){let n=this.strings,i=!1;if(n===void 0)t=x(this,t,e,0),i=!U(t)||t!==this._$AH&&t!==$,i&&(this._$AH=t);else{let l=t,a,c;for(t=n[0],a=0;a<n.length-1;a++)c=x(this,l[o+a],e,a),c===$&&(c=this._$AH[a]),i||=!U(c)||c!==this._$AH[a],c===u?t=u:t!==u&&(t+=(c??"")+n[a+1]),this._$AH[a]=c}i&&!s&&this.j(t)}j(t){t===u?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},lt=class extends C{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===u?void 0:t}},ht=class extends C{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==u)}},ct=class extends C{constructor(t,e,o,s,n){super(t,e,o,s,n),this.type=5}_$AI(t,e=this){if((t=x(this,t,e,0)??u)===$)return;let o=this._$AH,s=t===u&&o!==u||t.capture!==o.capture||t.once!==o.once||t.passive!==o.passive,n=t!==u&&(o===u||s);s&&this.element.removeEventListener(this.name,this,o),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},dt=class{constructor(t,e,o){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=o}get _$AU(){return this._$AM._$AU}_$AI(t){x(this,t)}};var fe=ut.litHtmlPolyfillSupport;fe?.(P,B),(ut.litHtmlVersions??=[]).push("3.3.2");var It=(r,t,e)=>{let o=e?.renderBefore??t,s=o._$litPart$;if(s===void 0){let n=e?.renderBefore??null;o._$litPart$=s=new B(t.insertBefore(L(),n),n,void 0,e??{})}return s._$AI(r),s};var ft=globalThis,S=class extends y{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=It(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return $}};S._$litElement$=!0,S.finalized=!0,ft.litElementHydrateSupport?.({LitElement:S});var be=ft.litElementPolyfillSupport;be?.({LitElement:S});(ft.litElementVersions??=[]).push("4.2.2");var ge={attribute:!0,type:String,converter:N,reflect:!1,hasChanged:K},_e=(r=ge,t,e)=>{let{kind:o,metadata:s}=e,n=globalThis.litPropertyMetadata.get(s);if(n===void 0&&globalThis.litPropertyMetadata.set(s,n=new Map),o==="setter"&&((r=Object.create(r)).wrapped=!0),n.set(e.name,r),o==="accessor"){let{name:i}=e;return{set(l){let a=t.get.call(this);t.set.call(this,l),this.requestUpdate(i,a,r,!0,l)},init(l){return l!==void 0&&this.C(i,void 0,r,l),l}}}if(o==="setter"){let{name:i}=e;return function(l){let a=this[i];t.call(this,l),this.requestUpdate(i,a,r,!0,l)}}throw Error("Unsupported decorator location: "+o)};function f(r){return(t,e)=>typeof e=="object"?_e(r,t,e):((o,s,n)=>{let i=s.hasOwnProperty(n);return s.constructor.createProperty(n,o),i?Object.getOwnPropertyDescriptor(s,n):void 0})(r,t,e)}function bt(r){return f({...r,state:!0,attribute:!1})}var Ht={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Nt=r=>(...t)=>({_$litDirective$:r,values:t}),J=class{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,e,o){this._$Ct=t,this._$AM=e,this._$Ci=o}_$AS(t,e){return this.update(t,e)}update(t,e){return this.render(...e)}};var Dt="important",ve=" !"+Dt,G=Nt(class extends J{constructor(r){if(super(r),r.type!==Ht.ATTRIBUTE||r.name!=="style"||r.strings?.length>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(r){return Object.keys(r).reduce((t,e)=>{let o=r[e];return o==null?t:t+`${e=e.includes("-")?e:e.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase()}:${o};`},"")}update(r,[t]){let{style:e}=r.element;if(this.ft===void 0)return this.ft=new Set(Object.keys(t)),this.render(t);for(let o of this.ft)t[o]==null&&(this.ft.delete(o),o.includes("-")?e.removeProperty(o):e[o]=null);for(let o in t){let s=t[o];if(s!=null){this.ft.add(o);let n=typeof s=="string"&&s.endsWith(ve);o.includes("-")||n?e.setProperty(o,n?s.slice(0,-11):s,n?Dt:""):e[o]=s}}return $}});function Lt(r,t){return r.map((e,o)=>{let s=e.borderRadius||`${t.fallbackRadius}px`,n={left:`${e.x}px`,top:`${e.y}px`,width:`${e.width}px`,height:`${e.height}px`,"border-radius":s};if(e.isContainer){let l={...n};return e.containerBg&&(l.background=e.containerBg),e.containerBorder&&(l.border=e.containerBorder),e.containerShadow&&(l["box-shadow"]=e.containerShadow),E`<div
        class="shimmer-container-block"
        style=${G(l)}
      >${t.debug?E`<span class="debug-label" data-kind="container">C${o}</span>`:u}</div>`}let i={...n,background:`var(--shimmer-bg, ${t.backgroundColor})`};return t.stagger>0&&(i["animation-delay"]=`${o*t.stagger}s`),E`<div class="shimmer-block" style=${G(i)}>${t.debug?E`<span class="debug-label">${o}</span>`:u}</div>`})}var j="phantom-ui",g="data-shimmer-ignore",Z="data-shimmer-no-children",Q="data-shimmer-width",tt="data-shimmer-height",O="data-phantom-graphic",z="rgba(128, 128, 128, 0.3)",q="rgba(128, 128, 128, 0.2)";var Pt=["img","svg","video","canvas","button",'[role="button"]'],Bt=`
	-webkit-text-fill-color: transparent !important;
	pointer-events: none;
	user-select: none;
`,ye=`
	-webkit-text-fill-color: initial !important;
	pointer-events: auto;
	user-select: auto;
`,k=`${j}[loading]:not([mode="overlay"])`,Ut=r=>Pt.map(t=>`${r} ${t}`).join(`,
	`),$e=`
	${k} * { ${Bt} }
	${Ut(k)} { opacity: 0 !important; }
	${k} [${g}],
	${k} [${g}] * { ${ye} }
	${Ut(`${k} [${g}]`)} { opacity: 1 !important; }
`,Ae=`${k} [${O}]`,Gt=`${$e}
	${Ae} { opacity: 0 !important; }
`,jt=`
	:host([${g}]) *, [${g}] * {
		-webkit-text-fill-color: initial !important;
		opacity: 1 !important;
	}
	* { ${Bt} }
	${Pt.join(", ")}, [${O}] { opacity: 0 !important; }
`;var zt="phantom-ui-loading-styles";function qt(){if(document.getElementById(zt))return;let r=document.createElement("style");r.id=zt,r.textContent=Gt,document.head.appendChild(r)}function Wt(r){for(let t of[null,"::before","::after"]){let e=getComputedStyle(r,t),o=e.getPropertyValue("mask-image")||e.getPropertyValue("-webkit-mask-image");if(o&&o!=="none")return!0}return!1}var gt="phantom-ui-shadow-hide";function Ft(r){if(r.querySelector(`#${gt}`))return;let t=document.createElement("style");t.id=gt,t.textContent=jt,r.appendChild(t)}function Vt(r){r.querySelector(`#${gt}`)?.remove()}var et=class{constructor(t){this.host=t;this._hiddenRoots=new Set;this._markedGraphics=new Set;this._inertedElements=new Set;t.addController(this)}hostDisconnected(){this.restore()}apply(t){let e=this.host.pierceShadow;Ee(t,e,o=>{e&&o.shadowRoot&&(Ft(o.shadowRoot),this._hiddenRoots.add(o.shadowRoot)),Wt(o)&&(o.setAttribute(O,""),this._markedGraphics.add(o))}),this._restoreInert(),this._applyInert(t)}restore(){this._restoreShadowContent(),this._restoreGraphics(),this._restoreInert()}_restoreShadowContent(){for(let t of this._hiddenRoots)Vt(t);this._hiddenRoots.clear()}_restoreGraphics(){for(let t of this._markedGraphics)t.removeAttribute(O);this._markedGraphics.clear()}_applyInert(t){let e=o=>{if(!o.hasAttribute(g)){if(!o.querySelector(`[${g}]`)){o.hasAttribute("inert")||(o.setAttribute("inert",""),this._inertedElements.add(o));return}for(let s of o.children)e(s)}};for(let o of t)e(o)}_restoreInert(){for(let t of this._inertedElements)t.removeAttribute("inert");this._inertedElements.clear()}};function Ee(r,t,e){let o=s=>{if(e(s),t&&s.shadowRoot)for(let n of s.shadowRoot.children)o(n);for(let n of s.children)o(n)};for(let s of r)o(s)}var Se=new Set(["IMG","SVG","VIDEO","CANVAS","IFRAME","INPUT","TEXTAREA","BUTTON","HR"]),Kt=new Set(["BR","WBR"]);function Re(r){if(Se.has(r.tagName))return!0;for(let t of r.children)if(!Kt.has(t.tagName))return!1;return!0}function we(r){if(r.children.length===0)return!1;for(let t of r.children)if(t.tagName!=="SLOT"&&!Kt.has(t.tagName))return!1;return!0}function Yt(r){return r==="0px"?"":r}function Te(r,t){let e=document.createElement("span");e.style.visibility="hidden",e.style.position="absolute",e.textContent=r.textContent,r.appendChild(e);let{width:o}=e.getBoundingClientRect();return r.removeChild(e),Math.min(o,t)}function xe(r){for(let t of r.childNodes)if(t.nodeType===Node.TEXT_NODE&&t.textContent?.trim())return!0;return!1}function Xt(r,t,e=!1,o){let s=[];function n(i){if(i instanceof HTMLSlotElement){for(let _ of i.assignedElements({flatten:!0}))n(_);return}let l=i.getBoundingClientRect(),a=Number(i.getAttribute(Q))||0,c=Number(i.getAttribute(tt))||0,d=a>0||c>0,h=a||l.width,b=c||l.height;if((h===0||b===0)&&!d||i.hasAttribute(g))return;if(e&&i.shadowRoot&&(o?.add(i.shadowRoot),i.shadowRoot.children.length>0)){for(let _ of i.shadowRoot.children)n(_);return}if(i.hasAttribute(Z)||Re(i)||e&&we(i)){let _=(i.tagName==="TD"||i.tagName==="TH")&&xe(i)&&!a;s.push({x:l.left-t.left,y:l.top-t.top,width:_?Te(i,l.width):h,height:b,borderRadius:Yt(getComputedStyle(i).borderRadius)});return}for(let _ of i.children)n(_)}return n(r),s}function Jt(r,t){let e=r.getBoundingClientRect();if(e.width===0||e.height===0)return null;let o=getComputedStyle(r),s=o.backgroundColor,n=o.borderWidth,i=o.borderStyle,l=o.borderColor,a=o.boxShadow,c=o.borderRadius,d=s==="rgba(0, 0, 0, 0)"||s==="transparent",h=i!=="none"&&n!=="0px",b=a!=="none"&&a!=="";if(d&&!h&&!b)return null;let v=h?`${n} ${i} ${l}`:"";return{x:e.left-t.left,y:e.top-t.top,width:e.width,height:e.height,borderRadius:Yt(c),backgroundColor:d?"":s,border:v,boxShadow:b?a:""}}function Zt(r,t,{count:e,gap:o,rowHeight:s}){let n=[...r];for(let i=1;i<e;i++){let l=i*(s+o);for(let a of t)n.push({x:a.x,y:a.y+l,width:a.width,height:a.height,borderRadius:a.borderRadius,isContainer:!0,containerBg:a.backgroundColor,containerBorder:a.border,containerShadow:a.boxShadow});for(let a of r)n.push({...a,y:a.y+l})}return n}function Qt(r,t){let e=null,o=new ResizeObserver(()=>{e!==null&&cancelAnimationFrame(e),e=requestAnimationFrame(()=>{e=null,t()})});return o.observe(r),o}var te=st`
	:host {
		display: block;
		position: relative;
		overflow: hidden;
		--shimmer-color: ${I(z)};
		--shimmer-duration: ${1.5}s;
		--shimmer-bg: ${I(q)};
	}

	:host([loading]:not([mode="overlay"])) ::slotted(*) {
		-webkit-text-fill-color: transparent !important;
		pointer-events: none;
		user-select: none;
	}

	:host([loading]:not([mode="overlay"])) ::slotted(img),
	:host([loading]:not([mode="overlay"])) ::slotted(svg),
	:host([loading]:not([mode="overlay"])) ::slotted(video),
	:host([loading]:not([mode="overlay"])) ::slotted(canvas),
	:host([loading]:not([mode="overlay"])) ::slotted(button),
	:host([loading]:not([mode="overlay"])) ::slotted([role="button"]) {
		opacity: 0 !important;
	}

	/*
	 * Overlay mode: keep the content visible and dimmed, and turn each measured
	 * block into a transparent glint that sweeps over the matching element (a
	 * structure-aware stale-while-revalidate refresh). Setting --shimmer-bg to
	 * transparent makes both the block fill and the gradient edges transparent, so
	 * the same block + direction + reduced-motion rules become a pure light sweep.
	 */
	:host([mode="overlay"]) {
		--shimmer-bg: transparent;
	}

	:host([loading][mode="overlay"]) ::slotted(*) {
		opacity: var(--phantom-content-opacity, 0.5);
		pointer-events: none;
		transition: opacity 0.2s ease-out;
	}

	/* Container blocks replicate card backgrounds for count > 1, which would cover
	   the visible content. Overlay never duplicates rows, so hide them. */
	:host([mode="overlay"]) .shimmer-container-block {
		display: none;
	}

	.shimmer-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		transition: opacity var(--reveal-duration, 0s) ease-out;
	}

	.shimmer-overlay.revealing {
		opacity: 0;
	}

	.shimmer-block {
		position: absolute;
		overflow: hidden;
	}

	.shimmer-container-block {
		position: absolute;
		box-sizing: border-box;
	}

	.shimmer-block::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			var(--shimmer-bg) 30%,
			var(--shimmer-color) 50%,
			var(--shimmer-bg) 70%
		);
		background-size: 200% 100%;
		animation: shimmer-horizontal var(--shimmer-duration) linear infinite;
	}

	:host([shimmer-direction="ttb"]) .shimmer-block::after,
	:host([shimmer-direction="btt"]) .shimmer-block::after {
		background: linear-gradient(
			180deg,
			var(--shimmer-bg) 30%,
			var(--shimmer-color) 50%,
			var(--shimmer-bg) 70%
		);
		background-size: 100% 200%;
		animation-name: shimmer-vertical;
	}

	/* rtl and btt sweep the same track as ltr/ttb, just the other way. The timing
	   function is linear, so reversing the animation is equivalent to a mirrored
	   set of keyframes. */
	:host([shimmer-direction="rtl"]) .shimmer-block::after,
	:host([shimmer-direction="btt"]) .shimmer-block::after {
		animation-direction: reverse;
	}

	@keyframes shimmer-horizontal {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	@keyframes shimmer-vertical {
		0% { background-position: 0 200%; }
		100% { background-position: 0 -200%; }
	}

	:host([animation="pulse"]) .shimmer-block {
		animation: phantom-pulse var(--shimmer-duration) ease-in-out infinite;
	}

	:host([animation="pulse"]) .shimmer-block::after {
		display: none;
	}

	@keyframes phantom-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	:host([animation="breathe"]) .shimmer-block {
		animation: phantom-breathe var(--shimmer-duration) ease-in-out infinite;
	}

	:host([animation="breathe"]) .shimmer-block::after {
		display: none;
	}

	@keyframes phantom-breathe {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.02);
		}
	}

	:host([animation="solid"]) .shimmer-block::after {
		display: none;
	}

	/* Overlay paints nothing but the glint: its block fill is transparent by design, so
	   every path that suppresses the glint leaves the refresh with no indication at all.
	   Keep a flat veil in those cases. pulse and breathe animate the block, so they
	   animate the veil with it; solid holds it static. */
	:host([mode="overlay"][animation="pulse"]) .shimmer-block::after,
	:host([mode="overlay"][animation="breathe"]) .shimmer-block::after,
	:host([mode="overlay"][animation="solid"]) .shimmer-block::after {
		display: block;
		animation: none;
		background: var(--shimmer-color);
	}

	:host([debug]) .shimmer-block {
		outline: 1px dashed rgba(247, 118, 142, 0.9);
		outline-offset: -1px;
	}

	:host([debug]) .shimmer-container-block {
		outline: 1px dashed rgba(122, 162, 247, 0.9);
		outline-offset: -1px;
	}

	.debug-label {
		position: absolute;
		top: 2px;
		left: 2px;
		font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #fff;
		background: rgba(247, 118, 142, 0.95);
		padding: 2px 5px;
		border-radius: 3px;
		pointer-events: none;
		z-index: 1;
	}

	.debug-label[data-kind="container"] {
		background: rgba(122, 162, 247, 0.95);
	}

	/* Reduced motion — degrade every animation mode to the static solid look
	   (WCAG 2.3.3: the infinite shimmer/pulse/breathe animations stop; blocks
	   keep their static background, exactly like animation="solid"). */
	@media (prefers-reduced-motion: reduce) {
		.shimmer-block,
		:host([animation]) .shimmer-block {
			animation: none;
		}

		.shimmer-block::after {
			display: none;
		}

		/* Skeleton keeps its static block fill, so dropping the glint still leaves the
		   placeholder visible. Overlay has no fill to fall back on, so it keeps the veil,
		   held static by the animation: none above. */
		:host([mode="overlay"]) .shimmer-block::after {
			display: block;
			animation: none;
			background: var(--shimmer-color);
		}
	}
`;var ee={childList:!0,subtree:!0,attributes:!0},Ce={childList:!0,subtree:!0,attributes:!0,attributeFilter:[Q,tt,g,Z,"style","hidden"]},p=class extends S{constructor(){super(...arguments);this.loading=!1;this.shimmerDirection="ltr";this.shimmerColor=z;this.backgroundColor=q;this.duration=1.5;this.fallbackRadius=4;this.animation="shimmer";this.mode="skeleton";this.stagger=0;this.reveal=0;this.count=1;this.countGap=0;this.debug=!1;this.loadingLabel="Loading";this.pierceShadow=!1;this._blocks=[];this._revealing=!1;this._resizeObserver=null;this._mutationObserver=null;this._loadHandler=null;this._measureScheduled=!1;this._revealTimeout=null;this._visibility=new et(this)}static{this.styles=te}connectedCallback(){super.connectedCallback(),qt(),this.hasUpdated&&this.loading&&(this._setupObservers(),this._scheduleMeasure())}disconnectedCallback(){super.disconnectedCallback(),this._teardownObservers(),this._clearRevealTimeout()}willUpdate(e){e.has("loading")&&!this.loading&&this.reveal>0&&this._blocks.length>0&&(this._revealing=!0)}updated(e){if((e.has("count")||e.has("countGap"))&&this.loading&&this._scheduleMeasure(),e.has("loading")||e.has("loadingLabel")){let o=!!this.loading;this.setAttribute("aria-busy",String(o)),o?this.setAttribute("aria-label",this.loadingLabel):this.removeAttribute("aria-label")}e.has("loading")&&(!this.loading&&this.hasAttribute("loading")&&this.removeAttribute("loading"),this.loading?(this._revealing=!1,this._clearRevealTimeout(),this._scheduleMeasure(),this._setupObservers()):this._revealing?(this._teardownObservers(),this._revealTimeout=setTimeout(()=>{this._revealing=!1,this._blocks=[],this._revealTimeout=null,this.style.minHeight="",this._visibility.restore()},this.reveal*1e3)):(this._blocks=[],this._teardownObservers(),this.style.minHeight="",this._visibility.restore()))}render(){let e={};this.shimmerColor!==z&&(e["--shimmer-color"]=this.shimmerColor),this.backgroundColor!==q&&(e["--shimmer-bg"]=this.backgroundColor),Number.isFinite(this.duration)&&this.duration!==1.5&&(e["--shimmer-duration"]=`${this.duration}s`),Number.isFinite(this.reveal)&&this.reveal>0&&(e["--reveal-duration"]=`${this.reveal}s`);let o=G(e),s=this.loading||this._revealing;return E`
      <slot></slot>
      ${s?E`
            <div
              class="shimmer-overlay ${this._revealing?"revealing":""}"
              style=${o}
              aria-hidden="true"
            >
              ${Lt(this._blocks,{fallbackRadius:this.fallbackRadius,backgroundColor:this.backgroundColor,stagger:this.stagger,debug:this.debug})}
            </div>
          `:u}
    `}_scheduleMeasure(){this._measureScheduled||(this._measureScheduled=!0,requestAnimationFrame(()=>{this._measureScheduled=!1,this._measure()}))}_measure(){if(!this.loading)return;let e=this.getBoundingClientRect();if(e.width===0||e.height===0)return;let o=this.shadowRoot?.querySelector("slot");if(!o)return;this._mutationObserver&&this._mutationObserver.disconnect();let s=o.assignedElements({flatten:!0});this.mode!=="overlay"&&this._visibility.apply(s);let n=new Set,i=[];for(let l of s)i.push(...Xt(l,e,this.pierceShadow,n));if(this.count>1&&i.length>0&&this.mode!=="overlay"){let l=0,a=[];for(let c of s){l=Math.max(l,c.getBoundingClientRect().bottom-e.top);let d=Jt(c,e);d&&a.push(d)}i=Zt(i,a,{count:this.count,gap:this.countGap,rowHeight:l}),this.style.minHeight=`${this.count*l+(this.count-1)*this.countGap}px`}else this.style.minHeight="";if(this._blocks=i,this._mutationObserver){this._mutationObserver.observe(this,ee);for(let l of n)this._mutationObserver.observe(l,Ce)}}_setupObservers(){this._teardownObservers(),this._resizeObserver=Qt(this,()=>{this._scheduleMeasure()}),this._mutationObserver=new MutationObserver(()=>{this._scheduleMeasure()}),this._mutationObserver.observe(this,ee),this._loadHandler=()=>this._scheduleMeasure(),this.addEventListener("load",this._loadHandler,!0)}_teardownObservers(){this._resizeObserver&&(this._resizeObserver.disconnect(),this._resizeObserver=null),this._mutationObserver&&(this._mutationObserver.disconnect(),this._mutationObserver=null),this._loadHandler&&(this.removeEventListener("load",this._loadHandler,!0),this._loadHandler=null)}_clearRevealTimeout(){this._revealTimeout!==null&&(clearTimeout(this._revealTimeout),this._revealTimeout=null)}};m([f({type:Boolean,reflect:!0,converter:{fromAttribute:e=>e!==null&&e!=="false",toAttribute:e=>e?"":null}})],p.prototype,"loading",2),m([f({attribute:"shimmer-direction",reflect:!0})],p.prototype,"shimmerDirection",2),m([f({attribute:"shimmer-color"})],p.prototype,"shimmerColor",2),m([f({attribute:"background-color"})],p.prototype,"backgroundColor",2),m([f({type:Number})],p.prototype,"duration",2),m([f({type:Number,attribute:"fallback-radius"})],p.prototype,"fallbackRadius",2),m([f({reflect:!0})],p.prototype,"animation",2),m([f({reflect:!0})],p.prototype,"mode",2),m([f({type:Number})],p.prototype,"stagger",2),m([f({type:Number})],p.prototype,"reveal",2),m([f({type:Number,converter:e=>Math.max(1,Math.round(Number(e)||1))})],p.prototype,"count",2),m([f({type:Number,attribute:"count-gap",converter:e=>Math.max(0,Number(e)||0)})],p.prototype,"countGap",2),m([f({type:Boolean,reflect:!0})],p.prototype,"debug",2),m([f({attribute:"loading-label"})],p.prototype,"loadingLabel",2),m([f({type:Boolean,attribute:"pierce-shadow"})],p.prototype,"pierceShadow",2),m([bt()],p.prototype,"_blocks",2),m([bt()],p.prototype,"_revealing",2);customElements.get(j)||customElements.define(j,p);export{p as PhantomUi};
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
lit-html/lit-html.js:
lit-element/lit-element.js:
@lit/reactive-element/decorators/custom-element.js:
@lit/reactive-element/decorators/property.js:
@lit/reactive-element/decorators/state.js:
@lit/reactive-element/decorators/event-options.js:
@lit/reactive-element/decorators/base.js:
@lit/reactive-element/decorators/query.js:
@lit/reactive-element/decorators/query-all.js:
@lit/reactive-element/decorators/query-async.js:
@lit/reactive-element/decorators/query-assigned-nodes.js:
lit-html/directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/style-map.js:
  (**
   * @license
   * Copyright 2018 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
