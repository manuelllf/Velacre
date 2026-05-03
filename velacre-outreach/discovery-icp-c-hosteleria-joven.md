# Discovery ICP C — Restaurantes Galicia

> **Estado**: 51 candidatos pre-cualificados (Galicia, banda reseñas 1600-6000, banda rating 3.7-4.5, sin DM previo). Pendiente criba humana.
> 
> **Cobertura**: ciudades principales + Camino de Santiago (Sarria/Portomarín/Melide/Arzúa) + zonas turísticas (Salnés, O Grove, Combarro, Cambados, Sanxenxo, Costa da Morte, Ribeira Sacra, Finisterre).

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

## Lista — Santiago

### Mesón 42 · Santiago

- **Maps**: https://maps.google.com/?cid=5927344419804187750&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://meson42.com/
- **Tel**: +34 981 58 10 09
- **Reseñas**: 5279 totales · rating 4.5
- **Heartbeat**: ❄ hace 133d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa do Franco, 42, 15702 Santiago de Compostela, A Coruña
- **Source query**: `restaurante Santiago`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante María Castaña · Santiago

- **Maps**: https://maps.google.com/?cid=10932712443508208552&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://mariacastanha.com/
- **Tel**: +34 981 56 01 37
- **Reseñas**: 3293 totales · rating 4.2
- **Heartbeat**: ⚠ hace 64d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa da Raíña, 19, 15705 Santiago de Compostela, A Coruña
- **Source query**: `restaurante Santiago`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Codex / Santiago de Compostela · Santiago

- **Maps**: https://maps.google.com/?cid=5912449295255675093&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 881 25 30 09
- **Reseñas**: 2315 totales · rating 4.4
- **Heartbeat**: ⚠ hace 81d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa dos Bautizados, 13, 15702 Santiago de Compostela, A Coruña
- **Source query**: `restaurante Santiago`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Casa Felisa · Santiago

- **Maps**: https://maps.google.com/?cid=13532847955274934&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.casafelisa.es/
- **Tel**: +34 981 58 26 02
- **Reseñas**: 1841 totales · rating 4.2
- **Heartbeat**: ❄ hace 145d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa da Porta da Pena, 5, 15704 Santiago de Compostela, A Coruña
- **Source query**: `restaurante Santiago`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Combarro

### Restaurante O Bocoi · Combarro

- **Maps**: https://maps.google.com/?cid=8103158266735404316&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.bodegaobocoi.com/
- **Tel**: +34 986 77 11 42
- **Reseñas**: 4722 totales · rating 4.5
- **Heartbeat**: ❄ hace 155d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa do Mar, 20, 36993 Combarro, Pontevedra
- **Source query**: `restaurante Combarro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante O Peirao · Combarro

- **Maps**: https://maps.google.com/?cid=1837866290764423709&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 986 77 23 76
- **Reseñas**: 2123 totales · rating 4.1
- **Heartbeat**: ❄ hace 124d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Mar, 6, 36993 Combarro, Pontevedra
- **Source query**: `restaurante Combarro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Entrepedras · Combarro

- **Maps**: https://maps.google.com/?cid=10380871266154198466&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 686 98 66 51
- **Reseñas**: 1829 totales · rating 4.1
- **Heartbeat**: ❄ hace 213d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa San Roque, 15, 36993 Combarro, Pontevedra
- **Source query**: `restaurante Combarro`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Costa da Morte

### Restaurante O Centolo · Costa da Morte

- **Maps**: https://maps.google.com/?cid=5540255660049053324&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.centolo.com/
- **Tel**: +34 981 74 04 52
- **Reseñas**: 3939 totales · rating 4.4
- **Heartbeat**: ❄ hace 133d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Paseo Ribeira, 3, 15155 Fisterra, A Coruña
- **Source query**: `restaurante Costa da Morte`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Tira do Cordel · Costa da Morte

