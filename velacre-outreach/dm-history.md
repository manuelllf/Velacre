# Histórico de DMs enviados (no repetir)

> Lista de prospects ya contactados por Manuel en fases anteriores. El pipeline de discovery filtra estos nombres automáticamente (`scripts/outreach/discovery/1-source.mjs` lee este archivo). Si un mismo negocio sale por Places API en un batch nuevo, se descarta antes de llegar a la lista cualificada.
>
> **Resultado de estos DMs**: 3-4 respuestas, 0 clientes, mucha pérdida de impulso. Por eso el pivote a discovery con guion Mom Test (ver `dm-templates.md` y `guion-llamada.md`).

## Lista — fase abril 2026

Hostelería:
- O Fogar da Carne (Narón)
- Taberna Cunqueirito
- El Papatorio (Santiago)
- Taberna A Pedra (Vigo)
- A Taberna do Bispo (Santiago)
- A Noiesa Casa de Comidas (Santiago)
- Redes Compostela (Santiago)
- Tizar Gourmet (Ourense)
- O Pincho (Ferrol)
- O Cabo
- Mesón O Pote
- Taberna da Galera (A Coruña)
- "El de Alberto"
- Tiagos Churrasco
- Posto Santo Bar
- Somos Gumer (Pontevedra)
- The Othilio Bar (Vigo)
- Volteo Tortillería
- O Sendeiro (Santiago)
- Raíces Food

Hoteles:
- Noa Boutique Hotel (Oleiros)
- Atmos Hotel (Outes)
- Hotel Mardevela (Sanxenxo)
- Hotel Plaza A Coruña

Otros:
- Javier Agote (SEO local)

## Patrones de matching para el pipeline

El script hace match case-insensitive por substring contra `name` y `formattedAddress` de Places. Patrones (uno por línea, tipo regex permisivo):

```
fogar da carne
cunqueir
papatorio
a pedra
do bispo
noiesa
redes compostela
tizar
o pincho
mesón o pote
o cabo
taberna da galera
tiagos
churrasco
posto santo
gumer
othilio
volteo
tortillería
sendeiro
raíces food
raices food
noa boutique
atmos hotel
mardevela
plaza coruña
hotel plaza
javier agote
```
