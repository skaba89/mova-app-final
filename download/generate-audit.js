const { Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber,
        AlignmentType, HeadingLevel, PageBreak, TableOfContents, Table, TableRow,
        TableCell, WidthType, BorderStyle, ShadingType, SectionType, TabStopType,
        TabStopPosition } = require("docx");
const fs = require("fs");

// Tech palette for MOVA (ride-hailing tech)
const P = { primary: "0A1628", body: "000000", secondary: "506070", accent: "5B8DB8", surface: "F4F8FC" };
const c = (hex) => hex.replace("#", "");

// Helpers
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, color: c(P.primary) })]
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 300, after: 160 },
  children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, color: c(P.primary) })]
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, bold: true, font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, color: c(P.secondary) })]
});
const body = (text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  indent: { firstLine: 480 },
  spacing: { line: 312, after: 80 },
  children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
});
const bodyBold = (label, text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  indent: { firstLine: 480 },
  spacing: { line: 312, after: 80 },
  children: [
    new TextRun({ text: label, bold: true, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })
  ]
});
const emptyP = () => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "", size: 12 })] });

// Severity badge helper
const sev = (s) => {
  const colors = { CRIT: "FF0000", HIGH: "E67E22", MED: "F39C12", LOW: "3498DB", INFO: "95A5A6" };
  return new TextRun({ text: ` [${s}] `, bold: true, size: 22, color: colors[s] || "000000", font: { ascii: "Calibri" } });
};

// Table builder
function buildTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h => new TableCell({
      children: [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: h, bold: true, size: 21, color: c(P.body), font: { ascii: "Calibri", eastAsia: "SimHei" } })] })],
      shading: { type: ShadingType.CLEAR, fill: c(P.accent) },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }))
  });
  const dataRows = rows.map((row, i) => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: cell, size: 20, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
      shading: i % 2 === 0 ? { type: ShadingType.CLEAR, fill: c(P.surface) } : undefined,
      margins: { top: 40, bottom: 40, left: 100, right: 100 },
    }))
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

// Cover
function buildCover() {
  return [
    new Paragraph({ spacing: { before: 4000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "RAPPORT D'AUDIT COMPLET", font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 56, bold: true, color: c(P.accent) })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: "MOVA - Application VTC & Mobile Money", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 36, color: c(P.secondary) })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Conakry, Guin\u00e9e", font: { ascii: "Calibri" }, size: 24, color: c(P.secondary) })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: "Version 1.0 - Avril 2026", font: { ascii: "Calibri" }, size: 24, color: c(P.secondary) })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 800 },
      children: [new TextRun({ text: "Analyse compl\u00e8te du frontend, backend, API et s\u00e9curit\u00e9", font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.secondary), italics: true })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [new TextRun({ text: "4 r\u00f4les : Passager, Chauffeur, Marchand, Admin | 15 services | 72+ routes API", font: { ascii: "Calibri" }, size: 20, color: c(P.secondary) })]
    }),
  ];
}

