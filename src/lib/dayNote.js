import { diffDays } from './dates.js';

// "Günün notu": one note per day, the same for everybody, changing at midnight. Three kinds of pages:
//   - motivation: a general motivating sentence plus a quote (poem, novel, film, song, proverb), translated into Turkish
//   - tip: a general piece of advice about child development, education and parenting
// The lists below last a while; when they are nearly used up the app asks the Worker for a new batch of BATCH items (see autoNote / Bugün)
// and keeps it in the household's `dayPool` collection, so both phones show the same text. Until a batch exists, older items are reused in a mixed order.

export const START_DATE = '2026-11-08'; // day 0
export const BATCH = 60;
export const REFILL_AHEAD = 14; // ask for the next batch when this many days (or fewer) of content are left

export const MOTIVATION = [
  { t: 'Bugün büyük bir şey yapmak zorunda değilsin; sadece kendine nazik davranman yeterli.' },
  { t: 'Küçük adımlar da seni ileri götürür, yeter ki durma.' },
  { t: 'Her sabah, yeniden başlamak için verilmiş sessiz bir fırsattır.' },
  { t: 'Mükemmel olmak zorunda değilsin; devam edebilmek zaten yeterince cesurcadır.' },
  { t: 'Zor günler de geçer; sen yine de kendi hızında yürümeye devam et.' },
  { t: 'Bugün dinlenmek de ilerlemenin bir parçasıdır.' },
  { t: 'Kendine bir kez daha inanmak, hiçbir zaman boşa gitmez.' },
  { t: 'Her gün biraz daha iyi olmak için dünden biraz daha sabırlı ol.' },
  { t: 'İçindeki ses yapamazsın diyorsa, derin bir nefes al ve yine de dene.' },
  { t: 'Başlamak için doğru zamanı bekleme; zamanı doğru yapan sensin.' },
  { t: 'Sevdiklerinle paylaşılan küçük anlar, hayatın en büyük zenginliğidir.' },
  { t: 'Bugün kendine gösterdiğin anlayış, yarınki gücünün tohumudur.' },
  { t: 'Bir şeyi güzel yapmanın ilk yolu, onu yapmaya başlamaktır.' },
  { t: 'Güne minnettar bir kalple başlamak, yükü hafifletir.' },
  { t: 'Yorulduğunda vazgeçme; biraz dinlen ve yoluna devam et.' },
  { t: 'Hayat, acele edenlere değil, farkında olanlara güzel görünür.' },
  { t: 'Bugün birine içten bir gülümseme vermek, ikinizin gününü de değiştirebilir.' },
  { t: 'Hata yapmak öğrenmenin bir yoludur; kendine yüklenmek değil.' },
  { t: 'Elindekiyle başla; gerisi yol boyunca gelir.' },
  { t: 'Sabır, görünmeyen emeğin meyve vermesini bekleme sanatıdır.' },
  { t: 'Güçlü olmak her şeyi tek başına taşımak değil, gerektiğinde yardım istemektir.' },
  { t: 'Kendini başkalarıyla değil, dünkü kendinle kıyasla.' },
  { t: 'Her gün yeni bir sayfa; ne yazacağın senin elinde.' },
  { t: 'Zor bir gün, kötü bir hayat demek değildir.' },
  { t: 'Cesaret, korkunun yokluğu değil, korkuya rağmen bir adım atmaktır.' },
  { t: 'Bugün yapabildiğin kadarı, bugün için yeterlidir.' },
  { t: 'İyi şeyler çoğu zaman sessizce, adım adım büyür.' },
  { t: 'Kendine zaman ayırmak bencillik değil, bir ihtiyaçtır.' },
  { t: 'Hayalin büyük olduğu için yol uzun görünebilir; yine de yürümeye değer.' },
  { t: 'Sevgiyle yapılan en küçük iş bile değerlidir.' },
  { t: 'Ne olursa olsun, bugüne kadarki bütün zor günlerini atlattın.' },
  { t: 'Bir nefes al, omuzlarını bırak; her şeyi şimdi çözmek zorunda değilsin.' },
  { t: 'Sabahın ilk ışığı, her şeyin yeniden mümkün olduğunu hatırlatır.' },
  { t: 'Güzel bir hayat, küçük güzel günlerin birikimidir.' },
  { t: 'Kendi hikâyende hem yazar hem kahramansın.' },
  { t: 'Bugün, bir şeyi ilk kez denemek için güzel bir gün olabilir.' },
  { t: 'Denemekten korkma; denemeyenler hiçbir zaman öğrenemez.' },
  { t: 'Dinlenmiş bir zihin, yorgun bir zihnin göremediği yolları görür.' },
  { t: 'Kendine söylediğin sözler günün tonunu belirler; nazik olanı seç.' },
  { t: 'Birlikte yürümek yolu kısaltır.' },
  { t: 'Her akşam, yeni bir sabaha açılan bir kapıdır.' },
  { t: 'Zorluklar seni yıldırmak için değil, güçlendirmek için karşına çıkar.' },
  { t: 'Bugünü bütün yoğunluğuyla yaşa; yarın kendi derdini kendisi getirir.' },
  { t: 'İyi hissetmek için her şeyin yolunda olması gerekmez.' },
  { t: 'Küçük bir teşekkür, büyük bir gün yaratabilir.' },
  { t: 'Yavaş ilerlemek, durmaktan her zaman daha iyidir.' },
  { t: 'Bugün kendine ve sevdiklerine biraz daha sabırlı davran.' },
  { t: 'İyi bir gün bazen sadece güzel bir çayla başlar.' },
  { t: 'Her şeyi bilmek zorunda değilsin; merak etmek yolun başlangıcıdır.' },
  { t: 'Gün sonunda önemli olan ne kadar yaptığın değil, nasıl hissettiğindir.' },
];

