#!/usr/bin/env python3
"""Build /error-codes hub + one page per code from tools/error_codes.json.

Run from the repo root:  python3 tools/build_error_codes.py
Affiliate IDs live in tools/affiliates.json (created with blanks on first run).
"""
import html
import json
import os
import re
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.r3mappliancerepair.com"
PHONE = "(469) 446-4242"
TEL = "tel:+14694464242"
CITIES = ["Rockwall", "Forney", "Fate", "Royse City", "Rowlett", "Sunnyvale", "Heath"]

SERVICE_PAGE = {
    "washer": ("/services/washer-repair", "washer repair"),
    "dryer": ("/services/dryer-repair", "dryer repair"),
    "dishwasher": ("/services/dishwasher-repair", "dishwasher repair"),
    "refrigerator": ("/services/refrigerator-repair", "refrigerator repair"),
    "oven-range": ("/services/oven-range-repair", "oven &amp; range repair"),
}
APPLIANCE_LABEL = {
    "washer": "Washer", "dryer": "Dryer", "dishwasher": "Dishwasher",
    "refrigerator": "Refrigerator", "oven-range": "Oven / Range",
}
BRAND_PAGE = {
    "Samsung": "/brands/samsung", "LG": "/brands/lg", "Whirlpool": "/brands/whirlpool",
    "Bosch": "/brands/bosch", "Frigidaire": "/brands/frigidaire", "GE": "/brands/ge",
    "Maytag": "/brands/maytag", "KitchenAid": "/brands/kitchenaid",
}

AFF_PATH = os.path.join(ROOT, "tools", "affiliates.json")
if not os.path.exists(AFF_PATH):
    json.dump({"amazon_tag": "", "note": "Amazon Associates tracking ID, e.g. r3mappliance-20. Leave blank until approved."},
              open(AFF_PATH, "w"), indent=2)
AFF = json.load(open(AFF_PATH))

e = html.escape


def amazon_link(query):
    url = "https://www.amazon.com/s?k=" + urllib.parse.quote_plus(query)
    if AFF.get("amazon_tag"):
        url += "&tag=" + urllib.parse.quote(AFF["amazon_tag"])
    return url


def header():
    return ('<header class="header"><div class="container header-inner"><a class="brand" href="/" aria-label="R3M Appliance Repair home">'
            '<img src="/assets/logo.png" alt="R3M Appliance Repair" width="720" height="258"></a>'
            '<nav class="nav"><a href="/services">Services</a><a href="/brands">Brands</a><a href="/service-areas">Service Areas</a>'
            '<a href="/error-codes">Error Codes</a><a href="/reviews">Reviews</a><a href="/about">About</a><a href="/contact">Contact</a></nav>'
            '<div class="actions"><a class="btn btn-outline phone-card btn-phone" href="' + TEL + '"><span class="ph"><span class="ph1">(469)</span> <span class="ph2">446-4242</span></span></a>'
            '<a class="btn btn-primary" href="/schedule-service">Book Service</a></div></div></header>\n')


def footer():
    return ('<footer class="footer"><div class="container"><div class="footer-grid"><div><h3>R3M Appliance Repair</h3>'
            '<p>Family-owned residential appliance repair based in Rockwall, TX. Serving Rockwall, Forney, Fate, Royse City, Rowlett, Sunnyvale, Heath and McLendon-Chisholm.</p></div>'
            '<div><h3>Quick Links</h3><p><a href="/services">Services</a></p><p><a href="/brands">Brands</a></p><p><a href="/service-areas">Service Areas</a></p>'
            '<p><a href="/error-codes">Error Codes</a></p><p><a href="/schedule-service">Schedule Service</a></p></div>'
            '<div><h3>Contact</h3><p><a href="' + TEL + '" class="phone-card"><span class="ph"><span class="ph1">(469)</span> <span class="ph2">446-4242</span></span></a></p>'
            '<p><a href="mailto:R3mappliances@gmail.com">R3mappliances@gmail.com</a></p><p>Rockwall, Texas</p></div></div>'
            '<div class="footer-bottom">© 2026 R3M Appliance Repair. All rights reserved.</div></div></footer>\n'
            '<div class="mobile-bar"><a href="' + TEL + '" class="phone-card">Call <span class="ph"><span class="ph1">(469)</span> <span class="ph2">446-4242</span></span></a><a href="/schedule-service">Book Service</a></div>\n'
            '<script src="/assets/script.js" defer></script>\n</body></html>\n')


