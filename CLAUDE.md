# Cassandra

İki kişilik kişisel organizasyon PWA'sı (Semihcan + eşi). Her oturumun başında `SPEC.md`'yi oku, tasarım referansı `design/` klasöründedir.

## Çalışma kuralları
- Arayüz metinleri Türkçe. Kod, değişken adları ve yorumlar İngilizce olabilir.
- Aşama aşama ilerle (SPEC §10). Bir aşamaya başlamadan önce kısa bir plan yaz ve onay bekle. Aşama bitince çalışan hâli göster ve dur.
- SPEC'te "AÇIK" yazan yerlerde varsayım yapma, kullanıcıya sor.
- Kullanıcı hobi geliştiricidir; açıklamaları kısa ve doğrudan yap. Aynı hata ayıklama önerisini tekrar etme, yeni bir yaklaşım dene.
- Tema sistemi tek kod tabanıdır: yerleşim sabit, temalar CSS değişkenleriyle değişir. Tema başına ayrı ekran kodu yazma.

## Değişmez kurallar
- Kişisel veri (`users/{uid}/**`) yalnızca sahibine açıktır. Güvenlik kurallarını SPEC §5'e göre kur ve emülatör testlerini yeşil görmeden Kişisel aşamasına geçme.
- API anahtarları (Gemini vb.) istemci koduna ve depoya asla girmez; Worker sırrı olarak tutulur.
- Hane belgesi (`households/{hid}`) elle oluşturulur, istemciden yazılamaz.
- Sabit aktivite listesi ve başlat-durdur sayacı yok.
- Dokunma hedefleri en az 44px, emoji yok, simgeler çizgi SVG.
