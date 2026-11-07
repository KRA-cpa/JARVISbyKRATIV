import re, sys
src, out_light, out_dark = sys.argv[1:4]
s = open(src).read()
OFF, K = 30.0, 0.7          # new cycle 10s: creation 0-30%, the old 7s flow mapped into 30-100%
FLOW = ['card','cardline','dot','conn','pill','a1','a2','a3','d1','d2','d3','f1','f2','l1','l2','l3']
def fmt(x):
    x = round(x, 1); return (str(int(x)) if x == int(x) else str(x)) + '%'
def remap_sel(sel):
    parts = [p.strip() for p in sel.split(',')]
    out = []
    for p in parts:
        v = float(p[:-1])
        if v == 0: out += ['0%', fmt(OFF)]
        else: out.append(fmt(OFF + K * v))
    return ','.join(dict.fromkeys(out))
def remap_block(m):
    name, body = m.group(1), m.group(2)
    if name not in FLOW: return m.group(0)
    body = re.sub(r'([0-9.%,\s]+)\{', lambda mm: remap_sel(mm.group(1)) + '{', body)
    return '@keyframes ' + name + '{' + body + '}'
s = re.sub(r'@keyframes (\w+)\{((?:[^{}]*\{[^{}]*\})*)\}', remap_block, s)
s = s.replace(' 7s ', ' 10s ')
# the card no longer slides in from the left: it appears where the submitted form was
s = s.replace('0%,30%{transform:translateX(-250px);opacity:0}', '0%,30%{transform:translateX(15px);opacity:0}')
assert '0%,30%{transform:translateX(15px);opacity:0}' in s, 'card keyframe not found'
for a, b in [
    ('0%,30%{transform:translateX(15px);opacity:0}35.6%{transform:translateX(15px);opacity:1}',
     '0%,24%{transform:translateX(15px);opacity:0}27%{transform:translateX(15px);opacity:1}'),   # card = the submitted form
    ('@keyframes conn{0%,30%,34.2%{opacity:0}37%,', '@keyframes conn{0%,27%{opacity:0}28%,'),         # link to step 1
    ('@keyframes a1{0%,30%,34.2%{opacity:0}36.3%,', '@keyframes a1{0%,30.5%{opacity:0}31.5%,'),       # step 1 active on arrival
    ('@keyframes l1{0%,30%,34.2%{fill:var(--muted)}36.3%,', '@keyframes l1{0%,30.5%{fill:var(--muted)}31.5%,')]:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
