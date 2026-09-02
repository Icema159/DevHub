# Developer Knowledge Hub

Techninė sistemos dokumentacija | 2026-08-26 | Versija 2.0

Privati dokumentų biblioteka, asinchroninis PDF apdorojimas ir šaltiniais pagrįsti AI atsakymai.

## Dokumento paskirtis ir patikimumas

Šis dokumentas skirtas techniniam projekto vertinimui prieš peržiūrint veikiančią demonstracinę aplikaciją. I dalis pateikia 10-15 minučių architektūrinę apžvalgą; II dalis leidžia patikrinti sutartis, apribojimus ir jų įgyvendinimo vietas. Markdown failas yra redaguojamas kanoninis šios apžvalgos šaltinis, o PDF - iš jo sugeneruota platinama versija.

Patikimumo tvarka: dabartinis kodas, patvirtintas production veikimas, aktualūs dokumentai ir ADR, ankstesnis PDF. Audituota repozitorijos būsena `83d3cc7`. Ankstesnis 2026-08-21 PDF išsaugotas nepakeistas. Ši versija nekeičia aplikacijos elgsenos.

Naudojami trys įrodymų lygiai:

- **Patikrinta kode:** įgyvendinimas, konfigūracijos taisyklės ir testų scenarijai perskaityti repozitorijoje.
- **Patvirtinta operatoriaus:** užduotyje nurodytas realus Railway veikimas; šiame audite pakartotinai netestuotas.
- **Nepatikrinta:** faktinė infrastruktūros parinktis arba operacinė garantija, kurios negalima nustatyti iš kodo ir pateikto patvirtinimo.

Tai nėra saugumo sertifikatas, išorinių paslaugų kainoraštis ar naujo production priėmimo testo ataskaita. Šio atnaujinimo metu nekviestos AI paslaugos, nekeisti duomenys ir neleistos aplikacijos testų programos.

## Turinys

### I dalis - techninė apžvalga

