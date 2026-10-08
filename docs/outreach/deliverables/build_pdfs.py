"""Build small PDFs from the HTML sources in this folder.

Chromium's print-to-PDF embeds two hinted DejaVu subsets (54-58 KB per file).
Email attachments go through the Gmail API as base64, so size matters:
- forum_proposal_sq: Albanian fits WinAnsi, so it uses the PDF base fonts; the few words with
  Vietnamese letters get a tiny Liberation Sans subset (Helvetica metrics, so it blends in).
- worker_leaflet_vi: Vietnamese needs an embedded font. One unhinted DejaVu Sans subset is embedded;
  headings are drawn with a thin outline (fill + stroke) instead of embedding the bold face too.

Run: python3 build_pdfs.py [tmpdir]  (needs reportlab and fonttools; font subsets go to tmpdir)
"""
import html
import os
import re
import sys
import tempfile
from html.parser import HTMLParser

from fontTools import subset
from fontTools.ttLib import TTFont
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont
from reportlab.platypus import (Flowable, KeepTogether, ListFlowable, ListItem, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)
from reportlab.platypus.flowables import HRFlowable

HERE = os.path.dirname(os.path.abspath(__file__))
rl_config.useA85 = 0  # raw Flate streams; ASCII85 only adds 25%
FONTS = "/usr/share/fonts/truetype/"
INK = colors.HexColor("#111111")


def unhinted_subset(src, text, out):
    opts = subset.Options()
    opts.hinting = False
    opts.layout_features = []
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    opts.drop_tables += ["GPOS", "GSUB", "GDEF", "kern", "hdmx", "LTSH", "VDMX", "gasp", "DSIG", "FFTM"]
    font = TTFont(src, recalcTimestamp=False)  # keep head.modified fixed so rebuilds are byte-identical
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    font.save(out)


def winansi(ch):
    try:
        ch.encode("cp1252")
        return True
    except UnicodeEncodeError:
        return False


class StrokedHeading(Flowable):
    """One-line heading in the regular face, thickened with a stroke (saves embedding a bold face)."""

    def __init__(self, text, font, size, stroke, rule=False, space_before=0, space_after=2):
        super().__init__()
        self.text, self.font, self.size, self.stroke, self.rule = text, font, size, stroke, rule
        self.spaceBefore, self.spaceAfter = space_before, space_after

    def wrap(self, avail_w, avail_h):
        self.width = avail_w
        self.height = self.size * 1.25 + (3 if self.rule else 0)
        return self.width, self.height

    def draw(self):
        c = self.canv
        base = 3 + self.size * 0.28 if self.rule else self.size * 0.28
        c.saveState()
        c.setFillColor(INK)
        c.setStrokeColor(INK)
        c.setLineWidth(self.stroke)
        t = c.beginText(0, base)
        t.setFont(self.font, self.size)
        t.setTextRenderMode(2)
        t.textOut(self.text)
        c.drawText(t)
        if self.rule:
            c.setStrokeColor(colors.HexColor("#999999"))
            c.setLineWidth(0.6)
            c.line(0, 0.5, self.width, 0.5)
        c.restoreState()


class Doc(HTMLParser):
    """Turns the small, fixed HTML used here into (kind, class, inline markup) blocks."""

    def __init__(self, fallback_font=None):
        super().__init__(convert_charrefs=True)
        self.blocks, self.stack, self.buf, self.cls, self.items = [], [], [], None, []
        self.fallback_font = fallback_font

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("h1", "h2", "p", "li", "div"):
            self.buf, self.cls = [], a.get("class")
            self.stack.append(tag)
        elif tag in ("ul", "ol"):
            self.items = []
        elif tag == "b":
            self.buf.append("<b>")
        elif tag == "br":
            self.buf.append("<br/>")

    def handle_endtag(self, tag):
        if tag == "b":
            self.buf.append("</b>")
        elif tag in ("h1", "h2", "p", "div") and self.stack:
            self.stack.pop()
            text = "".join(self.buf).strip()
            if text:
                self.blocks.append((tag, self.cls, text))
        elif tag == "li" and self.stack:
            self.stack.pop()
            self.items.append("".join(self.buf).strip())
        elif tag in ("ul", "ol"):
            self.blocks.append((tag, None, list(self.items)))

    def handle_data(self, data):
        if not self.stack:
            return
        text = html.escape(re.sub(r"\s+", " ", data), quote=False)
        if self.fallback_font:
            text = re.sub(r"\S+", lambda m: m.group(0) if all(winansi(ch) for ch in m.group(0))
                          else f'<font name="{self.fallback_font}">{m.group(0)}</font>', text)
        self.buf.append(text)


