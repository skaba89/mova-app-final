#!/usr/bin/env python3
"""
MOVA - Super-App Mobilite Africaine | Rapport d'Etat et Recommandations
Generates a comprehensive PDF report in French.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate,
    NextPageTemplate, Image, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ─── Constants ───────────────────────────────────────────────────────────────
EMERALD = HexColor("#059669")
EMERALD_DARK = HexColor("#047857")
EMERALD_LIGHT = HexColor("#D1FAE5")
DARK_BLUE = HexColor("#1F4E79")
LIGHT_BLUE = HexColor("#D6EAF8")
LIGHT_GRAY = HexColor("#F8F9FA")
MED_GRAY = HexColor("#E5E7EB")
RED = HexColor("#DC2626")
ORANGE = HexColor("#EA580C")
YELLOW_BG = HexColor("#FEF3C7")
RED_BG = HexColor("#FEE2E2")
GREEN_BG = HexColor("#DCFCE7")
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 2.0 * cm
RIGHT_MARGIN = 2.0 * cm
TOP_MARGIN = 2.0 * cm
BOTTOM_MARGIN = 2.0 * cm

# ─── Fonts ───────────────────────────────────────────────────────────────────
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('SimHei-Bold', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('TimesNewRoman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('Calibri-Bold', '/usr/share/fonts/truetype/english/calibri-bold.ttf'))

# ─── Styles ──────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, **kwargs):
    defaults = dict(fontName='SimHei', fontSize=10, leading=14, textColor=black)
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)

sTitle = make_style('sTitle', fontName='Calibri-Bold', fontSize=32, leading=40, textColor=white, alignment=TA_CENTER)
sSubtitle = make_style('sSubtitle', fontName='Calibri', fontSize=16, leading=22, textColor=HexColor("#D1FAE5"), alignment=TA_CENTER)
sH1 = make_style('sH1', fontName='Calibri-Bold', fontSize=22, leading=28, textColor=EMERALD_DARK, spaceAfter=12, spaceBefore=20)
sH2 = make_style('sH2', fontName='Calibri-Bold', fontSize=16, leading=22, textColor=DARK_BLUE, spaceAfter=8, spaceBefore=14)
sH3 = make_style('sH3', fontName='Calibri-Bold', fontSize=13, leading=18, textColor=EMERALD_DARK, spaceAfter=6, spaceBefore=10)
sBody = make_style('sBody', fontSize=10, leading=15, alignment=TA_JUSTIFY, spaceAfter=6)
sBodyBold = make_style('sBodyBold', fontName='Calibri-Bold', fontSize=10, leading=15, spaceAfter=6)
sCode = make_style('sCode', fontName='TimesNewRoman', fontSize=9, leading=13, textColor=HexColor("#1E293B"), backColor=LIGHT_GRAY, leftIndent=6, rightIndent=6, spaceAfter=4, spaceBefore=2)
sBullet = make_style('sBullet', fontSize=10, leading=15, leftIndent=20, bulletIndent=8, spaceAfter=3)
sTableCell = make_style('sTableCell', fontSize=9, leading=13, spaceAfter=0)
sTableHeader = make_style('sTableHeader', fontName='Calibri-Bold', fontSize=9, leading=13, textColor=white, alignment=TA_CENTER)
sTableHeaderLeft = make_style('sTableHeaderLeft', fontName='Calibri-Bold', fontSize=9, leading=13, textColor=white, alignment=TA_LEFT)
sTOCEntry = make_style('sTOCEntry', fontName='SimHei', fontSize=12, leading=20, leftIndent=20)

# ─── Helpers ─────────────────────────────────────────────────────────────────
def P(text, style=sBody):
    return Paragraph(str(text), style)

def header_cell(text, style=sTableHeader):
    return P(text, style)

def cell(text, style=sTableCell, extra_style=None):
    if extra_style:
        s = ParagraphStyle('dyn', parent=style, **extra_style)
        return P(text, s)
    return P(text, style)

def code_cell(text):
    return P(str(text), sCode)

def bold(text):
    return P(str(text), sBodyBold)

def bullet(text):
    return P(f"\u2022 {text}", sBullet)

def spacer(h=6):
    return Spacer(1, h * mm)

def hr():
    return HRFlowable(width="100%", thickness=1, color=EMERALD, spaceAfter=8, spaceBefore=8)

def section_hr():
    return HRFlowable(width="100%", thickness=2, color=EMERALD, spaceAfter=12, spaceBefore=4)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with Paragraph cells."""
    hdr = [header_cell(h) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([cell(str(c)) for c in row])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t

def make_score_table(title, score, max_score, items):
    """Create a score card table."""
    pct = score / max_score * 100
    if pct >= 75:
        color = EMERALD
        bg = GREEN_BG
        label = "Bon"
    elif pct >= 50:
        color = ORANGE
        bg = YELLOW_BG
        label = "Moyen"
    else:
        color = RED
        bg = RED_BG
        label = "Critique"

    data = [
        [P(f"<b>{title}</b>", sTableHeaderLeft)],
        [cell(f"<b>Score: {score}/{max_score} ({pct:.0f}%) - {label}</b>", extra_style={'textColor': color, 'fontSize': 11})],
    ]
    for item in items:
        data.append([cell(item)])

    t = Table(data, colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN - 0.5*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('BACKGROUND', (0, 1), (-1, 1), bg),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t

# ─── Cover Page ──────────────────────────────────────────────────────────────
def build_cover_page():
    elements = []
    elements.append(Spacer(1, 3 * cm))

    # Green banner
    cover_data = [[
        P("<b>MOVA</b>", sTitle),
    ], [
        P("Super-App Mobilite Africaine", sSubtitle),
    ], [
        P("Conakry, Guinee", make_style('coverLoc', fontName='Calibri', fontSize=13, leading=18, textColor=HexColor("#A7F3D0"), alignment=TA_CENTER)),
    ]]
    cover_table = Table(cover_data, colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), EMERALD),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 15),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ('LEFTPADDING', (0, 0), (-1, -1), 20),
        ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ('ROUNDEDCORNERS', [10, 10, 10, 10]),
    ]))
    elements.append(cover_table)
    elements.append(Spacer(1, 2.5 * cm))

    # Report title
    elements.append(P("Rapport d'Etat du Projet", make_style('rTitle', fontName='Calibri-Bold', fontSize=26, leading=34, textColor=DARK_BLUE, alignment=TA_CENTER)))
    elements.append(P("et Recommandations Strategiques", make_style('rTitle2', fontName='Calibri-Bold', fontSize=22, leading=30, textColor=DARK_BLUE, alignment=TA_CENTER)))
    elements.append(spacer(10))

    # Decorative line
    elements.append(HRFlowable(width="60%", thickness=3, color=EMERALD, spaceAfter=10, spaceBefore=10))

    # Date and version
    info_data = [
        [cell("<b>Date:</b>"), cell("Janvier 2025")],
        [cell("<b>Version:</b>"), cell("1.0 - Post Audit QA")],
        [cell("<b>Classification:</b>"), cell("Confidentiel - Interne")],
        [cell("<b>Preparé par:</b>"), cell("Equipe Technique MOVA")],
    ]
    info_table = Table(info_data, colWidths=[5*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, MED_GRAY),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 3 * cm))

    # Footer
    elements.append(P("Document genere automatiquement par Z.ai", make_style('footer', fontName='SimHei', fontSize=9, leading=12, textColor=HexColor("#94A3B8"), alignment=TA_CENTER)))

    elements.append(PageBreak())
    return elements

