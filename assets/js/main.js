
document.addEventListener("DOMContentLoaded", () => {
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  let currentCalendar = "julian"; // Old calendar by default
  let currentDate = new Date();   // month shown in selector
  let selectedDate = new Date();  // day whose data is shown on the left


  function withMainAnimation(updateFn, options) {
    const main = document.querySelector(".app-main");
    const opts = options || {};
    const scrollToTop = !!opts.scrollToTop;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (!main) {
      updateFn();
      return;
    }

    const DURATION = 160; // keep in sync with CSS

    // Phase 1: fade out
    main.classList.add("is-updating");

    setTimeout(() => {
      // Phase 2: run update while faded out
      const maybePromise = updateFn();

      const finish = () => {
        // Force reflow so the browser recognizes DOM changes
        void main.offsetWidth;

        // Restore scroll position (or force top)
        window.scrollTo(0, scrollToTop ? 0 : scrollY);

        // Phase 3: fade back in
        main.classList.remove("is-updating");
      };

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.finally(finish);
      } else {
        finish();
      }
    }, DURATION);
  }

function updateCivilDate() {
    const el = document.getElementById("civil-date");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    el.textContent = fmt.format(selectedDate);
  }

  function monthName(num) {
    const names = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return names[num] || "";
  }

  function setToggleUI() {
    const julBtn = document.getElementById("toggle-julian");
    const gregBtn = document.getElementById("toggle-gregorian");
    if (!julBtn || !gregBtn) return;

    if (currentCalendar === "julian") {
      julBtn.classList.add("active");
      gregBtn.classList.remove("active");
    } else {
      gregBtn.classList.add("active");
      julBtn.classList.remove("active");
    }
  }

  function apiDayUrl(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `https://orthocal.info/api/${currentCalendar}/${y}/${m}/${d}/`;
  }

  // Normalise Orthocal references like "1 Timothy 1.18-20, 2.8-15" -> "1 Timothy 1:18-20"
  function normaliseReference(ref) {
    if (!ref) return "";
    let firstPart = ref.split(",")[0].trim();
    firstPart = firstPart.replace(/(\d)\.(\d)/g, "$1:$2");
    return firstPart;
  }

  // Bible text API (KJV via bible-api.com – free, public domain)
  async function fetchBiblePassage(reference) {
    if (!reference) return "";
    const displayRef = reference.replace(/\.$/, "");
    const normalised = normaliseReference(displayRef);
    if (!normalised) return displayRef;

    const url = `https://bible-api.com/${encodeURIComponent(normalised)}?translation=kjv`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (data && data.text) {
        return `${displayRef} (KJV)\n\n${data.text.trim()}`;
      }
    } catch (e) {
      console.error("Bible API error:", e);
    }
    return `${displayRef}\n\nPassage text could not be loaded. Please open this reference in your Bible.`;
  }

  function resetToday() {
    const setText = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setText("calendar-date-label", "—");
    setText("liturgical-date", "—");

    ["feast-list", "saints-list", "service-notes-list", "readings-list", "fast-list"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
      }
    );

    const notes = document.getElementById("service-notes");
    if (notes) notes.style.display = "none";

    const readingsEmpty = document.getElementById("readings-empty");
    if (readingsEmpty) readingsEmpty.style.display = "none";

    const errorEl = document.getElementById("summary-error");
    if (errorEl) errorEl.style.display = "none";
  }

  function extraFastFoods(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("fast-free") || t.includes("no fasting") || t.includes("no fast")) {
    return [];
  }
  let foods = new Set();

  // Explicit "no X" phrases in the Orthocal text
  if (t.includes("no meat") || t.includes("without meat") || t.includes("abstain from meat")) {
    foods.add("meat");
  }
  if (t.includes("no dairy") || t.includes("without dairy")) {
    foods.add("dairy");
  }
  if (t.includes("no eggs") || t.includes("without eggs")) {
    foods.add("eggs");
  }
  if (t.includes("no fish") || t.includes("without fish")) {
    foods.add("fish");
  }
  if (t.includes("no oil") || t.includes("no olive oil") || t.includes("without oil")) {
    foods.add("oil");
  }
  if (t.includes("no wine") || t.includes("no alcoholic") || t.includes("no alcohol")) {
    foods.add("wine");
  }
  if (t.includes("no animal products")) {
    ["meat", "dairy", "eggs"].forEach((f) => foods.add(f));
  }

  // Generic patterns by fast name (fallback)
  if (t.includes("strict fast")) {
    ["meat", "dairy", "eggs", "fish", "oil", "wine"].forEach((f) => foods.add(f));
  }
  if (
      t.includes("nativity fast") ||
      t.includes("great lent") ||
      t.includes("great fast") ||
      t.includes("lenten fast") ||
      t.includes("dormition") ||
      t.includes("apostles fast")
    ) {
      ["meat", "dairy"].forEach((f) => foods.add(f));
  }

  // If we still have nothing but the word "fast" is present, assume at least meat.
  if (t.includes("fast") && foods.size === 0) {
    foods.add("meat");
  }

  return Array.from(foods);
}


const FAST_FOOD_CATEGORIES = ["Meat", "Dairy", "Eggs", "Fish", "Wine", "Oil"];

/**
 * From Orthocal fast descriptions, compute which foods are allowed and forbidden.
 */



function computeFastRules(fastLevelDesc, fastExceptionDesc) {
  const combined = ((fastLevelDesc || "") + " " + (fastExceptionDesc || "")).trim();
  const t = combined.toLowerCase();

  const allFoods = ["Meat", "Dairy", "Eggs", "Fish", "Wine", "Oil"];

  // Completely fast-free: everything allowed, nothing forbidden
  if (
    !combined ||
    t.includes("fast-free") ||
    t.includes("fast free") ||
    t.includes("fast free period") ||
    t.includes("no fast") ||
    t.includes("no fasting")
  ) {
    return {
      label: combined || "No fast",
      isNoFast: true,
      allowed: allFoods.slice(),
      forbidden: []
    };
  }

  // Cheese-fare / meat-only restriction (e.g. Cheese-fare week: no meat, other animal products allowed)
  const isCheeseFare =
    t.includes("cheese-fare") ||
    t.includes("cheese fare") ||
    t.includes("cheesefare");

  if (
    isCheeseFare ||
    (t.includes("no meat") &&
      !t.includes("no dairy") &&
      !t.includes("no eggs") &&
      !t.includes("no fish") &&
      !t.includes("no wine") &&
      !t.includes("no oil"))
  ) {
    const allowed = ["Dairy", "Eggs", "Fish", "Wine", "Oil"];
    const forbidden = ["Meat"];
    return {
      label: combined || "Meat fast",
      isNoFast: false,
      allowed,
      forbidden
    };
  }

  // If the text does not even mention a fast at all, treat it as no fast
  const mentionsFast = t.includes("fast") || t.includes("lent");
  if (!mentionsFast) {
    return {
      label: combined || "No fast",
      isNoFast: true,
      allowed: allFoods.slice(),
      forbidden: []
    };
  }

  // Baseline for any fast day according to Russian typikon explanations:
  // strict fast = no meat, eggs, dairy products, fish, wine or oil.
  const allowedSet = new Set();
  const forbiddenSet = new Set(allFoods);

  const textHas = (phrase) => t.includes(phrase);

  // Canonical phrases used in Russian calendars:
  const hasFishWineOil =
    t.includes("fish, wine and oil") ||
    t.includes("fish, wine & oil") ||
    t.includes("fish wine and oil");
  const hasWineOil =
    (t.includes("wine and oil") || t.includes("wine & oil")) && !hasFishWineOil;

  // Apply high-level canonical exceptions first
  if (hasFishWineOil) {
    ["Fish", "Wine", "Oil"].forEach((f) => {
      forbiddenSet.delete(f);
      allowedSet.add(f);
    });
  } else if (hasWineOil) {
    ["Wine", "Oil"].forEach((f) => {
      forbiddenSet.delete(f);
      allowedSet.add(f);
    });
  }

  // Additional explicit "X allowed" phrases (if present in the API text)
  if (textHas("fish allowed") || textHas("fish is allowed")) {
    forbiddenSet.delete("Fish");
    allowedSet.add("Fish");
  }
  if (textHas("wine allowed") || textHas("wine is allowed")) {
    forbiddenSet.delete("Wine");
    allowedSet.add("Wine");
  }
  if (textHas("oil allowed") || textHas("oil is allowed") || textHas("olive oil allowed")) {
    forbiddenSet.delete("Oil");
    allowedSet.add("Oil");
  }

  // Explicit "no X" phrases always override allowances
  if (textHas("no meat")) {
    forbiddenSet.add("Meat");
    allowedSet.delete("Meat");
  }
  if (textHas("no dairy")) {
    forbiddenSet.add("Dairy");
    allowedSet.delete("Dairy");
  }
  if (textHas("no eggs")) {
    forbiddenSet.add("Eggs");
    allowedSet.delete("Eggs");
  }
  if (textHas("no fish")) {
    forbiddenSet.add("Fish");
    allowedSet.delete("Fish");
  }
  if (textHas("no wine") || textHas("no alcohol")) {
    forbiddenSet.add("Wine");
    allowedSet.delete("Wine");
  }
  if (textHas("no oil") || textHas("no olive oil")) {
    forbiddenSet.add("Oil");
    allowedSet.delete("Oil");
  }

  return {
    label: combined,
    isNoFast: false,
    allowed: Array.from(allowedSet),
    forbidden: Array.from(forbiddenSet)
  };
}



