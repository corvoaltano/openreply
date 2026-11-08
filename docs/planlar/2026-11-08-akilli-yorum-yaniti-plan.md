# Akıllı yorum yanıtı + yorum dizisi kuralı · uygulama planı

**Amaç:** Yorum yanıtı DM'in gerçek sonucunu söylesin; aynı yorum dizisine en fazla bir otomatik yanıt gitsin.
**Yol:** Worker DM'i önce gönderir, sonra sonuca göre üç metin havuzundan birini yorum olarak yazar. Webhook yorumun üst yorumunu (`parent_id`) okur; yanıtlanmış bir dizinin altındaki cevaplara yorum yazılmaz.
**Araçlar:** Next.js + Prisma (Neon), BullMQ worker (Oracle VM), vitest.
**Onay:** Fatih 2026-11-08 ("kod değişikliğini yapmaya başla"). Commit/push, veritabanı geçişi, Vercel ve VM yayını ayrıca onaylı.

## Kanıt (2026-11-08 ölçümü)

- Yanıtımıza yazılan cevaplarla tetiklenen en az 126 kayıt ("@fatihbellissoy link bozuk", "gelmedi"...), 99'u her kelimeye tepki veren kampanyada.
- Instagram DM sonucunda üç kesin bilgi verir: gitti / "invalid for a private reply" (mesaj ayarı kapalı veya yorum silinmiş) / "user cannot be found". İstek kutusuna mı düştüğünü söylemez.
- Takip durumu testi (VM, salt okur, 30 kişi): bize hiç yazmamış kişilerin 8/15'inde ve DM'i gidemeyenlerin 15/15'inde Meta "User consent is required" döndü. Yani takip bilgisi sadece daha önce etkileşime girmiş kişide var. Karar: takip **doğrulanırsa** kısa "gönderdim", doğrulanamazsa "isteklere düşmüş olabilir" metni.

## Davranış

| DM sonucu | Yorum yanıtı (akıllı mod) |
|---|---|
| Gitti, takip doğrulandı | `publicReplyMessages` (ör. "Gönderdim, DM kutuna bak") |
| Gitti, takip doğrulanamadı | `publicReplyRequestMessages`, boşsa `publicReplyMessages` |
| "invalid for a private reply" | `publicReplyFailedMessages`, boşsa yanıt yok |
| Kullanıcı bulunamadı / pencere dışı | yanıt yok |
| Geçici hata (tekrar denenecek) | şimdi yanıt yok, tekrar denemede karar verilir |
| Başka kampanya bu yoruma zaten DM attı | yanıt yok |

`{kelime}` metinde `replyCtaKeyword`'e (boşsa kampanyanın ilk kelimesine) çevrilir. Akıllı mod kapalı kampanyalar bugünkü gibi çalışır (yanıt DM'den önce).

**Dizi kuralı (bütün kampanyalar):** yorum bir cevapsa (`parent_id` var) ve o dizide daha önce herhangi bir kampanya iş yaptıysa:
- yorum yanıtı yazılmaz;
- DM yalnız şu durumda gider: bu kişi o dizide hiç DM almamış **ve** (önceki denemesi başarısız olmuş **ya da** kampanya belirli kelimeyle çalışıyor ve kişi dizide yeni). Her kelimeye tepki veren kampanyada yeni kişiye DM gitmez.
- Diğer durumlarda kayıt `SKIPPED_DEDUP` "yorum dizisi zaten yanıtlandı".

## Hedef olmayanlar

- Panelde yeni alanlar için arayüz (API / kod modu ile ayarlanır).
- Görüldü bilgisinin ölçümü (ayrı iş).
- Kampanya metinlerinin girilmesi (kod yayına çıktıktan sonra, ayrı onay).

## Gözden kaçabilecekler