export const QUOTES = [
  { t: 'Yaşamak şakaya gelmez, büyük bir ciddiyetle yaşayacaksın.', by: 'Nâzım Hikmet, Yaşamaya Dair' },
  { t: 'Yaşamak bir ağaç gibi tek ve hür ve bir orman gibi kardeşçesine, bu hasret bizim.', by: 'Nâzım Hikmet, Davet' },
  { t: 'Bedava yaşıyoruz, bedava; hava bedava, bulut bedava.', by: 'Orhan Veli, Bedava Yaşıyoruz' },
  { t: 'Yaratılanı severiz, Yaratan’dan ötürü.', by: 'Yunus Emre' },
  { t: 'Gelin tanış olalım, işi kolay kılalım; sevelim sevilelim, dünya kimseye kalmaz.', by: 'Yunus Emre' },
  { t: 'Dün dündür, bugün bugün; bugün yeni şeyler söylemek lazım.', by: 'Mevlânâ' },
  { t: 'Hayatta en hakiki mürşit ilimdir, fendir.', by: 'Mustafa Kemal Atatürk' },
  { t: 'Bir insanı sevmekle başlar her şey.', by: 'Sait Faik Abasıyanık' },
  { t: 'Çözülmemiş her şeye karşı sabırlı ol ve soruların kendilerini sevmeye çalış.', by: 'Rainer Maria Rilke, Genç Bir Şaire Mektuplar' },
  { t: 'Asıl önemli olan gözle görülmez, ancak yürekle görülür.', by: 'Antoine de Saint-Exupéry, Küçük Prens' },
  { t: 'Gülünü bu kadar önemli kılan, ona harcadığın zamandır.', by: 'Antoine de Saint-Exupéry, Küçük Prens' },
  { t: 'Herkes dünyayı değiştirmeyi düşünür, ama kimse kendini değiştirmeyi düşünmez.', by: 'Lev Tolstoy' },
  { t: 'Güzellik dünyayı kurtaracak.', by: 'Fyodor Dostoyevski, Budala' },
  { t: 'Kışın ortasında, içimde yenilmez bir yaz olduğunu öğrendim.', by: 'Albert Camus' },
  { t: 'Her başlangıçta bir büyü vardır; bizi korur ve yaşamamıza yardım eder.', by: 'Hermann Hesse, Basamaklar' },
  { t: 'Bilmek yetmez, uygulamak gerekir; istemek yetmez, yapmak gerekir.', by: 'Johann Wolfgang von Goethe' },
  { t: 'Ama yine de, toz gibi, yükselirim.', by: 'Maya Angelou, Hâlâ Yükseliyorum' },
  { t: 'Yapılana kadar her şey imkânsız görünür.', by: 'Nelson Mandela' },
  { t: 'Zihnin, sık sık düşündüğün şeylerin rengini alır.', by: 'Marcus Aurelius, Kendime Düşünceler' },
  { t: 'Bin millik yolculuk tek bir adımla başlar.', by: 'Lao Tzu, Tao Te Ching' },
  { t: 'Yavaş gitmekten korkma; yalnızca durmaktan kork.', by: 'Çin atasözü' },
  { t: 'Tek başımıza çok az şey yapabiliriz; birlikte çok şey yapabiliriz.', by: 'Helen Keller' },
  { t: 'Hayal gücü bilgiden daha önemlidir.', by: 'Albert Einstein' },
  { t: 'Dünyayı daha iyi yapmaya başlamak için kimsenin tek bir an bile beklemesine gerek yok.', by: 'Anne Frank, Günlük' },
  { t: 'Hayat bir çikolata kutusu gibidir; içinden ne çıkacağını asla bilemezsin.', by: 'Forrest Gump (film)' },
  { t: 'Geçmiş acıtabilir; ama ondan ya kaçarsın ya da ondan öğrenirsin.', by: 'Aslan Kral (film)' },
  { t: 'Carpe diem. Günü yakalayın, hayatınızı olağanüstü kılın.', by: 'Ölü Ozanlar Derneği (film)' },
  { t: 'Umut güzel bir şeydir, belki de en güzelidir; güzel şeyler de asla ölmez.', by: 'Esaretin Bedeli (film)' },
  { t: 'Dün geçmişte kaldı, yarın bir gizem; ama bugün bir armağandır.', by: 'Kung Fu Panda (film)' },
  { t: 'Yap ya da yapma. Denemek diye bir şey yoktur.', by: 'Yoda, Yıldız Savaşları (film)' },
  { t: 'Her şey yoluna girecek.', by: 'Bob Marley, Three Little Birds (şarkı)' },
  { t: 'Hayat, sen başka planlar yaparken başına gelenlerdir.', by: 'John Lennon, Beautiful Boy (şarkı)' },
  { t: 'Yedi kere düş, sekiz kere kalk.', by: 'Japon atasözü' },
  { t: 'Bir ağaç dikmek için en iyi zaman yirmi yıl önceydi; ikinci en iyi zaman bugündür.', by: 'Çin atasözü' },
  { t: 'Hızlı gitmek istiyorsan yalnız git; uzağa gitmek istiyorsan birlikte git.', by: 'Afrika atasözü' },
  { t: 'Yolcu, yol yoktur; yol, yürüdükçe yapılır.', by: 'Antonio Machado' },
  { t: 'Yavaş giden sağlam gider ve uzağa varır.', by: 'İtalyan atasözü' },
  { t: 'Yedi kere ölç, bir kere biç.', by: 'Rus atasözü' },
  { t: 'Dünyadaki en önemli şey nedir? İnsan, insan, insan.', by: 'Maori atasözü' },
  { t: 'Dünyayı atalarımızdan miras almadık; çocuklarımızdan ödünç aldık.', by: 'Yerli Amerikan atasözü' },
  { t: 'Damlaya damlaya göl olur.', by: 'Türk atasözü' },
  { t: 'Bu da geçer.', by: 'Fars atasözü' },
  { t: 'Sabır, ferahlığın anahtarıdır.', by: 'Arap atasözü' },
  { t: 'Acele işe bereket gelmez.', by: 'Svahili atasözü' },
  { t: 'Zorluklar aşılarak yıldızlara.', by: 'Latin deyişi' },
  { t: 'Gülmeden geçen gün, kaybedilmiş bir gündür.', by: 'Nicolas Chamfort' },
];

