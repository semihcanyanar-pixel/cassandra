import { diffDays } from './dates.js';

// "Günün notu": one note per day, the same for everybody, changing at midnight. Three kinds of pages:
//   - motivation: two or three sentences on building habits and the effect of small habits
//   - quote: a well-known quote in six categories (psychologists and novels come most often), translated into Turkish; foreign proverbs only
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

export const QUOTES = {
  psikolog: [
    { t: "Elinden her şey alınabilir, yalnızca bir şey hariç: verilen koşullarda kendi tutumunu seçme özgürlüğü.", by: "Viktor Frankl, İnsanın Anlam Arayışı" },
    { t: "Tuhaf bir paradoks var: kendimi olduğum gibi kabul ettiğimde değişebilirim.", by: "Carl Rogers, Bir İnsan Olmak Üzerine" },
    { t: "Eli çekiç olan herkes her şeyi çivi sanır.", by: "Abraham Maslow" },
    { t: "Alışkanlık, toplumun dev çarkıdır.", by: "William James" },
    { t: "Hayatın yaşamaya değer olduğuna inan; bu inanç, gerçeği yaratmana yardım edecek.", by: "William James" },
    { t: "Hayatın anlamı, topluma katkıda bulunmaktır.", by: "Alfred Adler" },
    { t: "Sevmek bir eylemdir, edilgen bir duygu değil.", by: "Erich Fromm, Sevme Sanatı" },
    { t: "Yaratıcılık, kesinlikleri bırakma cesaretini gerektirir.", by: "Erich Fromm" },
    { t: "Gelişmekte olmak, hazır olmaktan iyidir.", by: "Carol Dweck, Zihniyet" },
    { t: "Kırılganlık; sevginin, aidiyetin, neşenin ve cesaretin doğduğu yerdir.", by: "Brené Brown" },
    { t: "Hayatta hiçbir şey, üzerinde düşündüğün kadar önemli değildir.", by: "Daniel Kahneman" },
    { t: "Bilinçdışını fark etmedikçe o hayatını yönetir ve sen buna kader dersin.", by: "Carl Jung (aktarım)" },
    { t: "Cesaret, umutsuzluğun yokluğu değil; umutsuzluğa rağmen ilerleyebilme gücüdür.", by: "Rollo May" },
    { t: "En güzel anlar, insanın zorlu ve değerli bir işi başarmak için sınırlarını zorladığı anlardır.", by: "Mihaly Csikszentmihalyi, Akış" },
    { t: "Sevgi ve çalışma, insan olmanın köşe taşlarıdır.", by: "Sigmund Freud (aktarım)" },
    { t: "Çocuğun ihtiyacı mükemmel bir ebeveyn değil, yeterince iyi bir ebeveyndir.", by: "Donald Winnicott (aktarım)" },
  ],
  roman: [
    { t: "İnsan ancak yüreğiyle doğru görür; asıl önemli olan gözle görülmez.", by: "Küçük Prens, Antoine de Saint-Exupéry" },
    { t: "Gülünü bu kadar önemli kılan, ona harcadığın zamandır.", by: "Küçük Prens, Antoine de Saint-Exupéry" },
    { t: "Bir şeyi gerçekten istediğinde, bütün evren onu gerçekleştirmen için işbirliği yapar.", by: "Simyacı, Paulo Coelho" },
    { t: "Her parıldayan altın değildir; dolaşan herkes de kaybolmuş sayılmaz.", by: "Yüzüklerin Efendisi, J. R. R. Tolkien" },
    { t: "İnsan yenilmek için yaratılmamıştır. Yok edilebilir, ama yenilmez.", by: "Yaşlı Adam ve Deniz, Ernest Hemingway" },
    { t: "Dün’e dönemem; çünkü o zaman başka biriydim.", by: "Alice Harikalar Diyarında, Lewis Carroll" },
    { t: "Korku akıl katilidir.", by: "Dune, Frank Herbert" },
    { t: "Güzellik dünyayı kurtaracak.", by: "Budala, Fyodor Dostoyevski" },
    { t: "Hayatı, hayatın anlamından daha çok sevmek gerek.", by: "Karamazov Kardeşler, Fyodor Dostoyevski" },
    { t: "Yarının henüz içinde hiç hata yapılmamış yepyeni bir gün olduğunu düşünmek ne güzel.", by: "Yeşil Tepeli Anne, L. M. Montgomery" },
    { t: "Fırtınalardan korkmuyorum; çünkü gemimi nasıl yöneteceğimi öğreniyorum.", by: "Küçük Kadınlar, Louisa May Alcott" },
    { t: "Bilgi aktarılabilir, ama bilgelik aktarılamaz.", by: "Siddhartha, Hermann Hesse" },
    { t: "Ben bir kuş değilim; hiçbir ağ beni tuzağa düşüremez.", by: "Jane Eyre, Charlotte Brontë" },
    { t: "Özgürlük, gökyüzünün insanlara verdiği en değerli armağandır.", by: "Don Kişot, Miguel de Cervantes" },
    { t: "Herkes dünyayı değiştirmeyi düşünür, ama kimse kendini değiştirmeyi düşünmez.", by: "Lev Tolstoy" },
  ],
  film: [
    { t: "Hayat bir çikolata kutusu gibidir; içinden ne çıkacağını asla bilemezsin.", by: "Forrest Gump (film)" },
    { t: "Ya yaşamakla meşgul olursun ya da ölmekle.", by: "Esaretin Bedeli (film)" },
    { t: "Umut güzel bir şeydir, belki de en güzelidir; güzel şeyler de asla ölmez.", by: "Esaretin Bedeli (film)" },
    { t: "Carpe diem. Günü yakalayın, hayatınızı olağanüstü kılın.", by: "Ölü Ozanlar Derneği (film)" },
    { t: "Yap ya da yapma. Denemek diye bir şey yoktur.", by: "Yoda, Yıldız Savaşları (film)" },
    { t: "Yolu bilmekle yolda yürümek arasında fark vardır.", by: "Morpheus, Matrix (film)" },
    { t: "Bize verilen zamanla ne yapacağımıza karar vermek bizim elimizde.", by: "Gandalf, Yüzüklerin Efendisi (film)" },
    { t: "Mutluluk, en karanlık zamanlarda bile bulunabilir; yeter ki ışığı yakmayı hatırla.", by: "Dumbledore, Harry Potter ve Azkaban Tutsağı (film)" },
    { t: "Hayatta yaptıklarımız sonsuza dek yankılanır.", by: "Maximus, Gladyatör (film)" },
    { t: "Önemli olan ne kadar sert vurduğun değil; ne kadar sert darbe alıp yoluna devam edebildiğindir.", by: "Rocky Balboa (film)" },
  ],
  isim: [
    { t: "Aç kalın, aptal kalın.", by: "Steve Jobs" },
    { t: "Yapılana kadar her şey imkânsız görünür.", by: "Nelson Mandela" },
    { t: "Hayatta korkulacak bir şey yoktur, yalnızca anlaşılacak şeyler vardır.", by: "Marie Curie" },
    { t: "Hayatım boyunca defalarca başarısız oldum; başarılı olmamın nedeni de bu.", by: "Michael Jordan" },
    { t: "Senin rızan olmadan kimse seni aşağılık hissettiremez.", by: "Eleanor Roosevelt" },
    { t: "Hepimiz büyük şeyler yapamayız; ama küçük şeyleri büyük bir sevgiyle yapabiliriz.", by: "Rahibe Teresa" },
    { t: "Başarı bitmiş değildir, başarısızlık ölümcül değildir; önemli olan devam etme cesaretidir.", by: "Winston Churchill (atfedilir)" },
    { t: "Tek başımıza çok az şey yapabiliriz; birlikte çok şey yapabiliriz.", by: "Helen Keller" },
    { t: "Ayaklarınıza değil, yıldızlara bakın.", by: "Stephen Hawking" },
    { t: "Hayal gücü bilgiden daha önemlidir.", by: "Albert Einstein" },
    { t: "Dünyayı daha iyi yapmaya başlamak için kimsenin tek bir an bile beklemesine gerek yok.", by: "Anne Frank, Günlük" },
    { t: "Ama yine de, toz gibi, yükselirim.", by: "Maya Angelou, Hâlâ Yükseliyorum" },
    { t: "Kışın ortasında, içimde yenilmez bir yaz olduğunu öğrendim.", by: "Albert Camus" },
  ],
  klasik: [
    { t: "Sorgulanmamış hayat yaşamaya değmez.", by: "Sokrates" },
    { t: "Ne kadar yavaş gittiğin önemli değil, yeter ki durma.", by: "Konfüçyüs (atfedilir)" },
    { t: "Aynı nehirde iki kez yıkanılmaz.", by: "Herakleitos" },
    { t: "Biz neyi sık sık yapıyorsak oyuz; mükemmellik bir eylem değil, bir alışkanlıktır.", by: "Will Durant, Aristoteles’in düşüncesinden" },
    { t: "Zamanın kısa olmasından değil, onu boşa harcamamızdan yakınmalıyız.", by: "Seneca" },
    { t: "Bizi rahatsız eden olaylar değil, olaylar hakkındaki düşüncelerimizdir.", by: "Epiktetos" },
    { t: "Bin millik yolculuk tek bir adımla başlar.", by: "Lao Tzu, Tao Te Ching" },
    { t: "Bilmek yetmez, uygulamak gerekir; istemek yetmez, yapmak gerekir.", by: "Johann Wolfgang von Goethe" },
    { t: "Yirmi yıl sonra, yaptıklarına değil yapmadıklarına pişman olacaksın.", by: "Mark Twain (atfedilir)" },
    { t: "Zihnin, sık sık düşündüğün şeylerin rengini alır.", by: "Marcus Aurelius, Kendime Düşünceler" },
    { t: "Çözülmemiş her şeye karşı sabırlı ol ve soruların kendilerini sevmeye çalış.", by: "Rainer Maria Rilke, Genç Bir Şaire Mektuplar" },
    { t: "Yolcu, yol yoktur; yol, yürüdükçe yapılır.", by: "Antonio Machado" },
    { t: "Gülmeden geçen gün, kaybedilmiş bir gündür.", by: "Nicolas Chamfort" },
  ],
  atasozu: [
    { t: "Yedi kere düş, sekiz kere kalk.", by: "Japon atasözü" },
    { t: "Bir ağaç dikmek için en iyi zaman yirmi yıl önceydi; ikinci en iyi zaman bugündür.", by: "Çin atasözü" },
    { t: "Yavaş gitmekten korkma; yalnızca durmaktan kork.", by: "Çin atasözü" },
    { t: "Hızlı gitmek istiyorsan yalnız git; uzağa gitmek istiyorsan birlikte git.", by: "Afrika atasözü" },
    { t: "Yavaş giden sağlam gider ve uzağa varır.", by: "İtalyan atasözü" },
    { t: "Yedi kere ölç, bir kere biç.", by: "Rus atasözü" },
    { t: "Dünyadaki en önemli şey nedir? İnsan, insan, insan.", by: "Maori atasözü" },
    { t: "Dünyayı atalarımızdan miras almadık; çocuklarımızdan ödünç aldık.", by: "Yerli Amerikan atasözü" },
    { t: "Bu da geçer.", by: "Fars atasözü" },
    { t: "Sabır, ferahlığın anahtarıdır.", by: "Arap atasözü" },
    { t: "Acele işe bereket gelmez.", by: "Svahili atasözü" },
    { t: "Zorluklar aşılarak yıldızlara.", by: "Latin deyişi" },
  ],
};

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