- **Maps**: https://maps.google.com/?cid=4256072767919574229&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://tiradocordel.com/
- **Tel**: +34 981 74 06 97
- **Reseñas**: 3658 totales · rating 4.3
- **Heartbeat**: ⚠ hace 64d
- **Span 5 destacadas**: ✓ 0.6a
- **Dirección**: Paseo Marítimo, 1, 15155 Fisterra, A Coruña
- **Source query**: `restaurante Costa da Morte`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante El Puerto · Costa da Morte

- **Maps**: https://maps.google.com/?cid=9225951178744076094&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://elpuertofisterra.com/
- **Tel**: +34 981 71 21 17
- **Reseñas**: 1973 totales · rating 4
- **Heartbeat**: ❄ hace 182d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Paseo Ribeira, 43, 15155 Fisterra, A Coruña
- **Source query**: `restaurante Costa da Morte`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Os Tres Golpes · Costa da Morte

- **Maps**: https://maps.google.com/?cid=7176662193543703943&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 981 74 00 47
- **Reseñas**: 1873 totales · rating 4.3
- **Heartbeat**: ❄ hace 197d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Hortas, 2, 15155 Fisterra, A Coruña
- **Source query**: `restaurante Costa da Morte`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Lugo

### Restaurante Fonte Do Rei · Lugo

- **Maps**: https://maps.google.com/?cid=7407249749457047909&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 982 24 56 08
- **Reseñas**: 3770 totales · rating 4.3
- **Heartbeat**: ⚠ hace 98d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Av. de Madrid, 5, 27002 Lugo
- **Source query**: `restaurante Lugo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Fonte do Rei II · Lugo

- **Maps**: https://maps.google.com/?cid=14786453243014356235&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.fontedorei.com/
- **Tel**: +34 982 22 37 11
- **Reseñas**: 2647 totales · rating 4.3
- **Heartbeat**: ⚠ hace 107d
- **Span 5 destacadas**: ⚠ 1.8a
- **Dirección**: Av. de Madrid, 63, 27002 Lugo
- **Source query**: `restaurante Lugo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Manuel Manuel · Lugo

- **Maps**: https://maps.google.com/?cid=17806136981751220292&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://restaurantemanuelmanuel.es/
- **Tel**: +34 982 21 30 19
- **Reseñas**: 2230 totales · rating 4.5
- **Heartbeat**: ⚠ hace 115d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa Monte Faro, 19, 27003 Lugo
- **Source query**: `restaurante Lugo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante España · Lugo

- **Maps**: https://maps.google.com/?cid=10479262661598738018&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.restespana.es/
- **Tel**: +34 982 24 27 17
- **Reseñas**: 2079 totales · rating 4.5
- **Heartbeat**: ❄ hace 124d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Teatro, 10, 27001 Lugo
- **Source query**: `restaurante Lugo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Campos · Lugo

- **Maps**: https://maps.google.com/?cid=17675903275853188437&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.restaurantecampos.es/
- **Tel**: +34 982 22 97 43
- **Reseñas**: 1929 totales · rating 4.5
- **Heartbeat**: ❄ hace 135d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Nova, 2, 4, 27001 Lugo
- **Source query**: `restaurante Lugo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Vigo

### Porto Santo (Vigo) · Vigo

- **Maps**: https://maps.google.com/?cid=8454595412773121745&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.portosanto.es/
- **Tel**: +34 626 58 51 18
- **Reseñas**: 3569 totales · rating 4.4
- **Heartbeat**: ❄ hace 120d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: R. de García Barbón, 45, Santiago de Vigo, 36201 Vigo, Pontevedra
- **Source query**: `restaurante Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante O Portón · Vigo

