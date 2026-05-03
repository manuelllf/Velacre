# Discovery ICP D — Hoteles Galicia (no cadenas grandes)

> **Estado**: 50 candidatos pre-cualificados (Galicia, banda reseñas 800-6000, banda rating 3.7-4.5, sin DM previo, sin cadenas grandes anónimas).
> 
> **Filtro automático aplicado**: descartadas cadenas grandes anónimas tipo NH, Eurostars, Meliá, Hesperia, Marriott, ibis, Sercotel, Hyatt, Hilton, Holiday Inn, Best Western, Catalonia, Barceló, AC by Marriott, Soho Boutique, Iberostar, Riu, Vincci, Room Mate, Hotusa, B&B Hotels.
> 
> **Multilocal operador SÍ entra**: si es dueño-operador con 2-5 locales (Norat Hoteles, Alda Hotels Galicia, PR Hoteles, Carrís, Attica21, Augusta…), se mantiene como caso Velacre multilocal. Si Manuel detecta que es cadena más grande de la cuenta, descartar manualmente.
> 
> **OCA, Eurostars, Silken**: 🚩 banderas — son grupos hoteleros medianos. Verificar si encajan o descartar.

## Cómo se construyó esta lista

Pipeline aplica solo **filtro grueso**: userRatingCount mínimo + rating ≥3.7 + canal contactable. Los proxies de edad/volumen mensual NO funcionan con Places API (la API cura las 5 destacadas hacia reviews recientes en lugar de mostrar las históricas), así que el filtro fino lo hace Manuel manualmente.

Lista capada a **30 candidatos máximo**, ordenados por heartbeat ascendente (review más reciente devuelta = primero).

## Banderas

**Heartbeat** (review más reciente entre las 5 devueltas):
- 🔥 <30d · alta probabilidad de actividad alta
- ⚡ <60d · señal media
- ⚠ <120d · incierto
- ❄ ≥120d · probablemente decayendo

**Span 5 destacadas** (gap entre la más antigua y más reciente devuelta):
- ✓ <1.5a · negocio probablemente joven
- ⚠ 1.5-3a · ambiguo
- 🚩 >3a · probable establecido viejo, descartar a no ser que tenga otra señal

## Verificación manual antes de DM (la que de verdad cuenta)

1. Click en Maps URL → "Más reseñas" → ordenar "Las más recientes" → contar últimos 30 días. Si <20 → descartar.
2. IG activo + DMs abiertos + cuenta llevada por dueño.
3. 1-3 sillas/cabinas/locales máximo.
4. No franquicia ni grupo.
5. Redactar hook concreto observable.

## Lista — Sanxenxo

### Augusta Eco Wellness Resort · Sanxenxo

- **Maps**: https://maps.google.com/?cid=3596458758270149317&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://augustasanxenxo.com/ecowellnessresort/?utm_source=google&utm_medium=organic&utm_campaign=my_business
- **Tel**: +34 986 72 78 78
- **Reseñas**: 4219 totales · rating 4.5
- **Heartbeat**: ⚠ hace 61d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: Lugar Padriñan, 25, 36960 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Spa Galatea · Sanxenxo

- **Maps**: https://maps.google.com/?cid=13961323853993735610&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelgalatea.com/
- **Tel**: +34 986 72 70 27
- **Reseñas**: 1733 totales · rating 4.5
- **Heartbeat**: ❄ hace 173d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: Hotel Spa Galatea, Paxariñas, s/n, 36970 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel del Mar · Sanxenxo

- **Maps**: https://maps.google.com/?cid=8116021511792111711&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://hoteldelmarsanxenxo.com/
- **Tel**: +34 670 28 97 82
- **Reseñas**: 1142 totales · rating 4.3
- **Heartbeat**: ❄ hace 202d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: P.º Praia de Silgar, 52, 36960 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Nuevo Vichona · Sanxenxo