1. [Kas yra sistema](#1-kas-yra-sistema)
2. [Sprendžiama problema](#2-sprendžiama-problema)
3. [Pagrindinis vartotojo kelias](#3-pagrindinis-vartotojo-kelias)
4. [Aukšto lygio architektūra](#4-aukšto-lygio-architektūra)
5. [Pagrindiniai techniniai sprendimai](#5-pagrindiniai-techniniai-sprendimai)
6. [RAG principas](#6-rag-principas)
7. [Dokumento paruošimas](#7-dokumento-paruošimas)
8. [Saugumo modelis](#8-saugumo-modelis)
9. [Production topologija](#9-production-topologija)
10. [Dabartinis produkto pasirengimas](#10-dabartinis-produkto-pasirengimas)
11. [Ribos ir sąmoningi kompromisai](#11-ribos-ir-sąmoningi-kompromisai)

### II dalis - techninis žinynas

12. [Monorepo](#12-monorepo)
13. [Frontend](#13-frontend)
14. [API ir sutartys](#14-api-ir-sutartys)
15. [Duomenų modelis](#15-duomenų-modelis)
16. [Dokumento gyvavimo ciklas](#16-dokumento-gyvavimo-ciklas)
17. [Eilės ir užduotys](#17-eilės-ir-užduotys)
18. [Worker](#18-worker)
19. [Objektų saugykla](#19-objektų-saugykla)
20. [Embeddings ir vektorinė paieška](#20-embeddings-ir-vektorinė-paieška)
21. [RAG atsakymų generavimas](#21-rag-atsakymų-generavimas)
22. [Pokalbiai ir citatos](#22-pokalbiai-ir-citatos)
23. [Autentifikacija ir sesijos](#23-autentifikacija-ir-sesijos)
24. [El. pašto patvirtinimas](#24-el-pašto-patvirtinimas)
25. [Autorizacija](#25-autorizacija)
26. [Naršyklės saugumo riba](#26-naršyklės-saugumo-riba)
27. [PDF apdorojimo ribojimas](#27-pdf-apdorojimo-ribojimas)
28. [Kvotos ir AI išlaidų kontrolė](#28-kvotos-ir-ai-išlaidų-kontrolė)
29. [Diegimas](#29-diegimas)
30. [Runtime konfigūracija](#30-runtime-konfigūracija)
31. [Health ir parengtis](#31-health-ir-parengtis)
32. [Testavimas ir įrodymai](#32-testavimas-ir-įrodymai)
33. [Operacinės klaidos ir atkūrimas](#33-operacinės-klaidos-ir-atkūrimas)
34. [Atidėti darbai](#34-atidėti-darbai)
35. [ADR ir peržiūros maršrutas](#35-adr-ir-peržiūros-maršrutas)

# I dalis - techninė apžvalga

## 1. Kas yra sistema

Developer Knowledge Hub, dar vadinamas DevHub, yra full-stack žinių platforma individualiam programuotojui. Vartotojas įkelia techninius PDF į privačią biblioteką, stebi jų paruošimą, ieško dokumentų pagal pavadinimą ir užduoda klausimus apie bibliotekos turinį. Sistema semantiškai suranda tinkamas ištraukas ir generuoja atsakymą su šaltinių nuorodomis.

Vienas dokumentas priklauso vienam vartotojui. Dabartinis produktas neturi komandinių darbo erdvių, bendrinimo, atsiskaitymų ar išorinių repozitorijų importo. Tai veikiantis, production aplinkoje demonstruojamas MVP, o ne pažadas apie visas galimas žinių valdymo funkcijas. Produkto ribos detalizuotos [product-scope.md](product-scope.md).

## 2. Sprendžiama problema

Techninė informacija dažnai išskaidyta tarp dokumentų, mokymosi medžiagos ir projektų aprašymų. Failo pavadinimo ar tikslios frazės paieška nepadeda, kai vartotojas prisimena tik problemos prasmę. Bendro pobūdžio AI atsakymas taip pat nebūtinai atitinka konkretaus projekto sprendimus.

DevHub sujungia privačią biblioteką su semantine paieška. Vertė yra ne vien sugeneruotas tekstas, bet jo ryšys su vartotojo šaltiniais. Citatos rodo panaudotą dokumentą ir, kai žinoma, puslapį. Šiuo metu jų navigacija atidaro Document Details, ne originalų PDF; pilnas šaltinio perskaitymas aplikacijoje dar nėra įgyvendintas.

## 3. Pagrindinis vartotojo kelias

1. Vartotojas registruojasi, patvirtina el. paštą ir prisijungia. Prisijungti galima ir prieš patvirtinimą, tačiau brangios funkcijos ribojamos API.
2. Įkelia PDF. API patikrina autentifikaciją, CSRF, kilmę, įkėlimo ribas, kvotas ir failo tapatybę.
3. Originalas išsaugomas privačiame R2, metaduomenys - PostgreSQL. Redis perduodama tik apdorojimo užduotis su identifikatoriais.
4. Worker ištraukia tekstą, sukuria dalis, atskira užduotimi sugeneruoja embeddings ir pažymi dokumentą READY.
5. Pokalbio klausimui API naudoja tik šio savininko nepašalintus READY dokumentus. Ankstesnės kelios žinutės padeda suprasti tęstinį klausimą, bet nėra faktinis šaltinis.
6. Atsakymas ir citatos išsaugomi. Perkrovus puslapį gaunama serverio autoritetinga istorija.
7. FAILED dokumentą galima paleisti iš naujo. Šalinimas dokumentą paslepia iš karto, o galutinį duomenų ir originalo pašalinimą atlieka Worker.

Frontend nerodo tariamo apdorojimo procento. PENDING, PROCESSING, CHUNKS_READY ir EMBEDDING grupuojamos kaip Processing; būsenos atnaujinamos esamais skaitymais ir rankiniu Refresh, ne nuolatiniu polling.

## 4. Aukšto lygio architektūra

Sistema padalinta pagal atsakomybę, ne pagal kiekvieną produkto funkciją. React valdo sąveiką; Express autentifikuoja ir koordinuoja trumpus HTTP veiksmus; Worker atlieka PDF bei embedding užduotis. PostgreSQL yra verslo būsenos šaltinis, R2 - originalių baitų saugykla, Redis - eilių ir trumpalaikio srauto ribojimo infrastruktūra.

```text
Naršyklė --HTTPS--> Railway Web / Caddy
                         |-- React statiniai failai
                         `-- /api/* --> privatus Express API
                                          |-- PostgreSQL + pgvector
                                          |-- Redis / BullMQ
                                          |-- R2 (įkėlimas)
                                          |-- OpenAI (klausimas, atsakymas)
                                          `-- Resend HTTPS (el. paštas)

Redis / BullMQ --> privatus Worker
                     |-- PostgreSQL + pgvector
                     |-- R2 (skaitymas, pašalinimas)
                     `-- OpenAI (dokumentų embeddings)
```

Tai operatoriaus patvirtinta production schema. Naršyklė negauna DB, Redis, R2 ar AI prisijungimų. Caddy išsaugo `/api` prefiksą; API nepaslepiamas po SPA fallback. Vienas viešas origin supaprastina cookies ir CSRF modelį, tačiau nepakeičia backend autorizacijos.

## 5. Pagrindiniai techniniai sprendimai

| Sprendimas | Kodėl šiame produkte | Kompromisas |
| --- | --- | --- |
| npm workspaces monorepo | Vienu pakeitimu suderinami API, Worker ir bendri kontraktai | Reikia aiškių paketų ribų ir root build konteksto |
| PostgreSQL + Prisma | Ryšiai, transakcijos, savininkai ir migracijos vienoje sistemoje | pgvector operacijoms reikia parametrizuoto SQL |
| pgvector toje pačioje DB | Dokumentai ir vektoriai filtravimo metu turi bendrą autoritetingą būseną | Augant apimčiai reikės matuoti indeksavimo strategiją |
| R2 per adapterį | Originalai nelaikomi reliacinių įrašų turinyje | DB ir saugyklos veiksmai nėra viena transakcija |
| BullMQ + atskiras Worker | PDF ir AI trukmė neblokuoja įkėlimo HTTP užklausos | Reikia idempotentiškumo, atkūrimo ir monitoring |
| Bendros AI abstrakcijos | Verslo logika nepriklauso nuo SDK metodų | Naujam modeliui reikia atnaujinti ir kainodaros politiką |
| Opaque server-side sesijos | Atsijungimas iš tikrųjų atšaukia sesiją | Kiekvienas privatus prašymas tikrina PostgreSQL |

ADR istorija išsaugota. Ankstyvas sprendimas nėra pažadas, kad jo fazės apribojimai vis dar galioja; dabartinė architektūra turi pirmenybę.

## 6. RAG principas

RAG reiškia, kad prieš generuojant atsakymą paimamos aktualios dokumentų ištraukos. Tai nėra modelio mokymas vartotojo failais. Dokumentų embeddings sukuriami background apdorojimo metu ir pakartotinai naudojami paieškai; kiekvienam klausimui sukuriamas užklausos vektorius. Apdorojimo retry gali pakartoti dokumento embeddings generavimą.

```text
Klausimas + ribota šio pokalbio istorija
  -> kontekstinė paieškos užklausa
  -> OpenAI klausimo embedding
  -> pgvector: savininkas + nepašalintas + READY
  -> iki 5 ištraukų pagal kosinuso panašumą
  -> atskirti dialogo, šaltinių ir klausimo blokai
  -> OpenAI Responses API
  -> citatų žymų tikrinimas
  -> ASSISTANT + citatos + metaduomenys PostgreSQL
```

Paieška apima visą tinkamą savininko biblioteką, ne vartotojo pasirinktą vieną dokumentą. Istorija ribota šešiomis ankstesnėmis USER/ASSISTANT žinutėmis ir 6 000 simbolių serializuotu kontekstu. Tęstinumas gerėja, bet nenaudojama ilgalaikė atmintis ar kito pokalbio duomenys.

Jei paieška negrąžina ištraukų, naudojamas fiksuotas nepakankamo konteksto atsakymas ir atsakymo generavimo užklausa nekviečiama. Klausimo embedding išlaida tuo metu jau galima; pirmam sėkmingam pokalbio įrašui gali būti papildomai kuriamas pavadinimas. Citatų žymų tikrinimas neįrodo kiekvieno teiginio teisingumo.

## 7. Dokumento paruošimas

PDF įkėlimas ir indeksavimas yra skirtingi etapai. Įkėlimo atsakymas nereiškia, kad dokumentas jau tinkamas RAG. Redis neperduodamas PDF ar ištrauktas tekstas; Worker vėliau pats užkrauna autoritetingus duomenis.

```text
PDF -> API ribos / kvota / SHA-256
    -> privatus R2 objektas
    -> Document(PENDING)
    -> document.process
    -> PROCESSING: dydis / parašas / izoliuotas parseris
    -> tekstas -> ribotos, surikiuotos dalys
    -> transakcija: DocumentChunk + CHUNKS_READY
    -> document.embed
    -> AI biudžeto rezervacija -> EMBEDDING
    -> OpenAI -> vector(1536) + modelio metaduomenys
    -> transakcija: pilnumo tikrinimas + READY
```

Parseris ribojamas 150 puslapių, 1 000 000 ištrauktų simbolių, 30 sekundžių ir atskira Worker Thread vykdymo riba. Chunker leidžia daugiausia 1 000 dalių. Deterministinis atmetimas saugiai užbaigia dokumentą FAILED prieš embeddings. Tai saugo ir procesą, ir AI išlaidų kelią, bet nėra operacinės sistemos lygio PDF sandbox.

## 8. Saugumo modelis

Saugumas sudarytas iš nepriklausomų ribų. Sesija atsako, kas prisijungė; savininku apribota užklausa - ką jis gali pasiekti; el. pašto patvirtinimas - ar leidžiamos brangios funkcijos; CSRF ir Origin - ar naršyklės mutacija atitinka leistiną kontekstą. Failų ir AI ribos mažina resursų piktnaudžiavimo poveikį.

Svarbiausia invariantė: kito savininko dokumentas negali patekti į vartotojo atsakymo kontekstą net jei jo embedding būtų panašiausias. SQL savininko, deletedAt, READY, modelio ir dimensijų filtrai taikomi iki rikiavimo. Cituojami šaltiniai dar kartą autorizuojami išsaugant atsakymą.

Vieši dokumentų ir pokalbių DTO neatskleidžia saugyklos rakto, failo hash ar vidinio userId; auth DTO sąmoningai pateikia paties prisijungusio vartotojo id. Naršyklė AI ir dokumentų tekstą rodo kaip tekstą, ne HTML. Privatiems API atsakymams nustatytas no-store. Neaprašoma formali atitiktis ar garantija, kad neįmanoma jokia ataka; konkretūs kontrolės mechanizmai ir testų vietos pateikti II dalyje.

## 9. Production topologija

Operatorius patvirtino penkis veikiančius Railway servisus: Web/Caddy, API, Worker, PostgreSQL su pgvector ir Redis. Išorinės paslaugos yra Cloudflare R2, OpenAI ir Resend HTTPS. Viešas įėjimas yra Web HTTPS origin; API pasiekiamas per privatų Caddy upstream.

Web statiniai failai surenkami Node Docker etape ir pateikiami Caddy runtime. API ir Worker startuoja atskirai. API naudoja platformos PORT; patvirtintoje aplinkoje tai 8080. Caddy upstream būtinas būtent API klausomas portas, ne numanomas HTTP 80.

Repozitorija apibrėžia atkartojamą PostgreSQL 16 + pgvector bazę, tačiau faktinė production PostgreSQL versija šiame audite nenuskaityta. Taip pat nepatikrinta domenų, atsarginių kopijų, replica skaičiaus, restart politikos ar tikslaus proxy-hop skaičiaus būsena. Šių reikšmių pavyzdžiai nėra įrodymai apie veikiantį deployment.

## 10. Dabartinis produkto pasirengimas

**Patikrinta kode ir operatoriaus patvirtinta kaip veikianti:** registracija, login, verification, PDF įkėlimas, R2, Worker tekstas ir dalys, embeddings, pgvector retrieval, RAG atsakymai, matomos citatos ir sėkmingai vykdomos cleanup užduotys. Health endpoint rodo API ir DB ryšį.

Frontend turi Overview (kode -- Dashboard, `/dashboard`), dokumentų biblioteką ir detales, upload, FAILED-only Retry, patvirtinamą Delete, Threads (kode -- Chat, `/chat`) su pokalbių sąrašu, sukūrimu, istorija, klausimų siuntimu ir citatų kortelėmis. Dizaino kryptis -- tamsi V4 "Liquid Glass" vizualinė tapatybė (pakeitusi ankstesnę šviesią kryptį), su skaitomais nepermatomais žinių paviršiais ir ribota dekoratyvine animacija; ji apima Auth puslapius, Overview, Documents, Document Details ir Threads. Pokalbio atsakymai dabar transliuojami per Server-Sent Events (žr. architecture.md), o ne grąžinami vienu atsakymu.

Pagrindinis demo kelias veikia, tačiau tai nepaverčia visų operacinių reikalavimų užbaigtais. Šis dokumentacijos auditas nepakeičia production priėmimo matricos, išorinių vartotojų email pristatomumo, atkūrimo bandymo ar monitoring patikros.

## 11. Ribos ir sąmoningi kompromisai

MVP apimtis: PDF su teksto sluoksniu, viena biblioteka vienam vartotojui, sinchroninis chat atsakymas ir tikslioji vektorinė paieška. Nėra OCR, PDF viewer/download, pasirinkto dokumento scope, Markdown interpretavimo, ilgalaikės atminties ar bendrinimo. (Streaming čia anksčiau buvo išvardytas kaip neįgyvendintas -- jis jau įgyvendintas, žr. architecture.md.)

Nėra transakcinio outbox tarp PostgreSQL ir BullMQ ar automatinio reconciliation serviso. Išnaudojusi retry bandymus cleanup užduotis gali palikti paslėptą DB įrašą ir R2 objektą. Toks įrašas vis dar užima unikalų failo hash. Provider klaidų diagnostika nevienoda, o Worker parengtis neturi pilno health kontrakto.

Kode identifikuotos dvi papildomo patikrinimo reikalaujančios embedding atkūrimo ribos: pasikartojantis embedding job ID po manual Retry ir klaida iki EMBEDDING perėjimo. Jos šiame audite neatkartotos ir netaisytos. Šias konkrečias rizikas verta patikrinti prieš platesnį viešą naudojimą, užuot teigus, kad visi užstrigimo atvejai automatiškai atsistato.

# II dalis - techninis žinynas

## 12. Monorepo

| Vieta | Atsakomybė |
| --- | --- |
| `apps/web` | React puslapiai, hook, feature services, DTO validacija ir komponentai |
| `apps/api` | HTTP, autentifikacija, autorizacija, kvotos, dokumentai ir chat |
| `apps/worker` | Apdorojimo, embedding ir šalinimo consumer bei jų servisai |
| `packages/shared` | Eilių kontraktai, Redis parametrai ir bendras biudžeto persistence |
| `packages/ai` | Provider-neutral AI servisai, OpenAI adapteriai ir kainodaros politika |
| `prisma` | Schema, nuoseklios migracijos ir duomenų modelio dokumentacija |
| `docs/decisions` | Sprendimų istorija ir jų kontekstas |

Root package-lock ir npm workspaces yra bendras dependency šaltinis. API/Worker naudoja bendrą generuojamą Prisma Client. Pridėjus workspace negalima jo nepaisyti Docker root kontekste. Bendras paketas nereiškia, kad naršyklei galima eksportuoti serverio paslaptis ar DB klientą.

Šaltiniai: [root scripts](../package.json), [Prisma schema](../prisma/schema.prisma), [architektūra](architecture.md).

## 13. Frontend

Duomenų kelias: page/component -> focused hook -> feature service -> bendras Axios client -> API. Zod tikrina runtime atsakymų formas. Zustand saugo tik saugų vartotojo DTO ir sesijos būseną; feature duomenys laikomi atitinkamuose hook. HTTP atsakymas, ne optimistinė browser kopija, išlieka ID, datų, pavadinimų, citatų ir pokalbio istorijos šaltiniu.

Vieši maršrutai: `/login`, `/register`, `/verify-email`; apsaugoti: `/dashboard`, `/documents`, `/documents/:documentId`, `/chat`, `/chat/:conversationId`. `/ui-kit` demonstruoja komponentus tik development build'e -- production jis neregistruojamas ir nepasiekiamas. Frontend prieigos ribojimas yra UX; tikrasis saugumas vykdomas API.

Dashboard sujungia tris esamus API skaitymus: 5 naujausi dokumentai ir skaitikliai, 3 FAILED dokumentai, 5 naujausi pokalbiai. Tai nėra atskira analytics ar įvykių istorijos sistema. Dokumentai turi pavadinimo paiešką, status filtrą, puslapiavimą, Refresh ir upload. Pokalbio siuntimas apsaugotas nuo pasikartojančio paspaudimo bei pavėluoto kito maršruto atsakymo.

AI turinys ir failų pavadinimai renderinami kaip React tekstas. Citatos page=null nerodo puslapio, ilgas pavadinimas saugiai laužomas. Citatos veda į dokumento metaduomenis. Žinučių turinys ribotas 4 000 simbolių; backend priima tik content. Nėra Markdown/HTML ar automatinio dokumentų būsenų polling. Atsakymas transliuojamas per SSE (`status` / `delta` / `completed` įvykiai), bet pats turinys lieka grynas tekstas.

Šaltiniai: [router](../apps/web/src/app/router.tsx), [Axios client](../apps/web/src/lib/api-client.ts), [messaging hook](../apps/web/src/features/conversations/use-conversation-messaging.ts), [thread](../apps/web/src/features/conversations/components/ConversationThread.tsx).

## 14. API ir sutartys

Express išlaiko route -> controller -> service -> repository -> Prisma/SQL sluoksnius. Middleware nustato saugumo kontekstą ir validuoja užklausą. Controller valdo HTTP, service - use case ir verslo sprendimus, repository - duomenų prieigą. Objektų saugykla, email ir AI yra adapteriai, ne tiesioginiai controller SDK kvietimai.

| Endpoint grupė | Veiksmai |
| --- | --- |
| `/api/auth` | register, login, verify-email, resend-verification, me, csrf-token, logout |
| `/api/documents` | GET sąrašas, POST multipart upload |
| `/api/documents/:documentId` | GET detalės, DELETE asinchroninio cleanup pradžia |
| `/api/documents/:documentId/retry` | POST pilnas FAILED dokumento restart |
| `/api/conversations` | GET sąrašas, POST sukūrimas |
| `/api/conversations/:conversationId` | GET pokalbis su vieša istorija |
| `/api/conversations/:conversationId/messages` | POST vienas content laukas |
| `/api/search` | POST query, owner-scoped semantinės paieškos rezultatai |
| `/api/health` | GET API ir PostgreSQL ryšio būsena |

Sutartys turi istorinių skirtumų: dokumentų list/details ir pokalbiai naudoja `data`, login/me grąžina `user`, upload grąžina `document`, o health yra neapgaubtas. Klaidos turi `error` su stabiliu code ir saugia message. Details/retry dokumento vieši laukai: id, filename, mimeType, size, processingState, processingError, createdAt, updatedAt, processedAt. processingError pateikiamas tik FAILED atveju, kitu metu null; list jo neturi. Upload naudoja atskirą senesnį name/sizeBytes/status DTO. Nei vienas jų neturi būti laikomas tiesioginiu Prisma modeliu ar savavališkai suvienodinamas frontend.

Privatūs skaitymai reikalauja sesijos. Mutacijos papildomai reikalauja CSRF; upload, Retry, search ir message generation - patvirtinto email. Pokalbio sukūrimas, dokumento ištrynimas ir privatūs skaitymai prieinami prisijungusiam nepatvirtintam vartotojui. Tikslios formos, puslapiavimas ir klaidos: [API reference](api.md).

## 15. Duomenų modelis

Schema turi 13 modelių. Įprasti ID generuojami CUID; išimtis - mėnesį identifikuojantis `AiBudgetPeriod.periodStart`. Laiko tikslumas `Timestamptz(3)`. Prisma naujojo client generatoriaus output yra bendras `generated/prisma`; DATABASE_URL nustatomas Prisma konfigūracijoje.

| Modelis | Paskirtis ir svarbiausi ryšiai |
| --- | --- |
| User | Unikalus email, passwordHash, optional name, emailVerifiedAt; nuosavybės pradžia |
| Document | userId, name, storageKey, mimeType, sizeBytes, fileHash, status, processingError, metadata, processedAt, deletedAt |
| DocumentChunk | Document dalis, position, content, tokenCount, metadata, vector ir modelio parametrai |
| Conversation | Savininkas, optional title, deletedAt, laiko žymos |
| Message | Conversation, role, content, citations JSON, aiMetadata JSON, šaltinių ryšiai |
| Session | Token hash, userId, expiresAt, revokedAt |
| EmailVerificationToken | Atskiro token hash, expiresAt, usedAt |
| RefreshToken | Istorinis nenaudojamas modelis; ne aktyvus auth kelias |
| DocumentQuotaReservation | Upload/delete rollback talpos ir processing rezervacijos |
| AiTurnReservation | Rolling-window USER AI turn priėmimas ir commit |
| AiBudgetPeriod | Globalus UTC mėnesio rezervuotas ir įvertintas sunaudotas biudžetas |
| AiBudgetReservation | Provider operacijos, modelio, savininko ir sumos rezervacija |
| AiUsageRecord | Vienos rezervacijos token usage ir micro-USD įvertis |

User -> Document -> DocumentChunk ir User -> Conversation -> Message yra pagrindinės šakos. Dokumento dalys turi many-to-many ryšį su jas cituojančiomis žinutėmis. Pašalinus dokumentą dalys ir jų vektoriai pašalinami; istorinis Message.citations JSON nėra perrašomas. AI ledger naudotojo ryšiai gali tapti SetNull, o biudžeto ir usage ryšiai saugomi Restrict taisyklėmis.

Document turi globaliai unikalų storageKey ir `@@unique([userId, fileHash])`. Šis apribojimas apima ir soft-deleted įrašus. Chunk turi `@@unique([documentId, position])`; embedding yra nullable `Unsupported("vector(1536)")`, ne atskira lentelė. metadata skirta lankstiems duomenims, tačiau esamas Worker automatiškai neįrašo bendro puslapių skaičiaus į Document.metadata.

Šaltiniai: [schema](../prisma/schema.prisma), [DB reference](../prisma/README.md), [Prisma config](../prisma.config.ts).

## 16. Dokumento gyvavimo ciklas

Normalus kelias: PENDING -> PROCESSING -> CHUNKS_READY -> EMBEDDING -> READY. FAILED reiškia terminalinį apdorojimo nesėkmės rezultatą; tarpinis automatinio bandymo sutrikimas nėra iškart terminalinė būsena. processedAt nustatomas užbaigiant embeddings. Saugi processingError prasmė nesutampa su pilnais diagnostiniais logais.

Manual Retry leidžiamas tik savininko nepašalintam FAILED dokumentui. Išlaikomi ID ir originalas, pašalinamos senos dalys ir vektoriai, išvaloma klaida, nustatoma PROCESSING ir sukuriama nauja processing užduotis. Nepavykus enqueue, būsenos kompensacija sąlyginė; pašalintos senos dalys neatkuriamos. Galimas vėlesnis embedding job ID konfliktas aprašytas 33 skyriuje.

```text
DELETE + sesija + CSRF + savininkas
  -> kvotos rollback hold + deletedAt
  -> neberodomas list / details / naujame RAG
  -> document.delete -> 202 Accepted
  -> Worker: autoritetingas soft-deleted įrašas
  -> pašalinti R2 objektą
  -> DB transakcija: chunks / vektoriai / source links
  -> Document hard delete
```

**Kontrolė:** soft delete iškart nutraukia naują prieigą, bet HTTP nelaukia išorinio storage cleanup. **Priežastis:** lėtas R2 neturi laikyti browser mutacijos atviros; DB įrašas išsaugo cleanup adresą. **Mechanizmas:** owner-scoped sąlyginis atnaujinimas, kvotos rollback rezervacija, identifier-only užduotis ir storage-first cleanup. **Vieta:** [API deletion service](../apps/api/src/services/document-deletion.service.ts), [Worker deletion service](../apps/worker/src/services/document-deletion.service.ts). **Įrodymai:** API delete ir Worker cleanup testai apima foreign/deleted/missing, enqueue failure, pakartotinį vykdymą bei saugyklos nesėkmę; šiame audite tik perskaityti.

Jei R2 pašalinimas nepavyksta, DB eilutė lieka paslėpta. Reupload jos neatkuria: tas pats savininkas ir failo hash tebėra unikalus. Įkėlimas gali būti atmestas net kai seno failo nesimato UI. Sėkmingas hard cleanup šį konkretų blokavimą pašalina.

## 17. Eilės ir užduotys

| BullMQ eilė | Užduoties vardas | Producer -> consumer |
| --- | --- | --- |
| document-processing | document.process | API -> processing Worker |
| document-embedding | document.embed | processing Worker -> embedding Worker |
| document-deletion | document.delete | API -> cleanup Worker |

Visų payload yra tik documentId ir userId. Queue name nėra tas pats, kas job name. Duomenų savininkas ir storage key tikrinami DB; payload pats savaime nesuteikia leidimo. Redis papildomai naudojamas rate-limit langams, bet nėra dokumentų ar sesijų autoritetinga saugykla.

Visų trijų eilių politika: 3 bendri bandymai, exponential backoff nuo 1 000 ms. Completed retention: 3 600 s / 1 000 užduočių; failed: 24 h / 5 000. Tai BullMQ pašalinimo parinktys, ne garantuotas tiksliai tą sekundę veikiantis cleanup laikrodis.

Pradiniai ID yra document-, embedding- arba deletion- su dokumento ID. Manual processing Retry gauna naują UUID. To paties job ID pridėjimas nėra tas pats, kas failed job retry. Terminalinio cleanup atkūrimas šiuo metu operacinis veiksmas; nėra vartotojo cleanup retry API ar reconciliation serviso.

Šaltiniai: [queue contracts](../packages/shared/src/queue/document-processing.ts), [embedding producer](../apps/worker/src/queues/document-embedding.queue.ts), [cleanup producer](../apps/api/src/queues/document-deletion.queue.ts).

## 18. Worker

Vienas Node procesas paleidžia tris atskirus consumer. Processing ir embedding concurrency numatytai po 1, konfigūruojami atskirai; cleanup concurrency yra 1. Tai per-process riba: keli replica gali kartu atlikti daugiau darbo. SIGTERM/SIGINT uždaro consumer, producer ir Prisma ryšius.

Service koordinuoja, repository mutuoja duomenis, storage tik gauna ar pašalina failą, parser ir chunker izoliuoti servisais. Chunk replacement ir CHUNKS_READY saugomi vienoje transakcijoje. Embedding completion parametrizuotu SQL atnaujina vektorius, patikrina komplektiškumą ir owner/deletion/state sąlygas prieš READY.

Processing ir embedding kiekviename svarbiame žingsnyje tikrina būseną. Pašalintas dokumentas nebegali sėkmingai užbaigti naujų dalių ar vektorių įrašymo. Tačiau ištrynimas jau vykstančio provider kvietimo nebūtinai atšaukia ar grąžina jo kainą. Dingęs dokumentas yra saugus no-op; dingusi Redis užduotis savaime nėra DB būsenos sutvarkymas.

Retryable klaida išmetama BullMQ; terminalinis bandymas bando saugiai pažymėti FAILED. Neatkuriamos PDF klaidos naudoja UnrecoverableError. State guard išimtys ir prieš EMBEDDING kylantys gedimai riboja universalią pažadą, kad kiekviena terminalinė užduotis visada paliks FAILED; žr. 33 skyrių.

Šaltiniai: [entry point](../apps/worker/src/worker.ts), [processing service](../apps/worker/src/services/document-processing.service.ts), [embedding service](../apps/worker/src/services/embedding-processing.service.ts), [Worker reference](../apps/worker/README.md).

## 19. Objektų saugykla

Originalas saugomas per application-owned storage abstrakciją. Lokaliai naudojamas filesystem adapteris; production - privatus R2 per S3-compatible SDK. API įkelia originalą, Worker atsisiunčia apdorojimui arba pašalina cleanup metu. Nauji objektų raktai nekuriami iš tiesiogiai patikėto vartotojo kelio.

**Kontrolė:** originalų neprieinamumas tiesiogiai iš browser. **Priežastis:** storage raktas neturi tapti aplinkkeliu aplenkiant owner query. **Mechanizmas:** DB saugo privatų storageKey, viešas DTO jo negrąžina, Worker naudoja DB reikšmę. **Vieta:** API/Worker `infrastructure/storage` ir document repositories. **Įrodymai:** safe DTO, owner mismatch ir cleanup testai; tikri production bucket ACL ir credentials permissions šiame audite nenuskaityti.

Storage ir PostgreSQL nesudaro bendros transakcijos. Po nepavykusio DB įrašo API bando pašalinti naują objektą. Po nepavykusio enqueue taikoma sąlyginė kompensacija. Crash ar išorinis gedimas gali palikti orphan objektą arba įrašą; automatinis abiejų sistemų sutikrinimas dar neįgyvendintas.

Prieš parserį R2 ContentLength arba lokalaus failo metaduomenys lyginami su Document.sizeBytes, po buferizavimo tikrinamas faktinis baitų skaičius ir `%PDF-`. Tai remiasi API pritaikytu upload limit. Atskirai neįgyvendintas streaming parser ar signed original-file URL endpoint.

Šaltiniai: [R2 retrieval](../apps/worker/src/infrastructure/storage/r2-object-storage.ts), [stored file validation](../apps/worker/src/services/pdf-file-validation.ts).

## 20. Embeddings ir vektorinė paieška

Bendras embedding servisas naudoja `text-embedding-3-small`, 1 536 dimensijas ir nuoseklias iki 100 tekstų partijas. Patikrinamas įvesčių netuštumas, rezultatų kiekis, vektoriaus ilgis ir baigtinės skaitinės reikšmės. Adapteris kviečia `client.embeddings.create` su input, model, dimensions ir `encoding_format: float`; timeout 30 s, SDK retries 0.

DocumentChunk išlaiko vieną nullable vektorių ir embeddingModel/embeddingDimensions laukus. Keli bandymai nekuria naujos embedding lentelės ar antro tos pačios dalies įrašo. Atitinkantys esami vektoriai gali būti praleidžiami; reikalingų partijų rezultatai pirmiausia surenkami, tada įrašomi transakcijoje. Nėra kiekvienos partijos durable checkpoint.

Paieškos repository vykdo parametrizuotą SQL: cosine distance operatorius `<=>`, similarity = 1 - distance. Owner, deletedAt IS NULL, READY, embedding buvimas, modelis ir dimensijos apriboja kandidatus prieš ORDER BY ir LIMIT. Numatyta top K = 5.

Šiuo metu nėra HNSW/IVFFlat indekso, minimalios relevance ribos, reranker ar lexical-hybrid paieškos. Top 5 reiškia geriausius turimus kandidatus, ne garantuotai pakankamus atsakymui. Indeksą reikėtų rinktis po realios apimties ir retrieval kokybės matavimo, išsaugant owner filtrą.

Šaltiniai: [embedding abstraction](../packages/ai/src/embedding.service.ts), [OpenAI embeddings](../packages/ai/src/openai-embedding.provider.ts), [vector repository](../apps/api/src/repositories/vector.repository.ts), [vector persistence](../apps/worker/src/repositories/embedding.repository.ts).

## 21. RAG atsakymų generavimas

Vienas kelias aptarnauja chat: conversation service -> retrieval service -> grounded prompt -> bendras chat generation service -> OpenAI adapteris. Nėra antro nepriklausomo AI pipeline. Klausimo istorija sujungiama deterministiškai, ne papildomu LLM rewrite kvietimu.

Tiksli generavimo vieta: `OpenAIChatGenerationProvider.generateAnswer` bendrame AI pakete. Naudojamas **OpenAI Responses API**, ne Chat Completions. Užklausos forma:

```text
client.responses.create
  model: konfigūruotas input.model
  instructions: systemInstructions
  input: viena USER input_text žinutė su atskirais blokais
  max_output_tokens: input.maxOutputTokens
  store: false
```

Blokai: optional conversation_context, retrieved_context, user_question. Nesiunčiami tools, temperature, reasoning parametrai, previous_response_id ar provider-managed conversation. Atsakymas nestriminamas. SDK maxRetries=0, timeout=60 s. Numatyta atsakymo išvesties riba 1 200 tokenų; pirmo pokalbio pavadinimo generavimui - 64.

Prompt draudžia vykdyti instrukcijas iš dokumentų ar dialogo, nurodo istoriją naudoti tik nuorodoms suprasti, o faktus grįsti naujais šaltiniais. Šaltiniams suteikiamos [S1], [S2] ir kitos žymos. Atsakyme tikrinama, ar naudotos leistinos žymos; substanciniam atsakymui jų reikia. Tai nėra automatinis semantinis visų teiginių faktų tikrinimas.

Fiksuotas nepakankamo konteksto tekstas: "The available documents do not contain enough information to answer this question." Kai retrieval negrąžina ištraukų, deterministinis atsakymas neįskaitomas į turn kvotą. Jei nepakankamą kontekstą nurodo jau pakviestas modelis, dabartinis generavimo kelias išsaugo atsakymą ir įskaito turn. Abiem atvejais jau atliktas embedding ar title nėra nemokamas provider veiksmas.

Provider/usage klaidos generavimo bloke paprastai paverčiamos saugiu `503 AI_PROVIDER_UNAVAILABLE`. Budget denial turi atskirą saugų kontraktą. Originali generavimo priežastis šiame kelyje neišsaugoma ir neloginama, o AppError middleware grąžina atsakymą be log. Todėl Railway gali nesimatyti naudingo provider klaidos paaiškinimo. Tai dokumentuota diagnostikos spraga, ne pataisyta šiame darbe.

Šaltiniai: [OpenAI Responses adapter](../packages/ai/src/openai-chat-generation.provider.ts), [prompt builder](../apps/api/src/services/rag-prompt.service.ts), [conversation orchestration](../apps/api/src/services/conversation.service.ts), [error middleware](../apps/api/src/middleware/error-handler.ts).

## 22. Pokalbiai ir citatos

Conversation ir Message priklauso serverio valdomam savininkui. Kiekvienas naujas klausimas persiunčiamas tik kaip content, iki 4 000 simbolių. Klientas negali pateikti savų šaltinių, userId, modelio ar istorijos. API išsaugo USER, pasiekia ribotą ankstesnį kontekstą ir išsaugo ASSISTANT kartu su autorizuotomis citatomis.

Kontekstas: iki 6 naujausių ankstesnių USER/ASSISTANT žinučių, tik to paties aktyvaus savininko pokalbio. Dabartinė USER žinutė neįtraukiama antrą kartą. Serializuojama chronologiškai iki 6 000 simbolių su role žymomis ir separatoriais; pirmiausia atsisakoma senesnių blokų. Jei vien naujausias blokas per ilgas, jis trumpinamas. Tai apytikriai trys apsikeitimai, ne griežtai suporuoti turn.

Message.citations yra serverio sukurtas šaltinių snapshot: label, documentId, documentName, chunkId, chunkPosition, page arba null. `aiMetadata` atskirai registruoja provider, modelį, trukmę ir token usage. Įvertinta kaina yra AI ledger, ne viešame Message DTO. Nėra atskiro Citation modelio.

Assistant persistence dar kartą patikrina kiekvieno source chunk savininką, nepašalinimą ir READY būseną. Istorinė citata gali išlikti pašalinus originalų dokumentą; nauji retrieval rezultatai jo nenaudoja, source relation pašalinama, Details rodo generic unavailable. Snapshot nėra leidimas pasiekti failą.

Pirmam sėkmingam turn pavadinimas generuojamas best effort iš pirmo klausimo, po valymo iki 7 žodžių / 80 simbolių. Nesėkmė neanuliuoja atsakymo, title gali likti null. Pokalbių sąraše preview yra naujausia USER žinutė. Nėra ilgalaikės atminties, summarization ar cross-conversation konteksto.

Šaltinis: [conversation repository](../apps/api/src/repositories/conversation.repository.ts). Svarbus kompromisas: nėra idempotency key ar vieno pokalbio užklausų serializavimo; crash metu best-effort USER kompensacija gali neįvykti.

## 23. Autentifikacija ir sesijos

**Kas:** opaque PostgreSQL sesija, ne JWT. **Kodėl:** backend gali atšaukti prisijungimą ir vertinti dabartinę vartotojo būseną. **Kaip:** po password patikros sukuriamas 32 atsitiktinių baitų base64url credential; DB saugo tik SHA-256 hash, galiojimą ir atšaukimo laiką. **Kur:** session service/repository, authenticate middleware ir auth cookie konfiguracija. **Patikra:** session bei auth integration testai apima galiojimą, atšaukimą, senų credentials nepripažinimą ir prieigos ribas; naujai nevykdyti.

```text
Login -> bcrypt password patikra
      -> atsitiktinis opaque credential
      |-- raw token -> HttpOnly cookie
      `-- SHA-256 hash -> Session PostgreSQL

Privatus prašymas + cookie
      -> hash -> aktyvi, neatšaukta Session + User
      -> req.user -> owner-scoped veiksmas

Logout -> Session.revokedAt -> cookie išvalymas
```

Sesija galioja fiksuotai 7 dienas, be sliding renewal. Kiekvienas protected request tikrina DB. Production cookie `__Host-developer-knowledge-hub-session` yra HttpOnly, Secure, SameSite=Lax, path=/, be Domain. Lokaliam HTTP naudojamas kitas cookie vardas. Credential nepatenka į localStorage, sessionStorage, Zustand ar JS-readable cookie.

Logout atšaukia esamą sesiją; kitos sesijos lieka galiojančios. Vidinis revoke-all yra, bet viešo session-management endpoint/UI nėra. Password hashing naudoja bcryptjs cost 12; input email normalizuojamas, slaptažodis min. 8 simboliai ir max. 72 UTF-8 baitai. RefreshToken modelis paliktas istoriniam migration saugumui, tačiau nenaudojamas autentifikacijai.

Šaltiniai: [session service](../apps/api/src/services/session.service.ts), [authenticate](../apps/api/src/middleware/authenticate.ts), [cookie](../apps/api/src/config/auth-cookie.ts), [password](../apps/api/src/utils/password.ts).

## 24. El. pašto patvirtinimas

Registracija naujam ir jau egzistuojančiam normalizuotam email grąžina tą patį `202 VERIFICATION_REQUIRED`; duplicate registration nesiunčia naujo laiško ir nesukuria sesijos. Naujai paskyrai transakcijoje sukuriamas vartotojas ir hashed verification token. Token yra atskiras 32 baitų atsitiktinis credential, galioja 60 minučių ir panaudojamas vieną kartą.

EmailVerificationSender abstrakciją production realizuoja Resend HTTPS API. Pasirinktinai išlieka SMTP, o development - apribotas console adapteris. Resend perduodami from, to, subject ir text; production reikia RESEND_API_KEY bei EMAIL_FROM, ne SMTP nustatymų.

Nuoroda naudoja patikrintą APP_BASE_URL ir `/verify-email#token=...`. Frontend pašalina fragmentą iš matomo URL ir perduoda token API. Authenticated resend anuliuoja ankstesnius nepanaudotus token. Jau patvirtintas vartotojas papildomo laiško negauna.

Nepavykus pradiniam pristatymo kvietimui registracija lieka generic 202, paskyra - nepatvirtinta; vėliau galima authenticated resend. Pakartotinio siuntimo endpoint klaida grąžinama kaip saugus 503, o siuntimo diagnostika loguojama ribotais klasifikavimo metaduomenimis, be gavėjo/token/key/raw provider response. Provider acceptance nėra garantija, kad laiškas pateko į inbox.

Operatorius patvirtino veikiančią production verification. Faktinis EMAIL_FROM, patvirtintas custom sender domain ir pristatymas bet kuriam išoriniam gavėjui šiame audite nepatikrinti. Negalima vien iš adapterio pasirinkimo jų laikyti užbaigtais.

Šaltiniai: [email service](../apps/api/src/services/email-verification.service.ts), [Resend adapter](../apps/api/src/infrastructure/email/resend-email-verification.sender.ts), [ADR-0011](decisions/0011-server-sessions-email-verification.md).

## 25. Autorizacija

**Kas:** savininkas riboja užklausą DB lygiu. **Kodėl:** ID pakeitimas URL neturi atskleisti svetimų dokumentų, pokalbių ar RAG šaltinių. **Kaip:** userId imamas tik iš patikrintos sesijos, private repository užklausa apjungia resource ID, owner ir deletion predicates; public DTO yra explicit select. **Kur:** document/conversation/vector repositories ir Worker owner/state guards. **Patikra:** realių repository ir pgvector testų scenarijai su artimesniu svetimu vektoriumi, foreign URL, source conflicts ir suklastotu queue owner perskaityti; šiame audite neleisti.

Nerastas, svetimas arba soft-deleted dokumentas turi vienodą 404 DOCUMENT_NOT_FOUND. Pokalbiams taikomas atitinkamas generic contract. SYSTEM žinutės neišduodamos kaip vartotojo istorija. Citatos priimamos tik iš serverio retrieval, ne iš browser request.

Tai application-level autorizacija, ne PostgreSQL Row-Level Security. Naujas query kelias turi pakartoti tą pačią ribą. Redis užduotys yra patikimos infrastruktūros įvestis, tačiau Worker vis tiek tikrina dokumento savininką ir būseną prieš storage/AI/DB veiksmus.

Šaltiniai: [document repository](../apps/api/src/repositories/document.repository.ts), [conversation authorization tests](../apps/api/src/routes/conversation-authorization.integration.test.ts), [vector tests](../apps/api/src/repositories/vector.repository.integration.test.ts), [security reference](security.md).

## 26. Naršyklės saugumo riba

**CSRF / Origin. Kas:** ankstyvas Origin ir sesijai pririštas CSRF tikrinimas. **Kodėl:** HttpOnly cookie browser siunčia automatiškai, todėl vien autentifikacijos neužtenka mutacijai. **Kaip:** unsafe POST/PUT/PATCH/DELETE Origin privalo tiksliai sutapti su CORS_ORIGIN prieš JSON parser, rate limiter ar multipart. Trūkstamas, null ar svetimas origin atmetamas. Authenticated mutacijoms tikrinamas X-CSRF-Token, HMAC-SHA256 iš raw session credential ir serverio CSRF_SECRET. **Kur:** browser-security middleware, csrf service ir Axios interceptor. **Patikra:** missing/invalid/cross-session token, Origin ir multipart-atmetimo regression scenarijai.

Frontend CSRF token gauna per `/api/auth/csrf-token`, saugo tik modulio atmintyje ir prideda automatiškai. Login, register ir verify-email nereikalauja sesijai pririšto CSRF, bet privalo praeiti Origin kontrolę. CORS leidžia credentialed vieno explicit origin atsakymus; tai nėra owner autorizacijos pakaitalas.

**Privatumas ir headers. Kas:** private API `Cache-Control: private, no-store`; CSP self, object-src none, base-uri none, frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy ir X-Frame-Options DENY. **Kodėl:** riboti duomenų cache, framing ir aktyvaus turinio paviršių. **Kaip:** API middleware, o frontend HTML - Caddy. API HSTS įjungiamas validžiai HTTPS production konfiguracijai; Caddy production profilis taip pat jį pateikia. **Kur:** API app/browser-security ir Web Caddyfile. **Patikra:** API/browser header bei frontend konfiguracijos testai. Early Origin rejection dar nepasiekia private router no-store middleware, bet negrąžina privataus payload.

Statiniai hashed frontend assets gali būti viešai cache'inami vienerius metus; kitas frontend turinys revaliduojamas. Production CORS_ORIGIN ir APP_BASE_URL turi būti vienodi canonical HTTPS origin. TRUSTED_PROXY_HOPS privalomas 0-2 diapazone. Teisingas faktinis hop skaičius bei spoof-resistant req.ip tikrinami konkrečiame Railway deployment, ne vien unit testu.

Šaltiniai: [browser boundary](../apps/api/src/middleware/browser-security.ts), [CSRF](../apps/api/src/services/csrf.service.ts), [regression](../apps/api/src/routes/browser-security.integration.test.ts), [Caddyfile](../apps/web/Caddyfile).

## 27. PDF apdorojimo ribojimas

**Kas:** ribotas multipart, storage validation ir termination-capable parser. **Kodėl:** nedidelis PDF gali pareikalauti neproporcingo CPU, atminties, teksto ar AI darbo. **Kaip:** žemiau nurodyti check atliekami prieš downstream etapą; viršyta riba sukelia typed non-retryable klaidą ir neleidžia embeddings. **Kur:** central pdf-processing config, upload middleware, parser core/thread ir chunking service. **Patikra:** timeout, crash, valid-after-failure, page/text/chunk, malformed file ir zero downstream work scenarijai yra testuose; šiame audite nevykdyti.

| Kontrolė | Dabartinė riba |
| --- | --- |
| Upload bytes | 10 MiB pagal nutylėjimą; MAX_UPLOAD_SIZE_BYTES konfigūruojamas |
| Multipart | 1 failas, 0 tekstinių laukų, daugiausia 2 parts |
| PDF puslapiai | 150 |
| Ištrauktas tekstas | 1 000 000 JS string code units |
| Dalys | 1 000, kiekviena iki 1 200 code units |
| Parser vykdymas | 30 000 ms, tikras Worker.terminate |
| Thread JS resursai | old generation 256 MiB, young 32 MiB, stack 4 MiB |

Pipeline: upload validation -> stored size/signature -> page limit -> izoliuotas tekstas su cumulative limit -> chunk limit -> transaction -> embedding job. `pdf-parse` vykdomas atskirame thread su isEvalSupported=false ir stopAtErrors=true. Deklaruotas puslapių skaičius patikrinamas prieš pilną extraction, tekstas renkamas po vieną puslapį. Timeout neapsiriboja Promise.race: parser thread iš tikrųjų nutraukiamas.

Chunking deterministinis ir page-aware: normalizuojami tarpai, pašalinami NUL, pirmenybė žodžio ribai po 60 % maksimalaus ilgio, nėra overlap. Position nulinis ir bendras dokumentui. tokenCount yra `ceil(length / 4)` įvertis, ne tikras tokenizer. Metadata išsaugo puslapį ir įverčio metodą.

Ribų klaidos: PDF_PAGE_LIMIT_EXCEEDED, PDF_TEXT_LIMIT_EXCEEDED, PDF_CHUNK_LIMIT_EXCEEDED, PDF_PROCESSING_TIMEOUT; parser crash ir netinkamas stored file turi papildomus saugius kodus. Atmestas dokumentas šiuo keliu nesukuria chunks, embedding job, provider call ar embedding budget reservation. Image-only dokumentui nėra OCR.

Thread nėra OS sandbox ar bendro proceso RSS hard cap: native allocations ir bendras Node procesas išlieka rizikos ribos. Originalas dar buferizuojamas visas, remiantis API dydžio limitu. Griežtesnę izoliaciją reikėtų vertinti pagal apkrovą ir grėsmių modelį.

Šaltiniai: [central limits](../apps/worker/src/config/pdf-processing.ts), [parser](../apps/worker/src/services/pdf-parser.service.ts), [chunker](../apps/worker/src/services/document-chunking.service.ts), [multipart](../apps/api/src/middleware/document-upload.ts).

## 28. Kvotos ir AI išlaidų kontrolė

**Srauto ribos. Kas:** Redis fixed-window burst controls. **Kodėl:** mažinti login, upload ir AI piktnaudžiavimo dažnį. **Kaip:** atominiu Redis skaitikliu ir TTL ribojamas IP, email arba user; neveikiant limiter saugiai fail closed 503. **Kur:** auth-rate-limit config ir Redis limiter. **Patikra:** limiter bei route regression testai. Patikimas req.ip priklauso ir nuo production proxy konfiguracijos.

| Veiksmas | Numatyta burst riba |
| --- | --- |
| Register | 5 / IP / val. |
| Login | 30 / IP / 15 min. ir 10 / email / 15 min. |
| Verification resend | 3 / user / val. ir 5 / IP / val. |
| Verification submit | 20 / IP / val. |
| Upload | 20 / IP / val. |
| AI / search | 60 / IP / val. |

**Savininko resursai. Kas:** durable PostgreSQL admission. **Kodėl:** vien rate limit neužkerta concurrent talpos viršijimo. **Kaip:** User FOR UPDATE serializuoja skaičiavimą; aktyvūs įrašai ir nepasibaigusios rezervacijos vertinami kartu. **Kur:** resource-quota ir ai-turn-quota repositories. **Patikra:** concurrent admissions, quota rollback, expiry ir owner integration scenarijai.

Numatyta vienam savininkui: 25 nepašalinti dokumentai; 150 MiB originalų (157 286 400 baitų); 2 aktyvūs pipeline; 30 išsaugotų AI generavimo turn per slenkantį 24 h langą. Tuščio retrieval deterministinis atsakymas neskaičiuojamas, o modelio atsisakymas po netuščio retrieval šiuo metu skaičiuojamas. FAILED ir READY užima dokumentų/baitų kvotą, bet ne processing slot. Retry naudoja slot, ne naują dokumentą ar originalo baitus. Dokumentų reservation TTL 15 min., AI turn - 10 min.; expiry sutikrinamas lazy po tais pačiais lock.

**Globalus AI biudžetas. Kas:** vieno UTC mėnesio admission ir ledger, pagal nutylėjimą 20 USD. **Kodėl:** riboti keturis provider kelių tipus: klausimų embeddings, atsakymus, title ir dokumentų embeddings. **Kaip:** užrakinamas AiBudgetPeriod, tikrinama committed + reserved + naujas įvertis; sumos sveiki micro-USD. Rezervacija prieš kvietimą, naudojimas po jo, nežinoma provider klaida konservatyviai įskaitoma rezervuotu įverčiu. **Kur:** shared resource-guard, API/Worker budget wrappers ir AI pricing. **Patikra:** concurrent oversubscription, unknown model, expiry, warnings ir embedding delay testai.

Modelių kainodaros kataloge yra tik text-embedding-3-small ir gpt-5.6-sol. Tai lokali išlaidų politika, ne patvirtintas viešas kainoraštis. Nežinomas modelis atmetamas dar prieš provider call. Input rezervavimas naudoja konservatyvų UTF-8 baitų įvertį ir output ribą; faktinis ledger gali remtis reported usage. 50 % ir 80 % perspėjimai pažymimi kartą per mėnesį. Budget reservation TTL 15 min.

Biudžetas nėra provider sąskaitos hard cap ar kitų to paties API key vartotojų kontrolė. Crash, rezervacijos expiry ir neapibrėžta provider apskaita reikalauja atskiro billing monitoring. Kai dokumentui biudžeto nėra, job atidedamas iki tinkamo rezervacijos expiry ar kito UTC mėnesio, bent 60 s, paprastai paliekant CHUNKS_READY. Cleanup ir skaitymai nuo biudžeto nepriklauso.

Šaltiniai: [resource limits](../apps/api/src/config/resource-limits.ts), [quota repository](../apps/api/src/repositories/resource-quota.repository.ts), [budget ledger](../packages/shared/src/resource-guard/ai-budget.ts), [model pricing policy](../packages/ai/src/pricing.ts).

## 29. Diegimas

Web Dockerfile yra vienintelis application Dockerfile. Node 22.23.2-alpine etape iš root workspaces vykdomas npm ci ir build:web; Caddy 2.11.4-alpine pateikia dist iš `/srv`. Tai repozitorijoje užfiksuoti image tag, ne pažadas, kad jie visada naujausi ar konkretaus production image digest įrodymas.

API `build:api` ir Worker `build:worker` generuoja Prisma Client bei tikrina TypeScript. Start komandos vykdo TypeScript per tsx, ne dist JavaScript bundle; tai reikalinga ir parser thread pakrovimo modeliui. Visų app servisų build root turi būti monorepo root. API migration owner komanda yra `prisma:migrate:deploy`; Worker migracijų nekartoja.

| Servisas | Konfigūracijos atsakomybė |
| --- | --- |
| Web | Dockerfile build/start; public HTTPS; API_UPSTREAM host:port; /healthz |
| API | build:api, start:api, vienas prisma:migrate:deploy; private PORT; /api/health |
| Worker | build:worker, start:worker; private; trys consumer; ne HTTP servisas |
| PostgreSQL | pgvector prieinamas ir migration įjungtas; persistent duomenys |
| Redis | privatus queue/limiter ryšys; persistence/recovery parinktys tikrinamos deployment |

Caddy auto_https off reiškia TLS užbaigimą platformos edge. Browser kreipiasi į savo origin `/api`, o API_UPSTREAM yra tik serverio runtime reikšmė. VITE_API_BASE_URL production paliekamas `/` arba nenurodomas, ne privatus Railway DNS. Upstream privalo įtraukti faktinį API portą; operatoriaus aplinkoje - 8080.

**Privatus tinklas. Kas:** backend, DB ir Redis nepasiekiami kaip viešas browser API kelias. **Kodėl:** mažinti tiesioginį infrastruktūros paviršių. **Kaip:** Railway private networking ir Caddy gateway. **Kur:** deployment nustatymai, env validacija, Redis family=0. **Patikra:** schema patvirtinta operatoriaus; realus public exposure, TLS ir hop skaičius šiame audite nepatikrinti.

Repozitorijoje nerasta pilno Railway IaC ar `.github` CI workflow, todėl dashboard nustatymai yra atskiras operational state. [Deployment reference](deployment.md) pateikia atkuriamą blueprint, ne įrodymą, kad visos ten esančios opcijos taikytos production.

## 30. Runtime konfigūracija

| Sritis | Reikšmės ir saugojimas |
| --- | --- |
| Browser | VITE_API_BASE_URL; jokių secret ar privačių host vardų |
| Web runtime | PORT, API_UPSTREAM; reverse proxy tikslas tik serveryje |
| API origins | NODE_ENV, CORS_ORIGIN, APP_BASE_URL, TRUSTED_PROXY_HOPS |
| API sesijos / email | CSRF_SECRET; EMAIL_DELIVERY_DRIVER=resend; RESEND_API_KEY, EMAIL_FROM |
| API ir Worker | DATABASE_URL, REDIS_URL, storage driver ir R2 credentials |
| AI | OPENAI_API_KEY, EMBEDDING/CHAT modelių konfiguracija, output/budget limit |
| Worker | processing/embedding concurrency; PDF ribos central kode |

**Paslaptys. Kas:** tik serverio aplinkoje laikomi credentials. **Kodėl:** frontend bundle ir vieši DTO yra matomi vartotojui. **Kaip:** serverio env, atskiros Web/API/Worker atsakomybės, fail-fast missing values, jokio raw token persistence browser. **Kur:** API/Worker environment moduliai ir Web base URL validacija. **Patikra:** environment ir public DTO testai; Railway secret rotacija bei realių teisių auditas šioje užduotyje neatliktas.

Production reikalauja explicit HTTPS origin, sutampančio APP_BASE_URL, CSRF secret min. 32 simbolių, bounded proxy trust, tinkamo storage driver ir pasirinktų provider reikšmių. Tai nepatvirtina key galiojimo, modelio prieinamumo, R2 endpoint URL kokybės ar privataus DB/Redis tinklo. Ne tuščias R2_ENDPOINT dar gali būti neteisingas.

Modelio konfigūracija turi atitikti kodą ir kainodaros katalogą. Operatorius patvirtino gpt-5.6-sol pasirinkimą; kito modelio bandymas buvo sustabdytas dėl trūkstamos kainodaros metadata prieš OpenAI kvietimą. Tai eksploatacijos apribojimas, ne produkto funkcija ir ne modelių kokybės palyginimas.

Šaltiniai: [API environment](../apps/api/src/config/environment.ts), [Worker environment](../apps/worker/src/config/environment.ts), [Web base URL](../apps/web/src/lib/api-base-url.ts), [environment examples](../.env.example). Dokumentacijoje nenaudojamos realios secret reikšmės.

## 31. Health ir parengtis

`GET /api/health` atlieka paprastą PostgreSQL SELECT 1 ir grąžina API running bei DB connected/disconnected, status ir timestamp. Sveikai DB grąžinamas 200, sutrikus ryšiui 503. Tai įrodo API ir DB kelią, ne Redis, R2, Resend ar OpenAI funkcionalumą.

Web `/healthz` grąžina Caddy atsakymą ir neįrodo API ar visos aplikacijos parengties. Worker HTTP health endpoint neturi; startup log nėra garantija, kad jis sėkmingai atsisiųs PDF ar prisijungs prie provider. Visos pipeline parengtis tikrinama atskiru kontroliuojamu smoke testu.

Deploy activation check nėra nuolatinio monitoring pakaitalas. Proceso gyvybingumą, queue lag, exhausted failures, DB/storage neatitikimus ir provider/biudžeto sutrikimus reikėtų stebėti atskirai. Šioje dokumentacijos užduotyje nė vienas live health patikrinimas nevykdytas.

Šaltinis: [health service](../apps/api/src/services/health.service.ts), [health controller](../apps/api/src/controllers/health.controller.ts).

## 32. Testavimas ir įrodymai

Frontend naudoja Vitest ir React Testing Library; backend bei bendri paketai - Node test runner per tsx, su mocked provider ir tikrais PostgreSQL/Redis integration scenarijais ten, kur reikia persistence ar konkurencijos. Testų buvimas nėra šio audito vykdymo rezultatas.

| Sritis | Repozitorijoje rasti scenarijai |
| --- | --- |
| Web | Auth restore, CSRF, Zod kontraktai, stale response, upload/delete/retry, content-only POST, citatų tekstas, maršrutai |
| API | Sesijos, verification, owner isolation, generic 404, browser security, kvotos, RAG context ir source validation |
| PostgreSQL / Redis | Tikras vector owner filtras, quota locks, rolling windows, budget konkurencija, limiter TTL |
| Worker | Parser timeout/crash ir survival, PDF ribos, zero embeddings rejection, lifecycle, delete idempotency, budget delay |
| AI / Shared | Provider shape, embedding dimensions, pricing fail closed, usage/rezervacijų matematika ir queue kontraktai |

Normalūs repo patikrinimai: `npm run test:web`; API, Worker, AI ir Shared testams - `npm run test --workspace @developer-knowledge-hub/<paketas>`; atitinkami workspace typecheck script; `npm run lint`, `npm run format:check`, `npm run build:web`. Root script test:api, test:worker ir test:ai nėra. Prisma validate ir migrate status tikrina schema/migration būseną atitinkamoje aplinkoje. Tikslias galimas komandas visada patvirtina [package.json](../package.json).

Šio atnaujinimo patikra apsiribojo kodo/testų skaitymu, dokumentų nuorodomis ir antraštėmis, PDF tekstu bei renderiais, paslapčių šablonais ir docs-only diff. Neatliktas naujas RAG smoke testas, testų suite, production query ar saugumo pentest. Ankstesni README/roadmap passing counts yra konkrečių fazių istoriniai rezultatai.

Reprezentatyvūs šaltiniai: [browser security tests](../apps/api/src/routes/browser-security.integration.test.ts), [vector integration](../apps/api/src/repositories/vector.repository.integration.test.ts), [parser tests](../apps/worker/src/services/pdf-parser.service.test.ts), [frontend client tests](../apps/web/src/lib/api-client.test.ts).

## 33. Operacinės klaidos ir atkūrimas

Keturi operatoriaus patvirtinti išmokimai įtraukti be raw log ar incidentų identifikatorių:

- **Upstream portas:** Caddy DNS veikė, bet neteisingas 80 vietoj API 8080 sukėlė 502. Reikia tikrinti klausomą portą ir server-side upstream kartu.
- **Email transportas:** deployment plano SMTP egress apribojimas paskatino Resend HTTPS adapterį; email abstrakcija leido nekeisti auth domeno logikos.
- **R2 konfigūracija:** klaidingas Worker endpoint sutrikdė ir download, ir cleanup. Env presence patikra neatstoja saugaus realaus provider smoke testo.
- **Exhausted cleanup:** paslėptas DB įrašas ir originalas išliko iki tikslinės failed job atkūrimo operacijos. Operatorius patvirtino sėkmingą cleanup ir to paties PDF reupload po jos. Šiame audite pakartotinai niekas nekeista.

Saugi tyrimo seka: read-only owner/document būsenos ir storageKey nustatymas -> tikslaus queue job ID bei būsenos patikra -> problemos priežasties pataisymo patvirtinimas -> atskirai autorizuotas tikslinis atkūrimas -> DB/storage rezultatų patikra. Negalima automatiškai trinti plačių Redis rinkinių ar manyti, kad iš UI dingęs failas jau fiziškai pašalintas.

### Konkrečios dar nepatikrintos kodo rizikos

Manual Retry processing užduočiai suteikia naują ID, tačiau embedding producer naudoja pastovų `embedding-${documentId}`. Retained failed embedding job gali blokuoti naują add ir palikti CHUNKS_READY. Reikia targeted end-to-end recovery testo; esami mocked enqueue testai šios būsenos neįrodo.

Kita riba: embedding darbas gali nutrūkti dėl trūkstamų chunks ar modelio kainodaros iki perėjimo į EMBEDDING. Terminalinis failure update apribotas EMBEDDING būsena, todėl DB gali likti CHUNKS_READY nors job jau failed. Tai kodu pagrįsta rizika, ne šiame darbe atkartotas production gedimas.

Generavimo provider error priežastis prarandama paverčiant į AI_PROVIDER_UNAVAILABLE. Nežinomas API error kitame kelyje gali būti loguojamas raw; negalima teigti, kad visos diagnostikos žinutės yra vienodai redaguotos ir struktūruotos. DB auth lookup sutrikimai taip pat konvertuojami į generic 401, todėl browser klaida viena pati neatskiria sesijos ir infrastruktūros priežasties.

Dalinis chat turn ar provider išlaida gali išlikti po proceso crash; kompensacija nėra outbox. Keli vieno pokalbio POST nėra griežtai serializuoti. Šias ribas reikia įvertinti atskirame reliability darbe, nekeisti tyliai dokumentacijos atnaujinimo metu.

## 34. Atidėti darbai

**Patvirtintai nėra kode:** automatinio DB/queue/storage reconciliation, transactional outbox, vartotojo cleanup atkūrimo įrankio, pilno Worker readiness, request idempotency sutarties ir deployment-wide worker concurrency politikos. Nėra OCR, originalaus PDF viewer/download, selected-source RAG, long-term memory, komandų ar billing. (Streaming įgyvendintas -- žr. architecture.md; pašalintas iš šio sąrašo.)

**Reikalauja operacinio įrodymo, ne spėjimo:** faktinis PostgreSQL image/major, private exposure, proxy spoof resistance, replicas/restart settings, custom domain, verified sender domain ir pristatomumas išoriniams vartotojams, backup/restore bei rollback praktika. Vien to, kad jų nustatymo nėra kode, nepakanka teigti, kad paslauga jų nenaudoja.

**Rekomenduojama seka:** patikrinti konkrečias Retry/state rizikas; pabaigti dokumentuotą production acceptance; pridėti tikslinį exhausted-job monitoring ir atkūrimą; įrodyti backup/restore bei rollback; prieš mastelio didinimą išmatuoti retrieval kokybę, DB scan trukmę ir globalią konkurenciją. Naujo vektorinės DB produkto ar papildomos infrastruktūros vien dokumentacija nepagrindžia.

## 35. ADR ir peržiūros maršrutas

| ADR | Sprendimas / dabartinis kontekstas |
| --- | --- |
| 0001 | Monorepo ir npm workspaces |
| 0002 | Objektų saugyklos abstrakcija, pradinis R2 |
| 0003 | PostgreSQL ir Prisma |
| 0004 | pgvector vietoj atskiros vector DB |
| 0005 | AI provider abstrakcija, pradinis OpenAI |
| 0006 | Privati asmeninė biblioteka, owner scope |
| 0007 | PDF processing ir chunking bazė; vėliau containment |
| 0008 | Atskira embedding užduotis ir 1 536 dimensijos |
| 0009 | Semantinės retrieval bazė |
| 0010 | Grounded answer ir citatos; vėliau context/title/budget |
| 0011 | Revocable sessions ir email verification; production Resend |

Sprendimų tekstai išsaugo savo fazės alternatyvas bei kompromisus. Vėlesni ribotas kontekstas, titles, quota/budget ir PDF containment sprendimai nekeičia istorijos atgaline data. Dabartinį kontraktą tikrinti kode ir [ADR indekso evoliucijos pastaboje](decisions/README.md).

Rekomenduojama senior reviewer skaitymo tvarka: I dalis -> production 9 ir 29-31 -> RAG 20-22 -> saugumas 23-28 -> duomenys, Worker ir operacijos 15-19, 32-34. Atskirai naudingi [API kontraktai](api.md), [architektūra](architecture.md), [deployment](deployment.md), [security](security.md), [roadmap](roadmap.md) ir [šio atnaujinimo gap analysis](technical-documentation-gap-analysis.md).

Svarbiausi dalykai, kuriuos projekto autorius turėtų paaiškinti savarankiškai: kodėl login credential nėra JWT; kur SQL užtikrina owner scope; kada dokumentas tampa READY; kodėl delete yra dviejų fazių; kodėl istorija nėra RAG faktų šaltinis; kuo AI reservation skiriasi nuo realios sąskaitos; ką health patikrina ir ko ne; kaip storage-first cleanup bei failed job retention veikia pakartotinį PDF įkėlimą.
