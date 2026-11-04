# Cassandra — Teknik Özet (SPEC)

Cassandra: iki kişilik (Semihcan ve eşi) kişisel organizasyon uygulaması. iPhone ana ekranına eklenen PWA, iPad'de de çalışır. Arayüz dili Türkçe.
Bu dosya, tasarım konuşmasının sonucudur. Karar verilmiş yerler kesindir. "AÇIK" işaretli yerlerde kullanıcıya sor.

## 1. Altyapı

- Barındırma: GitHub Pages (statik, build adımı mümkünse yok ya da çok hafif)
- Kimlik doğrulama ve veri: Firebase Auth (e-posta/şifre) + Firestore, ücretsiz katman
- Sunucu tarafı: Cloudflare Worker (yapay zekâ vekili + iPhone takvim akışı), ücretsiz katman
- Yapay zekâ: Gemini ücretsiz katman, yalnızca Worker üzerinden çağrılır. API anahtarı istemciye asla girmez.
- Framework seçimi sende. Kriter: GitHub Pages'e doğrudan yayınlanır, küçük, iPhone Safari'de hızlı. Seçimi yapmadan önce kullanıcıya iki cümleyle öner.
- PWA: uygulama adı **Cassandra** (manifest `name`/`short_name`, ana ekran etiketi, sayfa başlığı), manifest, apple-touch-icon, standalone görünüm, `env(safe-area-inset-*)` boşlukları, Firestore çevrimdışı önbellek açık.

## 2. Kullanıcılar ve erişim

- İki kullanıcı, her biri kendi Firebase hesabıyla girer.
- Eş, uygulamanın tamamına aynı yetkiyle erişir. Tek istisna **Kişisel** alanı: herkesin kişisel verisi yalnızca kendisine açıktır, diğeri göremez.
- Ortak alanlar (Ev İhtiyaçları, Ailenin Yapılacakları, İlaçlar, ortak Notlar, Aile takvim kayıtları) iki hesaba açıktır ve canlı senkronize olur.
- Hane (household) belgesi **elle** oluşturulur (Firebase konsolundan): iki UID'yi `members` dizisinde tutar. Davet kodu sistemi yazma.
- İki hesap açıldıktan sonra yeni kayıt (sign-up) kapatılır (Authentication › Settings › User actions, varsa).
- Bilinmesi gereken: Firebase konsolunu proje sahibi yönettiği için teknik olarak veriye oradan erişilebilir. Uygulama içinde eş göremez.

## 3. Sekmeler ve ekranlar

Alt menü (yüzen, 5 ikon): **Bugün · Takvim · Notlar · Ortak · Kişisel**. Sağ üstteki avatar (baş harf) **Ayarlar**'ı açar.

### Bugün
- Selamlama, tarih, ayarlar avatarı.
- Özet alanı (temaya göre farklı görünür, bkz. §6): bugünkü toplam süre, günlük hedefin yüzdesi, gün serisi.
- Aktivite kutuları: kullanıcının kendi aktiviteleri (sabit liste yok). Her kutuda bugünkü dakika, hedef varsa ilerleme çubuğu.
- Yaklaşan kayıtlar: takvimden sıradaki 3 kayıt (aile + kendi kişisel kayıtları). Kişisel olanda kilit rozeti.
- Ailenin açık yapılacak sayısı.
- İlaç kartı (aktif ilaç dönemi varsa): üç kişinin (Ben / Eşi / Aslan) bugünkü dozları saat sırasıyla, kişi avatarıyla; her birinde "aç/tok" etiketi ve işaretleme kutusu; sıradaki dozun saati öne çıkar. Ayrıntı: "İlaç takibi" bölümü.
- Günlük kişisel görevler (to-do): ilk taslaklarda vardı, v2 Bugün ekranında **çizilmedi**. Bugün'e ekle (başlık, tamamlandı işareti, tekrar seçeneği: yok / her gün / belirli günler). KARAR: görevler eklenebilir, düzenlenebilir, silinebilir; tekrar seçenekleri (yok / her gün / belirli günler) özelleştirilebilir. Görevler Kişisel'dir (`users/{uid}/tasks`).