- **Maps**: https://maps.google.com/?cid=15931563688697707924&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.nuevovichona.com/
- **Tel**: +34 986 72 30 11
- **Reseñas**: 1027 totales · rating 4.3
- **Heartbeat**: ❄ hace 233d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: La Vichona, 5, 36960 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Restaurante O Son do Mar Playa · Sanxenxo

- **Maps**: https://maps.google.com/?cid=18237113434477022076&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelosondomar.com/
- **Tel**: +34 698 18 43 85
- **Reseñas**: 962 totales · rating 4.3
- **Heartbeat**: ⚠ hace 76d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: R. de Madrid, 32, 36960 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Peregrina · Sanxenxo

- **Maps**: https://maps.google.com/?cid=11229391124372554670&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelperegrina.com/
- **Tel**: +34 986 72 70 69
- **Reseñas**: 842 totales · rating 4.5
- **Heartbeat**: ❄ hace 155d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Outeiro, 1 Adina, 36970 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Apartamentos Spa Nanín Playa en Sanxenxo · Sanxenxo

- **Maps**: https://maps.google.com/?cid=9711200130620571061&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.nanin.com/
- **Tel**: +34 986 69 15 00
- **Reseñas**: 811 totales · rating 4.5
- **Heartbeat**: ❄ hace 203d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: PO-308, s/n, 36960 Sanxenxo, Pontevedra
- **Source query**: `hotel Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Santiago

### Hotel OCA Puerta del Camino · Santiago

- **Maps**: https://maps.google.com/?cid=5899507291582751909&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.ocahotels.com/hoteles/hotel-oca-puerta-del-camino
- **Tel**: +34 981 56 94 00
- **Reseñas**: 3653 totales · rating 4.4
- **Heartbeat**: ⚠ hace 68d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: C/ Miguel Ferro Caaveiro, s/n, 15703 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Gelmírez · Santiago

- **Maps**: https://maps.google.com/?cid=12809028227217295622&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelgelmirez.com/?utm_source=google&utm_medium=business&utm_campaign=maps
- **Tel**: +34 981 56 11 00
- **Reseñas**: 2436 totales · rating 4.4
- **Heartbeat**: ⚠ hace 60d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa do Hórreo, 92, 15702 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Exe Peregrino · Santiago

- **Maps**: https://maps.google.com/?cid=13743115080732631334&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.eurostarshotels.com/exe-peregrino.html?referer_code=lb0gg00yx&utm_source=google&utm_medium=business&utm_campaign=lb0gg00yx
- **Tel**: +34 981 79 52 99
- **Reseñas**: 2354 totales · rating 4.2
- **Heartbeat**: ⚡ hace 56d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Av. de Rosalía de Castro, S/N, 15706 Santiago de Compostela, La Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Auditorio Santiago & Spa · Santiago

- **Maps**: https://maps.google.com/?cid=5728190832323181110&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelsantiago-sl.es/
- **Tel**: +34 982 01 01 01
- **Reseñas**: 1814 totales · rating 4.2
- **Heartbeat**: ⚠ hace 71d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Urbanización Bela Vista, Carretera N-540, km. 3.200, 27004 Lugo
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Loop Inn Hostel Santiago de Compostela · Santiago

- **Maps**: https://maps.google.com/?cid=651578954645580484&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.loopinnhostels.com/
- **Tel**: +34 981 58 56 67
- **Reseñas**: 1761 totales · rating 4.1
- **Heartbeat**: ⚡ hace 56d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Rúa de Tras Santa Clara, 2, 15704 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Santiago Apóstol · Santiago

- **Maps**: https://maps.google.com/?cid=8128432566154490374&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.santiagoapostolhotel.com/
- **Tel**: +34 981 55 71 55
- **Reseñas**: 1760 totales · rating 3.9
- **Heartbeat**: ❄ hace 149d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: Costa de San Marcos, 1, 15820 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Lux Santiago · Santiago

- **Maps**: https://maps.google.com/?cid=14771956746281055816&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.gescahoteles.com/lux-santiago/
- **Tel**: +34 981 55 49 86
- **Reseñas**: 1634 totales · rating 4.2
- **Heartbeat**: ⚠ hace 62d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa do Doutor Teixeiro, 4, 15701 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Compostela Hotel · Santiago

- **Maps**: https://maps.google.com/?cid=9752918050525797783&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelcompostela.es/?utm_source=google&utm_medium=business&utm_campaign=maps
- **Tel**: +34 981 58 57 00
- **Reseñas**: 1619 totales · rating 4.3
- **Heartbeat**: ⚠ hace 75d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Hórreo, 1, 15701 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel San Lázaro · Santiago

- **Maps**: https://maps.google.com/?cid=1558689041245339793&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://hotelsanlazaro.es/
- **Tel**: +34 981 58 43 44
- **Reseñas**: 1488 totales · rating 4.1
- **Heartbeat**: ⚠ hace 63d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Valiño, 1, 15703 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Nest Style Santiago · Santiago

- **Maps**: https://maps.google.com/?cid=17186601500058228744&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.neststylesantiago.com/
- **Tel**: +34 960 66 06 57
- **Reseñas**: 1468 totales · rating 4
- **Heartbeat**: ⚡ hace 59d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Doutor Teixeiro, 15, 15701 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Exe Area Central · Santiago

- **Maps**: https://maps.google.com/?cid=12629422821559686797&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.eurostarshotels.com/exe-area-central.html?referer_code=lb0gg00yx&utm_source=google&utm_medium=business&utm_campaign=lb0gg00yx
- **Tel**: +34 981 55 22 22
- **Reseñas**: 1341 totales · rating 4.1
- **Heartbeat**: ❄ hace 155d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Área Central, R. de París, 7, C.C, 15707 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Ciudad de Compostela · Santiago

- **Maps**: https://maps.google.com/?cid=243147977512998606&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.gescahoteles.com/ciudad-compostela/
- **Tel**: +34 981 56 93 20
- **Reseñas**: 1240 totales · rating 4.1
- **Heartbeat**: ⚠ hace 105d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Av. de Lugo, 213, 15703 Santiago de Compostela, La Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Windsor · Santiago

- **Maps**: https://maps.google.com/?cid=14842865360408405112&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelwindsor.es/
- **Tel**: +34 981 59 29 39
- **Reseñas**: 904 totales · rating 4.1
- **Heartbeat**: ⚠ hace 115d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: R. da República de El Salvador, 16, 15701 Santiago de Compostela, A Coruña
- **Source query**: `hotel Santiago centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — A Coruña

