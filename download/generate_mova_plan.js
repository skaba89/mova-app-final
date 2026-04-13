const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, LevelFormat, PageBreak,
} = require("docx");
const fs = require("fs");

// ── Palette: GO-1 Graphite Orange (proposal / plan) ──
const P = {
  primary: "1A2330",
  body: "000000",
  secondary: "506070",
  accent: "D4875A",
  surface: "F8F0EB",
};
const c = (hex) => hex.replace("#", "");
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Helper functions ──
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function bodyNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}
function emptyLine() {
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: [] });
}

function makeTable(headers, rows) {
  const tHeaderBg = c(P.accent);
  const tHeaderText = "FFFFFF";
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDD0C8" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(h =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: tHeaderText })] })],
            shading: { type: ShadingType.CLEAR, fill: tHeaderBg },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          })
        ),
      }),
      ...rows.map((row, idx) =>
        new TableRow({
          cantSplit: true,
          children: row.map(cell =>
            new TableCell({
              children: [new Paragraph({
                spacing: { line: 280 },
                children: [new TextRun({ text: cell, size: 20, color: c(P.body) })],
              })],
              shading: idx % 2 === 0
                ? { type: ShadingType.CLEAR, fill: c(P.surface) }
                : { type: ShadingType.CLEAR, fill: "FFFFFF" },
              margins: { top: 50, bottom: 50, left: 120, right: 120 },
            })
          ),
        })
      ),
    ],
  });
}

// ── Cover Recipe R1 ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  const breakAfter = new Set([...',,;:!?...', ...'-_ \t']);
  function splitTitleLines(title, cpl) {
    if (title.length <= cpl) return [title];
    const lines = [];
    let remaining = title;
    while (remaining.length > cpl) {
      let breakAt = -1;
      for (let i = cpl; i >= Math.floor(cpl * 0.6); i--) {
        if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
      if (breakAt === -1) {
        const limit = Math.min(remaining.length, Math.ceil(cpl * 1.3));
        for (let i = cpl + 1; i < limit; i++) {
          if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
        }
      }
      if (breakAt === -1) breakAt = cpl;
      lines.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    if (remaining) lines.push(remaining);
    if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
      lines[lines.length - 2] += lines.pop();
    }
    return lines;
  }
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800 } = params;
  const SAFETY = 1200;
  const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, bottomSpacing };
}

function buildCoverR1(config) {
  const palette = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle,
    hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: palette.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: palette.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel, size: 18, color: palette.accent,
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: palette.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: palette.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: palette.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: palette.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: palette.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                                    " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: palette.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return new Table({
    borders: allNoBorders,
    width: { size: 11906, type: WidthType.DXA },
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        width: { size: 11906, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: config.palette.bg },
        verticalAlign: "top",
        borders: allNoBorders,
        children,
      })],
    })],
  });
}

// ── Cover config ──
const coverPalette = {
  bg: "1A2330",
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  accent: "D4875A",
  footerColor: "687078",
};

const coverConfig = {
  title: "Plan de Migration Module par Module",
  subtitle: "MOVA Super-App - Conakry, Guinee",
  englishLabel: "T E C H N I C A L   P L A N",
  metaLines: [
    "Version 2.0 | 13 avril 2026",
    "6 modules : Ride, Food, Courier, Partenaires, Chauffeur, Paiements",
    "Strategie : Risque minimal, flux preserves, non-regression",
  ],
  footerLeft: "MOVA Technologies",
  footerRight: "Confidentiel",
  palette: coverPalette,
};

// ── Page numbering footer ──
function pageNumFooter(fmt) {
  const instrText = fmt === "roman" ? "PAGE \\* ROMAN \\* MERGEFORMAT" : "PAGE \\* arabic \\* MERGEFORMAT";
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })],
    })],
  });
}

// ── BODY CONTENT ──
const bodyContent = [];

// ═══════════════════════════════════════════
// EXECUTIVE SUMMARY
// ═══════════════════════════════════════════
bodyContent.push(h1("Resume executif"));
bodyContent.push(body("Ce document presente le plan de migration module par module pour la super-application MOVA, plateforme de mobilite et services urbains deployee a Conakry, Guinee. L'objectif est de passer du schema Prisma simplifie actuel (20 modeles) au schema complet cible (35 modeles, 23 enums) tout en preservant les flux existants, en minimisant les risques de regression et en documentant chaque modification de maniere exhaustive. La plateforme couvre six verticalites principales : transport de personnes (Ride), livraison de repas et courses (Food/Grocery), livraison de colis (Courier/Delivery), portails partenaires (restaurants et commercants), application chauffeur/coursier, et l'ensemble des services transverses (paiements, portefeuille, promotions, support, securite, analytics)."));
bodyContent.push(body("Chaque module est traite individuellement avec une approche en quatre phases : (1) diagnostic de l'etat actuel incluant l'inventaire complet des fichiers touches, (2) identification et classification des risques par niveau de criticite, (3) description detaillee de la strategie de migration avec les etapes precises, et (4) plan de verification de non-regression avec les tests cles a executer. Cette approche incremental et defensive permet de valider chaque module independamment avant de passer au suivant, reduisant ainsi la surface d'impact en cas de probleme. Les deux schemas Prisma coexisteront temporairement pendant la transition, et chaque migration sera validee par un commit Git dedie avec des tests automatises."));
bodyContent.push(body("L'architecture technique repose sur Next.js 16 avec App Router, Prisma ORM v6, une base SQLite pour le developpement (cible PostgreSQL pour la production), un systeme d'authentification JWT via jose, une couche de cache Redis avec fallback en memoire, et un etat client gere par Zustand. La plateforme dispose actuellement de 35 routes API, 20 vues frontend, 9 utilitaires de bibliotheque et environ 16 000 lignes de code applicatif. Le plan ci-dessous s'inscrit dans la continuite des corrections de bugs P0 deja effectuees (commit 43c2477) et vise a consolider chaque verticalite avant toute ajout de fonctionnalite nouvelle."));

// ═══════════════════════════════════════════
// MODULE 1: RIDE
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 1 : Ride (Transport de personnes)"));

bodyContent.push(h2("1.1 Etat actuel et inventaire"));
bodyContent.push(body("Le module Ride constitue la verticalite principale de MOVA. Il dispose d'un cycle de vie complet couvrant la creation de course avec OTP, l'estimation du tarif, l'affectation de chauffeur, le suivi en temps reel et le paiement via wallet. L'ensemble du flux fonctionne actuellement avec le schema simplifie et les routes API suivantes : POST /api/mova/rides (creation), GET /api/mova/rides (liste des courses), GET/PATCH /api/mova/rides/[id] (detail et machine a etats), GET /api/mova/fare (estimation publique), ainsi que les variantes moto, covoiturage et reservations programmees. Les corrections P0 deja appliquees ont restaure les fonctions estimateFare() et corrige les erreurs d'authentification sur les routes rides."));