- **Maps**: https://maps.google.com/?cid=5835747271607581801&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 986 43 81 08
- **Reseñas**: 2250 totales · rating 4.4
- **Heartbeat**: ❄ hace 141d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa Pescadería, 1, Bajo, 36202 Vigo, Pontevedra
- **Source query**: `restaurante Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Mesón Compostela · Vigo

- **Maps**: https://maps.google.com/?cid=13197474247695853976&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.mesoncompostela.com/
- **Tel**: +34 986 43 28 96
- **Reseñas**: 2038 totales · rating 4.1
- **Heartbeat**: ⚡ hace 56d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Praza de Compostela, 6, 36201 Vigo, Pontevedra
- **Source query**: `restaurante Vigo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — O Grove

### Asador O Chiringuito · O Grove

- **Maps**: https://maps.google.com/?cid=9309753410472462703&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.facebook.com/restaurante.ochiringuito
- **Tel**: +34 986 73 17 01
- **Reseñas**: 3514 totales · rating 4.4
- **Heartbeat**: ❄ hace 169d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Av. de Beiramar, 84, 36980 O Grove, Pontevedra
- **Source query**: `restaurante O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Marisquería Solaina O Grove · O Grove

- **Maps**: https://maps.google.com/?cid=11466910775628031425&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://marisqueriassolaina.es/
- **Tel**: +34 986 73 29 69
- **Reseñas**: 2747 totales · rating 4.2
- **Heartbeat**: ❄ hace 146d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Av. de Beiramar, s/n, 36980 O Grove, Pontevedra
- **Source query**: `restaurante O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante O Cruceiro · O Grove

- **Maps**: https://maps.google.com/?cid=4829026144118270239&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.restauranteocruceiro.com/
- **Tel**: +34 986 73 16 40
- **Reseñas**: 2315 totales · rating 4.5
- **Heartbeat**: ❄ hace 163d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa do Cruceiro, 17, Bajo, 36980 O Grove, Pontevedra
- **Source query**: `restaurante O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Taberna Lavandeiro · O Grove

- **Maps**: https://maps.google.com/?cid=7203470827681946757&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 986 73 19 56
- **Reseñas**: 1905 totales · rating 4.5
- **Heartbeat**: ❄ hace 135d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Santo Antonio, 2, 36980 O Grove, Pontevedra
- **Source query**: `restaurante O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Balcón De Floreano · O Grove

- **Maps**: https://maps.google.com/?cid=3746040630278995911&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 610 56 90 21
- **Reseñas**: 1638 totales · rating 4.3
- **Heartbeat**: ❄ hace 129d
- **Span 5 destacadas**: ✓ 1.0a
- **Dirección**: Praza De arriba, 11, 36980 O Grove, Pontevedra
- **Source query**: `restaurante O Grove`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Ribeira Sacra

### Playa Fluvial De A Cova Restaurante & Ocio · Ribeira Sacra

- **Maps**: https://maps.google.com/?cid=15137697874797146880&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.playadacova.es/
- **Tel**: +34 647 62 87 35
- **Reseñas**: 3507 totales · rating 4.4
- **Heartbeat**: ❄ hace 130d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Saviñao, 27548, Lugo
- **Source query**: `restaurante Ribeira Sacra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante O Curtiñeiro · Ribeira Sacra

- **Maps**: https://maps.google.com/?cid=2299584412583596572&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 619 02 07 01
- **Reseñas**: 2292 totales · rating 4.4
- **Heartbeat**: ⚠ hace 97d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Praza da Fonte, 6, 32740 Parada de Sil, Ourense
- **Source query**: `restaurante Ribeira Sacra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante A Cova · Ribeira Sacra