### Kişisel (yalnızca sahibi görür)
- Üstte "Sadece sen görürsün" kilit rozeti.
- Başlangıçta **boş**. İngilizce, spor, yazılım gibi örnekler tasarımdaki örnek veridir, koda sabit gömülmez.
- Bu hafta kutusu: haftalık toplam süre + günlük çubuk grafik (Pzt başlangıçlı hafta).
- Aktivite kartları: ad, renk, plan metni ("haftada 4 gün · günlük 45 dk"), haftalık ilerleme (örn. 2/4 gün), 7 günlük ilerleme noktaları.
- **Aktivite ekle**: ad, haftada kaç gün (1–7), günlük süre hedefi (isteğe bağlı, açma-kapama + 15/30/45/60/90 dk ya da özel), renk. Sonradan düzenlenir ve arşivlenir (silmek yerine arşiv, geçmiş kayıtlar kalsın).
- **Süre ekle**: aktivite + toplam dakika, tarih varsayılan bugün (geçmişe dönük girilebilir). Aynı gün birden fazla kayıt olabilir. Sayaç/başlat-durdur **yok**.
- Hedefler: aylık hedef kartı çizildi ("Kasım: 20 gün spor, 3/20"). Haftalık, aylık ve uzun vadeli hedefler olacak. KARAR: hedefler uzun vadelidir ve ilerleme/grafik ekranından bağımsızdır (kendi ekranı). Basit tut: başlık, hedef değer, bitiş tarihi, ilerleme elle güncellenir; istenirse aktiviteye bağlanabilir (`linkedActivityId`). Tasarımı çizilmedi, temalarla uyumlu yap.
- Raporlar: haftalık / aylık / 3 aylık görünüm, aktiviteye göre renkli yığılmış çubuk. Tam ekran rapor görünümü **çizilmedi**; "Bu hafta" kutusuna dokununca açılsın.
- Gün serisi: üst üste en az bir süre kaydı olan gün sayısı.
- KARAR (grafik): tek grafik alanı. Üstte yatay kaydırmalı seçici: **Genel · Aktivite 1 · Aktivite 2 …**; altında dönem seçici **Günlük · Haftalık · Aylık** (kaydırmalı). Seri ve toplamlar seçilen aktiviteye (ya da genele) göre hesaplanır, yani aktivite bazlı seri de vardır.
- Teknik kararlar: akış bayatlamasına karşı uygulama açılışında ve hane verisi değişince `/cal/sync`; tek token iki yol (`/cal/{token}.ics`, `/cal/{token}/med.ics`); `medLogs` belge kimliği `{medicationId}_{date}_{time}`; kurallarda `doneBy`/`addedBy == request.auth.uid`; ilaç dönemi bitişi istemcide `endDate`'ten türetilir; fontlar yerel barındırılır; sign-up kapatma kullanıcı tarafından doğrulanır.
- Yapay zekâ haftalık yorum kartı (bkz. §8).