export const TIPS = [
  { t: 'Çocuklarla her gün birlikte kitap okumak dil gelişimini ve hayal gücünü güçlendirir; on dakika bile fark yaratır.' },
  { t: 'Çocuğu azarlamak yerine davranışın sonucunu sakin bir sesle açıklamak, kuralları daha kalıcı öğretir.' },
  { t: 'Çocuklar söylediklerinizden çok yaptıklarınızı taklit eder; örnek olmak en güçlü eğitimdir.' },
  { t: 'Düzenli uyku ve yemek saatleri, çocuğa güven duygusu verir.' },
  { t: 'Sonuçtan çok çabayı takdir etmek (“Çok uğraştın!”), çocuğun öğrenme isteğini besler.' },
  { t: 'Çocuğun duygusunu adlandırmak (“Kızgın görünüyorsun”), duygularıyla baş etmesini kolaylaştırır.' },
  { t: 'Oyun, çocuğun öğrenme biçimidir; her gün serbest oyuna zaman ayırın.' },
  { t: 'Hayır demek de sevgidir; net ve tutarlı sınırlar çocuğa güvenli bir çerçeve sunar.' },
  { t: 'Çocuğun sorusuna “Bilmiyorum, birlikte bakalım” demek merakı canlı tutar.' },
  { t: 'Ekran süresini yasaklarla değil, birlikte konuşarak belirlemek genelde daha iyi sonuç verir.' },
  { t: 'Çocuğunuzla göz hizasında konuşmak, onu dinlediğinizi hissettirir.' },
  { t: 'Başkalarıyla kıyaslamak yerine çocuğun kendi gelişimini görmek, özgüvenini korur.' },
  { t: 'Her gün birkaç dakika, telefonsuz ve yalnızca çocuğa ayrılmış özel zaman bırakın.' },
  { t: 'Bir kuralı koyarken nedenini de anlatın; çocuklar anladıkları kurallara daha kolay uyar.' },
  { t: 'Hata yaptığında çocuğun utanmasına değil, düzeltmenin yolunu bulmasına yardım edin.' },
  { t: 'Çocuğa seçenek sunmak (“Mavi mi, sarı mı?”) kontrol duygusu verir ve inatlaşmayı azaltır.' },
  { t: 'Birlikte yemek hazırlamak sayı, ölçü ve sabır gibi pek çok beceriyi öğretir.' },
  { t: 'Tekrar eden rutinler (uyku öncesi hikâye gibi) çocuğa öngörülebilir bir dünya sunar.' },
  { t: 'Çocuk ağlarken sorunu çözmeye çalışmadan önce yanında olmak çoğu zaman yeterlidir.' },
  { t: '“Aferin” yerine ne gördüğünüzü anlatın: “Kuleyi çok dikkatli yapmışsın.”' },
  { t: 'Doğada geçirilen zaman, çocukların dikkat ve merak becerilerini destekler.' },
  { t: 'Çocuğun hatasını başkalarının yanında düzeltmemeye özen gösterin.' },
  { t: 'Sabırsızlandığınızda kısa bir mola vermek, hem sizin hem çocuğun için daha iyi bir tepki sağlar.' },
  { t: 'Küçük yaşta sorumluluk vermek (oyuncakları toplamak gibi) özgüveni ve becerileri büyütür.' },
  { t: 'Çocuğun kendi başına denemesine izin vermek, öğrenmenin en kalıcı yoludur.' },
  { t: 'Uzun nasihatler yerine kısa ve net cümleler çocuklar için daha anlaşılırdır.' },
  { t: 'Çocuğunuzla günün nasıl geçtiğini konuşmak (günün en güzel anı gibi), iletişim alışkanlığı kurar.' },
  { t: 'Kardeşler ya da arkadaşlar arasındaki anlaşmazlıklarda hemen müdahale etmek yerine önce çocuğun çözmesine fırsat verin.' },
  { t: 'Müzik ve şarkılar, dil ve hafıza gelişimini destekleyen eğlenceli bir araçtır.' },
  { t: '“Yapamazsın” yerine “Henüz yapamıyorsun” demek, gelişime odaklı bir bakış kazandırır.' },
  { t: 'Kendi duygularınızı sakin biçimde ifade etmek, çocuğa duygu yönetimini öğretir.' },
  { t: 'İstediği her şeyi hemen vermemek, çocuğa beklemeyi ve sabrı öğretir.' },
  { t: 'Düzenli fiziksel hareket, çocukların hem bedenini hem öğrenmesini destekler.' },
  { t: 'Tepki verirken çocuğu değil davranışı eleştirin: “Sen kötüsün” değil, “Bu davranış doğru değildi.”' },
  { t: 'Öğrenme evde sohbetle başlar; günlük konuşmalarda yeni kelimeler kullanın.' },
  { t: 'Anne babanın birbirine saygılı iletişim kurması, çocuğa en iyi ilişki modelini sunar.' },
  { t: 'Çocuğun ilgi alanlarını fark edip desteklemek, öğrenme isteğini artırır.' },
  { t: 'Dinlenmiş ve desteklenmiş bir ebeveyn daha sabırlı ve sevgi dolu olabilir; kendinize de bakın.' },
  { t: 'Mükemmel ebeveyn yoktur; yeterince iyi, sevgi dolu ve tutarlı olmak çoğu zaman yeterlidir.' },
];

