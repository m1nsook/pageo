use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};

const CONFIG: &str = "site.json";
const EXPORTS: &str = "site-exports";
// First-party, browser-only runtime. The Studio preview deliberately removes it.
struct SiteRuntimeAsset {
    filename: &'static str,
    source: &'static str,
}
const SITE_RUNTIME_ASSETS: &[SiteRuntimeAsset] = &[
    SiteRuntimeAsset { filename: "paglora.js", source: include_str!("../../../../packages/site-runtime/dist/index.js") },
    SiteRuntimeAsset { filename: "paglora-search.js", source: include_str!("../../../../packages/site-runtime/dist/search.js") },
];
fn site_runtime_script_tags() -> String {
    SITE_RUNTIME_ASSETS.iter()
        .map(|asset| format!("<script defer src=\"{}\"></script>\n", asset.filename))
        .collect()
}
const SITE_CSS: &str = r#"
@font-face{font-family:"Geist Website";src:url("fonts/geist-latin.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}
:root{color-scheme:light;--bg:#ffffff;--fg:#151a24;--muted:#626b7c;--line:#e6eaf0;--subtle:#f6f8fb;--hover:#edf3fa;--brand:#2196f3;--brand-light:#eaf5ff;--code-bg:#101828;--code-fg:#e9eef8;--header-bg:rgba(255,255,255,.96)}
:root[data-color-mode="dark"]{color-scheme:dark;--bg:#11151d;--fg:#f1f4f9;--muted:#a5aec0;--line:#2a3342;--subtle:#191f2b;--hover:#222d40;--brand:#72baff;--brand-light:#152e48;--code-bg:#080d14;--code-fg:#e9eef8;--header-bg:rgba(17,21,29,.96)}
@media(prefers-color-scheme:dark){:root:not([data-color-mode="light"]){color-scheme:dark;--bg:#11151d;--fg:#f1f4f9;--muted:#a5aec0;--line:#2a3342;--subtle:#191f2b;--hover:#222d40;--brand:#72baff;--brand-light:#152e48;--code-bg:#080d14;--code-fg:#e9eef8;--header-bg:rgba(17,21,29,.96)}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:105px}
body{margin:0;background:var(--bg);color:var(--fg);font-family:"Geist Website",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.75;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit}
a:hover{color:var(--brand)}
a:focus-visible,summary:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
.skip-link{position:absolute;z-index:100;top:-60px;left:10px;background:var(--bg);padding:8px 14px;border:1px solid var(--line);border-radius:8px}
.skip-link:focus{top:10px}
.site-header{position:sticky;top:0;z-index:30;background:var(--header-bg);border-bottom:1px solid var(--line);backdrop-filter:blur(18px)}
.site-header.not-sticky{position:relative}
.paglora-appearance-toggle{flex-shrink:0;appearance:none;border:1px solid var(--line);border-radius:9px;background:var(--subtle);color:var(--fg);font:inherit;font-size:12px;font-weight:650;cursor:pointer;white-space:nowrap;padding:7px 11px;line-height:1.3}
.paglora-appearance-toggle:hover{border-color:var(--brand);background:var(--hover)}
.paglora-appearance-toggle:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.paglora-search-trigger{appearance:none;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;width:160px;min-height:33px;padding:5px 11px;border:1px solid var(--line);border-radius:9px;background:var(--subtle);color:var(--muted);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.paglora-search-trigger::after{content:"⌘K";font-size:11px;opacity:.65}
.paglora-search-trigger:hover{border-color:var(--brand);color:var(--fg)}
.paglora-search-trigger:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.paglora-search-open{overflow:hidden}
.paglora-search-backdrop[hidden]{display:none}
.paglora-search-backdrop{position:fixed;inset:0;z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:12vh 18px 28px;background:rgba(5,10,18,.65);backdrop-filter:blur(5px)}
.paglora-search-dialog{width:min(640px,100%);max-height:min(76vh,750px);display:flex;flex-direction:column;border:1px solid var(--line);border-radius:15px;background:var(--bg);color:var(--fg);box-shadow:0 20px 80px rgba(0,0,0,.25);overflow:hidden}
.paglora-search-field{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line)}
.paglora-search-input{flex:1;min-width:0;outline:none;background:transparent;border:0;color:var(--fg);font:inherit;font-size:16px}
.paglora-search-input::-webkit-search-cancel-button{cursor:pointer}
.paglora-search-close{padding:5px 9px;border:1px solid var(--line);border-radius:6px;background:var(--subtle);color:var(--muted);font:inherit;font-size:11px;cursor:pointer}
.paglora-search-results{min-height:100px;max-height:55vh;overflow-y:auto;padding:8px}
.paglora-search-result{display:block;padding:11px 13px;border:1px solid transparent;border-radius:9px;color:var(--fg);text-decoration:none}
.paglora-search-result:hover,.paglora-search-result.is-selected{background:var(--hover);border-color:var(--line)}
.paglora-search-result-title{display:block;font-size:13px;font-weight:700;line-height:1.5}
.paglora-search-result-summary{display:block;margin-top:4px;font-size:12px;color:var(--muted);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.paglora-search-status{padding:22px 15px;color:var(--muted);font-size:13px}
.paglora-search-retry{margin:0 15px 16px;padding:8px 12px;border:1px solid var(--line);border-radius:7px;background:var(--subtle);color:var(--fg);font:inherit;font-size:12px;cursor:pointer}
.paglora-search-retry:hover,.paglora-search-retry:focus-visible{border-color:var(--brand);outline-offset:2px}
.paglora-search-footnote{padding:9px 15px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
@media(max-width:680px){.paglora-search-trigger{width:auto;min-width:75px}.paglora-search-trigger::after{display:none}.paglora-search-backdrop{padding-top:7vh}}

.toc-inner a[aria-current="location"]{color:var(--brand);font-weight:650}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
.top-bar{max-width:1500px;min-height:72px;margin:auto;padding:0 clamp(22px,3vw,48px);display:flex;align-items:center;justify-content:space-between;gap:28px}
.brand-wrap{display:inline-flex;align-items:center;gap:12px;min-width:0}
.brand{font-size:17px;font-weight:750;letter-spacing:-.045em;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brand-logo{height:34px;max-width:144px;object-fit:contain}
.header-links{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.header-links a{font-size:13px;color:var(--muted);text-decoration:none;font-weight:550;white-space:nowrap}
.header-links a:hover{color:var(--fg)}
.site-header.header-center .top-bar{justify-content:center;flex-wrap:wrap;padding-block:14px}
.mobile-nav{display:none}
.site-body{max-width:1500px;margin:0 auto;display:grid;grid-template-columns:minmax(230px,260px) minmax(0,1fr) minmax(190px,235px);min-height:calc(100vh - 165px)}
.site-nav{grid-column:1;min-width:0;min-height:0;border-right:1px solid var(--line);padding:32px 16px 40px clamp(18px,2.5vw,42px)}
.site-nav-inner{position:sticky;top:100px;max-height:calc(100vh - 115px);overflow:auto;scrollbar-width:thin}
.site-nav .nav-group{margin-bottom:23px}
.site-nav .nav-group:last-child{margin-bottom:0}
.site-nav .nav-group>summary,.mobile-nav .nav-group>summary{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:6px 13px;margin:0 0 7px;border-radius:7px;color:var(--muted);font-size:11px;font-weight:750;line-height:1.5;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;list-style:none;user-select:none}
.site-nav .nav-group>summary::-webkit-details-marker,.mobile-nav .nav-group>summary::-webkit-details-marker{display:none}
.site-nav .nav-group>summary::after,.mobile-nav .nav-group>summary::after{content:"";width:6px;height:6px;flex-shrink:0;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .16s ease}
.site-nav .nav-group:not([open])>summary::after,.mobile-nav .nav-group:not([open])>summary::after{transform:rotate(-45deg)}
.site-nav .nav-group>summary:hover,.mobile-nav .nav-group>summary:hover{background:var(--hover);color:var(--fg)}
.site-nav .nav-group>summary:focus-visible,.mobile-nav .nav-group>summary:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.mobile-nav .nav-group{min-width:0}
.mobile-nav .nav-group>summary{margin:9px 0 5px}
.mobile-nav .nav-group-links{display:grid;gap:3px}
.site-body.nav-top .site-nav .nav-group{display:flex;align-items:center;gap:8px;margin:0}
.site-body.nav-top .site-nav .nav-group>summary{margin:0}
.site-body.nav-top .site-nav .nav-group-links{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
@media(prefers-reduced-motion:reduce){.site-nav .nav-group>summary::after,.mobile-nav .nav-group>summary::after{transition:none}}
.site-nav a{display:block;padding:8px 13px;margin:2px 0;border-radius:9px;text-decoration:none;font-size:13px;font-weight:500;line-height:1.55;color:var(--muted);overflow-wrap:anywhere;transition:background-color .13s,color .13s}
.site-nav a:hover{background:var(--hover);color:var(--fg)}
.site-nav a[aria-current=page]{background:var(--brand-light);color:var(--brand);font-weight:700}
.site-main{grid-column:2;min-width:0;width:100%;padding:44px clamp(26px,5vw,80px) 110px}
.article-wrap{max-width:var(--paglora-content-width,790px);margin:0 auto}
.page-heading{margin:0 0 27px;font-size:12px;line-height:1.5;color:var(--muted);font-weight:500}
.page-heading .crumb-separator{margin:0 8px;color:var(--muted)}
.page-heading strong{font-weight:650;color:var(--fg)}
.docs{font-size:15.5px;line-height:1.82;overflow-wrap:anywhere}
.docs h1,.docs h2,.docs h3,.docs h4{line-height:1.3;font-weight:740;letter-spacing:-.035em;scroll-margin-top:100px}
.docs h1{font-size:clamp(2.1rem,3.2vw,2.85rem);letter-spacing:-.052em;line-height:1.14;margin:0 0 27px}
.docs h2{font-size:1.68rem;margin:53px 0 17px;padding-bottom:13px;border-bottom:1px solid var(--line)}
.docs h3{font-size:1.25rem;margin:32px 0 12px}
.docs h4{font-size:1.05rem;margin:22px 0 9px}
.docs p,.docs ul,.docs ol{margin:0 0 19px}
.docs ul,.docs ol{padding-left:1.55em}
.docs li{padding-left:3px;margin:.32em 0}
.docs li::marker{color:var(--muted)}
.docs li.paglora-task-item{list-style:none;padding-left:0}
.docs .paglora-task-checkbox{margin:0 .55em 0 -1.5em;vertical-align:middle;accent-color:var(--brand);opacity:1;pointer-events:none}
.docs blockquote{margin:24px 0;border-left:3px solid var(--brand);padding:13px 20px;color:var(--muted);background:var(--subtle);border-radius:0 10px 10px 0}
.docs blockquote p:last-child{margin-bottom:0}

/* Markdown callouts — sanitized in the shared preview/build pipeline. */
.docs .paglora-callout{--callout-accent:var(--brand);position:relative;display:block;margin:25px 0;padding:16px 19px 17px;border:1px solid color-mix(in srgb,var(--callout-accent) 38%,var(--line));border-left:3px solid var(--callout-accent);border-radius:11px;background:color-mix(in srgb,var(--callout-accent) 7%,var(--bg));box-shadow:0 1px 2px rgba(0,0,0,.025)}
.docs .paglora-callout-title{display:flex;align-items:center;gap:9px;margin:0 0 6px;color:var(--fg);font-size:13px;font-weight:730;line-height:1.5}
.docs .paglora-callout-title::before{content:"i";display:grid;place-items:center;flex:0 0 18px;width:18px;height:18px;border-radius:50%;background:var(--callout-accent);color:#fff;font-size:12px;font-family:system-ui,sans-serif;font-style:normal;font-weight:750}
.docs .paglora-callout > :last-child{margin-bottom:0}
.docs .paglora-callout p{margin:0 0 10px}
.docs .paglora-callout ul,.docs .paglora-callout ol{margin:5px 0 10px}
.docs .paglora-callout-tip{--callout-accent:#168950}
.docs .paglora-callout-important{--callout-accent:#805bd4}
.docs .paglora-callout-warning{--callout-accent:#b67909}
.docs .paglora-callout-caution{--callout-accent:#c14454}
.docs .paglora-callout-tip .paglora-callout-title::before{content:"✓"}
.docs .paglora-callout-important .paglora-callout-title::before{content:"!"}
.docs .paglora-callout-warning .paglora-callout-title::before,.docs .paglora-callout-caution .paglora-callout-title::before{content:"!"}

.docs pre{position:relative;overflow:auto;border-radius:12px;background:var(--code-bg);color:var(--code-fg);padding:22px 23px;line-height:1.65;font-size:13px;border:1px solid var(--line);tab-size:2}
.docs code{font-family:"Cascadia Code","JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace}
.docs :not(pre)>code{background:var(--subtle);border:1px solid var(--line);color:var(--fg);padding:2px 5px;border-radius:5px;font-size:.86em}
.docs pre code{color:inherit}
.docs pre.paglora-has-copy{padding-top:52px}
.docs .paglora-copy-code{position:absolute;top:10px;right:12px;z-index:1;appearance:none;padding:5px 10px;border:1px solid #4d5664;border-radius:6px;background:#253041;color:#e9eef8;font:inherit;font-size:11px;line-height:1.4;cursor:pointer}
.docs .paglora-copy-code:hover{background:#354359}
.docs .paglora-copy-code:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.docs .paglora-heading-link{margin-left:12px;display:inline-block;font-size:.7em;font-weight:550;color:var(--brand);text-decoration:none;opacity:0;vertical-align:baseline}
.docs :is(h2,h3):hover .paglora-heading-link,.docs .paglora-heading-link:focus-visible{opacity:1}
@media(hover:none){.docs .paglora-heading-link{opacity:.8}}
.docs .paglora-heading-link:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
.docs a{color:var(--brand);text-decoration-color:color-mix(in srgb,var(--brand) 40%,transparent);text-decoration-thickness:1px;text-underline-offset:3px}
.docs a:hover{text-decoration-color:var(--brand)}
.docs img{display:block;max-width:100%;height:auto;border-radius:12px;border:1px solid var(--line);margin:22px 0}
.docs table{border-collapse:separate;border-spacing:0;width:100%;display:block;overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:25px 0}
.docs th,.docs td{padding:12px 16px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);text-align:left;white-space:normal;min-width:130px}
.docs th{background:var(--subtle);font-weight:700}
.docs tr:last-child td{border-bottom:0}
.docs th:last-child,.docs td:last-child{border-right:0}
.docs hr{border:0;border-top:1px solid var(--line);margin:38px 0}
.docs :is(h2,h3) a{color:inherit}
.on-this-page{grid-column:3;min-width:0;padding:35px clamp(18px,2.2vw,32px) 40px 14px}
.toc-inner{position:sticky;top:105px;max-height:calc(100vh - 125px);overflow-y:auto;scrollbar-width:thin}
.toc-inner h2{margin:0 0 13px;font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);font-weight:750}
.toc-inner a{display:block;text-decoration:none;color:var(--muted);font-size:12px;line-height:1.6;padding:6px 9px;border-left:1px solid var(--line);overflow-wrap:anywhere}
.toc-inner a:hover{border-left:2px solid var(--brand);color:var(--fg);background:var(--subtle)}
.toc-inner a.toc-h3{padding-left:20px;font-size:11.5px}
.mobile-toc{display:none}
.page-pager{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:64px;padding-top:24px;border-top:1px solid var(--line)}
.page-pager a{display:flex;flex-direction:column;gap:4px;min-height:86px;padding:15px 17px;border:1px solid var(--line);border-radius:11px;text-decoration:none;transition:border-color .15s,background .15s}
.page-pager a:hover{border-color:var(--brand);background:var(--subtle)}
.page-pager .next{grid-column:2;text-align:right}
.page-pager small{font-size:11px;color:var(--muted)}
.page-pager span{font-size:13px;font-weight:650;color:var(--fg)}
.site-footer{border-top:1px solid var(--line);background:var(--subtle)}
.site-footer-inner{max-width:1500px;margin:auto;padding:25px clamp(22px,3vw,48px);font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.footer-links{display:flex;flex-wrap:wrap;gap:17px}
.footer-links a{text-decoration:none}
.site-body.nav-right{grid-template-columns:minmax(190px,235px) minmax(0,1fr) minmax(230px,260px)}
.site-body.nav-right .site-nav{grid-column:3;grid-row:1;border-right:0;border-left:1px solid var(--line);padding:32px clamp(18px,2.5vw,42px) 40px 16px}
.site-body.nav-right .site-main{grid-column:2;grid-row:1}
.site-body.nav-right .on-this-page{grid-column:1;grid-row:1;padding-left:clamp(18px,2.2vw,32px);padding-right:14px}
.site-body.nav-top{grid-template-columns:minmax(0,1fr) minmax(190px,235px)}
.site-body.nav-top .site-nav{grid-column:1/-1;grid-row:1;border:0;border-bottom:1px solid var(--line);padding:10px clamp(22px,3vw,48px)}
.site-body.nav-top .site-nav-inner{position:static;max-height:none;display:flex;gap:6px;align-items:center;flex-wrap:wrap;overflow:visible}
.site-body.nav-top .site-nav h2{margin:0 8px 0 0;padding:0}
.site-body.nav-top .site-nav a{white-space:nowrap;margin:0}
.site-body.nav-top .site-main{grid-column:1;grid-row:2}
.site-body.nav-top .on-this-page{grid-column:2;grid-row:2}
@media(max-width:1180px){.site-body,.site-body.nav-right{grid-template-columns:245px minmax(0,1fr)}.site-body.nav-right{grid-template-columns:minmax(0,1fr) 245px}.site-body .on-this-page{display:none}.site-main{padding-inline:clamp(28px,6vw,78px)}.site-body.nav-top{grid-template-columns:1fr}.site-body.nav-top .site-main{grid-column:1}}
@media(max-width:800px){
  html{scroll-padding-top:78px}.top-bar{min-height:64px;padding-inline:20px}.brand{font-size:16px}.brand-logo{height:30px}
  .header-links{gap:12px}.header-links a{font-size:12px}
  .site-body,.site-body.nav-right,.site-body.nav-top{display:block;min-height:calc(100vh - 145px)}
  .site-body .site-nav{display:none}
  .site-main,.site-body.nav-right .site-main,.site-body.nav-top .site-main{width:100%;padding:34px 22px 68px}
  .mobile-nav{display:block;max-width:100%;border-bottom:1px solid var(--line);padding:10px 20px;background:var(--subtle)}
  .mobile-nav summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:650;padding:7px 0}
  .mobile-nav summary::after{content:"+";font-size:19px;color:var(--muted)}.mobile-nav[open] summary::after{content:"−"}
  .mobile-nav-inner{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:5px;padding:9px 0 14px}
  .mobile-nav a{display:block;padding:9px 11px;border-radius:8px;text-decoration:none;font-size:13px;color:var(--muted)}
  .mobile-nav a[aria-current=page]{background:var(--brand-light);color:var(--brand);font-weight:650}
  .mobile-toc{display:block;margin:0 0 30px;border:1px solid var(--line);border-radius:10px;background:var(--subtle);padding:8px 15px}
  .mobile-toc summary{cursor:pointer;font-size:12px;font-weight:650;padding:6px 0}
  .mobile-toc a{display:block;font-size:12px;padding:4px 6px;text-decoration:none;color:var(--muted)}
  .docs h1{font-size:2.15rem}.docs h2{font-size:1.45rem}.page-pager{gap:10px}.page-pager a{padding:12px}
}
@media(max-width:460px){.top-bar{gap:12px}.header-links a:nth-child(n+3){display:none}.page-pager{display:flex;flex-direction:column}.page-pager a.next{align-items:flex-end}}

/* Per-page public layout modes. Source CSS in theme/custom.css may override these. */
.site-body.layout-wide .on-this-page{display:none}
.site-body.layout-wide .site-main{grid-column:2/4}
.site-body.nav-right.layout-wide .site-main{grid-column:1/3}
.site-body.nav-top.layout-wide .site-main{grid-column:1/-1}
.layout-wide .article-wrap{max-width:1100px}
.layout-wide .docs{font-size:16px}
.site-body.layout-landing{display:block}
.site-body.layout-landing .site-nav,.site-body.layout-landing .on-this-page{display:none}
.layout-landing .site-main{width:100%;padding:76px clamp(24px,5vw,86px) 110px}
.layout-landing .article-wrap{max-width:1150px}
.layout-landing .page-heading,.layout-landing .page-pager{display:none}
.layout-landing .docs>h1:first-child{max-width:950px;margin:16px auto 28px;text-align:center;font-size:clamp(2.8rem,6vw,5.1rem);font-weight:770;line-height:1.06;letter-spacing:-.07em}
.layout-landing .docs>h1:first-child + p{max-width:700px;margin:0 auto 58px;text-align:center;color:var(--muted);font-size:clamp(1.05rem,1.7vw,1.32rem);line-height:1.7}
.layout-landing .docs h2{margin-top:68px;font-size:2rem}
.page-layout-landing .mobile-nav{display:none}
@media(max-width:1180px){
  .site-body.layout-wide .site-main,.site-body.nav-right.layout-wide .site-main{grid-column:2}
  .site-body.nav-right.layout-wide .site-main{grid-column:1}
  .site-body.nav-top.layout-wide .site-main{grid-column:1}
}
@media(max-width:800px){
  .site-body.layout-wide,.site-body.layout-landing{display:block}
  .site-body.layout-wide .site-main,.site-body.nav-right.layout-wide .site-main,.site-body.nav-top.layout-wide .site-main{display:block;width:100%}
  .layout-landing .site-main{padding:48px 22px 74px}
  .layout-landing .docs>h1:first-child{font-size:clamp(2.5rem,9vw,3.6rem)}
  .layout-landing .docs>h1:first-child + p{margin-bottom:42px}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{transition:none!important}}

/* Arabic documents use right-to-left reading order, including navigation and callouts. */
:root[dir="rtl"] .site-nav{border-right:0;border-left:1px solid var(--line);padding-right:clamp(18px,2.5vw,42px);padding-left:16px}
:root[dir="rtl"] .site-body.nav-right .site-nav{border-left:0;border-right:1px solid var(--line);padding-right:16px;padding-left:clamp(18px,2.5vw,42px)}
:root[dir="rtl"] .docs ul,:root[dir="rtl"] .docs ol{padding-left:0;padding-right:1.55em}
:root[dir="rtl"] .docs .paglora-task-checkbox{margin:0 -1.5em 0 .55em}
:root[dir="rtl"] .docs blockquote{border-left:0;border-right:3px solid var(--brand);border-radius:10px 0 0 10px}
:root[dir="rtl"] .docs .paglora-callout{border-left:1px solid var(--line);border-right:3px solid var(--callout-accent)}
:root[dir="rtl"] .docs .paglora-heading-link{margin-left:0;margin-right:12px}
:root[dir="rtl"] .docs th,:root[dir="rtl"] .docs td{text-align:right}
:root[dir="rtl"] .toc-inner a{border-left:0;border-right:1px solid var(--line)}
:root[dir="rtl"] .toc-inner a.toc-h3{padding-left:9px;padding-right:20px}
:root[dir="rtl"] .page-pager .next{text-align:left}
@media(max-width:800px){:root[dir="rtl"] .site-nav,:root[dir="rtl"] .site-body.nav-right .site-nav{border:0}}

"#;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteLink {
    label: String,
    url: String,
}

fn nav_default() -> String { "left".into() }
fn align_default() -> String { "left".into() }
fn true_default() -> bool { true }
fn width_default() -> u16 { 790 }
fn theme_default() -> String { "system".into() }
fn language_default() -> String { "en".into() }
fn accent_default() -> String { "#2196f3".into() }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteSettings {
    title: String,
    description: String,
    footer_text: String,
    #[serde(default = "nav_default")]
    navigation_position: String,
    #[serde(default = "align_default")]
    header_alignment: String,
    #[serde(default = "true_default")]
    sticky_header: bool,
    #[serde(default = "true_default")]
    show_footer: bool,
    #[serde(default = "width_default")]
    content_width: u16,
    #[serde(default)]
    logo_url: String,
    #[serde(default)]
    header_links: Vec<SiteLink>,
    #[serde(default)]
    footer_links: Vec<SiteLink>,
    #[serde(default = "theme_default")]
    theme_mode: String,
    #[serde(default = "accent_default")]
    accent_color: String,
    #[serde(default = "language_default")]
    language: String,
    // Optional remote font on the published site. Blank keeps the default Geist.
    #[serde(default)]
    google_font_family: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPage {
    id: String,
    html: String,
    #[serde(default)]
    toc: Vec<TocHeading>,
    #[serde(default)]
    search_text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TocHeading {
    id: String,
    title: String,
    level: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageManifest {
    format_version: u8,
    pages: Vec<crate::pages::Page>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 &&
        id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn project_folder(app: &AppHandle, project_id: &str) -> Result<(PathBuf, String), String> {
    if !valid_id(project_id) { return Err("Invalid project identifier".into()); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("projects").join(project_id);
    let data: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(dir.join("paglora.json")).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if data["id"].as_str() != Some(project_id) { return Err("Project configuration mismatch".into()); }
    let name = data["name"].as_str().ok_or("Project name missing")?.to_string();
    Ok((dir, name))
}

fn default_settings(name: &str) -> SiteSettings {
    SiteSettings {
        title: name.into(),
        description: format!("Documentation for {name}"),
        footer_text: format!("{name} · Built with Paglora"),
        navigation_position: nav_default(),
        header_alignment: align_default(),
        sticky_header: true,
        show_footer: true,
        content_width: width_default(),
        logo_url: String::new(),
        header_links: Vec::new(),
        footer_links: Vec::new(),
        theme_mode: theme_default(),
        accent_color: accent_default(),
        language: language_default(),
        google_font_family: String::new(),
    }
}

fn read_settings(dir: &Path, name: &str) -> Result<SiteSettings, String> {
    if !dir.join(CONFIG).exists() { return Ok(default_settings(name)); }
    serde_json::from_str(&fs::read_to_string(dir.join(CONFIG)).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn valid_google_font_family(value: &str) -> bool {
    value.is_empty() ||
    (value.len() <= 80 && value.trim() == value &&
     !value.contains("  ") &&
     value.bytes().all(|c| c.is_ascii_alphanumeric() || c == b' ' || c == b'-'))
}

fn google_font_markup(value: &str) -> String {
    if value.is_empty() { return String::new(); }
    // This is called only after validate_settings. Use a strict font-name
    // character allowlist so the name cannot inject HTML, CSS or query args.
    let family = value.replace(' ', "+");
    format!(
        "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family={family}&amp;display=swap\">\n<style>body{{font-family:\"{value}\",\"Geist Website\",system-ui,-apple-system,\"Segoe UI\",sans-serif}}</style>"
    )
}

fn validate_settings(settings: &SiteSettings) -> Result<(), String> {
    for (value, field, max) in [
        (&settings.title, "Site title", 100),
        (&settings.description, "Site description", 240),
        (&settings.footer_text, "Footer text", 240),
    ] {
        if (field == "Site title" && value.trim().is_empty()) ||
            value.chars().count() > max || value.chars().any(char::is_control) {
            return Err(format!("{field} must contain no control characters and fit within {max} characters"));
        }
    }
    if !["left", "right", "top"].contains(&settings.navigation_position.as_str()) {
        return Err("Unsupported navigation position".into());
    }
    if !["left", "center"].contains(&settings.header_alignment.as_str()) {
        return Err("Unsupported header alignment".into());
    }
    if !["system", "light", "dark"].contains(&settings.theme_mode.as_str()) {
        return Err("Unsupported website color mode".into());
    }
    // An explicit allowlist prevents HTML attribute injection in <html lang>.
    if !["en", "ko", "pl", "de", "fr", "es", "ja", "zh-CN", "zh-TW", "pt-BR",
         "ru", "uk", "ar", "tr", "it", "cs", "hu", "th"].contains(&settings.language.as_str()) {
        return Err("Unsupported website content language".into());
    }
    let accent = settings.accent_color.as_bytes();
    if accent.len() != 7 || accent[0] != b'#' || !accent[1..].iter().all(|value| value.is_ascii_hexdigit()) {
        return Err("Accent color must use a six-digit hexadecimal code".into());
    }
    if !valid_google_font_family(&settings.google_font_family) {
        return Err("Google Fonts family may contain only letters, numbers, spaces and hyphens (max 80 characters)".into());
    }
    if !(640..=1100).contains(&settings.content_width) {
        return Err("Content width must be between 640 and 1100 pixels".into());
    }
    if !settings.logo_url.is_empty() && !safe_link(&settings.logo_url, true) {
        return Err("Logo must use an HTTPS URL".into());
    }
    for (links, name) in [
        (&settings.header_links, "Header"),
        (&settings.footer_links, "Footer"),
    ] {
        if links.len() > 8 { return Err(format!("{name} has too many links")); }
        for link in links {
            if link.label.trim().is_empty() || link.label.chars().count() > 60 ||
                link.label.chars().any(char::is_control) || !safe_link(&link.url, false) {
                return Err(format!("{name} link label or URL is invalid"));
            }
        }
    }
    Ok(())
}

fn safe_link(raw: &str, https_only: bool) -> bool {
    if raw.chars().any(|c| c.is_control() || c.is_whitespace() || matches!(c, '"' | '\'' | '<' | '>')) {
        return false;
    }
    if raw.starts_with("https://") && raw.len() > 8 { return true; }
    !https_only && (
        (raw.starts_with("mailto:") && raw.len() > 7) ||
        (raw.ends_with(".html") && raw.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-'))
    )
}

fn valid_site_page_entry(page: &crate::pages::Page) -> bool {
    valid_id(&page.id) && crate::pages::valid_navigation_group(&page.nav_group) &&
        ["docs", "wide", "landing"].contains(&page.layout.as_str()) &&
        !page.title.trim().is_empty() && page.title.chars().count() <= 100 &&
        !page.title.chars().any(char::is_control)
}

fn read_pages(dir: &Path) -> Result<Vec<crate::pages::Page>, String> {
    let manifest: PageManifest = serde_json::from_str(
        &fs::read_to_string(dir.join("pages.json")).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    if manifest.format_version != 1 || manifest.pages.is_empty() ||
        manifest.pages.len() > 500 || manifest.pages[0].id != "index" ||
        !manifest.pages[0].is_public {
        return Err("Invalid public site page manifest".into());
    }
    let mut seen = HashSet::new();
    for page in &manifest.pages {
        if !valid_site_page_entry(page) || !seen.insert(page.id.as_str()) {
            return Err("Invalid page identifier in site".into());
        }
    }
    Ok(manifest.pages)
}

fn escape(value: &str) -> String {
    value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
        .replace('"', "&quot;").replace('\'', "&#39;")
}

fn filename(id: &str) -> String { format!("{id}.html") }
fn public_search_index(
    public_pages: &[&crate::pages::Page],
    html_by_id: &HashMap<&str, &RenderedPage>,
) -> serde_json::Value {
    let pages: Vec<_> = public_pages.iter().filter_map(|page| {
        let item = html_by_id.get(page.id.as_str())?;
        Some(serde_json::json!({
            "title": page.title,
            "url": filename(&page.id),
            "text": item.search_text.chars().take(15_000).collect::<String>()
        }))
    }).collect();
    serde_json::json!({"version": 1, "pages": pages})
}


fn render_site_page(
    settings: &SiteSettings,
    pages: &[crate::pages::Page],
    page: &crate::pages::Page,
    body: &str,
    toc: &[TocHeading],
) -> String {
    let public_pages: Vec<_> = pages.iter().filter(|p| p.is_public).collect();
    let mut links = String::new();
    let mut previous_group: Option<&str> = None;
    for item in &public_pages {
        let group = item.nav_group.as_str();
        if previous_group != Some(group) {
            if previous_group.is_some() { links.push_str("</div></details>"); }
            links.push_str(&format!(
                "<details class=\"nav-group\" open><summary>{}</summary><div class=\"nav-group-links\">",
                escape(group)
            ));
            previous_group = Some(group);
        }
        let current = if item.id == page.id { " aria-current=\"page\"" } else { "" };
        links.push_str(&format!(
            "<a href=\"{}\"{}>{}</a>",
            filename(&item.id), current, escape(&item.title)
        ));
    }
    if previous_group.is_some() { links.push_str("</div></details>"); }
    let mut toc_links = String::new();
    for heading in toc.iter().take(100) {
        // All heading metadata comes from the frontend's sanitized Markdown DOM.
        // Validate it again before placing it into an HTML attribute.
        if !matches!(heading.level, 2 | 3) || heading.title.trim().is_empty() ||
            heading.title.len() > 640 || heading.id.len() > 160 ||
            heading.id.is_empty() || !heading.id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-') {
            continue;
        }
        toc_links.push_str(&format!(
            "<a class=\"toc-h{}\" href=\"#{}\">{}</a>",
            heading.level, heading.id, escape(&heading.title)
        ));
    }
    let toc_aside = if toc_links.is_empty() { String::new() } else {
        format!("<div class=\"toc-inner\"><h2>On this page</h2>{toc_links}</div>")
    };
    let mobile_toc = if toc_links.is_empty() { String::new() } else {
        format!("<details class=\"mobile-toc\"><summary>On this page</summary>{toc_links}</details>")
    };
    let mut pager = String::new();
    if let Some(index) = public_pages.iter().position(|item| item.id == page.id) {
        if index > 0 {
            let previous = public_pages[index - 1];
            pager.push_str(&format!("<a class=\"previous\" href=\"{}\"><small>← Previous</small><span>{}</span></a>",
                filename(&previous.id), escape(&previous.title)));
        }
        if let Some(next) = public_pages.get(index + 1) {
            pager.push_str(&format!("<a class=\"next\" href=\"{}\"><small>Next →</small><span>{}</span></a>",
                filename(&next.id), escape(&next.title)));
        }
    }
    let pager = if pager.is_empty() { String::new() } else {
        format!("<nav class=\"page-pager\" aria-label=\"Previous and next pages\">{pager}</nav>")
    };
    let page_title = format!("{} | {}", page.title, settings.title);
    let logo = if settings.logo_url.is_empty() {
        String::new()
    } else {
        format!("<img class=\"brand-logo\" src=\"{}\" alt=\"\">", escape(&settings.logo_url))
    };
    let link_html = |items: &[SiteLink], class_name: &str| -> String {
        if items.is_empty() { return String::new(); }
        let mut out = format!("<nav class=\"{}\" aria-label=\"Site links\">", class_name);
        for link in items {
            out.push_str(&format!(
                "<a href=\"{}\"{}>{}</a>",
                escape(&link.url),
                if link.url.starts_with("https://") { " rel=\"noopener noreferrer\"" } else { "" },
                escape(&link.label),
            ));
        }
        out.push_str("</nav>");
        out
    };
    let header_class = format!("{} {}", if settings.sticky_header { "" } else { "not-sticky" },
        if settings.header_alignment == "center" { "header-center" } else { "" });
    let footer = if settings.show_footer {
        format!("<footer class=\"site-footer\"><div class=\"site-footer-inner\"><span>{}</span>{}</div></footer>",
            escape(&settings.footer_text), link_html(&settings.footer_links, "footer-links"))
    } else { String::new() };
    let description = escape(&settings.description);
    let theme_mode = &settings.theme_mode;
    let language = &settings.language;
    let direction = if language == "ar" { "rtl" } else { "ltr" };
    let google_font = google_font_markup(&settings.google_font_family);
    // Hex color was checked by validate_settings for both preview and build.
    let accent_style = format!("<style>:root{{--brand:{};--brand-light:color-mix(in srgb,var(--brand) 13%,var(--bg))}}</style>", settings.accent_color);
    let page_title = escape(&page_title);
    let brand_title = escape(&settings.title);
    let breadcrumb_title = escape(&page.title);
    let header_links = link_html(&settings.header_links, "header-links");
    let nav_position = &settings.navigation_position;
    let content_width = settings.content_width;
    let layout = &page.layout;
    let runtime_scripts = site_runtime_script_tags();
    format!(r##"<!doctype html>
<html lang="{language}" dir="{direction}" data-color-mode="{theme_mode}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{description}">
<meta property="og:type" content="article">
<meta property="og:title" content="{page_title}">
<meta property="og:description" content="{description}">
<meta property="og:site_name" content="{brand_title}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#ffffff">
<title>{page_title}</title>
<link rel="stylesheet" href="styles.css">
{google_font}
{accent_style}
</head>
<body class="page-layout-{layout}">
<a class="skip-link" href="#content">Skip to content</a>
<header class="site-header {header_class}"><div class="top-bar"><a class="brand brand-wrap" href="index.html">{logo}{brand_title}</a>{header_links}</div></header>
<details class="mobile-nav"><summary>Browse documentation</summary><nav class="mobile-nav-inner" aria-label="Mobile page navigation">{links}</nav></details>
<div class="site-body nav-{nav_position} layout-{layout}">
<nav class="site-nav" aria-label="Documentation navigation"><div class="site-nav-inner">{links}</div></nav>
<main class="site-main" id="content" style="--paglora-content-width:{content_width}px">
<div class="article-wrap">
<div class="page-heading"><a href="index.html">Docs</a><span class="crumb-separator">/</span><strong>{breadcrumb_title}</strong></div>
{mobile_toc}
<article class="docs">{body}</article>
{pager}
</div></main>
<aside class="on-this-page" aria-label="Table of contents">{toc_aside}</aside>
</div>
{footer}
{runtime_scripts}
</body>
</html>"##)
}
#[tauri::command]
pub fn load_site_settings(app: AppHandle, project_id: String) -> Result<SiteSettings, String> {
    let (dir, name) = project_folder(&app, &project_id)?;
    read_settings(&dir, &name)
}

#[tauri::command]
pub fn save_site_settings(app: AppHandle, project_id: String, settings: SiteSettings) -> Result<(), String> {
    validate_settings(&settings)?;
    let (dir, _) = project_folder(&app, &project_id)?;
    fs::write(dir.join(CONFIG),
        format!("{}\n", serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?)
    ).map_err(|e| e.to_string())
}

/// Preview uses the exact same HTML and CSS renderer as static export.
/// The caller supplies already sanitized HTML; no files are written.
#[tauri::command]
pub fn preview_site_page(app: AppHandle, project_id: String, rendered: RenderedPage, settings_override: Option<SiteSettings>) -> Result<String, String> {
    let (dir, project_name) = project_folder(&app, &project_id)?;
    let settings = if let Some(value) = settings_override { value } else { read_settings(&dir, &project_name)? };
    validate_settings(&settings)?;
    let pages = read_pages(&dir)?;
    let page = pages.iter().find(|p| p.id == rendered.id && p.is_public)
        .ok_or("Page is private or not in this project")?;
    if rendered.html.len() > 15_000_000 { return Err("Page HTML is too large".into()); }
    let theme = crate::source::site_css(&dir)?;
    let doc = render_site_page(&settings, &pages, page, &rendered.html, &rendered.toc);
    // CSS is user-authored project source. Embed in this script-disabled iframe
    // without letting a literal closing style tag break out of the CSS element.
    let override_css = theme.map(|css| {
        let escaped = css.replace('<', "\\3c ");
        format!("<style>{escaped}</style>")
    }).unwrap_or_default();
    let site_with_font = SITE_CSS.replace("fonts/geist-latin.woff2", &format!(
        "data:font/woff2;base64,{}", include_str!("../assets/geist-latin.b64")
    ));
    let doc = doc.replace(
        "<link rel=\"stylesheet\" href=\"styles.css\">",
        &format!("<style>{site_with_font}</style>"),
    );
    // Studio preview is intentionally script-disabled; remove the exported
    // runtime reference. Site interactions are tested in the built website.
    let mut doc = doc;
    for asset in SITE_RUNTIME_ASSETS {
        let tag = format!("<script defer src=\"{}\"></script>", asset.filename);
        doc = doc.replace(&tag, "");
    }
    // Project-owned CSS always comes last, overriding designer presets.
    Ok(doc.replace("</head>", &format!("{override_css}</head>")))
}

#[tauri::command]
pub fn build_site(app: AppHandle, project_id: String, rendered: Vec<RenderedPage>) -> Result<String, String> {
    let (dir, project_name) = project_folder(&app, &project_id)?;
    let settings = read_settings(&dir, &project_name)?;
    validate_settings(&settings)?;
    let pages = read_pages(&dir)?;
    let theme = crate::source::site_css(&dir)?;
    let public_pages: Vec<_> = pages.iter().filter(|p| p.is_public).collect();
    let expected: HashSet<_> = public_pages.iter().map(|p| p.id.as_str()).collect();
    if rendered.len() != public_pages.len() { return Err("Public page count changed. Build again".into()); }
    let mut html_by_id = HashMap::new();
    for page in &rendered {
        if !expected.contains(page.id.as_str()) || !valid_id(&page.id) ||
            page.html.len() > 15_000_000 || html_by_id.insert(page.id.as_str(), page).is_some() {
            return Err("Invalid page data for static site build".into());
        }
    }
    let exports_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join(EXPORTS);
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
    let target = exports_dir.join(&project_id);
    let staged = exports_dir.join(format!(".{project_id}-building"));
    let backup = exports_dir.join(format!(".{project_id}-previous"));
    if staged.exists() { fs::remove_dir_all(&staged).map_err(|e| e.to_string())?; }
    fs::create_dir(&staged).map_err(|e| e.to_string())?;
    let write_result = (|| -> Result<(), String> {
        fs::write(staged.join("styles.css"), SITE_CSS).map_err(|e| e.to_string())?;
        for asset in SITE_RUNTIME_ASSETS {
            fs::write(staged.join(asset.filename), asset.source).map_err(|e| e.to_string())?;
        }
        // Bundle the default Geist font; optional hosted Google Fonts remain supported.
        fs::create_dir(staged.join("fonts")).map_err(|e| e.to_string())?;
        fs::write(staged.join("fonts/geist-latin.woff2"), include_bytes!("../assets/geist-latin.woff2"))
            .map_err(|e| e.to_string())?;
        fs::write(staged.join("fonts/OFL.txt"), include_str!("../assets/GEIST-LICENSE.txt"))
            .map_err(|e| e.to_string())?;
        if let Some(css) = &theme {
            fs::write(staged.join("custom.css"), css).map_err(|e| e.to_string())?;
        }
        // Index only explicitly public, already sanitized page content.
        // Never copy private Markdown or raw user HTML into the search index.
        let index = public_search_index(&public_pages, &html_by_id);
        fs::write(staged.join("search-index.json"),
            serde_json::to_vec(&index)
                .map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        for page in &public_pages {
            let rendered_page = html_by_id.get(page.id.as_str()).ok_or("Missing public page")?;
            let mut output = render_site_page(&settings, &pages, page, &rendered_page.html, &rendered_page.toc);
            if theme.is_some() {
                output = output.replace("</head>", "<link rel=\"stylesheet\" href=\"custom.css\">\n</head>");
            }
            fs::write(staged.join(filename(&page.id)), output).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    if let Err(error) = write_result { let _ = fs::remove_dir_all(&staged); return Err(error); }
    // Stage first so an unsuccessful generation never replaces a working export.
    if backup.exists() { fs::remove_dir_all(&backup).map_err(|e| e.to_string())?; }
    if target.exists() { fs::rename(&target, &backup).map_err(|e| e.to_string())?; }
    if let Err(error) = fs::rename(&staged, &target) {
        if backup.exists() { let _ = fs::rename(&backup, &target); }
        return Err(error.to_string());
    }
    if backup.exists() { let _ = fs::remove_dir_all(&backup); }
    Ok(target.display().to_string())
}

#[cfg(test)]
mod website_font_tests {
    use super::*;

    #[test]
    fn exported_page_titles_obey_manifest_character_and_control_limits() {
        let mut page = crate::pages::Page {
            id: "index".into(), title: "Overview".into(), is_public: true,
            layout: "docs".into(), nav_group: "Documentation".into(),
        };
        assert!(valid_site_page_entry(&page));
        page.title = "📘".repeat(100);
        assert!(valid_site_page_entry(&page));
        page.title.push('📘');
        assert!(!valid_site_page_entry(&page));
        page.title = "Docs\u{85}Internal".into();
        assert!(!valid_site_page_entry(&page));
        page.title = "   ".into();
        assert!(!valid_site_page_entry(&page));
    }

    #[test]
    fn page_navigation_groups_appear_in_generated_html() {
        let settings = default_settings("Docs");
        let pages = vec![
            crate::pages::Page { id: "index".into(), title: "Overview".into(), is_public: true, layout: "docs".into(), nav_group: "Getting Started".into() },
            crate::pages::Page { id: "api".into(), title: "API Guide".into(), is_public: true, layout: "docs".into(), nav_group: "API Reference".into() },
            crate::pages::Page { id: "private".into(), title: "Draft".into(), is_public: false, layout: "docs".into(), nav_group: "Secret".into() },
        ];
        let output = render_site_page(&settings, &pages, &pages[0], "<p>Docs</p>", &[]);
        assert!(output.contains("<details class=\"nav-group\" open><summary>Getting Started</summary>"));
        assert!(output.contains("<details class=\"nav-group\" open><summary>API Reference</summary>"));
        assert!(output.contains("api.html"));
        assert!(!output.contains("Secret"));
        assert!(!output.contains("private.html"));
        assert!(output.contains("</div></details>"));
        assert!(output.contains("aria-current=\"page\""));
        for asset in SITE_RUNTIME_ASSETS {
            assert!(output.contains(&format!("<script defer src=\"{}\"></script>", asset.filename)));
            assert!(!asset.source.is_empty());
        }
        assert!(SITE_RUNTIME_ASSETS[1].source.contains("search-index.json"));
        assert!(SITE_RUNTIME_ASSETS[0].source.contains("paglora:theme:"));
    }

    #[test]
    fn website_language_is_validated_and_defaults_for_existing_projects() {
        let settings = default_settings("Docs");
        assert_eq!(settings.language, "en");
        let mut legacy = serde_json::to_value(&settings).unwrap();
        legacy.as_object_mut().unwrap().remove("language");
        let restored: SiteSettings = serde_json::from_value(legacy).unwrap();
        assert_eq!(restored.language, "en");

        let mut korean = settings.clone();
        korean.language = "ko".into();
        assert!(validate_settings(&korean).is_ok());
        let page = crate::pages::Page {
            id: "index".into(), title: "개요".into(), is_public: true,
            layout: "docs".into(), nav_group: "Documentation".into(),
        };
        let output = render_site_page(&korean, &[page.clone()], &page, "<p>안녕하세요</p>", &[]);
        assert!(output.contains(r#"<html lang="ko" dir="ltr" data-color-mode="#));

        let mut arabic = settings.clone();
        arabic.language = "ar".into();
        assert!(validate_settings(&arabic).is_ok());
        let rtl = render_site_page(&arabic, &[page.clone()], &page, "<p>مرحبا</p>", &[]);
        assert!(rtl.contains(r#"<html lang="ar" dir="rtl" data-color-mode="#));
        assert!(SITE_CSS.contains(r#":root[dir="rtl"] .docs blockquote"#));

        korean.language = r#"en" onload="alert(1)"#.into();
        assert!(validate_settings(&korean).is_err());
        korean.language = "xx".into();
        assert!(validate_settings(&korean).is_err());
    }

    #[test]
    fn public_pages_include_escaped_social_preview_metadata() {
        let mut settings = default_settings("Docs & Friends");
        settings.title = "Docs & Friends".into();
        settings.description = "Guides <for> everyone".into();
        let pages = vec![crate::pages::Page {
            id: "index".into(),
            title: "Overview & Setup".into(),
            is_public: true,
            layout: "docs".into(),
            nav_group: "Documentation".into(),
        }];
        let html = render_site_page(&settings, &pages, &pages[0], "<p>Welcome</p>", &[]);
        assert!(html.contains("<meta property=\"og:type\" content=\"article\">"));
        assert!(html.contains("<meta property=\"og:title\" content=\"Overview &amp; Setup | Docs &amp; Friends\">"));
        assert!(html.contains("<meta property=\"og:description\" content=\"Guides &lt;for&gt; everyone\">"));
        assert!(html.contains("<meta property=\"og:site_name\" content=\"Docs &amp; Friends\">"));
        assert!(html.contains("<meta name=\"twitter:card\" content=\"summary\">"));
        assert!(!html.contains("content=\"Guides <for> everyone\""));
    }

    #[test]
    fn search_index_includes_only_public_pages() {
        let pages = vec![
            crate::pages::Page { id: "index".into(), title: "Public".into(), is_public: true, layout: "docs".into(), nav_group: "Docs".into() },
            crate::pages::Page { id: "draft".into(), title: "Secret Draft".into(), is_public: false, layout: "docs".into(), nav_group: "Internal".into() },
        ];
        let rendered = vec![
            RenderedPage { id: "index".into(), html: "<p>Visible</p>".into(), toc: vec![], search_text: "Visible page".into() },
            RenderedPage { id: "draft".into(), html: "<p>Secret</p>".into(), toc: vec![], search_text: "Private content".into() },
        ];
        let refs = pages.iter().filter(|p| p.is_public).collect::<Vec<_>>();
        let by_id = rendered.iter().map(|p| (p.id.as_str(), p)).collect::<HashMap<_, _>>();
        let index = public_search_index(&refs, &by_id);
        assert_eq!(index["version"], 1);
        assert_eq!(index["pages"].as_array().unwrap().len(), 1);
        assert_eq!(index["pages"][0]["url"], "index.html");
        let json = serde_json::to_string(&index).unwrap();
        assert!(!json.contains("Secret"));
        assert!(!json.contains("Private content"));
    }

    #[test]
    fn google_fonts_are_opt_in_and_default_projects_keep_geist() {
        let settings = default_settings("Test Project");
        assert_eq!(settings.google_font_family, "");
        assert!(google_font_markup(&settings.google_font_family).is_empty());
        assert!(validate_settings(&settings).is_ok());
    }

    #[test]
    fn valid_google_font_appears_in_generated_static_html() {
        let mut settings = default_settings("Test Project");
        settings.google_font_family = "Noto Sans KR".into();
        assert!(validate_settings(&settings).is_ok());
        let page = crate::pages::Page {
            id: "index".into(), title: "Overview".into(), is_public: true, layout: "docs".into(), nav_group: "Documentation".into()
        };
        let output = render_site_page(&settings, &[page.clone()], &page, "<p>Test</p>", &[]);
        assert!(output.contains("https://fonts.googleapis.com/css2?family=Noto+Sans+KR&amp;display=swap"));
        assert!(output.contains("body{font-family:\"Noto Sans KR\""));
        assert!(output.contains("<link rel=\"stylesheet\" href=\"styles.css\">"));
    }

    #[test]
    fn custom_font_name_does_not_allow_html_or_query_injection() {
        for invalid in ["<script>", "Roboto&display=block", "Inter\";body{}", "Noto  Sans", " Noto Sans ", ""] {
            if !invalid.is_empty() { assert!(!valid_google_font_family(invalid)); }
        }
        assert!(valid_google_font_family(""));
        assert!(valid_google_font_family("Plus Jakarta Sans"));
        assert!(valid_google_font_family("M PLUS 1"));
    }
}