### İlaç takibi (ortak)
Dönemsel ilaç kullanımı (kür), üç kişi için: Semihcan, eşi ve Aslan. İlaçların hepsi **ortaktır**: iki hesap da tüm ilaçları görür, ekler, düzenler ve doz işaretler. Yeni sekme açmaz: yönetimi **Ortak** içinde üçüncü alt sekme olan "İlaçlar"da, günlük görünümü **Bugün**'deki ilaç kartındadır.
- **İlaç dönemi ekle**: **kimin için** (Semihcan / Eşi / Aslan; ilk ikisi hane belgesindeki `profiles`'tan, Aslan `dependents`'tan gelir), ilaç adı, doz metni (serbest: "1 tablet", "5 ml", "5 damla"), günde kaç kez (1–6), **aç / tok / fark etmez**, başlangıç tarihi, bitiş (gün sayısı ya da bitiş tarihi), not (isteğe bağlı).
- **Günde N kez girildiğinde saatler otomatik önerilir** (3 kez: 08:00, 14:00, 20:00; 2 kez: 09:00, 21:00; 1 kez: 09:00) ve tek tek düzenlenebilir. Her saat bir hatırlatmadır.
- Hatırlatma metni kişiyi ve aç/tok bilgisini taşır: "Aslan · D vitamini · 5 damla · tok karnına".
- Doz durumu: bekliyor / alındı / atlandı. **Kimin işaretlediği ve saati kaydedilir, herkese görünür** ("Eşi işaretledi · 14:05"). Aslan'ın dozunu ebeveynlerden biri verdiğinde diğeri anında "verildi · kim · saat" görür; çifte doz riskini azaltmak bu özelliğin ana amacıdır, bu yüzden verildi durumunu belirgin göster.
- Bugün kartı: üç kişinin bugünkü tüm dozları saat sırasıyla, kişi avatarı/rengiyle; kişiye göre filtre; sıradaki doz öne çıkar.
- Dönem bitince kendiliğinden arşivlenir; geçmiş dönemler kişi bazında listelenir (hangi ilaç, hangi tarihler, kaç doz alındı).
- Uygulama doz, süre ya da ilaç etkileşimi **önermez**; yalnızca girilen bilgiyi hatırlatır. Ekranda kısa not: "Doktorun yazdığı kullanım şeklini gir."
- Sağlık verisidir ama bilinçli olarak ortaktır (`households/{hid}/medications`, `medLogs`). Yalnızca hane üyeleri erişir.
- **Hatırlatma teslimi** (en hassas nokta): ilk yol iPhone Takvim akışıdır. Doz saatleri `RRULE;UNTIL` ile tekrar eden, `VALARM`'lı kayıtlar olarak ayrı bir "Cassandra İlaç" akışına yazılır; iPhone'un yerel Takvim'i bildirimi kendisi gösterir, uygulama kapalıyken ve internet yokken de çalışır. Akış ayrıdır ki ilaç kayıtları normal takvimi doldurmasın ve ayrı kapatılabilsin.
- Her kullanıcı kendi akışında **hangi kişilerin hatırlatmasını alacağını** seçer (`users/{uid}.medReminderFor`, varsayılan: kendisi + Aslan). Böylece eşin ilacının alarmı ona ait kalır, Aslan'ınki ikisinde de çalar.
- **Bilinen sınır**: Takvim alarmı "alındı" bilgisini bilmez. Biri Aslan'ın dozunu verdiyse diğerinin telefonu yine de çalabilir; uygulama açılınca doz "verildi" görünür. Bunu ekranda tek satırla belirt. Web push ile aşılabilir (alındıyı bilip bildirimi güncellemek), ama iOS'ta yalnızca ana ekrana eklenmiş PWA'da çalışır ve garanti değildir; ilk sürümde yok, ihtiyaç hissedilirse son aşamada değerlendir.
- Önemli ilaçlar için uygulamanın tek güvence olmadığını ekranda bir satırla belirt ("Önemli ilaçlar için telefon alarmını da kurabilirsin").

### Takvim
- Aylık ızgara + seçili günün kayıtları + yaklaşanlar listesi.
- Kayıt ekle: başlık, tarih, saat (isteğe bağlı), **kapsam: Aile / Kişisel**, tekrar (yok / haftalık / aylık / yıllık, doğum günleri için yıllık), hatırlatma (1 gün önce, 2 saat önce, vb.).
- Aile kayıtları işaretsizdir (eş de görür). Kişisel kayıtlar farklı renk + kilit rozetiyle ayrışır.
- "iPhone Takvim → Eşle" butonu: bölüm §9'a bak. Eşleme her kullanıcının kendi tercihidir.

### Notlar
- Kategori çipleri: Hepsi · Ev · Market · Aslan · **Kişisel** (kilitli, kullanıcıya özel).
- Kart ızgarası (iki sütun). Her kart serbest metin ya da işaretlenebilir madde listesi olabilir.
- KARAR: Market yalnızca Ortak › Ev İhtiyaçları'nda yaşar. Notlar'da ayrı Market kategorisi yok; kategori çipleri: Hepsi · Ev · Aslan · Kişisel.