# ─── Table of Contents ──────────────────────────────────────────────────────
class MovaDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        frame = Frame(LEFT_MARGIN, BOTTOM_MARGIN, PAGE_W - LEFT_MARGIN - RIGHT_MARGIN, PAGE_H - TOP_MARGIN - BOTTOM_MARGIN, id='normal')
        self.addPageTemplates([
            PageTemplate(id='cover', frames=[frame], onPage=self._cover_page),
            PageTemplate(id='normal', frames=[frame], onPage=self._normal_page),
        ])

    def _cover_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(EMERALD)
        canvas.rect(0, PAGE_H - 1.2*cm, PAGE_W, 1.2*cm, fill=1, stroke=0)
        canvas.setFillColor(EMERALD_DARK)
        canvas.rect(0, 0, PAGE_W, 0.8*cm, fill=1, stroke=0)
        canvas.restoreState()

    def _normal_page(self, canvas, doc):
        canvas.saveState()
        # Header bar
        canvas.setFillColor(EMERALD)
        canvas.rect(0, PAGE_H - 1.0*cm, PAGE_W, 1.0*cm, fill=1, stroke=0)
        canvas.setFillColor(white)
        canvas.setFont('Calibri-Bold', 8)
        canvas.drawString(LEFT_MARGIN, PAGE_H - 0.7*cm, "MOVA - Rapport d'Etat et Recommandations")
        canvas.drawRightString(PAGE_W - RIGHT_MARGIN, PAGE_H - 0.7*cm, "Confidentiel")
        # Footer bar
        canvas.setFillColor(EMERALD_DARK)
        canvas.rect(0, 0, PAGE_W, 0.7*cm, fill=1, stroke=0)
        canvas.setFillColor(white)
        canvas.setFont('Calibri', 8)
        canvas.drawString(LEFT_MARGIN, 0.25*cm, "Z.ai - Janvier 2025")
        canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.25*cm, f"Page {doc.page}")
        canvas.restoreState()