def head(title, desc, path, jsonld):
    url = SITE + path
    out = ['<!doctype html>', '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
           f'<title>{e(title)}</title>', f'<meta name="description" content="{e(desc)}">',
           f'<link rel="canonical" href="{url}">', '<link rel="stylesheet" href="/assets/styles.css">']
    for obj in jsonld:
        out.append('<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False) + '</script>')
    out.append(f'<meta property="og:type" content="article"><meta property="og:site_name" content="R3M Appliance Repair"><meta property="og:title" content="{e(title)}">'
               f'<meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{url}">'
               f'<meta property="og:image" content="{SITE}/assets/og-logo.png"><meta name="twitter:card" content="summary_large_image"></head><body>')
    return "\n".join(out) + "\n"


def faq_items(c):
    brand, app, code = c["brand"], APPLIANCE_LABEL[c["appliance"]].lower(), c["code"]
    items = [
        (f"How do I clear the {code} code on my {brand} {app}?",
         f"Fix the cause first, then unplug the {app} (or turn it off at the breaker) for about a minute and restart. The code clears once the {app} no longer sees the problem. If it comes right back, the cause is still there."),
        (f"Is a {brand} {app} with a {code} error worth repairing?",
         "Usually yes. " + c["parts"][0].capitalize() + " and similar parts cost a fraction of a new " + app + ". I tell you the price before any work starts, and if a repair is not worth it I say so."),
        (f"Can you come out today for a {brand} {code} error in Rockwall?",
         f"Most days, yes. I carry common {brand} parts on the truck, so many {code} repairs are done in one visit. Call or text {PHONE} with your model number."),
    ]
    if c["aliases"]:
        items.insert(1, (f"Is {code} the same as {' / '.join(c['aliases'])}?",
                         f"Yes. {brand} uses different displays on different model years, so the same problem shows up as {code} on some machines and {' or '.join(c['aliases'])} on others. The fix is the same."))
    return items


def code_page(c, all_codes):
    brand, app_key, code = c["brand"], c["appliance"], c["code"]
    app = APPLIANCE_LABEL[app_key]
    path = "/error-codes/" + c["slug"]
    svc_url, svc_name = SERVICE_PAGE[app_key]
    title = f"{brand} {app} {code} Error Code: Meaning and How to Fix It"
    desc = (f"{brand} {app.lower()} {code} error code explained: what it means, the most common causes, what to try yourself, "
            f"and when to call. Repair in Rockwall, TX and nearby: {PHONE}.")
    faqs = faq_items(c)

    jsonld = [
        {"@context": "https://schema.org", "@type": "Article", "headline": title, "description": desc,
         "url": SITE + path, "author": {"@type": "Person", "name": "Ramez Slama", "jobTitle": "Owner and appliance repair technician"},
         "publisher": {"@type": "LocalBusiness", "@id": SITE + "/#business", "name": "R3M Appliance Repair", "telephone": "+14694464242"},
         "about": {"@type": "Thing", "name": f"{brand} {app.lower()} error code {code}"}},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Error Codes", "item": SITE + "/error-codes"},
            {"@type": "ListItem", "position": 3, "name": f"{brand} {app} {code}", "item": SITE + path}]},
    ]

    alias_txt = (" Also shown as " + ", ".join(e(a) for a in c["aliases"]) + " on some models.") if c["aliases"] else ""
    causes = "".join(f'<li style="margin:0 0 10px;line-height:1.7"><strong style="color:var(--text)">{i+1}.</strong> {e(x)}</li>' for i, x in enumerate(c["causes"]))
    steps = "".join(f'<li style="margin:0 0 14px;line-height:1.7">{e(x)}</li>' for x in c["diy"])
    parts = "".join(
        f'<article class="card"><h3 style="margin-top:0;text-transform:capitalize">{e(p)}</h3>'
        f'<p>Search by your model number so the part matches.</p>'
        f'<p style="margin-top:12px"><a class="btn btn-outline" href="{amazon_link(f"{brand} {app.lower()} {p}")}" target="_blank" rel="nofollow sponsored noopener">Find on Amazon</a></p></article>'
        for p in c["parts"])
    faq_html = "".join(f'<details><summary>{e(q)}</summary><p style="margin:12px 0 0;color:var(--muted);line-height:1.7">{e(a)}</p></details>' for q, a in faqs)

    related = [o for o in all_codes if o["slug"] != c["slug"] and (o["brand"] == brand or o["appliance"] == app_key)][:8]
    related_html = "".join(f'<a class="city" href="/error-codes/{o["slug"]}">⚠️ {e(o["brand"])} {e(APPLIANCE_LABEL[o["appliance"]].lower())} {e(o["code"])}</a>' for o in related)
    brand_link = f'<a href="{BRAND_PAGE[brand]}">{e(brand)} repair</a>' if brand in BRAND_PAGE else e(brand)
    sources = " · ".join(f'<a href="{e(s)}" target="_blank" rel="noopener nofollow">{e(urllib.parse.urlparse(s).netloc.replace("www.", ""))}</a>' for s in c["sources"])

    body = f'''{header()}<main>
<section class="page-hero"><div class="container">
  <div class="breadcrumbs"><a href="/">Home</a> / <a href="/error-codes">Error Codes</a> / {e(brand)} {e(app)} {e(code)}</div>
  <div class="eyebrow">{e(brand)} · {e(app)} · Error code</div>
  <h1>{e(brand)} {e(app)} {e(code)} Error Code</h1>
  <p class="lead">{e(c["meaning"])}{alias_txt}</p>
  <p class="lead" style="margin-top:12px">I am Ramez, owner of R3M Appliance Repair in Rockwall, TX. Below is what this code means, what you can safely try before calling anyone, and the point where it is time to call. If you are in the Rockwall area and want it handled today: <a href="{TEL}">{PHONE}</a>.</p>
  <div class="hero-actions"><a class="btn btn-primary" href="{TEL}">Call {PHONE}</a><a class="btn btn-outline" href="/schedule-service">Book online</a></div>
  <div class="checks"><span>✓ Verified against {e(brand)}'s own documentation</span><span>✓ Written by a working technician</span><span>✓ Same-day on most calls around Rockwall</span></div>
</div></section>

<section class="section"><div class="container">
  <div class="content-grid">
    <div>
      <div class="eyebrow">Step 1</div>
      <h2>What usually causes {e(code)}</h2>
      <p class="lead" style="margin-top:14px">Most common first. In my experience the first one or two on this list account for most {e(brand)} {e(code)} calls.</p>
      <ol style="list-style:none;padding:0;margin:22px 0 0;color:var(--muted)">{causes}</ol>

      <div class="eyebrow" style="margin-top:40px">Step 2</div>
      <h2>What to try before you call</h2>
      <p class="lead" style="margin-top:14px">Safe things a homeowner can do. Unplug the {e(app.lower())} before reaching into anything.</p>
      <ol style="padding-left:22px;margin:22px 0 0;color:var(--muted)">{steps}</ol>

      <div class="eyebrow" style="margin-top:40px">Step 3</div>
      <h2>When to stop and call a technician</h2>
      <p class="lead" style="margin-top:14px">{e(c["call_pro_when"])} At that point the fix is usually a part, and guessing at parts gets expensive fast. I test first, then quote, so you only pay for what is actually broken.</p>
    </div>
    <aside class="sidebar"><div class="card">
      <div class="eyebrow">{e(brand)} {e(code)} in Rockwall?</div>
      <h3 style="font-size:24px;margin:10px 0 8px">Call or text {PHONE}</h3>
      <p>Tell me the model and what it is doing. I will tell you straight whether it is worth fixing and when I can be there.</p>
      <p style="margin-top:16px"><a class="btn btn-primary" href="{TEL}" style="width:100%">Call now</a></p>
      <p style="margin-top:10px"><a class="btn btn-outline" href="/schedule-service" style="width:100%">Book online</a></p>
      <p style="margin-top:16px;font-size:14px;color:var(--muted)">Serving {", ".join(CITIES)} and McLendon-Chisholm. See <a href="{svc_url}">{svc_name}</a> and {brand_link}.</p>
    </div></aside>
  </div>
</div></section>

<section class="section soft"><div class="container">
  <div class="center"><div class="eyebrow">Doing it yourself?</div><h2>Parts that usually fix a {e(brand)} {e(code)}</h2><p class="lead" style="margin:16px auto 0">If the steps above did not clear it, one of these is the usual culprit. Always match the part to your full model number (on the sticker inside the door or on the back).</p></div>
  <div class="grid-3" style="margin-top:28px">{parts}</div>
  <p class="center" style="margin-top:18px;font-size:13px;color:var(--muted)">Some links on this page are affiliate links. If you buy through them, R3M may earn a small commission at no extra cost to you. It does not change which parts I recommend.</p>
</div></section>

<section class="section"><div class="container">
  <div class="center"><div class="eyebrow">Questions</div><h2>{e(brand)} {e(code)} questions</h2></div>
  <div class="faq" style="max-width:820px;margin:34px auto 0">{faq_html}</div>
</div></section>

<section class="section soft"><div class="container">
  <div class="eyebrow">Related</div><h2>Other error codes</h2>
  <div class="grid-4" style="margin-top:22px">{related_html}</div>
  <p style="margin-top:22px"><a class="btn btn-outline" href="/error-codes">All error codes</a></p>
  <p style="margin-top:22px;font-size:13px;color:var(--muted)">Sources checked: {sources}. Model-specific behavior varies; your owner's manual is the final word for your machine.</p>
</div></section>

<section class="cta"><div class="container cta-inner"><div><div class="eyebrow" style="color:#dbeafe">Need it fixed today?</div><h2>{e(brand)} {e(app.lower())} repair around Rockwall, usually same day.</h2><p>Honest diagnosis, a clear price before any work starts, and a warranty on every repair.</p></div><div class="hero-actions"><a class="btn btn-outline" href="{TEL}">Call Now</a><a class="btn btn-primary" href="/schedule-service">Book Service</a></div></div></section>
</main>
{footer()}'''
    return head(title + " | R3M Appliance Repair", desc, path, jsonld) + body