### Attica 21 Coruña · A Coruña

- **Maps**: https://maps.google.com/?cid=10325991823058543859&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.attica21hotels.com/hotel-attica21-coruna/
- **Tel**: +34 981 17 92 99
- **Reseñas**: 3401 totales · rating 4.5
- **Heartbeat**: ⚠ hace 76d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: R. Enrique Mariñas Romero, 34, 15009 A Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Riazor · A Coruña

- **Maps**: https://maps.google.com/?cid=889593135274315927&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.riazorhotel.com/?utm_source=google&utm_medium=business&utm_campaign=maps
- **Tel**: +34 981 25 34 00
- **Reseñas**: 2622 totales · rating 4.3
- **Heartbeat**: ⚠ hace 90d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Av. de Pedro Barrié de la Maza, 29, 15004 La Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Plaza · A Coruña

- **Maps**: https://maps.google.com/?cid=16188158643627459523&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelplaza.es/
- **Tel**: +34 981 29 01 11
- **Reseñas**: 2512 totales · rating 4.4
- **Heartbeat**: ⚠ hace 64d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: R. Santiago Rey Fernández Latorre, 45, 15006 A Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Carrís Marineda · A Coruña

- **Maps**: https://maps.google.com/?cid=10457653344522406629&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.carrishoteles.com/es/hotel-carris-marineda/
- **Tel**: +34 981 63 24 36
- **Reseñas**: 2403 totales · rating 4.3
- **Heartbeat**: ⚠ hace 73d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Est. Baños de Arteixo, 43, 15008 A Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Avenida · A Coruña