// ========================== DOCUMENT ==========================
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) } },
      heading2: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) } },
      heading3: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.secondary) } },
    },
  },
  sections: [
    // COVER
    {
      properties: { page: { margin: { top: 0, bottom: 0, left: 1440, right: 1440 } } },
      children: buildCover(),
    },
    // TOC
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
        titlePage: true,
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "MOVA - Audit Complet", size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] }),
      },
      children: [
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Table des mati\u00e8res", bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] }),
        new TableOfContents("Table des mati\u00e8res", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // BODY
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "MOVA - Audit Complet", size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] }),
      },
      children: [
        // ===== 1. RESUME EXECUTIF =====
        h1("1. R\u00e9sum\u00e9 Ex\u00e9cutif"),
        body("Ce rapport pr\u00e9sente l'audit complet de l'application MOVA, une plateforme de transport et de services financiers mobiles con\u00e7ue pour Conakry, Guin\u00e9e. L'audit couvre l'int\u00e9gralit\u00e9 du code source : architecture, composants frontend (30+ vues), routes API (72+ endpoints), logique m\u00e9tier, gestion d'\u00e9tat, s\u00e9curit\u00e9 et exp\u00e9rience utilisateur, pour les 4 r\u00f4les (passager, chauffeur, marchand, administrateur) et les 15 services propos\u00e9s."),
        body("L'application est construite avec Next.js 16 (Turbopack), TypeScript, Prisma ORM, PostgreSQL, Socket.IO et Zustand. Le code source comprend environ 45 000 lignes r\u00e9parties dans 60+ fichiers composants, 72+ routes API et 15+ fichiers utilitaires. Le projet utilise un pattern SPA (Single Page Application) avec navigation par \u00e9tat Zustand plut\u00f4t que le routing Next.js natif."),

        h2("1.1 Chiffres cl\u00e9s de l'audit"),
        buildTable(
          ["M\u00e9trique", "Valeur"],
          [
            ["Fichiers analys\u00e9s", "60+ composants + 36 API routes + 15 librairies"],
            ["Lignes de code totales", "~45 000"],
            ["Bugs critiques (s\u00e9curit\u00e9)", "13 vuln\u00e9rabilit\u00e9s identifi\u00e9es"],
            ["Bugs fonctionnels", "40+ probl\u00e8mes identifi\u00e9s"],
            ["Services enti\u00e8rement fonctionnels", "3 sur 15 (VTC, Livraison, Moto)"],
            ["Services partiellement fonctionnels", "5 sur 15"],
            ["Services enti\u00e8rement en stub", "3 sur 15 (Navigation, Location, Transfert)"],
            ["API routes sans authentification", "20 sur 27 (74%)"],
          ]
        ),

        h2("1.2 Verdict global"),
        body("L'application MOVA dispose d'une architecture solide et d'une base de code impressionnante en termes de volume et de couverture fonctionnelle. Cependant, l'audit r\u00e9v\u00e8le que seulement 20% des services sont pleinement op\u00e9rationnels. Les probl\u00e8mes majeurs sont concentr\u00e9s sur trois axes : la s\u00e9curit\u00e9 API (74% des endpoints sans auth), les services stub/placeholder (navigation, location voiture, transfert d'argent) et les incoh\u00e9rences de donn\u00e9es entre le client et le serveur. Le travail n\u00e9cessaire pour atteindre 100% de fonctionnalit\u00e9 est estim\u00e9 \u00e0 environ 2-3 semaines de d\u00e9veloppement concentr\u00e9."),

        // ===== 2. ARCHITECTURE =====
        h1("2. Architecture Globale"),
        h2("2.1 Structure du projet"),
        body("Le projet suit une architecture Next.js standard avec le pattern App Router. Le dossier src/ contient trois sous-dossiers principaux : app/ pour les routes API et les pages, components/ pour l'interface utilisateur, et lib/ pour la logique m\u00e9tier. Les composants MOVA sont regroup\u00e9s dans components/mova/ tandis que les composants UI g\u00e9n\u00e9riques (shadcn/ui) sont dans components/ui/."),
        body("Le routing est enti\u00e8rement g\u00e9r\u00e9 par le store Zustand (currentView) plut\u00f4t que par le syst\u00e8me de fichiers Next.js. La page principale (page.tsx) fait office de routeur SPA en mappant chaque valeur de currentView vers un composant React charg\u00e9 dynamiquement via React.lazy() et Suspense. Ce choix architectural simplifie la navigation entre les 23 vues mais sacrifie le deep-linking, le partage d'URL et la navigation navigateur (pr\u00e9c\u00e9dent/suivant)."),

        h2("2.2 Gestion d'\u00e9tat"),
        body("Le store Zustand (store.ts) est un store monolithique contenant plus de 50 pi\u00e8ces d'\u00e9tat couvrant l'authentification, la navigation, les r\u00e9servations, les notifications, la fid\u00e9lit\u00e9 et les param\u00e8tres r\u00e9gionaux. Ce pattern God Store pose des probl\u00e8mes de performance car chaque modification d'\u00e9tat provoque le re-rendu de tous les composants abonn\u00e9s. Le store ne utilise aucun middleware Zustand (pas de devtools, persist ou immer), ce qui complique le d\u00e9bogage."),
        body("Les probl\u00e8mes identifi\u00e9s dans le store incluent : un bug dans goBack() qui ne met pas \u00e0 jour previousView, un ID utilisateur cod\u00e9 en dur ('demo') pour toutes les connexions de test, une inad\u00e9quation d'hydratation entre le serveur et le client pour la locale (localStorage lu au niveau module), et un cast de type non s\u00e9curis\u00e9 sur la valeur de locale depuis localStorage."),

        h2("2.3 Middleware et s\u00e9curit\u00e9"),
        body("Le middleware Next.js (middleware.ts) impl\u00e9mente le rate limiting, les headers de s\u00e9curit\u00e9 (CSP, HSTS, CORS) et la v\u00e9rification JWT pour les routes API. Cependant, un bug critique a \u00e9t\u00e9 identifi\u00e9 : le matcher est configur\u00e9 uniquement pour /api/mova/:path*, ce qui signifie que tous les headers de s\u00e9curit\u00e9, le rate limiting et la v\u00e9rification CORS ne s'appliquent jamais aux routes de pages. De plus, la politique CSP utilise 'unsafe-inline' et 'unsafe-eval', ce qui annule la protection contre les attaques XSS."),

        // ===== 3. AUDIT FRONTEND - PASSAGER =====
        h1("3. Audit Frontend - R\u00f4le Passager"),
        h2("3.1 Vue Passager principale (passenger-view.tsx) - 4 493 lignes"),
        body("C'est le composant le plus complexe et le plus fonctionnel de l'application. Le flux de r\u00e9servation complet fonctionne : recherche d'adresse via Nominatim, estimation du tarif via OSRM, cr\u00e9ation de course via API, assignation chauffeur via Socket.IO et suivi en temps r\u00e9el. La carte Leaflet est int\u00e9gr\u00e9e et les favoris sont persist\u00e9s dans localStorage. Les codes promo sont valid\u00e9s via l'API et le partage de course utilise le Web Share API."),
        body("Malgr\u00e9 sa sophistication, plusieurs bugs subsistent. La r\u00e9servation pour un tiers (bookForThird) collecte nom et t\u00e9l\u00e9phone mais ne les envoie jamais \u00e0 l'API. Les arr\u00eats multiples (stops) sont g\u00e9r\u00e9s en UI mais jamais inclus dans le payload de cr\u00e9ation. La remise promo est calcul\u00e9e c\u00f4t\u00e9 client mais jamais soustraite du tarif final. La barre de progression pendant la recherche chauffeur est cod\u00e9e en dur \u00e0 66%."),
        body("Probl\u00e8mes d'exp\u00e9rience utilisateur : les coordonn\u00e9es par d\u00e9faut sont cod\u00e9es en dur (centre de Conakry), la recherche Nominatim \u00e9choue silencieusement sans feedback, et l'erreur de cr\u00e9ation de course affiche un toast g\u00e9n\u00e9rique sans pr\u00e9server l'\u00e9tat du formulaire pour r\u00e9essai."),

        h2("3.2 Hub des services (hub-view.tsx) - 878 lignes"),
        body("Le hub est le tableau de bord principal montrant le message d'accueil, les services populaires, les promotions, l'activit\u00e9 r\u00e9cente et les points de fid\u00e9lit\u00e9. Les donn\u00e9es proviennent des API (analytics, promotions, rides) et les skeletons de chargement sont bien impl\u00e9ment\u00e9s. Le bouton Voir tout ouvre la grille compl\u00e8te des 15 services."),
        body("Trois \u00e9tats sont d\u00e9clar\u00e9s mais jamais rendus dans le JSX : showSupport, showAllServices et showAssistant. Leurs setters sont appel\u00e9s mais aucune bo\u00eete de dialogue n'est affich\u00e9e. Les boutons Utiliser des promotions sont purement d\u00e9coratifs sans handler onClick. Le nombre de promotions actives est cod\u00e9 en dur ('3 promotions actives'). La navigation mobile en bas de page a un onglet Accueil toujours actif, les autres onglets ne changent pas l'\u00e9tat visuel."),

        h2("3.3 Navigation GPS (navigation-view.tsx) - 451 lignes"),
        bodyBold("Statut : ", "ENTIEREMENT EN STUB - Aucune fonctionnalit\u00e9 r\u00e9elle"),
        body("La vue navigation est un placeholder complet. La carte est un dessin SVG statique avec des lignes cod\u00e9es en dur, pas d'int\u00e9gration Leaflet/OSM. Les instructions de navigation pas-\u00e0-pas sont des donn\u00e9es mock qui ne changent jamais selon la destination. Les dur\u00e9es par mode de transport sont cod\u00e9es en dur. Le bouton Commencer la navigation affiche uniquement un toast sans d\u00e9marrer de r\u00e9elle navigation. Les boutons de zoom n'ont aucun handler onClick. Un bandeau En cours de d\u00e9veloppement est affich\u00e9, indiquant que cette fonctionnalit\u00e9 n'est pas impl\u00e9ment\u00e9e."),
        body("La fonction getModeConfig retourne des distances diff\u00e9rentes par mode de transport pour la m\u00eame destination (3.2 km en marchant, 5.8 km en voiture, 4.1 km en bus), ce qui est logiquement impossible pour un m\u00eame trajet."),

        h2("3.4 Location de voiture (car-rental-view.tsx) - 541 lignes"),
        bodyBold("Statut : ", "PARCIELLEMENT FONCTIONNEL - Consultation uniquement"),
        body("La vue permet de parcourir les v\u00e9hicules disponibles avec des filtres fonctionnels (type, prix, localisation, dates). Cependant, le bouton R\u00e9server affiche uniquement un toast R\u00e9servation bient\u00f4t disponible. Il n'y a aucune int\u00e9gration API, aucun calcul de prix total pour la p\u00e9riode s\u00e9lectionn\u00e9e, aucune v\u00e9rification de disponibilit\u00e9 selon les dates, et aucune validation que la date de fin est post\u00e9rieure \u00e0 la date de d\u00e9but. Tous les 6 v\u00e9hicules sont des donn\u00e9es cod\u00e9es en dur."),

        h2("3.5 Transfert d'argent (transfer-view.tsx) - 498 lignes"),
        bodyBold("Statut : ", "ENTIEREMENT SIMULE - Aucun vrai transfert"),
        body("L'interface est visuellement compl\u00e8te avec validation t\u00e9l\u00e9phone (format 6XX XX XX XX), validation du montant (max 5M GNF), boutons de montant rapide et historique des transferts. Cependant, la fonction handleSubmit utilise un setTimeout de 1.5 secondes pour simuler le transfert sans aucun appel API. L'historique contient 5 entr\u00e9es mock cod\u00e9es en dur. Les statistiques r\u00e9sum\u00e9es (150 000 envoy\u00e9s, 75 000 re\u00e7us) sont des cha\u00eenes cod\u00e9es en dur. La fonction formatPhoneDisplay est cens\u00e9e masquer les chiffres du milieu mais retourne le num\u00e9ro tel quel. Il n'y a aucune v\u00e9rification de solde, aucune confirmation par PIN/biom\u00e9trie, et aucun num\u00e9ro de re\u00e7u apr\u00e8s envoi."),

        h2("3.6 Moto-taxi (moto-view.tsx) - 691 lignes"),
        bodyBold("Statut : ", "FONCTIONNEL AVEC RESERVES"),
        body("Le flux de r\u00e9servation moto fonctionne : formulaire, recherche chauffeur, attribution, course et fin. L'API est appel\u00e9e pour cr\u00e9er et mettre \u00e0 jour les courses. L'historique est r\u00e9cup\u00e9r\u00e9 depuis l'API. Cependant, une condition de course critique existe : le setTimeout qui cr\u00e9e le faux chauffeur n'est pas coordonn\u00e9 avec l'appel API. Si l'API \u00e9choue, le faux chauffeur est toujours cr\u00e9\u00e9 apr\u00e8s 2.5 secondes. De plus, le bouton d'appel t\u00e9l\u00e9phonique affiche un toast sans initier d'appel r\u00e9el. Il manque le suivi GPS en temps r\u00e9el, la notation apr\u00e8s course et le flux de paiement."),

        h2("3.7 Covoiturage (carpool-view.tsx) - 1 177 lignes"),
        bodyBold("Statut : ", "RECHERCHE COMPLETEMENT CASSEE"),
        body("La vue covoiturage a une interface impressionnante avec 4 onglets (Rechercher, Publier, Mes trajets, R\u00e9servations). Cependant, le tableau availableTrips est initialis\u00e9 comme tableau vide et n'est jamais peupl\u00e9 par aucune source de donn\u00e9es. La fonctionnalit\u00e9 de recherche filtre toujours un tableau vide, affichant perp\u00e9tuellement 0 trajet disponible. Le bouton de r\u00e9servation envoie un num\u00e9ro de t\u00e9l\u00e9phone cod\u00e9 en dur (+224 6XX XX XX XX). Le formulaire de publication cr\u00e9e un v\u00e9hicule fictif (Toyota Corolla Blanc GN-4821-A) pour tous les utilisateurs. Les panneaux de notification et chat sont rendus mais non connect\u00e9s \u00e0 des donn\u00e9es r\u00e9elles."),

        h2("3.8 Livraison (delivery-view.tsx) - 1 804 lignes"),
        bodyBold("Statut : ", "FONCTIONNEL - Le plus professionnel des composants"),
        body("C'est le composant le plus complet techniquement avec int\u00e9gration React Query (useDeliveries, useCreateDelivery, useUpdateDelivery), un formulaire wizard en 4 \u00e9tapes, calcul de prix par distance Haversine, suivi de statut avec barre de progression, gestion des favoris localStorage et inscription marchand. Le suivi OTP est fonctionnel et les \u00e9toiles de notation sont impl\u00e9ment\u00e9es. Le seul statut 'near' dans la barre de suivi ne peut jamais \u00eatre atteint car il n'existe pas dans le type DeliveryStatus. Le taux de ponctualit\u00e9 est cod\u00e9 en dur \u00e0 94%."),

        h2("3.9 Transport interurbain (intercity-view.tsx) - 1 139 lignes"),
        bodyBold("Statut : ", "PARTIELLEMENT FONCTIONNEL"),
        body("La recherche fonctionne avec g\u00e9n\u00e9ration d\u00e9terministe de trajets, matrice de distance pour 10 villes guin\u00e9ennes, calcul de prix et bo\u00eete de r\u00e9servation avec r\u00e9f\u00e9rence de booking. Cependant, les donn\u00e9es de routes API sont r\u00e9cup\u00e9r\u00e9es mais jamais int\u00e9gr\u00e9es dans les r\u00e9sultats (les trajets d\u00e9mo sont toujours utilis\u00e9s). Un bug de fuseau horaire existe : la date de voyage est forc\u00e9e en UTC alors que l'utilisateur s'attend \u00e0 l'heure locale (GMT). Le s\u00e9lecteur de m\u00e9thode de paiement est d\u00e9fini mais jamais affich\u00e9. L'annulation de r\u00e9servation ne fait qu'une mise \u00e0 jour locale sans appel API."),

        h2("3.10 Transport scolaire (school-view.tsx) - 1 455 lignes"),
        bodyBold("Statut : ", "PARTIELLEMENT FONCTIONNEL - Bug critique"),
        body("Le formulaire de r\u00e9servation est complet avec informations enfant, \u00e9cole, emploi du temps et r\u00e9sum\u00e9 avant confirmation. L'API est appel\u00e9e pour cr\u00e9er les abonnements et r\u00e9cup\u00e9rer les existants. Cependant, un bug critique existe \u00e0 la ligne 346 : le champ dropoffZone est r\u00e9gl\u00e9 sur la commune au lieu de la zone de l'\u00e9cole, envoyant la m\u00eame adresse comme d\u00e9part et arriv\u00e9e. La route affich\u00e9e montre donc Kaloum - Kaloum au lieu de Kaloum - Dixinn. La s\u00e9lection de chauffeur est absente de l'interface malgr\u00e9 un tableau DEMO_DRIVERS d\u00e9fini. Tous les types de forfaits (journalier, unique, activit\u00e9s) sont mapp\u00e9s vers 'monthly' dans l'API, ce qui est incorrect."),

        // ===== 4. AUDIT FRONTEND - CHAUFFEUR =====
        h1("4. Audit Frontend - R\u00f4le Chauffeur"),
        h2("4.1 Vue Chauffeur principale (driver-view.tsx) - 2 550 lignes"),
        body("C'est le deuxi\u00e8me composant le plus complexe de l'application avec tableau de bord, gestion des courses, gains, paiements et suivi WebSocket en temps r\u00e9el. Le toggle en ligne/hors ligne fonctionne avec mise \u00e0 jour optimiste et rollback API. Le cycle de vie des courses (accepter, d\u00e9cliner, prendre en charge, conduire, terminer) est enti\u00e8rement c\u00e2bl\u00e9. Le partage de position GPS toutes les 1.5 secondes pendant les courses actives est impl\u00e9ment\u00e9 via geolocation.watchPosition."),
        body("Trois bugs critiques ont \u00e9t\u00e9 identifi\u00e9s. Premier, le handler handleRideAction utilise une closure stale pour driverEarnings, causant un double-cr\u00e9dit si deux courses sont termin\u00e9es rapidement (devrait utiliser un updater fonctionnel). Deuxi\u00e8me, un effet de synchronisation des gains (ligne 665) cr\u00e9e une boucle de r\u00e9troaction avec le handler WebSocket. Troisi\u00e8me, validDocs est cod\u00e9 en dur \u00e0 0, plafonnant le pourcentage de compl\u00e9tion du profil \u00e0 75% maximum. Les zones de chaleur (heatmap) sont toujours vides car l'API n'est jamais appel\u00e9e. Le paiement affiche un toast sous 24h mais ne fait aucun appel API."),

        h2("4.2 Classement chauffeurs (driver-leaderboard.tsx) - 591 lignes"),
        body("Le tableau de classement affiche les 10 meilleurs chauffeurs avec un podium visuel pour le top 3 et des filtres par p\u00e9riode (mois, trimestre, tout). Cependant, le filtre de p\u00e9riode est non fonctionnel : la variable period change d'\u00e9tat mais n'est jamais utilis\u00e9e dans la d\u00e9rivation de donn\u00e9es, toutes les p\u00e9riodes affichent des donn\u00e9es identiques. Les streaks sont cod\u00e9s en dur \u00e0 0 pour tous les chauffeurs. Les gains sont estim\u00e9s via une formule synth\u00e9tique (completedRides x 15 000 x rating/4.5) qui produit des nombres irr\u00e9alistes."),

        // ===== 5. AUDIT FRONTEND - MARCHAND & ADMIN =====
        h1("5. Audit Frontend - R\u00f4les Marchand et Admin"),
        h2("5.1 Vue Corporate (corporate-view.tsx) - 2 491 lignes"),
        body("Le tableau de bord entreprise dispose de 6 onglets (Dashboard, Employ\u00e9s, Centres de co\u00fbts, R\u00e9servations, Factures, Param\u00e8tres) avec API hooks r\u00e9els. La gestion CRUD des employ\u00e9s fonctionne avec persistance serveur. L'export CSV et la g\u00e9n\u00e9ration de factures TXT sont impl\u00e9ment\u00e9s. Le KPI nouveaux employ\u00e9s est cod\u00e9 en dur \u00e0 3. L'attribution des d\u00e9penses par d\u00e9partement est incorrecte (divis\u00e9e \u00e9galement). L'ID business utilis\u00e9 est toujours 'biz_demo_001' quel que soit l'ID r\u00e9el de l'API."),

        h2("5.2 Marketplace (marketplace-view.tsx) - 1 897 lignes"),
        body("Le march\u00e9 de petites annonces permet de parcourir, filtrer, cr\u00e9er et supprimer des annonces avec recherche d\u00e9bounc\u00e9e. Le contact WhatsApp et le partage natif fonctionnent. Deux chemins de suppression existent : le FAB supprime uniquement en local (pas d'appel API) tandis que la bo\u00eete de d\u00e9tail appelle l'API DELETE. L'upload de photos g\u00e9n\u00e8re des noms de fichiers fictifs sans s\u00e9lecteur de fichiers r\u00e9el. Les favoris sont stock\u00e9s en Set local et perdus au rechargement. Quand l'API retourne un tableau vide, les donn\u00e9es d\u00e9mo sont silencieusement substitu\u00e9es."),

        h2("5.3 Vue Admin principale (admin-view.tsx) - 2 100+ lignes"),
        body("Le panneau d'administration est le plus complet avec 11 sections navigables via sidebar. Le dashboard affiche les KPI depuis l'API analytics. La gestion des courses inclut filtres, recherche et d\u00e9tail. La carte en direct utilise les donn\u00e9es des chauffeurs en ligne. Cependant, le calcul des revenus hebdomadaires (ligne 750) acc\u00e8de la propri\u00e9t\u00e9 amount au lieu de revenus, affichant toujours 0. La l\u00e9gende de la carte utilise 3 points verts identiques pour des concepts diff\u00e9rents. Le filtre de zones ne contient que 5 communes sur les 13 de Conakry. Plusieurs tableaux de donn\u00e9es pour les graphiques sont d\u00e9finis comme tableaux vides."),

        h2("5.4 Surveillance syst\u00e8me (admin-monitoring-view.tsx) - 974 lignes"),
        body("Le dashboard de monitoring interroge les endpoints health (10s) et monitoring (30s). L'affichage inclut la sant\u00e9 DB, cache, rate limiter, file d'attente, m\u00e9moire et erreurs API. Le taux de hit cache est incorrectement pars\u00e9 : si l'API retourne '85.5%', parseFloat retourne 0 car la cha\u00eene contient '%'. L'erreur du health fetch est attrap\u00e9e silencieusement, affichant toujours l'\u00e9tat healthy m\u00eame quand l'endpoint \u00e9choue. Les top violateurs de rate limit et les endpoints lents ne sont pas affich\u00e9s malgr\u00e9 la pr\u00e9sence des donn\u00e9es."),

        h2("5.5 Graphiques admin (admin-charts.tsx) - 1 558 lignes"),
        body("La librairie de 10 composants Recharts couvre les revenus, courses, croissance utilisateurs, demande par zone et m\u00e9thodes de paiement. Cependant, 7 graphiques sur 10 utilisent uniquement des donn\u00e9es d\u00e9mo cod\u00e9es en dur sans interface de props pour recevoir des donn\u00e9es dynamiques. Seuls RevenueChart et quelques autres acceptent des donn\u00e9es via props. Le compteur d'\u00e9v\u00e9nements en temps r\u00e9el (RealtimeActivityFeed) g\u00e9n\u00e8re des \u00e9v\u00e9nements fictifs toutes les 15 secondes. La variable eventCounter au niveau module est partag\u00e9e entre toutes les instances, causant des probl\u00e8mes d'hydratation SSR."),

        // ===== 6. AUDIT API & BACKEND =====
        h1("6. Audit API & Backend"),
        h2("6.1 S\u00e9curit\u00e9 - Vuln\u00e9rabilit\u00e9s critiques"),
        body("L'audit a r\u00e9v\u00e9l\u00e9 que 20 des 27 routes API (74%) ne disposent d'aucune authentification. N'importe quel client peut cr\u00e9er, modifier ou supprimer des donn\u00e9es sensibles sans v\u00e9rification d'identit\u00e9. Le tableau ci-dessous d\u00e9taille les vuln\u00e9rabilit\u00e9s les plus critiques identifi\u00e9es."),
        buildTable(
          ["Route", "Vuln\u00e9rabilit\u00e9", "Impact"],
          [
            ["bookings/", "Aucune auth - CRUD ouvert", "Cr\u00e9ation/liste de courses pour n'importe quel utilisateur"],
            ["wallet/", "Aucune auth - cr\u00e9dit illimit\u00e9", "Cr\u00e9dit de portefeuille sans limite ni v\u00e9rification"],
            ["rides/", "Aucune auth - cr\u00e9ation de courses", "Courses cr\u00e9\u00e9es pour n'importe qui"],
            ["drivers/", "Aucune auth - donn\u00e9es publiques", "T\u00e9l\u00e9phones, notes, zones visibles"],
            ["deliveries/", "OTP visible sans auth", "Codes de livraison expos\u00e9s publiquement"],
            ["assistant/", "Aucun auth ni rate limit", "Spam LLM gratuit, manipulation conversations"],
            ["chat/", "Aucune auth - spoofing messages", "Envoi de messages en tant que n'importe qui"],
            ["marketplace/", "DELETE sans auth", "Suppression d'annonces par n'importe qui"],
            ["analytics/", "Aucune auth - revenus publics", "Donn\u00e9es financi\u00e8res visibles publiquement"],
            ["intercity/", "Cr\u00e9ation comptes sans mot de passe", "Comptes orphelins exploitables"],
          ]
        ),

        h2("6.2 Bugs fonctionnels API"),
        body("Au-del\u00e0 des probl\u00e8mes de s\u00e9curit\u00e9, plusieurs bugs fonctionnels ont \u00e9t\u00e9 identifi\u00e9s dans les routes API. Le endpoint drivers/route.ts contient un bug de filtre : la condition online !== null est toujours vraie quand le param\u00e8tre est absent, masquant tous les chauffeurs en ligne. Le wallet/route.ts a un probl\u00e8me de snapshot de solde dans les transactions. L'endpoint incidents/route.ts a un probl\u00e8me N+1 avec 100 requ\u00eates DB pour 50 incidents au lieu d'un seul include. Les paiements mobile-money utilisent setTimeout avec des \u00e9tats perdus au red\u00e9marrage serveur."),
        buildTable(
          ["Fichier", "Ligne", "Bug", "S\u00e9v\u00e9rit\u00e9"],
          [
            ["drivers/route.ts", "21", "Filtre online masque les chauffeurs en ligne", "CRIT"],
            ["wallet/route.ts", "118", "Snapshot de solde stale dans transaction", "MED"],
            ["wallet/transfer/", "56", "Wallet destinataire cr\u00e9\u00e9 hors transaction", "MED"],
            ["incidents/route.ts", "39-59", "Probl\u00e8me N+1 (100+ requ\u00eates DB)", "MED"],
            ["moto/route.ts", "89", "Filtre status appliqu\u00e9 aux v\u00e9hicules", "MED"],
            ["payments/mobile-money", "34-81", "Paiements perdus au red\u00e9marrage", "CRIT"],
            ["api.ts", "94-97", "Headers custom remplacent headers auth", "MED"],
            ["auth/register", "12", "Min 6 chars vs 8 dans validations.ts", "LOW"],
          ]
        ),

        h2("6.3 Incoh\u00e9rences donn\u00e9es client/serveur"),
        body("Le pricing-engine.ts c\u00f4t\u00e9 client inclut des multiplicateurs de temps, de surge et de m\u00e9t\u00e9o qui ne sont pas impl\u00e9ment\u00e9s dans le serveur fare/route.ts (qui ne fait que base + distance x prixKm). Si l'API est indisponible, le client calcule un prix compl\u00e8tement diff\u00e9rent de celui du serveur. De plus, le fichier validations.ts d\u00e9finit des sch\u00e9mas Zod complets pour 18 entit\u00e9s, mais la majorit\u00e9 des routes API utilisent leur propre validation manuelle ou des sch\u00e9mas Zod en ligne, rendant les d\u00e9finitions centrales inutilis\u00e9es. L'endpoint school/route.ts retourne des donn\u00e9es d\u00e9mo cod\u00e9es en dur pour les \u00e9coles et abonnements plut\u00f4t que des donn\u00e9es r\u00e9elles de la base de donn\u00e9es."),

        // ===== 7. SYNTHESE PAR SERVICE =====
        h1("7. Synth\u00e8se par Service"),
        body("Le tableau ci-dessous r\u00e9sume l'\u00e9tat fonctionnel de chacun des 15 services de l'application MOVA, avec le niveau de fonctionnalit\u00e9, les bugs critiques et la priorit\u00e9 d'intervention recommand\u00e9e."),
        buildTable(
          ["Service", "Fonctionnel", "Bugs Critiques", "Priorit\u00e9"],
          [
            ["VTC (passenger-view)", "Oui - Core booking OK", "3 bugs (promo, tiers, stops)", "P1"],
            ["Moto-taxi", "Oui - Avec r\u00e9serves", "1 bug (race condition)", "P1"],
            ["Livraison", "Oui - Le plus complet", "1 bug (statut near)", "P2"],
            ["Covoiturage", "NON - Recherche cass\u00e9e", "availableTrips toujours vide", "P0"],
            ["Navigation GPS", "NON - Entierement stub", "Aucune fonction r\u00e9elle", "P0"],
            ["Location voiture", "NON - Consultation seule", "Aucune r\u00e9servation", "P0"],
            ["Transfert argent", "NON - Simul\u00e9", "Aucun vrai transfert", "P0"],
            ["Transport scolaire", "Partiel", "1 bug critique (dropoffZone)", "P0"],
            ["Interurbain", "Partiel", "1 bug (timezone), API ignor\u00e9", "P1"],
            ["Marketplace", "Oui - Avec r\u00e9serves", "2 bugs (delete, photos)", "P2"],
            ["Corporate/Business", "Partiel", "ID cod\u00e9 en dur, KPI fake", "P2"],
            ["Admin dashboard", "Partiel", "KPI \u00e0 0, zones incompl\u00e8tes", "P2"],
            ["Wallet/Paiement", "Partiel", "Simulation setTimeout", "P1"],
            ["Chat", "Partiel", "Sans auth, pas de persistance", "P2"],
            ["Assistant IA", "Oui - Fonctionnel", "Sans auth, conversations volatiles", "P2"],
          ]
        ),

        // ===== 8. PLAN D'ACTION =====
        h1("8. Plan d'Action Prioritaire"),
        h2("8.1 Phase 1 - Critique (Semaine 1)"),
        body("La premi\u00e8re phase doit traiter les probl\u00e8mes les plus urgents qui emp\u00eachent l'utilisation de l'application. La priorit\u00e9 absolue est la s\u00e9curit\u00e9 des API en ajoutant le middleware validateRequest \u00e0 toutes les routes de mutation. En parall\u00e8le, trois services doivent \u00eatre rendus fonctionnels : la navigation GPS (int\u00e9grer Leaflet et OSRM pour le routing r\u00e9el), la location de voiture (cr\u00e9er l'API booking et le flux de paiement), et le transfert d'argent (connecter \u00e0 l'API wallet/transfer existante). Le bug de dropoffZone dans le transport scolaire doit \u00eatre corrig\u00e9 imm\u00e9diatement. Le filtre online des chauffeurs doit \u00eatre corrig\u00e9."),

        h2("8.2 Phase 2 - Importante (Semaine 2)"),
        body("La deuxi\u00e8me phase doit am\u00e9liorer les services partiellement fonctionnels. Le covoiturage n\u00e9cessite de peupler availableTrips depuis une API ou des donn\u00e9es de d\u00e9mo r\u00e9alistes. Les paiements mobile-money doivent remplacer les setTimeout par un job queue avec persistance DB. Le pricing-engine client et le serveur fare/route doivent \u00eatre align\u00e9s. Le probl\u00e8me N+1 dans incidents doit \u00eatre r\u00e9solu avec Prisma include. L'admin dashboard doit corriger le calcul de revenus (revenus au lieu de amount) et ajouter les 8 communes manquantes au filtre de zones."),

        h2("8.3 Phase 3 - Am\u00e9lioration (Semaine 3)"),
        body("La troisi\u00e8me phase couvre les am\u00e9liorations qualit\u00e9. Le store Zustand doit \u00eatre split\u00e9 en slices (auth, booking, navigation). La navigation par URL (history.pushState) doit \u00eatre ajout\u00e9e pour le deep-linking. Les graphiques admin (7/10 en mode d\u00e9mo) doivent recevoir des interfaces de props. Le leaderboard chauffeur doit connecter le filtre de p\u00e9riode aux donn\u00e9es r\u00e9elles. Les favoris marketplace doivent \u00eatre persist\u00e9s. Le middleware matcher doit \u00eatre \u00e9tendu pour couvrir toutes les routes."),

        // ===== 9. CONCLUSION =====
        h1("9. Conclusion"),
        body("L'application MOVA repr\u00e9sente une base technique solide avec une couverture fonctionnelle remarquable. L'architecture Next.js + Prisma + Socket.IO est bien pens\u00e9e et le volume de code (45 000 lignes) t\u00e9moigne d'un effort de d\u00e9veloppement cons\u00e9quent. Les composants les plus aboutis (passenger-view, delivery-view, driver-view) d\u00e9montrent une ma\u00eetrise des patterns React avanc\u00e9s et une int\u00e9gration API propre via React Query."),
        body("Cependant, l'audit r\u00e9v\u00e8le que l'application n'est pas pr\u00eate pour une mise en production. Les trois obstacles principaux sont : la s\u00e9curit\u00e9 API (74% sans auth), les services non fonctionnels (navigation, location, transfert) et les incoh\u00e9rences de donn\u00e9es. Avec un effort concentr\u00e9 de 2-3 semaines suivant le plan d'action propos\u00e9, l'application peut atteindre un niveau de fonctionnalit\u00e9 de 100% et \u00eatre d\u00e9ploy\u00e9e en production en toute s\u00e9curit\u00e9."),
        body("Les recommandations cl\u00e9s sont : ajouter l'authentification JWT \u00e0 toutes les routes API, corriger le bug du store Zustand goBack(), splitter le God Store en slices, remplacer les simulations setTimeout par des workflows persistants, et aligner le pricing client/serveur. Ces corrections sont essentielles pour garantir la fiabilit\u00e9, la s\u00e9curit\u00e9 et la confiance des utilisateurs dans la plateforme MOVA."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/MOVA_Audit_Complet.docx", buf);
  console.log("Audit report generated: /home/z/my-project/download/MOVA_Audit_Complet.docx");
});