### Ortak
- Üç alt sekme: **Ev İhtiyaçları**, **Ailenin Yapılacakları** ve **İlaçlar** (bkz. "İlaç takibi").
- Ev İhtiyaçları: kategoriler Market, Ev, Aslan (filtre çipleri, sayaçlı). Her satırda: işaretleme (alındı), ad, kategori, ekleyenin avatarı.
- Ailenin Yapılacakları: ad, işaretleme, atanan kişi (isteğe bağlı), avatar.
- Alt kısımda hızlı ekleme çubuğu. Biri eklediğinde diğerinde anında görünür (onSnapshot).
- v2 temalarında bu ekran çizilmedi. Referans: `design/v1/YonB.dc.html` içindeki sağ ekran (Mozaik). Notlar ve Ayarlar'daki kalıplarla temalandır.

### Ayarlar
- Tema seçimi (3 seçenek, canlı önizleme küçük renk şeritleriyle).
- iPhone Takvim eşleme, hatırlatma bildirimleri anahtarı, çıkış.

## 4. Veri modeli (Firestore)

```
users/{uid}                       displayName, theme, householdId, calendarToken (rastgele, yenilenebilir), medReminderFor ["self","aslan"]
users/{uid}/activities/{id}       name, color, weeklyDays, dailyMinutes|null, archived, createdAt
users/{uid}/logs/{id}             activityId, date "YYYY-MM-DD", minutes, createdAt
users/{uid}/goals/{id}            title, period (week|month|long), target, unit, linkedActivityId|null, dueDate|null
users/{uid}/tasks/{id}            title, done, repeat, date
users/{uid}/notes/{id}            title, body|items[], color, updatedAt
users/{uid}/events/{id}           kişisel takvim kaydı (alanlar aşağıdaki event ile aynı)
users/{uid}/insights/{weekId}     yapay zekâ haftalık özet önbelleği

Aşama 4 şema notları (uygulanan):
- events.repeat "none"|"weekly"|"monthly"|"yearly" (aylık/yıllık kısa aylarda ayın son gününe oturur, 29 Şubat → 28 Şubat); remind "none"|"at"|"30m"|"2h"|"1d" (saat gerektirenler yalnızca saatli kayıtta). Aile kayıtları households/{hid}/events, kişisel kayıtlar users/{uid}/events; hedef yalnızca seçilen kapsamdan belirlenir. Hatırlatmalar iPhone Takvim akışı (Aşama 7) gelene kadar bildirim üretmez; iPhone eşleme düğmesi pasif.

Aşama 3 şema notları (uygulanan):
- households/{hid}/notes.category yalnızca "ev"|"aslan" (Market kararı gereği); not rengi `color` (0–3, tema paleti sırası); `items` [{t, done}] ya da `body`. Kişisel notlar `users/{uid}/notes` altında, kategori alanı yok; hedef koleksiyon yalnızca seçilen kategoriden belirlenir (`src/lib/notes.js`, testli).
- shoppingItems/familyTodos: `assignee` uid ya da null; uygulama içinde atanan kişi avatarına dokunarak döner (atanmamış → ben → eşi).

Aşama 2 şema notları (uygulanan):
- activities.color = tema paletinden renk SIRASI (0–5), hex değil; renkler temayla birlikte değişir (`--act-0..5`).
- tasks: repeat "none"|"daily"|"days", days [0–6, Pzt=0], date (tek seferlik için gün, tekrarlı için başlangıç), done (tek seferlik), doneDates [] (tekrarlı). Açık kalan tek seferlik görev ertesi gün "geçmiş tarihli" olarak görünmeye devam eder.
- goals: period her zaman "long" (uzun vadeli), unit "saat"|"gün"|"adet", progress (elle), startDate, linkedActivityId (saat/gün biriminde otomatik ilerleme).

households/{hid}                  members [uidA, uidB], profiles {uid: {name, initial}}, dependents [{id:"aslan", name:"Aslan", initial:"A"}]   (elle oluşturulur)
households/{hid}/shoppingItems/{id}  text, category (market|ev|aslan), done, addedBy, createdAt
households/{hid}/familyTodos/{id}    text, done, assignee|null, addedBy, createdAt
households/{hid}/notes/{id}          category (ev|market|aslan), title, body|items[], addedBy, updatedAt
households/{hid}/events/{id}         title, date, time|null, repeat, remind, createdBy
households/{hid}/medications/{id}    forId (uid ya da dependent id), name, dose, timesPerDay, times ["08:00","14:00","20:00"], meal (aç|tok|fark_etmez), startDate, endDate, note, archived, createdBy, createdAt
households/{hid}/medLogs/{id}        medicationId, forId, date "YYYY-MM-DD", time "HH:MM", status (alindi|atlandi), doneBy (uid), doneAt
```

