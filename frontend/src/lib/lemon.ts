const MONTHLY_VARIANT = process.env.NEXT_PUBLIC_LEMON_BASIC_VARIANT_ID ?? ''
const PRO_VARIANT = process.env.NEXT_PUBLIC_LEMON_PRO_VARIANT_ID ?? ''

export function getLemonCheckoutUrl(userId: string, plan: 'basic' | 'pro'): string {
  const variantId = plan === 'pro' ? PRO_VARIANT : MONTHLY_VARIANT
  if (!variantId) return 'https://velacre.com' // fallback
  return `https://app.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][user_id]=${userId}`
}
