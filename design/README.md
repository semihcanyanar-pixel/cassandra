# Tasarım referansları

Bu klasördeki `.dc.html` dosyaları bir tasarım aracında hazırlanmış ekran kaynaklarıdır. Tarayıcıda tek başına doğru açılmazlar (`support.js` çalışma zamanı olmadan). **Referans kaynak olarak oku**: işaretleme yapısı, satır içi stiller (renk, boşluk, köşe, yazı boyutu) ve `renderVals()` içindeki örnek veriler birebir değerleri taşır. `{{...}}` ve `sc-for` / `sc-if` kalıpları şablon sözdizimidir, kodlanacak mantık değildir.

Dosyalar (v2 = geçerli tasarım, her dosyada 3 tema yan yana: Mozaik, Yörünge, Teknik Pano):
- `V2Bugun.dc.html`: Bugün ekranı
- `V2Kisisel.dc.html`: Kişisel sekmesi
- `V2Ekle.dc.html`: Aktivite ekle
- `V2Notlar.dc.html`: Notlar
- `V2Takvim.dc.html`: Takvim
- `V2Ayarlar.dc.html`: Ayarlar (tema seçimi, iPhone eşleme)
- `V2Ilac.dc.html`: Ortak › İlaçlar sekmesi (bugünkü dozlar, aktif dönemler, kişi filtresi)
- `V2IlacEkle.dc.html`: İlaç dönemi ekle
- `V2BugunIlac.dc.html`: Bugün ekranının aşağı kaydırılmış hâli (sıradaki ilaç, bugünkü dozlar, yaklaşan)
- `v1/YonB.dc.html`: ilk taslak. **Yalnızca** Ortak ekranının (sağdaki telefon) Mozaik referansı olarak kullan; kalan her şey v2 ile değişti.

Çizilmeyenler için SPEC §12'ye bak.