const DAILY_PRAYERS = [
  {
    category: "Morning Prayers",
    prayers: [
      {
        title: "The Trisagion Prayer",
        text: `In the Name of the Father, and of the Son, and of the Holy Spirit. Amen. Glory to thee, our God, glory to thee. O heavenly King, O Comforter, the Spirit of truth, who art in all places and fills all things; Treasury of good things and Giver of life: Come and dwell in us and cleanse us from every stain, and save our souls, O gracious Lord. Holy God, Holy Mighty, Holy Immortal: have mercy on us. (Thrice) Glory to the Father, and to the Son, and to the Holy Spirit: now and ever and unto ages of ages. Amen. All-holy Trinity, have mercy on us. Lord, cleanse us from our sins. Master, pardon our iniquities. Holy God, visit and heal our infirmities for thy Name'ssake. Lord, have mercy. (Thrice) Glory to the Father, and to the Son, and to the Holy Spirit: now and ever, and unto ages of ages. Amen. Our Father, who art in heaven, hallowed be thy Name; thy kingdom come; thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Through the prayers of our holy Fathers, Lord Jesus Christ our God, have mercy on us and save us. Amen.`
      },
      {
        title: "Troparia to the Holy Trinity",
        text: `Having arisen from sleep, we fall down before thee, O Blessed One, and sing to thee, O Mighty One, the Angelic Hymn: Holy, holy, holy art thou, O God. Through the Theotokos have mercy on us. Glory to the Father, and to the Son, and to the Holy Spirit: From my bed and sleep Thou hast raised me: O Lord, enlighten my mind and my heart, and open my lips that I may praise thee, O Holy Trinity: Holy, holy, holy art thou, O God. Through the Theotokos have mercy on us. Both now and ever, and unto ages of ages. Amen. Suddenly the Judge shall come, and the deeds of each shall be revealed: but with fear we cry out in the middle of the night: Holy, holy, holy art thou, O God. Through the Theotokos have mercy on us. Lord, have mercy. (12 times )`
      },
      {
        title: "A Prayer to the Holy Trinity",
        text: `Arising from sleep I thank thee, O holy Trinity, because of the abundance of thy goodness and long-suffering thou was not wroth with me, slothful and sinful as I am; neither hast thou destroyed me in my transgressions: but in thy compassion raised me up, as I lay in despair; that at dawn I might sing the glories of thy Majesty. Do thou now enlighten the eyes of my understanding, open my mouth to receive thy words, teach me thy commandments, help me to do thy will, confessing thee from my heart, singing and praising thine All -holy Name: of the Father, and of the Son, and of the Holy Spirit: now and ever, and unto ages of ages. Amen.`
      },
      {
        title: "The Creed (Nicene-Constantinopolitan)",
        text: `I believe in one God, the Father Almighty, Maker of heaven and earth, and of all things visible and invisible; And in one Lord Jesus Christ, the Son of God, the Only -begotten, Begotten of the Father before all worlds, Light of Light, Very God of Very God, Begotten, not made; of one essence with the Father, by whom all things were made : Who for us men and for our salvation came down from heaven, And was incarnate of the Holy Spirit and the Virgin Mary, and was made man; And was crucified also for us under Pontius Pilate, and suffered and was buried; And the third day He rose again, according to the Scriptures; And ascended into heaven, and sits at the right hand of the Father; And He shall come again with glory to judge the quick and the dead, Whose kingdom shall have no end. And I believe in the Holy Spirit, the Lord, and Giver of Life, Who proceed sfrom the Father, Who with the Father and the Son together is worshipped and glorified, Who spoke by the Prophets; And I believe in One Holy Catholic and Apostolic Church. I acknowledge one Baptism for the remission of sins. I look for the Resurrection of the dead. And the Life of the world to come. Amen.`
      },
      {
        title: "A Morning Prayer of St. Basil the Great",
        text: `We bless thee, O God most high and Lord of mercies, whoever works great and mysterious deeds for us, glorious, wonderful, and numberless; who provides us with sleep as a rest from our infirmities and as a repose for our bodies tired by labor. We thank thee that thou hast not destroyed us in our transgressions, but in thy love toward mankind thou hast raised us up, as we lay in despair, that we may glorify thy Majesty. We entreat thine infinite goodness, enlighten the eyes of our understanding and raise up our minds from the heavy sleep of indolence; open our mouths and fill them with thy praise, that we may unceasingly sing and confess thee, who a rt God glorified in all and by all, the eternal Father, the Only -Begotten Son, and the all -holy and good and life -giving Spirit: now and ever, and unto ages of ages. Amen. [Here may be added your own private devotions and intercessions, using your own words or the "Occasional Prayers". When you have finished, conclude with this prayer:] Through the prayers of our holy Fathers, Lord Jesus Christ our God, have mercy upon us and save us. Amen.`
      }
    ]
  },
  {
    category: "Evening Prayers",
    prayers: [
      {
        title: "The Trisagion Prayer",
        text: `In the Name of the Father, and of the Son, and of the Holy Spirit. Amen. Glory to thee, our God, glory to thee. O heavenly King, O Comforter, the Spirit of truth, who art in all places and fills all things; Treasury of good things and Giver of life: Come and dwell in us and cleanse us from every stain, and save our souls, O gracious Lord. Holy God, Holy Mighty, Holy Immortal: have mercy on us. (Thrice) Glory to the Father, and to the Son, and to the Holy Spirit: now and ever and unto ages of ages. Amen. All-holy Trinity, have mercy on us. Lord, cleanse us from our sins. Master, pardon our iniquities. Holy God, visit and heal our infirmities for thy Name'ssake. Lord, have mercy. (Thrice) Glory to the Father, and to the Son, and to the Holy Spirit: now and ever, and unto ages of ages. Amen. Our Father, who art in heaven, hallowed be thy Name; thy kingdom come; thy will be done on earth, as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Through the prayers of our holy Fathers, Lord Jesus Christ our God, have mercy on us and save us. Amen.`
      },
      {
        title: "Troparia of Thanksgiving",
        text: `Now that the day has come to a close, I thank thee, O Lord, and I ask that the eve ning with the night may be sinless; grant this to me, O Savior , and save me. Glory to the Father, and to the Son, and to the Holy Spirit. Now that the day hath passed, I glorify thee, O Master, and I ask that the evening, with the night may be without offe nce; grant this to me, O Savior , and save me. Both now and ever, and unto ages of ages. Amen. Now that the day hath run its course, I praise thee, O Holy One, and I ask that the evening with the night may be undisturbed; grant this to me, O Savior , and sav eme. Lord, have mercy. (12 times)`
      },
      {
        title: "A Prayer for Forgiveness",
        text: `O Lord our God, if during this day I have sinned, whether in word or deed or thought, forgive me all, for thou art good and loves mankind. Grant me peaceful and undisturbed sleep, and deliver me from all influence and temptation of the evil one. Raise me up again in proper time that I may glorify thee; for thou art blessed: with thine Only -begotten Son and thine All -holy Spirit: now and ever, and unto ages of ages. Amen. The Creed I believe in one God, the Father Almighty, Maker of heaven and earth, and of all things visible and invisible; And in one Lord Jesus Christ, the Son of God, the Only -begotten, Begotten of the Father before all worlds, Light of Light, Very God of Very God, Begotten, not made; of one essence with the Father, by whom all things were made: Who for us men and for our salvation came down from heaven, And was incarnate of the Holy Spirit and the Virgin Mary, and was made man; And was crucified also for us under Pontius Pilate, and suffered and was buried; And the third day He rose again, according to the Scriptures; And ascended into heaven, and sits at the right hand of the Father; And He shall come again with glory to judge the quick and the dead, Whose kingdom shall have no end. And I believe in the Holy Spirit, the Lord, and Giver of Life, Who proceed sfrom the Father, Who with the Father and the Son together is worshipped and glorified, Who spoke by the Prophets; And I believe in One Holy Catholic and Apos tolic Church. I acknowledge one Baptism for the remission of sins. I look for the Resurrection of the dead. And the Life of the world to come. Amen.`
      },
      {
        title: "Prayer of the Hours",
        text: `O Christ our God, who at all times and in every hour, in heaven and on earth, art wor shipped and glorified; who art long -suffering, merciful and compassionate; who loves the just and shows mercy upon the sinner; who calls all to salvation through the promise of blessings to come; O Lord, in this hour receive our supplications, and direct o ur lives according to thy commandments. Sanctify our souls, hallow our bodies, correct our thoughts, cleanse our minds; deliver us from all tribulation, evil and distress. Encompass us with thy holy Angels, that guided and guarded by them, we may attain to the unity of the faith and to the knowledge of thine unapproachable glory, for thou art blessed unto ages of ages. Amen. [Here may be added your own private devotions and intercessions, using your own words or the "Occasional Prayers". When you have finis hed, conclude with this prayer:] Through the prayers of our holy Fathers, Lord Jesus Christ our God, have mercy upon us and save us. Amen. [As you lie down to sleep, say:]`
      },
      {
        title: "Into Thy Hands",
        text: `Into thy hands, O Lord, I commend my soul and my body. Do thou thyself bless me, have mercy upon me, and grant me life eternal. Amen.`
      }
    ]
  },
  {
    category: "Table Prayers",
    prayers: [
      {
        title: "Prayer Before Meals",
        text: `In the Name of the Father, and of the Son, and of the Holy Spirit. Amen. Our Father, who art in heaven, hallowed be thy Name; thy kingdom come; thy will be done on earth, as it is in he aven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. For thine is the kingdom, and the power, and the glory, of the Father, and of the Son, and of the Holy Spirit: now and ever, and unto ages of ages. Amen. Glory to the Father, and to the Son, and to the Holy Spirit: now and ever, and unto ages of ages. Amen. Lord, have mercy. (Thrice) Then O Christ our God, bless the food and drink of thy servants, for thou art Holy always; now and ever, and unto ages of ages. Amen.`
      },
      {
        title: "Prayer After Meals",
        text: `Glory to the Father, and to the Son, and to the Holy Spirit: now and ever, and unto ages of ages. Amen. Lord, have mercy. (Thrice) Then We thank thee, O Christ our God, that thou hast satisfied us with thy earthly gifts, deprive us not of thy Heavenly Kingdom; but as thou entered into the midst of thy disciples, O Savior , and gave them peace, enter also among us and save us. Amen.`
      }
    ]
  },
  {
    category: "Prayers Before Work and Travel",
    prayers: [
      {
        title: "Prayer Before Any Task",
        text: `Almighty God, our Help and Refuge, Fountain of wisdom and Tower of strength, who knows that I can do nothing without thy guidance and help; assist me, I pray thee, and direct me to divine wisdom and power, that I may accomplish this task, and whatever I may undertake to do, faithfully and diligently, according to thy will, so that it may be profitable to myself and others, and to the glory of thy Holy Name. For thine is the kingdom, and the power, and the glory, of the Father, and of the Son, and of the Holy Spirit: now and ever, and unto ages of ages. Amen.`
      },
      {
        title: "Prayer Before a Journey",
        text: `O Lord Jesus Christ our God, the true and living way, be thou, O Master, my companion, guide and guardian during my journey; deliver and protect me from all danger, misfortune and temptation; that being so defended by Thy divine power, I may have a peaceful and successful journey and arrive safely at my destination. For in thee I put my trust and hope, and to thee, together with thy Eternal Father, and the All -holy Sp irit, I ascribe all praise, honor and glory: now and ever, and unto ages of ages. Amen.`
      }
    ]
  },
  {
    category: "Prayers in Preparation for Holy Communion",
    prayers: [
      {
        title: "A Prayer of St. Basil the Great",
        text: `O Lord and Master, Jesus Christ, our God, Fountain of life and immortality, Creator of all things visible and invisible; Consubstantial and Co -eternal Son of the eternal Father, who in thine exceeding great love didst become incarnate in the latter days, and was crucified for us ungrateful and wicked children, and by thine own Blood didst renew our nature corrupted by sin: Do thou, O Immortal King, receive me, a repentant sinner; incline thine ear unto me and hear my prayer. I have sinned, O Lord, I have sinned againstheaven and before thee, and I am not worthy to lift up my eyes to the majesty of thy glory, for I have affronted thy goodness, and broken thy commandments, and disobeyed thy laws. But thou, O Lord, most loving, long -suffering and merciful, hast not given me over to perish in my sin, but dost ever await my return. For, O Thou who lov es mankind, thou hast said, by thy Prophet, that thou hast no pleasure in the death of a sinner, but rather than he should turn from his wickedness and live. Thou dost not desire, O Master, to destroy the works of thy hands or that they should perish, but wills that all men should be saved and come to the knowledge of the Truth. Wherefore I, although unworthy both of heaven and of earth and of this temporary life, even I, a wretched sinner who had given myself over to every evil desire, despair not of salva tion, though I have been wholly subject to sin, a slave to passion, and have defiled thine image within me, who am thy creation and thy work; but trusting in thine infinite compassion, draw nigh unto thee. Receive me, O Lord, thou that loves mankind, as th ou didst receive the sinful woman, the thief, the publican and the prodigal son. Take away the heavy burden of my sins, O Thou that takes away the sins of the world, and heals the infirmities of men, and calls all that are weary and heavy laden to thyself and gives them rest; thou that came not to call the righteous but sinners to repentance, cleanse thou me from all stain of body and soul and teach me to fulfill holiness in thy fear, that with the witness of my conscience pure, I may receive a portion of thy Holy Gifts, and be united to thy Holy Body and Precious Blood, and may have thee, with thy Father and Holy Spirit, dwelling and abiding in me. And grant, O Lord Jesus Christ, my God, that the partaking of thy precious and Life -giving Mysteries may not b eto my condemnation, nor may not through the weakness of my soul and body be received unworthily; but grant that, even unto my last breath, I may partake of a portion of thy Holy Gifts without condemnation, unto the Communion of thy Holy Spirit, as a preparation for eternal Life and for a good defense at thy dread Judgment Seat; so that I, together with all thine elect, may also receive those incorruptible good things which thou hast prepared for them that love thee, O Lord; in whom thou art glorified fore ver. Amen. Another Prayer of St. Basil the Great O Lord, I know that I am unworthy to receive thy Holy Body and Precious Blood; I know that I am guilty, and that I eat and drink condemnation to myself, not discerning the Body and Blood of Christ my God. Bu ttrusting in thy loving -kindness I come unto thee who has said: He that eats my Body and drink smy Blood shall dwell in me and I in him. Therefore, O Lord, have compassion on me and make not an example of me, thy sinful servant. But do unto me according to thy great mercy, and grant that these Holy Gifts may be for me unto the healing, purification, enlightenment, protection, salvation and sanctification of my soul and body, and to the expulsion of every evil imagination, sinful deed or work of the Devil. May they move me to reliance on thee and to love thee always, to amend and keep firm my life; and be ever in me to the increase of virtue, to the keeping of thy Commandments, to the communion of the Holy Spirit, and as a good defense before thy dread Judgm ent Seat, and for Life Eternal. Amen. O Lord my God, I know that I am not worthy nor sufficient that thou should enter under my roof into the habitation of my soul, for it is all deserted and in ruins, and thou hast not a fi tting place in me to lay thy head. But as from the heights of thy glory thou didst humble thyself, so now bear me in my humility; as thou didst deign to lie in a manger in a cave, so deign now also to come into the manger of my mute soul and corrupt body. As thou didst not refrain from entering into the house of Simon the leper, or shrink from eating there with sinners, so also vouchsafe to enter the house of my poor soul, all leprous and full of sin. Thou didst not reject the sinful woman who ventured to draw near to touch thee, so also have pity on me, a sinner, approaching to touch thee. And grant that I may partake of thine All -holy Body and Precious Blood for the sanctification, enlightenment and strengthening of my weak soul and body; for the relief fr om the burden of my many sins; for my preservation against all the snares of the devil; for victory over all my sinful and evil habits; for the mortification of my passions; for obedience to thy Commandments; for growth in thy divine Grace and for the inhe ritance of thy Kingdom. For it is not with careless heart that I approach thee, O Christ my God, but I come trusting in thine infinite goodness, and fearing lest I may be drawn afar from thee and become the prey of the wolf of souls. Wherefore, I pray thee , O Master, who alone art holy, that thou would sanctify my soul and body, my mind and heart and reins, and renew me entirely. Implant in my members the fear of thee, be thou my helper and guide, directing my life in the paths of peace, and make me worthy to stand at thy right hand with thy Saints; through the prayers and intercessions of thine immaculate Mother, of thy Bodiless Servitors, of the immaculate Powers, and of all the Saints who from all ages have been well -pleasing unto thee. Amen.`
      },
      {
        title: "A Prayer of St. John of Damascus",
        text: `O Lord and Master Jesus Christ, our God, who alone hath power to forgive the sins of men, do thou, O Good One who loves mankind, forgive all the sins that I have committed in knowledge or in ignorance, and make me worthy to receive wit hout condemnation thy divine, glorious, immaculate and life -giving Mysteries; not unto punishment or unto increase of sin; but unto purification, and sanctification and a promise of thy Kingdom and the Life to come; as a protection and a help to overthrow the adversaries, and to blot out my many sins. For thou art a God of mercy and compassion and love toward mankind, and unto Thee we ascribe glory, together with the Father and the Holy Spirit: now and ever, and unto ages of ages. Amen.`
      },
      {
        title: "Another Prayer of St. John of Damascus",
        text: `I stand before the gates of thy Temple, and yet I refrain not from my evil thoughts. But do thou, O Christ my God, who didst justify the publican, and had mercy on the Canaanite woman, and opened the gates of Paradise to the thief; open unto me the compassion of thy love toward mankind, and receive me as I approach and touch thee, like the sinful woman and the woman with the issue of blood; for the one, by embracing thy feet received the forgiveness of her sins, and the other by but touch ing the hem of thy garment was healed. And I, most sinful, dare to partake of thy whole Body. Let me not be consumed, but receive me as thou didst receive them, and enlighten the perceptions of my soul, consuming the accusations of my sins: through the intercessions of Her that, without stain, gave Thee birth, and of the heavenly Powers: for thou art blessed unto ages of ages. Amen.`
      },
      {
        title: "A Prayer of St. John Chrysostom",
        text: `O Lord my God, I know that I am not worthy nor sufficient that thou should enter under my roof into the habitation of my soul, for it is all deserted and in ruins, and thou hast not a fi tting place in me to lay thy head. But as from the heights of thy glory thou didst humble thyself, so now bear me in my humility; as thou didst deign to lie in a manger in a cave, so deign now also to come into the manger of my mute soul and corrupt body. As thou didst not refrain from entering into the house of Simon the leper, or shrink from eating there with sinners, so also vouchsafe to enter the house of my poor soul, all leprous and full of sin. Thou didst not reject the sinful woman who ventured to draw near to touch thee, so also have pity on me, a sinner, approaching to touch thee. And grant that I may partake of thine All -holy Body and Precious Blood for the sanctification, enlightenment and strengthening of my weak soul and body; for the relief fr om the burden of my many sins; for my preservation against all the snares of the devil; for victory over all my sinful and evil habits; for the mortification of my passions; for obedience to thy Commandments; for growth in thy divine Grace and for the inhe ritance of thy Kingdom. For it is not with careless heart that I approach thee, O Christ my God, but I come trusting in thine infinite goodness, and fearing lest I may be drawn afar from thee and become the prey of the wolf of souls. Wherefore, I pray thee , O Master, who alone art holy, that thou would sanctify my soul and body, my mind and heart and reins, and renew me entirely. Implant in my members the fear of thee, be thou my helper and guide, directing my life in the paths of peace, and make me worthy to stand at thy right hand with thy Saints; through the prayers and intercessions of thine immaculate Mother, of thy Bodiless Servitors, of the immaculate Powers, and of all the Saints who from all ages have been well -pleasing unto thee. Amen. A Prayer of St. John of Damascus O Lord and Master Jesus Christ, our God, who alone hath power to forgive the sins of men, do thou, O Good One who loves mankind, forgive all the sins that I have committed in knowledge or in ignorance, and make me worthy to receive wit hout condemnation thy divine, glorious, immaculate and life -giving Mysteries; not unto punishment or unto increase of sin; but unto purification, and sanctification and a promise of thy Kingdom and the Life to come; as a protection and a help to overthrow the adversaries, and to blot out my many sins. For thou art a God of mercy and compassion and love toward mankind, and unto Thee we ascribe glory, together with the Father and the Holy Spirit: now and ever, and unto ages of ages. Amen. Another Prayer of St . John of Damascus I stand before the gates of thy Temple, and yet I refrain not from my evil thoughts. But do thou, O Christ my God, who didst justify the publican, and had mercy on the Canaanite woman, and opened the gates of Paradise to the thief; open unto me the compassion of thy love toward mankind, and receive me as I approach and touch thee, like the sinful woman and the woman with the issue of blood; for the one, by embracing thy feet received the forgiveness of her sins, and the other by but touch ing the hem of thy garment was healed. And I, most sinful, dare to partake of thy whole Body. Let me not be consumed, but receive me as thou didst receive them, and enlighten the perceptions of my soul, consuming the accusations of my sins: through the intercessions of Her that, without stain, gave Thee birth, and of the heavenly Powers: for thou art blessed unto ages of ages. Amen.`
      },
      {
        title: "I believe, O Lord, and I confess",
        text: `I believe, O Lord, and I confess that thou art truly the Christ, the Son of the living God, who didst come into the world to save sinners, of whom I am chief. And I believe that this is truly thine own precious Body, and that this is truly thine own precious Blood. Wherefore I pray thee, have mercy upon me and forgive my transgressions both volunta ry and involuntary, of word and of deed, of knowledge and of ignorance; and make me worthy to partake without condemnation of thine immaculate Mysteries, unto remission of my sins and unto life everlasting. Amen.`
      }
    ]
  }
];