def hub_page(codes):
    path = "/error-codes"
    title = "Appliance Error Codes Explained: Samsung, LG, Whirlpool, Bosch, GE"
    desc = ("Plain-English guide to washer, dryer, dishwasher, refrigerator and oven error codes. What each code means, what to try, "
            f"and when to call. Appliance repair in Rockwall, TX: {PHONE}.")
    jsonld = [
        {"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": SITE + path, "description": desc,
         "publisher": {"@type": "LocalBusiness", "@id": SITE + "/#business", "name": "R3M Appliance Repair"}},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Error Codes", "item": SITE + path}]},
    ]
    brands = []
    for c in codes:
        if c["brand"] not in brands:
            brands.append(c["brand"])
    sections = ""
    for b in brands:
        cards = ""
        for c in [x for x in codes if x["brand"] == b]:
            terms = " ".join([c["brand"], c["appliance"], c["code"]] + c["aliases"]).lower()
            cards += (f'<a class="card ec-card" href="/error-codes/{c["slug"]}" data-terms="{e(terms)}" style="display:block;text-decoration:none">'
                      f'<div class="eyebrow">{e(APPLIANCE_LABEL[c["appliance"]])}</div><h3 style="margin-top:8px">{e(c["code"])}'
                      + (f' <span style="color:var(--muted);font-weight:600;font-size:15px">/ {e(", ".join(c["aliases"]))}</span>' if c["aliases"] else "")
                      + f'</h3><p>{e(c["meaning"].split(". ")[0].rstrip("."))}.</p></a>')
        sections += f'<div class="ec-brand" style="margin-top:36px"><h2>{e(b)} error codes</h2><div class="grid-3" style="margin-top:18px">{cards}</div></div>'

    hub_footer = footer().replace('<script src="/assets/script.js" defer></script>', '<script src="/assets/script.js" defer></script>\n<script src="/assets/error-codes.js" defer></script>')
    body = f'''{header()}<main>
<section class="page-hero"><div class="container">
  <div class="breadcrumbs"><a href="/">Home</a> / Error Codes</div>
  <div class="eyebrow">Free troubleshooting guide</div>
  <h1>Appliance Error Codes, Explained by a Technician</h1>
  <p class="lead">Your washer, dryer, dishwasher, fridge or oven is flashing a code. This is what it means, what you can safely try yourself, and the point where it is time to call. I am Ramez, owner of R3M Appliance Repair in Rockwall, TX, and these are the codes I see most in the field, checked against each manufacturer's own documentation.</p>
  <div class="hero-actions"><a class="btn btn-primary" href="{TEL}">Call {PHONE}</a><a class="btn btn-outline" href="/schedule-service">Book online</a></div>
  <div class="checks"><span>✓ {len(codes)} codes and growing</span><span>✓ Verified against manufacturer documentation</span><span>✓ Same-day repair around Rockwall</span></div>
</div></section>

<section class="section"><div class="container">
  <label for="ec-search" class="eyebrow">Find your code</label>
  <input id="ec-search" type="search" placeholder="Type a brand or code, e.g. Samsung 4C, LG OE, E24" autocomplete="off" style="display:block;width:100%;max-width:560px;margin-top:10px;padding:14px 16px;font:inherit;font-size:17px;border:1px solid var(--line);border-radius:12px">
  <p id="ec-empty" style="display:none;margin-top:18px;color:var(--muted)">No match yet. Call or text <a href="{TEL}">{PHONE}</a> with the code and your model number and I will tell you what it means.</p>
  {sections}
</div></section>

<section class="cta"><div class="container cta-inner"><div><div class="eyebrow" style="color:#dbeafe">Code not listed?</div><h2>Text me the code and the model number.</h2><p>I will tell you what it means and whether it is worth a visit. Rockwall, Heath, Fate, Royse City, Rowlett, Forney and Sunnyvale.</p></div><div class="hero-actions"><a class="btn btn-outline" href="{TEL}">Call Now</a><a class="btn btn-primary" href="/schedule-service">Book Service</a></div></div></section>
</main>
{hub_footer}'''
    return head(title + " | R3M Appliance Repair", desc, path, jsonld) + body