- **Maps**: https://maps.google.com/?cid=11255434008950367326&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 982 17 18 85
- **Reseñas**: 1937 totales · rating 4.4
- **Heartbeat**: ❄ hace 165d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: 27548 Os Ferreiros, Lugo
- **Source query**: `restaurante Ribeira Sacra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Portomarín

### O Mirador · Portomarín

- **Maps**: https://maps.google.com/?cid=1126119413727303846&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.omiradorportomarin.com/
- **Tel**: +34 982 54 53 23
- **Reseñas**: 3198 totales · rating 4.4
- **Heartbeat**: ❄ hace 167d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa do Peregrino, 27, bajo, 27170 Portomarín, Lugo
- **Source query**: `restaurante Portomarín`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Pérez · Portomarín

- **Maps**: https://maps.google.com/?cid=18393966808250572486&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://pensionperez.com/
- **Tel**: +34 982 54 50 40
- **Reseñas**: 2785 totales · rating 4.4
- **Heartbeat**: ⚠ hace 61d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Praza Aviación Española, 2, 27170 Portomarín, Lugo
- **Source query**: `restaurante Portomarín`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Sanxenxo

### Restaurante O Barco · Sanxenxo

- **Maps**: https://maps.google.com/?cid=3361058339285001221&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.restauranteobarco.com/
- **Tel**: +34 986 72 06 03
- **Reseñas**: 2972 totales · rating 4.4
- **Heartbeat**: ❄ hace 127d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: P.º Praia de Silgar, 72, 36960 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Taberna Maruca · Sanxenxo

- **Maps**: https://maps.google.com/?cid=17876922962306062953&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://hgabodegas.com/carta/taberna_maruca.pdf
- **Tel**: +34 619 53 40 56
- **Reseñas**: 2693 totales · rating 4.5
- **Heartbeat**: ❄ hace 216d
- **Span 5 destacadas**: ✓ 1.1a
- **Dirección**: Lugar da Barrosa, 43, 36979 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### La Indiana · Sanxenxo

- **Maps**: https://maps.google.com/?cid=13976015078932153055&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://m.facebook.com/Laindianacr/?locale2=es_ES
- **Tel**: +34 986 72 45 14
- **Reseñas**: 2235 totales · rating 4.3
- **Heartbeat**: ❄ hace 155d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Lugar Vinquiño, 39, 36960 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### GABBA SANXENXO · Sanxenxo

- **Maps**: https://maps.google.com/?cid=6975165760142704361&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.gabba.es/
- **Tel**: +34 986 72 46 72
- **Reseñas**: 1857 totales · rating 4.1
- **Heartbeat**: ⚠ hace 84d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Praza de Portugal, 1, 36960 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Mardivino Asador · Sanxenxo

- **Maps**: https://maps.google.com/?cid=9920564861797444872&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://mardivinoasador.net/
- **Tel**: +34 986 72 11 33
- **Reseñas**: 1806 totales · rating 4.5
- **Heartbeat**: ❄ hace 166d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Paseo de Silgar, 15, 36960 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Fidel en Sanxenxo · Sanxenxo

- **Maps**: https://maps.google.com/?cid=14639787293777746620&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://smartmenu.agorapos.com/?id=u8ttrm8n#/
- **Tel**: +34 634 42 28 79
- **Reseñas**: 1619 totales · rating 4.1
- **Heartbeat**: ❄ hace 210d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: R. de Madrid, 34, 36960 Sanxenxo, Pontevedra
- **Source query**: `restaurante Sanxenxo`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Pontevedra

### Il Piccolo · Pontevedra

- **Maps**: https://maps.google.com/?cid=12637090998901812017&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://ristoranteilpiccolo.com/
- **Tel**: +34 986 85 99 99
- **Reseñas**: 2962 totales · rating 4.4
- **Heartbeat**: ⚠ hace 67d
- **Span 5 destacadas**: ✓ 0.6a
- **Dirección**: Rúa da Virxe do Camiño, 16, 36004 Pontevedra
- **Source query**: `restaurante Pontevedra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Bar restaurante Ultramar - Pepe Vieira · Pontevedra