function buildDailyPrayers() {
  const container = document.getElementById("prayer-category-list");
  if (!container) return;
  container.innerHTML = "";

  DAILY_PRAYERS.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "reading-card";

    const header = document.createElement("div");
    header.className = "reading-header";

    const main = document.createElement("div");
    main.className = "reading-main";

    const nameEl = document.createElement("div");
    nameEl.className = "prayer-category-name";
    nameEl.textContent = cat.category;
    main.appendChild(nameEl);

    const toggle = document.createElement("div");
    toggle.className = "reading-toggle";
    toggle.textContent = "View prayers";

    header.appendChild(main);
    header.appendChild(toggle);

    const body = document.createElement("div");
    body.className = "reading-body";
    body.style.display = "none";

    if (Array.isArray(cat.prayers) && cat.prayers.length > 0) {
      cat.prayers.forEach((prayer) => {
        const item = document.createElement("div");
        item.className = "prayer-item";

        const pHeader = document.createElement("div");
        pHeader.className = "prayer-header";

        const titleEl = document.createElement("div");
        titleEl.className = "prayer-title";
        titleEl.textContent = prayer.title;

        const pToggle = document.createElement("div");
        pToggle.className = "prayer-toggle";
        pToggle.textContent = "Show";

        pHeader.appendChild(titleEl);
        pHeader.appendChild(pToggle);

        const pBody = document.createElement("div");
        pBody.className = "prayer-body";
        pBody.style.display = "none";
        pBody.textContent = prayer.text;

        const togglePrayer = () => {
          if (pBody.style.display === "none" || !pBody.style.display) {
            pBody.style.display = "block";
            pToggle.textContent = "Hide";
          } else {
            pBody.style.display = "none";
            pToggle.textContent = "Show";
          }
        };

        pHeader.addEventListener("click", togglePrayer);
        pToggle.addEventListener("click", (ev) => {
          ev.stopPropagation();
          togglePrayer();
        });

        item.appendChild(pHeader);
        item.appendChild(pBody);
        body.appendChild(item);
      });
    } else {
      const none = document.createElement("p");
      none.className = "muted";
      none.textContent = "No prayers have been added to this section yet.";
      body.appendChild(none);
    }

    const toggleBody = () => {
      if (body.style.display === "none" || !body.style.display) {
        body.style.display = "block";
        toggle.textContent = "Hide";
      } else {
        body.style.display = "none";
        toggle.textContent = "View prayers";
      }
    };

    header.addEventListener("click", toggleBody);
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleBody();
    });

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}
function normalizeReadingText(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/\r\n/g, "\n");
  const paragraphs = s.split(/\n{2,}/);
  const cleaned = paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  return cleaned.join("\n\n");
}


