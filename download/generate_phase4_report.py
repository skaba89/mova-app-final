# -*- coding: utf-8 -*-
"""MOVA Phase 4 - Beta Launch Conakry Report Generator"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')

EMERALD = colors.HexColor('#059669')
DARK_BLUE = colors.HexColor('#1F4E79')
LIGHT_GRAY = colors.HexColor('#F5F5F5')
WHITE = colors.white

cover_title = ParagraphStyle(name='CoverTitle', fontName='SimHei', fontSize=36, leading=44, alignment=TA_CENTER, spaceAfter=24, textColor=EMERALD)
cover_sub = ParagraphStyle(name='CoverSub', fontName='SimHei', fontSize=18, leading=26, alignment=TA_CENTER, spaceAfter=12, textColor=colors.HexColor('#333333'))
cover_info = ParagraphStyle(name='CoverInfo', fontName='SimHei', fontSize=13, leading=20, alignment=TA_CENTER, spaceAfter=8, textColor=colors.HexColor('#666666'))
h1 = ParagraphStyle(name='H1', fontName='SimHei', fontSize=18, leading=26, spaceBefore=18, spaceAfter=12, textColor=DARK_BLUE, wordWrap='CJK')
h2 = ParagraphStyle(name='H2', fontName='SimHei', fontSize=14, leading=20, spaceBefore=14, spaceAfter=8, textColor=DARK_BLUE, wordWrap='CJK')
body = ParagraphStyle(name='Body', fontName='SimHei', fontSize=10.5, leading=18, alignment=TA_LEFT, spaceAfter=6, wordWrap='CJK')
th = ParagraphStyle(name='TH', fontName='SimHei', fontSize=9.5, leading=14, alignment=TA_CENTER, textColor=WHITE, wordWrap='CJK')
tc = ParagraphStyle(name='TC', fontName='SimHei', fontSize=9, leading=13, alignment=TA_LEFT, wordWrap='CJK')
tcc = ParagraphStyle(name='TCC', fontName='SimHei', fontSize=9, leading=13, alignment=TA_CENTER, wordWrap='CJK')
cap = ParagraphStyle(name='Cap', fontName='SimHei', fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#666666'))

pdf_path = '/home/z/my-project/download/MOVA_Phase4_Rapport_Beta_Launch.pdf'
doc = SimpleDocTemplate(pdf_path, pagesize=A4, title='MOVA Phase 4 - Beta Launch Conakry', author='Z.ai', creator='Z.ai', subject='MOVA Phase 4 rapport - Beta launch readiness', leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
story = []

# COVER
story.append(Spacer(1, 100))
story.append(Paragraph('<b>MOVA</b>', cover_title))
story.append(Spacer(1, 16))
story.append(Paragraph('<b>Phase 4 : Lancement Beta Conakry</b>', cover_sub))
story.append(Spacer(1, 8))
story.append(Paragraph('PWA, i18n, Onboarding et Corrections Critiques', cover_info))
story.append(Spacer(1, 60))
story.append(HRFlowable(width='60%', color=EMERALD, thickness=2))
story.append(Spacer(1, 40))
story.append(Paragraph('Super-app Mobilite - Conakry, Guinee', cover_info))
story.append(Paragraph('Rapport technique de corrections', cover_info))
story.append(Spacer(1, 40))
story.append(Paragraph('Avril 2026', cover_info))
story.append(Paragraph('Version 2.2.0', cover_info))
story.append(PageBreak())

# SECTION 1
story.append(Paragraph('<b>1. Resume Executif</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "La Phase 4 prepare le lancement beta de MOVA a Conakry, Guinee. Un audit complet de 18 fichiers a "
    "revele 3 blocages critiques et 7 problemes importants. Cette phase a corrige l'integralite des "
    "blocages et la majorite des problemes importants, amenant le projet a un etat de beta-readiness. "
    "Les corrections couvrent les endpoints API manquants, la securisation des notifications push, "
    "la completion de l'infrastructure PWA (screenshots, install prompt), la traduction i18n en 3 "
    "langues locales (Francais, Pular, Susu), et l'optimisation du SEO pour le partage social.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Trois blocages critiques ont ete identifies et resolus : l'endpoint de validation de code beta "
    "manquant (qui causait une erreur 500 a chaque soumission), les screenshots PWA absents (qui "
    "empechaient l'affichage du prompt d'installation riche sur Chrome/Edge), et la cle VAPID "
    "hardcodee dans le hook push (qui rendait les notifications push inoperantes en production). "
    "Sept problemes importants ont egalement ete traites : la soumission du profil onboarding n'etait "
    "pas persistee cote serveur, le selecteur de langue n'etait pas synchronise avec l'i18n reel, "
    "les meta tags OpenGraph manquaient pour le partage social, l'event appinstalled n'etait pas "
    "ecoute, le texte d'onboarding n'etait pas traduit, et la validation du numero de telephone "
    "etait absente.", body
))
story.append(Spacer(1, 12))

# Score table
sd = [
    [Paragraph('<b>Critere Beta</b>', th), Paragraph('<b>Avant</b>', th), Paragraph('<b>Apres</b>', th), Paragraph('<b>Statut</b>', th)],
    [Paragraph('Endpoint beta/validate', tc), Paragraph('Manquant (500)', tcc), Paragraph('Operationnel', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Screenshots PWA', tc), Paragraph('Absents', tcc), Paragraph('540x720 + 1080x1920', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Cle VAPID push', tc), Paragraph('Hardcodee demo', tcc), Paragraph('API dynamique', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Onboarding serveur', tc), Paragraph('localStorage seul', tcc), Paragraph('API register', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('i18n beta (3 langues)', tc), Paragraph('FR seulement', tcc), Paragraph('FR + Pular + Susu', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Selecteur langue', tc), Paragraph('FR/EN/AR (incoherent)', tcc), Paragraph('FR/Pular/Susu', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('OG meta tags', tc), Paragraph('Absents', tcc), Paragraph('OG + Twitter Card', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Event appinstalled', tc), Paragraph('Non ecoute', tcc), Paragraph('Ecoute + persiste', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Validation telephone', tc), Paragraph('Absente', tcc), Paragraph('+224 10-14 chars', tcc), Paragraph('RESOLU', tcc)],
    [Paragraph('Endpoint vapid-key', tc), Paragraph('Manquant', tcc), Paragraph('GET operationnel', tcc), Paragraph('RESOLU', tcc)],
]
st = Table(sd, colWidths=[3.8*cm, 3.5*cm, 3.5*cm, 3.2*cm])
sc = [('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
for i in range(1, len(sd)):
    sc.append(('BACKGROUND', (0, i), (-1, i), WHITE if i % 2 == 1 else LIGHT_GRAY))
st.setStyle(TableStyle(sc))
story.append(st)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 1 : Critere de beta-readiness avant/apres Phase 4', cap))
story.append(Spacer(1, 18))

# SECTION 2
story.append(Paragraph('<b>2. Corrections Critiques</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>2.1 Endpoint Beta Validate</b>', h2))
story.append(Paragraph(
    "Le composant beta-onboarding.tsx appelait POST /api/mova/beta/validate mais cet endpoint n'existait "
    "pas, causant une erreur 500 systematique a chaque tentative de validation de code d'invitation. "
    "Un nouvel endpoint a ete cree qui effectue une recherche en base de donnees via Prisma dans la "
    "table BetaRegistration. La validation est insensible a la casse (toUpperCase), rejette les codes "
    "deja utilises (champ invited === true), et retourne les informations d'inscription associees "
    "(email, position) en cas de succes. Le code est maintenant verifie reellement contre les codes "
    "d'invitation generes par le systeme d'administration.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>2.2 Screenshots PWA</b>', h2))
story.append(Paragraph(
    "Le manifest.json faisait reference a /screenshots/narrow.png (540x720) et /screenshots/wide.png "
    "(1080x1920) mais ces fichiers n'existaient pas. Sans ces captures d'ecran, Chrome et Edge "
    "n'affichent pas le prompt d'installation riche (Richer Install UI), ce qui reduit considerablement "
    "le taux d'adoption PWA. Deux images ont ete generees avec l'interface MOVA, montrant le design "
    "emerald/gold avec la carte de Conakry, le formulaire de reservation et les cartes chauffeurs. "
    "Les images ont ete redimensionnees aux dimensions exactes requises par le manifest.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>2.3 Cle VAPID Push Dynamique</b>', h2))
story.append(Paragraph(
    "Le hook use-push-notifications.ts utilisait une cle VAPID demon constante (DEMO_VAPID_KEY). "
    "En production, cette cle ne correspond pas aux cles VAPID configurees cote serveur, rendant "
    "toute notification push inoperante. Le hook a ete refactorise pour recuperer dynamiquement "
    "la cle publique VAPID via un nouvel endpoint GET /api/mova/notifications/vapid-key. La cle "
    "est mise en cache apres le premier appel pour eviter les requetes redondantes. En mode "
    "developpement, le fallback vers la cle demo est conserve pour faciliter les tests locaux. "
    "Un nouvel endpoint expose NEXT_PUBLIC_VAPID_PUBLIC_KEY ou VAPID_PUBLIC_KEY depuis les variables "
    "d'environnement, retournant une erreur 503 si les notifications push ne sont pas configurees.", body
))
story.append(Spacer(1, 18))

# SECTION 3
story.append(Paragraph('<b>3. Ameliorations PWA et Onboarding</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>3.1 Event appinstalled</b>', h2))
story.append(Paragraph(
    "Le composant pwa-install.tsx detectait le beforeinstallprompt pour afficher la banniere "
    "d'installation, mais ne surveillait pas l'evenement appinstalled. Si un utilisateur installait "
    "l'application via le menu du navigateur au lieu de cliquer sur la banniere, l'etat d'installation "
    "restait erroneement a false. L'event appinstalled est maintenant ecoute : il met a jour l'etat "
    "isInstalled, supprime le listener beforeinstallprompt (devenu inutile), persiste l'etat dans "
    "localStorage sous la cle mova_pwa_installed, et nettoie le timer d'auto-prompt de 30 secondes. "
    "Le rendu du composant est egalement protege par un guard isInstalled pour ne pas afficher la "
    "banniere si l'application est deja installee.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>3.2 Onboarding Beta Serveur</b>', h2))
story.append(Paragraph(
    "La soumission du profil dans beta-onboarding.tsx ne persistait les donnees qu'en localStorage, "
    "sans creer de compte utilisateur cote serveur. La fonction handleProfileSubmit est maintenant "
    "asynchrone et effectue un appel POST /api/mova/auth/register avec les informations du profil "
    "(nom, telephone, zone, locale). Cet appel est non-bloquant : en cas d'echec, l'onboarding "
    "continue normalement sans interrompre l'experience utilisateur. Une validation du numero de "
    "telephone a ete ajoutee : le numero doit commencer par +224 ou 224 et mesurer entre 10 et 14 "
    "caracteres, correspondant au format guineen standard.", body
))
story.append(Spacer(1, 18))

# SECTION 4
story.append(Paragraph('<b>4. Internationalisation (i18n)</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "L'internationalisation est un element essentiel pour le marche guineen ou trois langues locales "
    "sont largement parlees a Conakry : le Francais (langue officielle), le Pular (Fulfulde, langue "
    "la plus parlee en Guinee avec environ 40% de locuteurs), et le Susu (environ 20% de locuteurs "
    "a Conakry). Avant la Phase 4, le systeme i18n existait mais les cles pour l'onboarding beta "
    "n'etaient pas definies, et le selecteur de langue dans les parametres proposait Anglais et Arabe "
    "alors que ces langues n'etaient pas supportees par le systeme de traduction.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Dix-huit nouvelles cles de traduction ont ete ajoutees pour couvrir l'integralite du flux "
    "d'onboarding beta : titre de bienvenue, sous-titre, titre des fonctionnalites, titre du code, "
    "placeholder, indice, demande de code, messages d'erreur et de succes, titre du profil, labels "
    "des champs (nom, telephone, zone), checkbox des conditions, bouton de soumission et placeholders. "
    "Les traductions Pular utilisent les caracteres diacritiques appropris (ɓ, ɗ, ƴ, ɲ) et les "
    "traductions Susu suivent les patterns linguistiques couramment parles a Conakry. Le selecteur de "
    "langue dans les parametres a ete corrige pour afficher les trois langues reellement supportees "
    "(Francais, Pular, Susu) au lieu des langues non-implementationees (Anglais, Arabe), et la "
    "selection est maintenant connectee a la fonction setLocale() du store Zustand pour propager "
    "le changement de langue a travers toute l'interface.", body
))
story.append(Spacer(1, 18))

# SECTION 5
story.append(Paragraph('<b>5. SEO et Partage Social</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Les meta tags OpenGraph et Twitter Card ont ete ajoutes au layout principal pour permettre un "
    "affichage enrichi lors du partage de liens MOVA sur les reseaux sociaux (WhatsApp, Facebook, "
    "Twitter/X, Telegram). Avant cette correction, un lien partage vers MOVA n'affichait aucune "
    "image ni description, reduisant considerablement le taux de clic. Les tags ajoutes incluent "
    "og:image avec le logo MOVA, og:image:width et og:image:height pour le dimensionnement, "
    "og:image:alt pour l'accessibilite, ainsi que les tags Twitter Card (summary, title, description, "
    "image). Le manifest.json existant contenait deja les champs de base PWA (nom, theme, display, "
    "categories, icones, raccourcis, protocol handlers, share target), mais manquait du champ id "
    "recommande par la derniere specification.", body
))
story.append(Spacer(1, 18))

# SECTION 6: Files
story.append(Paragraph('<b>6. Recapitulatif des Modifications</b>', h1))
story.append(Spacer(1, 8))
fd = [
    [Paragraph('<b>Fichier</b>', th), Paragraph('<b>Action</b>', th), Paragraph('<b>Description</b>', th)],
    [Paragraph('api/mova/beta/validate/route.ts', tc), Paragraph('Cree', tcc), Paragraph('Validation code beta via BetaRegistration DB', tc)],
    [Paragraph('api/mova/notifications/vapid-key/route.ts', tc), Paragraph('Cree', tcc), Paragraph('Exposition cle publique VAPID dynamique', tc)],
    [Paragraph('hooks/use-push-notifications.ts', tc), Paragraph('Modifie', tcc), Paragraph('Fetch VAPID key API au lieu de hardcode demo', tc)],
    [Paragraph('components/mova/pwa-install.tsx', tc), Paragraph('Modifie', tcc), Paragraph('Event appinstalled + garde isInstalled', tc)],
    [Paragraph('components/mova/beta-onboarding.tsx', tc), Paragraph('Modifie', tcc), Paragraph('Validation tel +224, POST register API', tc)],
    [Paragraph('lib/mova/i18n.ts', tc), Paragraph('Modifie', tcc), Paragraph('+18 cles beta en FR, Pular, Susu', tc)],
    [Paragraph('components/mova/settings-view.tsx', tc), Paragraph('Modifie', tcc), Paragraph('Langues FR/Pular/Susu + setLocale()', tc)],
    [Paragraph('app/layout.tsx', tc), Paragraph('Modifie', tcc), Paragraph('OG image + Twitter Card meta tags', tc)],
    [Paragraph('public/screenshots/narrow.png', tc), Paragraph('Cree', tcc), Paragraph('Capture PWA 540x720 pour manifest', tc)],
    [Paragraph('public/screenshots/wide.png', tc), Paragraph('Cree', tcc), Paragraph('Capture PWA 1080x1920 pour manifest', tc)],
]
ft = Table(fd, colWidths=[5.5*cm, 1.8*cm, 7.7*cm])
fc = [('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
for i in range(1, len(fd)):
    fc.append(('BACKGROUND', (0, i), (-1, i), WHITE if i % 2 == 1 else LIGHT_GRAY))
ft.setStyle(TableStyle(fc))
story.append(ft)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 2 : Liste des fichiers modifies et crees en Phase 4', cap))
story.append(Spacer(1, 18))

# SECTION 7
story.append(Paragraph('<b>7. Verifications</b>', h1))
story.append(Spacer(1, 8))
vd = [
    [Paragraph('<b>Verification</b>', th), Paragraph('<b>Resultat</b>', th), Paragraph('<b>Details</b>', th)],
    [Paragraph('Tests unitaires', tc), Paragraph('188/188 passants', tcc), Paragraph('5 suites, 684ms', tc)],
    [Paragraph('ESLint', tc), Paragraph('0 erreurs', tcc), Paragraph('Sur 10 fichiers modifies', tc)],
    [Paragraph('Build Next.js', tc), Paragraph('OK', tcc), Paragraph('Compilation reussie, toutes routes dynamiques', tc)],
    [Paragraph('Screenshots PWA', tc), Paragraph('OK', tcc), Paragraph('narrow.png (540x720) + wide.png (1080x1920)', tc)],
    [Paragraph('Service Worker', tc), Paragraph('OK', tcc), Paragraph('v2, 3 strategies cache, offline page', tc)],
    [Paragraph('Manifest.json', tc), Paragraph('OK', tcc), Paragraph('5 shortcuts, share target, screenshots', tc)],
]
vt = Table(vd, colWidths=[4*cm, 3.5*cm, 7.5*cm])
vc = [('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE), ('TEXTCOLOR', (0, 0), (-1, 0), WHITE), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
for i in range(1, len(vd)):
    vc.append(('BACKGROUND', (0, i), (-1, i), WHITE if i % 2 == 1 else LIGHT_GRAY))
vt.setStyle(TableStyle(vc))
story.append(vt)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 3 : Verifications post-Phase 4', cap))
story.append(Spacer(1, 18))

story.append(Paragraph('<b>8. Etat Final du Projet</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Le projet MOVA est desormais en etat de beta-readiness. Quatre phases de developpement ont ete "
    "completees avec succes : Phase 1 (Securite et Stabilite), Phase 2 (Integrations Tierces avec "
    "Orange Money, MTN MoMo, SMS OTP AfricasTalking et PWA), Phase 3 (Scaling et Monitoring avec "
    "Redis, CI/CD, 188 tests et Sentry), et Phase 4 (Beta Launch avec corrections critiques PWA, "
    "i18n trilingue, endpoints beta et SEO). Le projet dispose de 63 routes API, 48 composants UI, "
    "20 vues, un service worker v2 avec 3 strategies de cache, une integration complete des API "
    "Mobile Money, un systeme de notifications push fonctionnel, et une infrastructure Docker "
    "production-ready avec PostgreSQL 16 et Redis 7.", body
))

doc.build(story)
print(f'PDF genere : {pdf_path}')