# ─── Main Content ────────────────────────────────────────────────────────────
def build_report():
    output_path = "/home/z/my-project/download/MOVA_Etat_Projet_et_Recommandations.pdf"

    doc = MovaDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title="MOVA - Etat du Projet et Recommandations",
        author="Z.ai",
    )

    story = []

    # ── Cover Page ──
    story.extend(build_cover_page())

    # ── Table of Contents ──
    story.append(NextPageTemplate('normal'))
    story.append(P("Table des Matieres", sH1))
    story.append(section_hr())

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle('toc0', fontName='Calibri-Bold', fontSize=12, leading=22, leftIndent=10, textColor=DARK_BLUE),
        ParagraphStyle('toc1', fontName='SimHei', fontSize=10, leading=18, leftIndent=30, textColor=HexColor("#374151")),
    ]
    story.append(toc)
    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 1: RESUME EXECUTIF
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("1. Resume Executif", sH1))
    story.append(section_hr())

    story.append(P(
        "MOVA est une super-application de mobilite destinee au marche africain, "
        "avec un lancement initial prevu a Conakry, Guinee. Le projet combine le transport "
        "de personnes (VTC, interurbain, transport scolaire), la livraison de colis, "
        "les services de marketplace, et un module corporate B2B. Ce rapport presente "
        "l'etat complet du projet apres l'audit QA de janvier 2025 et les corrections effectuees.",
        sBody
    ))
    story.append(spacer(4))

    # Score tables
    story.append(P("<b>Scores de Maturite du Projet</b>", sH3))
    story.append(spacer(2))

    score1 = make_score_table("Securite", 6, 10, [
        "\u2713 Authentification JWT implementee",
        "\u2713 Headers de securite configures",
        "\u2713 Rate limiting en place",
        "\u2713 Zod validation sur tous les endpoints",
        "\u2713 Middleware RBAC admin",
        "\u2718 Cle JWT hardcoded (fallback)",
        "\u2718 Fallback mot de passe en clair",
        "\u2718 Pas de Redis pour rate limiting distribue",
    ])
    story.append(score1)
    story.append(spacer(6))

    score2 = make_score_table("Fonctionnalites", 8, 10, [
        "\u2713 63 routes API operationnelles",
        "\u2713 48 composants MOVA",
        "\u2713 23 modeles Prisma",
        "\u2713 20 vues applicatives",
        "\u2713 Systeme de prix intelligent",
        "\u2713 Module corporate B2B",
        "\u2713 Marketplace + Fidelite + Parrainage",
        "\u2718 Mobile Money en mode demo",
        "\u2718 Pas de notifications push reelles",
        "\u2718 Pas de WebSocket temps reel",
    ])
    story.append(score2)
    story.append(spacer(6))

    score3 = make_score_table("Infrastructure & Qualite", 4, 10, [
        "\u2713 TypeScript strict mode",
        "\u2713 PWA manifest + service worker",
        "\u2713 i18n multi-langues (FR, Pular, Susu)",
        "\u2718 SQLite au lieu de PostgreSQL",
        "\u2718 Aucun test automatise",
        "\u2718 Pas de pipeline CI/CD",
        "\u2718 Pas de logging structure",
        "\u2718 Pas de monitoring (Sentry, Grafana)",
        "\u2718 Pas de file de jobs (Bull/BullMQ)",
        "\u2718 Pas de cache distribue (Redis)",
    ])
    story.append(score3)
    story.append(spacer(6))

    score4 = make_score_table("Pret pour la Production", 3, 10, [
        "\u2713 Architecture Next.js 16 moderne",
        "\u2713 Stack technique coherente",
        "\u2718 Base de donnees non adaptee aux finances",
        "\u2718 Secrets non securises",
        "\u2718 Paiements simules uniquement",
        "\u2718 Pas de gestion d'erreurs avancee",
        "\u2718 Pas de monitoring en production",
        "\u2718 Pas de tests de non-regression",
        "\u2718 Variables d'environnement non gerees",
        "\u2718 Performance non optimisee (Framer Motion lourd)",
    ])
    story.append(score4)
    story.append(spacer(6))

    # Global score summary table
    summary_headers = ["Domaine", "Score", "Max", "Pourcentage", "Statut"]
    summary_rows = [
        ["Securite", "6", "10", "60%", "Moyen"],
        ["Fonctionnalites", "8", "10", "80%", "Bon"],
        ["Infrastructure & Qualite", "4", "10", "40%", "Critique"],
        ["Pret pour la Production", "3", "10", "30%", "Critique"],
        ["<b>SCORE GLOBAL</b>", "<b>21</b>", "<b>40</b>", "<b>52.5%</b>", "<b>Moyen</b>"],
    ]
    cw = [5*cm, 2*cm, 2*cm, 3*cm, 3*cm]
    st = make_table(summary_headers, summary_rows, cw)
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -3), [white, LIGHT_GRAY]),
        ('BACKGROUND', (0, -1), (-1, -1), EMERALD_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(P("<b>Synthese Globale</b>", sH3))
    story.append(st)
    story.append(spacer(4))

    story.append(P(
        "<b>Conclusion:</b> Le projet MOVA a progresse de maniere significative depuis l'audit QA initial, "
        "avec 32 ameliorations importantes implementees. Cependant, le score global de 52.5% indique que "
        "le projet n'est pas encore pret pour un deploiement en production. Les blocages critiques concernent "
        "la base de donnees, la securite des secrets, et l'absence de paiements reels.",
        sBody
    ))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 2: ETAT ACTUEL DU PROJET
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("2. Etat Actuel du Projet", sH1))
    story.append(section_hr())

    story.append(P("2.1 Stack Technique", sH2))
    tech_headers = ["Categorie", "Technologie", "Version / Detail"]
    tech_rows = [
        ["Framework", "Next.js + React + TypeScript", "Next.js 16, React 19"],
        ["Base de donnees", "Prisma ORM + SQLite", "23 modeles Prisma"],
        ["UI / Design", "Tailwind CSS + shadcn/ui", "Tailwind CSS 4"],
        ["State Management", "Zustand", "Stores centralises"],
        ["Data Fetching", "TanStack Query + Table", "Cache + pagination cliente"],
        ["Animations", "Framer Motion", "Transitions et micro-interactions"],
        ["Temps reel", "Socket.io-client", "Importe mais pas de serveur"],
        ["Cartes", "Leaflet + React-Leaflet", "Cartes OpenStreetMap basiques"],
        ["Graphiques", "Recharts", "Dashboard analytique"],
        ["Internationalisation", "next-intl", "FR, Pular, Susu"],
        ["Theming", "next-themes", "Mode clair / sombre"],
        ["Authentification", "next-auth + JWT (jose)", "Middleware + bcryptjs"],
        ["IA", "z-ai-web-dev-sdk", "Integrations AI avancees"],
        ["Validation", "Zod", "18+ schemas definis"],
    ]
    story.append(make_table(tech_headers, tech_rows, [3.5*cm, 5.5*cm, 6.5*cm]))
    story.append(spacer(8))

    story.append(P("2.2 Metriques du Projet", sH2))
    story.append(P(
        "Le projet a connu une croissance significative depuis le rapport QA initial de janvier 2025 :",
        sBody
    ))
    metrics_headers = ["Metrique", "Valeur Actuelle", "Valeur QA (Jan 2025)", "Evolution"]
    metrics_rows = [
        ["Routes API", "63", "32", "+97%"],
        ["Composants MOVA", "48", "25", "+92%"],
        ["Modeles Prisma", "23", "N/A", "Nouveau"],
        ["Vues applicatives", "20", "N/A", "Nouveau"],
        ["Commits (master)", "11", "N/A", "Nouveau"],
        ["Bugs critiques corriges", "7", "7 identifies", "100% corriges"],
        ["Ameliorations", "32", "0", "Nouveau"],
        ["Schemas Zod", "18+", "0", "Nouveau"],
    ]
    story.append(make_table(metrics_headers, metrics_rows, [4.5*cm, 3.5*cm, 4*cm, 3.5*cm]))
    story.append(spacer(8))

    story.append(P("2.3 Architecture des Modules", sH2))
    story.append(P(
        "L'application MOVA est organisee en modules fonctionnels distincts, chacun avec "
        "ses propres routes API, composants frontend et modeles de donnees :",
        sBody
    ))
    modules_headers = ["Module", "Fonctionnalite", "Statut"]
    modules_rows = [
        ["Transport VTC", "Courses en ville, prix dynamique, suivi GPS", "Operationnel"],
        ["Transport Interurbain", "Trajets entre villes, reservation提前", "Operationnel"],
        ["Transport Scolaire", "Bus scolaires, suivi parents", "Partiel (pas de verification zones)"],
        ["Livraison Colis", "Envoi et reception de colis", "Partiel (prix pas temps reel)"],
        ["Mobile Money", "Paiement Orange Money + MTN MoMo", "DEMO uniquement"],
        ["Portefeuille", "Wallet, transferts, historique", "Bug race condition"],
        ["Marketplace", "Annonces, categories, vendeurs locaux", "Operationnel"],
        ["Corporate B2B", "Comptes entreprise, employes, centres de couts", "Operationnel"],
        ["Fidelite", "Points, niveaux (bronze a diamond)", "Partiel (pas de recalcul)"],
        ["Parrainage", "Code referral, classement", "Operationnel"],
        ["Chat", "Messagerie entre utilisateurs", "Operationnel"],
        ["Notifications", "Centre de notifications, badge", "Pas de push reels"],
        ["Sécurite", "Bouton SOS, overlay securite", "Operationnel"],
        ["Support", "Tickets, centre d'aide, feedback", "Operationnel"],
        ["Onboarding", "Flux beta, tutoriel, OTP", "Operationnel"],
    ]
    story.append(make_table(modules_headers, modules_rows, [3.5*cm, 8*cm, 4*cm]))
    story.append(spacer(6))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 3: AMELIORATIONS REALISEES
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("3. Ameliorations Realisees Depuis le Rapport QA", sH1))
    story.append(section_hr())

    story.append(P(
        "Depuis le rapport d'audit QA de janvier 2025, l'equipe technique a implemente "
        "32 ameliorations majeures couvrant la securite, les fonctionnalites, l'experience "
        "utilisateur et l'architecture technique. Voici le detail complet :",
        sBody
    ))
    story.append(spacer(4))

    # 3.1 Securite
    story.append(P("3.1 Securite et Authentification (7 items)", sH2))
    sec_headers = ["#", "Amelioration", "Detail"]
    sec_rows = [
        ["1", "Correction BUG-001 a BUG-007", "7 bugs critiques corriges"],
        ["2", "Systeme JWT complet", "Middleware + login + register avec tokens JWT (jose)"],
        ["3", "Hashage bcrypt", "Mots de passe hashes avec bcryptjs (salt rounds)"],
        ["4", "Rate limiting", "In-memory: 100/min general, 30/min API, 5/min auth"],
        ["5", "Headers de securite", "X-Content-Type-Options, X-Frame-Options, XSS Protection"],
        ["6", "Configuration CORS", "CORS configure dans le middleware Next.js"],
        ["7", "Validation Zod", "18+ schemas Zod sur tous les endpoints API"],
        ["8", "Protection RBAC admin", "Verification du role utilisateur dans les routes admin"],
    ]
    story.append(make_table(sec_headers, sec_rows, [1*cm, 4*cm, 10.5*cm]))
    story.append(spacer(8))

    # 3.2 Fonctionnalites
    story.append(P("3.2 Fonctionnalites Implementees (15 items)", sH2))
    feat_headers = ["#", "Fonctionnalite", "Detail"]
    feat_rows = [
        ["9", "PWA", "manifest.json + service worker (sw.js)"],
        ["10", "Internationalisation", "3 langues: Francais, Pular, Susu"],
        ["11", "Moteur de prix intelligent", "Surge, multiplicateurs meteo/temps, cache"],
        ["12", "Integration Mobile Money", "Demo: Orange Money + MTN MoMo (in-memory)"],
        ["13", "Push notifications", "Modele Prisma + API subscription"],
        ["14", "Marketplace", "Annonces avec categories et filtres"],
        ["15", "Module Corporate B2B", "BusinessAccount, Employee, CostCenter"],
        ["16", "Overlay Securite", "Bouton SOS accessible partout"],
        ["17", "Onboarding Beta", "Systeme d'integration pour nouveaux utilisateurs"],
        ["18", "Systeme Chat", "Modele ChatMessage + API de messagerie"],
        ["19", "Programme de fidelite", "Niveaux bronze, silver, gold, platinum, diamond"],
        ["20", "Systeme de parrainage", "Code referral + classement leaderboard"],
        ["21", "Centre de support", "Tickets d'assistance + centre d'aide"],
        ["22", "Systeme de feedback", "Collecte de retours utilisateurs"],
        ["23", "Classement chauffeurs", "Leaderboard des meilleurs chauffeurs"],
    ]
    story.append(make_table(feat_headers, feat_rows, [1*cm, 4.5*cm, 10*cm]))
    story.append(spacer(8))

    # 3.3 UX et Technique
    story.append(P("3.3 Experience Utilisateur et Technique (9 items)", sH2))
    ux_headers = ["#", "Amelioration", "Detail"]
    ux_rows = [
        ["24", "TypeScript strict", "ignoreBuildErrors: false, compilation stricte"],
        ["25", "SEO et OpenGraph", "Meta tags + balises OpenGraph sur toutes les pages"],
        ["26", "Composant ErrorBoundary", "Gestion d'erreurs elegante pour l'utilisateur"],
        ["27", "Pull-to-refresh", "Rafraichissement par tirage sur mobile"],
        ["28", "Vue Parametres", "Page complete de parametres utilisateur"],
        ["29", "Vue Profil", "Page de profil utilisateur complete"],
        ["30", "Centre de notifications", "Badge + panneau de notifications"],
        ["31", "Flux OTP", "Verification par code a usage unique"],
        ["32", "Demo login", "Endpoint de connexion demo pour les tests"],
    ]
    story.append(make_table(ux_headers, ux_rows, [1*cm, 4.5*cm, 10*cm]))
    story.append(spacer(6))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 4: PROBLEMES PERSISTANTS
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("4. Problemes Persistants", sH1))
    story.append(section_hr())

    story.append(P(
        "Malgre les progres significatifs, plusieurs problemes critiques et de haute priorite "
        "persistent et doivent etre resolus avant tout deploiement en production. "
        "Cette section les categorise par niveau de severite.",
        sBody
    ))
    story.append(spacer(4))

    # 4.1 Bloquants
    story.append(P("4.1 Bloquants pour la Production (6 items)", sH2))
    story.append(P(
        "Ces problemes bloquent absolument tout deploiement en production et doivent "
        "etre traites en priorite absolue :",
        sBody
    ))
    block_headers = ["ID", "Probleme", "Impact", "Complexite"]
    block_rows = [
        ["P-001", "SQLite utilise comme base de donnees", "Systeme financier non fiable, pas de concurrence, pas de scalabilite", "Elevee"],
        ["P-002", "Cle JWT hardcoded (fallback)", "Faille de securite critique - cle exposee dans le code source", "Faible"],
        ["P-003", "Fallback mot de passe en clair", "Faille de securite majeure - mots de passe non hashes dans certains cas", "Faible"],
        ["P-004", "Mobile Money en mode DEMO", "Aucun paiement reel possible - Map in-memory, setTimeout simule", "Elevee"],
        ["P-005", "Pas de WebSocket temps reel", "socket.io-client importe mais aucun serveur WebSocket deploye", "Moyenne"],
        ["P-006", "Race condition transfert wallet", "BUG-011 non corrige - double depense possible sur les transferts", "Moyenne"],
    ]
    bt = make_table(block_headers, block_rows, [1.5*cm, 4.5*cm, 7*cm, 2.5*cm])
    bt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), RED),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [RED_BG, white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(bt)
    story.append(spacer(8))

    # 4.2 Haute Priorite
    story.append(P("4.2 Haute Priorite (12 items)", sH2))
    story.append(P(
        "Ces problemes affectent gravement la qualite et la fiabilite du service :",
        sBody
    ))
    hp_headers = ["ID", "Probleme", "Detail", "Bug ID"]
    hp_rows = [
        ["P-007", "Requetes N+1 listing chauffeurs", "Pas de Prisma includes - requetes multiples en cascade", "BUG-008"],
        ["P-008", "Analytics charge tous les paiements", "Pas de filtre par date - surcharge serveur", "BUG-009"],
        ["P-009", "Pas de pagination wallet", "Historique transactions non pagine", "BUG-010"],
        ["P-010", "Reservation sans check conflits", "Pas de verification chevauchement horaire", "BUG-012"],
        ["P-011", "Prix livraison non temps reel", "Calcul statique au lieu de dynamique", "BUG-013"],
        ["P-012", "Points fidelite non recalcules", "Mise a jour manuelle uniquement", "BUG-015"],
        ["P-013", "Interurbain sans validation capacite", "Surbooking possible", "BUG-016"],
        ["P-014", "Transport scolaire sans zone check", "Pas de verification couverture geographique", "BUG-017"],
        ["P-015", "Pas de Redis", "Rate limiting et cache en-memory uniquement", "-"],
        ["P-016", "Pas de file de jobs", "Taches async non gerees (emails, notifications)", "-"],
        ["P-017", "Aucun test automatise", "Pas de Jest ni Playwright", "-"],
        ["P-018", "Pas de pipeline CI/CD", "Deploiement manuel uniquement", "-"],
    ]
    ht = make_table(hp_headers, hp_rows, [1.5*cm, 4.5*cm, 7.5*cm, 2*cm])
    ht.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), ORANGE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [YELLOW_BG, white]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(ht)
    story.append(spacer(8))

    # 4.3 Priorite Moyenne
    story.append(P("4.3 Priorite Moyenne (10 items)", sH2))
    mp_headers = ["#", "Probleme", "Categorie"]
    mp_rows = [
        ["P-019", "Favicon SVG generique", "Branding"],
        ["P-020", "Skeleton pas sur toutes les vues admin", "UX"],
        ["P-021", "Problemes dark mode sur certaines cartes", "UI"],
        ["P-022", "Position scroll non preservee entre vues", "UX"],
        ["P-023", "Formatage dates incoherent", "UX"],
        ["P-024", "Images AI non optimisees (pas WebP)", "Performance"],
        ["P-025", "Logging avec console.log uniquement", "Observabilite"],
        ["P-026", "Config hardcoded dans moteur de prix", "Architecture"],
        ["P-027", "Pas de gestion env (.env.development/.production)", "DevOps"],
        ["P-028", "Framer Motion lourd (AuthView 112+ refs)", "Performance"],
    ]
    story.append(make_table(mp_headers, mp_rows, [1.5*cm, 9*cm, 5*cm]))
    story.append(spacer(8))

    # 4.4 Specifique Marche
    story.append(P("4.4 Problemes Specifiques au Marche Africain (8 items)", sH2))
    story.append(P(
        "Ces problemes sont particulierement importants pour le marche cible de Conakry et "
        "l'Afrique de l'Ouest :",
        sBody
    ))
    mkt_headers = ["#", "Probleme", "Impact Marche"]
    mkt_rows = [
        ["P-029", "Pas de vraie integration Mapbox/Google Maps", "Geocoding imprecis, pas d'itineraire optimal"],
        ["P-030", "Pas d'API reelle Orange Money / MTN MoMo", "Aucun revenu possible - blocant pour le modele economique"],
        ["P-031", "Pas d'OTP SMS (Africa's Talking/Twilio)", "Verification utilisateurs limitee"],
        ["P-032", "Pas de push notifications (FCM/APNs)", "Engagement utilisateur faible"],
        ["P-033", "Pas de multi-devise (GNF uniquement)", "Limitation aux clients guineens uniquement"],
        ["P-034", "Pas de deep linking", "Marketing et acquisition limits"],
        ["P-035", "Pas de mode hors-ligne", "Problematique dans zones mal connectees de Conakry"],
        ["P-036", "Pas de systeme d'alertes trafic", "Valeur ajoutee absente pour le transport"],
    ]
    story.append(make_table(mkt_headers, mkt_rows, [1.5*cm, 5*cm, 9*cm]))
    story.append(spacer(6))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 5: RECOMMANDATIONS & ROADMAP
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("5. Recommandations et Roadmap", sH1))
    story.append(section_hr())

    story.append(P(
        "Nous recommandons une approche en 4 phases, s'etalant sur 8 semaines, pour amener "
        "le projet MOVA a un niveau de maturite suffisant pour un lancement beta a Conakry. "
        "Chaque phase a des objectifs clairs et des criteres d'acceptation definis.",
        sBody
    ))
    story.append(spacer(4))

    # Phase 1
    story.append(P("5.1 Phase 1 : Securite et Stabilite (2 semaines)", sH2))
    story.append(P(
        "<b>Objectif:</b> Resoudre tous les bloquants de production et securiser l'infrastructure de base.",
        sBody
    ))
    p1_headers = ["#", "Action", "Detail Technique", "Priorite"]
    p1_rows = [
        ["1.1", "Migrer SQLite vers PostgreSQL", "Adapter Prisma schema, scripts de migration, pool connections", "Critique"],
        ["1.2", "Retirer cle JWT hardcoded", "Utiliser uniquement process.env.JWT_SECRET, supprimer le fallback", "Critique"],
        ["1.3", "Supprimer fallback mot de passe clair", "Forcer bcrypt uniquement, rejeter les mots de passe non hashes", "Critique"],
        ["1.4", "Corriger race condition wallet", "Pessimistic locking avec Prisma tx, verifier solde avant/apres", "Critique"],
        ["1.5", "Ajouter pagination universelle", "Cursor-based pagination sur tous les endpoints liste", "Haute"],
        ["1.6", "Corriger requetes N+1", "Utiliser Prisma include/select pour charger les relations", "Haute"],
        ["1.7", "Deployer Redis", "Rate limiting distribue + cache TTL pour les donnees frequentes", "Haute"],
        ["1.8", "Dockeriser + Caddy HTTPS", "Dockerfile + docker-compose, Caddy reverse proxy auto-HTTPS", "Haute"],
    ]
    p1t = make_table(p1_headers, p1_rows, [1.2*cm, 4*cm, 7*cm, 2.3*cm])
    p1t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(p1t)
    story.append(spacer(8))

    # Phase 2
    story.append(P("5.2 Phase 2 : Paiements et Mobile (3 semaines)", sH2))
    story.append(P(
        "<b>Objectif:</b> Implementer les integrations paiement reelles et optimiser l'experience mobile.",
        sBody
    ))
    p2_headers = ["#", "Action", "Detail Technique", "Priorite"]
    p2_rows = [
        ["2.1", "Integrer Orange Money API", "API REST OM, webhooks callback, gestion des statuts", "Critique"],
        ["2.2", "Integrer MTN MoMo API", "API REST MTN, collection/disbursement, reconciliation", "Critique"],
        ["2.3", "OTP SMS via Africa's Talking", "Envoi SMS, verification code, fallback email", "Haute"],
        ["2.4", "Push notifications FCM", "Firebase Cloud Messaging pour Android, APNs pour iOS", "Haute"],
        ["2.5", "Optimiser PWA", "Images WebP, lazy loading, precaching stratégique", "Moyenne"],
        ["2.6", "Integration Mapbox", "Geocoding, routage optimal, cartographie HD", "Moyenne"],
    ]
    story.append(make_table(p2_headers, p2_rows, [1.2*cm, 4.5*cm, 6.5*cm, 2.3*cm]))
    story.append(spacer(8))

    # Phase 3
    story.append(P("5.3 Phase 3 : Scaling et Monitoring (2 semaines)", sH2))
    story.append(P(
        "<b>Objectif:</b> Mettre en place l'infrastructure de production, le monitoring et les tests.",
        sBody
    ))
    p3_headers = ["#", "Action", "Detail Technique", "Priorite"]
    p3_rows = [
        ["3.1", "Redis distribue", "Sentinel cluster, pub/sub pour temps reel", "Haute"],
        ["3.2", "File de jobs Bull/BullMQ", "Taches async: emails, notifications, reconciliation", "Haute"],
        ["3.3", "Monitoring Sentry", "Error tracking, performance monitoring, alerts", "Haute"],
        ["3.4", "CI/CD GitHub Actions", "Lint, build, test, deploy automatique", "Haute"],
        ["3.5", "Tests Jest + Playwright", "Unit tests + E2E tests, couverture minimum 60%", "Moyenne"],
        ["3.6", "Dashboard Grafana", "Metriques API, temps de reponse, taux d'erreur", "Moyenne"],
    ]
    story.append(make_table(p3_headers, p3_rows, [1.2*cm, 4.5*cm, 6.5*cm, 2.3*cm]))
    story.append(spacer(8))

    # Phase 4
    story.append(P("5.4 Phase 4 : Lancement Conakry (1 semaine)", sH2))
    story.append(P(
        "<b>Objectif:</b> Beta testing avec 100 utilisateurs reels a Conakry et preparation du lancement.",
        sBody
    ))
    p4_headers = ["#", "Action", "Detail", "Priorite"]
    p4_rows = [
        ["4.1", "Beta testing 100 utilisateurs", "Recrutement via reseaux sociaux Conakry, feedback continu", "Critique"],
        ["4.2", "Corrections bugs feedback", "Triaged par severite, correction immediate des critiques", "Critique"],
        ["4.3", "Optimisation performance", "Lighthouse score > 80, temps de chargement < 3s", "Haute"],
        ["4.4", "Soumission stores", "PWA installable, metadata stores, captures ecrans", "Moyenne"],
    ]
    story.append(make_table(p4_headers, p4_rows, [1.2*cm, 4.5*cm, 7*cm, 2.3*cm]))
    story.append(spacer(6))

    # Timeline summary
    story.append(P("5.5 Synthese du Calendrier", sH2))
    timeline_headers = ["Phase", "Duree", "Semaines", "Livraison Cle"]
    timeline_rows = [
        ["Phase 1: Securite & Stabilite", "2 semaines", "S1-S2", "PostgreSQL + JWT secure + Redis"],
        ["Phase 2: Paiements & Mobile", "3 semaines", "S3-S5", "Orange Money + MTN + SMS OTP"],
        ["Phase 3: Scaling & Monitoring", "2 semaines", "S6-S7", "CI/CD + Sentry + Tests"],
        ["Phase 4: Lancement Conakry", "1 semaine", "S8", "Beta 100 utilisateurs live"],
        ["<b>TOTAL</b>", "<b>8 semaines</b>", "<b>S1-S8</b>", "<b>MOVA Beta Conakry</b>"],
    ]
    tlt = make_table(timeline_headers, timeline_rows, [4.5*cm, 2.5*cm, 2.5*cm, 6*cm])
    tlt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('GRID', (0, 0), (-1, -1), 0.5, MED_GRAY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [white, LIGHT_GRAY]),
        ('BACKGROUND', (0, -1), (-1, -1), EMERALD_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(tlt)
    story.append(spacer(6))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────────────
    # SECTION 6: EVOLUTIONS FUTURES
    # ──────────────────────────────────────────────────────────────────────────
    story.append(P("6. Evolutions Futures", sH1))
    story.append(section_hr())

    story.append(P(
        "Au-dela de la roadmap de lancement, nous identifions 12 evolutions strategiques "
        "a moyen et long terme qui renforceront la position de MOVA sur le marche africain "
        "et ouvriront de nouvelles sources de revenus :",
        sBody
    ))
    story.append(spacer(4))

    future_headers = ["#", "Evolution", "Description", "Horizon"]
    future_rows = [
        ["E-01", "Multi-devise", "Support XOF (Cote d'Ivoire), XAF (Cameroun), USD, EUR - expansion regionale", "Moyen terme"],
        ["E-02", "Tarification surge dynamique", "Algorithme ML base sur la demande reelle, meteo, evenements", "Moyen terme"],
        ["E-03", "Mode hors-ligne", "Service worker avance, sync offline-first, IndexedDB pour donnees locales", "Moyen terme"],
        ["E-04", "Zones de securite communautaires", "Signalement communautaire, alertes zones a risque, itineraires alternatifs", "Court terme"],
        ["E-05", "Marketplace marchands locaux", "Integration commerces Conakry, livraison dernier kilometre, paiement in-app", "Court terme"],
        ["E-06", "Billets de transport QR", "Generation QR codes pour bus interurbains, validation conducteur, historique", "Court terme"],
        ["E-07", "Gamification chauffeurs", "Badges, niveaux, bonus performance, classement communautaire", "Moyen terme"],
        ["E-08", "Deep linking", "Liens profonds pour partage courses, invitation, campagnes marketing", "Court terme"],
        ["E-09", "API versioning (v1, v2)", "Gestion des versions d'API pour partenaires et integrations tierces", "Moyen terme"],
        ["E-10", "Webhooks partenaires", "Notifications temps reel pour les partenaires (restaurants, marchands)", "Moyen terme"],
        ["E-11", "Micro-investissement / OPCVM", "Epargne automatique sur les courses, micro-placements, litteratie financiere", "Long terme"],
        ["E-12", "Systeme d'alertes trafic", "Alertes en temps reel sur conditions de circulation, travaux, incidents", "Court terme"],
    ]
    story.append(make_table(future_headers, future_rows, [1.2*cm, 3.5*cm, 9*cm, 2.8*cm]))
    story.append(spacer(8))

    story.append(P("6.1 Vision Strategique", sH2))
    story.append(P(
        "MOVA a le potentiel de devenir la super-application de reference pour la mobilite "
        "en Afrique de l'Ouest. La combinaison unique de transport (VTC, interurbain, scolaire), "
        "de livraison, de marketplace et de services financiers (mobile money, wallet) positionne "
        "MOVA comme un acteur incontournable du ecosysteme digital guineen.",
        sBody
    ))
    story.append(spacer(4))
    story.append(P(
        "Les evolutions E-04, E-05, E-06 et E-08 peuvent etre lancees des la Phase 4 (beta) "
        "pour enrichir l'experience des premiers utilisateurs et generer des retours qualitatifs. "
        "Les evolutions E-01, E-09 et E-10 sont des prerequis pour l'expansion regionale vers "
        "la Cote d'Ivoire, le Senegal et le Mali.",
        sBody
    ))
    story.append(spacer(4))
    story.append(P(
        "L'evolution E-11 (micro-investissement) est la plus ambitieuse et necessitera des "
        "partenariats avec des institutions financieres et des approvals reglementaires. "
        "Elle represente neanmoins une opportunite de differentiation majeure sur le marche.",
        sBody
    ))
    story.append(spacer(10))

    # ── Closing ──
    story.append(hr())
    story.append(spacer(4))
    story.append(P(
        "<b>Rapport prepare par l'equipe technique MOVA</b><br/>"
        "Document confidentiel - Usage interne uniquement<br/>"
        "Janvier 2025 - Version 1.0 Post-Audit QA",
        make_style('closing', fontSize=9, leading=14, alignment=TA_CENTER, textColor=HexColor("#64748B"))
    ))

    # Build with TOC
    doc.multiBuild(story)
    return output_path


if __name__ == "__main__":
    path = build_report()
    print(f"PDF generated: {path}")