function findCommemorationDetail(data, name) {
  if (!data || !name) return "";
  const n = name.trim().toLowerCase();

  // Helper: deep search data for a long string mentioning this name
  function deepSearch(obj) {
    if (!obj || typeof obj !== "object") return "";
    if (Array.isArray(obj)) {
      for (const v of obj) {
        const res = typeof v === "object" ? deepSearch(v) : "";
        if (res) return res;
      }
      return "";
    }
    // plain object
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const text = value.trim();
        if (text.length > 200) {
          const tLower = text.toLowerCase();
          // Only use significant words from the saint's name, not generic titles
          const STOP_WORDS = new Set([
            "saint","st","holy","most","great","martyr","martyrs","venerable",
            "apostle","hieromartyr","wonderworker","and","of","the","with",
            "from","in","on","for","to","our","father","mother","virgin",
            "confessor","bishop","priest","monk","nun","new","equal","apostles"
          ]);
          const tokens = n
            .split(/\s+/)
            .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
            .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
          let hits = 0;
          for (const w of tokens) {
            if (tLower.includes(w)) {
              hits++;
              if (hits >= 2) {
                return text;
              }
            }
          }
        }
      } else if (typeof value === "object") {
        const res = deepSearch(value);
        if (res) return res;
      }
    }
    return "";
  }

  // Try a 'commemorations' array if present
    if (Array.isArray(data.commemorations)) {
      for (const item of data.commemorations) {
        const title = (item.title || item.name || item.commemoration || "").trim();
        const text =
          item.text ||
          item.description ||
          item.bio ||
          item.life ||
          item.synaxarion ||
          "";
        if (!text) continue;
        const tLower = title.toLowerCase();
        if (tLower && (tLower.includes(n) || n.includes(tLower))) {
          return String(text).trim();
        }
      }
    }

    // Try a 'saint_details' style array if present
    if (Array.isArray(data.saint_details)) {
      for (const item of data.saint_details) {
        const title = (item.title || item.name || "").trim();
        const text = item.text || item.description || "";
        if (!text) continue;
        const tLower = title.toLowerCase();
        if (tLower && (tLower.includes(n) || n.includes(tLower))) {
          return String(text).trim();
        }
      }
    }

    

  // Fallback: deep search any nested long text that mentions this name
  const deep = deepSearch(data);
  if (deep) return deep;

  return "";
}
function findFeastDetail(data, name) {
  if (!data || !name) return "";
  const n = name.trim().toLowerCase();

  function deepSearch(obj) {
    if (!obj || typeof obj !== "object") return "";
    if (Array.isArray(obj)) {
      for (const v of obj) {
        const res = typeof v === "object" ? deepSearch(v) : "";
        if (res) return res;
      }
      return "";
    }
    // plain object
    let candidate = "";
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const text = value.trim();
        if (text.length > 200) {
          const tLower = text.toLowerCase();
          const tokens = n.split(/\s+/).filter((w) => w.length > 3);
          let hits = 0;
          for (const w of tokens) {
            if (tLower.includes(w)) {
              hits++;
              if (hits >= 2) {
                return text;
              }
            }
          }
          if (!candidate) candidate = text;
        }
      } else if (typeof value === "object") {
        const res = deepSearch(value);
        if (res) return res;
      }
    }
    return candidate;
  }

  // Try a dedicated feast details array if present
  if (Array.isArray(data.feast_details)) {
    for (const item of data.feast_details) {
      const title = (item.title || item.name || item.feast || "").trim();
      const text =
        item.text ||
        item.description ||
        item.note ||
        "";
      if (!text) continue;
      const tLower = title.toLowerCase();
      if (tLower && (tLower.includes(n) || n.includes(tLower))) {
        return String(text).trim();
      }
    }
  }

  // Fallback: reuse the commemorations deep search logic over the whole payload
  const deep = deepSearch(data);
  if (deep) return deep;

  return "";
}
function buildFeastDescription(text) {
    const t = (text || "").trim();
    if (!t) return "";
    if (/theotokos|mother of god/i.test(t)) {
      return "Feast of the Theotokos, honouring the Mother of God in the life of the Church.";
    }
    if (/nativity|birth/i.test(t)) {
      return "Feast of the Nativity, celebrating the birth connected with this event.";
    }
    if (/entry|presentation/i.test(t)) {
      return "Feast recalling the entry into the holy place and dedication to God.";
    }
    if (/resurrection|pascha/i.test(t)) {
      return "Feast of the Resurrection, centred on the victory of Christ over death.";
    }
    return "Feast kept today in the Orthodox Church in honour of this event or saint.";
  }

  function buildServiceNoteDescription(text) {
    const t = (text || "").toLowerCase();
    if (!t) return "";
    if (t.includes("great canon")) {
      return "A long penitential canon by St Andrew of Crete, appointed in the services of Great Lent.";
    }
    if (t.includes("presanctified")) {
      return "A Liturgy of the Presanctified Gifts, served on certain weekdays of Great Lent.";
    }
    if (t.includes("akathist")) {
      return "A hymn of praise chanted standing, often in honour of the Theotokos or a saint.";
    }
    if (t.includes("memorial") || t.includes("panikhida")) {
      return "Memorial prayers offered for the departed.";
    }
    return "Liturgical note for today’s services in the Orthodox Church.";
  }


  async function loadTodayFromAPI() {
    resetToday();
    updateCivilDate();

    const liturgicalDateEl = document.getElementById("liturgical-date");
    const feastListEl = document.getElementById("feast-list");
    const saintsListEl = document.getElementById("saints-list");
    const serviceNotesBlock = document.getElementById("service-notes");
    const serviceNotesList = document.getElementById("service-notes-list");
    const fastListEl = document.getElementById("fast-list");
    const readingsList = document.getElementById("readings-list");
    const readingsEmpty = document.getElementById("readings-empty");
    const errorEl = document.getElementById("summary-error");

    try {
      const url = apiDayUrl(selectedDate);
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();

      const y = data.year;
      const m = data.month;
      const d = data.day;
      const labelEl = document.getElementById("calendar-date-label");

      if (labelEl) {
        labelEl.textContent =
          currentCalendar === "julian"
            ? "Julian calendar date:"
            : "Gregorian calendar date:";
      }

      if (y && m && d && liturgicalDateEl) {
        liturgicalDateEl.textContent = `${d} ${monthName(m)} ${y}`;
      }

      const saintsArray = Array.isArray(data.saints) ? data.saints : [];

      // Saints of the day with richer descriptions
      

if (saintsListEl) {
        saintsListEl.innerHTML = "";
        if (saintsArray.length > 0) {
          saintsArray.forEach((s, idx) => {
            const li = document.createElement("li");

            // Build a card similar to scripture cards, with expandable detail.
            const card = document.createElement("div");
            card.className = "reading-card"; // reuse reading card styling

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const nameEl = document.createElement("div");
            nameEl.className = "saint-name";
            nameEl.textContent = s;

            main.appendChild(nameEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Learn More";

            header.appendChild(main);
            header.appendChild(toggle);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.style.display = "none";

            const fullText = findCommemorationDetail(data, s);
            if (fullText) {
              const text = String(fullText).trim();
              if (/[<>&]/.test(text)) {
                body.innerHTML = text;
              } else {
                body.textContent = text;
              }
            } else {
              body.textContent = "No further details are available.";
            }

            const toggleBody = () => {
              if (body.style.display === "none" || !body.style.display) {
                body.style.display = "block";
                toggle.textContent = "Hide";
              } else {
                body.style.display = "none";
                toggle.textContent = "Learn More";
              }
            };

            header.addEventListener("click", toggleBody);
            toggle.addEventListener("click", (ev) => {
              ev.stopPropagation();
              toggleBody();
            });

            card.appendChild(header);
            card.appendChild(body);
            li.appendChild(card);
            saintsListEl.appendChild(li);
          });
        } else {
          const li = document.createElement("li");
          const nameEl = document.createElement("div");
          nameEl.className = "saint-name";
          nameEl.textContent = "No specific commemorations listed for this day.";
          li.appendChild(nameEl);
          saintsListEl.appendChild(li);
        }
      }

// Fasting: bullet for type, then forbidden list
// (card style: fast name + expandable details from fast_exception_desc only)

      if (fastListEl) {
        fastListEl.innerHTML = "";

        const fastLevelDesc = data.fast_level_desc || "";
        const fastExceptionDesc = data.fast_exception_desc || "";
        const rules = computeFastRules(fastLevelDesc, fastExceptionDesc);

        const li = document.createElement("li");

        // Card container, matching Scripture and Commemorations
        const card = document.createElement("div");
        card.className = "reading-card";

        const header = document.createElement("div");
        header.className = "reading-header";

        const main = document.createElement("div");
        main.className = "reading-main";

        const nameEl = document.createElement("div");
        nameEl.className = "fast-name";

        if (rules.isNoFast) {
          nameEl.textContent = "No fast";
        } else {
          nameEl.textContent =
            data.fast_name ||
            data.fast_period ||
            fastLevelDesc ||
            fastExceptionDesc ||
            "Fast day";
        }

        main.appendChild(nameEl);

        const toggle = document.createElement("div");
        toggle.className = "reading-toggle";
        toggle.textContent = "Learn More";

        header.appendChild(main);
        header.appendChild(toggle);

        const body = document.createElement("div");
        body.className = "reading-body";
        body.style.display = "none";

        // Body text: show exception description if present, otherwise a simple "no exceptions" line.
        let detailText = "";
        if (rules.isNoFast) {
          detailText = "There is no fasting prescribed for this day.";
        } else if (
          fastExceptionDesc &&
          fastExceptionDesc.toLowerCase() !== "no overrides"
        ) {
          detailText = fastExceptionDesc;
        } else {
          detailText = "There are no exceptions for today's fast.";
        }

        body.textContent = detailText;

        const toggleBody = () => {
          if (body.style.display === "none" || !body.style.display) {
            body.style.display = "block";
            toggle.textContent = "Hide";
          } else {
            body.style.display = "none";
            toggle.textContent = "Learn More";
          }
        };

        header.addEventListener("click", toggleBody);
        toggle.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleBody();
        });

        card.appendChild(header);
        card.appendChild(body);
        li.appendChild(card);
        fastListEl.appendChild(li);
      }

// Feasts with richer descriptions, excluding "Liturgy..."
      if (feastListEl) {
        feastListEl.innerHTML = "";
        let added = false;
        if (Array.isArray(data.feasts) && data.feasts.length > 0) {
          data.feasts.forEach((f) => {
            if (typeof f === "string" && f.toLowerCase().startsWith("liturgy")) {
              return;
            }
            if (!f) return;
            const li = document.createElement("li");

            // Build a card similar to scripture and commemorations
            const card = document.createElement("div");
            card.className = "reading-card";

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const nameEl = document.createElement("div");
            nameEl.className = "feast-name";
            nameEl.textContent = f;
            main.appendChild(nameEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Learn More";

            header.appendChild(main);
            header.appendChild(toggle);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.style.display = "none";

            const fullText = findFeastDetail(data, f) || buildFeastDescription(f);
            if (fullText) {
              const text = String(fullText).trim();
              if (/[<>&]/.test(text)) {
                body.innerHTML = text;
              } else {
                body.textContent = text;
              }
            }

            const toggleBody = () => {
              if (body.style.display === "none" || !body.style.display) {
                body.style.display = "block";
                toggle.textContent = "Hide";
              } else {
                body.style.display = "none";
                toggle.textContent = "Learn More";
              }
            };

            header.addEventListener("click", toggleBody);
            toggle.addEventListener("click", (ev) => {
              ev.stopPropagation();
              toggleBody();
            });

            card.appendChild(header);
            card.appendChild(body);
            li.appendChild(card);
            feastListEl.appendChild(li);
            added = true;
          });
        }
        if (!added) {
          const li = document.createElement("li");
          const nameEl = document.createElement("div");
          nameEl.className = "feast-name";
          nameEl.textContent = "This is not a major feast day.";
          li.appendChild(nameEl);
          feastListEl.appendChild(li);
        }
      }
      if (serviceNotesList && serviceNotesBlock) {
        serviceNotesList.innerHTML = "";
        if (Array.isArray(data.service_notes) && data.service_notes.length > 0) {
          serviceNotesBlock.style.display = "block";
          data.service_notes.forEach((note) => {
            const li = document.createElement("li");

            const nameEl = document.createElement("div");
            nameEl.className = "note-name";
            nameEl.textContent = note;

            const descEl = document.createElement("div");
            descEl.className = "note-description";
            descEl.textContent = buildServiceNoteDescription(note);

            li.appendChild(nameEl);
            li.appendChild(descEl);
            serviceNotesList.appendChild(li);
          });
        } else {
          serviceNotesBlock.style.display = "none";
        }
      }

      // Readings — preload Bible text so toggles are instant
      if (readingsList && readingsEmpty) {
        readingsList.innerHTML = "";
        if (Array.isArray(data.readings) && data.readings.length > 0) {
          const refs = data.readings.map(
            (reading) => reading.display || reading.short_display || ""
          );
          const texts = await Promise.all(refs.map((r) => fetchBiblePassage(r)));

          data.readings.forEach((reading, index) => {
            const card = document.createElement("div");
            card.className = "reading-card";

            const header = document.createElement("div");
            header.className = "reading-header";

            const main = document.createElement("div");
            main.className = "reading-main";

            const refEl = document.createElement("div");
            refEl.className = "reading-ref";
            refEl.textContent = refs[index];

            const typeEl = document.createElement("div");
            typeEl.className = "reading-type";
            typeEl.textContent = reading.source || "Reading";

            main.appendChild(refEl);
            main.appendChild(typeEl);

            const toggle = document.createElement("div");
            toggle.className = "reading-toggle";
            toggle.textContent = "Read Scripture";

            header.appendChild(main);
            header.appendChild(toggle);

            const body = document.createElement("div");
            body.className = "reading-body";
            body.id = `reading-body-${index}`;
            const rawText = texts[index] || refs[index];
            body.textContent = normalizeReadingText(rawText);

            header.addEventListener("click", () => {
              const isActive = body.classList.contains("active");
              if (isActive) {
                body.classList.remove("active");
                toggle.textContent = "Read Scripture";
              } else {
                body.classList.add("active");
                toggle.textContent = "Hide";
              }
            });

            card.appendChild(header);
            card.appendChild(body);
            readingsList.appendChild(card);
          });

          readingsEmpty.style.display = "none";
        } else {
          readingsEmpty.style.display = "block";
        }
      }
    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent =
          "Could not load the Orthodox calendar information at this time.";
      }
    }
  }

  function updateMonthLabel() {
    const monthLabel = document.getElementById("month-label");
    if (!monthLabel) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthLabel.textContent = `${monthName(month + 1)} ${year}`;
  }

  function buildMonthGrid() {
    const tbody = document.getElementById("month-grid-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let day = 1;
    for (let week = 0; week < 6; week++) {
      const tr = document.createElement("tr");
      for (let dow = 0; dow < 7; dow++) {
        const td = document.createElement("td");

        if (week === 0 && dow < startDay) {
          td.className = "month-day-empty";
          td.textContent = "";
        } else if (day > daysInMonth) {
          td.className = "month-day-empty";
          td.textContent = "";
        } else {
          const dateObj = new Date(year, month, day);
          const isSelected =
            dateObj.getFullYear() === selectedDate.getFullYear() &&
            dateObj.getMonth() === selectedDate.getMonth() &&
            dateObj.getDate() === selectedDate.getDate();

          if (isSelected) td.classList.add("month-day-selected");

          const inner = document.createElement("div");
          inner.className = "month-day-inner";
          inner.textContent = String(day);
          td.appendChild(inner);

          const targetDay = day;
          td.addEventListener("click", () => {
            withMainAnimation(async () => {
              selectedDate = new Date(year, month, targetDay);
              updateCivilDate();
              await loadTodayFromAPI();
              buildMonthGrid();
            }, { scrollToTop: true });
          });

          day++;
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      if (day > daysInMonth) break;
    }
  }

  const julBtn = document.getElementById("toggle-julian");
  const gregBtn = document.getElementById("toggle-gregorian");

  if (julBtn) {
    julBtn.addEventListener("click", () => {
      if (currentCalendar !== "julian") {
        withMainAnimation(async () => {
          currentCalendar = "julian";
          setToggleUI();
          updateMonthLabel();
          buildMonthGrid();
          await loadTodayFromAPI();
        }, { scrollToTop: true });
      }
    });
  }

  if (gregBtn) {
    gregBtn.addEventListener("click", () => {
      if (currentCalendar !== "gregorian") {
        withMainAnimation(async () => {
          currentCalendar = "gregorian";
          setToggleUI();
          updateMonthLabel();
          buildMonthGrid();
          await loadTodayFromAPI();
        }, { scrollToTop: true });
      }
    });
  }

  const prevMonth = document.getElementById("prev-month");
  const nextMonth = document.getElementById("next-month");

  if (prevMonth) {
    prevMonth.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );
      updateMonthLabel();
      buildMonthGrid();
    });
  }

  if (nextMonth) {
    nextMonth.addEventListener("click", () => {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );
      updateMonthLabel();
      buildMonthGrid();
    });
  }

  

  // Hymn audio player
  const hymnButton = document.getElementById("hymn-random-btn");
  const hymnControls = document.getElementById("hymn-controls");
  const hymnPlayPause = document.getElementById("hymn-play-pause");
  const hymnVolume = document.getElementById("hymn-volume");
  const hymnAudio = document.getElementById("hymn-audio");
  const hymnNowPlaying = document.getElementById("hymn-now-playing");
  const hymnPrev = document.getElementById("hymn-prev");
  const hymnNext = document.getElementById("hymn-next");
  const hymnLoop = document.getElementById("hymn-loop");

  // Fixed hymn track list wired to assets/music
  // Make sure these file names exist in assets/music/
