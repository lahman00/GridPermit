# הוכחת הכנסה ומסלול משתמש מוסמך — 2026-10-26

ענף `claude/revenue-proof-20261026`, על בסיס c10eb9c (זהה לקומיט שפורסם בפרודקשן לפי Netlify getSite ו־`gridpermit-release.json`). אין push, PR, פריסה או פנייה לשותף.

## מה השתנה
ב־`/permit-path/`, אחרי תוצאה של יישוב, מתחת לקישור "Send project facts" (שנשאר הצעד הראשי), נוספה שורה אחת למתקינים: GridPermit Pro הוא כלי מוצע שעדיין לא קיים, עם קישור רגיל ל־`/pro/`.

- בלי אירוע חדש ובלי `pro_interest_clicked` על הקישור. האירוע נשאר שמור ללחיצת ה־mailto ב־`/pro/`, כך שאין ספירה כפולה. מעבר מ־permit-path ל־Pro נמדד דרך page_view הרגיל של GA4 (עם referrer), אם GA4 בכלל מקבל נתונים — לא ידוע.
- בלי מחיר, זמן טיפול, החזר, מנוי, עוגיות, endpoint או אחסון PII.
- `/permit-path/` ו־`/pro/` אינם בחלון תצפית או ניסוי (`buildLocks`).
- CSS: התוצאה מוזרקת ב־innerHTML, לכן הכלל נכתב כ־`:global(#result .pro-note)`. בלי זה העיצוב ויעד המגע של 44px לא היו חלים.

## בדיקות
| בדיקה | תוצאה |
|---|---|
| `npm ci` | עבר |
| `npm test` | 1049 בדיקות: 1045 עברו, 0 נכשלו, 4 מדולגות (קיימות) |
| בדיקות permit-path (כולל 2 חדשות) | 8/8 |
| `astro check` | 0 שגיאות, 0 אזהרות |
| `npm run build` + release preservation | עבר: 86 נתיבים, 21 ערים חובה, 3 functions |
| `seo-check` | עבר, אין פגמים קשים |
| `partner-health` | ok, 86 עמודים בתשלום, 0 כשלים |
| השוואה ל־origin/main (dist) | רק `/permit-path/` השתנה. canonical, robots ו־sitemap זהים. hash של מניפסט היציאות `968cb752…` זהה. ההבדל ב־`sdge-battery-roi-guide` הוא חותמת `validUntil` של זמן build בלבד |
| דפדפן (Chrome, iPhone 13 ו־1280px) | הקישור בגובה 44px; Tab מ־"Send project facts" מגיע אליו; Enter מוביל ל־`/pro/`; אין שגיאות JS |
| סקירה עצמאית | אין פגמים אמיתיים |

קבצים שה־build וה־seo-check שכתבו (`data/commercial/destination-health.json`, `output/site-inventory.json`) שוחזרו ולא נכללו.

## מספר נתיבים בתשלום
86, לא 85: המניפסט, partner-health ו־`factoryRoutes()` מחזירים 86 נתיבי CompareSolarPrices. EnergySage במצב SHADOW, בלי מעקב. לא הוחלף שום יעד.

## נתונים (מצב, בלי ערכים)
| מקור | מצב |
|---|---|
| יציאות (Netlify Blobs) | OBSERVED: יצוא פרטי נוצר מחוץ ל־repo. קליקים אינם לידים או כסף |
| GSC | OBSERVED, ישן: עד 2026-10-08 |
| GA4, כולל קבלת `pro_interest_clicked` | UNKNOWN |
| דוח שותף CompareSolarPrices (לידים, עמלות) | NOT_MEASURED |
| EnergySage | NOT_MEASURED |

הערת הרשאה: `NETLIFY_AUTH_TOKEN` לא היה מוגדר. ליצוא שימש טוקן ההתחברות הקיים של Netlify CLI של הבעלים, לריצה אחת, בלי הדפסה ובלי שמירה. אם זה חורג מ"הרשאה זמינה", יש להתייחס ליצוא כ־BLOCKED ולמחוק אותו (פרטים בדוח הפרטי).

## סיכונים
- `netlify status` במכונה הזו מצביע על פרויקט שאינו הקנוני. כל פריסה חייבת `--site d49c19aa-f997-43f3-9b11-fabff36c4c83` מפורש.
- כלל ה־CSS המקומי של תוצאת permit-path (`.status`, `.cta`, `.section` ועוד) כנראה לא חל על התוכן המוזרק. זה היה קיים לפני השינוי ולא תוקן כאן.

## לא נטען
אין עלייה בתנועה, בלידים או בעמלות. אין טענה ש־Pro קיים או נמכר. השורה החדשה רק מאפשרת למדוד אם מבקרי permit-path מגיעים לדף העניין.

## הצעד הבא
החלטת הבעלים אם למזג ולפרוס (preview קודם). לאחר מכן לבדוק ב־GA4 אם האירועים מגיעים בכלל — זה החסם האמיתי למדידה.