// Quote categories. The cycle says which category a day takes: psychologists three times and novels twice in nine days, the rest once.
// Every category walks through its own list in order, one item per appearance.
export const CYCLE = ['psikolog', 'roman', 'film', 'psikolog', 'isim', 'roman', 'psikolog', 'klasik', 'atasozu'];
export const QCATS = Object.keys(QUOTES);
export const qpool = (cat) => `q-${cat}`;
export const BUILTIN = { motivation: MOTIVATION, tip: TIPS, ...Object.fromEntries(QCATS.map((c) => [qpool(c), QUOTES[c]])) };
export const POOLS = Object.keys(BUILTIN);
export const REFILL_QUOTE = 4; // a quote category asks for a new batch when this many of its items (or fewer) are left

export const dayIndex = (iso) => Math.max(0, diffDays(iso, START_DATE));

// The category of day d and its place in that category's list.
export function quoteSlot(d) {
  const cat = CYCLE[d % CYCLE.length];
  return { cat, idx: poolIndex(qpool(cat), d) };
}
// How far into its own list a pool is on day d (motivation and tips: one per day; a quote category: one per appearance).
export function poolIndex(pool, d) {
  if (!pool.startsWith('q-')) return d;
  const cat = pool.slice(2);
  const per = CYCLE.filter((c) => c === cat).length;
  const pos = d % CYCLE.length;
  return Math.floor(d / CYCLE.length) * per + CYCLE.slice(0, pos).filter((c) => c === cat).length;
}

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

// The item at place idx. Beyond everything we have (a new batch is not ready), older items come back in a mixed order, so the repeat is hard to notice.
export function pickFor(pool, idx, docs = []) {
  const all = poolItems(pool, docs);
  if (idx < all.length) return all[idx];
  let step = 7;
  while (gcd(step, all.length) !== 1) step += 2;
  return all[(idx * step + Math.floor(idx / all.length) * 3) % all.length];
}

// The number of the next batch to ask for in this pool on day d, or null when enough content is left.
export function refillNeeded(pool, d, docs = []) {
  const known = poolItems(pool, docs).length;
  const ahead = pool.startsWith('q-') ? REFILL_QUOTE : REFILL_AHEAD;
  if (known - poolIndex(pool, d) > ahead) return null;
  let n = 0;
  while (docs.some((x) => x.id === `${pool}-${n}`)) n += 1;
  return n;
}

export const dailyNote = (iso, docs = []) => {
  const d = dayIndex(iso);
  const { cat, idx } = quoteSlot(d);
  return { motivation: pickFor('motivation', d, docs), quote: { ...pickFor(qpool(cat), idx, docs), cat }, tip: pickFor('tip', d, docs) };
};