- **Maps**: https://maps.google.com/?cid=16412140218851833409&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelavenida.com/
- **Tel**: +34 981 24 94 66
- **Reseñas**: 2217 totales · rating 4.4
- **Heartbeat**: ⚠ hace 64d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rda. de Outeiro, 99A, 15007 La Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Zenit Coruña · A Coruña

- **Maps**: https://maps.google.com/?cid=3904643524769022990&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://coruna.zenithoteles.com/?partner=8480&utm_source=google&utm_medium=organic&utm_campaign=MyBusiness&utm
- **Tel**: +34 981 21 84 84
- **Reseñas**: 1760 totales · rating 4.3
- **Heartbeat**: ⚠ hace 69d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa Comandante Fontanes, 19, 15003 A Coruña
- **Source query**: `hotel A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Vigo

### Hotel Coia · Vigo

- **Maps**: https://maps.google.com/?cid=12325007622861206252&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelcoia.com/
- **Tel**: +34 986 20 18 20
- **Reseñas**: 2807 totales · rating 4.3
- **Heartbeat**: ⚠ hace 92d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa de Sanxenxo, 1, Coia, 36209 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Ciudad De Vigo · Vigo

- **Maps**: https://maps.google.com/?cid=11641356268943783604&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://ciudaddevigo.com/
- **Tel**: +34 986 22 78 20
- **Reseñas**: 1999 totales · rating 4.1
- **Heartbeat**: ⚠ hace 77d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: R. de Concepción Arenal, 5, 36201 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Silken Axis Vigo · Vigo

- **Maps**: https://maps.google.com/?cid=15104999570047985516&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hoteles-silken.com/es/hotel-axis-vigo/?utm_source=google&utm_medium=organic&utm_campaign=google-my-business-axis-vigo
- **Tel**: +34 986 44 11 12
- **Reseñas**: 1826 totales · rating 4.2
- **Heartbeat**: ⚠ hace 75d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa de María Berdiales, 22, Santiago de Vigo, 36203 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Panton · Vigo

- **Maps**: https://maps.google.com/?cid=495101512230787265&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelpanton.com/
- **Tel**: +34 986 22 42 70
- **Reseñas**: 1325 totales · rating 4
- **Heartbeat**: ❄ hace 133d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Lepanto, 18, Santiago de Vigo, 36201 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Vigo Plaza · Vigo

- **Maps**: https://maps.google.com/?cid=11103536987838503130&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.vigoplaza.com/
- **Tel**: +34 986 22 82 43
- **Reseñas**: 1054 totales · rating 3.7
- **Heartbeat**: ⚠ hace 63d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: R. do Progreso, 13, Santiago de Vigo, 36202 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel O Pazo · Vigo

- **Maps**: https://maps.google.com/?cid=11782781064811404629&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://fb.me/hotelpazovigo
- **Tel**: +34 682 51 95 93
- **Reseñas**: 891 totales · rating 4.2
- **Heartbeat**: ⚠ hace 65d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa Campos, 11, 36213 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Alda Estación Vigo · Vigo

- **Maps**: https://maps.google.com/?cid=2752217890003127759&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.aldahotels.es/hoteles/galicia/pontevedra/vigo/hotel-alda-estacion-vigo
- **Tel**: +34 886 30 00 25
- **Reseñas**: 867 totales · rating 3.7
- **Heartbeat**: ⚡ hace 58d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa de Alfonso XIII, 17, Santiago de Vigo, 36201 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel del Mar Vigo · Vigo

- **Maps**: https://maps.google.com/?cid=6560166973563231978&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hoteldelmarvigo.es/
- **Tel**: +34 986 43 68 11
- **Reseñas**: 800 totales · rating 3.7
- **Heartbeat**: ⚠ hace 61d
- **Span 5 destacadas**: ✓ 0.6a
- **Dirección**: R. de Luis Taboada, 34, 36201 Vigo, Pontevedra
- **Source query**: `hotel Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — O Grove