def build(src, out, regular, bold, body_size, leading_ratio, h1_size, h2_size, sub_size, foot_size,
          fallback_font=None, stroked_headings=False, margins=(17, 17, 14, 14)):
    source = open(os.path.join(HERE, src), encoding="utf-8").read()
    parser = Doc(fallback_font)
    parser.feed(source)
    grey = colors.HexColor("#444444")
    body = ParagraphStyle("body", fontName=regular, fontSize=body_size, leading=body_size * leading_ratio,
                          textColor=INK, spaceAfter=body_size * 0.45)
    styles = {
        "h1": ParagraphStyle("h1", parent=body, fontName=bold, fontSize=h1_size, leading=h1_size * 1.2, spaceAfter=2),
        "h2": ParagraphStyle("h2", parent=body, fontName=bold, fontSize=h2_size, leading=h2_size * 1.25,
                             spaceBefore=body_size * 0.8, spaceAfter=1),
        "sub": ParagraphStyle("sub", parent=body, fontSize=sub_size, leading=sub_size * 1.35, textColor=grey,
                              spaceAfter=body_size * 0.7),
        "foot": ParagraphStyle("foot", parent=body, fontSize=foot_size, leading=foot_size * 1.35, textColor=grey,
                               spaceBefore=body_size * 0.8),
        "li": ParagraphStyle("li", parent=body, spaceAfter=1.5),
    }
    story = []
    for kind, cls, content in parser.blocks:
        if kind in ("h1", "h2") and stroked_headings:
            plain = html.unescape(re.sub(r"<[^>]+>", "", content))
            size = h1_size if kind == "h1" else h2_size
            story.append(StrokedHeading(plain, regular, size, stroke=size * 0.045, rule=(kind == "h2"),
                                        space_before=0 if kind == "h1" else body_size * 0.8, space_after=3))
        elif kind == "h1":
            story.append(Paragraph(content, styles["h1"]))
        elif kind == "h2":
            story.append(KeepTogether([Paragraph(content, styles["h2"]),
                                       HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#999999"),
                                                  spaceBefore=0, spaceAfter=3)]))
        elif kind in ("ul", "ol"):
            numbered = kind == "ol"
            items = [ListItem(Paragraph(t, styles["li"]), leftIndent=13, value=i + 1 if numbered else None)
                     for i, t in enumerate(content)]
            story.append(ListFlowable(items, bulletType="1" if numbered else "bullet", start=1 if numbered else "•",
                                      bulletFontName=regular, bulletFontSize=body_size * (1 if numbered else 0.85),
                                      leftIndent=13, bulletFormat="%s." if numbered else None,
                                      spaceAfter=body_size * 0.35))
        elif kind == "div" and cls == "warn":
            content = content.replace("<b>", '<font color="#bb0000">').replace("</b>", "</font>") \
                if stroked_headings else content
            box = Table([[Paragraph(content, ParagraphStyle("warn", parent=body, spaceAfter=0))]], colWidths=["100%"])
            box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1.1, colors.HexColor("#bb0000")),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                                     ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
            story += [Spacer(1, 3), box, Spacer(1, 5)]
        else:
            story.append(Paragraph(content, styles.get(cls or "", body)))
    title = html.unescape(re.search(r"<title>(.*?)</title>", source).group(1))
    left, right, top, bottom = margins
    doc = SimpleDocTemplate(os.path.join(HERE, out), pagesize=A4, leftMargin=left * mm, rightMargin=right * mm,
                            topMargin=top * mm, bottomMargin=bottom * mm, title=title, author="Lorenc Hoxha",
                            creator="", producer="", pageCompression=1, invariant=1)
    doc.build(story)
    return os.path.getsize(os.path.join(HERE, out))


def chars_of(name):
    text = open(os.path.join(HERE, name), encoding="utf-8").read()
    return "".join(sorted(set(html.unescape(re.sub(r"<[^>]+>", " ", text))) - set("\r\n\t")))


if __name__ == "__main__":
    tmp = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
    proposal = html.unescape(re.sub(r"<[^>]+>", " ", open(os.path.join(HERE, "forum_proposal_sq.html"), encoding="utf-8").read()))
    vn_words = "".join(set("".join(w for w in proposal.split() if not all(winansi(ch) for ch in w))))
    unhinted_subset(FONTS + "liberation/LiberationSans-Regular.ttf", vn_words, os.path.join(tmp, "VnSans.ttf"))
    pdfmetrics.registerFont(RLTTFont("VnSans", os.path.join(tmp, "VnSans.ttf")))
    unhinted_subset(FONTS + "dejavu/DejaVuSans.ttf", chars_of("worker_leaflet_vi.html") + "•.0123456789",
                    os.path.join(tmp, "LeafletSans.ttf"))
    pdfmetrics.registerFont(RLTTFont("LeafletSans", os.path.join(tmp, "LeafletSans.ttf")))
    print("forum_proposal_sq.pdf", build("forum_proposal_sq.html", "forum_proposal_sq.pdf", "Helvetica", "Helvetica-Bold",
                                         9.7, 1.32, 15, 11, 9, 8.3, fallback_font="VnSans",
                                         margins=(16, 16, 12, 11)), "bytes")
    print("worker_leaflet_vi.pdf", build("worker_leaflet_vi.html", "worker_leaflet_vi.pdf", "LeafletSans", "LeafletSans",
                                         9.6, 1.32, 15, 10.5, 8.5, 8, stroked_headings=True), "bytes")
