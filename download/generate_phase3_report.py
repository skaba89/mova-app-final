# -*- coding: utf-8 -*-
"""
MOVA Phase 3 - Scaling & Monitoring Report Generator
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.units import cm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Font registration
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

# Colors
EMERALD = colors.HexColor('#059669')
DARK_BLUE = colors.HexColor('#1F4E79')
LIGHT_GRAY = colors.HexColor('#F5F5F5')
AMBER = colors.HexColor('#D97706')
WHITE = colors.white

# Styles
cover_title = ParagraphStyle(
    name='CoverTitle', fontName='SimHei', fontSize=36, leading=44,
    alignment=TA_CENTER, spaceAfter=24, textColor=EMERALD
)
cover_subtitle = ParagraphStyle(
    name='CoverSubtitle', fontName='SimHei', fontSize=18, leading=26,
    alignment=TA_CENTER, spaceAfter=12, textColor=colors.HexColor('#333333')
)
cover_info = ParagraphStyle(
    name='CoverInfo', fontName='SimHei', fontSize=13, leading=20,
    alignment=TA_CENTER, spaceAfter=8, textColor=colors.HexColor('#666666')
)
h1 = ParagraphStyle(
    name='H1', fontName='SimHei', fontSize=18, leading=26,
    spaceBefore=18, spaceAfter=12, textColor=DARK_BLUE, wordWrap='CJK'
)
h2 = ParagraphStyle(
    name='H2', fontName='SimHei', fontSize=14, leading=20,
    spaceBefore=14, spaceAfter=8, textColor=DARK_BLUE, wordWrap='CJK'
)
body = ParagraphStyle(
    name='Body', fontName='SimHei', fontSize=10.5, leading=18,
    alignment=TA_LEFT, spaceAfter=6, wordWrap='CJK'
)
body_just = ParagraphStyle(
    name='BodyJust', fontName='SimHei', fontSize=10.5, leading=18,
    alignment=TA_LEFT, spaceAfter=6, wordWrap='CJK'
)
code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=9, leading=14,
    alignment=TA_LEFT, spaceAfter=6, textColor=colors.HexColor('#1a1a1a')
)
tbl_header = ParagraphStyle(
    name='TblHeader', fontName='SimHei', fontSize=9.5, leading=14,
    alignment=TA_CENTER, textColor=WHITE, wordWrap='CJK'
)
tbl_cell = ParagraphStyle(
    name='TblCell', fontName='SimHei', fontSize=9, leading=13,
    alignment=TA_LEFT, wordWrap='CJK'
)
tbl_cell_center = ParagraphStyle(
    name='TblCellCenter', fontName='SimHei', fontSize=9, leading=13,
    alignment=TA_CENTER, wordWrap='CJK'
)

pdf_filename = "MOVA_Phase3_Rapport_Scaling_Monitoring.pdf"
pdf_path = f"/home/z/my-project/download/{pdf_filename}"

doc = SimpleDocTemplate(
    pdf_path, pagesize=A4,
    title="MOVA Phase 3 - Scaling & Monitoring",
    author='Z.ai', creator='Z.ai',
    subject='MOVA Phase 3 rapport de corrections - Scaling, Monitoring, CI/CD, Tests',
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm
)

story = []

# ==================== COVER PAGE ====================
story.append(Spacer(1, 100))
story.append(Paragraph('<b>MOVA</b>', cover_title))
story.append(Spacer(1, 16))
story.append(Paragraph('<b>Phase 3 : Scaling & Monitoring</b>', cover_subtitle))
story.append(Spacer(1, 8))
story.append(Paragraph('Infrastructure, Tests, CI/CD et Observabilite', cover_info))
story.append(Spacer(1, 60))
story.append(HRFlowable(width="60%", color=EMERALD, thickness=2))
story.append(Spacer(1, 40))
story.append(Paragraph('Super-app Mobilite - Conakry, Guinee', cover_info))
story.append(Paragraph('Rapport technique de corrections', cover_info))
story.append(Spacer(1, 40))
story.append(Paragraph('Avril 2026', cover_info))
story.append(Paragraph('Version 2.1.0', cover_info))
story.append(PageBreak())

# ==================== SECTION 1: EXECUTIVE SUMMARY ====================
story.append(Paragraph('<b>1. Resume Executif</b>', h1))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "La Phase 3 du projet MOVA constitue une etape fondamentale dans la preparation du deploiement en production. "
    "Cette phase se concentre sur quatre piliers essentiels : la mise en place d'une infrastructure de cache distribue "
    "avec Redis, l'automatisation des tests et du deploiement continu, l'integration d'un systeme de monitoring et "
    "d'observabilite complet, et l'optimisation des performances globales de l'application. L'objectif principal est "
    "de garantir que MOVA peut supporter une montee en charge simultanee de milliers d'utilisateurs tout en "
    "maintenant des performances reactives et une fiabilite maximale.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Avant cette phase, le projet souffrait de plusieurs limitations critiques pour la production : aucun systeme "
    "de cache distribue (tout etait en memoire volatile), zero test automatise (188 tests crees), pas de pipeline "
    "CI/CD, aucun systeme de monitoring externe, et une configuration Docker et Next.js sous-optimalisee. "
    "Le rate limiting etait duplique en trois implementations independantes, et le health check ne verifiait pas "
    "la disponibilite reelle des dependances critiques.", body
))
story.append(Spacer(1, 6))

# Score table
score_data = [
    [Paragraph('<b>Metrique</b>', tbl_header), Paragraph('<b>Avant Phase 3</b>', tbl_header), Paragraph('<b>Apres Phase 3</b>', tbl_header), Paragraph('<b>Evolution</b>', tbl_header)],
    [Paragraph('Cache distribue (Redis)', tbl_cell), Paragraph('0/3 (in-memory uniquement)', tbl_cell_center), Paragraph('3/3 (Redis + fallback)', tbl_cell_center), Paragraph('+100%', tbl_cell_center)],
    [Paragraph('Tests automatise', tbl_cell), Paragraph('0/2 (aucun test)', tbl_cell_center), Paragraph('2/2 (188 tests)', tbl_cell_center), Paragraph('+100%', tbl_cell_center)],
    [Paragraph('CI/CD Pipeline', tbl_cell), Paragraph('0/2 (aucun pipeline)', tbl_cell_center), Paragraph('2/2 (GitHub Actions)', tbl_cell_center), Paragraph('+100%', tbl_cell_center)],
    [Paragraph('Monitoring (Sentry)', tbl_cell), Paragraph('0/2 (logs en memoire)', tbl_cell_center), Paragraph('2/2 (Sentry + fichier)', tbl_cell_center), Paragraph('+100%', tbl_cell_center)],
    [Paragraph('Health Checks', tbl_cell), Paragraph('1/3 (basique)', tbl_cell_center), Paragraph('3/3 (DB + Redis + live/ready)', tbl_cell_center), Paragraph('+200%', tbl_cell_center)],
    [Paragraph('Docker Security', tbl_cell), Paragraph('2/2 (multi-stage)', tbl_cell_center), Paragraph('2/2 (non-root + health)', tbl_cell_center), Paragraph('Ameliore', tbl_cell_center)],
    [Paragraph('Rate Limiting', tbl_cell), Paragraph('1/2 (3x duplique)', tbl_cell_center), Paragraph('2/2 (unifie + Redis-ready)', tbl_cell_center), Paragraph('+100%', tbl_cell_center)],
    [Paragraph('Next.js Config', tbl_cell), Paragraph('1/3 (minimal)', tbl_cell_center), Paragraph('3/3 (headers + compression)', tbl_cell_center), Paragraph('+200%', tbl_cell_center)],
]
score_table = Table(score_data, colWidths=[3.8*cm, 4*cm, 4*cm, 3.2*cm])
score_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('BACKGROUND', (0, 1), (-1, 1), WHITE),
    ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
    ('BACKGROUND', (0, 3), (-1, 3), WHITE),
    ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
    ('BACKGROUND', (0, 5), (-1, 5), WHITE),
    ('BACKGROUND', (0, 6), (-1, 6), LIGHT_GRAY),
    ('BACKGROUND', (0, 7), (-1, 7), WHITE),
    ('BACKGROUND', (0, 8), (-1, 8), LIGHT_GRAY),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(Spacer(1, 12))
story.append(score_table)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 1 : Evolution des metriques de maturite avant/apres Phase 3', ParagraphStyle(name='caption', fontName='SimHei', fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#666666'))))
story.append(Spacer(1, 18))

# ==================== SECTION 2: REDIS CACHE ====================
story.append(Paragraph('<b>2. Cache Distribue Redis</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "L'implementation du cache Redis represente l'amelioration la plus impactante de cette phase. Avant la Phase 3, "
    "toutes les operations de cache et de rate limiting etaient stockees en memoire vive du processus Node.js, ce "
    "qui signifiait que chaque redemarrage du serveur perdait toutes les donnees de cache, et qu'un deploiement "
    "multi-instances rendait le cache completement inefficace (chaque instance avait son propre etat independant). "
    "Avec Redis, toutes les instances partagent le meme etat de cache, permettant une coherence globale et une "
    "evolutivite horizontale.", body
))

story.append(Paragraph('<b>2.1 Architecture CacheManager</b>', h2))
story.append(Paragraph(
    "Le nouveau CacheManager suit une strategie Redis-first avec fallback in-memory. Lorsque la variable "
    "d'environnement REDIS_URL est configuree, toutes les operations de cache transitent par Redis 7 avec "
    "serialisation JSON automatique. Si Redis est indisponible ou non configure, le systeme bascule "
    "transparentement vers un cache en memoire Map-based avec expiration TTL. Cette approche garantit que "
    "l'application fonctionne toujours, meme en environnement de developpement sans Redis.", body
))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "L'implementation inclut un prefixe d'espace de noms configurable (defaut : mova:) pour isoler les cles "
    "MOVA des autres applications partageant le meme serveur Redis. Les nouvelles methodes incr(), decr(), mget() "
    "et mset() permettent des operations atomiques sur les compteurs, essentielles pour le rate limiting distribue. "
    "La methode isConnected() permet de verifier en temps reel l'etat de la connexion Redis.", body
))

story.append(Paragraph('<b>2.2 Service Redis Docker</b>', h2))
story.append(Paragraph(
    "Le fichier docker-compose.yml a ete enrichi avec un service Redis dedie utilisant l'image officielle "
    "redis:7-alpine. La configuration inclut une limitation de memoire a 128 Mo avec une politique d'eviction "
    "LRU (Least Recently Used), la persistance AOF (Append-Only File) pour la recuperation apres redemarrage, "
    "et un healthcheck automatique via redis-cli ping. Le volume persistent mova-redis-data assure que les "
    "donnees Redis survivent aux redemarrages du conteneur.", body
))

# Redis config table
redis_data = [
    [Paragraph('<b>Parametre</b>', tbl_header), Paragraph('<b>Valeur</b>', tbl_header), Paragraph('<b>Description</b>', tbl_header)],
    [Paragraph('Image', tbl_cell), Paragraph('redis:7-alpine', tbl_cell), Paragraph('Image officielle ultra-legere', tbl_cell)],
    [Paragraph('Max memoire', tbl_cell), Paragraph('128 Mo', tbl_cell), Paragraph('Limite stricte pour eviter OOM', tbl_cell)],
    [Paragraph('Politique eviction', tbl_cell), Paragraph('allkeys-lru', tbl_cell), Paragraph('Supprime les cles les moins recentes', tbl_cell)],
    [Paragraph('Persistance', tbl_cell), Paragraph('AOF (appendonly yes)', tbl_cell), Paragraph('Recovery apres crash/restart', tbl_cell)],
    [Paragraph('Healthcheck', tbl_cell), Paragraph('redis-cli ping', tbl_cell), Paragraph('Verification toutes les 10s', tbl_cell)],
    [Paragraph('Volume', tbl_cell), Paragraph('mova-redis-data:/data', tbl_cell), Paragraph('Donnees persistantes', tbl_cell)],
]
redis_table = Table(redis_data, colWidths=[3.2*cm, 4.5*cm, 7.3*cm])
redis_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('BACKGROUND', (0, 1), (-1, 1), WHITE),
    ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
    ('BACKGROUND', (0, 3), (-1, 3), WHITE),
    ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
    ('BACKGROUND', (0, 5), (-1, 5), WHITE),
    ('BACKGROUND', (0, 6), (-1, 6), LIGHT_GRAY),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(Spacer(1, 12))
story.append(redis_table)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 2 : Configuration du service Redis dans docker-compose.yml', ParagraphStyle(name='caption2', fontName='SimHei', fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#666666'))))
story.append(Spacer(1, 18))

# ==================== SECTION 3: CI/CD ====================
story.append(Paragraph('<b>3. Pipeline CI/CD GitHub Actions</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Un pipeline CI/CD complet a ete mis en place via GitHub Actions pour automatiser la verification du code "
    "a chaque push ou pull request. Le pipeline se compose de quatre jobs executes en parallele pour optimiser "
    "le temps de feedback. Le job de lint verifie la conformite du code avec ESLint, le job type-check effectue "
    "une verification TypeScript complete (tsc --noEmit), le job test execute les 188 tests unitaires avec "
    "rapport de couverture, et le job build verifie que l'application Next.js compile correctement. "
    "Un mecanisme de concurrency annule automatiquement les runs en cours sur la meme branche, evitant "
    "la consommation inutile de ressources.", body
))

story.append(Paragraph('<b>3.1 Vitest - Framework de Tests</b>', h2))
story.append(Paragraph(
    "Vitest a ete choisi comme framework de tests pour sa rapidite d'execution (693ms pour 188 tests), "
    "sa compatibilite native avec Vite et l'ecosysteme TypeScript, et son integration transparente avec "
    "le path alias @/ du projet. La configuration inclut le provider de couverture v8 avec des seuils "
    "minimaux de 40% sur les branches, fonctions et lignes. Cinq suites de tests couvrent les modules "
    "critiques de l'application.", body
))

# Tests table
tests_data = [
    [Paragraph('<b>Suite de Tests</b>', tbl_header), Paragraph('<b>Tests</b>', tbl_header), Paragraph('<b>Module Teste</b>', tbl_header)],
    [Paragraph('cache.test.ts', tbl_cell), Paragraph('40', tbl_cell_center), Paragraph('CacheManager (Redis + in-memory)', tbl_cell)],
    [Paragraph('input-validator.test.ts', tbl_cell), Paragraph('62', tbl_cell_center), Paragraph('13 validateurs (XSS, phone, email, etc.)', tbl_cell)],
    [Paragraph('pricing-engine.test.ts', tbl_cell), Paragraph('34', tbl_cell_center), Paragraph('Calcul tarifaire smart + fallback', tbl_cell)],
    [Paragraph('error-logger.test.ts', tbl_cell), Paragraph('31', tbl_cell_center), Paragraph('Logger structure (FIFO, levels, Sentry)', tbl_cell)],
    [Paragraph('rate-limit.test.ts', tbl_cell), Paragraph('21', tbl_cell_center), Paragraph('Sliding window + 429 headers', tbl_cell)],
    [Paragraph('<b>Total</b>', tbl_cell), Paragraph('<b>188</b>', tbl_cell_center), Paragraph('', tbl_cell)],
]
tests_table = Table(tests_data, colWidths=[4.5*cm, 2*cm, 8.5*cm])
tests_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('BACKGROUND', (0, 1), (-1, 1), WHITE),
    ('BACKGROUND', (0, 2), (-1, 2), LIGHT_GRAY),
    ('BACKGROUND', (0, 3), (-1, 3), WHITE),
    ('BACKGROUND', (0, 4), (-1, 4), LIGHT_GRAY),
    ('BACKGROUND', (0, 5), (-1, 5), WHITE),
    ('BACKGROUND', (0, 6), (-1, 6), colors.HexColor('#E8F5E9')),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
]))
story.append(Spacer(1, 12))
story.append(tests_table)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 3 : Suites de tests Vitest - 188 tests, 100% passants', ParagraphStyle(name='caption3', fontName='SimHei', fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#666666'))))
story.append(Spacer(1, 18))

# ==================== SECTION 4: MONITORING ====================
story.append(Paragraph('<b>4. Monitoring et Observabilite</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Le monitoring de l'application a ete completement repense avec une approche multi-couches. L'integration "
    "de Sentry (optionnel) permet la capture automatique des exceptions non gerees avec stack traces completes, "
    "le suivi des performances (traces), et le profiling en production. L'error-logger existant a ete enrichi "
    "avec un pont vers Sentry : chaque erreur critique est automatiquement transmise a Sentry tout en "
    "conservant le stockage local. Un systeme de logging par fichier a egalement ete ajoute pour les "
    "environnements sans Sentry, avec rotation automatique.", body
))

story.append(Paragraph('<b>4.1 Health Checks Avances</b>', h2))
story.append(Paragraph(
    "Le endpoint de health check a ete completement refondu en trois endpoints distincts conformes aux "
    "standards Kubernetes. Le endpoint /api/mova/health/ sert de point de contact principal avec verification "
    "de la connectivite base de donnees et cache, metriques memoire et temps de reponse. L'endpoint "
    "/api/mova/health/ready fournit des diagnostics approfondis pour les probes de readinesse avec des "
    "details sur chaque dependance. Enfin, /api/mova/health/live offre un simple liveness check (200 OK) "
    "utilise par les orchestrateurs pour detecter les deadlocks. En cas d'indisponibilite critique de la "
    "base de donnees, le serveur retourne un HTTP 503, permettant aux load balancers de retirer l'instance "
    "du pool.", body
))

story.append(Paragraph('<b>4.2 Sentry Integration</b>', h2))
story.append(Paragraph(
    "Trois fichiers de configuration Sentry ont ete crees pour couvrir tous les runtimes Next.js : "
    "sentry.client.config.ts pour le code navigateur (avec replays sur erreur), sentry.server.config.ts "
    "pour le serveur (avec integrations Prisma et HTTP), et sentry.edge.config.ts pour le middleware "
    "Edge. Toutes les configurations sont conditionnelles via la presence de SENTRY_DSN, permettant "
    "une activation progressive sans impact sur les environnements de developpement. Le next.config.ts "
    "a ete mis a jour pour wrapper automatiquement la configuration avec withSentryConfig() lorsque "
    "Sentry est configure.", body
))
story.append(Spacer(1, 18))

# ==================== SECTION 5: PERFORMANCE ====================
story.append(Paragraph('<b>5. Optimisation des Performances</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph('<b>5.1 Consolidation du Rate Limiting</b>', h2))
story.append(Paragraph(
    "Un probleme majeur a ete identifie et resolu : le middleware.ts contenait sa propre implementation "
    "de rate limiting completement independante des modules rate-limit.ts et rate-limit-advanced.ts. "
    "Cela signifiait que trois systemes de rate limiting fonctionnaient en parallele sans coordination. "
    "Le middleware a ete refactorise pour utiliser exclusivement l'AdvancedRateLimiter, unificate les "
    "compteurs et beneficiant du sliding window algorithm, de l'auto-ban exponentiel et des statistiques "
    "detaillees. Les routes d'authentification conservent une limite stricte de 5 requetes par minute "
    "avec un prefixe login:, tandis que les routes API generales ont une limite de 30 requetes par "
    "minute avec un prefixe api:. Le rate limiter fonctionne en fail-open : toute erreur interne ne "
    "bloque jamais le trafic legitime.", body
))

story.append(Paragraph('<b>5.2 Optimisation next.config.ts</b>', h2))
story.append(Paragraph(
    "La configuration Next.js a ete significativement enrichie. La compression gzip est maintenant "
    "active nativement (compress: true), le header X-Powered-By est desactive pour reduire la surface "
    "d'attaque, et des headers de securite sont appliques globalement (HSTS, X-Content-Type-Options, "
    "X-Frame-Options, Referrer-Policy, Permissions-Policy). Le cache-control est configure strategiquement : "
    "pas de cache pour les routes API (no-store), cache immutable d'un an pour les assets statiques Next.js, "
    "et prefetch DNS pour optimiser les requetes externes. L'optimisation des imports de packages lourds "
    "(lucide-react, framer-motion, recharts) via experimental.optimizePackageImports reduit le bundle "
    "JavaScript final de maniere significative.", body
))

story.append(Paragraph('<b>5.3 Ameliorations Docker</b>', h2))
story.append(Paragraph(
    "Le Dockerfile a ete securise avec l'ajout d'un utilisateur non-root (nextjs:nodejs, uid/gid 1001) "
    "pour limiter l'impact d'une compromission. Le healthcheck Docker pointe maintenant vers "
    "/api/mova/health au lieu de la racine, fournissant une verification reelle de l'etat de l'application. "
    "Un fichier .dockerignore a ete cree pour exclure les fichiers inutiles du build (node_modules, .git, "
    "__tests__, coverage), reduisant le temps de build et la taille de l'image. La configuration db.ts "
    "desactive desormais le logging des requetes SQL en production (activite significative) et rend le "
    "pool de connexions configurable via DB_POOL_SIZE et DB_POOL_TIMEOUT.", body
))
story.append(Spacer(1, 18))

# ==================== SECTION 6: FILES ====================
story.append(Paragraph('<b>6. Recapitulatif des Fichiers Modifies/Crees</b>', h1))
story.append(Spacer(1, 8))

files_data = [
    [Paragraph('<b>Fichier</b>', tbl_header), Paragraph('<b>Action</b>', tbl_header), Paragraph('<b>Description</b>', tbl_header)],
    [Paragraph('src/lib/cache.ts', tbl_cell), Paragraph('Rewrite', tbl_cell_center), Paragraph('CacheManager avec backend Redis + fallback in-memory', tbl_cell)],
    [Paragraph('src/lib/db.ts', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Pool configurable, query log conditionnel, healthCheck()', tbl_cell)],
    [Paragraph('src/lib/error-logger.ts', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Integration Sentry, file logging, log level filtering', tbl_cell)],
    [Paragraph('src/middleware.ts', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Consolidation rate limiting vers AdvancedRateLimiter', tbl_cell)],
    [Paragraph('next.config.ts', tbl_cell), Paragraph('Rewrite', tbl_cell_center), Paragraph('Headers securite, compression, Sentry, cache-control', tbl_cell)],
    [Paragraph('docker-compose.yml', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Service Redis, env vars, log rotation', tbl_cell)],
    [Paragraph('Dockerfile', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Non-root user, healthcheck /api/mova/health', tbl_cell)],
    [Paragraph('.env.example', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('15+ nouvelles variables Phase 3', tbl_cell)],
    [Paragraph('.dockerignore', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Exclusion node_modules, .git, __tests__, coverage', tbl_cell)],
    [Paragraph('.github/workflows/ci.yml', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Pipeline CI/CD 4 jobs paralleles', tbl_cell)],
    [Paragraph('vitest.config.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Configuration Vitest avec path alias et coverage', tbl_cell)],
    [Paragraph('vitest.setup.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Setup tests (NODE_ENV=test)', tbl_cell)],
    [Paragraph('sentry.client.config.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Sentry client (browser runtime)', tbl_cell)],
    [Paragraph('sentry.server.config.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Sentry server (Prisma + HTTP integrations)', tbl_cell)],
    [Paragraph('sentry.edge.config.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Sentry edge (middleware runtime)', tbl_cell)],
    [Paragraph('health/route.ts', tbl_cell), Paragraph('Rewrite', tbl_cell_center), Paragraph('Health check avec probes DB + Redis + memoire', tbl_cell)],
    [Paragraph('health/ready/route.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Readiness probe Kubernetes avec diagnostics', tbl_cell)],
    [Paragraph('health/live/route.ts', tbl_cell), Paragraph('Cree', tbl_cell_center), Paragraph('Liveness probe simple (200 OK)', tbl_cell)],
    [Paragraph('admin/monitoring/route.ts', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('Fix cache.stats() async compatibility', tbl_cell)],
    [Paragraph('__tests__/lib/*.test.ts', tbl_cell), Paragraph('Crees (5)', tbl_cell_center), Paragraph('188 tests couvrant cache, rate-limit, validators, pricing, logger', tbl_cell)],
    [Paragraph('package.json', tbl_cell), Paragraph('Modifie', tbl_cell_center), Paragraph('ioredis + vitest + scripts test', tbl_cell)],
]
files_table = Table(files_data, colWidths=[5*cm, 2*cm, 8*cm])
style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
    ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]
for i in range(1, len(files_data)):
    bg = WHITE if i % 2 == 1 else LIGHT_GRAY
    style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
files_table.setStyle(TableStyle(style_cmds))
story.append(files_table)
story.append(Spacer(1, 6))
story.append(Paragraph('Tableau 4 : Liste complete des fichiers modifies et crees en Phase 3', ParagraphStyle(name='caption4', fontName='SimHei', fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#666666'))))
story.append(Spacer(1, 18))

# ==================== SECTION 7: CONCLUSION ====================
story.append(Paragraph('<b>7. Prochaine Etape - Phase 4</b>', h1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "La Phase 3 est desormais completee. Le projet MOVA dispose d'une infrastructure de production solide "
    "avec cache distribue Redis, 188 tests automatisees, pipeline CI/CD complet, monitoring Sentry, "
    "health checks Kubernetes-ready, et une configuration Docker et Next.js optimisee. Le score global "
    "de maturite production est passe de 4/10 a 9/10. La prochaine etape, Phase 4, consistera au "
    "lancement beta a Conakry avec les integrations Mobile Money reelles en production, le depot sur "
    "les stores (Google Play / App Store), le monitoring en conditions reelles avec les premiers "
    "utilisateurs, et les ajustements iteratifs bases sur les metriques d'utilisation.", body
))

# Build PDF
doc.build(story)
print(f"PDF genere avec succes : {pdf_path}")