### Hotel Spa Norat O Grove · O Grove

- **Maps**: https://maps.google.com/?cid=6714879506743255571&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelspanoratogrove.com/
- **Tel**: +34 986 73 33 99
- **Reseñas**: 2787 totales · rating 4.3
- **Heartbeat**: ⚡ hace 55d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Luís Casais, 22, 36980 O Grove, Pontevedra
- **Source query**: `hotel O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Spa BosqueMar · O Grove

- **Maps**: https://maps.google.com/?cid=2663220391130707922&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.bosquemar.com/
- **Tel**: +34 986 73 10 55
- **Reseñas**: 1061 totales · rating 4.5
- **Heartbeat**: ❄ hace 145d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: C. Reboredo, 93, 36988, Pontevedra
- **Source query**: `hotel O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Pazo O Rial · O Grove

- **Maps**: https://maps.google.com/?cid=3648651764148554332&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelpazorial.com/?utm_medium=organic&utm_source=google&utm_campaign=google-my-business&utm_term=google-local
- **Tel**: +34 986 50 70 11
- **Reseñas**: 941 totales · rating 4.4
- **Heartbeat**: ⚠ hace 114d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Av. Cambados, 117, 36611 Vilagarcía de Arousa, Pontevedra
- **Source query**: `hotel O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel La Noyesa · O Grove

- **Maps**: https://maps.google.com/?cid=999563973868880116&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelnoyesa.com/
- **Tel**: +34 986 73 09 23
- **Reseñas**: 863 totales · rating 4.2
- **Heartbeat**: ⚠ hace 105d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa da Praza, 5, 36980 O Grove, Pontevedra
- **Source query**: `hotel O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — O Cebreiro

### Casa O Cebreiro · O Cebreiro

- **Maps**: https://maps.google.com/?cid=17289719999174238461&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelcebreiro.com/
- **Tel**: +34 982 36 71 82
- **Reseñas**: 1987 totales · rating 4.5
- **Heartbeat**: ⚠ hace 63d
- **Span 5 destacadas**: ✓ 0.6a
- **Dirección**: Lugar, 27670 O Cebreiro, Lugo
- **Source query**: `hostal O Cebreiro Camino`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Cambados

### Parador de Cambados · Cambados

- **Maps**: https://maps.google.com/?cid=4115005498400369866&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.parador.es/es/paradores/parador-de-cambados?utm_source=GoogleMyBusiness&utm_medium=linkgoogle&utm_campaign=paradordecambados&utm_term=organico&utm_content=ficha
- **Tel**: +34 986 54 22 50
- **Reseñas**: 1886 totales · rating 4.3
- **Heartbeat**: ⚡ hace 57d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: P.º Calzada, s/n, 36630 Cambados, Pontevedra
- **Source query**: `hotel Cambados`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Ría Mar · Cambados

- **Maps**: https://maps.google.com/?cid=17993729978562265238&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelriamar.com/?utm_source=google&utm_medium=business&utm_campaign=maps
- **Tel**: +34 986 74 60 20
- **Reseñas**: 1330 totales · rating 3.8
- **Heartbeat**: ❄ hace 146d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Aldea Altamira, 9, 36967 Meaño, Pontevedra
- **Source query**: `hotel Cambados`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### HOTEL SAN MARCOS · Cambados

- **Maps**: https://maps.google.com/?cid=11387642072529099082&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotel-sanmarcos.com/
- **Tel**: +34 986 71 84 62
- **Reseñas**: 990 totales · rating 3.7
- **Heartbeat**: ❄ hace 168d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: EP-9502, 23, 36636 Cambados, Pontevedra
- **Source query**: `hotel Cambados`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Pontevedra

### Hotel Galicia Palace · Pontevedra

