#!/usr/bin/env python3
"""Bundle every AdmitMap page into ONE standalone .html file.

Each page keeps its own document context (rendered into an iframe via srcdoc), so the
pages' identical class names and function names can't collide — merging them into a
single DOM would break all three. A tiny shim injected into each page turns link
clicks and window.location assignments into messages the shell router handles.
"""
import re, os, json

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = {
    "landing":  "landing.html",
    "signup":   "signup.html",
    "funnel":   "funnel.html",
    "report":   "report.html",
    "pricing":  "pricing.html",
    "platform": "platform.html",
}
ALIASES = {"index": "landing", "onboarding": "funnel", "admitted": "landing"}
START = "landing"

# Navigation that assigns location directly -> route through the shim instead.
LOC_RE = re.compile(r"""window\.location\.href\s*=\s*(['"])([^'"]+\.html[^'"]*)\1""")

def shim(page_key):
    return """<script>
(function(){
  window.__nav = function(h){ try{ parent.postMessage({__amNav:h}, '*'); }catch(e){} };
  // Paywall: the shell passes ?unlocked=1 through as a flag, since a srcdoc
  // document has no query string of its own.
  window.__unlocked = %s;
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    var h = a.getAttribute('href') || '';
    if(/\\.html(\\?|#|$)/.test(h)){ e.preventDefault(); window.__nav(h); }
  }, true);
})();
</script>""" % ("true" if page_key == "platform" else "false")

def prepare(key, path):
    src = open(os.path.join(HERE, path), encoding="utf-8").read()
    # location assignments -> router
    src = LOC_RE.sub(lambda m: "window.__nav('%s')" % m.group(2), src)
    # platform reads ?unlocked=1 from a query string it won't have inside srcdoc
    src = src.replace("params.get('unlocked') === '1'",
                      "(window.__unlocked === true || params.get('unlocked') === '1')")
    # inject the shim as the first thing in <head>
    if "<head>" in src:
        src = src.replace("<head>", "<head>" + shim(key), 1)
    else:
        src = shim(key) + src
    return src

def main():
    pages = {k: prepare(k, v) for k, v in PAGES.items()}
    blocks = []
    for k, html in pages.items():
        # only </script> needs neutralising inside a text/html script block
        safe = html.replace("</script>", "<\\/script>")
        blocks.append('<script type="text/html" id="pg-%s">%s</script>' % (k, safe))

    shell = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AdmitMap</title>
<style>
  html,body{margin:0;padding:0;height:100%%;background:#f8fafc}
  #stage{border:0;width:100%%;height:100%%;display:block}
</style>
</head>
<body>
<iframe id="stage" title="AdmitMap"></iframe>
%s
<script>
(function(){
  var ALIASES = %s, START = %s;
  var stage = document.getElementById('stage');
  function pageSource(key){
    var el = document.getElementById('pg-' + key);
    return el ? el.textContent.replace(/<\\\\\\/script>/g, '<\\/script>') : null;
  }
  function keyFromHref(h){
    var file = String(h).split('/').pop().split('?')[0].split('#')[0].replace(/\\.html$/, '');
    if(!file) file = START;
    return ALIASES[file] || file;
  }
  function show(href){
    var key = keyFromHref(href);
    var src = pageSource(key);
    if(!src){ key = START; src = pageSource(key); }
    // pass the unlock flag through the query string
    if(/unlocked=1/.test(String(href))) src = src.replace('window.__unlocked = false','window.__unlocked = true');
    stage.srcdoc = src;
    if(location.hash.slice(1) !== key) history.replaceState(null,'','#'+key);
    document.title = 'AdmitMap';
  }
  window.addEventListener('message', function(e){
    if(e.data && e.data.__amNav) show(e.data.__amNav);
  });
  window.addEventListener('hashchange', function(){ show(location.hash.slice(1) || START); });
  show(location.hash.slice(1) || START);
})();
</script>
</body>
</html>
""" % ("\n".join(blocks), json.dumps(ALIASES), json.dumps(START))

    out = os.path.join(HERE, "AdmitMap-complete.html")
    open(out, "w", encoding="utf-8").write(shell)
    print("wrote %s  (%.1f KB)" % (out, os.path.getsize(out) / 1024))

if __name__ == "__main__":
    main()