- **Maps**: https://maps.google.com/?cid=2829901522750002281&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://laultramar.es/
- **Tel**: +34 649 60 52 90
- **Reseñas**: 2106 totales · rating 4.1
- **Heartbeat**: ❄ hace 251d
- **Span 5 destacadas**: ✓ 0.1a
- **Dirección**: Rúa Padre Amoedo Carballo, 3, 36002 Pontevedra
- **Source query**: `restaurante Pontevedra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Casa Román - Pontevedra · Pontevedra

- **Maps**: https://maps.google.com/?cid=11676743898097058119&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://casaroman.com/
- **Tel**: +34 986 84 35 60
- **Reseñas**: 1771 totales · rating 4.4
- **Heartbeat**: ⚠ hace 99d
- **Span 5 destacadas**: ✓ 0.9a
- **Dirección**: Av. Augusto García Sánchez, 12, 36003 Pontevedra
- **Source query**: `restaurante Pontevedra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Loaira · Pontevedra

- **Maps**: https://maps.google.com/?cid=8584751631857126975&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://menuyvinos.com/loaira/
- **Tel**: +34 986 85 88 15
- **Reseñas**: 1724 totales · rating 4.4
- **Heartbeat**: ⚠ hace 64d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Praza da Leña, 1, 36002 Pontevedra
- **Source query**: `restaurante Pontevedra`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — A Coruña

### Taberna da Penela Samaná · A Coruña

- **Maps**: https://maps.google.com/?cid=4794699901905946020&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.samanacoruna.com/
- **Tel**: +34 981 70 71 72
- **Reseñas**: 2780 totales · rating 4.3
- **Heartbeat**: ⚠ hace 106d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa Rosalía de Castro, 9, 15004 A Coruña
- **Source query**: `restaurante A Coruña`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Cambados

### A Taberna do Trasno Cambados · Cambados

- **Maps**: https://maps.google.com/?cid=6587231937041978608&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.atabernadotrasno.com/
- **Tel**: +34 986 52 49 88
- **Reseñas**: 2529 totales · rating 4.5
- **Heartbeat**: ⚠ hace 73d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Rúa Príncipe, 12, 36630 Cambados, Pontevedra
- **Source query**: `restaurante Cambados`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Hotel Casa Rosita · Cambados

- **Maps**: https://maps.google.com/?cid=17694622558983767275&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.hrosita.com/
- **Tel**: +34 986 54 28 78
- **Reseñas**: 1729 totales · rating 4.5
- **Heartbeat**: ⚡ hace 57d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: 36634 O Ribeiro, Pontevedra
- **Source query**: `restaurante Cambados`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Arzúa

### Casa Teodora · Arzúa

- **Maps**: https://maps.google.com/?cid=6934878896355136373&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.casateodora.com/
- **Tel**: +34 981 50 00 83
- **Reseñas**: 2497 totales · rating 4.4
- **Heartbeat**: ❄ hace 218d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa Lugo, 38, 15810 Arzúa, A Coruña
- **Source query**: `restaurante Arzúa`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Churrería "O' Furancho d' Santiso" Taperia-Meson · Arzúa

- **Maps**: https://maps.google.com/?cid=8989026490939675707&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://ofuranchodesantiso.com/
- **Tel**: +34 699 81 81 39
- **Reseñas**: 1935 totales · rating 4.2
- **Heartbeat**: ⚠ hace 62d
- **Span 5 destacadas**: ✓ 1.4a
- **Dirección**: Rúa Lugo, 9, 15810 Arzúa, A Coruña
- **Source query**: `restaurante Arzúa`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Restaurante Casa Chelo · Arzúa

- **Maps**: https://maps.google.com/?cid=14615615787636525256&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 981 50 82 48
- **Reseñas**: 1799 totales · rating 4.4
- **Heartbeat**: ⚠ hace 60d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Rúa Fraga do Rei, 14, 15810 Arzúa, A Coruña
- **Source query**: `restaurante Arzúa`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Pulpería Parrillada Europa · Arzúa

- **Maps**: https://maps.google.com/?cid=1555727504897926089&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 981 93 88 72
- **Reseñas**: 1733 totales · rating 4.3
- **Heartbeat**: ❄ hace 134d
- **Span 5 destacadas**: ✓ 0.4a
- **Dirección**: Rúa Luís Seoane, 3, 15810 Arzúa, A Coruña
- **Source query**: `restaurante Arzúa`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Ourense