HUB_JS = """(function(){var q=document.getElementById('ec-search');if(!q)return;var cards=[].slice.call(document.querySelectorAll('.ec-card'));var groups=[].slice.call(document.querySelectorAll('.ec-brand'));var empty=document.getElementById('ec-empty');
function run(){var t=q.value.trim().toLowerCase().replace(/\\s+/g,' ');var words=t?t.split(' '):[];var n=0;cards.forEach(function(c){var s=c.getAttribute('data-terms');var ok=words.every(function(w){return s.indexOf(w)>-1});c.style.display=ok?'':'none';if(ok)n++;});
groups.forEach(function(g){var any=[].slice.call(g.querySelectorAll('.ec-card')).some(function(c){return c.style.display!=='none'});g.style.display=any?'':'none';});empty.style.display=n?'none':'';}
q.addEventListener('input',run);var p=new URLSearchParams(location.search).get('q');if(p){q.value=p;run();}})();
"""


def update_sitemap(codes):
    p = os.path.join(ROOT, "sitemap.xml")
    xml = open(p).read()
    xml = re.sub(r"<url><loc>%s/error-codes[^<]*</loc></url>\n?" % re.escape(SITE), "", xml)
    new = f"<url><loc>{SITE}/error-codes</loc></url>\n" + "".join(f"<url><loc>{SITE}/error-codes/{c['slug']}</loc></url>\n" for c in codes)
    xml = xml.replace("</urlset>", new + "</urlset>")
    open(p, "w").write(xml)


def main():
    codes = json.load(open(os.path.join(ROOT, "tools", "error_codes.json")))
    slugs = [c["slug"] for c in codes]
    assert len(slugs) == len(set(slugs)), "duplicate slug"
    os.makedirs(os.path.join(ROOT, "error-codes"), exist_ok=True)
    for c in codes:
        open(os.path.join(ROOT, "error-codes", c["slug"] + ".html"), "w").write(code_page(c, codes))
    open(os.path.join(ROOT, "error-codes.html"), "w").write(hub_page(codes))
    open(os.path.join(ROOT, "assets", "error-codes.js"), "w").write(HUB_JS)
    update_sitemap(codes)
    print(f"built {len(codes)} code pages + hub")


if __name__ == "__main__":
    sys.exit(main())
