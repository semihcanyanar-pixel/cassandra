import { diffDays } from './dates.js';

// "Günün notu": one note per day, the same for everybody, changing at midnight. Three kinds of pages:
//   - motivation: two or three sentences on building habits and the effect of small habits
//   - quote: a well-known quote (poem, novel, film, song, proverb), translated into Turkish
//   - tip: a general piece of advice about child development, education and parenting
// The lists below last a while; when they are nearly used up the app asks the Worker for a new batch of BATCH items (see autoNote / Bugün)
// and keeps it in the household's `dayPool` collection, so both phones show the same text. Until a batch exists, older items are reused in a mixed order.

export const START_DATE = '2026-11-08'; // day 0
export const BATCH = 60;
export const REFILL_AHEAD = 14; // ask for the next batch when this many days (or fewer) of content are left

export const MOTIVATION = [
  { t: "Küçük alışkanlıklar küçük görünür ama her gün tekrarlandığında üst üste biner. Günde yalnızca yüzde bir ilerlemek bile bir yıl sonunda büyük bir fark yaratır." },
  { t: "Bir alışkanlığı başlatmanın en kolay yolu onu gülünç derecede küçültmektir: iki sayfa oku, beş dakika yürü. Başlamak kolaylaştıkça devam etmek de kolaylaşır." },
  { t: "Yeni bir alışkanlığı var olan bir alışkanlığın hemen ardına bağla: dişlerini fırçaladıktan sonra, kahveni koyduktan hemen sonra. Hazır bir alışkanlık, yenisine kanca görevi görür." },
  { t: "Motivasyon gelip geçer, düzen kalır. Alışkanlığı güne sabit bir yere koyarsan her seferinde karar vermek zorunda kalmazsın." },
  { t: "Bir gün aksatmak sorun değildir; asıl önemli olan iki gün üst üste aksatmamaktır. Bozulan zinciri hemen ertesi gün yeniden bağla." },
  { t: "Alışkanlık sana ne yaptığını değil, kim olduğunu söyler. Her küçük tekrar, kendine verdiğin bir oydur: ben okuyan biriyim, ben hareket eden biriyim." },
  { t: "Başlangıçta sonuçlar görünmez; buna sabır platosu denir. Buz, erimeden önce yavaş yavaş ısınır; sen de ısınıyorsun, devam et." },
  { t: "Bir alışkanlığın yerleşmesi ortalama iki ay kadar sürer; kimisi daha kısa, kimisi çok daha uzun. Gecikmen sana değil, sürecin doğasına aittir." },
  { t: "Ortamını kolaylaştır: kitabı yastığının yanına, spor ayakkabısını kapının önüne koy. İyi alışkanlıklar kolay, kötüleri zor olmalı." },
  { t: "Takip etmek ilerlemeyi gözle görülür kılar. Bir işareti tamamlamanın verdiği küçük tatmin, yarın yine gelmen için yeterli bir ödüldür." },
  { t: "Hedefin yerine sistemini düşün: ne kadar kazandığın değil, her gün ne yaptığın önemli. Hedefler yön gösterir, günlük düzen yolu yürütür." },
  { t: "Beş dakikalık kural: bir işe sadece beş dakika ver. Çoğu zaman en zor kısım başlamaktır; başladığında devam etmek kendiliğinden gelir." },
  { t: "Büyük değişimler tek bir kahramanca günde değil, sıradan günlerin tutarlılığında oluşur. Bugünkü küçük tekrarın yarınki sen için bir yatırım." },
  { t: "Yoğun ama seyrek çabadan çok, hafif ama düzenli çaba kazandırır. Her gün on dakika, haftada bir üç saatten daha kalıcıdır." },
  { t: "Bir alışkanlığı bırakmak için yerine bir şey koymak gerekir. Boşluğu bırakma; yeri doldurulan alışkanlık çok daha kolay terk edilir." },
  { t: "Alışkanlıklar beynin enerji tasarrufu yoludur. Bir davranış otomatikleştiğinde zihnin başka şeylere, çocuklarına ve sevdiklerine daha çok yer açar." },
  { t: "Her şey birden değişmek zorunda değil. Tek bir alışkanlığa odaklan, onu oturt, sonra bir sonrakine geç." },
  { t: "Yorgun olduğun günlerde alışkanlığın en küçük halini yap. Mükemmel bir gün gerekmez; sadece zinciri koparmayan bir gün yeterli." },
  { t: "Bir davranışın ödülü ne kadar çabuk gelirse o kadar çabuk yerleşir. Bitirdiğinde kendine küçük bir teşekkür etmek bunun için yeterli olabilir." },
  { t: "Başkalarıyla yapılan alışkanlıklar daha kolay sürer. Eşinle ya da çocuklarınla birlikte yaptığın küçük bir rutin, sana destek de katar." },
  { t: "Sabah ya da akşam, hep aynı saatte yapılan bir iş zamanla kendiliğinden gelmeye başlar. Saat bir hatırlatıcıdır; beden hatırlamayı öğrenir." },
  { t: "Küçük bir işi bitirmek, bir sonrakini başlatmayı kolaylaştırır. İvmeyi büyük işten değil, küçük bir zaferden al." },
  { t: "Kendinle konuşma biçimin de bir alışkanlıktır. Hatalarına arkadaşına davranacağın gibi davranırsan devam etmek çok daha kolay olur." },
  { t: "Alışkanlığı bir sınav gibi değil, bir deney gibi gör. İşe yaramayan bir şeyi değiştirmek başarısızlık değil, ayarlamadır." },
  { t: "Bir günde değil, bir yılda ne yaptığına bak. Şu an göremediğin birikim, tekrar edildikçe hızlanan bir faiz gibi çalışır." },
  { t: "Bir alışkanlık bırakmak istiyorsan onu göremeyeceğin, ulaşamayacağın bir yere koy. Çaba gerektiren davranışlar çoğu zaman kendiliğinden azalır." },
  { t: "Alışkanlığın için net bir an ve yer seç: pazartesi, sabah kahvesinden sonra, masada. Belirsiz niyetler, net planlar kadar güçlü değildir." },
  { t: "Ne kadar küçük olursa olsun yapılan bir iş, hiç yapılmamış mükemmel bir plandan değerlidir. Bugün küçük bir şey yapmanın tadını çıkar." },
  { t: "Çocuklar seni izleyerek öğrenir. Senin küçük ve düzenli alışkanlıkların, onlara anlatabileceğin her sözden daha etkili bir ders olabilir." },
  { t: "İnsan kendini ne kadar sık hatırlıyorsa o kadar çabuk dönüşür. Kendine bırakacağın küçük bir not, bir sonraki adımı kolaylaştırır." },
  { t: "Alışkanlık kurmak bir maraton gibidir; hız değil süreklilik kazandırır. Yavaş da olsa yürümeyi bırakmayanlar sonunda yola çıkıp bırakanlardan öne geçer." },
  { t: "Zorlandığın bir alışkanlığı daha da küçült. Yarım sayfa, bir dakika, iki hareket; küçük başlamak, hiç başlamamaktan her zaman iyidir." },
  { t: "Dünkü sen dün kalsın. Alışkanlıklarına yeniden başlamak için pazartesiyi ya da ayın ilk gününü bekleme; şu an en iyi başlangıç anıdır." },
  { t: "Tek bir güçlü karar yerine, her gün verilen basit kararlar seni inşa eder. Bugünkü doğru seçim, yarını biraz daha kolaylaştırır." },
  { t: "Bir işi bitirmeden önce yarın ne yapacağını bir cümleyle yaz. Ertesi gün başlamak, sıfırdan kurmaktan çok daha hafif olur." },
  { t: "Alışkanlıkların birbirini besler: düzenli uyku, daha iyi odak; iyi odak, daha fazla enerji; enerji de yeni alışkanlıklara yer açar. Birini düzeltmek hepsini hafifletir." },
  { t: "Kendini ödüllendirmek şımartmak değildir; yeni bir davranışı beynin sevmesi için bir yoldur. İşin sonunda küçük bir keyif planla." },
  { t: "Bugün yaptığın küçük bir iş, yarın biraz daha kolay görünecek. Kolaylaşma işareti, alışkanlığın kök salmaya başladığı andır." },
  { t: "Gerçek ilerleme çoğu zaman sıkıcı görünür: aynı işi tekrar tekrar yapmak. Ama sıkıcı olan tekrar, parlak bir başlangıçtan daha çok şey öğretir." },
  { t: "Sürekli yeni bir hedef aramak yerine, mevcut alışkanlığını biraz derinleştir. Aynı işi biraz daha özenle yapmak da ilerlemedir." },
  { t: "Bir alışkanlığı yaparken kendine iyi hissettiğin bir an ara: müzik, bir fincan çay, güzel bir ışık. Keyifle bağlanan alışkanlıklar çok daha uzun yaşar." },
  { t: "Her gün çok şey yapmana gerek yok; her gün hiçbir şeyi atlamaman yeterli. Süreklilik, yoğunluğun önündedir." },
  { t: "Ertelemek çoğu zaman tembellik değil, işin gözünde büyümesidir. İşi en küçük parçasına böl ve yalnızca ilk parçayı yap." },
  { t: "Bir alışkanlığı sürdürmenin sırrı onu hayatına uydurmaktır, hayatını ona değil. Programına sığmayan bir plan, plan değil dilektir." },
  { t: "Bugün küçük bir adım atmışsan, kendine bunu söyle. Fark edilen ilerleme, tekrar edilen ilerlemedir." },
  { t: "Düzen kurmak özgürlüğü azaltmaz; tersine, karar yorgunluğunu alıp enerjini sevdiğin şeylere bırakır. Rutin, zihnine açılan boş bir alandır." },
  { t: "Zor bir dönemde alışkanlıkların seni taşır. Karar verecek gücün olmadığında, çoktan oturmuş küçük rutinler sana yol gösterir." },
  { t: "Küçük başarıları kutla. Bir alışkanlığı sürdürmek için büyük bir zafer beklemeye gerek yok; her gün tamamlanan bir işaret zaten kutlamaya değer." },
  { t: "Seni sen yapan şey, nadiren yaptığın büyük işler değil, her gün tekrar ettiğin küçük şeylerdir. Bugünün tekrarı, yarınki karakterindir." },
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