### A Casa do Pulpo · Ourense

- **Maps**: https://maps.google.com/?cid=8636628298113025247&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.facebook.com/acasadopulpo/
- **Tel**: +34 988 23 83 08
- **Reseñas**: 2434 totales · rating 4.2
- **Heartbeat**: ⚠ hace 119d
- **Span 5 destacadas**: ✓ 0.3a
- **Dirección**: Calle, Rúa Juan de Austria, 15, 32005 Ourense
- **Source query**: `restaurante Ourense`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Taberna Pulpería Atarazana · Ourense

- **Maps**: https://maps.google.com/?cid=924699381495278864&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.atarazanaourense.com/
- **Tel**: +34 649 98 38 58
- **Reseñas**: 2390 totales · rating 4.4
- **Heartbeat**: ❄ hace 124d
- **Span 5 destacadas**: ✓ 0.2a
- **Dirección**: Rúa dos Fornos, 11, 32005 Ourense
- **Source query**: `restaurante Ourense`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Sarria

### Restaurante Mesón Roberto · Sarria

- **Maps**: https://maps.google.com/?cid=4912511745513607363&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: https://www.mesonroberto.com/
- **Tel**: +34 982 53 40 24
- **Reseñas**: 1815 totales · rating 4.4
- **Heartbeat**: ⚠ hace 90d
- **Span 5 destacadas**: ✓ 0.5a
- **Dirección**: Rúa Malecón do Río Sarria, 13, 17, 27600 Sarria, Lugo
- **Source query**: `restaurante Sarria`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Lista — Ferrol

### Casalexo · Ferrol

- **Maps**: https://maps.google.com/?cid=1982550149482905974&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: http://www.casalexo.com/?idioma=es
- **Tel**: +34 981 35 40 53
- **Reseñas**: 1687 totales · rating 4.5
- **Heartbeat**: ⚠ hace 110d
- **Span 5 destacadas**: ✓ 1.4a
- **Dirección**: Rúa Pardo Baixo, 15403 Ferrol, A Coruña
- **Source query**: `restaurante Ferrol`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

### Mesón La Cañita · Ferrol

- **Maps**: https://maps.google.com/?cid=16636247338797401509&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA
- **Web**: —
- **Tel**: +34 881 12 83 94
- **Reseñas**: 1658 totales · rating 4.2
- **Heartbeat**: ❄ hace 253d
- **Span 5 destacadas**: 🚩 3.1a (probable establecido viejo)
- **Dirección**: C. de María, 91, 15401 Ferrol, La Coruña
- **Source query**: `restaurante Ferrol`
- **Verificación manual pendiente**: volumen real Maps · IG handle · DMs abiertos · dueño · hook
- **Estado**: ⬜ por contactar

## Resumen

| Ciudad | Cualificados | Contactados | Respuestas | Conversaciones |
|---|---|---|---|---|
| Santiago | 4 | 0 | 0 | 0 |
| Combarro | 3 | 0 | 0 | 0 |
| Costa da Morte | 4 | 0 | 0 | 0 |
| Lugo | 5 | 0 | 0 | 0 |
| Vigo | 3 | 0 | 0 | 0 |
| O Grove | 5 | 0 | 0 | 0 |
| Ribeira Sacra | 3 | 0 | 0 | 0 |
| Portomarín | 2 | 0 | 0 | 0 |
| Sanxenxo | 6 | 0 | 0 | 0 |
| Pontevedra | 4 | 0 | 0 | 0 |
| A Coruña | 1 | 0 | 0 | 0 |
| Cambados | 2 | 0 | 0 | 0 |
| Arzúa | 4 | 0 | 0 | 0 |
| Ourense | 2 | 0 | 0 | 0 |
| Sarria | 1 | 0 | 0 | 0 |
| Ferrol | 2 | 0 | 0 | 0 |
| **Total** | **51** | **0** | **0** | **0** |