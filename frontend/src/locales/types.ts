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
    review: {
      date: string
      text: string
      negativeBadge: string
    }
    response: {
      title: string
      toneBadge: string
      cta: string
      hint: string
      text: string
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
        Cercano: { label: string; desc: string }
        Directo: { label: string; desc: string }
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
        googleBtn: string
        googleLoading: string
        orDivider: string
        hasAccount: string
        login: string
        privacyNote: string
        privacyLink: string
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
  }
}