export const BUILTIN = { motivation: MOTIVATION, quote: QUOTES, tip: TIPS };
export const POOLS = ['motivation', 'quote', 'tip'];

export const dayIndex = (iso) => Math.max(0, diffDays(iso, START_DATE));

// Built-in items followed by the generated batches (dayPool docs "{pool}-0", "{pool}-1", ... as long as they are contiguous).
export function poolItems(pool, docs = []) {
  const all = [...BUILTIN[pool]];
  for (let n = 0; ; n++) {
    const d = docs.find((x) => x.id === `${pool}-${n}`);
    if (!d || !Array.isArray(d.items) || !d.items.length) break;
    all.push(...d.items.filter((i) => i && typeof i.t === 'string'));
  }
  return all;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// The item for day `idx`. When the day is beyond everything we have (a new batch is not ready), older items come back in a mixed order, so the repeat is hard to notice.
export function pickFor(pool, idx, docs = []) {
  const all = poolItems(pool, docs);
  if (idx < all.length) return all[idx];
  let step = 7;
  while (gcd(step, all.length) !== 1) step += 2;
  return all[(idx * step + Math.floor(idx / all.length) * 3) % all.length];
}

// The number of the next batch to ask for, or null when enough content is left.
export function refillNeeded(pool, idx, docs = []) {
  const known = poolItems(pool, docs).length;
  if (known - idx > REFILL_AHEAD) return null;
  let n = 0;
  while (docs.some((x) => x.id === `${pool}-${n}`)) n += 1;
  return n;
}

export const dailyNote = (iso, docs = []) => {
  const i = dayIndex(iso);
  return { motivation: pickFor('motivation', i, docs), quote: pickFor('quote', i, docs), tip: pickFor('tip', i, docs) };
};