Tarihler kullanıcının yerel saatiyle `YYYY-MM-DD` metni olarak tutulur (Europe/Istanbul). Saat dilimi kaymasına dikkat.

## 5. Güvenlik kuralları (en kritik kısım)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function isMember(hid) {
      return signedIn() &&
        request.auth.uid in get(/databases/$(db)/documents/households/$(hid)).data.members;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }
    match /households/{hid} {
      allow read: if isMember(hid);
      allow write: if false;
      // NOT /{document=**}: that also matches the household doc itself and lets members write it (found by test 5).
      match /{sub}/{document=**} {
        allow read, write: if isMember(hid);
      }
    }
  }
}
```

Zorunlu doğrulama: `@firebase/rules-unit-testing` + Firebase emulator ile otomatik test yaz. En az şunlar:
1. A kullanıcısı B'nin `users/B/...` yolunu okuyamaz ve yazamaz.
2. Giriş yapmamış biri hiçbir şeyi okuyamaz.
3. Hane üyesi olmayan biri `households/...` altına erişemez.
4. İki hane üyesi de hane alt koleksiyonlarını okuyup yazabilir.
5. Kimse `households/{hid}` belgesinin kendisini yazamaz.
6. İlaç verisi (`households/{hid}/medications`, `medLogs`) hane üyesi olmayanlara kapalı, iki hane üyesine açıktır. Sağlık verisi olduğu için bu iki koleksiyon testlerde ayrıca doğrulanır.

Kişisel verinin yanlışlıkla ortak koleksiyona yazılmadığını kod tarafında da kontrol et (kapsam alanı yalnızca "Aile" ya da "Kişisel" seçiminden gelir).

## 6. Tema sistemi

Yerleşim **tüm temalarda aynı** (Mozaik tabanlı). Temalar yalnızca şunları değiştirir: renkler, yazı tipleri, köşe yarıçapları, çizgi/kenarlık stili ve **Bugün özet alanının** biçimi. Tek kod tabanı, CSS değişkenleri (`data-theme` özniteliği). Seçim `users/{uid}.theme` içinde saklanır, anında açılması için `localStorage`'a da yazılır.

| Belirteç | Mozaik | Yörünge | Teknik Pano |
|---|---|---|---|
| Gövde yazı tipi | Bricolage Grotesque | Manrope | Archivo |
| Başlık yazı tipi | Bricolage Grotesque 800, -1.2px | Unbounded 600, -0.5px | Archivo 800, -1.2px, BÜYÜK HARF |
| Zemin | #E8ECF3 | #0B0F1A | #FAFAFA |
| Kart | #FFFFFF, kenarlık yok | #151B2B, kenarlık yok | #FFFFFF, 2px #0A0A0A |
| Kart köşesi | 28 (küçük: 20–24) | 24 (küçük: 18) | 0 |
| Metin | #121212 | #EEF1FA | #0A0A0A |
| Soluk metin | #4A5568 | #9AA3BD | #5C5C5C |
| Ayırıcı çizgi | #E3E7EF | #263050 | #C9C9C9 |
| İlerleme zemini | rgba(18,18,18,.16) | #263050 | #E4E4E4 |
| Alt menü | #121212, köşe 32 | #151B2B + 1px #263050, köşe 32 | #FAFAFA + 2px #0A0A0A, köşe 0 |
| Menü ikon / aktif | #D5DAE6 / #FFD43B zemin | #9AA3BD / #C6F432 zemin | #0A0A0A / #FF4F00 zemin |
| Avatar, ana buton | #121212 zemin, #FFD43B metin | #C6F432 zemin, #0B0F1A metin | #0A0A0A zemin / #FF4F00 buton, 2px kenarlık |
| Kişisel rozeti | #2F4BFF / beyaz | #B79CFF / #0B0F1A | #FF4F00 / #0A0A0A |
| Aktivite renkleri (3 örnek) | #FFD43B #FF9EC0 #5EEAD4 | #C6F432 #FF7A66 #7CC8FF | #0A0A0A #FF4F00 #6B6B6B |
| Not kartı renkleri | #FFD43B #5EEAD4 #FF9EC0 #2F4BFF | kart rengi + renkli etiket | beyaz, kenarlıklı; Kişisel #FF4F00 |

Bugün özet alanı:
- **Mozaik**: mavi (#2F4BFF) büyük blok, iri toplam süre ("2 sa 15 dk"), aktivitelere göre bölümlü ince çubuk, sarı seri rozeti.
- **Yörünge**: iç içe halkalar (her aktivite bir halka, en çok 4), ortada toplam süre. Hedefi olmayan aktiviteler halka almaz.
- **Teknik Pano**: çok büyük dakika sayısı ("135 DK"), altında bölümlü çubuk, siyah seri etiketi.
Aktivite sayısı değişkendir (0–N). Hiç aktivite yoksa özet alanı boş durum gösterir ("İlk aktiviteni ekle").

Kesin değerler için `design/` klasöründeki kaynak dosyalara bak (satır içi stiller birebir değerleri taşır). Bu dosyalar kendi başına tarayıcıda açılmaz, referans kaynak olarak oku.

## 7. Erişilebilirlik ve kullanım

- Dokunma hedefleri en az 44px olmalı. Tasarımdaki bazı çipler 34–38px, uygulamada büyüt.
- Metin kontrastı 4.5:1 (soluk metinler dahil), özellikle Yörünge'de #6B769A gibi soluk tonları gerçek cihazda kontrol et.
- Gerçek `<button>`, `<input>` + `<label>`. Yalnızca renkle anlam taşıma (kişisel kayıt: renk + kilit rozeti).
- Emoji kullanma. Simgeler çizgi (stroke) SVG.

## 8. Yapay zekâ

- Haftalık özet: son 4 haftanın aktivite toplamları ve hedefler Worker'a gönderilir. Çıktı: kısa Türkçe yorum + en çok iki öneri. Sonuç `users/{uid}/insights/{weekId}` içinde önbelleklenir, hafta başına en çok bir kez üretilir.
- Worker, istekle gelen Firebase ID token'ını doğrular (yetkisiz çağrı olmaz) ve kullanıcı başına istek sınırı uygular.
- Başka kullanıcının verisi ya da Kişisel olmayan alanlar modele gönderilmez. İsim gibi gereksiz kişisel bilgi gönderme.
- Sonra eklenebilir: "bu hafta ne yapmalıyım" sohbet alanı. Şimdilik yok.

## 9. iPhone Takvim akışı

PWA doğrudan iPhone takvimine yazamaz. Çözüm: abone olunan `.ics` akışı.
- Önerilen mimari: kayıt değiştiğinde uygulama Worker'a `POST /cal/sync` (Firebase ID token ile) yapar. Worker token'ı doğrular, o kullanıcının görmesi gereken kayıtlardan (aile + kendi kişisel) `.ics` üretir ve Cloudflare KV'ye `calendarToken` anahtarıyla yazar. `GET /cal/{token}.ics` bunu sunar. Böylece Worker'a Firestore yönetici yetkisi vermek gerekmez.
- Token rastgele, tahmin edilemez, Ayarlar'dan yenilenebilir (eski bağlantı geçersiz olur).
- Eşle butonu `webcal://` bağlantısını açar, iPhone aboneliği onaylatır. Tek yönlü (uygulama → iPhone), anlık değil: iPhone yenilemeyi kendi aralığında yapar.
- Her kayda `VALARM` ekle (kaydın hatırlatma ayarına göre). Böylece hatırlatmalar iPhone'un yerel Takvim'i üzerinden gelir ve PWA bildirimlerinden daha güvenilir olabilir. Abonelik ayarında alarmların kaldırılmadığını gerçek cihazda test et.
- Tekrarlayan kayıtlar için `RRULE` kullan (doğum günleri yıllık).
- Web push (Firebase Cloud Messaging) bildirimleri iOS'ta yalnızca ana ekrana eklenmiş PWA'da çalışır ve garanti değildir. İlk sürümde yok, `VALARM` yeterli olmazsa son aşamada değerlendir.