- Instagram yanıtlarda `parent_id`'yi üst düzey yorumun id'si olarak verir (dizi düz). Eski kayıtlarda `parentCommentId` yok: dizi kontrolü `commentId = parent_id` kaydına da bakar.
- Yoklama (reconciler) yalnız üst düzey yorumları alır; `SKIPPED_DEDUP` kayıtları tamamlanmış sayılmalı, yoksa her taramada tekrar kuyruğa girer.
- Aynı yoruma birden çok kampanya: DM tekilleştirmesi bugünkü gibi; akıllı modda tekilleşen kampanya yorum yazmaz.
- Takip sorgusu ek bir API çağrısı; `requireFollow` zaten sorguladıysa sonuç yeniden kullanılır.
- Türkçe metin: `{kelime}` yer tutucusu, `{username}` ile birlikte çalışmalı.

## Görevler

### Görev 1: veritabanı alanları
**Dosyalar:** `prisma/schema.prisma` (Automation, DmLog), yeni `prisma/migrations/20261108120000_smart_public_reply/migration.sql`
- [ ] Automation: `smartPublicReply Boolean @default(false)`, `publicReplyRequestMessages String[] @default([])`, `publicReplyFailedMessages String[] @default([])`, `replyCtaKeyword String?`
- [ ] DmLog: `parentCommentId String?` + index
- [ ] Geçiş yalnız `ADD COLUMN` (geri alınabilir, eski kod etkilenmez); `npx prisma generate` hatasız

### Görev 2: webhook üst yorum
**Dosyalar:** `lib/meta/webhook.ts`, `app/api/webhook/route.ts`, `lib/queue/client.ts` (ProcessCommentJob.parentId), test `__tests__/webhook.test.ts`
- [ ] Test: `parent_id` olan yorum olayında `parentId` dolu, olmayanda boş
- [ ] Uygula, geç

### Görev 3: worker dizi kuralı + akıllı yanıt
**Dosyalar:** `lib/queue/dm-worker.ts` (processComment), test `__tests__/dm-worker.test.ts`
- [ ] Testler: dizide cevap → yanıt yok + DM yok (her kelime); aynı kişi önceki başarısız → DM var, yanıt yok; akıllı mod gitti+takip → `publicReplyMessages`; gitti+takip yok → istek havuzu; invalid → başarısız havuzu; kullanıcı yok → yanıt yok; `{kelime}` çevrilir; akıllı mod kapalı → eski sıra
- [ ] Uygula, bütün testler geç (`npx vitest run`, önce 171/171)

### Görev 4: API + yoklama
**Dosyalar:** `app/api/automations/route.ts` (oluştur/güncelle şeması), `lib/polling/comment-reconciler.ts` (SKIPPED_DEDUP tamamlandı)
- [ ] Yeni alanlar oluşturma ve güncellemede kabul edilir; `npx tsc --noEmit` ve `npm run lint` temiz

### Durum (2026-11-08 15:10)
Görev 1-4 bitti: 185/185 test, `tsc` ve `eslint` temiz. Sonnet gözden geçirmesinden sonra eklenenler:
- tekrar denemede gelen "invalid" yanıtına "DM'in kapalı" denmez (ilk deneme DM'i teslim etmiş olabilir);
- dizi yalnız gerçekten bir şey gitmişse "yanıtlanmış" sayılır (PENDING / limitli üst yorum saymaz);
- akıllı yanıt adımı hiç hata fırlatmaz (DM'i yanlışlıkla FAILED yapıp çift DM'e yol açmasın);
- yoklama akıllı modda SENT (hatasız), SKIPPED_DEDUP, SKIPPED_PLAN_LIMIT kayıtlarını bitmiş sayar;
- satır sonları eski haline (LF) döndürüldü.
Bilinen sınır: panelde "kampanyayı çoğalt" yeni alanları kopyalamaz; düzenleme silmez.

### Görev 5: yayın (her adım ayrı onay)
Sıra önemli: yeni web kodu yeni sütunları okur, veritabanı önce güncellenmeli.
- [ ] `npx prisma migrate deploy` (yalnız sütun ekler)
- [ ] `main`'e commit, `curve`'e birleştir, push (Vercel kendisi yayınlar)
- [ ] VM'de `git pull`, `npm ci`, `openreply-worker` yeniden başlat; `/api/health` worker kalp atışı yeni
- [ ] Bir kampanyada akıllı mod + metinler (Fatih'in seçtiği), Fatih ikinci hesabından yorum + yanıta yanıt testi