s = s.replace('<title id="tf-t">Daloy approval flow</title>', '<title id="tf-t">Daloy: create a request, then the approval flow</title>')
s = re.sub(r'<desc id="tf-d">[^<]*</desc>', '<desc id="tf-d">A requester types a purchase request (Laptop for new hire, 45,000) and clicks Submit; the form turns into ticket PR-2026-00000042, which goes to the first approver (Manager) and then through Finance and Done, ending Approved</desc>', s)
css = '''
/* creation phase (0-30% of the 10s loop): form in, typing, cursor clicks Submit, form turns into the ticket card */
.form{opacity:0}
.fbg{fill:var(--card);stroke:var(--blue);stroke-width:1.5}
.ftitle{fill:var(--text);font-size:15px;font-weight:700}
.flabel{fill:var(--muted);font-size:12px}
.finput{fill:var(--bg);stroke:var(--line);stroke-width:1.2}
.ftext{fill:var(--text);font-size:14px}
.btnbg{fill:var(--blue)}
.btntx{fill:#fff;font-size:13px;font-weight:700;text-anchor:middle}
.btn{transform-box:fill-box;transform-origin:center}
.cur{opacity:0}
.curp{fill:var(--text);stroke:var(--card);stroke-width:1.2;stroke-linejoin:round}
.t1,.t2{transform-box:fill-box;transform-origin:left center;transform:scaleX(1)}
.form{animation:form 10s ease infinite}
.t1{animation:t1 10s linear infinite}
.t2{animation:t2 10s linear infinite}
.cur{animation:cur 10s ease-in-out infinite}
.btn{animation:btn 10s ease infinite}
.btnbg{animation:btnbg 10s ease infinite}
@keyframes form{0%{opacity:0;transform:translateY(8px)}3%,28%{opacity:1;transform:translateY(0)}29%,100%{opacity:0;transform:translateY(0)}}
.fbg{transform-box:fill-box;transform-origin:top center;animation:fbg 10s cubic-bezier(.4,0,.2,1) infinite}
.ftitle{animation:ftitle 10s ease infinite}
.ffields{animation:ffields 10s ease infinite}
.tok{fill:var(--blue);opacity:0;animation:tok 10s cubic-bezier(.4,0,.2,1) infinite}
@keyframes fbg{0%,24.5%{transform:scaleY(1);opacity:1}27.5%{transform:scaleY(.6);opacity:1}28.5%,100%{transform:scaleY(.6);opacity:0}}
@keyframes ftitle{0%,24%{opacity:1}25.5%,100%{opacity:0}}
@keyframes ffields{0%,23.5%{opacity:1}25.5%,100%{opacity:0}}
@keyframes tok{0%,27.8%{opacity:0;transform:translateY(0)}28.3%{opacity:1;transform:translateY(0)}30.3%{opacity:1;transform:translateY(64px)}31%,100%{opacity:0;transform:translateY(64px)}}
@keyframes t1{0%,4%{transform:scaleX(0);animation-timing-function:steps(19,end)}12%,100%{transform:scaleX(1)}}
@keyframes t2{0%,13%{transform:scaleX(0);animation-timing-function:steps(6,end)}17%,100%{transform:scaleX(1)}}
@keyframes cur{0%,16%{opacity:0;transform:translate(70px,46px)}18%{opacity:1;transform:translate(70px,46px)}21.5%,24%{opacity:1;transform:translate(0,0)}26%,100%{opacity:0;transform:translate(0,0)}}
@keyframes btn{0%,21.5%{transform:scale(1)}22.5%{transform:scale(.92)}23.5%,100%{transform:scale(1)}}
@keyframes btnbg{0%,21.5%{fill:var(--blue)}22.5%,100%{fill:#1D4ED8}}
'''
s = s.replace('.still *{animation:none!important}', css.strip() + '\n.still *{animation:none!important}')
defs = '''<defs>
<clipPath id="tf-c1"><rect class="t1" x="39" y="87" width="170" height="20"></rect></clipPath>
<clipPath id="tf-c2"><rect class="t2" x="39" y="135" width="60" height="20"></rect></clipPath>
</defs>
'''
form = '''<g class="form">
<rect class="fbg" x="15" y="28" width="230" height="140" rx="14"></rect>
<text class="ftitle" x="33" y="58">New purchase request</text>
<g class="ffields">
<text class="flabel" x="33" y="78">Item</text>
<rect class="finput" x="31" y="83" width="198" height="26" rx="6"></rect>
<text class="ftext" x="39" y="101" clip-path="url(#tf-c1)">Laptop for new hire</text>
<text class="flabel" x="33" y="126">Amount (PHP)</text>
<rect class="finput" x="31" y="131" width="118" height="26" rx="6"></rect>
<text class="ftext" x="39" y="149" clip-path="url(#tf-c2)">45,000</text>
<g class="btn"><rect class="btnbg" x="161" y="131" width="68" height="26" rx="6"></rect><text class="btntx" x="195" y="148.5">Submit</text></g>
<g class="cur"><g transform="translate(196 141)"><path class="curp" d="M0 0L0 16L4.5 12L7.5 18.5L10 17.3L7 11L12.5 11Z"></path></g></g>
</g>
</g>
'''
# insert defs right after <style>...</style>; the form after the background rect (under the card / pill layers)
s = s.replace('</style>\n', '</style>\n' + defs, 1)
s = s.replace('<rect class="bg" width="560" height="280" rx="20"></rect>\n', '<rect class="bg" width="560" height="280" rx="20"></rect>\n' + form, 1)
s = s.replace('<g class="pill">', '<circle class="tok" cx="130" cy="116" r="5"></circle>\n<g class="pill">', 1)
assert s.count('class="form"') == 1 and 'tf-c1' in s and 'class="tok"' in s
open(out_light, 'w').write(s)
open(out_dark, 'w').write(s.replace('class="tf light"', 'class="tf dark"', 1))
print('ok', len(s))