## 10. Aşamalar

Her aşamadan önce kısa plan yaz ve onay al. Aşama bitince çalışan hâli göster ve dur.

1. **İskelet**: depo, PWA kabuğu, Firebase giriş, hane belgesi, güvenlik kuralları + emülatör testleri, tema sistemi (3 tema, Ayarlar'dan değişir), boş sekmeler. Kabul: iki hesapla giriş, tema değişimi kalıcı, kural testleri yeşil.
2. **Kişisel + Bugün**: aktivite ekle/düzenle/arşivle, süre ekle, haftalık/aylık grafik, gün serisi, Bugün özet alanı (3 tema), günlük görevler.
3. **Ortak + Notlar**: Ev İhtiyaçları, Ailenin Yapılacakları, Notlar (Kişisel kategorisi dahil), canlı senkron. Kabul: iki cihazda anında yansıma.
4. **Takvim**: ay görünümü, kayıt ekle (Aile/Kişisel), tekrar, hatırlatma ayarı, Bugün'de yaklaşanlar.
5. **İlaç takibi (ortak)**: Ortak içinde İlaçlar sekmesi, ilaç dönemi ekle/düzenle/arşivle, kimin için (Ben/Eşi/Aslan), günde N kez için otomatik saat önerisi, aç/tok, doz işaretleme (kim, ne zaman), Bugün ilaç kartı, geçmiş dönemler. Kabul: 3 dozlu bir dönem açılınca Bugün'de 3 doz görünür; bir hesapta işaretlenen doz diğerinde anında "verildi · kim · saat" görünür; hane dışı hesap hiçbir ilaç verisine erişemez.
6. **Yapay zekâ**: Worker vekili, haftalık özet kartı.
7. **iPhone Takvim akışları**: KV + `.ics`, Eşle butonu, `VALARM`, `RRULE`. İki akış: normal takvim ve ayrı "Cassandra İlaç" akışı (kişi seçimiyle: `medReminderFor`). Kabul: ilaç hatırlatması gerçek iPhone'da uygulama kapalıyken gelir; Aslan'ın ilacı iki telefonda da çalar.

## 11. Bilinçli olarak yapılmayanlar

- Başlat-durdur sayacı yok. Süre elle toplam olarak girilir.
- Sabit aktivite listesi yok. Her şey kullanıcı tarafından eklenir.
- Davet kodu ve genel kayıt sistemi yok. İki hesap elle kurulur.
- iPhone'dan uygulamaya yönde (iPhone → uygulama) takvim aktarımı yok.
- Arka plan push bildirimi ilk sürümde yok.

## 12. Tasarımda çizilmeyenler (kullanıcıyla netleştir)

Ortak (v2 temaları), günlük görevler (Bugün'de), hedefler ekranı, tam ekran rapor görünümü, boş durumlar, giriş ekranı, aktivite düzenleme/arşiv.