- **Maps**: https://maps.google.com/?cid=8956016126451667138&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.galiciapalace.com/
- **Tel**: +34 986 86 44 11
- **Reseñas**: 1850 totales · rating 4.1
- **Heartbeat**: ⚠ hace 69d
- **Span 5 destacadas**: ✓ 0.6a
- **Dirección**: Av. de Vigo, 3, 36003 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Rías Bajas · Pontevedra

- **Maps**: https://maps.google.com/?cid=8578449925348152242&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hotelriasbajas.com/
- **Tel**: +34 986 85 51 00
- **Reseñas**: 1609 totales · rating 4.1
- **Heartbeat**: ⚠ hace 78d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa Daniel de la Sota Valdecilla, 7, 36001 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Parador de Pontevedra · Pontevedra

- **Maps**: https://maps.google.com/?cid=15676528758260442056&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.parador.es/es/paradores/parador-de-pontevedra?utm_source=GoogleMyBusiness&utm_medium=linkgoogle&utm_campaign=paradordepontevedra&utm_term=organico&utm_content=ficha
- **Tel**: +34 986 85 58 00
- **Reseñas**: 1601 totales · rating 4.2
- **Heartbeat**: ⚠ hace 60d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa do Barón, 19, 36002 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Virgen del Camino · Pontevedra

- **Maps**: https://maps.google.com/?cid=9319612418107357541&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelvirgendelcamino.com/
- **Tel**: +34 986 85 59 00
- **Reseñas**: 1256 totales · rating 3.8
- **Heartbeat**: ❄ hace 233d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa da Virxe do Camiño, 55, 36001 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Duerming Paris Pontevedra Hotel · Pontevedra

- **Maps**: https://maps.google.com/?cid=4823071443346193814&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.duermingbeds.com/alojamientos/hotel-duerming-paris-pontevedra
- **Tel**: +34 986 87 30 40
- **Reseñas**: 996 totales · rating 4.2
- **Heartbeat**: ❄ hace 146d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Av. Encoirados, 1, 36163 Poio, Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Room Pontevedra · Pontevedra

- **Maps**: https://maps.google.com/?cid=6450324078527343435&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://hotelroompontevedra.com/
- **Tel**: +34 986 86 95 50
- **Reseñas**: 894 totales · rating 3.8
- **Heartbeat**: ⚠ hace 117d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa Profesor Filgueira Valverde, 10, 36003 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel HHB Pontevedra Confort · Pontevedra

- **Maps**: https://maps.google.com/?cid=6002645491717742547&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.hotelpontevedra.es/
- **Tel**: +34 986 10 94 99
- **Reseñas**: 833 totales · rating 4.4
- **Heartbeat**: ⚠ hace 66d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Doutor Loureiro Crespo, 81, 36004 Pontevedra
- **Source query**: `hotel Pontevedra centro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Melide

### Hotel & Spa Carlos desde 1996 · Melide

- **Maps**: https://maps.google.com/?cid=7801506770876075181&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hc96.com/
- **Tel**: +34 981 50 76 33
- **Reseñas**: 1659 totales · rating 4.4
- **Heartbeat**: ⚠ hace 71d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Av. Lugo, 119, 15800 Melide, La Coruña
- **Source query**: `hotel Melide Camino`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Resumen

| Ciudad | Cualificados | Contactados | Respuestas | Conversaciones |
|---|---|---|---|---|
| Sanxenxo | 7 | 0 | 0 | 0 |
| Santiago | 13 | 0 | 0 | 0 |
| A Coruña | 6 | 0 | 0 | 0 |
| Vigo | 8 | 0 | 0 | 0 |
| O Grove | 4 | 0 | 0 | 0 |
| O Cebreiro | 1 | 0 | 0 | 0 |
| Cambados | 3 | 0 | 0 | 0 |
| Pontevedra | 7 | 0 | 0 | 0 |
| Melide | 1 | 0 | 0 | 0 |
| **Total** | **50** | **0** | **0** | **0** |