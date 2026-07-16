# UI Component Library — Catalog

Toate componentele sunt în `src/components/ui/`. Import unic:
```js
import { Card, Button, MetricCard, ... } from '../components/ui';
```

---

## Index

### Faza A — Foundation
| Componentă | Scop |
|------------|------|
| [Card](#card) | Container generic cu variante și status |
| [SectionHeader](#sectionheader) | Titlu de secțiune |
| [Button](#button) | Buton acționabil cu 5 variante |
| [IconButton](#iconbutton) | Buton circular/pătrat cu badge |
| [Input](#input) | Câmp text cu label, eroare, helper |
| [SearchBar](#searchbar) | Input specializat pentru căutare |
| [StatusBadge](#statusbadge) | Indicator semantic de stare |
| [EmptyState](#emptystate) | Stare vidă cu CTA opțional |
| [Skeleton](#skeleton) | Placeholder animat pentru loading |
| [Divider](#divider) | Separator vizual H/V |

### Faza B — Vehicle
| Componentă | Scop |
|------------|------|
| [HeroCard](#herocard) | Card de prim-plan cu valoare mare |
| [MetricCard](#metriccard) | Card compact pentru metrici cu trend |
| [HealthGauge](#healthgauge) | Indicator SVG arc pentru scor sănătate |
| [RecommendationCard](#recommendationcard) | Recomandare acționabilă cu prioritate |
| [PredictionCard](#predictioncard) | Prognoză cu confidență |
| [TimelineCard](#timelinecard) | Element în linie cronologică |
| [MaintenanceCard](#maintenancecard) | Task de mentenanță cu deadline dublu |
| [DocumentCard](#documentcard) | Card pentru document atașat |
| [WorkshopCard](#workshopcard) | Card pentru service auto |
| [CostCard](#costcard) | Afișare cost cu breakdown detaliat |
| [MilestoneCard](#milestonecard) | Realizare/etapă cu progress |

---

## Faza A — Foundation

---

### Card

**Scop:** Container universal pentru orice conținut grupat. Aplicat peste tot unde datele formează o unitate vizuală distinctă.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| variant | `'default'│'outlined'│'filled'│'elevated'` | `'default'` | Aspectul vizual al containerului |
| status | `'optimal'│'good'│'monitor'│'caution'│'critical'│'neutral'` | — | Bordură și tint semantic |
| padding | `'none'│'sm'│'md'│'lg'` | `'md'` | Padding interior |
| onPress | `function` | — | Dacă e furnizat, card-ul devine acționabil |
| disabled | `boolean` | `false` | Dezactivează press + reduce opacitate |
| style | `object` | — | Override container |
| children | `ReactNode` | — | Conținut |
| testID | `string` | — | |
| accessibilityLabel | `string` | — | |

**Variante:** `default` (bg[1] + border subtle), `outlined` (bg[0] + border default), `filled` (bg[2] + no border), `elevated` (bg[2] + shadow)

**State:** none (pur prezentațional, cu excepția press scale când `onPress` e furnizat)

**Animații:** Press scale `0.98` → `1`, durata `motion.duration.fast`, `useNativeDriver: true`

**Accesibilitate:** `accessibilityRole="button"` când `onPress` e furnizat, `accessibilityState={{ disabled }}`

**Utilizare:**
```jsx
// Card simplu
<Card><Text>Conținut</Text></Card>

// Card cu status
<Card variant="filled" status="caution">
  <Text>Temperatură ridicată</Text>
</Card>

// Card acționabil
<Card onPress={() => navigation.navigate('Details')}>
  <Text>Apasă pentru detalii</Text>
</Card>
```

---

### SectionHeader

**Scop:** Titlu standardizat pentru orice secțiune sau grup de carduri. Opțional afișează un buton text la dreapta (ex: "Vezi tot").

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | Titlul principal |
| subtitle | `string` | — | Text descriptiv sub titlu |
| action | `{label: string, onPress: fn}` | — | Buton text la dreapta |
| size | `'sm'│'md'│'lg'` | `'md'` | Dimensiunea titlului |
| uppercase | `boolean` | `true` | Transformare UPPERCASE |
| style | `object` | — | Override container |

**Variante:** sm (11px), md (13px), lg (14px)

**State:** none

**Animații:** none

**Accesibilitate:** action → `accessibilityRole="button"`, `accessibilityLabel=action.label`

**Utilizare:**
```jsx
<SectionHeader title="Subsisteme" action={{ label: 'Toate', onPress: () => {} }} />
<SectionHeader title="Istoric" subtitle="Ultimele 30 de zile" size="lg" uppercase={false} />
```

---

### Button

**Scop:** Acțiunile principale ale utilizatorului. 5 variante semantice (primary, secondary, ghost, danger, success) × 3 dimensiuni.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| label | `string` | required | Textul butonului |
| onPress | `function` | required | Callback |
| variant | `'primary'│'secondary'│'ghost'│'danger'│'success'` | `'primary'` | |
| size | `'sm'│'md'│'lg'` | `'md'` | |
| loading | `boolean` | `false` | Afișează ActivityIndicator, blochează press |
| disabled | `boolean` | `false` | |
| leftIcon | `string│ReactNode` | — | |
| rightIcon | `string│ReactNode` | — | |
| fullWidth | `boolean` | `false` | `width: '100%'` |
| style | `object` | — | |
| testID | `string` | — | |
| accessibilityLabel | `string` | label | |

**State:** `loading` (busy), `disabled`

**Animații:** Press scale `0.97` → `1`, `motion.duration.fast`, `useNativeDriver: true`

**Accesibilitate:** `accessibilityRole="button"`, `accessibilityState={{ disabled, busy: loading }}`

**Utilizare:**
```jsx
<Button label="Salvează" onPress={handleSave} />
<Button label="Șterge" variant="danger" onPress={handleDelete} />
<Button label="Se încarcă..." loading />
<Button label="Export PDF" leftIcon="📄" onPress={handleExport} fullWidth />
```

---

### IconButton

**Scop:** Acțiuni secundare compacte fără label text (close, edit, share, notificări). Suportă badge numeric.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| icon | `string│ReactNode` | required | Conținutul butonului |
| onPress | `function` | required | |
| variant | `'default'│'outlined'│'ghost'│'danger'` | `'default'` | |
| size | `'xs'│'sm'│'md'│'lg'` | `'md'` | Dimesniunea: 28/32/40/48px |
| badge | `number│boolean` | — | Număr → cifra; `true` → dot roșu |
| disabled | `boolean` | `false` | |
| shape | `'circle'│'square'` | `'circle'` | Forma butonului |
| style | `object` | — | |
| accessibilityLabel | `string` | required | |
| testID | `string` | — | |

**State:** `disabled`

**Animații:** Press scale `0.92` → `1`, `motion.duration.fast`, `useNativeDriver: true`

**Accesibilitate:** `accessibilityRole="button"`, `accessibilityState={{ disabled }}`

**Utilizare:**
```jsx
<IconButton icon="✕" onPress={onClose} accessibilityLabel="Închide" />
<IconButton icon="🔔" badge={5} onPress={openNotifications} accessibilityLabel="Notificări (5)" />
<IconButton icon="⚙" shape="square" variant="ghost" onPress={openSettings} accessibilityLabel="Setări" />
```

---

### Input

**Scop:** Orice interacțiune text cu utilizatorul: IP server, VIN, preț combustibil, note. Gestionează focus state vizual și mesaje de validare.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| value | `string` | required | |
| onChangeText | `function` | required | |
| label | `string` | — | Etichetă afișată deasupra |
| placeholder | `string` | — | |
| error | `string` | — | Mesaj eroare (activează border roșu + tint) |
| helper | `string` | — | Text ajutător sub câmp |
| disabled | `boolean` | `false` | |
| multiline | `boolean` | `false` | |
| numberOfLines | `number` | `1` | Relevant doar când `multiline=true` |
| keyboardType | `string` | `'default'` | |
| secureTextEntry | `boolean` | `false` | |
| leftIcon | `ReactNode` | — | |
| rightIcon | `ReactNode` | — | |
| onSubmitEditing | `function` | — | |
| onFocus | `function` | — | |
| onBlur | `function` | — | |
| returnKeyType | `string` | — | |
| style | `object` | — | Override wrapper |
| inputStyle | `object` | — | Override TextInput |
| testID | `string` | — | |
| accessibilityLabel | `string` | label | |

**State intern:** `focused` (border accent + bg[1])

**Animații:** none (tranziția de border color e sincronă cu state)

**Accesibilitate:** `accessibilityLiveRegion="polite"` pe mesajul de eroare

**Utilizare:**
```jsx
const [ip, setIp] = useState('');
const [err, setErr] = useState('');

<Input
  label="Adresă server"
  value={ip}
  onChangeText={setIp}
  error={err}
  keyboardType="numeric"
  helper="IP-ul adaptorului OBD2"
/>
```

---

### SearchBar

**Scop:** Input specializat pentru filtrare și căutare în liste. Buton X apare automat când există text, icon filter opțional.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| value | `string` | required | |
| onChangeText | `function` | required | |
| placeholder | `string` | `'Caută...'` | |
| onClear | `function` | — | Dacă lipsește, curăță automat |
| onFilter | `function` | — | Dacă e furnizat, apare icon filter |
| autoFocus | `boolean` | `false` | |
| filterActive | `boolean` | `false` | Colorează icon-ul filter în accent |
| style | `object` | — | |
| testID | `string` | — | |

**State intern:** `focused` (border accent + bg[2])

**Animații:** none

**Accesibilitate:** `accessibilityRole="search"` pe TextInput

**Utilizare:**
```jsx
const [q, setQ] = useState('');
const [filterOn, setFilterOn] = useState(false);

<SearchBar
  value={q}
  onChangeText={setQ}
  onFilter={() => setFilterOn(p => !p)}
  filterActive={filterOn}
/>
```

---

### StatusBadge

**Scop:** Indicator compact de stare semantică. Trei variante: `filled` (bg tint + border), `outlined` (transparent + border), `dot` (cerc mic).

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| status | `'optimal'│'good'│'monitor'│'caution'│'critical'│'neutral'` | `'neutral'` | |
| label | `string` | — | Textul badge-ului (nu apare la `dot`) |
| variant | `'filled'│'outlined'│'dot'` | `'filled'` | |
| size | `'sm'│'md'│'lg'` | `'md'` | |
| pulse | `boolean` | `false` | Animație opacity loop (recomandat pentru `critical`) |
| style | `object` | — | |

**State:** none (extern)

**Animații:** `pulse=true` → opacity `1 → 0.4 → 1`, loop, `motion.duration.slow`, `useNativeDriver: true`

**Accesibilitate:** `accessibilityLabel=label│status`

**Utilizare:**
```jsx
<StatusBadge status="optimal" label="Optim" />
<StatusBadge status="critical" label="Critic" pulse />
<StatusBadge status="monitor" variant="dot" />
<StatusBadge status="caution" label="Atenție" variant="outlined" size="sm" />
```

---

### EmptyState

**Scop:** Înlocuiește liste sau secțiuni goale cu un mesaj util și o acțiune de remediere. Trei mărimi pentru contexte diferite.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| icon | `string│ReactNode` | — | |
| subtitle | `string` | — | |
| action | `{label: string, onPress: fn}` | — | Buton CTA |
| size | `'sm'│'md'│'lg'` | `'md'` | |
| style | `object` | — | |

**State:** none

**Animații:** none

**Accesibilitate:** Moștenit din Button pentru CTA

**Utilizare:**
```jsx
// În interiorul unui Card
<Card><EmptyState icon="📋" title="Fără documente" size="sm" /></Card>

// Secțiune
<EmptyState
  icon="🔍"
  title="Niciun rezultat"
  subtitle="Modifică filtrele de căutare"
  action={{ label: 'Resetează', onPress: resetFilters }}
/>
```

---

### Skeleton

**Scop:** Placeholder animat pentru conținut în curs de încărcare. Reduce perceived lag și previne layout shift.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| variant | `'text'│'rect'│'circle'│'card'` | `'rect'` | Forma placeholder-ului |
| width | `number│string` | `'100%'` | — |
| height | `number` | per variant | text=14, rect=80, circle=40, card=100 |
| lines | `number` | `1` | Pt `variant='text'`: nr de linii |
| animate | `boolean` | `true` | Dezactivează animația |
| style | `object` | — | |

**State:** none (animație internă cu loop)

**Animații:** Opacity `1 → 0.35 → 1`, loop, `motion.duration.slow`, `useNativeDriver: true`. Cleanup pe unmount.

**Utilizare:**
```jsx
// Loading card
{loading ? (
  <>
    <Skeleton variant="text" width={120} />
    <Skeleton variant="text" lines={3} style={{ marginTop: 8 }} />
    <Skeleton variant="card" height={100} style={{ marginTop: 12 }} />
  </>
) : <ActualContent />}
```

---

### Divider

**Scop:** Delimitare vizuală ușoară între secțiuni sau elemente. Suportă label centrat și orientare verticală.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| orientation | `'horizontal'│'vertical'` | `'horizontal'` | |
| label | `string` | — | Text centrat (doar horizontal) |
| strength | `'subtle'│'default'│'strong'` | `'default'` | Intensitatea liniei |
| spacing | `number` | — | Margin vertical (H) sau orizontal (V) |
| style | `object` | — | |

**State:** none

**Animații:** none

**Utilizare:**
```jsx
<Divider />
<Divider label="SAU" strength="subtle" />
<View style={{ flexDirection: 'row' }}>
  <Text>A</Text>
  <Divider orientation="vertical" />
  <Text>B</Text>
</View>
```

---

## Faza B — Vehicle

---

### HeroCard

**Scop:** Card de prim-plan care evidențiază O singură valoare cheie (scor sănătate, distanță, consum). Primul element vizual al unui ecran sau secțiune importantă.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| value | `string│number` | required | Valoarea principală |
| unit | `string` | — | Unitatea valorii |
| title | `string` | — | Titlul cardului |
| subtitle | `string` | — | Context secundar |
| description | `string` | — | Text suplimentar |
| status | status enum | `'neutral'` | Colorează border + tint |
| icon | `string│ReactNode` | — | Icon colț dreapta-sus |
| onPress | `function` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Fade + slide-up la mount (`motion.duration.normal`), press scale `0.98`

**Utilizare:**
```jsx
<HeroCard
  value={healthScore}
  unit="%"
  title="Sănătate vehicul"
  subtitle="Audi A6 C4 · 2.5 TDI"
  status={scoreToStatus(healthScore)}
  icon="🚗"
  onPress={() => navigation.navigate('VehicleHealth')}
/>
```

---

### MetricCard

**Scop:** Card compact pentru o singură metrică cu trend față de perioada anterioară. Optimizat pentru grid-uri 2×2 sau 3×3.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| value | `string│number` | required | |
| label | `string` | required | |
| unit | `string` | — | |
| trend | `number` | — | Delta % față de referință |
| trendInverse | `boolean` | `false` | `true` când trend negativ = bun (ex: consum) |
| trendLabel | `string` | — | Context trend (ex: 'față de ieri') |
| status | status enum | `'neutral'` | |
| icon | `string│ReactNode` | — | |
| size | `'sm'│'md'│'lg'` | `'md'` | |
| onPress | `function` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Press scale `0.97`, `useNativeDriver: true`

**Utilizare:**
```jsx
<View style={{ flexDirection: 'row', gap: 8 }}>
  <MetricCard label="Viteză" value={87} unit="km/h" status="good" trend={5.2} style={{ flex: 1 }} />
  <MetricCard label="Consum" value={7.4} unit="L/100" trendInverse trend={12.3} style={{ flex: 1 }} />
</View>
```

---

### HealthGauge

**Scop:** Vizualizare SVG arc pentru scor de sănătate animat. Semicircle (π → 2π). Versiunea din `ui/` este genericA și fără dependențe de i18n/context.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| score | `number` | required | 0–100 |
| label | `string` | — | Eticheta sub valoare |
| subtitle | `string` | — | Text colorat semantic sub label |
| size | `'sm'│'md'│'lg'│'xl'` | `'md'` | Total: 120/180/240/300px |
| animate | `boolean` | `true` | Animează arcul la mount |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Arc animated de la 0 la `score`, `motion.duration.reveal` (800ms), JS thread (`useNativeDriver: false` — SVG limitare)

**Culoare:** derivată din `getHealthColor(score)` din `statusUtils`

**Utilizare:**
```jsx
<HealthGauge score={healthData.overall} label="SĂNĂTATE" subtitle={healthData.message} size="lg" />
```

---

### RecommendationCard

**Scop:** Prezintă o recomandare acționabilă cu prioritate vizuală (low/medium/high/critical), descriere și buton CTA. Suportă dismiss cu animație.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| description | `string` | — | |
| priority | `'low'│'medium'│'high'│'critical'` | `'medium'` | |
| icon | `string│ReactNode` | — | |
| action | `{label: string, onPress: fn}` | — | |
| onDismiss | `function` | — | Dacă e furnizat, apare butonul ✕ |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Fade-in la mount (`motion.duration.normal`), fade-out la dismiss (`motion.duration.fast`)

**Utilizare:**
```jsx
<RecommendationCard
  title="Filtru aer necesită înlocuire"
  description="Consumul de combustibil a crescut cu 8% în ultima lună."
  priority="high"
  icon="⚠"
  action={{ label: 'Programează', onPress: openBooking }}
  onDismiss={() => dismissRecommendation(id)}
/>
```

---

### PredictionCard

**Scop:** Prezintă o predicție cu nivel de confidență vizualizat printr-un progress bar și badge semantic. Folosit pentru estimări predictive AI.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| prediction | `string` | required | Textul predicției |
| confidence | `'low'│'medium'│'high'` | `'medium'` | |
| timeframe | `string` | — | Orizont temporal |
| icon | `string│ReactNode` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** none

**Utilizare:**
```jsx
<PredictionCard
  title="Filtru ulei"
  prediction="Va necesita înlocuire la aproximativ 247 000 km pe baza intervalului mediu."
  confidence="high"
  timeframe="~1200 km"
  icon="🔧"
/>
```

---

### TimelineCard

**Scop:** Element individual într-o linie cronologică verticală. Liniile de conectare sus/jos sunt gestionate prin `isFirst`/`isLast`.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| description | `string` | — | |
| date | `string` | — | |
| time | `string` | — | |
| type | `'event'│'maintenance'│'alert'│'trip'│'milestone'` | `'event'` | Colorează dot-ul |
| isFirst | `boolean` | `false` | Ascunde linia de sus |
| isLast | `boolean` | `false` | Ascunde linia de jos |
| onPress | `function` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Press scale `0.98`

**Utilizare:**
```jsx
{events.map((e, i) => (
  <TimelineCard
    key={e.id}
    title={e.title}
    description={e.description}
    date={formatDate(e.timestamp)}
    time={formatTime(e.timestamp)}
    type={e.type}
    isFirst={i === 0}
    isLast={i === events.length - 1}
    onPress={() => openEvent(e.id)}
  />
))}
```

---

### MaintenanceCard

**Scop:** Item de mentenanță cu deadline dublu (km + dată), status (upcoming/overdue/done) și cost estimat. Tratament vizual distinct per status.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| subtitle | `string` | — | Subsistemul vizat |
| dueKm | `number` | — | Km la care e programat |
| dueDate | `string` | — | Data formatată |
| estimatedCost | `number` | — | |
| currency | `string` | `'RON'` | |
| status | `'upcoming'│'overdue'│'done'` | `'upcoming'` | |
| urgency | `'low'│'normal'│'high'` | `'normal'` | |
| onPress | `function` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Press scale `0.98`

**Utilizare:**
```jsx
<MaintenanceCard
  title="Schimb ulei"
  dueKm={245000}
  dueDate="oct 2025"
  estimatedCost={350}
  status={isOverdue ? 'overdue' : 'upcoming'}
  urgency={isOverdue ? 'high' : 'normal'}
  onPress={() => navigation.navigate('MaintenanceDetail', { id })}
/>
```

---

### DocumentCard

**Scop:** Afișează metadatele unui document atașat vehiculului (ITP, asigurare, facturi) cu icon vizual specific tipului.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| documentType | `'pdf'│'image'│'doc'│'xls'│'other'` | `'other'` | |
| fileSize | `string` | — | Ex: `'2.4 MB'` |
| date | `string` | — | |
| category | `string` | — | Ex: `'Asigurare'` |
| onPress | `function` | — | |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Press scale `0.97`

**Utilizare:**
```jsx
<DocumentCard
  title="Poliță RCA 2025 — Generali"
  documentType="pdf"
  fileSize="1.2 MB"
  date="15 ian 2025"
  category="Asigurare"
  onPress={() => openDocument(doc.uri)}
/>
```

---

### WorkshopCard

**Scop:** Prezintă un service auto cu rating, distanță și acțiuni rapide (navigare, apel).

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| name | `string` | required | |
| address | `string` | — | |
| rating | `number` | — | 0–5 |
| reviewCount | `number` | — | |
| distance | `string` | — | Ex: `'3.2 km'` |
| phone | `string` | — | |
| certified | `boolean` | `false` | Badge "Autorizat" |
| onPress | `function` | — | |
| onCallPress | `function` | — | Buton apel rapid |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** Press scale `0.98`

**Utilizare:**
```jsx
<WorkshopCard
  name={shop.name}
  address={shop.address}
  rating={shop.rating}
  distance={`${shop.distanceKm.toFixed(1)} km`}
  certified={shop.isAuthorized}
  onPress={() => openWorkshop(shop.id)}
  onCallPress={() => Linking.openURL(`tel:${shop.phone}`)}
/>
```

---

### CostCard

**Scop:** Afișează un cost principal cu trend față de perioada anterioară și, opțional, un breakdown detaliat expandabil pe categorii.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| amount | `number` | required | |
| currency | `string` | `'RON'` | |
| period | `string` | — | Ex: `'Iulie 2025'` |
| trend | `number` | — | Delta % față de precedent |
| trendInverse | `boolean` | `true` | Default true (costuri mai mari = rău) |
| breakdown | `Array<{label, amount, icon?}>` | — | Activează expandare |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**State intern:** `expanded` (toggle breakdown)

**Animații:** none

**Utilizare:**
```jsx
<CostCard
  title="Cheltuieli luna aceasta"
  amount={costs.total}
  period={currentMonth}
  trend={costs.trendVsLastMonth}
  trendInverse
  breakdown={costs.categories}
/>
```

---

### MilestoneCard

**Scop:** Marchează atingerea unui obiectiv important. `achieved=false` + `progress` afișează progress bar. `achieved=true` activează design-ul celebratoriu.

**Props:**
| Prop | Tip | Default | Descriere |
|------|-----|---------|-----------|
| title | `string` | required | |
| description | `string` | — | |
| achieved | `boolean` | `false` | |
| icon | `string│ReactNode` | — | |
| achievedDate | `string` | — | Afișat doar când `achieved=true` |
| target | `string` | — | Descrierea țintei |
| progress | `number` | — | 0–100, afișat ca progress bar când `!achieved` |
| loading | `boolean` | `false` | |
| style | `object` | — | |

**Animații:** none

**Utilizare:**
```jsx
<MilestoneCard
  title="250 000 km"
  description="Sfert de milion de kilometri parcurși"
  achieved={odometer >= 250000}
  icon="🏆"
  achievedDate={milestoneDate}
  target="250 000 km"
  progress={Math.min(100, (odometer / 250000) * 100)}
/>
```

---

## Design Tokens

Toate componentele folosesc exclusiv tokenuri din `src/theme/index.js`:

```js
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
```

| Token | Utilizare |
|-------|-----------|
| `colors.bg[0-5]` | Fundal stratificat |
| `colors.border.*` | Borduri subtle/default/strong |
| `colors.text.*` | Texte primary/secondary/tertiary/disabled |
| `colors.accent.*` | Accent albastru |
| `colors.status.*` | Culori semantice de stare |
| `colors.tint.*` | Fundal translucid semantic |
| `spacing[0-16]` | Toate marginile și padding-urile |
| `typography.sizes.*` | Toate dimensiunile de font |
| `typography.weights.*` | Toate grosimile de font |
| `radii.*` | Toate razele de colț |
| `motion.duration.*` | Toate duratele de animație |
| `layout.*` | Constante de layout ecran |
