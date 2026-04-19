export interface LandingLocale {
  lang: 'es' | 'en' | 'gal'

  nav: {
    login: string
    start: string
  }

  hero: {
    badge: string
    h1: string
    h1highlight: string
    p: string
    ctaGoogle: string
    ctaGoogleLoading: string
    ctaEmail: string
    setup: string
  }

  stats: {
    s1val: string
    s1label: string
    s2val: string
    s2label: string
    s3val: string
    s3label: string
  }

  demo: {
    h2: string
    p: string
    reviews: Array<{
      author: string
      date: string
      text: string
      stars: number
      badge: string
      badgeType: 'negative' | 'positive' | 'neutral'
      tones: {
        profesional: string
        empatico: string
        cercano: string
        directo: string
        agradecido: string
        humoristico: string
      }
    }>
    response: {
      title: string
      cta: string
      hint: string
      toneLabels: {
        profesional: string
        empatico: string
        cercano: string
        directo: string
        agradecido: string
        humoristico: string
      }
    }
  }

  health: {
    h2: string
    p: string
    kpi1: string
    kpi2: string
    kpi3: string
    prevMonth: string
    reviewsOf: string
    newReviews: string
    sentiment: string
    positive: string
    positiveCount: string
    neutral: string
    neutralCount: string
    negative: string
    negativeCount: string
    keywords: string
    kwords: Array<{ w: string; s: 'positive' | 'negative' | 'neutral' }>
    brillaLabel: string
    brillaText: string
    quemaLabel: string
    quemaText: string
    accionLabel: string
    accionText: string
    proBadge: string
  }

  radarPreview: {
    h2: string
    p: string
    competitor: string
    tuNegocio: string
    categories: string[]
    threatLabel: string
    threatHigh: string
    threatMedium: string
    threatLow: string
    proBadge: string
  }

  howto: {
    h2: string
    p: string
    stepLabel: string
    steps: Array<{ title: string; desc: string }>
  }

  forWho: {
    h2: string
    p: string
    sectors: string[]
  }

  pricing: {
    h2: string
    p: string
    monthly: string
    yearly: string
    yearlySave: string
    plans: {
      basic: {
        name: string
        price: string
        desc: string
        features: string[]
        cta: string
      }
      core: {
        name: string
        priceMonthly: string
        priceYearly: string
        priceYearlyMonthly: string
        desc: string
        features: string[]
        cta: string
        badge: string
      }
      pro: {
        name: string
        priceMonthly: string
        priceYearly: string
        priceYearlyMonthly: string
        desc: string
        features: string[]
        cta: string
        badge: string
      }
    }
    perMonth: string
    perYear: string
    vatNote: string
    transversalTitle: string
    transversalItems: string[]
  }

  cta: {
    h2line1: string
    h2line2: string
    p: string
    ctaGoogle: string
    ctaGoogleLoading: string
    setup: string
  }

  footer: {
    rights: string
    privacy: string
    terms: string
    contact: string
  }

  landingEditorial: {
    nav: {
      product: string
      radar: string
      pricing: string
    }
    hero: {
      metaLangs: string
      metaVersion: string
      h1l1: string
      h1l2pre: string
      h1accent: string
      h1l2post: string
      sub: string
      seeDemo: string
      foot: [string, string, string]
      ticker: {
        title: string
        count: string
        tagPositive: string
        tagComplaint: string
        tagRetained: string
        items: Array<{
          av: string
          name: string
          preview: string
          stars: 1 | 2 | 3 | 4 | 5
          tag: 'positive' | 'complaint' | 'retained'
        }>
      }
    }
    stats: {
      s4val: string
      s4label: string
    }
    sections: {
      product: string
      intel: string
      health: string
      flow: string
      who: string
      pricing: string
      start: string
    }
    sectionsHelp: {
      product: string
      intel: string
      health: string
      pricing: string
    }
    data: {
      label: string
      h2l1: string
      h2l2: string
      lede: string
      items: Array<{ num: string; text: string; src: string }>
    }
    compare: {
      label: string
      lede: string
      headers: [string, string, string]
      priceRow: { lbl: string; values: [string, string, string] }
      rows: Array<{ lbl: string; values: [boolean, boolean, boolean] }>
      foot: string
    }
    faq: {
      label: string
      h2l1: string
      h2l2: string
      items: Array<{ q: string; a: string }>
    }
    founding: {
      label: string
      headline: string
      meta: string
      codeLabel: string
      code: string
      copy: string
      copied: string
    }
    demo: {
      h2l1: string
      h2l2: string
      lede: string
      reviewLabel: string
      responseLabel: string
      statusReady: string
      statusGenerating: string
      languageLabel: string
      respondInGoogle: string
    }
    radar: {
      h2l1: string
      h2l2: string
      lede: string
      tuNegocio: string
      headerBiz: string
      catCocina: string
      catServicio: string
      catAmbiente: string
      catPrecio: string
      competitors: [string, string, string]
      actionLbl: string
      actionTxt: string
      strengthLbl: string
      strengthTxt: string
      opportunityLbl: string
      opportunityTxt: string
      proBadge: string
    }
    health: {
      h2l1: string
      h2l2: string
      lede: string
      kpi4lbl: string
      kpi4val: string
      kpi4sub: string
    }
    howto: {
      h2l1: string
      h2l2: string
      lede: string
    }
    forWho: {
      h2l1: string
      h2l2: string
      lede: string
      sectors: string[]
    }
    pricing: {
      h2l1: string
      h2l2: string
      lede: string
      basicForever: string
      perMonth: string
      perYear: string
    }
    cta: {
      sectionLbl: string
      h2l1: string
      h2l2: string
      sub: string
      foot: string
    }
    footer: {
      tagline: string
      productCol: string
      legalCol: string
      productLinks: Array<{ label: string; href: string }>
      legalLinks: Array<{ label: string; href: string }>
      bottomLeft: string
      bottomRight: string
    }
  }

  app: {
    common: {
      logout: string
      save: string
      saving: string
      saved: string
      loading: string
      error: string
      back: string
      cancel: string
      copy: string
      copied: string
    }

    inicio: {
      greeting: string
      subtitle: string
      cards: {
        reviews: { title: string; desc: string }
        health: { title: string; desc: string }
        config: { title: string; desc: string }
      }
    }

    dashboard: {
      title: string
      syncBtn: string
      syncLoading: string
      syncDone: string
      syncNone: string
      pendingEmpty: string
      pendingEmptyDesc: string
      generateBtn: string
      generating: string
      markAnswered: string
      markPending: string
      ignore: string
      allTab: string
      pendingTab: string
      answeredTab: string
      ignoredTab: string
      copyBtn: string
      copiedBtn: string
      goToGoogle: string
      manualTitle: string
      manualDesc: string
      manualPlaceholder: string
      manualBtn: string
      manualBtnLoading: string
      manualLabel: string
      desc: string
      urgent: string
      anonymous: string
      noText: string
      syncSteps: string[]
      syncTips: string[]
      statuses: {
        activo: string
        pendiente: string
        suspendido: string
      }
      filters: {
        pending: string
        answered: string
        ignored: string
        all: string
      }
      reviewCount: string
      backToList: string
      selectReview: string
      selectReviewDesc: string
      iaBar: {
        title: string
        limitReached: string
        limitBasic: string
        limitCore: string
        viewPlans: string
      }
      defaultBusinessName: string
      softCap: {
        title: string
        desc: string
      }
      empty: {
        allDone: string
        noMatch: string
        allDoneDesc: string
        noMatchDesc: string
      }
      retention: {
        title: string
        desc: string
        intoxicacion: string
        maltrato: string
        amenaza_legal: string
        datos_personales: string
        acusacion_fraude: string
        discriminacion: string
        unknown: string
      }
      manual: {
        title: string
        desc: string
        placeholder: string
        toneSelect: string
        toneNames: {
          profesional: string
          cercano: string
          directo: string
        }
        savePending: string
        saveAnswered: string
        saving: string
        selectTone: string
        tryAnother: string
      }
      context: {
        clientSaid: string
        youRespond: string
      }
      upsell: {
        titleBasic: string
        titleCore: string
        titlePro: string
        descBasic: string
        descCore: string
        descPro: string
        pendingMsg: string
        pendingDesc: string
        btnPro: string
        btnCore: string
        btnClose: string
        keepLimit: string
      }
      actions: {
        generateIA: string
        generating: string
        copyResponse: string
        copied: string
        publishGoogle: string
        publishGoogleDisabled: string
        respondGoogle: string
        respondGoogleTitle: string
        comingSoon: string
        otherPlatform: string
        sync: string
        answered: string
        reopen: string
      }
      states: {
        answeredGoogle: string
        answeredIA: string
        loadResponse: string
        noResponse: string
        retainedBadge: string
        retainedTitle: string
        retainedDesc: string
        otherPlatformBadge: string
      }
    }

    salud: {
      title: string
      upgradeTitle: string
      upgradeDesc: string
      upgradeBtn: string
      totalReviews: string
      responseRate: string
      timeSaved: string
      improvement: string
      sentiment: string
      positive: string
      neutral: string
      negative: string
      analysisTitle: string
      analysisBrilla: string
      analysisQuema: string
      analysisAccion: string
      generateAnalysis: string
      generatingAnalysis: string
      noAnalysis: string
      // Panel headers
      panelTitle: string
      panelTitleFull: string
      panelTitleFullProOnly: string
      yourAvgRating: string
      globalAvgRating: string
      avgRating: string
      basedOnNReviews: string
      thisMonth: string
      reviewsThisMonth: string
      responded: string
      notResponded: string
      viewPending: string
      trend: string
      sentimentDistribution: string
      sentimentTooltip: string
      positiveLabel: string
      neutralLabel: string
      negativeLabel: string
      newReviews: string
      nReviews: string
      responseRateLabel: string
      ofTotal: string
      vsLastMonth: string
      noPriorData: string
      // Teaser (basic/core)
      nReviewsNotResponded: string
      analysisIATellsYou: string
      fullPanelDesc: string
      lockedAnalysisIA: string
      lockedRadar: string
      lockedSentimentCategory: string
      lockedPdfReports: string
      unlockWithPro: string
      upgradeToPro: string
      // Impacto Velacre
      impactTitle: string
      impactTooltip: string
      reviewsResponded: string
      timeSavedLabel: string
      seoOptimization: string
      seoTooltip: string
      vsManual: string
      keywordUsesInResponses: string
      keywordsUsedInAIResponses: string
      withIA: string
      // Velocidad de respuesta
      responseSpeed: string
      responseSpeedTooltip: string
      avgResponse: string
      respondedIn48h: string
      respondedIn24h: string
      betweenReviewAndResponse: string
      googleMapsThreshold: string
      ofNResponded: string
      // Evolución
      thisMonthVsLast: string
      noVariation: string
      monthlyEvolution: string
      tableMonth: string
      tableReviews: string
      tableRating: string
      tablePositive: string
      tableNegative: string
      tableResponded: string
      currentLabel: string
      pctPositive: string
      pctNegative: string
      // Análisis IA Pro
      aiLimitReached: string
      generating: string
      // Radar
      radarTitle: string
      radarTooltip: string
      radarSubtitle: string
      noCompetitorsAdded: string
      searchBusinessPlaceholder: string
      deleteLabel: string
      reAnalyze: string
      analyzeNow: string
      nextAnalysisAvailable: string
      yourStrength: string
      yourWeakness: string
      competitorHeader: string
      strengthHeader: string
      weaknessHeader: string
      threatHeader: string
      opportunities: string
      actionThisWeek: string
      sentimentByCategory: string
      categoryHeader: string
      youHeader: string
      insightHeader: string
      strategicAction: string
      compLabel: string
      // Radar steps
      radarStepFetchingYours: string
      radarStepFetchingComp: string
      radarStepAnalyzing: string
      radarStepGenerating: string
      radarNavHint: string
      // Radar errors
      radarMaxCompetitors: string
      radarAlreadyAdded: string
      radarRemoveError: string
      radarNoCompetitors: string
      radarNoOwnReviews: string
      radarAlreadyAnalyzed: string
      radarAnalyzeError: string
      // PDF
      pdfMonth: string
      pdfYear: string
      pdfGenerating: string
    }

    settings: {
      title: string
      businessSection: string
      profileSection: string
      planSection: string
      toneSection: string
      toneSubtitle: string
      googleSection: string
      googleDesc: string
      googleConnected: string
      googleNotConnected: string
      saveBtn: string
      savedMsg: string
      nameLabel: string
      businessNameLabel: string
      emailLabel: string
      phoneLabel: string
      descLabel: string
      descPlaceholder: string
      monthly: string
      yearly: string
      tonos: {
        Profesional: { label: string; desc: string }
        Empatico: { label: string; desc: string }
        Cercano: { label: string; desc: string }
        Directo: { label: string; desc: string }
        Agradecido: { label: string; desc: string }
        Humoristico: { label: string; desc: string }
      }
      planCurrent: string
      planThanks: string
      planChoose: string
      planCore: string[]
      planPro: string[]
      planRecommended: string
      planRedirecting: string
      planChooseCore: string
      planChoosePro: string
      planStartCore: string
      planStartPro: string
      loadError: string
      saveError: string
      checkoutError: string
      seoLabel: string
      seoDesc: string
      seoPlaceholder: string
      manageSub: string
      manageSubDesc: string
      statusCancelled: string
      statusPastDue: string
      statusActive: string
      nextRenewal: string
      upgradeToProTitle: string
      upgradeToProDesc: string
      gbpComingSoon: string
      gbpConnectedMsg: string
      gbpLocationError: string
      gbpOauthError: string
      gbpConnectError: string
      gbpDisconnectedMsg: string
      gbpDisconnectError: string
      gbpFinalizeError: string
      gbpDisconnectTitle: string
      gbpDisconnectWarning: string
      gbpDisconnectWarningDesc: string
      gbpDisconnectConfirmMsg: string
      gbpDisconnectCancel: string
      gbpDisconnectConfirm: string
      gbpDisconnecting: string
      gbpConnecting: string
      gbpConnectBtn: string
      gbpConnectedLabel: string
      gbpConnectedSub: string
      gbpNotConnectedLabel: string
      gbpOutscraperNote: string
      gbpLocationTitle: string
      gbpLocationDesc: string
      gbpLocationConfirm: string
      gbpLocationConnecting: string
      dangerZone: {
        title: string
        cancelSub: string
        cancelSubDesc: string
        cancelSubContact: string
        cancelSubConfirm: string
        deleteAccount: string
        deleteAccountDesc: string
        deleteConfirmTitle: string
        deleteConfirmWarning: string
        deleteConfirmLabel: string
        deleteConfirmPlaceholder: string
        deleteConfirmKeyword: string
        deleteBtn: string
        deletingMsg: string
        cancelBtn: string
      }
    }

    auth: {
      login: {
        title: string
        subtitle: string
        email: string
        password: string
        loginBtn: string
        loginLoading: string
        error: string
        googleBtn: string
        googleLoading: string
        forgotPassword: string
        resetIntro: string
        resetEmail: string
        resetBtn: string
        resetLoading: string
        resetSent: string
        resetSentDesc: string
        resetBack: string
        noAccount: string
        register: string
        privacyNote: string
        orDivider: string
      }
      register: {
        title: string
        subtitle: string
        name: string
        email: string
        password: string
        passwordHint: string
        registerBtn: string
        registerLoading: string
        error: string
        errorAlreadyRegistered: string
        googleBtn: string
        googleLoading: string
        orDivider: string
        hasAccount: string
        login: string
        privacyNote: string
        privacyLink: string
      }
      resetPassword: {
        title: string
        subtitle: string
        newPasswordLabel: string
        repeatPasswordLabel: string
        placeholder: string
        saveBtn: string
        savingBtn: string
        passwordMismatch: string
        updateError: string
        successTitle: string
        successRedirecting: string
      }
    }

    onboarding: {
      title: string
      subtitle: string
      setupLabel: string
      placeLabel: string
      placeSubtitle: string
      placePlaceholder: string
      placeSkip: string
      toneLabel: string
      descLabel: string
      descOptional: string
      descPlaceholder: string
      descHint: string
      submitBtn: string
      submitLoading: string
      steps: string[]
      progress: string
      planTitle: string
      planSubtitle: string
      planMonthly: string
      planYearly: string
      planSkip: string
      planSkipNote: string
      planRedirecting: string
      planRecommended: string
      planChooseCore: string
      planChoosePro: string
    }

    help: {
      title: string
      tooltip: string
      steps: Array<{ title: string; body: string }>
      prev: string
      next: string
      done: string
    }

    report: {
      title: string
      desc: string
      successTitle: string
      successDesc: string
      reference: string
      close: string
      observationsLabel: string
      observationsPlaceholder: string
      showDetails: string
      hideDetails: string
      sourceLabel: string
      messageLabel: string
      statusLabel: string
      endpointLabel: string
      errorIdLabel: string
      attachNote: string
      send: string
      sending: string
    }

    errors: {
      pageTitle: string
      pageDesc: string
      appTitle: string
      appDesc: string
      reload: string
      reportBtn: string
      retry: string
      serverError: string
    }

    sectionNav: {
      reviews: string
      health: string
      settings: string
    }

    waitlistModal: {
      coreDesc: string
      proDesc: string
      upgradeTo: string
      notNow: string
      redirecting: string
      activate: string
      paymentError: string
    }

    callback: {
      loggingIn: string
      error: string
      backToLogin: string
    }

    onboardingPage: {
      loadLocalesError: string
      oauthAccessDenied: string
      oauthNoLocations: string
      oauthStateInvalid: string
      oauthGenericError: string
      writeBusinessName: string
      googleConnected: string
      importingReviews: string
      selectYourLocal: string
      multipleLocalsFound: string
      loadingLocals: string
      backToOnboarding: string
      connectThisLocal: string
      connecting: string
      seoLabel: string
      seoOptional: string
      seoHint: string
      seoPlaceholder: string
      chooseConnection: string
      comingSoon: string
      googleBusiness: string
      googleBusinessDesc: string
      manualSearch: string
      manualSearchDesc: string
      change: string
      googleBusinessLabel: string
      manualLabel: string
      businessNameLabel: string
      businessNamePlaceholder: string
      googlePermissionNote: string
      connectGoogleBusiness: string
      finalizeError: string
      showingNofM: string
      refineSearch: string
    }

    planPage: {
      paymentError: string
      free: string
      noCard: string
      featuresBasic: string[]
      continueFree: string
      coreYearlyNote: string
      proYearlyNote: string
      startCore: string
      startPro: string
    }

    admin: {
      badgeActivo: string
      badgePrueba: string
      badgePruebaExp: string
      badgeSuspendido: string
      optActivo: string
      optPrueba: string
      optSuspendido: string
      trialDays: string
      days: string
      custom: string
      expires: string
      error401: string
      saving: string
      confirmChange: string
      confirm: string
      activate: string
      deactivate: string
      noLimit: string
      withExpiry: string
      overrideActiveUntil: string
      notesPlaceholder: string
      notesAdminOnly: string
      saveNotes: string
      noBusinessAssociated: string
      searchGooglePlaces: string
      confirmBusinessChange: string
      currentBusiness: string
      businessNamePlaceholder: string
      selectFromList: string
      moreResults: string
      headerTitle: string
      kpiActivos: string
      kpiPrueba: string
      kpiSuspendidos: string
      kpiPro: string
      kpiCore: string
      kpiTotal: string
      users: string
      searchPlaceholder: string
      filterAll: string
      filterActivos: string
      filterPrueba: string
      filterSuspendidos: string
      noResults: string
      noUsers: string
      updating: string
      update: string
      exit: string
      loadError: string
      updateError: string
      registro: string
      trialUntil: string
      overrideUntil: string
      noName: string
      noBusiness: string
      btnEstado: string
      btnProOverride: string
      btnPlan: string
      btnNotas: string
      btnPlaceId: string
    }

    miniRadar: {
      stepFetching: string
      stepAnalyzing: string
      stepRendering: string
      stepDone: string
      stepError: string
      headerTitle: string
      headerSubtitle: string
      backAdmin: string
      generateReport: string
      reportDesc: string
      searchLabel: string
      searchPlaceholder: string
      searchHint: string
      showingNofM: string
      refineSearch: string
      generating: string
      generateBtn: string
      newReport: string
      errorTitle: string
      unknownError: string
      selectFirst: string
      ratingLabel: string
      reviewsAnalyzed: string
      pctResponded: string
      analyzedBusiness: string
      emailPitchTitle: string
      emailPitchDesc: string
      copy: string
      copied: string
      strengthsTitle: string
      weaknessesTitle: string
      complaintsTitle: string
      pdfDownloaded: string
      pdfDownloadHint: string
      loading: string
    }

    legal: {
      privacy: {
        title: string
        lastUpdated: string
        s1Title: string
        s1p1: string
        s1p2: string
        s2Title: string
        s2intro: string
        s2items: string[]
        s2note: string
        s3Title: string
        s3headers: [string, string]
        s3rows: [string, string][]
        s4Title: string
        s4intro: string
        s4items: string[]
        s4note: string
        s5Title: string
        s5intro: string
        s5items: string[]
        s6Title: string
        s6intro: string
        s6rights: string[]
        s6exercise: string
        s6complaint: string
        s7Title: string
        s7text: string
        s8Title: string
        s8text: string
        s9Title: string
        s9text: string
      }
      terms: {
        title: string
        lastUpdated: string
        sections: Array<{
          title: string
          paragraphs: string[]
          items?: string[]
        }>
      }
      contact: {
        title: string
        subtitle: string
        generalEmail: string
        generalEmailDesc: string
        generalEmailNote: string
        privacyEmail: string
        privacyEmailDesc: string
        locationTitle: string
        locationAddress: string
        faqTitle: string
        faqs: Array<{ q: string; a: string }>
      }
      login: string
      start: string
      footerRights: string
      footerPrivacy: string
      footerTerms: string
      footerContact: string
    }

    inicioPage: {
      planBasic: string
      planCore: string
      planPro: string
      welcome: string
    }
  }
}