const HYMN_TRACKS = [
    { title: "Belisarius", src: "assets/music/Belisarius.mp3" },
    { title: "We Praise Thee", src: "assets/music/We Praise Thee.mp3" },
    { title: "My Sinful Soul", src: "assets/music/My Sinful Soul.mp3" },
    { title: "Lord, I have cried unto Thee", src: "assets/music/Lord, I have cried unto Thee.mp3" },
    { title: "Hymn of the Cherubim", src: "assets/music/Hymn of the Cherubim.mp3" },
  ];
;


  let currentHymnIndex = -1;
  let hymnHasStarted = false;
  let hymnLoopEnabled = false;
  const HYMN_BASE_VOLUME = 0.2;

  function pickRandomHymnIndex() {
    if (!HYMN_TRACKS.length) return -1;
    let idx = Math.floor(Math.random() * HYMN_TRACKS.length);
    if (HYMN_TRACKS.length > 1 && idx === currentHymnIndex) {
      idx = (idx + 1) % HYMN_TRACKS.length;
    }
    return idx;
  }


  function nextSequentialIndex() {
    if (!HYMN_TRACKS.length) return -1;
    if (currentHymnIndex === -1) return 0;
    return (currentHymnIndex + 1) % HYMN_TRACKS.length;
  }

  function prevSequentialIndex() {
    if (!HYMN_TRACKS.length) return -1;
    if (currentHymnIndex === -1) return 0;
    return (currentHymnIndex - 1 + HYMN_TRACKS.length) % HYMN_TRACKS.length;
  }

  function showHymnControls() {
    if (hymnControls && !hymnControls.classList.contains("is-visible")) {
      hymnControls.classList.add("is-visible");
    }
  }

  function updateNowPlaying(title) {
    if (!hymnNowPlaying) return;
    hymnNowPlaying.textContent = title ? `Now playing: ${title}` : "";
    hymnNowPlaying.style.display = title ? "block" : "none";
  }

  function fadeVolume(audio, from, to, durationMs, done) {
    if (!audio) {
      if (done) done();
      return;
    }
    const start = performance.now();
    const startVol = from;
    const delta = to - from;

    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const v = startVol + delta * t;
      audio.volume = Math.max(0, Math.min(1, v));
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (done) {
        done();
      }
    }

    requestAnimationFrame(step);
  }

  function playTrackByIndex(idx) {
    if (!hymnAudio || idx < 0 || idx >= HYMN_TRACKS.length) return;
    const track = HYMN_TRACKS[idx];
    currentHymnIndex = idx;

    hymnAudio.src = track.src;
    hymnAudio.load();
    hymnAudio.volume = 0;
    hymnAudio
      .play()
      .then(() => {
        hymnHasStarted = true;
        showHymnControls();
        updateNowPlaying(track.title);
        hymnAudio.loop = false; // we handle looping manually on ended
        if (hymnPlayPause) hymnPlayPause.textContent = "⏸";
        fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 600);
      })
      .catch((err) => {
        console.error("Hymn play failed:", err);
      });
  }


    function playRandomTrackWithFade() {
    if (!hymnAudio || !HYMN_TRACKS.length) return;
    const nextIdx = pickRandomHymnIndex();
    if (nextIdx === -1) return;

    const startNew = () => playTrackByIndex(nextIdx);

    if (!hymnAudio.paused && !hymnAudio.ended && hymnAudio.currentTime > 0) {
      // Cross-fade: fade out current, then start new
      fadeVolume(
        hymnAudio,
        hymnAudio.volume,
        0,
        500,
        () => {
          hymnAudio.pause();
          startNew();
        }
      );
    } else {
      startNew();
    }
  }

  if (hymnAudio) {
    hymnAudio.volume = HYMN_BASE_VOLUME;
  }


  if (hymnButton && hymnAudio) {
    hymnButton.addEventListener("click", () => {
      // First click: start random chant
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }

      // If paused, resume current with a gentle fade-in
      if (hymnAudio.paused) {
        hymnAudio
          .play()
          .then(() => {
            showHymnControls();
            if (hymnPlayPause) hymnPlayPause.textContent = "⏸";
            fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 400);
          })
          .catch((err) => console.error("Hymn play failed:", err));
      } else {
        // Already playing: treat as "next track" with cross-fade
        playRandomTrackWithFade();
      }
    });
  }

  if (hymnPlayPause && hymnAudio) {
    hymnPlayPause.addEventListener("click", () => {
      if (hymnAudio.paused) {
        hymnAudio
          .play()
          .then(() => {
            hymnHasStarted = true;
            showHymnControls();
            hymnPlayPause.textContent = "⏸";
            fadeVolume(hymnAudio, 0, HYMN_BASE_VOLUME, 400);
          })
          .catch((err) => console.error("Hymn play failed:", err));
      } else {
        fadeVolume(hymnAudio, hymnAudio.volume, 0, 300, () => {
          hymnAudio.pause();
          hymnPlayPause.textContent = "▶";
        });
      }
    });
  }

  if (hymnPrev && hymnAudio) {
    hymnPrev.addEventListener("click", () => {
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }
      const idx = prevSequentialIndex();
      if (idx !== -1) {
        playTrackByIndex(idx);
      }
    });
  }

  if (hymnNext && hymnAudio) {
    hymnNext.addEventListener("click", () => {
      if (!hymnHasStarted) {
        playRandomTrackWithFade();
        return;
      }
      const idx = nextSequentialIndex();
      if (idx !== -1) {
        playTrackByIndex(idx);
      }
    });
  }

  if (hymnLoop) {
    hymnLoop.addEventListener("click", () => {
      hymnLoopEnabled = !hymnLoopEnabled;
      hymnLoop.classList.toggle("is-active", hymnLoopEnabled);
    });
  }

  if (hymnVolume && hymnAudio) {
    hymnVolume.value = String(HYMN_BASE_VOLUME);
    hymnVolume.addEventListener("input", () => {
      const v = parseFloat(hymnVolume.value);
      if (!Number.isNaN(v)) {
        hymnAudio.volume = Math.min(1, Math.max(0, v));
      }
    });
  }

  // Continuous shuffle or loop on ended
  if (hymnAudio) {
    hymnAudio.addEventListener("ended", () => {
      if (hymnLoopEnabled && currentHymnIndex !== -1) {
        playTrackByIndex(currentHymnIndex);
      } else {
        playRandomTrackWithFade();
      }
    });
  }

  if (hymnVolume && hymnAudio) {
    hymnVolume.value = String(HYMN_BASE_VOLUME);
    hymnVolume.addEventListener("input", () => {
      const v = parseFloat(hymnVolume.value);
      if (!Number.isNaN(v)) {
        hymnAudio.volume = Math.min(1, Math.max(0, v));
      }
    });
  }

  // Continuous shuffle: when a track ends, automatically go to the next random one
  if (hymnAudio) {
    hymnAudio.addEventListener("ended", () => {
      playRandomTrackWithFade();
    });
  }

// Initial load
  updateCivilDate();
  setToggleUI();
  loadTodayFromAPI();
  updateMonthLabel();
  buildMonthGrid();
  buildDailyPrayers();
});