bodyContent.push(makeTable(
  ["Categorie", "Fichier", "Statut", "Impact migration"],
  [
    ["API", "app/api/mova/rides/route.ts", "Operationnel", "Migration enums + champs Ride"],
    ["API", "app/api/mova/rides/[id]/route.ts", "Operationnel", "Machine a etats a enrichir"],
    ["API", "app/api/mova/fare/route.ts", "Operationnel", "FareRule a integrer"],
    ["API", "app/api/mova/moto/route.ts", "Operationnel", "Sous-type Ride existant"],
    ["API", "app/api/mova/carpool/route.ts", "Operationnel", "ScheduledRide a lier"],
    ["API", "app/api/mova/bookings/route.ts", "Operationnel", "Booking deja dans schema cible"],
    ["API", "app/api/mova/bookings/[id]/route.ts", "Operationnel", "Aucun changement majeur"],
    ["Frontend", "components/mova/rides-view.tsx", "Operationnel", "Zone selector + fare call"],
    ["Lib", "lib/mova/zone-distances.ts", "Corrige (P0)", "FareRule a deprecier"],
    ["Schema", "prisma/schema.prisma", "20 modeles", "Vers schema complet"],
    ["Schema", "prisma-schema/schema.prisma", "35 modeles", "Schema cible"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("1.2 Risques identifies"));
bodyContent.push(body("Le risque principal de la migration du module Ride reside dans la difference entre les enums RideStatus du schema simplifie et du schema complet. Le schema cible contient 15 valeurs d'enum (requested, accepted, arrived, in_progress, completed, cancelled, no_show, driver_cancelled, passenger_cancelled, scheduled, repositioning, waiting, paused, emergency_stop, refunded) alors que le code actuel ne manipule qu'un sous-ensemble. L'introduction de nouveaux statuts comme repositioning, paused et emergency_stop necessite une mise a jour de la machine a etats dans rides/[id]/route.ts sans casser les transitions existantes."));
bodyContent.push(body("Le deuxieme risque concerne la dualite des tables de tarification. Le schema actuel utilise des constantes dans zone-distances.ts (VEHICLE_FARES) tandis que le schema cible definit un modele FareRule en base de donnees. La migration doit se faire de maniere retro-compatible pour ne pas casser les estimations de tarif en cours. Le troisieme risque porte sur les liaisons avec DriverProfile et Vehicle qui changent de structure : DriverProfile perd certains champs au profit de la relation Vehicle, et les earnings doivent maintenant transiter par le modele DriverEarnings au lieu d'etre calcules dynamiquement."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["Enum RideStatus elargi", "Critique", "Machine a etats cassee", "Approche additive : nouveaux statuts en plus, sans suppression"],
    ["Dualite FareRule / VEHICLE_FARES", "Eleve", "Estimations incorrectes", "Phase 1 : FareRule en lecture seule ; Phase 2 : deprecier constantes"],
    ["Relation DriverProfile/Vehicle modifiee", "Moyen", "Requetes chauffeur cassees", "Migration Prisma avec data-mapping automatise"],
    ["DriverEarnings nouveau modele", "Moyen", "Calculs de revenus absents", "Creer un service d'aggregation en attendant"],
    ["Champs otp / paymentStatus", "Faible", "Deja geres dans les deux schemas", "Verification croisee uniquement"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("1.3 Strategie de migration"));
bodyContent.push(body("La migration du module Ride suivra une approche en trois phases distinctes. La premiere phase, dite de compatibilite, consiste a aligner le schema Prisma simplifie avec le schema cible en ajoutant progressivement les nouveaux champs et enums sans supprimer les existants. Cela signifie que le modele Ride dans prisma/schema.prisma sera enrichi avec les nouveaux statuts de RideStatus, les champs manquants comme scheduledAt et emergencyContact, et les relations vers DriverEarnings et SOSAlert. Le code existant continuera de fonctionner sans modification car les nouvelles valeurs d'enum sont purement additives."));
bodyContent.push(body("La deuxieme phase porte sur la refonte de la tarification. Le modele FareRule du schema cible remplacera progressivement les constantes en dur de zone-distances.ts. La fonction estimateFare() sera modifiee pour interroger d'abord FareRule en base, avec un fallback sur les constantes existantes si aucune regle n'est trouvee. Cela garantit que les estimations continuent de fonctionner pendant la periode de transition. Le troisieme axe de cette phase est l'integration du modele ScheduledRide qui remplacera le champ scheduledAt de Ride pour les courses programmees, avec une migration des donnees existantes."));
bodyContent.push(body("La troisieme phase est celle de l'optimisation avancee. Elle inclut l'integration du modele SOSAlert pour les alertes d'urgence pendant les courses, la mise en place du modele ChatMessage pour la messagerie passager-chauffeur, et la creation du service DriverEarnings pour le suivi des revenus. Chacune de ces fonctionnalites sera developpee dans une branche dediee, fusionnee apres validation des tests de non-regression sur les flux existants."));

bodyContent.push(h2("1.4 Plan de non-regression"));
bodyContent.push(body("La verification de non-regression pour le module Ride s'articule autour de quatre axes de test. Premierement, les tests fonctionnels de bout en bout : creation de course (POST /rides avec toutes les combinaisons de vehicleType), estimation tarif (GET /fare pour chaque paire de zones), machine a etats complete (sequence requested, accepted, arrived, in_progress, completed), et annulation a chaque etape. Deuxiemement, les tests de compatibilite : verification que les courses creees avant la migration restent accessibles et lisibles, que les OTP generes continuent de se valider, et que les paiements via wallet fonctionnent comme avant."));
bodyContent.push(body("Troisiemement, les tests de performance : le temps de reponse de l'estimation tarif ne doit pas augmenter de plus de 50ms par rapport a la version actuelle, et le nombre de requetes Prisma par creation de course ne doit pas augmenter de plus de deux. Quatriemement, les tests de securite : verification que les guards requireAuth fonctionnent sur toutes les routes, que les permissions passager/chauffeur/admin sont correctement enforcees, et que les donnees d'un utilisateur ne sont accessibles que par lui-meme ou par un admin. Chaque test sera automatise dans un script de validation execute avant chaque commit de migration."));

// ═══════════════════════════════════════════
// MODULE 2: FOOD / GROCERY
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 2 : Food / Grocery (Livraison de repas)"));

bodyContent.push(h2("2.1 Etat actuel et inventaire"));
bodyContent.push(body("Le module Food dispose d'un flux complet allant de la decouverte de restaurant a la livraison du repas. L'experience utilisateur actuelle comprend quatre vues connectees : food-view (liste des restaurants avec filtres), restaurant-view (detail avec menu categorise), foodcart-view (panier et passage de commande), et foodtracking-view (suivi de la commande). Cote API, les routes couvrent la gestion des commandes (POST/GET /food, GET/PATCH /food/[id]) et les restaurants (GET /food/restaurants et /food/restaurants/[id]). Le schema cible enrichit significativement ce module avec les modeles MenuItem, Rating, et des statuts de commande plus granulaires."));

bodyContent.push(makeTable(
  ["Categorie", "Fichier", "Statut", "Impact migration"],
  [
    ["API", "app/api/mova/food/route.ts", "Operationnel", "Enum FoodOrderStatus elargi"],
    ["API", "app/api/mova/food/[id]/route.ts", "Operationnel", "Machine a etats a enrichir"],
    ["API", "app/api/mova/food/restaurants/route.ts", "Public", "Filtre isOpen a revoir"],
    ["API", "app/api/mova/food/restaurants/[id]/route.ts", "Public", "Menu + categorie a valider"],
    ["Frontend", "components/mova/food-view.tsx", "Operationnel", "Recherche et filtres"],
    ["Frontend", "components/mova/restaurant-view.tsx", "Operationnel", "Add-to-cart via Zustand"],
    ["Frontend", "components/mova/foodcart-view.tsx", "Operationnel (P0 corrige)", "Items JSON a valider"],
    ["Frontend", "components/mova/foodtracking-view.tsx", "Operationnel", "Polling status"],
    ["Lib", "lib/mova/store.ts", "Operationnel", "foodCart state Zustand"],
    ["Schema", "Modele Restaurant", "Simplifie", "OperatingHours JSON a valider"],
    ["Schema", "Modele MenuItem", "Absent", "Nouveau modele cible"],
    ["Schema", "Modele Rating", "Absent", "Nouveau modele cible"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("2.2 Risques identifies"));
bodyContent.push(body("Le risque principal du module Food est l'elargissement de l'enum FoodOrderStatus. Le schema cible passe de 9 statuts (pending, confirmed, preparing, ready, picked_up, in_transit, delivered, cancelled, refused) a 15 statuts en ajoutant delayed, refund_requested, refunded, partial_refund, driver_assigned et restaurant_accepted. Chaque nouveau statut doit etre integre dans la machine a etats de food/[id]/route.ts sans casser les transitions existantes. Le statut restaurant_accepted est particulierement sensible car il introduit une etape de validation cote restaurant qui n'existait pas auparavant, ce qui peut affecter le workflow de commande si les restaurants ne sont pas prets."));
bodyContent.push(body("Le deuxieme risque concerne le modele MenuItem qui remplace le champ items du schema simplifie. Actuellement, les items d'une commande sont stockes sous forme de JSON dans le champ items de FoodOrder. Le schema cible definit un modele MenuItem separe lie a Restaurant, et la commande doit reference ces items. La migration doit gerer la conversion des donnees JSON existantes vers le nouveau modele relationnel, tout en preservant la capacite a recreer le contenu d'une commande historique. Le troisieme risque porte sur les operatingHours du restaurant, stockes en JSON, qui doivent etre valides et coherents avec le filtre isOpen deja utilise dans l'API."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["FoodOrderStatus elargi a 15 valeurs", "Critique", "Workflows de commande casses", "Additif pur : nouveaux statuts sans suppression des anciens"],
    ["MenuItem remplace items JSON", "Eleve", "Commandes historiques illisibles", "Migration JSON vers relationnel avec snapshot dans FoodOrder"],
    ["restaurant_accepted nouveau", "Moyen", "Delai de confirmation restaurant", "Optionnel en Phase 1, obligatoire en Phase 2"],
    ["OperatingHours validation", "Moyen", "Filtre isOpen incorrect", "Schema Zod de validation des horaires JSON"],
    ["DriverEarnings pour food", "Faible", "Revenus livraison repas", "Partage du modele DriverEarnings existant"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("2.3 Strategie de migration"));
bodyContent.push(body("La migration du module Food sera conduite en trois phases successives. La phase initiale se concentre sur l'enrichissement progressif du schema FoodOrder. L'enum FoodOrderStatus sera etendu avec les six nouvelles valeurs, mais la machine a etats dans food/[id]/route.ts ne les activera pas immediatement. Cela signifie qu'une commande continuera de suivre le flux actuel (pending, confirmed, preparing, ready, picked_up, in_transit, delivered) tandis que les nouveaux statuts seront disponibles pour les futures integrations. Le modele MenuItem sera cree avec une migration de donnees depuis le JSON de FoodOrder, et le champ items sera maintenu en tant que snapshot pour les commandes historiques."));
bodyContent.push(body("La phase intermediaire porte sur l'integration du modele Rating. Actuellement, aucune route ne permet de noter une commande. Le schema cible definit un modele Rating polymorphique (liable a Ride, FoodOrder ou Delivery) avec un score et un commentaire. Les routes PATCH /food/[id] et /rides/[id] seront enrichies pour accepter une notation lors du passage au statut completed. Le frontend foodtracking-view et rides-view afficheront un formulaire de notation apres completion. Le modele MenuItem sera egalement enrichi avec les champs isPopular et isAvailable pour permettre le filtrage avance dans l'API restaurants."));
bodyContent.push(body("La phase finale aborde l'optimisation avancee du module Food. Elle inclut l'activation du statut restaurant_accepted dans le workflow de commande, la mise en place du calcul automatique des revenus livreurs via DriverEarnings pour les commandes food, et l'implementation du systeme de remboursement (refund_requested, refunded, partial_refund) avec un workflow d'approbation admin. Les operatingHours seront enrichis avec des heures exceptionnelles (jours feri, evenements speciaux) et la recherche de restaurants sera amelioree avec la recherche par categorie de plat et par tags."));

bodyContent.push(h2("2.4 Plan de non-regression"));
bodyContent.push(body("Les tests de non-regression pour le module Food couvrent quatre dimensions. En termes de flux fonctionnel, on verifiera le parcours complet : liste de restaurants avec recherche et filtres, selection d'un restaurant, ajout d'items au panier, passage de commande avec paiement wallet, suivi en temps reel, et reception. Pour chaque statut de la machine a etats, on testera la transition vers le statut suivant et la rejection des transitions illegales. On verifiera egalement que le panier Zustand fonctionne correctement apres migration du modele MenuItem."));
bodyContent.push(body("En termes de donnees, on s'assurera que les commandes creees avant la migration restent accessibles avec leur contenu JSON intact. Les nouvelles commandes devront utiliser le modele MenuItem tout en conservant le snapshot JSON pour compatibilite. Les tests de performance verifieront que le temps de chargement de la liste des restaurants n'augmente pas de plus de 20ms apres l'ajout du modele MenuItem et des filtres avances. Enfin, les tests de securite garantiront que les commandes d'un utilisateur ne sont accessibles que par lui-meme et par l'admin, que les routes publiques de restaurants ne revelent aucune donnee sensible, et que le OTP de livraison reste securise."));

// ═══════════════════════════════════════════
// MODULE 3: COURIER / DELIVERY
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 3 : Courier / Delivery (Livraison de colis)"));

bodyContent.push(h2("3.1 Etat actuel et inventaire"));
bodyContent.push(body("Le module Courier permet aux utilisateurs d'envoyer des colis entre deux zones de Conakry avec suivi OTP. Le flux actuel est plus simple que le module Ride car il ne comporte pas d'estimation tarifaire dynamique, mais il inclut des informations specifiques comme le type de colis, le poids, la valeur declaree et les coordonnees du destinataire. L'API comprend deux routes principales : POST/GET /api/mova/deliveries pour la creation et la liste, et GET/PATCH /api/mova/deliveries/[id] pour le detail et la machine a etats. Le schema cible ajoute les statuts returned et delayed a l'enum DeliveryStatus et introduit les relations avec Rating, DriverEarnings et Incident."));

bodyContent.push(makeTable(
  ["Categorie", "Fichier", "Statut", "Impact migration"],
  [
    ["API", "app/api/mova/deliveries/route.ts", "Operationnel", "Enum DeliveryStatus elargi"],
    ["API", "app/api/mova/deliveries/[id]/route.ts", "Operationnel", "Nouveaux statuts returned/delayed"],
    ["Frontend", "components/mova/deliveries-view.tsx", "Operationnel", "Creation + suivi colis"],
    ["Schema", "Modele Delivery", "Present", "Champs supplementaires cible"],
    ["Schema", "Modele Rating", "Absent", "Notation coursier"],
    ["Schema", "Modele DriverEarnings", "Absent", "Revenus coursier"],
    ["Schema", "Modele Incident", "Absent", "Signalements livraison"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("3.2 Risques identifies"));
bodyContent.push(body("Le module Courier presente un risque modere car le schema actuel et le schema cible sont relativement proches. Le risque principal est l'introduction des statuts returned et delayed dans l'enum DeliveryStatus. Le statut returned est particulierement complexe car il implique un retour physique du colis a l'expediteur, avec une remboursement potentiel et une mise a jour du statut de paiement. Le statut delayed necessite la gestion d'une notification au destinataire et un suivi supplementaire. Ces deux statuts doivent etre ajoutes de maniere additive sans modifier les transitions existantes (pending, accepted, picked_up, in_transit, delivered, cancelled, failed)."));
bodyContent.push(body("Un deuxieme risque concerne le champ otp du modele Delivery. Actuellement, l'OTP est genere a la creation et valide a la livraison. Avec l'introduction du statut returned, l'OTP doit egalement etre valide lors du retour. La logique de validation OTP dans deliveries/[id]/route.ts doit etre mise a jour pour accepter la verification dans les deux cas. Enfin, le troisieme risque porte sur l'estimation du prix de livraison qui est actuellement calculee cote client. Le schema cible prevoit un champ estimatedPrice qui doit etre enrichi avec une logique de calcul cote serveur basee sur la distance, le poids et le type de colis."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["Statuts returned / delayed", "Eleve", "Workflows de retour complexes", "Implementation separee, validation OTP double"],
    ["Estimation prix cote serveur", "Moyen", "Tarification incoherente", "Reutilisation logique FareRule adaptee"],
    ["OTP double validation", "Moyen", "Securite de livraison", "OTP unique avec deux contexts de validation"],
    ["DriverEarnings pour deliveries", "Faible", "Suivi revenus coursier", "Partage modele existant"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("3.3 Strategie de migration"));
bodyContent.push(body("La migration du module Courier sera conduite en deux phases. La premiere phase ajoute les nouveaux statuts returned et delayed a l'enum DeliveryStatus de maniere additive. La machine a etats dans deliveries/[id]/route.ts sera mise a jour pour supporter les transitions supplementaires : in_transit peut passer a delayed ou delivered, et delivered peut passer a returned (dans un delai defini). La logique de validation OTP sera modifiee pour verifier le code dans les contextes de livraison et de retour, avec un champ otpValidatedAt pour tracer la derniere validation."));
bodyContent.push(body("La seconde phase implemente le calcul de prix cote serveur. Une nouvelle fonction estimateDeliveryPrice() sera creee dans zone-distances.ts, basee sur la distance entre les zones, le poids du colis et le type de colis. Cette fonction sera appelee lors de la creation de la livraison (POST /deliveries) pour pre-remplir le champ estimatedPrice, tout en permettant au livreur de confirmer ou ajuster le prix final. Le modele DriverEarnings sera utilise pour suivre les revenus du coursier sur chaque livraison terminee, avec les memes mecanismes que pour les courses Ride et les commandes Food."));

bodyContent.push(h2("3.4 Plan de non-regression"));
bodyContent.push(body("Les tests de non-regression pour le module Courier couvrent trois axes principaux. Le premier est le flux de livraison standard : creation d'une livraison avec tous les champs, sequence complete de statuts (pending, accepted, picked_up, in_transit, delivered), validation OTP a la livraison, et annulation a chaque etape possible. Le deuxieme est le flux de retour : creation d'une livraison, livraison initiale, puis declenchement du retour avec validation OTP au retour. On verifiera que le remboursement est correctement declenche si un paiement wallet a ete effectue. Le troisieme axe est la performance : le temps de reponse de la creation de livraison ne doit pas augmenter de plus de 30ms avec l'ajout de l'estimation de prix cote serveur."));

// ═══════════════════════════════════════════
// MODULE 4: PORTAILS PARTENAIRES
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 4 : Portails Partenaires (Restaurants et Commercants)"));

bodyContent.push(h2("4.1 Etat actuel et inventaire"));
bodyContent.push(body("Le module Portails Partenaires est actuellement le moins developpe de la plateforme MOVA. Seule une route API existe (POST/GET /api/mova/business) permettant de creer et lister des comptes entreprises, mais aucune vue frontend n'est encore implementee. Le schema cible definit deux modeles cles : BusinessAccount (avec statut, plan d'abonnement, limite mensuelle) et BusinessEmployee (avec role et limite individuelle). Le schema cible prevoit egalement le modele Restaurant qui est deja partiellement utilise par le module Food, mais sans interface de gestion cote partenaire."));
bodyContent.push(body("L'absence de portail partenaire constitue un manque fonctionnel majeur car les restaurants ne peuvent pas gerer leur menu, leurs horaires, ni leurs commandes en temps reel. Actuellement, toutes les operations de gestion restaurant sont effectuees par l'admin via des requetes directes a la base de donnees. Le schema cible corrige cela avec une architecture multi-tenant ou chaque restaurant (Restaurant) et chaque commerce (lie a BusinessAccount) dispose de son propre espace de gestion. Le modele BusinessEmployee permet de gerer les droits d'acces au sein d'une meme entreprise."));

bodyContent.push(makeTable(
  ["Categorie", "Fichier", "Statut", "Impact migration"],
  [
    ["API", "app/api/mova/business/route.ts", "Operationnel", "BusinessAccount + BusinessEmployee"],
    ["Frontend", "Vue portail partenaire", "Absente", "Creation complete necessaire"],
    ["Frontend", "Vue gestion restaurant", "Absente", "Creation complete necessaire"],
    ["Schema", "Modele BusinessAccount", "Partiel", "SubscriptionPlan, monthlyLimit"],
    ["Schema", "Modele BusinessEmployee", "Absent", "Role, monthlyLimit, uniqueness"],
    ["Schema", "Modele Restaurant", "Partiel", "OperatingHours, menu management"],
    ["Schema", "Modele MenuItem", "Absent", "Creation et gestion par partenaire"],
    ["Schema", "Modele MarketplaceListing", "Absent", "Marketplace c/o commercants"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("4.2 Risques identifies"));
bodyContent.push(body("Le risque majeur de ce module est son etat d'inachevement. Contrairement aux modules Ride, Food et Courier qui disposent de flux complets, le portail partenaire necessite la creation de nouvelles routes API et de nouvelles vues frontend, ce qui augmente la surface de regression potentielle. Le premier risque est la multiplication des roles : le schema cible definit UserRole avec compte_entreprise en plus des roles existants, ce qui impose une mise a jour du middleware d'authentification (requireRole) pour gerer les permissions specifiques aux partenaires."));
bodyContent.push(body("Le deuxieme risque concerne l'architecture multi-tenant. Les restaurants et commercants doivent avoir acces uniquement a leurs propres donnees (menu, commandes, revenus), ce qui necessite l'ajout de filtres ownerId sur toutes les requetes. Si ces filtres sont oublies, un partenaire pourrait acceder aux donnees d'un autre partenaire, ce qui constitue une faille de securite critique. Le troisieme risque porte sur le modele MarketplaceListing qui prevoit un marche en ligne pour les commercants. Ce modele est entierement nouveau et n'a aucun equivalent dans le code actuel, ce qui signifie que son integration est un developpement from scratch avec un risque d'incompatibilite eleve."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["Creation de nouvelles routes", "Eleve", "Bugs potentiels importants", "Developpement TDD avec tests unitaires"],
    ["Multi-tenant isolation", "Critique", "Fuite de donnees entre partenaires", "Filtre ownerId obligatoire sur chaque requete"],
    ["Nouveau role compte_entreprise", "Eleve", "Permissions incorrectes", "Mise a jour requireRole avec tests matrix"],
    ["MarketplaceListing from scratch", "Moyen", "Delai et qualite", "MVP minimal, validation iterative"],
    ["Absence de portail frontend", "Moyen", "UX partenaire degradee", "Interface admin temporaire en attendant"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("4.3 Strategie de migration"));
bodyContent.push(body("La strategie pour le module Portails Partenaires adopte une approche en deux volets paralleles. Le premier volet consolide le backend existant. La route business/route.ts sera enrichie pour supporter le cycle de vie complet de BusinessAccount : creation avec ajout automatique du createur en tant qu'employe admin, activation et suspension de compte, gestion des abonnements (free, basic, premium, enterprise), et suivi des limites mensuelles. Le modele BusinessEmployee sera cree avec une contrainte d'unicite sur (businessAccountId, userId) pour eviter les doublons. Le middleware requireRole sera mis a jour pour accepter le nouveau role compte_entreprise et ses permissions specifiques."));
bodyContent.push(body("Le second volet cree les interfaces de gestion. Dans un premier temps, une interface admin temporaire sera ajoutee au tableau de bord admin-monitoring-view pour gerer les restaurants et les comptes entreprises. Cette interface permettra de creer des restaurants, de modifier leurs menus et leurs horaires, et de suivre leurs performances sans necessiter un portail partenaire dedie. Dans un deuxieme temps, un portail partenaire autonome sera developpe avec des vues dediees : gestion du menu (ajout/modification/suppression de MenuItem), suivi des commandes en temps reel, consultation des revenus, et gestion des employes. Le modele MarketplaceListing sera traite dans une phase ulterieure comme un module independant."));

bodyContent.push(h2("4.4 Plan de non-regression"));
bodyContent.push(body("Les tests de non-regression pour ce module sont particulierement critiques car le portail partenaire touche au systeme d'authentification et aux permissions. Premierement, on verifiera que les routes existantes (rides, food, deliveries, wallet) continuent de fonctionner avec les roles existants (client, chauffeur, admin) apres l'ajout du role compte_entreprise. Deuxiemement, on testera l'isolation multi-tenant : creation de deux comptes entreprises, ajout de restaurants et d'employes dans chaque compte, et verification que chaque employe n'a acces qu'aux donnees de son entreprise. Troisiemement, on validera les limites mensuelles : creation de commandes jusqu'a la limite mensuelle, verification que la limite est respectee, et test du renouvellement mensuel."));

// ═══════════════════════════════════════════
// MODULE 5: APP CHAUFFEUR / COURSIER
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 5 : Application Chauffeur / Coursier"));

bodyContent.push(h2("5.1 Etat actuel et inventaire"));
bodyContent.push(body("L'application chauffeur/coursier est actuellement reduite a deux routes API (GET /drivers et GET/PATCH /drivers/[id]) permettant de lister les chauffeurs, de consulter leur profil et de modifier leur statut en ligne/hors ligne et leur zone de couverture. Aucune interface frontend dediee n'existe pour les chauffeurs et coursiers. L'ensemble des interactions chauffeur passe actuellement par l'interface admin ou par des requetes directes a la base de donnees. Le schema cible definit un modele DriverProfile complet avec les relations vers Vehicle, DriverDocument, DriverEarnings, et les associations avec Ride, FoodOrder et Delivery."));
bodyContent.push(body("Le schema cible enrichit significativement le profil chauffeur avec des documents de verification (DriverDocument : permis, assurance, controle technique), un suivi des revenus detaille (DriverEarnings avec frais de plateforme et revenu net par course/livraison), et des statistiques de performance (rating, totalEarnings, completedRides). L'absence d'application chauffeur est un frein operationnel majeur car tout doit passer par l'admin, ce qui ne scale pas avec la croissance de la plateforme. Le chauffeur ne peut pas non plus consulter ses revenus, ses documents ou ses performances en autonomie."));

bodyContent.push(makeTable(
  ["Categorie", "Fichier", "Statut", "Impact migration"],
  [
    ["API", "app/api/mova/drivers/route.ts", "Operationnel", "Filtres avances, stats"],
    ["API", "app/api/mova/drivers/[id]/route.ts", "Operationnel", "Gestion documents, earnings"],
    ["Frontend", "Vue chauffeur/coursier", "Absente", "Creation complete necessaire"],
    ["Schema", "Modele DriverProfile", "Partiel", "Enrichissement complet"],
    ["Schema", "Modele Vehicle", "Partiel", "Liens vers Ride + DriverProfile"],
    ["Schema", "Modele DriverDocument", "Absent", "Verification documents KYC"],
    ["Schema", "Modele DriverEarnings", "Absent", "Suivi revenus detaille"],
    ["Schema", "Modele PushSubscription", "Absent", "Notifications push chauffeur"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("5.2 Risques identifies"));
bodyContent.push(body("Le risque principal de ce module est la complexite de l'application chauffeur qui implique de nombreux flux distincts : acceptation/refus de courses, navigation vers le passager, demarrage et fin de course, validation OTP, suivi des revenus, gestion des documents, et notifications push. Chacun de ces flux doit etre developpe et teste individuellement, avec des interactions potentielles entre eux. Par exemple, un chauffeur qui accepte une course doit voir son statut isOnline et sa zone mis a jour, et les notifications push doivent etre envoyees au bon chauffeur pour la bonne course."));
bodyContent.push(body("Le deuxieme risque concerne la dualite chauffeur/coursier. Dans le schema cible, un DriverProfile peut etre a la fois chauffeur de personnes et livreur de colis/repas. Les roles UserRole.chauffeur et UserRole.coursier sont separes, mais le meme profil peut cumuler les deux. Cette dualite complexifie les requetes de recherche de chauffeurs disponibles : un chauffeur en course ne doit pas recevoir de demande de livraison, et inversement. Le troisieme risque porte sur les documents de verification (DriverDocument) qui introduisent un processus de validation KYC. Si ce processus est trop strict, il peut bloquer l'onboarding de nouveaux chauffeurs ; s'il est trop laxiste, il peut compromettre la securite de la plateforme."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["Complexite multi-flux chauffeur", "Critique", "Bugs et UX degradee", "Developpement increment par flux"],
    ["Dualite chauffeur/coursier", "Eleve", "Mauvaise affectation de demandes", "Champs specialite sur DriverProfile"],
    ["Processus KYC DriverDocument", "Eleve", "Onboarding bloque ou securite faible", "Workflow configurable par admin"],
    ["Notifications push (PushSubscription)", "Moyen", "Notifications non recues", "Fallback SMS + in-app en attendant"],
    ["Absence totale de frontend chauffeur", "Moyen", "Aucune autonomie chauffeur", "Interface admin temporaire"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("5.3 Strategie de migration"));
bodyContent.push(body("La migration du module Chauffeur/Coursier adopte une approche en trois phases incremenales. La premiere phase consolide le backend et l'interface admin. Les routes drivers seront enrichies avec les filtres avances du schema cible : filtre par type de vehicule, zone, disponibilite, et specialite (chauffeur et/ou coursier). Le modele DriverDocument sera cree pour stocker les documents de verification avec un workflow d'approbation admin. Une interface admin dediee sera ajoutee pour gerer les chauffeurs : approbation/rejet de documents, activation/suspension de compte, et consultation des statistiques de performance. Le modele DriverEarnings sera implemente pour le suivi des revenus avec une aggregation par jour, semaine et mois."));
bodyContent.push(body("La deuxieme phase deploie les notifications en temps reel. Le modele PushSubscription sera cree pour stocker les tokens de notification push des chauffeurs. Les evenements cles (nouvelle course disponible, course acceptee par un autre chauffeur, rappel de course, notification de paiement) declencheront des notifications push via le service de job-queue existant. En cas d'echec de la notification push, un fallback SMS sera utilise, puis une notification in-app lors de la prochaine connexion du chauffeur. Le troisieme axe de cette phase est la mise en place du modele SOSAlert pour les alertes d'urgence declenchees par le chauffeur pendant une course."));
bodyContent.push(body("La troisieme phase est le developpement de l'application chauffeur autonome. Cette application sera integree dans le meme SPA MOVA avec un mode chauffeur active par le role de l'utilisateur connecte. Les vues comprendront : tableau de bord chauffeur (statistiques du jour, revenus, courses en attente), liste des demandes disponibles avec acceptation/refus, suivi de course en cours avec navigation, historique des courses et revenus, gestion des documents, et parametres (zone de couverture, disponibilite). Chaque vue sera developpee dans un composant dedie dans components/mova/ et connectee au routeur Zustand existant."));

bodyContent.push(h2("5.4 Plan de non-regression"));
bodyContent.push(body("Les tests de non-regression pour ce module sont divisibles en quatre categories. Les tests d'integration API verifieront que les routes existantes (GET /drivers, PATCH /drivers/[id]) continuent de fonctionner avec les filtres et parametres actuels apres l'enrichissement du schema. Les tests multi-tenant garantiront qu'un chauffeur ne peut acceder qu'a ses propres donnees (courses, revenus, documents) et non a celles d'un autre chauffeur. Les tests de notifications valideront que les push sont envoyees au bon destinataire pour le bon evenement, avec le fallback SMS en cas d'echec. Enfin, les tests de securite verifieront que les guards requireAuth et requireRole fonctionnent correctement sur toutes les nouvelles routes, et que les documents de verification ne sont accessibles qu'aux admins et au chauffeur concerne."));

// ═══════════════════════════════════════════
// MODULE 6: PAYMENTS / WALLET / PROMOS / SUPPORT / SAFETY / ANALYTICS
// ═══════════════════════════════════════════
bodyContent.push(h1("Module 6 : Paiements, Wallet, Promotions, Support, Securite et Analytics"));

bodyContent.push(h2("6.1 Etat actuel et inventaire"));
bodyContent.push(body("Le module transverse regroupe six sous-systemes critiques pour la plateforme MOVA. Le systeme de paiement est actuellement simule via le wallet interne avec des debits et credits atomiques. Le wallet supporte le rechargement (POST /wallet avec methodes mobile_money, bank_transfer, card) et les transferts pair-a-pair (POST /wallet/transfer avec un plafond de 1M GNF). Les promotions (GET/POST /promotions) gerent des codes promo avec validation d'usage, et les parrainages (GET/POST /referrals) generent des codes MOVA-XXXXXXXX avec suivi des bonus. Le programme de fidelite (GET/POST /loyalty) implemente un systeme de points avec cinq niveaux (bronze, silver, gold, platinum, diamond) et des seuils de progression."));
bodyContent.push(body("Le support est assure par un assistant AI (POST /assistant utilisant z-ai-web-dev-sdk) avec un historique de conversation en memoire. Les incidents sont geres via POST /incidents avec un workflow de signalement et d'enquete. Les notifications (GET/POST /notifications, PATCH /notifications/[id]) supportent les canaux push, SMS, email et in-app. L'admin dispose d'un monitoring systeme (GET /admin/monitoring, GET /admin/audit-logs, GET /analytics) avec des statistiques globales sur la plateforme. Le schema cible enrichit chaque sous-systeme avec de nouvelles fonctionnalites : TransactionStatus pour les paiements, IncidentSeverity et IncidentType pour les incidents, NotificationChannel et NotificationType pour les notifications."));

bodyContent.push(makeTable(
  ["Sous-systeme", "Routes existantes", "Schema cible", "Ecart principal"],
  [
    ["Wallet", "GET/POST /wallet, POST /wallet/transfer", "Wallet + WalletTransaction enrichis", "TransactionStatus en ajout"],
    ["Promotions", "GET/POST /promotions", "Promotion + UserPromotion", "Usage tracking par utilisateur"],
    ["Parrainage", "GET/POST /referrals", "Referral + ReferralStatus", "Workflow de validation"],
    ["Fidelite", "GET/POST /loyalty", "LoyaltyProfile + LoyaltyTransaction", "Transactions de points detaillees"],
    ["Support", "GET/POST /assistant", "Conversation en memoire", "Persistance DB manquante"],
    ["Incidents", "GET/POST /incidents", "Incident + IncidentSeverity/Type", "Workflow d'enquete enrichi"],
    ["Notifications", "GET/POST /notifications", "Notification + PushSubscription", "Multi-canal a consolider"],
    ["Analytics", "GET /analytics", "Stats globales", "Dashboards par module"],
    ["Audit", "GET /admin/audit-logs", "AuditLog enrichi", "Filtres avances"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("6.2 Risques identifies"));
bodyContent.push(body("Ce module transverse presente le risque le plus eleve en termes d'impact car il touche a l'argent (wallet, paiements) et a la confiance des utilisateurs (securite, support, notifications). Le risque financier est preponderant : toute erreur dans la logique de debit/credit du wallet peut entrainer des pertes financieres reelles pour les utilisateurs ou pour la plateforme. Le systeme actuel utilise des transactions atomiques avec balanceBefore et balanceAfter dans WalletTransaction, mais la migration vers le schema cible avec le nouveau champ TransactionStatus (pending, completed, failed, reversed, cancelled) introduit de nouveaux etats intermediaires qui doivent etre geres correctement."));
bodyContent.push(body("Le deuxieme risque est la coherence transversale entre les sous-systemes. Par exemple, quand une promotion est appliquee a une commande food, le montant reduit doit etre reflete dans le wallet, dans les DriverEarnings du livreur, et dans les analytics. Si un seul de ces sous-systemes n'est pas mis a jour, les donnees deviennent incoherentes. Le troisieme risque concerne la persistance des conversations du support. Actuellement en memoire, elles sont perdues a chaque redemarrage du serveur. La migration vers une persistance en base de donnees est essentielle mais risque d'introduire des bugs si le mapping des messages n'est pas correct."));

bodyContent.push(makeTable(
  ["Risque", "Niveau", "Impact", "Mitigation"],
  [
    ["Logique debit/credit wallet", "Critique", "Perte financiere reelle", "Transactions de test, reconciliations automatisees"],
    ["TransactionStatus nouveaux etats", "Eleve", "Paiements en attente non traites", "Job de nettoyage des transactions pending"],
    ["Coherence transversale promo/wallet/earnings", "Eleve", "Donnees incoherentes", "Transactions de compensation automatiques"],
    ["Persistance conversations support", "Moyen", "Historique perdu", "Migration avec snapsho t en DB"],
    ["Notifications multi-canal", "Moyen", "Notifications non recues", "Queue prioritaire par canal"],
    ["Analytics enrichis", "Faible", "Statistiques incorrectes", "Validation croisee avec DB"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("6.3 Strategie de migration"));
bodyContent.push(body("La migration du module transverse sera conduite en quatre phases, une par groupe de sous-systemes. La premiere phase traite le Wallet et les paiements. Le modele WalletTransaction sera enrichi avec le champ TransactionStatus et les nouveaux types : promotion_credit, cashback et fee. La logique de debit/credit sera modifiee pour passer par un etat pending avant completed, permettant une periode de verification. Un job de nettoyage sera programme via job-queue.ts pour traiter les transactions pending depuis plus de 24 heures. Les methode de paiement mobile_money, mtn_momo et wave seront enrichies avec une simulation d'integration (en attendant les connecteurs reels) incluant la generation de references de transaction uniques."));
bodyContent.push(body("La deuxieme phase couvre les Promotions, Parrainages et Fidelite. Le modele UserPromotion sera mis a jour pour suivre l'utilisation par utilisateur avec les champs usageCount, maxUsagePerUser et validUntil. Les codes promo seront enrichis avec des conditions d'eligibilite (montant minimum, type de service, zone geographique). Le modele Referral sera ameliore avec le workflow ReferralStatus (pending, completed, rewarded, expired, cancelled) et la generation automatique des bonus. Le modele LoyaltyTransaction sera enrichi pour suivre chaque operation de points avec une description detaillee et une reference a l'evenement declencheur (course, commande, connexion, review)."));
bodyContent.push(body("La troisieme phase traite le Support, la Securite et les Notifications. Les conversations de l'assistant AI seront migrees de la memoire vers un modele ChatMessage en base de donnees, permettant la persistance entre sessions. Le modele Incident sera enrichi avec les enums IncidentSeverity (low, medium, high, critical) et IncidentType (accident, harassment, theft, fraud, safety_violation, vehicle_damage, dispute, other), et un workflow d'enquete complet (reported, investigating, resolved, dismissed, escalated). Le modele Notification sera enrichi avec le canal PushSubscription pour les notifications push, et un systeme de priorite sera ajoute pour gerer les notifications SOS en priorite absolue."));
bodyContent.push(body("La quatrieme phase consolide l'Analytics et l'Audit. La route GET /analytics sera enrichie avec des statistiques detaillees par module (nombre de courses par jour, revenus par type de service, taux d'annulation, temps moyen de livraison, rating moyen par chauffeur). Un dashboard analytics sera cree dans le frontend avec des graphiques interactifs. Le modele AuditLog sera enrichi avec les filtres avances deja presents dans l'API (userId, action, resource, severity, date range) et les rapports seront exportables en format CSV."));

bodyContent.push(h2("6.4 Plan de non-regression"));
bodyContent.push(body("Les tests de non-regression pour le module transverse sont les plus exigeants car ils impliquent des verifications financieres. Premierement, les tests de coherence financiere : pour chaque operation (creation de course, commande food, livraison, rechargement wallet, transfert), on verifiera que le solde du wallet est coherent avec l'historique des transactions, que les balanceBefore et balanceAfter sont corrects dans chaque WalletTransaction, et que le total des debits et credits est nul. Deuxiemement, les tests de promotion : application d'un code promo sur une commande, verification que la reduction est correctement appliquee, et validation que le code ne peut pas etre utilise au-dela de sa limite."));
bodyContent.push(body("Troisiemement, les tests de notifications : envoi de notifications sur chaque canal (push, SMS, email, in-app), verification que les notifications SOS sont traitees en priorite, et validation que les notifications sont bien marquees comme lues. Quatriemement, les tests de securite : verification que l'assistant AI ne divulgue pas d'informations sensibles, que les incidents sont correctement classes par severite, et que les logs d'audit sont complets et immuables. Chaque phase de migration sera validee par un jeu de tests automatises executables via un script unique, et les resultats seront enregistres dans le worklog du projet."));

// ═══════════════════════════════════════════
// SYNTHESE ET ROADMAP
// ═══════════════════════════════════════════
bodyContent.push(h1("Synthese et Roadmap globale"));

bodyContent.push(h2("7.1 Matrice de dependance inter-modules"));
bodyContent.push(body("Les six modules ne sont pas independants et presentent des dependances qui imposent un ordre de migration optimal. Le module Ride doit etre migre en premier car il est le plus mature et sert de reference pour les patterns de migration (machine a etats enrichie, estimation tarifaire, DriverEarnings). Le module Food doit suivre immediatement apres car il partage les modeles Rating et DriverEarnings avec Ride. Le module Courier peut etre migre en parallele du module Food car leurs dependances communes (Rating, DriverEarnings) seront deja traitees. Le module Portails Partenaires depend du module Food (gestion des restaurants) et doit etre migre apres. Le module Chauffeur/Coursier depend des modules Ride, Food et Courier (acceptation de courses, livraison de repas, livraison de colis) et doit etre migre apres les trois premiers. Enfin, le module transverse peut etre migre en parallele des modules metier car ses sous-systemes sont largement independants, bien que la coherence financiere necessite une coordination avec les modules Ride, Food et Courier."));

bodyContent.push(makeTable(
  ["Phase", "Module", "Duree estimee", "Dependances", "Priorite"],
  [
    ["Phase 1", "Ride (Transport)", "2-3 jours", "Aucune", "Critique"],
    ["Phase 2", "Food / Grocery", "2-3 jours", "Ride (Rating, Earnings)", "Critique"],
    ["Phase 2 (parallele)", "Courier / Delivery", "1-2 jours", "Ride (Rating, Earnings)", "Elevee"],
    ["Phase 3", "Portails Partenaires", "3-4 jours", "Food (restaurants)", "Elevee"],
    ["Phase 4", "App Chauffeur / Coursier", "4-5 jours", "Ride + Food + Courier", "Elevee"],
    ["Phase 1-5 (parallele)", "Paiements / Wallet / transverse", "3-4 jours", "Coherence financiere", "Critique"],
  ]
));
bodyContent.push(emptyLine());

bodyContent.push(h2("7.2 Principes directeurs"));
bodyContent.push(body("L'ensemble de la migration respecte cinq principes directeurs qui guident chaque decision technique. Le premier est le principe de precaution : aucune suppression de champ, d'enum ou de route existant n'est effectuee sans une periode de deprecation d'au moins une version. Tout changement est d'abord ajoutitif, puis les anciennes implementations sont marquees comme depreciees, et enfin supprimees dans une version ulterieure. Le deuxieme est le principe de tracabilite : chaque migration est documentee dans le worklog du projet avec l'identifiant du module, les fichiers touches, les changements effectues et les resultats des tests de non-regression."));
bodyContent.push(body("Le troisieme principe est le principe de reversibilite : chaque phase de migration doit pouvoir etre annulee sans perte de donnees. Cela implique l'utilisation de migrations Prisma reversibles, des backups de la base de donnees avant chaque phase, et des scripts de rollback testes. Le quatrieme principe est le principe de validation continue : chaque commit de migration est valide par un ensemble de tests automatises qui couvrent les flux existants et les nouveaux flux. Les tests sont executes dans un environnement de staging avant d'etre appliques en production. Le cinquieme principe est le principe de communication : chaque phase de migration est signalee aux utilisateurs impacts (chauffeurs, restaurants, commercants) avec une description des changements et des instructions de mise a jour si necessaire."));

bodyContent.push(h2("7.3 Checklist pre-migration"));
bodyContent.push(body("Avant de demarrer chaque phase de migration, la checklist suivante doit etre validee : (1) les corrections P0 sont appliquees et validees (commit 43c2477), (2) les tests automatises existants passent a 100%, (3) un backup de la base de donnees est realise, (4) le worklog est a jour avec le module et les fichiers touches, (5) la branche de migration est creee depuis la branche principale, (6) l'environnement de staging est synchronise avec la production, (7) les parties impactees (chauffeurs, restaurants) sont informeess du calendrier de maintenance. Apres chaque phase, la checklist post-migration valide : (1) tous les tests de non-regression passent, (2) les nouvelles fonctionnalites sont operationnelles, (3) les performances sont dans les seuils definis, (4) le commit est pousse avec un message descriptif, (5) le worklog est mis a jour avec les resultats."));

// ── Document Assembly ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 400, after: 200, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 300, after: 160, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  sections: [
    // Section 1: Cover
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: [buildCoverR1(coverConfig)],
    },
    // Section 2: TOC (Front matter)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageNumFooter("roman") },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({
            text: "Table des matieres",
            bold: true, size: 32,
            font: { eastAsia: "SimHei", ascii: "Calibri" },
            color: c(P.primary),
          })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note : Cette table des matieres est generee via des codes de champ. Pour actualiser les numeros de page, faites un clic droit sur la table et selectionnez \u00ab Mettre a jour les champs \u00bb.",
            italics: true, size: 18, color: "888888",
          })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "MOVA - Plan de Migration Module par Module", size: 18, color: "808080" })],
          })],
        }),
      },
      footers: { default: pageNumFooter("arabic") },
      children: bodyContent,
    },
  ],
});

// ── Generate ──
const OUTPUT = "/home/z/my-project/download/MOVA_Plan_Migration_Modules.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document generated: " + OUTPUT);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
